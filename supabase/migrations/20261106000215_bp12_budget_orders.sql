-- BP12 ↔ BP07: an explicitly classified, accepted budget item creates exactly
-- one clinic-scoped laboratory order. The source row and resulting order remain
-- linked for traceability and status synchronization.

ALTER TABLE public.presupuesto_items
  ADD COLUMN es_laboratorio boolean NOT NULL DEFAULT false,
  ADD COLUMN laboratorio_id uuid,
  ADD COLUMN tipo_trabajo_laboratorio_id uuid,
  ADD COLUMN pieza_dentaria text,
  ADD COLUMN color_guia text,
  ADD COLUMN indicaciones_tecnicas text,
  ADD COLUMN orden_laboratorio_id uuid;

ALTER TABLE public.ordenes_laboratorio
  ADD COLUMN presupuesto_id uuid,
  ADD COLUMN presupuesto_item_id uuid;

-- Fill legacy item patients only from their own clinic-scoped budget.
UPDATE public.presupuesto_items bi
SET paciente_id = b.paciente_id
FROM public.presupuestos b
WHERE bi.presupuesto_id = b.id
  AND bi.clinica_id = b.clinica_id
  AND bi.paciente_id IS NULL
  AND b.paciente_id IS NOT NULL;

ALTER TABLE public.presupuesto_items
  ADD CONSTRAINT presupuesto_items_bp12_laboratorio_check CHECK (
    (es_laboratorio AND presupuesto_id IS NOT NULL AND paciente_id IS NOT NULL
      AND tipo_trabajo_laboratorio_id IS NOT NULL)
    OR (NOT es_laboratorio AND laboratorio_id IS NULL
      AND tipo_trabajo_laboratorio_id IS NULL AND pieza_dentaria IS NULL
      AND color_guia IS NULL AND indicaciones_tecnicas IS NULL
      AND orden_laboratorio_id IS NULL)
  ),
  ADD CONSTRAINT presupuesto_items_bp12_tipo_fk
    FOREIGN KEY (tipo_trabajo_laboratorio_id, clinica_id)
    REFERENCES public.laboratorio_tipos_trabajo (id, clinica_id) ON DELETE RESTRICT,
  ADD CONSTRAINT presupuesto_items_bp12_laboratorio_fk
    FOREIGN KEY (laboratorio_id, clinica_id)
    REFERENCES public.laboratorios (id, clinica_id) ON DELETE RESTRICT,
  ADD CONSTRAINT presupuesto_items_bp12_source_unique
    UNIQUE (id, clinica_id, presupuesto_id, paciente_id),
  ADD CONSTRAINT presupuesto_items_bp12_order_fk
    FOREIGN KEY (orden_laboratorio_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT;

ALTER TABLE public.ordenes_laboratorio
  ADD CONSTRAINT ordenes_laboratorio_bp07_source_check CHECK (
    (presupuesto_id IS NULL AND presupuesto_item_id IS NULL)
    OR (presupuesto_id IS NOT NULL AND presupuesto_item_id IS NOT NULL)
  ),
  ADD CONSTRAINT ordenes_laboratorio_bp07_source_fk
    FOREIGN KEY (presupuesto_item_id, clinica_id, presupuesto_id, paciente_id)
    REFERENCES public.presupuesto_items (id, clinica_id, presupuesto_id, paciente_id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX ordenes_laboratorio_bp07_item_unique
  ON public.ordenes_laboratorio (clinica_id, presupuesto_item_id)
  WHERE presupuesto_item_id IS NOT NULL;
CREATE UNIQUE INDEX presupuesto_items_bp12_order_unique
  ON public.presupuesto_items (clinica_id, orden_laboratorio_id)
  WHERE orden_laboratorio_id IS NOT NULL;
CREATE INDEX presupuesto_items_bp12_laboratorio_idx
  ON public.presupuesto_items (clinica_id, tipo_trabajo_laboratorio_id)
  WHERE es_laboratorio;

COMMENT ON COLUMN public.presupuesto_items.es_laboratorio IS
  'BP12: explicit opt-in; description text is never used to infer a laboratory job.';
COMMENT ON COLUMN public.ordenes_laboratorio.presupuesto_item_id IS
  'BP12: unique source budget item; set only by the transactional BP07 integration.';

-- The client cannot forge lab classification or source links with direct table
-- writes. The BP12 synchronization RPC is SECURITY DEFINER and applies the
-- fields after the existing BP09 budget validation has succeeded.
CREATE OR REPLACE FUNCTION public.proteger_item_laboratorio_presupuesto_bp12()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user <> 'postgres'
       AND (NEW.es_laboratorio OR NEW.laboratorio_id IS NOT NULL
         OR NEW.tipo_trabajo_laboratorio_id IS NOT NULL
         OR NEW.pieza_dentaria IS NOT NULL OR NEW.color_guia IS NOT NULL
         OR NEW.indicaciones_tecnicas IS NOT NULL OR NEW.orden_laboratorio_id IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Use la sincronización de presupuesto para clasificar un trabajo de laboratorio';
    END IF;
    IF NEW.orden_laboratorio_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El vínculo de orden se crea automáticamente';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.es_laboratorio IS DISTINCT FROM OLD.es_laboratorio
      OR NEW.laboratorio_id IS DISTINCT FROM OLD.laboratorio_id
      OR NEW.tipo_trabajo_laboratorio_id IS DISTINCT FROM OLD.tipo_trabajo_laboratorio_id
      OR NEW.pieza_dentaria IS DISTINCT FROM OLD.pieza_dentaria
      OR NEW.color_guia IS DISTINCT FROM OLD.color_guia
      OR NEW.indicaciones_tecnicas IS DISTINCT FROM OLD.indicaciones_tecnicas
      OR NEW.orden_laboratorio_id IS DISTINCT FROM OLD.orden_laboratorio_id)
     AND current_user <> 'postgres' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Use la sincronización de presupuesto para cambiar datos de laboratorio';
  END IF;

  IF OLD.orden_laboratorio_id IS NOT NULL
     AND (NEW.es_laboratorio IS DISTINCT FROM OLD.es_laboratorio
       OR NEW.laboratorio_id IS DISTINCT FROM OLD.laboratorio_id
       OR NEW.tipo_trabajo_laboratorio_id IS DISTINCT FROM OLD.tipo_trabajo_laboratorio_id
       OR NEW.pieza_dentaria IS DISTINCT FROM OLD.pieza_dentaria
       OR NEW.color_guia IS DISTINCT FROM OLD.color_guia
       OR NEW.indicaciones_tecnicas IS DISTINCT FROM OLD.indicaciones_tecnicas
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.presupuesto_id IS DISTINCT FROM OLD.presupuesto_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'El ítem vinculado a una orden de laboratorio es inmutable';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_item_laboratorio_presupuesto_bp12() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER presupuesto_items_bp12_laboratorio_guard
  BEFORE INSERT OR UPDATE ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.proteger_item_laboratorio_presupuesto_bp12();

CREATE OR REPLACE FUNCTION public.proteger_origen_orden_laboratorio_bp12()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user <> 'postgres'
       AND (NEW.presupuesto_id IS NOT NULL OR NEW.presupuesto_item_id IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El vínculo a presupuesto se crea desde la aprobación';
    END IF;
  ELSIF NEW.presupuesto_id IS DISTINCT FROM OLD.presupuesto_id
     OR NEW.presupuesto_item_id IS DISTINCT FROM OLD.presupuesto_item_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'El origen de la orden de laboratorio es inmutable';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_origen_orden_laboratorio_bp12() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER ordenes_laboratorio_bp12_source_guard
  BEFORE INSERT OR UPDATE ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_origen_orden_laboratorio_bp12();

CREATE OR REPLACE FUNCTION public.sincronizar_presupuesto_offline_bp12(
  p_presupuesto jsonb,
  p_items jsonb,
  p_presupuesto_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_presupuesto_id uuid;
  v_paciente uuid;
  v_item jsonb;
  v_id_local text;
  v_hash text;
  v_item_id uuid;
  v_es_laboratorio boolean;
  v_laboratorio_id uuid;
  v_tipo_id uuid;
  v_pieza text;
  v_color text;
  v_indicaciones text;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role,
       'asistente'::public.app_role, 'recepcion'::public.app_role)
     OR pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede sincronizar el presupuesto';
  END IF;

  -- Preserve the BP09 atomic validation for budget, item, and inventory fields.
  v_presupuesto_id := public.sincronizar_presupuesto_offline_bp09(
    p_presupuesto, p_items, p_presupuesto_id
  );
  SELECT b.paciente_id INTO v_paciente
  FROM public.presupuestos b
  WHERE b.id = v_presupuesto_id AND b.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND OR v_paciente IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El presupuesto no está disponible en la clínica activa';
  END IF;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) LOOP
    v_id_local := nullif(pg_catalog.btrim(v_item->>'id'), '');
    IF v_id_local IS NULL OR pg_catalog.length(v_id_local) > 200 THEN
      RAISE EXCEPTION 'El ítem no tiene un ID local estable';
    END IF;
    IF v_id_local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_item_id := v_id_local::uuid;
    ELSE
      v_hash := pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to('studio-dental:presupuesto-item:v1:' || v_presupuesto_id::text || ':' || v_id_local, 'UTF8'),
          'sha256'
        ), 'hex'
      );
      v_item_id := (
        pg_catalog.substr(v_hash, 1, 8) || '-' || pg_catalog.substr(v_hash, 9, 4) || '-5' ||
        pg_catalog.substr(v_hash, 14, 3) || '-8' || pg_catalog.substr(v_hash, 18, 3) || '-' ||
        pg_catalog.substr(v_hash, 21, 12)
      )::uuid;
    END IF;

    IF v_item ? 'es_laboratorio'
       AND pg_catalog.jsonb_typeof(v_item->'es_laboratorio') NOT IN ('boolean', 'null') THEN
      RAISE EXCEPTION 'La clasificación de laboratorio del ítem no es válida';
    END IF;
    v_es_laboratorio := COALESCE(nullif(v_item->>'es_laboratorio', '')::boolean, false);
    v_laboratorio_id := NULL;
    v_tipo_id := NULL;
    v_pieza := nullif(pg_catalog.btrim(v_item->>'pieza_dentaria'), '');
    v_color := nullif(pg_catalog.btrim(v_item->>'color_guia'), '');
    v_indicaciones := nullif(pg_catalog.btrim(v_item->>'indicaciones_tecnicas'), '');

    IF v_es_laboratorio THEN
      IF v_paciente IS NULL OR v_item->>'tipo_trabajo_laboratorio_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR (nullif(v_item->>'laboratorio_id', '') IS NOT NULL
           AND (v_item->>'laboratorio_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         OR (v_pieza IS NOT NULL AND pg_catalog.char_length(v_pieza) > 80)
         OR (v_color IS NOT NULL AND pg_catalog.char_length(v_color) > 80)
         OR (v_indicaciones IS NOT NULL AND pg_catalog.char_length(v_indicaciones) > 3000) THEN
        RAISE EXCEPTION 'Los datos del trabajo de laboratorio del presupuesto no son válidos';
      END IF;
      v_tipo_id := (v_item->>'tipo_trabajo_laboratorio_id')::uuid;
      IF nullif(v_item->>'laboratorio_id', '') IS NOT NULL THEN
        v_laboratorio_id := (v_item->>'laboratorio_id')::uuid;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.laboratorio_tipos_trabajo t
        WHERE t.id = v_tipo_id AND t.clinica_id = v_clinica AND t.estado = 'activo'
      ) OR (v_laboratorio_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.laboratorios l
        WHERE l.id = v_laboratorio_id AND l.clinica_id = v_clinica AND l.estado = 'activo'
      )) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El tipo o laboratorio no pertenece al catálogo activo de la clínica';
      END IF;
    ELSIF v_item ? 'tipo_trabajo_laboratorio_id'
       AND nullif(v_item->>'tipo_trabajo_laboratorio_id', '') IS NOT NULL
       OR (v_item ? 'laboratorio_id' AND nullif(v_item->>'laboratorio_id', '') IS NOT NULL)
       OR v_pieza IS NOT NULL OR v_color IS NOT NULL OR v_indicaciones IS NOT NULL THEN
      RAISE EXCEPTION 'Un ítem no clasificado no puede tener datos de laboratorio';
    END IF;

    UPDATE public.presupuesto_items bi
    SET paciente_id = COALESCE(bi.paciente_id, v_paciente),
        es_laboratorio = v_es_laboratorio,
        laboratorio_id = v_laboratorio_id,
        tipo_trabajo_laboratorio_id = v_tipo_id,
        pieza_dentaria = CASE WHEN v_es_laboratorio THEN v_pieza ELSE NULL END,
        color_guia = CASE WHEN v_es_laboratorio THEN v_color ELSE NULL END,
        indicaciones_tecnicas = CASE WHEN v_es_laboratorio THEN v_indicaciones ELSE NULL END
    WHERE bi.id = v_item_id AND bi.clinica_id = v_clinica
      AND bi.presupuesto_id = v_presupuesto_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El ítem no pertenece al presupuesto de la clínica activa';
    END IF;
  END LOOP;
  RETURN v_presupuesto_id;
