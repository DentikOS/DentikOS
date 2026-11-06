-- BP12 traceability/alerts integration coverage. Fixtures and all effects roll back.
BEGIN;

CREATE TEMP TABLE bp12_trace_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  dentista_id uuid NOT NULL,
  recepcion_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  laboratorio_id uuid NOT NULL,
  tipo_id uuid NOT NULL,
  orden_original_id uuid NOT NULL,
  archivo_id uuid NOT NULL,
  garantia_id uuid NOT NULL,
  orden_vencida_id uuid NOT NULL,
  orden_proxima_id uuid NOT NULL,
  orden_prueba_id uuid NOT NULL,
  orden_pago_id uuid NOT NULL
) ON COMMIT DROP;

DO $setup$
DECLARE
  v_clinica_a uuid;
  v_clinica_b uuid;
  v_admin uuid;
  v_dentista uuid;
  v_recepcion uuid;
  v_paciente uuid;
  v_lab uuid := gen_random_uuid();
  v_tipo uuid := gen_random_uuid();
  v_original uuid := gen_random_uuid();
  v_archivo uuid := gen_random_uuid();
  v_garantia uuid := gen_random_uuid();
BEGIN
  SELECT mc.clinica_id,
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'admin'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'dentista'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'recepcion'))[1]
    INTO v_clinica_a, v_admin, v_dentista, v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.activo
  GROUP BY mc.clinica_id
  HAVING count(*) FILTER (WHERE mc.rol::text = 'admin') > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'dentista') > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'recepcion') > 0
  ORDER BY mc.clinica_id
  LIMIT 1;
  IF v_clinica_a IS NULL THEN
    RAISE EXCEPTION 'BP12 traceability test requires active admin, dentist, and reception memberships';
  END IF;

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP12 trace rollback ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_b;
  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES (v_clinica_b, v_admin, 'admin'::public.app_role, true);

  INSERT INTO public.pacientes (clinica_id, user_id, nombre, rut)
  VALUES (v_clinica_a, v_admin, 'BP12 trace rollback patient', 'BP12-' || replace(gen_random_uuid()::text, '-', ''))
  RETURNING id INTO v_paciente;
  INSERT INTO public.laboratorios (id, clinica_id, nombre, tipo, created_by)
  VALUES (v_lab, v_clinica_a, 'BP12 trace rollback lab', 'externo', v_admin);
  INSERT INTO public.laboratorio_tipos_trabajo (id, clinica_id, categoria, nombre, created_by)
  VALUES (v_tipo, v_clinica_a, 'protesis_fija', 'BP12 trace rollback type', v_admin);

  INSERT INTO pg_temp.bp12_trace_fixture (
    clinica_a, clinica_b, admin_id, dentista_id, recepcion_id, paciente_id,
    laboratorio_id, tipo_id, orden_original_id, archivo_id, garantia_id,
    orden_vencida_id, orden_proxima_id, orden_prueba_id, orden_pago_id
  ) VALUES (
    v_clinica_a, v_clinica_b, v_admin, v_dentista, v_recepcion, v_paciente,
    v_lab, v_tipo, v_original, v_archivo, v_garantia,
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  );
END;
$setup$;

GRANT SELECT, UPDATE ON pg_temp.bp12_trace_fixture TO authenticated;

-- Dentist delivers an order, links R2 evidence, and creates an idempotent claim.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true)
FROM pg_temp.bp12_trace_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_trace_fixture;
SET LOCAL ROLE authenticated;
DO $claim$
DECLARE
  v_fixture record;
  v_garantia uuid;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  INSERT INTO public.ordenes_laboratorio (
    id, clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
  ) VALUES (
    v_fixture.orden_original_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.laboratorio_id, v_fixture.tipo_id
  );
  PERFORM public.transicionar_orden_laboratorio(
    v_fixture.orden_original_id, 'entrega', 'Orden entregada para test',
    'c1200000-0000-4000-8000-000000000001'::uuid, 1
  );
  INSERT INTO public.archivos_clinicos (
    id, clinica_id, paciente_id, r2_object_key, nombre_archivo, mime_type,
    tamano_bytes, categoria, uploaded_by, metadata, orden_laboratorio_id
  ) VALUES (
    v_fixture.archivo_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.clinica_a::text || '/' || v_fixture.paciente_id::text || '/laboratorio/' || v_fixture.archivo_id::text,
    'evidencia.jpg', 'image/jpeg', 100, 'laboratorio', v_fixture.dentista_id,
    '{"tipo_documento":"evidencia_garantia"}'::jsonb, v_fixture.orden_original_id
  );
  SELECT (public.crear_reclamo_garantia_laboratorio(
    v_fixture.orden_original_id, 'Motivo clínico del reproceso', v_fixture.archivo_id,
    'c1200000-0000-4000-8000-000000000002'::uuid
  )->>'id')::uuid INTO v_garantia;
  IF (public.crear_reclamo_garantia_laboratorio(
    v_fixture.orden_original_id, 'Motivo clínico del reproceso', v_fixture.archivo_id,
    'c1200000-0000-4000-8000-000000000002'::uuid
  )->>'id')::uuid IS DISTINCT FROM v_garantia THEN
    RAISE EXCEPTION 'Idempotent guarantee claim replay returned a different record';
  END IF;
  UPDATE pg_temp.bp12_trace_fixture SET garantia_id = v_garantia;
