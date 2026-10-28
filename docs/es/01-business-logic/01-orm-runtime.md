# Capa de lógica de negocio I — Ejecución del ORM y semántica de modelos

> **Versión.** Odoo 19.0 Enterprise. Las anclas del código fuente están en `odoo/orm/` salvo que se indique lo contrario.
> **Audiencia.** Desarrolladores de backend que sobrescribirán el comportamiento del núcleo y necesitan razonar sobre caché, recálculo, acceso y SQL.

---

## 1. El modelo mental

El ORM de Odoo no es un mapeador de datos pasivo. Es un **entorno de ejecución de tipo active record** con:

- semántica de conjuntos de registros (cada operación se procesa por lotes sobre N registros),
- un mapa de identidad transaccional (la caché de campos),
- recálculo incremental dirigido por dependencias,
- generación implícita de SQL con prefetch,
- seguridad aplicada en el momento de construir la consulta,
- clases de modelo ensambladas a partir de fragmentos de módulos en el momento de construir el registro.

Por lo tanto, una llamada a un método como `order.action_confirm()` no es una simple llamada a función. Puede:

1. validar ACL y reglas de registro,
2. leer y escribir entradas de caché,
3. marcar campos dependientes para recálculo,
4. volcar a SQL las escrituras pendientes,
5. ejecutar varias sentencias `UPDATE`/`INSERT`,
6. disparar el seguimiento de `mail.thread` y las notificaciones del bus,
7. confirmar o revertir toda la transacción de la petición.

Comprender esa canalización es la diferencia entre una personalización mantenible y un error latente de corrupción de datos.

---

## 2. Conjuntos de registros

### 2.1 Representación

```python
class BaseModel:
    __slots__ = ['env', '_ids', '_prefetch_ids']
```

Un conjunto de registros es una colección ordenada e inmutable de ids de un modelo, que comparte un entorno. `record` es un conjunto de registros de longitud 1. Las operaciones devuelven conjuntos de registros **nuevos**; nunca modifican el receptor in situ.

```python
orders = env['sale.order'].search([('state', '=', 'sale')])
one = orders[0]                 # new recordset, same env, prefetch ids
subset = orders.filtered(lambda o: o.amount_total > 1000)
```

### 2.2 Álgebra de conjuntos

| Operación | Semántica | SQL |
|---|---|---|
| `a | b` | unión, preserva el orden | ninguna |
| `a & b` | intersección | ninguna |
| `a - b` | diferencia | ninguna |
| `a.exists()` | conserva los ids presentes en la BD | una consulta |
| `a.filtered_domain(domain)` | filtra en SQL | una consulta |
| `a.filtered(func)` | filtra en Python | puede leer campos |
| `a.sorted(key=...)` | ordena en Python | puede leer campos |
| `a.mapped('field')` | proyecta el campo | lectura por lotes |

**[WARNING]** `filtered()` y `sorted()` sobre un conjunto de registros grande cargan los campos de todos los registros en la caché. Preferir `search()` con un dominio o `filtered_domain()`.

### 2.3 Prefetch

Cuando se lee un campo en un conjunto de registros, el ORM obtiene ese campo para el **conjunto de prefetch completo** en una sola consulta. El conjunto de prefetch suele ser el conjunto de registros utilizado para obtener el registro, no el registro en sí.

```python
for order in orders:          # orders has 1000 ids
    print(order.partner_id.name)   # 1 query for partner_id, 1 for names
```

Pero:

```python
for order in orders:
    partner = order.partner_id        # prefetch set = order ids
    print(partner.name)               # partner records have their own prefetch set
```

`with_prefetch(ids)` cambia el conjunto de prefetch. `with_context(prefetch_fields=False)` deshabilita el prefetch de campos. `search_fetch()` y `fetch()` permiten un control explícito.

Fuente: `orm/models.py:3754` (`_fetch_field`), `orm/models.py:3775` (`fetch`), `orm/models.py:5871` (`__init__`).

**[WARNING]** El prefetch es una optimización de rendimiento con un coste de memoria. Obtener un conjunto de 100 000 registros con un campo binario puede agotar la memoria del worker. Usar `search(..., limit=...)` y `fetch()` explícito.

