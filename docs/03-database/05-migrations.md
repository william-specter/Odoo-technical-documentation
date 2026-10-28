# Database Design V — Migrations, Upgrades, and Data Evolution

> **Reality check.** Odoo's schema synchroniser is additive and conservative. It will add columns and indexes; it will not rename, drop, or transform data. A production upgrade without a migration plan is a data-loss event waiting for a trigger.

---

## 1. Upgrade surfaces

| Surface | Changed by | Migration mechanism |
|---|---|---|
| Python model/fields | module code | schema sync + migration scripts |
| Data records | XML/CSV data files | `noupdate`, `ir.model.data` |
| Views/actions | XML data files | `noupdate`, view inheritance |
| SQL constraints | `_sql_constraints` / `models.Constraint` | created on upgrade; may fail on dirty data |
| Indexes | `index=` / `models.Index` | created/dropped by registry |
| Translations | `.po` files | loaded on upgrade |
| Assets | manifest `assets` | rebuilt bundle (no DB migration) |
| Configuration | `ir.config_parameter`, company fields | custom script |
| External integrations | API contracts | versioned adapters |

---

## 2. Standard upgrade pipeline

```bash
# stop the service or drain workers
odoo-bin -c /etc/odoo/odoo.conf -d mydb -u all --stop-after-init
# restart
```

The pipeline (`modules/loading.py:340`):

1. load `base`,
2. read `ir_module_module` list,
3. build the module graph in `update` mode,
4. for each module:
   - run `migrations/<version>/pre-*.py`,
   - load model definitions and set up fields,
   - synchronise schema (`init_models`),
   - load data files (`init` or `update` mode),
   - run `migrations/<version>/post-*.py`,
   - run `post_init_hook`,
   - write `state='installed'`, `latest_version`,
5. after all modules: `end-*.py` scripts,
6. run `base` post-init, translations, and tests if enabled.

**[WARNING]** `-u all` upgrades every installed module. It is the most common cause of long, risky upgrades. Prefer targeted `-u module1,module2` for custom modules, and a full upgrade only for major version changes.

---

## 3. Module migration scripts

### 3.1 Directory layout

```
my_module/
└── migrations/
    ├── 19.0.1.1/
    │   ├── pre-migrate_data.py
    │   └── post-fill_new_field.py
    ├── 19.0.2.0/
    │   └── post-recompute.py
    └── 0.0.0/
        └── end-assert_invariants.py
```

| Stage | Runs | Use |
|---|---|---|
| `pre-` | before schema sync | drop/rename columns, create temp tables, clean data that would block a constraint |
| `post-` | after schema sync and data load | backfill new columns, recompute, map records |
| `end-` | after all modules | cross-module fixes, final invariants |

`0.0.0` scripts run on any version change: `pre` first, `post`/`end` last.

### 3.2 Script contract

```python
def migrate(cr, version):
    if not version:
        return  # fresh install
    cr.execute("""
        UPDATE my_table
        SET new_column = old_column
        WHERE new_column IS NULL
    """)
```

- Signature must be exactly `(cr, version)` (or `(_cr, _version)`).
- `version` is the installed version before the upgrade.
- Use raw SQL, not the ORM, in `pre` scripts: the registry may not match the old schema.
- In `post` scripts, the ORM is available but the model may still be mid-upgrade; use `env` carefully.
- Scripts are executed in filename order.
- A failing script aborts the upgrade; the transaction is rolled back for that module.

### 3.3 Version matching

`MigrationManager` compares the installed version with the manifest version and runs every script in the range. It handles:

- module versions (`19.0.1.1`),
- server-prefixed versions (`19.0.1.1` on a 19.0 server),
- major-less versions (`1.1` applies within the same major),
- `0.0.0` for all changes.

### 3.4 Where scripts live

- `my_module/migrations/` — preferred for custom modules.
- `odoo/upgrade/<module>/` — private upgrade path, used by Odoo SA/partners; not present in the standard source tree.
- `--pre-upgrade-scripts` — run arbitrary scripts before the upgrade (CLI option).

---

## 4. Data files and `noupdate`

### 4.1 Semantics

