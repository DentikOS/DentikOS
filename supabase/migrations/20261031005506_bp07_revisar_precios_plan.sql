-- BP07: revisión explícita de precios del borrador hacia el plan clínico.
-- SECURITY INVOKER conserva RLS; los locks evitan aplicar decisiones sobre revisiones obsoletas.
BEGIN;

CREATE FUNCTION public.revisar_precios_plan_desde_presupuesto(
  p_presupuesto_id uuid,
  p_paciente_id uuid,
  p_plan_revision text,
  p_version_esperada integer,
  p_motivo text
) RETURNS TABLE(nueva_revision text, nueva_version integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_presupuesto public.presupuestos%ROWTYPE;
  v_ficha public.fichas_clinicas%ROWTYPE;
  v_plan jsonb;
  v_items jsonb;
  v_fi integer;
  v_pi integer;
  v_ii integer;
  v_item_index integer;
  v_proc jsonb;
  v_item jsonb;
  v_proc_id text;
  v_precio integer;
  v_ids text[] := ARRAY[]::text[];
  v_total_plan integer := 0;
  v_total_items integer := 0;
  v_diferencias integer := 0;
  v_revision text;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true
    OR p_presupuesto_id IS NULL OR p_paciente_id IS NULL
    OR nullif(btrim(p_plan_revision),'') IS NULL OR length(p_plan_revision) > 100
    OR p_version_esperada IS NULL OR p_version_esperada < 1
    OR nullif(btrim(p_motivo),'') IS NULL OR length(btrim(p_motivo)) > 500 THEN
    RAISE EXCEPTION 'Revisión de precios no autorizada o datos inválidos';
  END IF;

  SELECT * INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica
      AND b.paciente_id = p_paciente_id FOR UPDATE;
  IF NOT FOUND OR NOT v_presupuesto.origen_plan
    OR v_presupuesto.estado NOT IN ('borrador','Borrador')
    OR v_presupuesto.version IS DISTINCT FROM p_version_esperada
    OR COALESCE(v_presupuesto.monto_abonado,0) <> 0
    OR v_presupuesto.version_grupo_id IS NULL
    OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.clinica_id = v_clinica AND b.version_grupo_id = v_presupuesto.version_grupo_id
        AND b.version > v_presupuesto.version) THEN
    RAISE EXCEPTION 'El borrador vinculado ya no está disponible para revisión';
  END IF;

  SELECT * INTO v_ficha FROM public.fichas_clinicas f
    WHERE f.clinica_id = v_clinica AND f.paciente_id = p_paciente_id FOR UPDATE;
  IF NOT FOUND OR v_ficha.plan_tratamiento->>'actualizadoAt' IS DISTINCT FROM p_plan_revision
    OR jsonb_typeof(v_ficha.plan_tratamiento->'fases') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_presupuesto.detalle_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'El plan o el presupuesto cambió; vuelva a revisar los precios';
  END IF;

  v_plan := v_ficha.plan_tratamiento;
  v_items := v_presupuesto.detalle_items;
  IF jsonb_array_length(v_items) = 0 OR jsonb_array_length(v_plan->'fases') = 0 THEN
    RAISE EXCEPTION 'El plan vinculado no contiene prestaciones revisables';
  END IF;
  FOR v_ii IN 0..jsonb_array_length(v_items)-1 LOOP
    IF nullif(v_items->v_ii->>'origenPlanProcedimientoId','') IS NOT NULL THEN
      v_total_items := v_total_items + 1;
    END IF;
  END LOOP;

  FOR v_fi IN 0..jsonb_array_length(v_plan->'fases')-1 LOOP
    IF jsonb_typeof(v_plan->'fases'->v_fi->'procedimientos') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Fase clínica inválida';
    END IF;
    IF jsonb_array_length(v_plan->'fases'->v_fi->'procedimientos') = 0 THEN CONTINUE; END IF;
    FOR v_pi IN 0..jsonb_array_length(v_plan->'fases'->v_fi->'procedimientos')-1 LOOP
      v_proc := v_plan->'fases'->v_fi->'procedimientos'->v_pi;
      v_proc_id := nullif(v_proc->>'id','');
      IF v_proc_id IS NULL OR v_proc_id = ANY(v_ids)
        OR nullif(v_proc->>'prestacionId','') IS NULL
        OR COALESCE((v_proc->>'requiereRevision')::boolean,false)
        OR COALESCE(v_proc->>'costo','') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Procedimiento clínico no revisable';
      END IF;
      v_ids := array_append(v_ids,v_proc_id);
      v_total_plan := v_total_plan + 1;
      v_item_index := -1;
      FOR v_ii IN 0..jsonb_array_length(v_items)-1 LOOP
        IF v_items->v_ii->>'origenPlanProcedimientoId' = v_proc_id THEN
          IF v_item_index >= 0 THEN RAISE EXCEPTION 'Prestación duplicada en el presupuesto'; END IF;
          v_item_index := v_ii;
        END IF;
      END LOOP;
      IF v_item_index < 0 THEN RAISE EXCEPTION 'El presupuesto no coincide con el plan'; END IF;
      v_item := v_items->v_item_index;
      IF v_item->>'codigoPrestacion' IS DISTINCT FROM v_proc->>'prestacionId'
        OR v_item->>'cantidad' IS DISTINCT FROM '1'
        OR COALESCE(v_item->>'precioUnitario','') !~ '^[1-9][0-9]*$'
        OR COALESCE(v_item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(v_item->>'subtotal','') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Prestación o precio incompatible con el plan';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.presupuesto_items bi
        WHERE bi.id = (v_item->>'id')::uuid AND bi.presupuesto_id = p_presupuesto_id
          AND bi.paciente_id = p_paciente_id AND bi.clinica_id = v_clinica
          AND bi.valor = (v_item->>'subtotal')::integer) THEN
        RAISE EXCEPTION 'Ítem del presupuesto no sincronizado';
      END IF;
      v_precio := (v_item->>'precioUnitario')::integer;
      IF v_precio IS DISTINCT FROM (v_proc->>'costo')::integer THEN
        v_plan := jsonb_set(v_plan, ARRAY['fases',v_fi::text,'procedimientos',v_pi::text,'costo'],to_jsonb(v_precio));
        v_items := jsonb_set(v_items, ARRAY[v_item_index::text,'precioPlanOriginal'],to_jsonb(v_precio));
        v_diferencias := v_diferencias + 1;
      END IF;
    END LOOP;
  END LOOP;
  IF v_total_plan = 0 OR v_total_plan <> v_total_items OR v_diferencias = 0 THEN
    RAISE EXCEPTION 'No hay una diferencia de precio revisable';
  END IF;

  v_revision := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_plan := v_plan || jsonb_build_object('actualizadoAt',v_revision,
    'ultimaRevisionPrecio',jsonb_build_object('presupuestoId',p_presupuesto_id,
      'actorUserId',auth.uid(),'motivo',btrim(p_motivo),'fecha',v_revision));
  UPDATE public.fichas_clinicas SET plan_tratamiento = v_plan, updated_at = clock_timestamp()
    WHERE clinica_id = v_clinica AND paciente_id = p_paciente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el plan'; END IF;
  PERFORM set_config('app.bp07_motivo',btrim(p_motivo),true);
  UPDATE public.presupuestos SET detalle_items = v_items, plan_revision = v_revision,
    version = version + 1, requiere_revision = true, updated_at = clock_timestamp()
    WHERE id = p_presupuesto_id AND clinica_id = v_clinica;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el presupuesto'; END IF;
  RETURN QUERY SELECT v_revision, v_presupuesto.version + 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.revisar_precios_plan_desde_presupuesto(uuid,uuid,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_precios_plan_desde_presupuesto(uuid,uuid,text,integer,text) TO authenticated;
COMMIT;
