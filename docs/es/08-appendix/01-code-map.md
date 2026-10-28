# Apéndice A — Mapa del código fuente

> **Ruta base.** `source code/odoo-19.0+e.20260826/odoo/`. Utilizar este mapa para localizar el código que hay detrás de un comportamiento sin buscar a ciegas con grep.

---

## 1. Nivel superior

```
odoo/
├── __main__.py            # python -m odoo
├── init.py                # bootstrap
├── http.py                # WSGI/ASGI, Request, Response, dispatchers
├── sql_db.py              # cursor, connection pool, savepoints, callbacks
├── exceptions.py          # UserError, ValidationError, AccessError, ...
├── release.py             # version info
├── service/               # RPC service layer
├── orm/                   # ORM kernel
├── modules/               # module discovery, graph, loading, migration
├── fields/                # field type exports
├── models/                # model base exports
├── api/                   # API decorator exports
├── tools/                 # SQL, safe_eval, translate, profiler, misc
├── addons/                # 1,469 modules
└── tests/                 # framework tests
```

---

## 2. Núcleo del ORM

| Archivo | Contiene | Buscar aquí |
|---|---|---|
| `orm/models.py` | `BaseModel`, CRUD, búsqueda, dominios, acceso | create/write/unlink, `_search`, `check_access`, `modified` |
| `orm/fields.py` | `Field`, atributos, caché, cálculo | tipos de columna, `@api.depends`, related, dependiente de compañía |
| `orm/fields_relational.py` | many2one/one2many/many2many | tablas de relación, comandos x2many, caché |
| `orm/fields_textual.py` | char/text/html | almacenamiento de traducciones |
| `orm/fields_numeric.py` | int/float/monetary | redondeo, moneda |
| `orm/fields_temporal.py` | date/datetime | conversión de zona horaria |
| `orm/fields_selection.py` | selection | `selection_add`, valores |
| `orm/fields_reference.py` | reference | referencias dinámicas a modelos |
| `orm/fields_properties.py` | properties | campos de esquema JSONB |
| `orm/fields_binary.py` | binary/image | almacenamiento de adjuntos |
| `orm/models_transient.py` | `TransientModel` | asistentes, vacuum |
| `orm/model_classes.py` | ensamblado de clases del registro | MRO, `_inherit`, `_inherits` |
| `orm/registry.py` | registro, inicialización del esquema | `init_models`, índices, claves foráneas |
| `orm/environments.py` | `Environment`, `Transaction`, `Cache` | composición del entorno, flush, recálculo |
| `orm/domains.py` | `Domain` AST | operadores, generación de SQL |
| `orm/decorators.py` | `@api.*` | depends, constrains, onchange, ondelete |
| `orm/table_objects.py` | `Constraint`, `Index`, `UniqueIndex` | objetos SQL declarativos |
| `orm/utils.py` | comprobaciones de nombres, SUPERUSER_ID | identificadores |

---

## 3. HTTP y servicios

| Archivo | Contiene | Buscar aquí |
|---|---|---|
| `http.py` | `Request`, `Response`, dispatchers, enrutamiento | ciclo de vida de la petición, JSON-RPC, CSRF, sesiones |
| `service/model.py` | `retrying`, `call_kw` | reintento de transacciones, despacho de RPC |
| `service/common.py` | `EXP_WORKER_CLASS`, RPC común | |
| `service/db.py` | RPC de gestión de bases de datos | listar, crear y eliminar bases de datos |
| `service/security.py` | `check_super` | operaciones de administrador |
| `service/server.py` | servidores WSGI/ASGI, prefork | workers, gevent |
| `addons/base/models/ir_http.py` | hooks de enrutamiento y autenticación | `_match`, `_authenticate`, `_pre_dispatch` |
| `addons/base/models/ir_ui_view.py` | vistas | herencia, validación |
| `addons/base/models/ir_actions.py` | acciones | acciones de servidor, informes, ventanas |
| `addons/base/models/ir_cron.py` | cron | reclamación de tareas, progreso, reintentos |
| `addons/bus/models/bus.py` | bus | notificaciones, GC |

---

## 4. Módulos

| Archivo | Contiene | Buscar aquí |
|---|---|---|
| `modules/module.py` | `Manifest`, descubrimiento de módulos | claves del manifiesto, ruta de addons |
| `modules/module_graph.py` | grafo, fases, profundidad | orden de carga, dependencias |
| `modules/loading.py` | `load_modules`, `load_module_graph` | canalización de instalación y actualización |
| `modules/db.py` | inicialización de la base de datos, lista de módulos | `initialize`, `is_initialized` |
| `modules/migration.py` | `MigrationManager` | scripts de migración |
| `modules/neutralize.py` | neutralización | copias de bases de datos |
| `addons/base/models/ir_module.py` | modelo de módulo | botones de instalación y actualización, instalación automática |

