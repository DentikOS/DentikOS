-- BP14 tenant and role coverage. Run with `supabase test db` after migrations.
-- Hosted execution is wrapped in BEGIN/ROLLBACK and uses synthetic fixtures only.
BEGIN;

DO $schema$
BEGIN
  IF to_regclass('public.urgencias_ges_ingresos') IS NULL
     OR to_regclass('public.urgencias_ges_triage') IS NULL
     OR to_regclass('public.urgencias_ges') IS NULL
     OR to_regclass('public.urgencias_ges_eventos') IS NULL THEN
    RAISE EXCEPTION 'BP14 core tables are not installed';
  END IF;
END;
$schema$;

CREATE TEMP TABLE bp14_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  dentista_id uuid NOT NULL,
  asistente_id uuid NOT NULL,
  recepcion_id uuid NOT NULL,
  paciente_a uuid NOT NULL,
  paciente_b uuid NOT NULL,
  ingreso_a uuid NOT NULL,
  ingreso_b uuid NOT NULL,
  ingreso_cruzado uuid NOT NULL,
  usuario_sin_membresia uuid NOT NULL,
  patologia_id text NOT NULL
) ON COMMIT DROP;

DO $setup$
DECLARE
  v_clinica_a uuid;
  v_admin uuid;
  v_dentista uuid;
  v_asistente uuid;
  v_recepcion uuid;
  v_clinica_b uuid := gen_random_uuid();
  v_paciente_a uuid := gen_random_uuid();
  v_paciente_b uuid := gen_random_uuid();
  v_ingreso_a uuid := gen_random_uuid();
  v_ingreso_b uuid := gen_random_uuid();
  v_ingreso_cruzado uuid := gen_random_uuid();
  v_usuario_sin_membresia uuid := gen_random_uuid();
  v_patologia text;
BEGIN
  SELECT mc.clinica_id,
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol = 'admin'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol = 'dentista'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol = 'asistente'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol = 'recepcion'))[1]
    INTO v_clinica_a, v_admin, v_dentista, v_asistente, v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.activo
  GROUP BY mc.clinica_id
  HAVING count(*) FILTER (WHERE mc.rol = 'admin') > 0
     AND count(*) FILTER (WHERE mc.rol = 'dentista') > 0
     AND count(*) FILTER (WHERE mc.rol = 'asistente') > 0
     AND count(*) FILTER (WHERE mc.rol = 'recepcion') > 0
  ORDER BY mc.clinica_id
  LIMIT 1;

  IF v_clinica_a IS NULL THEN
    RAISE EXCEPTION 'BP14 fixture needs an active clinic with admin, dentist, assistant, and reception';
  END IF;

  INSERT INTO public.clinicas (id, nombre)
  VALUES (v_clinica_b, 'BP14 rollback fixture');
  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES (v_clinica_b, v_admin, 'admin', true);

  INSERT INTO public.pacientes (id, clinica_id, user_id, nombre, rut)
  VALUES
    (v_paciente_a, v_clinica_a, v_admin, 'BP14 fixture A', 'BP14-' || replace(gen_random_uuid()::text, '-', '')),
    (v_paciente_b, v_clinica_b, v_admin, 'BP14 fixture B', 'BP14-' || replace(gen_random_uuid()::text, '-', ''));

  SELECT id INTO v_patologia
  FROM public.urgencias_ges_patologias
  WHERE id = 'pulpitis';
  IF v_patologia IS NULL THEN
    RAISE EXCEPTION 'BP14 catalog seed missing pulpitis';
  END IF;

  INSERT INTO pg_temp.bp14_fixture
  VALUES (v_clinica_a, v_clinica_b, v_admin, v_dentista, v_asistente,
          v_recepcion, v_paciente_a, v_paciente_b, v_ingreso_a,
          v_ingreso_b, v_ingreso_cruzado, v_usuario_sin_membresia, v_patologia);
END;
$setup$;

GRANT SELECT ON pg_temp.bp14_fixture TO authenticated;

