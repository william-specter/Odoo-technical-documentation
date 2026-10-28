# Project Management III — Team Structure and Roles

> **Principle.** Odoo projects fail when the team is a group of generalists without clear ownership, or a group of specialists who never talk. The minimum viable team has functional ownership, technical ownership, and business ownership.

---

## 1. Core roles

| Role | Primary accountability | Key skills |
|---|---|---|
| Sponsor | budget, scope, escalation | business authority |
| Project Manager | plan, risks, communication, change control | delivery, stakeholder mgmt |
| Solution Architect | architecture, integration, security, NFRs | Odoo internals, DB, integrations |
| Functional Consultant / BA | fit-gap, configuration, workshops, UAT | domain processes, Odoo config |
| Developer | custom modules, tests, migrations | Python, ORM, PostgreSQL, JS/OWL |
| Data Engineer | extract/transform/load, reconciliation | SQL, Python, data quality |
| QA Engineer | test strategy, automation, regression | Odoo testing, Selenium/Playwright |
| DevOps Engineer | environments, CI/CD, backup, monitoring | Docker, PostgreSQL, Linux |
| Change Manager | training, comms, adoption | org change, training |
| Key User | business validation, UAT, champion | domain expertise |
| Accountant | chart/taxes/localization/reports | local GAAP/IFRS |

---

## 2. RACI by phase

| Phase | Sponsor | PM | Architect | Functional | Developer | Data | QA | DevOps | Key User |
|---|---|---|---|---|---|---|---|---|---|
| Discovery | A | R | C | R | I | C | I | I | C |
| Design | I | A | R | R | C | C | I | I | C |
| Build | I | A | C | R | R | R | I | C | I |
| Test | I | A | C | C | C | C | R | C | C |
| UAT | I | A | I | C | I | I | C | I | R |
| Cutover | A | R | C | C | C | R | C | R | C |
| Hypercare | I | A | C | R | R | C | R | R | R |
| Closure | A | R | C | C | I | I | I | I | C |

---

## 3. Role profiles

### 3.1 Solution Architect

**Owns:** technical design, module boundaries, integration patterns, security model, performance, upgrade strategy.

**Must know:**

- ORM runtime, transactions, cache/recompute,
- module dependency and MRO,
- PostgreSQL schema/indexing,
- accounting and stock internals,
- security model (ACL/rules/sudo),
- integration patterns (idempotency, outbox).

**Deliverables:**

- solution architecture document,
- ADRs,
- data model extensions,
- security matrix,
- NFR targets,
- code review for high-risk changes.

### 3.2 Functional Consultant / BA

**Owns:** fit-gap, configuration, process design, UAT scenarios, training content.

**Must know:**

- the business domain (not just Odoo),
- standard Odoo flows and their limits,
- configuration vs customisation trade-offs,
- localization constraints.

**Deliverables:**

- fit-gap matrix,
- process maps,
- configuration workbook,
- UAT scripts,
- training materials.

### 3.3 Developer

**Owns:** custom modules, tests, migrations, code quality.

**Must know:**

- Python, Odoo ORM, `_inherit`/`super()`,
- XML views and assets,
- PostgreSQL and SQL,
- testing framework,
- security (ACL/rules/sudo).

**Deliverables:**

- modules with tests,
- migration scripts,
- code reviews,
- technical documentation.

### 3.4 Data Engineer

**Owns:** source profiling, mapping, ETL, reconciliation, cutover load.

**Must know:**

- SQL, Python, file formats,
- Odoo import/export and external IDs,
- data quality and deduplication,
- reconciliation techniques.

**Deliverables:**

- data audit,
- mapping specification,
- ETL scripts,
- reconciliation reports,
- cutover runbook.

### 3.5 QA Engineer

**Owns:** test plan, automation, regression, defect triage.

**Must know:**

- Odoo test classes, tours,
- API testing,
- performance testing,
- security testing basics.

**Deliverables:**

- test plan,
- automated suites,
- defect reports,
- release sign-off.

### 3.6 DevOps Engineer

**Owns:** environments, deployment, backup/restore, monitoring, security patching.

**Must know:**

- Linux, Docker, PostgreSQL,
- Odoo workers/cron/gevent,
- reverse proxy/TLS,
- backup/restore and filestore,
- CI/CD.

**Deliverables:**

- environment diagram,
- deployment pipeline,
- backup/restore runbook,
- monitoring dashboards,
- incident runbooks.

### 3.7 Change Manager

**Owns:** stakeholder engagement, training, communication, adoption.

**Must know:**

- the business impact of each change,
- training methods,
- resistance management,
- adoption metrics.

**Deliverables:**

- communication plan,
- training plan/materials,
- adoption dashboard,
- feedback loop.

### 3.8 Key User

**Owns:** business validation, UAT, first-line support, process adherence.

**Must know:** the process end-to-end, the data, the exceptions.

**Deliverables:** UAT sign-off, SOPs, champion network.

---

## 4. Team size by project scale

| Scale | Users | Team |
|---|---|---|
| Small | < 25 | PM/BA (1), developer (1–2), DevOps (shared), key user (1–2) |
| Medium | 25–150 | PM, architect (part-time), 2 BAs, 2–3 developers, data engineer, QA, DevOps, key users |
| Large | 150–1,000 | PM, programme manager, architect(s), BA team, dev team, data team, QA team, DevOps, change manager, localization experts |
| Multi-country | 1,000+ | programme office, per-country leads, integration team, security/compliance, support desk |

---

## 5. Decision rights

| Decision | Owner | Consulted |
|---|---|---|
| Scope change | Sponsor | PM, architect |
| Architecture | Architect | PM, developers |
| Process design | Functional lead | Key users |
| Data mapping | Data engineer | Functional, business |
| Security model | Architect | Security/compliance |
| Go-live | Sponsor | PM, QA, business |
| Emergency rollback | PM | Architect, DevOps |

**[INVARIANT]** One person must be accountable for each decision. Committees can consult, not decide.

---

## 6. Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| No business owner | scope drift, low adoption |
| Architect only at the end | rework, security gaps |
| Functional consultant writes code | fragile customisations |
| Developer designs process | technically correct, business-wrong |
| No QA | regressions, UAT surprises |
| No DevOps | manual, risky deployments |
| Key users unavailable | validation delayed |
| Offshore team without domain context | miscommunication |
| One person does everything | bus factor, burnout |

---

## 7. Collaboration rituals

- daily stand-up (15 min) per workstream,
- weekly steering committee (sponsor, PM, architect),
- sprint demo every 2 weeks,
- design authority meeting weekly,
- defect triage daily during UAT,
- cutover war room,
- hypercare daily.

---

## 8. Handover checklist

- [ ] Architecture and ADRs updated.
- [ ] Runbooks (deploy, restore, incident, close).
- [ ] Access and credentials transferred securely.
- [ ] Monitoring/alerts owned by operations.
- [ ] Backlog and known issues documented.
- [ ] Training delivered and recorded.
- [ ] Support model and SLAs agreed.
- [ ] Warranty period defined.

Continue with `04-quality-gates.md`.
