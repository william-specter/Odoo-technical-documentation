# Alcance del ERP I — Matriz de cobertura funcional

> **Cómo leer este documento.** «Out-of-box» significa que un módulo estándar de Odoo 19 Enterprise proporciona la capacidad solo con configuración. «Configurar» significa que es posible, pero requiere una puesta en marcha, datos o localización no triviales. «Personalizar» significa que requiere código o un módulo de terceros. La cobertura se evalúa para el árbol de Odoo 19.0 Enterprise de este repositorio.

---

## 1. Leyenda de cobertura

| Calificación | Significado |
|---|---|
| ● | out-of-box, solo configuración |
| ◐ | out-of-box con configuración/localización significativa |
| ○ | parcial; las carencias requieren código personalizado |
| ✗ | no cubierto; personalizado o de terceros |

---

## 2. Comercial

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| Presupuestos y pedidos de venta | ● | `sale`, `sale_management` | sin estado `done` en la versión 19 |
| Tarifas, descuentos | ● | `product`, `sale` | reglas por producto/categoría/cantidad/fecha |
| Precios específicos por cliente | ● | `product` | información de proveedor/cliente, tarifas |
| Ventas multidivisa | ● | `sale`, `account` | instantánea del tipo de cambio en la fecha del pedido |
| Aprobaciones de ventas | ◐ | `sale_management` | umbral simple; las matrices complejas requieren personalización |
| CPQ / productos configurables | ◐ | `product`, `sale` | variantes y atributos, no un motor CPQ completo |
| Suscripciones | ◐ | `sale_subscription` [ENT] | planes recurrentes; la facturación por uso compleja requiere personalización |
| Alquiler | ◐ | `sale_renting` [ENT] | precios por periodo, recargos por demora |
| Comercio electrónico | ● | `website_sale` | B2C/B2B, finalización de la compra, pago |
| Conectores de marketplace | ◐ | `sale_amazon`, `sale_shopee`, ... [ENT] | específicos de cada marketplace, límites de tasa |
| TPV | ● | `point_of_sale` | funciona sin conexión, restaurante |
| Embudo de CRM | ● | `crm` | etapas, equipos, leads |
| Automatización de marketing | ◐ | `marketing_automation` [ENT] | flujos de trabajo de campañas, no una CDP completa |
| Fidelización | ● | `loyalty`, `sale_loyalty` | cupones, puntos, promociones |
| Comisiones | ○ | ninguno en el núcleo | personalizado o de terceros |
| Gestión de contratos | ○ | `sale_subscription`, `sign` | sin biblioteca de cláusulas CLM |

---

## 3. Compras

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| SdP → pedido de compra | ● | `purchase` | umbrales de aprobación |
| Tarifas de proveedor | ● | `product` | `product.supplierinfo` |
| Solicitudes de compra | ● | `purchase_requisition` | pedidos marco |
| Conciliación a tres bandas | ◐ | `account_3way_match` [ENT] | indicadores, no bloqueo estricto |
| Costes en destino | ● | `stock_landed_costs` | métodos de asignación |
| Devoluciones a proveedores | ● | `purchase_stock` | picking de devolución + abono |
| Variación del precio de compra | ○ | ninguno | contabilidad personalizada |
| Cuadros de mando de proveedores | ○ | ninguno | personalizado |
| Precios por contrato | ○ | `purchase_requisition` parcial | sin ciclo de vida completo de contratos |
| Compras electrónicas / punch-out | ✗ | ninguno | personalizado/de terceros |

---

## 4. Inventario y logística

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| Almacenes múltiples | ● | `stock` | rutas por almacén |
| Recepciones/entregas en varios pasos | ● | `stock` | rutas de 1/2/3 pasos |
| Seguimiento por lote/número de serie | ● | `stock` | fechas de caducidad |
| Paquetes | ● | `stock` | tipos de paquete, dimensiones |
| Reglas de ubicación (putaway) | ● | `stock` | ubicación/paquete/categoría |
| Estrategias de extracción | ● | `stock` | FIFO/LIFO/más cercano/menos paquetes |
| Operaciones con código de barras | ◐ | `stock_barcode` [ENT] | interfaz móvil |
| Recuento cíclico | ○ | `stock` | recuentos manuales; la programación ABC requiere personalización |
| Picking por oleadas | ○ | ninguno en el núcleo | personalizado/de terceros |
| Slotting / intercalado de tareas | ✗ | ninguno | extensión de WMS |
| Cross-docking | ● | `stock` | ruta |
| Envío directo | ● | `stock`, `purchase_stock` | |
| Consignación | ● | `stock` | propietario en los quants |
| Costes en destino | ● | `stock_landed_costs` | |
| Conectores de envío | ● | `delivery_*` | API de transportistas |
| Devoluciones (RMA) | ◐ | `stock`, `sale_stock` | básicas; el flujo de RMA requiere personalización |
| Valoración de inventario | ● | `stock_account` | FIFO/AVCO/estándar |
| Stock multicompañía | ● | `stock` | transferencias intercompañía |

