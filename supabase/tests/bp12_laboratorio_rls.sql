-- BP12 RLS/atomicity integration coverage. Run against the local Supabase DB
-- as postgres with `supabase test db`; all fixtures and audit rows roll back.
BEGIN;

CREATE TEMP TABLE bp12_test_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  dentista_id uuid NOT NULL,
  asistente_id uuid NOT NULL,
  recepcion_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  paciente_b uuid NOT NULL,
  laboratorio_a uuid NOT NULL,
  laboratorio_b uuid NOT NULL,
  tipo_a uuid NOT NULL,
  tipo_b uuid NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE bp12_finance_fixture (orden_id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE bp12_crossclinic_fixture (orden_id uuid NOT NULL) ON COMMIT DROP;

-- Use only IDs in the fixture; the script never prints patient data.
DO $setup$
DECLARE
  v_clinica_a uuid;
  v_clinica_b uuid;
  v_admin uuid;
  v_dentista uuid;
  v_asistente uuid;
  v_recepcion uuid;
  v_created_by_b uuid;
  v_paciente uuid;
  v_paciente_b uuid;
  v_lab_a uuid := gen_random_uuid();
  v_lab_b uuid := gen_random_uuid();
  v_tipo_a uuid := gen_random_uuid();
  v_tipo_b uuid := gen_random_uuid();
BEGIN
  SELECT mc.clinica_id,
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'admin'
           AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'dentista'
           AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'asistente'
           AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'recepcion'
           AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1))[1]
    INTO v_clinica_a, v_admin, v_dentista, v_asistente, v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.activo
  GROUP BY mc.clinica_id
  HAVING count(*) FILTER (WHERE mc.rol::text = 'admin'
             AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1) > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'dentista'
             AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1) > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'asistente'
             AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1) > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'recepcion'
             AND (SELECT count(*) FROM public.miembros_clinica m WHERE m.user_id = mc.user_id AND m.activo) = 1) > 0
  ORDER BY mc.clinica_id
  LIMIT 1;

  IF v_clinica_a IS NULL THEN
    RAISE EXCEPTION 'BP12 test fixture requires one clinic with active admin, dentist, assistant, and reception memberships';
  END IF;

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP12 rollback test ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_b;
  v_created_by_b := v_admin;

  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES (v_clinica_b, v_admin, 'admin'::public.app_role, true);

  INSERT INTO public.pacientes (clinica_id, user_id, nombre, rut)
  VALUES (
    v_clinica_a,
    v_admin,
    'BP12 RLS rollback fixture',
    'BP12-' || replace(gen_random_uuid()::text, '-', '')
  ) RETURNING id INTO v_paciente;

  INSERT INTO public.pacientes (clinica_id, user_id, nombre, rut)
  VALUES (
    v_clinica_b,
    v_created_by_b,
    'BP12 Clinic B rollback fixture',
    'BP12-' || replace(gen_random_uuid()::text, '-', '')
  ) RETURNING id INTO v_paciente_b;

  INSERT INTO public.laboratorios (id, clinica_id, nombre, tipo, created_by)
  VALUES
    (v_lab_a, v_clinica_a, 'BP12 lab A rollback fixture', 'externo', v_admin),
    (v_lab_b, v_clinica_b, 'BP12 lab B rollback fixture', 'externo', v_created_by_b);

  INSERT INTO public.laboratorio_tipos_trabajo (id, clinica_id, categoria, nombre, created_by)
  VALUES
    (v_tipo_a, v_clinica_a, 'protesis_fija', 'BP12 work type A rollback fixture', v_admin),
    (v_tipo_b, v_clinica_b, 'protesis_fija', 'BP12 work type B rollback fixture', v_created_by_b);

  INSERT INTO pg_temp.bp12_test_fixture
  VALUES (v_clinica_a, v_clinica_b, v_admin, v_dentista, v_asistente,
          v_recepcion, v_paciente, v_paciente_b, v_lab_a, v_lab_b, v_tipo_a, v_tipo_b);
