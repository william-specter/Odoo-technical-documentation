# Relaciones entre módulos III — Puntos de extensión ordenados por seguridad

> **Regla cero.** Nunca edite archivos bajo `odoo/addons/` ni el árbol de código fuente de Enterprise. Todo cambio debe residir en un módulo personalizado. Esto no es solo una cuestión de mantenibilidad: las actualizaciones firmadas, los contratos de soporte y el cumplimiento de licencias presuponen un núcleo intacto.

---

## 1. Clasificación por seguridad

| Rango | Punto de extensión | Estabilidad | Radio de impacto | Recomendado para |
|---|---|---|---|---|
| 1 | Modelo nuevo | alta | ninguno | nuevos objetos de negocio |
| 2 | `_inherit` + `super()` | media | todo el modelo | campos, comportamiento |
| 3 | Herencia de vistas | media | interfaz | diseño, botones, campos |
| 4 | Paquetes de recursos | media | frontend | JS/CSS/OWL |
| 5 | Controladores | media | HTTP | API, portal |
| 6 | Parches de OWL | media-baja | frontend | comportamiento de componentes |
| 7 | Plantillas de correo | alta | notificaciones | correos electrónicos |
| 8 | `base.automation` | alta | basado en datos | reglas de administración |
| 9 | `ir.actions.server` | media | basado en datos | acciones procedimentales |
| 10 | `ir.config_parameter` | alta | configuración | indicadores de funcionalidad |
| 11 | Hooks de módulo | baja | ciclo de vida | configuración inicial |
| 12 | `_inherit` en `mail.thread` | baja | mensajería | seguimiento |
| 13 | `_inherits` | baja | esquema | composición |
| 14 | Monkey-patching | muy baja | desconocido | nunca |

---

## 2. Modelos nuevos (los más seguros)

```python
class MyEntity(models.Model):
    _name = 'my.entity'
    _description = 'My Entity'
    _order = 'date desc, id desc'
    _check_company_auto = True

    name = fields.Char(required=True, index=True)
    company_id = fields.Many2one('res.company', required=True, index=True,
                                 default=lambda self: self.env.company)
    partner_id = fields.Many2one('res.partner', check_company=True)
    date = fields.Date(default=fields.Date.context_today)
    state = fields.Selection([('draft', 'Draft'), ('done', 'Done')], default='draft')
    line_ids = fields.One2many('my.entity.line', 'entity_id')
```

Lista de verificación:

- [ ] `_description` (obligatorio para la interfaz)
- [ ] `_order` con `id` como criterio de desempate
- [ ] `company_id` + regla de registro
- [ ] ACL en `security/ir.model.access.csv`
- [ ] `_rec_name` o un campo `name`
- [ ] `mail.thread` solo si es necesario
- [ ] índices en las FK filtradas
- [ ] `@api.constrains` para las invariantes
- [ ] pruebas

**Por qué es el más seguro:** no cambia ningún comportamiento existente; los fallos quedan aislados.

---

## 3. `_inherit` + `super()` (el más habitual)

```python
class SaleOrder(models.Model):
    _inherit = 'sale.order'

    approval_state = fields.Selection([('none', 'None'), ('pending', 'Pending'), ('approved', 'Approved')])

    def action_confirm(self):
        for order in self:
            if order.amount_total > 10000 and order.approval_state != 'approved':
                raise UserError(_("Orders above 10,000 require approval."))
        return super().action_confirm()
```

Reglas:

- llame siempre a `super()`, incluso si la base no hace nada;
- conserve la firma (posicional/por palabra clave);
- trabaje con conjuntos de registros, no con registros individuales;
- no cambie los tipos de retorno (`True` frente a un dict de acción);
- añada `depends` para cada módulo cuyo comportamiento extienda;
- pruebe con todos los módulos instalados, no solo con el suyo.

### 3.1 Dónde enganchar

