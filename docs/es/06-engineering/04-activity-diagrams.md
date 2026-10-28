# Ingeniería de software IV — Diagramas de actividad y mapeo a BPMN

> **Propósito.** Vistas orientadas a decisiones de los mismos flujos. Cada diagrama de actividad se puede convertir directamente a BPMN: los rectángulos son tareas, los rombos son compuertas exclusivas, las barras paralelas son compuertas paralelas y los carriles (swimlanes) son roles.

---

## 1. Reglas de mapeo a BPMN

| Constructo Mermaid | Elemento BPMN |
|---|---|
| `[Start]` / `[End]` | evento de inicio/fin |
| `[Action]` | tarea |
| `{Decision?}` | compuerta exclusiva (XOR) |
| ramas paralelas | compuerta paralela (AND) |
| `subgraph Lane` | pool/carril |
| flecha con condición | flujo de secuencia con condición |
| evento de temporizador | evento intermedio de captura por temporizador |
| evento de mensaje | evento de captura/emisión de mensaje |

---

## 2. Confirmación de pedido de venta

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

### 2.1 Notas sobre BPMN

- `Validate lines` y `Write state` son tareas de servicio en el carril de Ventas.
- `Route found?` es la compuerta de negocio clave; en BPMN, documente la regla de resolución de ruta.
- `Create picking/MO/PO` es un subproceso con su propio diagrama.
- El temporizador para la expiración del presupuesto es un evento de temporizador límite en la tarea de presupuesto.

---

## 3. Aprobación de compra

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

**Datos de decisión:** `company.po_double_validation`, `po_double_validation_amount`, `purchase.group_purchase_manager`.

---

## 4. Validación de entrega

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

**Rutas de excepción:** lote faltante, división de paquetes, stock negativo bloqueado, conflicto de reservas, cuenta de valoración faltante.

---

## 5. Contabilización de factura

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

## 6. Finalización de fabricación

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

## 7. Cierre de mes

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

## 8. Procesamiento de integraciones

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

**Nota:** la escritura en el outbox se realiza en la misma transacción; la entrega es un cron independiente. Este es el único patrón fiable sin un broker.

---

## 9. Triaje de incidencias de soporte

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

## 10. Mapeo de actividades a pruebas

| Diagrama de actividad | Enfoque de prueba |
|---|---|
| Confirmación de ventas | guardas, aprovisionamiento, bloqueo, correo |
| Aprobación de compra | umbral, grupo de gerentes, recepción |
| Validación de entrega | parcial, lotes, paquetes, pedido pendiente |
| Contabilización de factura | equilibrio, fecha de bloqueo, secuencia, hash |
| Finalización de OF | consumo, pedido pendiente, valoración |
| Cierre de mes | conciliación, FX, fechas de bloqueo |
| Integración | idempotencia, reintento, outbox |
| Triaje de incidencias | runbooks, observabilidad |

---

## 11. Lista de verificación para la exportación a BPMN

- [ ] Cada decisión tiene un flujo predeterminado.
- [ ] Cada tarea tiene un propietario (carril).
- [ ] Cada evento tiene un disparador (mensaje/temporizador/señal).
- [ ] Las rutas de excepción terminan o iteran, nunca quedan colgando.
- [ ] Los objetos de datos (SO, picking, factura) se referencian, no se duplican.
- [ ] Los temporizadores son explícitos (expiración de presupuesto, condiciones de pago, SLA).
- [ ] Los subprocesos están vinculados a sus propios diagramas.

---

## 12. Índice de evidencia

| Flujo | Archivo |
|---|---|
| Ventas | `sale/models/sale_order.py:1167` |
| Compra | `purchase/models/purchase_order.py:625` |
| Entrega | `stock/models/stock_picking.py:1413` |
| Factura | `account/models/account_move.py:5574` |
| OF | `mrp/models/mrp_production.py:2219` |
| Integración | `service/model.py:160` |
| Cierre | `account/models/company.py:76-112` |

Continúe con `05-state-machines.md`.
