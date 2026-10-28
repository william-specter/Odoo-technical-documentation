# Glosario de aspectos internos de Odoo

> Términos que se usan de forma ambigua en la documentación de Odoo. Cada entrada proporciona el **significado preciso en tiempo de ejecución** y la idea errónea habitual.

---

## A

**ACL (Access Control List)**
Una fila en `ir.model.access` que concede permisos CRUD sobre un modelo a un grupo. Las ACL son de alcance de modelo, no específicas de registro. Se comprueban antes que las reglas de registro.
*Idea errónea:* las ACL no son «permisos sobre menús». La visibilidad de menús es una relación `ir.ui.menu.groups_id` aparte.

**Acción**
Una instrucción de interfaz almacenada (`ir.actions.act_window`, `ir.actions.server`, `ir.actions.report`, `ir.actions.client`, `ir.actions.act_url`). Las acciones son datos, no código. Una acción de servidor puede ejecutar Python mediante `safe_eval` bajo restricciones estrictas.

**`_auto`**
Marca de modelo que controla la creación automática de la tabla. `_auto = True` (valor predeterminado para los modelos concretos) crea y sincroniza una tabla. `_auto = False` significa que el desarrollador debe crear manualmente una tabla o una vista SQL, normalmente con `_table_query`.

**`api.depends`**
Decorador que declara las dependencias de campos para un campo calculado. Las dependencias ausentes provocan valores obsoletos, no errores. `api.depends_context` declara claves de contexto que particionan la caché.

**`api.model` / `api.model_create_multi`**
Decoradores que describen la vinculación de métodos. Los métodos `@api.model` se pueden invocar sobre un conjunto de registros vacío. `@api.model_create_multi` es obligatorio para las sobrescrituras de `create()` que aceptan una lista de diccionarios de valores.

---

## B

**BaseModel / Model / TransientModel / AbstractModel**
Las cuatro clases base de modelo. `Model` es persistente; `TransientModel` se limpia periódicamente y se usa para asistentes; `AbstractModel` no tiene tabla y se usa para mixins. `BaseModel` es la raíz de bajo nivel.

**Bus**
El sistema de notificaciones `bus.bus` respaldado por PostgreSQL que utiliza el servicio websocket. La entrega es como máximo una vez. No es un broker de mensajes; no es duradero.

---

## C

**Campo dependiente de la compañía**
Un campo cuyo valor difiere por compañía, almacenado como `jsonb` indexado por id de compañía. Antes se denominaba «campo de propiedad». El acceso usa `with_company()`. No puede ser `required` ni traducible.

**Campo calculado**
Un campo cuyo valor se produce mediante un método. Si `store=True`, el valor se persiste y se recalcula cuando cambian las dependencias. Si `store=False`, se calcula al acceder y no se puede buscar a menos que se proporcione un método `search`.

**Contexto**
Un `frozendict` inmutable que contiene el entorno. Se usa para idioma, zona horaria, compañía, prueba activa y marcas arbitrarias. El contexto **no** es una frontera de seguridad; los usuarios a menudo pueden influirlo mediante RPC.

**Cursor**
Un envoltorio de cursor de `psycopg2` (`odoo.sql_db.Cursor`) que posee la transacción, los hooks pre/post-commit y la `Transaction` del ORM. Uno por petición/trabajo.

---

## D

**Herencia por delegación (`_inherits`)**
Herencia basada en composición: el modelo hijo almacena un many2one a un padre y expone los campos del padre como campos relacionados. La usan `ir.cron` → `ir.actions.server`, `product.product` → `product.template` (históricamente) y los subtipos de `mail.message`.
*Idea errónea:* `_inherits` no copia columnas; delega lecturas/escrituras.

**Dominio**
Una lista de ternas `(field, operator, value)` que el ORM evalúa a SQL. Admite prefijos lógicos (`&`, `|`, `!`), `child_of`, `parent_of`, `any`, `not any` y operadores de fecha. Los dominios son datos y se pueden evaluar mediante `safe_eval` en reglas de registro y acciones.

**Envío directo**
Una ruta de abastecimiento en la que el proveedor envía directamente al cliente. En Odoo 19 se representa mediante movimientos de stock entre las ubicaciones de proveedor y cliente, a menudo con una `stock.reference` que vincula documentos.

---

## E

**Entorno (`env`)**
El objeto de contexto en tiempo de ejecución: `cr`, `uid`, `context`, `su`, `transaction`, además de acceso tipo mapping a los modelos. Inmutable; se deriva con `env(user=..., context=..., su=...)`.

