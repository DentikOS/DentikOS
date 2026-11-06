-- Corrige colisión de UUID de ítems entre versiones; migración aditiva posterior.
BEGIN;
CREATE OR REPLACE FUNCTION public.crear_version_presupuesto_desde_plan(
  p_presupuesto_id uuid,
  p_plan_revision text,
  p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_origen public.presupuestos%ROWTYPE;
  v_nuevo_id uuid;
  v_items_nuevos jsonb;
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

  -- Los UUID de ítems son globales: cada versión necesita ids nuevos.
  SELECT jsonb_agg(jsonb_set(item.value, '{id}', to_jsonb(gen_random_uuid()::text)))
    INTO v_items_nuevos FROM jsonb_array_elements(p_items) AS item(value);
  PERFORM public.sincronizar_borrador_desde_plan(v_nuevo_id, v_origen.version, p_plan_revision, v_items_nuevos);
  UPDATE public.presupuestos SET version_grupo_id = v_origen.version_grupo_id
    WHERE id = v_nuevo_id AND clinica_id = v_clinica;
  RETURN v_nuevo_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.crear_version_presupuesto_desde_plan(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_version_presupuesto_desde_plan(uuid,text,jsonb) TO authenticated;
COMMIT;
