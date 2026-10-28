# Module Relationships V — Version Compatibility and 18→19 Breaking Changes

> **Purpose.** The official documentation snapshot is 20.0, the source is 19.0, and most community modules were written for 17/18. This chapter catalogues the changes that break custom code, with the exact source evidence.

---

## 1. Why 19 breaks things

Odoo 19 is not a cosmetic release. It removes or replaces several core models and changes field semantics. The most dangerous changes are silent: code still runs but returns wrong data or writes to a dead column.

### 1.1 Breaking changes at a glance

| Area | Removed / changed | Replacement | Impact |
|---|---|---|---|
| Procurement | `procurement.group` model | `stock.reference` | queries, overrides, reports |
| Valuation | `stock.valuation.layer` model | `stock.move.value`, `product.value` | valuation reports, custom layers |
| Product type | `type='product'` | `type='consu'` + `is_storable` | stock filters, BoM, routes |
| UoM | `uom.category`, `category_id` | tree `relative_uom_id` / `relative_factor` | conversions, custom UoM code |
| Sales state | `state='done'` | `locked` boolean | state checks |
| Purchase state | `state='done'` | no done state | state checks |
| Tax engine | `_compute_taxes` helpers | pure-function pipeline | tax overrides |
| Access API | `check_access_rights`, `check_access_rule` | `check_access`, `has_access` | security code |
| Grouping API | `read_group` | `_read_group` / `formatted_read_group` | dashboards |
| Active API | `toggle_active` | `action_archive` / `action_unarchive` | UI actions |
| Request API | `request.cr`, `request.uid`, `request.context` | `request.env.*` | controllers |
| ORM API | `name_get` | `display_name` / `_compute_display_name` | display code |
| ORM API | `api.one`, `api.multi` | none (removed earlier) | legacy modules |
| Domain | raw list | `Domain` class | SQL helpers, custom domains |
| Index API | `create_unique_index` | `create_index(unique=True)` | migrations |

---

## 2. Procurement: `stock.reference` [V19]

### 2.1 What changed

In ≤18, a procurement group grouped moves/pickings:

```python
group = env['procurement.group'].create({'name': so.name})
move.procurement_group_id = group
```

In 19, the model is gone. `stock.reference` groups documents:

```python
reference = env['stock.reference'].create({'name': so.name})
move.reference_ids = [Command.link(reference.id)]
```

`stock.reference` has `name`, `move_ids` (M2M), and computed `picking_ids`.

### 2.2 Migration checklist

- [ ] Search custom code for `procurement.group`, `procurement_group_id`, `group_id`.
- [ ] Replace with `stock.reference` / `reference_ids`.
- [ ] Update reports joining `procurement_group_id`.
- [ ] Update XML data that references `procurement.group`.
- [ ] Test SO → delivery, PO → receipt, MO grouping.

**[WARNING]** Comments and docstrings still mention "procurement group" in the 19 source (e.g. `stock_rule.py:316`). Do not infer the model exists from comments; check `_name` declarations.

---

## 3. Valuation: no `stock.valuation.layer` [V19]

### 3.1 What changed

In ≤18, valuation layers recorded every value change. In 19:

- `stock.move.value` is the move's total value,
- `stock.move.remaining_qty` / `remaining_value` track FIFO layers,
- `product.value` records manual value changes (standard price, lot price, move value),
- `product.standard_price` is the current cost.

### 3.2 Migration checklist

- [ ] Replace `stock.valuation.layer` queries with `stock.move.value`.
- [ ] Replace layer-based reports with move-based FIFO/AVCO logic.
- [ ] Custom `_create_valuation_layer` overrides must be rewritten.
- [ ] Reconcile opening/closing stock value after migration.

### 3.3 Valuation priority

`_get_value_data` uses:

1. manual `product.value`,
2. vendor bill / invoice,
3. production cost,
4. quotation (SO/PO),
5. returns,
6. standard price,
7. extra costs (landed costs).

Source: `stock_account/models/stock_move.py:365-470`.

---

## 4. Product type: `consu` + `is_storable` [V19]

### 4.1 What changed

