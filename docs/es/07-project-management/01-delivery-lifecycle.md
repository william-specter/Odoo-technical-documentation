# Gestión de proyectos I — Ciclo de vida de la entrega

> **Contexto.** Una implementación de Odoo no es un proyecto de software desde cero. Es un programa de **configuración del producto + cobertura de brechas + migración de datos + gestión del cambio**, condicionado por las convenciones de una plataforma existente. El ciclo de vida que se describe a continuación refleja esa realidad.

---

## 1. Fases y puertas

```mermaid
flowchart LR
    A[Discovery] --> G1{G1 Scope}
    G1 --> B[Fit-gap & design]
    B --> G2{G2 Design}
    G2 --> C[Build & configure]
    C --> G3{G3 Build}
    G3 --> D[Test & UAT]
    D --> G4{G4 Acceptance}
    G4 --> E[Deploy & cutover]
    E --> G5{G5 Go-live}
    G5 --> F[Hypercare & handover]
    F --> G6{G6 Closure]
```

| Fase | Duración (tamaño medio) | Entregable clave | Criterios de puerta |
|---|---|---|---|
| Descubrimiento | 2–4 semanas | alcance, mapa de procesos, auditoría de datos | alcance firmado, presupuesto |
| Ajuste y diseño | 3–6 semanas | matriz de ajuste, diseño de la solución, ADR | aprobación del diseño |
| Construcción y configuración | 8–20 semanas | módulos configurados, código personalizado, canalización de datos | construcción completa, pruebas superadas |
| Pruebas y UAT | 4–8 semanas | evidencias de prueba, aprobación de UAT, cierre de defectos | aceptación |
| Despliegue y paso a producción | 2–4 semanas | producción, datos migrados, guías operativas | preparación para la puesta en marcha |
| Soporte intensivo posterior a la puesta en marcha | 2–6 semanas | operaciones estabilizadas, traspaso | cierre |

Las duraciones son orientativas; un despliegue de ventas/inventario/contabilidad para una sola compañía y 30 usuarios es muy distinto de un programa de fabricación multicompañía.

---

## 2. Descubrimiento

### 2.1 Objetivos

- comprender el modelo de negocio, la estructura organizativa y las entidades legales,
- mapear los procesos actuales y los puntos de dolor,
- inventariar las fuentes de datos y su calidad,
- identificar las restricciones normativas/de localización,
- establecer los criterios de éxito y las restricciones.

### 2.2 Artefactos

| Artefacto | Contenido |
|---|---|
| Declaración de alcance | dentro/fuera del alcance, entidades, países, usuarios |
| Mapa de procesos | situación actual y situación objetivo, por dominio |
| Auditoría de datos | fuentes, volúmenes, calidad, propiedad |
| Panorama de sistemas | ERP actual, integraciones, elaboración de informes |
| Restricciones | presupuesto, plazo, cumplimiento, alojamiento |
| Métricas de éxito | tiempo de ciclo, tasa de errores, días de cierre, adopción |

### 2.3 Talleres

Realice un taller por dominio (ventas, compras, inventario, fabricación, contabilidad, RR. HH.). Use el catálogo de casos de uso de `06-engineering/01-use-cases.md` como orden del día. Registre decisiones, no opiniones.

**Resultado:** un backlog priorizado de épicas con criterios de aceptación, no una lista de funcionalidades.

---

## 3. Ajuste y diseño

### 3.1 Matriz de ajuste (fit-gap)

| ID | Requisito | Odoo estándar | Tipo de brecha | Solución | Esfuerzo | Riesgo |
|---|---|---|---|---|---|---|
| F-001 | Presupuesto con descuentos escalonados | sí | config | tarifas | S | bajo |
| F-002 | Aprobación superior a 10 000 | parcial | custom | automatización + campo | M | medio |
| F-003 | Comisión sobre facturas pagadas | no | custom | módulo de comisiones | L | alto |
| F-004 | Ingresos según IFRS 15 | no | custom | contrato de ingresos | XL | alto |

Tipos de brecha:

