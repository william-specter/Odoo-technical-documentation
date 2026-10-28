# Relaciones entre módulos V — Compatibilidad de versiones y cambios disruptivos de 18→19

> **Propósito.** La instantánea de la documentación oficial es 20.0, el código fuente es 19.0 y la mayoría de los módulos de la comunidad se escribieron para 17/18. Este capítulo cataloga los cambios que rompen el código personalizado, con la evidencia exacta del código fuente.

---

## 1. Por qué la versión 19 rompe cosas

Odoo 19 no es una versión meramente cosmética. Elimina o sustituye varios modelos del núcleo y cambia la semántica de los campos. Los cambios más peligrosos son silenciosos: el código sigue ejecutándose, pero devuelve datos incorrectos o escribe en una columna muerta.

### 1.1 Cambios disruptivos de un vistazo

| Área | Eliminado / modificado | Sustituto | Impacto |
|---|---|---|---|
| Abastecimiento | modelo `procurement.group` | `stock.reference` | consultas, sobrescrituras, informes |
| Valoración | modelo `stock.valuation.layer` | `stock.move.value`, `product.value` | informes de valoración, capas personalizadas |
| Tipo de producto | `type='product'` | `type='consu'` + `is_storable` | filtros de stock, LdM, rutas |
| UdM | `uom.category`, `category_id` | árbol `relative_uom_id` / `relative_factor` | conversiones, código personalizado de UdM |
| Estado de ventas | `state='done'` | booleano `locked` | comprobaciones de estado |
| Estado de compras | `state='done'` | sin estado «done» | comprobaciones de estado |
| Motor de impuestos | funciones auxiliares `_compute_taxes` | canalización de funciones puras | sobrescrituras de impuestos |
| API de acceso | `check_access_rights`, `check_access_rule` | `check_access`, `has_access` | código de seguridad |
| API de agrupación | `read_group` | `_read_group` / `formatted_read_group` | paneles |
| API de activación | `toggle_active` | `action_archive` / `action_unarchive` | acciones de la interfaz de usuario |
| API de petición | `request.cr`, `request.uid`, `request.context` | `request.env.*` | controladores |
| API del ORM | `name_get` | `display_name` / `_compute_display_name` | código de visualización |
| API del ORM | `api.one`, `api.multi` | ninguno (eliminados anteriormente) | módulos heredados |
| Dominio | lista sin procesar | clase `Domain` | funciones auxiliares de SQL, dominios personalizados |
| API de índices | `create_unique_index` | `create_index(unique=True)` | migraciones |

---

## 2. Abastecimiento: `stock.reference` [V19]

### 2.1 Qué ha cambiado

En versiones ≤18, un grupo de abastecimiento agrupaba movimientos y pickings:

```python
group = env['procurement.group'].create({'name': so.name})
move.procurement_group_id = group
```

En la versión 19, el modelo ya no existe. `stock.reference` agrupa documentos:

```python
reference = env['stock.reference'].create({'name': so.name})
move.reference_ids = [Command.link(reference.id)]
```

`stock.reference` tiene `name`, `move_ids` (M2M) y `picking_ids` calculado.

### 2.2 Lista de verificación de la migración

- [ ] Buscar `procurement.group`, `procurement_group_id` y `group_id` en el código personalizado.
- [ ] Sustituir por `stock.reference` / `reference_ids`.
- [ ] Actualizar los informes que unen por `procurement_group_id`.
- [ ] Actualizar los datos XML que referencian `procurement.group`.
- [ ] Probar la agrupación de pedido de venta → entrega, pedido de compra → recepción y OF.

**[WARNING]** Los comentarios y docstrings del código fuente de la versión 19 todavía mencionan «procurement group» (por ejemplo, `stock_rule.py:316`). No se debe inferir que el modelo existe a partir de los comentarios; se deben comprobar las declaraciones de `_name`.

---

## 3. Valoración: sin `stock.valuation.layer` [V19]

### 3.1 Qué ha cambiado

En versiones ≤18, las capas de valoración registraban cada cambio de valor. En la versión 19:

- `stock.move.value` es el valor total del movimiento,
- `stock.move.remaining_qty` / `remaining_value` realizan el seguimiento de las capas FIFO,
- `product.value` registra los cambios manuales de valor (precio estándar, precio del lote, valor del movimiento),
- `product.standard_price` es el coste actual.

### 3.2 Lista de verificación de la migración

- [ ] Sustituir las consultas a `stock.valuation.layer` por `stock.move.value`.
- [ ] Sustituir los informes basados en capas por lógica FIFO/AVCO basada en movimientos.
- [ ] Las sobrescrituras personalizadas de `_create_valuation_layer` deben reescribirse.
- [ ] Conciliar el valor del stock inicial y final después de la migración.

### 3.3 Prioridad de valoración

`_get_value_data` utiliza:

1. el `product.value` manual,
2. la factura de proveedor / factura,
3. el coste de producción,
4. el presupuesto (pedido de venta/pedido de compra),
5. las devoluciones,
6. el precio estándar,
7. los costes adicionales (costes en destino).

