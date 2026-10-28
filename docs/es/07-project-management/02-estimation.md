# Gestión de proyectos II — Estimación y presupuesto

> **Advertencia.** Las estimaciones de Odoo fallan con mayor frecuencia en los **datos**, la **localización** y la **integración**, no en el número de pantallas. Una pantalla CRUD «sencilla» es barata; una migración conciliada de 10 años de facturas no lo es.

---

## 1. Unidades de estimación

Use **persona-días (PD)** a razón de 6 horas productivas. Evite los story points para el trabajo a precio fijo; utilícelos solo para la velocidad dentro de un sprint.

| Tamaño | PD | Ejemplo |
|---|---|---|
| XS | 0,5–1 | añadir un campo + vista + ACL |
| S | 1–3 | módulo pequeño, un flujo |
| M | 4–10 | módulo con 2–3 modelos, pruebas, migración |
| L | 11–25 | funcionalidad entre módulos, integración |
| XL | 26–60 | subsistema (comisiones, reconocimiento de ingresos) |
| XXL | 60+ | vertical/APS/WMS |

---

## 2. Fórmula de estimación

```
Total = Σ (base effort × complexity × risk)
      + data migration
      + integration
      + testing/UAT support
      + project management
      + contingency
```

### 2.1 Esfuerzo base por tipo de trabajo

| Tipo de trabajo | PD base | Notas |
|---|---|---|
| Configuración (por dominio) | 3–10 | ajustes, impuestos, rutas, plan contable |
| Módulo CRUD sencillo | 1–3 | un modelo, vistas, ACL |
| Módulo de negocio | 5–15 | 2–4 modelos, máquina de estados, pruebas |
| Funcionalidad entre módulos | 10–25 | afecta a sale/stock/account |
| Informe (QWeb) | 1–3 | diseño + datos |
| Informe (financiero/BI) | 5–15 | agregación, conciliación |
| Integración (REST sencilla) | 5–10 | un endpoint, autenticación, reintentos |
| Integración (bidireccional) | 15–40 | mapeo, conflictos, monitorización |
| Migración de datos (por entidad) | 2–10 | depende de la calidad/volumen |
| Modelo de seguridad | 2–8 | roles, reglas, pruebas |
| Ajuste de rendimiento | 3–10 | perfilado, índices, refactorización |
| Actualización (versión mayor) | 10–30 % de la construcción | migraciones, regresión |

### 2.2 Multiplicadores de complejidad

| Factor | Multiplicador |
|---|---|
| Una sola compañía, una sola moneda | 1,0 |
| Multicompañía | 1,2–1,4 |
| Multimoneda | 1,1–1,3 |
| Multilingüe | 1,1–1,2 |
| Regulado (SOX, GxP) | 1,3–1,5 |
| Localización personalizada | 1,2–1,5 |
| Calidad deficiente de los datos heredados | 1,3–2,0 |
| Integración en tiempo real | 1,3–1,6 |
| Volumen alto (> 1 M de movimientos/año) | 1,2–1,5 |
| Sin conexión/móvil | 1,3–1,6 |

### 2.3 Contingencia por riesgo

| Nivel de riesgo | Contingencia |
|---|---|
| Bajo (estándar, datos conocidos) | 10 % |
| Medio (algo de personalización, datos de calidad media) | 20 % |
| Alto (dominio nuevo, datos deficientes, muchas integraciones) | 30–40 % |

La contingencia no es un colchón; es el coste esperado de las incógnitas conocidas. Debe rastrearse por separado.

---

## 3. Factores que dominan

### 3.1 Migración de datos

Estime por entidad:

| Entidad | Factor | Orientación en PD |
|---|---|---|
| Contactos | duplicados, validación del IVA, direcciones | 2–5 |
| Productos/variantes | atributos, UdM, categorías | 3–8 |
| Stock inicial | lotes, ubicaciones, valoración | 5–15 |
| Pedidos abiertos | líneas, precios, impuestos | 3–8 |
| Facturas abiertas | conciliación, residuales | 5–15 |
| Plan de cuentas | mapeo, saldos | 5–15 |
| Activos fijos | coste, historial de amortización | 3–10 |
| LdM/hojas de ruta | estructura, centros de trabajo | 3–10 |
| Adjuntos | volumen, nomenclatura, enlaces | 2–8 |

**Regla general:** la migración de datos representa el 20–40 % de un proyecto ERP maduro. Si su estimación dice un 5 %, es que no ha examinado los datos.

### 3.2 Localización

- plan de cuentas + impuestos: 3–10 PD,
- facturación electrónica: 5–20 PD (según el país),
- informes legales: 5–15 PD,
- nómina: 10–40 PD (según el país),
- revisión contable: 2–5 PD.

### 3.3 Integración

Para cada integración, estime:

- diseño del contrato/API: 1–3 PD,
- autenticación/gestión de errores: 1–2 PD,
- mapeo/transformación: 2–8 PD,
- idempotencia/outbox: 2–4 PD,
- monitorización/alertas: 1–2 PD,
- pruebas con el sistema externo: 2–5 PD.

### 3.4 Pruebas y UAT

- diseño de pruebas: 10–20 % de la construcción,
- automatización: 10–20 % de la construcción,
- soporte a la UAT: 10–15 % de la construcción,
- regresión: 5–10 % por versión.