**ID externo (ID XML)**
Una cadena `module.identifier` almacenada en `ir.model.data`, que se asigna a un modelo y a un id de registro. La usan los archivos de datos, las vistas, las acciones y `env.ref()`. Los ID externos **no** son únicos por modelo; son únicos a nivel global por módulo.

---

## F

**Campo**
Un objeto descriptor en una clase de modelo. Conoce su tipo, almacenamiento, métodos de cálculo/inverso/búsqueda, dependencias, grupos de acceso, dependencia de compañía, traducción y seguimiento. Los campos se comparten entre registros cuando es posible.

**Filestore**
El directorio (o bucket de S3) que contiene los adjuntos binarios. La ruta se deriva del nombre de la base de datos y del hash del adjunto. Debe respaldarse junto con la base de datos.

---

## G

**Grupo**
Un registro de `res.groups`. Los grupos implican otros grupos mediante `implied_ids` y controlan ACL, reglas de registro, acceso a campos, menús y marcas de funcionalidad. La comprobación en tiempo de ejecución es `has_group('module.xmlid')`.

---

## H

**Cadena de hash (contabilidad)**
Cuando un diario habilita `restrict_mode_hash_table`, los asientos publicados se encadenan con SHA-256 sobre campos seleccionados más el hash anterior. El hash se almacena en `inalterable_hash`. La edición de un asiento con hash está bloqueada. Es un control de inalterabilidad, no una cadena de bloques.

---

## I

**`ir.model` / `ir.model.fields`**
El reflejo de metadatos del registro de Python. Lo usan la interfaz, Studio y las vistas dinámicas. Se sincroniza durante la carga de módulos. Un campo puede existir en Python pero no en `ir.model.fields` si falló la reflexión; esto provoca su invisibilidad en la interfaz.

**Herencia (`_inherit`)**
Extensión de un modelo existente en su lugar. La clase del modelo se reconstruye con la nueva definición en su MRO. `_inherit` sin `_name` extiende; `_inherit` con `_name` crea un modelo nuevo que también hereda los campos y el comportamiento del padre.

---

## J

**Diario**
Un contenedor contable (`account.journal`) que define la secuencia, la moneda, las cuentas predeterminadas y las reglas de publicación. Cada `account.move` pertenece exactamente a un diario.

---

## L

**Libro mayor**
El conjunto de filas publicadas de `account.move.line`. No hay una tabla de libro mayor separada; los saldos se calculan agregando las líneas de asiento por cuenta y fecha.

**Fecha de bloqueo**
Una fecha a nivel de compañía (`hard_lock_date`, `fiscalyear_lock_date`, `tax_lock_date`) que impide publicar o modificar asientos anteriores a ella. Se aplica en la escritura/publicación de `account.move`, no en PostgreSQL.

---

## M

**Tabla de relación many2many**
Una tabla implícita denominada `<table1>_<table2>_rel` con las columnas `<table1>_id` y `<table2>_id`, una clave primaria compuesta y un índice inverso. Los valores explícitos `relation`, `column1` y `column2` anulan la nomenclatura.

**Módulo**
Un paquete Python con un manifiesto (`__manifest__.py`) bajo una ruta de addons. Un módulo puede ser `installable`, `auto_install`, y puede declarar `depends`, `data`, `demo`, `assets`, hooks y dependencias externas.

**MRO (Method Resolution Order)**
La linealización C3 de Python de una clase de modelo del registro. Determina el comportamiento de `super()` entre las sobrescrituras de módulos. Se deriva del orden de carga de módulos, no de las sentencias import.

---

## N

**`noupdate`**
Atributo XML de los datos. Los registros con `noupdate="1"` se crean en la instalación pero **no se actualizan** al actualizar. Se almacena en `ir.model.data.noupdate`.

---

## O

**ORM**
Object-Relational Mapper (mapeador objeto-relacional). En Odoo también es el entorno de ejecución de la lógica de negocio: los modelos contienen comportamiento, no solo datos.

**`_order`**
`ORDER BY` SQL predeterminado para las búsquedas de un modelo. Debe referenciar columnas almacenadas; un campo no almacenado provoca un error SQL o un mecanismo de reserva.

---

## P

**Prefetch**
El agrupamiento automático de lecturas del ORM para registros del mismo conjunto de registros. Acceder a `record.field` en un conjunto de 100 registros obtiene los 100 valores en una sola consulta. El prefetch se desactiva o altera con `with_prefetch()`, `prefetch_fields` y algunas operaciones x2many.

**Abastecimiento**
El mecanismo que convierte una demanda (línea de pedido de venta, regla de reabastecimiento, componente de OF) en movimientos de stock mediante `stock.rule`. En Odoo 19 el objeto de agrupación es `stock.reference`, no `procurement.group`.

---

## Q