- **config** — funcionalidad estándar, solo configuración,
- **process** — cambiar el proceso de negocio para adaptarlo al estándar,
- **extension** — módulo personalizado pequeño,
- **integration** — sistema externo,
- **gap** — construir o comprar una solución vertical.

### 3.2 Artefactos de diseño

- arquitectura de la solución (módulos, integraciones, flujo de datos),
- extensiones del modelo de datos (nuevos modelos/campos, diagrama ER),
- diagramas de secuencia/actividad para los flujos críticos,
- matriz de seguridad (roles × modelos × operaciones),
- estrategia de migración,
- ADR para cada decisión no obvia.

### 3.3 Lista de verificación de la revisión de diseño

- [ ] Cada requisito se asigna a un módulo/configuración/elemento personalizado.
- [ ] Sin modificaciones del núcleo.
- [ ] Cada módulo personalizado tiene un límite y un responsable claros.
- [ ] Los contratos de integración están versionados y son idempotentes.
- [ ] La migración de datos está estimada y es comprobable.
- [ ] Los roles de seguridad se definen antes de la construcción.
- [ ] Se han fijado objetivos de rendimiento.
- [ ] Se considera la ruta de actualización.

---

## 4. Construcción y configuración

### 4.1 Líneas de trabajo

| Línea de trabajo | Responsable | Entregable |
|---|---|---|
| Configuración | consultor funcional | ajustes, plan de cuentas, impuestos, rutas |
| Desarrollo personalizado | desarrollador | módulos, pruebas, migraciones |
| Migración de datos | ingeniero de datos | scripts de extracción/transformación/carga, conciliación |
| Integración | desarrollador de integraciones | conectores, outbox, monitorización |
| Informes | desarrollador de informes | QWeb/Spreadsheet/BI |
| Seguridad | arquitecto | grupos, ACL, reglas, acceso a campos |
| Gestión del cambio | PM/BA | formación, comunicación, SOP |

### 4.2 Cadencia de sprints

- sprints de 2 semanas, demostración en cada sprint,
- la definición de terminado incluye pruebas y documentación,
- configuración y código en el mismo repositorio cuando sea posible (configuración como datos/XML),
- despliegue en staging en cada sprint,
- la suite de regresión se ejecuta en cada merge.

### 4.3 Orden de construcción

1. cimientos (compañía, usuarios, seguridad, plan de cuentas),
2. datos maestros (contactos, productos, LdM, rutas),
3. flujos principales (ventas, compras, inventario),
4. integración contable,
5. fabricación/proyectos (si está en el alcance),
6. informes y cuadros de mando,
7. integraciones,
8. migración de datos,
9. ajuste de rendimiento.

---

## 5. Pruebas y UAT

### 5.1 Niveles de prueba

| Nivel | Responsable | Alcance |
|---|---|---|
| Unitarias/de integración | desarrolladores | código, invariantes, flujos |
| Pruebas de sistema | QA | de extremo a extremo, entre módulos |
| Rendimiento | QA/arquitecto | volumen, concurrencia |
| Seguridad | arquitecto | roles, portal, API |
| UAT | negocio | escenarios reales, roles reales |
| Regresión | QA | comportamiento existente tras un cambio |

### 5.2 Diseño de la UAT

- escenarios derivados de los casos de uso,
- datos similares a los de producción,
- roles de usuario reales,
- rutas de excepción (devoluciones, cancelaciones, pagos parciales),
- aprobación por dominio,
- gravedad de los defectos y criterios de salida.

### 5.3 Criterios de salida

- sin defectos críticos/altos abiertos,
- aprobación de la UAT,
- objetivos de rendimiento cumplidos,
- revisión de seguridad superada,
- migración de datos conciliada,
- guías operativas completas.

---

## 6. Despliegue y paso a producción

### 6.1 Plan de paso a producción

| Paso | Responsable | Duración | Reversión |
|---|---|---|---|
| Congelar las escrituras en el sistema heredado | negocio | T-2d | reabrir |
| Extracción final de datos | datos | T-1d | restaurar |
| Carga en producción | datos | T-0 | restaurar |
| Conciliar totales | finanzas | T-0 | corregir/restaurar |
| Prueba de humo | QA | T-0 | restaurar |
| Apertura para los usuarios | PM | T+1 | restaurar |

