# Gestión de proyectos VIII — Plantillas de documentos

> **Uso.** Copie estas plantillas en el repositorio de su proyecto. Manténgalas breves y actualizadas; un documento obsoleto es peor que ningún documento.

---

## 1. Registro de decisiones de arquitectura (ADR)

```markdown
# ADR-0001: <Title>

- Estado: propuesto | aceptado | reemplazado | rechazado
- Fecha: YYYY-MM-DD
- Decisores: <names>
- Relacionado: <links>

## Contexto

¿Qué problema se está resolviendo? ¿Qué restricciones (versión de Odoo, módulos, datos,
rendimiento, cumplimiento) se aplican?

## Opciones

### Opción A — <name>
- Descripción
- Ventajas
- Inconvenientes
- Coste/esfuerzo

### Opción B — <name>
...

## Decisión

Se elige la opción X porque ...

## Consecuencias

- Positivas:
- Negativas:
- Migración/reversión:
- Acciones de seguimiento:

## Evidencias

- Referencias a fuentes:
- Prototipo/benchmark:
```

---

## 2. Especificación de la solución

```markdown
# Especificación de la solución: <Feature>

## 1. Resumen
Un párrafo.

## 2. Contexto de negocio
Actores, proceso, frecuencia, volumen, problemas.

## 3. Requisitos
| ID | Requisito | Prioridad | Aceptación |
|---|---|---|---|

## 4. Alcance
Dentro del alcance / fuera del alcance.

## 5. Diseño en Odoo
- Módulos:
- Modelos (nuevos/extendidos):
- Campos:
- Máquina de estados:
- Seguridad (grupos/ACL/reglas):
- Vistas/acciones:
- Automatización/cron:
- Informes:

## 6. Modelo de datos
Diagrama ER + definiciones de tabla/campo.

## 7. Flujos
Diagramas de secuencia/actividad.

## 8. Integración
Contratos, autenticación, idempotencia, reintentos, monitorización.

## 9. Migración
Mapeo de datos, scripts, conciliación.

## 10. Rendimiento
Conjunto de datos, objetivos, índices.

## 11. Pruebas
Unitarias/de integración/tour/rendimiento/seguridad.

## 12. Riesgos
| Riesgo | Mitigación |

## 13. Preguntas abiertas
```

---

## 3. Plan de pruebas

```markdown
# Plan de pruebas: <Release>

## 1. Alcance
Qué se prueba / qué no se prueba.

## 2. Entornos
URL, base de datos, conjunto de datos, versión.

## 3. Roles
Quién prueba qué.

## 4. Escenarios
| ID | Escenario | Precondición | Pasos | Esperado | Real | Estado |

## 5. No funcionales
| Tipo | Objetivo | Resultado |

## 6. Defectos
| ID | Gravedad | Descripción | Responsable | Estado |

## 7. Criterios de salida
- críticos/altos cerrados
- aprobación de UAT
- rendimiento cumplido

## 8. Aprobación
Nombre, rol, fecha.
```

---

## 4. Lista de verificación del paso a producción

```markdown
# Plan del paso a producción: <Release>

## Cronograma
| T | Actividad | Responsable | Duración | Verificar | Reversión |

## Requisitos previos
- [ ] copia de seguridad verificada
- [ ] extracción final lista
- [ ] usuarios notificados
- [ ] turnos de soporte
- [ ] reversión probada

## Continuar/No continuar
| Criterio | Responsable | Estado |

## Comunicación
| Momento | Audiencia | Canal | Mensaje |

## Posterior al paso a producción
- [ ] pruebas de humo
- [ ] conciliación
- [ ] monitorización
- [ ] inicio del soporte intensivo
```

---

## 5. Registro RAID

