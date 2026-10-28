# Software Engineering III — Sequence Diagrams

> **Purpose.** Executable-level call sequences for the flows that matter most. Each diagram names the actual methods and the transaction boundary. Use these as the basis for design reviews, debugging, and test design.

---

## 1. HTTP request lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant W as WSGI Server
    participant R as Request
    participant DB as PostgreSQL
    participant H as ir.http
    participant CT as Controller
    participant M as Model
    participant ORM as ORM

    C->>W: POST /web/dataset/call_kw
    W->>R: Request(httprequest)
    R->>R: _post_init()
    R->>R: session + dbname
    R->>DB: Registry(db).cursor(readonly=True)
    R->>H: _match(path)
    H-->>R: rule, args
    R->>R: _set_request_dispatcher
    R->>H: _authenticate(endpoint)
    H->>DB: session / user lookup
    R->>H: _pre_dispatch
    R->>CT: endpoint(**params)
    CT->>M: business method
    M->>ORM: search/read/write
    ORM->>DB: SQL
    DB-->>ORM: rows
    ORM-->>M: recordset
    M-->>CT: result
    CT-->>R: Response
    R->>H: _post_dispatch
    R->>DB: COMMIT (retrying)
    R-->>C: 200 OK
```

**Transaction boundary:** from cursor creation to `retrying` commit. Exceptions roll back; serialization failures retry up to 5 times.

---

## 2. Sales order confirmation

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant SO as sale.order
    participant SOL as sale.order.line
    participant REF as stock.reference
    participant RULE as stock.rule
    participant PICK as stock.picking
    participant MOVE as stock.move
    participant MAIL as mail.thread

    U->>SO: action_confirm()
    SO->>SO: _confirmation_error_message()
    SO->>SOL: _validate_analytic_distribution()
    SO->>SO: write(state='sale', date_order=now)
    SO->>SOL: _action_confirm()
    SOL->>SOL: _action_launch_stock_rule()
    loop each line
        SOL->>SOL: _get_qty_procurement()
        SOL->>REF: create if absent
        SOL->>SOL: _prepare_procurement_values()
        SOL->>RULE: run(procurements)
    end
    RULE->>MOVE: _run_pull / _run_buy / _run_manufacture
    MOVE->>PICK: create/confirm
    PICK->>MOVE: _action_assign()
    SO->>MAIL: tracking message
    SO->>SO: _should_be_locked() -> action_lock()
    SO-->>U: True
```

**Alternates:**

- missing product → `UserError` before any write;
- no rule → confirmed SO, no picking (log/raise);
- `send_email` context → confirmation email after commit/queue;
- auto-lock setting → `locked=True`.

---

## 3. Purchase order to receipt

```mermaid
sequenceDiagram
    autonumber
    actor B as Buyer
    participant PO as purchase.order
    participant POL as purchase.order.line
    participant PICK as stock.picking
    participant MOVE as stock.move
    participant Q as stock.quant
    participant VAL as stock_account
    participant ACC as account.move

    B->>PO: button_confirm()
    PO->>PO: _confirmation_error_message()
    PO->>POL: _validate_analytic_distribution()
    PO->>PO: _add_supplier_to_product()
    alt approval required
        PO->>PO: write(state='to approve')
        B->>PO: button_approve()
    end
    PO->>PO: write(state='purchase', date_approve=now)
    PO->>PICK: _create_picking()
    PICK->>MOVE: order_line._create_stock_moves()
    MOVE->>MOVE: _action_confirm(), _action_assign()
    B->>PICK: button_validate()
    PICK->>PICK: _sanity_check()
    PICK->>PICK: _pre_action_done_hook()
    PICK->>MOVE: _action_done()
    MOVE->>Q: _update_available_quantity(+)
    MOVE->>VAL: _set_value()
    VAL->>ACC: _create_account_move()
    ACC->>ACC: _post()
    PICK-->>B: done / backorder
```

---

## 4. Delivery and invoice

