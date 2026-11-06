# BP14 — Plan de implementación Urgencias GES

> Plan aprobado para ejecutar por tareas. No crear otra fase F7 ni reescribir trabajo existente.

**Objetivo:** Reemplazar la constancia GES local por un flujo de urgencia odontológica persistente, aislado por clínica, auditable y sincronizado entre dispositivos; cubrir el alcance realizable del BP14 sin simular servicios externos ni convertir los protocolos pendientes en decisiones clínicas automáticas.

**Arquitectura:** Supabase será la fuente compartida de los ingresos y fichas. Una tabla de ingreso mínima para recepción queda separada de la ficha clínica porque RLS protege filas, no columnas. La ficha y sus eventos se mantienen en tablas clínicas tenant-scoped; la aplicación usa un servicio de dominio, caché/cola local idempotente y suscripción Realtime por clínica. BP06, BP07, BP09 y BP11 siguen siendo las fuentes canónicas de sus propios dominios.

**Tecnología:** React, TypeScript, Vitest, Supabase PostgreSQL/RLS/Realtime, helpers y servicios existentes. Sin dependencias nuevas.

**Especificación:** [BP14 Urgencias GES — diseño](../specs/2026-11-05-bp14-urgencias-ges-design.md)

## Restricciones globales

- Mantener las ocho patologías oficiales de urgencia separadas de los programas no urgentes de BP21. No borrar ni migrar constancias históricas; retirar categorías incorrectas solo del selector para registros nuevos.
- Datos oficiales y contrato real de la clínica prevalecen sobre mockups: no inventar códigos FONASA, aranceles, convenios, copagos, redes ni tiempos legales. No rotular 30 minutos como obligación legal.
- El contenido clínico de los ocho protocolos se muestra literalmente como referencia estática en borrador, pendiente de validación profesional. No crear checklist interactivo, recomendaciones contextuales, prescripciones, calculadoras ni alertas clínicas automáticas.
- Recepción solo puede ver/crear la cola mínima (`urgencias_ges_ingresos`). No otorgar SELECT sobre fichas ni eventos clínicos para resolver la llegada.
- El tenant se obtiene y valida en backend con membresía activa y helpers existentes; nunca se acepta como autoridad el `clinica_id` enviado por el cliente. Paciente, ingreso, ficha, presupuesto y movimiento deben pertenecer a la misma clínica.
- Tablas nuevas con RLS, `GRANT/REVOKE` explícitos y ausencia de acceso `anon`. Historial/auditoría append-only; no permitir borrado de ingresos, fichas ni eventos. Cierre inmutable; correcciones posteriores son eventos de enmienda.
- Si se requiere `SECURITY DEFINER` para un trigger de auditoría, definir `search_path = ''`, cualificar objetos, revocar ejecución directa, validar actor/tenant y probar intentos de abuso. No crear RPC privilegiados por conveniencia.
- Respetar el working tree preexistente, incluidos cambios BP14 visuales, los cambios BP09–BP12 y archivos eliminados. No revertir, renombrar ni limpiar rutas ajenas. Revisar cada diff que se solape antes de editar.
- No modificar migraciones históricas. Antes de desplegar, confirmar proyecto remoto e historial; no ejecutar un `db push` que aplique migraciones BP09–BP12 aún pendientes o cambios ajenos.
- No crear portal BP13, roles de paciente, pagos externos, envío XML/Email/Fax, llamadas a ambulancia, catálogo hospitalario global, suscripciones ni entitlements que el producto aún no tiene.
- La huella SHA-256, si se usa, solo prueba integridad del contenido; no presentarla como firma electrónica avanzada ni cumplimiento legal.

## Enfoque de revisión

1. Recepción no puede leer datos clínicos por consulta directa a ninguna tabla, vista ni suscripción.
2. Clínica A no puede leer, enlazar ni mutar registros de Clínica B, incluso con UUID conocido o `clinica_id` manipulado.
3. Reintentos offline y respuestas perdidas crean como máximo un ingreso, una ficha, un evento de negocio y un movimiento de inventario.
4. Un error de red no marca un registro sincronizado; las ediciones concurrentes o sobre una ficha cerrada fallan sin efectos secundarios.
5. Los eventos identifican actor autenticado, clínica validada, hora del servidor y tipo real de operación. El cliente no puede falsificar eventos ni borrarlos.
6. Presupuestos, pagos, recetas y movimientos siguen usando sus servicios canónicos; un vínculo entre módulos no duplica el ledger ni cambia contratos existentes sin necesidad.
7. Los protocolos no activan decisiones clínicas ni farmacológicas.

