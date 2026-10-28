# Appendix E — Sources, Evidence, and Version Matrix

> **Principle.** Every code-level statement in this manual is traceable to the source tree. Official documentation is used to understand intent and to identify drift, not as proof of runtime behaviour.

---

## 1. Version matrix

| Artifact | Version | Path |
|---|---|---|
| Odoo source | `19.0+e.20260826` | `source code/odoo-19.0+e.20260826/` |
| Odoo Community commit | `7b5a3f53a824d86fe6cb4002637299813cd81881` | `release.py` |
| Odoo Enterprise commit | `89c0ff24180571bc0e2df7d79f5d658f5a12dd3a` | `release.py` |
| Official docs | `20.0` | `official_docs/odoo-docs-20.0/` |
| Modules | 1,469 (656 Community + 813 Enterprise) | `addons/*/__manifest__.py` |
| PostgreSQL minimum | 13 | `release.py` |
| Python range | 3.10–3.14 | `release.py` |

**[WARNING]** Documentation is 20.0, source is 19.0. Version-sensitive claims must be checked against the source. Where behaviour is known to differ, the manual marks it `[V19]` or describes the 19 behaviour explicitly.

---

## 2. Primary source references

### 2.1 ORM kernel

| Topic | File |
|---|---|
| Environment/transaction/cache | `odoo/orm/environments.py` |
| Models/CRUD/search/access | `odoo/orm/models.py` |
| Fields | `odoo/orm/fields.py`, `fields_relational.py`, `fields_textual.py`, `fields_numeric.py` |
| Model class assembly/MRO | `odoo/orm/model_classes.py` |
| Registry/schema | `odoo/orm/registry.py` |
| Domains | `odoo/orm/domains.py` |
| Decorators | `odoo/orm/decorators.py` |
| Table objects | `odoo/orm/table_objects.py` |

### 2.2 Runtime

| Topic | File |
|---|---|
| HTTP/request/dispatch | `odoo/http.py` |
| Cursor/pool/savepoints | `odoo/sql_db.py` |
| RPC retry | `odoo/service/model.py` |
| Server/workers | `odoo/service/server.py` |
| Cron | `odoo/addons/base/models/ir_cron.py` |
| Bus | `odoo/addons/bus/models/bus.py` |
| Mail thread | `odoo/addons/mail/models/mail_thread.py` |

### 2.3 Modules

| Topic | File |
|---|---|
| Manifest | `odoo/modules/module.py` |
| Graph/phases | `odoo/modules/module_graph.py` |
| Loading | `odoo/modules/loading.py` |
| Migration | `odoo/modules/migration.py` |
| Module model | `odoo/addons/base/models/ir_module.py` |
| Neutralization | `odoo/modules/neutralize.py` |

### 2.4 Business modules

| Module | Path |
|---|---|
| `sale` | `odoo/addons/sale/` |
| `sale_stock` | `odoo/addons/sale_stock/` |
| `purchase` | `odoo/addons/purchase/` |
| `purchase_stock` | `odoo/addons/purchase_stock/` |
| `stock` | `odoo/addons/stock/` |
| `stock_account` | `odoo/addons/stock_account/` |
| `account` | `odoo/addons/account/` |
| `account_asset` | `odoo/addons/account_asset/` |
| `account_reports` | `odoo/addons/account_reports/` |
| `mrp` | `odoo/addons/mrp/` |
| `mrp_account` | `odoo/addons/mrp_account/` |
| `mrp_subcontracting` | `odoo/addons/mrp_subcontracting/` |
| `quality` | `odoo/addons/quality/` |
| `crm` | `odoo/addons/crm/` |
| `project` | `odoo/addons/project/` |
| `base` | `odoo/addons/base/` |
| `product` | `odoo/addons/product/` |
| `uom` | `odoo/addons/uom/` |

---

## 3. Official documentation structure

The 20.0 snapshot contains:

```
developer/
├── tutorials/            # getting started, module, views, tests
├── howtos/               # website, reports, OWL, upgrade
├── reference/
│   ├── backend/          # ORM, views, security, actions, data
│   ├── frontend/         # OWL, assets, JS
│   ├── cli.html
│   ├── external_api.html
│   ├── external_rpc_api.html
│   └── upgrades.html
├── contributing/
└── glossary.html
```

