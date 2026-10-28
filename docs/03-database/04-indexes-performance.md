# Database Design IV — Indexing, Query Performance, and Scaling

> **Premise.** Most Odoo performance incidents are not "Odoo is slow". They are: unbounded recordset operations, missing composite indexes, N+1 queries disguised as prefetch, long transactions, or a worker/connection pool sized incorrectly. This chapter gives the model and the diagnostics.

---

## 1. The cost model

| Layer | Cost driver | Typical symptom |
|---|---|---|
| Network | round trips per request | high latency, low CPU |
| ORM | number of queries, records fetched | high `sql_log_count` |
| PostgreSQL | scans, joins, sorts, locks | high CPU/IO, lock waits |
| Python | per-record loops, compute methods | high CPU in worker |
| Memory | prefetch of large sets, binaries | OOM kills |
| Locks | concurrent writes on same rows | timeouts, retries, deadlocks |

**[INVARIANT]** Optimise query count first, then query cost, then Python. A 10-query endpoint with indexed predicates beats a 1-query endpoint doing a sequential scan.

---

## 2. ORM query generation

### 2.1 Search → SQL

`search(domain, order, limit, offset)` compiles to:

```sql
SELECT "sale_order".id
FROM "sale_order"
WHERE ("sale_order"."state" = %s)
  AND ("sale_order"."company_id" IN (%s))
ORDER BY "sale_order"."date_order" DESC, "sale_order"."id" DESC
LIMIT %s OFFSET %s;
```

Then field access triggers a second query (`SELECT ... WHERE id IN (...)`). `search_read()` does both, but still two queries in most cases.

### 2.2 Prefetch

Accessing one field on a recordset fetches that field for the whole prefetch set. This is why `for record in records: record.name` is fast, and `for id in ids: env['x'].browse(id).name` is slow.

Control prefetch:

```python
records = env['sale.order'].search([...]).with_prefetch(ids)
records.fetch(['name', 'partner_id'])          # explicit
records.with_context(prefetch_fields=False)    # disable
```

### 2.3 `_read_group` / `read_group`

`_read_group(domain, groupby, aggregates)` is the efficient aggregation API:

```python
groups = env['sale.order.line']._read_group(
    [('order_id.state', '=', 'sale')],
    groupby=['product_id'],
    aggregates=['product_uom_qty:sum', 'price_subtotal:sum'],
)
```

It generates a single `GROUP BY` query instead of loading records. Use it for dashboards and reports instead of Python loops.

**[WARNING]** `read_group` (legacy API) and `_read_group` have different signatures and return shapes. Odoo 19 uses `_read_group` internally; `read_group` is a compatibility wrapper.

---

## 3. Indexing strategy

### 3.1 What Odoo indexes

- `id` (PK)
- fields with `index=True` / `index='btree_not_null'` / `index='trigram'`
- many2many reverse columns
- some system fields (`company_id` on many models, `state` on documents)
- `parent_path` for hierarchical models

### 3.2 What Odoo does **not** index

- every `Many2one` (only if declared)
- composite predicates
- `create_date` on most tables (except `bus.bus`)
- JSONB keys (unless a GIN index is added)
- translated values (unless trigram)

### 3.3 Composite index examples

```python
class StockMove(models.Model):
    _inherit = 'stock.move'

    _move_product_state = models.Index(
        "(product_id, state)",
        where="state NOT IN ('done','cancel')",
    )
    _move_picking_date = models.Index("(picking_id, date)")
```

```sql
CREATE INDEX CONCURRENTLY stock_move__product_state_index
ON stock_move (product_id, state)
WHERE state NOT IN ('done','cancel');
```

Use `CONCURRENTLY` in production to avoid blocking writes; Odoo's automatic index creation does not use it.

### 3.4 Index selection rules

| Query shape | Index |
|---|---|
| `WHERE company_id = ? AND state = ?` | `(company_id, state)` |
| `WHERE partner_id = ? ORDER BY date DESC` | `(partner_id, date DESC)` |
| `WHERE date >= ? AND date < ?` | `(date)` or BRIN for huge append-only tables |
| `WHERE name ILIKE '%foo%'` | GIN trigram on `unaccent(name)` |
| `WHERE product_id = ? AND location_id = ?` | `(product_id, location_id)` on `stock_quant` |
| JSONB containment | GIN on the JSONB column |

