# Database Design I — Conventions, Schema Generation, and Storage

> **Scope.** Physical PostgreSQL schema produced by the Odoo 19 ORM. This is the source of truth for DBAs, report writers, and migration engineers.

---

## 1. Table naming

| Rule | Example |
|---|---|
| Model name with dots → underscores | `sale.order` → `sale_order` |
| Explicit `_table` overrides | `ir.actions.server` → `ir_act_server` |
| Many2many relation table | `<table1>_<table2>_rel` (tables sorted alphabetically) |
| Relation columns | `<table1>_id`, `<table2>_id` |
| Index name | `<table>__<column>_index` |
| Constraint name | `<table>_<object_name>` |
| SQL view model | `_auto = False`, `_table_query` |
| Max identifier length | 63 bytes (PostgreSQL); Odoo validates |

Source: `orm/model_classes.py:266`, `orm/fields_relational.py:1291`, `tools/sql.py:783`, `orm/utils.py:97`.

**[WARNING]** Long module prefixes plus long model names can exceed 63 bytes. Odoo raises `ValidationError` at registry build; shorten the model name or set `_table` explicitly.

### 1.1 Magic columns

Every `_auto=True`, `_log_access=True` model has:

| Column | Type | Meaning |
|---|---|---|
| `id` | `SERIAL` / `INTEGER` | primary key |
| `create_uid` | `INTEGER` FK `res_users` | creator |
| `create_date` | `TIMESTAMP` | creation time (UTC) |
| `write_uid` | `INTEGER` FK `res_users` | last writer |
| `write_date` | `TIMESTAMP` | last write time (UTC) |

`_log_access=False` removes the four audit columns (used for high-volume log/transient tables). `_auto=False` removes the table entirely.

Source: `orm/models.py:262-297`.

### 1.2 Model metadata columns

| Model | Table | Purpose |
|---|---|---|
| `ir_model` | `ir_model` | model registry mirror |
| `ir_model_fields` | `ir_model_fields` | field registry mirror |
| `ir_model_data` | `ir_model_data` | XML IDs (`module`, `name`, `model`, `res_id`, `noupdate`) |
| `ir_model_constraint` | `ir_model_constraint` | SQL constraints |
| `ir_model_relation` | `ir_model_relation` | many2many relation metadata |
| `ir_attachment` | `ir_attachment` | file metadata + storage reference |
| `ir_ui_view` | `ir_ui_view` | views (arch XML/HTML) |
| `ir_act_window` / `ir_act_server` | ... | actions |
| `ir_rule` / `ir_model_access` | ... | security |
| `ir_config_parameter` | `ir_config_parameter` | key/value config |

---

## 2. Column types

| Odoo field | PostgreSQL type | Notes |
|---|---|---|
| `Char` | `VARCHAR` | unlimited unless `size` |
| `Text` / `Html` | `TEXT` | HTML is sanitised at render, not storage |
| `Integer` | `INTEGER` | |
| `Float` | `DOUBLE PRECISION` / `NUMERIC` | digits/precision from `decimal.precision` |
| `Monetary` | `NUMERIC` | currency in related field |
| `Boolean` | `BOOLEAN` | |
| `Date` | `DATE` | |
| `Datetime` | `TIMESTAMP` | stored UTC, displayed in user TZ |
| `Selection` | `VARCHAR` | values validated in Python, not DB |
| `Many2one` | `INTEGER` + FK | `ondelete` policy |
| `One2many` | no column | inverse FK on child |
| `Many2many` | relation table | composite PK, reverse index |
| `Binary` | `BYTEA` or filestore | `attachment=True` → filestore |
| `Json` | `JSONB` | |
| `Properties` | `JSONB` | schema stored in definition |
| `Translate=True` | `JSONB` | `{lang: value}` |
| `Company-dependent` | `JSONB` | `{company_id: value}` |

### 2.1 Translated columns

```sql
-- current language, fallback to en_US
SELECT COALESCE(name->>'fr_FR', name->>'en_US') FROM product_template;

-- all translations
SELECT name FROM product_template;
```

Odoo's ORM uses `->>'lang'` for reads and `jsonb` merge for writes. Indexes on translated columns are trigram GIN indexes over all values.

### 2.2 Company-dependent columns

```sql
-- value for company 2, fallback to default if absent
SELECT COALESCE(property_account_income_id->'2', 'null'::jsonb)
FROM product_category;
```

The column stores JSONB even for numeric/boolean fields. Type casts are required:

```sql
SELECT (property_account_income_id->>'2')::int FROM product_category;
```

---

## 3. Primary keys, foreign keys, and constraints

### 3.1 Primary keys

- Always `id SERIAL PRIMARY KEY`.
- No composite PKs except many2many relation tables.
- No UUIDs by default; external systems should use `ir.model.data` or a unique business key.

### 3.2 Foreign keys

Created for:

- `Many2one` fields (unless `_auto=False` or the target is a SQL view),
- `Many2many` relation columns (both directions),
- `_inherits` delegate fields.

