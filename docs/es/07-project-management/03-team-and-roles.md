# Gestión de proyectos III — Estructura del equipo y roles

> **Principio.** Los proyectos de Odoo fracasan cuando el equipo es un grupo de generalistas sin una responsabilidad clara, o un grupo de especialistas que nunca se comunican. El equipo mínimo viable cuenta con responsabilidad funcional, responsabilidad técnica y responsabilidad de negocio.

---

## 1. Roles principales

| Rol | Responsabilidad principal | Competencias clave |
|---|---|---|
| Patrocinador | presupuesto, alcance, escalado | autoridad de negocio |
| Jefe de proyecto (PM) | plan, riesgos, comunicación, control de cambios | entrega, gestión de interesados |
| Arquitecto de soluciones | arquitectura, integración, seguridad, requisitos no funcionales (NFR) | funcionamiento interno de Odoo, BD, integraciones |
| Consultor funcional / BA | ajuste, configuración, talleres, UAT | procesos del dominio, configuración de Odoo |
| Desarrollador | módulos personalizados, pruebas, migraciones | Python, ORM, PostgreSQL, JS/OWL |
| Ingeniero de datos | extracción/transformación/carga, conciliación | SQL, Python, calidad de datos |
| Ingeniero de QA | estrategia de pruebas, automatización, regresión | pruebas de Odoo, Selenium/Playwright |
| Ingeniero DevOps | entornos, CI/CD, copia de seguridad, monitorización | Docker, PostgreSQL, Linux |
| Gestor del cambio | formación, comunicación, adopción | cambio organizativo, formación |
| Usuario clave | validación de negocio, UAT, promotor | experiencia en el dominio |
| Contador | plan de cuentas/impuestos/localización/informes | GAAP local/IFRS |

---

## 2. RACI por fase

| Fase | Patrocinador | PM | Arquitecto | Funcional | Desarrollador | Datos | QA | DevOps | Usuario clave |
|---|---|---|---|---|---|---|---|---|---|
| Descubrimiento | A | R | C | R | I | C | I | I | C |
| Diseño | I | A | R | R | C | C | I | I | C |
| Construcción | I | A | C | R | R | R | I | C | I |
| Pruebas | I | A | C | C | C | C | R | C | C |
| UAT | I | A | I | C | I | I | C | I | R |
| Paso a producción | A | R | C | C | C | R | C | R | C |
| Soporte intensivo | I | A | C | R | R | C | R | R | R |
| Cierre | A | R | C | C | I | I | I | I | C |

---

## 3. Perfiles de rol

### 3.1 Arquitecto de soluciones

**Responsabilidades:** diseño técnico, límites de módulos, patrones de integración, modelo de seguridad, rendimiento, estrategia de actualización.

**Debe conocer:**

- runtime del ORM, transacciones, caché/recálculo,
- dependencias de módulos y MRO,
- esquema e indexación de PostgreSQL,
- funcionamiento interno de contabilidad y stock,
- modelo de seguridad (ACL/reglas/sudo),
- patrones de integración (idempotencia, outbox).

**Entregables:**

- documento de arquitectura de la solución,
- ADR,
- extensiones del modelo de datos,
- matriz de seguridad,
- objetivos de NFR,
- revisión de código para cambios de alto riesgo.

### 3.2 Consultor funcional / BA

**Responsabilidades:** ajuste, configuración, diseño de procesos, escenarios de UAT, contenido de formación.

**Debe conocer:**

- el dominio de negocio (no solo Odoo),
- los flujos estándar de Odoo y sus límites,
- los compromisos entre configuración y personalización,
- las restricciones de localización.

**Entregables:**

- matriz de ajuste,
- mapas de procesos,
- libro de configuración,
- guiones de UAT,
- materiales de formación.

### 3.3 Desarrollador

**Responsabilidades:** módulos personalizados, pruebas, migraciones, calidad del código.

**Debe conocer:**

- Python, ORM de Odoo, `_inherit`/`super()`,
- vistas XML y assets,
- PostgreSQL y SQL,
- marco de pruebas,
- seguridad (ACL/reglas/sudo).

**Entregables:**

- módulos con pruebas,
- scripts de migración,
- revisiones de código,
- documentación técnica.

### 3.4 Ingeniero de datos

**Responsabilidades:** perfilado de origen, mapeo, ETL, conciliación, carga del paso a producción.

**Debe conocer:**

- SQL, Python, formatos de archivo,
- importación/exportación de Odoo e ID externos,
- calidad de datos y deduplicación,
- técnicas de conciliación.

**Entregables:**

- auditoría de datos,
- especificación de mapeo,
- scripts de ETL,
- informes de conciliación,
- guía operativa del paso a producción.

### 3.5 Ingeniero de QA

