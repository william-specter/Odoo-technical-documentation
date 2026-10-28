# Project Management I — Delivery Lifecycle

> **Context.** An Odoo implementation is not a greenfield software project. It is a **product configuration + gap-filling + data migration + change management** programme, constrained by an existing platform's conventions. The lifecycle below reflects that reality.

---

## 1. Phases and gates

```mermaid
flowchart LR
    A[Discovery] --> G1{G1 Scope}
    G1 --> B[Fit-gap & design]
    B --> G2{G2 Design}
    G2 --> C[Build & configure]
    C --> G3{G3 Build}
    G3 --> D[Test & UAT]
    D --> G4{G4 Acceptance}
    G4 --> E[Deploy & cutover]
    E --> G5{G5 Go-live}
    G5 --> F[Hypercare & handover]
    F --> G6{G6 Closure]
```

| Phase | Duration (mid-size) | Key output | Gate criteria |
|---|---|---|---|
| Discovery | 2–4 weeks | scope, process map, data audit | signed scope, budget |
| Fit-gap & design | 3–6 weeks | fit-gap matrix, solution design, ADRs | design sign-off |
| Build & configure | 8–20 weeks | configured modules, custom code, data pipeline | build complete, tests pass |
| Test & UAT | 4–8 weeks | test evidence, UAT sign-off, defect closure | acceptance |
| Deploy & cutover | 2–4 weeks | production, migrated data, runbooks | go-live readiness |
| Hypercare | 2–6 weeks | stabilized operations, handover | closure |

Durations are indicative; a single-company 30-user sales/inventory/accounting rollout is very different from a multi-company manufacturing programme.

---

## 2. Discovery

### 2.1 Objectives

- understand the business model, org structure, and legal entities,
- map current processes and pain points,
- inventory data sources and quality,
- identify regulatory/localization constraints,
- establish success criteria and constraints.

### 2.2 Artifacts

| Artifact | Content |
|---|---|
| Scope statement | in/out of scope, entities, countries, users |
| Process map | as-is and to-be, per domain |
| Data audit | sources, volumes, quality, ownership |
| System landscape | current ERP, integrations, reporting |
| Constraints | budget, timeline, compliance, hosting |
| Success metrics | cycle time, error rate, close days, adoption |

### 2.3 Workshops

Run one workshop per domain (sales, purchase, inventory, manufacturing, accounting, HR). Use the use case catalogue in `06-engineering/01-use-cases.md` as the agenda. Capture decisions, not opinions.

**Output:** a prioritized backlog of epics with acceptance criteria, not a feature list.

---

## 3. Fit-gap and design

### 3.1 Fit-gap matrix

| ID | Requirement | Odoo standard | Gap type | Solution | Effort | Risk |
|---|---|---|---|---|---|---|
| F-001 | Quote with tiered discounts | yes | config | pricelists | S | low |
| F-002 | Approval above 10k | partial | custom | automation + field | M | medium |
| F-003 | Commission on paid invoices | no | custom | commission module | L | high |
| F-004 | IFRS 15 revenue | no | custom | revenue contract | XL | high |

Gap types:

- **config** — standard feature, configuration only,
- **process** — change the business process to fit the standard,
- **extension** — small custom module,
- **integration** — external system,
- **gap** — build or buy a vertical solution.

### 3.2 Design artifacts

- solution architecture (modules, integrations, data flow),
- data model extensions (new models/fields, ER diagram),
- sequence/activity diagrams for critical flows,
- security matrix (roles × models × operations),
- migration strategy,
- ADRs for every non-obvious decision.

### 3.3 Design review checklist

- [ ] Every requirement maps to a module/config/custom item.
- [ ] No core modifications.
- [ ] Every custom module has a clear boundary and owner.
- [ ] Integration contracts are versioned and idempotent.
- [ ] Data migration is estimated and testable.
- [ ] Security roles are defined before build.
- [ ] Performance targets are set.
- [ ] Upgrade path is considered.

---

## 4. Build and configure

### 4.1 Workstreams

| Workstream | Owner | Output |
|---|---|---|
| Configuration | functional consultant | settings, chart of accounts, taxes, routes |
| Custom development | developer | modules, tests, migrations |
| Data migration | data engineer | extract/transform/load scripts, reconciliation |
| Integration | integration developer | connectors, outbox, monitoring |
| Reports | report developer | QWeb/Spreadsheet/BI |
| Security | architect | groups, ACLs, rules, field access |
| Change management | PM/BA | training, comms, SOPs |

### 4.2 Sprint cadence

