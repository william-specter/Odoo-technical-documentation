# Alcance del ERP III — Cuellos de botella de rendimiento y límites de escalado

> **Los cuellos de botella son arquitectónicos, no solo de código.** El capítulo del ORM explica el coste de las consultas; este capítulo explica dónde se ralentiza la plataforma en su conjunto, por qué y qué hacer antes de que los usuarios lo noten.

---

## 1. Los diez cuellos de botella que importan

| # | Cuello de botella | Desencadenante | Impacto |
|---|---|---|---|
| 1 | Búsquedas ORM sin límites | vistas de lista, informes, importaciones | picos de memoria/CPU |
| 2 | Tormentas de recálculo | `@api.depends` amplios, escrituras masivas | CPU, tiempo de transacción |
| 3 | Transacciones largas | llamadas externas, crons, importaciones | bloqueos, bloat, tiempos de espera agotados |
| 4 | Contención de quants de stock | entregas y recepciones concurrentes | interbloqueos, reintentos |
| 5 | Bloqueo de secuencia contable | publicación masiva de facturas | publicación serializada |
| 6 | Volumen de seguimiento de correo | campos con seguimiento en modelos de gran volumen | crecimiento de la BD, colas de correo |
| 7 | E/S de adjuntos y filestore | PDF e imágenes grandes | disco, tiempo de copia de seguridad |
| 8 | Informes sobre el primario | BI, hojas de cálculo, exportaciones | ralentización del OLTP |
| 9 | Dimensionamiento incorrecto de workers y conexiones | pocos workers, demasiadas conexiones | latencia, errores 502 |
| 10 | Autovacuum y bloat | tablas con alta rotación | escaneos lentos, crecimiento del disco |

---

## 2. Flujos comerciales

### 2.1 Confirmación de pedidos de venta

Factores de coste:

- cálculo de la tarifa por línea (SQL + Python),
- cálculo de impuestos por línea,
- aprovisionamiento de stock (resolución de rutas, creación de movimientos),
- seguimiento de correo,
- desencadenantes de automatización.

Con más de 100 líneas, la confirmación puede tardar segundos y crear decenas de movimientos y pickings. Con 1.000 líneas, puede agotar el tiempo de espera.

**Mitigaciones:**

- limitar el número de líneas por pedido (regla de negocio),
- desactivar el seguimiento en los campos no esenciales,
- confirmar por lotes en un cron, no en una petición web,
- evitar campos personalizados con muchos onchange,
- probar con un catálogo realista (tarifas, impuestos, rutas).

### 2.2 Creación de facturas

`_create_invoices` carga las líneas de pedido, calcula los impuestos, agrupa las facturas y crea asientos y líneas. Para un lote de cierre de mes de 10k pedidos:

- hacerlo por bloques (500–1.000),
- hacer commit entre bloques (cron con progreso),
- prever contención en el bloqueo de secuencia,
- vigilar el crecimiento de `account_move_line`.

### 2.3 Portal y sitio web

Las consultas del sitio web son intensivas en lectura y a menudo ilimitadas:

- listado de productos con facetas,
- cálculo del precio por variante,
- disponibilidad de stock por producto,
- escrituras del carrito y del proceso de pago.

**Mitigaciones:**

- almacenar en caché las páginas del catálogo,
- limitar las variantes por plantilla,
- evitar `virtual_available` en bucles (agrega),
- usar una CDN para los recursos estáticos,
- separar los workers del sitio web si el tráfico es alto.

---

## 3. Flujos de inventario

### 3.1 Reserva y validación

- `_gather` busca quants por producto, ubicación, lote, paquete y propietario.
- `_update_available_quantity` bloquea una fila de quant.
- `_action_done` actualiza los quants por línea de movimiento y crea asientos de valoración.

La validación concurrente del mismo producto en distintos almacenes provoca esperas de bloqueo. El envoltorio de reintentos las enmascara como latencia, no como errores.

**Mitigaciones:**

- indexar `stock_quant(product_id, location_id)`,
- evitar validar el mismo SKU de forma concurrente (programación operativa),
- agrupar por picking, no por línea de movimiento,
- vigilar `pg_locks` durante los picos.

### 3.2 Valoración

`_set_value` para FIFO recorre los movimientos restantes; para AVCO actualiza el precio estándar. Las pilas FIFO grandes hacen que la valoración de salidas sea O(n).

**Mitigaciones:**

- mantener acotadas las capas FIFO (revaluación y limpieza periódicas),
- evitar el stock negativo (corrompe el FIFO),
- usar coste estándar cuando el negocio lo permita,
- probar la valoración de cierre de mes con volúmenes de producción.

