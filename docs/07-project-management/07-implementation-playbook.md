# Project Management VII — Implementation Playbook

> **Use.** A practical, phase-by-phase guide from kickoff to hypercare. Adapt durations to scope; keep the sequence.

---

## 1. Kickoff (week 0)

### 1.1 Inputs

- signed contract/statement of work,
- sponsor and key users named,
- access to systems and data,
- hosting/environment plan.

### 1.2 Activities

- kickoff meeting with sponsor, PM, architect, functional leads, key users,
- confirm scope, timeline, governance, escalation,
- agree communication cadence and tools,
- set up repository, CI, environments,
- create RAID log and decision log.

### 1.3 Outputs

- project charter,
- RACI,
- communication plan,
- environment access,
- backlog skeleton.

---

## 2. Discovery (weeks 1–4)

### 2.1 Workshops

| Domain | Agenda |
|---|---|
| Sales | quote-to-cash, pricing, discounts, approvals, delivery, invoicing |
| Purchase | requisition-to-pay, approvals, receipts, 3-way match |
| Inventory | warehouses, routes, lots, counts, valuation |
| Manufacturing | BoMs, routing, planning, costing, quality |
| Accounting | chart, taxes, localization, close, reports |
| HR/Projects | only if in scope |

### 2.2 Data audit

- sources and owners,
- volumes and growth,
- quality (nulls, duplicates, formats),
- mapping complexity,
- retention/legal constraints.

### 2.3 Outputs

- as-is process maps,
- to-be process maps,
- fit-gap matrix v1,
- data audit report,
- risk register v1,
- estimate v1.

---

## 3. Design (weeks 3–8)

### 3.1 Solution design

- module selection and dependency closure,
- configuration workbook (company, taxes, routes, pricelists, groups),
- custom module specifications,
- data model extensions,
- integration contracts,
- security matrix,
- reporting catalogue,
- migration strategy.

### 3.2 Design authority

Weekly review with architect, functional lead, developer lead. Approve ADRs; reject scope creep.

### 3.3 Outputs

- solution architecture document,
- ADRs,
- ER diagrams,
- sequence/activity diagrams for critical flows,
- backlog with estimates,
- updated risk register.

---

## 4. Build (weeks 6–20)

### 4.1 Foundation

1. create company/companies,
2. configure chart of accounts, taxes, fiscal positions,
3. users, groups, ACLs, record rules,
4. sequences, journals, payment methods,
5. warehouses, locations, routes, operation types,
6. product categories, UoM, pricelists.

### 4.2 Master data

- partners (customers, vendors, contacts),
- products/templates/variants,
- BoMs/routings/workcenters,
- pricelists/discounts,
- opening balances (later).

### 4.3 Core flows

- sales: quote → confirm → deliver → invoice → pay,
- purchase: RFQ → approve → receive → bill → pay,
- inventory: transfer, adjust, return, scrap,
- manufacturing: BoM → MO → work order → done,
- accounting: journal entry, reconciliation, close.

### 4.4 Custom development

- follow the module layout in `01-business-logic/03-service-layer.md`,
- write tests with each story,
- migration scripts from day one,
- code review gate.

### 4.5 Data migration

- build extract/transform/load scripts,
- use external IDs for idempotency,
- reconcile counts and totals,
- dry run on staging every sprint,
- document mapping.

### 4.6 Integrations

- contract-first,
- auth and error handling,
- idempotency/outbox,
- sandbox testing,
- monitoring.

---

## 5. Test (weeks 16–24)

- system test (end-to-end),
- regression suite,
- performance test on production-like data,
- security test (roles, portal, API),
- migration rehearsal,
- UAT scenarios and data,
- defect triage.

**Exit:** no critical/high defects, performance targets met, UAT sign-off.

---

## 6. Cutover (weeks 24–26)

### 6.1 T-minus plan

| Time | Activity | Owner |
|---|---|---|
| T-10d | freeze scope, final data extract plan | PM |
| T-7d | final dry run, reconcile | Data |
| T-3d | comms to users, support rota | Change |
| T-2d | backup, freeze legacy writes | DevOps/Business |
| T-1d | final extract/load | Data |
| T-0 | reconcile, smoke test, go/no-go | Finance/QA/Sponsor |
| T+1 | open users, hypercare starts | PM |

### 6.2 Cutover runbook

- step, owner, duration, dependency, verification, rollback,
- communication at each milestone,
- war room bridge,
- decision log.

### 6.3 Go/no-go

- data reconciled,
- critical flows pass,
- security verified,
- support ready,
- rollback tested.

---

## 7. Hypercare (weeks 26–32)

### 7.1 Cadence

- daily triage (15 min),
- daily status to sponsor,
- weekly trend report,
- defect SLA: critical 4h, high 1d, medium 3d.

### 7.2 Focus

- stabilize flows,
- fix data issues,
- tune performance,
- train stragglers,
- document workarounds,
- close open items.

### 7.3 Exit criteria

- no critical incidents for 2 weeks,
- ticket volume trending down,
- users trained,
- runbooks and handover accepted,
- support contract active.

---

## 8. Handover

- architecture and ADRs,
- configuration workbook,
- custom module documentation,
- data mapping and ETL,
- integration contracts and monitoring,
- runbooks,
- access/credentials,
- backlog and known issues,
- training records.

---

## 9. 90-day quick plan (small rollout)

| Week | Focus |
|---|---|
| 1 | kickoff, discovery workshops |
| 2 | fit-gap, data audit |
| 3 | design, environment setup |
| 4 | foundation config |
| 5 | master data, core sales/purchase |
| 6 | inventory, accounting |
| 7 | custom modules, reports |
| 8 | data migration dry run |
| 9 | system test, performance |
| 10 | UAT |
| 11 | fixes, cutover rehearsal |
| 12 | go-live, hypercare start |

This is aggressive; it assumes a small scope, clean data, and a co-located team.

---

## 10. Playbook anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Build before design sign-off | rework |
| Configure production directly | no rollback |
| Migrate data at the end | surprises, delay |
| Skip UAT | adoption failure |
| No cutover rehearsal | overrun |
| No hypercare | orphaned users |
| No handover | vendor lock-in |
| No change control | scope creep |

---

## 11. Artefact checklist

- [ ] charter, RACI, communication plan
- [ ] process maps (as-is/to-be)
- [ ] fit-gap matrix
- [ ] solution architecture + ADRs
- [ ] configuration workbook
- [ ] data mapping + ETL + reconciliation
- [ ] integration contracts
- [ ] security matrix
- [ ] test plan + results
- [ ] UAT sign-off
- [ ] cutover plan + rehearsal
- [ ] runbooks
- [ ] training materials
- [ ] hypercare report
- [ ] handover sign-off

Continue with `08-templates.md`.
