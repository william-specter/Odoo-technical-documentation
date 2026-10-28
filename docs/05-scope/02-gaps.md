# ERP Scope II — Functional Gaps and Their Engineering Consequences

> **Purpose.** A gap is not "Odoo can't do it". It is a capability where the standard product stops at a boundary, and crossing that boundary changes the cost, risk, or architecture of the project. Each gap below states the boundary, the workaround, and the engineering consequence.

---

## 1. Gap severity matrix

| # | Gap | Severity | Typical effort | Architecture impact |
|---|---|---|---|---|
| 1 | Advanced planning/scheduling (APS) | high | 4–12 weeks | external solver |
| 2 | WMS wave/slotting/task interleaving | high | 8–20 weeks | new models + UI |
| 3 | Revenue recognition (IFRS 15) | high | 3–8 weeks | accounting engine |
| 4 | Lease accounting (IFRS 16) | high | 4–8 weeks | asset/liability schedule |
| 5 | Transfer pricing / consolidation eliminations | high | 4–10 weeks | multi-company |
| 6 | Purchase price variance (PPV) | medium | 1–3 weeks | valuation hooks |
| 7 | Commissions | medium | 2–5 weeks | event sourcing |
| 8 | Contract lifecycle management | medium | 4–8 weeks | new models |
| 9 | RMA workflow | medium | 2–4 weeks | stock + portal |
| 10 | Cycle counting / ABC | medium | 2–4 weeks | stock |
| 11 | Quality SPC / control charts | medium | 3–6 weeks | stats + UI |
| 12 | MES/SCADA integration | high | 8–20 weeks | middleware |
| 13 | Global trade compliance | high | 6–16 weeks | external data |
| 14 | Payroll localization | high | country-dependent | localization |
| 15 | Full BI/ETL | medium | 4–12 weeks | warehouse |
| 16 | Document management at scale | medium | 2–6 weeks | storage/search |
| 17 | Real-time WCS | high | 12–24 weeks | hardware |
| 18 | Process manufacturing | high | vertical | new models |

---

## 2. Planning and scheduling

### 2.1 Boundary

`mrp` plans work orders on workcenters with calendars and capacity, but it does not solve a multi-resource, multi-constraint scheduling problem. It has no:

- finite-capacity global optimisation,
- alternative routing selection by load,
- setup-time matrices,
- sequence-dependent changeovers,
- what-if simulation,
- constraint propagation across plants.

### 2.2 Workaround

- use `mrp.workcenter` capacity + `blocked_by_workorder_ids` for simple precedence,
- integrate an APS (OR-Tools, OptaPlanner, commercial APS) through a custom module,
- write planned dates back to `mrp.workorder.date_planned_start/finished`.

### 2.3 Engineering consequence

An APS integration is not a CRUD sync. You need:

- a stable data model for operations, materials, calendars, setups,
- an idempotent import/export protocol,
- conflict resolution when the APS plan diverges from manual edits,
- performance for thousands of operations,
- a fallback when the solver is unavailable.

---

## 3. Warehouse management (WMS)

### 3.1 Boundary

Core `stock` handles locations, routes, quants, pickings, packages, putaway, removal strategies. It does **not** provide:

- wave/batch picking with optimisation,
- slotting (assign products to locations by velocity),
- task interleaving (combine putaway + pick),
- labour management/std-time,
- yard/dock scheduling,
- automated conveyor/WCS control,
- 3D warehouse visualisation.

### 3.2 Workaround

- use `stock.picking.batch` for simple batching (Enterprise `stock_picking_batch`),
- implement wave rules as a custom model + cron,
- compute slotting with a periodic ABC analysis,
- integrate a WMS if volume justifies it.

### 3.3 Engineering consequence

WMS logic is stateful and concurrent. A custom wave engine must handle:

- reservation conflicts,
- partial waves,
- re-slotting while picking,
- cancellation mid-wave,
- device offline/online,
- audit and traceability.

Do not underestimate the operational testing effort; a WMS bug stops the warehouse.

---

## 4. Revenue recognition (IFRS 15 / ASC 606)

### 4.1 Boundary

Core `account` recognises revenue at invoice posting. It does not provide:

- performance obligations,
- transaction price allocation,
- variable consideration,
- contract assets/liabilities,
- time-based recognition schedules,
- contract modifications,
- disaggregated revenue disclosures.

Enterprise `account_reports` has deferred revenue/expense reports, but not a full IFRS 15 engine.

### 4.2 Workaround

- create a `revenue.contract` model with performance obligations,
- allocate transaction price at contract inception,
- generate monthly recognition entries (Dr deferred revenue / Cr revenue),
- link invoices to contracts,
- report contract balances.

### 4.3 Engineering consequence

This is an accounting subsystem, not a field. You need:

- deterministic allocation (rounding, discounts, taxes),
- audit trail per obligation,
- revaluation on contract modification,
- multi-currency,
- integration with revenue reports,
- auditor sign-off.

---

## 5. Lease accounting (IFRS 16 / ASC 842)

### 5.1 Boundary

`account_asset` handles owned assets, not leases. There is no:

- right-of-use asset,
- lease liability amortisation,
- discount rate curves,
- short-term/low-value exemptions,
- sale-and-leaseback,
- remeasurement.

### 5.2 Workaround

- model leases as contracts with a payment schedule,
- compute ROU asset and liability at commencement,
- post monthly depreciation + interest,
- handle modifications and termination.

### 5.3 Engineering consequence

Lease accounting is mathematically sensitive. A 1-basis-point error compounds. Build a calculation engine with tests against the standard's examples, and keep an audit trail of assumptions.

---

## 6. Transfer pricing and consolidation

### 6.1 Boundary

`account_consolidation` [ENT] aggregates companies, but core does not provide:

- intercompany elimination automation at scale,
- transfer pricing policy engine,
- profit-in-inventory elimination,
- currency translation adjustments (CTA) full workflow,
- minority interests,
- segment reporting.

### 6.2 Workaround

- use `account_inter_company_rules` for document mirroring,
- build elimination journals per period,
- maintain a mapping of accounts/segments,
- use consolidation reports for aggregation.

### 6.3 Engineering consequence

Consolidation is a period-end batch process with strict audit requirements. It needs:

- a closed trial balance per company,
- FX rate tables by period,
- elimination rules versioned by period,
- lock dates to prevent post-close changes,
- reconciliation of consolidated vs sum-of-companies.

---

## 7. Purchase price variance

### 7.1 Boundary

Core records the vendor bill at the billed price and the receipt at the PO/standard price. It does not automatically post a PPV entry to a dedicated variance account. `account_3way_match` flags exceptions but does not post them.

### 7.2 Workaround

- add a PPV account on the product category,
- on bill posting, compare `price_unit` to the receipt value,
- post the difference (Dr/Cr PPV, balancing stock valuation/variation account),
- report PPV by product/vendor/period.

### 7.3 Engineering consequence

PPV interacts with:

- standard cost revaluation,
- FIFO/AVCO layers,
- landed costs,
- returns,
- currency.

Define the policy precisely (purchase price variance vs. price difference vs. exchange difference) before coding.

---

## 8. Commissions

### 8.1 Boundary

Core has no commission engine. There is no:

- commission plan,
- tiered rates,
- split attribution,
- clawbacks,
- payout approval,
- commission accounting.

### 8.2 Workaround

- model plans and rules,
- compute on invoice payment (not invoice posting, to avoid paying on unpaid invoices),
- create commission lines and payable entries,
- handle refunds/credit notes.

### 8.3 Engineering consequence

Commission is event-driven and retroactive. A credit note may require a negative commission; a plan change mid-period requires proration. Use an append-only ledger, not a mutable balance.

---

## 9. Contract lifecycle management

### 9.1 Boundary

`sale_subscription` handles recurring billing, `sign` handles signatures, but there is no:

- clause library,
- obligation tracking,
- renewal/termination workflows,
- contract hierarchy,
- compliance reporting.

### 9.2 Workaround

- model contracts with versions and clauses,
- link to SO/subscription/invoices,
- automate renewals with cron,
- store signed PDFs as attachments.

### 9.3 Engineering consequence

CLM is document-heavy and legal-heavy. The engineering is mostly workflow, permissions, and audit; the hard part is the legal content model.

---

## 10. RMA workflow

### 10.1 Boundary

Core supports returns (the `stock.return.picking` wizard) and refunds, but not a full RMA:

- RMA request portal,
- approval workflow,
- inspection/disposition,
- replacement vs repair vs refund,
- warranty tracking,
- restocking fees.

### 10.2 Workaround

- create an `rma.order` model linked to SO/picking,
- portal form for customers,
- inspection step with quality checks,
- generate return picking + credit note/replacement.

### 10.3 Engineering consequence

RMA touches sales, stock, accounting, quality, and portal. Design the state machine first; the integrations follow.

---

## 11. Cycle counting

### 11.1 Boundary

`stock` supports inventory adjustments and manual counts, but not:

- ABC classification,
- scheduled count plans,
- count sheets by zone,
- variance approval,
- recount rules,
- freeze policies.

### 11.2 Workaround

- ABC analysis from move history,
- generate count tasks per period,
- use `stock.quant` inventory fields,
- approve variances with a dedicated model.

### 11.3 Engineering consequence

Counting is a mobile-first workflow with offline requirements. Barcode/RFID integration and conflict handling (count while picking) are the hard parts.