### 3.3 Informes de inventario

`qty_available`, `virtual_available` y `free_qty` se calculan con agregados dependientes del contexto. Un listado de productos que muestra la disponibilidad de 100 productos puede lanzar más de 100 consultas.

**Mitigaciones:**

- precargar y agregar en una sola consulta,
- almacenar en caché la disponibilidad para las páginas del catálogo,
- evitar la disponibilidad en las vistas de lista para catálogos grandes.

---

## 4. Fabricación

- La explosión de la LdM es recursiva, pero está acotada por la profundidad de la LdM; las LdM multinivel profundas con fantasmas son costosas.
- La planificación de órdenes de trabajo recorre calendarios y capacidades; cientos de operaciones por OF son lentos.
- `_post_inventory` consume componentes y produce productos terminados; las OF grandes crean muchos movimientos y líneas.
- El cálculo de costes agrega los valores de los movimientos consumidos y los costes de las órdenes de trabajo; las hojas de ruta complejas añaden coste.

**Mitigaciones:**

- limitar el tamaño de la OF; dividirla en lotes,
- simplificar las LdM (evitar niveles fantasma innecesarios),
- planificar en un cron, no de forma interactiva,
- precalcular los costes de los centros de trabajo,
- vigilar el crecimiento de `mrp_workcenter_productivity`.

---

## 5. Contabilidad

### 5.1 Publicación

- `_check_balanced` y `_sync_dynamic_lines` recalculan las líneas de impuestos y de condiciones de pago.
- La asignación de secuencias bloquea por diario y período.
- La cadena de hash añade un SHA-256 por asiento.
- La conciliación crea conciliaciones parciales y asientos de cambio.

Publicar 10k facturas en una sola transacción es un antipatrón habitual: mantiene retenido el bloqueo de secuencia y hace crecer el registro de transacciones.

**Mitigaciones:**

- publicar por bloques con commits entre bloques,
- separar diarios para los flujos de gran volumen,
- evitar el encadenamiento de hash salvo que sea legalmente obligatorio,
- vigilar `pg_stat_activity` para detectar esperas de bloqueo.

### 5.2 Informes

El balance de comprobación, el libro mayor, la antigüedad de cuentas por cobrar y los informes de impuestos agregan `account_move_line`. Sin índices adecuados y filtros de fecha, recorren millones de filas.

**Mitigaciones:**

- indexar `(company_id, date, account_id)`,
- restringir los rangos de fechas,
- usar el motor Enterprise `account_reports` (SQL optimizado),
- ejecutar los informes pesados en una réplica,
- materializar los saldos mensuales si es necesario.

### 5.3 Conciliación

`_reconcile_plan` procesa las conciliaciones parciales por lotes, pero sigue cargando líneas y residuales. La conciliación bancaria con miles de líneas de extracto consume mucha memoria.

**Mitigaciones:**

- conciliar por lotes,
- evitar emparejar en rangos de fechas muy amplios,
- usar reglas y modelos para automatizar,
- vigilar el crecimiento de `account_partial_reconcile`.

---

## 6. Correo y notificaciones

`mail.thread` escribe mensajes y valores de seguimiento cuando cambian los campos con seguimiento. Los modelos de gran volumen con seguimiento generan:

- filas de `mail_message`,
- filas de `mail_tracking_value`,
- notificaciones a los seguidores,
- entradas en la cola de correo.

**Mitigaciones:**

- auditar `tracking=True` en movimientos de stock, asientos contables y modelos con muchas importaciones,
- desactivar el seguimiento en las importaciones (`tracking_disable=True`),
- agrupar las notificaciones por lotes,
- purgar los mensajes antiguos según la política de retención,
- evitar `message_post` en bucles.

---

## 7. Importaciones y exportaciones

- `base_import` carga los CSV/XLS en memoria; los archivos grandes pueden agotar la memoria del worker.
- Cada fila desencadena create/write, cálculos, restricciones y seguimiento.
- El modo de importación usa puntos de guardado y puede ser lento.

**Mitigaciones:**

- dividir los archivos (menos de 10k filas),
- desactivar el seguimiento y las automatizaciones durante la importación,
- usar `load()` con campos mapeados,
- validar antes de importar,
- ejecutar en un worker o cron dedicado.

---

## 8. Adjuntos y filestore

- Los binarios grandes en `ir_attachment` ralentizan las copias de seguridad y las restauraciones.
- `db_datas` (bytea) hincha la base de datos y el WAL.
- El filestore en NFS/S3 añade latencia.