`ondelete` values:

| Value | SQL | Effect |
|---|---|---|
| `cascade` | `ON DELETE CASCADE` | delete children |
| `restrict` | `ON DELETE RESTRICT` | block parent delete |
| `set null` | `ON DELETE SET NULL` | null the FK |
| `set default` | `ON DELETE SET DEFAULT` | default value |

Default for `Many2one` is `set null`. For required fields, use `restrict` or `cascade` explicitly.

### 3.3 SQL constraints

```python
_sql_constraints = [
    ('code_uniq', 'UNIQUE(code)', 'Code must be unique'),
]
```

or the v19 declarative form:

```python
_code_uniq = models.Constraint('UNIQUE(code)', 'Code must be unique')
```

Constraint names are prefixed with the table: `sale_order_code_uniq`. They are reflected in `ir_model_constraint`.

### 3.4 Check constraints

```python
_check_positive = models.Constraint('CHECK(amount >= 0)', 'Amount must be positive')
```

Use for invariants that must hold even under raw SQL/imports. Do not duplicate every Python constraint; reserve SQL for data integrity that must survive bypasses.

---

## 4. Many2many relation tables

Implicit:

```
sale_order_sale_order_line_rel
├── sale_order_id INTEGER NOT NULL
├── sale_order_line_id INTEGER NOT NULL
├── PRIMARY KEY (sale_order_id, sale_order_line_id)
└── INDEX (sale_order_line_id, sale_order_id)
```

Explicit:

```python
tag_ids = fields.Many2many(
    'res.partner.category',
    relation='my_model_tag_rel',
    column1='my_model_id',
    column2='tag_id',
    ondelete='cascade',
)
```

Rules:

- Table name must be unique per relation; two fields cannot share it unless explicitly allowed.
- Source column is `<model_table>_id`, target `<comodel_table>_id` by default.
- The reverse index is critical for joins from the target side.
- `ondelete='cascade'` on the target column is the default; `restrict` is allowed.

Source: `orm/fields_relational.py:1270-1375`.

---

## 5. Inheritance schemas

### 5.1 `_inherit` (same model)

No new table. New fields are added as columns to the existing table. A module adding a field to `res.partner` runs `ALTER TABLE res_partner ADD COLUMN ...`.

### 5.2 `_name` + `_inherit` (prototype)

New table with:

- all fields copied from the parent (columns),
- a `id` PK,
- no FK to the parent table,
- methods inherited via Python MRO.

No polymorphic query across parent/child; you must query each table.

### 5.3 `_inherits` (delegation)

Child table contains:

- `id` PK,
- a required `Many2one` delegate column (e.g. `ir_actions_server_id`),
- only child-specific columns.

Parent fields are **not** duplicated; they are related fields resolved through the FK. `create()` creates the parent first, then the child. `unlink()` cascades according to the delegate's `ondelete`.

```
ir_cron
├── id
├── ir_actions_server_id → ir_act_server.id (required, cascade)
├── cron_name
├── interval_number
└── ...
```

**[WARNING]** `_inherits` with multiple parents and overlapping field names resolves to the last parent in dictionary order. Document the order; it is a source of silent bugs.

### 5.4 SQL view models

```python
class MyReport(models.Model):
    _name = 'my.report'
    _auto = False
    _table_query = "SELECT id, name FROM res_partner WHERE active"
```

- No physical table; `_table_sql` wraps the query as a subquery.
- Reads/searches work; writes do not unless the view is updatable.
- `_depends` declares fields to flush before querying.
- `ir.model` still reflects the model; `_auto=False` is visible in the UI.

Source: `orm/models.py:493` (`_table_sql`), `addons/test_orm/models/test_orm.py:2483`.

---

## 6. Indexing conventions

### 6.1 Declared indexes

```python
name = fields.Char(index=True)                 # btree
code = fields.Char(index='trigram')            # GIN trigram
ref = fields.Char(index='btree_not_null')      # partial btree WHERE not null
```

Rules:

- `Many2one` fields are **not** indexed automatically (except some system fields). Add `index=True` for frequently filtered FKs.
- `Selection`/`state` fields are often indexed; low-cardinality indexes may not be used by PostgreSQL unless combined.
- `_order` fields should be indexed if used for pagination.
- `translate=True` only supports trigram indexes; a plain btree is ignored with a warning.
- `company_dependent` defaults to `btree_not_null`.

Source: `orm/registry.py:829-900`.

### 6.2 Index naming and management

`make_index_name(table, column)` → `<table>__<column>_index`. Odoo creates missing indexes and drops stale ones during `init_models`. It does **not** create composite indexes automatically.

### 6.3 Composite indexes

Add via `models.Constraint`? No — use `tools.sql.create_index` in `init()` or a migration:

```python
def init(self):
    self.env.cr.execute("""
        CREATE INDEX IF NOT EXISTS stock_move__product_state_index
        ON stock_move (product_id, state)
        WHERE state NOT IN ('done', 'cancel')
    """)
```

