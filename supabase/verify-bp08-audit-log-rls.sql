-- Verificación transaccional de public.audit_log.
-- Ejecutar con una conexión SQL de rol postgres (por ejemplo, psql con
-- ON_ERROR_STOP=1). Usa una clínica con los cuatro roles activos, crea fixtures
-- desechables y revierte todo al finalizar. No ejecutar sin BEGIN/ROLLBACK.
BEGIN;

DO $setup$
DECLARE
  v_clinica UUID;
  v_admin UUID;
  v_dentista UUID;
  v_asistente UUID;
  v_recepcion UUID;
  v_clinica_externa UUID := gen_random_uuid();
  v_ids UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_log'::regclass) THEN
    RAISE EXCEPTION 'RLS debe estar habilitado en audit_log';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log'
      AND cmd = 'SELECT' AND policyname = 'audit_log_select_clinica'
  ) THEN
    RAISE EXCEPTION 'La política amplia audit_log_select_clinica sigue habilitada';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'audit_log' AND cmd = 'SELECT') <> 2 THEN
    RAISE EXCEPTION 'audit_log debe tener solo las dos policies SELECT acotadas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log'
      AND policyname = 'audit_log_select_admin' AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual LIKE '%es_admin_de_clinica_actual%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log'
      AND policyname = 'audit_log_select_own' AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual LIKE '%user_id%'
      AND qual LIKE '%clinica_actual%'
  ) THEN
    RAISE EXCEPTION 'Faltan las policies limitadas de admin o de filas propias';
  END IF;

  SELECT miembro.clinica_id INTO v_clinica
  FROM public.miembros_clinica AS miembro
  WHERE miembro.activo
    AND miembro.rol::text IN ('admin', 'dentista', 'asistente', 'recepcion')
  GROUP BY miembro.clinica_id
  HAVING count(DISTINCT miembro.rol::text) = 4
  LIMIT 1;

  IF v_clinica IS NULL THEN
    RAISE EXCEPTION 'Se requiere una clínica con los cuatro roles activos para verificar RLS';
  END IF;

  SELECT miembro.user_id INTO v_admin FROM public.miembros_clinica AS miembro
    WHERE miembro.clinica_id = v_clinica AND miembro.rol::text = 'admin' AND miembro.activo LIMIT 1;
  SELECT miembro.user_id INTO v_dentista FROM public.miembros_clinica AS miembro
    WHERE miembro.clinica_id = v_clinica AND miembro.rol::text = 'dentista' AND miembro.activo LIMIT 1;
  SELECT miembro.user_id INTO v_asistente FROM public.miembros_clinica AS miembro
    WHERE miembro.clinica_id = v_clinica AND miembro.rol::text = 'asistente' AND miembro.activo LIMIT 1;
  SELECT miembro.user_id INTO v_recepcion FROM public.miembros_clinica AS miembro
    WHERE miembro.clinica_id = v_clinica AND miembro.rol::text = 'recepcion' AND miembro.activo LIMIT 1;

  INSERT INTO public.clinicas (id, nombre)
    VALUES (v_clinica_externa, 'BP08 fixture temporal de auditoría');
  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
    VALUES (v_clinica_externa, v_admin, 'admin', true);

  INSERT INTO public.audit_log (id, clinica_id, user_id, table_name, record_id, action, old_data, new_data, user_email)
  VALUES
    (v_ids[1], v_clinica, v_admin, 'prestaciones', 'bp08-audit-admin', 'UPDATE', '{"dato":"anterior"}', '{"dato":"nuevo"}', 'test@example.invalid'),
    (v_ids[2], v_clinica, v_dentista, 'prestaciones', 'bp08-audit-dentista', 'UPDATE', '{"dato":"anterior"}', '{"dato":"nuevo"}', 'test@example.invalid'),
    (v_ids[3], v_clinica, v_asistente, 'pacientes', 'bp08-audit-asistente', 'UPDATE', '{"dato":"anterior"}', '{"dato":"nuevo"}', 'test@example.invalid'),
    (v_ids[4], v_clinica, v_recepcion, 'citas', 'bp08-audit-recepcion', 'UPDATE', '{"dato":"anterior"}', '{"dato":"nuevo"}', 'test@example.invalid');

  PERFORM set_config('bp08.audit_test_clinica', v_clinica::text, true);
  PERFORM set_config('bp08.audit_test_clinica_externa', v_clinica_externa::text, true);
  PERFORM set_config('bp08.audit_test_admin', v_admin::text, true);
  PERFORM set_config('bp08.audit_test_dentista', v_dentista::text, true);
  PERFORM set_config('bp08.audit_test_asistente', v_asistente::text, true);
  PERFORM set_config('bp08.audit_test_recepcion', v_recepcion::text, true);
  PERFORM set_config('bp08.audit_test_ids', array_to_string(v_ids, ','), true);
