# Diseño — BP12 Laboratorio Dental

**Estado:** aprobado por el usuario el 2026-11-05 para implementación por cortes verificables.

## Intención

Convertir el módulo actual de laboratorio en un flujo protésico multi-clínica, trazable y sincronizado entre dispositivos, desde la solicitud hasta la entrega/cementación. La clínica debe conservar una sola fuente de verdad para órdenes, etapas, documentos y costos; las reglas de tenant y los permisos financieros deben aplicarse también en PostgreSQL.

## Hallazgos de la auditoría

- `src/domains/addons/lab` ya ofrece una pantalla de órdenes, un directorio, tarifarios simples, impresión y cálculos de resumen. La persistencia actual usa `createTenantRepository` en LocalStorage, sin sincronización Supabase ni eventos Realtime propios del módulo.
- `laboratorioConstants.ts` contiene laboratorios y una orden de ejemplo. El flujo actual tiene seis etapas distintas a las siete del BP. Los cambios de etapa no conservan actor, hora ni notas por etapa. La tabla muestra el costo y permite cambiar el pago desde la fila.
- Las pruebas del dominio se limitan a cálculos y constantes; no hay pruebas del hook, componentes, permisos, persistencia remota ni aislamiento entre clínicas.
- El proyecto Supabase activo `DentikOS` está sano y su historial remoto llega a BP11. La consulta de esquema no encontró tablas ni policies de laboratorio.
- El BP indica `fotos_clinicas`, pero la base activa no tiene esa tabla. La fuente clínica vigente es `archivos_clinicos`, que guarda metadatos y `r2_object_key`; su constraint de categoría aún no admite `laboratorio` y no existe `orden_laboratorio_id`.
- `VER_LABORATORIO` se concede hoy a dentistas y asistentes. El BP09 tiene permisos aditivos propios de inventario; no hay una tabla genérica de permisos granulares reutilizable para BP12.
- `movimientos_financieros` ya admite egresos y tiene RLS. Su lectura actual permite a dentistas ver movimientos de la clínica, lo que podría revelar los pagos a laboratorios que BP12 restringe al admin o a usuarios con permiso aditivo.
- `pagos` representa cobros asociados a pacientes/presupuestos, no pagos a proveedores. Los egresos al laboratorio deben integrarse como movimientos financieros sin confundirlos con cobros al paciente.
- `presupuesto_items` no tiene un indicador explícito de trabajo de laboratorio ni una relación actual con órdenes de laboratorio. Crear órdenes al aceptar un presupuesto requiere clasificar ítems y garantizar idempotencia.
- El working tree de `codex/bp06-bp07-core` tiene 274 rutas con cambios locales y 246 rutas en el diff no confirmado. Incluye ediciones en archivos del módulo de laboratorio y en `App.tsx`, permisos, Realtime, presupuestos, archivos clínicos, agenda, finanzas e inventario. Todo ese trabajo se conservará.

## Objetivos

1. Cumplir las 12 etapas del roadmap CORE del BP12 con entregas pequeñas y revisables.
2. Definir los siete tipos de trabajo y permitir sub-tipos y plantillas configurables por clínica.
3. Gestionar laboratorios externos, internos y digitales, catálogo pactado con historial de precios y cuatro vistas de órdenes.
4. Registrar cada etapa completada con hora, actor y notas, permitiendo saltar etapas cuando el flujo real lo requiera.
5. Mantener referencias válidas entre clínica, paciente, orden, presupuesto, laboratorio y usuario responsable.
6. Aplicar en backend los permisos para costo, margen, pagos, garantías, catálogo y plantillas.
7. Integrar el módulo con archivos de BP06, presupuestos BP07, pagos/finanzas BP08, agenda BP05 e inventario BP09 sin crear fuentes duplicadas.
8. Sincronizar cambios remotos usando el patrón Realtime ya instalado y conservar la seguridad multi-clínica.
9. Retirar datos de muestra del flujo normal y preservar los registros LocalStorage existentes hasta completar una importación revisable.

## Fuera del alcance CORE

El BP marca como add-ons/post-MVP: Portal del Laboratorio (S1), Connect, BI avanzado y Signature Pro. No se implementarán en este alcance. El dashboard CORE, las alertas in-app, las órdenes imprimibles y los documentos básicos sí están incluidos.

## Enfoques considerados

### A. Un único release CORE

