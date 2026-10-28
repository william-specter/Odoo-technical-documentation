# Business Logic Layer I — ORM Runtime and Model Semantics

> **Version.** Odoo 19.0 Enterprise. Source anchors are in `odoo/orm/` unless stated otherwise.
> **Audience.** Backend developers who will override core behaviour and need to reason about cache, recomputation, access, and SQL.

---

## 1. The mental model

Odoo's ORM is not a passive data mapper. It is an **active record runtime** with:

- recordset semantics (every operation is batched over N records),
- a transactional identity map (the field cache),
- dependency-driven incremental recomputation,
- implicit SQL generation with prefetching,
- security enforced at query construction time,
- model classes assembled from module fragments at registry build time.

A method call such as `order.action_confirm()` is therefore not a simple function call. It can:

1. validate ACLs and record rules,
2. read and write cache entries,
3. mark dependent fields for recomputation,
4. flush pending writes to SQL,
5. execute several `UPDATE`/`INSERT` statements,
6. trigger `mail.thread` tracking and bus notifications,
7. commit or roll back the entire request transaction.

Understanding that pipeline is the difference between a maintainable customisation and a latent data-corruption bug.

---

## 2. Recordsets

### 2.1 Representation

```python
class BaseModel:
    __slots__ = ['env', '_ids', '_prefetch_ids']
```

A recordset is an immutable, ordered collection of ids of one model, sharing one environment. `record` is a recordset of length 1. Operations return **new** recordsets; they never mutate the receiver in place.

```python
orders = env['sale.order'].search([('state', '=', 'sale')])
one = orders[0]                 # new recordset, same env, prefetch ids
subset = orders.filtered(lambda o: o.amount_total > 1000)
```

### 2.2 Set algebra

| Operation | Semantics | SQL |
|---|---|---|
| `a | b` | union, order-preserving | none |
| `a & b` | intersection | none |
| `a - b` | difference | none |
| `a.exists()` | keep ids present in DB | one query |
| `a.filtered_domain(domain)` | filter in SQL | one query |
| `a.filtered(func)` | filter in Python | may read fields |
| `a.sorted(key=...)` | sort in Python | may read fields |
| `a.mapped('field')` | project field | batched read |

**[WARNING]** `filtered()` and `sorted()` on a large recordset load every record's fields into cache. Prefer `search()` with a domain or `filtered_domain()`.

### 2.3 Prefetch

When a field is read on a recordset, the ORM fetches that field for the **entire prefetch set** in one query. The prefetch set is usually the recordset used to obtain the record, not the record itself.

```python
for order in orders:          # orders has 1000 ids
    print(order.partner_id.name)   # 1 query for partner_id, 1 for names
```

But:

```python
for order in orders:
    partner = order.partner_id        # prefetch set = order ids
    print(partner.name)               # partner records have their own prefetch set
```

`with_prefetch(ids)` changes the prefetch set. `with_context(prefetch_fields=False)` disables field prefetching. `search_fetch()` and `fetch()` allow explicit control.

Source: `orm/models.py:3754` (`_fetch_field`), `orm/models.py:3775` (`fetch`), `orm/models.py:5871` (`__init__`).

**[WARNING]** Prefetch is a performance optimisation with a memory cost. Fetching a 100k-record set with a binary field can exhaust worker memory. Use `search(..., limit=...)` and explicit `fetch()`.

### 2.4 New records (`NewId`)

`env['model'].new(vals)` creates an in-memory record with a `NewId` (a negative integer-like object). It is used by onchange, wizards, and precompute. New records:

- are not in the database,
- can be written and read from cache,
- cannot be searched,
- are converted to real records by `create()`.

**[INVARIANT]** Never store a `NewId` in a relational field or in the database. It will fail or be silently dropped.

---

## 3. Fields in depth

### 3.1 Field construction and attributes

A field declaration is a class attribute. At registry setup, the field is bound to its model, its inverse, its compute method, and its dependencies. Defaults applied by `_get_attrs` (`orm/fields.py:414`) are important:

| Declaration | Defaults that surprise developers |
|---|---|
| `compute=...` | `store=False`, `compute_sudo=store`, `readonly=not inverse`, `copy=False` |
| `related=...` | `store=False`, `compute_sudo=True`, `readonly=True`, `copy=False` |
| `company_dependent=True` | `index='btree_not_null'`, `prefetch='company_dependent'`, depends on `company` |
| `translate=True` | column type `jsonb`; only trigram index supported |
| `Many2one` | `ondelete='set null'` by default; `index=True` is **not** automatic |
| `One2many` | no column; inverse field must exist |
| `Many2many` | implicit relation table; `ondelete='cascade'` for source side |
| `state` | `copy=False` by default |
| `active` | enables `active_test` filtering by default |

