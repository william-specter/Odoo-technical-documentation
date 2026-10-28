# Alcance del ERP II — Brechas funcionales y sus consecuencias de ingeniería

> **Propósito.** Una brecha no significa «Odoo no puede hacerlo». Es una capacidad en la que el producto estándar se detiene ante un límite, y cruzar ese límite cambia el coste, el riesgo o la arquitectura del proyecto. Cada brecha que se describe a continuación indica el límite, la solución alternativa y la consecuencia de ingeniería.

---

## 1. Matriz de severidad de las brechas

| # | Brecha | Severidad | Esfuerzo típico | Impacto en la arquitectura |
|---|---|---|---|---|
| 1 | Planificación y programación avanzadas (APS) | alta | 4–12 semanas | solucionador externo |
| 2 | Oleadas, slotting e intercalado de tareas en el WMS | alta | 8–20 semanas | nuevos modelos + UI |
| 3 | Reconocimiento de ingresos (IFRS 15) | alta | 3–8 semanas | motor contable |
| 4 | Contabilidad de arrendamientos (IFRS 16) | alta | 4–8 semanas | cuadro de activos y pasivos |
| 5 | Precios de transferencia y eliminaciones de consolidación | alta | 4–10 semanas | multicompañía |
| 6 | Variación del precio de compra (PPV) | media | 1–3 semanas | hooks de valoración |
| 7 | Comisiones | media | 2–5 semanas | event sourcing |
| 8 | Gestión del ciclo de vida de contratos | media | 4–8 semanas | nuevos modelos |
| 9 | Flujo de trabajo de RMA | media | 2–4 semanas | stock + portal |
| 10 | Recuento cíclico / ABC | media | 2–4 semanas | stock |
| 11 | SPC de calidad / gráficos de control | media | 3–6 semanas | estadísticas + UI |
| 12 | Integración con MES/SCADA | alta | 8–20 semanas | middleware |
| 13 | Cumplimiento del comercio internacional | alta | 6–16 semanas | datos externos |
| 14 | Localización de nóminas | alta | según el país | localización |
| 15 | BI/ETL completo | media | 4–12 semanas | almacén de datos |
| 16 | Gestión documental a gran escala | media | 2–6 semanas | almacenamiento/búsqueda |
| 17 | WCS en tiempo real | alta | 12–24 semanas | hardware |
| 18 | Fabricación por procesos | alta | vertical | nuevos modelos |

---

## 2. Planificación y programación

### 2.1 Límite

`mrp` planifica las órdenes de trabajo en centros de trabajo con calendarios y capacidad, pero no resuelve un problema de programación con múltiples recursos y múltiples restricciones. No dispone de:

- optimización global con capacidad finita,
- selección de hojas de ruta alternativas según la carga,
- matrices de tiempos de preparación,
- cambios de preparación dependientes de la secuencia,
- simulación de tipo what-if,
- propagación de restricciones entre plantas.

### 2.2 Solución alternativa

- usar la capacidad de `mrp.workcenter` y `blocked_by_workorder_ids` para precedencias simples,
- integrar un APS (OR-Tools, OptaPlanner, APS comercial) mediante un módulo personalizado,
- escribir las fechas planificadas en `mrp.workorder.date_planned_start/finished`.

### 2.3 Consecuencia de ingeniería

Una integración con un APS no es una sincronización CRUD. Se necesita:

- un modelo de datos estable para operaciones, materiales, calendarios y preparaciones,
- un protocolo idempotente de importación y exportación,
- resolución de conflictos cuando el plan del APS difiere de las ediciones manuales,
- rendimiento para miles de operaciones,
- un mecanismo de respaldo cuando el solucionador no está disponible.

---

## 3. Gestión de almacenes (WMS)

### 3.1 Límite

El núcleo de `stock` gestiona ubicaciones, rutas, quants, pickings, paquetes, putaway y estrategias de retirada. **No** proporciona:

- picking por oleadas o por lotes con optimización,
- slotting (asignación de productos a ubicaciones según su rotación),
- intercalado de tareas (combinar putaway y picking),
- gestión de mano de obra y tiempos estándar,
- programación de patio y muelles,
- control automatizado de transportadores y WCS,
- visualización 3D del almacén.

### 3.2 Solución alternativa

- usar `stock.picking.batch` para el agrupamiento simple (Enterprise `stock_picking_batch`),
- implementar las reglas de oleadas como un modelo personalizado más un cron,
- calcular el slotting mediante un análisis ABC periódico,
- integrar un WMS si el volumen lo justifica.

### 3.3 Consecuencia de ingeniería

La lógica de un WMS mantiene estado y opera en concurrencia. Un motor de oleadas personalizado debe gestionar:

