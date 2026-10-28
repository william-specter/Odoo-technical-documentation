# Odoo Internals Field Manual

**A source-verified technical reference for Odoo 19.0 Enterprise — the runtime, business flows, database design, module graph, functional boundaries, and delivery practices that the official documentation does not explain.**

Independent analysis of the `odoo-19.0+e.20260826` Enterprise source tree, cross-checked against the Odoo 20.0 documentation. **47 chapters · 9 volumes · 77 Mermaid diagrams · 80,000+ words.**

> **Read it in the browser:** open [`index.html`](index.html) directly, or run `python3 serve.py` and visit <http://127.0.0.1:9000>.

---

## Summary

This repository documents how Odoo actually works, not only what its public API exposes. It reverse-engineers the call paths, state machines, schema conventions, extension points, and operational constraints behind the standard ERP flows, then turns them into material that architects, backend developers, data engineers, QA leads, and programme managers can use during design, build, and production support.

The manual is organised as nine volumes. It starts with the process model and ORM runtime, follows a quote through delivery, invoicing, and accounting, maps the physical database and the 1,469-module dependency graph, identifies where standard Odoo stops, and closes with engineering artefacts, delivery guidance, and operational appendices.

**It answers questions such as:**

- How does a request travel from HTTP through the registry, `Environment`, ORM cache, and PostgreSQL?
- Why do recordsets, computed fields, `sudo()`, savepoints, and retries behave the way they do?
- How do sales, purchase, inventory, accounting, manufacturing, and cross-module documents actually connect?
- What tables, columns, indexes, and hidden legacy structures exist, and how do you migrate them safely?
- Which module owns a behaviour, where should a customisation live, and what breaks between 18 and 19?
- Where does standard Odoo stop, what does it cost to cross the boundary, and how should the programme be estimated and delivered?

### At a glance

| Attribute | Value |
|---|---|
| **Primary source** | Odoo 19.0 Enterprise, build `19.0+e.20260826` |
| **Source commits** | Community `7b5a3f53a824d86fe6cb4002637299813cd81881`; Enterprise `89c0ff24180571bc0e2df7d79f5d658f5a12dd3a` |
| **Secondary reference** | Official Odoo documentation snapshot `20.0` |
| **Modules analysed** | 1,469 (656 Community + 813 Enterprise), 3,234 dependency edges, 0 manifest cycles |
| **Content** | 47 chapters, 77 Mermaid diagrams, 80,000+ words |
| **Audience** | Architects, backend developers, data engineers, QA leads, ERP programme managers |
| **Reader** | Static, offline-first HTML with search, table of contents, deep links, Mermaid, and dark mode |

---

## Critical version warning

The source tree is **19.0**, while the documentation snapshot is **20.0**. Odoo 19 introduced breaking architectural changes, and many 20.0 doc recipes do not apply cleanly to the 19.0 source.

| Area | What changed in Odoo 19 |
|---|---|
| **Procurement** | `procurement.group` is gone. `stock.reference` now groups moves and pickings. |
| **Valuation** | `stock.valuation.layer` is gone. Value lives on `stock.move.value` and `product.value`. |
| **Product type** | `type='product'` is replaced by `type='consu'` plus `is_storable`. |
| **Units of measure** | `uom.category` and `category_id` are replaced by a tree (`relative_uom_id`, `relative_factor`). |
| **Document states** | Sales and purchase no longer have a `done` state; sales use a `locked` boolean. |
| **Tax engine** | A pure-function pipeline replaces many pre-18 `_compute_taxes` extension points. |
| **ORM and API** | `read_group` → `_read_group`, `name_get` removed, `check_access_rights` deprecated, `Domain` class, list-based `create`, and other changes. |

Code-level chapters state the version they describe, and version-sensitive behaviour is marked `[V19]`. For the full porting catalogue, see [Version Compatibility and 18→19 Changes](docs/04-modules/05-upgrade-compat.md). For the documentation traps that break custom code, see [Where Documentation Misleads or Stops](docs/05-scope/04-doc-gaps.md).

---

## What is inside