### 3.5 Index anti-patterns

- Indexing every column "for safety" → write amplification, bloat.
- Duplicate indexes (Odoo may already have one).
- Partial indexes with a predicate the query does not use.
- Indexing low-cardinality booleans alone.
- Forgetting `CONCURRENTLY` on large production tables.

---

## 4. N+1 and unbounded operations

### 4.1 Detecting N+1

```python
from odoo.tests import Form
from odoo.tools import mute_logger
import logging

with mute_logger('odoo.sql_db'):
    before = env.cr.sql_log_count
    do_work()
    print("queries:", env.cr.sql_log_count - before)
```

Or enable SQL logging:

```bash
odoo-bin --log-level=debug_sql --logfile=/var/log/odoo/sql.log
```

### 4.2 Common N+1 patterns

| Pattern | Fix |
|---|---|
| `for rec in recs: rec.partner_id.name` | prefetch (usually automatic); check `prefetch_fields` |
| `for rec in recs: env['x'].search(...)` | one search with `in` |
| `for rec in recs: rec.line_ids` | prefetch x2many; avoid in loops |
| `for rec in recs: rec.compute()` calling search | batch compute |
| `mapped('a.b.c')` deep chain | prefetch, or `_read_group` |
| `len(recs)` repeatedly | compute once |
| `sorted(recs, key=lambda r: r.name)` | `search(order=...)` |

### 4.3 Unbounded recordset operations

```python
# DANGEROUS on 500k rows
orders = env['sale.order'].search([])
total = sum(orders.mapped('amount_total'))
```

Fixes:

```python
# aggregate in SQL
result = env['sale.order']._read_group([], aggregates=['amount_total:sum'])
total = result[0][0]

# or paginate
while True:
    batch = env['sale.order'].search([('id', '>', last_id)], limit=1000, order='id')
    if not batch:
        break
    ...
    last_id = batch[-1].id
```

**[WARNING]** Odoo does not enforce a default `limit` on `search()`. A missing limit on a large table can fetch millions of ids and exhaust memory before any field is read.

---

## 5. Compute and recompute cost

### 5.1 Stored computes

A stored computed field adds:

- a dependency registration,
- invalidation on source changes,
- a recompute on flush,
- a write to the column.

A chain `A → B → C → D` recomputes D whenever A changes. Deep chains on high-volume models are expensive.

### 5.2 `compute_sudo`

Default `True` for stored computes. This avoids access errors but can leak data. More importantly, it does not reduce query cost.

### 5.3 Recompute storms

Symptoms:

- one write triggers hundreds of recomputes,
- `Too many iterations for recomputing fields!` in logs,
- high CPU after a bulk import.

Fixes:

- reduce dependency breadth,
- use `store=False` for UI-only fields,
- batch writes (`write` on a recordset, not per record),
- use `env.protecting` when intentionally setting computed values,
- avoid `modified()` inside loops.

---

## 6. Transactions, locks, and vacuum

### 6.1 Long transactions

A transaction that stays open for minutes:

- holds row locks,
- prevents vacuum from cleaning dead tuples,
- increases bloat,
- can block sequence allocation,
- risks `idle in transaction` connection exhaustion.

Causes: external HTTP calls inside the transaction, unbounded loops, report generation, large imports, cron without progress commits.

### 6.2 Autovacuum

Odoo does not tune PostgreSQL. Default autovacuum settings are often too conservative for high-churn tables (`mail_message`, `stock_move`, `account_move_line`, `bus_bus`).

Recommended baseline:

```conf
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02
autovacuum_vacuum_cost_delay = 2ms
```

Per-table overrides for hot tables:

```sql
ALTER TABLE mail_message SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE stock_move SET (autovacuum_vacuum_scale_factor = 0.02);
```

### 6.3 Connection pool

`db_maxconn` default 64 (`tools/config.py:393`). The pool is per process. With `workers=8`, each worker can open up to 64 connections; PostgreSQL `max_connections` must account for all workers plus cron and maintenance.

Sizing rule:

```
max_connections >= workers * db_maxconn + cron_threads + reserve
```

In practice, set `db_maxconn` low (8–16) per worker and raise `max_connections` accordingly; most requests use one connection.

### 6.4 Worker sizing