---

## 5. Fabricación

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| LdM (incluidas las fantasma) | ● | `mrp` | multinivel |
| Órdenes de trabajo / hojas de ruta | ● | `mrp` | centros de trabajo, calendarios |
| Interfaz de planta | ◐ | `mrp_workorder` [ENT] | interfaz para tablet |
| Planificación / programación | ◐ | `mrp` | finita a nivel de centro de trabajo, no APS |
| Planificación de capacidad | ○ | `mrp` | básica; la APS avanzada requiere personalización |
| MRP / reaprovisionamiento | ● | `stock`, `mrp` | puntos de pedido, planificador |
| Subcontratación | ◐ | `mrp_subcontracting` | casos límite complejos |
| Control de calidad | ◐ | `quality`, `quality_mrp` | puntos de control, no SPC |
| PLM / ECO | ◐ | `mrp_plm` [ENT] | cambios de ingeniería |
| Mantenimiento | ● | `maintenance` | preventivo/correctivo |
| Costeo | ● | `mrp_account` | material + mano de obra + gastos generales |
| Contabilidad de productos en curso | ○ | `mrp_account` | básica; el detalle de productos en curso requiere personalización |
| Integración con MES | ✗ | ninguno | personalizado/de terceros |
| Analítica de OEE / tiempos de inactividad | ○ | `mrp_workorder` | registro de tiempos, no OEE completo |
| Fabricación por procesos (recetas, potencia) | ✗ | ninguno | vertical/de terceros |

---

## 6. Contabilidad y finanzas

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| Libro mayor | ● | `account` | |
| Facturas de cliente/proveedor | ● | `account` | |
| Pagos y conciliación | ● | `account` | conciliación bancaria |
| Impuestos | ● | `account` | motor de funciones puras de Odoo 19 |
| Posiciones fiscales | ● | `account` | |
| Multidivisa | ● | `account` | ganancia/pérdida por tipo de cambio |
| Contabilidad analítica | ● | `analytic` | distribuciones |
| Presupuestos | ◐ | `account_budget` [ENT] | básico |
| Activos fijos | ● | `account_asset` [ENT] | lineal/degresivo |
| Informes financieros | ● | `account_reports` [ENT] | estados, impuestos |
| Consolidación | ◐ | `account_consolidation` [ENT] | multicompañía |
| Reconocimiento de ingresos | ○ | ninguno en el núcleo | módulos de ingresos diferidos/personalización |
| Contabilidad de arrendamientos (IFRS 16) | ○ | ninguno en el núcleo | personalización/localización |
| Precios de transferencia | ✗ | ninguno | personalizado |
| Recordatorios de pago | ● | `account_followup` [ENT] | |
| Importación de extractos bancarios | ● | `account_bank_statement_import*` | CAMT/OFX/QIF/CSV |
| Facturación electrónica | ◐ | `account_edi*` | formatos por país |
| Nómina | ◐ | `hr_payroll` [ENT] + localizaciones | específica de cada país |
| Gestión de gastos | ● | `hr_expense` | |
| Tesorería | ○ | ninguno dedicado | personalizado |

---

## 7. Recursos humanos

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| Empleados / organigrama | ● | `hr` | |
| Vacaciones y ausencias | ● | `hr_holidays` | |
| Asistencia | ● | `hr_attendance` | |
| Reclutamiento | ● | `hr_recruitment` | |
| Evaluaciones | ● | `hr_appraisal` [ENT] | |
| Nómina | ◐ | `hr_payroll` [ENT] | depende de la localización |
| Partes de horas | ● | `hr_timesheet`, `timesheet_grid` | |
| Servicio de campo | ● | `industry_fsm` [ENT] | |
| Planificación / turnos | ● | `planning` [ENT] | |
| Competencias | ● | `hr_skills` | |
| LMS | ● | `website_slides` | |

---

