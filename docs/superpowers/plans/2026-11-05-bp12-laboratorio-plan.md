# BP12 Laboratorio Dental Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the BP12 CORE laboratory workflow in three verifiable waves, with clinic isolation, role-enforced financial privacy, traceable orders, and cross-device synchronization.

**Architecture:** Supabase PostgreSQL remains the shared source of truth, with RLS on every tenant table and a service/hook boundary in the existing React domain. Client cache/outbox uses tenant-aware IDs and idempotent commands; Realtime refreshes the active clinic view. Existing BP06 files, BP07 budget items, BP08 expense movements, BP05 agenda, and BP09 inventory remain canonical sources for their domains.

**Tech Stack:** React, TypeScript, Vitest, Supabase PostgreSQL/RLS/Realtime, existing Cloudflare R2 file services, and existing BP07/BP09 queue and idempotency patterns. No new dependency is planned.

**Spec:** [BP12 Laboratorio Dental design](../specs/2026-11-05-bp12-laboratorio-design.md)

## Global Constraints

- Implement BP12 CORE; exclude Portal del Laboratorio (S1), Connect, BI avanzado, and Signature Pro.
- Clinic scope comes from `clinica_actual()` and active membership, not from client-provided tenant IDs.
- Use the approved base matrix: admin manages all; dentist creates/edits orders; assistant creates and edits notes/stages; reception reads and creates a limited request.
- Cost and margin access requires admin or `ver_costos_laboratorio`; `pagar_laboratorios` allows relevant payment reads and writes without margin access.
- The seven stages are Solicitud, Enviada, Diseño, Fabricación, Prueba, Ajustes (optional), and Entrega/Cementación. Jumps and reversals are allowed with append-only history.
- Stage changes and history writes are atomic, idempotent, and include the authenticated actor and server timestamp.
- Preserve local orders/laboratories through import preview; never delete legacy local keys or historical database migrations as part of rollout.
- Extend `archivos_clinicos`; do not create `fotos_clinicas` or a duplicate gallery.
- Reuse existing finance, agenda, budget, inventory, R2, and Realtime patterns; do not generalize the global RBAC system as part of BP12.
- Do not revert or overwrite the 274 existing dirty paths. Inspect overlapping diffs before edits; do not commit or push automatically.
- Before remote DDL, verify the Supabase project reference is `nagduvivilmzupdpoayo`, reconcile migration history, run local checks/advisors, and review the exact diff.
- Active Supabase reports PostgreSQL 17 while `supabase/config.toml` declares 15; verify migration compatibility without changing the global configuration unless separately approved.

## Review Focus

1. A valid patient, laboratory, budget item, or user ID from another clinic must fail closed — owned by Task 1 RLS tests.
2. Dentists must not read laboratory costs or payments through direct Supabase queries unless granted an approved aditive permission — owned by Task 4 SQL and service tests.
3. Duplicate queue replay or stale concurrent stage changes must not duplicate history or overwrite the remote state — owned by Tasks 2–3.
4. Concurrent budget acceptance must create at most one order per eligible laboratory item and must not partially update the budget/order link — owned by Task 7.
5. Local imports and clinical files with missing, mismatched, deleted, or cross-clinic references must remain reviewable and produce no unintended link or deletion — owned by Tasks 2 and 6.

---

### Task 1: BP12 Core Schema and Tenant Security

**Files:**
- Create: `supabase/migrations/<timestamp>_bp12_laboratorio_core.sql` using the installed Supabase migration generator after checking CLI help.
- Create: `supabase/tests/bp12_laboratorio_rls.sql`
- Review only: `supabase/migrations/20261105181707_bp09_inventario_schema.sql`, `supabase/migrations/20261105203704_bp10_esterilizacion_core.sql`, `supabase/migrations/20261105213420_bp11_vademecum_realtime.sql`, and `supabase/migrations/20261105215421_bp11_recetas_canonicas.sql`.

**Interfaces:**
- Produces tenant-scoped tables for lab directory, work types, price catalog/history, orders, stage history, templates, guarantees, and additive permissions.
- Produces an authenticated-invoker stage transition operation; exact signature is fixed after reviewing current RPC conventions.
- Does not add costs to the row readable by all order roles.

