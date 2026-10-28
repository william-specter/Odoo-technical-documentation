# Manual de campo de Odoo Internals

[English](README.md) · [Español](README.es.md)

**Una referencia técnica verificada contra el código fuente de Odoo 19.0 Enterprise: el runtime, los flujos de negocio, el diseño de la base de datos, el grafo de módulos, las fronteras funcionales y las prácticas de entrega que la documentación oficial no explica.**

Análisis independiente del árbol de código fuente Enterprise `odoo-19.0+e.20260826`, contrastado con la documentación de Odoo 20.0. **47 capítulos · 9 volúmenes · 77 diagramas Mermaid · más de 80.000 palabras.**

> **Léalo en el navegador:** abra [`index.es.html`](index.es.html) directamente, o ejecute `python3 serve.py` y visite <http://127.0.0.1:9000>.

---

## Resumen

Este repositorio documenta cómo funciona Odoo en realidad, no solo lo que expone su API pública. Reconstruye mediante ingeniería inversa las rutas de llamada, las máquinas de estados, las convenciones de esquema, los puntos de extensión y las restricciones operativas que hay detrás de los flujos ERP estándar, y los convierte en material que arquitectos, desarrolladores de backend, ingenieros de datos, responsables de QA y responsables de programa pueden usar durante el diseño, la construcción y el soporte en producción.

El manual se organiza en nueve volúmenes. Comienza con el modelo de procesos y el runtime del ORM, sigue un presupuesto a través de la entrega, la facturación y la contabilidad, mapea la base de datos física y el grafo de dependencias de 1.469 módulos, identifica dónde se detiene el Odoo estándar y cierra con artefactos de ingeniería, orientación para la entrega y apéndices operativos.

**Responde a preguntas como:**

- ¿Cómo viaja una petición desde HTTP a través del registro, `Environment`, la caché del ORM y PostgreSQL?
- ¿Por qué los conjuntos de registros, los campos calculados, `sudo()`, los puntos de guardado y los reintentos se comportan como lo hacen?
- ¿Cómo se conectan realmente ventas, compras, inventario, contabilidad, fabricación y los documentos entre módulos?
- ¿Qué tablas, columnas, índices y estructuras heredadas ocultas existen, y cómo se migran de forma segura?
- ¿Qué módulo es responsable de un comportamiento, dónde debe residir una personalización y qué se rompe entre la 18 y la 19?
- ¿Dónde termina el Odoo estándar, cuánto cuesta cruzar la frontera y cómo se debe estimar y entregar el programa?

### De un vistazo

| Atributo | Valor |
|---|---|
| **Fuente primaria** | Odoo 19.0 Enterprise, build `19.0+e.20260826` |
| **Commits del código fuente** | Community `7b5a3f53a824d86fe6cb4002637299813cd81881`; Enterprise `89c0ff24180571bc0e2df7d79f5d658f5a12dd3a` |
| **Referencia secundaria** | Instantánea de la documentación oficial de Odoo `20.0` |
| **Módulos analizados** | 1.469 (656 Community + 813 Enterprise), 3.234 aristas de dependencia, 0 ciclos de manifiesto |
| **Contenido** | 47 capítulos, 77 diagramas Mermaid, más de 80.000 palabras |
| **Idiomas** | Inglés y español (traducción completa) |
| **Público** | Arquitectos, desarrolladores de backend, ingenieros de datos, responsables de QA, responsables de programas ERP |
| **Lector** | HTML estático y offline-first con búsqueda, tabla de contenidos, enlaces directos, Mermaid y modo oscuro |

---

## Advertencia crítica sobre la versión

El árbol de código fuente es la **19.0**, mientras que la instantánea de documentación es la **20.0**. Odoo 19 introdujo cambios arquitectónicos disruptivos, y muchas recetas de la documentación 20.0 no se aplican limpiamente al código fuente 19.0.

| Área | Qué cambió en Odoo 19 |
|---|---|
| **Aprovisionamiento** | `procurement.group` ha desaparecido. `stock.reference` ahora agrupa movimientos y pickings. |
| **Valoración** | `stock.valuation.layer` ha desaparecido. El valor reside en `stock.move.value` y `product.value`. |
| **Tipo de producto** | `type='product'` se sustituye por `type='consu'` más `is_storable`. |
| **Unidades de medida** | `uom.category` y `category_id` se sustituyen por un árbol (`relative_uom_id`, `relative_factor`). |
| **Estados de los documentos** | Ventas y compras ya no tienen un estado `done`; las ventas usan un booleano `locked`. |
| **Motor de impuestos** | Una canalización de funciones puras sustituye muchos puntos de extensión `_compute_taxes` anteriores a la 18. |
| **ORM y API** | `read_group` → `_read_group`, `name_get` eliminado, `check_access_rights` obsoleto, clase `Domain`, `create` basado en listas y otros cambios. |