- **Architecture and runtime** — process and deployment topology, HTTP request lifecycle, registry assembly, `Environment`/cursor/transaction, module loading, cron, bus, mail, persistence, and architectural invariants.
- **ORM and business logic** — recordset semantics, field machinery, CRUD internals, domains, inheritance, cache and recomputation, transactions and savepoints, retries, locking, services, business rules, automation, and security.
- **End-to-end flows** — quote-to-cash, requisition-to-payables, inventory and valuation, invoice-to-financial-statements, plan-to-produce, and the cross-module document graph.
- **Database design** — schema generation and naming, inheritance footprints, the core ER model, indexing and query performance, migrations, upgrades, and data evolution.
- **Module relationships** — manifest and loading semantics, the platform map, extension points ranked by safety, circular coupling, and the 18→19 compatibility catalogue.
- **ERP scope** — functional coverage, 18 major gaps and their engineering consequences, 10 performance bottlenecks, and places where official documentation is incomplete or misleading.
- **Software engineering** — 28 use cases, domain aggregates, sequence and activity diagrams, 13 state-machine references, non-functional requirements, and a test strategy for customisations.
- **Project management** — delivery lifecycle, estimation, roles, quality gates, environments and CI/CD, risk register, implementation playbook, and document templates.
- **Appendix** — source code map, read-only SQL cookbook, debugging and incident playbook, checklists, and the full evidence/version matrix.

---

## Documentation map

| Volume | Chapters | Focus |
|---|---|---|
| **0 — Orientation** | [Architecture and Runtime Model](docs/00-overview/01-architecture.md)<br>[Glossary of Odoo Internals](docs/00-overview/02-glossary.md) | Process model, request lifecycle, registry, environment, cursor, terminology |
| **1 — Business Logic Layer** | [ORM Runtime and Model Semantics](docs/01-business-logic/01-orm-runtime.md)<br>[Transactions, Concurrency, and Data Integrity](docs/01-business-logic/02-transactions.md)<br>[Service Structure, Injection, and Orchestration](docs/01-business-logic/03-service-layer.md)<br>[Business Rules, Events, and Automation Triggers](docs/01-business-logic/04-business-rules-events.md)<br>[Security Model](docs/01-business-logic/05-security.md) | Recordsets, fields, CRUD, cache, transactions, services, rules, ACLs, record rules |
| **2 — End-to-End Flows** | [Sales and CRM (Quote to Cash)](docs/02-flows/01-sales.md)<br>[Purchase (Requisition to Payables)](docs/02-flows/02-purchase.md)<br>[Inventory and Stock Valuation](docs/02-flows/03-inventory.md)<br>[Accounting (Invoice to Financial Statements)](docs/02-flows/04-accounting.md)<br>[Manufacturing (Plan to Produce)](docs/02-flows/05-manufacturing.md)<br>[Cross-Module Document Flow](docs/02-flows/06-cross-module.md) | State machines, call sequences, accounting impact, extension hooks, failure modes |
| **3 — Database Design** | [Schema Conventions and Storage](docs/03-database/01-conventions.md)<br>[Inheritance Strategies and Schema Effects](docs/03-database/02-inheritance.md)<br>[Core Entity-Relationship Model](docs/03-database/03-er-model.md)<br>[Indexing, Query Performance, and Scaling](docs/03-database/04-indexes-performance.md)<br>[Migrations, Upgrades, and Data Evolution](docs/03-database/05-migrations.md) | Physical schema, ER model, indexes, query cost, migration patterns |
| **4 — Module Relationships** | [Manifest, Loading, and Dependency Semantics](docs/04-modules/01-dependency-system.md)<br>[Platform Map and Dependency Clusters](docs/04-modules/02-module-map.md)<br>[Extension Points Ranked by Safety](docs/04-modules/03-extension-points.md)<br>[Circular Dependencies and Coupling](docs/04-modules/04-circular-dependencies.md)<br>[Version Compatibility and 18→19 Changes](docs/04-modules/05-upgrade-compat.md) | Module graph, impact analysis, safe extension, coupling, breaking changes |
| **5 — ERP Scope Boundaries** | [Functional Coverage Matrix](docs/05-scope/01-coverage.md)<br>[Functional Gaps and Engineering Consequences](docs/05-scope/02-gaps.md)<br>[Performance Bottlenecks and Scaling Limits](docs/05-scope/03-performance.md)<br>[Where Documentation Misleads or Stops](docs/05-scope/04-doc-gaps.md) | Out-of-box coverage, gap costs, performance limits, documentation traps |
| **6 — Software Engineering** | [Use Case Model](docs/06-engineering/01-use-cases.md)<br>[Domain Model and Aggregates](docs/06-engineering/02-domain-model.md)<br>[Sequence Diagrams](docs/06-engineering/03-sequence-diagrams.md)<br>[Activity Diagrams and BPMN Mapping](docs/06-engineering/04-activity-diagrams.md)<br>[State Machines Reference](docs/06-engineering/05-state-machines.md)<br>[Non-Functional Requirements](docs/06-engineering/06-nfr.md)<br>[Test Strategy](docs/06-engineering/07-testing-strategy.md) | UML/BPMN-ready models, invariants, NFR targets, testing layers |
| **7 — Project Management** | [Delivery Lifecycle](docs/07-project-management/01-delivery-lifecycle.md)<br>[Estimation and Budgeting](docs/07-project-management/02-estimation.md)<br>[Team Structure and Roles](docs/07-project-management/03-team-and-roles.md)<br>[Quality Gates and Definition of Done](docs/07-project-management/04-quality-gates.md)<br>[Environments, CI/CD, and Operations](docs/07-project-management/05-environments-ci.md)<br>[Risk Register](docs/07-project-management/06-risk-register.md)<br>[Implementation Playbook](docs/07-project-management/07-implementation-playbook.md)<br>[Document Templates](docs/07-project-management/08-templates.md) | Lifecycle, effort drivers, RACI, gates, operations, risks, templates |
| **8 — Appendix** | [Source Code Map](docs/08-appendix/01-code-map.md)<br>[SQL Cookbook](docs/08-appendix/02-sql-cookbook.md)<br>[Debugging and Incident Playbook](docs/08-appendix/03-debug-playbook.md)<br>[Checklists](docs/08-appendix/04-checklists.md)<br>[Sources, Evidence, and Version Matrix](docs/08-appendix/05-sources.md) | File map, diagnostic SQL, incident response, review checklists, evidence |

