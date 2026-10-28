# Relaciones entre módulos IV — Dependencias circulares, acoplamiento y composición segura

> **Hallazgo.** El árbol de Odoo 19 Enterprise tiene **cero ciclos de dependencias de manifiesto** en 1,469 módulos. Eso no significa que el sistema esté débilmente acoplado: presenta un fan-in elevado, acoplamiento por auto-instalación, ciclos de importación de Python y referencias circulares a nivel de datos. Este capítulo separa los cuatro tipos.

---

## 1. Cuatro tipos de «dependencia circular»

| Tipo | ¿Existe? | Ejemplo | Riesgo |
|---|---|---|---|
| Ciclo de manifiesto | no (0 en el árbol) | `a` depende de `b`, `b` depende de `a` | instalación imposible |
| Ciclo de importación de Python | sí, frecuente | `sale` importa símbolos de `account` | fallo en tiempo de importación si no se protege |
| Ciclo de datos/XML-ID | posible | la vista referencia una acción definida después | fallo de carga |
| Ciclo de ejecución/comportamiento | posible | el pedido de venta crea un pedido de compra y este crea un pedido de venta | bucle infinito de documentos |
| Acoplamiento por auto-instalación | sí, generalizado | `account` arrastra `account_accountant` | grafo de instalación inesperado |

El primero está prohibido por el grafo. El resto son problemas de diseño, no problemas del cargador.

---

## 2. Por qué los ciclos de manifiesto no pueden funcionar

`ModuleGraph` ordena topológicamente los módulos según `depends`. Un ciclo produciría nodos con grado de entrada insatisfecho y sin un orden de carga válido. Odoo no podría resolverlo o dejaría módulos sin cargar.

**Política:** si dos módulos necesitan los modelos del otro, se deben extraer los conceptos compartidos a un tercer módulo o usar una dependencia blanda.

---

## 3. Ciclos de importación legales en Python

Odoo difiere el registro de modelos: importar un módulo no requiere que los modelos de sus dependencias estén cargados. Esto permite:

```python
# sale/models/sale_order.py
from odoo.addons.account.models.account_move import AccountMove  # legal
```

Pero también implica:

- el código que accede al registro en tiempo de importación falla;
- los ciclos de importación pueden manifestarse solo en órdenes de instalación específicos;
- las anotaciones de tipo pueden crear ciclos que `from __future__ import annotations` evitaría.

**Reglas:**

- importar modelos solo para la comprobación de tipos (`if TYPE_CHECKING`);
- no ejecutar nunca consultas al registro en tiempo de importación;
- usar `env['model']` dentro de los métodos, no búsquedas a nivel de módulo;
- mantener mínimas las importaciones entre módulos.

---

## 4. Dependencias blandas

Una dependencia blanda es una comprobación en tiempo de ejecución sin una dependencia de manifiesto:

```python
if 'stock' in self.env:
    self.env['stock.move'].search(...)
```

o:

```python
stock_move = self.env['stock.move'] if 'stock' in self.env else None
```

Se debe usar cuando:

- la funcionalidad es opcional,
- el módulo debe instalarse de forma autónoma,
- se puede degradar de forma controlada.

**No** se deben usar dependencias blandas para evitar declarar una dependencia real. Si la funcionalidad es necesaria para el comportamiento central del módulo, se debe declarar.

### 4.1 Importaciones protegidas

```python
try:
    import zeep
except ImportError:
    zeep = None
```

Esto es aceptable solo para bibliotecas externas opcionales declaradas en `external_dependencies`.

---

## 5. Ciclos a nivel de datos

### 5.1 Orden de carga de XML

Los archivos de datos se cargan en el orden del manifiesto. Un registro que referencia un registro definido después en el mismo módulo falla. Soluciones:

1. reordenar los archivos (seguridad → datos → vistas → acciones → menús),
2. dividir en dos módulos,
3. usar `ref` solo para registros cuya existencia esté garantizada.

### 5.2 Referencias circulares entre registros

Dos registros que se referencian mutuamente mediante many2one no se pueden crear en una sola pasada si ambas claves foráneas son obligatorias. Patrones:

- crear A sin B, crear B con A y actualizar A con B;
- usar un modelo de enlace (many2many) en lugar de claves foráneas recíprocas;
- hacer que uno de los lados admita valores nulos.

### 5.3 Ciclos vista/acción

Una vista que referencia una acción que a su vez referencia la vista es correcta si la acción se crea primero y la vista la referencia mediante XML ID. La *herencia* circular (la vista A hereda de B y B hereda de A) no es válida y provoca recursión.

---

## 6. Ciclos de comportamiento en ejecución

Los peligrosos son los bucles de procesos de negocio:

| Bucle | Causa | Detección |
|---|---|---|
| Pedido de venta ↔ pedido de compra | reglas intercompañía en ambos lados | documentos duplicados, recuentos crecientes |
| OF ↔ OF | la LdM A contiene B y B contiene A | recursión de explosión / LdM infinita |
| Automatización ↔ automatización | A escribe X y B escribe de vuelta | `__action_done` solo evita la recursión en el mismo registro |
| Cron ↔ cron | el trabajo A activa B y B activa A | marcas de tiempo de activación, registros de trabajos |
| Webhook ↔ webhook | los sistemas externos se llaman entre sí | identificadores de evento, límites de tasa |
| Bucle de recálculo | el cálculo escribe su propia dependencia | advertencia tras 10 iteraciones |