```xml
<odoo>
  <data noupdate="1">
    <record id="my_config" model="ir.config_parameter">
      <field name="key">my.module.enabled</field>
      <field name="value">1</field>
    </record>
  </data>
</odoo>
```

- `noupdate="1"`: create on install, **never update** on upgrade.
- `noupdate="0"`: create on install, update on upgrade (fields are overwritten).
- `ir.model.data.noupdate` stores the flag.
- `env.ref('module.xmlid').toggle_noupdate(...)` flips it at runtime.

**[INVARIANT]** Never rely on an XML data file to update a user-edited record on upgrade. If the record is `noupdate=1`, your change will not apply; write a migration script instead.

### 4.2 XML ID stability

- Renaming an XML ID creates a new record and orphans the old one.
- Deleting an XML ID from XML does not delete the record; it remains in the DB.
- Duplicate XML IDs across modules are a hard error.
- Use `forcecreate="false"` to avoid recreating deleted records.

---

## 5. Schema migration patterns

### 5.1 Add a required field

```python
# 1. add field as optional
new_code = fields.Char()

# 2. post-migration: backfill
def migrate(cr, version):
    if not version:
        return
    cr.execute("UPDATE my_table SET new_code = COALESCE(old_code, 'MIGRATED') WHERE new_code IS NULL")

# 3. later module: mark required=True
```

Never add `required=True` to an existing non-empty table without a default/backfill; PostgreSQL rejects the NOT NULL constraint.

### 5.2 Rename a field

```python
# Step 1: add new field, keep old
new_name = fields.Char()

# Step 2: pre-migration copies data
def migrate(cr, version):
    cr.execute("UPDATE my_table SET new_name = old_name")

# Step 3: switch code to new_name

# Step 4 (later): drop old column
def migrate(cr, version):
    cr.execute("ALTER TABLE my_table DROP COLUMN IF EXISTS old_name")
```

### 5.3 Change a field type

```python
def migrate(cr, version):
    cr.execute("""
        ALTER TABLE my_table
        ALTER COLUMN amount TYPE numeric(16,4)
        USING amount::numeric(16,4)
    """)
```

Test with production-like data; casts can fail on empty strings, out-of-range values, or nulls.

### 5.4 Remove a field

Odoo keeps the column. To reclaim space:

```python
def migrate(cr, version):
    cr.execute("ALTER TABLE my_table DROP COLUMN IF EXISTS obsolete_column")
```

Do this only after confirming no external report/integration reads the column.

### 5.5 Change `_inherits`

1. add the delegate field,
2. backfill the FK (create parent records if needed),
3. move data from old columns,
4. drop old columns,
5. change `_inherits` in code.

### 5.6 Change `_parent_store`

If `_parent_store` is enabled on an existing model:

1. add `parent_path` column,
2. compute it with a recursive CTE,
3. add the index.

Odoo's `_parent_store_compute` can do this during `init_models`, but it must run after the column exists.

---

## 6. Data migration strategies

### 6.1 Batch processing

```python
def migrate(cr, version):
    cr.execute("SELECT id FROM my_table WHERE new_col IS NULL ORDER BY id")
    while rows := cr.fetchmany(1000):
        ids = [r[0] for r in rows]
        cr.execute("""
            UPDATE my_table SET new_col = ...
            WHERE id = ANY(%s)
        """, (ids,))
        cr.commit()   # allowed in migration scripts
```

Long migrations should commit in batches to avoid enormous transactions and lock time.

### 6.2 ORM vs SQL

| Use ORM when | Use SQL when |
|---|---|
| you need computes, translations, mail tracking | bulk updates, schema changes |
| the model is stable and loaded | `pre` stage, old schema |
| volume is small | volume is large |
| you need access rules (usually sudo) | performance matters |

In `post` scripts, `env = api.Environment(cr, SUPERUSER_ID, {})` is available; use `env['model'].search(...)` for correctness, SQL for speed.

### 6.3 Idempotency

Every migration must be safe to re-run:

- `IF NOT EXISTS` for DDL,
- `WHERE new_col IS NULL` for backfills,
- `ON CONFLICT DO NOTHING` for inserts,
- guard on `version` if the script only applies to a range.