---

## Selected findings

- The module graph is a DAG: **1,469 modules**, **3,234 declared dependency edges**, and **zero manifest cycles**. `account` has the largest fan-in (165 dependents), so changes there have platform-wide blast radius.
- There are **zero Community modules that depend directly on Enterprise modules** in this tree, but **1,006 modules auto-install** and can pull in unexpected dependencies when an app is installed.
- The ORM is an active-record runtime with a transactional identity map, prefetch, dependency-driven recomputation, and SQL-level record rules. Treating it as a simple data mapper produces N+1 queries, recompute storms, and security gaps.
- Odoo's schema synchroniser is additive and conservative: it adds columns and indexes but does not rename, drop, or transform data. Every production upgrade needs an explicit migration plan.
- Exactly-once external side effects are **not** guaranteed. Integrations need idempotency keys, an outbox, or post-commit hooks.
- The official 20.0 documentation explains the public API and feature configuration, but not registry assembly, transaction/cache internals, cross-module flows, or the 18→19 removals. Those gaps are the reason for this manual.

---

## Reading paths

| Role | Start here | Then |
|---|---|---|
| Backend developer | [ORM Runtime and Model Semantics](docs/01-business-logic/01-orm-runtime.md) | [Transactions](docs/01-business-logic/02-transactions.md), [Business Rules](docs/01-business-logic/04-business-rules-events.md), [Extension Points](docs/04-modules/03-extension-points.md) |
| Architect | [Architecture and Runtime Model](docs/00-overview/01-architecture.md) | [End-to-End Flows](docs/02-flows/01-sales.md), [ER Model](docs/03-database/03-er-model.md), [ERP Scope](docs/05-scope/01-coverage.md) |
| Data engineer | [Schema Conventions and Storage](docs/03-database/01-conventions.md) | [Inheritance](docs/03-database/02-inheritance.md), [Indexes and Performance](docs/03-database/04-indexes-performance.md), [Migrations](docs/03-database/05-migrations.md) |
| ERP functional lead | [Sales](docs/02-flows/01-sales.md) through [Manufacturing](docs/02-flows/05-manufacturing.md) | [Coverage Matrix](docs/05-scope/01-coverage.md), [Functional Gaps](docs/05-scope/02-gaps.md) |
| Programme manager | [Delivery Lifecycle](docs/07-project-management/01-delivery-lifecycle.md) | [Estimation](docs/07-project-management/02-estimation.md), [Quality Gates](docs/07-project-management/04-quality-gates.md) |
| QA engineer | [Test Strategy](docs/06-engineering/07-testing-strategy.md) | [State Machines](docs/06-engineering/05-state-machines.md), [Debug Playbook](docs/08-appendix/03-debug-playbook.md) |

