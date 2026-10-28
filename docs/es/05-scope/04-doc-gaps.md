# Alcance del ERP IV — Dónde la documentación oficial induce a error o se detiene

> **Base de la evidencia.** La instantánea de la documentación es la **20.0**; el código fuente es la **19.0**. Algunas brechas se deben al desfase entre versiones, otras a una abstracción deliberada y otras a docstrings o comentarios obsoletos en el propio código fuente. Cada trampa que se describe a continuación incluye un método de verificación.

---

## 1. La discrepancia estructural

| Hecho | Consecuencia |
|---|---|
| La documentación es 20.0, el código fuente es 19.0 | Las API, los modelos y los estados pueden diferir |
| La documentación describe la API pública | se omiten los mecanismos internos |
| La documentación está organizada por funcionalidad | los flujos entre módulos no se documentan de principio a fin |
| La documentación supone una base de datos estándar | los módulos personalizados, los campos de Studio y las localizaciones cambian el comportamiento |
| Los docstrings del código fuente pueden estar obsoletos | los comentarios no son evidencia |

**[INVARIANT]** Para cualquier afirmación sensible a la versión, se debe verificar contra `_name`, las declaraciones de campos y los cuerpos de los métodos en el árbol de código fuente, no contra una página de documentación ni un comentario.

---

## 2. Catálogo de trampas

### 2.1 «El modelo existe» (modelos eliminados)

El código fuente de la 19 todavía contiene comentarios y nombres de pruebas que hacen referencia a:

- `procurement.group` (`stock_rule.py:316`, archivos de prueba),
- `stock.valuation.layer` (comentario de demostración de `mrp_account`, comentario de prueba de `sale_stock`),
- «procurement group» en los docstrings de movimientos de stock.

Pero los modelos **no están definidos** en esta compilación. Una búsqueda de `_name = 'procurement.group'` no devuelve nada.

**Verificación:**

```bash
grep -rn "_name = 'procurement.group'" addons/
grep -rn "_name = 'stock.valuation.layer'" addons/
```

Si no hay una declaración `_name`, el modelo no existe, independientemente de los comentarios.

### 2.2 «Estado `done`» (estados eliminados)

Ventas y compras ya no tienen un estado `done`. Los docstrings y los módulos antiguos de la comunidad siguen haciendo referencia a él.

**Verificación:** inspeccionar la declaración `state = fields.Selection([...])` del modelo, no el docstring.

### 2.3 «El tipo de producto es `product`»

La v19 usa `type='consu'` + `is_storable=True`. El código antiguo que comprueba `type == 'product'` ha quedado obsoleto.

**Verificación:**

```bash
grep -n "type = fields.Selection" -A 10 addons/product/models/product_template.py
```

### 2.4 «La UdM tiene una categoría»

La v19 eliminó `uom.category`. El código de conversión antiguo que usa `category_id` falla.

**Verificación:**

```bash
grep -n "category_id" addons/uom/models/uom_uom.py
```

### 2.5 «`read_group` es la API»

`read_group` está obsoleto en la 19; `_read_group` es la API interna y `formatted_read_group` devuelve resultados formateados. Es posible que la documentación todavía muestre `read_group`.

**Verificación:** `orm/models.py:2748` muestra el decorador de obsolescencia.

### 2.6 «`create` acepta un dict»

`create` exige una lista o una tupla en la v19. `@api.model_create_multi` permite un único dict por compatibilidad con versiones anteriores, pero el método subyacente espera una lista.

**Verificación:** `orm/models.py:4611`.

### 2.7 «`name_get` es la API de visualización»

`name_get` se ha eliminado. Usar `display_name` / `_compute_display_name`.

**Verificación:** buscar `def name_get` en `orm/models.py`; no está presente.

### 2.8 «`check_access_rights` está vigente»

Obsoleto desde la 18; usar `check_access` / `has_access` / `_filtered_access`.

**Verificación:** `orm/models.py:4161-4190`.

### 2.9 «Los impuestos se calculan con `_compute_taxes`»

