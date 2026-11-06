-- Verificación transaccional de la cola offline BP07. Todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_clinica_externa uuid := gen_random_uuid();
  v_paciente_externo uuid := gen_random_uuid();
  v_id_local text := 'verify-offline-budget-v1';
  v_id_item_local text := 'verify-offline-item-v1';
  v_folio text := 'VERIFY-OFFLINE-' || substr(gen_random_uuid()::text, 1, 8);
  v_presupuesto_id uuid;
  v_retorno uuid;
  v_item_id uuid;
  v_detalle jsonb;
  v_presupuesto jsonb;
  v_items jsonb;
  v_rechazado boolean := false;
  v_historial_antes bigint;
  v_historial_despues bigint;
  v_auditoria_antes bigint;
  v_auditoria_despues bigint;
  v_prosecdef boolean;
  v_config text[];
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  SELECT mc.user_id, mc.clinica_id INTO v_admin, v_clinica
  FROM public.miembros_clinica mc
  WHERE mc.rol::text = 'admin' AND mc.activo
    AND (SELECT count(*) FROM public.miembros_clinica m2
      WHERE m2.user_id = mc.user_id AND m2.activo) = 1
    AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.clinica_id = mc.clinica_id)
  LIMIT 1;
  SELECT mc.user_id INTO v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.clinica_id = v_clinica AND mc.rol::text = 'recepcion' AND mc.activo
    AND (SELECT count(*) FROM public.miembros_clinica m2
      WHERE m2.user_id = mc.user_id AND m2.activo) = 1
  LIMIT 1;
  SELECT p.id INTO v_paciente FROM public.pacientes p
  WHERE p.clinica_id = v_clinica LIMIT 1;
  IF v_admin IS NULL OR v_clinica IS NULL OR v_paciente IS NULL OR v_recepcion IS NULL THEN
    RAISE EXCEPTION 'Faltan admin, recepción o paciente de prueba con una membresía activa';
  END IF;

  SELECT p.prosecdef, p.proconfig INTO v_prosecdef, v_config
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sincronizar_presupuesto_offline'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_presupuesto jsonb, p_items jsonb, p_presupuesto_id uuid';
  IF v_prosecdef IS DISTINCT FROM false
    OR NOT COALESCE('search_path=""' = ANY(v_config), false)
    OR NOT has_function_privilege('authenticated', 'public.sincronizar_presupuesto_offline(jsonb,jsonb,uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.sincronizar_presupuesto_offline(jsonb,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'El RPC debe ser invocador, fijar search_path y ejecutarse solo con sesión autenticada';
  END IF;

  -- Fixture de otra clínica dentro de la transacción para probar rechazo de un paciente externo.
  INSERT INTO public.clinicas(id, nombre)
  VALUES (v_clinica_externa, 'Prueba temporal BP07 offline');
  INSERT INTO public.pacientes(id, user_id, nombre, rut, clinica_id)
  VALUES (v_paciente_externo, v_admin, 'Paciente externo temporal',
    'VERIFY-' || substr(v_paciente_externo::text, 1, 8), v_clinica_externa);

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_detalle := jsonb_build_array(jsonb_build_object(
    'id', v_id_item_local, 'prestacionNombre', 'Prueba transaccional', 'valor', 10000
  ));
  v_presupuesto := jsonb_build_object(
    'id', v_id_local,
    'user_id', gen_random_uuid(),
    'clinica_id', v_clinica_externa,
    'paciente_id', v_paciente,
    'folio', v_folio,
    'paciente_nombre', 'Paciente de prueba',
    'fecha_emision', CURRENT_DATE,
    'convenio', 'Particular',
    'monto_total', 10000,
    'monto_abonado', 0,
    'estado', 'Aprobado',
    'observacion', 'Verificación transaccional revertida',
    'detalle_items', v_detalle,
    'total_bruto', 10000,
    'total_descuentos', 0,
    'descuentos', '[]'::jsonb,
    'version', 1
  );
  v_items := jsonb_build_array(jsonb_build_object(
    'id', v_id_item_local,
    'presupuesto_id', gen_random_uuid(),
    'clinica_id', v_clinica_externa,
    'paciente_id', v_paciente,
    'prestacion_nombre', 'Prueba transaccional',
    'valor', 10000,
    'convenio', 'Particular',
    'estado', 'Pendiente'
  ));

  v_presupuesto_id := public.sincronizar_presupuesto_offline(v_presupuesto, v_items, NULL);
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = v_presupuesto_id AND b.clinica_id = v_clinica
        AND b.user_id = v_admin AND b.paciente_id = v_paciente
        AND b.monto_total = 10000 AND b.monto_abonado = 0)
    OR (SELECT count(*) FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = v_presupuesto_id AND bi.clinica_id = v_clinica) <> 1 THEN
    RAISE EXCEPTION 'El guardado inicial no persistió cabecera e ítems en la clínica activa';
  END IF;
  SELECT bi.id INTO v_item_id FROM public.presupuesto_items bi
  WHERE bi.presupuesto_id = v_presupuesto_id AND bi.prestacion_nombre = 'Prueba transaccional';

  -- La cabecera legacy se vuelve a enviar con el mismo ID y conserva el mismo UUID remoto.
  IF public.sincronizar_presupuesto_offline(v_presupuesto, v_items, NULL) IS DISTINCT FROM v_presupuesto_id
    OR (SELECT count(*) FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 1
    OR (SELECT count(*) FROM public.presupuesto_items bi WHERE bi.presupuesto_id = v_presupuesto_id) <> 1 THEN
    RAISE EXCEPTION 'El reintento legacy duplicó filas o generó otro ID remoto';
  END IF;

  -- Registra un abono real dentro de la transacción para probar que el RPC no lo pisa.
  PERFORM 1 FROM public.registrar_abono_presupuesto_con_imputaciones(
    gen_random_uuid(), v_presupuesto_id, 2000, 'efectivo', 'Verificación reversible', '[]'::jsonb
  );
  IF (SELECT b.monto_abonado FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 2000 THEN
    RAISE EXCEPTION 'No se preparó el saldo pagado para la prueba';
  END IF;
  v_presupuesto := jsonb_set(v_presupuesto, '{estado}', '"en-curso"'::jsonb);
  SELECT count(*) INTO v_historial_antes FROM public.presupuesto_versiones h
  WHERE h.presupuesto_id = v_presupuesto_id;
  SELECT count(*) INTO v_auditoria_antes FROM public.audit_log a
  WHERE a.clinica_id = v_clinica AND a.record_id IN (v_presupuesto_id::text, v_item_id::text)
    AND a.table_name IN ('presupuestos', 'presupuesto_items');

  v_presupuesto := jsonb_set(v_presupuesto, '{observacion}', '"Cambio reversible"'::jsonb);
  v_items := jsonb_build_array(
    jsonb_build_object('id', v_id_item_local, 'paciente_id', v_paciente,
      'prestacion_nombre', 'Prueba transaccional', 'valor', 10000,
      'convenio', 'Particular', 'estado', 'En Proceso'),
    jsonb_build_object('id', 'verify-invalid-item-v1', 'paciente_id', v_paciente,
      'prestacion_nombre', 'Ítem inválido', 'valor', 100,
      'convenio', 'Particular', 'estado', 'Estado inválido')
  );
  v_rechazado := false;
  BEGIN
    PERFORM public.sincronizar_presupuesto_offline(v_presupuesto, v_items, NULL);
  EXCEPTION WHEN check_violation THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado
    OR (SELECT b.monto_total FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 10000
    OR (SELECT b.monto_abonado FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 2000
    OR (SELECT bi.valor FROM public.presupuesto_items bi WHERE bi.id = v_item_id) <> 10000
    OR (SELECT b.observacion FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 'Verificación transaccional revertida'
    OR (SELECT bi.estado FROM public.presupuesto_items bi WHERE bi.id = v_item_id) <> 'Pendiente'
    OR (SELECT count(*) FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = v_presupuesto_id) <> 1 THEN
    RAISE EXCEPTION 'El fallo de un ítem no revirtió todos los cambios de la transacción';
  END IF;
  SELECT count(*) INTO v_historial_despues FROM public.presupuesto_versiones h
  WHERE h.presupuesto_id = v_presupuesto_id;
  SELECT count(*) INTO v_auditoria_despues FROM public.audit_log a
  WHERE a.clinica_id = v_clinica AND a.record_id IN (v_presupuesto_id::text, v_item_id::text)
    AND a.table_name IN ('presupuestos', 'presupuesto_items');
  IF v_historial_despues <> v_historial_antes OR v_auditoria_despues <> v_auditoria_antes THEN
    RAISE EXCEPTION 'El rechazo dejó versiones o auditorías adicionales';
  END IF;

  -- Reintento válido actualiza el mismo presupuesto y nunca sobrescribe el abono.
  v_items := jsonb_build_array(jsonb_build_object(
    'id', v_id_item_local, 'paciente_id', v_paciente,
    'prestacion_nombre', 'Prueba transaccional', 'valor', 10000,
    'convenio', 'Particular', 'estado', 'En Proceso'
  ));
  v_retorno := public.sincronizar_presupuesto_offline(v_presupuesto, v_items, NULL);
  IF v_retorno IS DISTINCT FROM v_presupuesto_id
    OR (SELECT b.monto_total FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 10000
    OR (SELECT b.monto_abonado FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 2000
    OR (SELECT b.observacion FROM public.presupuestos b WHERE b.id = v_presupuesto_id) <> 'Cambio reversible'
    OR (SELECT bi.estado FROM public.presupuesto_items bi WHERE bi.id = v_item_id) <> 'En Proceso' THEN
    RAISE EXCEPTION 'El reintento válido no conservó ID, abono y datos del ítem';
  END IF;
  SELECT count(*) INTO v_historial_antes FROM public.presupuesto_versiones h
  WHERE h.presupuesto_id = v_presupuesto_id;
  SELECT count(*) INTO v_auditoria_antes FROM public.audit_log a
  WHERE a.clinica_id = v_clinica AND a.record_id IN (v_presupuesto_id::text, v_item_id::text)
    AND a.table_name IN ('presupuestos', 'presupuesto_items');
  PERFORM public.sincronizar_presupuesto_offline(v_presupuesto, v_items, NULL);
  SELECT count(*) INTO v_historial_despues FROM public.presupuesto_versiones h
  WHERE h.presupuesto_id = v_presupuesto_id;
  SELECT count(*) INTO v_auditoria_despues FROM public.audit_log a
  WHERE a.clinica_id = v_clinica AND a.record_id IN (v_presupuesto_id::text, v_item_id::text)
    AND a.table_name IN ('presupuestos', 'presupuesto_items');
  IF v_historial_despues <> v_historial_antes OR v_auditoria_despues <> v_auditoria_antes THEN
    RAISE EXCEPTION 'El reintento sin cambios produjo auditorías o revisiones duplicadas';
  END IF;

  -- La función permite la escritura al rol recepción configurado para BP07.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_recepcion, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  PERFORM public.sincronizar_presupuesto_offline(NULL, v_items, v_presupuesto_id);

  -- Un UUID válido de paciente ajeno a la clínica se rechaza sin insertar presupuesto.
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica)
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_rechazado := false;
  BEGIN
    PERFORM public.sincronizar_presupuesto_offline(
      jsonb_build_object(
        'id', 'verify-cross-tenant-budget-v1', 'user_id', v_admin,
        'clinica_id', v_clinica_externa, 'paciente_id', v_paciente_externo,
        'folio', 'VERIFY-CROSS-' || substr(v_clinica_externa::text, 1, 8),
        'paciente_nombre', 'Paciente externo', 'monto_total', 100,
        'estado', 'Borrador', 'detalle_items', '[]'::jsonb,
        'total_bruto', 100, 'total_descuentos', 0, 'descuentos', '[]'::jsonb
      ),
      '[]'::jsonb,
      NULL
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.folio = 'VERIFY-CROSS-' || substr(v_clinica_externa::text, 1, 8)) THEN
    RAISE EXCEPTION 'Se aceptó el paciente de otra clínica o se dejó una cabecera';
  END IF;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'BP07 offline: atomicidad, idempotencia, saldo, auditoría, rol recepción y rechazo entre clínicas comprobados';
END;
$verify$;
ROLLBACK;