---

## Run the web reader

The reader is static and offline-first. All Markdown is embedded in `assets/js/docs-data.js`, so `file://` works too.

```bash
# From the repository root — serve.py always serves this directory
python3 serve.py          # http://127.0.0.1:9000
python3 serve.py 9000     # custom port
```

The server binds to localhost only. Alternatively use the standard library server **from this directory**:

```bash
python3 -m http.server 9000
```

Running `python -m http.server` from your home directory will list your home directory instead. You can also open `index.html` directly in a browser.

### Rebuild the content index after editing Markdown

```bash
node build.mjs
```

`build.mjs` scans `docs/**/*.md`, derives titles and section metadata, and writes:

- `assets/js/docs-data.js` — the embedded content used by the offline reader;
- `docs/manifest.json` — navigation metadata for tooling.

No `npm install` is required. Commit both generated files together with the Markdown change, otherwise the browser will keep serving the previous content.

The site is fully static, so the repository root can also be published with GitHub Pages.

---

## Repository layout

```text
.
├── README.md                  # this file; also the "Start Here" page
├── index.html                 # static reader shell
├── serve.py                   # local server (default 127.0.0.1:9000)
├── build.mjs                  # regenerates docs-data.js and manifest.json
├── docs/
│   ├── 00-overview/           # 47 chapters across 9 volumes
│   ├── 01-business-logic/
│   ├── 02-flows/
│   ├── 03-database/
│   ├── 04-modules/
│   ├── 05-scope/
│   ├── 06-engineering/
│   ├── 07-project-management/
│   ├── 08-appendix/
│   └── manifest.json          # generated navigation metadata
└── assets/
    ├── css/style.css
    ├── js/app.js              # search, routing, TOC, theme, diagrams
    ├── js/docs-data.js        # generated; embeds all Markdown
    ├── img/favicon.svg
    └── vendor/                # marked 12.0.2 + Mermaid 10.9.1 (MIT)
```

---

## Notation and conventions

### Call sequence notation

```text
Actor -> Controller : HTTP POST /web/dataset/call_kw
Controller -> Model : action_confirm()
Model -> Model : _action_confirm()   [super() chain]
Model -> ORM : write({'state': 'sale'})
ORM -> PostgreSQL : UPDATE sale_order SET state='sale'
```

`A -> B : message` is a synchronous call. `A --> B : event` is asynchronous (bus, cron, mail). `[guard]` is a decision point. `opt`, `alt`, and `loop` follow UML combined-fragment semantics.

### State notation

```text
draft --action_confirm()--> sale --action_lock()--> sale(locked)
  |                            |
  +--action_cancel()--> cancel <+
```

Transitions are labelled with the **public** method that triggers them. Where the transition is computed rather than written, the label is `recompute:<field>`.

### Severity markers