END;
$setup$;

-- SET ROLE debe ejecutarse como sentencia de sesión, fuera de un bloque DO.
SET LOCAL ROLE authenticated;

DO $assertions$
DECLARE
  v_clinica UUID := current_setting('bp08.audit_test_clinica')::uuid;
  v_clinica_externa UUID := current_setting('bp08.audit_test_clinica_externa')::uuid;
  v_admin UUID := current_setting('bp08.audit_test_admin')::uuid;
  v_dentista UUID := current_setting('bp08.audit_test_dentista')::uuid;
  v_asistente UUID := current_setting('bp08.audit_test_asistente')::uuid;
  v_recepcion UUID := current_setting('bp08.audit_test_recepcion')::uuid;
  v_ids UUID[] := string_to_array(current_setting('bp08.audit_test_ids'), ',')::uuid[];
  v_visible BIGINT;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'Las comprobaciones de visibilidad deben ejecutarse como authenticated';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated', 'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  SELECT count(*) INTO v_visible FROM public.audit_log WHERE id = ANY(v_ids);
  IF v_visible <> 4 THEN
    RAISE EXCEPTION 'Admin debe leer los cuatro eventos de su clínica; vio %', v_visible;
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_dentista, 'role', 'authenticated', 'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  SELECT count(*) INTO v_visible FROM public.audit_log WHERE id = ANY(v_ids);
  IF v_visible <> 1 OR NOT EXISTS (SELECT 1 FROM public.audit_log WHERE id = v_ids[2]) THEN
    RAISE EXCEPTION 'Dentista debe leer solo su propio evento; vio %', v_visible;
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_asistente, 'role', 'authenticated', 'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  SELECT count(*) INTO v_visible FROM public.audit_log WHERE id = ANY(v_ids);
  IF v_visible <> 1 OR NOT EXISTS (SELECT 1 FROM public.audit_log WHERE id = v_ids[3]) THEN
    RAISE EXCEPTION 'Asistente debe leer solo su propio evento; vio %', v_visible;
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_recepcion, 'role', 'authenticated', 'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  SELECT count(*) INTO v_visible FROM public.audit_log WHERE id = ANY(v_ids);
  IF v_visible <> 1 OR NOT EXISTS (SELECT 1 FROM public.audit_log WHERE id = v_ids[4]) THEN
    RAISE EXCEPTION 'Recepción debe leer solo su propio evento; vio %', v_visible;
  END IF;

  -- El admin es miembro de ambas clínicas. Al seleccionar la externa, no puede
  -- recuperar su propio evento creado en la clínica original.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated', 'user_metadata', jsonb_build_object('clinica_id', v_clinica_externa)
  )::text, true);
  SELECT count(*) INTO v_visible FROM public.audit_log WHERE id = ANY(v_ids);
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'El cambio de clínica expuso % eventos del tenant anterior', v_visible;
  END IF;
END;
$assertions$;

RESET ROLE;

DO $fixture_check$
DECLARE
  v_ids UUID[] := string_to_array(current_setting('bp08.audit_test_ids'), ',')::uuid[];
BEGIN
  IF (SELECT count(*) FROM public.audit_log WHERE id = ANY(v_ids)) <> 4 THEN
    RAISE EXCEPTION 'La verificación alteró o eliminó registros de auditoría';
  END IF;
END;
$fixture_check$;

ROLLBACK;
