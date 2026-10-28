# Diseño de base de datos V — Migraciones, actualizaciones y evolución de datos

> **Comprobación de la realidad.** El sincronizador de esquemas de Odoo es aditivo y conservador. Añadirá columnas e índices; no renombrará, eliminará ni transformará datos. Una actualización de producción sin un plan de migración es un evento de pérdida de datos a la espera de un desencadenante.

---

## 1. Superficies de actualización

| Superficie | Modificada por | Mecanismo de migración |
|---|---|---|
| Modelo/campos de Python | código del módulo | sincronización de esquema + scripts de migración |
| Registros de datos | archivos de datos XML/CSV | `noupdate`, `ir.model.data` |
| Vistas/acciones | archivos de datos XML | `noupdate`, herencia de vistas |
| Restricciones SQL | `_sql_constraints` / `models.Constraint` | se crean en la actualización; pueden fallar con datos sucios |
| Índices | `index=` / `models.Index` | creados/eliminados por el registro |
| Traducciones | archivos `.po` | se cargan en la actualización |
| Assets | `assets` del manifiesto | paquete reconstruido (sin migración de BD) |
| Configuración | `ir.config_parameter`, campos de compañía | script personalizado |
| Integraciones externas | contratos de API | adaptadores versionados |

---

## 2. Canal de actualización estándar

```bash
# stop the service or drain workers
odoo-bin -c /etc/odoo/odoo.conf -d mydb -u all --stop-after-init
# restart
```

El canal (`modules/loading.py:340`):

1. cargar `base`,
2. leer la lista de `ir_module_module`,
3. construir el grafo de módulos en modo `update`,
4. para cada módulo:
   - ejecutar `migrations/<version>/pre-*.py`,
   - cargar las definiciones de modelos y configurar los campos,
   - sincronizar el esquema (`init_models`),
   - cargar los archivos de datos (modo `init` o `update`),
   - ejecutar `migrations/<version>/post-*.py`,
   - ejecutar `post_init_hook`,
   - escribir `state='installed'`, `latest_version`,
5. después de todos los módulos: scripts `end-*.py`,
6. ejecutar el post-init de `base`, las traducciones y las pruebas si están habilitadas.

**[WARNING]** `-u all` actualiza todos los módulos instalados. Es la causa más común de actualizaciones largas y arriesgadas. Prefiera `-u module1,module2` para módulos personalizados y una actualización completa solo para cambios de versión mayor.

---

## 3. Scripts de migración de módulos

### 3.1 Estructura de directorios

```
my_module/
└── migrations/
    ├── 19.0.1.1/
    │   ├── pre-migrate_data.py
    │   └── post-fill_new_field.py
    ├── 19.0.2.0/
    │   └── post-recompute.py
    └── 0.0.0/
        └── end-assert_invariants.py
```

| Etapa | Se ejecuta | Uso |
|---|---|---|
| `pre-` | antes de la sincronización del esquema | eliminar/renombrar columnas, crear tablas temporales, limpiar datos que bloquearían una restricción |
| `post-` | después de la sincronización del esquema y la carga de datos | rellenar columnas nuevas, recalcular, mapear registros |
| `end-` | después de todos los módulos | correcciones entre módulos, invariantes finales |

Los scripts `0.0.0` se ejecutan en cualquier cambio de versión: primero `pre`, al final `post`/`end`.

### 3.2 Contrato de los scripts

```python
def migrate(cr, version):
    if not version:
        return  # fresh install
    cr.execute("""
        UPDATE my_table
        SET new_column = old_column
        WHERE new_column IS NULL
    """)
```

- La firma debe ser exactamente `(cr, version)` (o `(_cr, _version)`).
- `version` es la versión instalada antes de la actualización.
- Use SQL directo, no el ORM, en los scripts `pre`: puede que el registro no coincida con el esquema antiguo.
- En los scripts `post`, el ORM está disponible, pero el modelo puede seguir en mitad de la actualización; use `env` con cuidado.
- Los scripts se ejecutan en orden alfabético de nombre de archivo.
- Un script fallido aborta la actualización; la transacción se revierte para ese módulo.

### 3.3 Coincidencia de versiones

`MigrationManager` compara la versión instalada con la versión del manifiesto y ejecuta todos los scripts del rango. Gestiona:

- versiones de módulo (`19.0.1.1`),
- versiones con prefijo de servidor (`19.0.1.1` en un servidor 19.0),
- versiones sin mayor (`1.1` se aplica dentro del mismo mayor),
- `0.0.0` para todos los cambios.

### 3.4 Ubicación de los scripts

- `my_module/migrations/` — preferido para módulos personalizados.
- `odoo/upgrade/<module>/` — ruta de actualización privada, usada por Odoo SA/partners; no está presente en el árbol de código fuente estándar.
- `--pre-upgrade-scripts` — ejecuta scripts arbitrarios antes de la actualización (opción de CLI).

---

## 4. Archivos de datos y `noupdate`

### 4.1 Semántica

```xml
<odoo>
  <data noupdate="1">
    <record id="my_config" model="ir.config_parameter">
      <field name="key">my.module.enabled</field>
      <field name="value">1</field>
    </record>
  </data>
</odoo>
```

