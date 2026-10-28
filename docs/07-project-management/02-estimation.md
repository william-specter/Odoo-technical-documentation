# Project Management II — Estimation and Budgeting

> **Warning.** Odoo estimates fail most often on **data**, **localization**, and **integration**, not on screen count. A "simple" CRUD screen is cheap; a reconciled migration of 10 years of invoices is not.

---

## 1. Estimation units

Use **person-days (PD)** at 6 productive hours. Avoid story points for fixed-price work; use them only for velocity inside a sprint.

| Size | PD | Example |
|---|---|---|
| XS | 0.5–1 | add a field + view + ACL |
| S | 1–3 | small module, one flow |
| M | 4–10 | module with 2–3 models, tests, migration |
| L | 11–25 | cross-module feature, integration |
| XL | 26–60 | subsystem (commissions, revenue recognition) |
| XXL | 60+ | vertical/APS/WMS |

---

## 2. Estimation formula

```
Total = Σ (base effort × complexity × risk)
      + data migration
      + integration
      + testing/UAT support
      + project management
      + contingency
```

### 2.1 Base effort by work type

| Work type | Base PD | Notes |
|---|---|---|
| Configuration (per domain) | 3–10 | settings, taxes, routes, chart |
| Simple CRUD module | 1–3 | one model, views, ACL |
| Business module | 5–15 | 2–4 models, state machine, tests |
| Cross-module feature | 10–25 | touches sale/stock/account |
| Report (QWeb) | 1–3 | layout + data |
| Report (financial/BI) | 5–15 | aggregation, reconciliation |
| Integration (simple REST) | 5–10 | one endpoint, auth, retries |
| Integration (bidirectional) | 15–40 | mapping, conflicts, monitoring |
| Data migration (per entity) | 2–10 | depends on quality/volume |
| Security model | 2–8 | roles, rules, tests |
| Performance tuning | 3–10 | profiling, indexes, refactor |
| Upgrade (major version) | 10–30% of build | migrations, regression |

### 2.2 Complexity multipliers

| Factor | Multiplier |
|---|---|
| Single company, single currency | 1.0 |
| Multi-company | 1.2–1.4 |
| Multi-currency | 1.1–1.3 |
| Multi-language | 1.1–1.2 |
| Regulated (SOX, GxP) | 1.3–1.5 |
| Custom localization | 1.2–1.5 |
| Legacy data quality poor | 1.3–2.0 |
| Real-time integration | 1.3–1.6 |
| High volume (> 1M moves/year) | 1.2–1.5 |
| Offline/mobile | 1.3–1.6 |

### 2.3 Risk contingency

| Risk level | Contingency |
|---|---|
| Low (standard, known data) | 10% |
| Medium (some custom, average data) | 20% |
| High (new domain, poor data, many integrations) | 30–40% |

Contingency is not padding; it is the expected cost of known unknowns. Track it separately.

---

## 3. Drivers that dominate

### 3.1 Data migration

Estimate per entity:

| Entity | Driver | PD guidance |
|---|---|---|
| Partners | duplicates, VAT validation, addresses | 2–5 |
| Products/variants | attributes, UoM, categories | 3–8 |
| Opening stock | lots, locations, valuation | 5–15 |
| Open orders | lines, prices, taxes | 3–8 |
| Open invoices | reconciliation, residuals | 5–15 |
| Chart of accounts | mapping, balances | 5–15 |
| Fixed assets | cost, depreciation history | 3–10 |
| BoMs/routings | structure, workcenters | 3–10 |
| Attachments | volume, naming, links | 2–8 |

**Rule of thumb:** data migration is 20–40% of a mature ERP project. If your estimate says 5%, you have not looked at the data.

### 3.2 Localization

- chart of accounts + taxes: 3–10 PD,
- e-invoicing: 5–20 PD (country-dependent),
- legal reports: 5–15 PD,
- payroll: 10–40 PD (country-dependent),
- accountant review: 2–5 PD.

### 3.3 Integration

For each integration, estimate:

- contract/API design: 1–3 PD,
- auth/error handling: 1–2 PD,
- mapping/transformation: 2–8 PD,
- idempotency/outbox: 2–4 PD,
- monitoring/alerting: 1–2 PD,
- testing with external system: 2–5 PD.

