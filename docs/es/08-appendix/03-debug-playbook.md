# Apéndice C — Guía operativa de depuración e incidentes

> **Regla.** Reproducir en preproducción, aislar la capa, demostrar la causa y después corregir. No se deben «probar cosas» en producción.

---

## 1. Primeros 10 minutos

| Paso | Acción |
|---|---|
| 1 | Registrar la URL/acción exacta, el usuario, la hora, la base de datos y el mensaje de error |
| 2 | Revisar `ir.logging` / los registros del servidor en torno a la marca temporal |
| 3 | Revisar los despliegues/actualizaciones de módulos recientes |
| 4 | Revisar la salud de la base de datos (conexiones, bloqueos, transacciones largas) |
| 5 | Reproducir en preproducción con los mismos datos |
| 6 | Clasificar: datos / código / configuración / infraestructura / integración |
| 7 | Abrir un incidente con severidad y responsable |

---

## 2. Registros

### 2.1 Niveles

```bash
--log-level=debug_sql     # every query
--log-level=debug         # ORM details
--log-level=info          # default
--log-level=warn          # warnings only
--log-level=error         # errors only
```

### 2.2 Greps útiles

```bash
grep -n "ERROR\|CRITICAL\|Traceback" /var/log/odoo/odoo.log | tail -50
grep -n "WARNING" /var/log/odoo/odoo.log | tail -50
grep -n "module .*: creating or updating" /var/log/odoo/odoo.log
grep -n "Too many iterations for recomputing" /var/log/odoo/odoo.log
grep -n "Failed to load registry" /var/log/odoo/odoo.log
```

### 2.3 Correlación de solicitudes

Si el proxy inverso añade un id de solicitud, regístrelo en un middleware/controlador personalizado e inclúyalo en los informes de error. Los registros predeterminados de Odoo no correlacionan las solicitudes entre workers.

---

## 3. Shell de Odoo

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

**[WARNING]** `odoo-bin shell` confirma la transacción al salir limpiamente de forma predeterminada en algunas versiones. Llame explícitamente a `env.cr.rollback()` si solo inspeccionó o escribió datos de prueba.

---

## 4. Errores comunes

### 4.1 `UserError`

Violación de una regla de negocio. Lea el mensaje; es intencionado. Busque el `raise UserError` en el código fuente:

```bash
grep -rn "raise UserError" addons/sale --include=*.py | grep -i "confirm"
```

### 4.2 `AccessError`

- falta la ACL del modelo → `ir.model.access`
- regla de registro → `ir.rule`
- grupo de campo → `groups=` en el campo
- usuario de portal/público → revisar `auth` y las reglas

```python
env['ir.model.access'].check('sale.order', 'write', raise_exception=False)
env['ir.rule']._get_rules('sale.order', 'write')
```

### 4.3 `MissingError`

Se eliminó un registro o el conjunto de registros está obsoleto tras `unlink`. Llame a `.exists()` antes de acceder; no mantenga conjuntos de registros después de un `unlink`.

### 4.4 `ValidationError` procedente de IntegrityError

Falló una restricción SQL. El envoltorio de reintentos convierte `IntegrityError` en `ValidationError`. Compruebe:

- restricción única,
- NOT NULL,
- FK,
- restricción de comprobación.

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'my_table'::regclass;
```

### 4.5 `psycopg2.errors.SerializationFailure`

Conflicto de actualización concurrente. El envoltorio de solicitudes reintenta 5 veces. Si persiste:

- reducir la longitud de la transacción,
- comprobar si hay filas calientes (quants, secuencias, configuración),
- comprobar el orden de bloqueo.

### 4.6 `psycopg2.errors.DeadlockDetected`

Dos transacciones bloquean filas en orden opuesto. Localice las consultas en el registro, ordene los ids antes de escribir y reduzca el tamaño del lote.

### 4.7 `psycopg2.errors.LockNotAvailable`

Una consulta `NOWAIT`/`SKIP LOCKED` no pudo adquirir un bloqueo. Normalmente quants de stock o tareas cron. Reintentar o procesar de forma secuencial.

### 4.8 `KeyError: 'model.name'`

El modelo no está en el registro:

- módulo no instalado,
- falta una dependencia,
- el registro no se recargó tras un cambio de código,
- error tipográfico en el nombre del modelo.

### 4.9 `ValueError: Invalid field ...`

El campo no existe en el modelo:

- error tipográfico,
- módulo no actualizado,
- campo eliminado en la v19,
- campo de Studio no cargado.

### 4.10 `ParseError` / validación de vistas

Una vista XML no es válida o un xpath no coincide. El error incluye el ID de la vista y el archivo. Corrija el xpath o el ancla; no aplique `position="replace"` al formulario completo.

### 4.11 `RegistryError: Cannot get registry`

La base de datos no está inicializada, el grafo de módulos está roto o la base de datos no es accesible. Compruebe:

```bash
psql -d mydb -c "SELECT state, COUNT(*) FROM ir_module_module GROUP BY state;"
```

### 4.12 Worker terminado / 502

Compruebe:

- se alcanzó `limit_memory_hard`,
- se superó `limit_time_real`,
- OOM killer (`dmesg`),
- agotamiento de conexiones a la base de datos.

---

## 5. Depuración de rendimiento

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

Lista de verificación:

- [ ] recuento de consultas,
- [ ] escaneos secuenciales,
- [ ] índices faltantes,
- [ ] N+1,
- [ ] búsqueda sin límites,
- [ ] tormenta de cálculos,
- [ ] esperas de bloqueo,
- [ ] pool de workers/base de datos.

---

## 6. Depuración de contabilidad

| Síntoma | Comprobación |
|---|---|
| No se puede publicar | `_check_balanced`, contacto, fecha, fecha de bloqueo |
| Total incorrecto | líneas de impuesto, posición fiscal, tasa de cambio |
| Secuencia duplicada | `account_move.name`, bloqueo de secuencia |
| Error de hash | `inalterable_hash`, `secure_sequence_number` |
| El pago no concilia | residual, tipo de cuenta, contacto, moneda |
| Falta la diferencia de cambio | tasas de cambio, importes parciales |
| Faltan los COGS | cuentas de valoración de la categoría de producto, valor del movimiento |

```python
move = env['account.move'].browse(id)
print(move.state, move.amount_total, move.amount_total_signed)
for l in move.line_ids:
    print(l.account_id.code, l.debit, l.credit, l.balance, l.amount_currency, l.currency_id.name)