**Mitigaciones:**

- usar el filestore para los archivos grandes,
- comprimir los PDF y las imágenes,
- establecer retención para los adjuntos transitorios,
- hacer copias de seguridad incrementales del filestore,
- vigilar el uso del disco.

---

## 9. Dimensionamiento de workers y base de datos

### 9.1 Fórmula

```
workers = 2 * CPU cores + 1        # CPU-bound interactive
max_connections >= workers * db_maxconn + cron_threads + reserve
RAM >= workers * limit_memory_soft + PostgreSQL cache + OS
```

Ejemplo: 8 núcleos, 16 workers, `db_maxconn=8` → 128 conexiones + 2 de cron + reserva ≈ 140. `max_connections` de PostgreSQL debe ser ≥ 150, con `shared_buffers` dimensionado según la RAM.

### 9.2 Síntomas de un dimensionamiento incorrecto

| Síntoma | Causa |
|---|---|
| 502/504 bajo carga | pocos workers o peticiones largas |
| `too many connections` | `db_maxconn` × workers > `max_connections` |
| Procesos terminados por OOM | límites de memoria demasiado altos o fugas |
| Latencia alta, CPU baja | espera de E/S o contención de bloqueos |
| Inanición del cron | `max_cron_threads` demasiado bajo o tareas largas |

### 9.3 Gevent frente a prefork

- Prefork (`--workers=N`) es el valor predeterminado en producción; cada worker es un proceso.
- Gevent está pensado para E/S de alta concurrencia (websocket, long polling); cambia el comportamiento de memoria y conexiones.
- No se deben mezclar los supuestos de gevent y prefork.

---

## 10. Crecimiento de la base de datos

| Tabla | Factor de crecimiento | Estrategia de retención |
|---|---|---|
| `mail_message` | chatter, seguimiento | archivar o purgar los antiguos |
| `mail_tracking_value` | campos con seguimiento | purgar junto con los mensajes |
| `stock_move` / `stock_move_line` | cada transferencia | archivar los movimientos completados |
| `account_move_line` | cada asiento | conservar lo legalmente exigido |
| `bus_bus` | notificaciones | GC (integrado) |
| `ir_attachment` | archivos | filestore + retención |
| `ir_logging` | registros del servidor | rotar o desactivar |
| `auditlog_log_line` | módulo de auditoría | política de retención |

**[WARNING]** Eliminar el historial contable o de stock puede romper la valoración y la auditoría. Archivar en un almacén de datos; no eliminar a ciegas.

---

## 11. Criterios de aceptación de rendimiento

Definir antes de la puesta en marcha:

| Escenario | Objetivo |
|---|---|
| Confirmación de pedido de venta (50 líneas) | < 2 s p95 |
| Validación de entrega (100 líneas) | < 3 s p95 |
| Publicación de factura (individual) | < 1 s p95 |
| Lote de facturas (1.000) | < 30 min, sin tiempo de espera de bloqueo agotado |
| Listado de productos (100 elementos) | < 1 s p95 |
| Balance de comprobación (1 año, 1M líneas) | < 30 s |
| Página del portal | < 2 s p95 |
| PDF de informe | < 10 s p95 |

Medir con datos similares a los de producción, no con una base de datos de demostración vacía.

---

## 12. Pruebas de carga

- Usar `locust`/`k6` contra los puntos de acceso JSON-RPC con sesiones realistas.
- Precalentar el registro y las cachés antes de medir.
- Probar la concurrencia máxima, no la media.
- Incluir un informe pesado y una importación.
- Monitorizar PostgreSQL (`pg_stat_activity`, `pg_stat_statements`), la CPU y la RAM de los workers y los percentiles de latencia.
- Probar los modos de fallo: reinicio de la base de datos, terminación de un worker y tiempo de espera de bloqueo agotado.

---

## 13. Índice de evidencia

| Tema | Archivo |
|---|---|
| Configuración de workers | `tools/config.py:393-491` |
| Pool de conexiones | `sql_db.py:610-690` |
| Bloqueo de quants de stock | `addons/stock/models/stock_quant.py:1038` |
| Bloqueo de secuencia | `addons/account/models/sequence_mixin.py:355` |
| Seguimiento de correo | `addons/mail/models/mail_thread.py:527-760` |
| GC del bus | `addons/bus/models/bus.py:96` |
| Perfilador | `tools/profiler.py:508` |

Continuar con `04-doc-gaps.md`.
