-- Verifica metadata compartida de packs y permisos existentes. Todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_id uuid := gen_random_uuid();
  v_afectadas bigint;
  v_visibles bigint;
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
  SELECT mc.user_id INTO v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.rol = 'recepcion' AND mc.clinica_id = v_clinica AND mc.activo
    AND (SELECT count(*) FROM public.miembros_clinica m2
      WHERE m2.user_id = mc.user_id AND m2.activo) = 1
  LIMIT 1;
  IF v_admin IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'Falta un admin con una sola membresía activa para verificar metadata de packs';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.prestaciones(
    id, user_id, clinica_id, nombre, especialidad,
    precio_particular, precio_fonasa, codigo_fonasa, precio,
    descripcion, ahorro_estimado
  ) VALUES (
    v_id, v_admin, v_clinica, 'Verificación pack', 'Pack Promocional',
    50000, 50000, NULL, 50000, 'Evaluación y limpieza', '15%'
  );

  SELECT count(*) INTO v_visibles FROM public.prestaciones p
  WHERE p.id = v_id AND p.descripcion = 'Evaluación y limpieza'
    AND p.ahorro_estimado = '15%';
  IF v_visibles <> 1 THEN RAISE EXCEPTION 'No se pudo leer metadata compartida del pack'; END IF;

  UPDATE public.prestaciones p
  SET descripcion = 'Evaluación, limpieza y flúor', ahorro_estimado = '20%'
  WHERE p.id = v_id;
  GET DIAGNOSTICS v_afectadas = ROW_COUNT;
  IF v_afectadas <> 1 THEN RAISE EXCEPTION 'Administración no pudo actualizar metadata del pack'; END IF;

  IF v_recepcion IS NOT NULL THEN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_recepcion, 'role', 'authenticated',
      'user_metadata', jsonb_build_object('clinica_id', v_clinica)
    )::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_visibles FROM public.prestaciones p WHERE p.id = v_id;
    IF v_visibles <> 1 THEN RAISE EXCEPTION 'Recepción no puede leer el pack de su clínica'; END IF;
    UPDATE public.prestaciones p SET descripcion = 'Cambio no autorizado' WHERE p.id = v_id;
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    IF v_afectadas <> 0 THEN RAISE EXCEPTION 'Recepción pudo modificar metadata del pack'; END IF;
  END IF;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT EXISTS (SELECT 1 FROM public.prestaciones p WHERE p.id = v_id
      AND p.descripcion = 'Evaluación, limpieza y flúor' AND p.ahorro_estimado = '20%') THEN
    RAISE EXCEPTION 'El rechazo a recepción alteró metadata del pack';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Packs: lectura y edición de metadata autorizadas, recepción de solo lectura';
END;
$verify$;
ROLLBACK;
