# Appendix A — Source Code Map

> **Base path.** `source code/odoo-19.0+e.20260826/odoo/`. Use this map to find the code behind a behaviour without grepping blindly.

---

## 1. Top-level

```
odoo/
├── __main__.py            # python -m odoo
├── init.py                # bootstrap
├── http.py                # WSGI/ASGI, Request, Response, dispatchers
├── sql_db.py              # cursor, connection pool, savepoints, callbacks
├── exceptions.py          # UserError, ValidationError, AccessError, ...
├── release.py             # version info
├── service/               # RPC service layer
├── orm/                   # ORM kernel
├── modules/               # module discovery, graph, loading, migration
├── fields/                # field type exports
├── models/                # model base exports
├── api/                   # API decorator exports
├── tools/                 # SQL, safe_eval, translate, profiler, misc
├── addons/                # 1,469 modules
└── tests/                 # framework tests
```

---

## 2. ORM kernel

| File | Contains | Look here for |
|---|---|---|
| `orm/models.py` | `BaseModel`, CRUD, search, domains, access | create/write/unlink, `_search`, `check_access`, `modified` |
| `orm/fields.py` | `Field`, attributes, cache, compute | column types, `@api.depends`, related, company-dependent |
| `orm/fields_relational.py` | many2one/one2many/many2many | relation tables, x2many commands, cache |
| `orm/fields_textual.py` | char/text/html | translation storage |
| `orm/fields_numeric.py` | int/float/monetary | rounding, currency |
| `orm/fields_temporal.py` | date/datetime | timezone conversion |
| `orm/fields_selection.py` | selection | `selection_add`, values |
| `orm/fields_reference.py` | reference | dynamic model references |
| `orm/fields_properties.py` | properties | JSONB schema fields |
| `orm/fields_binary.py` | binary/image | attachment storage |
| `orm/models_transient.py` | `TransientModel` | wizards, vacuum |
| `orm/model_classes.py` | registry class assembly | MRO, `_inherit`, `_inherits` |
| `orm/registry.py` | registry, schema init | `init_models`, indexes, FKs |
| `orm/environments.py` | `Environment`, `Transaction`, `Cache` | env composition, flush, recompute |
| `orm/domains.py` | `Domain` AST | operators, SQL generation |
| `orm/decorators.py` | `@api.*` | depends, constrains, onchange, ondelete |
| `orm/table_objects.py` | `Constraint`, `Index`, `UniqueIndex` | declarative SQL objects |
| `orm/utils.py` | name checks, SUPERUSER_ID | identifiers |

---

## 3. HTTP and services

| File | Contains | Look here for |
|---|---|---|
| `http.py` | `Request`, `Response`, dispatchers, routing | request lifecycle, JSON-RPC, CSRF, sessions |
| `service/model.py` | `retrying`, `call_kw` | transaction retry, RPC dispatch |
| `service/common.py` | `EXP_WORKER_CLASS`, common RPC | |
| `service/db.py` | database management RPC | list/create/drop DB |
| `service/security.py` | `check_super` | admin operations |
| `service/server.py` | WSGI/ASGI servers, prefork | workers, gevent |
| `addons/base/models/ir_http.py` | routing/auth hooks | `_match`, `_authenticate`, `_pre_dispatch` |
| `addons/base/models/ir_ui_view.py` | views | inheritance, validation |
| `addons/base/models/ir_actions.py` | actions | server actions, reports, windows |
| `addons/base/models/ir_cron.py` | cron | job claiming, progress, retries |
| `addons/bus/models/bus.py` | bus | notifications, GC |

---

## 4. Modules

| File | Contains | Look here for |
|---|---|---|
| `modules/module.py` | `Manifest`, module discovery | manifest keys, addons path |
| `modules/module_graph.py` | graph, phases, depth | load order, dependencies |
| `modules/loading.py` | `load_modules`, `load_module_graph` | install/upgrade pipeline |
| `modules/db.py` | DB init, module list | `initialize`, `is_initialized` |
| `modules/migration.py` | `MigrationManager` | migration scripts |
| `modules/neutralize.py` | neutralization | DB copies |
| `addons/base/models/ir_module.py` | module model | install/upgrade buttons, auto-install |

