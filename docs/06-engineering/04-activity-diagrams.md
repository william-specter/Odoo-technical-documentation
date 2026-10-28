# Software Engineering IV — Activity Diagrams and BPMN Mapping

> **Purpose.** Decision-oriented views of the same flows. Each activity diagram can be converted directly to BPMN: rectangles are tasks, diamonds are exclusive gateways, parallel bars are parallel gateways, and swimlanes are roles.

---

## 1. BPMN mapping rules

| Mermaid construct | BPMN element |
|---|---|
| `[Start]` / `[End]` | start/end event |
| `[Action]` | task |
| `{Decision?}` | exclusive gateway (XOR) |
| parallel branches | parallel gateway (AND) |
| `subgraph Lane` | pool/lane |
| arrow with condition | sequence flow with condition |
| timer event | intermediate timer catch event |
| message event | message catch/throw event |

---

## 2. Sales order confirmation

```mermaid
flowchart TD
    S([Start: quotation]) --> A[Validate lines]
    A --> B{All lines have products?}
    B -- no --> E1[Raise UserError]
    E1 --> X([End: rejected])
    B -- yes --> C{Analytic distribution valid?}
    C -- no --> E2[Raise UserError]
    E2 --> X
    C -- yes --> D[Write state=sale, date_order]
    D --> F[Run _action_confirm]
    F --> G{Stock module installed?}
    G -- yes --> H[Launch stock rules]
    H --> I{Route found?}
    I -- no --> J[No picking; log warning]
    I -- yes --> K[Create picking/MO/PO]
    G -- no --> L[Skip procurement]
    J --> M{Auto-lock enabled?}
    K --> M
    L --> M
    M -- yes --> N[action_lock]
    M -- no --> O[Keep unlocked]
    N --> P{Send email?}
    O --> P
    P -- yes --> Q[Queue/send confirmation]
    P -- no --> R([End: confirmed])
    Q --> R
```

### 2.1 BPMN notes

- `Validate lines` and `Write state` are service tasks in the Sales lane.
- `Route found?` is the key business gateway; in BPMN, document the route resolution rule.
- `Create picking/MO/PO` is a sub-process with its own diagram.
- The timer for quotation expiry is a boundary timer event on the quotation task.

---

## 3. Purchase approval

```mermaid
flowchart TD
    S([Start: RFQ]) --> A[Validate lines/products]
    A --> B{Valid?}
    B -- no --> E1[UserError]
    E1 --> X([End])
    B -- yes --> C[Add vendor to product]
    C --> D{Approval required?}
    D -- no --> G[button_approve]
    D -- yes --> E[state=to approve]
    E --> F{Manager approves?}
    F -- no --> H[Revise RFQ]
    H --> A
    F -- yes --> G
    G --> I[state=purchase, date_approve]
    I --> J{Company lock setting?}
    J -- lock --> K[locked=True]
    J -- no --> L[locked=False]
    K --> M[Create receipt]
    L --> M
    M --> N([End: PO confirmed])
```

**Decision data:** `company.po_double_validation`, `po_double_validation_amount`, `purchase.group_purchase_manager`.

---

## 4. Delivery validation

```mermaid
flowchart TD
    S([Start: picking]) --> A[Confirm draft pickings]
    A --> B[Sanity check quantities/lots]
    B --> C{Sanity OK?}
    C -- no --> E1[UserError: fix lines]
    E1 --> X([End])
    C -- yes --> D[Pre-action hook]
    D --> F{All quantities picked?}
    F -- no --> G[Backorder wizard]
    G --> H{User choice}
    H -- backorder --> I[Validate picked qty]
    H -- cancel remaining --> J[Validate + cancel rest]
    H -- no --> K[Abort validation]
    K --> X
    F -- yes --> I
    I --> L[_action_done]
    L --> M[Update quants]
    M --> N[Create valuation entry]
    N --> O{Push rule?}
    O -- yes --> P[Create/assign next move]
    O -- no --> Q[Trigger successor assign]
    P --> Q
    Q --> R([End: done])
```

**Exception paths:** lot missing, package split, negative stock blocked, reservation conflict, valuation account missing.

---

## 5. Invoice posting

```mermaid
flowchart TD
    S([Start: draft invoice]) --> A[Check permissions]
    A --> B{Authorized?}
    B -- no --> E1[AccessError]
    E1 --> X([End])
    B -- yes --> C[Validate invoice fields]
    C --> D{Partner/date/total valid?}
    D -- no --> E2[UserError]
    E2 --> X
    D -- yes --> F[Sync dynamic lines]
    F --> G{Balanced?}
    G -- no --> E3[UserError: unbalanced]
    E3 --> X
    G -- yes --> H[Set state=posted]
    H --> I{Numbered?}
    I -- no --> J[Allocate sequence]
    I -- yes --> K[Keep number]
    J --> L{Hash journal?}
    K --> L
    L -- yes --> M[Compute hash]
    L -- no --> N[Skip hash]
    M --> O[Reconcile marked lines]
    N --> O
    O --> P[Update partner ranks]
    P --> Q{Zero total?}
    Q -- yes --> R[Invoice paid hook]
    Q -- no --> T([End: posted])
    R --> T
```