- 2-week sprints, demo every sprint,
- definition of done includes tests and documentation,
- configuration and code in the same repository where possible (config as data/XML),
- staging deployment every sprint,
- regression suite runs on every merge.

### 4.3 Build order

1. foundation (company, users, security, chart of accounts),
2. master data (partners, products, BoMs, routes),
3. core flows (sales, purchase, inventory),
4. accounting integration,
5. manufacturing/projects (if in scope),
6. reports and dashboards,
7. integrations,
8. data migration,
9. performance tuning.

---

## 5. Test and UAT

### 5.1 Test levels

| Level | Owner | Scope |
|---|---|---|
| Unit/integration | developers | code, invariants, flows |
| System test | QA | end-to-end, cross-module |
| Performance | QA/architect | volume, concurrency |
| Security | architect | roles, portal, API |
| UAT | business | real scenarios, real roles |
| Regression | QA | existing behaviour after change |

### 5.2 UAT design

- scenarios derived from use cases,
- production-like data,
- real user roles,
- exception paths (returns, cancellations, partial payments),
- sign-off per domain,
- defect severity and exit criteria.

### 5.3 Exit criteria

- no open critical/high defects,
- UAT sign-off,
- performance targets met,
- security review passed,
- data migration reconciled,
- runbooks complete.

---

## 6. Deploy and cutover

### 6.1 Cutover plan

| Step | Owner | Duration | Rollback |
|---|---|---|---|
| Freeze legacy writes | business | T-2d | reopen |
| Final data extract | data | T-1d | restore |
| Load into production | data | T-0 | restore |
| Reconcile totals | finance | T-0 | fix/restore |
| Smoke test | QA | T-0 | restore |
| Open for users | PM | T+1 | restore |

### 6.2 Cutover checklist

- [ ] Backup verified and restorable.
- [ ] DNS/load balancer switched.
- [ ] Cron jobs active and scheduled.
- [ ] Email/SMS gateways configured.
- [ ] Payment providers live/tested.
- [ ] Integrations enabled with monitoring.
- [ ] Users can log in with correct groups.
- [ ] Reports produce correct figures.
- [ ] Attachments/documents available.
- [ ] Support channel open.

### 6.3 Go/no-go

A go/no-go meeting with the business owner, PM, architect, and finance. Criteria:

- critical defects closed,
- data reconciled,
- training completed,
- support ready,
- rollback plan tested.

---

## 7. Hypercare

- daily triage call for the first 2 weeks,
- prioritized defect fixes,
- user adoption monitoring,
- performance monitoring,
- data quality checks,
- knowledge transfer and documentation,
- transition to BAU support.

**Exit criteria:** stable ticket volume, no critical incidents for 2 weeks, handover accepted.

---

## 8. RACI

| Activity | Sponsor | PM | Architect | Functional | Developer | QA | Business |
|---|---|---|---|---|---|---|---|
| Scope | A | R | C | C | I | I | C |
| Design | I | A | R | C | C | I | C |
| Build | I | A | C | C | R | I | I |
| Test | I | A | C | C | C | R | C |
| UAT | I | A | I | C | I | C | R |
| Cutover | A | R | C | C | C | C | C |
| Hypercare | I | A | C | R | R | R | C |

R = responsible, A = accountable, C = consulted, I = informed.

---

## 9. Timeline template (mid-size, 3 domains)

| Month | Milestone |
|---|---|
| 1 | discovery, scope, data audit |
| 2 | fit-gap, solution design, ADRs |
| 3–4 | foundation + master data + core flows |
| 5 | accounting integration, reports |
| 6 | integrations, data migration dry run |
| 7 | system test, performance, security |
| 8 | UAT, fixes |
| 9 | cutover, hypercare |

Add 20–30% contingency for data quality and localization surprises.

---

## 10. Common programme failures

| Failure | Early signal | Prevention |
|---|---|---|
| Scope creep | "while we're here" requests | change control, backlog |
| Underestimated data | dirty master data | data profiling in discovery |
| Localization surprise | tax/report gaps | accountant review early |
| Integration optimism | "the API is simple" | contract-first, idempotency |
| Key user unavailable | missed workshops | named owners, calendar |
| Testing compressed | UAT starts late | test early, automate |
| No change management | low adoption | training, champions |
| Upgrade mid-project | version drift | pin version, freeze |

---

## 11. Evidence and tailoring

- Tailor phases to size: a 10-user rollout can compress discovery/design into 2 weeks; a multi-country programme can take 18 months.
- The gates are decision points, not bureaucracy. Skip a gate only with an explicit, recorded risk acceptance.
- Keep the backlog and the fit-gap matrix as living documents; they are the project's memory.

Continue with `02-estimation.md`.