- `noupdate="1"`: se crea en la instalación, **nunca se actualiza** en la actualización.
- `noupdate="0"`: se crea en la instalación, se actualiza en la actualización (los campos se sobrescriben).
- `ir.model.data.noupdate` almacena el indicador.
- `env.ref('module.xmlid').toggle_noupdate(...)` lo invierte en tiempo de ejecución.

**[INVARIANT]** Nunca dependa de un archivo de datos XML para actualizar un registro editado por el usuario durante una actualización. Si el registro tiene `noupdate=1`, su cambio no se aplicará; escriba un script de migración en su lugar.

### 4.2 Estabilidad de los ID XML

- Renombrar un ID XML crea un registro nuevo y deja huérfano el antiguo.
- Eliminar un ID XML del XML no elimina el registro; permanece en la BD.
- Los ID XML duplicados entre módulos son un error grave.
- Use `forcecreate="false"` para evitar recrear registros eliminados.

---

## 5. Patrones de migración de esquema

### 5.1 Añadir un campo obligatorio

```python
# 1. add field as optional
new_code = fields.Char()

# 2. post-migration: backfill
def migrate(cr, version):
    if not version:
        return
    cr.execute("UPDATE my_table SET new_code = COALESCE(old_code, 'MIGRATED') WHERE new_code IS NULL")

# 3. later module: mark required=True
```

Nunca añada `required=True` a una tabla existente no vacía sin un valor predeterminado o un relleno; PostgreSQL rechaza la restricción NOT NULL.

### 5.2 Renombrar un campo

```python
# Step 1: add new field, keep old
new_name = fields.Char()

# Step 2: pre-migration copies data
def migrate(cr, version):
    cr.execute("UPDATE my_table SET new_name = old_name")

# Step 3: switch code to new_name

# Step 4 (later): drop old column
def migrate(cr, version):
    cr.execute("ALTER TABLE my_table DROP COLUMN IF EXISTS old_name")
```

### 5.3 Cambiar el tipo de un campo

```python
def migrate(cr, version):
    cr.execute("""
        ALTER TABLE my_table
        ALTER COLUMN amount TYPE numeric(16,4)
        USING amount::numeric(16,4)
    """)
```

Pruébelo con datos similares a los de producción; las conversiones pueden fallar con cadenas vacías, valores fuera de rango o nulos.

### 5.4 Eliminar un campo

Odoo conserva la columna. Para recuperar espacio:

```python
def migrate(cr, version):
    cr.execute("ALTER TABLE my_table DROP COLUMN IF EXISTS obsolete_column")
```

Hágalo solo después de confirmar que ningún informe o integración externos leen la columna.

### 5.5 Cambiar `_inherits`

1. añadir el campo delegado,
2. rellenar la FK (crear registros padre si es necesario),
3. mover los datos de las columnas antiguas,
4. eliminar las columnas antiguas,
5. cambiar `_inherits` en el código.

### 5.6 Cambiar `_parent_store`

Si `_parent_store` está habilitado en un modelo existente:

1. añadir la columna `parent_path`,
2. calcularla con una CTE recursiva,
3. añadir el índice.

`_parent_store_compute` de Odoo puede hacerlo durante `init_models`, pero debe ejecutarse después de que exista la columna.

---

## 6. Estrategias de migración de datos

### 6.1 Procesamiento por lotes

```python
def migrate(cr, version):
    cr.execute("SELECT id FROM my_table WHERE new_col IS NULL ORDER BY id")
    while rows := cr.fetchmany(1000):
        ids = [r[0] for r in rows]
        cr.execute("""
            UPDATE my_table SET new_col = ...
            WHERE id = ANY(%s)
        """, (ids,))
        cr.commit()   # allowed in migration scripts
```

Las migraciones largas deben confirmar por lotes para evitar transacciones enormes y tiempos de bloqueo.

### 6.2 ORM frente a SQL

| Use el ORM cuando | Use SQL cuando |
|---|---|
| necesite cálculos, traducciones, seguimiento de correo | actualizaciones masivas, cambios de esquema |
| el modelo sea estable y esté cargado | etapa `pre`, esquema antiguo |
| el volumen sea pequeño | el volumen sea grande |
| necesite reglas de acceso (normalmente sudo) | el rendimiento importe |

En los scripts `post`, `env = api.Environment(cr, SUPERUSER_ID, {})` está disponible; use `env['model'].search(...)` por corrección y SQL por velocidad.

### 6.3 Idempotencia

Toda migración debe poder ejecutarse de nuevo sin riesgo:

- `IF NOT EXISTS` para DDL,
- `WHERE new_col IS NULL` para rellenos,
- `ON CONFLICT DO NOTHING` para inserciones,
- protección sobre `version` si el script solo se aplica a un rango.

Una actualización fallida suele reintentarse; los scripts no idempotentes corrompen los datos.

---

## 7. OpenUpgrade

OpenUpgrade es el proyecto comunitario que proporciona scripts de migración entre versiones mayores de Odoo. **No** forma parte del núcleo.