---

## 12. Quality SPC

### 12.1 Boundary

`quality` supports checkpoints and pass/fail/measure, but not:

- control charts (X-bar/R, p-chart),
- Cp/Cpk,
- sampling plans (AQL),
- trend rules (Western Electric),
- SPC alarms.

### 12.2 Workaround

- store measurements in `quality.check` / a custom measure model,
- compute statistics in a report or external BI,
- trigger alerts via automation.

### 12.3 Engineering consequence

SPC requires statistical correctness and time-series storage. Do not compute Cpk in a list view; use a batch job and a proper chart library.

---

## 13. MES/SCADA integration

### 13.1 Boundary

Odoo has no MES. `mrp_workorder` is a shop-floor UI, not a machine integration layer. There is no:

- OPC-UA/MQTT connector,
- machine state model,
- recipe download,
- traceability at machine level,
- Andon,
- real-time OEE from PLCs.

### 13.2 Workaround

- middleware (Node-RED, Ignition, custom service) translates PLC data to Odoo,
- write production confirmations/time logs via RPC,
- use `iot` for simple devices (scales, printers, cameras).

### 13.3 Engineering consequence

This is an OT/IT integration project. Latency, reliability, security zones, and data volume dominate; the Odoo side is the easy part.

---

## 14. Global trade compliance

### 14.1 Boundary

Odoo has Intrastat and some localization reports, but not:

- customs declarations,
- HS classification,
- denied party screening,
- export licences,
- rules of origin,
- duty calculation.

### 14.2 Workaround

- integrate a GTM provider,
- store HS codes and origin on products,
- generate declarations externally.

### 14.3 Engineering consequence

Compliance data changes constantly. Any local cache must be versioned and auditable; a wrong HS code has legal consequences.

---

## 15. Payroll

### 15.1 Boundary

`hr_payroll` [ENT] is a framework, not a global payroll engine. Each country needs a localization with:

- tax brackets,
- social contributions,
- payslip rules,
- legal reports,
- year-end declarations.

Coverage varies; some countries are community modules, some are partner modules, some are absent.

### 15.2 Workaround

- use the localization if it exists and is maintained,
- integrate an external payroll provider for complex countries,
- keep Odoo as the HR master and import payslip summaries.

### 15.3 Engineering consequence

Payroll is high-risk: errors affect employees and compliance. Budget for parallel runs and legal review, not just code.

---

## 16. BI and data warehouse

### 16.1 Boundary

`spreadsheet_dashboard` and `account_reports` are operational reporting, not a warehouse. There is no:

- columnar store,
- ETL scheduler,
- semantic layer,
- row-level security for BI,
- historical snapshots.

### 16.2 Workaround

- replicate to PostgreSQL/ClickHouse/BigQuery,
- model dimensions/facts,
- schedule ETL,
- use a BI tool (Metabase, Superset, Power BI).

### 16.3 Engineering consequence

Direct BI queries on the Odoo primary compete with OLTP. Use a replica or CDC; never run heavy analytics on the production primary.

---

## 17. Process manufacturing

### 17.1 Boundary

Odoo's `mrp` is discrete manufacturing: BoMs, units, work orders. It lacks:

- recipes/formulas with scaling,
- potency/activity,
- co-products/by-products with variable yields,
- bulk UoM conversions,
- tank/batch traceability,
- shelf-life constraints.

### 17.2 Workaround

- model recipes as BoMs with percentage components,
- use lots for batch traceability,
- custom yield/co-product logic,
- vertical third-party modules.

### 17.3 Engineering consequence

Process manufacturing changes the core data model (batch, recipe, yield). Retrofitting it onto `mrp` is possible but expensive; evaluate a vertical solution first.

---

## 18. Gap management playbook

1. **Quantify the gap.** Write the user story, the frequency, the volume, and the cost of *not* having it.
2. **Check the edge.** Many gaps are 80% covered by a combination of core features; verify before building.
3. **Estimate the integration surface.** Count the models, states, and reports touched.
4. **Decide build vs buy vs integrate.** A vertical module or external system is often cheaper.
5. **Design the boundary.** Keep custom logic in a dedicated module; do not fork core.
6. **Plan the data migration.** Gaps often need historical data (contracts, leases, serials).
7. **Plan the audit.** Regulated gaps need immutable trails and reports.
8. **Test operationally.** A gap that works in a demo but fails at month-end is not closed.

---

## 19. Evidence and caveats

- Capability assessments are based on module manifests and source inspection, not a formal functional audit.
- Enterprise modules and localizations change frequently; re-verify before committing.
- Some "gaps" are deliberate product boundaries (Odoo is not an APS, MES, or GTM system). Treat them as integration points, not defects.

Continue with `03-performance.md`.