| Old | New |
|---|---|
| `type='product'` | `type='consu'`, `is_storable=True` |
| `type='consu'` | `type='consu'`, `is_storable=False` |
| `type='service'` | unchanged |

`type` now has `consu`, `service`, `combo`. Stock behaviour is driven by `is_storable`.

### 4.2 Migration checklist

```python
# Old
if product.type == 'product':

# New
if product.is_storable:
```

- [ ] Replace every `type == 'product'` / `type != 'product'`.
- [ ] Replace `type == 'consu'` if the intent was "storable".
- [ ] Update domains in XML: `[('type','=','product')]`.
- [ ] Update server actions and filters.

**[WARNING]** `type == 'consu'` is now true for both storable and non-storable goods. A filter that previously excluded consumables now includes them.

---

## 5. UoM tree [V19]

### 5.1 What changed

| Old | New |
|---|---|
| `uom.category` model | removed |
| `uom.uom.category_id` | removed |
| `uom.uom.factor` (relative to category ref) | computed from tree |
| per-category rounding | global `decimal.precision` "Product Unit" |
| `uom.uom.rounding` stored | computed |

Each UoM has `relative_uom_id` and `relative_factor`; `factor` is the absolute factor to the tree root. Conversion walks the tree.

### 5.2 Migration checklist

- [ ] Remove references to `uom.category` / `category_id`.
- [ ] Recreate UoM hierarchies with `relative_uom_id`/`relative_factor`.
- [ ] Recalculate conversion factors; verify `factor` values.
- [ ] Test purchase/sale/stock conversions across UoMs.
- [ ] Check custom reports that joined `uom_category`.

### 5.3 Conversion API

```python
qty_in_uom = uom_from._compute_quantity(qty, uom_to, rounding_method='HALF-UP')
```

or per product:

```python
qty_product_uom = product.uom_id._compute_quantity(qty, product_uom)
```

**[WARNING]** `rounding` is global. Two UoMs cannot have different rounding anymore; if your business needs that, enforce it in custom code.

---

## 6. Document states

### 6.1 Sales

| Old | New |
|---|---|
| `state='done'` | `state='sale'` + `locked=True` |
| `action_done` | `action_lock` |
| `action_unlock` | `action_unlock` |

### 6.2 Purchase

| Old | New |
|---|---|
| `state='done'` | no done state; use `qty_received` / `invoice_status` |
| `action_done` | `button_approve` / receipt validation |

### 6.3 Manufacturing

`mrp.production.state` is **computed** from moves/work orders. `state='done'` must be reached via `button_mark_done`, not written.

**Migration checklist:**

- [ ] Search custom code and XML for `state == 'done'` on SO/PO.
- [ ] Replace with `locked` or quantity checks.
- [ ] Update kanban/list decorations.
- [ ] Update automations with state filters.

---

## 7. Tax engine [V19]

### 7.1 What changed

Odoo 19 uses pure functions on base-line dictionaries:

```
_prepare_product_base_line_for_taxes_computation
_add_tax_details_in_base_lines
_round_base_lines_tax_details
_aggregate_base_lines_tax_details
_aggregate_base_lines_aggregated_values
```

Legacy helpers (`_compute_taxes`, `_prepare_invoice_aggregated_taxes`) are deprecated shims or removed.

### 7.2 Migration checklist

- [ ] Replace `_compute_taxes` overrides with `_get_tax_details` / base-line pipeline.
- [ ] Test tax-included, fixed, and repartition taxes.
- [ ] Test cash basis and round-globally.
- [ ] Verify tax report tags.

Source: `account/models/account_tax.py:1137`, `:4972`.

---

## 8. ORM API changes

### 8.1 Removed/deprecated