-- Reception may create/read only the minimum arrival queue.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $reception$
DECLARE
  f record;
  v_count integer;
  v_denied boolean;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  INSERT INTO public.urgencias_ges_ingresos (id, clinica_id, paciente_id)
  VALUES (f.ingreso_a, f.clinica_a, f.paciente_a);

  SELECT count(*) INTO v_count FROM public.urgencias_ges_ingresos WHERE id = f.ingreso_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Reception cannot read its clinic arrival'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.urgencias_ges_triage (id, clinica_id, severidad)
    VALUES (f.ingreso_a, f.clinica_a, 'moderada');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Reception unexpectedly created triage'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.urgencias_ges (id, clinica_id, patologia_id, diagnostico_clinico)
    VALUES (f.ingreso_a, f.clinica_a, f.patologia_id, 'Reception must not create clinical data');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Reception unexpectedly created a case'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.timeline_paciente (
      id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
    ) VALUES (
      gen_random_uuid(), f.clinica_a, f.paciente_a, f.recepcion_id, 'urgencia_ges',
      clock_timestamp(), 'Reception GES timeline must be denied', '{}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Reception unexpectedly inserted a GES timeline event'; END IF;
END;
$reception$;
RESET ROLE;
DO $reception_no_side_effects$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  IF EXISTS (SELECT 1 FROM public.urgencias_ges_triage WHERE id = f.ingreso_a)
     OR EXISTS (SELECT 1 FROM public.urgencias_ges WHERE id = f.ingreso_a) THEN
    RAISE EXCEPTION 'Denied reception clinical writes left rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente
    WHERE clinica_id = f.clinica_a AND titulo = 'Reception GES timeline must be denied') THEN
    RAISE EXCEPTION 'Denied reception timeline insert left a row';
  END IF;
  IF (SELECT count(*) FROM public.urgencias_ges_eventos WHERE ingreso_id = f.ingreso_a) <> 1 THEN
    RAISE EXCEPTION 'Denied reception clinical writes created audit events';
  END IF;
END;
$reception_no_side_effects$;

-- Assistant can record triage but cannot query a clinical case or audit payload.
SELECT set_config('request.jwt.claim.sub', asistente_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', asistente_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $assistant$
DECLARE
  f record;
  v_count integer;
  v_denied boolean;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  INSERT INTO public.urgencias_ges_triage (
    id, clinica_id, severidad, presion_sistolica, presion_diastolica,
    frecuencia_cardiaca, saturacion_oxigeno, temperatura_c, eva
  ) VALUES (f.ingreso_a, f.clinica_a, 'moderada', 120, 80, 72, 98, 36.8, 4);

  SELECT count(*) INTO v_count FROM public.urgencias_ges_triage WHERE id = f.ingreso_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Assistant cannot read its triage row'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.urgencias_ges (id, clinica_id, patologia_id, diagnostico_clinico)
    VALUES (f.ingreso_a, f.clinica_a, f.patologia_id, 'Assistant must not create full case');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Assistant unexpectedly created a clinical case'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.timeline_paciente (
      id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
    ) VALUES (
      gen_random_uuid(), f.clinica_a, f.paciente_a, f.asistente_id, 'urgencia_ges',
      clock_timestamp(), 'Assistant GES timeline must be denied', '{}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Assistant unexpectedly inserted a GES timeline event'; END IF;
END;
$assistant$;
RESET ROLE;
DO $assistant_no_side_effects$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  IF EXISTS (SELECT 1 FROM public.urgencias_ges WHERE id = f.ingreso_a) THEN
    RAISE EXCEPTION 'Denied assistant case creation left a row';
  END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente
    WHERE clinica_id = f.clinica_a AND titulo = 'Assistant GES timeline must be denied') THEN
    RAISE EXCEPTION 'Denied assistant timeline insert left a row';
  END IF;
  IF (SELECT count(*) FROM public.urgencias_ges_eventos WHERE ingreso_id = f.ingreso_a) <> 2 THEN
    RAISE EXCEPTION 'Denied assistant case creation created an audit event';
  END IF;
END;
$assistant_no_side_effects$;

