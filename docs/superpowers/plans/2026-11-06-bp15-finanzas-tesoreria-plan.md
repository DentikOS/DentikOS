# BP15 — Plan de implementación Finanzas y Tesorería

> Plan para ejecutar según el diseño aprobado. Conservar los 382 cambios locales preexistentes, no crear commits ni hacer push.

**Objetivo:** Integrar BP15 CORE como dominio acotado, sincronizado y tenant-safe: caja única, conciliación manual, cartera, gastos, bonos manuales, libros internos, proyección y reportes.

**Arquitectura:** Nuevo dominio `src/domains/billing/treasury`. Supabase es fuente de verdad. BP07 mantiene pagos/presupuestos; BP09/BP12 mantienen ventas de inventario y pagos de laboratorio. BP15 consume esas fuentes, añade relaciones/proyecciones mínimas para caja y no duplica pagos como libro.

**Especificación:** [BP15 Finanzas y Tesorería — diseño](../specs/2026-11-05-bp15-finanzas-tesoreria-design.md)

**Tecnología:** React/TypeScript, Vitest, Supabase Postgres/RLS/Realtime, Edge Functions y R2 existentes. Reusar `exceljs`; no agregar dependencias importantes.

## Restricciones globales

- Solo el alcance CORE aprobado. No construir add-ons ni integraciones bancarias externas.
- Admin opera BP15 completo; recepción opera caja únicamente. Dentista/asistente no acceden a vistas BP15. Se conservan los permisos existentes de BP07.
- Pagos efectivo confirmados requieren una sesión de caja abierta y respuesta del servidor. Un borrador offline no cuenta como pago, no aumenta el arqueo y bloquea el cierre desde ese dispositivo hasta resolverlo.
- El cierre y la conciliación bancaria son atómicos, idempotentes y con actor/fecha de servidor; no permitir borrado silencioso de sesiones, eventos, filas bancarias conciliadas ni pagos fuente.
- Las tablas nuevas son `clinica_id NOT NULL`, RLS/grants explícitos, relaciones tenant-compuestas, sin acceso `anon`; las vistas expuestas deben ser `security_invoker` salvo que un diseño de lectura agregada justifique explícitamente otra cosa.
- Las funciones `SECURITY DEFINER` se evitan. Si un trigger/RPC necesita privilegio, justificarlo en el ledger, usar `search_path = ''`, cualificar referencias, revocar `PUBLIC/anon`, validar actor/tenant y probar acceso directo y abuso.
- Las filas de `pagos` existentes mantienen compatibilidad histórica con sesión nula. Una nueva caja no migra retrospectivamente pagos/arqueos locales como si fueran comprobados.
- F29/F22 y libros son salidas internas parciales con advertencias; sin DTE verificado o clasificación contable no etiquetar una cifra como tributariamente lista ni generar TXT oficial.
- El importe `monto`, status/tipo de documento y el medio monetario se validan según esquema real; no usar valores del mockup tributario como reglas.
- Mantener cambios previos de BP07–BP14, incluyendo archivos modificados/eliminados. No hacer checkout, reset, stash ni reformat masivo. Revisar cada diff solapado antes de editar.
- Supabase remoto ya tiene BP08/BP09/BP12/BP14; no usar `db push` a ciegas ni aplicar migraciones históricas pendientes de la rama. Crear migración BP15 nueva con CLI y verificar versión/historial antes de despliegue.
- No commit ni push automático. El despliegue de migración está autorizado por el usuario tras pruebas y revisión de seguridad; no publicar código de la app sin revisar su mecanismo y destino.

## Interfaces acordadas

