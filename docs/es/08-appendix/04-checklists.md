# Apéndice D — Listas de verificación

> **Uso.** Copie la lista de verificación correspondiente en el ticket/PR/runbook. Una lista de verificación solo es útil si la firma una persona con nombre y apellidos.

---

## 1. Revisión de arquitectura

- [ ] Alcance y no objetivos documentados.
- [ ] El grafo de dependencias de módulos es acíclico y está declarado.
- [ ] Sin modificaciones al código fuente del núcleo.
- [ ] Los módulos personalizados tienen una única responsabilidad.
- [ ] Estrategia de herencia elegida deliberadamente (`_inherit`/prototipo/`_inherits`/mixin).
- [ ] Máquinas de estados documentadas con guardas.
- [ ] Modelo de seguridad: grupos, ACL, reglas de registro, grupos de campos, portal.
- [ ] Multicompañía y multimoneda contemplados.
- [ ] Contratos de integración versionados, idempotentes y monitorizados.
- [ ] Estrategia de migración de datos y conciliación.
- [ ] Objetivos de rendimiento y conjunto de datos.
- [ ] Ruta de actualización y fijación de versiones.
- [ ] ADR para decisiones no obvias.
- [ ] Observabilidad: registros, métricas, alertas.
- [ ] Copia de seguridad/restauración y rollback.

---

## 2. Revisión de código

### ORM
- [ ] `@api.model_create_multi` en `create`.
- [ ] `super()` en cada sobrescritura.
- [ ] Seguro para conjuntos de registros (sin `ensure_one` en bucles).
- [ ] `@api.depends` completo.
- [ ] Sin `cr.commit()`/`cr.rollback()` en el código del modelo.
- [ ] Sin SQL directo sin flush/parametrización.
- [ ] Sin `sudo()` sin justificación.
- [ ] Sin N+1 ni `search([])` sin límites.
- [ ] Sin valores predeterminados mutables (`{}`/`[]`) en campos.
- [ ] Sin `NewId` persistido.

### Esquema
- [ ] `_description`, `_order` (con `id`), `_rec_name`.
- [ ] `company_id` + regla de registro para modelos de negocio.
- [ ] Índices en FK filtradas.
- [ ] Restricciones SQL para unicidad sin carreras.
- [ ] `ondelete` explícito.
- [ ] Migración para campos eliminados/renombrados/obligatorios.
- [ ] `_check_company_auto` + `check_company=True`.

### Seguridad
- [ ] ACL para cada operación.
- [ ] Reglas de registro para propiedad/empresa.
- [ ] Grupos de campos en campos sensibles.
- [ ] Los controladores llaman a `check_access`.
- [ ] Rutas de portal acotadas al contacto.
- [ ] Sin secretos en el código/los registros.
- [ ] Acciones de servidor restringidas al grupo de sistema.

### Vistas/UI
- [ ] Anclas xpath estables.
- [ ] Sin `position="replace"` sobre el formulario completo.
- [ ] Modificadores de acceso coherentes con los grupos.
- [ ] Assets en el bundle correcto.
- [ ] Traducciones para las cadenas visibles al usuario.
- [ ] Comprobación en móvil/tableta (si procede).

### Operaciones
- [ ] Cron idempotente + commits de progreso.
- [ ] Llamadas externas en postcommit/outbox.
- [ ] Registros estructurados, sin PII.
- [ ] Configuración mediante ICP/compañía.
- [ ] Las pruebas cubren el cambio.
- [ ] Documentación/ADR actualizados.

---

## 3. Revisión de seguridad

- [ ] Modelo de amenazas para la funcionalidad.
- [ ] Método de autenticación adecuado.
- [ ] Autorización a nivel de modelo y de registro.
- [ ] Mínimo privilegio para usuarios de API/integración.
- [ ] Acceso de portal/público acotado.
- [ ] Validación de la carga de archivos.
- [ ] Sin inyección SQL.
- [ ] Sin XSS en QWeb/HTML.
- [ ] CSRF en rutas que cambian estado.
- [ ] Secretos fuera de la base de datos.
- [ ] 2FA para administradores.
- [ ] Registro de auditoría para acciones sensibles.
- [ ] Escaneo de dependencias.
- [ ] Hallazgos de pruebas de penetración cerrados.

