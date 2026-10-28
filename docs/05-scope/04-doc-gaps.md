# ERP Scope IV — Where the Official Documentation Misleads or Stops

> **Evidence basis.** The documentation snapshot is **20.0**; the source is **19.0**. Some gaps are version drift, some are deliberate abstraction, some are stale docstrings/comments in the source itself. Each trap below includes a verification method.

---

## 1. The structural mismatch

| Fact | Consequence |
|---|---|
| Docs are 20.0, source is 19.0 | APIs, models, and states can differ |
| Docs describe the public API | internal mechanics are omitted |
| Docs are organised by feature | cross-module flows are not documented end-to-end |
| Docs assume a standard database | custom modules, Studio fields, and localizations change behaviour |
| Docstrings in source can be stale | comments are not evidence |

**[INVARIANT]** For any version-sensitive claim, verify against `_name`, field declarations, and method bodies in the source tree, not against a doc page or a comment.

---

## 2. Trap catalogue

### 2.1 "The model exists" (removed models)

The 19 source still contains comments and test names referring to:

- `procurement.group` (`stock_rule.py:316`, test files),
- `stock.valuation.layer` (`mrp_account` demo comment, `sale_stock` test comment),
- "procurement group" in stock move docstrings.

But the models are **not defined** in this build. A search for `_name = 'procurement.group'` returns nothing.

**Verification:**

```bash
grep -rn "_name = 'procurement.group'" addons/
grep -rn "_name = 'stock.valuation.layer'" addons/
```

If there is no `_name` declaration, the model does not exist, regardless of comments.

### 2.2 "State `done`" (removed states)

Sales and purchase no longer have a `done` state. Docstrings and old community modules still reference it.

**Verification:** inspect the `state = fields.Selection([...])` declaration in the model, not the docstring.

### 2.3 "Product type is `product`"

v19 uses `type='consu'` + `is_storable=True`. Old code checking `type == 'product'` is dead.

**Verification:**

```bash
grep -n "type = fields.Selection" -A 10 addons/product/models/product_template.py
```

### 2.4 "UoM has a category"

v19 removed `uom.category`. Old conversion code using `category_id` fails.

**Verification:**

```bash
grep -n "category_id" addons/uom/models/uom_uom.py
```

### 2.5 "`read_group` is the API"

`read_group` is deprecated in 19; `_read_group` is the internal API and `formatted_read_group` returns formatted results. The docs may still show `read_group`.

**Verification:** `orm/models.py:2748` shows the deprecation decorator.

### 2.6 "`create` takes a dict"

`create` asserts a list/tuple in v19. `@api.model_create_multi` allows a single dict for backward compatibility, but the underlying method expects a list.

**Verification:** `orm/models.py:4611`.

### 2.7 "`name_get` is the display API"

`name_get` is removed. Use `display_name` / `_compute_display_name`.

**Verification:** search for `def name_get` in `orm/models.py`; it is absent.

### 2.8 "`check_access_rights` is current"

Deprecated since 18; use `check_access` / `has_access` / `_filtered_access`.

**Verification:** `orm/models.py:4161-4190`.

### 2.9 "Taxes are computed by `_compute_taxes`"

The v19 engine is a pure-function pipeline. Legacy helpers are deprecated or removed.

**Verification:** `account/models/account_tax.py:1137`, `:4972`.

### 2.10 "The ORM commits at the end of each method"

No. The request wrapper commits once; model methods must not commit. Cron commits progress explicitly.

**Verification:** `service/model.py:160-241`, `addons/base/models/ir_cron.py:399-500`.

### 2.11 "Savepoints are free"

Each savepoint is a PostgreSQL subtransaction with a cost; nested savepoints per row can dominate runtime.

**Verification:** `sql_db.py:60-140`, `account/models/sequence_mixin.py:355-425`.

### 2.12 "Record rules are optional"

Without a record rule, a model with an ACL is fully visible to that group. A missing rule is an open door.

**Verification:** `addons/base/models/ir_rule.py:113-175`.

### 2.13 "`noupdate` means never update"

It means the record is not updated by XML data files; migration scripts and ORM writes still change it.

**Verification:** `addons/base/models/ir_model.py:2237-2450`.

### 2.14 "Views are just XML"

Views are data with inheritance, xpath, groups, and validation. A broken xpath fails module load, not runtime.

**Verification:** `addons/base/models/ir_ui_view.py` (`_validate_module_views`).

### 2.15 "Cron is a simple scheduler"

Cron jobs are claimed with `SKIP LOCKED`, run in separate transactions, support progress commits, and can be deactivated after repeated failures.

**Verification:** `addons/base/models/ir_cron.py:187-500`.

### 2.16 "Bus is a message queue"

`bus.bus` is an at-most-once UI notification table with GC, not a durable queue.