- La interfaz Finanzas actual se conecta a `TreasuryModulo`; se agrega el acceso al sidebar y se conservan los nombres/rutas que el resto de la aplicación ya usa.
- `PERMISOS.VER_TESORERIA` habilita vista administrativa; `PERMISOS.OPERAR_CAJA` habilita la vista restringida de caja. RLS replica la misma matriz. La lectura mínima de ID/estado de sesión necesaria para una operación BP07 no devuelve montos ni datos de cierre a dentistas/asistentes.
- `pagos.caja_sesion_id` enlaza un pago en efectivo confirmado con la sesión. El backend lo fija/valida al insertar, incluso en caminos RPC BP07 y ventas BP09. Pagos no efectivo conservan el flujo actual.
- `bp15_caja_movimientos` es una proyección mínima append-only para el arqueo (tipo, importe, origen, sesión y actor); no reemplaza `pagos` ni constituye un segundo ledger de ventas. Debe haber un único evento por pago fuente; reversiones autorizadas agregan un contramovimiento y nunca editan el evento original.
- Cartera se deriva de `presupuestos.plan_pago` y pagos confirmados. Sin cuota/vencimiento se reporta saldo no fechado; `presupuestos.fecha_vencimiento` no sirve como vencimiento de cuota.
- Conciliación enlaza filas bancarias importadas a una fuente interna con confirmación manual; sugerencias nunca escriben una conciliación. Lotes, filas, adjuntos y relaciones son tenant-scoped e idempotentes.
- Las ventas internas mostrarán que `tipoDTE`/`folioDTE` no están persistidos/verificados en Supabase. No se agrega emisión SII.
- Expense document attachments use an isolated financial metadata table and the existing private R2 account with a narrowly scoped, authenticated upload/download URL flow. No URLs públicas ni reutilización de `archivos_clinicos`.

## Rulings de ejecución

- **Ruling:** continuar en el checkout actual `codex/bp06-bp07-core` en lugar de crear un worktree desde HEAD, porque el proyecto contiene 382 cambios locales BP07–BP14 necesarios para que la integración y las migraciones representen el estado aprobado; el worktree administrado no copia esos cambios. **Costo si es incorrecto:** los cambios BP15 no quedan aislados de actividad concurrente en el mismo checkout; por eso cada tarea comprobará estado y diff, y no hará commit/push.
- **Ruling:** efectivo solo se acepta cuando una sesión está abierta y Supabase confirma la operación; la cola offline conserva borradores no liquidados. Se eligió por integridad de caja y por la respuesta explícita del usuario. **Costo si es incorrecto:** una clínica pierde la capacidad de cerrar pagos en efectivo durante una interrupción de red.
- **Ruling:** pagos BP07 creados por roles autorizados existentes pueden anexarse automáticamente a la caja por un vínculo mínimo, aunque dentistas no vean Finanzas; un ID/estado de sesión no incluye totales ni datos de cierre. **Costo si es incorrecto:** el permiso BP07 para cobrar y el rol financiero estarían acoplados de manera distinta a lo esperado; probar con cada rol antes de desplegar.
- **Ruling:** no tratar el modelo UI `tipoDTE`/`folioDTE` como datos sincronizados, pues faltan en esquema/allowlist remotos; libros y resúmenes tributarios mostrarán faltantes y serán internos, no declarables. **Costo si es incorrecto:** F29/F22 CORE ofrece menos automatización tributaria que el mockup del BP.

---

### Task 1: Cálculos, validación de datos e importadores puros

**Archivos:** crear `treasury/utils/{caja,cartera,conciliacion,flujoCaja,libros}Calculations.ts` y sus tests; crear parsers CSV/XLSX/OFX en `treasury/services/importadores/` y pruebas. No modificar UI en esta tarea.

**Interfaces:** entradas inmutables con importes enteros/decimal explícitos, moneda y fechas ISO. Los resultados señalan incompletitud; funciones puras no acceden a Supabase/localStorage.

- [x] Escribir test RED de arqueo: apertura + pagos efectivo confirmados − egresos caja; diferencia con signo; motivo solo sobre umbral; rechazar monto/denominación inválida.
- [x] Escribir test RED de aging: bandas 0–30/31–60/61–90/+90 y saldo sin fecha separado, pagos/anulaciones no confirmados excluidos, sin sumar monedas.
- [x] Escribir test RED de match: monto exacto y fecha/reference generan sugerencias ordenadas; nunca estado confirmado; límite/tolerancia no cambia monto fuente.
- [x] Escribir test RED de parsers: CSV coma/punto y coma y decimales; XLSX desde `exceljs`; OFX de formatos válidos y rechazo de fila ambigua; aplicar límite de tamaño/filas.
- [x] Escribir test RED de flujo escenario por tasas explícitas, gastos conocidos y cuotas fechadas; no inferir conversión, vencimientos ni tasas.
- [x] Implementar funciones mínimas y ejecutar los tests. No añadir dependencia.
- [x] Ejecutar `npm test -- --reporter=dot`; leer salida completa y registrar cualquier fallo ajeno en el ledger.