- conflictos de reserva,
- oleadas parciales,
- reasignación de ubicaciones (re-slotting) durante el picking,
- cancelación a mitad de oleada,
- dispositivos desconectados o conectados,
- auditoría y trazabilidad.

No se debe subestimar el esfuerzo de pruebas operativas; un error en el WMS detiene el almacén.

---

## 4. Reconocimiento de ingresos (IFRS 15 / ASC 606)

### 4.1 Límite

El núcleo de `account` reconoce los ingresos al publicar la factura. No proporciona:

- obligaciones de ejecución,
- asignación del precio de la transacción,
- contraprestación variable,
- activos y pasivos de contrato,
- calendarios de reconocimiento basados en el tiempo,
- modificaciones de contratos,
- desgloses de ingresos desagregados.

El módulo Enterprise `account_reports` incluye informes de ingresos y gastos diferidos, pero no un motor completo de IFRS 15.

### 4.2 Solución alternativa

- crear un modelo `revenue.contract` con obligaciones de ejecución,
- asignar el precio de la transacción al inicio del contrato,
- generar asientos de reconocimiento mensuales (Debe: ingresos diferidos / Haber: ingresos),
- vincular las facturas a los contratos,
- informar de los saldos de contrato.

### 4.3 Consecuencia de ingeniería

Se trata de un subsistema contable, no de un campo. Se necesita:

- asignación determinista (redondeos, descuentos, impuestos),
- pista de auditoría por obligación,
- revaluación ante modificaciones del contrato,
- multimoneda,
- integración con los informes de ingresos,
- aprobación del auditor.

---

## 5. Contabilidad de arrendamientos (IFRS 16 / ASC 842)

### 5.1 Límite

`account_asset` gestiona activos propios, no arrendamientos. No existe:

- activo por derecho de uso,
- amortización del pasivo por arrendamiento,
- curvas de tipos de descuento,
- exenciones para arrendamientos a corto plazo o de bajo valor,
- venta con arrendamiento posterior (sale-and-leaseback),
- remedición.

### 5.2 Solución alternativa

- modelar los arrendamientos como contratos con un calendario de pagos,
- calcular el activo por derecho de uso y el pasivo al inicio del arrendamiento,
- registrar mensualmente la depreciación y los intereses,
- gestionar modificaciones y terminaciones.

### 5.3 Consecuencia de ingeniería

La contabilidad de arrendamientos es matemáticamente sensible. Un error de 1 punto básico se acumula. Se debe construir un motor de cálculo con pruebas basadas en los ejemplos de la norma y mantener una pista de auditoría de los supuestos.

---

## 6. Precios de transferencia y consolidación

### 6.1 Límite

`account_consolidation` [ENT] agrega compañías, pero el núcleo no proporciona:

- automatización de eliminaciones intercompañía a escala,
- motor de políticas de precios de transferencia,
- eliminación de beneficios en existencias,
- flujo de trabajo completo de ajustes por conversión de moneda (CTA),
- intereses minoritarios,
- información por segmentos.

### 6.2 Solución alternativa

- usar `account_inter_company_rules` para el reflejo de documentos,
- crear asientos de eliminación por período,
- mantener una correspondencia de cuentas y segmentos,
- usar los informes de consolidación para la agregación.

### 6.3 Consecuencia de ingeniería

La consolidación es un proceso por lotes de cierre de período con estrictos requisitos de auditoría. Necesita:

- un balance de comprobación cerrado por compañía,
- tablas de tipos de cambio por período,
- reglas de eliminación versionadas por período,
- fechas de bloqueo para impedir cambios posteriores al cierre,
- conciliación entre lo consolidado y la suma de las compañías.

---

## 7. Variación del precio de compra

### 7.1 Límite

El núcleo registra la factura de proveedor al precio facturado y la recepción al precio del pedido de compra o estándar. No registra automáticamente un asiento de PPV en una cuenta de variación dedicada. `account_3way_match` marca las excepciones, pero no las contabiliza.

### 7.2 Solución alternativa

- añadir una cuenta de PPV en la categoría de producto,
- al publicar la factura, comparar `price_unit` con el valor de la recepción,
- contabilizar la diferencia (Debe/Haber PPV, con la cuenta de valoración o variación de existencias como contrapartida),
- informar del PPV por producto, proveedor y período.

### 7.3 Consecuencia de ingeniería

El PPV interactúa con:

- la revaluación del coste estándar,
- las capas FIFO/AVCO,
- los costes en destino,
- las devoluciones,
- la moneda.

Definir la política con precisión (variación del precio de compra frente a diferencia de precio frente a diferencia de cambio) antes de programar.

---

## 8. Comisiones

### 8.1 Límite

El núcleo no tiene motor de comisiones. No existe:

- plan de comisiones,
- tarifas escalonadas,
- atribución compartida,
- recuperación de comisiones (clawbacks),
- aprobación de pagos,
- contabilidad de comisiones.