### 2.4 Registros nuevos (`NewId`)

`env['model'].new(vals)` crea un registro en memoria con un `NewId` (un objeto similar a un entero negativo). Lo usan onchange, los asistentes y el precálculo. Los registros nuevos:

- no están en la base de datos,
- se pueden escribir y leer desde la caché,
- no se pueden buscar,
- se convierten en registros reales mediante `create()`.

**[INVARIANT]** Nunca se debe almacenar un `NewId` en un campo relacional ni en la base de datos. Fallará o se descartará silenciosamente.

---

## 3. Los campos en profundidad

### 3.1 Construcción y atributos de campos

La declaración de un campo es un atributo de clase. Durante la configuración del registro, el campo se vincula a su modelo, su inverso, su método de cálculo y sus dependencias. Los valores predeterminados aplicados por `_get_attrs` (`orm/fields.py:414`) son importantes:

| Declaración | Valores predeterminados que sorprenden a los desarrolladores |
|---|---|
| `compute=...` | `store=False`, `compute_sudo=store`, `readonly=not inverse`, `copy=False` |
| `related=...` | `store=False`, `compute_sudo=True`, `readonly=True`, `copy=False` |
| `company_dependent=True` | `index='btree_not_null'`, `prefetch='company_dependent'`, depende de `company` |
| `translate=True` | tipo de columna `jsonb`; solo se admite índice trigram |
| `Many2one` | `ondelete='set null'` por defecto; `index=True` **no** es automático |
| `One2many` | sin columna; el campo inverso debe existir |
| `Many2many` | tabla de relación implícita; `ondelete='cascade'` para el lado origen |
| `state` | `copy=False` por defecto |
| `active` | habilita el filtrado `active_test` por defecto |

### 3.2 Almacenado frente a no almacenado

| | Almacenado | No almacenado |
|---|---|---|
| Persistido | sí | no |
| Buscable | sí | solo con `search=` |
| Ordenable/agrupable | sí | no |
| En reglas de registro | sí | solo mediante SQL personalizado |
| Recalculado | al cambiar una dependencia | al acceder |
| Caché | transaccional, se vuelca | transaccional, se descarta al final |
| Migración | columna | ninguna |

**[INVARIANT]** No se debe añadir un campo calculado no almacenado a un `_order`, un dominio, un `groupby` ni una regla de registro. Fallará en tiempo de ejecución o producirá SQL incorrecto.

### 3.3 Métodos de cálculo

```python
@api.depends('order_line.price_total')
def _compute_amount_total(self):
    for order in self:
        order.amount_total = sum(order.order_line.mapped('price_total'))
```

Reglas:

- El método recibe `self` como un conjunto de registros; se asigna a cada registro, no se devuelve un valor.
- `@api.depends` debe listar **todos** los campos leídos, incluidos los campos de modelos relacionados (`partner_id.country_id.code`).
- Se permiten dependencias sobre campos no almacenados; el ORM sigue la cadena.
- `@api.depends_context('lang', 'company')` crea entradas de caché separadas; esos campos no se pueden almacenar.
- `compute_sudo=True` (valor predeterminado para los cálculos almacenados) evalúa como superusuario. Esto puede filtrar datos si el valor calculado incorpora campos restringidos. Establecer `compute_sudo=False` cuando el resultado deba respetar el acceso del usuario.
- Un método de cálculo debe ser **idempotente** y no debe depender del orden de iteración.

**[WARNING]** `@api.depends` sobre una ruta de campo relacionado no invalida automáticamente cuando el registro intermedio se vuelve a vincular, a menos que el propio campo relacional esté en la lista de dependencias. Ejemplo: `@api.depends('partner_id.name')` sí invalida cuando cambia `partner_id`, porque el ORM trata la ruta como dependiente de `partner_id` y `name`.

### 3.4 Métodos inversos

Un inverso se ejecuta cuando se escribe un campo calculado:

```python
def _inverse_total(self):
    for record in self:
        record.line_ids = ...  # write the underlying data
```