**Verification:** `addons/bus/models/bus.py:88-200`.

### 2.17 "Attachments are in the database"

Large attachments are in the filestore; a DB dump alone is incomplete.

**Verification:** `addons/base/models/ir_attachment.py:75-320`.

### 2.18 "Deleting a record is straightforward"

`unlink()` cascades, invalidates the whole cache, and can be blocked by `ir.model.data` or `@api.ondelete`. Cascades are not tracked by the ORM.

**Verification:** `orm/models.py:4194-4320`.

---

## 3. What the official docs cover well

To be fair, the 20.0 developer docs are good for:

- model/field declarations and basic ORM usage,
- view syntax and inheritance,
- controller/routing basics,
- manifest/data file basics,
- security group basics,
- testing framework,
- CLI and deployment basics,
- frontend/OWL tutorials,
- upgrade scripts at a high level.

They are **not** a substitute for source reading when behaviour matters.

---

## 4. Coverage gap map

| Topic | Official docs | This manual |
|---|---|---|
| Environment/registry internals | brief | `00-overview/01`, `01-business-logic/01` |
| Transaction/retry/savepoints | almost absent | `01-business-logic/02` |
| Cache/recompute | brief | `01-business-logic/01` |
| Record rules semantics | basic | `01-business-logic/05` |
| Cron concurrency/progress | absent | `01-business-logic/02` |
| Bus guarantees | absent | `00-overview/01` |
| Mail tracking cost | absent | `01-business-logic/04` |
| Module MRO/load phases | brief | `04-modules/01` |
| 18→19 removals | absent | `04-modules/05` |
| Procurement internals | brief | `02-flows/03` |
| Accounting posting/hash | brief | `02-flows/04` |
| Manufacturing state compute | brief | `02-flows/05` |
| DB naming/inheritance | basic | `03-database/01-02` |
| Indexing/composite indexes | absent | `03-database/04` |
| Migration patterns | basic | `03-database/05` |
| Scope/gaps | marketing-oriented | `05-scope/*` |
| Estimation/PM | absent | `07-project-management/*` |

---

## 5. How to verify a claim quickly

### 5.1 Model existence

```bash
grep -rn "_name = 'model.name'" addons/ --include=*.py
```

### 5.2 Field definition

```bash
grep -rn "field_name = fields\." addons/module/models/ --include=*.py
```

### 5.3 Method body

```bash
grep -rn "def method_name" addons/module/ --include=*.py
```

### 5.4 Actual state values

```bash
python3 - <<'PY'
import ast
# parse the model file and print the `state = fields.Selection([...])` literal
PY
```

### 5.5 Installed module version

```sql
SELECT name, state, latest_version FROM ir_module_module WHERE name = 'sale';
```

### 5.6 Actual schema

```sql
\d sale_order
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sale_order';
```

### 5.7 Runtime behaviour

```python
# in odoo shell
so = env['sale.order'].browse(1)
print(so.state, so.locked, so.invoice_status)
print(so._fields['state'].selection)
```

---

## 6. Documentation traps in custom code

| Trap | Example | Fix |
|---|---|---|
| Copying a blog snippet | `state == 'done'` | verify against source |
| Trusting a docstring | `_action_invoice_created` (absent) | grep the method |
| Assuming a model | `env['procurement.group']` | check `_name` |
| Assuming an API | `name_get()` | use `display_name` |
| Assuming a default | `search([])` returns all | check `limit` |
| Assuming a transaction | `cr.commit()` in a method | remove |
| Assuming a rule | new model visible only to admins | add ACL + rule |
| Assuming a version | 20 docs on 19 source | pin the version |

---

## 7. Recommendations for the team

1. **Pin the source version** in every design document and code review checklist.
2. **Treat docs as onboarding**, not as a specification.
3. **Write an ADR** for every non-obvious behaviour you rely on, with a source reference.
4. **Add regression tests** for the behaviours you reverse-engineer.
5. **Keep a local "known gaps" register** (this volume) and update it each upgrade.
6. **Do not copy Enterprise code**; reimplement behaviour from the documented contract.
7. **Verify at runtime** in a staging database with production-like data.

---

## 8. Evidence index

| Topic | File |
|---|---|
| Deprecated APIs | `orm/models.py:2748`, `4161-4190`, `5789` |
| Create signature | `orm/models.py:4611` |
| Transaction wrapper | `service/model.py:160` |
| Cron | `addons/base/models/ir_cron.py:187-500` |
| Bus | `addons/bus/models/bus.py:88-200` |
| Attachments | `addons/base/models/ir_attachment.py:75-320` |
| Record rules | `addons/base/models/ir_rule.py:113-175` |
| UoM | `addons/uom/models/uom_uom.py:18-100` |
| Product type | `addons/product/models/product_template.py:54-62` |

Continue with Volume 6: software engineering artefacts.
