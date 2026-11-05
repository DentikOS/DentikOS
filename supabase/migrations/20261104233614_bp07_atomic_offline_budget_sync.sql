-- BP07: sincronización idempotente y atómica de presupuestos y sus ítems.
CREATE OR REPLACE FUNCTION public.sincronizar_presupuesto_offline(
  p_presupuesto jsonb,
  p_items jsonb,
  p_presupuesto_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_presupuesto_id uuid;
  v_id_local text;
  v_hash text;
  v_paciente_id uuid;
  v_paciente_text text;
  v_presupuesto public.presupuestos%ROWTYPE;
  v_item jsonb;
  v_item_id uuid;
  v_item_id_local text;
  v_item_hash text;
  v_item_paciente_id uuid;
  v_item_paciente_text text;
  v_prestacion_id uuid;
  v_prestacion_text text;
  v_valor_text text;
  v_valor integer;
  v_nombre text;
  v_ids_items text[] := ARRAY[]::text[];
  v_item_clinica uuid;
  v_item_presupuesto uuid;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede sincronizar el presupuesto';
  END IF;
  IF pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Lista de ítems de presupuesto inválida';
  END IF;

  IF p_presupuesto IS NULL THEN
    IF p_presupuesto_id IS NULL THEN
      RAISE EXCEPTION 'Falta el presupuesto asociado a los ítems';
    END IF;
    v_presupuesto_id := p_presupuesto_id;
    SELECT b.* INTO v_presupuesto
      FROM public.presupuestos b
      WHERE b.id = v_presupuesto_id
      FOR UPDATE;
    IF NOT FOUND OR v_presupuesto.clinica_id IS DISTINCT FROM v_clinica_id
      OR v_presupuesto.paciente_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = v_presupuesto.paciente_id AND p.clinica_id = v_clinica_id
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El presupuesto no está disponible en la clínica activa';
    END IF;
  ELSE
    IF pg_catalog.jsonb_typeof(p_presupuesto) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Cabecera de presupuesto inválida';
    END IF;
    v_id_local := nullif(pg_catalog.btrim(p_presupuesto->>'id'), '');
    IF v_id_local IS NULL OR pg_catalog.length(v_id_local) > 200 THEN
      RAISE EXCEPTION 'El presupuesto no tiene un ID local estable';
    END IF;

    IF v_id_local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_presupuesto_id := v_id_local::uuid;
    ELSE
      v_hash := pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to('studio-dental:presupuesto:v1:' || v_clinica_id::text || ':' || v_id_local, 'UTF8'),
          'sha256'
        ),
        'hex'
      );
      v_presupuesto_id := (
        pg_catalog.substr(v_hash, 1, 8) || '-' || pg_catalog.substr(v_hash, 9, 4) || '-5' ||
        pg_catalog.substr(v_hash, 14, 3) || '-8' || pg_catalog.substr(v_hash, 18, 3) || '-' ||
        pg_catalog.substr(v_hash, 21, 12)
      )::uuid;
    END IF;
    IF p_presupuesto_id IS NOT NULL AND p_presupuesto_id IS DISTINCT FROM v_presupuesto_id THEN
      RAISE EXCEPTION 'El ID del presupuesto no coincide';
    END IF;

    v_paciente_text := nullif(p_presupuesto->>'paciente_id', '');
    IF v_paciente_text IS NULL OR v_paciente_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'El paciente del presupuesto no es válido';
    END IF;
    v_paciente_id := v_paciente_text::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = v_paciente_id AND p.clinica_id = v_clinica_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El paciente no pertenece a la clínica activa';
    END IF;

    IF pg_catalog.jsonb_typeof(p_presupuesto->'detalle_items') NOT IN ('array', 'null')
      OR pg_catalog.jsonb_typeof(p_presupuesto->'descuentos') NOT IN ('array', 'null') THEN
      RAISE EXCEPTION 'Detalle o descuentos del presupuesto inválidos';
    END IF;
    IF nullif(pg_catalog.btrim(p_presupuesto->>'folio'), '') IS NULL
      OR nullif(pg_catalog.btrim(p_presupuesto->>'paciente_nombre'), '') IS NULL THEN
      RAISE EXCEPTION 'Folio y nombre del paciente son obligatorios';
    END IF;

    INSERT INTO public.presupuestos AS presupuesto_destino (
      id, user_id, paciente_id, folio, paciente_nombre, paciente_rut, fecha_emision,
      convenio, monto_total, estado, observacion, clinica_id, detalle_items,
      total_bruto, total_descuentos, fecha_vencimiento, descuentos, plan_pago,
      version, origen_plan, plan_revision, version_grupo_id, requiere_revision,
      descuento_global_pct, archivado_at
    ) VALUES (
      v_presupuesto_id,
      v_user_id,
      v_paciente_id,
      pg_catalog.btrim(p_presupuesto->>'folio'),
      pg_catalog.btrim(p_presupuesto->>'paciente_nombre'),
      nullif(p_presupuesto->>'paciente_rut', ''),
      COALESCE(nullif(p_presupuesto->>'fecha_emision', '')::date, CURRENT_DATE),
      COALESCE(nullif(p_presupuesto->>'convenio', ''), 'Particular'),
      COALESCE(nullif(p_presupuesto->>'monto_total', '')::integer, 0),
      COALESCE(nullif(p_presupuesto->>'estado', ''), 'Emitido'),
      COALESCE(p_presupuesto->>'observacion', ''),
      v_clinica_id,
      CASE WHEN pg_catalog.jsonb_typeof(p_presupuesto->'detalle_items') = 'array'
        THEN p_presupuesto->'detalle_items' ELSE '[]'::jsonb END,
      COALESCE(nullif(p_presupuesto->>'total_bruto', '')::integer, 0),
      COALESCE(nullif(p_presupuesto->>'total_descuentos', '')::integer, 0),
      nullif(p_presupuesto->>'fecha_vencimiento', '')::timestamptz,
      CASE WHEN pg_catalog.jsonb_typeof(p_presupuesto->'descuentos') = 'array'
        THEN p_presupuesto->'descuentos' ELSE '[]'::jsonb END,
      CASE WHEN p_presupuesto->'plan_pago' IS NULL OR p_presupuesto->'plan_pago' = 'null'::jsonb
        THEN NULL ELSE p_presupuesto->'plan_pago' END,
      COALESCE(nullif(p_presupuesto->>'version', '')::integer, 1),
      COALESCE(nullif(p_presupuesto->>'origen_plan', '')::boolean, false),
      nullif(p_presupuesto->>'plan_revision', ''),
      nullif(p_presupuesto->>'version_grupo_id', '')::uuid,
      COALESCE(nullif(p_presupuesto->>'requiere_revision', '')::boolean, false),
      nullif(p_presupuesto->>'descuento_global_pct', '')::numeric,
      nullif(p_presupuesto->>'archivado_at', '')::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      paciente_id = EXCLUDED.paciente_id,
      folio = EXCLUDED.folio,
      paciente_nombre = EXCLUDED.paciente_nombre,
      paciente_rut = EXCLUDED.paciente_rut,
      fecha_emision = EXCLUDED.fecha_emision,
      convenio = EXCLUDED.convenio,
      monto_total = EXCLUDED.monto_total,
      estado = EXCLUDED.estado,
      observacion = EXCLUDED.observacion,
      detalle_items = EXCLUDED.detalle_items,
      total_bruto = EXCLUDED.total_bruto,
      total_descuentos = EXCLUDED.total_descuentos,
      fecha_vencimiento = EXCLUDED.fecha_vencimiento,
      descuentos = EXCLUDED.descuentos,
      plan_pago = EXCLUDED.plan_pago,
      version = EXCLUDED.version,
      origen_plan = EXCLUDED.origen_plan,
      plan_revision = EXCLUDED.plan_revision,
      version_grupo_id = EXCLUDED.version_grupo_id,
      requiere_revision = EXCLUDED.requiere_revision,
      descuento_global_pct = EXCLUDED.descuento_global_pct,
      archivado_at = EXCLUDED.archivado_at
    WHERE presupuesto_destino.clinica_id = v_clinica_id
      AND ROW(
        presupuesto_destino.user_id, presupuesto_destino.paciente_id, presupuesto_destino.folio,
        presupuesto_destino.paciente_nombre, presupuesto_destino.paciente_rut,
        presupuesto_destino.fecha_emision, presupuesto_destino.convenio,
        presupuesto_destino.monto_total, presupuesto_destino.estado, presupuesto_destino.observacion,
        presupuesto_destino.detalle_items, presupuesto_destino.total_bruto,
        presupuesto_destino.total_descuentos, presupuesto_destino.fecha_vencimiento,
        presupuesto_destino.descuentos, presupuesto_destino.plan_pago, presupuesto_destino.version,
        presupuesto_destino.origen_plan, presupuesto_destino.plan_revision,
        presupuesto_destino.version_grupo_id, presupuesto_destino.requiere_revision,
        presupuesto_destino.descuento_global_pct, presupuesto_destino.archivado_at
      ) IS DISTINCT FROM ROW(
        EXCLUDED.user_id, EXCLUDED.paciente_id, EXCLUDED.folio, EXCLUDED.paciente_nombre,
        EXCLUDED.paciente_rut, EXCLUDED.fecha_emision, EXCLUDED.convenio, EXCLUDED.monto_total,
        EXCLUDED.estado, EXCLUDED.observacion, EXCLUDED.detalle_items, EXCLUDED.total_bruto,
        EXCLUDED.total_descuentos, EXCLUDED.fecha_vencimiento, EXCLUDED.descuentos,
        EXCLUDED.plan_pago, EXCLUDED.version, EXCLUDED.origen_plan, EXCLUDED.plan_revision,
        EXCLUDED.version_grupo_id, EXCLUDED.requiere_revision, EXCLUDED.descuento_global_pct,
        EXCLUDED.archivado_at
      )
    RETURNING * INTO v_presupuesto;

    IF NOT FOUND THEN
      SELECT b.* INTO v_presupuesto
        FROM public.presupuestos b
        WHERE b.id = v_presupuesto_id AND b.clinica_id = v_clinica_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El presupuesto no está disponible en la clínica activa';
      END IF;
    END IF;
    IF v_presupuesto.clinica_id IS DISTINCT FROM v_clinica_id
      OR v_presupuesto.paciente_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = v_presupuesto.paciente_id AND p.clinica_id = v_clinica_id
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El presupuesto no pertenece a la clínica activa';
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Ítem de presupuesto inválido';
    END IF;
    v_item_id_local := nullif(pg_catalog.btrim(v_item->>'id'), '');
    IF v_item_id_local IS NULL OR pg_catalog.length(v_item_id_local) > 200 THEN
      RAISE EXCEPTION 'El ítem no tiene un ID local estable';
    END IF;
    IF v_item_id_local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_item_id := v_item_id_local::uuid;
    ELSE
      v_item_hash := pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to('studio-dental:presupuesto-item:v1:' || v_presupuesto_id::text || ':' || v_item_id_local, 'UTF8'),
          'sha256'
        ),
        'hex'
      );
      v_item_id := (
        pg_catalog.substr(v_item_hash, 1, 8) || '-' || pg_catalog.substr(v_item_hash, 9, 4) || '-5' ||
        pg_catalog.substr(v_item_hash, 14, 3) || '-8' || pg_catalog.substr(v_item_hash, 18, 3) || '-' ||
        pg_catalog.substr(v_item_hash, 21, 12)
      )::uuid;
    END IF;
    IF v_item_id::text = ANY(v_ids_items) THEN
      RAISE EXCEPTION 'La lista contiene IDs de ítem repetidos';
    END IF;
    v_ids_items := pg_catalog.array_append(v_ids_items, v_item_id::text);

    v_nombre := nullif(pg_catalog.btrim(COALESCE(v_item->>'prestacion_nombre', v_item->>'nombrePrestacion', v_item->>'nombre', v_item->>'prestacion')), '');
    v_valor_text := COALESCE(v_item->>'valor', v_item->>'subtotal', v_item->>'precio', v_item->>'precioUnitario');
    IF v_nombre IS NULL OR v_valor_text IS NULL OR v_valor_text !~ '^-?[0-9]+$' THEN
      RAISE EXCEPTION 'Nombre o valor del ítem inválido';
    END IF;
    v_valor := v_valor_text::integer;

    v_item_paciente_text := nullif(v_item->>'paciente_id', '');
    IF v_item_paciente_text IS NULL THEN
      v_item_paciente_id := NULL;
    ELSIF v_item_paciente_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_item_paciente_id := v_item_paciente_text::uuid;
      IF v_item_paciente_id IS DISTINCT FROM v_presupuesto.paciente_id THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El ítem no corresponde al paciente del presupuesto';
      END IF;
    ELSE
      RAISE EXCEPTION 'El paciente del ítem no es válido';
    END IF;

    v_prestacion_text := nullif(v_item->>'prestacion_id', '');
    IF v_prestacion_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_prestacion_id := v_prestacion_text::uuid;
    ELSE
      v_prestacion_id := NULL;
    END IF;
    IF v_prestacion_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.prestaciones pr
      WHERE pr.id = v_prestacion_id AND pr.clinica_id = v_clinica_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La prestación no pertenece a la clínica activa';
    END IF;

    SELECT bi.clinica_id, bi.presupuesto_id INTO v_item_clinica, v_item_presupuesto
      FROM public.presupuesto_items bi
      WHERE bi.id = v_item_id
      FOR UPDATE;
    IF FOUND AND (v_item_clinica IS DISTINCT FROM v_clinica_id
      OR v_item_presupuesto IS DISTINCT FROM v_presupuesto_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El ítem ya pertenece a otro presupuesto';
    END IF;

    INSERT INTO public.presupuesto_items AS item_destino (
      id, presupuesto_id, paciente_id, prestacion_id, prestacion_nombre,
      valor, convenio, estado, clinica_id
    ) VALUES (
      v_item_id,
      v_presupuesto_id,
      v_item_paciente_id,
      v_prestacion_id,
      v_nombre,
      v_valor,
      COALESCE(nullif(v_item->>'convenio', ''), 'Particular'),
      COALESCE(nullif(v_item->>'estado', ''), 'Pendiente'),
      v_clinica_id
    )
    ON CONFLICT (id) DO UPDATE SET
      paciente_id = EXCLUDED.paciente_id,
      prestacion_id = EXCLUDED.prestacion_id,
      prestacion_nombre = EXCLUDED.prestacion_nombre,
      valor = EXCLUDED.valor,
      convenio = EXCLUDED.convenio,
      estado = EXCLUDED.estado
    WHERE item_destino.clinica_id = v_clinica_id
      AND item_destino.presupuesto_id = v_presupuesto_id
      AND ROW(item_destino.paciente_id, item_destino.prestacion_id,
        item_destino.prestacion_nombre, item_destino.valor, item_destino.convenio, item_destino.estado)
        IS DISTINCT FROM ROW(EXCLUDED.paciente_id, EXCLUDED.prestacion_id,
          EXCLUDED.prestacion_nombre, EXCLUDED.valor, EXCLUDED.convenio, EXCLUDED.estado);

    IF NOT EXISTS (
      SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.id = v_item_id AND bi.clinica_id = v_clinica_id
        AND bi.presupuesto_id = v_presupuesto_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pudo asociar el ítem al presupuesto';
    END IF;
  END LOOP;

  RETURN v_presupuesto_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sincronizar_presupuesto_offline(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_presupuesto_offline(jsonb, jsonb, uuid) TO authenticated;
