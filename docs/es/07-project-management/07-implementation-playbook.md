# Gestión de proyectos VII — Manual de implementación

> **Uso.** Una guía práctica, fase por fase, desde el arranque hasta el soporte intensivo posterior a la puesta en marcha. Adapte las duraciones al alcance; mantenga la secuencia.

---

## 1. Arranque (semana 0)

### 1.1 Entradas

- contrato/declaración de trabajo firmados,
- patrocinador y usuarios clave designados,
- acceso a los sistemas y a los datos,
- plan de alojamiento/entornos.

### 1.2 Actividades

- reunión de arranque con el patrocinador, el PM, el arquitecto, los responsables funcionales y los usuarios clave,
- confirmar alcance, calendario, gobernanza y escalado,
- acordar la cadencia y las herramientas de comunicación,
- configurar el repositorio, la CI y los entornos,
- crear el registro RAID y el registro de decisiones.

### 1.3 Resultados

- acta de constitución del proyecto,
- RACI,
- plan de comunicación,
- acceso a los entornos,
- esqueleto del backlog.

---

## 2. Descubrimiento (semanas 1–4)

### 2.1 Talleres

| Dominio | Agenda |
|---|---|
| Ventas | de presupuesto a cobro, precios, descuentos, aprobaciones, entrega, facturación |
| Compras | de solicitud a pago, aprobaciones, recepciones, conciliación a tres bandas |
| Inventario | almacenes, rutas, lotes, recuentos, valoración |
| Fabricación | LdM, hojas de ruta, planificación, costes, calidad |
| Contabilidad | plan contable, impuestos, localización, cierre, informes |
| RR. HH./Proyectos | solo si están en el alcance |

### 2.2 Auditoría de datos

- fuentes y propietarios,
- volúmenes y crecimiento,
- calidad (nulos, duplicados, formatos),
- complejidad del mapeo,
- restricciones de retención/legales.

### 2.3 Resultados

- mapas de procesos actuales,
- mapas de procesos objetivo,
- matriz de ajuste-brecha v1,
- informe de auditoría de datos,
- registro de riesgos v1,
- estimación v1.

---

## 3. Diseño (semanas 3–8)

### 3.1 Diseño de la solución

- selección de módulos y cierre de dependencias,
- libro de configuración (compañía, impuestos, rutas, tarifas, grupos),
- especificaciones de módulos personalizados,
- extensiones del modelo de datos,
- contratos de integración,
- matriz de seguridad,
- catálogo de informes,
- estrategia de migración.

### 3.2 Autoridad de diseño

Revisión semanal con el arquitecto, el responsable funcional y el responsable de desarrollo. Aprobar los ADR; rechazar la expansión del alcance.

### 3.3 Resultados

- documento de arquitectura de la solución,
- ADR,
- diagramas ER,
- diagramas de secuencia/actividad para los flujos críticos,
- backlog con estimaciones,
- registro de riesgos actualizado.

---

## 4. Construcción (semanas 6–20)

### 4.1 Fundamentos

1. crear la compañía/las compañías,
2. configurar el plan contable, los impuestos y las posiciones fiscales,
3. usuarios, grupos, ACL y reglas de registro,
4. secuencias, diarios, métodos de pago,
5. almacenes, ubicaciones, rutas, tipos de operación,
6. categorías de producto, UdM, tarifas.

### 4.2 Datos maestros

- socios (clientes, proveedores, contactos),
- productos/plantillas/variantes,
- LdM/hojas de ruta/centros de trabajo,
- tarifas/descuentos,
- saldos iniciales (más adelante).

### 4.3 Flujos principales

- ventas: presupuesto → confirmar → entregar → facturar → cobrar,
- compras: SdP → aprobar → recibir → facturar → pagar,
- inventario: transferencia, ajuste, devolución, desecho,
- fabricación: LdM → OF → orden de trabajo → finalizado,
- contabilidad: asiento contable, conciliación, cierre.

### 4.4 Desarrollo personalizado

- seguir la estructura de módulos descrita en `01-business-logic/03-service-layer.md`,
- escribir pruebas con cada historia,
- scripts de migración desde el primer día,
- puerta de revisión de código.

### 4.5 Migración de datos

- construir scripts de extracción/transformación/carga,
- usar identificadores externos para la idempotencia,
- conciliar recuentos y totales,
- ejecución de prueba en staging en cada sprint,
- documentar el mapeo.

### 4.6 Integraciones

- contrato primero,
- autenticación y gestión de errores,
- idempotencia/outbox,
- pruebas en sandbox,
- monitorización.

---

