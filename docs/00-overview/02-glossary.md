# Glossary of Odoo Internals

> Terms that are overloaded in Odoo documentation. Each entry gives the **precise runtime meaning** and the common misconception.

---

## A

**ACL (Access Control List)**
A row in `ir.model.access` granting CRUD permissions on a model to a group. ACLs are model-wide, not record-specific. They are checked before record rules.
*Misconception:* ACLs are not "permissions on menus". Menu visibility is a separate `ir.ui.menu.groups_id` relation.

**Action**
A stored UI instruction (`ir.actions.act_window`, `ir.actions.server`, `ir.actions.report`, `ir.actions.client`, `ir.actions.act_url`). Actions are data, not code. A server action can execute Python via `safe_eval` under strict restrictions.

**`_auto`**
Model flag controlling automatic table creation. `_auto = True` (default for concrete models) creates/syncs a table. `_auto = False` means the developer must create a table or SQL view manually, typically with `_table_query`.

**`api.depends`**
Decorator declaring field dependencies for a computed field. Missing dependencies cause stale values, not errors. `api.depends_context` declares context keys that partition the cache.

**`api.model` / `api.model_create_multi`**
Decorators describing method binding. `@api.model` methods are callable on an empty recordset. `@api.model_create_multi` is mandatory for `create()` overrides that accept a list of value dicts.

---

## B

**BaseModel / Model / TransientModel / AbstractModel**
The four model base classes. `Model` is persistent; `TransientModel` is vacuumed and used for wizards; `AbstractModel` has no table and is used for mixins. `BaseModel` is the low-level root.

**Bus**
The `bus.bus` PostgreSQL-backed notification system used by the websocket service. Delivery is at-most-once. Not a message broker; not durable.

---

## C

**Company-dependent field**
A field whose value differs per company, stored as `jsonb` keyed by company id. Formerly called "property field". Access uses `with_company()`. Cannot be `required` or translated.

**Compute field**
A field whose value is produced by a method. If `store=True`, the value is persisted and recomputed on dependency changes. If `store=False`, it is computed on access and cannot be searched unless a `search` method is provided.

**Context**
An immutable `frozendict` carried by the environment. Used for language, timezone, company, active test, and arbitrary flags. Context is **not** a security boundary; users can often influence it through RPC.

**Cursor**
A `psycopg2` cursor wrapper (`odoo.sql_db.Cursor`) owning the transaction, pre/post-commit hooks, and the ORM `Transaction`. One per request/job.

---

## D

**Delegation inheritance (`_inherits`)**
Composition-based inheritance: the child model stores a many2one to a parent and exposes the parent's fields as related fields. Used by `ir.cron` → `ir.actions.server`, `product.product` → `product.template` (historically), `mail.message` subtypes.
*Misconception:* `_inherits` does not copy columns; it delegates reads/writes.

**Domain**
A list of triples `(field, operator, value)` evaluated to SQL by the ORM. Supports logical prefixes (`&`, `|`, `!`), `child_of`, `parent_of`, `any`, `not any`, and date operators. Domains are data and can be evaluated via `safe_eval` in record rules and actions.

**Dropship**
A procurement route where the vendor ships directly to the customer. In Odoo 19 it is represented by stock moves between supplier and customer locations, often with a `stock.reference` linking documents.

---

## E

**Environment (`env`)**
The runtime context object: `cr`, `uid`, `context`, `su`, `transaction`, plus mapping access to models. Immutable; derive with `env(user=..., context=..., su=...)`.

**External ID (XML ID)**
A string `module.identifier` stored in `ir.model.data`, mapping to a model and record id. Used by data files, views, actions, and `env.ref()`. External IDs are **not** unique per model; they are globally unique per module.

---

## F

**Field**
A descriptor object on a model class. It knows its type, storage, compute/inverse/search methods, dependencies, access groups, company dependency, translation, and tracking. Fields are shared across registries when possible.

**Filestore**
The directory (or S3 bucket) holding binary attachments. Path is derived from the database name and attachment hash. Must be backed up with the database.

---

## G

**Group**
A `res.groups` record. Groups imply other groups via `implied_ids`, and gate ACLs, record rules, field access, menus, and feature flags. `has_group('module.xmlid')` is the runtime check.

---

## H

**Hash chain (accounting)**
When a journal enables `restrict_mode_hash_table`, posted moves are chained with SHA-256 over selected fields plus the previous hash. The hash is stored in `inalterable_hash`. Editing a hashed move is blocked. This is an inalterability control, not a blockchain.

---

## I

**`ir.model` / `ir.model.fields`**
The metadata mirror of the Python registry. Used by the UI, Studio, and dynamic views. It is synchronised during module loading. A field can exist in Python but not in `ir.model.fields` if reflection failed; this causes UI invisibility.

**Inheritance (`_inherit`)**
Extension of an existing model in place. The model class is rebuilt with the new definition in its MRO. `_inherit` without `_name` extends; `_inherit` with `_name` creates a new model that also inherits the parent's fields and behaviour.

---

## J

**Journal**
An accounting container (`account.journal`) defining sequence, currency, default accounts, and posting rules. Every `account.move` belongs to exactly one journal.

---

## L

**Ledger**
The set of posted `account.move.line` rows. There is no separate ledger table; balances are computed by aggregating move lines by account and date.