Flujo típico:

1. clonar OpenUpgrade para la versión de destino,
2. añadirlo a `addons-path`,
3. ejecutar `odoo-bin -d db --update all --load=base,web,openupgrade_framework`,
4. ejecutar los scripts específicos de la versión (`openupgrade_scripts`),
5. validar.

Advertencias:

- la cobertura varía según el módulo y la versión,
- los módulos de empresa no están cubiertos,
- los módulos personalizados necesitan sus propios scripts,
- OpenUpgrade presupone un esquema estándar; las personalizaciones intensas pueden romperlo.

---

## 8. Probar una actualización

### 8.1 Verificación previa

- [ ] Copia de seguridad completa (BD + filestore).
- [ ] Restaurar en un entorno de staging con la misma versión de PostgreSQL.
- [ ] Inventariar los módulos instalados y el código personalizado.
- [ ] Ejecutar `odoo-bin -d staging --stop-after-init` para detectar errores del registro.
- [ ] Comprobar `ir_model_fields` en busca de campos manuales o de Studio.
- [ ] Comprobar `ir_model_data` en busca de registros `noupdate` que deban cambiar.
- [ ] Comprobar las vistas e informes SQL personalizados en busca de columnas eliminadas.

### 8.2 Durante

- [ ] Ejecutar la actualización con `--log-level=info` y capturar los registros.
- [ ] Monitorizar bloqueos y transacciones largas de PostgreSQL.
- [ ] Detenerse en el primer error; no continuar con una BD parcialmente actualizada.
- [ ] Verificar los estados de los módulos (`ir_module_module.state`).

### 8.3 Verificación posterior

- [ ] Ejecutar las pruebas de Odoo (`--test-enable`) para los módulos personalizados.
- [ ] Hacer pruebas de humo de los flujos críticos: pedido de venta → entrega → factura → pago; pedido de compra → recepción → factura de proveedor; OF → done.
- [ ] Verificar el balance contable y el balance de sumas y saldos.
- [ ] Verificar la valoración del stock y los totales de quant.
- [ ] Comprobar que los adjuntos se abren.
- [ ] Comprobar que los trabajos de cron están activos y programados.
- [ ] Comparar los recuentos de filas y los totales clave antes y después.

---

## 9. Estrategia de reversión

Odoo **no tiene reversión integrada**. Opciones:

| Estrategia | Coste | Riesgo |
|---|---|---|
| Restaurar copia de seguridad de BD + filestore | tiempo de inactividad | pierde los datos escritos después de la copia |
| Azul/verde con dos bases de datos | infraestructura | complejidad de sincronización |
| Réplica lógica + paso a producción | configuración | retraso de replicación |
| Degradación a nivel de módulo | ninguno (no soportado) | inconsistencia de esquema/datos |

**[INVARIANT]** Realice una copia de seguridad verificada inmediatamente antes de la actualización y pruebe la restauración. Una copia de seguridad que nunca se ha restaurado es una hipótesis, no una copia de seguridad.

---

## 10. Neutralización

`modules/neutralize.py` ejecuta `data/neutralize.sql` para cada módulo instalado. Se usa al copiar una base de datos de producción a un entorno que no es de producción:

- deshabilita los servidores de correo,
- deshabilita los proveedores de pago,
- cambia las frecuencias de cron,
- borra las claves de API/webhooks,
- restablece la marca.

```bash
odoo-bin neutralize -d copied_db
```

**[WARNING]** La neutralización es específica de cada módulo. Un módulo personalizado con una integración externa debe incluir su propio `data/neutralize.sql`, o el entorno copiado llamará a las API de producción.

---

## 11. Antipatrones de migración

| Antipatrón | Consecuencia |
|---|---|
| `-u all` en cada despliegue | tiempo de inactividad largo, cambios de esquema innecesarios |
| Editar datos XML sin tener en cuenta `noupdate` | el cambio no se aplica silenciosamente |
| Añadir `required=True` sin relleno | la actualización falla en filas existentes |
| Eliminar columnas antes de que el código deje de usarlas | errores en tiempo de ejecución |
| Migración no idempotente | el reintento corrompe los datos |
| Confirmar cada fila | lento, con muchos bloqueos |
| Ignorar el filestore | adjuntos rotos |
| Sin prueba de restauración | reversión imposible |
| Migrar en el primario sin réplica | interrupción prolongada |
| Omitir las pruebas de módulos personalizados | las regresiones llegan a producción |

---

## 12. Índice de evidencias

| Tema | Archivo |
|---|---|
| Gestor de migraciones | `modules/migration.py:1-260` |
| Contrato de scripts | `modules/migration.py:200-260` |
| Canal de actualización | `modules/loading.py:340-520` |
| `noupdate` | `addons/base/models/ir_model.py:2237-2450` |
| Neutralización | `modules/neutralize.py` |
| Sincronización de esquema | `orm/models.py:3170-3260` |
| Inicialización del registro | `orm/registry.py:750-830` |
| Análisis de versiones | `odoo/tools/parse_version.py` |

Continúe con el volumen 4: relaciones entre módulos.