---

## 5. Tools

| File | Contains | Look here for |
|---|---|---|
| `tools/sql.py` | SQL wrapper, DDL | table/column/index creation |
| `tools/safe_eval.py` | restricted eval | server actions, domains |
| `tools/translate.py` | translations | `.po`, JSONB, `_()` |
| `tools/profiler.py` | profiler | SQL/trace collectors |
| `tools/misc.py` | helpers, Callbacks | pre/post commit hooks |
| `tools/float_utils.py` | float compare/round | monetary/quantity precision |
| `tools/date_utils.py` | date helpers | timezone, ranges |
| `tools/config.py` | CLI options | workers, limits, DB |

---

## 6. Business modules (key files)

| Module | Key files |
|---|---|
| `sale` | `models/sale_order.py`, `sale_order_line.py`, `wizard/sale_advance_payment_inv.py` |
| `sale_stock` | `models/sale_order.py`, `sale_order_line.py`, `stock_move.py` |
| `purchase` | `models/purchase_order.py`, `purchase_order_line.py` |
| `purchase_stock` | `models/purchase_order.py`, `purchase_order_line.py` |
| `stock` | `models/stock_move.py`, `stock_move_line.py`, `stock_picking.py`, `stock_quant.py`, `stock_rule.py`, `stock_location.py`, `stock_warehouse.py` |
| `stock_account` | `models/stock_move.py`, `product_value.py`, `product.py` |
| `account` | `models/account_move.py`, `account_move_line.py`, `account_tax.py`, `account_payment.py`, `sequence_mixin.py` |
| `account_asset` | `models/account_asset.py` |
| `account_reports` | `models/account_report.py`, `models/account.py`, `models/account_move_line.py` |
| `mrp` | `models/mrp_production.py`, `mrp_bom.py`, `mrp_workorder.py`, `mrp_workcenter.py` |
| `mrp_account` | `models/mrp_production.py` |
| `mrp_subcontracting` | `models/mrp_production.py`, `stock_picking.py` |
| `quality` | `models/quality.py` (`quality.point`, `quality.check`) |
| `crm` | `models/crm_lead.py`, `crm_stage.py` |
| `project` | `models/project_project.py`, `project_task.py` |
| `mail` | `models/mail_thread.py`, `mail_message.py`, `mail_template.py` |
| `base` | `models/res_partner.py`, `res_users.py`, `res_company.py`, `ir_rule.py`, `ir_model.py`, `ir_attachment.py` |
| `product` | `models/product_template.py`, `product_product.py`, `product_pricelist.py` |
| `uom` | `models/uom_uom.py` |

---

## 7. Finding a behaviour

```bash
# 1. find the model definition
grep -rn "_name = 'sale.order'" addons/ --include=*.py

# 2. find a method
grep -rn "def action_confirm" addons/sale --include=*.py

# 3. find overrides across modules
grep -rn "def _action_confirm" addons/ --include=*.py

# 4. find a field
grep -rn "invoice_status = fields" addons/sale --include=*.py

# 5. find XML data
grep -rn "view_order_form" addons/sale/views --include=*.xml

# 6. find a route
grep -rn "@http.route" addons/ --include=*.py | grep "/my/"
```

---

## 8. Reading a traceback

Odoo tracebacks include:

- the HTTP/RPC entry point,
- the controller,
- the model method chain (with `super()` frames),
- the ORM internals,
- the SQL query (if `--log-level=debug_sql`).

Tips:

- read bottom-up for the immediate cause, top-down for the business context;
- `UserError` is expected business logic, not a bug;
- `psycopg2.errors.*` indicates DB constraints/locks;
- `MissingError` means a stale recordset after unlink;
- `AccessError` means ACL/rules, not a missing record.

---

## 9. Version pinning

Record in every project:

```text
Odoo: 19.0+e.20260826
Commit: 7b5a3f53a824d86fe6cb4002637299813cd81881
Enterprise commit: 89c0ff24180571bc0e2df7d79f5d658f5a12dd3a
PostgreSQL: 16.x
Python: 3.12.x
```

Line numbers in this manual are for this build. Symbols are stable; lines drift.

Continue with `02-sql-cookbook.md`.