### 6.1 Ciclos de LdM

`mrp.bom.explode` es iterativo (BFS), por lo que un ciclo directo se repetiría indefinidamente a menos que exista una protección de profundidad. Odoo no proporciona un detector general de ciclos para las LdM; una LdM que se contiene a sí misma (de forma directa o mediante fantasmas) es un error de datos.

**Protección:**

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

### 6.2 Bucles intercompañía

Si la compañía A crea automáticamente un pedido de compra en B al confirmar un pedido de venta, y B crea automáticamente un pedido de venta en A al confirmar un pedido de compra, las dos reglas se rebotan mutuamente. Se debe proteger con:

- una marca de origen (`is_intercompany_generated`),
- una comprobación de que el contacto es el contacto intercompañía,
- idempotencia en el documento de origen,
- la desactivación de una de las direcciones.

---

## 7. Acoplamiento por auto-instalación

`auto_install` crea aristas implícitas que no están en `depends`. Instalar `account` en una base de datos Enterprise arrastra:

```
account
├── account_accountant (auto)
├── account_reports (auto)
├── account_asset (auto)
├── account_edi_ubl_cii (auto)
├── account_fiscal_categories (auto)
└── ...
```

Consecuencias:

- tiempo de instalación y uso de disco,
- cambios en menús y permisos,
- adiciones de modelos y campos no previstas,
- superficie de actualización.

**Mitigación:**

- auditar el cierre antes de la instalación:

```python
modules = env['ir.module.module'].search([('name', '=', 'account')])
print(modules.downstream_dependencies())
```

- usar `--skip-auto-install` en despliegues controlados,
- fijar la lista de módulos en el manifiesto de despliegue,
- probar con el cierre exacto.

---

## 8. Métricas de acoplamiento

| Métrica | Significado | Rango saludable |
|---|---|---|
| Fan-in | módulos que dependen de X | alto para `base`/`account`, bajo para personalizados |
| Fan-out | módulos de los que depende X | 5–15 típico; > 25 sospechoso |
| Profundidad | ruta más larga hasta `base` | 8–14 típico; > 18 frágil |
| Inestabilidad | fan-out / (fan-in + fan-out) | alto para aplicaciones hoja, bajo para el núcleo |
| Abstracción | interfaces / total | no aplicable (no hay interfaces) |

Los módulos personalizados deben tener un **fan-in bajo** (pocos dependientes) y un **fan-out moderado** (dependencias claras). Un módulo personalizado con 20 dependientes es una plataforma, no una personalización.

---

## 9. Romper un ciclo

### 9.1 Extraer los conceptos compartidos

```
Before:
  custom_sales -> custom_inventory -> custom_sales

After:
  custom_core (models, mixins)
     ^          ^
  custom_sales  custom_inventory
```

### 9.2 Invertir con eventos/outbox

En lugar de que `A` llame a `B` de forma síncrona, `A` escribe un evento en la bandeja de salida y `B` lo consume. Esto elimina la dependencia de código, pero añade complejidad operativa.

### 9.3 Usar una dependencia blanda

Si `B` es opcional, se debe comprobar `if 'b' in env` y degradar. Se debe documentar el comportamiento degradado.

### 9.4 Fusionar los módulos

Si dos módulos se instalan siempre juntos y comparten modelos, son un solo módulo. Dividirlos crea una complejidad artificial.

---

## 10. Reglas de composición

1. **Depender de abstracciones, no de aplicaciones.** Colocar los campos y mixins compartidos en un módulo `*_core` pequeño.
2. **Una sola dirección.** Si A depende de B, B nunca debe importar A.
3. **Sin importaciones de modelos a nivel de módulo.** Usar `env` dentro de los métodos.
4. **Sin acceso al registro en tiempo de importación.**
5. **Declarar todas las dependencias duras.** Las dependencias blandas son solo para funcionalidades opcionales.
6. **Proteger las importaciones opcionales.** Usar `try/except ImportError` + `external_dependencies`.
7. **Probar las instalaciones autónomas.** Un módulo que solo funciona en una pila completa no es reutilizable.
8. **Probar el cierre completo.** La auto-instalación puede cambiar el comportamiento.
9. **Documentar el grafo de dependencias** en el README del módulo.
10. **Mantener los módulos personalizados hacia las hojas.** Los módulos de plataforma no deben depender de módulos personalizados.

---

## 11. Comandos de diagnóstico

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

## 12. Índice de evidencia

| Tema | Archivo |
|---|---|
| Ordenación del grafo | `modules/module_graph.py:160-317` |
| Fases de carga | `modules/module_graph.py:26-160` |
| Auto-instalación | `addons/base/models/ir_module.py:407-434` |
| Tabla de dependencias | `ir_module_module_dependency` |
| Explosión de LdM | `addons/mrp/models/mrp_bom.py:419-474` |
| Reglas intercompañía | `addons/account_inter_company_rules/models/` |

Continuar con `05-upgrade-compat.md`.