Los métodos inversos son la forma en que funcionan los campos calculados editables (p. ej., `sale.order.line.price_unit`, `account.move.line.debit`). Se ejecutan dentro de `env.protecting(...)` para que el campo calculado no se recalcule inmediatamente sobre el valor que se está estableciendo.

### 3.5 Campos relacionados

```python
partner_country = fields.Many2one(related='partner_id.country_id', store=True)
```

- Los campos relacionados no almacenados se calculan al acceder con `related_sudo=True` por defecto. Esto significa que un usuario puede leer un campo de un registro al que no tiene acceso, si la cadena de relación cruza modelos.
- Los campos relacionados almacenados añaden una columna y una cadena de dependencias. Las cadenas profundas (`a.b.c.d`) multiplican el coste de recálculo.
- Se requiere `related_sudo=False` cuando el valor relacionado debe respetar las reglas de registro.

**[WARNING]** Un campo relacionado almacenado que apunta a un campo no almacenado es legal, pero fuerza un recálculo de toda la cadena de dependencias cada vez que cambia el destino. Evitarlo en modelos de alto volumen.

### 3.6 Campos dependientes de la compañía

```python
property_account_income_id = fields.Many2one(
    'account.account', company_dependent=True, check_company=True)
```

Almacenamiento: columna `jsonb` indexada por id de compañía. La ruta de lectura usa `env.company` (no `env.companies`). La ruta de escritura escribe la clave de la compañía actual. La búsqueda usa `->company_id` con repliegue al valor predeterminado.

Fuente: `orm/fields.py:1215` (`_get_company_dependent`), `orm/fields.py:781` (`column_type`).

**[INVARIANT]** Los campos dependientes de la compañía no pueden ser `required`, no pueden traducirse y no se copian por defecto. Los informes SQL deben unir por la clave de compañía; un `SELECT column` ingenuo devuelve JSON, no el valor.

### 3.7 Campos traducidos

Almacenamiento: `jsonb` `{"en_US": "...", "fr_FR": "..."}`. El ORM devuelve el valor para `env.lang`, recurriendo a `en_US` si no existe. Las escrituras actualizan solo el idioma actual, a menos que `translate=True` se gestione explícitamente.

```python
product.with_context(lang='fr_FR').name = "Chaise"
```

El SQL debe usar `->>'fr_FR'`. Los índices sobre campos traducidos son índices trigram sobre todos los idiomas (`orm/registry.py` `check_indexes`).

### 3.8 Campos binarios

- `attachment=True`: se almacena en el filestore, referenciado por `ir.attachment`.
- `attachment=False`: se almacena en la columna (bytea), se carga con el registro.
- El contexto `bin_size=True` devuelve un tamaño legible en lugar de los bytes para las vistas de lista.
- Los binarios grandes en un conjunto de registros con prefetch pueden agotar la memoria.

---

## 4. Funcionamiento interno de CRUD

### 4.1 `create()`

Flujo (`orm/models.py:4611`):

1. `check_access('create')` sobre el modelo vacío (comprobación de ACL).
2. Valida cada nombre de campo proporcionado y el acceso a nivel de campo.
3. `_prepare_create_values()`: añade valores predeterminados, elimina campos mágicos, añade campos de registro y precalcula campos.
4. Para `_inherits`: crea o actualiza primero los registros padre.
5. `_create()`: `INSERT ... RETURNING id` por lotes (tamaño de lote `INSERT_BATCH_SIZE`).
6. Protege los campos calculados y ejecuta los métodos inversos para las escrituras no almacenadas.
7. Valida las restricciones de Python en los campos almacenados e invertidos.
8. `_check_company()` si `_check_company_auto`.
9. Devuelve el nuevo conjunto de registros.

Detalles críticos:

- Los valores predeterminados se calculan **antes** de la inserción y pueden depender del contexto (claves `default_*`).
- `@api.model_create_multi` es obligatorio; sobrescribir `create(self, vals)` con un diccionario rompe a los llamadores por lotes.
- `create()` puede desencadenar escrituras en otros modelos mediante cálculos, inversos y `_inherits`. Una «inserción simple» rara vez es una sola sentencia SQL.
- `_check_company_auto` valida los campos relacionales con `check_company=True`, pero solo para los campos presentes en `vals` (y los campos calculados después de crear).

