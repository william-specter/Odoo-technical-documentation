# Module Relationships III — Extension Points Ranked by Safety

> **Rule zero.** Never edit files under `odoo/addons/` or the Enterprise source tree. Every change must live in a custom module. This is not just maintainability: signed upgrades, support contracts, and licence compliance assume an untouched core.

---

## 1. Safety ranking

| Rank | Extension point | Stability | Blast radius | Recommended for |
|---|---|---|---|---|
| 1 | New model | high | none | new business objects |
| 2 | `_inherit` + `super()` | medium | model-wide | fields, behaviour |
| 3 | View inheritance | medium | UI | layout, buttons, fields |
| 4 | Asset bundles | medium | frontend | JS/CSS/OWL |
| 5 | Controllers | medium | HTTP | APIs, portal |
| 6 | OWL patches | medium-low | frontend | component behaviour |
| 7 | Mail templates | high | notifications | emails |
| 8 | `base.automation` | high | data-driven | admin rules |
| 9 | `ir.actions.server` | medium | data-driven | procedural actions |
| 10 | `ir.config_parameter` | high | config | feature flags |
| 11 | Module hooks | low | lifecycle | one-time setup |
| 12 | `_inherit` on `mail.thread` | low | messaging | tracking |
| 13 | `_inherits` | low | schema | composition |
| 14 | Monkey-patching | very low | unknown | never |

---

## 2. New models (safest)

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

Checklist:

- [ ] `_description` (required for UI)
- [ ] `_order` with `id` tiebreaker
- [ ] `company_id` + record rule
- [ ] ACLs in `security/ir.model.access.csv`
- [ ] `_rec_name` or a `name` field
- [ ] `mail.thread` only if needed
- [ ] indexes on filtered FKs
- [ ] `@api.constrains` for invariants
- [ ] tests

**Why safest:** no existing behaviour changes; failures are isolated.

---

## 3. `_inherit` + `super()` (most common)

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

Rules:

- always call `super()`, even if the base is a no-op;
- preserve the signature (positional/keyword);
- handle recordsets, not single records;
- do not change return types (`True` vs action dict);
- add `depends` for every module whose behaviour you extend;
- test with all modules installed, not just your module.

### 3.1 Where to hook

| Goal | Hook |
|---|---|
| Add a field on confirm | `_prepare_confirmation_values` |
| Add side effects after confirm | `_action_confirm` |
| Change invoice header | `_prepare_invoice` |
| Change invoice lines | `_prepare_invoice_lines_vals_list` |
| Change invoiceability | `_get_invoiceable_lines` |
| Change stock procurement | `_action_launch_stock_rule` (risky) |
| Change picking validation | `button_validate` (risky) |
| Change move execution | `_action_done` (very risky) |
| Change posting | `_post` (very risky) |

**[WARNING]** Overriding `action_confirm` to add a guard is safe; overriding it to replace the whole confirmation is a fork. Prefer the smallest hook.

---

## 4. View inheritance

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

Positions: `inside`, `after`, `before`, `replace`, `attributes`.

Rules:

- use `xpath` with a stable anchor (field/button name), not positional indexes;
- never `position="replace"` a whole form; replace the smallest node;
- inherit by XML ID, not by view name;
- test with all modules that also inherit the view (xpath collisions are common);
- `mode="primary"` creates a new view, not an extension.

**[WARNING]** XPath expressions are brittle. A core upgrade that renames a field/button breaks your view at module load, not at runtime. Pin the Odoo version and run view validation in CI.

---

## 5. Asset bundles

```python
'assets': {
    'web.assets_backend': [
        'my_module/static/src/**/*.js',
        'my_module/static/src/**/*.xml',
        'my_module/static/src/**/*.scss',
    ],
}
```

- Bundle names: `web.assets_backend`, `web.assets_frontend`, `web.assets_common`, `point_of_sale.assets`, `website.assets_frontend`.
- Globs are supported; order matters.
- `('include', 'module/file')` includes an existing asset.
- `('remove', 'module/file')` removes one.
- Assets are rebuilt on module upgrade; browser cache is busted by a hash.

**[WARNING]** Do not put secrets in frontend assets. Everything in a bundle is public.

---

## 6. Controllers

```python
class MyController(http.Controller):

    @http.route('/my/api/orders', type='jsonrpc', auth='user', methods=['POST'])
    def orders(self, **kwargs):
        orders = request.env['sale.order'].search([('partner_id', '=', request.env.user.partner_id.id)])
        return [{'id': o.id, 'name': o.name} for o in orders]
```

Rules:

- `auth='user'` for backend, `auth='public'` only for public pages;
- `csrf=True` for browser forms, disabled only for signed API callbacks;
- `readonly=True` when the route only reads;
- validate input types and bounds;
- call `check_access` explicitly for records fetched by id;
- return JSON-serialisable data (no recordsets);
- version your API path (`/my/api/v1/...`).

---

## 7. OWL components and patches

Odoo 19's backend is OWL 2. Extension patterns:

| Pattern | Use |
|---|---|
| New component + registry | new UI feature |
| `patch(Component.prototype, {...})` | modify existing behaviour |
| `registry.category('fields').add(...)` | new field widget |
| `registry.category('views').add(...)` | new view type |
| `registry.category('services').add(...)` | new service |
| Template inheritance (`t-inherit`) | modify XML templates |

**[WARNING]** OWL internals are not stable across minor versions. Patches on private methods break silently. Prefer public registries and documented hooks; pin the version.