Or declare an `Index` table object in v19:

```python
_move_product_state = models.Index(
    "(product_id, state)",
    where="state NOT IN ('done','cancel')",
)
```

### 6.4 When to add an index

| Symptom | Index |
|---|---|
| Slow list view filter on FK | btree on FK |
| Slow `ilike` search | trigram GIN |
| Slow `state` + date filter | composite `(state, date)` |
| Slow `company_id` rule | composite `(company_id, state)` |
| Slow x2many join | reverse relation index (core creates) |

**[WARNING]** Every index slows writes and consumes disk. Measure with `EXPLAIN (ANALYZE, BUFFERS)` before and after; do not index "just in case".

---

## 7. Sequences and numbering

- `ir.sequence` generates document numbers (SO, PO, invoice, picking) using PostgreSQL row locks.
- Accounting uses `sequence.mixin` (not `ir.sequence`) with a unique index lock and per-period cache.
- `ir.sequence` has `number_next`, `number_next_actual`, `prefix`, `suffix`, `padding`, `implementation` (`standard`/`no_gap`).
- `no_gap` uses a transaction-level lock and is slower.

**[WARNING]** `ir.sequence` numbers are not gapless under rollback; `no_gap` reduces but does not eliminate gaps under crashes. Never use sequences as business keys for reconciliation.

---

## 8. Attachments and filestore

`ir_attachment` columns:

| Column | Meaning |
|---|---|
| `name` | filename |
| `res_model`, `res_id` | linked record |
| `mimetype` | MIME type |
| `file_size` | bytes |
| `checksum` | SHA-1 of content |
| `store_fname` | relative filestore path |
| `db_datas` | bytea (if stored in DB) |
| `public` | accessible without auth |
| `res_field` | binary field name if field attachment |

Storage decision:

- `attachment=True` → filestore (`store_fname`), deduplicated by checksum.
- `attachment=False` → `db_datas` bytea.
- Large binaries should always use the filestore.

**[INVARIANT]** Backups must include both the PostgreSQL dump and the filestore directory (`~/.local/share/Odoo/filestore/<db>` or configured `data_dir`). A DB-only restore yields broken attachments.

---

## 9. Schema change behaviour

`init_models()` is additive:

| Change | Behaviour |
|---|---|
| New field | `ALTER TABLE ADD COLUMN` |
| New required field | adds column, computes values, then NOT NULL if possible |
| Field type change | `ALTER COLUMN TYPE` with cast (may fail) |
| Field removed | **column kept**, warning logged |
| Field renamed | new column created; old column kept |
| Model removed | table kept |
| Constraint added | created; fails if existing data violates |
| Index removed | dropped if Odoo created it |
| `_auto=False` | no table management |

Source: `orm/models.py:3170-3260`, `orm/registry.py:750-830`.

**[INVARIANT]** Never rely on Odoo to drop or rename columns. Every production upgrade needs an explicit migration script for:

- removed fields (drop or archive),
- renamed fields (copy + drop),
- type changes (cast + validate),
- constraint additions (clean data first).

---

## 10. Naming and design checklist

- [ ] Table name ≤ 63 bytes; explicit `_table` if long.
- [ ] `_log_access=False` for high-volume log/transient tables.
- [ ] `company_id` on every business document, indexed.
- [ ] `Many2one` indexed if filtered/joined often.
- [ ] `_order` ends with `id` for deterministic pagination.
- [ ] `_rec_name` set for user-facing models.
- [ ] SQL constraints for race-free uniqueness.
- [ ] `ondelete` explicit for required relations.
- [ ] `_check_company_auto` for multi-company models.
- [ ] No reserved SQL keywords as field names (`order`, `group`, `user`, `select`).
- [ ] No column named `id` other than the PK.
- [ ] Translated fields not used in `_order`.
- [ ] Company-dependent fields not `required`.
- [ ] Filestore included in backup.

---

## 11. Diagnostic queries

```sql
-- Tables without primary key
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'p');

-- Missing FK indexes (candidate)
SELECT conrelid::regclass AS table, a.attname AS column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Table and index sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 30;

-- Unused indexes
SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 12. Evidence index

| Topic | File |
|---|---|
| Table naming | `orm/model_classes.py:266` |
| Magic columns | `orm/models.py:262-297` |
| M2M relation | `orm/fields_relational.py:1270-1375` |
| Index checks | `orm/registry.py:829-900` |
| Foreign keys | `orm/registry.py:921-970` |
| Table creation | `tools/sql.py:278` |
| `_table_query` | `orm/models.py:493`, `addons/test_orm/models/test_orm.py:2483` |
| Name validation | `orm/utils.py:97` |
| `ir_model_data` | `addons/base/models/ir_model.py:2237` |
| Attachments | `addons/base/models/ir_attachment.py:75-320` |

Continue with `02-inheritance.md`.