END;
$setup$;

GRANT SELECT ON pg_temp.bp12_test_fixture TO authenticated;
GRANT SELECT, INSERT ON pg_temp.bp12_finance_fixture TO authenticated;
GRANT SELECT, INSERT ON pg_temp.bp12_crossclinic_fixture TO authenticated;

-- Admin may manage the directory and create orders in the active tenant.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $admin$
DECLARE
  v_fixture record;
  v_before bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  IF public.clinica_actual() IS DISTINCT FROM v_fixture.clinica_a THEN
    RAISE EXCEPTION 'Admin fixture did not resolve to Clinic A';
  END IF;
  SELECT count(*) INTO v_before FROM public.laboratorios;
  INSERT INTO public.laboratorios (clinica_id, nombre, tipo, created_by)
  VALUES (v_fixture.clinica_a, 'BP12 admin write rollback fixture', 'digital', auth.uid());
  IF (SELECT count(*) FROM public.laboratorios) <> v_before + 1 THEN
    RAISE EXCEPTION 'Admin laboratory write was not visible in the active clinic';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.admin_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_b)
  )::text, true);
  IF public.clinica_actual() IS DISTINCT FROM v_fixture.clinica_b THEN
    RAISE EXCEPTION 'A user with active membership could not switch to Clinic B';
  END IF;
  IF (SELECT count(*) FROM public.laboratorios WHERE id = v_fixture.laboratorio_b) <> 1
     OR (SELECT count(*) FROM public.laboratorios WHERE id = v_fixture.laboratorio_a) <> 0 THEN
    RAISE EXCEPTION 'Admin clinic switch did not isolate laboratory reads';
  END IF;
END;
$admin$;
RESET ROLE;