---

## 4. Revisión de rendimiento

- [ ] Conjunto de datos definido (volúmenes, crecimiento).
- [ ] Rutas críticas identificadas.
- [ ] `search()` acotado.
- [ ] Las agregaciones usan `_read_group`.
- [ ] Índices verificados con `EXPLAIN`.
- [ ] Sin escaneos secuenciales en tablas grandes.
- [ ] Cálculos por lotes; dependencias completas.
- [ ] Prefetch controlado.
- [ ] Sin `flush()` por registro.
- [ ] Transacciones largas evitadas.
- [ ] Pool de workers/conexiones dimensionado.
- [ ] Réplica de lectura para informes (si es necesario).
- [ ] Prueba de rendimiento a 2× el pico.
- [ ] Objetivos de p95 cumplidos.

---

## 5. Migración de datos

- [ ] Origen perfilado (filas, nulos, duplicados, formatos).
- [ ] Mapeo aprobado por el negocio.
- [ ] Estrategia de ID externo.
- [ ] Scripts idempotentes.
- [ ] Orden de carga definido.
- [ ] Métricas de conciliación y tolerancia.
- [ ] Prueba en seco en preproducción.
- [ ] Plan de rollback.
- [ ] Adjuntos/filestore gestionados.
- [ ] Momento del paso a producción y congelación.
- [ ] Validación posterior a la carga (recuentos, totales, muestras).

---

## 6. Actualización

- [ ] Copia de seguridad de la base de datos + filestore verificada.
- [ ] Restauración en preproducción probada.
- [ ] Módulos instalados y código personalizado inventariados.
- [ ] APIs/modelos obsoletos eliminados.
- [ ] Scripts de migración probados.
- [ ] Registros `noupdate` revisados.
- [ ] Vistas validadas.
- [ ] Pruebas superadas.
- [ ] Flujos de prueba de humo superados.
- [ ] Totales de contabilidad/stock conciliados.
- [ ] Tareas cron activas.
- [ ] Rollback probado.
- [ ] Ventana de mantenimiento programada.

---

## 7. Puesta en marcha

- [ ] Aprobación (go/no-go) del patrocinador.
- [ ] Copia de seguridad verificada y restaurable.
- [ ] Plan de paso a producción con responsables/tiempos.
- [ ] Carga final de datos ensayada.
- [ ] Conciliación aprobada.
- [ ] Flujos críticos probados con pruebas de humo.
- [ ] Usuarios formados y credenciales emitidas.
- [ ] Servicio de soporte informado.
- [ ] Monitorización/alertas activas.
- [ ] Integraciones habilitadas y monitorizadas.
- [ ] Proveedores de correo/SMS/pagos activos.
- [ ] Plantillas de impresión/informes verificadas.
- [ ] Aprobación legal/fiscal.
- [ ] Criterios de rollback acordados.

---

## 8. Soporte intensivo

- [ ] Triaje diario programado.
- [ ] Severidad/SLA acordados.
- [ ] Ruta de escalado.
- [ ] Registro de problemas conocidos.
- [ ] Métricas de adopción.
- [ ] Monitorización del rendimiento.
- [ ] Comprobaciones de calidad de datos.
- [ ] Transferencia de conocimiento.
- [ ] Lista de verificación de traspaso.
- [ ] Criterios de salida.

---

## 9. Preparación del soporte

- [ ] Guías operativas: reinicio, restauración, cron, bloqueos, integración, rollback.
- [ ] Turnos de guardia.
- [ ] Cuadros de mando de monitorización.
- [ ] Enrutamiento de alertas.
- [ ] Gestión de accesos.
- [ ] Simulacro de copia de seguridad/restauración.
- [ ] Proceso de incidentes.
- [ ] Escalado con el proveedor.
- [ ] Índice de documentación.
- [ ] Registros de formación.

---

## 10. Plantilla de aprobación

```markdown
# Checklist Sign-off

- Checklist: <name>
- Release/Change: <id>
- Date:
- Reviewer:
- Evidence links:

| Item | Status | Comment |
|---|---|---|

Decision: approved / approved with conditions / rejected
Conditions:
```

Continúe con `05-sources.md`.
