# BP14 — Urgencias GES: diseño propuesto

**Estado:** propuesta para revisión. No se han modificado código ni bases de datos durante la auditoría.

## Intención

Convertir el registro actual de constancias GES en un flujo de urgencia odontológica conectado a la ficha clínica, con datos persistentes por clínica, sincronización entre dispositivos y trazabilidad. El alcance es el BP14 completo, desarrollado por etapas como define su roadmap.

## Hallazgos que fijan el alcance

- El módulo actual es una constancia local. `useUrgenciasGes` lee y escribe en `localStorage`; no hay tablas GES en la base conectada ni suscripción Realtime para urgencias.
- El selector actual mezcla la urgencia odontológica con salud oral de 60 años, embarazo y fisura. Esos programas no son urgencias del BP14; se excluyen de nuevas atenciones y se conservan sus datos históricos.
- El acceso al módulo y el permiso `VER_URGENCIAS_GES` ya existen para administración y dentistas, pero no para recepción. La recepción necesita una vista de ingreso/espera con información mínima; no debe recibir por ello acceso a la ficha clínica completa.
- La línea de tiempo usa `timeline_paciente`; no corresponde agregar una columna a `evoluciones_clinicas` como sugiere el SQL del BP.
- `vademecum_urgencia` existe con 11 medicamentos activos. El stock por clínica pertenece al inventario BP09 y necesita una asociación por clínica; el vademécum es catálogo de referencia, no stock.
- No existe un portal de pacientes BP13 en esta aplicación. Tampoco se encontró infraestructura de suscripción/entitlements para vender y habilitar los tres add-ons del BP14.
- La base conectada ya tiene BP12. La migración local debe agregarse como nueva; no se debe editar ninguna migración histórica.

## Datos oficiales que prevalecen sobre los mockups

El BP propone una espera máxima de 30 minutos como obligación GES y copagos FONASA de 0/10/20/30% por tramo. La Superintendencia de Salud publica confirmación diagnóstica dentro de 24 horas desde la sospecha, tratamiento inmediato después de confirmarla, copago de 0% para FONASA A–D y 20% para ISAPRE. No se rotulará el umbral de 30 minutos como exigencia legal ni se calcularán copagos con la tabla del mockup. Puede conservarse como objetivo operativo interno únicamente si la clínica lo configura como tal.

La guía oficial de MINSAL enumera ocho diagnósticos de urgencia y separa las urgencias odontológicas de los programas de 60 años, embarazo y niñez. Sus recomendaciones farmacológicas son condicionales y no respaldan automatizar la prescripción generalizada que aparece en algunos protocolos del BP.

Fuentes consultadas:

- [Superintendencia de Salud — Urgencia Odontológica Ambulatoria](https://www.superdesalud.gob.cl/orientacion-en-salud/urgencia-odontologica-ambulatoria/)
- [MINSAL — Orientación Técnica Programa GES Odontológico](https://diprece.minsal.cl/wp-content/uploads/2019/02/Orientaci%C3%B3n-T%C3%A9cnica-Programa-GES-Odontol%C3%B3gico-2019.pdf)
- [MINSAL/DIPRECE — Recomendaciones GPC de Urgencia Odontológica Ambulatoria](https://diprece.minsal.cl/garantias-explicitas-en-salud-auge-o-ges/guias-de-practica-clinica/urgencia-odontologica-ambulatoria/recomendaciones/)

## Objetivos

1. Registrar llegada, triage, ocho diagnósticos GES, ficha clínica, derivación, cierre y seguimiento sin reemplazar la ficha clínica regular.
2. Usar Supabase como persistencia compartida; refrescar la app por Realtime y conservar la capacidad offline mediante una cola idempotente ya alineada con los patrones del proyecto.
3. Aislar todos los registros por `clinica_id` en backend y RLS, comprobar que paciente y urgencia pertenecen a la misma clínica y no confiar en IDs del navegador.
4. Mantener auditoría append-only con usuario autenticado, clínica, hora del servidor, tipo de evento y datos de cambio. Las correcciones a casos cerrados deben ser nuevas enmiendas auditadas, nunca borrados silenciosos.
5. Integrar la urgencia en `timeline_paciente`, BP07, recetas BP08/BP11 e inventario BP09 usando los servicios y datos existentes, sin duplicar esas áreas.
6. Permitir configurar código/arancel por clínica cuando haya datos contractuales verificados. El catálogo global contendrá solo datos respaldados por una fuente oficial.
7. Presentar el contenido de los ocho protocolos del BP como referencia estática en borrador, pendiente de aprobación clínica. No convertirlo en checklist, recomendación contextual, prescripción, cálculo de dosis ni alerta clínica automática.

## Fuera de alcance de esta propuesta

- Programas GES no urgentes de BP21 y nuevos formularios para ellos.
- Crear un portal BP13, autenticación de pacientes o nuevos roles de autenticación.
- Afirmar que un hash SHA-256 o una marca de tiempo constituye por sí sola firma electrónica avanzada o cumplimiento legal.
- Enviar facturas/XML a FONASA, Isapres o SEREMI, enviar fichas a hospitales, llamar ambulancias o enviar emails/faxes. El BP no entrega formatos, contratos ni endpoints oficiales para esas acciones.
- Inventar códigos FONASA, aranceles, elegibilidad de red o copagos por clínica.
- Crear suscripciones de pago o entitlements para los add-ons. El producto no tiene esa infraestructura disponible hoy.
- Eliminar constancias, datos locales o registros históricos. Solo se quitarán categorías programáticas del selector de nuevas urgencias.

## Enfoques considerados

1. **Extender el módulo actual local y sumar pantallas:** descartado porque no resuelve sincronización entre usuarios ni aislamiento backend.
2. **Extender el dominio existente con persistencia Supabase, RLS, cola offline y Realtime; completar BP14 por etapas:** propuesto. Es la interpretación del pedido explícito de aplicar el BP completo y dejar la app sincronizada, y permite integrar BP06/BP07/BP09 sin crear módulos duplicados.
3. **Crear una aplicación/portal GES separado:** descartado para BP14 porque el repositorio ya tiene una app modular y el portal de pacientes pertenece a BP13.

## Modelo de datos propuesto

- Catálogo global versionado de las ocho patologías oficiales, separado de la configuración de cada clínica. La configuración conserva el código/arancel pactado y los datos vigentes al momento de atender; los valores desconocidos quedan sin configurar, nunca con ejemplos ficticios.
- `urgencias_ges_ingresos` guarda solo lo necesario para la cola de recepción (`id`, clínica, paciente, llegada, estado de cola y actor); `urgencias_ges_triage` separa severidad y signos vitales, disponibles a dentistas/asistentes; `urgencias_ges` contiene la ficha clínica detallada y referencia el ingreso con el mismo ID. Esta separación evita que una política RLS de filas entregue datos clínicos a recepción o la ficha completa a asistentes, ya que RLS no limita columnas.
- `urgencias_ges` con `clinica_id`, folio, estado, marcas de tiempo, datos clínicos, derivación, atención, cierre y una clave de idempotencia para reintentos offline. El triage se consulta desde su tabla de alcance reducido.
- `urgencias_ges_eventos` append-only y tenant-scoped para auditar creación, triage, atención, cambios, derivación, facturación, cierre y enmiendas.
- Tablas relacionadas de protocolos versionados, derivaciones y facturación solo donde se necesite conservar una relación o ciclo de vida propio. Los pagos permanecen en BP15 y los presupuestos en BP07.
- Asociación por clínica entre fármacos del carro y registros de inventario BP09; los movimientos siguen siendo los movimientos BP09 y apuntan al paciente y al caso de urgencia.

Las políticas deben emplear los helpers existentes (`clinica_actual()` y `tiene_rol_en_clinica(...)`), validar el tenant del paciente y separar acciones de recepción de lectura clínica. Recepción solo tendrá acceso a `urgencias_ges_ingresos`; asistentes acceden al ingreso y triage, no a la ficha completa; dentistas/admin acceden a fichas y eventos clínicos. El borrador de RLS incluido en el BP no se copiará: no define políticas para todas las tablas ni evita con claridad relaciones paciente/urgencia entre clínicas.

## Flujo de aplicación y sincronización

1. Recepción registra llegada y estado de espera mínimos en `urgencias_ges_ingresos`; asistente/dentista registra triage en `urgencias_ges_triage`; solo dentista/admin enlaza el ingreso a la ficha completa en `urgencias_ges`.
2. Dentista registra diagnóstico, examen, tratamiento, fármacos realmente administrados/prescritos, derivación e indicaciones. Las recetas siguen creándose mediante el flujo BP08/BP11.
3. Los cambios se encolan con UUID/idempotency key, se confirman en Supabase y se refrescan en otros dispositivos mediante Realtime. Un fallo de red no debe crear duplicados ni marcar un registro como sincronizado si no fue confirmado por backend.
4. Al cerrar, el contenido clínico queda bloqueado; una corrección posterior se registra como enmienda. El timeline recibe un evento `urgencia_ges`.
5. BP07 conserva el presupuesto y BP15 el copago pagado. El estado de liquidación institucional se mantiene como registro interno hasta disponer de reglas y formatos externos verificables.

## Plan por etapas

1. Auditoría final de patrones, migración expand-only, RLS/índices/eventos y catálogo de ocho patologías.
2. Configuración de clínica para códigos/aranceles y protocolos, sin inventar datos externos.
3. Ficha completa, cola offline idempotente, sincronización inicial y Realtime.
4. Protocolos estáticos en borrador y vínculo con receta/alergias/interacciones sin recomendar tratamiento.
5. Integración BP07/BP15 con copagos vigentes y estado manual de pago/liquidación.
6. Dashboard y reportes internos; CSV/PDF primero. XML/envío solo cuando exista un contrato oficial validado.
7. Carro: asociación al inventario BP09, movimientos idempotentes y alertas de stock/vencimiento existentes.
8. Derivaciones y revisión de dependencias BP13/add-ons. No se simularán integraciones externas ni roles de superadministrador ausentes.

## Verificación requerida antes de cerrar

- RLS: permitido para clínica y rol autorizados; rechazado para otra clínica, paciente de otro tenant, usuario sin membresía y `clinica_id` ausente/manipulado.
- Auditoría: usuario/tenant/fecha del servidor; eventos no actualizables ni eliminables; una operación inválida no deja efectos secundarios.
- Offline/RealtIme: reintento produce un caso y un movimiento como máximo; dos dispositivos ven el mismo estado; falla de red visible y recuperable.
- Frontend: recepción no ve ficha completa; dentista puede registrar y cerrar; responsive de app.
- Integración: evento timeline, receta enlazada, presupuesto/pago y movimientos BP09 conservan el mismo paciente/urgencia/clínica.
- Sin credenciales clínicas de prueba, se ejecutarán tests unitarios/integración y verificaciones de base disponibles; el flujo autenticado entre dispositivos requiere una credencial temporal de prueba, no producción.

## Riesgos y decisiones pendientes

- Códigos, aranceles y convenios dependen de datos oficiales y contratos propios de cada clínica.
- La facturación GES requiere confirmar que la clínica y la prestación pertenecen a la red/contrato aplicable; no se debe prometer un cobro automático a FONASA a cualquier clínica privada.
- La firma electrónica y la entrega de copias requieren una definición legal/producto. El hash se tratará únicamente como comprobación de integridad.
- Portal BP13, superadministración global y monetización de add-ons son dependencias de otros módulos que no existen en la app actual.
- El working tree ya contiene cambios sin commit en Urgencias GES y muchos módulos relacionados. Toda implementación debe revisar y preservar esos cambios, sin revertir ni limpiar archivos ajenos.
