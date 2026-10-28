# Apéndice E — Fuentes, evidencias y matriz de versiones

> **Principio.** Cada afirmación a nivel de código de este manual es trazable hasta el árbol de código fuente. La documentación oficial se usa para entender la intención e identificar divergencias, no como prueba del comportamiento en tiempo de ejecución.

---

## 1. Matriz de versiones

| Artefacto | Versión | Ruta |
|---|---|---|
| Código fuente de Odoo | `19.0+e.20260826` | `source code/odoo-19.0+e.20260826/` |
| Commit de Odoo Community | `7b5a3f53a824d86fe6cb4002637299813cd81881` | `release.py` |
| Commit de Odoo Enterprise | `89c0ff24180571bc0e2df7d79f5d658f5a12dd3a` | `release.py` |
| Documentación oficial | `20.0` | `official_docs/odoo-docs-20.0/` |
| Módulos | 1,469 (656 Community + 813 Enterprise) | `addons/*/__manifest__.py` |
| PostgreSQL mínimo | 13 | `release.py` |
| Rango de Python | 3.10–3.14 | `release.py` |

**[WARNING]** La documentación corresponde a la 20.0 y el código fuente a la 19.0. Las afirmaciones sensibles a la versión deben comprobarse contra el código fuente. Cuando se sabe que el comportamiento difiere, el manual lo marca como `[V19]` o describe explícitamente el comportamiento de la 19.

---

## 2. Referencias a fuentes primarias

### 2.1 Núcleo del ORM

| Tema | Archivo |
|---|---|
| Entorno/transacción/caché | `odoo/orm/environments.py` |
| Modelos/CRUD/búsqueda/acceso | `odoo/orm/models.py` |
| Campos | `odoo/orm/fields.py`, `fields_relational.py`, `fields_textual.py`, `fields_numeric.py` |
| Ensamblado de clases de modelo/MRO | `odoo/orm/model_classes.py` |
| Registro/esquema | `odoo/orm/registry.py` |
| Dominios | `odoo/orm/domains.py` |
| Decoradores | `odoo/orm/decorators.py` |
| Objetos de tabla | `odoo/orm/table_objects.py` |

### 2.2 Tiempo de ejecución

| Tema | Archivo |
|---|---|
| HTTP/solicitud/despacho | `odoo/http.py` |
| Cursor/pool/puntos de guardado | `odoo/sql_db.py` |
| Reintento de RPC | `odoo/service/model.py` |
| Servidor/workers | `odoo/service/server.py` |
| Cron | `odoo/addons/base/models/ir_cron.py` |
| Bus | `odoo/addons/bus/models/bus.py` |
| Hilo de correo | `odoo/addons/mail/models/mail_thread.py` |

### 2.3 Módulos

| Tema | Archivo |
|---|---|
| Manifiesto | `odoo/modules/module.py` |
| Grafo/fases | `odoo/modules/module_graph.py` |
| Carga | `odoo/modules/loading.py` |
| Migración | `odoo/modules/migration.py` |
| Modelo de módulo | `odoo/addons/base/models/ir_module.py` |
| Neutralización | `odoo/modules/neutralize.py` |

### 2.4 Módulos de negocio

| Módulo | Ruta |
|---|---|
| `sale` | `odoo/addons/sale/` |
| `sale_stock` | `odoo/addons/sale_stock/` |
| `purchase` | `odoo/addons/purchase/` |
| `purchase_stock` | `odoo/addons/purchase_stock/` |
| `stock` | `odoo/addons/stock/` |
| `stock_account` | `odoo/addons/stock_account/` |
| `account` | `odoo/addons/account/` |
| `account_asset` | `odoo/addons/account_asset/` |
| `account_reports` | `odoo/addons/account_reports/` |
| `mrp` | `odoo/addons/mrp/` |
| `mrp_account` | `odoo/addons/mrp_account/` |
| `mrp_subcontracting` | `odoo/addons/mrp_subcontracting/` |
| `quality` | `odoo/addons/quality/` |
| `crm` | `odoo/addons/crm/` |
| `project` | `odoo/addons/project/` |
| `base` | `odoo/addons/base/` |
| `product` | `odoo/addons/product/` |
| `uom` | `odoo/addons/uom/` |

---

## 3. Estructura de la documentación oficial

La instantánea de la 20.0 contiene:

```
developer/
├── tutorials/            # getting started, module, views, tests
├── howtos/               # website, reports, OWL, upgrade
├── reference/
│   ├── backend/          # ORM, views, security, actions, data
│   ├── frontend/         # OWL, assets, JS
│   ├── cli.html
│   ├── external_api.html
│   ├── external_rpc_api.html
│   └── upgrades.html
├── contributing/
└── glossary.html
```

La documentación de aplicaciones está organizada por área funcional (ventas, inventario, contabilidad, fabricación, etc.) y está orientada al usuario.

### 3.1 Lo que verificamos de forma cruzada

- conceptos básicos de la API de modelo/campo,
- herencia de vistas,
- manifiesto de módulo/archivos de datos,
- conceptos básicos de grupos de seguridad,
- marco de pruebas,
- conceptos básicos de CLI/actualización,
- tutoriales de JS/OWL.