---

### Task 1: Auditoría de implementación y esquema core con seguridad tenant

**Archivos:**
- Revisar: `src/domains/clinical/emergency-ges/**`, `src/constants/rbacConstantsBase.ts`, `src/constants/rbacPermisosPorRol.ts`, `src/shared/hooks/usePermissions.ts`, `src/shared/hooks/useRealtimeSync.ts`, `src/infrastructure/realtime/realtimeEvents.ts`.
- Revisar: migraciones BP09–BP12, estructura de `pacientes`, membresías, permisos SQL existentes y las tablas BP09/BP07 que se vincularán.
- Crear: `supabase/migrations/<timestamp>_bp14_urgencias_ges_core.sql`.
- Crear: `supabase/tests/bp14_urgencias_ges_rls.sql`.

**Interfaces:**
- Catálogo común de las ocho patologías oficiales separado de configuración por clínica. Códigos/aranceles son nulos hasta que una clínica ingrese y valide sus datos.
- `urgencias_ges_ingresos` contiene solo ID, paciente, clínica, hora de recepción, estado de cola y actor; recepción no tiene grants clínicos.
- `urgencias_ges_triage` contiene severidad y signos vitales en alcance reducido para asistente/dentista. Asistentes no consultan la ficha completa.
- `urgencias_ges` contiene diagnóstico, tratamiento registrado, tiempos clínicos, profesional responsable, estado/cierre y referencias. Cada relación se valida dentro del mismo tenant.
- `urgencias_ges_eventos` guarda eventos append-only de ingreso, cambios, triage, derivación, cierre y enmienda. La auditoría no depende de una llamada opcional de frontend.
- Las funciones de auditoría privilegiadas, si hacen falta, solo se ejecutan como trigger, con `search_path` vacío y permisos revisados.

- [ ] Inspeccionar el contrato real de las tablas y roles disponibles, incluyendo constraints, grants, RLS, triggers, funciones, índices y migration history remota. Registrar los cambios preexistentes con los que se solapará BP14.
- [ ] Añadir pruebas SQL transaccionales de ingreso permitido para recepción, ficha denegada a recepción/asistente, triage permitido a asistente/dentista, ficha permitida a dentista/admin, falta de membresía, tenant ausente/manipulado y paciente de otra clínica.
- [ ] Probar `INSERT/UPDATE/DELETE` inválidos y verificar cero filas/eventos secundarios; comprobar que un ingreso duplicado conserva un solo ID y que no es posible borrar eventos.
- [ ] Crear una migración expand-only con catálogo de ocho patologías, configuración por clínica, ingreso mínimo, ficha y eventos; índices, claves y constraints tenant-scoped donde el esquema existente lo permita sin modificar historial.
- [ ] Añadir RLS y permisos mínimos explícitos a cada tabla; separar los grants de recepción de ficha/triage y los de asistente de la ficha completa; negar `anon`, `DELETE` y mutaciones de auditoría.
- [ ] Añadir registro de eventos con actor y reloj del servidor. Bloquear modificaciones clínicas después del cierre y permitir enmiendas como eventos nuevos.
- [ ] Ejecutar SQL tests y `scripts/db/verify-migrations.js`; revisar completo el diff de SQL y comprobar que no contiene IDs, tarifas ni datos de pacientes de ejemplo.

### Task 2: Servicio Supabase, caché/cola y sincronización Realtime

**Archivos:**
- Crear: `src/domains/clinical/emergency-ges/services/urgenciasGesCloudService.ts` y `src/domains/clinical/emergency-ges/services/urgenciasGesOfflineQueueService.ts`.
- Modificar: `src/domains/clinical/emergency-ges/services/urgenciasGesStorageService.ts`, `src/domains/clinical/emergency-ges/hooks/useUrgenciasGes.ts`, `src/shared/hooks/useRealtimeSync.ts`, `src/infrastructure/realtime/realtimeEvents.ts`.
- Añadir pruebas junto a los servicios y hooks existentes.