Fuente: `stock_account/models/stock_move.py:365-470`.

---

## 4. Tipo de producto: `consu` + `is_storable` [V19]

### 4.1 Qué ha cambiado

| Anterior | Nuevo |
|---|---|
| `type='product'` | `type='consu'`, `is_storable=True` |
| `type='consu'` | `type='consu'`, `is_storable=False` |
| `type='service'` | sin cambios |

`type` ahora admite `consu`, `service` y `combo`. El comportamiento de stock viene determinado por `is_storable`.

### 4.2 Lista de verificación de la migración

```python
# Old
if product.type == 'product':

# New
if product.is_storable:
```

- [ ] Sustituir todas las apariciones de `type == 'product'` / `type != 'product'`.
- [ ] Sustituir `type == 'consu'` si la intención era «almacenable».
- [ ] Actualizar los dominios en XML: `[('type','=','product')]`.
- [ ] Actualizar las acciones de servidor y los filtros.

**[WARNING]** `type == 'consu'` ahora es verdadero tanto para bienes almacenables como no almacenables. Un filtro que antes excluía los consumibles ahora los incluye.

---

## 5. Árbol de UdM [V19]

### 5.1 Qué ha cambiado

| Anterior | Nuevo |
|---|---|
| modelo `uom.category` | eliminado |
| `uom.uom.category_id` | eliminado |
| `uom.uom.factor` (relativo a la referencia de categoría) | calculado a partir del árbol |
| redondeo por categoría | `decimal.precision` global «Product Unit» |
| `uom.uom.rounding` almacenado | calculado |

Cada UdM tiene `relative_uom_id` y `relative_factor`; `factor` es el factor absoluto respecto a la raíz del árbol. La conversión recorre el árbol.

### 5.2 Lista de verificación de la migración

- [ ] Eliminar las referencias a `uom.category` / `category_id`.
- [ ] Recrear las jerarquías de UdM con `relative_uom_id`/`relative_factor`.
- [ ] Recalcular los factores de conversión; verificar los valores de `factor`.
- [ ] Probar las conversiones de compra/venta/stock entre UdM.
- [ ] Revisar los informes personalizados que unían por `uom_category`.

### 5.3 API de conversión

```python
qty_in_uom = uom_from._compute_quantity(qty, uom_to, rounding_method='HALF-UP')
```

o por producto:

```python
qty_product_uom = product.uom_id._compute_quantity(qty, product_uom)
```

**[WARNING]** `rounding` es global. Dos UdM ya no pueden tener un redondeo distinto; si el negocio lo necesita, se debe aplicar en código personalizado.

---

## 6. Estados de los documentos

### 6.1 Ventas

| Anterior | Nuevo |
|---|---|
| `state='done'` | `state='sale'` + `locked=True` |
| `action_done` | `action_lock` |
| `action_unlock` | `action_unlock` |

### 6.2 Compras

| Anterior | Nuevo |
|---|---|
| `state='done'` | sin estado «done»; usar `qty_received` / `invoice_status` |
| `action_done` | `button_approve` / validación de la recepción |

### 6.3 Fabricación

`mrp.production.state` se **calcula** a partir de los movimientos y las órdenes de trabajo. Se debe llegar a `state='done'` mediante `button_mark_done`, no escribiéndolo.

**Lista de verificación de la migración:**

- [ ] Buscar `state == 'done'` en el código personalizado y el XML de pedidos de venta y de compra.
- [ ] Sustituir por `locked` o comprobaciones de cantidad.
- [ ] Actualizar las decoraciones de kanban y lista.
- [ ] Actualizar las automatizaciones con filtros de estado.

---

## 7. Motor de impuestos [V19]

### 7.1 Qué ha cambiado

Odoo 19 utiliza funciones puras sobre diccionarios de líneas base:

```
_prepare_product_base_line_for_taxes_computation
_add_tax_details_in_base_lines
_round_base_lines_tax_details
_aggregate_base_lines_tax_details
_aggregate_base_lines_aggregated_values
```

Las funciones auxiliares heredadas (`_compute_taxes`, `_prepare_invoice_aggregated_taxes`) son adaptadores obsoletos o se han eliminado.

### 7.2 Lista de verificación de la migración

- [ ] Sustituir las sobrescrituras de `_compute_taxes` por `_get_tax_details` / la canalización de líneas base.
- [ ] Probar los impuestos incluidos en el precio, fijos y de reparto.
- [ ] Probar la base de caja y el redondeo global.
- [ ] Verificar las etiquetas de los informes de impuestos.

Fuente: `account/models/account_tax.py:1137`, `:4972`.

---

## 8. Cambios en la API del ORM

### 8.1 Eliminado/obsoleto

