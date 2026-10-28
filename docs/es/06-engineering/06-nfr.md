# Ingeniería de software VI — Requisitos no funcionales

> **Propósito.** Requisitos no funcionales (RNF) que deben especificarse antes de construir, no descubrirse en producción. Cada requisito es medible y está vinculado a un mecanismo de Odoo o a un control operativo.

---

## 1. Disponibilidad

| Requisito | Objetivo | Mecanismo |
|---|---|---|
| Disponibilidad en horario laboral | 99.5% | workers redundantes, base de datos monitorizada |
| Disponibilidad en el cierre de mes | 99.9% | ventana de mantenimiento, réplica de lectura para informes |
| Tiempo de inactividad planificado | < 4 h/mes | reinicios escalonados, actualizaciones probadas en staging |
| Objetivo de tiempo de recuperación (RTO) | < 4 h | restauración desde copia de seguridad/réplica |
| Objetivo de punto de recuperación (RPO) | < 15 min | archivado WAL / réplica en streaming |

**Realidad de Odoo:** no existe alta disponibilidad (HA) integrada. Se necesita:

- un balanceador de carga con comprobaciones de estado,
- varios workers de Odoo detrás de él,
- replicación en streaming de PostgreSQL o HA gestionada,
- filestore compartido (NFS/S3) o sincronización por worker,
- afinidad de sesión o un almacén de sesiones compartido,
- un singleton de cron (solo un worker ejecuta cron, o bloqueo distribuido).

**[WARNING]** Dos clústeres de Odoo que escriben en la misma base de datos sin coordinación ejecutarán dos veces los trabajos cron y corromperán las secuencias. Utilice una sola instancia de cron o bloqueos de asesoramiento (advisory locks).

---

## 2. Rendimiento

| Escenario | objetivo p95 | Medición |
|---|---|---|
| Página interactiva | < 2 s | navegador/APM |
| Lectura JSON-RPC | < 500 ms | prueba de carga |
| Confirmación de pedido de venta (50 líneas) | < 2 s | generador de perfiles |
| Validación de picking (100 líneas) | < 3 s | generador de perfiles |
| Contabilización de factura | < 1 s | generador de perfiles |
| Informe (1 año, 1M líneas) | < 30 s | medición de tiempos SQL |
| Importación por lotes (10k filas) | < 10 min | registro de cron |

Defina el conjunto de datos: número de productos, contactos, pedidos abiertos, movimientos de stock por mes y líneas de factura por año. El rendimiento sobre una base de datos vacía carece de sentido.

---

## 3. Escalabilidad

| Dimensión | Objetivo de diseño | Límite |
|---|---|---|
| Usuarios concurrentes | 200 | workers × hilos |
| Pedidos/día | 10,000 | rendimiento de escritura de la BD |
| SKU | 100,000 | consultas de producto/variante |
| Movimientos de stock/mes | 1,000,000 | tamaño de tabla/índice |
| Líneas de factura/año | 5,000,000 | informes |
| Adjuntos | 1 TB | filestore/copia de seguridad |
| Compañías | 50 | reglas de registro/multicompañía |

Palancas de escalado, en orden:

1. optimización de consultas/índices,
2. ajuste de workers/conexiones,
3. réplica de lectura para informes,
4. archivado/particionado,
5. escalado horizontal (workers sin estado + BD compartida),
6. servicios externos para trabajo pesado (BI, búsqueda, integraciones).

---

## 4. Seguridad

| Requisito | Control |
|---|---|
| Autenticación | sesión + política de contraseñas + 2FA para administradores |
| Autorización | ACL + reglas de registro + grupos de campos |
| Mínimo privilegio | usuarios de API dedicados, grupos mínimos |
| Cifrado en tránsito | TLS en todas partes, HSTS |
| Cifrado en reposo | cifrado de disco/BD (Odoo no cifra campos por defecto) |
| Secretos | variables de entorno/gestor de secretos, no ICP |
| Auditoría | `mail.tracking`, `ir.logging`, auditoría de BD |
| Gestión de vulnerabilidades | versiones fijadas, monitorización de CVE, escaneo de dependencias |
| Prueba de penetración | antes de la puesta en marcha y anualmente |
| Residencia de datos | ubicación de la base de datos/filestore |

**[WARNING]** Odoo no cifra campos individuales. Los datos sensibles (salario, salud, credenciales) requieren cifrado de columna, un gestor de secretos o un almacén separado.

---

## 5. Auditabilidad

| Evento | Evidencia | Retención |
|---|---|---|
| Cambios de campos | `mail.tracking.value` | según la política |
| Contabilización de documentos | `account.move` + hash | legal (7–10 años) |
| Acceso | registros del servidor web, `ir.logging` | 1 año |
| Cambios de configuración | `ir.model.data`, auditoría de BD | 1–7 años |
| Integraciones | outbox/registro de eventos | 1–3 años |
| Eliminaciones | registros de `unlink` (logger) | 1 año |

Requisitos:

- los registros de auditoría deben ser inmutables (sin edición en la UI),
- marcas de tiempo en UTC,
- id de usuario e IP cuando corresponda,
- id de correlación para las integraciones.

---

## 6. Calidad de datos

