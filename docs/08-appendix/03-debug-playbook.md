# Appendix C — Debugging and Incident Playbook

> **Rule.** Reproduce in staging, isolate the layer, prove the cause, then fix. Do not "try things" on production.

---

## 1. First 10 minutes

| Step | Action |
|---|---|
| 1 | Capture the exact URL/action, user, time, database, and error message |
| 2 | Check `ir.logging` / server logs around the timestamp |
| 3 | Check recent deployments/module upgrades |
| 4 | Check DB health (connections, locks, long transactions) |
| 5 | Reproduce in staging with the same data |
| 6 | Classify: data / code / config / infrastructure / integration |
| 7 | Open an incident with severity and owner |

---

## 2. Logs

### 2.1 Levels

```bash
--log-level=debug_sql     # every query
--log-level=debug         # ORM details
--log-level=info          # default
--log-level=warn          # warnings only
--log-level=error         # errors only
```

### 2.2 Useful greps

```bash
grep -n "ERROR\|CRITICAL\|Traceback" /var/log/odoo/odoo.log | tail -50
grep -n "WARNING" /var/log/odoo/odoo.log | tail -50
grep -n "module .*: creating or updating" /var/log/odoo/odoo.log
grep -n "Too many iterations for recomputing" /var/log/odoo/odoo.log
grep -n "Failed to load registry" /var/log/odoo/odoo.log
```

### 2.3 Request correlation

If the reverse proxy adds a request id, log it in a custom middleware/controller and include it in error reports. Odoo's default logs do not correlate requests across workers.

---

## 3. Odoo shell

```bash
odoo-bin shell -c /etc/odoo/odoo.conf -d mydb
```

```python
# inspect a record
so = env['sale.order'].browse(123)
print(so.state, so.locked, so.invoice_status, so.delivery_status)
print(so.order_line.mapped(lambda l: (l.product_id.display_name, l.qty_to_invoice)))

# inspect fields
print(so._fields['state'].selection)
print(so._fields.keys())

# run a method (commits on exit unless you rollback)
env.cr.rollback()   # always rollback exploratory writes
```

**[WARNING]** `odoo-bin shell` commits on clean exit by default in some versions. Call `env.cr.rollback()` explicitly if you only inspected or wrote test data.

---

## 4. Common errors

### 4.1 `UserError`

Business rule violation. Read the message; it is intentional. Find the `raise UserError` in source:

```bash
grep -rn "raise UserError" addons/sale --include=*.py | grep -i "confirm"
```

### 4.2 `AccessError`

- model ACL missing → `ir.model.access`
- record rule → `ir.rule`
- field group → `groups=` on field
- portal/public user → check `auth` and rules

```python
env['ir.model.access'].check('sale.order', 'write', raise_exception=False)
env['ir.rule']._get_rules('sale.order', 'write')
```

### 4.3 `MissingError`

A record was deleted or the recordset is stale after `unlink`. Call `.exists()` before access; do not hold recordsets across unlink.

### 4.4 `ValidationError` from IntegrityError

A SQL constraint failed. The retry wrapper converts `IntegrityError` to `ValidationError`. Check:

- unique constraint,
- NOT NULL,
- FK,
- check constraint.

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'my_table'::regclass;
```

### 4.5 `psycopg2.errors.SerializationFailure`

Concurrent update conflict. The request wrapper retries 5 times. If it persists:

- reduce transaction length,
- check for hot rows (quants, sequences, config),
- check lock ordering.

### 4.6 `psycopg2.errors.DeadlockDetected`

Two transactions lock rows in opposite order. Find the queries in the log, sort ids before writing, and reduce batch size.

### 4.7 `psycopg2.errors.LockNotAvailable`

A `NOWAIT`/`SKIP LOCKED` query could not acquire a lock. Usually stock quants or cron jobs. Retry or process sequentially.

### 4.8 `KeyError: 'model.name'`

The model is not in the registry:

- module not installed,
- dependency missing,
- registry not reloaded after code change,
- typo in model name.

### 4.9 `ValueError: Invalid field ...`

The field does not exist on the model:

- typo,
- module not upgraded,
- field removed in v19,
- Studio field not loaded.

### 4.10 `ParseError` / view validation

An XML view is invalid or an xpath does not match. The error includes the view ID and file. Fix the xpath or the anchor; do not `position="replace"` the whole form.

### 4.11 `RegistryError: Cannot get registry`

The database is not initialized, the module graph is broken, or the DB is unreachable. Check:

```bash
psql -d mydb -c "SELECT state, COUNT(*) FROM ir_module_module GROUP BY state;"
```

### 4.12 Worker killed / 502

Check:

- `limit_memory_hard` reached,
- `limit_time_real` exceeded,
- OOM killer (`dmesg`),
- DB connection exhaustion.

---

## 5. Performance debugging

```python
from odoo.tools.profiler import Profiler

