-- BP15 security, cash atomicity, and tenant-boundary coverage.
-- Run only against an isolated local Supabase database; all fixtures roll back.
BEGIN;

CREATE TEMP TABLE bp15_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  dentist_id uuid NOT NULL,
  assistant_id uuid NOT NULL,
  reception_id uuid NOT NULL,
  no_member_id uuid NOT NULL,
  session_b_id uuid NOT NULL,
  pago_b_id uuid NOT NULL,
  account_a_id uuid NOT NULL,
  account_b_id uuid NOT NULL,
  expense_a_id uuid NOT NULL,
  bonus_a_id uuid NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE bp15_cash_session_result (session_id uuid NOT NULL) ON COMMIT DROP;

DO $setup$
DECLARE
  v_clinica_a uuid;
  v_clinica_b uuid;
  v_admin uuid := gen_random_uuid();
  v_dentist uuid := gen_random_uuid();
  v_assistant uuid := gen_random_uuid();
  v_reception uuid := gen_random_uuid();
  v_no_member uuid := gen_random_uuid();
  v_session_b uuid := gen_random_uuid();
  v_pago_b uuid := gen_random_uuid();
  v_account_a uuid := gen_random_uuid();
  v_account_b uuid := gen_random_uuid();
  v_expense_a uuid := gen_random_uuid();
  v_bonus_a uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
    (v_admin, 'authenticated', 'authenticated', 'bp15-admin-' || v_admin::text || '@example.invalid', '', clock_timestamp(),
      '{}'::jsonb, '{"role":"admin","full_name":"BP15 test admin"}'::jsonb, clock_timestamp(), clock_timestamp()),
    (v_dentist, 'authenticated', 'authenticated', 'bp15-dentist-' || v_dentist::text || '@example.invalid', '', clock_timestamp(),
      '{}'::jsonb, '{"role":"dentista","full_name":"BP15 test dentist"}'::jsonb, clock_timestamp(), clock_timestamp()),
    (v_assistant, 'authenticated', 'authenticated', 'bp15-assistant-' || v_assistant::text || '@example.invalid', '', clock_timestamp(),
      '{}'::jsonb, '{"role":"asistente","full_name":"BP15 test assistant"}'::jsonb, clock_timestamp(), clock_timestamp()),
    (v_reception, 'authenticated', 'authenticated', 'bp15-reception-' || v_reception::text || '@example.invalid', '', clock_timestamp(),
      '{}'::jsonb, '{"role":"recepcion","full_name":"BP15 test reception"}'::jsonb, clock_timestamp(), clock_timestamp()),
    (v_no_member, 'authenticated', 'authenticated', 'bp15-no-member-' || v_no_member::text || '@example.invalid', '', clock_timestamp(),
      '{}'::jsonb, '{"role":"recepcion","full_name":"BP15 test no membership"}'::jsonb, clock_timestamp(), clock_timestamp());

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP15 Clinic A rollback test ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_a;

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP15 rollback test ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_b;

  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES
    (v_clinica_a, v_admin, 'admin', true),
    (v_clinica_a, v_dentist, 'dentista', true),
    (v_clinica_a, v_assistant, 'asistente', true),
    (v_clinica_a, v_reception, 'recepcion', true),
    (v_clinica_b, v_admin, 'admin', true);

  INSERT INTO public.bp15_caja_sesiones (
    id, clinica_id, moneda, estado, monto_apertura_minor, abierta_por, idempotency_key
  ) VALUES (
    v_session_b, v_clinica_b, 'CLP', 'abierta', 0, v_admin, gen_random_uuid()
  );

  INSERT INTO public.pagos (
    id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
    clinica_id, presupuesto_id, referencia, moneda
  ) VALUES (
    v_pago_b, v_admin, NULL, 'BP15-B-' || v_pago_b::text, 10000, 'transferencia', current_date,
    'BP15 rollback cross-tenant source', v_clinica_b, NULL, NULL, 'CLP'
  );

  INSERT INTO public.bp15_cuentas_bancarias (
    id, clinica_id, alias, entidad, ultimos_cuatro, moneda, created_by, updated_by
  ) VALUES
    (v_account_a, v_clinica_a, 'BP15 test A', 'Banco A', '1001', 'CLP', v_admin, v_admin),
    (v_account_b, v_clinica_b, 'BP15 test B', 'Banco B', '2002', 'CLP', v_admin, v_admin);

  INSERT INTO public.bp15_parametros_proyeccion (
    clinica_id, moneda, escenario, tasa_cobranza_bps, horizonte_dias, created_by, updated_by
  ) VALUES (
    v_clinica_a, 'CLP', 'realista', 8000, 90, v_admin, v_admin
  );

  INSERT INTO public.bp15_gastos (
    id, clinica_id, fecha_emision, categoria, proveedor_nombre, proveedor_rut,
    descripcion, moneda, neto_minor, iva_minor, exento_minor, total_minor,
    estado, created_by, updated_by, idempotency_key
  ) VALUES (
    v_expense_a, v_clinica_a, current_date, 'insumos', 'BP15 test', '11.111.111-1',
    'Gasto de prueba', 'CLP', 10000, 1900, 0, 11900,
    'pendiente', v_admin, v_admin, gen_random_uuid()
  );

  INSERT INTO public.bp15_gasto_documentos (
    clinica_id, gasto_id, r2_key, mime_type, bytes, sha256, created_by
  ) VALUES (
    v_clinica_a, v_expense_a,
    v_clinica_a::text || '/' || v_expense_a::text || '/55555555-5555-4555-8555-555555555555.pdf',
    'application/pdf', 100, repeat('a', 64), v_admin
  );

  INSERT INTO public.bp15_bonos (
    id, clinica_id, numero_bono, prevision, moneda, monto_total_minor,
    aporte_minor, copago_minor, estado, created_by, updated_by, idempotency_key
  ) VALUES (
    v_bonus_a, v_clinica_a, 'BP15-TEST-' || gen_random_uuid()::text, 'FONASA', 'CLP',
    100000, 80000, 20000, 'pendiente', v_admin, v_admin, gen_random_uuid()
  );

  INSERT INTO pg_temp.bp15_fixture
  VALUES (v_clinica_a, v_clinica_b, v_admin, v_dentist, v_assistant,
          v_reception, v_no_member, v_session_b, v_pago_b,
          v_account_a, v_account_b, v_expense_a, v_bonus_a);
