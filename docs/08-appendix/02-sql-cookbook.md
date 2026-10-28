# Appendix B — SQL Cookbook for Odoo 19

> **Warning.** These queries are read-only diagnostics unless stated. Never run `UPDATE`/`DELETE` against an Odoo database without a backup, a transaction, and a tested rollback. Prefer the ORM for writes.

---

## 1. Schema inspection

```sql
-- Tables and sizes
SELECT relname AS table, pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 30;

-- Columns of a table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sale_order'
ORDER BY ordinal_position;

-- Indexes of a table
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'stock_move';

-- Foreign keys
SELECT conname, conrelid::regclass AS table, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND conrelid = 'sale_order_line'::regclass;
```

---

## 2. Module and model metadata

```sql
-- Installed modules
SELECT name, state, latest_version, auto_install
FROM ir_module_module
WHERE state IN ('installed','to upgrade','to install')
ORDER BY name;

-- Dependents of a module
SELECT d.name, d.state
FROM ir_module_module_dependency dep
JOIN ir_module_module d ON d.id = dep.module_id
JOIN ir_module_module m ON m.id = dep.depend_id
WHERE m.name = 'account'
ORDER BY d.name;

-- Models without ACLs (danger)
SELECT m.model
FROM ir_model m
WHERE m.transient = false
  AND NOT EXISTS (SELECT 1 FROM ir_model_access a WHERE a.model_id = m.id);

-- Fields of a model
SELECT name, ttype, store, required, readonly, relation
FROM ir_model_fields
WHERE model = 'sale.order'
ORDER BY name;

-- XML IDs for a record
SELECT module, name, noupdate
FROM ir_model_data
WHERE model = 'sale.order' AND res_id = 123;
```

---

## 3. Sales

```sql
-- Order status overview
SELECT state, invoice_status, delivery_status, COUNT(*)
FROM sale_order
GROUP BY state, invoice_status, delivery_status
ORDER BY state;

-- Lines to invoice
SELECT so.name, sol.id, pp.default_code, sol.product_uom_qty,
       sol.qty_delivered, sol.qty_invoiced, sol.qty_to_invoice
FROM sale_order_line sol
JOIN sale_order so ON so.id = sol.order_id
JOIN product_product pp ON pp.id = sol.product_id
WHERE so.state = 'sale' AND sol.qty_to_invoice <> 0
ORDER BY so.name;

-- Orders with no delivery
SELECT so.name, so.date_order, so.amount_total
FROM sale_order so
WHERE so.state = 'sale'
  AND NOT EXISTS (SELECT 1 FROM stock_picking sp WHERE sp.sale_id = so.id);

-- Sales margin (standard cost approximation)
SELECT so.name, pp.default_code, sol.product_uom_qty, sol.qty_delivered,
       sol.price_subtotal,
       pp.standard_price * sol.qty_delivered AS estimated_cost,
       sol.price_subtotal - pp.standard_price * sol.qty_delivered AS margin
FROM sale_order_line sol
JOIN sale_order so ON so.id = sol.order_id
JOIN product_product pp ON pp.id = sol.product_id
WHERE so.state = 'sale'
ORDER BY margin ASC;
```

---

## 4. Purchase

```sql
-- Open POs and receipt status
SELECT po.name, po.state, rp.name AS vendor, po.amount_total,
       po.invoice_status,
       COALESCE(SUM(pol.qty_received), 0) AS received,
       COALESCE(SUM(pol.product_qty), 0) AS ordered
FROM purchase_order po
JOIN res_partner rp ON rp.id = po.partner_id
LEFT JOIN purchase_order_line pol ON pol.order_id = po.id
WHERE po.state IN ('purchase','to approve')
GROUP BY po.id, rp.name
ORDER BY po.date_approve DESC;

-- Bills awaiting matching
SELECT am.name, am.invoice_origin, am.amount_total, am.state, am.release_to_pay
FROM account_move am
WHERE am.move_type = 'in_invoice' AND am.state = 'posted'
  AND am.release_to_pay IN ('no','exception')
ORDER BY am.invoice_date_due;
```

`release_to_pay` exists only with `account_3way_match`.

---