Applications documentation is organised by functional area (sales, inventory, accounting, manufacturing, etc.) and is user-oriented.

### 3.1 What we cross-checked

- model/field API basics,
- view inheritance,
- module manifest/data files,
- security group basics,
- testing framework,
- CLI/upgrade basics,
- JS/OWL tutorials.

### 3.2 What the docs do not cover

- registry class assembly and MRO consequences,
- transaction/cache/recompute internals,
- retry/savepoint semantics,
- record rule SQL evaluation details,
- cron claiming/progress,
- bus delivery guarantees,
- v19 removals (procurement group, valuation layer, UoM category),
- accounting hash/sequence internals,
- stock/valuation internals,
- performance/indexing,
- migration patterns beyond script basics,
- estimation/PM.

---

## 4. Community sources (corroboration only)

| Source | Use |
|---|---|
| Odoo GitHub issues/PRs | bug context, version changes |
| OpenUpgrade | migration patterns between major versions |
| OCA modules | extension patterns, edge cases |
| Odoo forums | field experience, workarounds |
| Postgres docs | SQL/locking/isolation semantics |

Community sources are not used as proof of a runtime behaviour when the source is available. Where used, they are labelled.

---

## 5. Static analysis methodology

The module statistics in this manual were produced by parsing every `__manifest__.py` in the tree and building a dependency graph:

- 1,469 parseable manifests, 3,234 dependency edges;
- Kahn/Tarjan cycle detection (0 cycles, 0 unresolved nodes);
- missing dependency/file checks (0);
- fan-in/fan-out and depth computation;
- `auto_install` and `external_dependencies` census;
- license/repository classification (Community vs Enterprise).

The raw working notes were not shipped; the results are reproduced in `04-modules/01-dependency-system.md` and `04-modules/02-module-map.md`. To reproduce, use the Kahn algorithm in `04-modules/04-circular-dependencies.md` §11 and extend it to count fan-in/fan-out.

Line references were verified against this build at the time of writing. Symbols (model/field/method names) are the stable anchor; line numbers drift across patches.

---

## 6. How to verify a claim

```bash
# model exists?
grep -rn "_name = 'model.name'" odoo/addons --include=*.py

# field definition?
grep -rn "field_name = fields\." odoo/addons/module/models --include=*.py

# method?
grep -rn "def method_name" odoo/addons/module --include=*.py

# state values?
grep -n "state = fields.Selection" -A 15 odoo/addons/module/models/file.py

# actual schema?
psql -d db -c "\d table_name"

# installed version?
psql -d db -c "SELECT name, latest_version FROM ir_module_module WHERE name='sale';"
```

---

## 7. Known limitations of this manual

- Line numbers are build-specific; symbols are the stable anchor.
- Functional coverage is based on module/source inspection, not exhaustive hands-on testing of every feature.
- Enterprise module behaviour may change between builds; verify against your licensed source.
- Localization coverage varies by country and version.
- Performance figures are targets/guidance, not benchmarks of your dataset.
- The manual does not redistribute Enterprise code; snippets are short and explanatory.

---

## 8. Suggested reading order for new team members

1. `00-overview/01-architecture.md`
2. `00-overview/02-glossary.md`
3. `01-business-logic/01-orm-runtime.md`
4. `01-business-logic/02-transactions.md`
5. `02-flows/01-sales.md` through `05-manufacturing.md`
6. `03-database/01-conventions.md`
7. `04-modules/01-dependency-system.md`
8. `04-modules/03-extension-points.md`
9. `06-engineering/05-state-machines.md`
10. `08-appendix/03-debug-playbook.md`

---

## 9. Maintenance

- Re-verify each chapter after a major upgrade.
- Update the version matrix and `[V19]` markers.
- Add new ADRs/patterns as the team learns.
- Keep the web UI data build (`build.mjs`) in sync with Markdown changes.
- Archive obsolete chapters rather than deleting them; history is useful.

---

## 10. Attribution

Odoo is a trademark of Odoo S.A. Community code is LGPL-3; Enterprise code is under `OEEL-1`/`OPL-1`. This manual is an independent technical analysis and does not redistribute the source. All trademarks belong to their respective owners.