### 3.2 Stored vs non-stored

| | Stored | Non-stored |
|---|---|---|
| Persisted | yes | no |
| Searchable | yes | only with `search=` |
| Sortable/groupable | yes | no |
| In record rules | yes | only via custom SQL |
| Recomputed | on dependency change | on access |
| Cache | transactional, flushed | transactional, discarded at end |
| Migration | column | none |

**[INVARIANT]** Do not add a non-stored computed field to a `_order`, a domain, a `groupby`, or a record rule. It will fail at runtime or produce incorrect SQL.

### 3.3 Compute methods

```python
@api.depends('order_line.price_total')
def _compute_amount_total(self):
    for order in self:
        order.amount_total = sum(order.order_line.mapped('price_total'))
```

Rules:

- The method receives `self` as a recordset; assign to each record, do not return a value.
- `@api.depends` must list **all** fields read, including fields on related models (`partner_id.country_id.code`).
- Dependencies on non-stored fields are allowed; the ORM tracks the chain.
- `@api.depends_context('lang', 'company')` creates separate cache entries; such fields cannot be stored.
- `compute_sudo=True` (default for stored computes) evaluates as superuser. This can leak data if the computed value embeds restricted fields. Set `compute_sudo=False` when the result must respect the user's access.
- A compute method must be **idempotent** and must not depend on iteration order.

**[WARNING]** `@api.depends` on a related field path does not automatically invalidate when the intermediate record is re-linked unless the relational field itself is in the dependency list. Example: `@api.depends('partner_id.name')` does invalidate when `partner_id` changes, because the ORM treats the path as depending on `partner_id` and `name`.

### 3.4 Inverse methods

An inverse runs when a computed field is written:

```python
def _inverse_total(self):
    for record in self:
        record.line_ids = ...  # write the underlying data
```

Inverse methods are how editable computed fields work (e.g. `sale.order.line.price_unit`, `account.move.line.debit`). They run inside `env.protecting(...)` so the computed field is not immediately recomputed over the value being set.

### 3.5 Related fields

```python
partner_country = fields.Many2one(related='partner_id.country_id', store=True)
```

- Non-stored related fields are computed on access with `related_sudo=True` by default. This means a user can read a field on a record they cannot access, if the related chain crosses models.
- Stored related fields add a column and a dependency chain. Deep chains (`a.b.c.d`) multiply recomputation cost.
- `related_sudo=False` is required when the related value must respect record rules.

**[WARNING]** A stored related field to a non-stored field is legal but forces a recompute of the entire dependency chain whenever the target changes. Avoid on high-volume models.

### 3.6 Company-dependent fields

```python
property_account_income_id = fields.Many2one(
    'account.account', company_dependent=True, check_company=True)
```

Storage: `jsonb` column keyed by company id. Read path uses `env.company` (not `env.companies`). Write path writes the key for the current company. Search uses `->company_id` with a fallback to the default value.

Source: `orm/fields.py:1215` (`_get_company_dependent`), `orm/fields.py:781` (`column_type`).

**[INVARIANT]** Company-dependent fields cannot be `required`, cannot be translated, and are not copied by default. SQL reports must join on the company key; a naive `SELECT column` returns JSON, not the value.

### 3.7 Translated fields

Storage: `jsonb` `{"en_US": "...", "fr_FR": "..."}`. The ORM returns the value for `env.lang`, falling back to `en_US`. Writes update only the current language unless `translate=True` is handled explicitly.

```python
product.with_context(lang='fr_FR').name = "Chaise"
```

SQL must use `->>'fr_FR'`. Indexes on translated fields are trigram indexes over all languages (`orm/registry.py` `check_indexes`).

### 3.8 Binary fields

- `attachment=True`: stored in the filestore, referenced by `ir.attachment`.
- `attachment=False`: stored in the column (bytea), loaded with the record.
- `bin_size=True` context returns a human-readable size instead of the bytes for list views.
- Large binaries in a prefetched recordset are a memory bomb.

---

## 4. CRUD internals

### 4.1 `create()`

Pipeline (`orm/models.py:4611`):