Los capítulos de nivel de código indican la versión que describen, y el comportamiento sensible a la versión se marca con `[V19]`. Para consultar el catálogo completo de portabilidad, véase [Compatibilidad de versiones y cambios de la 18→19](docs/es/04-modules/05-upgrade-compat.md). Para conocer las trampas de la documentación que rompen el código personalizado, véase [Dónde la documentación induce a error o se detiene](docs/es/05-scope/04-doc-gaps.md).

---

## Qué contiene

- **Arquitectura y runtime** — topología de procesos y despliegue, ciclo de vida de una petición HTTP, ensamblado del registro, `Environment`/cursor/transacción, carga de módulos, cron, bus, correo, persistencia e invariantes de arquitectura.
- **ORM y lógica de negocio** — semántica de los conjuntos de registros, mecánica de campos, funcionamiento interno de CRUD, dominios, herencia, caché y recálculo, transacciones y puntos de guardado, reintentos, bloqueos, servicios, reglas de negocio, automatización y seguridad.
- **Flujos de extremo a extremo** — del presupuesto al cobro, de la solicitud al pago a proveedores, inventario y valoración, de la factura a los estados financieros, del plan a la producción y el grafo de documentos entre módulos.
- **Diseño de base de datos** — generación y nomenclatura del esquema, huellas de herencia, modelo ER central, indexación y rendimiento de consultas, migraciones, actualizaciones y evolución de datos.
- **Relaciones entre módulos** — semántica de manifiestos y carga, mapa de la plataforma, puntos de extensión clasificados por seguridad, acoplamiento circular y catálogo de compatibilidad 18→19.
- **Alcance del ERP** — cobertura funcional, 18 brechas principales y sus consecuencias de ingeniería, 10 cuellos de botella de rendimiento y puntos en los que la documentación oficial es incompleta o induce a error.
- **Ingeniería de software** — 28 casos de uso, agregados de dominio, diagramas de secuencia y de actividad, 13 referencias de máquinas de estados, requisitos no funcionales y una estrategia de pruebas para personalizaciones.
- **Gestión de proyectos** — ciclo de vida de entrega, estimación, roles, puertas de calidad, entornos y CI/CD, registro de riesgos, manual de implementación y plantillas de documentos.
- **Apéndice** — mapa del código fuente, recetario SQL de solo lectura, guía de depuración e incidentes, listas de verificación y la matriz completa de evidencias/versiones.

---

## Mapa de la documentación