-- Dentist creates an order, records a jump, replays idempotently, rejects a
-- stale version without side effects, and can reverse a stage before delivery.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $dentist$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_result jsonb;
  v_historial bigint;
  v_auditoria bigint;
  v_auditoria_total bigint;
  v_ordenes_total bigint;
  v_fallo boolean;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  IF (SELECT count(*) FROM public.laboratorios WHERE id = v_fixture.laboratorio_b) <> 0 THEN
    RAISE EXCEPTION 'Clinic A can read Clinic B laboratory data';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.dentista_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_b)
  )::text, true);
  IF public.clinica_actual() IS NOT NULL
     OR (SELECT count(*) FROM public.laboratorios WHERE id = v_fixture.laboratorio_b) <> 0 THEN
    RAISE EXCEPTION 'A user without Clinic B membership could select or read Clinic B';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.dentista_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_a)
  )::text, true);

  INSERT INTO public.ordenes_laboratorio (
    clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id,
    pieza_dentaria, color_guia, observaciones
  ) VALUES (
    v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_a,
    v_fixture.tipo_a, '36', 'A2', 'BP12 rollback test'
  ) RETURNING id INTO v_orden;
  INSERT INTO pg_temp.bp12_finance_fixture (orden_id) VALUES (v_orden);

  UPDATE public.ordenes_laboratorio
  SET color_guia = 'A3',
      indicaciones_tecnicas = 'Control de contacto proximal',
      fecha_estimada_entrega = current_date + 7
  WHERE id = v_orden;
  IF NOT FOUND OR (SELECT color_guia FROM public.ordenes_laboratorio WHERE id = v_orden) <> 'A3'
     OR (SELECT indicaciones_tecnicas FROM public.ordenes_laboratorio WHERE id = v_orden) <> 'Control de contacto proximal'
     OR (SELECT fecha_estimada_entrega FROM public.ordenes_laboratorio WHERE id = v_orden) <> current_date + 7 THEN
    RAISE EXCEPTION 'Dentist could not edit permitted order details';
  END IF;

  v_result := public.transicionar_orden_laboratorio(
    v_orden, 'prueba', 'Salto permitido', 'b1200000-0000-4000-8000-000000000001'::uuid, 1
  );
  IF v_result->>'etapa_actual' <> 'prueba' OR (v_result->>'version')::integer <> 2 THEN
    RAISE EXCEPTION 'The stage jump did not update the order/version';
  END IF;

  PERFORM public.transicionar_orden_laboratorio(
    v_orden, 'prueba', 'Salto permitido', 'b1200000-0000-4000-8000-000000000001'::uuid, 1
  );
  SELECT count(*) INTO v_historial
  FROM public.historial_etapas_laboratorio WHERE orden_id = v_orden;
  IF v_historial <> 2 THEN
    RAISE EXCEPTION 'Idempotent replay created duplicate stage history';
  END IF;

  SELECT count(*) INTO v_auditoria FROM public.audit_log
  WHERE table_name = 'ordenes_laboratorio' AND record_id = v_orden::text;
  v_fallo := false;
  BEGIN
    PERFORM public.transicionar_orden_laboratorio(
      v_orden, 'entrega', 'Stale request', 'b1200000-0000-4000-8000-000000000002'::uuid, 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Stale stage transition was accepted'; END IF;
  IF (SELECT version FROM public.ordenes_laboratorio WHERE id = v_orden) <> 2
     OR (SELECT count(*) FROM public.historial_etapas_laboratorio WHERE orden_id = v_orden) <> 2
     OR (SELECT count(*) FROM public.audit_log WHERE table_name = 'ordenes_laboratorio' AND record_id = v_orden::text) <> v_auditoria THEN
    RAISE EXCEPTION 'Rejected stale transition left an order, history, or audit side effect';
  END IF;

  v_result := public.transicionar_orden_laboratorio(
    v_orden, 'enviada', 'Retroceso permitido', 'b1200000-0000-4000-8000-000000000003'::uuid, 2
  );
  IF v_result->>'etapa_actual' <> 'enviada' OR (v_result->>'version')::integer <> 3 THEN
    RAISE EXCEPTION 'The stage reversal did not update the order/version';
  END IF;

  SELECT count(*) INTO v_ordenes_total FROM public.ordenes_laboratorio;
  SELECT count(*) INTO v_auditoria_total FROM public.audit_log
  WHERE table_name = 'ordenes_laboratorio';
  v_fallo := false;
  BEGIN
    INSERT INTO public.ordenes_laboratorio (
      clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
    ) VALUES (
      v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_b, v_fixture.tipo_a
    );
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Cross-clinic laboratory reference was accepted'; END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio) <> v_ordenes_total
     OR (SELECT count(*) FROM public.audit_log WHERE table_name = 'ordenes_laboratorio') <> v_auditoria_total THEN
    RAISE EXCEPTION 'Rejected cross-clinic order insert left order/audit side effects';
  END IF;
END;
$dentist$;
RESET ROLE;

-- Admin sets the order cost and creates a valid Clinic B order for the
-- cross-tenant payment check. No user permission is granted yet.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_seed$
DECLARE
  v_fixture record;
  v_orden_a uuid;
  v_orden_b uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  SELECT orden_id INTO v_orden_a FROM pg_temp.bp12_finance_fixture;
  v_result := public.guardar_costo_orden_laboratorio(v_orden_a, 100000, 160000);
  IF v_result ? 'costo_total' OR v_result ? 'precio_paciente' THEN
    RAISE EXCEPTION 'Cost write RPC returned financial values outside the RLS projection';
  END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio_costos
      WHERE clinica_id = v_fixture.clinica_a AND orden_id = v_orden_a
        AND costo_total = 100000 AND precio_paciente = 160000) <> 1 THEN
    RAISE EXCEPTION 'Admin did not persist the order cost';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.admin_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_b)
  )::text, true);
  INSERT INTO public.ordenes_laboratorio (
    clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
  ) VALUES (
    v_fixture.clinica_b, v_fixture.paciente_b, v_fixture.laboratorio_b, v_fixture.tipo_b
  ) RETURNING id INTO v_orden_b;
  INSERT INTO pg_temp.bp12_crossclinic_fixture VALUES (v_orden_b);