Implementar esquema, permisos, flujo, finanzas, archivos, alertas, garantías, integraciones, plantillas y dashboard en una sola entrega. Termina antes, pero concentra riesgos de migración y cambios en múltiples dominios y complica aislar una regresión.

### B. Cortes verificables — seleccionado

Seguir el roadmap del BP en tres olas. Cada ola deja una capacidad utilizable y se revisa antes de avanzar. Se reduce el tamaño de cada diff y se prueban las fronteras de seguridad antes de integrar finanzas y datos clínicos.

## Secuencia propuesta

### Ola 1 — Base segura y flujo principal (fases BP12 1–4)

- Migración compatible con el esquema activo, RLS por clínica y permisos del módulo.
- Catálogo de siete categorías/sub-tipos y plantillas base requeridas para crear órdenes.
- Ficha de laboratorio y catálogo pactado.
- Órdenes, datos clínicos necesarios, estados de siete etapas e historial append-only.
- Lista, Kanban, detalle e historial de etapa; filtros y sincronización Realtime.
- Sin datos ficticios en nuevas clínicas. Importación local con vista previa, mapeo explícito de referencias y preservación de las claves anteriores hasta conciliar conteos.

### Ola 2 — Trazabilidad clínica y financiera (fases BP12 5–9)

- Separación de información financiera sensible; costos y márgenes calculados solo en la vista autorizada.
- Pagos parciales al laboratorio, integrados a egresos de BP08 sin duplicar registros ni exponerlos a roles no autorizados.
- Categoría y vínculo de laboratorio sobre `archivos_clinicos`; documentos de orden asociados al mismo archivo y almacenamiento R2 existente.
- Alertas in-app configurables y garantías/reprocesos con sus órdenes de reposición.
- Sin nuevos canales de WhatsApp/email de Connect.

### Ola 3 — Integraciones y cierre CORE (fases BP12 10–12)

- Crear una orden por ítem de laboratorio de un presupuesto aceptado, una sola vez y con enlace de ida/vuelta.
- Timeline e historial protésico de BP06; sugerencias de citas de BP05.
- Consumo de inventario solo para órdenes de laboratorio interno, usando los movimientos idempotentes existentes de BP09.
- Permisos aditivos del módulo, ocho plantillas configurables y dashboard/reportes CORE.
- Pruebas funcionales, de permisos, tenant, sincronización y responsive.

Las olas son una secuencia de implementación; el alcance aprobado abarcaría el CORE completo. Cada operación remota se considerará terminada solo cuando tenga prueba de sincronización y de aislamiento relevante.

## Arquitectura y decisiones propuestas

### Persistencia, tenant y sincronización

- Supabase PostgreSQL es la fuente de verdad compartida. Cada tabla nueva tendrá `clinica_id NOT NULL`, RLS habilitado, grants mínimos y referencias que impidan combinar IDs de clínicas distintas. El tenant se deriva de la membresía activa (`clinica_actual()`), no de un valor de cliente aceptado como autorización.
- Mantener componentes de presentación separados de servicios de dominio. Agregar un servicio cloud de laboratorio y un hook que cargue y refresque datos al cambiar clínica, al recibir Realtime y al recuperar conexión.
- Reutilizar el patrón de cola tenant-aware e idempotente de BP09/BP07 para escrituras offline, con identificación estable de cada comando y procesamiento FIFO. Una escritura no se marcará como sincronizada hasta la confirmación del servidor; errores de autorización no quedarán en reintentos infinitos.
- Si otro dispositivo cambia la orden antes de reproducir una operación pendiente, rechazar la operación por conflicto de versión, conservarla para revisión y mostrar el estado remoto. No aplicar "última escritura gana" ni sobrescribir el historial; el usuario tendrá que revisar y reenviar una acción nueva.
- Los IDs de la clínica activa y del usuario autenticado se obtienen en la capa de servicio/sesión. No se aceptarán `clinica_id`, actor o permiso enviados por la UI como prueba de autorización.

### Modelo de datos

La migración nueva seguirá el modelo real del proyecto, no copiará literalmente el SQL ilustrativo del BP. Se propone crear tablas tenant-aware para laboratorios, tipos de trabajo, catálogo versionado, órdenes, historial de etapas, garantías, pagos de laboratorio, permisos aditivos y plantillas. Nombres definitivos, constraints e índices se fijarán en el plan después de revisar las migraciones BP09–BP11 completas.

