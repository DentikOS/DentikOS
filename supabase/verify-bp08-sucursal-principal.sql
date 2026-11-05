-- Verificación transaccional de sucursal principal y asignación de citas BP08.
-- Ejecutar en una base local preparada con migraciones y datos mínimos.
BEGIN;
DO $verify$
DECLARE
  v_admin UUID;
  v_clinica UUID;
  v_sucursal_anterior UUID := gen_random_uuid();
  v_sucursal_objetivo UUID := gen_random_uuid();
  v_clinica_externa UUID := gen_random_uuid();
  v_sucursal_externa UUID := gen_random_uuid();
  v_cita_sin_sucursal UUID;
  v_cita_con_sucursal UUID;
  v_principal_anterior UUID;
  v_reasignadas INTEGER;
  v_citas_sin_sucursal_antes BIGINT;
  v_rechazado BOOLEAN;
  v_auditorias_cita_antes BIGINT;
  v_auditorias_cita_despues BIGINT;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.clinicas'::regclass
      AND attname = 'principal_sucursal_id'
      AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinicas'::regclass
      AND conname = 'clinicas_principal_sucursal_tenant_fk'
  ) THEN
    RAISE EXCEPTION 'Falta la columna principal o su FK compuesta por clínica';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS funcion
    WHERE funcion.oid = 'public.designar_sucursal_principal(uuid)'::regprocedure
      AND NOT funcion.prosecdef
      AND array_to_string(funcion.proconfig, ',') LIKE '%search_path=%'
  ) THEN
    RAISE EXCEPTION 'La RPC debe ser SECURITY INVOKER y fijar search_path';
  END IF;

  IF has_function_privilege('anon', 'public.designar_sucursal_principal(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.designar_sucursal_principal(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Los permisos de ejecución de la RPC no son restrictivos';
  END IF;

  SELECT miembro.user_id, miembro.clinica_id
    INTO v_admin, v_clinica
    FROM public.miembros_clinica AS miembro
    WHERE miembro.rol::text = 'admin'
      AND miembro.activo
    LIMIT 1;
  IF v_admin IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'Se requiere un administrador activo para ejecutar la prueba';
  END IF;

  SELECT clinica.principal_sucursal_id INTO v_principal_anterior
    FROM public.clinicas AS clinica WHERE clinica.id = v_clinica;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'user_metadata', jsonb_build_object('clinica_id', v_clinica)
    )::text,
    true
  );

  INSERT INTO public.sucursales(id, clinica_id, nombre, direccion, comuna, region, estado)
    VALUES
      (v_sucursal_anterior, v_clinica, 'BP08 Sucursal anterior', 'Calle de prueba 10', 'Prueba', 'Prueba', 'activa'),
      (v_sucursal_objetivo, v_clinica, 'BP08 Sucursal principal', 'Calle de prueba 20', 'Prueba', 'Prueba', 'activa');

  INSERT INTO public.clinicas(id, nombre)
    VALUES (v_clinica_externa, 'BP08 Clínica externa');
  INSERT INTO public.sucursales(id, clinica_id, nombre, direccion, comuna, region, estado)
    VALUES (v_sucursal_externa, v_clinica_externa, 'BP08 Sucursal externa', 'Calle de prueba 30', 'Prueba', 'Prueba', 'activa');

  INSERT INTO public.citas(user_id, clinica_id, fecha, hora_inicio, estado, notas)
    VALUES (v_admin, v_clinica, CURRENT_DATE, '08:00', 'Agendada', 'Nota a conservar')
    RETURNING id INTO v_cita_sin_sucursal;
  INSERT INTO public.citas(user_id, clinica_id, fecha, hora_inicio, estado, notas, sede_id)
    VALUES (v_admin, v_clinica, CURRENT_DATE, '08:30', 'Agendada', 'Asignación existente', v_sucursal_anterior)
    RETURNING id INTO v_cita_con_sucursal;

  -- El dentista no puede designar la sucursal. Se comprueba que el rechazo
  -- no cambie el principal ni las citas.
  UPDATE public.miembros_clinica
    SET rol = 'dentista'
    WHERE user_id = v_admin AND clinica_id = v_clinica;
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_rechazado := false;
  BEGIN
    PERFORM * FROM public.designar_sucursal_principal(v_sucursal_objetivo);
  EXCEPTION WHEN OTHERS THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN RAISE EXCEPTION 'Se permitió designar la principal a un dentista'; END IF;
  EXECUTE 'RESET ROLE';
  UPDATE public.miembros_clinica
    SET rol = 'admin'
    WHERE user_id = v_admin AND clinica_id = v_clinica;

  IF (SELECT clinica.principal_sucursal_id FROM public.clinicas AS clinica WHERE clinica.id = v_clinica)
      IS DISTINCT FROM v_principal_anterior
    OR (SELECT cita.sede_id FROM public.citas AS cita WHERE cita.id = v_cita_sin_sucursal) IS NOT NULL THEN
    RAISE EXCEPTION 'La llamada no autorizada produjo efectos secundarios';
  END IF;

  -- Rechaza una sucursal de otro tenant y mantiene intactos los datos.
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_rechazado := false;
  BEGIN
    PERFORM * FROM public.designar_sucursal_principal(v_sucursal_externa);
  EXCEPTION WHEN OTHERS THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN RAISE EXCEPTION 'Se permitió designar una sucursal de otra clínica'; END IF;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_auditorias_cita_antes
    FROM public.audit_log
    WHERE table_name = 'citas'
      AND record_id = v_cita_sin_sucursal::text
      AND clinica_id = v_clinica
      AND user_id = v_admin
      AND action = 'UPDATE';

  SELECT count(*) INTO v_citas_sin_sucursal_antes
    FROM public.citas
    WHERE clinica_id = v_clinica
      AND sede_id IS NULL;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT resultado.citas_reasignadas INTO v_reasignadas
    FROM public.designar_sucursal_principal(v_sucursal_objetivo) AS resultado;
  IF v_reasignadas <> v_citas_sin_sucursal_antes THEN
    RAISE EXCEPTION 'Se esperaban % citas reasignadas; resultado: %', v_citas_sin_sucursal_antes, v_reasignadas;
  END IF;

  SELECT resultado.citas_reasignadas INTO v_reasignadas
    FROM public.designar_sucursal_principal(v_sucursal_objetivo) AS resultado;
  IF v_reasignadas <> 0 THEN RAISE EXCEPTION 'La segunda llamada no fue idempotente'; END IF;

  v_rechazado := false;
  BEGIN
    UPDATE public.sucursales
      SET estado = 'inactiva'
      WHERE id = v_sucursal_objetivo AND clinica_id = v_clinica;
  EXCEPTION WHEN check_violation THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN RAISE EXCEPTION 'Se permitió desactivar la sucursal principal'; END IF;

  IF (SELECT clinica.principal_sucursal_id FROM public.clinicas AS clinica WHERE clinica.id = v_clinica)
      IS DISTINCT FROM v_sucursal_objetivo
    OR (SELECT cita.sede_id FROM public.citas AS cita WHERE cita.id = v_cita_sin_sucursal)
      IS DISTINCT FROM v_sucursal_objetivo
    OR (SELECT cita.sede_id FROM public.citas AS cita WHERE cita.id = v_cita_con_sucursal)
      IS DISTINCT FROM v_sucursal_anterior
    OR (SELECT cita.notas FROM public.citas AS cita WHERE cita.id = v_cita_sin_sucursal)
      IS DISTINCT FROM 'Nota a conservar'
    OR (SELECT sucursal.estado FROM public.sucursales AS sucursal WHERE sucursal.id = v_sucursal_objetivo)
      IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'La operación alteró datos distintos al principal y la sede nula';
  END IF;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_auditorias_cita_despues
    FROM public.audit_log
    WHERE table_name = 'citas'
      AND record_id = v_cita_sin_sucursal::text
      AND clinica_id = v_clinica
      AND user_id = v_admin
      AND action = 'UPDATE';
  IF v_auditorias_cita_despues <= v_auditorias_cita_antes THEN
    RAISE EXCEPTION 'La reasignación no produjo auditoría con el usuario y clínica correctos';
  END IF;
END;
$verify$;
ROLLBACK;