| Volumen | Capítulos | Enfoque |
|---|---|---|
| **0 — Orientación** | [Arquitectura y modelo de runtime](docs/es/00-overview/01-architecture.md)<br>[Glosario de aspectos internos de Odoo](docs/es/00-overview/02-glossary.md) | Modelo de procesos, ciclo de vida de peticiones, registro, entorno, cursor y terminología |
| **1 — Capa de lógica de negocio** | [Runtime del ORM y semántica de modelos](docs/es/01-business-logic/01-orm-runtime.md)<br>[Transacciones, concurrencia e integridad de datos](docs/es/01-business-logic/02-transactions.md)<br>[Estructura de servicios, inyección y orquestación](docs/es/01-business-logic/03-service-layer.md)<br>[Reglas de negocio, eventos y desencadenantes de automatización](docs/es/01-business-logic/04-business-rules-events.md)<br>[Modelo de seguridad](docs/es/01-business-logic/05-security.md) | Conjuntos de registros, campos, CRUD, caché, transacciones, servicios, reglas, ACL y reglas de registro |
| **2 — Flujos de extremo a extremo** | [Ventas y CRM (del presupuesto al cobro)](docs/es/02-flows/01-sales.md)<br>[Compras (de la solicitud al pago a proveedores)](docs/es/02-flows/02-purchase.md)<br>[Inventario y valoración de stock](docs/es/02-flows/03-inventory.md)<br>[Contabilidad (de la factura a los estados financieros)](docs/es/02-flows/04-accounting.md)<br>[Fabricación (del plan a la producción)](docs/es/02-flows/05-manufacturing.md)<br>[Flujo de documentos entre módulos](docs/es/02-flows/06-cross-module.md) | Máquinas de estados, secuencias de llamadas, impacto contable, hooks de extensión y modos de fallo |
| **3 — Diseño de base de datos** | [Convenciones de esquema y almacenamiento](docs/es/03-database/01-conventions.md)<br>[Estrategias de herencia y efectos en el esquema](docs/es/03-database/02-inheritance.md)<br>[Modelo entidad-relación central](docs/es/03-database/03-er-model.md)<br>[Indexación, rendimiento de consultas y escalado](docs/es/03-database/04-indexes-performance.md)<br>[Migraciones, actualizaciones y evolución de datos](docs/es/03-database/05-migrations.md) | Esquema físico, modelo ER, índices, coste de consultas y patrones de migración |
| **4 — Relaciones entre módulos** | [Manifiesto, carga y semántica de dependencias](docs/es/04-modules/01-dependency-system.md)<br>[Mapa de la plataforma y clústeres de dependencias](docs/es/04-modules/02-module-map.md)<br>[Puntos de extensión clasificados por seguridad](docs/es/04-modules/03-extension-points.md)<br>[Dependencias circulares y acoplamiento](docs/es/04-modules/04-circular-dependencies.md)<br>[Compatibilidad de versiones y cambios de la 18→19](docs/es/04-modules/05-upgrade-compat.md) | Grafo de módulos, análisis de impacto, extensión segura, acoplamiento y cambios disruptivos |
| **5 — Límites del alcance ERP** | [Matriz de cobertura funcional](docs/es/05-scope/01-coverage.md)<br>[Brechas funcionales y consecuencias de ingeniería](docs/es/05-scope/02-gaps.md)<br>[Cuellos de botella de rendimiento y límites de escalado](docs/es/05-scope/03-performance.md)<br>[Dónde la documentación induce a error o se detiene](docs/es/05-scope/04-doc-gaps.md) | Cobertura de serie, costes de las brechas, límites de rendimiento y trampas de la documentación |
| **6 — Ingeniería de software** | [Modelo de casos de uso](docs/es/06-engineering/01-use-cases.md)<br>[Modelo de dominio y agregados](docs/es/06-engineering/02-domain-model.md)<br>[Diagramas de secuencia](docs/es/06-engineering/03-sequence-diagrams.md)<br>[Diagramas de actividad y correspondencia con BPMN](docs/es/06-engineering/04-activity-diagrams.md)<br>[Referencia de máquinas de estados](docs/es/06-engineering/05-state-machines.md)<br>[Requisitos no funcionales](docs/es/06-engineering/06-nfr.md)<br>[Estrategia de pruebas](docs/es/06-engineering/07-testing-strategy.md) | Modelos listos para UML/BPMN, invariantes, objetivos de NFR y capas de prueba |
| **7 — Gestión de proyectos** | [Ciclo de vida de entrega](docs/es/07-project-management/01-delivery-lifecycle.md)<br>[Estimación y presupuestación](docs/es/07-project-management/02-estimation.md)<br>[Estructura del equipo y roles](docs/es/07-project-management/03-team-and-roles.md)<br>[Puertas de calidad y definición de terminado](docs/es/07-project-management/04-quality-gates.md)<br>[Entornos, CI/CD y operaciones](docs/es/07-project-management/05-environments-ci.md)<br>[Registro de riesgos](docs/es/07-project-management/06-risk-register.md)<br>[Manual de implementación](docs/es/07-project-management/07-implementation-playbook.md)<br>[Plantillas de documentos](docs/es/07-project-management/08-templates.md) | Ciclo de vida, impulsores del esfuerzo, RACI, puertas, operaciones, riesgos y plantillas |
| **8 — Apéndice** | [Mapa del código fuente](docs/es/08-appendix/01-code-map.md)<br>[Recetario SQL](docs/es/08-appendix/02-sql-cookbook.md)<br>[Guía de depuración e incidentes](docs/es/08-appendix/03-debug-playbook.md)<br>[Listas de verificación](docs/es/08-appendix/04-checklists.md)<br>[Fuentes, evidencias y matriz de versiones](docs/es/08-appendix/05-sources.md) | Mapa de archivos, SQL de diagnóstico, respuesta a incidentes, listas de verificación de revisión y evidencias |