### 4.2 `write()`

Flujo (`orm/models.py:4334`):

1. `check_access('write')`.
2. Valida los nombres de campos y el acceso de escritura a nivel de campo.
3. Protege los campos que son calculados y se están invirtiendo.
4. Trata de forma especial los campos relacionales: llama a `modified(..., before=True)` **antes** de escribir y luego a `modified(...)` después, para recalcular tanto los padres antiguos como los nuevos.
5. Escribe los campos en el orden de `write_sequence` (monetarios antes que moneda, x2many al final).
6. Ejecuta los métodos inversos.
7. Valida las restricciones.
8. `_check_company()`.

**[WARNING]** Escribir un campo relacional (especialmente `one2many`) puede eliminar registros (`Command.delete`), crear registros (`Command.create`) o reasignarlos. `write()` no es una actualización superficial.

### 4.3 `unlink()`

Flujo (`orm/models.py:4194`):

1. `check_access('unlink')`.
2. Comprueba las referencias de `ir.model.data` y las políticas `ondelete`.
3. Ejecuta las sobrescrituras de `unlink` (pueden lanzar `UserError`).
4. Elimina filas por lotes; aplica cascada a nivel de SQL donde esté configurado.
5. Invalida toda la caché (`env.invalidate_all(flush=False)`) porque las cascadas no son seguidas por el ORM.

**[INVARIANT]** Nunca se debe asumir que el ORM sabe qué se eliminó en cascada. Después de `unlink()`, todo conjunto de registros que contenga ids eliminados debe llamar a `exists()` o descartarse. Un conjunto de registros obsoleto lanza `MissingError` al acceder.

### 4.4 `read()` / `search_read()`

`read()` devuelve una lista de diccionarios; es la representación apta para RPC. `search_read()` combina búsqueda y lectura en un solo viaje, pero sigue ejecutando dos consultas (ids y luego campos), a menos que el ORM pueda combinarlas. Preferir `search_fetch()` internamente y `read()` en el límite de RPC.

### 4.5 `search()`

`search(domain, offset, limit, order)` construye SQL mediante `_search()` (`orm/models.py:5324`):

- aplica `active_test` a menos que esté deshabilitado,
- inyecta las reglas de registro (`ir.rule._compute_domain`),
- traduce los dominios a joins/subconsultas,
- aplica `_order` si no se proporciona un orden,
- devuelve un conjunto de registros; **no** obtiene los campos.

`search_count()` usa el mismo flujo con `COUNT(*)`. En tablas grandes, un recuento sobre un dominio complejo puede ser más lento que obtener los ids; almacenar los recuentos en caché o usar `estimated_count` cuando sea aceptable.

---

## 5. Dominios y generación de SQL

### 5.1 AST de dominios

Odoo 19 usa un objeto `Domain` tipado (`orm/domains.py:196`) en lugar de listas sin procesar. Admite:

- composición lógica: `Domain.AND([...])`, `Domain.OR([...])`, `~domain`,
- condiciones de campo: `Domain('field', '=', value)`,
- recorrido relacional: `Domain('partner_id.country_id.code', '=', 'BE')`,
- optimizaciones: `domain.optimize(model)` pliega constantes y simplifica.

### 5.2 Operadores y su SQL

| Operador | Semántica | Notas |
|---|---|---|
| `=` | igualdad | `False` se convierte en `IS NULL` para many2one |
| `!=` | desigualdad | incluye NULL en algunos casos; comprobar explícitamente |
| `>`, `>=`, `<`, `<=` | comparación | las fechas se comparan como timestamps |
| `in`, `not in` | pertenencia a un conjunto | `IN` limitado a 1000 ids por consulta (`IN_MAX`) |
| `like`, `ilike` | patrón | `ilike` usa `unaccent` + trigram cuando están disponibles |
| `=like`, `=ilike` | patrón exacto | sin `%...%` implícito |
| `child_of` | jerarquía | usa `parent_path` cuando `_parent_store=True` |
| `parent_of` | jerarquía inversa | igual |
| `any`, `not any` | existencia en x2many | subconsulta correlacionada |
| `=?` | igualdad o nulo | dependiente del contexto |