---

## 6. Manufacturing completion

```mermaid
flowchart TD
    S([Start: MO in progress]) --> A[pre_button_mark_done]
    A --> B{Validations pass?}
    B -- no --> E1[UserError/wizard]
    E1 --> X([End])
    B -- yes --> C[Finish work orders]
    C --> D{Produced < demand?}
    D -- yes --> E[Split backorder]
    D -- no --> F[No backorder]
    E --> G[_post_inventory]
    F --> G
    G --> H{Raw moves picked?}
    H -- no --> I[Cancel unpicked]
    H -- yes --> J[Consume components]
    I --> J
    J --> K[_cal_price]
    K --> L[Produce finished goods]
    L --> M[Post valuation/labour]
    M --> N{Backorder?}
    N -- yes --> O[Assign components to backorder]
    N -- no --> P[Set done + lock]
    O --> P
    P --> Q([End: MO done])
```

---

## 7. Month-end close

```mermaid
flowchart TD
    S([Start: period end]) --> A[Cut off sales/purchase]
    A --> B[Post all draft invoices]
    B --> C[Reconcile bank]
    C --> D{Unreconciled items?}
    D -- yes --> E[Investigate/write off]
    E --> C
    D -- no --> F[Stock valuation check]
    F --> G{Variance?}
    G -- yes --> H[Adjust inventory/landed cost]
    H --> F
    G -- no --> I[Accruals/deferrals]
    I --> J[FX revaluation]
    J --> K[Depreciation]
    K --> L[Trial balance review]
    L --> M{Balanced?}
    M -- no --> N[Adjust]
    N --> L
    M -- yes --> O[Tax reports]
    O --> P[Set lock dates]
    P --> Q[Publish financials]
    Q --> R([End: closed])
```

---

## 8. Integration processing

```mermaid
flowchart TD
    S([Start: inbound event]) --> A[Authenticate]
    A --> B{Valid credentials?}
    B -- no --> E1[401]
    E1 --> X([End])
    B -- yes --> C[Validate payload]
    C --> D{Valid?}
    D -- no --> E2[422 with errors]
    E2 --> X
    D -- yes --> F{Event ID seen?}
    F -- yes --> G[Return 200 duplicate]
    G --> X
    F -- no --> H[Begin transaction]
    H --> I[Apply changes]
    I --> J[Write outbox event]
    J --> K{Commit OK?}
    K -- no --> L[Rollback + retry]
    L --> H
    K -- yes --> M[200 OK]
    M --> X
```

**Note:** the outbox write is in the same transaction; delivery is a separate cron. This is the only reliable pattern without a broker.

---

## 9. Support incident triage

```mermaid
flowchart TD
    S([Start: incident]) --> A[Classify: data/functional/performance/security]
    A --> B{Reproducible?}
    B -- no --> C[Collect logs/traces]
    C --> D[Add instrumentation]
    D --> B
    B -- yes --> E{Data corruption?}
    E -- yes --> F[Freeze writes/backup]
    F --> G[Root cause + repair script]
    G --> H[Validate in staging]
    H --> I[Apply + verify]
    E -- no --> J{Performance?}
    J -- yes --> K[Profile SQL/Python]
    K --> L[Index/query/worker fix]
    J -- no --> M[Functional fix + test]
    L --> N[Verify]
    M --> N
    I --> N
    N --> O[Postmortem + regression test]
    O --> P([End])
```

---

## 10. Activity-to-test mapping

| Activity diagram | Test focus |
|---|---|
| Sales confirmation | guards, procurement, lock, email |
| Purchase approval | threshold, manager group, receipt |
| Delivery validation | partial, lots, packages, backorder |
| Invoice posting | balance, lock date, sequence, hash |
| MO completion | consumption, backorder, valuation |
| Month-end close | reconciliation, FX, lock dates |
| Integration | idempotency, retry, outbox |
| Incident triage | runbooks, observability |

---

## 11. BPMN export checklist

- [ ] Every decision has a default flow.
- [ ] Every task has an owner (lane).
- [ ] Every event has a trigger (message/timer/signal).
- [ ] Exception paths terminate or loop, never dangle.
- [ ] Data objects (SO, picking, invoice) are referenced, not duplicated.
- [ ] Timers are explicit (quotation expiry, payment terms, SLA).
- [ ] Sub-processes are linked to their own diagrams.

---

## 12. Evidence index

| Flow | File |
|---|---|
| Sales | `sale/models/sale_order.py:1167` |
| Purchase | `purchase/models/purchase_order.py:625` |
| Delivery | `stock/models/stock_picking.py:1413` |
| Invoice | `account/models/account_move.py:5574` |
| MO | `mrp/models/mrp_production.py:2219` |
| Integration | `service/model.py:160` |
| Close | `account/models/company.py:76-112` |

Continue with `05-state-machines.md`.