### 8.2 Solución alternativa

- modelar los planes y las reglas,
- calcular al pagar la factura (no al publicarla, para evitar pagar comisiones sobre facturas impagadas),
- crear líneas de comisión y asientos a pagar,
- gestionar devoluciones y notas de crédito.

### 8.3 Consecuencia de ingeniería

Las comisiones se basan en eventos y son retroactivas. Una nota de crédito puede exigir una comisión negativa; un cambio de plan a mitad de período requiere prorrateo. Se debe usar un libro de solo adición (append-only), no un saldo mutable.

---

## 9. Gestión del ciclo de vida de contratos

### 9.1 Límite

`sale_subscription` gestiona la facturación recurrente y `sign` gestiona las firmas, pero no existe:

- biblioteca de cláusulas,
- seguimiento de obligaciones,
- flujos de trabajo de renovación y terminación,
- jerarquía de contratos,
- informes de cumplimiento.

### 9.2 Solución alternativa

- modelar los contratos con versiones y cláusulas,
- vincular con el pedido de venta, la suscripción y las facturas,
- automatizar las renovaciones con cron,
- almacenar los PDF firmados como adjuntos.

### 9.3 Consecuencia de ingeniería

La gestión del ciclo de vida de contratos está muy centrada en documentos y en aspectos legales. La ingeniería consiste principalmente en flujos de trabajo, permisos y auditoría; la parte difícil es el modelo de contenido legal.

---

## 10. Flujo de trabajo de RMA

### 10.1 Límite

El núcleo admite devoluciones (el asistente `stock.return.picking`) y reembolsos, pero no un RMA completo:

- portal de solicitudes de RMA,
- flujo de trabajo de aprobación,
- inspección y disposición,
- sustitución, reparación o reembolso,
- seguimiento de garantías,
- cargos por reposición (restocking fees).

### 10.2 Solución alternativa

- crear un modelo `rma.order` vinculado al pedido de venta y al picking,
- formulario de portal para los clientes,
- paso de inspección con controles de calidad,
- generar el picking de devolución y la nota de crédito o la sustitución.

### 10.3 Consecuencia de ingeniería

El RMA afecta a ventas, stock, contabilidad, calidad y portal. Se debe diseñar primero la máquina de estados; las integraciones vienen después.

---

## 11. Recuento cíclico

### 11.1 Límite

`stock` admite ajustes de inventario y recuentos manuales, pero no:

- clasificación ABC,
- planes de recuento programados,
- hojas de recuento por zona,
- aprobación de variaciones,
- reglas de recuento,
- políticas de congelación.

### 11.2 Solución alternativa

- análisis ABC a partir del historial de movimientos,
- generar tareas de recuento por período,
- usar los campos de inventario de `stock.quant`,
- aprobar las variaciones con un modelo dedicado.

### 11.3 Consecuencia de ingeniería

El recuento es un flujo de trabajo pensado para dispositivos móviles y con requisitos de funcionamiento sin conexión. La integración de códigos de barras y RFID, así como la gestión de conflictos (recuento simultáneo al picking), son las partes difíciles.

---

## 12. SPC de calidad

### 12.1 Límite

`quality` admite puntos de control y resultados de tipo apto, no apto o medida, pero no:

- gráficos de control (X-barra/R, gráfico p),
- Cp/Cpk,
- planes de muestreo (AQL),
- reglas de tendencia (Western Electric),
- alarmas de SPC.

### 12.2 Solución alternativa

- almacenar las mediciones en `quality.check` o en un modelo de mediciones personalizado,
- calcular las estadísticas en un informe o en una herramienta de BI externa,
- activar alertas mediante automatizaciones.

### 12.3 Consecuencia de ingeniería

El SPC requiere corrección estadística y almacenamiento de series temporales. No se debe calcular el Cpk en una vista de lista; se debe usar un proceso por lotes y una biblioteca de gráficos adecuada.

---

## 13. Integración con MES/SCADA

### 13.1 Límite

Odoo no tiene MES. `mrp_workorder` es una interfaz de planta, no una capa de integración con máquinas. No existe:

- conector OPC-UA/MQTT,
- modelo de estado de las máquinas,
- descarga de recetas,
- trazabilidad a nivel de máquina,
- Andon,
- OEE en tiempo real a partir de PLC.

### 13.2 Solución alternativa

- un middleware (Node-RED, Ignition, un servicio personalizado) traduce los datos de los PLC a Odoo,
- escribir las confirmaciones de producción y los registros de tiempos mediante RPC,
- usar `iot` para dispositivos sencillos (balanzas, impresoras, cámaras).

### 13.3 Consecuencia de ingeniería

Se trata de un proyecto de integración OT/IT. Dominan la latencia, la fiabilidad, las zonas de seguridad y el volumen de datos; el lado de Odoo es la parte sencilla.