## 5. Inventory

```sql
-- On hand by product/location
SELECT pp.default_code, pt.name->>'en_US' AS product,
       sl.complete_name AS location,
       SUM(sq.quantity) AS qty,
       SUM(sq.reserved_quantity) AS reserved,
       SUM(sq.quantity - sq.reserved_quantity) AS available
FROM stock_quant sq
JOIN product_product pp ON pp.id = sq.product_id
JOIN product_template pt ON pt.id = pp.product_tmpl_id
JOIN stock_location sl ON sl.id = sq.location_id
WHERE sl.usage = 'internal'
GROUP BY pp.default_code, pt.name, sl.complete_name
HAVING SUM(sq.quantity) <> 0
ORDER BY pp.default_code;

-- Negative quants
SELECT pp.default_code, sl.complete_name, sq.quantity, sq.reserved_quantity
FROM stock_quant sq
JOIN product_product pp ON pp.id = sq.product_id
JOIN stock_location sl ON sl.id = sq.location_id
WHERE sq.quantity < 0
ORDER BY sq.quantity;

-- Open moves
SELECT sm.id, sm.origin, pp.default_code, sm.product_uom_qty, sm.quantity,
       sm.state, sm.date, sl.complete_name AS src, sd.complete_name AS dest
FROM stock_move sm
JOIN product_product pp ON pp.id = sm.product_id
JOIN stock_location sl ON sl.id = sm.location_id
JOIN stock_location sd ON sd.id = sm.location_dest_id
WHERE sm.state NOT IN ('done','cancel')
ORDER BY sm.date;

-- Duplicate quants (same key)
SELECT product_id, location_id, lot_id, package_id, owner_id, COUNT(*)
FROM stock_quant
GROUP BY product_id, location_id, lot_id, package_id, owner_id
HAVING COUNT(*) > 1;
```

---

## 6. Accounting

```sql
-- Trial balance
SELECT aa.code, aa.name->>'en_US' AS account,
       SUM(aml.debit) AS debit, SUM(aml.credit) AS credit,
       SUM(aml.balance) AS balance
FROM account_move_line aml
JOIN account_move am ON am.id = aml.move_id
JOIN account_account aa ON aa.id = aml.account_id
WHERE am.state = 'posted' AND am.date <= DATE '2026-12-31'
GROUP BY aa.code, aa.name
ORDER BY aa.code;

-- Unbalanced posted moves (should be empty)
SELECT am.id, am.name, SUM(aml.debit) - SUM(aml.credit) AS diff
FROM account_move am
JOIN account_move_line aml ON aml.move_id = am.id
WHERE am.state = 'posted'
GROUP BY am.id, am.name
HAVING SUM(aml.debit) <> SUM(aml.credit);

-- Open receivables
SELECT am.name, rp.name AS partner, am.invoice_date_due,
       am.amount_total, am.amount_residual
FROM account_move am
JOIN res_partner rp ON rp.id = am.partner_id
WHERE am.move_type = 'out_invoice' AND am.state = 'posted'
  AND am.payment_state IN ('not_paid','partial')
ORDER BY am.invoice_date_due;

-- Sequence gaps
SELECT am.name, am.sequence_number, am.journal_id, am.state
FROM account_move am
WHERE am.state = 'posted' AND am.name <> '/'
ORDER BY am.journal_id, am.sequence_number;

-- Hash chain entries
SELECT name, secure_sequence_number, inalterable_hash
FROM account_move
WHERE inalterable_hash IS NOT NULL
ORDER BY journal_id, secure_sequence_number;
```

---

## 7. Manufacturing

```sql
-- Open MOs
SELECT mp.name, pp.default_code, mp.product_qty, mp.qty_producing,
       mp.state, mp.date_start, mp.date_finished
FROM mrp_production mp
JOIN product_product pp ON pp.id = mp.product_id
WHERE mp.state NOT IN ('done','cancel')
ORDER BY mp.date_start;

-- Component shortages
SELECT mp.name, pp.default_code, sm.product_uom_qty, sm.quantity, sm.state
FROM mrp_production mp
JOIN stock_move sm ON sm.raw_material_production_id = mp.id
JOIN product_product pp ON pp.id = sm.product_id
WHERE mp.state IN ('confirmed','progress')
  AND sm.state NOT IN ('done','cancel')
  AND sm.quantity < sm.product_uom_qty;

-- Workorder time
SELECT wo.id, mp.name, wo.name, wo.state, wo.duration_expected, wo.duration
FROM mrp_workorder wo
JOIN mrp_production mp ON mp.id = wo.production_id
WHERE mp.state NOT IN ('done','cancel')
ORDER BY mp.name, wo.sequence;
```