| Objetivo | Hook |
|---|---|
| Añadir un campo al confirmar | `_prepare_confirmation_values` |
| Añadir efectos secundarios tras la confirmación | `_action_confirm` |
| Cambiar la cabecera de la factura | `_prepare_invoice` |
| Cambiar las líneas de la factura | `_prepare_invoice_lines_vals_list` |
| Cambiar la facturabilidad | `_get_invoiceable_lines` |
| Cambiar el aprovisionamiento de stock | `_action_launch_stock_rule` (riesgoso) |
| Cambiar la validación del picking | `button_validate` (riesgoso) |
| Cambiar la ejecución del movimiento | `_action_done` (muy riesgoso) |
| Cambiar la publicación | `_post` (muy riesgoso) |

**[WARNING]** Sobrescribir `action_confirm` para añadir una salvaguarda es seguro; sobrescribirlo para reemplazar toda la confirmación equivale a crear un fork. Prefiera el hook más pequeño.

---

## 4. Herencia de vistas

```xml
<record id="view_order_form_inherit_my_module" model="ir.ui.view">
    <field name="name">sale.order.form.my_module</field>
    <field name="model">sale.order</field>
    <field name="inherit_id" ref="sale.view_order_form"/>
    <field name="arch" type="xml">
        <xpath expr="//field[@name='partner_id']" position="after">
            <field name="approval_state" readonly="1"/>
        </xpath>
        <xpath expr="//button[@name='action_confirm']" position="attributes">
            <attribute name="invisible">approval_state != 'approved' and amount_total &gt; 10000</attribute>
        </xpath>
    </field>
</record>
```

Posiciones: `inside`, `after`, `before`, `replace`, `attributes`.

Reglas:

- use `xpath` con un ancla estable (nombre de campo/botón), no índices posicionales;
- nunca aplique `position="replace"` a un formulario completo; reemplace el nodo más pequeño;
- herede por ID XML, no por nombre de vista;
- pruebe con todos los módulos que también heredan la vista (las colisiones de xpath son habituales);
- `mode="primary"` crea una vista nueva, no una extensión.

**[WARNING]** Las expresiones XPath son frágiles. Una actualización del núcleo que cambie el nombre de un campo o botón rompe la vista al cargar el módulo, no en tiempo de ejecución. Fije la versión de Odoo y ejecute la validación de vistas en CI.

---

## 5. Paquetes de recursos

```python
'assets': {
    'web.assets_backend': [
        'my_module/static/src/**/*.js',
        'my_module/static/src/**/*.xml',
        'my_module/static/src/**/*.scss',
    ],
}
```

- Nombres de paquete: `web.assets_backend`, `web.assets_frontend`, `web.assets_common`, `point_of_sale.assets`, `website.assets_frontend`.
- Se admiten globs; el orden importa.
- `('include', 'module/file')` incluye un recurso existente.
- `('remove', 'module/file')` elimina uno.
- Los recursos se reconstruyen al actualizar el módulo; la caché del navegador se invalida mediante un hash.

**[WARNING]** No coloque secretos en los recursos de frontend. Todo lo que hay en un paquete es público.

---

## 6. Controladores

```python
class MyController(http.Controller):

    @http.route('/my/api/orders', type='jsonrpc', auth='user', methods=['POST'])
    def orders(self, **kwargs):
        orders = request.env['sale.order'].search([('partner_id', '=', request.env.user.partner_id.id)])
        return [{'id': o.id, 'name': o.name} for o in orders]
```

Reglas:

- `auth='user'` para el backend, `auth='public'` solo para páginas públicas;
- `csrf=True` para formularios del navegador, deshabilitado solo para callbacks de API firmados;
- `readonly=True` cuando la ruta solo lee;
- valide los tipos y límites de la entrada;
- llame a `check_access` explícitamente para los registros obtenidos por id;
- devuelva datos serializables a JSON (sin conjuntos de registros);
- versione la ruta de su API (`/my/api/v1/...`).

---

## 7. Componentes y parches de OWL

El backend de Odoo 19 es OWL 2. Patrones de extensión:

| Patrón | Uso |
|---|---|
| Componente nuevo + registro | nueva funcionalidad de interfaz |
| `patch(Component.prototype, {...})` | modificar comportamiento existente |
| `registry.category('fields').add(...)` | nuevo widget de campo |
| `registry.category('views').add(...)` | nuevo tipo de vista |
| `registry.category('services').add(...)` | nuevo servicio |
| Herencia de plantillas (`t-inherit`) | modificar plantillas XML |

**[WARNING]** Las partes internas de OWL no son estables entre versiones menores. Los parches sobre métodos privados se rompen silenciosamente. Prefiera los registros públicos y los hooks documentados; fije la versión.

---

## 8. Plantillas de correo

```xml
<record id="email_template_my_module" model="mail.template">
    <field name="name">My Module: confirmation</field>
    <field name="model_id" ref="model_my_entity"/>
    <field name="subject">Confirmation {{ object.name }}</field>
    <field name="body_html" type="html">
        <p>Hello {{ object.partner_id.name }},</p>
    </field>
    <field name="email_from">{{ (object.company_id.email or user.email) }}</field>
    <field name="lang">{{ object.partner_id.lang }}</field>
</record>
```

- Las plantillas son QWeb; `object` es el registro.
- `lang` controla la traducción.
- Los adjuntos pueden ser acciones de informe.
- El envío se encola mediante `mail.mail` salvo que `force_send=True`.

**[WARNING]** Renderizar una plantilla en un bucle es costoso. Use `message_post_with_source` con destinatarios explícitos y agrupe por lotes cuando sea posible.

---

## 9. Acciones automatizadas

`base.automation` es la forma más segura de añadir reglas específicas de clientes sin despliegue:

- se activan al crear/escribir/por tiempo/por mensaje,
- se filtran con dominios,
- ejecutan acciones de servidor,
- no requieren despliegue de código, pero tampoco tienen control de versiones por defecto.

**[WARNING]** Las automatizaciones son datos, no código. No están en Git, no se prueban en CI y cualquier administrador puede editarlas. Expórtelas como XML y revise los cambios.

---

## 10. Acciones de servidor

Tipos de `ir.actions.server`: update, create, copy, code, webhook, multi.

- `code` se ejecuta mediante `safe_eval` con `env`, `model`, `record`, `records`.
- Solo `base.group_system` debería editar acciones de código.
- Los webhooks no tienen reintentos ni firma por defecto.
- Las acciones de servidor se almacenan en `ir_act_server`, no en el código del módulo.

**Úselo para:** pegamento procedimental pequeño, correcciones puntuales, acciones activadas por el administrador.
**No lo use para:** lógica de negocio central, integraciones que requieran fiabilidad, nada que necesite pruebas.

---

## 11. Configuración e indicadores de funcionalidad

```python
enabled = env['ir.config_parameter'].sudo().get_param('my_module.enabled', '0') == '1'
```

- `ir.config_parameter` es una tabla clave/valor; los valores son cadenas.
- `res.config.settings` proporciona la interfaz de administración y `get_values`/`set_values`.
- Los ajustes específicos de la compañía pertenecen a `res.company`, no a ICP.
- Los ajustes específicos del usuario pertenecen a `res.users` o `ir.default`.

**[WARNING]** Las lecturas de ICP son baratas pero no gratuitas; almacénelas en caché en una variable local por solicitud, no por registro.

---

## 12. Hooks de módulo

| Hook | Cuándo | Uso |
|---|---|---|
| `pre_init_hook(env)` | antes de cargar los modelos | crear columnas/tablas que necesita el módulo |
| `post_init_hook(env)` | después de cargar los datos, antes de instalado | sembrar datos, configurar |
| `uninstall_hook(env)` | antes de desinstalar | limpiar recursos externos |
| `post_load()` | después de cargar el servidor | **no es una clave de manifiesto admitida en esta compilación** |

Reglas:

- idempotente,
- rápido,
- sin commit,
- sin depender de `state='installed'` en `post_init_hook`,
- registre en el log lo que cambia.

---

## 13. `mail.thread` y `_inherits`

### 13.1 `mail.thread`

