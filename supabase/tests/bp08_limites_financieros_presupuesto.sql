-- Transactional integration test for the BP08 budget limits trigger.
-- Run as a database owner against a database with an active admin member and
-- at least one patient. All fixture rows and audit events are rolled back.
BEGIN;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  (
    SELECT mc.user_id::text
    FROM public.miembros_clinica AS mc
    WHERE mc.activo AND mc.rol::text = 'admin'
    ORDER BY mc.clinica_id, mc.user_id
    LIMIT 1
  ),
  true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('request.jwt.claim.sub', true),
    'role', 'authenticated'
  )::text,
  true
);
SELECT pg_catalog.set_config(
  'bp08.test.recepcion_user',
  (
    SELECT mc.user_id::text
    FROM public.miembros_clinica AS mc
    WHERE mc.activo
      AND mc.rol::text = 'recepcion'
      AND mc.clinica_id = public.clinica_actual()
    ORDER BY mc.clinica_id, mc.user_id
    LIMIT 1
  ),
  true
);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_paciente uuid;
  v_config jsonb;
  v_descuento_maximo numeric;
  v_descuento_excedido numeric;
  v_cuotas_maximas numeric;
  v_cuotas_validas numeric;
  v_presupuesto_valido uuid := gen_random_uuid();
  v_presupuesto_valido_legacy uuid := gen_random_uuid();
  v_presupuesto_descuento uuid := gen_random_uuid();
  v_presupuesto_cuotas uuid := gen_random_uuid();
  v_versiones_antes bigint;
  v_versiones_legacy_antes bigint;
  v_auditoria_antes bigint;
  v_auditoria_valido_antes bigint;
  v_auditoria_legacy_antes bigint;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'No se pudo preparar el contexto autenticado del test';
  END IF;

  SELECT p.id INTO v_paciente
  FROM public.pacientes AS p
  WHERE p.clinica_id = v_clinica
  ORDER BY p.id
  LIMIT 1;
  IF v_paciente IS NULL THEN
    RAISE EXCEPTION 'El test requiere un paciente de la clínica del actor';
  END IF;

  SELECT c.configuracion_financiera INTO v_config
  FROM public.clinicas AS c
  WHERE c.id = v_clinica;
  v_descuento_maximo := (v_config->>'descuentoMaximoPermitidoPct')::numeric;
  v_cuotas_maximas := (v_config->>'maximoCuotasSinInteres')::numeric;
  IF v_descuento_maximo IS NULL OR v_descuento_maximo >= 100
    OR v_cuotas_maximas IS NULL OR v_cuotas_maximas < 1 THEN
    RAISE EXCEPTION 'Los límites configurados no permiten ejecutar este test';
  END IF;
  v_descuento_excedido := LEAST(100, v_descuento_maximo + 1);
  v_cuotas_validas := pg_catalog.floor(v_cuotas_maximas);

  -- Both currently used JSON shapes must accept the configured maximum.
  INSERT INTO public.presupuestos (
    id, user_id, paciente_id, folio, paciente_nombre, clinica_id, estado,
    descuento_global_pct, plan_pago
  ) VALUES (
    v_presupuesto_valido, v_actor, v_paciente, 'TEST-BP08-VALIDO', 'Test BP08', v_clinica, 'borrador',
    v_descuento_maximo,
    pg_catalog.jsonb_build_object('modalidad', 'cuotas', 'cuotas', v_cuotas_validas)
  );
  INSERT INTO public.presupuestos (
    id, user_id, paciente_id, folio, paciente_nombre, clinica_id, estado, plan_pago
  ) VALUES (
    v_presupuesto_valido_legacy, v_actor, v_paciente, 'TEST-BP08-LEGACY', 'Test BP08', v_clinica, 'borrador',
    pg_catalog.jsonb_build_object('modalidad', 'cuotas-sin-interes', 'numeroCuotas', v_cuotas_validas)
  );

  SELECT count(*) INTO v_auditoria_antes
  FROM public.audit_log
  WHERE record_id IN (v_presupuesto_descuento::text, v_presupuesto_cuotas::text);

  BEGIN
    INSERT INTO public.presupuestos (
      id, user_id, paciente_id, folio, paciente_nombre, clinica_id, estado, descuento_global_pct
    ) VALUES (
      v_presupuesto_descuento, v_actor, v_paciente, 'TEST-BP08-DESCUENTO-RECHAZADO', 'Test BP08', v_clinica, 'borrador',
      v_descuento_excedido
    );
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Se aceptó un descuento sobre el máximo';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.presupuestos (
      id, user_id, paciente_id, folio, paciente_nombre, clinica_id, estado, plan_pago
    ) VALUES (
      v_presupuesto_cuotas, v_actor, v_paciente, 'TEST-BP08-CUOTAS-RECHAZADAS', 'Test BP08', v_clinica, 'borrador',
      pg_catalog.jsonb_build_object('modalidad', 'cuotas', 'cuotas', v_cuotas_validas + 1)
    );
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Se aceptó un número de cuotas sobre el máximo';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  SELECT count(*) INTO v_versiones_legacy_antes
  FROM public.presupuesto_versiones
  WHERE presupuesto_id = v_presupuesto_valido_legacy;
  SELECT count(*) INTO v_auditoria_legacy_antes
  FROM public.audit_log
  WHERE record_id = v_presupuesto_valido_legacy::text;
  BEGIN
    UPDATE public.presupuestos
    SET plan_pago = pg_catalog.jsonb_build_object(
      'modalidad', 'cuotas-sin-interes', 'numeroCuotas', v_cuotas_validas + 1
    )
    WHERE id = v_presupuesto_valido_legacy;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Se aceptó actualizar cuotas sobre el máximo';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  -- Lowering clinic settings does not rewrite or block edits to existing terms.
  -- This setting change and all audit rows roll back with the test transaction.
  UPDATE public.clinicas
  SET configuracion_financiera = pg_catalog.jsonb_set(
    configuracion_financiera,
    '{descuentoMaximoPermitidoPct}',
    pg_catalog.to_jsonb(v_descuento_maximo / 2)
  )
  WHERE id = v_clinica;
  UPDATE public.presupuestos
  SET observacion = 'BP08 transactional test'
  WHERE id = v_presupuesto_valido;

  SELECT count(*) INTO v_versiones_antes
  FROM public.presupuesto_versiones
  WHERE presupuesto_id = v_presupuesto_valido;
  SELECT count(*) INTO v_auditoria_valido_antes
  FROM public.audit_log
  WHERE record_id = v_presupuesto_valido::text;
  BEGIN
    UPDATE public.presupuestos
    SET descuento_global_pct = v_descuento_excedido
    WHERE id = v_presupuesto_valido;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Se aceptó actualizar un descuento sobre el máximo';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  IF NOT EXISTS (
      SELECT 1 FROM public.presupuestos
      WHERE id = v_presupuesto_valido
        AND descuento_global_pct = v_descuento_maximo
        AND observacion = 'BP08 transactional test'
    ) OR (SELECT count(*) FROM public.presupuesto_versiones
          WHERE presupuesto_id = v_presupuesto_valido) <> v_versiones_antes
    OR (SELECT count(*) FROM public.audit_log
        WHERE record_id = v_presupuesto_valido::text) <> v_auditoria_valido_antes
    OR NOT EXISTS (
      SELECT 1 FROM public.presupuestos
      WHERE id = v_presupuesto_valido_legacy
        AND plan_pago->>'numeroCuotas' = v_cuotas_validas::text
    ) OR (SELECT count(*) FROM public.presupuesto_versiones
          WHERE presupuesto_id = v_presupuesto_valido_legacy) <> v_versiones_legacy_antes
    OR (SELECT count(*) FROM public.audit_log
        WHERE record_id = v_presupuesto_valido_legacy::text) <> v_auditoria_legacy_antes THEN
    RAISE EXCEPTION 'El rechazo de actualización dejó efectos en el presupuesto o su historial';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.presupuestos
    WHERE id IN (v_presupuesto_descuento, v_presupuesto_cuotas)
  ) OR EXISTS (
    SELECT 1 FROM public.presupuesto_versiones
    WHERE presupuesto_id IN (v_presupuesto_descuento, v_presupuesto_cuotas)
  ) OR EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE record_id IN (v_presupuesto_descuento::text, v_presupuesto_cuotas::text)
  ) OR v_auditoria_antes <> 0 THEN
    RAISE EXCEPTION 'El rechazo de escritura dejó filas o eventos de auditoría';
  END IF;