1. `check_access('create')` on the empty model (ACL check).
2. Validate every provided field name and field-level access.
3. `_prepare_create_values()`: add defaults, strip magic fields, add log fields, precompute fields.
4. For `_inherits`: create or update parent records first.
5. `_create()`: batched `INSERT ... RETURNING id` (batch size `INSERT_BATCH_SIZE`).
6. Protect computed fields, run inverse methods for non-stored writes.
7. Validate Python constraints on stored and inversed fields.
8. `_check_company()` if `_check_company_auto`.
9. Return the new recordset.

Critical details:

- Defaults are computed **before** the insert and can depend on context (`default_*` keys).
- `@api.model_create_multi` is required; overriding `create(self, vals)` with a dict breaks batch callers.
- `create()` can trigger writes to other models via computes, inverses, and `_inherits`. A "simple insert" is rarely one SQL statement.
- `_check_company_auto` validates `check_company=True` relational fields, but only for fields present in `vals` (and computed fields after create).

### 4.2 `write()`

Pipeline (`orm/models.py:4334`):

1. `check_access('write')`.
2. Validate field names and field-level write access.
3. Protect fields that are computed and being inversed.
4. Handle relational fields specially: call `modified(..., before=True)` **before** writing, then `modified(...)` after, to recompute both old and new parents.
5. Write fields in `write_sequence` order (monetary before currency, x2many last).
6. Run inverse methods.
7. Validate constraints.
8. `_check_company()`.

**[WARNING]** Writing a relational field (especially `one2many`) can delete records (`Command.delete`), create records (`Command.create`), or reassign them. `write()` is not a shallow update.

### 4.3 `unlink()`

Pipeline (`orm/models.py:4194`):

1. `check_access('unlink')`.
2. Check `ir.model.data` references and `ondelete` policies.
3. Run `unlink` overrides (may raise `UserError`).
4. Delete rows in batches; cascade at SQL level where configured.
5. Invalidate the entire cache (`env.invalidate_all(flush=False)`) because cascades are not tracked by the ORM.

**[INVARIANT]** Never assume the ORM knows what was cascade-deleted. After `unlink()`, any recordset holding deleted ids must call `exists()` or be discarded. A stale recordset raises `MissingError` on access.

### 4.4 `read()` / `search_read()`

`read()` returns a list of dicts; it is the RPC-friendly representation. `search_read()` combines search and read in one round trip but still executes two queries (ids, then fields), unless the ORM can combine them. Prefer `search_fetch()` internally and `read()` at the RPC boundary.

### 4.5 `search()`

`search(domain, offset, limit, order)` builds SQL through `_search()` (`orm/models.py:5324`):

- applies `active_test` unless disabled,
- injects record rules (`ir.rule._compute_domain`),
- translates domains to joins/subqueries,
- applies `_order` if no order is given,
- returns a recordset; it does **not** fetch fields.

`search_count()` uses the same pipeline with `COUNT(*)`. On large tables, a count over a complex domain can be slower than fetching ids; cache counts or use `estimated_count` where acceptable.

---

## 5. Domains and SQL generation

### 5.1 Domain AST

Odoo 19 uses a typed `Domain` object (`orm/domains.py:196`) rather than raw lists. It supports:

- logical composition: `Domain.AND([...])`, `Domain.OR([...])`, `~domain`,
- field conditions: `Domain('field', '=', value)`,
- relational traversal: `Domain('partner_id.country_id.code', '=', 'BE')`,
- optimisations: `domain.optimize(model)` folds constants and simplifies.

### 5.2 Operators and their SQL

| Operator | Semantics | Notes |
|---|---|---|
| `=` | equality | `False` becomes `IS NULL` for many2one |
| `!=` | inequality | includes NULL in some cases; test explicitly |
| `>`, `>=`, `<`, `<=` | comparison | dates compare as timestamps |
| `in`, `not in` | set membership | `IN` limited to 1000 ids per query (`IN_MAX`) |
| `like`, `ilike` | pattern | `ilike` uses `unaccent` + trigram when available |
| `=like`, `=ilike` | exact pattern | no implicit `%...%` |
| `child_of` | hierarchy | uses `parent_path` when `_parent_store=True` |
| `parent_of` | reverse hierarchy | same |
| `any`, `not any` | x2many existence | correlated subquery |
| `=?` | equality or null | context-dependent |

**[WARNING]** `!=` on a nullable column does **not** return rows where the column is NULL in SQL. Odoo's domain compiler sometimes rewrites it, but do not rely on it; add `| ('field', '=', False)` explicitly.

### 5.3 `_order` pitfalls

