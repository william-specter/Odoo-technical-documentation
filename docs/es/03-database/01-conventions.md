# Diseño de base de datos I — convenciones, generación de esquema y almacenamiento

> **Alcance.** Esquema físico de PostgreSQL producido por el ORM de Odoo 19. Es la fuente de verdad para administradores de bases de datos (DBA), autores de informes e ingenieros de migración.

---

## 1. Nomenclatura de tablas

| Regla | Ejemplo |
|---|---|
| Nombre del modelo con puntos → guiones bajos | `sale.order` → `sale_order` |
| Sobrescrituras explícitas de `_table` | `ir.actions.server` → `ir_act_server` |
| Tabla de relación many2many | `<table1>_<table2>_rel` (tablas ordenadas alfabéticamente) |
| Columnas de relación | `<table1>_id`, `<table2>_id` |
| Nombre de índice | `<table>__<column>_index` |
| Nombre de restricción | `<table>_<object_name>` |
| Modelo de vista SQL | `_auto = False`, `_table_query` |
| Longitud máxima del identificador | 63 bytes (PostgreSQL); Odoo lo valida |

Fuente: `orm/model_classes.py:266`, `orm/fields_relational.py:1291`, `tools/sql.py:783`, `orm/utils.py:97`.

**[WARNING]** Los prefijos de módulo largos junto con nombres de modelo largos pueden superar los 63 bytes. Odoo lanza `ValidationError` durante la construcción del registro; acorte el nombre del modelo o defina `_table` explícitamente.

### 1.1 Columnas mágicas

Todo modelo con `_auto=True` y `_log_access=True` tiene:

| Columna | Tipo | Significado |
|---|---|---|
| `id` | `SERIAL` / `INTEGER` | clave primaria |
| `create_uid` | `INTEGER` FK `res_users` | creador |
| `create_date` | `TIMESTAMP` | fecha de creación (UTC) |
| `write_uid` | `INTEGER` FK `res_users` | último modificador |
| `write_date` | `TIMESTAMP` | fecha de la última modificación (UTC) |

`_log_access=False` elimina las cuatro columnas de auditoría (se usa en tablas de log o transitorias de gran volumen). `_auto=False` elimina la tabla por completo.

Fuente: `orm/models.py:262-297`.

### 1.2 Columnas de metadatos del modelo

| Modelo | Tabla | Propósito |
|---|---|---|
| `ir_model` | `ir_model` | reflejo del registro de modelos |
| `ir_model_fields` | `ir_model_fields` | reflejo del registro de campos |
| `ir_model_data` | `ir_model_data` | XML IDs (`module`, `name`, `model`, `res_id`, `noupdate`) |
| `ir_model_constraint` | `ir_model_constraint` | restricciones SQL |
| `ir_model_relation` | `ir_model_relation` | metadatos de relación many2many |
| `ir_attachment` | `ir_attachment` | metadatos de archivo + referencia de almacenamiento |
| `ir_ui_view` | `ir_ui_view` | vistas (arch XML/HTML) |
| `ir_act_window` / `ir_act_server` | ... | acciones |
| `ir_rule` / `ir_model_access` | ... | seguridad |
| `ir_config_parameter` | `ir_config_parameter` | configuración clave/valor |

---

## 2. Tipos de columna

| Campo Odoo | Tipo PostgreSQL | Notas |
|---|---|---|
| `Char` | `VARCHAR` | sin límite salvo que se indique `size` |
| `Text` / `Html` | `TEXT` | el HTML se sanea al renderizarse, no al almacenarse |
| `Integer` | `INTEGER` | |
| `Float` | `DOUBLE PRECISION` / `NUMERIC` | dígitos/precisión según `decimal.precision` |
| `Monetary` | `NUMERIC` | la moneda está en un campo relacionado |
| `Boolean` | `BOOLEAN` | |
| `Date` | `DATE` | |
| `Datetime` | `TIMESTAMP` | se almacena en UTC y se muestra en la zona horaria del usuario |
| `Selection` | `VARCHAR` | valores validados en Python, no en la BD |
| `Many2one` | `INTEGER` + FK | política `ondelete` |
| `One2many` | sin columna | FK inversa en el hijo |
| `Many2many` | tabla de relación | PK compuesta, índice inverso |
| `Binary` | `BYTEA` o filestore | `attachment=True` → filestore |
| `Json` | `JSONB` | |
| `Properties` | `JSONB` | esquema almacenado en la definición |
| `Translate=True` | `JSONB` | `{lang: value}` |
| `Company-dependent` | `JSONB` | `{company_id: value}` |