```

---

## 7. Depuración de stock

| Síntoma | Comprobación |
|---|---|
| El picking no se asigna | quants, método de reserva, ruta |
| No se puede validar | `picked`, lotes, paquetes, cantidades |
| Stock negativo | quants, movimientos forzados |
| Valoración incorrecta | `value` del movimiento, método de coste, precio de factura/pedido de compra |
| Quants duplicados | `stock_quant` agrupado por clave |
| No se crea el pedido pendiente | `create_backorder` del tipo de picking |

```python
picking = env['stock.picking'].browse(id)
print(picking.state, picking.picking_type_id.code)
for m in picking.move_ids:
    print(m.product_id.display_name, m.product_uom_qty, m.quantity, m.state, m.picked)
    for ml in m.move_line_ids:
        print('  ', ml.quantity, ml.lot_id.name, ml.location_id.complete_name, ml.location_dest_id.complete_name)
```

---

## 8. Depuración de fabricación

| Síntoma | Comprobación |
|---|---|
| La OF no se confirma | LdM, componentes, tipo de picking |
| No se puede marcar como hecha | movimientos de materias primas con `picked`, `qty_producing`, OT |
| Coste incorrecto | `_cal_price`, coste del centro de trabajo, subproductos |
| Atascada en to_close | estados de las órdenes de trabajo |
| La LdM fantasma crea una OF | tipo de LdM |

```python
mo = env['mrp.production'].browse(id)
print(mo.state, mo.qty_producing, mo.product_qty, mo.reservation_state)
for m in mo.move_raw_ids:
    print(m.product_id.display_name, m.product_uom_qty, m.quantity, m.state, m.picked)
print(mo.workorder_ids.mapped(lambda w: (w.name, w.state, w.duration)))
```

---

## 9. Depuración de instalación/actualización de módulos

```bash
odoo-bin -c odoo.conf -d mydb -u my_module --stop-after-init --log-level=debug
```

Compruebe:

- sintaxis de `__manifest__.py`,
- completitud de `depends`,
- orden de los archivos de datos,
- anclas xpath,
- firma del script de migración,
- dependencias externas,
- advertencias de ACL,
- reflexión de `ir.model.fields`.

---

## 10. Depuración de frontend

- consola/red del navegador,
- devtools de OWL,
- `--dev=assets` para desactivar el empaquetado,
- comprobar que `web.assets_backend` incluye sus archivos,
- verificar la herencia de plantillas (`t-inherit`),
- limpiar la caché del navegador/recarga forzada,
- comprobar el arch de `ir.ui.view` en la base de datos.

---

## 11. Depuración de integraciones

| Síntoma | Comprobación |
|---|---|
| 401/403 | clave de API, sesión, grupos de usuario |
| 422 | validación del payload, campos obligatorios |
| Registros duplicados | clave de idempotencia, restricción única |
| Tiempo de espera agotado | longitud de la transacción, latencia externa |
| Eventos perdidos | estado del outbox, cron, reintentos |
| Datos inconsistentes | mapeo, moneda, UdM, zona horaria |

Registre siempre el id de la solicitud externa y el id del registro de Odoo; correlacione ambos.

---

## 12. Severidad de incidentes

| Severidad | Definición | Respuesta |
|---|---|---|
| S1 | producción caída, pérdida de datos, brecha de seguridad | inmediata, sala de crisis |
| S2 | flujo crítico bloqueado, sin solución alternativa | < 1 h |
| S3 | flujo degradado, existe solución alternativa | < 4 h |
| S4 | menor/cosmético | próxima versión |

---

## 13. Plantilla de postmortem

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

Cultura sin culpables: el foco se pone en los sistemas y los controles, no en las personas.

---

## 14. Índice de evidencias

| Tema | Archivo |
|---|---|
| Reintentos/errores | `service/model.py:160` |
| Comprobaciones de acceso | `orm/models.py:4100` |
| Registro | `orm/registry.py` |
| Cron | `addons/base/models/ir_cron.py` |
| Bus | `addons/bus/models/bus.py` |
| Profiler | `tools/profiler.py` |

Continúe con `04-checklists.md`.