**[WARNING]** `!=` sobre una columna que admite nulos **no** devuelve las filas en las que la columna es NULL en SQL. El compilador de dominios de Odoo a veces lo reescribe, pero no se debe confiar en ello; añadir explícitamente `| ('field', '=', False)`.

### 5.3 Trampas de `_order`

`_order = 'date_order desc, id desc'` se inyecta en cada búsqueda sin un orden explícito. Reglas:

- cada campo de `_order` debe ser una columna almacenada,
- los campos traducidos necesitan `->>'lang'` y no se pueden usar directamente,
- un orden no determinista (sin un desempate único) provoca duplicados u omisiones en la paginación; terminar siempre con `id`.

---

## 6. Contexto, compañía e idioma

### 6.1 Claves de contexto que cambian el comportamiento

| Clave | Efecto |
|---|---|
| `lang` | traducción y formato de fechas |
| `tz` | zona horaria para fechas y horas sin zona en la interfaz |
| `allowed_company_ids` | compañías visibles para las reglas de registro y `env.companies` |
| `company_id` / `force_company` | compañía seleccionada en algunos flujos |
| `active_test` | incluye registros archivados |
| `default_*` | valores predeterminados para `create()` |
| `bin_size` | devuelve el tamaño binario en lugar del contenido |
| `prefetch_fields` | habilita/deshabilita el prefetch |
| `tracking_disable` | omite el seguimiento de correo |
| `mail_create_nolog` | omite el registro de creación |
| `no_reset_password` | creación de portal/usuario |
| `import_file` | comportamiento del modo de importación |
| `install_mode` | comportamiento de instalación/actualización de módulos |

**[WARNING]** El usuario puede influir en el contexto a través de RPC. Nunca se debe usar una clave de contexto como decisión de autorización (`if env.context.get('is_admin')`). Usar grupos y reglas de registro.

### 6.2 Multicompañía

- `env.company` es la compañía activa (de `allowed_company_ids[0]` o la predeterminada del usuario).
- `env.companies` es el conjunto de registros de compañías permitidas.
- Las reglas de registro suelen usar `['|', ('company_id', '=', False), ('company_id', 'in', company_ids)]`.
- Los campos dependientes de la compañía se resuelven contra `env.company`.
- `with_company(company)` cambia tanto `company` como el conjunto permitido a esa compañía.

**[INVARIANT]** Un registro de la compañía A nunca debe vincularse a un registro de la compañía B, a menos que la relación sea explícitamente `check_company=False`. `_check_company` solo lo aplica en los campos declarados.

### 6.3 Idioma

- `env.lang` proviene del contexto o de la preferencia del usuario.
- `_()` traduce en tiempo de ejecución usando el idioma actual.
- Los campos traducidos almacenados devuelven el idioma actual; al escribir solo se establece ese idioma.
- `env['ir.translation']` es heredado; ahora las traducciones residen en columnas JSONB y archivos `.po`.

---

## 7. Semántica de la herencia

### 7.1 Tres mecanismos

| Mecanismo | Sintaxis | Almacenamiento | Uso |
|---|---|---|---|
| Herencia clásica de Python | `_inherit = 'model'` (sin `_name`) | misma tabla | extiende comportamiento/campos in situ |
| Herencia de prototipo | `_name = 'new'`, `_inherit = 'base'` | tabla nueva + copia de campos | crear un modelo especializado |
| Delegación | `_inherits = {'base': 'base_id'}` | tabla nueva + FK; campos del padre delegados | composición; evitar salvo que sea necesario |

### 7.2 `_inherit` sin `_name`