---

## 14. Cumplimiento del comercio internacional

### 14.1 Límite

Odoo dispone de Intrastat y algunos informes de localización, pero no de:

- declaraciones aduaneras,
- clasificación HS,
- verificación de partes denegadas,
- licencias de exportación,
- normas de origen,
- cálculo de derechos arancelarios.

### 14.2 Solución alternativa

- integrar un proveedor de GTM,
- almacenar los códigos HS y el origen en los productos,
- generar las declaraciones externamente.

### 14.3 Consecuencia de ingeniería

Los datos de cumplimiento cambian constantemente. Toda caché local debe estar versionada y ser auditable; un código HS incorrecto tiene consecuencias legales.

---

## 15. Nóminas

### 15.1 Límite

`hr_payroll` [ENT] es un marco de trabajo, no un motor global de nóminas. Cada país necesita una localización con:

- tramos impositivos,
- cotizaciones sociales,
- reglas de nómina,
- informes legales,
- declaraciones de fin de año.

La cobertura varía: algunos países cuentan con módulos de la comunidad, otros con módulos de partners y otros no tienen ninguno.

### 15.2 Solución alternativa

- usar la localización si existe y se mantiene,
- integrar un proveedor externo de nóminas para los países complejos,
- mantener Odoo como maestro de RR. HH. e importar resúmenes de nóminas.

### 15.3 Consecuencia de ingeniería

La nómina es de alto riesgo: los errores afectan a los empleados y al cumplimiento. Se debe presupuestar la ejecución en paralelo y la revisión legal, no solo el código.

---

## 16. BI y almacén de datos

### 16.1 Límite

`spreadsheet_dashboard` y `account_reports` son informes operativos, no un almacén de datos. No existe:

- almacén columnar,
- planificador de ETL,
- capa semántica,
- seguridad a nivel de fila para BI,
- instantáneas históricas.

### 16.2 Solución alternativa

- replicar en PostgreSQL/ClickHouse/BigQuery,
- modelar dimensiones y hechos,
- programar el ETL,
- usar una herramienta de BI (Metabase, Superset, Power BI).

### 16.3 Consecuencia de ingeniería

Las consultas directas de BI sobre el primario de Odoo compiten con el OLTP. Se debe usar una réplica o CDC; nunca se deben ejecutar análisis pesados sobre el primario de producción.

---

## 17. Fabricación por procesos

### 17.1 Límite

El módulo `mrp` de Odoo es de fabricación discreta: listas de materiales, unidades y órdenes de trabajo. Carece de:

- recetas y fórmulas con escalado,
- potencia y actividad,
- coproductos y subproductos con rendimientos variables,
- conversiones de UdM a granel,
- trazabilidad de tanques y lotes,
- restricciones de vida útil.

### 17.2 Solución alternativa

- modelar las recetas como listas de materiales con componentes en porcentaje,
- usar lotes para la trazabilidad de lotes,
- lógica personalizada de rendimientos y coproductos,
- módulos verticales de terceros.

### 17.3 Consecuencia de ingeniería

La fabricación por procesos cambia el modelo de datos central (lote, receta, rendimiento). Adaptarla a `mrp` es posible, pero costoso; se debe evaluar primero una solución vertical.

---

## 18. Guía de gestión de brechas

1. **Cuantificar la brecha.** Escribir la historia de usuario, la frecuencia, el volumen y el coste de *no* disponer de ella.
2. **Comprobar el límite.** Muchas brechas están cubiertas en un 80 % por una combinación de funcionalidades del núcleo; verificarlo antes de construir.
3. **Estimar la superficie de integración.** Contar los modelos, estados e informes afectados.
4. **Decidir entre desarrollar, comprar o integrar.** Un módulo vertical o un sistema externo suele resultar más económico.
5. **Diseñar el límite.** Mantener la lógica personalizada en un módulo dedicado; no crear una bifurcación del núcleo.
6. **Planificar la migración de datos.** Las brechas suelen requerir datos históricos (contratos, arrendamientos, números de serie).
7. **Planificar la auditoría.** Las brechas reguladas necesitan pistas inmutables e informes.
8. **Probar en condiciones operativas.** Una brecha que funciona en una demostración pero falla en el cierre de mes no está cerrada.

---

## 19. Evidencia y salvedades

- Las evaluaciones de capacidad se basan en los manifiestos de los módulos y en la inspección del código fuente, no en una auditoría funcional formal.
- Los módulos Enterprise y las localizaciones cambian con frecuencia; se debe volver a verificar antes de comprometerse.
- Algunas «brechas» son límites deliberados del producto (Odoo no es un sistema APS, MES ni GTM). Deben tratarse como puntos de integración, no como defectos.

Continuar con `03-performance.md`.