-- Dentist can see the triage, create and close a case; closed case is immutable.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $dentist$
DECLARE
  f record;
  v_count integer;
  v_events_before integer;
  v_rows_changed integer;
  v_timeline_cruzado uuid := gen_random_uuid();
  v_denied boolean := false;
  v_failed_stale boolean := false;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  SELECT count(*) INTO v_count FROM public.urgencias_ges_triage WHERE id = f.ingreso_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Dentist cannot read assistant triage'; END IF;

  INSERT INTO public.urgencias_ges (id, clinica_id, patologia_id, diagnostico_clinico)
  VALUES (f.ingreso_a, f.clinica_a, f.patologia_id, 'BP14 synthetic test diagnosis');
  SELECT count(*) INTO v_count FROM public.urgencias_ges WHERE id = f.ingreso_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Dentist cannot read its clinical case'; END IF;

  INSERT INTO public.timeline_paciente (
    id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
  ) VALUES (
    f.ingreso_a, f.clinica_a, f.paciente_a, f.dentista_id, 'urgencia_ges',
    clock_timestamp(), 'Atención GES de prueba', jsonb_build_object('urgencia_id', f.ingreso_a)
  );
  SELECT count(*) INTO v_count FROM public.timeline_paciente
  WHERE id = f.ingreso_a AND tipo = 'urgencia_ges';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Dentist cannot read its BP14 timeline entry'; END IF;

  BEGIN
    INSERT INTO public.timeline_paciente (
      id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
    ) VALUES (
      v_timeline_cruzado, f.clinica_a, f.paciente_b, f.dentista_id, 'urgencia_ges',
      clock_timestamp(), 'Cross-clinic GES timeline must be denied',
      jsonb_build_object('urgencia_id', f.ingreso_a)
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Dentist linked a Clinic B patient to a Clinic A GES timeline'; END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente WHERE id = v_timeline_cruzado) THEN
    RAISE EXCEPTION 'Rejected cross-clinic GES timeline insert left a row';
  END IF;

  UPDATE public.urgencias_ges
  SET diagnostico_clinico = 'BP14 corrected before close', version = version + 1
  WHERE id = f.ingreso_a;
  BEGIN
    UPDATE public.urgencias_ges
    SET diagnostico_clinico = 'stale update', version = version + 2
    WHERE id = f.ingreso_a;
  EXCEPTION WHEN serialization_failure THEN v_failed_stale := true;
  END;
  IF NOT v_failed_stale THEN RAISE EXCEPTION 'Stale case update was not rejected'; END IF;

  UPDATE public.urgencias_ges SET estado = 'cerrada', version = version + 1 WHERE id = f.ingreso_a;
  SELECT count(*) INTO v_events_before FROM public.urgencias_ges_eventos WHERE ingreso_id = f.ingreso_a;
  UPDATE public.urgencias_ges
  SET diagnostico_clinico = 'tampered after close', version = version + 1
  WHERE id = f.ingreso_a;
  GET DIAGNOSTICS v_rows_changed = ROW_COUNT;
  IF v_rows_changed <> 0 THEN RAISE EXCEPTION 'Closed clinical case accepted an update'; END IF;
  IF (SELECT count(*) FROM public.urgencias_ges_eventos WHERE ingreso_id = f.ingreso_a) <> v_events_before THEN
    RAISE EXCEPTION 'Rejected post-close update generated an audit event';
  END IF;

  INSERT INTO public.urgencias_ges_enmiendas (clinica_id, ingreso_id, motivo, detalle)
  VALUES (f.clinica_a, f.ingreso_a, 'Corrección de dato clínico documentado', '{"campo":"diagnostico_clinico"}'::jsonb);
  SELECT count(*) INTO v_count
  FROM public.urgencias_ges_eventos
  WHERE ingreso_id = f.ingreso_a
    AND evento_tipo = 'enmienda_agregada'
    AND actor_user_id = f.dentista_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Enmienda audit event is not linked to the corrected case'; END IF;

  BEGIN
    INSERT INTO public.urgencias_ges_eventos (
      clinica_id, ingreso_id, actor_user_id, evento_tipo, datos
    ) VALUES (f.clinica_a, f.ingreso_a, f.dentista_id, 'ficha_cerrada', '{}'::jsonb);
    RAISE EXCEPTION 'Dentist unexpectedly inserted a forged audit event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.urgencias_ges_eventos SET datos = '{}'::jsonb WHERE ingreso_id = f.ingreso_a;
    RAISE EXCEPTION 'Dentist unexpectedly changed an audit event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.urgencias_ges_eventos WHERE ingreso_id = f.ingreso_a;
    RAISE EXCEPTION 'Dentist unexpectedly deleted audit events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT count(*) INTO v_count
  FROM public.urgencias_ges_eventos
  WHERE ingreso_id = f.ingreso_a AND actor_user_id = f.dentista_id;
  IF v_count < 4 THEN RAISE EXCEPTION 'Case and queue events do not retain the authenticated actor'; END IF;
END;
$dentist$;
RESET ROLE;

-- A timeline row cannot point at a patient from another clinic even when the row's clinic is active.
DO $timeline_cross_tenant_fixture$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  INSERT INTO public.timeline_paciente (
    id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
  ) VALUES (
    gen_random_uuid(), f.clinica_a, f.paciente_b, f.dentista_id, 'urgencia_ges',
    clock_timestamp(), 'Cross-clinic BP14 fixture', jsonb_build_object('urgencia_id', f.ingreso_a)
  );
END;
$timeline_cross_tenant_fixture$;
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $timeline_cross_tenant_read$
DECLARE
  f record;
  v_count integer;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  SELECT count(*) INTO v_count FROM public.timeline_paciente
  WHERE clinica_id = f.clinica_a AND paciente_id = f.paciente_b AND tipo = 'urgencia_ges';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Clinic A read a BP14 timeline row linked to a Clinic B patient'; END IF;
END;
$timeline_cross_tenant_read$;
RESET ROLE;

-- Admin creates an arrival in Clinic B. Clinic A cannot read it or attach its patient.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_b)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $admin_b$
DECLARE
  f record;
  v_timeline_id uuid := gen_random_uuid();
  v_count integer;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  INSERT INTO public.urgencias_ges_ingresos (id, clinica_id, paciente_id)
  VALUES (f.ingreso_b, f.clinica_b, f.paciente_b);

  INSERT INTO public.timeline_paciente (
    id, clinica_id, paciente_id, actor_user_id, tipo, fecha, titulo, metadata
  ) VALUES (
    v_timeline_id, f.clinica_b, f.paciente_b, f.admin_id, 'urgencia_ges',
    clock_timestamp(), 'Admin GES timeline allowed', jsonb_build_object('urgencia_id', f.ingreso_b)
  );
  SELECT count(*) INTO v_count FROM public.timeline_paciente WHERE id = v_timeline_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Clinic B admin cannot insert a GES timeline event'; END IF;