A failed upgrade is often retried; non-idempotent scripts corrupt data.

---

## 7. OpenUpgrade

OpenUpgrade is the community project that provides migration scripts between major Odoo versions. It is **not** part of core.

Typical flow:

1. clone OpenUpgrade for the target version,
2. add it to `addons-path`,
3. run `odoo-bin -d db --update all --load=base,web,openupgrade_framework`,
4. run version-specific scripts (`openupgrade_scripts`),
5. validate.

Caveats:

- coverage varies by module and version,
- enterprise modules are not covered,
- custom modules need their own scripts,
- OpenUpgrade assumes a standard schema; heavy customisations may break it.

---

## 8. Testing an upgrade

### 8.1 Pre-flight

- [ ] Full backup (DB + filestore).
- [ ] Restore into a staging environment with the same PostgreSQL version.
- [ ] Inventory installed modules and custom code.
- [ ] Run `odoo-bin -d staging --stop-after-init` to detect registry errors.
- [ ] Check `ir_model_fields` for manual/studio fields.
- [ ] Check `ir_model_data` for `noupdate` records that must change.
- [ ] Check custom SQL views/reports for removed columns.

### 8.2 During

- [ ] Run upgrade with `--log-level=info` and capture logs.
- [ ] Monitor PostgreSQL locks and long transactions.
- [ ] Stop on first error; do not continue with a partially upgraded DB.
- [ ] Verify module states (`ir_module_module.state`).

### 8.3 Post-flight

- [ ] Run Odoo tests (`--test-enable`) for custom modules.
- [ ] Smoke-test critical flows: SO → delivery → invoice → payment; PO → receipt → bill; MO → done.
- [ ] Verify accounting balance and trial balance.
- [ ] Verify stock valuation and quant totals.
- [ ] Check attachments open.
- [ ] Check cron jobs are active and scheduled.
- [ ] Compare row counts and key totals before/after.

---

## 9. Rollback strategy

Odoo has **no built-in rollback**. Options:

| Strategy | Cost | Risk |
|---|---|---|
| Restore DB + filestore backup | downtime | loses data written after backup |
| Blue/green with two databases | infrastructure | sync complexity |
| Logical replica + cutover | setup | replication lag |
| Module-level downgrade | none (not supported) | schema/data inconsistency |

**[INVARIANT]** Take a verified backup immediately before the upgrade and test the restore. A backup that has never been restored is a hypothesis, not a backup.

---

## 10. Neutralisation

`modules/neutralize.py` runs `data/neutralize.sql` for each installed module. It is used when copying a production database to a non-production environment:

- disables email servers,
- disables payment providers,
- changes cron frequencies,
- clears API keys/webhooks,
- resets branding.

```bash
odoo-bin neutralize -d copied_db
```

**[WARNING]** Neutralisation is module-specific. A custom module with an external integration must ship its own `data/neutralize.sql`, or the copied environment will call production APIs.

---

## 11. Migration anti-patterns

| Anti-pattern | Consequence |
|---|---|
| `-u all` on every deployment | long downtime, unnecessary schema churn |
| Editing XML data without `noupdate` awareness | change silently not applied |
| Adding `required=True` without backfill | upgrade fails on existing rows |
| Dropping columns before code stops using them | runtime errors |
| Non-idempotent migration | retry corrupts data |
| Committing every row | slow, lock-heavy |
| Ignoring filestore | broken attachments |
| No restore test | rollback impossible |
| Migrating on the primary without a replica | extended outage |
| Skipping custom module tests | regressions reach production |

---

## 12. Evidence index

| Topic | File |
|---|---|
| Migration manager | `modules/migration.py:1-260` |
| Script contract | `modules/migration.py:200-260` |
| Upgrade pipeline | `modules/loading.py:340-520` |
| `noupdate` | `addons/base/models/ir_model.py:2237-2450` |
| Neutralisation | `modules/neutralize.py` |
| Schema sync | `orm/models.py:3170-3260` |
| Registry init | `orm/registry.py:750-830` |
| Version parsing | `odoo/tools/parse_version.py` |

Continue with Volume 4: module relationships.
