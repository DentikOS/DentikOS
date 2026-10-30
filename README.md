# Studio Dental 🦷

Aplicación web de gestión odontológica multi-clínica. Reúne agenda, pacientes y fichas clínicas, prestaciones, presupuestos, pagos, inventario y otras áreas de operación clínica.

## Tecnologías y funcionamiento

- **Interfaz:** React 19, TypeScript, Vite 8, Tailwind CSS 4 y Framer Motion.
- **Estado y validación:** Zustand y Zod.
- **Backend:** Supabase Auth, PostgreSQL con políticas RLS, Realtime y Edge Functions.
- **Archivos:** Supabase Storage y Cloudflare R2, según el flujo.
- **Uso local:** LocalStorage, IndexedDB y PWA. Algunos servicios conservan una caché por clínica y colas de operaciones pendientes para sincronizar al recuperar la conexión.
- **Pruebas y calidad:** Vitest, Testing Library, Playwright, oxlint y GitHub Actions.

`src/main.tsx` monta `src/App.tsx`. La aplicación restaura la sesión, comprueba si se necesita configurar una clínica y muestra la navegación una vez autenticado el usuario. Los módulos acceden a datos mediante hooks, stores y servicios. El aislamiento de datos entre clínicas depende de la autorización y las políticas del backend; la caché local también se separa por clínica.

## Inicio local

Requiere Node.js y npm. Para conectarse a Supabase, configura las variables indicadas en `.env.example` en un archivo `.env` local. No incluyas claves secretas o `service_role` en variables `VITE_`, porque se exponen al navegador.

```bash
npm ci
npm run dev
```

Vite muestra la dirección local al iniciar; normalmente es `http://localhost:5173/`. La interfaz requiere una cuenta y una clínica autorizada para usar los flujos conectados a Supabase.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Vista local del build |
| `npm run typecheck` | Comprobación de TypeScript |
| `npm run lint` | Análisis con oxlint |
| `npm run test` | Pruebas unitarias y de componentes con Vitest |
| `npm run test:security` | Suite de regresión de seguridad |
| `npm run test:coverage` | Pruebas con cobertura |
| `npm run validate:architecture` | Reglas de arquitectura del proyecto |
| `npm run test:e2e` | Pruebas Playwright; requieren entorno y credenciales de prueba |

Los comandos de base de datos (`db:reset`, `db:push`, `db:pull`, `db:diff`, `db:seed`, `db:verify`) están en `package.json`. Revisa el entorno enlazado antes de ejecutar operaciones sobre la base de datos.

El historial local y el del proyecto principal tienen migraciones anteriores sin correspondencia uno a uno (15 versiones solo locales y 4 solo remotas, comprobadas el 30 de octubre de 2026). No ejecutes `db:push` sobre el proyecto principal sin conciliar ese historial; esta tarea no modificó esas migraciones previas.

## BP06 y BP07: CORE de pacientes y presupuestos

La ficha clínica mantiene el odontograma y el plan por paciente y clínica activa. Un hallazgo del odontograma queda **sin precio y pendiente de revisión clínica** hasta que un profesional seleccione una prestación configurada y una fase. El presupuesto se crea como borrador con los ítems y totales revisados; el módulo global permite aprobar o rechazar manualmente estados permitidos, archivar sin eliminar el historial y registrar abonos manuales vinculados al presupuesto. El abono se confirma mediante una función de PostgreSQL antes de actualizar el saldo local. El timeline registra eventos reales vinculados al paciente.

Las migraciones [de integridad clínica y presupuestos](supabase/migrations/20261030060804_bp06_bp07_core_integrity.sql) y [de abonos manuales](supabase/migrations/20261030060852_bp07_manual_payments.sql) se aplican **en ese orden**. Incluyen columnas aditivas, restricciones, políticas RLS por clínica autorizada y paciente, auditoría de ficha y la función de registro de abonos. Se aplicaron al proyecto principal DentikOS el 30 de octubre de 2026. Se verificaron consultas RLS con y sin sesión y pruebas de abono, idempotencia, rechazo y auditoría dentro de transacciones revertidas. La interfaz puede iniciarse con datos locales; el flujo E2E en navegador con una cuenta real todavía requiere revisión. Ninguna migración se aplica al iniciar Vite.

