# Diseño de base de datos IV — Indexación, rendimiento de consultas y escalado

> **Premisa.** La mayoría de los incidentes de rendimiento de Odoo no son «Odoo es lento». Son: operaciones con conjuntos de registros sin límite, índices compuestos ausentes, consultas N+1 disfrazadas de prefetch, transacciones largas o un grupo de workers/conexiones dimensionado incorrectamente. Este capítulo proporciona el modelo y los diagnósticos.

---

## 1. El modelo de costes

| Capa | Factor de coste | Síntoma típico |
|---|---|---|
| Red | idas y vueltas por solicitud | latencia alta, CPU baja |
| ORM | número de consultas, registros obtenidos | `sql_log_count` alto |
| PostgreSQL | escaneos, uniones, ordenaciones, bloqueos | CPU/IO altos, esperas de bloqueo |
| Python | bucles por registro, métodos de cálculo | CPU alta en el worker |
| Memoria | prefetch de conjuntos grandes, binarios | terminaciones por OOM |
| Bloqueos | escrituras concurrentes en las mismas filas | tiempos de espera, reintentos, interbloqueos |

**[INVARIANT]** Optimice primero el número de consultas, después el coste de las consultas y luego Python. Un endpoint de 10 consultas con predicados indexados supera a un endpoint de 1 consulta que hace un escaneo secuencial.

---

## 2. Generación de consultas del ORM

### 2.1 Búsqueda → SQL

`search(domain, order, limit, offset)` se compila a:

```sql
SELECT "sale_order".id
FROM "sale_order"
WHERE ("sale_order"."state" = %s)
  AND ("sale_order"."company_id" IN (%s))
ORDER BY "sale_order"."date_order" DESC, "sale_order"."id" DESC
LIMIT %s OFFSET %s;
```

Después, el acceso a un campo desencadena una segunda consulta (`SELECT ... WHERE id IN (...)`). `search_read()` hace ambas cosas, pero en la mayoría de los casos sigue siendo dos consultas.

### 2.2 Prefetch

El acceso a un campo de un conjunto de registros obtiene ese campo para todo el conjunto de prefetch. Por eso `for record in records: record.name` es rápido y `for id in ids: env['x'].browse(id).name` es lento.

Control del prefetch:

```python
records = env['sale.order'].search([...]).with_prefetch(ids)
records.fetch(['name', 'partner_id'])          # explicit
records.with_context(prefetch_fields=False)    # disable
```

### 2.3 `_read_group` / `read_group`

`_read_group(domain, groupby, aggregates)` es la API de agregación eficiente:

```python
groups = env['sale.order.line']._read_group(
    [('order_id.state', '=', 'sale')],
    groupby=['product_id'],
    aggregates=['product_uom_qty:sum', 'price_subtotal:sum'],
)
```

Genera una única consulta `GROUP BY` en lugar de cargar registros. Úsela para paneles e informes en lugar de bucles de Python.

**[WARNING]** `read_group` (API heredada) y `_read_group` tienen firmas y formas de retorno diferentes. Odoo 19 usa `_read_group` internamente; `read_group` es un envoltorio de compatibilidad.

---

## 3. Estrategia de indexación

### 3.1 Qué indexa Odoo

- `id` (PK)
- campos con `index=True` / `index='btree_not_null'` / `index='trigram'`
- columnas inversas many2many
- algunos campos del sistema (`company_id` en muchos modelos, `state` en documentos)
- `parent_path` para modelos jerárquicos

### 3.2 Qué **no** indexa Odoo

- todos los `Many2one` (solo si se declaran)
- predicados compuestos
- `create_date` en la mayoría de las tablas (excepto `bus.bus`)
- claves JSONB (salvo que se añada un índice GIN)
- valores traducidos (salvo trigram)

### 3.3 Ejemplos de índices compuestos

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

Use `CONCURRENTLY` en producción para evitar bloquear escrituras; la creación automática de índices de Odoo no lo usa.

### 3.4 Reglas de selección de índices

| Forma de la consulta | Índice |
|---|---|
| `WHERE company_id = ? AND state = ?` | `(company_id, state)` |
| `WHERE partner_id = ? ORDER BY date DESC` | `(partner_id, date DESC)` |
| `WHERE date >= ? AND date < ?` | `(date)` o BRIN para tablas enormes de solo inserción |
| `WHERE name ILIKE '%foo%'` | trigram GIN sobre `unaccent(name)` |
| `WHERE product_id = ? AND location_id = ?` | `(product_id, location_id)` en `stock_quant` |
| contención JSONB | GIN en la columna JSONB |

### 3.5 Antipatrones de índices

- Indexar todas las columnas «por seguridad» → amplificación de escrituras, hinchazón.
- Índices duplicados (puede que Odoo ya tenga uno).
- Índices parciales con un predicado que la consulta no usa.
- Indexar booleanos de baja cardinalidad por sí solos.
- Olvidar `CONCURRENTLY` en tablas de producción grandes.

---

