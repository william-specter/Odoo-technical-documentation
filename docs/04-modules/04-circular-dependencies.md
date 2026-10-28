# Module Relationships IV — Circular Dependencies, Coupling, and Safe Composition

> **Finding.** The Odoo 19 Enterprise tree has **zero manifest dependency cycles** across 1,469 modules. That does not mean the system is loosely coupled: it has heavy fan-in, auto-install coupling, Python import cycles, and data-level circular references. This chapter separates the four kinds.

---

## 1. Four kinds of "circular dependency"

| Kind | Exists? | Example | Risk |
|---|---|---|---|
| Manifest cycle | no (0 in tree) | `a` depends `b`, `b` depends `a` | install impossible |
| Python import cycle | yes, common | `sale` imports `account` symbols | import-time failure if unguarded |
| Data/XML-ID cycle | possible | view references action defined later | load failure |
| Runtime/behaviour cycle | possible | SO creates PO, PO creates SO | infinite document loop |
| Auto-install coupling | yes, widespread | `account` pulls `account_accountant` | unexpected install graph |

The first is forbidden by the graph. The rest are design problems, not loader problems.

---

## 2. Why manifest cycles cannot work

`ModuleGraph` topologically sorts modules by `depends`. A cycle would produce nodes with unsatisfied in-degree and no valid load order. Odoo would fail to resolve or leave modules unloaded.

**Policy:** if two modules need each other's models, extract the shared concepts into a third module, or use a soft dependency.

---

## 3. Legal Python import cycles

Odoo defers model registration: importing a module does not require its dependencies' models to be loaded. This allows:

```python
# sale/models/sale_order.py
from odoo.addons.account.models.account_move import AccountMove  # legal
```

But it also means:

- import-time code that touches the registry fails;
- circular imports can surface only in specific install orders;
- type hints can create cycles that `from __future__ import annotations` would avoid.

**Rules:**

- import models only for type checking (`if TYPE_CHECKING`);
- never execute registry queries at import time;
- use `env['model']` inside methods, not module-level lookups;
- keep cross-module imports minimal.

---

## 4. Soft dependencies

A soft dependency is a runtime check without a manifest dependency:

```python
if 'stock' in self.env:
    self.env['stock.move'].search(...)
```

or:

```python
stock_move = self.env['stock.move'] if 'stock' in self.env else None
```

Use when:

- the feature is optional,
- the module must install standalone,
- you can degrade gracefully.

**Do not** use soft dependencies to avoid declaring a real dependency. If the feature is required for the module's core behaviour, declare it.

### 4.1 Guarded imports

```python
try:
    import zeep
except ImportError:
    zeep = None
```

This is acceptable only for optional external libraries declared in `external_dependencies`.

---

## 5. Data-level cycles

### 5.1 XML load order

Data files load in manifest order. A record that references a record defined later in the same module fails. Solutions:

1. reorder files (security → data → views → actions → menus),
2. split into two modules,
3. use `ref` only to records guaranteed to exist.

### 5.2 Circular references between records

Two records referencing each other via many2one cannot be created in one pass with both FKs required. Patterns:

- create A without B, create B with A, update A with B;
- use a link model (many2many) instead of reciprocal FKs;
- make one side nullable.

### 5.3 View/action cycles

A view referencing an action that references the view is fine if the action is created first and the view references it by XML ID. Circular *inheritance* (view A inherits B, B inherits A) is invalid and causes recursion.

---

## 6. Runtime behaviour cycles

The dangerous ones are business-process loops:

| Loop | Cause | Detection |
|---|---|---|
| SO ↔ PO | intercompany rules on both sides | duplicate documents, growing counts |
| MO ↔ MO | BoM A contains B, B contains A | explosion recursion / infinite BOM |
| Automation ↔ automation | A writes X, B writes back | `__action_done` prevents same-record recursion only |
| Cron ↔ cron | job A triggers B triggers A | trigger timestamps, job logs |
| Webhook ↔ webhook | external systems call each other | event ids, rate limits |
| Recompute loop | compute writes its own dependency | 10-iteration warning |

### 6.1 BoM cycles

`mrp.bom.explode` is iterative (BFS), so a direct cycle would loop forever unless a depth guard exists. Odoo does not provide a general cycle detector for BoMs; a BoM that contains itself (directly or through phantoms) is a data error.

**Guard:**

```python
def _check_bom_cycle(self):
    seen = set()
    stack = [(self, 0)]
    while stack:
        bom, depth = stack.pop()
        if bom.id in seen or depth > 20:
            raise ValidationError(_("BoM cycle detected"))
        seen.add(bom.id)
        for line in bom.bom_line_ids:
            child = line.product_id.product_tmpl_id.bom_ids[:1]
            if child:
                stack.append((child, depth + 1))
```

### 6.2 Intercompany loops