| API | Estado | Sustituto |
|---|---|---|
| `name_get()` | eliminado | `display_name`, `_compute_display_name` |
| `api.one` | eliminado | iterar sobre `self` |
| `api.multi` | eliminado | comportamiento predeterminado del conjunto de registros |
| `read_group` | obsoleto (19) | `_read_group`, `formatted_read_group` |
| `check_access_rights` | obsoleto (18) | `check_access` |
| `check_access_rule` | obsoleto (18) | `check_access` |
| `_filter_access_rules` | obsoleto (18) | `_filtered_access` |
| `toggle_active` | obsoleto (19) | `action_archive` / `action_unarchive` |
| `request.cr` / `request.uid` / `request.context` | obsoleto (19) | `request.env.cr`, etc. |
| `create_unique_index` | obsoleto (19) | `create_index(unique=True)` |
| `_filter_access_rules_python` | obsoleto (18) | `_filtered_access` |

### 8.2 Firma de `create()`

`create()` ahora exige una lista o tupla (`orm/models.py:4611`). El decorador `@api.model_create_multi` proporciona compatibilidad hacia atrás con un único diccionario, pero sobrescribir `create(self, vals)` sin él rompe las llamadas por lotes.

```python
@api.model_create_multi
def create(self, vals_list):
    records = super().create(vals_list)
    ...
    return records
```

### 8.3 Clase Domain

`Domain` es ahora un objeto de primera clase (`orm/domains.py:196`). Las funciones auxiliares de SQL personalizadas deben aceptar `Domain` y usar `.to_sql()`/`_to_sql()` en lugar de manipular cadenas. La función heredada `_where_calc` está obsoleta en favor de `Domain.custom`.

### 8.4 `read_group` → `_read_group`

```python
# Old
env['sale.order'].read_group(domain, ['amount_total:sum'], ['partner_id'])

# New
env['sale.order']._read_group(domain, ['partner_id'], ['amount_total:sum'])
```

La forma de retorno es distinta: `_read_group` devuelve tuplas, no diccionarios.

---

## 9. Cambios en campos y atributos

| Cambio | Impacto |
|---|---|
| `group_operator` → `aggregator` | los campos personalizados que usan `group_operator` emiten una advertencia |
| `tracking` acepta un entero (secuencia) | `tracking=True` sigue funcionando |
| atributo `precompute` | los cálculos almacenados se pueden precalcular al crear |
| `index='btree_not_null'` | índice parcial; sustituye algunos `index=True` |
| `index='trigram'` | GIN trigram para búsqueda de texto |
| `models.Constraint` / `models.Index` | objetos de tabla declarativos |
| `_depends` en vistas SQL | obligatorio para los modelos con `_table_query` |

---

## 10. Cambios en el frontend

- OWL 2 es el valor predeterminado; las API de widgets heredadas ya no existen.
- Los bundles de `web.assets_backend` sustituyen a las claves `js`/`css` del manifiesto.
- La vista de lista es la predeterminada (la vista de árbol se ha renombrado a lista en la interfaz y en el código).
- Las modificaciones de `web_studio` se almacenan como datos; no sobreviven a la actualización de un módulo si la vista subyacente cambia.
- El frontend del TPV se basa en OWL; los widgets antiguos del TPV se han eliminado.

---

## 11. Matriz de compatibilidad para módulos personalizados

| Versión de destino del módulo | ¿Funciona en 19? | Acción |
|---|---|---|
| 19.0 | sí | — |
| 18.0 | en su mayor parte, con rupturas | auditar la tabla anterior |
| 17.0 | poco probable | portar el ORM y el frontend |
| 16.0 | no | reescribir |
| 15.0 o anterior | no | reescribir |

### 11.1 Orden de portado

1. `version` del manifiesto → `19.0.x.y.z`,
2. sustituir los modelos y campos eliminados,
3. corregir las firmas de `create`/`write`,
4. sustituir las API obsoletas,
5. actualizar las vistas (lista/árbol, anclas xpath),
6. actualizar los assets y OWL,
7. ejecutar las pruebas,
8. scripts de migración de datos.

---

## 12. Probar el portado

- [ ] Instalar en una base de datos 19 limpia.
- [ ] Instalar en una copia de producción (con datos).
- [ ] Ejecutar las pruebas del módulo.
- [ ] Ejecutar los flujos de negocio clave.
- [ ] Comprobar en `ir.model.fields` si hay referencias a campos obsoletos.
- [ ] Comprobar que las vistas se cargan (validación de `ir.ui.view`).
- [ ] Comprobar los trabajos cron y las automatizaciones.
- [ ] Comparar los informes antes y después.

---

## 13. Índice de evidencia

| Tema | Archivo |
|---|---|
| `stock.reference` | `addons/stock/models/stock_reference.py` |
| Valoración | `addons/stock_account/models/stock_move.py:193-470` |
| Tipo de producto | `addons/product/models/product_template.py:54-62` |
| Árbol de UdM | `addons/uom/models/uom_uom.py:18-100` |
| Estados de venta | `addons/sale/models/sale_order.py:26-31` |
| Estados de compra | `addons/purchase/models/purchase_order.py:105-116` |
| Motor de impuestos | `addons/account/models/account_tax.py:1137`, `4972` |
| Obsoletos del ORM | `orm/models.py:2748`, `4161-4190`, `5789` |
| Clase Domain | `orm/domains.py:196` |

Continuar con el volumen 5: límites del alcance del ERP.
