-- BP07: asociación explícita al plan y reemplazo atómico de ítems de borrador.
BEGIN;

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS origen_plan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_revision text,
  ADD COLUMN IF NOT EXISTS version_grupo_id uuid,
  ADD COLUMN IF NOT EXISTS requiere_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descuento_global_pct numeric;

ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_descuento_global_pct_valido
  CHECK (descuento_global_pct IS NULL OR descuento_global_pct BETWEEN 0 AND 100) NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_presupuestos_grupo_version
  ON public.presupuestos(clinica_id, version_grupo_id, version)
  WHERE version_grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_plan_paciente
  ON public.presupuestos(clinica_id, paciente_id, origen_plan)
  WHERE origen_plan = true;

CREATE OR REPLACE FUNCTION public.proteger_revision_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.requiere_revision AND NOT NEW.requiere_revision
      AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'La revisión del presupuesto requiere un profesional autorizado';
    END IF;
    IF OLD.requiere_revision AND NEW.estado IS DISTINCT FROM OLD.estado
      AND NEW.estado IN ('enviado','Emitido','Pendiente','aprobado','Aprobado') THEN
      RAISE EXCEPTION 'Revise el presupuesto antes de enviarlo o aprobarlo';
    END IF;
    IF OLD.estado IN ('enviado','Emitido','Pendiente','aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado')
      AND (NEW.monto_total IS DISTINCT FROM OLD.monto_total
        OR NEW.detalle_items IS DISTINCT FROM OLD.detalle_items
        OR NEW.total_bruto IS DISTINCT FROM OLD.total_bruto
        OR NEW.total_descuentos IS DISTINCT FROM OLD.total_descuentos
        OR NEW.descuentos IS DISTINCT FROM OLD.descuentos
        OR NEW.plan_pago IS DISTINCT FROM OLD.plan_pago
        OR NEW.plan_revision IS DISTINCT FROM OLD.plan_revision
        OR NEW.origen_plan IS DISTINCT FROM OLD.origen_plan) THEN
      RAISE EXCEPTION 'Cree una nueva versión para modificar los importes de este presupuesto';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_proteger_revision_presupuesto ON public.presupuestos;
CREATE TRIGGER trg_proteger_revision_presupuesto
  BEFORE UPDATE ON public.presupuestos FOR EACH ROW
  EXECUTE FUNCTION public.proteger_revision_presupuesto();

-- El RPC invocador necesita poder reemplazar ítems del borrador, nunca de una versión aceptada.
CREATE POLICY presupuesto_items_bp07_delete_plan_draft ON public.presupuesto_items
  FOR DELETE TO authenticated USING (
    clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id
        AND b.paciente_id = presupuesto_items.paciente_id
        AND b.origen_plan AND b.estado IN ('borrador','Borrador')
        AND b.monto_abonado = 0));
GRANT DELETE ON public.presupuesto_items TO authenticated;

