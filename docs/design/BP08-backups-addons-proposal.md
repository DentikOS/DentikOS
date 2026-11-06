# BP08 — Propuesta de backups, exportación y add-ons

**Estado:** propuesta para revisión. No implementada ni aprobada para cambios de arquitectura.
**Alcance:** BP08 §20 (Backups y exportación) y §23 (Dashboard CORE / add-ons).
**Revisada:** 2026-11-05.

## 1. Hallazgos en el repositorio

- `RespaldoDatosSection` exporta e importa JSON de la caché local de una clínica. `persistenceStorageService` solo recorre claves `sd_<clinicaId>_...` de `localStorage`; no crea copias del PostgreSQL ni copia objetos de R2.
- Los archivos clínicos guardan metadatos en `archivos_clinicos` y los objetos físicos en Cloudflare R2. Restaurar PostgreSQL no restaura esos objetos.
- `audit_log` guarda snapshots JSON completos para 11 tablas, pero no cubre todas las entidades de clínica. Es un log de auditoría append-only con datos sensibles; no se considera una fuente de cambios completa para backups incrementales.
- `registrar_exportacion` registra reportes `pdf`/`excel`; no implementa exportación íntegra de clínica ni restore.
- `DashboardAdministracion` no lista add-ons. No se encontró un modelo de suscripciones, entitlements, solicitudes o facturación de add-ons. Los directorios `src/domains/addons/{analytics,connect,...}` siguen como stubs de migración.
- `docs/BACKUP_RESTORE.md` y `docs/DEPLOY_CHECKLIST.md` describen Supabase Pro/PITR y piden probar restores en staging. No se verificó la configuración real del proyecto Supabase ni el plan contratado.

## 2. Diseño recomendado de backup

Separar las copias internas de recuperación de plataforma de los archivos que una clínica puede descargar.

### A. Recuperación de plataforma

1. Mantener las copias automáticas/PITR administradas por Supabase según el plan contratado. Solo operaciones de plataforma pueden restaurar el proyecto completo; esa acción afecta a todas las clínicas y requiere una ventana de mantenimiento.
2. Si BP08 exige además `.sql` propio y réplica externa, crear una tarea de operaciones programada fuera del cliente. El dump completo se cifra, se guarda en almacenamiento privado y se replica a AWS S3, como indica BP08. Credenciales con acceso global quedan en un secret manager y nunca llegan al navegador ni a logs.
3. Registrar fecha, resultado, tamaño, checksum, retención y referencia del objeto. El panel de clínica podrá mostrar el estado pertinente, pero nunca expondrá el dump global.
4. Los objetos de R2 se respaldan por una tarea separada o se incluyen al generar el ZIP de documentos. Una copia SQL por sí sola solo conserva sus metadatos.