---

## 8. Performance diagnostics

```sql
-- Long transactions
SELECT pid, now() - xact_start AS age, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY age DESC
LIMIT 20;

-- Blocking
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid,
       blocked.query AS blocked_query, blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks kl ON kl.locktype = bl.locktype
                 AND kl.database IS NOT DISTINCT FROM bl.database
                 AND kl.relation IS NOT DISTINCT FROM bl.relation
                 AND kl.page IS NOT DISTINCT FROM bl.page
                 AND kl.tuple IS NOT DISTINCT FROM bl.tuple
                 AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
                 AND kl.granted
JOIN pg_stat_activity blocking ON blocking.pid = kl.pid;

-- Idle in transaction
SELECT pid, now() - state_change AS idle_age, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY idle_age DESC;

-- Slow queries
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Unused indexes
SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table bloat estimate (dead tuples)
SELECT relname, n_live_tup, n_dead_tup,
       ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1), 2) AS dead_ratio
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;
```

---

## 9. Security and audit

```sql
-- Users and groups
SELECT u.id, u.login, u.active, g.name->>'en_US' AS group_name
FROM res_users u
JOIN res_groups_users_rel r ON r.uid = u.id
JOIN res_groups g ON g.id = r.gid
WHERE u.active
ORDER BY u.login;

-- Global ACLs (group_id IS NULL)
SELECT m.model, a.perm_read, a.perm_write, a.perm_create, a.perm_unlink
FROM ir_model_access a
JOIN ir_model m ON m.id = a.model_id
WHERE a.group_id IS NULL AND a.active;

-- Record rules on a model
SELECT r.name, r.domain_force, r.perm_read, r.perm_write, r.perm_create, r.perm_unlink
FROM ir_rule r
JOIN ir_model m ON m.id = r.model_id
WHERE m.model = 'sale.order' AND r.active;

-- Recent messages (audit)
SELECT mm.date, mm.model, mm.res_id, mm.message_type, mm.body
FROM mail_message mm
WHERE mm.date > now() - interval '1 day'
ORDER BY mm.date DESC
LIMIT 100;
```

---

## 10. Data quality

```sql
-- Partners without VAT (if required)
SELECT id, name FROM res_partner
WHERE is_company AND active AND (vat IS NULL OR vat = '');

-- Products without category/UoM
SELECT id, name FROM product_template
WHERE categ_id IS NULL OR uom_id IS NULL;

-- Duplicate VAT
SELECT vat, COUNT(*) FROM res_partner
WHERE vat IS NOT NULL AND vat <> ''
GROUP BY vat HAVING COUNT(*) > 1;

-- Duplicate barcodes
SELECT barcode, COUNT(*) FROM product_product
WHERE barcode IS NOT NULL AND barcode <> ''
GROUP BY barcode HAVING COUNT(*) > 1;

-- Attachments without files (filestore check must be external)
SELECT id, name, store_fname, file_size
FROM ir_attachment
WHERE store_fname IS NOT NULL AND file_size = 0;
```

---

## 11. Safety rules

- [ ] Always `BEGIN;` for manual writes and `ROLLBACK;` after inspection.
- [ ] Take a backup before any `UPDATE`/`DELETE`.
- [ ] Use `WHERE id = ...`, never a broad predicate.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` before trusting a query.
- [ ] Do not run heavy analytics on the primary during business hours.
- [ ] Do not update `ir_model_fields`/`ir_model_data` manually unless you know the registry implications.
- [ ] After manual SQL writes, invalidate the ORM cache (`env.invalidate_all()`) or restart workers.

Continue with `03-debug-playbook.md`.