**Expected:** cada test nuevo falla antes de código por comportamiento ausente y pasa después. La suite completa conserva 7 fallos de línea base, todos fuera de los archivos BP15 añadidos en esta tarea.

### Task 2: Migración BP15, RLS, caja y fuentes

**Archivos:** crear por `supabase migration new bp15_finanzas_tesoreria_core` una migración nueva; crear `supabase/tests/bp15_finanzas_tesoreria_rls.sql`. Revisar, sin reemplazar, las migraciones BP07–BP12 aplicadas y tablas existentes.

**Interfaces:** cabecera de sesión no contiene importes; detalle/eventos financieros separan `SELECT` administrativo/caja de metadatos mínimos de referencia BP07. `pagos.caja_sesion_id` nullable es compatible con historia. Nuevas tablas: sesión/eventos/movimientos caja; cuenta/lote/fila bancaria/match; gasto/documento; bono/liquidación; parámetros de escenario. Nombres y constraints finales se ajustan al esquema real antes de DDL.

- [ ] Añadir SQL RED para crear clínica A/B con usuarios de prueba y comprobar: admin/recepción caja permitidos, recep gastos/banco denegados, dentista/asistente sin lectura de importes, UUID/clinic cruzado rechazado y usuario sin membresía falla cerrada.
- [ ] Añadir SQL RED para apertura/cierre concurrente e idempotente; cierre no modifica filas si existe diferencia sin motivo >$5.000; evento duplicado no duplica movimientos; payment efectivo sin sesión no produce pago ni proyección; transferencia no exige caja.
- [ ] Añadir SQL RED de tenant compuesto para referencias a pago/presupuesto/paciente/fuente; `INSERT/UPDATE/DELETE` rechazado deja cero efectos; history rows no son editables/borrables.
- [ ] Inspeccionar Supabase `pg_policies`, grants, constraints, funciones, triggers, publication y versión actuales otra vez. Asegurar que políticas existentes no se ensanchan por OR.
- [ ] Implementar la migración expand-only: constraints tenant-compuestas; restricciones importes/moneda/estado; RLS y grants mínimos; tabla de eventos append-only; `pagos.caja_sesion_id`; trigger/proyección única para pago efectivo; RPC transaccional `abrir`/`cerrar` que sea `SECURITY INVOKER` cuando el modelo lo permita.
- [ ] Añadir tablas/Reatime con una operación idempotente; incluir únicamente cabeceras de sesión necesarias para BP07. Mantener datos de detalles en acceso admin/recepción.
- [ ] Ejecutar el SQL test en base local aislada; comparar salida RED/GREEN; ejecutar `npm run db:verify`; revisar el SQL completo.
- [ ] Añadir captura de línea base local para `estado`, `tipoDTE`, `folioDTE` ausentes del schema remoto; no hacer backfill fiscal inventado.

**Expected:** tests cubren ambas clínicas y cero efectos secundarios; `npm run db:verify` acepta orden/estructura; ninguna tabla nueva carece de RLS o grant explícito.

### Task 3: Servicios de dominio, caja, BP07/BP09, banco y Realtime

**Archivos:** crear `treasury/services/*`, `treasury/hooks/*` y tests; modificar con diff mínimo `pagosService.ts`, `pagosOfflineQueueService.ts`, `pagosStorageService.ts`, transformaciones/types de pagos, ruta/suscripción Realtime e hidratación inicial. Revisar previamente el diff preexistente de cada archivo.