Las integraciones con SII, Mercado Pago, Transbank, WhatsApp y firma remota/biométrica quedan para una entrega posterior; este CORE no genera documentos fiscales ni confirmaciones externas. La sincronización offline de presupuestos conserva una cola local; el registro de abonos exige conexión para evitar saldos financieros ambiguos.

**Registro de abonos manuales:** en la ficha del paciente, abre «Presupuestos + Plan Tratamiento», selecciona un presupuesto aprobado o en curso con saldo y pulsa «Registrar pago». La misma acción aparece en el módulo «Presupuestos», ahora accesible desde el menú. Recepción, dentista y administración pueden registrar el abono; el módulo general «Pagos» no imputa automáticamente un abono a un presupuesto. Un presupuesto pendiente de sincronización no admite abonos. El RPC confirma monto, clínica, paciente, estado e idempotencia antes de actualizar el saldo. Las migraciones [de acceso de recepción](supabase/migrations/20261030143914_bp07_reception_payments.sql) y [reintento idempotente](supabase/migrations/20261030144209_bp07_reception_idempotency.sql) se aplicaron al proyecto principal el 30 de octubre de 2026. Se probaron allí en transacciones revertidas: primer abono, reintento, sobrepago, entradas inválidas, rechazo del rol asistente y auditoría; las filas de prueba no persistieron.

### Estado de implementación pendiente

El CORE de ambos blueprints aún no está completo. Con Supabase activo, el arancel de `public.prestaciones` se carga por clínica al iniciar sesión, se actualiza por eventos de la tabla y alimenta el Plan de Tratamiento y Presupuestos. Solo administración y dentistas pueden escribir, conforme a las RLS existentes. Si la clínica no tiene prestaciones remotas, la lista queda vacía: no se copian automáticamente los precios de ejemplo. Los aranceles anteriores guardados en `localStorage` permanecen intactos; administración y dentistas pueden revisar e importar sus prestaciones personalizadas una por una desde «Prestaciones», con precio visible antes de cada importación. Los ejemplos sin cambios se excluyen. Crear una prestación nueva también la registra en Supabase. Los packs nuevos comparten nombre y precio como prestación, pero su descripción promocional sigue local a ese navegador. El reajuste masivo queda deshabilitado en modo Supabase hasta contar con una operación atómica. Las derivaciones se guardan como eventos clínicos del timeline, con motivo, especialista y prioridad, y se consultan desde el plan; no existe aún un documento PDF de interconsulta.

Al guardar cambios del plan, un profesional puede actualizar los borradores vinculados: se conservan ítems manuales y descuentos, se recalculan las prestaciones originadas en el plan y el presupuesto queda pendiente de revisión clínica. Si se pospone, «Actualizar borrador» permite retomarlo; PostgreSQL impide enviarlo o confirmarlo con una revisión anterior. Para un presupuesto enviado o aprobado, «Crear nueva versión» conserva la versión previa y genera un borrador revisable. La confirmación de revisión está disponible para administración y dentistas. Las migraciones [de vínculo y sincronización](supabase/migrations/20261030152509_bp07_plan_draft_sync.sql), [de identificadores por versión](supabase/migrations/20261030152814_bp07_plan_version_item_ids.sql) y [de bloqueo de revisiones obsoletas](supabase/migrations/20261030193818_bp07_block_stale_plan_budget.sql) se aplicaron al proyecto principal el 30 de octubre de 2026. La [verificación SQL](supabase/verify-bp07-plan-budget.sql) pasó allí dentro de una transacción revertida; no dejó presupuestos ni auditorías de prueba.

