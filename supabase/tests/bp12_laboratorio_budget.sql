-- BP12/BP07 integration and atomicity coverage. All fixtures, audit rows,
-- orders, costs and timeline events are rolled back at the end.
BEGIN;

CREATE TEMP TABLE bp12_budget_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  recepcion_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  laboratorio_a uuid NOT NULL,
  laboratorio_b uuid NOT NULL,
  tipo_a uuid NOT NULL,
  tipo_b uuid NOT NULL,
  presupuesto_id uuid NOT NULL,
  item_id uuid NOT NULL,
  presupuesto_recepcion_id uuid NOT NULL,
  item_recepcion_id uuid NOT NULL
) ON COMMIT DROP;

DO $setup$
DECLARE
  v_clinica_a uuid;
  v_clinica_b uuid;
  v_admin uuid;
  v_recepcion uuid;
  v_paciente uuid;
  v_lab_a uuid := gen_random_uuid();
  v_lab_b uuid := gen_random_uuid();
  v_tipo_a uuid := gen_random_uuid();
  v_tipo_b uuid := gen_random_uuid();
  v_budget uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_budget_recepcion uuid := gen_random_uuid();
  v_item_recepcion uuid := gen_random_uuid();
BEGIN
  SELECT mc.clinica_id,
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'admin'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'recepcion'))[1]
    INTO v_clinica_a, v_admin, v_recepcion
  FROM public.miembros_clinica mc
  WHERE mc.activo
  GROUP BY mc.clinica_id
  HAVING count(*) FILTER (WHERE mc.rol::text = 'admin') > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'recepcion') > 0
  ORDER BY mc.clinica_id LIMIT 1;
  IF v_clinica_a IS NULL THEN
    RAISE EXCEPTION 'BP12 budget test requires active admin and reception memberships';
  END IF;

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP12 budget rollback ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_b;
  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES (v_clinica_b, v_admin, 'admin'::public.app_role, true);
  INSERT INTO public.pacientes (clinica_id, user_id, nombre, rut)
  VALUES (v_clinica_a, v_admin, 'BP12 budget rollback patient', 'BP12-' || replace(gen_random_uuid()::text, '-', ''))
  RETURNING id INTO v_paciente;
  INSERT INTO public.laboratorios (id, clinica_id, nombre, tipo, created_by)
  VALUES
    (v_lab_a, v_clinica_a, 'BP12 budget lab A', 'externo', v_admin),
    (v_lab_b, v_clinica_b, 'BP12 budget lab B', 'externo', v_admin);
  INSERT INTO public.laboratorio_tipos_trabajo (id, clinica_id, categoria, nombre, dias_estimados, created_by)
  VALUES
    (v_tipo_a, v_clinica_a, 'protesis_fija', 'BP12 budget type A', 6, v_admin),
    (v_tipo_b, v_clinica_b, 'protesis_fija', 'BP12 budget type B', 6, v_admin);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica_a)
  )::text, true);
  INSERT INTO public.laboratorio_precios (
    clinica_id, laboratorio_id, tipo_trabajo_id, costo, created_by
  ) VALUES (v_clinica_a, v_lab_a, v_tipo_a, 82000, v_admin);

  INSERT INTO pg_temp.bp12_budget_fixture VALUES (
    v_clinica_a, v_clinica_b, v_admin, v_recepcion, v_paciente,
    v_lab_a, v_lab_b, v_tipo_a, v_tipo_b,
    v_budget, v_item, v_budget_recepcion, v_item_recepcion
  );
END;
$setup$;

GRANT SELECT, UPDATE ON pg_temp.bp12_budget_fixture TO authenticated;