- [ ] Escribir test RED de caja: apertura confirmada desde backend, cierre atómico/idempotente, denominaciones, reportes y motiva diferencia; rol y clínica se derivan de la sesión.
- [ ] Escribir test RED de pago efectivo BP07: insert/RPC asocia la sesión activa solo en backend; sin sesión, tenant equivocado o caja cerrada rechaza antes de todo efecto; transferencia no cambia el flujo actual.
- [ ] Escribir test RED de borrador offline: aparece “sin confirmar”, no se incluye en caja/reportes ni se presenta como pagado; reconexión con sesión abierta envía una vez, sesión cerrada queda para revisión sin segundo cargo.
- [ ] Escribir test RED para los caminos BP09 de pago efectivo, anulaciones/reversiones y unicidad del movimiento proyectado; la fuente `pagos` se conserva y cualquier reversión es evento compensatorio.
- [ ] Escribir test RED de Realtime/hidratación: evento de clínica A invalida datos A solamente; cambio de clínica limpia subscripción/caché previa; reconexión no duplica movimientos.
- [ ] Crear APIs con idempotency UUID, error `no-session` visible y tenant activo desde sesión validada. No usar borrado de arrays ni upsert que borre filas ausentes.
- [ ] Implementar servicios cloud, caja y asociación con pagos; mapeo y cola tenant-aware de borradores; observación Realtime para tablas BP15. Actualizar pagos transformaciones de forma additive.
- [ ] Confirmar manualmente diff BP07/BP09 y ejecutar pruebas unitarias/de servicio RED→GREEN, luego `npm test -- --reporter=dot`.

**Expected:** recepción no puede crear pago offline confirmado; un reintento idéntico produce un único pago y un movimiento caja; tabla `pagos` sigue fuente única.

### Task 4: Conciliación bancaria manual

**Archivos:** crear `treasury/bank-reconciliation/{components,hooks,services}` y tests; añadir tabla/servicio RLS ya prevista en Task 2; modificar solo el shell BP15.

- [ ] Escribir test RED de importación: reimportación idéntica es idempotente; parsing inválido/incompleto no escribe filas; archivos no quedan guardados ni se escriben filas antes de confirmación.
- [ ] Escribir test RED de sugerencia vs confirmación: match no modifica pagos ni queda conciliado hasta acción admin; una fila no se enlaza a otra clínica; conflicto/duplicado rechaza con cero mutaciones.
- [ ] Implementar CRUD seguro de cuentas con alias y últimos cuatro dígitos; no guardar cuenta completa/token.
- [ ] Integrar preview, mapeo de columnas y confirmación para CSV/XLSX/OFX usando parsers Task 1. Persistir filas normalizadas/hash/lote, no el documento original.
- [ ] Implementar sugerencias por monto/fecha/referencia y enlace manual 1:1; excepciones agregadas quedan pendientes documentadas.
- [ ] Añadir vista admin con filtros, importes por moneda y exportación de diferencia. Solo admin puede consultar/modificar banco.
- [ ] Ejecutar tests de parsing, idempotencia, UI/RLS y `npm test -- --reporter=dot`.

**Expected:** una importación malformada/duplicada no altera conciliaciones ni fuentes; únicamente admin llega a datos bancarios.

### Task 5: Gastos, bonos, cartera y archivos de respaldo

**Archivos:** crear `treasury/{expenses,bonuses,receivables}` servicios/componentes/tests; crear Edge Function `supabase/functions/r2-finanzas-upload-url` y tests si el patrón existente requiere endpoint específico; usar tabla de metadatos aislada, no `archivos_clinicos`.