### 3.4 Testing and UAT

- test design: 10–20% of build,
- automation: 10–20% of build,
- UAT support: 10–15% of build,
- regression: 5–10% per release.

### 3.5 Project management

- PM: 10–15% of total,
- BA/functional: 15–25%,
- architect: 10–15%,
- change management/training: 5–10%.

---

## 4. Sample estimate: mid-size distribution company

Scope: 50 users, 1 company, sales, purchase, inventory, accounting, 2 warehouses, 1 e-commerce integration, 5 years of data.

| Workstream | PD |
|---|---|
| Discovery & design | 25 |
| Configuration (sales/purchase/inventory/accounting) | 35 |
| Custom modules (approvals, commissions, RMA) | 45 |
| Reports (5 operational + 3 financial) | 20 |
| E-commerce integration | 25 |
| Data migration (partners, products, stock, open documents) | 55 |
| Security & roles | 8 |
| Testing & automation | 30 |
| UAT support | 15 |
| Training & change management | 12 |
| PM/BA/architecture | 35 |
| **Subtotal** | **305** |
| Contingency 25% | 76 |
| **Total** | **381 PD** |

At 8 PD/person-week, that is ~48 person-weeks, or ~11 weeks with a team of 4–5 (with parallel workstreams).

---

## 5. Estimate by module complexity

| Module | Config PD | Custom PD (typical) | Notes |
|---|---|---|---|
| `sale` | 5–10 | 5–20 | pricing, approvals, documents |
| `purchase` | 3–8 | 3–15 | approvals, 3-way match |
| `stock` | 8–15 | 5–25 | routes, putaway, barcode |
| `account` | 10–20 | 5–30 | localization, reports |
| `mrp` | 8–15 | 10–30 | BoMs, workorders, costing |
| `project` | 3–8 | 3–10 | billing, stages |
| `crm` | 2–5 | 3–10 | pipeline, automation |
| `website_sale` | 5–10 | 5–20 | theme, checkout, payment |
| `hr` | 3–8 | 3–10 | payroll separate |
| Integrations | — | 10–40 each | depends on system |

---

## 6. Bottom-up vs top-down

### 6.1 Bottom-up

For each epic:

1. list user stories,
2. identify models/methods/views,
3. estimate each story (XS–XL),
4. add tests/migration,
5. sum and apply multipliers.

### 6.2 Top-down

Use a reference project (similar size/domain) and adjust:

```
estimate = reference_effort × size_ratio × complexity_ratio × risk_ratio
```

Top-down is useful for sanity-checking bottom-up; a 2× discrepancy means an assumption is wrong.

### 6.3 Three-point

For high uncertainty:

```
E = (O + 4M + P) / 6
```

Use for integrations, migrations, and localization.

---

## 7. Estimation anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Counting screens | Odoo screens are cheap; data/logic is expensive |
| Ignoring data | 20–40% of effort |
| Assuming standard localization | every country differs |
| "The API is simple" | mapping/error handling dominates |
| No contingency | surprises become overruns |
| Estimating in hours | false precision |
| One estimate for all teams | skill/experience varies |
| Forgetting UAT/training | adoption risk |
| Forgetting upgrades | 10–30% of build |
| Fixed price without scope | change requests eat margin |

---

## 8. Budget model

| Cost | Basis |
|---|---|
| Licences | Odoo Enterprise per user/month (or Odoo.sh) |
| Implementation | PD × rate |
| Infrastructure | hosting, DB, backup, monitoring |
| Data migration | PD × rate |
| Training | PD × rate + materials |
| Support | annual % of licence/implementation |
| Contingency | 10–30% |
| Internal effort | key users, UAT, change management |

Total cost of ownership over 5 years includes upgrades, support, and internal admin.

---

## 9. Tracking

- burn-up by epic, not by task,
- earned value: planned vs actual PD,
- variance reasons (scope, data, estimates),
- re-estimate at each gate,
- change requests priced before acceptance.

---

## 10. Evidence and calibration

- Keep a historical database of estimates vs actuals by work type.
- After each project, update the multipliers.
- Separate "estimate" from "commitment"; a commitment includes contingency and a change process.
- Review estimates with the delivery team, not only managers.

Continue with `03-team-and-roles.md`.