**Quant**
`stock.quant` es la cantidad disponible autoritativa por producto/ubicación/lote/paquete/propietario. Almacena `quantity` y `reserved_quantity`. Los movimientos de stock no cambian directamente los quants; lo hacen las líneas de movimiento, mediante `_update_available_quantity`.

---

## R

**Regla de registro**
Una fila en `ir.rule` con un dominio que se evalúa por usuario/compañía. Las reglas globales se combinan con AND; las reglas de grupo se combinan con OR dentro del mismo conjunto de grupos. `sudo()` las omite; `with_user()` no.

**Registro**
El contenedor por base de datos de clases de modelo ensambladas y metadatos. Véase `00-overview/01-architecture.md`.

**`res.config.settings`**
Un modelo transitorio utilizado como formulario de configuración. Escribe en `ir.config_parameter`, en campos de compañía o en otros modelos mediante `set_values`/`get_values`. No es en sí mismo un almacén de configuración.

**`res.partner`**
El modelo de datos maestros de terceros: clientes, proveedores, contactos, compañías y direcciones. Casi todos los documentos de negocio lo referencian.

---

## S

**`safe_eval`**
Un evaluador restringido de Python usado para dominios, acciones, acciones de servidor y acciones automatizadas. Bloquea importaciones y builtins peligrosos, pero **no** es un sandbox frente a un administrador decidido. El código de las acciones de servidor debe tratarse como código de confianza.

**Punto de guardado**
Una transacción anidada de PostgreSQL. Odoo expone `with env.cr.savepoint():` y lo usa internamente para la asignación de secuencias e inserciones opcionales. La reversión de un punto de guardado no revierte la transacción externa.

**Secuencia**
Un mecanismo de numeración, no una `SEQUENCE` de PostgreSQL. Odoo 19 usa un `sequence.mixin` con `_locked_increment`, que bloquea una entrada de índice única para asignar números casi sin huecos por diario/periodo. Aun así pueden producirse huecos al revertir.

**`sudo()`**
Devuelve un entorno con `su=True`, omitiendo las ACL y las reglas de registro. **No** cambia `uid`; los campos de auditoría conservan el usuario original. Usarlo con moderación y documentar por qué.

---

## T

**Modelo transitorio**
Un modelo respaldado por una tabla pero destinado a asistentes temporales. Las filas se limpian mediante `_transient_vacuum` (1 hora por defecto). Nunca se deben almacenar datos de negocio en un modelo transitorio.

**Traducción**
Una columna `jsonb` que almacena valores por idioma para campos traducibles. `env.lang` selecciona el valor. El SQL debe usar `->>'lang'` o `jsonb_path_query`.

---

## U

**UdM (unidad de medida)**
`uom.uom` en Odoo 19 es un **árbol**, no un sistema basado en categorías: cada UdM tiene `relative_uom_id` y `relative_factor`, y el redondeo es global (`decimal.precision` «Product Unit»). La conversión sigue la cadena hasta la raíz. Es un cambio incompatible con versiones anteriores.

**`_table_query`**
Una consulta SQL usada en lugar de una tabla física para modelos de solo lectura (`_auto = False`). El ORM la trata como una tabla; las escrituras no se admiten a menos que la consulta sea actualizable.

---

## V

**Disponible virtual (`virtual_available`)**
Cantidad prevista: existencias menos salidas más entradas, dentro de un horizonte dependiente del contexto. No es una columna almacenada y resulta costosa en conjuntos de datos grandes.

---

## W

**Asistente**
Un `TransientModel` con una vista de formulario, normalmente abierto en un diálogo modal. Los asistentes son servicios de aplicación: recogen entrada, llaman a métodos de modelo y devuelven una acción. No deben contener reglas de negocio reutilizables.

**`with_company` / `with_user` / `with_context`**
Métodos de derivación de entorno. Devuelven entornos nuevos que comparten la misma transacción. `with_company` cambia `env.company` y `env.companies`, lo que afecta a los campos dependientes de la compañía y a las reglas de registro.

---

## X

**Archivo de datos XML**
Un archivo listado en la clave `data` del manifiesto, analizado por `odoo.tools.convert`. Admite `<record>`, `<field>`, `<menuitem>`, `<template>`, `<act_window>`, `<report>` y `<function>`. Se carga en el orden del manifiesto; las referencias hacia adelante fallan.

---

## Z

**Actualización sin tiempo de inactividad**
No es compatible con el núcleo de Odoo. Las actualizaciones de módulos requieren detener o drenar los workers, ejecutar `-u` y reiniciar. Las actualizaciones progresivas con dos esquemas son una arquitectura personalizada, no una funcionalidad de la plataforma.
