-- Prueba transaccional de RLS para pagos. Todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_otro_paciente uuid;
  v_clinica_externa uuid := gen_random_uuid();
  v_paciente_externo uuid := gen_random_uuid();
  v_presupuesto uuid;
  v_pago_valido uuid := gen_random_uuid();
  v_pago_paciente_externo uuid := gen_random_uuid();
  v_pago_paciente_presupuesto_distinto uuid := gen_random_uuid();
  v_pago_invalido uuid := gen_random_uuid();
  v_rechazado boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  SELECT mc.user_id, mc.clinica_id
    INTO v_admin, v_clinica
    FROM public.miembros_clinica mc
    WHERE mc.rol::text = 'admin' AND mc.activo
    LIMIT 1;

  SELECT b.id, b.paciente_id
    INTO v_presupuesto, v_paciente
    FROM public.presupuestos b
    JOIN public.pacientes p
      ON p.id = b.paciente_id AND p.clinica_id = b.clinica_id
    WHERE b.clinica_id = v_clinica
    LIMIT 1;

  SELECT p.id INTO v_otro_paciente
    FROM public.pacientes p
    WHERE p.clinica_id = v_clinica AND p.id <> v_paciente
    LIMIT 1;

  IF v_admin IS NULL OR v_clinica IS NULL OR v_paciente IS NULL OR v_presupuesto IS NULL THEN
    RAISE EXCEPTION 'Falta un admin, paciente o presupuesto de la clínica de prueba';
  END IF;

  IF v_otro_paciente IS NULL THEN
    INSERT INTO public.pacientes(user_id, nombre, rut, clinica_id)
      VALUES (v_admin, 'Prueba RLS pagos', 'TEST-' || gen_random_uuid()::text, v_clinica)
      RETURNING id INTO v_otro_paciente;
  END IF;

  INSERT INTO public.clinicas(id, nombre)
    VALUES (v_clinica_externa, 'Prueba transaccional RLS pagos');
  INSERT INTO public.pacientes(user_id, nombre, rut, clinica_id)
    VALUES (v_admin, 'Prueba RLS pagos externa', 'TEST-' || gen_random_uuid()::text, v_clinica_externa)
    RETURNING id INTO v_paciente_externo;

  -- Si las políticas locales no contienen las correlaciones explícitas,
  -- no se continúa con las pruebas funcionales.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pagos'
      AND policyname = 'pagos_bp07_select' AND cmd = 'SELECT'
      AND qual LIKE '%clinica_id = clinica_actual%'
      AND qual LIKE '%p.clinica_id = pagos.clinica_id%'
      AND qual LIKE '%b.clinica_id = pagos.clinica_id%'
      AND qual LIKE '%b.paciente_id = pagos.paciente_id%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pagos'
      AND policyname = 'pagos_bp07_insert' AND cmd = 'INSERT'
      AND with_check LIKE '%clinica_id = clinica_actual%'
      AND with_check LIKE '%user_id = auth.uid%'
      AND with_check LIKE '%p.clinica_id = pagos.clinica_id%'
      AND with_check LIKE '%b.clinica_id = pagos.clinica_id%'
      AND with_check LIKE '%b.paciente_id = pagos.paciente_id%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pagos'
      AND policyname = 'pagos_bp07_update' AND cmd = 'UPDATE'
      AND qual LIKE '%clinica_id = clinica_actual%'
      AND qual LIKE '%user_id = auth.uid%'
      AND with_check LIKE '%clinica_id = clinica_actual%'
      AND with_check LIKE '%user_id = auth.uid%'
      AND with_check LIKE '%p.clinica_id = pagos.clinica_id%'
      AND with_check LIKE '%b.clinica_id = pagos.clinica_id%'
      AND with_check LIKE '%b.paciente_id = pagos.paciente_id%'
  ) THEN
    RAISE EXCEPTION 'Las políticas no cotejan explícitamente clínica y paciente del pago';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated',
      'user_metadata', jsonb_build_object('clinica_id', v_clinica))::text,
    true
  );

  -- Fixtures deliberadamente inconsistentes para comprobar SELECT. No tienen
  -- abono presupuestario real; los triggers de saldo se pausan solo al crear
  -- esta fila inválida y se restauran dentro de la misma transacción.
  INSERT INTO public.pagos(id, user_id, paciente_id, folio, monto, metodo_pago, clinica_id, concepto)
    VALUES (v_pago_paciente_externo, v_admin, v_paciente_externo,
      'TEST-RLS-EXTERNO-' || substr(v_pago_paciente_externo::text, 1, 8),
      1, 'efectivo', v_clinica, 'Prueba RLS rollback');

  ALTER TABLE public.pagos DISABLE TRIGGER trg_validar_abono_presupuesto;
  ALTER TABLE public.pagos DISABLE TRIGGER trg_aplicar_abono_presupuesto;
  INSERT INTO public.pagos(id, user_id, paciente_id, presupuesto_id, folio,
      monto, metodo_pago, clinica_id, concepto)
    VALUES (v_pago_paciente_presupuesto_distinto, v_admin, v_otro_paciente,
      v_presupuesto, 'TEST-RLS-PRESUPUESTO-' || substr(v_pago_paciente_presupuesto_distinto::text, 1, 8),
      1, 'efectivo', v_clinica, 'Prueba RLS rollback');
  ALTER TABLE public.pagos ENABLE TRIGGER trg_validar_abono_presupuesto;
  ALTER TABLE public.pagos ENABLE TRIGGER trg_aplicar_abono_presupuesto;

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- La inserción y lectura de un pago dentro de la clínica siguen permitidas.
  INSERT INTO public.pagos(id, user_id, paciente_id, folio, monto, metodo_pago, clinica_id, concepto)
    VALUES (v_pago_valido, v_admin, v_paciente,
      'TEST-RLS-VALIDO-' || substr(v_pago_valido::text, 1, 8),
      1, 'efectivo', v_clinica, 'Prueba RLS rollback');
  IF NOT EXISTS (SELECT 1 FROM public.pagos WHERE id = v_pago_valido) THEN
    RAISE EXCEPTION 'Admin no pudo leer su pago válido';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pagos WHERE id = v_pago_paciente_externo)
    OR EXISTS (SELECT 1 FROM public.pagos WHERE id = v_pago_paciente_presupuesto_distinto) THEN
    RAISE EXCEPTION 'RLS expuso un pago con clínica/paciente inconsistente';
  END IF;

  -- Una referencia a paciente de otra clínica debe rechazarse al insertar.
  v_rechazado := false;
  BEGIN
    INSERT INTO public.pagos(id, user_id, paciente_id, folio, monto, metodo_pago, clinica_id, concepto)
      VALUES (v_pago_invalido, v_admin, v_paciente_externo,
        'TEST-RLS-RECHAZADO-' || substr(v_pago_invalido::text, 1, 8),
        1, 'efectivo', v_clinica, 'Prueba RLS rollback');
  EXCEPTION WHEN insufficient_privilege THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'RLS permitió insertar un pago de paciente de otra clínica';
  END IF;

  -- La fila no debe moverse a otra clínica mediante el cambio de paciente.
  v_rechazado := false;
  BEGIN
    UPDATE public.pagos SET paciente_id = v_paciente_externo WHERE id = v_pago_valido;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'RLS permitió actualizar el pago a paciente de otra clínica';
  END IF;

  EXECUTE 'RESET ROLE';
  IF EXISTS (SELECT 1 FROM public.pagos WHERE id = v_pago_invalido)
    OR (SELECT paciente_id FROM public.pagos WHERE id = v_pago_valido) IS DISTINCT FROM v_paciente THEN
    RAISE EXCEPTION 'Operación rechazada dejó efectos secundarios';
  END IF;
END;
$verify$;
ROLLBACK;