```markdown
# Registro RAID

## Riesgos
| ID | Riesgo | P | I | Puntuación | Mitigación | Responsable | Disparador | Estado |

## Supuestos
| ID | Supuesto | Impacto si es falso | Responsable | Validar antes de |

## Incidencias
| ID | Incidencia | Gravedad | Responsable | Vencimiento | Estado | Resolución |

## Dependencias
| ID | Dependencia | Responsable | Necesaria para | Estado | Impacto |
```

---

## 6. Solicitud de cambio

```markdown
# Solicitud de cambio CR-<NN>

- Solicitada por:
- Fecha:
- Épica/historia relacionada:

## Descripción
Qué se solicita y por qué.

## Impacto
- Alcance:
- Calendario:
- Coste (persona-día):
- Arquitectura:
- Datos/migración:
- Seguridad:
- Pruebas:

## Opciones
1. Hacerlo ahora
2. Aplazarlo a la fase 2
3. Rechazar

## Decisión
Aprobada/rechazada por: <sponsor> el <date>.

## Implementación
Épica/historias, responsable, versión objetivo.
```

---

## 7. Especificación del mapeo de datos

```markdown
# Mapeo de datos: <Source> → Odoo

## Perfil de origen
- Sistema:
- Tabla/vista:
- Filas:
- Propietario:
- Notas de calidad:

## Mapeo
| Campo de origen | Odoo model.field | Tipo | Transformación | Obligatorio | Predeterminado | Notas |

## Claves
- Estrategia de ID externo:
- Deduplicación:
- Idempotencia:

## Conciliación
| Métrica | Origen | Odoo | Tolerancia |

## Paso a producción
- Ventana de extracción:
- Orden de carga:
- Reversión:
```

---

## 8. Lista de verificación de revisión de código

```markdown
# Revisión de código: <PR>

## Corrección
- [ ] requisito cumplido
- [ ] casos límite tratados
- [ ] guardas de estado
- [ ] idempotente

## Odoo
- [ ] `_inherit` + `super()`
- [ ] seguro para conjuntos de registros
- [ ] `@api.depends` completo
- [ ] sin `cr.commit()`
- [ ] sin SQL en bruto sin flush
- [ ] sin `sudo()` sin justificación
- [ ] sin búsquedas N+1/ilimitadas

## Esquema
- [ ] `_description`, `_order`, `_rec_name`
- [ ] company_id + regla
- [ ] índices
- [ ] restricciones
- [ ] migración

## Seguridad
- [ ] ACL
- [ ] reglas de registro
- [ ] grupos de campos
- [ ] comprobaciones de acceso del controlador
- [ ] sin secretos

## Pruebas
- [ ] unitarias/de integración
- [ ] tour (si hay UI)
- [ ] rendimiento (si es crítico)
- [ ] migración

## Documentación
- [ ] ADR/especificación actualizados
- [ ] registro de cambios
```

---

## 9. Guía operativa

```markdown
# Guía operativa: <Operation>

## Disparador
Cuándo usar esta guía operativa.

## Impacto
Qué se ve afectado y durante cuánto tiempo.

## Comprobaciones previas
- [ ] copia de seguridad
- [ ] acceso
- [ ] ventana de mantenimiento

## Pasos
1. ...
2. ...

## Verificación
- [ ] comprobación de estado
- [ ] prueba de humo
- [ ] conciliación

## Reversión
1. ...

## Escalado
| Nivel | Contacto | Cuándo |
```

---

## 10. Traspaso

```markdown
# Traspaso: <Project>

## Alcance entregado
## Arquitectura
## Entornos
## Accesos/credenciales (transferencia segura)
## Guías operativas
## Monitorización/alertas
## Incidencias abiertas/backlog
## Modelo de soporte/SLA
## Registros de formación
## Garantía
## Aprobación
```

---

## 11. Convenciones de documentos

- un documento = una decisión o un plan,
- versionar y fechar cada documento,
- enlazar a la fuente/evidencia,
- mantener las plantillas en el repositorio, no en una wiki que se desactualiza,
- revisar en cada puerta.

Continúe con el Volumen 8: apéndice.