```mermaid
sequenceDiagram
    autonumber
    actor W as Warehouse
    participant PICK as stock.picking
    participant MOVE as stock.move
    participant Q as stock.quant
    participant SO as sale.order
    participant INV as account.move
    participant PAY as account.payment

    W->>PICK: button_validate()
    PICK->>MOVE: _action_done()
    MOVE->>Q: _update_available_quantity(-)
    MOVE->>MOVE: _set_value() (FIFO/AVCO)
    MOVE->>MOVE: no per-move GL entry for customer location
    SO->>SO: _compute_qty_delivered()
    SO->>INV: _create_invoices()
    INV->>INV: create draft invoice
    W->>INV: action_post()
    INV->>INV: _post() + COGS lines
    INV->>INV: _check_balanced()
    INV->>INV: _sync_dynamic_lines()
    INV->>INV: _set_next_sequence()
    INV->>INV: _hash_moves()
    PAY->>INV: reconcile payment
```

---

## 5. Invoice posting internals

```mermaid
sequenceDiagram
    autonumber
    actor A as Accountant
    participant AM as account.move
    participant AML as account.move.line
    participant TAX as account.tax
    participant SEQ as sequence.mixin
    participant HASH as hash chain
    participant DB as PostgreSQL

    A->>AM: action_post()
    AM->>AM: _post(soft=False)
    AM->>AM: _check_balanced(container)
    AM->>AM: _sync_dynamic_lines(container)
    AM->>TAX: _add_tax_details_in_base_lines()
    TAX-->>AM: tax lines
    AM->>AM: write(state='posted')
    loop unnumbered moves
        AM->>SEQ: _set_next_sequence()
        SEQ->>DB: update unique index row (lock)
        SEQ-->>AM: sequence
    end
    AM->>HASH: _hash_moves()
    HASH->>DB: update inalterable_hash
    AM->>AML: _reconcile_marked()
    AM->>DB: COMMIT (request wrapper)
```

---

## 6. Payment and reconciliation

```mermaid
sequenceDiagram
    autonumber
    actor A as Accountant
    participant W as payment.register
    participant PAY as account.payment
    participant AM as account.move
    participant AML as account.move.line
    participant REC as account.partial.reconcile
    participant FX as exchange move

    A->>W: open wizard
    W->>W: compute amount/residual
    W->>PAY: create(payment_vals)
    W->>PAY: action_post()
    PAY->>AM: create + _post()
    W->>AML: _reconcile_plan([[payment_line, invoice_line]])
    AML->>AML: _optimize_reconciliation_plan()
    AML->>AML: _prepare_reconciliation_plan()
    AML->>REC: create(partials)
    alt currency differs
        AML->>FX: _create_exchange_difference_moves()
    end
    AML->>AML: _create_full_reconcile()
    AML->>AM: _invoice_paid_hook()
```

---

## 7. Manufacturing order completion

```mermaid
sequenceDiagram
    autonumber
    actor P as Planner
    participant MO as mrp.production
    participant WO as mrp.workorder
    participant MOVE as stock.move
    participant Q as stock.quant
    participant VAL as mrp_account
    participant ACC as account.move

    P->>MO: button_mark_done()
    MO->>MO: pre_button_mark_done()
    MO->>WO: button_finish()
    MO->>MO: _split_productions() (if partial)
    MO->>MO: _post_inventory()
    MO->>MOVE: raw moves._action_done()
    MOVE->>Q: decrease components
    MO->>VAL: _cal_price(consumed_moves)
    VAL->>VAL: material + workcenter + extra cost
    MO->>MOVE: finished moves._action_done()
    MOVE->>Q: increase finished goods
    MO->>ACC: valuation / labour entries
    MO->>MO: write(state='done', is_locked=True)
```

---

## 8. Cron job execution

```mermaid
sequenceDiagram
    autonumber
    participant W as Cron Worker
    participant CR as ir.cron
    participant DB as PostgreSQL
    participant JOB as Server Action
    participant PROG as ir.cron.progress

    W->>DB: _acquire_one_job (FOR UPDATE SKIP LOCKED)
    DB-->>W: job
    W->>CR: _process_job(cr, job)
    CR->>CR: _clear_schedule()
    CR->>DB: new cursor + transaction
    CR->>JOB: run()
    loop batches
        JOB->>PROG: _commit_progress(done, remaining)
        PROG->>DB: COMMIT progress
    end
    alt success
        CR->>CR: _reschedule_later()
    else partial
        CR->>CR: _reschedule_asap()
    else failure
        CR->>CR: _update_failure_count()
        CR->>CR: deactivate after threshold
    end
```