---

## 5. Herramientas

| Archivo | Contiene | Buscar aquí |
|---|---|---|
| `tools/sql.py` | envoltorio SQL, DDL | creación de tablas, columnas e índices |
| `tools/safe_eval.py` | evaluación restringida | acciones de servidor, dominios |
| `tools/translate.py` | traducciones | `.po`, JSONB, `_()` |
| `tools/profiler.py` | perfilador | recopiladores de SQL y trazas |
| `tools/misc.py` | ayudantes, Callbacks | hooks antes y después del commit |
| `tools/float_utils.py` | comparación y redondeo de flotantes | precisión monetaria y de cantidades |
| `tools/date_utils.py` | ayudantes de fechas | zona horaria, rangos |
| `tools/config.py` | opciones de CLI | workers, límites, base de datos |

---

## 6. Módulos de negocio (archivos clave)

| Módulo | Archivos clave |
|---|---|
| `sale` | `models/sale_order.py`, `sale_order_line.py`, `wizard/sale_advance_payment_inv.py` |
| `sale_stock` | `models/sale_order.py`, `sale_order_line.py`, `stock_move.py` |
| `purchase` | `models/purchase_order.py`, `purchase_order_line.py` |
| `purchase_stock` | `models/purchase_order.py`, `purchase_order_line.py` |
| `stock` | `models/stock_move.py`, `stock_move_line.py`, `stock_picking.py`, `stock_quant.py`, `stock_rule.py`, `stock_location.py`, `stock_warehouse.py` |
| `stock_account` | `models/stock_move.py`, `product_value.py`, `product.py` |
| `account` | `models/account_move.py`, `account_move_line.py`, `account_tax.py`, `account_payment.py`, `sequence_mixin.py` |
| `account_asset` | `models/account_asset.py` |
| `account_reports` | `models/account_report.py`, `models/account.py`, `models/account_move_line.py` |
| `mrp` | `models/mrp_production.py`, `mrp_bom.py`, `mrp_workorder.py`, `mrp_workcenter.py` |
| `mrp_account` | `models/mrp_production.py` |
| `mrp_subcontracting` | `models/mrp_production.py`, `stock_picking.py` |
| `quality` | `models/quality.py` (`quality.point`, `quality.check`) |
| `crm` | `models/crm_lead.py`, `crm_stage.py` |
| `project` | `models/project_project.py`, `project_task.py` |
| `mail` | `models/mail_thread.py`, `mail_message.py`, `mail_template.py` |
| `base` | `models/res_partner.py`, `res_users.py`, `res_company.py`, `ir_rule.py`, `ir_model.py`, `ir_attachment.py` |
| `product` | `models/product_template.py`, `product_product.py`, `product_pricelist.py` |
| `uom` | `models/uom_uom.py` |

---

## 7. Localizar un comportamiento

```bash
# 1. find the model definition
grep -rn "_name = 'sale.order'" addons/ --include=*.py

# 2. find a method
grep -rn "def action_confirm" addons/sale --include=*.py

# 3. find overrides across modules
grep -rn "def _action_confirm" addons/ --include=*.py

# 4. find a field
grep -rn "invoice_status = fields" addons/sale --include=*.py

# 5. find XML data
grep -rn "view_order_form" addons/sale/views --include=*.xml

# 6. find a route
grep -rn "@http.route" addons/ --include=*.py | grep "/my/"
```

---

## 8. Lectura de un traceback

Los tracebacks de Odoo incluyen:

- el punto de entrada HTTP/RPC,
- el controlador,
- la cadena de métodos del modelo (con marcos de `super()`),
- las interioridades del ORM,
- la consulta SQL (si `--log-level=debug_sql`).

Consejos:

- leer de abajo arriba para la causa inmediata y de arriba abajo para el contexto de negocio;
- `UserError` es lógica de negocio esperada, no un error;
- `psycopg2.errors.*` indica restricciones o bloqueos de la base de datos;
- `MissingError` significa un conjunto de registros obsoleto tras un unlink;
- `AccessError` significa ACL o reglas, no un registro ausente.

---

## 9. Fijación de versiones

Registrar en cada proyecto:

```text
Odoo: 19.0+e.20260826
Commit: 7b5a3f53a824d86fe6cb4002637299813cd81881
Enterprise commit: 89c0ff24180571bc0e2df7d79f5d658f5a12dd3a
PostgreSQL: 16.x
Python: 3.12.x
```

Los números de línea de este manual corresponden a esta compilación. Los símbolos son estables; las líneas cambian de posición.

Continuar con `02-sql-cookbook.md`.
