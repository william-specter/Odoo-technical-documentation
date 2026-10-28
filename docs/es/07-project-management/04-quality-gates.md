# Gestión de proyectos IV — Puertas de calidad y definición de terminado

> **Propósito.** Las puertas de calidad son puntos de decisión en los que se revisan evidencias, no reuniones en las que se intercambian opiniones. Cada puerta tiene criterios de entrada, evidencias, revisores y una decisión de apto/no apto.

---

## 1. Mapa de puertas

```mermaid
flowchart LR
    G0[G0 Discovery] --> G1[G1 Design]
    G1 --> G2[G2 Code]
    G2 --> G3[G3 Test]
    G3 --> G4[G4 UAT]
    G4 --> G5[G5 Go-live]
    G5 --> G6[G6 Closure]
```

| Puerta | Pregunta | Evidencia |
|---|---|---|
| G0 Descubrimiento | ¿El alcance es real y está financiado? | alcance, auditoría de datos, estimaciones |
| G1 Diseño | ¿Funcionará este diseño y será mantenible? | arquitectura, ADR, ER, seguridad |
| G2 Código | ¿El cambio es correcto y seguro? | revisión, pruebas, migración |
| G3 Pruebas | ¿El sistema cumple los requisitos? | informe de pruebas, rendimiento, seguridad |
| G4 UAT | ¿Lo acepta el negocio? | aprobación de UAT, cierre de defectos |
| G5 Puesta en marcha | ¿Podemos operarlo? | plan de paso a producción, guías operativas, prueba de copia de seguridad |
| G6 Cierre | ¿Está traspasado y es estable? | informe de soporte intensivo, traspaso |

---

## 2. G1 — Revisión de diseño

### 2.1 Lista de verificación

- [ ] Cada requisito se asigna a configuración/personalización/integración.
- [ ] Los límites de los módulos respetan las dependencias (sin ediciones del núcleo, sin ciclos).
- [ ] El modelo de datos utiliza la estrategia de herencia adecuada.
- [ ] Las máquinas de estados están documentadas con guardas.
- [ ] La matriz de seguridad cubre modelos, reglas, campos y portal.
- [ ] Se abordan la multicompañía y la multimoneda.
- [ ] Los contratos de integración están versionados y son idempotentes.
- [ ] La estrategia de migración está definida y estimada.
- [ ] Los objetivos de rendimiento y el conjunto de datos están definidos.
- [ ] La ruta de actualización y la fijación de versión están documentadas.
- [ ] Existen ADR para las decisiones no obvias.

### 2.2 Revisores

Arquitecto (presidente), líder funcional, líder de desarrollo, DBA/DevOps, seguridad/cumplimiento, usuario clave del dominio.

### 2.3 Criterios de salida

Documento de diseño firmado, ADR aprobados, backlog estimado, sin preguntas críticas de diseño abiertas.

---

## 3. G2 — Revisión de código

### 3.1 Comprobaciones automáticas

- lint (ruff/pylint-odoo/eslint),
- pruebas unitarias/de integración,
- instalación del módulo en una BD limpia,
- simulación de migración,
- análisis de seguridad (bandit, auditoría de dependencias),
- sin código de depuración/print/console.log,
- sin credenciales embebidas en el código.

### 3.2 Lista de verificación manual

**ORM**

- [ ] `@api.model_create_multi` para `create`.
- [ ] Se llama a `super()` en las sobrescrituras.
- [ ] Seguro para conjuntos de registros (sin `ensure_one` en bucles).
- [ ] `@api.depends` completo.
- [ ] sin `cr.commit()` en el código del modelo.
- [ ] sin SQL en crudo sin flush/parametrización.
- [ ] sin `sudo()` sin justificación.
- [ ] sin `search()` en bucles.
- [ ] sin `search([])` sin límite.

**Esquema**

- [ ] `_description`, `_order`, `_rec_name`.
- [ ] `company_id` + regla para los modelos de negocio.
- [ ] índices en las FK filtradas.
- [ ] restricciones SQL para unicidad sin condiciones de carrera.
- [ ] `ondelete` explícito.
- [ ] migración para campos eliminados/renombrados.

**Seguridad**

- [ ] ACL para todas las operaciones.
- [ ] reglas de registro por compañía/titularidad.
- [ ] grupos de campo en campos sensibles.
- [ ] los controladores llaman a `check_access`.
- [ ] rutas del portal limitadas al contacto.
- [ ] sin secretos en el código/los registros.

**Vistas/UI**

- [ ] anclas xpath estables.
- [ ] sin `position="replace"` de formularios completos.
- [ ] modificadores de acceso coherentes con los grupos.
- [ ] assets en el bundle correcto.
- [ ] traducciones para las cadenas visibles al usuario.

**Operaciones**

- [ ] cron idempotente + commits de progreso.
- [ ] llamadas externas postcommit/outbox.
- [ ] registros estructurados, sin PII.
- [ ] configuración mediante ICP/compañía, no código.
- [ ] las pruebas cubren el cambio.

### 3.3 Criterios de salida

Dos aprobaciones (autor + revisor), CI en verde, migración probada, documentación actualizada.

---

## 4. G3 — Pruebas de sistema

### 4.1 Evidencias de prueba

- plan de pruebas y resultados,
- resultados de la suite automatizada,
- resultados de rendimiento frente a objetivos,
- resultados de pruebas de seguridad,
- resultados de regresión,
- registro de defectos con gravedad.