### 3.5 Gestión de proyectos

- PM: 10–15 % del total,
- BA/funcional: 15–25 %,
- arquitecto: 10–15 %,
- gestión del cambio/formación: 5–10 %.

---

## 4. Estimación de ejemplo: empresa de distribución de tamaño medio

Alcance: 50 usuarios, 1 compañía, ventas, compras, inventario, contabilidad, 2 almacenes, 1 integración de comercio electrónico, 5 años de datos.

| Línea de trabajo | PD |
|---|---|
| Descubrimiento y diseño | 25 |
| Configuración (ventas/compras/inventario/contabilidad) | 35 |
| Módulos personalizados (aprobaciones, comisiones, RMA) | 45 |
| Informes (5 operativos + 3 financieros) | 20 |
| Integración de comercio electrónico | 25 |
| Migración de datos (contactos, productos, stock, documentos abiertos) | 55 |
| Seguridad y roles | 8 |
| Pruebas y automatización | 30 |
| Soporte a la UAT | 15 |
| Formación y gestión del cambio | 12 |
| PM/BA/arquitectura | 35 |
| **Subtotal** | **305** |
| Contingencia 25 % | 76 |
| **Total** | **381 PD** |

Con 8 PD por persona-semana, son ~48 personas-semana, o ~11 semanas con un equipo de 4–5 personas (con líneas de trabajo en paralelo).

---

## 5. Estimación por complejidad de módulo

| Módulo | PD de configuración | PD de personalización (típico) | Notas |
|---|---|---|---|
| `sale` | 5–10 | 5–20 | precios, aprobaciones, documentos |
| `purchase` | 3–8 | 3–15 | aprobaciones, conciliación a tres bandas |
| `stock` | 8–15 | 5–25 | rutas, putaway, código de barras |
| `account` | 10–20 | 5–30 | localización, informes |
| `mrp` | 8–15 | 10–30 | LdM, órdenes de trabajo, cálculo de costes |
| `project` | 3–8 | 3–10 | facturación, etapas |
| `crm` | 2–5 | 3–10 | embudo, automatización |
| `website_sale` | 5–10 | 5–20 | tema, checkout, pago |
| `hr` | 3–8 | 3–10 | nómina aparte |
| Integraciones | — | 10–40 cada una | depende del sistema |

---

## 6. Estimación ascendente frente a descendente

### 6.1 Ascendente

Para cada épica:

1. enumerar las historias de usuario,
2. identificar modelos/métodos/vistas,
3. estimar cada historia (XS–XL),
4. añadir pruebas/migración,
5. sumar y aplicar los multiplicadores.

### 6.2 Descendente

Use un proyecto de referencia (tamaño/dominio similares) y ajuste:

```
estimate = reference_effort × size_ratio × complexity_ratio × risk_ratio
```

La estimación descendente es útil para contrastar la ascendente; una discrepancia de 2× significa que alguna hipótesis es errónea.

### 6.3 De tres puntos

Para alta incertidumbre:

```
E = (O + 4M + P) / 6
```

Úsela para integraciones, migraciones y localización.

---

## 7. Antipatrones de estimación

| Antipatrón | Por qué falla |
|---|---|
| Contar pantallas | las pantallas de Odoo son baratas; los datos y la lógica son caros |
| Ignorar los datos | 20–40 % del esfuerzo |
| Suponer una localización estándar | cada país es diferente |
| «La API es sencilla» | el mapeo y la gestión de errores dominan |
| Sin contingencia | las sorpresas se convierten en sobrecostes |
| Estimar en horas | falsa precisión |
| Una única estimación para todos los equipos | la habilidad y la experiencia varían |
| Olvidar la UAT y la formación | riesgo de adopción |
| Olvidar las actualizaciones | 10–30 % de la construcción |
| Precio fijo sin alcance | las solicitudes de cambio se comen el margen |

---

## 8. Modelo de presupuesto

| Coste | Base |
|---|---|
| Licencias | Odoo Enterprise por usuario/mes (u Odoo.sh) |
| Implantación | PD × tarifa |
| Infraestructura | alojamiento, BD, copia de seguridad, monitorización |
| Migración de datos | PD × tarifa |
| Formación | PD × tarifa + materiales |
| Soporte | % anual de la licencia/implantación |
| Contingencia | 10–30 % |
| Esfuerzo interno | usuarios clave, UAT, gestión del cambio |

El coste total de propiedad a 5 años incluye actualizaciones, soporte y administración interna.

---

## 9. Seguimiento

- burn-up por épica, no por tarea,
- valor ganado: PD planificados frente a reales,
- motivos de desviación (alcance, datos, estimaciones),
- volver a estimar en cada puerta,
- solicitudes de cambio valoradas antes de su aceptación.

---

## 10. Evidencias y calibración

- Mantenga una base de datos histórica de estimaciones frente a reales por tipo de trabajo.
- Tras cada proyecto, actualice los multiplicadores.
- Separe «estimación» de «compromiso»; un compromiso incluye contingencia y un proceso de cambios.
- Revise las estimaciones con el equipo de entrega, no solo con los responsables.

Continúe con `03-team-and-roles.md`.