-- Admin saves an explicitly classified budget item through the same BP09
-- atomic sync entry point used by the frontend.
SELECT set_config('request.jwt.claim.sub', admin_id::text, true)
FROM pg_temp.bp12_budget_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_budget_fixture;
SET LOCAL ROLE authenticated;
DO $admin_sync$
DECLARE
  v_fixture record;
  v_item jsonb;
  v_presupuesto jsonb;
  v_id uuid;
  v_orden uuid;
  v_folio text;
  v_failed boolean := false;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_budget_fixture;
  v_item := jsonb_build_object(
    'id', v_fixture.item_id,
    'paciente_id', v_fixture.paciente_id,
    'prestacion_nombre', 'BP12 order item',
    'valor', 150000,
    'convenio', 'Particular',
    'estado', 'Pendiente',
    'es_laboratorio', true,
    'laboratorio_id', v_fixture.laboratorio_a,
    'tipo_trabajo_laboratorio_id', v_fixture.tipo_a,
    'pieza_dentaria', '36',
    'color_guia', 'A2',
    'indicaciones_tecnicas', 'Rollback fixture only'
  );
  v_presupuesto := jsonb_build_object(
    'id', v_fixture.presupuesto_id,
    'paciente_id', v_fixture.paciente_id,
    'folio', 'BP12-BUDGET-' || replace(v_fixture.presupuesto_id::text, '-', ''),
    'paciente_nombre', 'BP12 budget rollback patient',
    'paciente_rut', 'TEST', 'fecha_emision', CURRENT_DATE,
    'convenio', 'Particular', 'moneda', 'CLP',
    'monto_total', 150000, 'estado', 'borrador',
    'observacion', '', 'detalle_items', jsonb_build_array(v_item)
  );
  v_id := public.sincronizar_presupuesto_offline_bp12(
    v_presupuesto, jsonb_build_array(v_item), NULL
  );
  IF v_id IS DISTINCT FROM v_fixture.presupuesto_id THEN
    RAISE EXCEPTION 'BP12 budget sync returned an unexpected budget ID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.presupuesto_items bi
    WHERE bi.id = v_fixture.item_id AND bi.clinica_id = v_fixture.clinica_a
      AND bi.presupuesto_id = v_fixture.presupuesto_id
      AND bi.paciente_id = v_fixture.paciente_id AND bi.es_laboratorio
      AND bi.tipo_trabajo_laboratorio_id = v_fixture.tipo_a
  ) THEN
    RAISE EXCEPTION 'Explicit lab classification was not persisted';
  END IF;

  -- A known ID from another clinic must fail and leave no budget behind.
  v_failed := false;
  BEGIN
    v_item := jsonb_build_object(
      'id', gen_random_uuid(), 'paciente_id', v_fixture.paciente_id,
      'prestacion_nombre', 'Cross clinic lab item', 'valor', 1000,
      'es_laboratorio', true,
      'laboratorio_id', v_fixture.laboratorio_b,
      'tipo_trabajo_laboratorio_id', v_fixture.tipo_a
    );
    v_presupuesto := jsonb_build_object(
      'id', gen_random_uuid(), 'paciente_id', v_fixture.paciente_id,
      'folio', 'BP12-CROSS-' || gen_random_uuid()::text,
      'paciente_nombre', 'BP12 budget rollback patient',
      'estado', 'borrador', 'detalle_items', jsonb_build_array(v_item)
    );
    PERFORM public.sincronizar_presupuesto_offline_bp12(
      v_presupuesto, jsonb_build_array(v_item), NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Cross-clinic lab reference was accepted'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuestos WHERE folio LIKE 'BP12-CROSS-%') THEN
    RAISE EXCEPTION 'Cross-clinic rejection left a budget side effect';
  END IF;

  -- Accepting the budget creates one order and snapshots the configured cost.
  UPDATE public.presupuestos SET estado = 'Aprobado'
  WHERE id = v_fixture.presupuesto_id AND clinica_id = v_fixture.clinica_a;
  SELECT o.id, o.folio INTO v_orden, v_folio
  FROM public.ordenes_laboratorio o
  WHERE o.clinica_id = v_fixture.clinica_a AND o.presupuesto_item_id = v_fixture.item_id;
  IF v_orden IS NULL THEN RAISE EXCEPTION 'Budget acceptance did not create a laboratory order'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ordenes_laboratorio o
    WHERE o.id = v_orden AND o.presupuesto_id = v_fixture.presupuesto_id
      AND o.paciente_id = v_fixture.paciente_id AND o.laboratorio_id = v_fixture.laboratorio_a
      AND o.pieza_dentaria = '36'
  ) THEN
    RAISE EXCEPTION 'The created order has incorrect clinic, patient, or item source';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ordenes_laboratorio_costos c
    WHERE c.clinica_id = v_fixture.clinica_a AND c.orden_id = v_orden
      AND c.costo_total = 82000 AND c.precio_paciente = 150000
  ) THEN
    RAISE EXCEPTION 'Configured lab cost and accepted patient price were not snapshotted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.timeline_paciente t
    WHERE t.clinica_id = v_fixture.clinica_a AND t.paciente_id = v_fixture.paciente_id
      AND t.metadata->>'orden_laboratorio_id' = v_orden::text
  ) THEN
    RAISE EXCEPTION 'Order creation was not written to the patient timeline';
  END IF;

  UPDATE public.presupuestos SET estado = 'Aprobado'
  WHERE id = v_fixture.presupuesto_id AND clinica_id = v_fixture.clinica_a;
  IF (SELECT count(*) FROM public.ordenes_laboratorio o
      WHERE o.clinica_id = v_fixture.clinica_a AND o.presupuesto_item_id = v_fixture.item_id) <> 1 THEN
    RAISE EXCEPTION 'Repeated acceptance created a duplicate laboratory order';
  END IF;

  PERFORM public.transicionar_orden_laboratorio(
    v_orden, 'entrega', 'Rollback status sync',
    'd1200000-0000-4000-8000-000000000001'::uuid, 1
  );
  IF (SELECT estado FROM public.presupuesto_items WHERE id = v_fixture.item_id) <> 'Realizado' THEN
    RAISE EXCEPTION 'Order delivery did not update the budget item';
  END IF;

  v_failed := false;
  BEGIN
    UPDATE public.presupuesto_items SET es_laboratorio = false
    WHERE id = v_fixture.item_id AND clinica_id = v_fixture.clinica_a;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Client changed an accepted linked lab item'; END IF;