### 6.2 Lista de verificación del paso a producción

- [ ] Copia de seguridad verificada y restaurable.
- [ ] DNS/balanceador de carga conmutado.
- [ ] Tareas cron activas y programadas.
- [ ] Pasarelas de correo/SMS configuradas.
- [ ] Proveedores de pago activos/probados.
- [ ] Integraciones habilitadas con monitorización.
- [ ] Los usuarios pueden iniciar sesión con los grupos correctos.
- [ ] Los informes producen cifras correctas.
- [ ] Adjuntos/documentos disponibles.
- [ ] Canal de soporte abierto.

### 6.3 Decisión go/no-go

Una reunión go/no-go con el responsable de negocio, el PM, el arquitecto y finanzas. Criterios:

- defectos críticos cerrados,
- datos conciliados,
- formación completada,
- soporte preparado,
- plan de reversión probado.

---

## 7. Soporte intensivo posterior a la puesta en marcha

- reunión diaria de triaje durante las 2 primeras semanas,
- corrección de defectos priorizada,
- seguimiento de la adopción por parte de los usuarios,
- monitorización del rendimiento,
- controles de calidad de datos,
- transferencia de conocimiento y documentación,
- transición al soporte ordinario (BAU).

**Criterios de salida:** volumen de tickets estable, sin incidentes críticos durante 2 semanas, traspaso aceptado.

---

## 8. RACI

| Actividad | Patrocinador | PM | Arquitecto | Funcional | Desarrollador | QA | Negocio |
|---|---|---|---|---|---|---|---|
| Alcance | A | R | C | C | I | I | C |
| Diseño | I | A | R | C | C | I | C |
| Construcción | I | A | C | C | R | I | I |
| Pruebas | I | A | C | C | C | R | C |
| UAT | I | A | I | C | I | C | R |
| Paso a producción | A | R | C | C | C | C | C |
| Soporte intensivo | I | A | C | R | R | R | C |

R = responsable, A = accountable (autoridad final), C = consultado, I = informado.

---

## 9. Plantilla de cronograma (tamaño medio, 3 dominios)

| Mes | Hito |
|---|---|
| 1 | descubrimiento, alcance, auditoría de datos |
| 2 | ajuste, diseño de la solución, ADR |
| 3–4 | cimientos + datos maestros + flujos principales |
| 5 | integración contable, informes |
| 6 | integraciones, simulación de migración de datos |
| 7 | pruebas de sistema, rendimiento, seguridad |
| 8 | UAT, correcciones |
| 9 | paso a producción, soporte intensivo |

Debe añadirse un 20–30 % de contingencia para sorpresas de calidad de datos y localización.

---

## 10. Fallos habituales de los programas

| Fallo | Señal temprana | Prevención |
|---|---|---|
| Alcance cambiante | solicitudes del tipo «ya que estamos aquí» | control de cambios, backlog |
| Datos subestimados | datos maestros con errores | perfilado de datos en el descubrimiento |
| Sorpresa de localización | brechas fiscales/en informes | revisión contable temprana |
| Optimismo con las integraciones | «la API es sencilla» | contrato primero, idempotencia |
| Usuario clave no disponible | talleres no realizados | responsables designados, calendario |
| Pruebas comprimidas | la UAT empieza tarde | probar pronto, automatizar |
| Sin gestión del cambio | baja adopción | formación, promotores |
| Actualización en mitad del proyecto | deriva de versión | fijar la versión, congelar |

---

## 11. Evidencias y adaptación

- Adapte las fases al tamaño: un despliegue de 10 usuarios puede comprimir el descubrimiento y el diseño en 2 semanas; un programa multipaís puede tardar 18 meses.
- Las puertas son puntos de decisión, no burocracia. Omita una puerta solo con una aceptación explícita y registrada del riesgo.
- Mantenga el backlog y la matriz de ajuste como documentos vivos; son la memoria del proyecto.

Continúe con `02-estimation.md`.