### 2.1 Columnas traducidas

```sql
-- current language, fallback to en_US
SELECT COALESCE(name->>'fr_FR', name->>'en_US') FROM product_template;

-- all translations
SELECT name FROM product_template;
```

El ORM de Odoo usa `->>'lang'` para las lecturas y la fusión de `jsonb` para las escrituras. Los índices sobre columnas traducidas son índices GIN de trigramas sobre todos los valores.

### 2.2 Columnas dependientes de compañía

```sql
-- value for company 2, fallback to default if absent
SELECT COALESCE(property_account_income_id->'2', 'null'::jsonb)
FROM product_category;
```

La columna almacena JSONB incluso para campos numéricos o booleanos. Se requieren conversiones de tipo:

```sql
SELECT (property_account_income_id->>'2')::int FROM product_category;
```

---

## 3. Claves primarias, claves externas y restricciones

### 3.1 Claves primarias

- Siempre `id SERIAL PRIMARY KEY`.
- No hay PK compuestas salvo en las tablas de relación many2many.
- No se usan UUID de forma predeterminada; los sistemas externos deben usar `ir.model.data` o una clave de negocio única.

### 3.2 Claves externas

Se crean para:

- campos `Many2one` (salvo que `_auto=False` o que el destino sea una vista SQL),
- columnas de relación `Many2many` (ambas direcciones),
- campos delegados de `_inherits`.

Valores de `ondelete`:

| Valor | SQL | Efecto |
|---|---|---|
| `cascade` | `ON DELETE CASCADE` | elimina los hijos |
| `restrict` | `ON DELETE RESTRICT` | bloquea la eliminación del padre |
| `set null` | `ON DELETE SET NULL` | pone la FK a NULL |
| `set default` | `ON DELETE SET DEFAULT` | valor predeterminado |

El valor predeterminado para `Many2one` es `set null`. Para los campos obligatorios, use `restrict` o `cascade` de forma explícita.

### 3.3 Restricciones SQL

```python
_sql_constraints = [
    ('code_uniq', 'UNIQUE(code)', 'Code must be unique'),
]
```

o la forma declarativa de la v19:

```python
_code_uniq = models.Constraint('UNIQUE(code)', 'Code must be unique')
```

Los nombres de las restricciones llevan el prefijo de la tabla: `sale_order_code_uniq`. Se reflejan en `ir_model_constraint`.

### 3.4 Restricciones CHECK

```python
_check_positive = models.Constraint('CHECK(amount >= 0)', 'Amount must be positive')
```

Se usan para invariantes que deben mantenerse incluso con SQL directo o importaciones. No se debe duplicar cada restricción de Python; reserve SQL para la integridad de datos que deba sobrevivir a los accesos directos.

---

## 4. Tablas de relación many2many

Implícita:

```
sale_order_sale_order_line_rel
├── sale_order_id INTEGER NOT NULL
├── sale_order_line_id INTEGER NOT NULL
├── PRIMARY KEY (sale_order_id, sale_order_line_id)
└── INDEX (sale_order_line_id, sale_order_id)
```

Explícita:

```python
tag_ids = fields.Many2many(
    'res.partner.category',
    relation='my_model_tag_rel',
    column1='my_model_id',
    column2='tag_id',
    ondelete='cascade',
)
```

Reglas:

- El nombre de la tabla debe ser único por relación; dos campos no pueden compartirla salvo que se permita explícitamente.
- La columna de origen es `<model_table>_id` y la de destino `<comodel_table>_id` de forma predeterminada.
- El índice inverso es fundamental para las uniones desde el lado del destino.
- `ondelete='cascade'` en la columna de destino es el valor predeterminado; se permite `restrict`.

Fuente: `orm/fields_relational.py:1270-1375`.

---

## 5. Esquemas de herencia

### 5.1 `_inherit` (mismo modelo)

No se crea una tabla nueva. Los campos nuevos se añaden como columnas a la tabla existente. Un módulo que añade un campo a `res.partner` ejecuta `ALTER TABLE res_partner ADD COLUMN ...`.

### 5.2 `_name` + `_inherit` (prototipo)

Nueva tabla con:

- todos los campos copiados del padre (columnas),
- una PK `id`,
- ninguna FK hacia la tabla padre,
- métodos heredados mediante el MRO de Python.

No hay consultas polimórficas entre padre e hijo; se debe consultar cada tabla.