**Responsabilidades:** plan de pruebas, automatización, regresión, triaje de defectos.

**Debe conocer:**

- clases de prueba de Odoo, tours,
- pruebas de API,
- pruebas de rendimiento,
- fundamentos de pruebas de seguridad.

**Entregables:**

- plan de pruebas,
- suites automatizadas,
- informes de defectos,
- aprobación de la versión.

### 3.6 Ingeniero DevOps

**Responsabilidades:** entornos, despliegue, copia de seguridad/restauración, monitorización, parcheo de seguridad.

**Debe conocer:**

- Linux, Docker, PostgreSQL,
- workers/cron/gevent de Odoo,
- proxy inverso/TLS,
- copia de seguridad/restauración y filestore,
- CI/CD.

**Entregables:**

- diagrama de entornos,
- canalización de despliegue,
- guía operativa de copia de seguridad/restauración,
- cuadros de mando de monitorización,
- guías operativas de incidentes.

### 3.7 Gestor del cambio

**Responsabilidades:** implicación de los interesados, formación, comunicación, adopción.

**Debe conocer:**

- el impacto de negocio de cada cambio,
- métodos de formación,
- gestión de la resistencia,
- métricas de adopción.

**Entregables:**

- plan de comunicación,
- plan/materiales de formación,
- cuadro de mando de adopción,
- bucle de retroalimentación.

### 3.8 Usuario clave

**Responsabilidades:** validación de negocio, UAT, soporte de primera línea, cumplimiento del proceso.

**Debe conocer:** el proceso de extremo a extremo, los datos y las excepciones.

**Entregables:** aprobación de UAT, SOP, red de promotores.

---

## 4. Tamaño del equipo según la escala del proyecto

| Escala | Usuarios | Equipo |
|---|---|---|
| Pequeño | < 25 | PM/BA (1), desarrollador (1–2), DevOps (compartido), usuario clave (1–2) |
| Mediano | 25–150 | PM, arquitecto (a tiempo parcial), 2 BA, 2–3 desarrolladores, ingeniero de datos, QA, DevOps, usuarios clave |
| Grande | 150–1.000 | PM, gestor de programa, arquitecto(s), equipo de BA, equipo de desarrollo, equipo de datos, equipo de QA, DevOps, gestor del cambio, expertos en localización |
| Multipaís | 1.000+ | oficina de programa, responsables por país, equipo de integración, seguridad/cumplimiento, servicio de soporte |

---

## 5. Derechos de decisión

| Decisión | Responsable | Consultado |
|---|---|---|
| Cambio de alcance | Patrocinador | PM, arquitecto |
| Arquitectura | Arquitecto | PM, desarrolladores |
| Diseño de procesos | Líder funcional | Usuarios clave |
| Mapeo de datos | Ingeniero de datos | Funcional, negocio |
| Modelo de seguridad | Arquitecto | Seguridad/cumplimiento |
| Puesta en marcha | Patrocinador | PM, QA, negocio |
| Reversión de emergencia | PM | Arquitecto, DevOps |

**[INVARIANT]** Una persona debe ser responsable última de cada decisión. Los comités pueden consultar, no decidir.

---

## 6. Antipatrones

| Antipatrón | Consecuencia |
|---|---|
| Sin responsable de negocio | deriva del alcance, baja adopción |
| Arquitecto solo al final | retrabajo, brechas de seguridad |
| El consultor funcional escribe código | personalizaciones frágiles |
| El desarrollador diseña el proceso | técnicamente correcto, incorrecto para el negocio |
| Sin QA | regresiones, sorpresas en la UAT |
| Sin DevOps | despliegues manuales y arriesgados |
| Usuarios clave no disponibles | validación retrasada |
| Equipo en remoto sin contexto de dominio | mala comunicación |
| Una sola persona lo hace todo | factor bus, agotamiento |

---

## 7. Rituales de colaboración

- reunión diaria de pie (15 min) por línea de trabajo,
- comité de dirección semanal (patrocinador, PM, arquitecto),
- demostración del sprint cada 2 semanas,
- reunión semanal de autoridad de diseño,
- triaje diario de defectos durante la UAT,
- sala de crisis del paso a producción,
- soporte intensivo diario.

---

## 8. Lista de verificación del traspaso

- [ ] Arquitectura y ADR actualizados.
- [ ] Guías operativas (despliegue, restauración, incidentes, cierre).
- [ ] Accesos y credenciales transferidos de forma segura.
- [ ] Monitorización/alertas a cargo de operaciones.
- [ ] Backlog e incidencias conocidas documentados.
- [ ] Formación impartida y registrada.
- [ ] Modelo de soporte y SLA acordados.
- [ ] Período de garantía definido.

Continúe con `04-quality-gates.md`.