Cada capítulo está disponible en inglés bajo `docs/` y en español bajo `docs/es/`. El lector web refleja esta estructura con `index.html` e `index.es.html`.

---

## Hallazgos seleccionados

- El grafo de módulos es un DAG: **1.469 módulos**, **3.234 aristas de dependencia declaradas** y **cero ciclos de manifiesto**. `account` tiene el mayor fan-in (165 dependientes), por lo que los cambios allí tienen un radio de impacto en toda la plataforma.
- En este árbol **no hay ningún módulo Community que dependa directamente de módulos Enterprise**, pero **1.006 módulos se autoinstalan** y pueden arrastrar dependencias inesperadas al instalar una aplicación.
- El ORM es un runtime active-record con un mapa de identidad transaccional, prefetch, recálculo impulsado por dependencias y reglas de registro a nivel SQL. Tratarlo como un simple mapeador de datos produce consultas N+1, tormentas de recálculo y brechas de seguridad.
- El sincronizador de esquema de Odoo es aditivo y conservador: añade columnas e índices, pero no renombra, elimina ni transforma datos. Toda actualización de producción necesita un plan de migración explícito.
- Los efectos secundarios externos exactamente una vez **no** están garantizados. Las integraciones necesitan claves de idempotencia, un outbox o hooks posteriores al commit.
- La documentación oficial de la 20.0 explica la API pública y la configuración de funcionalidades, pero no el ensamblado del registro, el funcionamiento interno de las transacciones y la caché, los flujos entre módulos ni las eliminaciones de la 18→19. Esas brechas son la razón de ser de este manual.

---

## Rutas de lectura

| Rol | Punto de partida | Después |
|---|---|---|
| Desarrollador de backend | [Runtime del ORM y semántica de modelos](docs/es/01-business-logic/01-orm-runtime.md) | [Transacciones](docs/es/01-business-logic/02-transactions.md), [Reglas de negocio](docs/es/01-business-logic/04-business-rules-events.md), [Puntos de extensión](docs/es/04-modules/03-extension-points.md) |
| Arquitecto | [Arquitectura y modelo de runtime](docs/es/00-overview/01-architecture.md) | [Flujos de extremo a extremo](docs/es/02-flows/01-sales.md), [Modelo ER](docs/es/03-database/03-er-model.md), [Alcance del ERP](docs/es/05-scope/01-coverage.md) |
| Ingeniero de datos | [Convenciones de esquema y almacenamiento](docs/es/03-database/01-conventions.md) | [Herencia](docs/es/03-database/02-inheritance.md), [Índices y rendimiento](docs/es/03-database/04-indexes-performance.md), [Migraciones](docs/es/03-database/05-migrations.md) |
| Responsable funcional de ERP | [Ventas](docs/es/02-flows/01-sales.md) hasta [Fabricación](docs/es/02-flows/05-manufacturing.md) | [Matriz de cobertura](docs/es/05-scope/01-coverage.md), [Brechas funcionales](docs/es/05-scope/02-gaps.md) |
| Responsable de programa | [Ciclo de vida de entrega](docs/es/07-project-management/01-delivery-lifecycle.md) | [Estimación](docs/es/07-project-management/02-estimation.md), [Puertas de calidad](docs/es/07-project-management/04-quality-gates.md) |
| Ingeniero de QA | [Estrategia de pruebas](docs/es/06-engineering/07-testing-strategy.md) | [Máquinas de estados](docs/es/06-engineering/05-state-machines.md), [Guía de depuración](docs/es/08-appendix/03-debug-playbook.md) |

---

## Ejecutar el lector web

El lector es estático y offline-first. Todo el Markdown está incrustado en `assets/js/docs-data.es.js` (español) o `assets/js/docs-data.js` (inglés), por lo que `file://` también funciona.

```bash
# Desde la raíz del repositorio — serve.py siempre sirve este directorio
python3 serve.py          # http://127.0.0.1:9000
python3 serve.py 9000     # puerto personalizado
```

El servidor se enlaza únicamente a localhost. Alternativamente, use el servidor de la biblioteca estándar **desde este directorio**:

```bash
python3 -m http.server 9000
```

Ejecutar `python -m http.server` desde el directorio personal listará ese directorio en su lugar. También puede abrir `index.es.html` (español) o `index.html` (inglés) directamente en un navegador.

### Reconstruir el índice de contenido después de editar Markdown

```bash
node build.mjs
```

`build.mjs` recorre `docs/**/*.md` (inglés) y `docs/es/**/*.md` (español), deriva los títulos y los metadatos de las secciones y escribe:

- `assets/js/docs-data.js` — contenido inglés incrustado para el lector offline;
- `assets/js/docs-data.es.js` — contenido español incrustado para el lector offline;
- `docs/manifest.json` — metadatos de navegación en inglés para las herramientas;
- `docs/manifest.es.json` — metadatos de navegación en español para las herramientas.

No se requiere `npm install`. Haga commit de los cuatro archivos generados junto con el cambio de Markdown; de lo contrario, el navegador seguirá sirviendo el contenido anterior.

El sitio es completamente estático, por lo que la raíz del repositorio también se puede publicar con GitHub Pages.

---

## Estructura del repositorio

```text
.
├── README.md                  # este archivo; también la página «Empieza aquí» en inglés
├── README.es.md               # edición en español de este archivo
├── index.html                 # lector estático en inglés
├── index.es.html              # lector estático en español
├── serve.py                   # servidor local (por defecto 127.0.0.1:9000)
├── build.mjs                  # regenera ambos docs-data y ambos manifiestos
├── LICENSE                    # GNU GPL v3.0
├── docs/
│   ├── 00-overview/           # 47 capítulos en inglés, 9 volúmenes
│   ├── 01-business-logic/
│   ├── 02-flows/
│   ├── 03-database/
│   ├── 04-modules/
│   ├── 05-scope/
│   ├── 06-engineering/
│   ├── 07-project-management/
│   ├── 08-appendix/
│   ├── es/                    # traducciones al español, misma estructura
│   ├── manifest.json          # metadatos de navegación en inglés (generado)
│   └── manifest.es.json       # metadatos de navegación en español (generado)
└── assets/
    ├── css/style.css
    ├── js/app.js              # búsqueda, rutas, TOC, tema, diagramas e idioma de la UI
    ├── js/docs-data.js        # generado; incluye todo el Markdown en inglés
    ├── js/docs-data.es.js     # generado; incluye todo el Markdown en español
    ├── img/favicon.svg
    └── vendor/                # marked 12.0.2 + Mermaid 10.9.1 (MIT)
```

---

## Notación y convenciones

### Notación de secuencias de llamadas

```text
Actor -> Controller : HTTP POST /web/dataset/call_kw
Controller -> Model : action_confirm()
Model -> Model : _action_confirm()   [super() chain]
Model -> ORM : write({'state': 'sale'})
ORM -> PostgreSQL : UPDATE sale_order SET state='sale'
```

`A -> B : message` es una llamada síncrona. `A --> B : event` es asíncrona (bus, cron, correo). `[guard]` es un punto de decisión. `opt`, `alt` y `loop` siguen la semántica de fragmentos combinados de UML.

### Notación de estados

```text
draft --action_confirm()--> sale --action_lock()--> sale(locked)
  |                            |
  +--action_cancel()--> cancel <+
```

Las transiciones se etiquetan con el método **público** que las desencadena. Cuando la transición se calcula en lugar de escribirse, la etiqueta es `recompute:<field>`.

### Marcadores de gravedad

- **[INVARIANT]** — violarlo corrompe datos o rompe la contabilidad.
- **[WARNING]** — incidente de producción habitual.
- **[INTERNAL]** — API privada; puede cambiar sin previo aviso.
- **[V19]** — comportamiento específico de Odoo 19, a menudo distinto del de la documentación de la 18 o la 20.
- **[ENTERPRISE]** — solo presente en el repositorio Enterprise.

### Referencias de código

Todas las referencias de archivo usan rutas relativas a la raíz del código fuente de Odoo:

```text
source code/odoo-19.0+e.20260826/odoo/
├── orm/            # ORM kernel: models, fields, registry, environments
├── modules/        # module graph, manifest parsing, loading, migration
├── http.py         # WSGI/ASGI entry, Request, dispatchers, sessions
├── service/        # RPC service layer, retrying, security
├── addons/         # 1,469 modules (656 community + 813 enterprise)
└── tools/          # SQL helpers, safe_eval, translations, misc
```

Una afirmación como `sale/models/sale_order.py:1167` significa `odoo/addons/sale/models/sale_order.py`, línea 1167 en esta build exacta. Los números de línea son específicos de cada build; los símbolos (nombres de modelos, campos y métodos) son el ancla estable.

---

## Base de evidencias y metodología