- [ ] Escribir test RED de gastos: valida neto/IVA/total y estado, proveedor/RUT, moneda; repetición por idempotency key no duplica; total no puede editarse después de pago sin enmienda.
- [ ] Escribir test RED de respaldos: solo admin de clínica obtiene upload/download URL; MIME/tamaño allowlist PDF/XML/JPG/PNG; URL privada corta; usuario de clínica B no accede a objeto A; no almacenar URL pública ni credencial R2.
- [ ] Escribir test RED de bonos/liquidaciones: monto total y parciales no exceden aporte; estados se transicionan auditadamente; pago externo no se registra como pago BP07.
- [ ] Escribir test RED de cartera: saldo usa pagos confirmados y plan de cuotas; saldo sin fecha no se reparte en aging; paciente/presupuesto de otro tenant se descarta.
- [ ] Implementar servicios para gastos, asociaciones BP09/BP12 y bonos; `bp15_caja_movimientos` incluye egresos en efectivo solo tras registrar gasto/caja, evitando dos cargos por una factura.
- [ ] Añadir adjuntos privados de gasto con endpoint mínimo basado en patrón R2 existente; validar usuario, clinic role, tamaño/tipo/nombre, propiedad de key, revocación/limpieza auditada.
- [ ] Implementar cartera con datos mínimos para admin; recepción no ve deuda ni gasto general.
- [ ] Ejecutar tests RED→GREEN, tests Edge Deno relevantes y `npm test -- --reporter=dot`.

**Expected:** conciliaciones/gastos/bonos cruzados por clínica rechazan; attachments requieren usuario válido y quedan privados; ningún pago se duplica en ledger BP07.

### Task 6: Libros internos, flujo de caja y reportes CORE

**Archivos:** crear `treasury/reports/{services,components}` y tests; modificación mínima de `ReportesModulo` solo si la ruta se comparte; exportes internos CSV/PDF.

- [ ] Escribir test RED de ventas internas: excluye borradores y monedas no convertidas; document metadata ausente aparece como “no informado/no verificado”; no sumar pagos por `tipoDTE` no persistido.
- [ ] Escribir test RED de compras/IVA: usa desglose registrado del gasto, créditos solo con clasificación/soporte confirmados; no aplica exención dental general ni cifras tasa del mockup.
- [ ] Escribir test RED de F29/F22 interno: mapeo SII versionado/configurado, filas excluidas y advertencias visibles; no produce TXT oficial ni estima impuesto sin régimen/configuración.
- [ ] Escribir test RED de escenarios: tasas de escenarios explícitas por clínica; con dato faltante produce “insuficiente” y no cero ficticio; horizonte configurable.
- [ ] Implementar estados de resultados operacionales solo con fuentes completas; ratios solo con parámetros validados; cartera/gasto/banco desglosados por CLP/moneda.
- [ ] Añadir exportaciones internas con actor/filtro, tenant y límites de campos; no enviar automáticamente al SII/contador.
- [ ] Ejecutar tests unitarios/exports y `npm test -- --reporter=dot`.

**Expected:** resultados reproducibles desde fuentes; cada estimación muestra procedencia/ausencias; salida no afirma cumplimiento legal.

### Task 7: UI integrada, accesos y retiro de acciones antiguas

**Archivos:** crear `src/domains/billing/treasury/TreasuryModulo.tsx` y componentes; modificar `src/App.tsx`, `src/constants/sidebarConstants.ts`, `rbacConstantsBase.ts`, `rbacPermisosPorRol.ts`, `usePermissions` solo si es necesario; modificar/exportar `cash-register` tras revisar los diffs actuales.

- [ ] Escribir tests RED de permisos/sidebar: admin ve Finanzas completo; recepción ve caja únicamente; dentista/asistente no ven BP15; recepción conserva sus capacidades BP07 actuales.
- [ ] Escribir test RED de ruta: entrypoint sidebar y `activeSection=Finanzas` cargan Treasury; tabs ocultas no pueden llamarse por ruta ni por acción del cliente.
- [ ] Escribir test RED de borrado legacy: Finanzas no expone `eliminarMovimiento` a pagos/abonos fuente; la calculadora de boletas sale de la navegación BP15 y su servicio queda solo si otro import lo usa.
- [ ] Implementar módulo integrado y vistas responsive por rol, estado offline, lote pendiente y datos incompletos. Componentes no hablan directamente con Supabase.
- [ ] Preservar históricos de `movimientos_financieros`, cierres locales y convenios; no importarlos de forma silenciosa ni borrar registros.
- [ ] Ejecutar tests de componentes, permisos y navegación RED→GREEN y `npm test -- --reporter=dot`.

**Expected:** sidebar/route respetan rol y `Finanzas` muestra solo capacidades concedidas; ningún botón de Finanzas borra pagos BP07.