- [ ] Definir tipos del catálogo, ingreso, ficha, evento y estados a partir del SQL; reemplazar IDs/folios basados en `Date.now()` por UUID/idempotencia y folio emitido desde el servicio compartido.
- [ ] Implementar lectura/escritura Supabase usando sesión autenticada; contrastar la clínica activa, validar paciente visible y manejar errores sin filtrar datos sensibles.
- [ ] Implementar caché/cola local tenant-aware según los patrones existentes. Los comandos pendientes conservan su clave idempotente, fecha local no confiable y estado pendiente; no declarar sincronizado hasta confirmación remota. Si no es posible garantizar el límite de tenant o la reconciliación segura, desactivar escritura offline y mostrar estado explícito.
- [ ] Reconciliar duplicados tras timeout leyendo el mismo ID/idempotency key, nunca creando un segundo ingreso o movimiento.
- [ ] Suscribirse a cambios de ingreso/ficha para la clínica activa y limpiar suscripciones/cache al cambiar de clínica; los eventos y el payload no deben incluir datos de otra clínica.
- [ ] Añadir pruebas de persistencia remota, cola/reintento, conflicto, cambio de clínica, deduplicación, permisos y fallo de red.

### Task 3: Flujo de recepción, triage y ficha clínica

**Archivos:**
- Modificar: `src/domains/clinical/emergency-ges/UrgenciasGesModulo.tsx`, `components/FormRegistroUrgencia.tsx`, `components/DocumentoImpresoGes.tsx`, `constants/urgenciasGesConstants.ts`, `hooks/useUrgenciasGes.ts`.
- Modificar: `src/constants/rbacConstantsBase.ts`, `src/constants/rbacPermisosPorRol.ts`, sidebar/acciones solo si el nuevo permiso de ingreso lo requiere.
- Crear componentes co-localizados para cola, ficha, triage y enmiendas si reducen duplicación y mantienen el límite de permisos.

- [ ] Agregar permisos aditivos: recepción registra/consulta solo llegadas y asistente gestiona triage; mantener `VER_URGENCIAS_GES` como acceso a ficha/eventos completos y comprobar la matriz resultante.
- [ ] Crear el ingreso con hora del servidor; cuando se capture sin red, distinguir claramente hora local pendiente de confirmación. Mostrar estado de sincronización y acción de reintento.
- [ ] Completar campos del BP: severidad, signos vitales, escala de dolor, diagnóstico, piezas afectadas, tratamiento realizado, inicio/fin, responsable, indicaciones, seguimiento y derivación; conservar los campos actuales que sean compatibles.
- [ ] Usar el catálogo de ocho urgencias oficial; sacar 60 años, embarazo y fisura de las nuevas urgencias sin borrar datos históricos.
- [ ] Cerrar ficha sin `DELETE`; ofrecer corrección mediante enmienda con motivo/actor/hora y mostrar el historial. Rechazos/derivaciones quedan registrados como eventos.
- [ ] Actualizar impresión con contenido registrado, estado de sincronización y aviso de que el hash no equivale a firma electrónica; no afirmar cumplimiento legal no validado.
- [ ] Añadir pruebas de formularios por rol, validaciones, estados pendiente/sincronizado/error y flujo cerrado/enmienda.

### Task 4: Protocolos en borrador y derivaciones

**Archivos:**
- Crear contenido estático versionado en `src/domains/clinical/emergency-ges/data/` y vista en `components/`.
- Crear: migración/pruebas solo si la derivación necesita persistencia propia tras revisar el modelo core.

- [ ] Incluir los ocho textos del BP como referencia estática con rótulo persistente “BORRADOR CLÍNICO — PENDIENTE DE VALIDACIÓN”. Conservarlos como texto, no convertir pasos farmacológicos en acciones.
- [ ] No crear calculadora, dosis automática, checklist bloqueante, recomendación por diagnóstico, alertas clínicas, validación farmacológica nueva ni emisión de recetas.
- [ ] Registrar una derivación manual (destino, motivo, fecha, estado y notas) enlazada a la ficha si ese ciclo de vida no cabe en eventos sin duplicar información.
- [ ] Generar ficha de derivación imprimible con datos capturados y permisos clínicos; no enviar datos automáticamente a hospitales ni incluir directorios/contactos inventados.
- [ ] Añadir pruebas que demuestren modo solo lectura, etiqueta de borrador, contenido completo y protección del documento clínico.

### Task 5: Códigos por clínica y vínculo con presupuesto/pago

**Archivos:**
- Modificar servicios/componentes BP07 únicamente tras inspeccionar el contrato actual.
- Crear configuración/facturación BP14 solo si la revisión confirma que requiere ciclo de vida propio; crear migración additive y pruebas de tenant.