**Lock date**
A company-level date (`hard_lock_date`, `fiscalyear_lock_date`, `tax_lock_date`) preventing posting or modification of entries before it. Enforced in `account.move` write/post, not in PostgreSQL.

---

## M

**Many2many relation table**
An implicit table named `<table1>_<table2>_rel` with columns `<table1>_id`, `<table2>_id`, a composite primary key, and a reverse index. Explicit `relation`, `column1`, `column2` override the naming.

**Module**
A Python package with a manifest (`__manifest__.py`) under an addons path. A module can be `installable`, `auto_install`, and may declare `depends`, `data`, `demo`, `assets`, hooks, and external dependencies.

**MRO (Method Resolution Order)**
The Python C3 linearisation of a registry model class. It determines `super()` behaviour across module overrides. It is derived from module load order, not from your import statements.

---

## N

**`noupdate`**
XML data attribute. `noupdate="1"` records are created on install but **not updated** on upgrade. Stored in `ir.model.data.noupdate`.

---

## O

**ORM**
Object-Relational Mapper. In Odoo it is also the business-logic runtime: models hold behaviour, not just data.

**`_order`**
Default SQL `ORDER BY` for a model's searches. Must reference stored columns; a non-stored field causes a SQL error or fallback.

---

## P

**Prefetch**
The ORM's automatic batching of reads for records in the same recordset. Accessing `record.field` on a 100-record set fetches all 100 values in one query. Prefetch is disabled or altered by `with_prefetch()`, `prefetch_fields`, and some x2many operations.

**Procurement**
The mechanism that turns a demand (SO line, reorder rule, MO component) into stock moves via `stock.rule`. In Odoo 19 the grouping object is `stock.reference`, not `procurement.group`.

---

## Q

**Quant**
`stock.quant` is the authoritative on-hand quantity per product/location/lot/package/owner. It stores `quantity` and `reserved_quantity`. Stock moves do not directly change quants; move lines do, through `_update_available_quantity`.

---

## R

**Record rule**
A row in `ir.rule` with a domain evaluated per user/company. Global rules are ANDed; group rules are ORed within the same group set. `sudo()` bypasses them; `with_user()` does not.

**Registry**
The per-database container of assembled model classes and metadata. See `00-overview/01-architecture.md`.

**`res.config.settings`**
A transient model used as a settings form. It writes to `ir.config_parameter`, company fields, or other models via `set_values`/`get_values`. Not a configuration store itself.

**`res.partner`**
The party master data model: customers, vendors, contacts, companies, and addresses. Almost every business document references it.

---

## S

**`safe_eval`**
A restricted Python evaluator used for domains, actions, server actions, and automated actions. It blocks imports and dangerous builtins but is **not** a sandbox against a determined administrator. Treat server-action code as trusted code.

**Savepoint**
A PostgreSQL nested transaction. Odoo exposes `with env.cr.savepoint():` and uses it internally for sequence allocation and optional inserts. A savepoint rollback does not roll back the outer transaction.

**Sequence**
A numbering mechanism, not a PostgreSQL `SEQUENCE`. Odoo 19 uses a `sequence.mixin` with `_locked_increment`, which locks a unique index entry to allocate gapless-ish numbers per journal/period. Gaps can still occur on rollback.

**`sudo()`**
Returns an environment with `su=True`, bypassing ACLs and record rules. Does **not** change `uid`; audit fields keep the original user. Use sparingly and document why.

---

## T

**Transient model**
A model backed by a table but intended for temporary wizards. Rows are vacuumed by `_transient_vacuum` (default 1 hour). Never store business data in a transient model.

**Translation**
A `jsonb` column storing per-language values for translatable fields. `env.lang` selects the value. SQL must use `->>'lang'` or `jsonb_path_query`.

---

## U

**UoM (Unit of Measure)**
`uom.uom` in Odoo 19 is a **tree**, not a category-based system: each UoM has `relative_uom_id` and `relative_factor`, and rounding is global (`decimal.precision` "Product Unit"). Conversion follows the chain to the root. This is a breaking change from earlier versions.

**`_table_query`**
A SQL query used instead of a physical table for read-only models (`_auto = False`). The ORM treats it as a table; writes are not supported unless the query is updatable.

---

## V

**Virtual available (`virtual_available`)**
Forecast quantity: on hand minus outgoing plus incoming, within a context-dependent horizon. It is not a stored column and is expensive on large datasets.

---

## W

**Wizard**
A `TransientModel` with a form view, usually opened in a modal dialog. Wizards are application services: they gather input, call model methods, and return an action. They should not contain reusable business rules.

**`with_company` / `with_user` / `with_context`**
Environment derivation methods. They return new environments sharing the same transaction. `with_company` changes `env.company` and `env.companies`, which affects company-dependent fields and record rules.

---

## X

**XML data file**
A file listed in the manifest `data` key, parsed by `odoo.tools.convert`. Supports `<record>`, `<field>`, `<menuitem>`, `<template>`, `<act_window>`, `<report>`, and `<function>`. Loaded in manifest order; forward references fail.

---

## Z

**Zero-downtime upgrade**
Not supported by core Odoo. Module upgrades require stopping or draining workers, running `-u`, and restarting. Rolling upgrades with two schemas are a custom architecture, not a platform feature.
