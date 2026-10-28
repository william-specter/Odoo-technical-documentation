# ERP Scope III — Performance Bottlenecks and Scaling Limits

> **Bottlenecks are architectural, not just code-level.** The ORM chapter explains query cost; this chapter explains where the platform as a whole slows down, why, and what to do before users notice.

---

## 1. The ten bottlenecks that matter

| # | Bottleneck | Trigger | Impact |
|---|---|---|---|
| 1 | Unbounded ORM searches | list views, reports, imports | memory/CPU spikes |
| 2 | Recompute storms | broad `@api.depends`, bulk writes | CPU, transaction time |
| 3 | Long transactions | external calls, crons, imports | locks, bloat, timeouts |
| 4 | Stock quant contention | concurrent deliveries/receipts | deadlocks, retries |
| 5 | Accounting sequence lock | bulk invoice posting | serialised posting |
| 6 | Mail tracking volume | tracked fields on high-volume models | DB growth, email queues |
| 7 | Attachment/filestore I/O | large PDFs/images | disk, backup time |
| 8 | Reporting on primary | BI, spreadsheets, exports | OLTP slowdown |
| 9 | Worker/connection mis-sizing | too few workers, too many connections | latency, 502s |
| 10 | Autovacuum/bloat | high-churn tables | slow scans, disk growth |

---

## 2. Commercial flows

### 2.1 Sales order confirmation

Cost drivers:

- pricelist computation per line (SQL + Python),
- tax computation per line,
- stock procurement (route resolution, move creation),
- mail tracking,
- automation triggers.

At 100+ lines, confirm can take seconds and create dozens of moves/pickings. At 1,000 lines, it can time out.

**Mitigations:**

- limit line count per order (business rule),
- disable tracking on non-essential fields,
- batch confirm in a cron, not in a web request,
- avoid onchange-heavy custom fields,
- test with a realistic catalog (pricelists, taxes, routes).

### 2.2 Invoice creation

`_create_invoices` loads order lines, computes taxes, groups invoices, creates moves and lines. For a month-end batch of 10k orders:

- do it in chunks (500–1,000),
- commit between chunks (cron with progress),
- expect sequence lock contention,
- monitor `account_move_line` growth.

### 2.3 Portal and website

Website queries are read-heavy and often unbounded:

- product listing with facets,
- price computation per variant,
- stock availability per product,
- cart/checkout writes.

**Mitigations:**

- cache catalog pages,
- limit variants per template,
- avoid `virtual_available` in loops (it aggregates),
- use a CDN for static assets,
- separate website workers if traffic is high.

---

## 3. Inventory flows

### 3.1 Reservation and validation

- `_gather` searches quants by product/location/lot/package/owner.
- `_update_available_quantity` locks one quant row.
- `_action_done` updates quants per move line and creates valuation entries.

Concurrent validation of the same product across warehouses causes lock waits. The retry wrapper masks them as latency, not errors.

**Mitigations:**

- index `stock_quant(product_id, location_id)`,
- avoid validating the same SKU concurrently (operational scheduling),
- batch by picking, not by move line,
- monitor `pg_locks` during peak.

### 3.2 Valuation

`_set_value` for FIFO walks remaining moves; for AVCO updates standard price. Large FIFO stacks make outgoing valuation O(n).

**Mitigations:**

- keep FIFO layers bounded (periodic revaluation/cleanup),
- avoid negative stock (it corrupts FIFO),
- use standard cost where business allows,
- test month-end valuation with production volumes.

### 3.3 Inventory reports

`qty_available`, `virtual_available`, `free_qty` are computed with context-dependent aggregates. A product list showing availability for 100 products can issue 100+ queries.

**Mitigations:**

- prefetch/aggregate in one query,
- cache availability for catalog pages,
- avoid availability in list views for large catalogs.

---

## 4. Manufacturing

- BoM explosion is recursive but bounded by BoM depth; deep multi-level BoMs with phantoms are expensive.
- Workorder planning iterates calendars/capacity; hundreds of operations per MO are slow.
- `_post_inventory` consumes components and produces finished goods; large MOs create many moves/lines.
- Cost computation aggregates consumed move values and workorder costs; complex routings add cost.

**Mitigations:**

- limit MO size; split into batches,
- simplify BoMs (avoid unnecessary phantom levels),
- plan in a cron, not interactively,
- precompute workcenter costs,
- monitor `mrp_workcenter_productivity` growth.

---

## 5. Accounting

### 5.1 Posting

- `_check_balanced` + `_sync_dynamic_lines` recompute tax/payment term lines.
- Sequence allocation locks per journal/period.
- Hash chain adds SHA-256 per move.
- Reconciliation creates partials and exchange moves.

Bulk posting 10k invoices in one transaction is a common anti-pattern: it holds the sequence lock and grows the transaction log.

**Mitigations:**

- post in chunks with commits between chunks,
- separate journals for high-volume flows,
- avoid hash chaining unless legally required,
- monitor `pg_stat_activity` for lock waits.

### 5.2 Reporting

Trial balance, general ledger, aged receivables, and tax reports aggregate `account_move_line`. Without proper indexes and date filters, they scan millions of rows.