| Parameter | Default | Guidance |
|---|---|---|
| `workers` | 0 (threaded) | `2 * CPU cores + 1` for CPU-bound |
| `max_cron_threads` | 2 | 1–4; cron is I/O-bound |
| `limit_time_cpu` | 60s | lower for interactive, higher for reports |
| `limit_time_real` | 120s | must exceed longest legitimate request |
| `limit_memory_soft` | 2 GB | recycle after request |
| `limit_memory_hard` | 2.5 GB | kill worker |
| `db_maxconn` | 64 | 8–16 per worker |

**[WARNING]** Memory limits are per worker, not per request. A memory leak accumulates across requests until the soft limit triggers a recycle.

---

## 7. Profiling

### 7.1 Built-in profiler

```python
from odoo.tools.profiler import Profiler

with Profiler(collectors=['sql', 'traces_async']) as p:
    do_work()
print(p.summary())
```

Or via the UI: Settings → Technical → Profiling (enable `--dev=profile`).

### 7.2 SQL logging

```bash
odoo-bin --log-level=debug_sql
```

Logs every query with duration. Use for a single request, not in production continuously.

### 7.3 PostgreSQL `pg_stat_statements`

```sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

This is the single most useful production diagnostic. Enable the extension and reset stats after a baseline period.

### 7.4 `EXPLAIN (ANALYZE, BUFFERS)`

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Look for:

- `Seq Scan` on large tables,
- nested loops with high row counts,
- sorts spilling to disk,
- heap fetches vs index-only scans,
- lock waits (`Lock` node).

---

## 8. Scaling patterns

### 8.1 Vertical first

- CPU for Python workers,
- RAM for PostgreSQL cache and worker memory,
- fast NVMe for WAL and data,
- separate disks for WAL and data if possible.

### 8.2 Read replicas

Odoo core does not route reads to replicas. Options:

- configure a PostgreSQL hot standby and route reporting/replica reads manually (custom code or `--db_host` per worker),
- use logical replication for analytics,
- accept that all ORM reads go to the primary.

**[WARNING]** A read replica with asynchronous replication can return stale data; Odoo's cache and record rules assume primary consistency. Do not use a replica for interactive business flows without a consistency strategy.

### 8.3 Partitioning

Core Odoo does not partition tables. Candidates:

- `mail_message` / `mail_tracking_value` (time-based),
- `stock_move_line` (time-based),
- `account_move_line` (by fiscal year),
- `bus_bus` (short retention, GC instead),
- audit/log tables.

Partitioning requires custom migrations and query changes; test with the ORM's `_table` assumptions.

### 8.4 Archiving

- `active=False` hides records but does not reduce table size.
- Move old records to archive tables or a data warehouse.
- For accounting, legal retention usually requires keeping entries; archive the database, not the rows.

---

## 9. Performance checklist

### Query level
- [ ] Every `search()` has a `limit` or a bounded domain.
- [ ] No `search()` inside a loop.
- [ ] Aggregations use `_read_group`, not Python sums.
- [ ] `EXPLAIN` shows index usage for hot queries.
- [ ] No sequential scans on tables > 1M rows for interactive requests.

### ORM level
- [ ] Computes are batched and dependencies are complete.
- [ ] Prefetch is enabled where appropriate.
- [ ] `ensure_one()` is not in loops.
- [ ] `sudo()` is not used to mask access-query cost.
- [ ] `flush()` is not called per record.

### Database level
- [ ] `pg_stat_statements` enabled.
- [ ] Autovacuum tuned for hot tables.
- [ ] No unused/duplicate indexes.
- [ ] Connection pool sized to `max_connections`.
- [ ] Long transactions monitored and killed if idle.

### Operations
- [ ] Workers sized to CPU.
- [ ] Memory limits set.
- [ ] Cron jobs commit progress.
- [ ] Backups include filestore.
- [ ] Monitoring on p95 latency, error rate, DB connections, replication lag.

---

## 10. Evidence index

| Topic | File |
|---|---|
| Config defaults | `tools/config.py:393-491` |
| Connection pool | `sql_db.py:610-690` |
| `_read_group` | `orm/models.py:1861-2388` |
| Prefetch | `orm/models.py:3754-3870` |
| Index management | `orm/registry.py:829-900` |
| Profiler | `tools/profiler.py:508` |
| Sequence lock | `account/models/sequence_mixin.py:355` |
| Quant locking | `stock/models/stock_quant.py:1038` |

Continue with `05-migrations.md`.