| Requisito | Control |
|---|---|
| Campos obligatorios | `required=True` + SQL NOT NULL |
| Unicidad | restricciones únicas de SQL |
| Integridad referencial | FK + `ondelete` |
| Duplicados | reglas de deduplicación de contactos/productos, `base_vat` |
| Completitud | validación de importaciones, paneles |
| Puntualidad | SLA en las integraciones |
| Consistencia | informes de conciliación |

La calidad de los datos es un proceso, no una restricción. Asigne responsabilidad por dominio (cliente, proveedor, producto, plan contable).

---

## 7. Localización y cumplimiento

| Requisito | Control |
|---|---|
| Plan contable | un `l10n_<country>` por compañía |
| Reglas de impuestos | localización + posiciones fiscales |
| Facturación electrónica | `account_edi*` + conector del país |
| Informes legales | localización de `account_reports` |
| Nómina | localización del país + revisión legal |
| Retención | política de archivo legal |
| RGPD | minimización de datos, proceso de supresión, DPA |
| SOX/ITGC | gestión de cambios, revisiones de acceso, segregación de funciones |

**[WARNING]** La cobertura de localizaciones de Odoo varía. Verifique el país y la versión específicos con un contable, no solo el nombre del módulo.

---

## 8. Mantenibilidad

| Requisito | Control |
|---|---|
| Sin modificaciones del núcleo | solo módulos personalizados |
| Control de versiones | Git, una rama por entorno |
| Revisión de código | obligatoria para `_inherit`, seguridad, migraciones |
| Pruebas | unitarias + integración + tour para flujos críticos |
| Documentación | ADR, diccionario de datos, runbooks |
| Ruta de actualización | versión fijada, scripts de migración |
| Higiene de dependencias | módulos mínimos, versiones fijadas |
| Observabilidad | registros estructurados, métricas, trazas |

---

## 9. Observabilidad

| Señal | Origen | Alerta |
|---|---|---|
| Tasa de HTTP 5xx | proxy inverso | > 1% durante 5 min |
| Latencia p95 | APM/registro de acceso | > 2 s durante 10 min |
| Conexiones a BD | `pg_stat_activity` | > 80% del máximo |
| Transacciones largas | `pg_stat_activity` | > 5 min |
| Esperas de bloqueo | `pg_locks` | > 30 s |
| Fallos de cron | `ir.cron.failure_count` | > 3 |
| Uso de disco | SO | > 80% |
| Tamaño del filestore | SO/S3 | crecimiento > 20%/semana |
| Éxito de la copia de seguridad | trabajo de copia | cualquier fallo |
| Retraso de replicación | PostgreSQL | > 60 s |

Los registros deben incluir el id de solicitud, el id de usuario, la base de datos y la duración. No registre secretos ni cargas útiles completas que contengan datos personales.

---

## 10. Copias de seguridad y recuperación ante desastres

| Elemento | Requisito |
|---|---|
| Copia de seguridad de la base de datos | completa diaria + archivado WAL |
| Copia de seguridad del filestore | incremental diaria, misma retención |
| Prueba de restauración | mensual, cronometrada |
| Copia externa | cifrada, región separada |
| Retención | 30 diarias, 12 mensuales, 7 anuales (política) |
| RTO/RPO | documentados y probados |
| Guía operativa | restauración paso a paso + validación |

**[INVARIANT]** Una copia de seguridad no es válida hasta que se restaura y se somete a una prueba de humo. Incluya el filestore y verifique los adjuntos.

---

## 11. Usabilidad y accesibilidad

- backend responsive para escritorio/tableta,
- navegación por teclado para pantallas de alto volumen,
- WCAG 2.1 AA cuando sea legalmente exigible (el núcleo es parcial),
- UI e informes traducidos,
- fechas con reconocimiento de zona horaria,
- mensajes de error claros (use `UserError`, no trazas de pila).

---

## 12. Operabilidad

| Requisito | Control |
|---|---|
| Despliegue | reproducible (contenedores/ansible), versionado |
| Reversión | restauración de BD+filestore o blue/green |
| Modo de mantenimiento | drenar workers, bloquear escrituras |
| Indicadores de funcionalidad | ICP/ajustes de compañía |
| Guías operativas | actualización, restauración, incidencia, cierre |
| Guardia | escalado, responsabilidad |
| Planificación de capacidad | revisión trimestral |

---

## 13. Lista de verificación de aceptación de RNF

- [ ] Rendimiento probado con datos similares a producción.
- [ ] Prueba de carga al 2× del pico.
- [ ] Restauración de copia de seguridad probada.
- [ ] Conmutación por error probada.
- [ ] Revisión de seguridad/prueba de penetración realizada.
- [ ] Revisión de accesos completada.
- [ ] Pistas de auditoría verificadas.
- [ ] Localización aprobada por el contable.
- [ ] Monitorización/alertas activas.
- [ ] Guías operativas escritas y ensayadas.
- [ ] RTO/RPO cumplidos en un simulacro.
- [ ] Ruta de actualización probada sobre una copia.

---

## 14. Índice de evidencia

| Tema | Archivo |
|---|---|
| Configuración de workers | `tools/config.py:393-491` |
| Pool de conexiones | `sql_db.py:610-690` |
| Cron | `addons/base/models/ir_cron.py` |
| Bus | `addons/bus/models/bus.py` |
| Adjuntos | `addons/base/models/ir_attachment.py` |
| Fechas de bloqueo | `addons/account/models/company.py:76-112` |
| Seguimiento | `addons/mail/models/mail_thread.py` |

Continúe con `07-testing-strategy.md`.