```python
class MyEntity(models.Model):
    _name = 'my.entity'
    _inherit = ['mail.thread', 'mail.activity.mixin']
```

Añade mensajería, seguidores, seguimiento y actividades. Costes:

- columnas adicionales,
- sobrecarga de escritura en cada cambio rastreado,
- crecimiento de `mail.message`,
- abanico de notificaciones.

Use `mail.thread` solo cuando los usuarios necesiten chatter/actividades. Si solo necesita auditoría, considere un modelo de registro dedicado.

### 13.2 `_inherits`

Úselo solo para composición 1:1 genuina (p. ej., `ir.cron` → `ir.actions.server`). Costes:

- creación/escritura en varias tablas,
- join en cada lectura,
- reglas de registro complejas,
- colisiones de nombres de campos.

---

## 14. Errores concretos en las sobrescrituras

| Error | Ejemplo | Solución |
|---|---|---|
| Falta `super()` | `def action_confirm(self): self.write(...)` | llamar a super |
| Firma incorrecta | `def create(self, vals)` | `@api.model_create_multi` |
| Asumir un solo registro | `self.partner_id.name` en multi | bucle o `ensure_one` |
| Cambiar el tipo de retorno | devolver `None` desde un botón | devolver `True`/acción |
| Escribir en un cálculo | `rec.total = ...; rec.line_ids.write(...)` | inverso |
| Falta `@api.depends` | valores calculados obsoletos | declarar todas las dependencias |
| Fuga de contexto | `with_context(...)` no propagado | pasarlo explícitamente |
| Abuso de `sudo()` | todo el método con sudo | limitar su alcance |
| Escritura recursiva | la sobrescritura escribe el mismo modelo | guarda |
| `flush()` por registro | O(n²) | por lotes |
| `search()` en bucle | N+1 | una sola búsqueda |
| SQL en bruto sin flush | lecturas obsoletas | `flush_model` |
| Desvincular en bucle | sorpresas en cascada | lote + `exists()` |
| Ignorar `active_test` | registros archivados invisibles | `with_context(active_test=False)` |
| Valor predeterminado mutable | `fields.Json(default={})` | usar `default=dict` |
| Traducción en `_order` | error SQL | campo almacenado |

---

## 15. Matriz de decisión de extensión

| Requisito | Primera opción | Segunda opción | Evitar |
|---|---|---|---|
| Entidad nueva | modelo nuevo | — | tabla nueva vía SQL |
| Campo nuevo | `_inherit` | Studio (campo manual) | editar el núcleo |
| Comportamiento nuevo | sobrescritura de método | automatización | monkey-patch |
| Pantalla nueva | modelo nuevo + vistas | herencia de vistas | reemplazar el formulario |
| Botón nuevo | herencia de vistas + método | acción de servidor | solo JS |
| API nueva | controlador | webhook de acción de servidor | BD directa |
| Informe nuevo | informe QWeb | vista SQL + modelo | solo BI externo |
| Tarea programada nueva | `ir.cron` | desencadenador temporal de automatización | cron del sistema llamando a RPC |
| Regla específica de cliente | automatización | ICP + sobrescritura | fork |
| Cambio de frontend | parche/registro OWL | paquete de recursos | editar JS del núcleo |

---

## 16. Índice de evidencia

| Tema | Archivo |
|---|---|
| Semántica de `_inherit` | `orm/model_classes.py:152-300` |
| Herencia de vistas | `addons/base/models/ir_ui_view.py` |
| Recursos | `addons/web/tools/_assets.py`, `assets` del manifiesto |
| Controladores | `http.py:1793+`, `addons/base/models/ir_http.py` |
| Plantillas de correo | `addons/mail/models/mail_template.py` |
| Automatización | `addons/base_automation/models/base_automation.py` |
| Acciones de servidor | `addons/base/models/ir_actions.py:586+` |
| Configuración | `addons/base/models/ir_config_parameter.py` |
| Hooks | `modules/loading.py:200-280` |

Continúe con `04-circular-dependencies.md`.