- Las órdenes referenciarán `pacientes`, `profiles`, `presupuestos` y los ítems de presupuesto cuando corresponda. Las relaciones comprobarán que los registros pertenecen a la misma clínica.
- Cada etapa completada generará una fila inmutable con estado, `auth.uid()`, hora de servidor y notas. Los saltos están permitidos; los valores de etapa son los siete del BP. Un cambio de estado y su evento de historial se guardarán de forma atómica e idempotente.
- No habrá borrado duro desde la interfaz para órdenes, pagos ni garantías. Se conservarán referencias e historial; se archivará donde corresponda.
- Los importes calculables, como el margen, no se duplicarán como fuente de verdad.

### Privacidad financiera

- Los campos de costo/pagos/margen no se incluirán en la fila que leen todos los roles. Se almacenarán en relaciones financieras separadas con policies propias; el margen se calculará en la consulta de usuarios autorizados.
- El precio al paciente podrá verse según la matriz base del BP; el costo y el margen solo por admin o por usuarios con permisos aditivos explícitos.
- BP08 permite actualmente que dentistas lean los movimientos financieros de la clínica. Para cumplir la visibilidad del BP12, la opción recomendada es etiquetar los egresos de laboratorio y ajustar la política de lectura de BP08 para restringir esas filas sin cambiar la lectura de las demás categorías. La UI por sí sola no es un control de acceso.

### Integraciones

- **Archivos/BP06:** extender `archivos_clinicos` con `orden_laboratorio_id` y categoría `laboratorio`; conservar R2, RLS, soft delete y auditoría existentes. No crear `fotos_clinicas` ni una galería paralela. El tipo documental usará el mecanismo de metadata vigente salvo que la auditoría del uploader requiera un campo normalizado.
- **Presupuestos/BP07:** agregar una clasificación explícita para ítems que generan trabajo de laboratorio y una referencia única al ítem de presupuesto en cada orden. La aceptación debe crear las órdenes de forma transaccional e idempotente. No inferir que un ítem es laboratorio por buscar palabras en su descripción.
- **Pagos/BP08:** un pago al laboratorio es un egreso, no un cobro de paciente. Se enlazará cada pago parcial a la orden y al movimiento contable; el registro de ambos será atómico y sujeto al permiso `pagar_laboratorios`.
- **Agenda/BP05:** generar sugerencias tras las etapas indicadas; no reservar una hora automáticamente ni notificar a proveedores externos.
- **Inventario/BP09:** solo los laboratorios internos descuentan stock. Cada movimiento referencia una orden y usa el RPC con idempotencia; no se cambia el servicio de inventario en la ola 1.
- **Timeline/BP06:** mostrar eventos de orden y etapa mediante la fuente de timeline existente, sin duplicar eventos clínicos ni generar afirmaciones clínicas automáticamente.

### Roles y permisos

La UI ocultará acciones según el permiso y PostgreSQL rechazará operaciones no autorizadas. Matriz base propuesta para aprobar:

| Rol | Operación base propuesta | Finanzas de laboratorio |
|---|---|---|
| Admin | CRUD funcional, gestionar catálogo/plantillas, aprobar garantías y registrar pagos | Costos, pagos y márgenes |
| Dentista | Ver/crear/editar órdenes y etapas; iniciar reclamos; sin borrado | Precio al paciente, sin costos/margen ni pagos |
| Asistente | Ver/crear; editar notas y etapas; sin cambiar referencias ni montos; sin borrado | Sin costos/margen ni pagos |
| Recepción | Ver ficha operativa y crear solicitud limitada desde paciente/presupuesto; sin editar ni borrar | Sin costos/margen ni pagos |

Permisos aditivos propuestos: `ver_costos_laboratorio` revela costos y márgenes; `pagar_laboratorios` permite consultar saldos/pagos vinculados y registrar pagos, sin ver el margen; `gestionar_laboratorios` modifica fichas y catálogo; `aprobar_garantias` resuelve reclamos; `configurar_plantillas` mantiene plantillas. Se recomienda seguir el patrón BP09 con permisos/policies específicas de laboratorio, sin refactorizar el sistema de autorización global.

## Archivos candidatos

### Laboratorio

