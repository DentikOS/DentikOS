# BP15 — Finanzas y Tesorería: diseño propuesto

**Estado:** propuesta para revisión. Durante la auditoría no se modificaron código ni base de datos.

## Decisiones recibidas del usuario

- Primera entrega: **CORE** del BP15.
- Arquitectura: **dominio BP15 acotado**.
- Acceso dentro de BP15: **admin completo; recepción solo caja**.
- El BP adjunto se usa como especificación funcional. Sus ejemplos de SQL, cifras tributarias y frases de cumplimiento no se ejecutan ni se toman como autoridad legal.

## Intención

Entregar en la aplicación un dominio de Finanzas y Tesorería conectado a Supabase, coherente con BP07 y con aislamiento por clínica. BP07 sigue capturando pagos; BP15 consolida, concilia y reporta. Cada peso tendrá una sola fuente de verdad y los datos nuevos se reflejarán entre dispositivos mediante sincronización y Realtime.

## Auditoría inicial

- `FinanzasModulo` existe y tiene arqueo diario de solo lectura, historial de movimientos, cuentas pendientes y calculadora de boletas. La ruta se renderiza desde `App.tsx`, pero no se encontró una entrada de Finanzas en la barra lateral actual.
- `useFinanzas` mezcla pagos de BP07, abonos locales de presupuestos y movimientos manuales. Su acción de eliminar puede borrar un pago de BP07 o un abono de la ficha clínica desde Finanzas.
- `finanzasStorageService` sincroniza `movimientos_financieros`, pero los cierres de caja y convenios siguen en almacenamiento local por clínica. Por eso esos cierres no están compartidos ni respaldados por RLS.
- La vista de cartera no calcula saldos ni antigüedad. El arqueo existente filtra movimientos por fecha; no guarda apertura, conteo físico, diferencia ni justificación.
- No encontré entidades propias para extractos bancarios, conciliaciones, gastos, liquidaciones de bonos, libros ni proyecciones financieras. `Reportes` presenta métricas operativas; no reemplaza un estado de resultados.
- El modelo de frontend de BP07 tiene `tipoDTE` y `folioDTE`, pero el esquema remoto `pagos` y su allowlist de sincronización no los conservan; tampoco encontré un servicio de emisión electrónica SII. La vista interna de ventas puede usar pagos sincronizados, pero mostrará esos metadatos como faltantes/no verificados y no afirmará que sea un libro legal.
- BP07 ya tiene cola offline y pagos en Supabase/Realtime. BP15 deberá integrarse a ese dominio sin duplicar la captura ni la fuente de pagos.
- El repositorio tiene cambios locales preexistentes en BP07–BP14, autenticación/RBAC, finanzas, navegación, migraciones y tests. Se preservarán y cada archivo tocado se revisará contra su diff actual.
- Lectura remota de Supabase en modo read-only: `pagos`, `presupuestos`, `movimientos_financieros` y `laboratorio_pagos` existen con RLS habilitado; las cuatro tablas están en Realtime. Los pagos tienen moneda/presupuesto, pero aún no una asociación a sesión de caja. No existen tablas remotas `cuentas_bancarias`, `arqueos_caja`, `gastos_clinica` ni `bonos_electronicos`.
- Las policies remotas de `movimientos_financieros` son las `*_bp12` y restringen operaciones por clínica/rol; no apareció una policy `*_clinica` adicional en esa tabla. Las policies de `presupuestos` comparan `p.clinica_id = p.clinica_id` (tautología), pero la tabla `pacientes` tiene RLS tenant-scoped y no se confirmó exposición cross-clinic. No hay FK compuesta presupuesto/paciente; registrar como hardening separado, no como vulnerabilidad reproducible.
- El historial remoto muestra las migraciones BP08/BP09/BP12/BP14 como aplicadas. La auditoría no cambió migraciones ni ejecutó datos de usuario. El Supabase Security Advisor también devuelve warnings de funciones `SECURITY DEFINER` preexistentes; no se ha determinado que sean vulnerables ni se corregirán dentro del alcance BP15.

## Alcance CORE propuesto