- **[INVARIANT]** — breaking this corrupts data or breaks accounting.
- **[WARNING]** — common production incident.
- **[INTERNAL]** — private API; may change without notice.
- **[V19]** — behaviour specific to Odoo 19, often different from 18 or 20 docs.
- **[ENTERPRISE]** — only present in the Enterprise repository.

### Code references

All file references use paths relative to the Odoo source root:

```text
source code/odoo-19.0+e.20260826/odoo/
├── orm/            # ORM kernel: models, fields, registry, environments
├── modules/        # module graph, manifest parsing, loading, migration
├── http.py         # WSGI/ASGI entry, Request, dispatchers, sessions
├── service/        # RPC service layer, retrying, security
├── addons/         # 1,469 modules (656 community + 813 enterprise)
└── tools/          # SQL helpers, safe_eval, translations, misc
```

A claim such as `sale/models/sale_order.py:1167` means `odoo/addons/sale/models/sale_order.py`, line 1167 in this exact build. Line numbers are build-specific; symbols (model, field, and method names) are the stable anchor.

---

## Evidence base and methodology

| Input | Version | Role in this manual |
|---|---|---|
| Source tree | `odoo-19.0+e.20260826` (Enterprise) | **Primary source of truth** for all code-level claims |
| Official documentation | `odoo-docs-20.0` | Secondary; used to identify what is documented, and where docs drift from code |
| Community knowledge | Odoo forums, GitHub issues, OpenUpgrade, OCA | Corroboration only; never used for a claim that could be checked in source |

The module statistics were produced by parsing every `__manifest__.py` in the tree and building a dependency graph: 1,469 parseable manifests, 3,234 dependency edges, Kahn/Tarjan cycle detection (0 cycles, 0 unresolved nodes), missing dependency/file checks (0), fan-in/fan-out and depth computation, and an `auto_install`/`external_dependencies` census.

**Known limitations:**

- Line numbers drift between builds; use the cited symbol as the stable anchor.
- Functional coverage is based on module and source inspection, not exhaustive hands-on testing of every feature.
- Enterprise module behaviour may change between builds; verify against your licensed source.
- Performance figures are targets and guidance, not benchmarks of your dataset.
- The manual does not redistribute Enterprise code; snippets are short and explanatory.

---

## What this manual is — and is not

**It is:**

- a reverse-engineered map of call sequences, state machines, schema conventions, and extension points;
- a catalogue of implicit contracts — invariants enforced by code but absent from API docs;
- a set of UML/BPMN-ready textual models (use case, class, sequence, activity, state);
- a delivery handbook for implementing Odoo: estimation, quality gates, environments, cutover;
- a list of functional gaps and performance traps, with evidence.

**It is not:**

- a user manual, installation guide, or replacement for the official API reference;
- a copy of Enterprise source code — snippets are short, explanatory, and attributed;
- a guarantee that internal APIs are stable — internal methods are explicitly marked;
- legal advice. Enterprise modules are licensed under `OEEL-1`/`OPL-1`; review your agreement before copying code.

---

## Maintenance rules

1. **Every code-level statement must be traceable** to a file and symbol. Line numbers drift; symbols do not. Prefer method names in prose and keep line numbers in evidence tables.
2. **Never document an internal method as stable API.** Mark it `[INTERNAL]`.
3. **Record the source version** in the chapter header when behaviour is version-sensitive.
4. **Test diagrams after editing.** Mermaid fails silently on invalid labels.
5. **Do not paste Enterprise source.** Use ≤15-line illustrative fragments and cite the file.
6. **Rebuild after Markdown changes.** Run `node build.mjs` and commit `assets/js/docs-data.js` plus `docs/manifest.json`.

---

## Licence and attribution

Odoo Community code is LGPL-3. Odoo Enterprise code is covered by the Odoo Enterprise Edition Licence (`OEEL-1`) or the Odoo Partnership Licence (`OPL-1`). This manual is an independent analysis; it does not redistribute the source. Odoo is a registered trademark of Odoo S.A.

The vendored frontend dependencies — `marked` 12.0.2 and `Mermaid` 10.9.1 — are MIT-licensed; see `assets/vendor/README.md` for details.