- [ ] Inspect the complete BP09–BP11 schema, RLS, grants, triggers, and audit patterns; record the current remote project ref and migration head before changing files.
- [ ] Add transactional SQL tests for admin, dentist, assistant, reception, missing membership, and Clinic A versus Clinic B. Assert forbidden operations leave zero rows and zero audit/history side effects.
- [ ] Run the SQL test against the local database to demonstrate the missing BP12 schema/policies fail the relevant assertions.
- [ ] Generate one additive migration. Add clinic-scoped unique keys and composite foreign keys so patient, budget, lab, work type, template, and actor relationships cannot cross clinics.
- [ ] Add RLS, least-privilege grants, audit, constraints, and indexes. Define base role permissions and add-on permission reads/writes; avoid SECURITY DEFINER unless a reviewed need is demonstrated.
- [ ] Add append-only stage history and an atomic, idempotent transition operation for all seven stages. Validate expected version before applying queued commands.
- [ ] Re-run the SQL tests and `scripts/db/verify-migrations.js`; inspect the full migration and policy diff.

### Task 2: Cloud Repository, Local Cache, Outbox, and Import

**Files:**
- Create: `src/domains/addons/lab/services/laboratorioCloudService.ts`
- Create: `src/domains/addons/lab/services/laboratorioOfflineQueueService.ts`
- Create: `src/domains/addons/lab/services/laboratorioImportService.ts`
- Create: `src/domains/addons/lab/services/laboratorioCloudService.test.ts`
- Create: `src/domains/addons/lab/services/laboratorioImportService.test.ts`
- Modify: `src/domains/addons/lab/services/laboratorioStorageService.ts`
- Modify: `src/domains/addons/lab/hooks/useLaboratorio.ts`

**Interfaces:**
- `laboratorioCloudService.cargar(clinicaId)` returns clinic-scoped orders, laboratories, work types, and templates filtered by server policy.
- Mutations use stable idempotency keys; stage transitions include the expected server version.
- `laboratorioImportService.previsualizar()` returns importable and unresolved legacy rows without deleting or rewriting source keys.

- [ ] Add failing service tests for missing Supabase session, tenant mismatch, network failure, duplicate command replay, and stale-version conflict.
- [ ] Add failing import tests for sample defaults, local records with UUID references, missing/cross-clinic references, partial completion, and retry idempotency.
- [ ] Implement the cloud repository and tenant-aware outbox; only mark commands synced after server confirmation.
- [ ] Preserve unresolved rows in a review state. Allow valid rows to import individually; keep legacy keys until an explicit reconciliation count matches.
- [ ] Update `useLaboratorio` to load/refetch for clinic changes and network restoration; remove sample defaults from active flows without deleting real stored data.
- [ ] Run focused Vitest tests and inspect cache/outbox behavior for clinic switching and failure recovery.

### Task 3: Catalog, Laboratory Directory, Orders, and Seven-Stage Views

**Files:**
- Modify: `src/domains/addons/lab/constants/laboratorioConstants.ts`
- Modify: `src/domains/addons/lab/utils/laboratorioCalculations.ts`
- Modify: `src/domains/addons/lab/LaboratorioModulo.tsx`
- Modify: `src/domains/addons/lab/components/ModalNuevaOrden.tsx`
- Modify: `src/domains/addons/lab/components/DirectorioLaboratorios.tsx`
- Modify: `src/domains/addons/lab/components/TablaOrdenesLaboratorio.tsx`
- Modify: `src/domains/addons/lab/components/OrdenImprimible.tsx`
- Create: tests next to the changed components and hook, using current Vitest/Testing Library conventions.
- Modify: `src/infrastructure/realtime/realtimeEvents.ts`
- Modify: `src/shared/hooks/useRealtimeSync.ts`

**Interfaces:**
- Order form submits IDs and clinical fields only; the service resolves the active clinic and authenticated actor.
- Four documented laboratory tabs: Datos generales, Catálogo, Historial de órdenes, Estadísticas.
- Four order views: detalle, seven-column Kanban, patient timeline projection, and filtered list.

- [ ] Add failing tests for work type categories/sub-types, catalog price selection, required patient/lab/type IDs, seven stages, allowed backtracking, and role-specific controls.
- [ ] Implement directory fields for external/internal/digital labs, price catalog versions, estimated delivery, and the four specified profile tabs. Do not invent the undefined fifth tab.
- [ ] Replace the six legacy stages and remove fake patient/lab/order data from new-clinic defaults while retaining the local import source.
- [ ] Add the four order views; show all seven Kanban stages with horizontal scrolling on narrow screens and role-specific default views.
- [ ] Add stage-note and responsible-user display sourced from append-only history; do not show cost to unauthorized roles.
- [ ] Subscribe to lab table events in `useRealtimeSync`; refresh only the active clinic view and clean up subscriptions on clinic switch/unmount.
- [ ] Run focused component/service tests and inspect responsive layout at 1920, 1024, 768, and 375 px.