If company A auto-creates a PO in B on SO confirmation, and B auto-creates an SO in A on PO confirmation, the two rules ping-pong. Guard with:

- an origin flag (`is_intercompany_generated`),
- a check that the partner is the intercompany partner,
- idempotency on the source document,
- disabling one direction.

---

## 7. Auto-install coupling

`auto_install` creates implicit edges that are not in `depends`. Installing `account` in an Enterprise database pulls:

```
account
├── account_accountant (auto)
├── account_reports (auto)
├── account_asset (auto)
├── account_edi_ubl_cii (auto)
├── account_fiscal_categories (auto)
└── ...
```

Consequences:

- install time and disk usage,
- menu/permission changes,
- model/field additions you did not plan for,
- upgrade surface.

**Mitigation:**

- audit the closure before install:

```python
modules = env['ir.module.module'].search([('name', '=', 'account')])
print(modules.downstream_dependencies())
```

- use `--skip-auto-install` in controlled deployments,
- pin the module list in your deployment manifest,
- test with the exact closure.

---

## 8. Coupling metrics

| Metric | Meaning | Healthy range |
|---|---|---|
| Fan-in | modules depending on X | high for `base`/`account`, low for custom |
| Fan-out | modules X depends on | 5–15 typical; > 25 suspicious |
| Depth | longest path to base | 8–14 typical; > 18 fragile |
| Instability | fan-out / (fan-in + fan-out) | high for leaf apps, low for core |
| Abstractness | interfaces / total | not applicable (no interfaces) |

Custom modules should have **low fan-in** (few dependents) and **moderate fan-out** (clear dependencies). A custom module with 20 dependents is a platform, not a customisation.

---

## 9. Breaking a cycle

### 9.1 Extract shared concepts

```
Before:
  custom_sales -> custom_inventory -> custom_sales

After:
  custom_core (models, mixins)
     ^          ^
  custom_sales  custom_inventory
```

### 9.2 Invert with events/outbox

Instead of `A` calling `B` synchronously, `A` writes an outbox event and `B` consumes it. This removes the code dependency but adds operational complexity.

### 9.3 Use a soft dependency

If `B` is optional, check `if 'b' in env` and degrade. Document the degraded behaviour.

### 9.4 Merge the modules

If two modules are always installed together and share models, they are one module. Splitting them creates artificial complexity.

---

## 10. Composition rules

1. **Depend on abstractions, not apps.** Put shared fields/mixins in a small `*_core` module.
2. **One direction only.** If A depends on B, B must never import A.
3. **No model imports at module level.** Use `env` inside methods.
4. **No registry access at import time.**
5. **Declare every hard dependency.** Soft dependencies are for optional features only.
6. **Guard optional imports.** Use `try/except ImportError` + `external_dependencies`.
7. **Test standalone installs.** A module that only works in a full stack is not reusable.
8. **Test the full closure.** Auto-install can change behaviour.
9. **Document the dependency graph** in the module README.
10. **Keep custom modules leaf-ward.** Platform modules should not depend on custom modules.

---

## 11. Diagnostic commands

```bash
# List installed modules and states
psql -d mydb -c "SELECT name, state, latest_version FROM ir_module_module WHERE state <> 'uninstalled' ORDER BY name;"

# Find dependents of a module
psql -d mydb -c "
SELECT d.name, d.state
FROM ir_module_module_dependency dep
JOIN ir_module_module d ON d.id = dep.module_id
JOIN ir_module_module m ON m.id = dep.depend_id
WHERE m.name = 'account'
ORDER BY d.name;"

# Detect manifest cycles in a custom addons path
python3 - <<'PY'
import ast, os, collections
mods = {}
for root, dirs, files in os.walk('addons'):
    if '__manifest__.py' in files:
        name = os.path.basename(root)
        m = ast.literal_eval(open(os.path.join(root, '__manifest__.py')).read())
        mods[name] = set(m.get('depends', []))
# Kahn
indeg = {m: 0 for m in mods}
for m, deps in mods.items():
    for d in deps:
        if d in indeg:
            indeg[m] += 1
q = collections.deque([m for m, n in indeg.items() if n == 0])
seen = 0
while q:
    m = q.popleft(); seen += 1
    for n, deps in mods.items():
        if m in deps:
            indeg[n] -= 1
            if indeg[n] == 0:
                q.append(n)
print('cycles or unresolved:', len(mods) - seen)
PY
```

---

## 12. Evidence index

| Topic | File |
|---|---|
| Graph sorting | `modules/module_graph.py:160-317` |
| Load phases | `modules/module_graph.py:26-160` |
| Auto-install | `addons/base/models/ir_module.py:407-434` |
| Dependency table | `ir_module_module_dependency` |
| BoM explosion | `addons/mrp/models/mrp_bom.py:419-474` |
| Intercompany rules | `addons/account_inter_company_rules/models/` |

Continue with `05-upgrade-compat.md`.