## 5. Pruebas (semanas 16–24)

- prueba del sistema (de extremo a extremo),
- suite de regresión,
- prueba de rendimiento con datos similares a producción,
- prueba de seguridad (roles, portal, API),
- ensayo de migración,
- escenarios y datos de UAT,
- triaje de defectos.

**Salida:** sin defectos críticos/altos, objetivos de rendimiento cumplidos, aprobación de UAT.

---

## 6. Paso a producción (semanas 24–26)

### 6.1 Plan T-menos

| Momento | Actividad | Responsable |
|---|---|---|
| T-10d | congelar el alcance, plan final de extracción de datos | PM |
| T-7d | ejecución de prueba final, conciliar | Datos |
| T-3d | comunicaciones a los usuarios, turnos de soporte | Cambio |
| T-2d | copia de seguridad, congelar escrituras en el sistema heredado | DevOps/Negocio |
| T-1d | extracción/carga final | Datos |
| T-0 | conciliar, prueba de humo, decisión de continuar o no | Finanzas/QA/Patrocinador |
| T+1 | abrir a los usuarios, comienza el soporte intensivo | PM |

### 6.2 Guía operativa del paso a producción

- paso, responsable, duración, dependencia, verificación, reversión,
- comunicación en cada hito,
- puente de sala de crisis,
- registro de decisiones.

### 6.3 Decisión de continuar o no

- datos conciliados,
- flujos críticos superados,
- seguridad verificada,
- soporte preparado,
- reversión probada.

---

## 7. Soporte intensivo posterior a la puesta en marcha (semanas 26–32)

### 7.1 Cadencia

- triaje diario (15 min),
- estado diario al patrocinador,
- informe de tendencias semanal,
- SLA de defectos: crítico 4 h, alto 1 d, medio 3 d.

### 7.2 Enfoque

- estabilizar los flujos,
- corregir problemas de datos,
- ajustar el rendimiento,
- formar a los usuarios rezagados,
- documentar las soluciones alternativas,
- cerrar los elementos abiertos.

### 7.3 Criterios de salida

- sin incidentes críticos durante 2 semanas,
- volumen de tickets en descenso,
- usuarios formados,
- guías operativas y traspaso aceptados,
- contrato de soporte activo.

---

## 8. Traspaso

- arquitectura y ADR,
- libro de configuración,
- documentación de los módulos personalizados,
- mapeo de datos y ETL,
- contratos de integración y monitorización,
- guías operativas,
- accesos/credenciales,
- backlog e incidencias conocidas,
- registros de formación.

---

## 9. Plan rápido de 90 días (despliegue pequeño)

| Semana | Enfoque |
|---|---|
| 1 | arranque, talleres de descubrimiento |
| 2 | ajuste-brecha, auditoría de datos |
| 3 | diseño, configuración del entorno |
| 4 | configuración de los fundamentos |
| 5 | datos maestros, ventas/compras principales |
| 6 | inventario, contabilidad |
| 7 | módulos personalizados, informes |
| 8 | ejecución de prueba de la migración de datos |
| 9 | prueba del sistema, rendimiento |
| 10 | UAT |
| 11 | correcciones, ensayo del paso a producción |
| 12 | puesta en marcha, inicio del soporte intensivo |

Este plan es agresivo; presupone un alcance pequeño, datos limpios y un equipo en la misma ubicación.

---

## 10. Antipatrones del manual

| Antipatrón | Consecuencia |
|---|---|
| Construir antes de la aprobación del diseño | retrabajo |
| Configurar producción directamente | sin reversión |
| Migrar los datos al final | sorpresas, retraso |
| Omitir la UAT | fallo de adopción |
| Sin ensayo del paso a producción | desbordamiento |
| Sin soporte intensivo | usuarios huérfanos |
| Sin traspaso | dependencia del proveedor |
| Sin control de cambios | expansión del alcance |

---

## 11. Lista de verificación de artefactos

- [ ] acta de constitución, RACI, plan de comunicación
- [ ] mapas de procesos (actuales/objetivo)
- [ ] matriz de ajuste-brecha
- [ ] arquitectura de la solución + ADR
- [ ] libro de configuración
- [ ] mapeo de datos + ETL + conciliación
- [ ] contratos de integración
- [ ] matriz de seguridad
- [ ] plan de pruebas + resultados
- [ ] aprobación de UAT
- [ ] plan del paso a producción + ensayo
- [ ] guías operativas
- [ ] materiales de formación
- [ ] informe de soporte intensivo
- [ ] aprobación del traspaso

Continúe con `08-templates.md`.