- `src/domains/addons/lab/constants/laboratorioConstants.ts`
- `src/domains/addons/lab/hooks/useLaboratorio.ts`
- `src/domains/addons/lab/services/laboratorioStorageService.ts` y nuevo servicio cloud/cola
- `src/domains/addons/lab/LaboratorioModulo.tsx`
- `src/domains/addons/lab/components/*` y nuevas vistas de detalle/Kanban si el plan confirma que no hay componente reutilizable
- `src/domains/addons/lab/utils/laboratorioCalculations.ts` y pruebas asociadas

### Integraciones sujetas a revisión puntual

- `src/infrastructure/realtime/realtimeEvents.ts`
- `src/shared/hooks/useRealtimeSync.ts`
- permisos de laboratorio y configuración aditiva
- uploader/metadata de `src/domains/clinical/patient`
- presupuesto y estados de aceptación en `src/domains/billing/budget`
- movimientos y policies de `src/domains/billing/cash-register`
- sugerencias en `src/domains/operations/agenda`
- movimiento idempotente de `src/domains/operations/inventory`
- migración nueva en `supabase/migrations/`

Se revisará el diff existente antes de cada edición; ningún cambio local previo será revertido o sustituido.

## Verificación requerida

- Pruebas de servicio y UI para operaciones permitidas y denegadas por rol.
- Pruebas RLS: clínica A no accede a clínica B; ID correcto con tenant incorrecto se rechaza; usuario sin membresía falla cerrado; operación destructiva inválida no produce cambios.
- Pruebas de que costos y pagos de laboratorio no se devuelven a roles no autorizados, aun consultando Supabase directamente.
- Pruebas de historial de etapa (actor/fecha/notas, salto de etapas, duplicados/idempotencia) y de conservación de datos al importar.
- Una fila local con referencias ausentes o no conciliables quedará en una lista de revisión con el motivo; filas válidas podrán importarse individualmente con clave idempotente. La importación parcial no se reportará como completa y no se borrará ningún dato local.
- Verificar Supabase Realtime con dos sesiones de la misma clínica y cambio de clínica, además de pruebas de sincronización tras reconexión.
- Ejecutar pruebas locales relevantes, build y migración en ambiente local/aislado antes de la base activa. Consultar advisories de Supabase y reconciliar historial de migraciones antes de aplicar.
- Para confirmar RLS con cuentas reales de los cuatro roles se requerirán credenciales temporales; no se incluirán ni guardarán en el repositorio.

## Decisiones confirmadas y llamadas de diseño

1. **Política BP08 — aprobada por el usuario:** modificar RLS para ocultar los egresos de laboratorio a dentistas, permitiendo lectura a admin y a usuarios con `ver_costos_laboratorio` o `pagar_laboratorios`.
2. **Matriz base — aprobada por el usuario:** Dentista crea/edita órdenes; Asistente crea y cambia etapas/notas; Recepción consulta y crea una solicitud limitada; Admin gestiona todo. Las capacidades se validarán en PostgreSQL.
3. **Etapas — aprobadas por el usuario:** permitir saltos y retrocesos entre las siete etapas con historial append-only; los reprocesos posteriores a la entrega crean otra orden de garantía/reposición.
4. **Quinta pestaña:** el BP anuncia cinco pestañas del laboratorio, pero solo define cuatro (Datos generales, Catálogo, Historial y Estadísticas). La propuesta es implementar esas cuatro y no inventar contenido para la quinta.
5. **Kanban:** el mockup dibuja cinco columnas aunque el flujo exige siete etapas. La propuesta es mostrar las siete columnas, con desplazamiento horizontal en pantallas estrechas.
6. **Offline y conflictos:** en conflicto de versión, conservar el comando pendiente para revisión y no sobrescribir el estado remoto; la importación local mantiene filas no conciliadas para revisión y nunca elimina la fuente local automáticamente.

## Restricciones y llamadas

- No se borrarán datos existentes ni se editarán migraciones históricas.
- No se desplegarán add-ons de pago ni se ampliará BP08/BP09 fuera de los vínculos necesarios para BP12.
- La base activa reporta PostgreSQL 17; `supabase/config.toml` declara versión mayor 15. Se comprobará la compatibilidad local antes del despliegue, sin cambiar la configuración global salvo aprobación.
- Aplicar migraciones remotas y desplegar el CORE solo después de aprobar este diseño, ejecutar verificaciones disponibles y comprobar el diff completo. No se harán commits ni push automáticos.