---

## 8. Mail templates

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

- Templates are QWeb; `object` is the record.
- `lang` controls translation.
- Attachments can be report actions.
- Sending is queued via `mail.mail` unless `force_send=True`.

**[WARNING]** Rendering a template in a loop is expensive. Use `message_post_with_source` with explicit recipients and batch where possible.

---

## 9. Automated actions

`base.automation` is the safest way to add customer-specific rules without deployment:

- trigger on create/write/time/message,
- filter with domains,
- execute server actions,
- no code deployment, but also no version control by default.

**[WARNING]** Automations are data, not code. They are not in Git, not tested in CI, and can be edited by any admin. Export them as XML and review changes.

---

## 10. Server actions

`ir.actions.server` types: update, create, copy, code, webhook, multi.

- `code` runs via `safe_eval` with `env`, `model`, `record`, `records`.
- Only `base.group_system` should edit code actions.
- Webhooks have no retry/signature by default.
- Server actions are stored in `ir_act_server`, not in module code.

**Use for:** small procedural glue, one-off fixes, admin-triggered actions.
**Do not use for:** core business logic, integrations requiring reliability, anything needing tests.

---

## 11. Configuration and feature flags

```python
enabled = env['ir.config_parameter'].sudo().get_param('my_module.enabled', '0') == '1'
```

- `ir.config_parameter` is a key/value table; values are strings.
- `res.config.settings` provides the admin UI and `get_values`/`set_values`.
- Company-specific settings belong on `res.company`, not ICP.
- User-specific settings belong on `res.users` or `ir.default`.

**[WARNING]** ICP reads are cheap but not free; cache in a local variable per request, not per record.

---

## 12. Module hooks

| Hook | When | Use |
|---|---|---|
| `pre_init_hook(env)` | before model load | create columns/tables needed by the module |
| `post_init_hook(env)` | after data load, before installed | seed data, configure |
| `uninstall_hook(env)` | before uninstall | cleanup external resources |
| `post_load()` | after server load | **not supported as manifest key in this build** |

Rules:

- idempotent,
- fast,
- no commit,
- no reliance on `state='installed'` in `post_init_hook`,
- log what you change.

---

## 13. `mail.thread` and `_inherits`

### 13.1 `mail.thread`

```python
class MyEntity(models.Model):
    _name = 'my.entity'
    _inherit = ['mail.thread', 'mail.activity.mixin']
```

Adds messaging, followers, tracking, activities. Costs:

- extra columns,
- write overhead on every tracked change,
- `mail.message` growth,
- notification fan-out.

Use only when users need chatter/activities. For audit only, consider a dedicated log model.

### 13.2 `_inherits`

Use only for genuine 1:1 composition (e.g. `ir.cron` → `ir.actions.server`). Costs:

- multi-table create/write,
- join on every read,
- complex record rules,
- field name collisions.

---

## 14. Concrete override pitfalls

| Pitfall | Example | Fix |
|---|---|---|
| Missing `super()` | `def action_confirm(self): self.write(...)` | call super |
| Wrong signature | `def create(self, vals)` | `@api.model_create_multi` |
| Assuming one record | `self.partner_id.name` on multi | loop or `ensure_one` |
| Changing return type | returning `None` from a button | return `True`/action |
| Writing in a compute | `rec.total = ...; rec.line_ids.write(...)` | inverse |
| Missing `@api.depends` | stale computed values | declare all deps |
| Context leak | `with_context(...)` not propagated | pass explicitly |
| `sudo()` creep | entire method sudo | scope it |
| Recursive write | override writes same model | guard |
| `flush()` per record | O(n²) | batch |
| `search()` in loop | N+1 | one search |
| Raw SQL without flush | stale reads | `flush_model` |
| Unlinking in a loop | cascade surprises | batch + `exists()` |
| Ignoring `active_test` | archived records invisible | `with_context(active_test=False)` |
| Mutable default | `fields.Json(default={})` | use `default=dict` |
| Translation in `_order` | SQL error | stored field |

---

## 15. Extension decision matrix

| Requirement | First choice | Second choice | Avoid |
|---|---|---|---|
| New entity | new model | — | new table via SQL |
| New field | `_inherit` | Studio (manual field) | core edit |
| New behaviour | method override | automation | monkey-patch |
| New screen | new model + views | view inheritance | replace form |
| New button | view inheritance + method | server action | JS-only |
| New API | controller | server action webhook | direct DB |
| New report | QWeb report | SQL view + model | external BI only |
| New scheduled job | `ir.cron` | automation time trigger | system cron calling RPC |
| Customer-specific rule | automation | ICP + override | fork |
| Frontend change | OWL patch/registry | asset bundle | core JS edit |

---

## 16. Evidence index

| Topic | File |
|---|---|
| `_inherit` semantics | `orm/model_classes.py:152-300` |
| View inheritance | `addons/base/models/ir_ui_view.py` |
| Assets | `addons/web/tools/_assets.py`, manifest `assets` |
| Controllers | `http.py:1793+`, `addons/base/models/ir_http.py` |
| Mail templates | `addons/mail/models/mail_template.py` |
| Automation | `addons/base_automation/models/base_automation.py` |
| Server actions | `addons/base/models/ir_actions.py:586+` |
| Config | `addons/base/models/ir_config_parameter.py` |
| Hooks | `modules/loading.py:200-280` |

Continue with `04-circular-dependencies.md`.