El motor de la v19 es una canalización de funciones puras. Los ayudantes antiguos están obsoletos o se han eliminado.

**Verificación:** `account/models/account_tax.py:1137`, `:4972`.

### 2.10 «El ORM hace commit al final de cada método»

No. El envoltorio de la petición hace commit una sola vez; los métodos de modelo no deben hacer commit. El cron confirma el progreso de forma explícita.

**Verificación:** `service/model.py:160-241`, `addons/base/models/ir_cron.py:399-500`.

### 2.11 «Los puntos de guardado son gratuitos»

Cada punto de guardado es una subtransacción de PostgreSQL con un coste; los puntos de guardado anidados por fila pueden dominar el tiempo de ejecución.

**Verificación:** `sql_db.py:60-140`, `account/models/sequence_mixin.py:355-425`.

### 2.12 «Las reglas de registro son opcionales»

Sin una regla de registro, un modelo con una ACL es totalmente visible para ese grupo. Una regla ausente es una puerta abierta.

**Verificación:** `addons/base/models/ir_rule.py:113-175`.

### 2.13 «`noupdate` significa que nunca se actualiza»

Significa que los archivos de datos XML no actualizan el registro; los scripts de migración y las escrituras del ORM siguen modificándolo.

**Verificación:** `addons/base/models/ir_model.py:2237-2450`.

### 2.14 «Las vistas son solo XML»

Las vistas son datos con herencia, xpath, grupos y validación. Un xpath roto hace fallar la carga del módulo, no el tiempo de ejecución.

**Verificación:** `addons/base/models/ir_ui_view.py` (`_validate_module_views`).

### 2.15 «El cron es un planificador sencillo»

Las tareas cron se reclaman con `SKIP LOCKED`, se ejecutan en transacciones separadas, admiten commits de progreso y pueden desactivarse tras fallos repetidos.

**Verificación:** `addons/base/models/ir_cron.py:187-500`.

### 2.16 «El bus es una cola de mensajes»

`bus.bus` es una tabla de notificaciones de interfaz con semántica de como máximo una entrega y con GC, no una cola duradera.

**Verificación:** `addons/bus/models/bus.py:88-200`.

### 2.17 «Los adjuntos están en la base de datos»

Los adjuntos grandes están en el filestore; un volcado de la base de datos por sí solo está incompleto.

**Verificación:** `addons/base/models/ir_attachment.py:75-320`.

### 2.18 «Eliminar un registro es sencillo»

`unlink()` aplica cascadas, invalida toda la caché y puede quedar bloqueado por `ir.model.data` o `@api.ondelete`. El ORM no rastrea las cascadas.

**Verificación:** `orm/models.py:4194-4320`.

---

## 3. Lo que la documentación oficial cubre bien

En honor a la verdad, la documentación para desarrolladores de la 20.0 es buena para:

- declaraciones de modelos y campos y uso básico del ORM,
- sintaxis y herencia de vistas,
- conceptos básicos de controladores y enrutamiento,
- conceptos básicos de manifiestos y archivos de datos,
- conceptos básicos de grupos de seguridad,
- marco de pruebas,
- conceptos básicos de CLI y despliegue,
- tutoriales de frontend y OWL,
- scripts de actualización a alto nivel.

**No** sustituyen la lectura del código fuente cuando el comportamiento importa.

---

## 4. Mapa de brechas de cobertura