END;
$admin_sync$;
RESET ROLE;

-- Reception accepts a budget with an explicitly classified lab item. The
-- order guard must downgrade it to a limited, unassigned request.
SELECT set_config('request.jwt.claim.sub', recepcion_id::text, true)
FROM pg_temp.bp12_budget_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', recepcion_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_budget_fixture;
SET LOCAL ROLE authenticated;
DO $reception$
DECLARE
  v_fixture record;
  v_item jsonb;
  v_presupuesto jsonb;
  v_orden public.ordenes_laboratorio%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_budget_fixture;
  v_item := jsonb_build_object(
    'id', v_fixture.item_recepcion_id, 'paciente_id', v_fixture.paciente_id,
    'prestacion_nombre', 'BP12 reception order item', 'valor', 25000,
    'es_laboratorio', true, 'laboratorio_id', v_fixture.laboratorio_a,
    'tipo_trabajo_laboratorio_id', v_fixture.tipo_a,
    'pieza_dentaria', '24', 'indicaciones_tecnicas', 'Must not reach limited order'
  );
  v_presupuesto := jsonb_build_object(
    'id', v_fixture.presupuesto_recepcion_id, 'paciente_id', v_fixture.paciente_id,
    'folio', 'BP12-RECEPTION-' || replace(v_fixture.presupuesto_recepcion_id::text, '-', ''),
    'paciente_nombre', 'BP12 budget rollback patient',
    'estado', 'borrador', 'detalle_items', jsonb_build_array(v_item)
  );
  PERFORM public.sincronizar_presupuesto_offline_bp12(
    v_presupuesto, jsonb_build_array(v_item), NULL
  );
  UPDATE public.presupuestos SET estado = 'Aprobado'
  WHERE id = v_fixture.presupuesto_recepcion_id AND clinica_id = v_fixture.clinica_a;
  SELECT o.* INTO v_orden FROM public.ordenes_laboratorio o
  WHERE o.clinica_id = v_fixture.clinica_a AND o.presupuesto_item_id = v_fixture.item_recepcion_id;
  IF NOT FOUND OR NOT v_orden.solicitud_limitada OR v_orden.laboratorio_id IS NOT NULL
     OR v_orden.plantilla_id IS NOT NULL OR v_orden.pieza_dentaria IS NOT NULL
     OR v_orden.indicaciones_tecnicas IS NOT NULL THEN
    RAISE EXCEPTION 'Reception did not receive a limited laboratory request';
  END IF;
END;
$reception$;
RESET ROLE;

ROLLBACK;