END;
$setup$;

GRANT SELECT ON pg_temp.bp15_fixture TO authenticated;
GRANT SELECT, INSERT ON pg_temp.bp15_cash_session_result TO authenticated;

-- Admin can open a session idempotently and receives its cash movements.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true) FROM pg_temp.bp15_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp15_fixture;
SET LOCAL ROLE authenticated;

DO $admin_cash$
DECLARE
  v_fixture record;
  v_open_key uuid := gen_random_uuid();
  v_close_key uuid := gen_random_uuid();
  v_session uuid;
  v_idempotent uuid;
  v_pago uuid := gen_random_uuid();
  v_close jsonb;
  v_close_replay jsonb;
  v_rejected boolean := false;
  v_count bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  IF public.clinica_actual() IS DISTINCT FROM v_fixture.clinica_a THEN
    RAISE EXCEPTION 'Admin did not resolve to Clinic A';
  END IF;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones WHERE id = v_fixture.session_b_id) <> 0 THEN
    RAISE EXCEPTION 'Admin in Clinic A read another clinic cash session';
  END IF;
  IF (SELECT count(*) FROM public.bp15_cuentas_bancarias WHERE id = v_fixture.account_a_id) <> 1
    OR (SELECT count(*) FROM public.bp15_gastos WHERE id = v_fixture.expense_a_id) <> 1
    OR (SELECT count(*) FROM public.bp15_bonos WHERE id = v_fixture.bonus_a_id) <> 1
    OR (SELECT count(*) FROM public.bp15_gasto_documentos WHERE gasto_id = v_fixture.expense_a_id) <> 1 THEN
    RAISE EXCEPTION 'Admin cannot read BP15 data in its own clinic';
  END IF;

  UPDATE public.bp15_cuentas_bancarias SET alias = 'BP15 test A actualizado'
    WHERE id = v_fixture.account_a_id;
  UPDATE public.bp15_parametros_proyeccion SET horizonte_dias = 120
    WHERE clinica_id = v_fixture.clinica_a AND moneda = 'CLP' AND escenario = 'realista';
  IF (SELECT alias FROM public.bp15_cuentas_bancarias WHERE id = v_fixture.account_a_id)
       IS DISTINCT FROM 'BP15 test A actualizado'
    OR (SELECT horizonte_dias FROM public.bp15_parametros_proyeccion
        WHERE clinica_id = v_fixture.clinica_a AND moneda = 'CLP' AND escenario = 'realista') <> 120 THEN
    RAISE EXCEPTION 'Admin account/projection updates failed';
  END IF;

  v_session := public.bp15_abrir_caja('CLP', 0, v_open_key);
  v_idempotent := public.bp15_abrir_caja('CLP', 0, v_open_key);
  IF v_session IS DISTINCT FROM v_idempotent THEN
    RAISE EXCEPTION 'Opening the same session idempotency key created another session';
  END IF;

  INSERT INTO public.pagos (
    id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
    clinica_id, presupuesto_id, referencia, moneda
  ) VALUES (
    v_pago, auth.uid(), NULL, 'BP15-' || v_pago::text, 10000, 'Efectivo', current_date,
    'BP15 rollback cash test', v_fixture.clinica_a, NULL, NULL, 'CLP'
  );

  SELECT count(*) INTO v_count
  FROM public.bp15_caja_movimientos
  WHERE clinica_id = v_fixture.clinica_a AND caja_sesion_id = v_session
    AND origen_tipo = 'pago' AND pago_id = v_pago AND monto_minor = 1000000;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Cash payment did not create exactly one cash movement'; END IF;
  IF (SELECT caja_sesion_id FROM public.pagos WHERE id = v_pago) IS DISTINCT FROM v_session THEN
    RAISE EXCEPTION 'Cash payment was not linked to the server-selected session';
  END IF;
  IF (SELECT count(*) FROM public.audit_log
      WHERE clinica_id = v_fixture.clinica_a
        AND table_name = 'bp15_caja_movimientos'
        AND record_id = (SELECT id::text FROM public.bp15_caja_movimientos WHERE pago_id = v_pago)
        AND action = 'INSERT' AND user_id = auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'Cash movement was not recorded in the tenant-scoped audit log';
  END IF;
  INSERT INTO pg_temp.bp15_cash_session_result VALUES (v_session);

  -- Updating an existing electronic payment must not retroactively post it into today's cash drawer.
  v_pago := gen_random_uuid();
  INSERT INTO public.pagos (
    id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
    clinica_id, presupuesto_id, referencia, moneda
  ) VALUES (
    v_pago, auth.uid(), NULL, 'BP15-' || v_pago::text, 100, 'transferencia', current_date,
    'BP15 rollback historical payment test', v_fixture.clinica_a, NULL, NULL, 'CLP'
  );
  v_rejected := false;
  BEGIN
    UPDATE public.pagos SET metodo_pago = 'efectivo' WHERE id = v_pago;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Updating an existing electronic payment retroactively entered cash';
  END IF;
  IF (SELECT caja_sesion_id FROM public.pagos WHERE id = v_pago) IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.bp15_caja_movimientos WHERE pago_id = v_pago) THEN
    RAISE EXCEPTION 'Rejected payment update left BP15 cash side effects';
  END IF;

  v_pago := gen_random_uuid();
  v_rejected := false;
  BEGIN
    INSERT INTO public.pagos (
      id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
      clinica_id, presupuesto_id, referencia, moneda
    ) VALUES (
      v_pago, auth.uid(), NULL, 'BP15-' || v_pago::text, 100, 'efectivo', current_date,
      'BP15 rollback currency mismatch', v_fixture.clinica_a, NULL, NULL, 'USD'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Cash payment used a session in a different currency'; END IF;
  SELECT count(*) INTO v_count FROM public.pagos WHERE id = v_pago;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Rejected currency mismatch left a payment behind'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.bp15_cerrar_caja(
      v_session, '[{"valorMinor":1,"cantidad":1}]'::jsonb, NULL, gen_random_uuid()
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'A closure with variance above $5,000 and no reason was accepted'; END IF;
  IF (SELECT estado FROM public.bp15_caja_sesiones WHERE id = v_session) <> 'abierta'
    OR (SELECT count(*) FROM public.bp15_caja_eventos
        WHERE clinica_id = v_fixture.clinica_a AND caja_sesion_id = v_session AND tipo = 'cierre') <> 0 THEN
    RAISE EXCEPTION 'Rejected cash close left session/event side effects';
  END IF;

  v_close := public.bp15_cerrar_caja(
    v_session,
    '[{"valorMinor":1000000,"cantidad":1}]'::jsonb,
    NULL,
    v_close_key
  );
  v_close_replay := public.bp15_cerrar_caja(
    v_session,
    '[{"valorMinor":1000000,"cantidad":1}]'::jsonb,
    NULL,
    v_close_key
  );
  IF v_close IS DISTINCT FROM v_close_replay THEN RAISE EXCEPTION 'Closing with the same key was not idempotent'; END IF;
  SELECT count(*) INTO v_count FROM public.bp15_caja_eventos
  WHERE clinica_id = v_fixture.clinica_a AND caja_sesion_id = v_session AND tipo = 'cierre';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Idempotent close duplicated its event'; END IF;

  -- No session is open now. A failed cash payment must leave zero rows behind.
  v_pago := gen_random_uuid();
  BEGIN
    INSERT INTO public.pagos (
      id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
      clinica_id, presupuesto_id, referencia, moneda
    ) VALUES (
      v_pago, auth.uid(), NULL, 'BP15-' || v_pago::text, 100, 'efectivo', current_date,
      'BP15 rollback no-session test', v_fixture.clinica_a, NULL, NULL, 'CLP'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Cash payment without an open session was accepted'; END IF;
  SELECT count(*) INTO v_count FROM public.pagos WHERE id = v_pago;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Rejected cash payment left a source row behind'; END IF;

  -- Electronic payments keep their current BP07 path and do not enter cash.
  v_pago := gen_random_uuid();
  INSERT INTO public.pagos (
    id, user_id, paciente_id, folio, monto, metodo_pago, fecha, concepto,
    clinica_id, presupuesto_id, referencia, moneda
  ) VALUES (
    v_pago, auth.uid(), NULL, 'BP15-' || v_pago::text, 100, 'transferencia', current_date,
    'BP15 rollback transfer test', v_fixture.clinica_a, NULL, NULL, 'CLP'
  );
  IF (SELECT caja_sesion_id FROM public.pagos WHERE id = v_pago) IS NOT NULL THEN
    RAISE EXCEPTION 'Electronic payment was incorrectly linked to a cash session';
  END IF;
END;
$admin_cash$;

-- Reception may use the cash drawer, but cannot inspect administrative data.
SELECT set_config('request.jwt.claim.sub', reception_id::text, true) FROM pg_temp.bp15_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', reception_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp15_fixture;
DO $reception$
DECLARE
  v_fixture record;
  v_count bigint;
  v_rejected boolean := false;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones WHERE clinica_id = v_fixture.clinica_a) <> 1 THEN
    RAISE EXCEPTION 'Reception cannot read the open/closed cash sessions for its clinic';
  END IF;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones WHERE id = v_fixture.session_b_id) <> 0 THEN
    RAISE EXCEPTION 'Reception read another clinic cash session';
  END IF;
  IF (SELECT count(*) FROM public.bp15_cuentas_bancarias) <> 0
     OR (SELECT count(*) FROM public.bp15_gastos) <> 0
     OR (SELECT count(*) FROM public.bp15_bonos) <> 0
     OR (SELECT count(*) FROM public.bp15_gasto_documentos) <> 0 THEN
    RAISE EXCEPTION 'Reception read bank, expense, bonus, or document metadata';
  END IF;
  SELECT count(*) INTO v_count FROM public.bp15_caja_movimientos WHERE clinica_id = v_fixture.clinica_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Reception cannot read its own cash movement'; END IF;

  BEGIN
    INSERT INTO public.bp15_gastos (
      clinica_id, fecha_emision, categoria, proveedor_nombre, descripcion, moneda,
      neto_minor, iva_minor, exento_minor, total_minor, estado, created_by, idempotency_key
    ) VALUES (
      v_fixture.clinica_a, current_date, 'insumos', 'No permitido', 'No debe persistir', 'CLP',
      100, 19, 0, 119, 'pendiente', auth.uid(), gen_random_uuid()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Reception unexpectedly inserted an administrative expense'; END IF;
END;
$reception$;

-- Dentist and assistant keep BP07 permissions, but have no BP15 financial reads.
SELECT set_config('request.jwt.claim.sub', dentist_id::text, true) FROM pg_temp.bp15_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentist_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp15_fixture;
DO $dentist$
DECLARE
  v_fixture record;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones WHERE clinica_id = v_fixture.clinica_a) <> 0
     OR (SELECT count(*) FROM public.bp15_caja_movimientos WHERE clinica_id = v_fixture.clinica_a) <> 0 THEN
    RAISE EXCEPTION 'Dentist can read BP15 cash amounts';
  END IF;