### Task 4: Cost Privacy, Partial Payments, and BP08 Expenses

**Files:**
- Create: `supabase/migrations/<timestamp>_bp12_laboratorio_finanzas.sql`
- Modify: `supabase/tests/bp12_laboratorio_rls.sql`
- Create: `src/domains/addons/lab/services/laboratorioFinanceService.ts`
- Create: `src/domains/addons/lab/services/laboratorioFinanceService.test.ts`
- Modify: `src/domains/addons/lab/components/LaboratorioModulo.tsx` and add a finance panel component under `src/domains/addons/lab/components/`.
- Modify: `src/domains/billing/cash-register/services/finanzasStorageService.ts`
- Modify: `src/domains/billing/cash-register/schemas/movimientoFinancieroSchema.ts`
- Modify: BP08 finance tests only where their current contracts require it.

**Interfaces:**
- Cost/price/margin data is stored separately from the common order projection; margin is derived.
- Each lab installment links to one order and one `movimientos_financieros` expense. The two writes are atomic and idempotent.
- `ver_costos_laboratorio` reveals costs/margins; `pagar_laboratorios` reads the linked balance/payment data and registers payments without revealing margin.

- [ ] Add failing RLS tests for admin, dentist, user with `ver_costos_laboratorio`, and user with `pagar_laboratorios`; test direct table queries, not only UI rendering.
- [ ] Add failing transaction tests for partial payments, overpayment, duplicate retries, cross-clinic order IDs, and zero side effects after rejection.
- [ ] Implement restricted finance relation and atomic expense/payment linking. Update the BP08 SELECT policy only for laboratory expense rows as approved; preserve access to other categories.
- [ ] Implement cost, patient price, margin, and payment history rendering from role-appropriate data projections.
- [ ] Run SQL and targeted Vitest tests; inspect raw Supabase result shapes for every role.

### Task 5: Files, Documents, Alerts, and Guarantees

**Files:**
- Create: `supabase/migrations/<timestamp>_bp12_laboratorio_traceability.sql`
- Modify: `src/domains/clinical/patient/hooks/useArchivosClinicos.ts` and the related upload/helper service selected after inspection.
- Modify: `src/domains/clinical/patient/components/ficha/adjuntos/AdjuntosSection.tsx` only for the laboratory filter/link integration.
- Create: lab document, alert, and warranty components/services under `src/domains/addons/lab/` with co-located tests.
- Modify: existing in-app notification service only if an existing event path cannot represent the seven BP12 alerts.

**Interfaces:**
- Clinical file metadata uses `archivos_clinicos`, category `laboratorio`, `orden_laboratorio_id`, existing R2 keys, and the current soft-delete/audit path.
- Warranty claims link the original order and, when approved, one replacement order. The original delivered order remains unchanged.
- Alert thresholds follow the BP12 values and clinic configuration; no WhatsApp/email delivery is added.

- [ ] Add failing tests for file-order-patient clinic mismatch, deleted files, warranty duplicate creation, guarantee responsibility, and each alert threshold.
- [ ] Add the `archivos_clinicos` category/link migration without creating `fotos_clinicas`; update uploader mapping and patient gallery filtering.
- [ ] Implement signed work-order/recipe metadata and supported document types using the current R2 service; do not store public raw URLs.
- [ ] Implement warranty claim/replacement lifecycle with append-only actor/time history and authorized approval.
- [ ] Use the existing notification mechanism for in-app alerts; first inspect whether it supports dedupe, persistence, clinic scope, and threshold scheduling. If it does not, pause for design approval before adding a scheduler or new notification contract.
- [ ] Run focused clinical-file, warranty, and alert tests; assert invalid operations produce no rows or audit events.

### Task 6: BP07, BP06, BP05, and BP09 Integrations