## 4. N+1 y operaciones sin límite

### 4.1 Detección de N+1

```python
from odoo.tests import Form
from odoo.tools import mute_logger
import logging

with mute_logger('odoo.sql_db'):
    before = env.cr.sql_log_count
    do_work()
    print("queries:", env.cr.sql_log_count - before)
```

O bien habilite el registro SQL:

```bash
odoo-bin --log-level=debug_sql --logfile=/var/log/odoo/sql.log
```

### 4.2 Patrones N+1 comunes

| Patrón | Corrección |
|---|---|
| `for rec in recs: rec.partner_id.name` | prefetch (normalmente automático); compruebe `prefetch_fields` |
| `for rec in recs: env['x'].search(...)` | una sola búsqueda con `in` |
| `for rec in recs: rec.line_ids` | prefetch de x2many; evítelo en bucles |
| `for rec in recs: rec.compute()` que llama a search | cálculo por lotes |
| `mapped('a.b.c')` cadena profunda | prefetch, o `_read_group` |
| `len(recs)` repetidamente | calcúlelo una vez |
| `sorted(recs, key=lambda r: r.name)` | `search(order=...)` |

### 4.3 Operaciones sin límite sobre conjuntos de registros

```python
# DANGEROUS on 500k rows
orders = env['sale.order'].search([])
total = sum(orders.mapped('amount_total'))
```

Correcciones:

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

**[WARNING]** Odoo no impone un `limit` predeterminado en `search()`. La ausencia de límite en una tabla grande puede obtener millones de ids y agotar la memoria antes de que se lea ningún campo.

---

## 5. Coste de cálculo y recálculo

### 5.1 Cálculos almacenados

Un campo calculado almacenado añade:

- un registro de dependencia,
- invalidación cuando cambian las fuentes,
- un recálculo al hacer flush,
- una escritura en la columna.

Una cadena `A → B → C → D` recalcula D cada vez que cambia A. Las cadenas profundas en modelos de gran volumen son costosas.

### 5.2 `compute_sudo`

Valor predeterminado `True` para los cálculos almacenados. Esto evita errores de acceso, pero puede filtrar datos. Más importante aún, no reduce el coste de las consultas.

### 5.3 Tormentas de recálculo

Síntomas:

- una escritura desencadena cientos de recálculos,
- `Too many iterations for recomputing fields!` en los registros,
- CPU alta tras una importación masiva.

Correcciones:

- reducir la amplitud de las dependencias,
- usar `store=False` para campos solo de interfaz,
- escrituras por lotes (`write` sobre un conjunto de registros, no por registro),
- usar `env.protecting` cuando se establezcan valores calculados intencionadamente,
- evitar `modified()` dentro de bucles.

---

## 6. Transacciones, bloqueos y vacuum

### 6.1 Transacciones largas

Una transacción que permanece abierta durante minutos:

- mantiene bloqueos de fila,
- impide que vacuum limpie tuplas muertas,
- aumenta la hinchazón,
- puede bloquear la asignación de secuencias,
- corre el riesgo de agotar conexiones por `idle in transaction`.

Causas: llamadas HTTP externas dentro de la transacción, bucles sin límite, generación de informes, importaciones grandes, cron sin commits de progreso.

### 6.2 Autovacuum

Odoo no ajusta PostgreSQL. La configuración predeterminada de autovacuum suele ser demasiado conservadora para tablas con alta rotación (`mail_message`, `stock_move`, `account_move_line`, `bus_bus`).

Línea base recomendada:

```conf
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02
autovacuum_vacuum_cost_delay = 2ms
```

Sobrescrituras por tabla para tablas activas:

```sql
ALTER TABLE mail_message SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE stock_move SET (autovacuum_vacuum_scale_factor = 0.02);
```

### 6.3 Grupo de conexiones

`db_maxconn` predeterminado 64 (`tools/config.py:393`). El grupo es por proceso. Con `workers=8`, cada worker puede abrir hasta 64 conexiones; `max_connections` de PostgreSQL debe tener en cuenta todos los workers más cron y mantenimiento.

Regla de dimensionamiento:

```
max_connections >= workers * db_maxconn + cron_threads + reserve
```

En la práctica, establezca `db_maxconn` bajo (8–16) por worker y aumente `max_connections` en consecuencia; la mayoría de las solicitudes usan una sola conexión.

### 6.4 Dimensionamiento de workers

| Parámetro | Valor predeterminado | Orientación |
|---|---|---|
| `workers` | 0 (con hilos) | `2 * CPU cores + 1` para cargas intensivas en CPU |
| `max_cron_threads` | 2 | 1–4; cron está limitado por E/S |
| `limit_time_cpu` | 60s | menor para interactivo, mayor para informes |
| `limit_time_real` | 120s | debe superar la solicitud legítima más larga |
| `limit_memory_soft` | 2 GB | reciclar tras la solicitud |
| `limit_memory_hard` | 2.5 GB | matar el worker |
| `db_maxconn` | 64 | 8–16 por worker |