**Mitigations:**

- index `(company_id, date, account_id)`,
- restrict date ranges,
- use Enterprise `account_reports` engine (optimised SQL),
- run heavy reports on a replica,
- materialise monthly balances if needed.

### 5.3 Reconciliation

`_reconcile_plan` batches partials but still loads lines and residuals. Bank reconciliation with thousands of statement lines is memory-heavy.

**Mitigations:**

- reconcile in batches,
- avoid matching across huge date ranges,
- use rules/models to automate,
- monitor `account_partial_reconcile` growth.

---

## 6. Mail and notifications

`mail.thread` writes messages and tracking values on tracked field changes. High-volume models with tracking generate:

- `mail_message` rows,
- `mail_tracking_value` rows,
- follower notifications,
- email queue entries.

**Mitigations:**

- audit `tracking=True` on stock moves, account moves, and import-heavy models,
- disable tracking in imports (`tracking_disable=True`),
- batch notifications,
- purge old messages per retention policy,
- avoid `message_post` in loops.

---

## 7. Imports and exports

- `base_import` loads CSV/XLS in memory; large files can exhaust worker memory.
- Each row triggers create/write, computes, constraints, and tracking.
- Import mode uses savepoints and may be slow.

**Mitigations:**

- split files (< 10k rows),
- disable tracking and automations during import,
- use `load()` with mapped fields,
- validate before import,
- run in a dedicated worker/cron.

---

## 8. Attachments and filestore

- Large binaries in `ir_attachment` slow backups and restores.
- `db_datas` (bytea) bloats the database and WAL.
- Filestore on NFS/S3 adds latency.

**Mitigations:**

- use filestore for large files,
- compress PDFs/images,
- set retention for transient attachments,
- back up filestore incrementally,
- monitor disk usage.

---

## 9. Worker and database sizing

### 9.1 Formula

```
workers = 2 * CPU cores + 1        # CPU-bound interactive
max_connections >= workers * db_maxconn + cron_threads + reserve
RAM >= workers * limit_memory_soft + PostgreSQL cache + OS
```

Example: 8 cores, 16 workers, `db_maxconn=8` → 128 connections + 2 cron + reserve ≈ 140. PostgreSQL `max_connections` must be ≥ 150, with `shared_buffers` sized to RAM.

### 9.2 Symptoms of mis-sizing

| Symptom | Cause |
|---|---|
| 502/504 under load | too few workers or long requests |
| `too many connections` | `db_maxconn` × workers > `max_connections` |
| OOM kills | memory limits too high or leaks |
| High latency, low CPU | I/O wait or lock contention |
| Cron starves | `max_cron_threads` too low or long jobs |

### 9.3 Gevent vs prefork

- Prefork (`--workers=N`) is the default for production; each worker is a process.
- Gevent is for high-concurrency I/O (websocket, long polling); it changes memory/connection behaviour.
- Do not mix gevent and prefork assumptions.

---

## 10. Database growth

| Table | Growth driver | Retention strategy |
|---|---|---|
| `mail_message` | chatter, tracking | archive/purge old |
| `mail_tracking_value` | tracked fields | purge with messages |
| `stock_move` / `stock_move_line` | every transfer | archive done moves |
| `account_move_line` | every entry | keep legally required |
| `bus_bus` | notifications | GC (built-in) |
| `ir_attachment` | files | filestore + retention |
| `ir_logging` | server logs | rotate/disable |
| `auditlog_log_line` | audit module | retention policy |

**[WARNING]** Deleting accounting or stock history can break valuation and audit. Archive to a warehouse; do not delete blindly.

---

## 11. Performance acceptance criteria

Define before go-live:

| Scenario | Target |
|---|---|
| SO confirm (50 lines) | < 2 s p95 |
| Delivery validation (100 lines) | < 3 s p95 |
| Invoice posting (single) | < 1 s p95 |
| Invoice batch (1,000) | < 30 min, no lock timeout |
| Product list (100 items) | < 1 s p95 |
| Trial balance (1 year, 1M lines) | < 30 s |
| Portal page | < 2 s p95 |
| Report PDF | < 10 s p95 |

Measure on production-like data, not an empty demo database.

---

## 12. Load testing

- Use `locust`/`k6` against JSON-RPC endpoints with realistic sessions.
- Warm the registry and caches before measuring.
- Test peak concurrency, not average.
- Include a heavy report and an import.
- Monitor PostgreSQL (`pg_stat_activity`, `pg_stat_statements`), worker CPU/RAM, and latency percentiles.
- Test failure modes: DB restart, worker kill, lock timeout.

---

## 13. Evidence index

| Topic | File |
|---|---|
| Worker config | `tools/config.py:393-491` |
| Connection pool | `sql_db.py:610-690` |
| Stock quant lock | `addons/stock/models/stock_quant.py:1038` |
| Sequence lock | `addons/account/models/sequence_mixin.py:355` |
| Mail tracking | `addons/mail/models/mail_thread.py:527-760` |
| Bus GC | `addons/bus/models/bus.py:96` |
| Profiler | `tools/profiler.py:508` |

Continue with `04-doc-gaps.md`.