## 8. Proyectos y servicios

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| Proyectos/tareas | ● | `project` | |
| Kanban/Gantt | ● | `project`, `web_gantt` | |
| Partes de horas | ● | `hr_timesheet` | |
| Facturación por tiempo | ● | `sale_timesheet` | |
| Helpdesk | ● | `helpdesk` [ENT] | |
| Servicio de campo | ● | `industry_fsm` [ENT] | |
| Aprobaciones | ● | `approvals` [ENT] | |
| Base de conocimiento | ● | `knowledge` [ENT] | |
| Firma electrónica | ● | `sign` [ENT] | |
| Documentos | ● | `documents` [ENT] | |
| Rentabilidad de proyectos | ◐ | `project_account` | básica; la avanzada requiere personalización |

---

## 9. Plataforma e integración

| Capacidad | Calificación | Módulo(s) | Notas |
|---|---|---|---|
| API REST/JSON-RPC | ● | `http`, `service` | sin REST nativa; JSON-RPC |
| XML-RPC | ● | `service` | heredado pero compatible |
| Webhooks (salientes) | ◐ | `ir.actions.server` | sin reintentos/firma |
| Webhooks (entrantes) | ◐ | controladores | personalizado |
| OAuth2 / SSO | ◐ | `auth_oauth`, `auth_saml` | combinación Enterprise/Community |
| LDAP | ◐ | `auth_ldap` | dependencia externa |
| 2FA | ● | `auth_totp` | |
| Registro de auditoría | ◐ | `mail.thread`, `ir.logging` | no es a prueba de manipulación |
| Multicompañía | ● | `base`, `account` | |
| Multidivisa | ● | `account` | |
| Localización | ● | 245 módulos `l10n_*` | la cobertura varía |
| BI / paneles | ◐ | `spreadsheet_dashboard`, `account_reports` | no es una plataforma BI completa |
| Importación/exportación de datos | ● | `base_import`, `base_export` | |
| Studio (sin código) | ● | `web_studio` [ENT] | no para lógica compleja |
| IoT | ◐ | `iot` [ENT] | dispositivos, básculas, impresoras |
| Funciones de IA | ◐ | `ai`, `ai_app` [ENT] | OCR, sugerencias |

---

## 10. Resumen de los límites del alcance

### 10.1 Sólido out-of-box

- flujos comerciales estándar (presupuesto → pedido → entrega → factura → pago),
- flujos de compra estándar (SdP → pedido de compra → recepción → factura de proveedor → pago),
- inventario estándar (múltiples almacenes, lotes, rutas, valoración),
- fabricación estándar (LdM, OF, órdenes de trabajo, costeo),
- contabilidad por partida doble con impuestos, conciliación y activos,
- CRM, proyectos, helpdesk, comercio electrónico, TPV,
- multicompañía, multidivisa, multilingüe.

### 10.2 Con mucha configuración

- localización (plan contable, impuestos, facturación electrónica),
- matrices de aprobación,
- logística en varios pasos,
- precios de suscripción/alquiler,
- nómina,
- puntos de control de calidad,
- automatización intercompañía.

### 10.3 Con mucha personalización

- APS / programación avanzada,
- oleadas/slotting de WMS,
- integración con MES/SCADA,
- reconocimiento de ingresos (IFRS 15) y contabilidad de arrendamientos (IFRS 16),
- precios de transferencia y eliminaciones de consolidación,
- PPV y contabilidad de costes compleja,
- comisiones,
- gestión del ciclo de vida de contratos,
- verticales sectoriales (fabricación por procesos, sanidad, sector público).

### 10.4 No cubierto

- plataforma BI/ETL completa,
- gestión documental a escala (solo la aplicación básica Documentos),
- suite de talento de RR. HH. (sucesión, benchmarking de retribuciones),
- punch-out de compras/compras electrónicas,
- cumplimiento del comercio global (aduanas, cribado de partes denegadas),
- ejecución de fabricación (MES) y SPC,
- control de almacén en tiempo real (WCS).

---

## 11. Evidencia y advertencias

- La cobertura se basa en la presencia de módulos y las dependencias del manifiesto, no en una prueba funcional práctica de cada función.
- Los módulos Enterprise requieren una licencia Enterprise; algunos se instalan automáticamente y cambian menús y comportamientos.
- La cobertura de localización varía mucho según el país; se debe verificar el módulo `l10n_<country>` correspondiente al régimen fiscal.
- Las versiones de Odoo cambian sus conjuntos de funciones; se debe volver a verificar con la versión exacta antes de comprometerse con una carencia.

Continuar con `02-gaps.md`.
