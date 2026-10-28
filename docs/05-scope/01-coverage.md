# ERP Scope I — Functional Coverage Matrix

> **How to read this.** "Out-of-box" means a standard Odoo 19 Enterprise module provides the capability with configuration only. "Configure" means it is possible but requires non-trivial setup, data, or localization. "Custom" means it requires code or a third-party module. Coverage is assessed for the 19.0 Enterprise tree in this repository.

---

## 1. Coverage legend

| Rating | Meaning |
|---|---|
| ● | out-of-box, configuration only |
| ◐ | out-of-box with significant configuration/localization |
| ○ | partial; gaps need custom code |
| ✗ | not covered; custom or third-party |

---

## 2. Commercial

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| Quotations and sales orders | ● | `sale`, `sale_management` | no `done` state in v19 |
| Pricelists, discounts | ● | `product`, `sale` | rules by product/category/qty/date |
| Customer-specific pricing | ● | `product` | supplier/customer info, pricelists |
| Multi-currency sales | ● | `sale`, `account` | rate snapshot at order date |
| Sales approvals | ◐ | `sale_management` | simple threshold; complex matrices custom |
| CPQ / configurable products | ◐ | `product`, `sale` | variants and attributes, not a full CPQ engine |
| Subscriptions | ◐ | `sale_subscription` [ENT] | recurring plans; complex usage billing custom |
| Rental | ◐ | `sale_renting` [ENT] | period pricing, late fees |
| eCommerce | ● | `website_sale` | B2C/B2B, checkout, payment |
| Marketplace connectors | ◐ | `sale_amazon`, `sale_shopee`, ... [ENT] | per-marketplace, rate limits |
| POS | ● | `point_of_sale` | offline-capable, restaurant |
| CRM pipeline | ● | `crm` | stages, teams, leads |
| Marketing automation | ◐ | `marketing_automation` [ENT] | campaign workflows, not a full CDP |
| Loyalty | ● | `loyalty`, `sale_loyalty` | coupons, points, promotions |
| Commissions | ○ | none in core | custom or third-party |
| Contract management | ○ | `sale_subscription`, `sign` | no CLM clause library |

---

## 3. Purchasing

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| RFQ → PO | ● | `purchase` | approval thresholds |
| Vendor price lists | ● | `product` | `product.supplierinfo` |
| Purchase requisitions | ● | `purchase_requisition` | blanket orders |
| Three-way match | ◐ | `account_3way_match` [ENT] | flags, not hard block |
| Landed costs | ● | `stock_landed_costs` | allocation methods |
| Vendor returns | ● | `purchase_stock` | return picking + credit |
| Purchase price variance | ○ | none | custom accounting |
| Supplier scorecards | ○ | none | custom |
| Contract pricing | ○ | `purchase_requisition` partial | no full contract lifecycle |
| E-procurement / punch-out | ✗ | none | custom/third-party |

---

## 4. Inventory and logistics

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| Multi-warehouse | ● | `stock` | routes per warehouse |
| Multi-step receipts/deliveries | ● | `stock` | 1/2/3 step routes |
| Lot/serial tracking | ● | `stock` | expiration dates |
| Packages | ● | `stock` | package types, dimensions |
| Putaway rules | ● | `stock` | location/package/category |
| Removal strategies | ● | `stock` | FIFO/LIFO/closest/least packages |
| Barcode operations | ◐ | `stock_barcode` [ENT] | mobile UI |
| Cycle counting | ○ | `stock` | manual counts; ABC scheduling custom |
| Wave picking | ○ | none in core | custom/third-party |
| Slotting / task interleaving | ✗ | none | WMS extension |
| Cross-docking | ● | `stock` | route |
| Dropshipping | ● | `stock`, `purchase_stock` | |
| Consignment | ● | `stock` | owner on quants |
| Landed costs | ● | `stock_landed_costs` | |
| Shipping connectors | ● | `delivery_*` | carrier APIs |
| Returns (RMA) | ◐ | `stock`, `sale_stock` | basic; RMA workflow custom |
| Inventory valuation | ● | `stock_account` | FIFO/AVCO/standard |
| Multi-company stock | ● | `stock` | intercompany transfers |

---

## 5. Manufacturing

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| BoMs (including phantom) | ● | `mrp` | multi-level |
| Work orders / routings | ● | `mrp` | workcenters, calendars |
| Shop-floor UI | ◐ | `mrp_workorder` [ENT] | tablet UI |
| Planning / scheduling | ◐ | `mrp` | finite at workcenter level, not APS |
| Capacity planning | ○ | `mrp` | basic; advanced APS custom |
| MRP / reordering | ● | `stock`, `mrp` | orderpoints, scheduler |
| Subcontracting | ◐ | `mrp_subcontracting` | complex edge cases |
| Quality control | ◐ | `quality`, `quality_mrp` | checkpoints, not SPC |
| PLM / ECO | ◐ | `mrp_plm` [ENT] | engineering changes |
| Maintenance | ● | `maintenance` | preventive/Corrective |
| Costing | ● | `mrp_account` | material + labour + overhead |
| WIP accounting | ○ | `mrp_account` | basic; detailed WIP custom |
| MES integration | ✗ | none | custom/third-party |
| OEE / downtime analytics | ○ | `mrp_workorder` | time tracking, not full OEE |
| Process manufacturing (recipes, potency) | ✗ | none | vertical/third-party |

---