**[WARNING]** Los límites de memoria son por worker, no por solicitud. Una fuga de memoria se acumula entre solicitudes hasta que se activa el límite blando y provoca el reciclado.

---

## 7. Perfilado

### 7.1 Perfilador integrado

```python
from odoo.tools.profiler import Profiler

with Profiler(collectors=['sql', 'traces_async']) as p:
    do_work()
print(p.summary())
```

O a través de la interfaz: Ajustes → Técnico → Perfilado (habilite `--dev=profile`).

### 7.2 Registro SQL

```bash
odoo-bin --log-level=debug_sql
```

Registra cada consulta con su duración. Úselo para una sola solicitud, no de forma continua en producción.

### 7.3 `pg_stat_statements` de PostgreSQL

```sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Este es el diagnóstico de producción más útil. Habilite la extensión y restablezca las estadísticas tras un periodo de referencia.

### 7.4 `EXPLAIN (ANALYZE, BUFFERS)`

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Busque:

- `Seq Scan` en tablas grandes,
- bucles anidados con recuentos de filas elevados,
- ordenaciones que se derraman a disco,
- lecturas de heap frente a escaneos solo de índice,
- esperas de bloqueo (nodo `Lock`).

---

## 8. Patrones de escalado

### 8.1 Primero vertical

- CPU para los workers de Python,
- RAM para la caché de PostgreSQL y la memoria de los workers,
- NVMe rápido para WAL y datos,
- discos separados para WAL y datos si es posible.

### 8.2 Réplicas de lectura

El núcleo de Odoo no enruta las lecturas a réplicas. Opciones:

- configurar un standby en caliente de PostgreSQL y enrutar manualmente las lecturas de informes/réplica (código personalizado o `--db_host` por worker),
- usar replicación lógica para analítica,
- aceptar que todas las lecturas del ORM van al primario.

**[WARNING]** Una réplica de lectura con replicación asíncrona puede devolver datos obsoletos; la caché y las reglas de registro de Odoo presuponen la consistencia del primario. No use una réplica para flujos de negocio interactivos sin una estrategia de consistencia.

### 8.3 Particionado

El núcleo de Odoo no particiona tablas. Candidatas:

- `mail_message` / `mail_tracking_value` (basadas en tiempo),
- `stock_move_line` (basadas en tiempo),
- `account_move_line` (por ejercicio fiscal),
- `bus_bus` (retención corta, mejor GC),
- tablas de auditoría/registro.

El particionado requiere migraciones personalizadas y cambios en las consultas; pruébelo con las suposiciones de `_table` del ORM.

### 8.4 Archivado

- `active=False` oculta registros, pero no reduce el tamaño de la tabla.
- Mueva los registros antiguos a tablas de archivo o a un almacén de datos.
- Para contabilidad, la retención legal suele exigir conservar los asientos; archive la base de datos, no las filas.

---

## 9. Lista de verificación de rendimiento

### Nivel de consulta
- [ ] Toda `search()` tiene un `limit` o un dominio acotado.
- [ ] No hay `search()` dentro de un bucle.
- [ ] Las agregaciones usan `_read_group`, no sumas de Python.
- [ ] `EXPLAIN` muestra uso de índices para las consultas activas.
- [ ] No hay escaneos secuenciales en tablas > 1M de filas para solicitudes interactivas.

### Nivel de ORM
- [ ] Los cálculos están por lotes y las dependencias están completas.
- [ ] El prefetch está habilitado donde corresponde.
- [ ] `ensure_one()` no está en bucles.
- [ ] `sudo()` no se usa para enmascarar el coste de las consultas de acceso.
- [ ] `flush()` no se llama por registro.

### Nivel de base de datos
- [ ] `pg_stat_statements` habilitado.
- [ ] Autovacuum ajustado para tablas activas.
- [ ] Sin índices sin usar o duplicados.
- [ ] Grupo de conexiones dimensionado para `max_connections`.
- [ ] Transacciones largas monitorizadas y terminadas si están inactivas.

### Operaciones
- [ ] Workers dimensionados según la CPU.
- [ ] Límites de memoria establecidos.
- [ ] Los trabajos de cron confirman el progreso.
- [ ] Las copias de seguridad incluyen el filestore.
- [ ] Monitorización de latencia p95, tasa de errores, conexiones a la base de datos y retraso de replicación.

---

## 10. Índice de evidencias

| Tema | Archivo |
|---|---|
| Valores predeterminados de configuración | `tools/config.py:393-491` |
| Grupo de conexiones | `sql_db.py:610-690` |
| `_read_group` | `orm/models.py:1861-2388` |
| Prefetch | `orm/models.py:3754-3870` |
| Gestión de índices | `orm/registry.py:829-900` |
| Perfilador | `tools/profiler.py:508` |
| Bloqueo de secuencias | `account/models/sequence_mixin.py:355` |
| Bloqueo de quant | `stock/models/stock_quant.py:1038` |

Continúe con `05-migrations.md`.