**Files:**
- Create: `supabase/migrations/<timestamp>_bp12_laboratorio_integraciones.sql`
- Modify: `src/domains/billing/budget/schemas/presupuestoSchema.ts`
- Modify: `src/domains/billing/budget/services/presupuestosStorageService.ts`
- Modify: `src/domains/billing/budget/services/presupuestosOfflineQueueService.ts`
- Modify: `src/domains/billing/budget/hooks/usePresupuestos.ts`
- Modify: `src/domains/clinical/patient/services/timelineService.ts`
- Modify: `src/domains/clinical/patient/components/ficha/FichaClinica.tsx`
- Modify: `src/domains/operations/agenda/AgendaModulo.tsx` or the smallest current agenda suggestion component confirmed by inspection.
- Modify: `src/domains/operations/inventory/services/inventarioCloudService.ts` only to pass the laboratory source reference through the existing idempotent movement contract.
- Add focused integration tests next to the existing budget, timeline, agenda, and inventory tests.

**Interfaces:**
- Only explicitly categorized budget items create lab orders; each source item maps to no more than one order.
- Order/timeline rows include clinic ID and actor context validated server-side.
- Internal-lab inventory consumption uses existing BP09 RPC idempotency; external/digital labs do not consume stock.

- [ ] Add failing tests for acceptance of a budget with 0/1/multiple lab items, duplicate acceptance, offline replay, item cancellation, and patient/tenant mismatch.
- [ ] Add an explicit lab-work classification and order link for `presupuesto_items`; implement one atomic idempotent server operation for acceptance-to-order creation.
- [ ] Update local queue serialization and reconciliation so lab fields survive offline budget edits and stale budget revisions do not create duplicate orders.
- [ ] Add order/stage events and prosthetic history to BP06 timeline without changing clinical evolution semantics.
- [ ] Add agenda suggestions for Fabricación completed and Prueba approved; do not book a visit automatically.
- [ ] Add internal-lab material consumption through BP09’s existing movement RPC, with one idempotency key per order operation.
- [ ] Run focused integration tests and assert invalid cross-tenant links create zero orders, movements, or timeline events.

### Task 7: Additive Permissions, Templates, and CORE Dashboard

**Files:**
- Modify: `src/domains/addons/lab/` for permission assignment, eight seed templates, template CRUD, and dashboard/report views.
- Modify: `src/constants/rbacConstantsBase.ts` and `src/constants/rbacPermisosPorRol.ts` only for sidebar/module visibility if required by the approved matrix.
- Create: co-located tests for permission grants, templates, and core dashboard calculations.
- Add any seed inserts for the eight default templates to the appropriate BP12 migration; no patient, lab, or order demo records.

**Interfaces:**
- Additive actions are `ver_costos_laboratorio`, `pagar_laboratorios`, `gestionar_laboratorios`, `aprobar_garantias`, and `configurar_plantillas`.
- The CORE dashboard reports orders by lab, average delivery time, rework rate, clinic costs for authorized users, active stages, and overdue orders.

- [ ] Add failing tests for each permission on each role and for revocation taking effect after reload/realtime refresh.
- [ ] Add tests for the eight required templates, per-clinic customization, disabling, and preserving the applied template snapshot on an existing order.
- [ ] Implement permission assignment and server-side policy checks; verify revocation cannot leave a cached financial projection visible.
- [ ] Implement CORE metrics using server-filtered data and avoid exposing financial aggregates to unauthorized users.
- [ ] Run role/component/calculation tests and check loading/empty/error states.

### Task 8: Full Verification and Remote Deployment

**Files:**
- Modify tests from Tasks 1–7 only for approved contract changes.
- No new product files unless a failing verification identifies a BP12 defect.

- [ ] Review all modified paths and compare each pre-existing dirty diff before finalizing; retain unrelated edits.
- [ ] Run focused unit/component/integration tests, SQL migration tests, `typecheck`, architecture validation, and PWA build. Do not claim tests that were not executed.
- [ ] Request the user’s temporary test credentials when required to validate actual Supabase RLS with the four roles; use them only for verification and do not persist them.
- [ ] Verify two-session Realtime behavior, clinic switch cleanup, offline queue replay/conflict review, and import reconciliation.
- [ ] Check Supabase security/performance/health advisors and confirm the target project ref and migration head again.
- [ ] Apply the reviewed additive migrations to `nagduvivilmzupdpoayo` using the Supabase integration only after local verification; then query schema, RLS, and migration history to confirm the deployed state.
- [ ] Report modified files, migrations applied, tests actually run, user-credential tests still unavailable, and any remaining limits. Do not commit or push.