| Entrada | Versión | Función en este manual |
|---|---|---|
| Árbol de código fuente | `odoo-19.0+e.20260826` (Enterprise) | **Fuente primaria de verdad** para todas las afirmaciones de nivel de código |
| Documentación oficial | `odoo-docs-20.0` | Secundaria; se usa para identificar qué está documentado y dónde la documentación se desvía del código |
| Conocimiento de la comunidad | Foros de Odoo, issues de GitHub, OpenUpgrade, OCA | Solo corroboración; nunca se usa para una afirmación que pueda verificarse en el código fuente |

Las estadísticas de módulos se obtuvieron analizando sintácticamente cada `__manifest__.py` del árbol y construyendo un grafo de dependencias: 1.469 manifiestos analizables, 3.234 aristas de dependencia, detección de ciclos de Kahn/Tarjan (0 ciclos, 0 nodos sin resolver), comprobaciones de dependencias y archivos faltantes (0 incidencias), cálculo de fan-in/fan-out y profundidad, y un censo de `auto_install`/`external_dependencies`.

**Limitaciones conocidas:**

- Los números de línea cambian entre builds; se debe usar el símbolo citado como ancla estable.
- La cobertura funcional se basa en la inspección de módulos y código fuente, no en pruebas prácticas exhaustivas de cada funcionalidad.
- El comportamiento de los módulos Enterprise puede cambiar entre builds; se debe verificar contra el código fuente con licencia.
- Las cifras de rendimiento son objetivos y orientación, no benchmarks de su conjunto de datos.
- El manual no redistribuye código Enterprise; los fragmentos son breves y explicativos.

---

## Qué es este manual — y qué no es

**Es:**

- un mapa obtenido por ingeniería inversa de secuencias de llamadas, máquinas de estados, convenciones de esquema y puntos de extensión;
- un catálogo de contratos implícitos — invariantes impuestos por el código pero ausentes de la documentación de la API;
- un conjunto de modelos textuales listos para UML/BPMN (casos de uso, clases, secuencia, actividad, estados);
- un manual de entrega para implementar Odoo: estimación, puertas de calidad, entornos, paso a producción;
- una lista de brechas funcionales y trampas de rendimiento, con evidencias.

**No es:**

- un manual de usuario, una guía de instalación ni un sustituto de la referencia oficial de la API;
- una copia del código fuente Enterprise — los fragmentos son breves, explicativos y atribuidos;
- una garantía de que las API internas sean estables — los métodos internos se marcan explícitamente;
- asesoramiento legal. Los módulos Enterprise están licenciados bajo `OEEL-1`/`OPL-1`; revise su acuerdo antes de copiar código.

---

## Reglas de mantenimiento

1. **Toda afirmación de nivel de código debe poder rastrearse** hasta un archivo y un símbolo. Los números de línea cambian; los símbolos no. Se deben preferir los nombres de métodos en la prosa y mantener los números de línea en las tablas de evidencias.
2. **Nunca se debe documentar un método interno como API estable.** Se debe marcar como `[INTERNAL]`.
3. **Registrar la versión del código fuente** en el encabezado del capítulo cuando el comportamiento sea sensible a la versión.
4. **Probar los diagramas después de editarlos.** Mermaid falla silenciosamente con etiquetas no válidas.
5. **No pegar código fuente Enterprise.** Usar fragmentos ilustrativos de ≤15 líneas y citar el archivo.
6. **Reconstruir después de cambios en Markdown.** Ejecutar `node build.mjs` y hacer commit de `assets/js/docs-data.js`, `assets/js/docs-data.es.js`, `docs/manifest.json` y `docs/manifest.es.json` junto con el cambio de origen.

---

## Licencia y atribución

El contenido original de este manual está licenciado bajo la GNU GPL v3.0 (GNU General Public License, versión 3.0); véase el archivo [LICENSE](LICENSE). Esta licencia se aplica al contenido original del manual y no al código de Odoo, las marcas comerciales ni las dependencias de terceros que se describen a continuación.

El código de Odoo Community es LGPL-3. El código de Odoo Enterprise está cubierto por la Odoo Enterprise Edition Licence (`OEEL-1`) o la Odoo Partnership Licence (`OPL-1`). Este manual es un análisis independiente; no redistribuye el código fuente. Odoo es una marca registrada de Odoo S.A.

Las dependencias de frontend incluidas en el repositorio — `marked` 12.0.2 y `Mermaid` 10.9.1 — tienen licencia MIT; véanse los detalles en `assets/vendor/README.md`.