- La clase de modelo se reconstruye con la nueva definición insertada en el MRO.
- Los campos declarados en la extensión se añaden a la misma tabla.
- Los métodos se sobrescriben por nombre; `super()` llama a la definición anterior.
- `_inherit` puede ser una lista: `_inherit = ['mail.thread', 'portal.mixin']` incorpora varios modelos.

### 7.3 `_inherit` con `_name`

- Crea un modelo y una tabla nuevos.
- Copia las definiciones de campos del padre (**no** los datos).
- Los métodos se heredan; `super()` funciona.
- El nuevo modelo **no** es un subtipo en SQL; las consultas sobre el padre no ven las filas del hijo.

### 7.4 `_inherits`

```python
class IrCron(models.Model):
    _name = 'ir.cron'
    _inherits = {'ir.actions.server': 'ir_actions_server_id'}
    ir_actions_server_id = fields.Many2one('ir.actions.server', required=True, ondelete='cascade', delegate=True)
```

- La tabla hija solo almacena la FK y sus propios campos.
- Los campos del padre se exponen como campos relacionados (`inherited=True`), con lectura/escritura a través de la FK.
- Al crear un hijo, se crea primero el padre.
- Al eliminar un hijo, la cascada sigue `ondelete`.
- Las colisiones de nombres de campo se resuelven a favor del **último** padre en el orden de `_inherits`.

**[WARNING]** `_inherits` convierte `create()` y `write()` en operaciones multitabla. También hace sutiles las reglas de registro: las reglas sobre el hijo no se aplican automáticamente al padre, ni viceversa. Usarlo solo donde la composición sea genuinamente 1:1 (p. ej., `ir.cron` → `ir.actions.server`).

### 7.5 MRO y `super()`

El MRO de la clase del registro se construye a partir de las definiciones de módulos en orden inverso de carga. Reglas prácticas:

- Llamar siempre a `super()` en las sobrescrituras, incluso si la base no hace nada, para preservar el comportamiento de otros módulos.
- `super().method()` usa el MRO de la **clase de la instancia**, que incluye todos los módulos instalados.
- Si un módulo no depende de otro módulo que sobrescribe el mismo método, no se puede predecir cuál se ejecuta primero. Declarar la dependencia si el orden importa.
- Usar `super(MyClass, self)` solo en código heredado; es frágil ante la reconstrucción del registro.

---

## 8. Control de acceso en el ORM

Hay cuatro puertas independientes:

1. **ACL de modelo** (`ir.model.access`): ¿puede este grupo crear/leer/escribir/eliminar este modelo en absoluto?
2. **Reglas de registro** (`ir.rule`): ¿qué filas puede ver/modificar este usuario?
3. **Grupos de campos** (`groups=` en un campo): ¿puede este grupo leer/escribir este campo?
4. **Grupos de menús/acciones**: ¿puede este usuario acceder a la interfaz en absoluto?

`check_access(operation)` comprueba 1 y 2. `_check_field_access(field, operation)` comprueba 3. `search()` inyecta 2 en SQL automáticamente. `browse()` **no** comprueba 2; leer un registro prohibido lanza `AccessError` al acceder a un campo.

**[INVARIANT]** `sudo()` omite 1, 2 y 3. No omite `_check_company` ni las restricciones de Python. Cada `sudo()` es una decisión de seguridad y debe justificarse en la revisión de código.

Fuente: `orm/models.py:4100` (`check_access`), `addons/base/models/ir_rule.py:113` (`_get_rules`), `addons/base/models/ir_model.py` (comprobaciones de ACL).

---

## 9. Reglas prácticas para métodos de negocio

### 9.1 Diseño de métodos

- Los métodos públicos (llamados por botones, RPC u otros módulos) deben aceptar conjuntos de registros y devolver valores/acciones simples.
- Los métodos privados (prefijo `_`) pueden asumir contexto y precondiciones.
- No poner reglas de negocio en las sobrescrituras de `create`/`write` cuando exista un método dedicado; las sobrescrituras también se ejecutan en importaciones, migraciones e integraciones.
- Preferir `@api.model_create_multi` para `create`.
- Usar `@api.ondelete(at_uninstall=False)` para bloquear la eliminación con un mensaje claro.