| API | Status | Replacement |
|---|---|---|
| `name_get()` | removed | `display_name`, `_compute_display_name` |
| `api.one` | removed | loop over `self` |
| `api.multi` | removed | default recordset behaviour |
| `read_group` | deprecated (19) | `_read_group`, `formatted_read_group` |
| `check_access_rights` | deprecated (18) | `check_access` |
| `check_access_rule` | deprecated (18) | `check_access` |
| `_filter_access_rules` | deprecated (18) | `_filtered_access` |
| `toggle_active` | deprecated (19) | `action_archive` / `action_unarchive` |
| `request.cr` / `request.uid` / `request.context` | deprecated (19) | `request.env.cr` etc. |
| `create_unique_index` | deprecated (19) | `create_index(unique=True)` |
| `_filter_access_rules_python` | deprecated (18) | `_filtered_access` |

### 8.2 `create()` signature

`create()` now asserts a list/tuple (`orm/models.py:4611`). The `@api.model_create_multi` decorator provides backward compatibility for a single dict, but overriding `create(self, vals)` without it breaks batch callers.

```python
@api.model_create_multi
def create(self, vals_list):
    records = super().create(vals_list)
    ...
    return records
```

### 8.3 Domain class

`Domain` is now a first-class object (`orm/domains.py:196`). Custom SQL helpers should accept `Domain` and use `.to_sql()`/`_to_sql()` rather than string manipulation. The legacy `_where_calc` is deprecated in favour of `Domain.custom`.

### 8.4 `read_group` → `_read_group`

```python
# Old
env['sale.order'].read_group(domain, ['amount_total:sum'], ['partner_id'])

# New
env['sale.order']._read_group(domain, ['partner_id'], ['amount_total:sum'])
```

Return shape differs: `_read_group` returns tuples, not dicts.

---

## 9. Field and attribute changes

| Change | Impact |
|---|---|
| `group_operator` → `aggregator` | custom fields using `group_operator` warn |
| `tracking` accepts int (sequence) | `tracking=True` still works |
| `precompute` attribute | stored computes can be precomputed at create |
| `index='btree_not_null'` | partial index; replaces some `index=True` |
| `index='trigram'` | GIN trigram for text search |
| `models.Constraint` / `models.Index` | declarative table objects |
| `_depends` on SQL views | required for `_table_query` models |

---

## 10. Frontend changes

- OWL 2 is the default; legacy widget APIs are gone.
- `web.assets_backend` bundles replace `js`/`css` manifest keys.
- The list view is the default (tree renamed to list in UI and code).
- `web_studio` edits are stored as data; they do not survive a module upgrade if the underlying view changes.
- The POS frontend is OWL-based; old POS widgets are removed.

---

## 11. Compatibility matrix for custom modules

| Your module targets | Runs on 19? | Action |
|---|---|---|
| 19.0 | yes | — |
| 18.0 | mostly, with breaks | audit the table above |
| 17.0 | unlikely | port ORM + frontend |
| 16.0 | no | rewrite |
| 15.0 or earlier | no | rewrite |

### 11.1 Porting order

1. manifest `version` → `19.0.x.y.z`,
2. replace removed models/fields,
3. fix `create`/`write` signatures,
4. replace deprecated APIs,
5. update views (list/tree, xpath anchors),
6. update assets/OWL,
7. run tests,
8. migration scripts for data.

---

## 12. Testing the port

- [ ] Install on a clean 19 database.
- [ ] Install on a copy of production (with data).
- [ ] Run module tests.
- [ ] Run key business flows.
- [ ] Check `ir.model.fields` for stale field references.
- [ ] Check views load (`ir.ui.view` validation).
- [ ] Check cron jobs and automations.
- [ ] Compare reports before/after.

---

## 13. Evidence index

| Topic | File |
|---|---|
| `stock.reference` | `addons/stock/models/stock_reference.py` |
| Valuation | `addons/stock_account/models/stock_move.py:193-470` |
| Product type | `addons/product/models/product_template.py:54-62` |
| UoM tree | `addons/uom/models/uom_uom.py:18-100` |
| Sale states | `addons/sale/models/sale_order.py:26-31` |
| Purchase states | `addons/purchase/models/purchase_order.py:105-116` |
| Tax engine | `addons/account/models/account_tax.py:1137`, `4972` |
| ORM deprecations | `orm/models.py:2748`, `4161-4190`, `5789` |
| Domain class | `orm/domains.py:196` |

Continue with Volume 5: ERP scope boundaries.