END;
$claim$;
RESET ROLE;

-- A receptionist cannot resolve a guarantee, and a cross-clinic selection is denied.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp12_trace_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_trace_fixture;
SET LOCAL ROLE authenticated;
DO $denied$
DECLARE
  v_fixture record;
  v_failed boolean := false;
  v_orders bigint;
  v_history bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  SELECT count(*) INTO v_orders FROM public.ordenes_laboratorio;
  SELECT count(*) INTO v_history FROM public.garantias_laboratorio_historial;
  BEGIN
    PERFORM public.resolver_garantia_laboratorio(v_fixture.garantia_id, 'aprobar', 'laboratorio', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Reception resolved a laboratory guarantee'; END IF;
  IF (SELECT count(*) FROM public.ordenes_laboratorio) <> v_orders
     OR (SELECT count(*) FROM public.garantias_laboratorio_historial) <> v_history THEN
    RAISE EXCEPTION 'Denied guarantee resolution left order or history side effects';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.recepcion_id, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_b)
  )::text, true);
  v_failed := false;
  BEGIN
    PERFORM public.resolver_garantia_laboratorio(v_fixture.garantia_id, 'aprobar', 'laboratorio', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Cross-clinic guarantee resolution was accepted'; END IF;
END;
$denied$;
RESET ROLE;

-- Admin approval creates one replacement, closes the original claim, and writes zero cost/price.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_trace_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_trace_fixture;
SET LOCAL ROLE authenticated;
DO $approved$
DECLARE
  v_fixture record;
  v_result jsonb;
  v_replacement uuid;
  v_count bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  v_result := public.resolver_garantia_laboratorio(v_fixture.garantia_id, 'aprobar', 'laboratorio', NULL, NULL);
  v_replacement := (v_result->>'orden_reposicion_id')::uuid;
  IF v_replacement IS NULL OR v_result->>'estado' <> 'repuesto' THEN
    RAISE EXCEPTION 'Approved claim did not return a replacement order';
  END IF;
  PERFORM public.resolver_garantia_laboratorio(v_fixture.garantia_id, 'aprobar', 'laboratorio', NULL, NULL);
  SELECT count(*) INTO v_count FROM public.ordenes_laboratorio
  WHERE garantia_id = v_fixture.garantia_id AND es_reposicion;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Guarantee replay created more than one replacement'; END IF;
  IF (SELECT etapa_actual FROM public.ordenes_laboratorio WHERE id = v_fixture.orden_original_id) <> 'entrega' THEN
    RAISE EXCEPTION 'The delivered original order was modified';
  END IF;
  IF (SELECT costo_total FROM public.ordenes_laboratorio_costos WHERE orden_id = v_replacement) <> 0
     OR (SELECT precio_paciente FROM public.ordenes_laboratorio_costos WHERE orden_id = v_replacement) <> 0 THEN
    RAISE EXCEPTION 'Laboratory-responsibility replacement is not zero cost and zero price';
  END IF;
  IF (SELECT count(*) FROM public.garantias_laboratorio_historial WHERE garantia_id = v_fixture.garantia_id) <> 3 THEN
    RAISE EXCEPTION 'Guarantee history did not record claim, approval, and replacement';
  END IF;
  IF (SELECT count(*) FROM public.archivos_clinicos WHERE id = v_fixture.archivo_id AND orden_laboratorio_id = v_fixture.orden_original_id) <> 1 THEN
    RAISE EXCEPTION 'The evidence file lost its original-order link';
  END IF;
END;
$approved$;

-- Tenant/patient mismatches, missing evidence, direct writes, and changed links fail closed.
DO $integrity$
DECLARE
  v_fixture record;
  v_failed boolean;
  v_before bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  SELECT count(*) INTO v_before FROM public.garantias_laboratorio;
  v_failed := false;
  BEGIN
    PERFORM public.crear_reclamo_garantia_laboratorio(
      v_fixture.orden_original_id, 'Otro reclamo', NULL,
      'c1200000-0000-4000-8000-000000000003'::uuid
    );
  EXCEPTION WHEN OTHERS THEN v_failed := true;
  END;
  IF NOT v_failed OR (SELECT count(*) FROM public.garantias_laboratorio) <> v_before THEN
    RAISE EXCEPTION 'Missing evidence was accepted or left a guarantee row';
  END IF;

  v_failed := false;
  BEGIN
    UPDATE public.archivos_clinicos SET orden_laboratorio_id = gen_random_uuid()
    WHERE id = v_fixture.archivo_id;
  EXCEPTION WHEN OTHERS THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Clinical file order link was mutable'; END IF;
END;
$integrity$;
RESET ROLE;

-- Configure thresholds and fixtures for all seven alerts.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_trace_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_trace_fixture;
SET LOCAL ROLE authenticated;
DO $alerts_setup$
DECLARE
  v_fixture record;
  v_index integer;
  v_fecha_local date;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  SELECT timezone(coalesce(nullif(c.zona_horaria, ''), 'UTC'), clock_timestamp())::date
    INTO v_fecha_local
  FROM public.clinicas c WHERE c.id = v_fixture.clinica_a;
  INSERT INTO public.configuracion_alertas_laboratorio (
    clinica_id, dias_antes_entrega, dias_prueba_inactiva, dias_pago_pendiente,
    ordenes_por_mes, tasa_reproceso_porcentaje, creado_por, actualizado_por
  ) VALUES (
    v_fixture.clinica_a, 1, 5, 15, 10, 5, v_fixture.admin_id, v_fixture.admin_id
  );
  INSERT INTO public.ordenes_laboratorio (
    id, clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id, fecha_solicitud, fecha_estimada_entrega
  )
  SELECT v_fixture.orden_vencida_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.laboratorio_id, v_fixture.tipo_id, v_fecha_local - 30, v_fecha_local - 1
  UNION ALL SELECT v_fixture.orden_proxima_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.laboratorio_id, v_fixture.tipo_id, v_fecha_local - 1, v_fecha_local + 1
  UNION ALL SELECT v_fixture.orden_prueba_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.laboratorio_id, v_fixture.tipo_id, v_fecha_local - 15, NULL
  UNION ALL SELECT v_fixture.orden_pago_id, v_fixture.clinica_a, v_fixture.paciente_id,
    v_fixture.laboratorio_id, v_fixture.tipo_id, v_fecha_local - 45, NULL;
  PERFORM public.transicionar_orden_laboratorio(
    v_fixture.orden_prueba_id, 'prueba', 'Prueba en curso', 'c1200000-0000-4000-8000-000000000004'::uuid, 1
  );
  PERFORM public.guardar_costo_orden_laboratorio(v_fixture.orden_pago_id, 10000, 12000);
  FOR v_index IN 1..6 LOOP
    INSERT INTO public.ordenes_laboratorio (
      clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id
    ) VALUES (
      v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_id, v_fixture.tipo_id
    );
  END LOOP;
END;
$alerts_setup$;
RESET ROLE;

-- Age only test fixture timestamps, then run the private scheduler as postgres.
UPDATE public.historial_etapas_laboratorio
SET registrado_en = clock_timestamp() - interval '6 days'
WHERE orden_id = (SELECT orden_prueba_id FROM pg_temp.bp12_trace_fixture)
  AND etapa = 'prueba';
UPDATE public.ordenes_laboratorio_costos
SET created_at = clock_timestamp() - interval '16 days'
WHERE orden_id = (SELECT orden_pago_id FROM pg_temp.bp12_trace_fixture);

DO $alerts_run$
DECLARE
  v_fixture record;
  v_types text[];
  v_before bigint;
  v_after bigint;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_trace_fixture;
  PERFORM public.generar_alertas_laboratorio();
  SELECT array_agg(DISTINCT tipo ORDER BY tipo) INTO v_types
  FROM public.alertas_laboratorio_estado
  WHERE clinica_id = v_fixture.clinica_a AND activo;
  IF NOT (v_types @> ARRAY[
    'entrega_proxima', 'entrega_vencida', 'prueba_pendiente', 'prueba_estancada',
    'pago_pendiente', 'volumen_laboratorio', 'reproceso_laboratorio'
  ]::text[]) THEN
    RAISE EXCEPTION 'The scheduler did not create all seven BP12 alert types';
  END IF;
  SELECT count(*) INTO v_before FROM public.notificaciones
  WHERE clinic_id = v_fixture.clinica_a AND metadata->>'source' = 'bp12_laboratorio';
  PERFORM public.generar_alertas_laboratorio();
  SELECT count(*) INTO v_after FROM public.notificaciones
  WHERE clinic_id = v_fixture.clinica_a AND metadata->>'source' = 'bp12_laboratorio';
  IF v_after <> v_before THEN RAISE EXCEPTION 'Repeated daily alert run created duplicate notifications'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.clinic_id = v_fixture.clinica_a AND n.metadata->>'source' = 'bp12_laboratorio'
      AND n.dedupe_key IS NULL
  ) THEN
    RAISE EXCEPTION 'A laboratory notification was missing its persisted dedupe key';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.clinic_id = v_fixture.clinica_a AND n.metadata->>'alert_key' LIKE 'pago_pendiente:%'
      AND n.message LIKE '%10000%'
  ) THEN
    RAISE EXCEPTION 'A payment notification exposed a financial amount';
  END IF;
END;
$alerts_run$;

ROLLBACK;