END;
$dentist$;

SELECT set_config('request.jwt.claim.sub', assistant_id::text, true) FROM pg_temp.bp15_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', assistant_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp15_fixture;
DO $assistant$
DECLARE
  v_fixture record;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones WHERE clinica_id = v_fixture.clinica_a) <> 0
     OR (SELECT count(*) FROM public.bp15_caja_movimientos WHERE clinica_id = v_fixture.clinica_a) <> 0 THEN
    RAISE EXCEPTION 'Assistant can read BP15 cash amounts';
  END IF;
END;
$assistant$;

-- Membership and active-clinic selection fail closed.
SELECT set_config('request.jwt.claim.sub', no_member_id::text, true) FROM pg_temp.bp15_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', no_member_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp15_fixture;
DO $no_membership$
DECLARE
  v_fixture record;
  v_rejected boolean := false;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  IF public.clinica_actual() IS NOT NULL THEN RAISE EXCEPTION 'A user without membership resolved a clinic'; END IF;
  IF (SELECT count(*) FROM public.bp15_caja_sesiones) <> 0 THEN RAISE EXCEPTION 'A user without membership read a cash session'; END IF;
  BEGIN
    PERFORM public.bp15_abrir_caja('CLP', 0, gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'A user without membership opened a cash session'; END IF;
END;
$no_membership$;

RESET ROLE;

-- Composite foreign keys reject an otherwise valid source from Clinic B.
DO $cross_clinic_fk$
DECLARE
  v_fixture record;
  v_session uuid;
  v_rejected boolean := false;
  v_count bigint;
  v_movement uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp15_fixture;
  SELECT session_id INTO v_session FROM pg_temp.bp15_cash_session_result;
  BEGIN
    INSERT INTO public.bp15_caja_movimientos (
      clinica_id, caja_sesion_id, tipo, monto_minor, moneda, origen_tipo,
      pago_id, actor_id, idempotency_key
    ) VALUES (
      v_fixture.clinica_a, v_session, 'ingreso', 1000000, 'CLP', 'pago',
      v_fixture.pago_b_id, v_fixture.admin_id, v_movement
    );
  EXCEPTION WHEN foreign_key_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'A Clinic A movement linked a Clinic B payment'; END IF;
  SELECT count(*) INTO v_count FROM public.bp15_caja_movimientos WHERE id = v_movement;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Rejected cross-clinic link left a movement behind'; END IF;
END;
$cross_clinic_fk$;

ROLLBACK;