## 6. Accounting and finance

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| General ledger | ● | `account` | |
| Customer/vendor invoices | ● | `account` | |
| Payments and reconciliation | ● | `account` | bank reconciliation |
| Taxes | ● | `account` | Odoo 19 pure-function engine |
| Fiscal positions | ● | `account` | |
| Multi-currency | ● | `account` | FX gain/loss |
| Analytical accounting | ● | `analytic` | distributions |
| Budgets | ◐ | `account_budget` [ENT] | basic |
| Fixed assets | ● | `account_asset` [ENT] | linear/degressive |
| Financial reports | ● | `account_reports` [ENT] | statements, tax |
| Consolidation | ◐ | `account_consolidation` [ENT] | multi-company |
| Revenue recognition | ○ | none in core | deferred revenue modules/custom |
| Lease accounting (IFRS 16) | ○ | none in core | custom/localization |
| Transfer pricing | ✗ | none | custom |
| Dunning | ● | `account_followup` [ENT] | |
| Bank statement import | ● | `account_bank_statement_import*` | CAMT/OFX/QIF/CSV |
| E-invoicing | ◐ | `account_edi*` | per-country formats |
| Payroll | ◐ | `hr_payroll` [ENT] + localizations | country-specific |
| Expense management | ● | `hr_expense` | |
| Treasury | ○ | none dedicated | custom |

---

## 7. Human resources

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| Employees / org chart | ● | `hr` | |
| Time off | ● | `hr_holidays` | |
| Attendance | ● | `hr_attendance` | |
| Recruitment | ● | `hr_recruitment` | |
| Appraisals | ● | `hr_appraisal` [ENT] | |
| Payroll | ◐ | `hr_payroll` [ENT] | localization-dependent |
| Timesheets | ● | `hr_timesheet`, `timesheet_grid` | |
| Field service | ● | `industry_fsm` [ENT] | |
| Planning / shifts | ● | `planning` [ENT] | |
| Skills | ● | `hr_skills` | |
| LMS | ● | `website_slides` | |

---

## 8. Projects and services

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| Projects/tasks | ● | `project` | |
| Kanban/Gantt | ● | `project`, `web_gantt` | |
| Timesheets | ● | `hr_timesheet` | |
| Billing from time | ● | `sale_timesheet` | |
| Helpdesk | ● | `helpdesk` [ENT] | |
| Field service | ● | `industry_fsm` [ENT] | |
| Approvals | ● | `approvals` [ENT] | |
| Knowledge base | ● | `knowledge` [ENT] | |
| eSignature | ● | `sign` [ENT] | |
| Documents | ● | `documents` [ENT] | |
| Project profitability | ◐ | `project_account` | basic; advanced custom |

---

## 9. Platform and integration

| Capability | Rating | Module(s) | Notes |
|---|---|---|---|
| REST/JSON-RPC API | ● | `http`, `service` | no native REST; JSON-RPC |
| XML-RPC | ● | `service` | legacy but supported |
| Webhooks (outbound) | ◐ | `ir.actions.server` | no retry/signature |
| Webhooks (inbound) | ◐ | controllers | custom |
| OAuth2 / SSO | ◐ | `auth_oauth`, `auth_saml` | enterprise/community mix |
| LDAP | ◐ | `auth_ldap` | external dep |
| 2FA | ● | `auth_totp` | |
| Audit log | ◐ | `mail.thread`, `ir.logging` | not tamper-proof |
| Multi-company | ● | `base`, `account` | |
| Multi-currency | ● | `account` | |
| Localization | ● | 245 `l10n_*` modules | coverage varies |
| BI / dashboards | ◐ | `spreadsheet_dashboard`, `account_reports` | not a full BI platform |
| Data import/export | ● | `base_import`, `base_export` | |
| Studio (no-code) | ● | `web_studio` [ENT] | not for complex logic |
| IoT | ◐ | `iot` [ENT] | devices, scales, printers |
| AI features | ◐ | `ai`, `ai_app` [ENT] | OCR, suggestions |

---

## 10. Scope boundary summary

### 10.1 Strong out-of-box

- standard commercial flows (quote → order → delivery → invoice → payment),
- standard purchase flows (RFQ → PO → receipt → bill → payment),
- standard inventory (multi-warehouse, lots, routes, valuation),
- standard manufacturing (BoM, MO, work orders, costing),
- double-entry accounting with taxes, reconciliation, assets,
- CRM, projects, helpdesk, eCommerce, POS,
- multi-company, multi-currency, multi-language.

### 10.2 Configure-heavy

- localization (chart of accounts, taxes, e-invoicing),
- approval matrices,
- multi-step logistics,
- subscription/rental pricing,
- payroll,
- quality checkpoints,
- intercompany automation.

### 10.3 Custom-heavy

- APS / advanced scheduling,
- WMS wave/slotting,
- MES/SCADA integration,
- revenue recognition (IFRS 15) and lease accounting (IFRS 16),
- transfer pricing and consolidation eliminations,
- PPV and complex cost accounting,
- commissions,
- contract lifecycle management,
- industry verticals (process manufacturing, healthcare, public sector).

### 10.4 Not covered

- full BI/ETL platform,
- document management at scale (basic Documents app only),
- HR talent suite (succession, compensation benchmarking),
- procurement punch-out/e-procurement,
- global trade compliance (customs, denied party screening),
- manufacturing execution (MES) and SPC,
- real-time warehouse control (WCS).

---

## 11. Evidence and caveats

- Coverage is based on module presence and manifest dependencies, not on a hands-on functional test of every feature.
- Enterprise modules require an Enterprise licence; some are auto-installed and change menus/behaviour.
- Localization coverage varies widely by country; verify the `l10n_<country>` module for your fiscal regime.
- Odoo releases change feature sets; re-verify against the exact version before committing to a gap.

Continue with `02-gaps.md`.