| Tema | Documentación oficial | Este manual |
|---|---|---|
| Interioridades del entorno y el registro | breve | `00-overview/01`, `01-business-logic/01` |
| Transacciones, reintentos y puntos de guardado | casi ausente | `01-business-logic/02` |
| Caché y recálculo | breve | `01-business-logic/01` |
| Semántica de las reglas de registro | básica | `01-business-logic/05` |
| Concurrencia y progreso del cron | ausente | `01-business-logic/02` |
| Garantías del bus | ausente | `00-overview/01` |
| Coste del seguimiento de correo | ausente | `01-business-logic/04` |
| MRO de módulos y fases de carga | breve | `04-modules/01` |
| Elementos eliminados de la 18 a la 19 | ausente | `04-modules/05` |
| Interioridades del aprovisionamiento | breve | `02-flows/03` |
| Publicación y hash contables | breve | `02-flows/04` |
| Cálculo de estados de fabricación | breve | `02-flows/05` |
| Nomenclatura y herencia de la base de datos | básica | `03-database/01-02` |
| Indexación e índices compuestos | ausente | `03-database/04` |
| Patrones de migración | básica | `03-database/05` |
| Alcance y brechas | orientada al marketing | `05-scope/*` |
| Estimación y gestión de proyectos | ausente | `07-project-management/*` |

---

## 5. Cómo verificar una afirmación rápidamente

### 5.1 Existencia de un modelo

```bash
grep -rn "_name = 'model.name'" addons/ --include=*.py
```

### 5.2 Definición de un campo

```bash
grep -rn "field_name = fields\." addons/module/models/ --include=*.py
```

### 5.3 Cuerpo de un método

```bash
grep -rn "def method_name" addons/module/ --include=*.py
```

### 5.4 Valores reales de los estados

```bash
python3 - <<'PY'
import ast
# parse the model file and print the `state = fields.Selection([...])` literal
PY
```

### 5.5 Versión del módulo instalado

```sql
SELECT name, state, latest_version FROM ir_module_module WHERE name = 'sale';
```

### 5.6 Esquema real

```sql
\d sale_order
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sale_order';
```

### 5.7 Comportamiento en tiempo de ejecución

```python
# in odoo shell
so = env['sale.order'].browse(1)
print(so.state, so.locked, so.invoice_status)
print(so._fields['state'].selection)
```

---

## 6. Trampas de la documentación en el código personalizado

| Trampa | Ejemplo | Solución |
|---|---|---|
| Copiar un fragmento de un blog | `state == 'done'` | verificar contra el código fuente |
| Confiar en un docstring | `_action_invoice_created` (ausente) | buscar el método con grep |
| Suponer un modelo | `env['procurement.group']` | comprobar `_name` |
| Suponer una API | `name_get()` | usar `display_name` |
| Suponer un valor predeterminado | `search([])` devuelve todo | comprobar `limit` |
| Suponer una transacción | `cr.commit()` en un método | eliminar |
| Suponer una regla | nuevo modelo visible solo para administradores | añadir ACL y regla |
| Suponer una versión | documentación 20 sobre código 19 | fijar la versión |

---

## 7. Recomendaciones para el equipo

1. **Fijar la versión del código fuente** en cada documento de diseño y en cada lista de verificación de revisión de código.
2. **Tratar la documentación como material de incorporación**, no como una especificación.
3. **Escribir un ADR** para cada comportamiento no evidente del que se dependa, con una referencia al código fuente.
4. **Añadir pruebas de regresión** para los comportamientos que se deduzcan por ingeniería inversa.
5. **Mantener un registro local de «brechas conocidas»** (este volumen) y actualizarlo en cada actualización.
6. **No copiar código Enterprise**; reimplementar el comportamiento a partir del contrato documentado.
7. **Verificar en tiempo de ejecución** en una base de datos de preproducción con datos similares a los de producción.

---

## 8. Índice de evidencia

| Tema | Archivo |
|---|---|
| API obsoletas | `orm/models.py:2748`, `4161-4190`, `5789` |
| Firma de create | `orm/models.py:4611` |
| Envoltorio de transacción | `service/model.py:160` |
| Cron | `addons/base/models/ir_cron.py:187-500` |
| Bus | `addons/bus/models/bus.py:88-200` |
| Adjuntos | `addons/base/models/ir_attachment.py:75-320` |
| Reglas de registro | `addons/base/models/ir_rule.py:113-175` |
| UdM | `addons/uom/models/uom_uom.py:18-100` |
| Tipo de producto | `addons/product/models/product_template.py:54-62` |

Continuar con el volumen 6: artefactos de ingeniería de software.