### 4.2 Puerta de rendimiento

| Escenario | Objetivo | Resultado |
|---|---|---|
| Confirmación de pedido de venta de 50 líneas | < 2 s p95 | |
| Entrega de 100 líneas | < 3 s p95 | |
| Contabilización de factura | < 1 s p95 | |
| Listado de 100 productos | < 1 s p95 | |
| Balance de comprobación de 1 M de líneas | < 30 s | |
| Importación de 10 000 filas | < 10 min | |

Pruebe con datos similares a los de producción. El resultado sobre una BD vacía no es una evidencia.

### 4.3 Puerta de seguridad

- matriz de roles probada,
- aislamiento del portal probado,
- autenticación de la API probada,
- acceso 2FA/administrador verificado,
- secretos fuera del repositorio,
- análisis de dependencias limpio,
- hallazgos de pruebas de penetración cerrados o aceptados.

### 4.4 Puerta de datos

- simulación de migración completada,
- recuentos de filas conciliados,
- totales financieros conciliados,
- valoración de stock conciliada,
- adjuntos verificados,
- reversión probada.

---

## 5. G4 — UAT

### 5.1 Criterios de entrada

- pruebas de sistema superadas,
- entorno de UAT con datos similares a los de producción,
- usuarios formados,
- escenarios preparados,
- proceso de defectos en funcionamiento.

### 5.2 Criterios de salida

- todos los defectos críticos/altos cerrados,
- defectos medios aceptados con solución alternativa,
- aprobación de UAT por dominio,
- incidencias abiertas registradas con responsables,
- recomendación de puesta en marcha.

### 5.3 Escenarios de UAT

Use el catálogo de casos de uso. Para cada uno:

- precondición,
- pasos,
- resultado esperado,
- resultado real,
- apto/no apto,
- evidencia (captura de pantalla/ID).

Incluya las excepciones: devoluciones, cancelaciones, pagos parciales, límites de crédito, multimoneda y multicompañía.

---

## 6. G5 — Preparación para la puesta en marcha

### 6.1 Lista de verificación

- [ ] Copia de seguridad verificada y restauración probada.
- [ ] Plan de paso a producción con tiempos y responsables.
- [ ] Ejecución final de la migración de datos ensayada.
- [ ] Plan de reversión probado.
- [ ] Monitorización/alertas en funcionamiento.
- [ ] Servicio de soporte informado.
- [ ] Usuarios formados y credenciales emitidas.
- [ ] Integraciones probadas de extremo a extremo.
- [ ] Tareas cron programadas.
- [ ] Plantillas de impresión/informes verificadas.
- [ ] Aprobación legal/fiscal.
- [ ] Reunión go/no-go celebrada.

### 6.2 Criterios de reversión

Defina de antemano:

- fallo de conciliación de datos más allá de la tolerancia,
- flujo crítico no disponible,
- incidente de seguridad,
- rendimiento inaceptable,
- corrupción de datos en la integración.

La reversión es una decisión de negocio, no técnica; el PM recomienda y el patrocinador decide.

---

## 7. G6 — Cierre

- informe de soporte intensivo (incidentes, correcciones, tendencias),
- traspaso al soporte ordinario (BAU),
- documentación completa,
- registros de formación,
- backlog abierto e incidencias conocidas,
- lecciones aprendidas,
- cierre financiero,
- contrato de garantía/soporte.

---

## 8. Definición de terminado

Una historia de usuario está terminada cuando:

- [ ] código/configuración fusionados,
- [ ] pruebas escritas y superadas,
- [ ] código revisado,
- [ ] desplegado en staging,
- [ ] aceptación funcional por el propietario del producto,
- [ ] documentación actualizada,
- [ ] migración considerada,
- [ ] seguridad revisada (si procede),
- [ ] rendimiento comprobado (si es una ruta crítica),
- [ ] traducciones añadidas,
- [ ] sin nuevas advertencias de lint.

Una versión está terminada cuando:

- [ ] todas las historias cumplen la DoD,
- [ ] suite de regresión en verde,
- [ ] actualización probada sobre una copia,
- [ ] notas de la versión publicadas,
- [ ] copia de seguridad realizada,
- [ ] plan de reversión preparado.

---

## 9. Métricas de calidad

| Métrica | Objetivo |
|---|---|
| Tasa de defectos escapados | < 5 % |
| Defectos críticos abiertos en la puesta en marcha | 0 |
| Cobertura de automatización de pruebas (flujos críticos) | 100 % |
| Cobertura de revisión de código | 100 % |
| Varianza de conciliación de la migración | 0 |
| Rendimiento p95 frente al objetivo | dentro del 20 % |
| Tasa de éxito de la UAT en el primer ciclo | > 80 % |
| Incidentes críticos posteriores a la puesta en marcha | 0 |

---

## 10. Índice de evidencias

| Puerta | Artefacto |
|---|---|
| G1 | documento de arquitectura, ADR, diagrama ER |
| G2 | revisión de PR, registros de CI, pruebas |
| G3 | informe de pruebas, informe de rendimiento, informe de seguridad |
| G4 | aprobación de UAT, registro de defectos |
| G5 | plan de paso a producción, prueba de copia de seguridad, guías operativas |
| G6 | informe de soporte intensivo, traspaso |

Continúe con `05-environments-ci.md`.