END;
$test$;

-- Verify that reception can use the same shared clinic limits under its own
-- RLS context (the budget module permits reception to manage budgets).
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('bp08.test.recepcion_user', true),
  true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('bp08.test.recepcion_user', true),
    'role', 'authenticated'
  )::text,
  true
);

DO $reception_test$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_paciente uuid;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['recepcion']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se pudo preparar el contexto de recepción';
  END IF;

  SELECT p.id INTO v_paciente
  FROM public.pacientes AS p
  WHERE p.clinica_id = v_clinica
  ORDER BY p.id
  LIMIT 1;
  IF v_paciente IS NULL THEN
    RAISE EXCEPTION 'El test requiere un paciente accesible a recepción';
  END IF;

  INSERT INTO public.presupuestos (
    user_id, paciente_id, folio, paciente_nombre, clinica_id, estado,
    descuento_global_pct, plan_pago
  ) VALUES (
    v_actor, v_paciente, 'TEST-BP08-RECEPCION', 'Test BP08', v_clinica, 'borrador',
    (SELECT (c.configuracion_financiera->>'descuentoMaximoPermitidoPct')::numeric
     FROM public.clinicas AS c WHERE c.id = v_clinica),
    (SELECT pg_catalog.jsonb_build_object(
       'modalidad', 'cuotas',
       'cuotas', pg_catalog.floor((c.configuracion_financiera->>'maximoCuotasSinInteres')::numeric)
     ) FROM public.clinicas AS c WHERE c.id = v_clinica)
  );
END;
$reception_test$;

ROLLBACK;