- [ ] Permitir que administrador autorizado configure y revise código, descripción, arancel, centro de costo y convenio por patología; valores no verificados siguen vacíos y se guarda actor/fecha del cambio.
- [ ] Guardar snapshot de la configuración usada por una atención para que cambios posteriores no alteren registros históricos.
- [ ] Vincular una atención a presupuesto existente sin duplicar cargos; validar mismo paciente y tenant y preservar estados/transiciones BP07.
- [ ] Mostrar cobertura/copago solo con datos oficiales y contrato vigente configurado. No calcular tramos mockup ni crear una liquidación FONASA automática. El pago registrado continúa en BP15.
- [ ] Representar el envío/liquidación externa como estado manual y explícito; no generar XML ni declarar que se facturó a una institución.
- [ ] Probar configuración por clínica, falta de código, validación de vínculos y cero efectos ante presupuesto o paciente de otro tenant.

### Task 6: Timeline BP06, reportes y exportación interna

**Archivos:**
- Modificar: `src/domains/clinical/patient/services/timelineService.ts`, ficha del paciente y tipo union solo donde el flujo de la ficha lo requiera.
- Añadir componentes/servicio de reportes dentro de `emergency-ges/`; modificar exportación únicamente para un informe interno.

- [ ] Añadir evento `urgencia_ges` a `timeline_paciente` usando su servicio actual; validar mismo paciente/clínica y manejar idempotencia para no duplicar el timeline.
- [ ] Mostrar el historial dentro de ficha clínica respetando permiso clínico; el módulo de recepción no puede entrar a la ficha ni ver este evento.
- [ ] Añadir dashboard interno con conteos/tiempos derivados de timestamps reales y filtros por clínica/período; no presentar 30 minutos como estándar legal.
- [ ] Añadir exportación interna CSV/PDF con campos autorizados. Restringir descarga de datos clínicos a roles clínicos/admin y nunca incluir tokens, IP no validada o datos innecesarios.
- [ ] No implementar envío XML/SEREMI hasta disponer de especificación oficial y contrato verificable.
- [ ] Añadir tests de idempotencia del timeline, filtros tenant, permisos de exportación y límites de datos.

### Task 7: Carro de urgencias e integración BP09

**Archivos:**
- Modificar: `src/domains/operations/inventory/services/inventarioCloudService.ts` y UI existente del inventario solo con un campo de origen de urgencia.
- Crear migración additive BP14/BP09 y pruebas SQL/servicio si hace falta FK nueva.

- [ ] Inspeccionar campos/grants/RPC de `vademecum_urgencia`, `inventario_stock_por_ubicacion`, lotes y movimientos actuales; vademécum sigue siendo catálogo, no stock.
- [ ] Enlazar una salida real de inventario a `urgencia_id` dentro del movimiento BP09 existente, validar paciente/clínica en backend y reutilizar la clave idempotente de movimientos.
- [ ] No descontar stock solo por marcar un medicamento en el formulario; el profesional registra el movimiento real y el sistema conserva su movimiento único.
- [ ] Mostrar stock/vencimiento y umbrales operativos únicamente desde inventario por clínica. No inventar umbrales ni crear alertas clínicas de tratamiento.
- [ ] Probar doble reintento, permisos, lote vencido, stock insuficiente y referencia cruzada; una operación inválida debe dejar cero movimientos.

### Task 8: Verificación, revisión de alcance y despliegue

**Archivos:**
- Revisar diff completo, migraciones y pruebas BP14; no incorporar cambios ajenos al alcance.

- [ ] Comparar todos los archivos tocados con el estado inicial; preservar los cambios BP14 visuales del usuario y cualquier trabajo concurrente.
- [ ] Ejecutar tests unitarios/componentes de BP14 y servicios relacionados, tests SQL/RLS, typecheck, validación de arquitectura y build PWA pertinentes. Reportar solo resultados ejecutados.
- [ ] Probar seguridad con Clínica A/B, recepción/dentista/admin, usuario sin membresía, paciente cruzado, UUID válido de otro tenant, clínica manipulada y ausencia de efectos secundarios.
- [ ] Si falta una credencial temporal para E2E autenticado o dos sesiones Realtime, pedir una credencial de prueba que no sea de producción y no persistirla. Continuar con verificaciones locales disponibles mientras tanto.
- [ ] Ejecutar advisors y comprobar la referencia remota de Supabase, versión PostgreSQL e historial de migraciones antes del despliegue. Comparar migraciones locales no aplicadas y dejar fuera todo BP09–BP12 o cambio ajeno.
- [ ] Aplicar solo la migración BP14 revisada al proyecto autorizado, comprobar esquema/RLS/grants/eventos e historial remoto, y verificar un round-trip de datos sin consultar contenido de pacientes reales.
- [ ] Revisar las 8 etapas del BP contra lo implementado y reportar funciones excluidas por falta de contrato/infraestructura; no afirmar CI, E2E, producción o cumplimiento legal si no se verificaron.
- [ ] No crear commit ni push.