---

## 9. External integration with retry

```mermaid
sequenceDiagram
    autonumber
    participant EXT as External System
    participant CTRL as Controller
    participant SVC as retrying()
    participant M as Model
    participant OUT as Outbox
    participant CRON as Cron
    participant API as Remote API

    EXT->>CTRL: POST /api/v1/orders (event_id)
    CTRL->>SVC: dispatch
    SVC->>M: process(payload)
    M->>M: check event_id uniqueness
    alt new event
        M->>M: create/update records
        M->>OUT: emit(event_id, payload)
        SVC->>M: flush
        SVC->>SVC: commit
    else duplicate
        M-->>SVC: no-op
    end
    SVC-->>CTRL: result
    CTRL-->>EXT: 200 OK
    CRON->>OUT: pending events
    OUT->>API: POST with idempotency key
    alt success
        OUT->>OUT: state='sent'
    else failure
        OUT->>OUT: state='failed', retry/backoff
    end
```

---

## 10. Bus notification

```mermaid
sequenceDiagram
    autonumber
    participant M as Model
    participant BUS as bus.bus
    participant DB as PostgreSQL
    participant WS as Websocket Worker
    participant C as Client

    M->>BUS: _sendone(channel, type, payload)
    BUS->>BUS: append to cr.precommit.data
    M->>DB: business transaction COMMIT
    DB->>BUS: precommit hook inserts bus_bus rows
    DB->>WS: postcommit NOTIFY imbus
    WS->>DB: poll bus_bus by channel
    WS-->>C: websocket message
    C->>C: refetch record via ORM
```

---

## 11. Failure and retry sequence

```mermaid
sequenceDiagram
    autonumber
    participant SVC as retrying()
    participant CR as Cursor
    participant TX as Transaction
    participant DB as PostgreSQL

    SVC->>DB: BEGIN (REPEATABLE READ)
    SVC->>DB: business writes
    DB-->>SVC: SerializationFailure (40001)
    SVC->>CR: rollback()
    SVC->>TX: reset()
    SVC->>SVC: sleep(random backoff)
    SVC->>DB: BEGIN (new snapshot)
    SVC->>DB: retry business writes
    DB-->>SVC: UPDATE ... OK
    SVC->>DB: COMMIT
    SVC->>CR: postcommit hooks
    SVC-->>SVC: return result
```

**[INVARIANT]** The business method must be idempotent; external side effects must be deferred or keyed.

---

## 12. Diagram conventions

- Every arrow is a synchronous call unless dashed (`-->>`) or explicitly async.
- `alt`/`else` are decisions; `loop` is iteration.
- The transaction boundary is stated in the caption, not implied.
- Method names are the stable anchor; line numbers are not shown in diagrams.
- Actors are roles, not systems, unless the system is external.

---

## 13. Evidence index

| Flow | File |
|---|---|
| Request | `http.py:1793-2340`, `service/model.py:160` |
| SO confirm | `sale/models/sale_order.py:1167`, `sale_stock/models/sale_order_line.py:280` |
| PO receipt | `purchase/models/purchase_order.py:625`, `purchase_stock/models/purchase_order.py:375` |
| Delivery | `stock/models/stock_picking.py:1413`, `stock_move.py:2244` |
| Invoice | `account/models/account_move.py:5574` |
| Payment | `account/wizard/account_payment_register.py:993`, `account_move_line.py:2793` |
| MO | `mrp/models/mrp_production.py:2219`, `mrp_account/models/mrp_production.py:57` |
| Cron | `addons/base/models/ir_cron.py:399` |
| Bus | `addons/bus/models/bus.py:111-160` |

Continue with `04-activity-diagrams.md`.