### 5.3 `_inherits` (delegación)

La tabla hija contiene:

- una PK `id`,
- una columna delegada `Many2one` obligatoria (p. ej. `ir_actions_server_id`),
- solo las columnas específicas del hijo.

Los campos del padre **no** se duplican; son campos relacionados que se resuelven a través de la FK. `create()` crea primero el padre y después el hijo. `unlink()` aplica la cascada según el `ondelete` del delegado.

```
ir_cron
├── id
├── ir_actions_server_id → ir_act_server.id (required, cascade)
├── cron_name
├── interval_number
└── ...
```

**[WARNING]** `_inherits` con varios padres y nombres de campo solapados se resuelve con el último padre en el orden del diccionario. Documente el orden; es una fuente de errores silenciosos.

### 5.4 Modelos de vista SQL

```python
class MyReport(models.Model):
    _name = 'my.report'
    _auto = False
    _table_query = "SELECT id, name FROM res_partner WHERE active"
```

- No hay tabla física; `_table_sql` envuelve la consulta como una subconsulta.
- Las lecturas y búsquedas funcionan; las escrituras no, salvo que la vista sea actualizable.
- `_depends` declara los campos que se deben volcar antes de consultar.
- `ir.model` sigue reflejando el modelo; `_auto=False` es visible en la interfaz de usuario.

Fuente: `orm/models.py:493` (`_table_sql`), `addons/test_orm/models/test_orm.py:2483`.

---

## 6. Convenciones de indexación

### 6.1 Índices declarados

```python
name = fields.Char(index=True)                 # btree
code = fields.Char(index='trigram')            # GIN trigram
ref = fields.Char(index='btree_not_null')      # partial btree WHERE not null
```

Reglas:

- Los campos `Many2one` **no** se indexan automáticamente (salvo algunos campos del sistema). Añada `index=True` para las FK que se filtran con frecuencia.
- Los campos `Selection`/`state` suelen estar indexados; PostgreSQL puede no usar índices de baja cardinalidad a menos que se combinen.
- Los campos de `_order` deben indexarse si se usan para la paginación.
- `translate=True` solo admite índices de trigramas; un btree simple se ignora con una advertencia.
- `company_dependent` usa `btree_not_null` de forma predeterminada.

Fuente: `orm/registry.py:829-900`.

### 6.2 Nomenclatura y gestión de índices

`make_index_name(table, column)` → `<table>__<column>_index`. Odoo crea los índices que faltan y elimina los obsoletos durante `init_models`. **No** crea índices compuestos de forma automática.

### 6.3 Índices compuestos

¿Añadir mediante `models.Constraint`? No: use `tools.sql.create_index` en `init()` o en una migración:

```python
def init(self):
    self.env.cr.execute("""
        CREATE INDEX IF NOT EXISTS stock_move__product_state_index
        ON stock_move (product_id, state)
        WHERE state NOT IN ('done', 'cancel')
    """)
```

O declare un objeto de tabla `Index` en la v19:

```python
_move_product_state = models.Index(
    "(product_id, state)",
    where="state NOT IN ('done','cancel')",
)
```

### 6.4 Cuándo añadir un índice

| Síntoma | Índice |
|---|---|
| Filtro lento en la vista de lista sobre una FK | btree sobre la FK |
| Búsqueda `ilike` lenta | GIN de trigramas |
| Filtro lento por `state` + fecha | índice compuesto `(state, date)` |
| Regla `company_id` lenta | índice compuesto `(company_id, state)` |
| Unión x2many lenta | índice de relación inversa (lo crea el núcleo) |

**[WARNING]** Cada índice ralentiza las escrituras y consume disco. Mida con `EXPLAIN (ANALYZE, BUFFERS)` antes y después; no cree índices «por si acaso».

---

## 7. Secuencias y numeración

- `ir.sequence` genera los números de documento (PV, PC, factura, picking) mediante bloqueos de fila de PostgreSQL.
- La contabilidad usa `sequence.mixin` (no `ir.sequence`) con un bloqueo de índice único y una caché por periodo.
- `ir.sequence` tiene `number_next`, `number_next_actual`, `prefix`, `suffix`, `padding`, `implementation` (`standard`/`no_gap`).
- `no_gap` usa un bloqueo a nivel de transacción y es más lento.

**[WARNING]** Los números de `ir.sequence` no están exentos de huecos tras un rollback; `no_gap` reduce los huecos en caso de fallo, pero no los elimina. Nunca use secuencias como claves de negocio para la conciliación.