END;
$finance_seed$;
RESET ROLE;

-- A dentist without financial permission cannot read or write order costs,
-- cannot inspect payment balances, and cannot manufacture lab expenses.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_dentist_denied$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_result jsonb;
  v_movimiento uuid;
  v_fallo boolean;
  v_auditoria bigint;
  v_auditoria_antes bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  SELECT orden_id INTO v_orden FROM pg_temp.bp12_finance_fixture;
  IF public.tiene_permiso_laboratorio('ver_costos_laboratorio')
     OR public.tiene_permiso_laboratorio('pagar_laboratorios') THEN
    RAISE EXCEPTION 'Dentist fixture unexpectedly has a financial add-on permission';
  END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 0
     OR (SELECT count(*) FROM public.laboratorio_pagos WHERE orden_id = v_orden) <> 0 THEN
    RAISE EXCEPTION 'Dentist without permission read laboratory costs or payments';
  END IF;
  v_result := public.precio_paciente_orden_laboratorio(v_orden);
  IF (v_result->>'precio_paciente')::integer <> 160000
     OR v_result ? 'costo_total' OR v_result ? 'margen' THEN
    RAISE EXCEPTION 'Dentist patient-price projection leaked the laboratory cost or margin';
  END IF;

  v_fallo := false;
  BEGIN
    PERFORM public.resumen_pagos_laboratorio(v_orden);
  EXCEPTION WHEN insufficient_privilege THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Dentist read payment summary without permission'; END IF;

  v_fallo := false;
  BEGIN
    PERFORM public.guardar_costo_orden_laboratorio(v_orden, 120000, 180000);
  EXCEPTION WHEN insufficient_privilege THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Dentist changed order cost without admin role'; END IF;
  IF (SELECT costo_total FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 100000 THEN
    RAISE EXCEPTION 'Denied cost write left a modified cost';
  END IF;

  INSERT INTO public.movimientos_financieros (
    user_id, clinica_id, fecha, tipo, categoria, monto, metodo_pago, descripcion
  ) VALUES (
    auth.uid(), v_fixture.clinica_a, current_date, 'Egreso', 'Insumos', 900,
    'Transferencia', 'BP12 rollback preserved BP08 movement'
  ) RETURNING id INTO v_movimiento;
  IF (SELECT count(*) FROM public.movimientos_financieros
      WHERE id = v_movimiento AND categoria = 'Insumos') <> 1 THEN
    RAISE EXCEPTION 'Dentist lost access to an unrelated BP08 movement';
  END IF;

  SELECT count(*) INTO v_auditoria FROM public.audit_log
  WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros';
  v_fallo := false;
  BEGIN
    INSERT INTO public.movimientos_financieros (
      user_id, clinica_id, fecha, tipo, categoria, monto, metodo_pago,
      descripcion, orden_laboratorio_id
    ) VALUES (
      auth.uid(), v_fixture.clinica_a, current_date, 'Egreso', 'Laboratorio Dental', 1000,
      'Transferencia', 'BP12 denied direct lab expense', v_orden
    );
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Dentist inserted a laboratory expense directly'; END IF;
  IF (SELECT count(*) FROM public.audit_log
      WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros') <> v_auditoria
     OR (SELECT categoria FROM public.movimientos_financieros WHERE id = v_movimiento) <> 'Insumos'
     OR (SELECT orden_laboratorio_id FROM public.movimientos_financieros WHERE id = v_movimiento) IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected direct lab expense left a movement or audit side effect';
  END IF;

  v_auditoria_antes := v_auditoria;
  v_fallo := false;
  BEGIN
    UPDATE public.movimientos_financieros
    SET categoria = 'Laboratorio Dental', orden_laboratorio_id = v_orden
    WHERE id = v_movimiento;
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Dentist relabeled a general movement as lab expense'; END IF;
  IF (SELECT count(*) FROM public.audit_log
      WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros') <> v_auditoria_antes
     OR (SELECT categoria FROM public.movimientos_financieros WHERE id = v_movimiento) <> 'Insumos'
     OR (SELECT orden_laboratorio_id FROM public.movimientos_financieros WHERE id = v_movimiento) IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected relabel left a movement or audit side effect';
  END IF;
END;
$finance_dentist_denied$;
RESET ROLE;

-- Admin grants only the approved view-cost and pay permissions.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_permissions$
DECLARE
  v_fixture record;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  INSERT INTO public.permisos_laboratorio_aditivos (
    clinica_id, user_id, permiso, asignado_por
  ) VALUES
    (v_fixture.clinica_a, v_fixture.dentista_id, 'ver_costos_laboratorio', auth.uid()),
    (v_fixture.clinica_a, v_fixture.asistente_id, 'pagar_laboratorios', auth.uid());
END;
$finance_permissions$;
RESET ROLE;

-- A dentist with the explicit cost permission may read the restricted cost
-- projection but does not inherit the payer permission.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_dentist_allowed$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_summary jsonb;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  SELECT orden_id INTO v_orden FROM pg_temp.bp12_finance_fixture;
  IF NOT public.tiene_permiso_laboratorio('ver_costos_laboratorio')
     OR public.tiene_permiso_laboratorio('pagar_laboratorios') THEN
    RAISE EXCEPTION 'Dentist financial permissions do not match the granted permission';
  END IF;
  IF (SELECT costo_total FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 100000
     OR (SELECT precio_paciente FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 160000 THEN
    RAISE EXCEPTION 'Cost-authorized dentist could not read the restricted cost projection';
  END IF;
  IF (SELECT count(*) FROM public.laboratorio_pagos WHERE orden_id = v_orden) <> 0 THEN
    RAISE EXCEPTION 'Dentist saw payment rows before a payment was made';
  END IF;
  v_summary := public.resumen_pagos_laboratorio(v_orden);
  IF (v_summary->>'costo_total')::integer <> 100000
     OR (v_summary->>'total_pagado')::integer <> 0
     OR (v_summary->>'saldo')::integer <> 100000 THEN
    RAISE EXCEPTION 'Cost-authorized summary omitted its authorized cost projection';
  END IF;
END;
$finance_dentist_allowed$;
RESET ROLE;

-- Payer can see payments and outstanding balance, but not the cost or patient
-- price. Partial payment, replay, overpayment rejection, and cross-tenant
-- rejection are all checked for atomic side effects.
SELECT set_config('request.jwt.claim.sub', asistente_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', asistente_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_payer$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_orden_b uuid;
  v_result jsonb;
  v_replay jsonb;
  v_summary jsonb;
  v_pago_id uuid;
  v_movimiento_id uuid;
  v_movimientos bigint;
  v_pagos bigint;
  v_audit_movimientos bigint;
  v_audit_pagos bigint;
  v_movimientos_antes bigint;
  v_pagos_antes bigint;
  v_audit_movimientos_antes bigint;
  v_audit_pagos_antes bigint;
  v_fallo boolean;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  SELECT orden_id INTO v_orden FROM pg_temp.bp12_finance_fixture;
  SELECT orden_id INTO v_orden_b FROM pg_temp.bp12_crossclinic_fixture;
  IF NOT public.tiene_permiso_laboratorio('pagar_laboratorios')
     OR public.tiene_permiso_laboratorio('ver_costos_laboratorio') THEN
    RAISE EXCEPTION 'Assistant financial permissions do not match the granted permission';
  END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 0 THEN
    RAISE EXCEPTION 'Payer can directly read order cost or price';
  END IF;
  v_fallo := false;
  BEGIN
    PERFORM public.precio_paciente_orden_laboratorio(v_orden);
  EXCEPTION WHEN insufficient_privilege THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Payer read patient price without an approved permission'; END IF;

  v_result := public.registrar_pago_laboratorio(
    v_orden, 30000, current_date, 'Transferencia',
    'b1200000-0000-4000-8000-000000000010'::uuid
  );
  v_replay := public.registrar_pago_laboratorio(
    v_orden, 30000, current_date, 'Transferencia',
    'b1200000-0000-4000-8000-000000000010'::uuid
  );
  v_pago_id := (v_result->>'id')::uuid;
  v_movimiento_id := (v_result->>'movimiento_id')::uuid;
  IF (v_replay->>'id')::uuid IS DISTINCT FROM v_pago_id
     OR (v_replay->>'movimiento_id')::uuid IS DISTINCT FROM v_movimiento_id THEN
    RAISE EXCEPTION 'Payment idempotency replay created another payment or expense';
  END IF;
  v_summary := public.resumen_pagos_laboratorio(v_orden);
  IF v_summary ? 'costo_total' OR v_summary ? 'precio_paciente' OR v_summary ? 'margen'
     OR (v_summary->>'total_pagado')::integer <> 30000
     OR (v_summary->>'saldo')::integer <> 70000
     OR jsonb_array_length(v_summary->'pagos') <> 1 THEN
    RAISE EXCEPTION 'Payer summary leaked costs or returned an incorrect payment balance';
  END IF;
  IF (SELECT count(*) FROM public.laboratorio_pagos WHERE id = v_pago_id) <> 1
     OR (SELECT count(*) FROM public.movimientos_financieros
         WHERE id = v_movimiento_id AND orden_laboratorio_id = v_orden
           AND tipo = 'Egreso' AND categoria = 'Laboratorio Dental' AND monto = 30000) <> 1 THEN
    RAISE EXCEPTION 'Partial payment and linked BP08 expense were not both persisted';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.dentista_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_a)
  )::text, true);
  IF (SELECT count(*) FROM public.movimientos_financieros WHERE id = v_movimiento_id) <> 1 THEN
    RAISE EXCEPTION 'Cost-authorized dentist could not read the linked BP08 laboratory expense';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.asistente_id,
    'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_a)
  )::text, true);

  v_fallo := false;
  BEGIN
    INSERT INTO public.laboratorio_pagos (
      clinica_id, orden_id, movimiento_id, monto, fecha, metodo_pago,
      idempotency_key, created_by
    ) VALUES (
      v_fixture.clinica_a, v_orden, v_movimiento_id, 1, current_date, 'Transferencia',
      'b1200000-0000-4000-8000-000000000013'::uuid, auth.uid()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Payer inserted a payment row outside the atomic RPC'; END IF;

  SELECT count(*) INTO v_movimientos FROM public.movimientos_financieros
  WHERE user_id = auth.uid() AND orden_laboratorio_id = v_orden;
  SELECT count(*) INTO v_pagos FROM public.laboratorio_pagos
  WHERE created_by = auth.uid() AND orden_id = v_orden;
  SELECT count(*) INTO v_audit_movimientos FROM public.audit_log
  WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros'
    AND record_id = v_movimiento_id::text;
  SELECT count(*) INTO v_audit_pagos FROM public.audit_log
  WHERE user_id = auth.uid() AND table_name = 'laboratorio_pagos'
    AND record_id = v_pago_id::text;
  IF v_movimientos <> 1 OR v_pagos <> 1 OR v_audit_movimientos <> 1 OR v_audit_pagos <> 1 THEN
    RAISE EXCEPTION 'Payment or movement audit was duplicated on idempotent replay';
  END IF;

  SELECT count(*) INTO v_movimientos_antes FROM public.movimientos_financieros
  WHERE user_id = auth.uid() AND orden_laboratorio_id IS NOT NULL;
  SELECT count(*) INTO v_pagos_antes FROM public.laboratorio_pagos
  WHERE created_by = auth.uid();
  SELECT count(*) INTO v_audit_movimientos_antes FROM public.audit_log
  WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros';
  SELECT count(*) INTO v_audit_pagos_antes FROM public.audit_log
  WHERE user_id = auth.uid() AND table_name = 'laboratorio_pagos';
  v_fallo := false;
  BEGIN
    PERFORM public.registrar_pago_laboratorio(
      v_orden, 70001, current_date, 'Transferencia',
      'b1200000-0000-4000-8000-000000000011'::uuid
    );
  EXCEPTION WHEN check_violation THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Overpayment was accepted'; END IF;
  IF (SELECT count(*) FROM public.movimientos_financieros
      WHERE user_id = auth.uid() AND orden_laboratorio_id IS NOT NULL) <> v_movimientos_antes
     OR (SELECT count(*) FROM public.laboratorio_pagos
         WHERE created_by = auth.uid()) <> v_pagos_antes
     OR (SELECT count(*) FROM public.audit_log
         WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros') <> v_audit_movimientos_antes
     OR (SELECT count(*) FROM public.audit_log
         WHERE user_id = auth.uid() AND table_name = 'laboratorio_pagos') <> v_audit_pagos_antes THEN
    RAISE EXCEPTION 'Rejected overpayment left a movement, payment, or audit side effect';
  END IF;

  v_fallo := false;
  BEGIN
    PERFORM public.registrar_pago_laboratorio(
      v_orden_b, 1000, current_date, 'Transferencia',
      'b1200000-0000-4000-8000-000000000012'::uuid
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Cross-clinic order ID was accepted for payment'; END IF;
  IF (SELECT count(*) FROM public.movimientos_financieros
      WHERE user_id = auth.uid() AND orden_laboratorio_id IS NOT NULL) <> v_movimientos_antes
     OR (SELECT count(*) FROM public.laboratorio_pagos
         WHERE created_by = auth.uid()) <> v_pagos_antes
     OR (SELECT count(*) FROM public.audit_log
         WHERE user_id = auth.uid() AND table_name = 'movimientos_financieros') <> v_audit_movimientos_antes
     OR (SELECT count(*) FROM public.audit_log
         WHERE user_id = auth.uid() AND table_name = 'laboratorio_pagos') <> v_audit_pagos_antes THEN
    RAISE EXCEPTION 'Rejected cross-clinic payment left a movement, payment, or audit side effect';
  END IF;
END;
$finance_payer$;
RESET ROLE;

-- Reception does not receive cost, payment, or lab-expense projections.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $finance_reception$
DECLARE
  v_orden uuid;
BEGIN
  SELECT orden_id INTO v_orden FROM pg_temp.bp12_finance_fixture;
  IF (SELECT count(*) FROM public.ordenes_laboratorio_costos WHERE orden_id = v_orden) <> 0
     OR (SELECT count(*) FROM public.laboratorio_pagos WHERE orden_id = v_orden) <> 0
     OR (SELECT count(*) FROM public.movimientos_financieros WHERE orden_laboratorio_id = v_orden) <> 0 THEN
    RAISE EXCEPTION 'Reception read restricted laboratory finance data';
  END IF;
END;
$finance_reception$;
RESET ROLE;

-- Assistant may create, transition, and edit notes, but cannot change clinical
-- references or manufacture history through direct table writes.
SELECT set_config('request.jwt.claim.sub', asistente_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', asistente_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $assistant$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_fallo boolean;
  v_auditoria bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  INSERT INTO public.ordenes_laboratorio (
    clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
  ) VALUES (
    v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_a, v_fixture.tipo_a
  ) RETURNING id INTO v_orden;
  PERFORM public.transicionar_orden_laboratorio(
    v_orden, 'fabricacion', 'Etapa por asistente', 'b1200000-0000-4000-8000-000000000004'::uuid, 1
  );
  UPDATE public.ordenes_laboratorio SET observaciones = 'Nota de asistente'
  WHERE id = v_orden;
  IF (SELECT observaciones FROM public.ordenes_laboratorio WHERE id = v_orden) <> 'Nota de asistente'
     OR NOT EXISTS (
       SELECT 1 FROM public.historial_etapas_laboratorio
       WHERE orden_id = v_orden AND actor_id = auth.uid() AND notas = 'Etapa por asistente'
     ) THEN
    RAISE EXCEPTION 'Assistant note or stage note was not saved';
  END IF;

  SELECT count(*) INTO v_auditoria FROM public.audit_log
  WHERE table_name = 'ordenes_laboratorio' AND record_id = v_orden::text;
  v_fallo := false;
  BEGIN
    UPDATE public.ordenes_laboratorio SET tipo_trabajo_id = v_fixture.tipo_b WHERE id = v_orden;
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Assistant changed the work type outside the role matrix'; END IF;
  IF (SELECT tipo_trabajo_id FROM public.ordenes_laboratorio WHERE id = v_orden) <> v_fixture.tipo_a
     OR (SELECT count(*) FROM public.audit_log
         WHERE table_name = 'ordenes_laboratorio' AND record_id = v_orden::text) <> v_auditoria THEN
    RAISE EXCEPTION 'Rejected assistant edit left an order or audit side effect';
  END IF;

  v_fallo := false;
  BEGIN
    UPDATE public.ordenes_laboratorio SET paciente_id = gen_random_uuid() WHERE id = v_orden;
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Assistant changed a protected patient reference'; END IF;
  v_fallo := false;
  BEGIN
    UPDATE public.historial_etapas_laboratorio SET notas = 'history tamper'
    WHERE orden_id = v_orden;
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Stage history is not append-only'; END IF;
END;
$assistant$;
RESET ROLE;

-- Reception may create a restricted request and cannot edit it afterward.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp12_test_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $reception$
DECLARE
  v_fixture record;
  v_orden uuid;
  v_limitada boolean;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  INSERT INTO public.ordenes_laboratorio (
    clinica_id, paciente_id, tipo_trabajo_id
  ) VALUES (v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.tipo_a)
  RETURNING id, solicitud_limitada INTO v_orden, v_limitada;
  IF NOT v_limitada THEN RAISE EXCEPTION 'Reception request was not marked as limited'; END IF;
  UPDATE public.ordenes_laboratorio SET observaciones = 'No permitido' WHERE id = v_orden;
  IF FOUND THEN RAISE EXCEPTION 'Reception edited an order after request creation'; END IF;
  IF (SELECT observaciones FROM public.ordenes_laboratorio WHERE id = v_orden) IS NOT NULL THEN
    RAISE EXCEPTION 'Reception update changed the order without a visible UPDATE row';
  END IF;
END;
$reception$;
RESET ROLE;

-- Missing membership fails closed for reads and writes.
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', current_setting('request.jwt.claim.sub', true),
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_test_fixture;
SET LOCAL ROLE authenticated;
DO $no_membership$
DECLARE
  v_fixture record;
  v_fallo boolean := false;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_test_fixture;
  IF public.clinica_actual() IS NOT NULL THEN
    RAISE EXCEPTION 'User without membership resolved an active clinic';
  END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio WHERE clinica_id = v_fixture.clinica_a) <> 0 THEN
    RAISE EXCEPTION 'User without membership read clinic orders';
  END IF;
  BEGIN
    INSERT INTO public.ordenes_laboratorio (
      clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
    ) VALUES (v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_a, v_fixture.tipo_a);
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'User without membership created an order'; END IF;
END;
$no_membership$;
RESET ROLE;

ROLLBACK;