### 3.2 Lo que la documentación no cubre

- ensamblado de la clase de registro y consecuencias del MRO,
- funcionamiento interno de transacción/caché/recálculo,
- semántica de reintentos/puntos de guardado,
- detalles de evaluación SQL de las reglas de registro,
- asignación y progreso de cron,
- garantías de entrega del bus,
- eliminaciones de la v19 (grupo de aprovisionamiento, capa de valoración, categoría de UdM),
- funcionamiento interno de hash/secuencia de contabilidad,
- funcionamiento interno de stock/valoración,
- rendimiento/indexación,
- patrones de migración más allá de lo básico de scripts,
- estimación/gestión de proyectos.

---

## 4. Fuentes de la comunidad (solo corroboración)

| Fuente | Uso |
|---|---|
| Issues/PRs de Odoo en GitHub | contexto de errores, cambios de versión |
| OpenUpgrade | patrones de migración entre versiones mayores |
| Módulos de la OCA | patrones de extensión, casos límite |
| Foros de Odoo | experiencia de campo, soluciones alternativas |
| Documentación de Postgres | semántica de SQL/bloqueo/aislamiento |

Las fuentes de la comunidad no se usan como prueba de un comportamiento en tiempo de ejecución cuando el código fuente está disponible. Cuando se usan, se etiquetan.

---

## 5. Metodología de análisis estático

Las estadísticas de módulos de este manual se generaron analizando cada `__manifest__.py` del árbol y construyendo un grafo de dependencias:

- 1,469 manifiestos analizables, 3,234 aristas de dependencia;
- detección de ciclos de Kahn/Tarjan (0 ciclos, 0 nodos sin resolver);
- comprobaciones de dependencias/archivos faltantes (0);
- cálculo de fan-in/fan-out y de profundidad;
- censo de `auto_install` y `external_dependencies`;
- clasificación de licencia/repositorio (Community vs Enterprise).

Las notas de trabajo sin procesar no se distribuyeron; los resultados se reproducen en `04-modules/01-dependency-system.md` y `04-modules/02-module-map.md`. Para reproducirlos, use el algoritmo de Kahn en `04-modules/04-circular-dependencies.md` §11 y amplíelo para contar fan-in/fan-out.

Las referencias de línea se verificaron contra esta compilación en el momento de la redacción. Los símbolos (nombres de modelo/campo/método) son el ancla estable; los números de línea cambian entre parches.

---

## 6. Cómo verificar una afirmación

```bash
# model exists?
grep -rn "_name = 'model.name'" odoo/addons --include=*.py

# field definition?
grep -rn "field_name = fields\." odoo/addons/module/models --include=*.py

# method?
grep -rn "def method_name" odoo/addons/module --include=*.py

# state values?
grep -n "state = fields.Selection" -A 15 odoo/addons/module/models/file.py

# actual schema?
psql -d db -c "\d table_name"

# installed version?
psql -d db -c "SELECT name, latest_version FROM ir_module_module WHERE name='sale';"
```

---

## 7. Limitaciones conocidas de este manual

- Los números de línea son específicos de la compilación; los símbolos son el ancla estable.
- La cobertura funcional se basa en la inspección de módulos/código fuente, no en pruebas prácticas exhaustivas de cada funcionalidad.
- El comportamiento de los módulos Enterprise puede cambiar entre compilaciones; verifíquelo contra su código fuente con licencia.
- La cobertura de localización varía según el país y la versión.
- Las cifras de rendimiento son objetivos/orientación, no benchmarks de su conjunto de datos.
- El manual no redistribuye código Enterprise; los fragmentos son breves y explicativos.

---

## 8. Orden de lectura sugerido para nuevos miembros del equipo

1. `00-overview/01-architecture.md`
2. `00-overview/02-glossary.md`
3. `01-business-logic/01-orm-runtime.md`
4. `01-business-logic/02-transactions.md`
5. `02-flows/01-sales.md` a `05-manufacturing.md`
6. `03-database/01-conventions.md`
7. `04-modules/01-dependency-system.md`
8. `04-modules/03-extension-points.md`
9. `06-engineering/05-state-machines.md`
10. `08-appendix/03-debug-playbook.md`

---

## 9. Mantenimiento

- Volver a verificar cada capítulo tras una actualización mayor.
- Actualizar la matriz de versiones y los marcadores `[V19]`.
- Añadir nuevos ADR/patrones a medida que el equipo aprende.
- Mantener la compilación de datos de la interfaz web (`build.mjs`) sincronizada con los cambios en Markdown.
- Archivar los capítulos obsoletos en lugar de eliminarlos; el historial es útil.

---

## 10. Atribución

Odoo es una marca registrada de Odoo S.A. El código Community es LGPL-3; el código Enterprise está bajo `OEEL-1`/`OPL-1`. Este manual es un análisis técnico independiente y no redistribuye el código fuente. Todas las marcas comerciales pertenecen a sus respectivos propietarios.