La derivación clínica registra motivo, diagnóstico, destino, prioridad, emisor y referencias a radiografías, fotos, odontograma y evoluciones de la ficha actual. El historial permite abrir esas secciones de la ficha y descargar un PDF informativo con los datos emitidos y la lista de referencias disponibles; el PDF no incluye copias de los archivos ni firma digital. Los archivos se referencian por ID; su contenido sigue en el repositorio clínico y puede cambiar o dejar de estar disponible si se elimina. Solo dentistas y administración clínica pueden emitir: la interfaz oculta la acción a otros roles y un trigger verifica rol, actor, clínica, paciente y archivos referenciados. Las migraciones [de autorización y referencias](supabase/migrations/20261030195805_bp06_derivacion_autorizada_referencias.sql) y [de tipo de evento](supabase/migrations/20261030195913_bp06_derivacion_tipo_timeline.sql) se aplicaron al proyecto principal el 30 de octubre de 2026. La [verificación transaccional](supabase/verify-bp06-derivacion.sql) confirmó emisión autorizada y rechazos sin efectos, con `ROLLBACK`.

El historial financiero BP07 conserva snapshots de creación y cambios de ítems, importes, descuentos o plan de pago desde la [migración de historial](supabase/migrations/20261030201257_bp07_historial_inmutable_presupuestos.sql). Incluye actor, clínica, paciente, motivo, valores antes/después y hash SHA-256 del snapshot; la app lo muestra en «Ver historial» dentro de los presupuestos del paciente. Las nuevas acciones de sincronización con el plan piden un motivo escrito; clientes anteriores reciben un motivo identificado como generado por el sistema. La app solo puede leer la tabla por RLS, y la función privada que la escribe no tiene ejecución directa. La [verificación SQL del historial](supabase/verify-bp07-historial.sql) y la [de sincronización del plan](supabase/verify-bp07-plan-budget.sql) pasaron en el proyecto principal en transacciones revertidas; comprobaron también que un abono no crea una versión financiera y que no quedan filas de prueba. No se reconstruyen versiones anteriores a esta migración ni se firma un PDF: el hash corresponde al snapshot financiero. La cola offline sube cabecera e ítems por separado y no garantiza atomicidad entre ambas tablas; si falla un ítem, mantiene el presupuesto pendiente y reintenta ese ítem sin reenviar la cabecera, incluso para colas huérfanas anteriores. La sincronización bidireccional de estados entre presupuesto, pagos y plan sigue pendiente antes de declarar BP06/BP07 completos.

## Estructura

```text
src/
├── main.tsx                 Entrada de React
├── App.tsx                  Sesión, navegación y composición de módulos
├── app/stores/              Estado compartido con Zustand
├── application/             Casos de uso y analítica de aplicación
├── domains/                 Áreas clínicas, financieras y operativas
├── infrastructure/          Auth, Supabase, almacenamiento y sincronización
├── shared/                  Hooks, componentes, tipos y utilidades comunes
├── design/                  Tokens y temas visuales
└── test/                    Soporte y pruebas de seguridad
supabase/
├── migrations/              Cambios versionados de PostgreSQL, RLS y funciones
├── functions/               Edge Functions
└── seeds/                   Datos de prueba por entorno
e2e/                        Pruebas de navegador con Playwright
scripts/                    Validaciones y utilidades del proyecto
docs/                       Arquitectura, decisiones y guías operativas
```

Los módulos de `src/domains/` se agrupan en `clinical`, `operations`, `billing`, `organization`, `specialty` y `addons`. La navegación de `App.tsx` carga Agenda y Dashboard al inicio y varios módulos mediante `React.lazy` cuando se abren.

## Verificación y documentación

El workflow de [CI](.github/workflows/ci.yml) ejecuta lint, tests, regresión de seguridad, comprobaciones de Edge Functions con Deno, build, validación de arquitectura y cobertura. El job E2E está deshabilitado mientras no exista un entorno de staging disponible. La configuración actual de cobertura mide archivos fuente JavaScript/JSX; no representa la cobertura del código TypeScript/TSX.

- [Reglas para agentes](AGENTS.md)
- [Constitución de arquitectura](docs/01-Constitucion_Arquitectura_Studio_Dental_v3.md)
- [Roadmap](docs/MASTER_ROADMAP.md)
- [Guía de contribución](CONTRIBUTING.md)
- [Migraciones de Supabase](supabase/README_MIGRATIONS.md)