1. **Caja única:** apertura, movimientos asociados, conteo por denominación, cierre persistido y motivo obligatorio si la diferencia supera el umbral operativo de $5.000 CLP indicado en el BP. Recepción opera la sesión; admin puede revisarla y corregir mediante evento auditado.
2. **Conciliación bancaria manual:** alta de cuentas con datos mínimos, importación CSV/XLSX/OFX, previsualización, sugerencias de coincidencia, confirmación manual y reporte de diferencias. Las sugerencias nunca concilian ni modifican pagos automáticamente.
3. **Cuentas por cobrar:** saldo y cuotas vencidas desde presupuestos/planes de BP07, agrupación 0–30, 31–60, 61–90 y más de 90 días, e identificación separada de saldos sin fecha de vencimiento. Los pagos de BP07 reducen el saldo desde su propia fuente.
4. **Gastos y egresos:** registro por categoría, proveedor, fecha, documento, montos neto/IVA/total, moneda, medio y estado de pago; metadatos de respaldo documental; desglose por categoría. Los costos ya registrados por BP09/BP12 se vinculan como fuente, no se duplican como otro gasto pagado.
5. **Bonos manuales FONASA/Isapre:** datos del bono, previsión, aporte, copago, estado y liquidaciones parciales. No se emite el bono desde DentikOS ni se integra con portales externos. Los abonos externos quedan trazados sin duplicar pagos de pacientes.
6. **Libros y preparación tributaria:** una vista interna de pagos/documentos BP07 y una vista de compras/gastos registrados; resumen mensual de IVA y anual de ingresos/egresos solo para revisión. `tipoDTE`/`folioDTE` de BP07 se muestran como declarados por el usuario, no como DTE verificados. Sin fuente de verificación, no se presentan como libro legal ni se usan como base tributaria confirmada; todo cálculo queda marcado como parcial/interno y muestra filas excluidas y datos faltantes.
7. **Flujo de caja:** proyección realista/optimista/pesimista, con parámetros visibles y editables por admin. Solo usa cuotas con vencimiento, gastos programados explícitamente, bonos pendientes y saldos históricos documentados. Agenda, conversión de presupuestos, salarios o impuestos estimados solo se incluyen si existe un dato confiable y configurable; no se inventan valores.
8. **Reportes CORE:** ingresos/egresos y tendencia; cartera; conciliación; gastos; actividad por medio de pago. Un estado operacional se muestra solo con categorías y fuentes suficientes. Ratios dependientes de honorarios, sillones, costos o régimen tributario quedan fuera hasta que los datos existan y sean validados.

## Fuera de alcance de esta entrega

- Conexión OAuth/API a bancos, almacenamiento de tokens o conciliación automática.
- Cobranza automatizada, canales externos, scoring o ML.
- Multi-caja, multi-sucursal y centros de costo.
- Emisión automatizada de bonos, envío de DTE/declaraciones al SII o integración con software contable.
- BI de pago, balance general completo y cálculo automático de impuestos basado en supuestos.

## Lectura crítica del BP y reglas tributarias

El BP sirve para alcance funcional, pero varios ejemplos no se deben copiar literalmente:

- El SII publica exención para prestaciones de salud cuando cumplen condiciones, incluyendo el carácter ambulatorio; no corresponde marcar toda venta dental automáticamente como exenta. [SII — servicios de salud ambulatorios](https://www.sii.cl/preguntas_frecuentes/iva_servicios_profesionales/001_320_8473.htm)
- El mockup asigna ventas exentas al código 501. La versión actual del F29 usa códigos que deben mapearse según el tipo de operación y documento; la aplicación debe mantener un catálogo versionado y contrastarlo con el formulario oficial vigente antes de exportar. [SII — F29 vigente consultado](https://www.sii.cl/formularios/imagen/F29.pdf)
- Resolución SII 38/2026 agrega códigos 817/818 para liquidaciones, con vigencia desde el período tributario julio de 2026. Esto refuerza que el mapeo no puede quedar hardcodeado al ejemplo del BP. [SII — Resolución 38/2026](https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso38.pdf)
- Los ejemplos de 27% de impuesto de primera categoría y “40% de utilidad” para PPM no son tasas universales. La configuración depende del régimen y situación del contribuyente. [SII — Circular 53/2025](https://www.sii.cl/normativa_legislacion/circulares/2025/circu53.pdf), [SII — PPM](https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_0695.htm)
- No exportar un TXT como archivo oficial de declaración hasta validar formato, campos y elegibilidad tributaria. El CORE prepara información para revisión; el admin/contador presenta fuera de DentikOS.

## Enfoques considerados

1. **Seguir extendiendo el módulo actual:** descartado como destino final. El módulo mezcla cobros, abonos y egresos, y guarda cierres en local; agregar pantallas encima conservaría duplicidad y fallas de sincronización.
2. **Crear el dominio BP15 acotado e integrarlo en la aplicación:** propuesto y elegido por el usuario. Mantiene BP07 como fuente de pagos, integra BP09/BP12 como fuentes relacionadas y limita los cambios de navegación, sincronización y permisos a las fronteras necesarias.
3. **Rehacer todos los dominios financieros y RBAC:** descartado. El alcance no justifica reescribir pagos, presupuesto, membresías ni autorización global.

## Límites de dominio y fuentes de verdad

- BP07 `pagos` sigue siendo la fuente de los pagos de pacientes y sus anulaciones. BP15 los consulta y relaciona; no los vuelve a crear ni permite borrarlos desde Tesorería. Una sesión de caja abierta se exige solo para pagos con medio efectivo; pagos electrónicos siguen el flujo BP07 actual.
- BP07 `presupuestos` y sus cuotas siguen siendo la fuente de cartera. La cuota determina vencimiento; el vencimiento del presupuesto no se interpreta como vencimiento de una cuota. Si no hay calendario, el saldo se muestra sin antigüedad calculada.
- Los gastos nuevos tienen registro BP15 con importes y documento. Un pago de laboratorio ya existente en BP12 o compra ya registrada en BP09 se enlaza como pago/costo para prevenir doble conteo.
- Las filas antiguas de `movimientos_financieros`, abonos locales, cierres locales y convenios se conservan durante la transición. No se purgan ni reescriben como si hubieran sido verificados. Se marcarán como legado cuando no se puedan asociar con un origen fiable.
- El registro de bonos y sus liquidaciones representa cobros de previsión, que no son pagos de pacientes ni se insertan artificialmente en `pagos`.
- Todos los importes conservan moneda. Las vistas no suman monedas distintas. Los cálculos tributarios CLP excluyen o requieren revisión de filas en otra moneda.

## Diseño de conciliación y caja

### Importaciones y conciliaciones

- Guardar metadatos de cuenta manual (banco, alias, tipo, moneda y últimos cuatro dígitos), lote de importación, hash del archivo y filas normalizadas. No guardar el archivo original, números completos de cuenta, credenciales bancarias ni tokens.
- Permitir mapeo/confirmación de columnas tras previsualizar y validar el archivo. `exceljs` ya existe en dependencias; el parser OFX se debe implementar/validar sin sumar una dependencia importante no aprobada.
- Cada fila bancaria tiene clave idempotente por cuenta/lote y fingerprint para bloquear reimportaciones accidentales. Una conciliación confirmada mantiene referencia al origen y al actor/fecha; desvincular requiere evento correctivo auditado.
- Coincidencias por monto, fecha y referencia son sugerencias. La primera versión contempla una fila bancaria contra un registro; depósitos agrupados o diferencias manuales quedan como excepción documentada, sin forzar un match incorrecto.

### Apertura y cierre

- Una caja por clínica y fecha de operación. La sesión guarda responsable, fondo inicial, conteos, saldo esperado calculado desde pagos en efectivo BP07 y egresos en efectivo BP15, total contado, diferencia, motivo, marcas de tiempo y estado.
- Al relacionar pagos en efectivo con su sesión, agregar una referencia nullable a BP07 para compatibilidad histórica. Los pagos en efectivo nuevos requieren sesión abierta y validación backend; pagos anteriores pueden quedar sin sesión. Los pagos offline no cuentan en un cierre confirmado y quedan como borrador hasta recibir confirmación del servidor.
- Un cierre confirmado queda inmutable. Reapertura o corrección posterior solo por admin y genera un evento con motivo y valores anteriores/nuevos. No borrar sesiones ni pagos.
- El umbral de $5.000 es una regla operativa tomada del BP, no una obligación legal. La fecha diaria se interpreta en zona `America/Santiago` salvo que la configuración existente de clínica ya tenga una zona horaria explícita.

### Política offline acordada

El pago en efectivo necesita conexión para confirmarse. Si se pierde la conexión, el formulario puede conservar un borrador local visible como no confirmado; no se registra como pago, no aumenta el saldo de caja ni se presenta como cobro completado. DentikOS no debe indicar que recibió el efectivo mientras está offline. La sesión no se puede cerrar desde ese dispositivo mientras quede un borrador de efectivo sin resolver. Al volver la conexión, el usuario lo envía contra la sesión que sigue abierta; si ya cerró desde otro flujo, queda rechazado para revisión admin. Los cierres consultan solo pagos aceptados por backend. La UI debe advertir que el cobro no está confirmado hasta recibir la respuesta del servidor.

## Esquema y controles de acceso

La migración BP15 será nueva, aditiva y tenant-aware. El diseño conceptual requiere tablas separadas para sesiones/eventos de caja, cuentas/lotes/filas/matches bancarios, gastos y respaldos, bonos/liquidaciones y parámetros de proyección. Las vistas contables y reportes se calculan desde las fuentes; no se persiste un duplicado de cada pago para construir libros.

- Cada tabla tendrá `clinica_id NOT NULL`, RLS, grants mínimos, índices por clínica/fecha y constraints o relaciones compuestas que impidan enlazar filas de clínicas distintas.
- Las policy checks derivarán clínica y rol desde la sesión/membresía validada en backend. No confiarán en `clinica_id`, `user_id` ni permiso enviados desde el navegador.
- **Admin:** acceso completo a las tablas y reportes BP15 de su clínica.
- **Recepción:** puede consultar lo mínimo necesario para su caja abierta y abrir/registrar/cerrar caja. No puede consultar bancos, gastos generales, bonos, cartera, impuestos ni reportes administrativos desde BP15.
- **Dentista/asistente:** sin acceso al dominio BP15. Esto no cambia los permisos de BP07 u otros módulos fuera de esta propuesta.
- La UI oculta las vistas según rol, pero RLS y validación del servidor imponen la misma matriz. El payload de caja de recepción no expone nombres de pacientes ni datos clínicos innecesarios.
- Antes de desplegar hay que volver a inspeccionar las policies locales y `pg_policies` remotas. Las policies permisivas se combinan con OR; crear otra policy restrictiva no neutraliza una lectura amplia preexistente.
- No copiar SQL del BP: omite relaciones tenant-compuestas, usa una clave bancaria completa y `api_token`, y su `numero_bono UNIQUE` no está limitado por clínica.

## Sincronización

- Supabase es la fuente compartida de BP15; `clinica_id` activo delimita cada lectura y escritura.
- Los cambios se confirman en backend y luego actualizan la caché local. Realtime invalida/refresca solamente la clínica activa; cambiar de clínica cancela suscripciones y descarta caché de otra clínica.
- Los eventos append-only permiten reconstruir quién abrió, cerró, concilió, corrigió o liquidó un registro.
- Las lecturas ya sincronizadas pueden consultarse offline con estado visible de antigüedad. Una escritura offline no se muestra como confirmada. Caja y conciliación requieren confirmación del servidor; la cola conserva identificadores estables e informa conflictos en vez de sobrescribir datos.
- La hidratación inicial, cambio de clínica, reconexión, logout y limpieza de caché se prueban específicamente. Ningún libro o reporte se marca actualizado mientras tenga cambios pendientes.

## Integración en la aplicación y retiro de funciones ajenas

- Integrar la navegación Finanzas existente con una vista BP15; hacer accesible la ruta desde sidebar, paleta de comandos y controles de permisos de la app que ya existan.
- La interfaz antigua de movimientos globales no seguirá ofreciendo borrado de pagos/abonos ni creación de ingresos manuales paralelos a BP07. La calculadora de boletas no pertenece al alcance BP15 y se retira de su navegación; no se elimina un servicio independiente sin verificar si otro módulo lo utiliza.
- Los movimientos y cierres existentes se conservan y solo se migran/importan con previsualización y deduplicación. Los registros sin fecha/origen verificable se muestran como legado y no se usan silenciosamente para impuestos o cierres.
- Se revisará cada diff local preexistente de `FinanzasModulo`, `useFinanzas`, almacenamiento, RBAC, sidebar y sincronización antes de editar. No se reemplazarán archivos completos para aplicar el rediseño.

## Secuencia de implementación propuesta

1. Revisar a fondo las migraciones recientes de BP07/BP08/BP09/BP12, policies actuales en Supabase, `pagos` y su cola offline. Cerrar el contrato mínimo de asociación pago-sesión.
2. Migración aditiva BP15 de caja/eventos y primeros servicios, integración de ruta, sidebar, permisos RLS y Realtime. Probar la caja completa con dos usuarios de la misma clínica.
3. Conciliación bancaria manual y reglas de importación idempotentes, incluyendo excepciones y exporte del reporte de diferencias.
4. Gastos, bonos manuales y cartera desde datos BP07/BP09/BP12, cada uno con pruebas de no duplicación.
5. Libros/preparación tributaria, escenarios de flujo y reportes con indicadores de datos faltantes y fuentes.
6. Pruebas de aislamiento, sync, flujos UI y build. Revisar migración en entorno local/aislado, aplicar a staging con credenciales temporales y desplegar solo tras evidencia de RLS, Realtime y aceptación funcional. La autorización previa del usuario cubre aplicar y desplegar las migraciones necesarias una vez aprobados el diseño y el plan.

## Verificación requerida antes de declarar entrega

- Unidad: parsing CSV/XLSX/OFX, fingerprints, sugerencias sin auto-confirmación, aging (incluye saldo sin fecha), moneda, caja teórica/física, reportes y escenarios.
- Servicios/UI: idempotencia de importación y de escrituras, confirmación/reapertura, gastos y liquidaciones parciales, pagos offline en conflicto, y ausencia de borrado de fuentes BP07.
- RLS con dos clínicas: admin autorizado, recepción caja permitida y demás áreas denegadas, dentista/asistente denegados en BP15, IDs cruzados rechazados, membresía ausente falla cerrada, y cero efectos secundarios ante operación rechazada.
- Integración: dos sesiones de la misma clínica observan cambios por Realtime; cambio de clínica no filtra ni conserva datos de la clínica anterior; reconexión no duplica ni pierde escrituras.
- Migraciones: aplicar desde estado limpio, validar RLS/constraints/grants/índices y revisar Supabase Advisors y `pg_policies` remoto. Nunca afirmar producción o Supabase verificado sin ejecutarlo.
- UI responsive y pruebas/build relevantes; usar las credenciales temporales del usuario solo en entorno de prueba. No guardar credenciales en el repositorio, salida de tests ni logs.

## Fuentes oficiales consultadas

- [SII — IVA en servicios de salud ambulatorios](https://www.sii.cl/preguntas_frecuentes/iva_servicios_profesionales/001_320_8473.htm)
- [SII — Formulario 29](https://www.sii.cl/formularios/imagen/F29.pdf)
- [SII — Resolución 38/2026](https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso38.pdf)
- [SII — Circular 53/2025](https://www.sii.cl/normativa_legislacion/circulares/2025/circu53.pdf)
- [SII — PPM](https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_0695.htm)

## Confirmación necesaria

Este documento fija alcance, arquitectura, permisos, sincronización, límites tributarios y el retiro seguro de funciones fuera de BP15. No se ha implementado producto ni migración. Tras revisar y aprobar este diseño, se preparará el plan de implementación por tareas y verificaciones antes de modificar código.