### 9.2 Idempotencia

Los botones se pueden pulsar dos veces, las llamadas RPC se pueden reintentar y los cron se pueden volver a ejecutar. Todo método público que cambie el estado debe ser idempotente o estar protegido:

```python
def action_confirm(self):
    for order in self:
        if order.state != 'draft':
            raise UserError(_("Only draft orders can be confirmed."))
    ...
```

### 9.3 Tipos de error

| Excepción | Significado | HTTP/RPC |
|---|---|---|
| `UserError` | violación de regla de negocio, visible para el usuario | 422 / carga de error |
| `ValidationError` | violación de restricción de datos | 422 |
| `AccessError` | violación de seguridad | 403 / carga de error |
| `MissingError` | registro eliminado o ausente | 404 |
| `RedirectWarning` | el usuario debe corregir algo en otro lugar | carga de acción |
| `except_orm` | alias heredado; no usar | — |

Nunca lanzar una `Exception` desnuda en código de negocio; se convierte en un 500 y pierde el mensaje para el usuario.

### 9.4 Transacciones en métodos de negocio

- No hacer commit.
- Usar puntos de guardado para trabajo opcional.
- Hacer flush antes de SQL directo.
- Diferir las llamadas externas a `postcommit`.
- Mantener los métodos cortos; las transacciones largas bloquean la asignación de secuencias y vacuum.

---

## 10. Lista de verificación de antipatrones

| Antipatrón | Por qué perjudica | Solución |
|---|---|---|
| `ensure_one()` en un bucle | rompe el procesamiento por lotes, lanza excepción con varios registros | vectorizar o iterar explícitamente |
| `search()` dentro de un bucle | consultas N+1 | una sola búsqueda con dominio `in` |
| `len(recordset)` en un bucle | recuento repetido | calcular una vez |
| `record.field` sobre un conjunto grande sin control de prefetch | explosión de memoria | usar `fetch()` de forma selectiva |
| `@api.depends` al que le falta un campo | valores obsoletos | auditar las dependencias |
| `sudo()` en todas partes | oculta errores de seguridad | limitarlo al mínimo |
| `cr.commit()` en código de modelo | commits parciales, reintentos rotos | eliminar |
| `write()` dentro de un cálculo | bucles infinitos de recálculo | usar inverso o `modified` con cuidado |
| Almacenar `NewId` | violación de FK | crear primero |
| `_order` sobre un campo no almacenado | error de SQL | usar un campo almacenado |
| Contexto como autorización | escalada de privilegios | grupos/reglas |
| Sobrescribir `create` con una firma de diccionario | rompe la importación por lotes | `@api.model_create_multi` |
| `unlink()` sin guardas `exists()` | `MissingError` | comprobar antes de acceder |
| SQL directo sin flush | lecturas obsoletas | usar `flush_model()` primero |
| Llamada a API externa dentro de la transacción | efectos secundarios duplicados al reintentar | postcommit + clave de idempotencia |

---

## 11. Índice de evidencias

| Tema | Archivo |
|---|---|
| Conjunto de registros, env, prefetch | `orm/models.py:362`, `5871` |
| Valores predeterminados y atributos de campos | `orm/fields.py:414` |
| Tipos de columna (jsonb para traducción/compañía) | `orm/fields.py:781` |
| SQL de campos dependientes de la compañía | `orm/fields.py:1215` |
| Flujo de create | `orm/models.py:4611`, `4849` |
| Flujo de write | `orm/models.py:4334`, `4520` |
| Flujo de unlink | `orm/models.py:4194` |
| AST de dominios | `orm/domains.py:196` |
| Ensamblaje de clases de modelo | `orm/model_classes.py:1-140`, `152` |
| Comprobaciones de acceso | `orm/models.py:4100`, `addons/base/models/ir_rule.py:113` |
| Ejecución de cálculos | `orm/models.py:4953` |
| Árbol de disparadores de recálculo | `orm/models.py:6756` |
| Punto fijo de flush | `orm/environments.py:380` |

Continuar con `02-transactions.md` para el modelo de transacciones y concurrencia.