with Profiler(collectors=['sql', 'traces_async']) as p:
    do_work()
print(p.summary())
```

```python
before = env.cr.sql_log_count
do_work()
print("queries:", env.cr.sql_log_count - before)
```

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Checklist:

- [ ] query count,
- [ ] sequential scans,
- [ ] missing indexes,
- [ ] N+1,
- [ ] unbounded search,
- [ ] compute storm,
- [ ] lock waits,
- [ ] worker/DB pool.

---

## 6. Accounting debugging

| Symptom | Check |
|---|---|
| Cannot post | `_check_balanced`, partner, date, lock date |
| Wrong total | tax lines, fiscal position, currency rate |
| Duplicate sequence | `account_move.name`, sequence lock |
| Hash error | `inalterable_hash`, `secure_sequence_number` |
| Payment won't reconcile | residual, account type, partner, currency |
| Exchange diff missing | currency rates, partial amounts |
| COGS missing | product category valuation accounts, move value |

```python
move = env['account.move'].browse(id)
print(move.state, move.amount_total, move.amount_total_signed)
for l in move.line_ids:
    print(l.account_id.code, l.debit, l.credit, l.balance, l.amount_currency, l.currency_id.name)
```

---

## 7. Stock debugging

| Symptom | Check |
|---|---|
| Picking not assigned | quants, reservation method, route |
| Cannot validate | `picked`, lots, packages, quantities |
| Negative stock | quants, forced moves |
| Wrong valuation | move `value`, cost method, bill/PO price |
| Duplicate quants | `stock_quant` group by key |
| Backorder not created | picking type `create_backorder` |

```python
picking = env['stock.picking'].browse(id)
print(picking.state, picking.picking_type_id.code)
for m in picking.move_ids:
    print(m.product_id.display_name, m.product_uom_qty, m.quantity, m.state, m.picked)
    for ml in m.move_line_ids:
        print('  ', ml.quantity, ml.lot_id.name, ml.location_id.complete_name, ml.location_dest_id.complete_name)
```

---

## 8. Manufacturing debugging

| Symptom | Check |
|---|---|
| MO not confirmed | BoM, components, picking type |
| Cannot mark done | raw moves picked, qty_producing, WOs |
| Wrong cost | `_cal_price`, workcenter cost, byproducts |
| Stuck to_close | workorder states |
| Phantom creates MO | BoM type |

```python
mo = env['mrp.production'].browse(id)
print(mo.state, mo.qty_producing, mo.product_qty, mo.reservation_state)
for m in mo.move_raw_ids:
    print(m.product_id.display_name, m.product_uom_qty, m.quantity, m.state, m.picked)
print(mo.workorder_ids.mapped(lambda w: (w.name, w.state, w.duration)))
```

---

## 9. Module install/upgrade debugging

```bash
odoo-bin -c odoo.conf -d mydb -u my_module --stop-after-init --log-level=debug
```

Check:

- `__manifest__.py` syntax,
- `depends` completeness,
- data file order,
- xpath anchors,
- migration script signature,
- external dependencies,
- ACL warnings,
- `ir.model.fields` reflection.

---

## 10. Frontend debugging

- browser console/network,
- OWL devtools,
- `--dev=assets` to disable bundling,
- check `web.assets_backend` includes your files,
- verify template inheritance (`t-inherit`),
- clear browser cache/hard reload,
- check `ir.ui.view` arch in the DB.

---

## 11. Integration debugging

| Symptom | Check |
|---|---|
| 401/403 | API key, session, user groups |
| 422 | payload validation, required fields |
| Duplicate records | idempotency key, unique constraint |
| Timeout | transaction length, external latency |
| Lost events | outbox state, cron, retries |
| Data mismatch | mapping, currency, UoM, timezone |

Always log the external request id and the Odoo record id; correlate both.

---

## 12. Incident severity

| Severity | Definition | Response |
|---|---|---|
| S1 | production down, data loss, security breach | immediate, war room |
| S2 | critical flow blocked, workaround unavailable | < 1 h |
| S3 | degraded flow, workaround exists | < 4 h |
| S4 | minor/cosmetic | next release |

---

## 13. Postmortem template

```markdown
# Postmortem: <Incident>

## Summary
## Impact
## Timeline (UTC)
## Root cause
## Detection
## Resolution
## What went well
## What went wrong
## Action items
| Action | Owner | Due | Status |
```

Blameless: focus on systems and controls, not individuals.

---

## 14. Evidence index

| Topic | File |
|---|---|
| Retry/errors | `service/model.py:160` |
| Access checks | `orm/models.py:4100` |
| Registry | `orm/registry.py` |
| Cron | `addons/base/models/ir_cron.py` |
| Bus | `addons/bus/models/bus.py` |
| Profiler | `tools/profiler.py` |

Continue with `04-checklists.md`.