### Task 8: Revisión completa, pruebas de seguridad y despliegue Supabase

**Archivos:** revisar diff de todos los archivos del plan; migración/SQL tests/Edge Functions; no modificar datos históricos.

- [ ] Escanear diff inicial/final; comprobar cada ruta y tabla nueva contra constraints de esta sección; confirmar que los cambios externos a BP15 preexistentes siguen intactos.
- [ ] Ejecutar `npm test -- --reporter=dot`, `npm run typecheck`, `npm run validate:architecture`, `npm run lint`, `npm run build`, `npm run db:verify` y SQL tests BP15; listar exactos resultados/fallos previos.
- [ ] Probar RLS con Clínica A/B, admin/recepción/dentista/asistente, membresía ausente, tenant manipulado, UUID cruzado y cero efectos secundarios.
- [ ] Probar Realtime en dos sesiones de clínica y cambio de tenant; pedir al usuario credenciales temporales de test cuando la prueba requiera una sesión real. No reutilizar producción ni guardar secretos.
- [ ] Confirmar el project ID remoto, versión PostgreSQL, historial aplicado, policies actuales y advisors. Aplicar únicamente migración BP15 aprobada; no ejecutar `db push` si hay migraciones locales pendientes ajenas.
- [ ] Después de aplicar: verificar tablas/RLS/grants/constraints, subscription Realtime, cierre de caja de prueba y ausencia de filas de prueba en producción. Limpiar pruebas de forma auditada si el entorno es de staging; no sembrar datos personales.
- [ ] Desplegar solo la Edge Function necesaria para documentos y comprobar su respuesta autenticada con credencial temporal. No publicar cambios de app sin confirmar mecanismo/destino.
- [ ] Revisión fresca de todo el branch y registro de hallazgos severidad Critical/Important/Minor; hacer solo una pasada de fixes TDD para Critical/Important. No commit/push.

**Expected:** todas las verificaciones declaradas se ejecutaron y su salida se leyó; migración/Realtime solo se reportan como desplegados si existe evidencia remota; los datos de usuario no se purgan ni migran a ciegas.

## Estado de ejecución · 2026-11-06

- BP15 quedó conectado a la ruta Finanzas. BP07 conserva `pagos`/`presupuestos` como fuentes; BP15 añade proyección append-only de caja y dominio admin de conciliación, gastos, bonos, libros internos y escenarios.
- Supabase remoto `nagduvivilmzupdpoayo`: migración aplicada como `20261106104120_bp15_finanzas_tesoreria_core`; se verificaron las 12 tablas nuevas con RLS activo y sus policies. La Edge Function `r2-finanzas-documento-url` está activa en versión 1 con validación JWT dentro del handler.
- Pruebas locales: SQL/RLS en una base aislada con rollback; Vitest BP15/pagos/permisos: 13 archivos, 63 tests; Deno del Edge Function: 12/12; `npm run typecheck` y `npm run build` pasaron.
- Correcciones encontradas en la revisión: respuestas tardías de otra clínica ya no reemplazan el snapshot activo; un pago existente no puede entrar retroactivamente a una caja; cada cambio de tabla BP15 registra `audit_log`; el reintento de efectivo recupera solo el mismo pago confirmado.
- `supabase db push` no se usó. El historial remoto ya contenía BP14 bajo el timestamp `20261106040756`, distinto del nombre local; se aplicó solo BP15 y el archivo local se alineó al timestamp remoto registrado.
- No se ejecutó prueba autenticada remota A/B ni prueba R2 real, según la preferencia del usuario de usar solo pruebas locales. Tampoco se publicó el frontend a un hosting externo ni se hizo `commit`/`push`. El build local verifica el código de la App; el despliegue externo del frontend queda fuera de esta ejecución.
- Los advisors de seguridad señalan los RPC `bp15_cerrar_caja` y `bp15_importar_extracto` por ser `SECURITY DEFINER` invocables por `authenticated`. Ambos tienen `search_path = ''`, revocación a `PUBLIC/anon` y validación explícita de usuario, rol y clínica; la advertencia no se clasificó como vulnerabilidad reproducible.