CREATE OR REPLACE FUNCTION public.sincronizar_borrador_desde_plan(
  p_presupuesto_id uuid,
  p_version_esperada integer,
  p_plan_revision text,
  p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_presupuesto public.presupuestos%ROWTYPE;
  v_item jsonb;
  v_bruto bigint := 0;
  v_descuento bigint;
  v_id uuid;
  v_prestacion uuid;
  v_cantidad integer;
  v_precio integer;
  v_descuento_item integer;
  v_subtotal integer;
  v_nombre text;
  v_codigo text;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL OR p_presupuesto_id IS NULL
    OR p_version_esperada IS NULL OR p_version_esperada < 1
    OR p_plan_revision IS NULL OR btrim(p_plan_revision) = ''
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR length(p_plan_revision) > 100
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede sincronizar el borrador';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'Demasiados ítems de presupuesto';
  END IF;

  SELECT * INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica FOR UPDATE;
  IF NOT FOUND OR NOT v_presupuesto.origen_plan
    OR v_presupuesto.paciente_id IS NULL
    OR v_presupuesto.estado IS NULL OR v_presupuesto.estado NOT IN ('borrador','Borrador')
    OR COALESCE(v_presupuesto.monto_abonado, -1) <> 0
    OR v_presupuesto.version <> p_version_esperada
    OR NOT EXISTS (SELECT 1 FROM public.fichas_clinicas f
      WHERE f.clinica_id = v_clinica AND f.paciente_id = v_presupuesto.paciente_id
        AND f.plan_tratamiento->>'actualizadoAt' = p_plan_revision) THEN
    RAISE EXCEPTION 'Borrador o revisión de plan no disponible';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
      OR COALESCE(v_item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR COALESCE(v_item->>'cantidad','') !~ '^[0-9]+$'
      OR COALESCE(v_item->>'precioUnitario','') !~ '^[0-9]+$'
      OR COALESCE(v_item->>'descuento','') !~ '^[0-9]+$'
      OR COALESCE(v_item->>'subtotal','') !~ '^[0-9]+$'
      OR btrim(COALESCE(v_item->>'nombrePrestacion','')) = '' THEN
      RAISE EXCEPTION 'Ítem de presupuesto inválido';
    END IF;
    v_id := (v_item->>'id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precioUnitario')::integer;
    v_descuento_item := (v_item->>'descuento')::integer;
    v_subtotal := (v_item->>'subtotal')::integer;
    v_nombre := btrim(v_item->>'nombrePrestacion');
    IF v_cantidad < 1 OR v_cantidad > 1000 OR v_descuento_item > v_cantidad::bigint * v_precio
      OR v_subtotal::bigint <> v_cantidad::bigint * v_precio - v_descuento_item THEN
      RAISE EXCEPTION 'Importe de ítem inválido';
    END IF;
    v_codigo := COALESCE(v_item->>'codigoPrestacion','');
    v_prestacion := NULL;
    IF v_codigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_prestacion := v_codigo::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.prestaciones p
        WHERE p.id = v_prestacion AND p.clinica_id = v_clinica) THEN
        RAISE EXCEPTION 'Prestación no disponible en esta clínica';
      END IF;
    END IF;
    v_bruto := v_bruto + v_subtotal;
  END LOOP;
  IF v_bruto < 1 OR v_bruto > 2147483647 THEN
    RAISE EXCEPTION 'Total de presupuesto inválido';
  END IF;
  v_descuento := CASE WHEN v_presupuesto.descuento_global_pct IS NULL
    THEN LEAST(v_bruto, GREATEST(0, v_presupuesto.total_descuentos))
    ELSE round(v_bruto * v_presupuesto.descuento_global_pct / 100)::bigint END;
  IF v_bruto - v_descuento < 1 THEN RAISE EXCEPTION 'Total de presupuesto inválido'; END IF;

  -- UPDATE, DELETE e INSERT se ejecutan en la misma transacción de la llamada RPC.
  UPDATE public.presupuestos SET detalle_items = p_items, total_bruto = v_bruto,
    total_descuentos = v_descuento, monto_total = v_bruto - v_descuento,
    plan_revision = p_plan_revision, requiere_revision = true,
    version = version + 1, updated_at = now()
    WHERE id = v_presupuesto.id AND clinica_id = v_clinica;
  DELETE FROM public.presupuesto_items
    WHERE presupuesto_id = v_presupuesto.id AND clinica_id = v_clinica;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_codigo := COALESCE(v_item->>'codigoPrestacion','');
    v_prestacion := CASE WHEN v_codigo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN v_codigo::uuid ELSE NULL END;
    INSERT INTO public.presupuesto_items(id, presupuesto_id, paciente_id, clinica_id,
      prestacion_id, prestacion_nombre, valor, convenio, estado)
    VALUES ((v_item->>'id')::uuid, v_presupuesto.id, v_presupuesto.paciente_id,
      v_clinica, v_prestacion, v_item->>'nombrePrestacion', (v_item->>'subtotal')::integer,
      v_presupuesto.convenio, 'Pendiente');
  END LOOP;
  RETURN v_presupuesto.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sincronizar_borrador_desde_plan(uuid,integer,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_borrador_desde_plan(uuid,integer,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_version_presupuesto_desde_plan(
  p_presupuesto_id uuid,
  p_plan_revision text,
  p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_origen public.presupuestos%ROWTYPE;
  v_nuevo_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL OR p_presupuesto_id IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede crear una versión';
  END IF;
  SELECT * INTO v_origen FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica FOR UPDATE;
  IF NOT FOUND OR NOT v_origen.origen_plan OR v_origen.version_grupo_id IS NULL
    OR v_origen.estado IS NULL OR v_origen.estado NOT IN ('enviado','Emitido','Pendiente','aprobado','Aprobado','en-curso','EnTratamiento')
    OR v_origen.plan_revision IS NOT DISTINCT FROM p_plan_revision
    OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.clinica_id = v_clinica AND b.version_grupo_id = v_origen.version_grupo_id
        AND b.version > v_origen.version) THEN
    RAISE EXCEPTION 'La versión de origen ya no está disponible';
  END IF;

  -- Se crea sin grupo hasta que el RPC de sincronización valida e incrementa la versión.
  -- Todo ocurre dentro de la misma transacción; ante cualquier error se revierte.
  INSERT INTO public.presupuestos(user_id, clinica_id, paciente_id, folio,
    paciente_nombre, paciente_rut, fecha_emision, convenio, monto_total,
    monto_abonado, estado, observacion, detalle_items, total_bruto,
    total_descuentos, fecha_vencimiento, descuentos, plan_pago, version,
    origen_plan, plan_revision, version_grupo_id, requiere_revision, descuento_global_pct)
  VALUES (auth.uid(), v_clinica, v_origen.paciente_id,
    v_origen.folio || '-v' || (v_origen.version + 1),
    v_origen.paciente_nombre, v_origen.paciente_rut, current_date,
    v_origen.convenio, v_origen.monto_total, 0, 'borrador',
    v_origen.observacion, v_origen.detalle_items, v_origen.total_bruto,
    v_origen.total_descuentos, now() + interval '15 days',
    v_origen.descuentos, NULL, v_origen.version,
    true, v_origen.plan_revision, NULL, true, v_origen.descuento_global_pct)
  RETURNING id INTO v_nuevo_id;

  PERFORM public.sincronizar_borrador_desde_plan(v_nuevo_id, v_origen.version, p_plan_revision, p_items);
  UPDATE public.presupuestos SET version_grupo_id = v_origen.version_grupo_id
    WHERE id = v_nuevo_id AND clinica_id = v_clinica;
  RETURN v_nuevo_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.crear_version_presupuesto_desde_plan(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_version_presupuesto_desde_plan(uuid,text,jsonb) TO authenticated;
COMMIT;