Supabase documenta backups diarios para planes Pro, Team y Enterprise, PITR como opción adicional, y aclara que las copias de base de datos no incluyen objetos del Storage API. [Documentación oficial de backups de Supabase](https://supabase.com/docs/guides/platform/backups)

### B. Exportación por clínica

1. Generarla en un servicio backend. Validar JWT, obtener `user_id` verificado, comprobar membresía activa y rol `admin`, y resolver la clínica con `clinica_actual()`; nunca aceptar `clinica_id` como autorización desde el cliente.
2. Usar una lista explícita y versionada de entidades exportables. Las tablas hijas se filtran por su relación con registros de la misma clínica. Excluir Auth, secretos, datos de otras clínicas y objetos no vinculados a la clínica.
3. Generar `.xlsx`, CSV y `.zip` de documentos. El ZIP lee solo los objetos R2 relacionados por los metadatos de esa clínica, usa nombres de archivo saneados y no publica URLs permanentes.
4. Guardar el artefacto en un bucket privado con ruta por clínica y exportación. La API verifica de nuevo el tenant y el estado del artefacto antes de emitir una URL de descarga breve.
5. Registrar exportación, actor, clínica, formato, versión, estado y checksum sin guardar PHI en logs. Reutilizar el patrón de auditoría append-only; ampliar el contrato solo mediante una migración nueva si hacen falta acciones.

Supabase Storage aplica acceso con RLS sobre `storage.objects`; las políticas deben limitar tanto bucket como ruta/tenant, y el cliente nunca recibe una service key. [Control de acceso de Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control)

### C. Incremental JSON cada hora

BP08 lo requiere, pero no debe construirse sobre `audit_log` tal como está: hoy no tiene cobertura completa y almacena snapshots clínicos/financieros.

Propuesta: definir un registro de cambios de backup separado, privado y con retención limitada. Cada entidad exportable debe aportar `clinica_id` directamente o resolverlo mediante una relación validada; cada evento incluye secuencia/cursor, tabla permitida, ID, operación, payload necesario y tombstone para eliminaciones. El job genera un archivo JSON idempotente por clínica y ventana horaria, cifra el artefacto y guarda cursor, checksum, estado y número de reintentos.

El contrato de cobertura de tablas debe revisarse antes de crear triggers. Los datos del registro de cambios son PHI potencial: acceso de servicio solamente, no lectura por usuarios, sin payload sensible en logs y borrado según retención aprobada. Un reintento del mismo cursor no debe duplicar ni omitir cambios.

Supabase Cron puede programar SQL o invocar Edge Functions; su documentación advierte que secretos enviados por `pg_net` quedan temporalmente en la cola de solicitudes. No propongo reutilizar una llamada con service key sin un análisis de permisos/secreto; la alternativa candidata es un scheduler de operaciones con secretos fuera de la base. [Cron](https://supabase.com/docs/guides/cron) · [Programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

### D. Restauración

- **Restore de plataforma:** lo ejecuta operaciones sobre un entorno aislado o mediante los controles del proveedor, nunca el admin de una clínica. Debe probarse antes del go-live.
- **Restore de clínica:** el cliente no sube ni ejecuta SQL arbitrario sobre PostgreSQL compartido. El backend valida manifest, tenant, formato, relaciones y versión; prepara una vista previa; crea un punto de recuperación de la clínica; aplica solo entidades allowlisted; verifica referencias y deja un evento auditado. La restauración debe ser transaccional o fallar sin efectos parciales.
- Las pruebas de restore usarán una instancia local/aislada con datos sintéticos de Clínica A y B. No se prueba un restore global en el proyecto actualmente conectado.

## 3. Flujo de add-ons recomendado

### Catálogo y solicitud

1. El dashboard lista los add-ons disponibles, descripción, precio y periodicidad desde un catálogo controlado por la plataforma. Los precios que aparecen en la UI no autorizan cobros por sí mismos.
2. Cada clínica tiene un estado de acceso explícito: `no solicitado`, `solicitado`, `activo`, `suspendido` o `cancelado`, además de actor, fechas y referencia de proveedor cuando corresponda.
3. **MVP recomendado:** mostrar “Solicitar activación”. Solo un admin puede crear la solicitud. Esta queda pendiente y no concede acceso. Un operador de plataforma la aprueba manualmente; la aprobación queda auditada.
4. **Autoservicio con cobro:** requiere elegir proveedor y flujo de checkout/webhook. El servidor valida firma, importe, add-on y clínica; maneja eventos repetidos de forma idempotente y cambia el entitlement. El navegador nunca activa el módulo ni fija el precio.
5. Los módulos validan entitlement en backend además de ocultar o mostrar UI. Un flag en Zustand/localStorage no es una barrera de acceso.

### Datos y servicios candidatos

Si se aprueba esta vía, el diseño detallado incluiría un catálogo de add-ons, una relación de acceso por clínica y un registro de solicitudes/eventos de proveedor. Las escrituras de estado las controla un endpoint/RPC backend; RLS permite a la clínica consultar solo su estado y deja la aprobación reservada a plataforma. Nombres y columnas quedan por definir tras elegir activación manual o pago automático.

## 4. Decisiones antes de implementar

1. **SQL por clínica:** propuesta recomendada: `.sql` completo es solo backup interno; la clínica obtiene CSV/XLSX/ZIP y JSON incremental. Si BP08 exige SQL portable por clínica, confirmar que se diseñe un script de datos tenant-scoped y no un `pg_dump` global.
2. **Activación:** aceptar el MVP “Solicitar activación” con aprobación manual, o especificar proveedor de cobro y autorizar el diseño de checkout/webhooks.
3. **Almacenamiento de réplica:** BP08 nombra AWS S3; el producto ya usa R2 para documentos. Confirmar AWS S3 para backups o autorizar cambiar BP08 para usar R2 como réplica.
4. **Retención y operación:** BP08 mockup menciona 30 días; confirmar 30 días para copias y exportaciones temporales. Definir quién en plataforma puede aprobar un restore global y cómo se registra la prueba de restauración.
5. **Entorno de prueba:** antes de cualquier verificación de restauración real, disponer de Supabase aislado con datos sintéticos. El proyecto conectado actual no se usará para probar restauraciones destructivas.

## 5. Orden de implementación tras aprobación

1. Cerrar decisiones de alcance, retención, proveedor de storage y modelo de activación.
2. Inventariar todas las tablas tenant-owned, relaciones y objetos R2; aprobar allowlists y permisos.
3. Implementar primero metadatos/jobs y exportación tenant-scoped con auditoría, sin restore global.
4. Añadir el registro incremental después de cubrir cada tabla y operación de borrado.
5. Implementar restore de clínica con preflight y pruebas de cero efectos secundarios ante cualquier fallo.
6. Añadir catálogo/solicitud de add-ons; integrar cobro y entitlements solo con proveedor aprobado.
7. Verificar RLS A→A permitido / A→B rechazado, autorización admin/no-admin, idempotencia, expiración de URLs, archivos R2, restore aislado, build y E2E.

No se han creado tablas, migraciones, Edge Functions, buckets, secretos, schedules ni cambios de configuración como parte de esta propuesta.