END;
$admin_b$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $cross_tenant$
DECLARE
  f record;
  v_count integer;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  SELECT count(*) INTO v_count FROM public.urgencias_ges_ingresos WHERE id = f.ingreso_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Clinic A can read Clinic B arrival'; END IF;

  BEGIN
    INSERT INTO public.urgencias_ges_ingresos (id, clinica_id, paciente_id)
    VALUES (f.ingreso_cruzado, f.clinica_a, f.paciente_b);
    RAISE EXCEPTION 'Clinic A linked a Clinic B patient to an arrival';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.urgencias_ges_ingresos WHERE id = f.ingreso_cruzado) THEN
    RAISE EXCEPTION 'Rejected cross-clinic insert left an arrival row';
  END IF;
END;
$cross_tenant$;
RESET ROLE;

-- A valid UUID without active membership is rejected and has no side effects.
SELECT set_config('request.jwt.claim.sub', usuario_sin_membresia::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', usuario_sin_membresia,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', (SELECT clinica_a FROM pg_temp.bp14_fixture))
)::text, true)
FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $no_membership$
DECLARE
  f record;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  IF public.clinica_actual() IS NOT NULL THEN RAISE EXCEPTION 'Missing membership resolved a clinic'; END IF;
  BEGIN
    INSERT INTO public.urgencias_ges_ingresos (id, clinica_id, paciente_id)
    VALUES (gen_random_uuid(), f.clinica_a, f.paciente_a);
    RAISE EXCEPTION 'User without membership created an arrival';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$no_membership$;
RESET ROLE;

-- Role isolation must hold even after clinical rows and audit events exist.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $reception_isolation$
DECLARE
  f record;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  IF EXISTS (SELECT 1 FROM public.urgencias_ges_triage WHERE clinica_id = f.clinica_a)
     OR EXISTS (SELECT 1 FROM public.urgencias_ges WHERE clinica_id = f.clinica_a)
     OR EXISTS (SELECT 1 FROM public.urgencias_ges_eventos WHERE clinica_id = f.clinica_a) THEN
    RAISE EXCEPTION 'Reception can read clinical triage, cases, or audit data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente WHERE tipo = 'urgencia_ges' AND clinica_id = f.clinica_a) THEN
    RAISE EXCEPTION 'Reception can read a BP14 clinical timeline entry';
  END IF;
END;
$reception_isolation$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', asistente_id::text, true)
FROM pg_temp.bp14_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', asistente_id,
  'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp14_fixture;
SET LOCAL ROLE authenticated;
DO $assistant_isolation$
DECLARE
  f record;
  v_count integer;
BEGIN
  SELECT * INTO f FROM pg_temp.bp14_fixture;
  SELECT count(*) INTO v_count FROM public.urgencias_ges_triage WHERE id = f.ingreso_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Assistant lost access to its clinic triage'; END IF;
  IF EXISTS (SELECT 1 FROM public.urgencias_ges WHERE clinica_id = f.clinica_a)
     OR EXISTS (SELECT 1 FROM public.urgencias_ges_eventos WHERE clinica_id = f.clinica_a) THEN
    RAISE EXCEPTION 'Assistant can read full case or audit data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente WHERE tipo = 'urgencia_ges' AND clinica_id = f.clinica_a) THEN
    RAISE EXCEPTION 'Assistant can read a BP14 clinical timeline entry';
  END IF;
END;
$assistant_isolation$;
RESET ROLE;

ROLLBACK;