---

## 8. Adjuntos y filestore

Columnas de `ir_attachment`:

| Columna | Significado |
|---|---|
| `name` | nombre de archivo |
| `res_model`, `res_id` | registro vinculado |
| `mimetype` | tipo MIME |
| `file_size` | bytes |
| `checksum` | SHA-1 del contenido |
| `store_fname` | ruta relativa en el filestore |
| `db_datas` | bytea (si se almacena en la BD) |
| `public` | accesible sin autenticación |
| `res_field` | nombre del campo binario si el adjunto pertenece a un campo |

Decisión de almacenamiento:

- `attachment=True` → filestore (`store_fname`), deduplicado por checksum.
- `attachment=False` → `db_datas` bytea.
- Los binarios grandes deben usar siempre el filestore.

**[INVARIANT]** Las copias de seguridad deben incluir tanto el volcado de PostgreSQL como el directorio del filestore (`~/.local/share/Odoo/filestore/<db>` o el `data_dir` configurado). Una restauración que solo incluya la BD produce adjuntos dañados.

---

## 9. Comportamiento ante cambios de esquema

`init_models()` es aditivo:

| Cambio | Comportamiento |
|---|---|
| Campo nuevo | `ALTER TABLE ADD COLUMN` |
| Campo obligatorio nuevo | añade la columna, calcula los valores y aplica NOT NULL si es posible |
| Cambio de tipo de campo | `ALTER COLUMN TYPE` con conversión (puede fallar) |
| Campo eliminado | **se conserva la columna**, se registra una advertencia |
| Campo renombrado | se crea una columna nueva; se conserva la antigua |
| Modelo eliminado | se conserva la tabla |
| Restricción añadida | se crea; falla si los datos existentes la incumplen |
| Índice eliminado | se elimina si lo creó Odoo |
| `_auto=False` | sin gestión de tabla |

Fuente: `orm/models.py:3170-3260`, `orm/registry.py:750-830`.

**[INVARIANT]** Nunca dependa de Odoo para eliminar o renombrar columnas. Toda actualización de producción necesita un script de migración explícito para:

- campos eliminados (eliminar o archivar),
- campos renombrados (copiar + eliminar),
- cambios de tipo (convertir + validar),
- adiciones de restricciones (limpiar los datos primero).

---

## 10. Lista de verificación de nomenclatura y diseño

- [ ] Nombre de tabla ≤ 63 bytes; `_table` explícito si es largo.
- [ ] `_log_access=False` en tablas de log o transitorias de gran volumen.
- [ ] `company_id` en cada documento de negocio, indexado.
- [ ] `Many2one` indexado si se filtra o une con frecuencia.
- [ ] `_order` termina en `id` para una paginación determinista.
- [ ] `_rec_name` definido para los modelos orientados al usuario.
- [ ] Restricciones SQL para unicidad sin condiciones de carrera.
- [ ] `ondelete` explícito en las relaciones obligatorias.
- [ ] `_check_company_auto` en los modelos multicompañía.
- [ ] Ningún campo con palabra reservada de SQL (`order`, `group`, `user`, `select`).
- [ ] Ninguna columna llamada `id` aparte de la PK.
- [ ] Campos traducidos no usados en `_order`.
- [ ] Campos dependientes de compañía no marcados como `required`.
- [ ] Filestore incluido en la copia de seguridad.

---

## 11. Consultas de diagnóstico

```sql
-- Tables without primary key
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'p');

-- Missing FK indexes (candidate)
SELECT conrelid::regclass AS table, a.attname AS column
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Table and index sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 30;

-- Unused indexes
SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 12. Índice de evidencia

| Tema | Archivo |
|---|---|
| Nomenclatura de tablas | `orm/model_classes.py:266` |
| Columnas mágicas | `orm/models.py:262-297` |
| Relación M2M | `orm/fields_relational.py:1270-1375` |
| Comprobaciones de índices | `orm/registry.py:829-900` |
| Claves externas | `orm/registry.py:921-970` |
| Creación de tablas | `tools/sql.py:278` |
| `_table_query` | `orm/models.py:493`, `addons/test_orm/models/test_orm.py:2483` |
| Validación de nombres | `orm/utils.py:97` |
| `ir_model_data` | `addons/base/models/ir_model.py:2237` |
| Adjuntos | `addons/base/models/ir_attachment.py:75-320` |

A continuación, `02-inheritance.md`.