`_order = 'date_order desc, id desc'` is injected into every search without an explicit order. Rules:

- every field in `_order` must be a stored column,
- translated fields need `->>'lang'` and cannot be used directly,
- a non-deterministic order (no unique tiebreaker) causes pagination duplicates/misses; always end with `id`.

---

## 6. Context, company, and language

### 6.1 Context keys that change behaviour

| Key | Effect |
|---|---|
| `lang` | translation and date formatting |
| `tz` | timezone for naive datetimes in UI |
| `allowed_company_ids` | companies visible to record rules and `env.companies` |
| `company_id` / `force_company` | selected company in some flows |
| `active_test` | include archived records |
| `default_*` | defaults for `create()` |
| `bin_size` | return binary size instead of content |
| `prefetch_fields` | enable/disable prefetch |
| `tracking_disable` | skip mail tracking |
| `mail_create_nolog` | skip creation log |
| `no_reset_password` | portal/user creation |
| `import_file` | import mode behaviour |
| `install_mode` | module install/upgrade behaviour |

**[WARNING]** Context is user-influenced over RPC. Never use a context key as an authorization decision (`if env.context.get('is_admin')`). Use groups and record rules.

### 6.2 Multi-company

- `env.company` is the active company (from `allowed_company_ids[0]` or the user's default).
- `env.companies` is the recordset of allowed companies.
- Record rules commonly use `['|', ('company_id', '=', False), ('company_id', 'in', company_ids)]`.
- Company-dependent fields resolve against `env.company`.
- `with_company(company)` changes both `company` and the allowed set to that company.

**[INVARIANT]** A record belonging to company A must never be linked to a record of company B unless the relation is explicitly `check_company=False`. `_check_company` enforces this only on declared fields.

### 6.3 Language

- `env.lang` comes from context or user preference.
- `_()` translates at runtime using the current language.
- Stored translated fields return the current language; writing sets that language only.
- `env['ir.translation']` is legacy; translations now live in JSONB columns and `.po` files.

---

## 7. Inheritance semantics

### 7.1 Three mechanisms

| Mechanism | Syntax | Storage | Use |
|---|---|---|---|
| Classical Python inheritance | `_inherit = 'model'` (no `_name`) | same table | extend behaviour/fields in place |
| Prototype inheritance | `_name = 'new'`, `_inherit = 'base'` | new table + copy of fields | create a specialised model |
| Delegation | `_inherits = {'base': 'base_id'}` | new table + FK; parent fields delegated | composition; avoid unless necessary |

### 7.2 `_inherit` without `_name`

- The model class is rebuilt with the new definition inserted in the MRO.
- Fields declared in the extension are added to the same table.
- Methods override by name; `super()` calls the previous definition.
- `_inherit` can be a list: `_inherit = ['mail.thread', 'portal.mixin']` mixes in several models.

### 7.3 `_inherit` with `_name`

- Creates a new model and table.
- Copies field definitions from the parent (**not** data).
- Methods are inherited; `super()` works.
- The new model is **not** a subtype in SQL; queries on the parent do not see child rows.

### 7.4 `_inherits`

```python
class IrCron(models.Model):
    _name = 'ir.cron'
    _inherits = {'ir.actions.server': 'ir_actions_server_id'}
    ir_actions_server_id = fields.Many2one('ir.actions.server', required=True, ondelete='cascade', delegate=True)
```

- The child table stores only the FK and its own fields.
- Parent fields are exposed as related fields (`inherited=True`), read/write through the FK.
- Creating a child creates the parent first.
- Deleting a child cascades according to `ondelete`.
- Field name collisions resolve to the **last** parent in `_inherits` order.

**[WARNING]** `_inherits` makes `create()` and `write()` multi-table operations. It also makes record rules subtle: rules on the child do not automatically apply to the parent, and vice versa. Use only where the composition is genuinely 1:1 (e.g. `ir.cron` → `ir.actions.server`).

### 7.5 MRO and `super()`

The registry class MRO is built from module definitions in reverse load order. Practical rules:

- Always call `super()` in overrides, even if the base is a no-op, to preserve other modules' behaviour.
- `super().method()` uses the MRO of the **instance's class**, which includes all installed modules.
- If your module does not depend on another module that overrides the same method, you cannot predict which runs first. Declare the dependency if order matters.
- Use `super(MyClass, self)` only in legacy code; it is fragile under registry rebuilding.

---

## 8. Access control in the ORM

There are four independent gates:

1. **Model ACL** (`ir.model.access`): can this group create/read/write/unlink this model at all?
2. **Record rules** (`ir.rule`): which rows can this user see/modify?
3. **Field groups** (`groups=` on a field): can this group read/write this field?
4. **Menu/action groups**: can this user reach the UI at all?

`check_access(operation)` checks 1 and 2. `_check_field_access(field, operation)` checks 3. `search()` injects 2 into SQL automatically. `browse()` does **not** check 2; reading a forbidden record raises `AccessError` on field access.

**[INVARIANT]** `sudo()` bypasses 1, 2, and 3. It does not bypass `_check_company` or Python constraints. Every `sudo()` is a security decision and must be justified in code review.

Source: `orm/models.py:4100` (`check_access`), `addons/base/models/ir_rule.py:113` (`_get_rules`), `addons/base/models/ir_model.py` (ACL checks).

---

## 9. Practical rules for business methods

### 9.1 Method design

- Public methods (called by buttons, RPC, or other modules) should accept recordsets and return simple values/actions.
- Private methods (prefix `_`) can assume context and preconditions.
- Do not put business rules in `create`/`write` overrides when a dedicated method exists; overrides run for imports, migrations, and integrations too.
- Prefer `@api.model_create_multi` for `create`.
- Use `@api.ondelete(at_uninstall=False)` to block deletion with a clear message.

### 9.2 Idempotency

Buttons can be double-clicked, RPC calls retried, crons re-run. Every state-changing public method should be idempotent or guarded:

```python
def action_confirm(self):
    for order in self:
        if order.state != 'draft':
            raise UserError(_("Only draft orders can be confirmed."))
    ...
```

### 9.3 Error types

| Exception | Meaning | HTTP/RPC |
|---|---|---|
| `UserError` | business rule violation, user-facing | 422 / error payload |
| `ValidationError` | data constraint violation | 422 |
| `AccessError` | security violation | 403 / error payload |
| `MissingError` | record deleted or missing | 404 |
| `RedirectWarning` | user must fix something elsewhere | action payload |
| `except_orm` | legacy alias; do not use | — |

Never raise bare `Exception` in business code; it becomes a 500 and loses the user message.

### 9.4 Transactions in business methods

- Do not commit.
- Use savepoints for optional work.
- Flush before raw SQL.
- Defer external calls to `postcommit`.
- Keep methods short; long transactions block sequence allocation and vacuum.

---

## 10. Anti-patterns checklist

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| `ensure_one()` in a loop | breaks batching, raises on multi-record | vectorise or iterate explicitly |
| `search()` inside a loop | N+1 queries | one search with `in` domain |
| `len(recordset)` in a loop | repeated count | compute once |
| `record.field` on a large set without prefetch control | memory blow-up | `fetch()` selectively |
| `@api.depends` missing a field | stale values | audit dependencies |
| `sudo()` everywhere | hides security bugs | scope to the minimum |
| `cr.commit()` in model code | partial commits, broken retry | remove |
| `write()` in a compute | infinite recompute loops | use inverse or `modified` carefully |
| Storing `NewId` | FK violation | create first |
| `_order` on non-stored field | SQL error | use stored field |
| Context as authorization | privilege escalation | groups/rules |
| Overriding `create` with a dict signature | breaks batch import | `@api.model_create_multi` |
| `unlink()` without `exists()` guards | `MissingError` | check before access |
| Raw SQL without flush | stale reads | `flush_model()` first |
| External API call inside transaction | duplicate side effects on retry | postcommit + idempotency key |

---

## 11. Evidence index

| Topic | File |
|---|---|
| Recordset, env, prefetch | `orm/models.py:362`, `5871` |
| Field defaults and attributes | `orm/fields.py:414` |
| Column types (jsonb for translate/company) | `orm/fields.py:781` |
| Company-dependent SQL | `orm/fields.py:1215` |
| Create pipeline | `orm/models.py:4611`, `4849` |
| Write pipeline | `orm/models.py:4334`, `4520` |
| Unlink pipeline | `orm/models.py:4194` |
| Domain AST | `orm/domains.py:196` |
| Model class assembly | `orm/model_classes.py:1-140`, `152` |
| Access checks | `orm/models.py:4100`, `addons/base/models/ir_rule.py:113` |
| Compute execution | `orm/models.py:4953` |
| Recompute trigger tree | `orm/models.py:6756` |
| Flush fixpoint | `orm/environments.py:380` |

Continue with `02-transactions.md` for the transaction and concurrency model.
