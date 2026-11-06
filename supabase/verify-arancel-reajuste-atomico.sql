-- Verificación transaccional del reajuste masivo del arancel. Todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_prestacion_1 uuid := gen_random_uuid();
  v_prestacion_2 uuid := gen_random_uuid();
  v_porcentaje constant numeric := -1;
  v_snapshot jsonb;
  v_snapshot_actual jsonb;
  v_primera uuid;
  v_particular integer;
  v_fonasa integer;
  v_return_count bigint;
  v_cambios_esperados bigint;
  v_auditorias_antes bigint;
  v_auditorias_despues bigint;
  v_rechazado boolean := false;
  v_config text[];
  v_config_auditoria text[];
  v_prosecdef boolean;
  v_auditoria_definer boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  SELECT mc.user_id, mc.clinica_id INTO v_admin, v_clinica
  FROM public.miembros_clinica mc
  WHERE mc.rol = 'admin' AND mc.activo
    AND (SELECT count(*) FROM public.miembros_clinica m2
      WHERE m2.user_id = mc.user_id AND m2.activo) = 1
  LIMIT 1;
  SELECT mc.user_id INTO v_recepcion FROM public.miembros_clinica mc
    WHERE mc.rol = 'recepcion' AND mc.activo
      AND (SELECT count(*) FROM public.miembros_clinica m2
        WHERE m2.user_id = mc.user_id AND m2.activo) = 1
    LIMIT 1;
  IF v_admin IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'Falta un admin con una sola membresía activa para verificar el reajuste';
  END IF;

  SELECT p.prosecdef, p.proconfig INTO v_prosecdef, v_config
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'reajustar_arancel_clinica'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_porcentaje numeric, p_prestaciones_esperadas jsonb';
  IF v_prosecdef IS DISTINCT FROM false OR NOT COALESCE('search_path=""' = ANY(v_config), false) THEN
    RAISE EXCEPTION 'RPC de reajuste debe ser SECURITY INVOKER y fijar search_path vacío';
  END IF;
  SELECT p.prosecdef, p.proconfig INTO v_auditoria_definer, v_config_auditoria
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'bp07_private' AND p.proname = 'auditar_cambio_prestacion_arancel';
  IF v_auditoria_definer IS DISTINCT FROM true
    OR NOT COALESCE('search_path=""' = ANY(v_config_auditoria), false) THEN
    RAISE EXCEPTION 'Trigger de auditoría debe ser SECURITY DEFINER y fijar search_path vacío';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- El arancel de prueba contiene solo filas temporales de esta clínica. Todo se revierte.
  INSERT INTO public.prestaciones(id, user_id, clinica_id, nombre, especialidad,
      precio_particular, precio_fonasa, codigo_fonasa, precio)
    VALUES (v_prestacion_1, v_admin, v_clinica, 'Prueba reajuste 1', 'Prueba', 10000, 5000, 'TEST-1', 10000),
      (v_prestacion_2, v_admin, v_clinica, 'Prueba reajuste 2', 'Prueba', 25000, 7000, 'TEST-2', 25000);
  SELECT p.id, p.precio_particular, p.precio_fonasa INTO v_primera, v_particular, v_fonasa
  FROM public.prestaciones p WHERE p.clinica_id = v_clinica ORDER BY p.id LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'precio_particular', p.precio_particular, 'precio_fonasa', p.precio_fonasa
  ) ORDER BY p.id), '[]'::jsonb) INTO v_snapshot
  FROM public.prestaciones p WHERE p.clinica_id = v_clinica;
  SELECT count(*) INTO v_cambios_esperados
  FROM public.prestaciones p WHERE p.clinica_id = v_clinica
    AND (round(p.precio_particular::numeric * 0.99, 0) <> p.precio_particular
      OR round(p.precio_fonasa::numeric * 0.99, 0) <> p.precio_fonasa
      OR p.precio IS DISTINCT FROM round(p.precio_particular::numeric * 0.99, 0)::integer);
  SELECT count(*) INTO v_auditorias_antes FROM public.audit_log a
  WHERE a.table_name = 'prestaciones' AND a.clinica_id = v_clinica;

  SELECT count(*) INTO v_return_count
  FROM public.reajustar_arancel_clinica(v_porcentaje, v_snapshot);
  IF v_return_count <> jsonb_array_length(v_snapshot) THEN
    RAISE EXCEPTION 'El reajuste no devolvió el arancel completo';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.prestaciones p WHERE p.id = v_primera AND p.clinica_id = v_clinica
      AND p.precio_particular = round(v_particular::numeric * 0.99, 0)::integer
      AND p.precio_fonasa = round(v_fonasa::numeric * 0.99, 0)::integer
      AND p.precio = round(v_particular::numeric * 0.99, 0)::integer
  ) THEN
    RAISE EXCEPTION 'No se actualizaron los precios particular, Fonasa y espejo';
  END IF;
  SELECT count(*) INTO v_auditorias_despues FROM public.audit_log a
  WHERE a.table_name = 'prestaciones' AND a.clinica_id = v_clinica;
  IF v_auditorias_despues - v_auditorias_antes <> v_cambios_esperados THEN
    RAISE EXCEPTION 'La auditoría por fila no coincide con las prestaciones cuyo precio cambió';
  END IF;
  IF v_cambios_esperados > 0 AND NOT EXISTS (
    SELECT 1 FROM public.audit_log a
    WHERE a.table_name = 'prestaciones' AND a.clinica_id = v_clinica
      AND a.record_id = v_primera::text AND a.action = 'UPDATE'
      AND a.old_data ? 'precio_particular' AND a.new_data ? 'precio_fonasa'
  ) THEN
    RAISE EXCEPTION 'No se encontró auditoría de valores anteriores y nuevos';
  END IF;

  -- El mismo snapshot de antes del primer intento debe fallar de forma segura.
  v_rechazado := false;
  BEGIN
    PERFORM 1 FROM public.reajustar_arancel_clinica(v_porcentaje, v_snapshot);
  EXCEPTION WHEN serialization_failure THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN RAISE EXCEPTION 'El snapshot obsoleto fue aceptado'; END IF;
  IF (SELECT p.precio_particular FROM public.prestaciones p WHERE p.id = v_primera) <>
      round(v_particular::numeric * 0.99, 0)::integer THEN
    RAISE EXCEPTION 'Un reintento obsoleto modificó nuevamente el precio';
  END IF;
  SELECT count(*) INTO v_auditorias_despues FROM public.audit_log a
  WHERE a.table_name = 'prestaciones' AND a.clinica_id = v_clinica;
  IF v_auditorias_despues - v_auditorias_antes <> v_cambios_esperados THEN
    RAISE EXCEPTION 'El rechazo del snapshot obsoleto dejó auditorías adicionales';
  END IF;

  IF v_recepcion IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'precio_particular', p.precio_particular, 'precio_fonasa', p.precio_fonasa
    ) ORDER BY p.id), '[]'::jsonb) INTO v_snapshot_actual
    FROM public.prestaciones p WHERE p.clinica_id = v_clinica;
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_recepcion, 'role', 'authenticated'
    )::text, true);
    v_rechazado := false;
    BEGIN
      PERFORM 1 FROM public.reajustar_arancel_clinica(v_porcentaje, v_snapshot_actual);
    EXCEPTION WHEN insufficient_privilege THEN
      v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Recepción pudo reajustar el arancel'; END IF;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated',
      'user_metadata', jsonb_build_object('clinica_id', v_clinica)
    )::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF (SELECT p.precio_particular FROM public.prestaciones p WHERE p.id = v_primera) <>
      round(v_particular::numeric * 0.99, 0)::integer THEN
      RAISE EXCEPTION 'El rechazo a recepción dejó cambios en precios';
    END IF;
    SELECT count(*) INTO v_auditorias_despues FROM public.audit_log a
    WHERE a.table_name = 'prestaciones' AND a.clinica_id = v_clinica;
    IF v_auditorias_despues - v_auditorias_antes <> v_cambios_esperados THEN
      RAISE EXCEPTION 'El rechazo a recepción dejó auditorías adicionales';
    END IF;
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Arancel: reajuste atómico, espejo, auditoría y rechazos sin efectos comprobados';
END;
$verify$;
ROLLBACK;
