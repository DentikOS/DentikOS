# Plan: BP11 vademécum y sincronización de recetas

## Estado auditado

- El vademécum curado ya existe en ocho tablas compartidas y el servicio mantiene caché local/offline.
- El formulario de receta activo consulta un store estático distinto, que precarga dosis genéricas.
- La app ya declara eventos Realtime para las tablas del vademécum, pero no mantiene suscripciones ni las tablas están publicadas para Realtime.
- `public.recetas` tiene cero filas y `fichas_clinicas.recetas` contiene tres registros. Esos registros incluyen hash/QR y profesional, campos que no están representados claramente por el contrato actual de `public.recetas`.
- Auditoría de solo lectura confirma UUID, fecha, medicamentos y tenant padre válidos en las tres recetas; el primer snapshot de auditoría vincula un único autor a cada una.
- Supabase conserva cuatro policies `recetas_*_rol` junto a las policies `recetas_*_clinica`. `role_in()` solo comprueba el rol global del JWT; las variantes `_rol` no exigen que el paciente pertenezca a `clinica_actual()`. No se modificó RLS.

## Alcance implementable

1. Conectar el formulario activo al catálogo de `vademecumService`, conservando su caché offline.
2. Iniciar recetas sin medicamento, dosis ni indicaciones precargadas; la selección de catálogo no completa dosis.
3. Suscribir la app a las ocho tablas de referencia y refrescar el catálogo tras cambios Realtime.
4. Agregar una migración idempotente que publique esas tablas en `supabase_realtime`; aplicada y verificada solo para las ocho tablas BP11.
5. Probar el formulario y los mapas de eventos; 53 tests focalizados, typecheck, build y Oxlint pasan.

## Fuera del cambio hasta aclarar el contrato de datos

- No migrar ni escribir recetas en `public.recetas` todavía: los tres registros existentes guardan profesional, hash forense y QR, mientras la tabla actual no ofrece una correspondencia confirmada para esos campos; tampoco persiste el diagnóstico/indicaciones del formulario activo.
- No hacer backfill, dual-write, cambios de tabla, RLS, permisos ni reglas clínicas/dosis.
- Después de completar la conciliación, presentar la decisión concreta de mapeo para que el usuario la confirme antes de alterar persistencia.

## Decisiones confirmadas para el flujo canónico de recetas

1. Retirar las cuatro policies `recetas_select_rol`, `recetas_insert_rol`, `recetas_update_rol` y `recetas_delete_rol`; reforzar las equivalentes `_clinica` para comprobar `clinica_id = clinica_actual()`, membresía del paciente y rol.
2. Agregar `profesional`, `hash_forense` y `qr_token` a `public.recetas`, copiar las tres recetas conservando intacto el JSON `medicamentos`, tomar `user_id` del primer evento de auditoría inequívoco y dejar `diagnostico`/`indicaciones` en null donde no existen datos.
3. Cambiar el formulario activo a una sola escritura en `public.recetas`, con ID UUID idempotente y sin cola offline; emitir solo cuando Supabase confirme el registro.
4. Probar Dentista autorizado, acceso/escritura cruzada Clínica A→B rechazados y cero efectos si falla el tenant; además, validar un cambio Realtime desde dos sesiones autenticadas.

El usuario confirmó que dosis, frecuencia y duración son obligatorias al emitir. También confirmó retirar afirmaciones de firma digital/QR verificable hasta integrar firma real. No se automatizarán dosis ni excepciones clínicas.

## Verificación inicial

- Baseline ejecutado: `Recetas.test.tsx`, `vademecumService.test.js` y `realtimeEvents.test.js` — 47 tests pasaron.
- Verificación final focalizada: 53 tests pasaron; `npm run typecheck`, `npm run build` y Oxlint focalizado pasaron.
- La migración `20261105213420_bp11_vademecum_realtime` quedó aplicada en Supabase; consulta de solo lectura confirmó las ocho tablas publicadas.