END;
$function$;
ALTER FUNCTION public.sincronizar_presupuesto_offline_bp12(jsonb, jsonb, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sincronizar_presupuesto_offline_bp12(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_presupuesto_offline_bp12(jsonb, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.materializar_orden_laboratorio_desde_item_bp12(p_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_item public.presupuesto_items%ROWTYPE;
  v_presupuesto public.presupuestos%ROWTYPE;
  v_tipo public.laboratorio_tipos_trabajo%ROWTYPE;
  v_plantilla public.plantillas_laboratorio%ROWTYPE;
  v_orden_id uuid;
  v_key_text text;
  v_idempotency uuid;
  v_costo integer;
  v_folio text;
  v_snapshot jsonb;
  v_laboratorio_id uuid;
  v_plantilla_id uuid;
  v_pieza text;
  v_color text;
  v_indicaciones text;
  v_fecha_estimada date;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role,
       'asistente'::public.app_role, 'recepcion'::public.app_role)
     OR p_item_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede crear la orden de laboratorio';
  END IF;

  SELECT bi.* INTO v_item
  FROM public.presupuesto_items bi
  WHERE bi.id = p_item_id AND bi.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND OR NOT v_item.es_laboratorio THEN RETURN NULL; END IF;
  SELECT b.* INTO v_presupuesto
  FROM public.presupuestos b
  WHERE b.id = v_item.presupuesto_id AND b.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND OR v_presupuesto.paciente_id IS DISTINCT FROM v_item.paciente_id
     OR v_presupuesto.estado NOT IN ('aprobado', 'Aprobado', 'en-curso', 'EnTratamiento') THEN
    RETURN NULL;
  END IF;

  IF v_item.orden_laboratorio_id IS NOT NULL THEN
    RETURN v_item.orden_laboratorio_id;
  END IF;
  SELECT t.* INTO v_tipo
  FROM public.laboratorio_tipos_trabajo t
  WHERE t.id = v_item.tipo_trabajo_laboratorio_id
    AND t.clinica_id = v_clinica AND t.estado = 'activo';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'El tipo de trabajo ya no está activo';
  END IF;
  IF v_item.laboratorio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.laboratorios l
    WHERE l.id = v_item.laboratorio_id AND l.clinica_id = v_clinica AND l.estado = 'activo'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'El laboratorio ya no está activo';
  END IF;

  SELECT p.* INTO v_plantilla
  FROM public.plantillas_laboratorio p
  WHERE p.clinica_id = v_clinica AND p.estado = 'activo'
    AND pg_catalog.lower(p.nombre) = pg_catalog.lower(v_tipo.nombre)
  ORDER BY p.version DESC, p.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    v_plantilla_id := v_plantilla.id;
    v_snapshot := pg_catalog.jsonb_build_object(
      'id', v_plantilla.id, 'nombre', v_plantilla.nombre,
      'categoria', v_plantilla.categoria, 'dias_estimados', v_plantilla.dias_estimados,
      'etapas', v_plantilla.etapas, 'fotos_requeridas', v_plantilla.fotos_requeridas,
      'campos_personalizados', v_plantilla.campos_personalizados, 'version', v_plantilla.version
    );
  ELSE
    v_plantilla_id := NULL;
    v_snapshot := pg_catalog.jsonb_build_object(
      'nombre', v_tipo.nombre, 'categoria', v_tipo.categoria,
      'dias_estimados', v_tipo.dias_estimados
    );
  END IF;

  v_laboratorio_id := v_item.laboratorio_id;
  v_pieza := v_item.pieza_dentaria;
  v_color := v_item.color_guia;
  v_indicaciones := v_item.indicaciones_tecnicas;
  v_fecha_estimada := CASE
    WHEN COALESCE(v_plantilla.dias_estimados, v_tipo.dias_estimados) IS NULL THEN NULL
    ELSE CURRENT_DATE + COALESCE(v_plantilla.dias_estimados, v_tipo.dias_estimados)
  END;
  IF v_rol = 'recepcion'::public.app_role THEN
    -- Reception creates a limited request; the dentist/assistant completes it.
    v_laboratorio_id := NULL;
    v_plantilla_id := NULL;
    v_snapshot := '{}'::jsonb;
    v_pieza := NULL;
    v_color := NULL;
    v_indicaciones := NULL;
    v_fecha_estimada := NULL;
  END IF;

  v_key_text := pg_catalog.md5(
    'studio-dental:bp12:budget-order:' || v_clinica::text || ':' || v_item.id::text
  );
  v_idempotency := (
    pg_catalog.substr(v_key_text, 1, 8) || '-' || pg_catalog.substr(v_key_text, 9, 4) || '-' ||
    pg_catalog.substr(v_key_text, 13, 4) || '-' || pg_catalog.substr(v_key_text, 17, 4) || '-' ||
    pg_catalog.substr(v_key_text, 21, 12)
  )::uuid;
  INSERT INTO public.ordenes_laboratorio (
    clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id, plantilla_id,
    plantilla_snapshot, pieza_dentaria, color_guia, indicaciones_tecnicas,
    fecha_estimada_entrega, idempotency_key, presupuesto_id, presupuesto_item_id
  ) VALUES (
    v_clinica, v_presupuesto.paciente_id, v_laboratorio_id, v_tipo.id,
    v_plantilla_id, v_snapshot, v_pieza, v_color, v_indicaciones,
    v_fecha_estimada, v_idempotency, v_presupuesto.id, v_item.id
  )
  ON CONFLICT (clinica_id, presupuesto_item_id) WHERE presupuesto_item_id IS NOT NULL
  DO NOTHING
  RETURNING id, folio INTO v_orden_id, v_folio;

  IF v_orden_id IS NULL THEN
    SELECT o.id, o.folio INTO v_orden_id, v_folio
    FROM public.ordenes_laboratorio o
    WHERE o.clinica_id = v_clinica AND o.presupuesto_item_id = v_item.id;
  END IF;
  IF v_orden_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver la orden idempotente del presupuesto';
  END IF;

  UPDATE public.presupuesto_items bi
  SET orden_laboratorio_id = v_orden_id,
      estado = CASE WHEN v_rol = 'recepcion'::public.app_role THEN 'Pendiente' ELSE 'En Proceso' END
  WHERE bi.id = v_item.id AND bi.clinica_id = v_clinica
    AND bi.presupuesto_id = v_presupuesto.id AND bi.paciente_id = v_presupuesto.paciente_id
    AND bi.orden_laboratorio_id IS NULL;

  IF v_laboratorio_id IS NOT NULL THEN
    SELECT p.costo INTO v_costo
    FROM public.laboratorio_precios p
    WHERE p.clinica_id = v_clinica AND p.laboratorio_id = v_laboratorio_id
      AND p.tipo_trabajo_id = v_tipo.id AND p.vigente_hasta IS NULL
    ORDER BY p.vigente_desde DESC, p.created_at DESC
    LIMIT 1;
    IF v_costo IS NOT NULL THEN
      INSERT INTO public.ordenes_laboratorio_costos (
        clinica_id, orden_id, costo_total, precio_paciente, created_by
      ) VALUES (v_clinica, v_orden_id, v_costo, v_item.valor, v_actor)
      ON CONFLICT (orden_id, clinica_id) DO NOTHING;
    END IF;
  END IF;

  -- BP06 timeline event shares the order transaction and has a stable ID.
  v_key_text := pg_catalog.md5('studio-dental:bp12:timeline:' || v_orden_id::text);
  INSERT INTO public.timeline_paciente (
    id, paciente_id, clinica_id, actor_user_id, tipo, fecha, titulo, detalles, metadata
  ) VALUES (
    (pg_catalog.substr(v_key_text, 1, 8) || '-' || pg_catalog.substr(v_key_text, 9, 4) || '-' ||
      pg_catalog.substr(v_key_text, 13, 4) || '-' || pg_catalog.substr(v_key_text, 17, 4) || '-' ||
      pg_catalog.substr(v_key_text, 21, 12))::uuid,
    v_presupuesto.paciente_id, v_clinica, v_actor, 'presupuesto', clock_timestamp(),
    'Orden de laboratorio creada desde presupuesto ' || v_presupuesto.folio,
    'Orden ' || v_folio || ' vinculada al ítem aceptado.',
    pg_catalog.jsonb_build_object(
      'origen', 'bp12_presupuesto', 'presupuesto_id', v_presupuesto.id,
      'presupuesto_item_id', v_item.id, 'orden_laboratorio_id', v_orden_id
    )
  ) ON CONFLICT (id) DO NOTHING;

  RETURN v_orden_id;
END;
$function$;
ALTER FUNCTION public.materializar_orden_laboratorio_desde_item_bp12(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.materializar_orden_laboratorio_desde_item_bp12(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sincronizar_ordenes_laboratorio_desde_presupuesto_bp12()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item record;
BEGIN
  IF NEW.estado IN ('aprobado', 'Aprobado', 'en-curso', 'EnTratamiento')
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    FOR v_item IN
      SELECT bi.id FROM public.presupuesto_items bi
      WHERE bi.clinica_id = NEW.clinica_id AND bi.presupuesto_id = NEW.id
        AND bi.es_laboratorio
      ORDER BY bi.id
    LOOP
      PERFORM public.materializar_orden_laboratorio_desde_item_bp12(v_item.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.sincronizar_ordenes_laboratorio_desde_presupuesto_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sincronizar_ordenes_laboratorio_desde_presupuesto_bp12() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sincronizar_orden_laboratorio_desde_item_bp12()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.es_laboratorio THEN
    PERFORM public.materializar_orden_laboratorio_desde_item_bp12(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.sincronizar_orden_laboratorio_desde_item_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sincronizar_orden_laboratorio_desde_item_bp12() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER presupuestos_bp12_ordenes_insert
  AFTER INSERT ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_ordenes_laboratorio_desde_presupuesto_bp12();
CREATE TRIGGER presupuestos_bp12_ordenes_estado
  AFTER UPDATE OF estado ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_ordenes_laboratorio_desde_presupuesto_bp12();
CREATE TRIGGER presupuesto_items_bp12_orden
  AFTER INSERT OR UPDATE OF es_laboratorio, laboratorio_id, tipo_trabajo_laboratorio_id,
    pieza_dentaria, color_guia, indicaciones_tecnicas
  ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_orden_laboratorio_desde_item_bp12();

CREATE OR REPLACE FUNCTION public.sincronizar_estado_item_desde_orden_laboratorio_bp12()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.presupuesto_item_id IS NOT NULL
     AND NEW.etapa_actual IS DISTINCT FROM OLD.etapa_actual THEN
    UPDATE public.presupuesto_items bi
    SET estado = CASE WHEN NEW.etapa_actual = 'entrega' THEN 'Realizado' ELSE 'En Proceso' END
    WHERE bi.id = NEW.presupuesto_item_id AND bi.clinica_id = NEW.clinica_id
      AND bi.presupuesto_id = NEW.presupuesto_id AND bi.orden_laboratorio_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.sincronizar_estado_item_desde_orden_laboratorio_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sincronizar_estado_item_desde_orden_laboratorio_bp12() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER ordenes_laboratorio_bp12_sync_budget_status
  AFTER UPDATE OF etapa_actual ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_estado_item_desde_orden_laboratorio_bp12();

COMMENT ON FUNCTION public.sincronizar_presupuesto_offline_bp12(jsonb, jsonb, uuid) IS
  'BP12/BP07: runs BP09 atomic budget validation, persists explicit clinic-scoped lab classification, and creates linked orders transactionally on acceptance.';
