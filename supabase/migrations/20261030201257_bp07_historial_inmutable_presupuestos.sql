-- BP07: snapshots financieros append-only; pagos y cambios de estado siguen su auditoría propia.
CREATE SCHEMA IF NOT EXISTS bp07_private;
REVOKE ALL ON SCHEMA bp07_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.presupuesto_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  clinica_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  fecha timestamptz NOT NULL,
  actor_user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('creacion','cambio_financiero')),
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  motivo_origen text NOT NULL CHECK (motivo_origen IN ('usuario','sistema')),
  anterior jsonb,
  nuevo jsonb NOT NULL,
  hash_sha256 text NOT NULL CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (presupuesto_id, revision)
);
CREATE INDEX idx_presupuesto_versiones_clinica_paciente
  ON public.presupuesto_versiones(clinica_id, paciente_id, fecha DESC);
ALTER TABLE public.presupuesto_versiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY presupuesto_versiones_select ON public.presupuesto_versiones FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
REVOKE ALL ON public.presupuesto_versiones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.presupuesto_versiones TO authenticated;

CREATE FUNCTION bp07_private.registrar_version_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_anterior jsonb;
  v_nuevo jsonb;
  v_fecha timestamptz := clock_timestamp();
  v_revision integer;
  v_motivo text;
  v_origen text;
  v_tipo text;
  v_hash text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.origen_plan AND NEW.version_grupo_id IS NULL THEN
    RETURN NULL; -- fila provisional de crear_version_presupuesto_desde_plan()
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.detalle_items IS NOT DISTINCT FROM OLD.detalle_items
      AND NEW.total_bruto IS NOT DISTINCT FROM OLD.total_bruto
      AND NEW.total_descuentos IS NOT DISTINCT FROM OLD.total_descuentos
      AND NEW.monto_total IS NOT DISTINCT FROM OLD.monto_total
      AND NEW.descuentos IS NOT DISTINCT FROM OLD.descuentos
      AND NEW.plan_pago IS NOT DISTINCT FROM OLD.plan_pago
      AND NEW.descuento_global_pct IS NOT DISTINCT FROM OLD.descuento_global_pct THEN
      RETURN NULL;
    END IF;
  END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR NEW.paciente_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = NEW.paciente_id AND p.clinica_id = NEW.clinica_id)
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede registrar la versión del presupuesto';
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_tipo := 'creacion';
    v_anterior := NULL;
  ELSE
    v_tipo := 'cambio_financiero';
    v_anterior := jsonb_build_object('detalle_items',OLD.detalle_items,'total_bruto',OLD.total_bruto,
      'total_descuentos',OLD.total_descuentos,'monto_total',OLD.monto_total,
      'descuentos',OLD.descuentos,'plan_pago',OLD.plan_pago,'descuento_global_pct',OLD.descuento_global_pct);
  END IF;
  v_nuevo := jsonb_build_object('detalle_items',NEW.detalle_items,'total_bruto',NEW.total_bruto,
    'total_descuentos',NEW.total_descuentos,'monto_total',NEW.monto_total,
    'descuentos',NEW.descuentos,'plan_pago',NEW.plan_pago,'descuento_global_pct',NEW.descuento_global_pct);
  v_motivo := nullif(btrim(current_setting('app.bp07_motivo', true)), '');
  IF v_motivo IS NULL THEN
    v_motivo := CASE WHEN v_tipo = 'creacion' THEN 'Creación inicial del presupuesto'
      WHEN NEW.origen_plan AND NEW.plan_revision IS DISTINCT FROM OLD.plan_revision
        THEN 'Actualización del plan de tratamiento'
      ELSE 'Cambio financiero registrado por cliente anterior' END;
    v_origen := 'sistema';
  ELSE
    IF length(v_motivo) > 500 THEN RAISE EXCEPTION 'Motivo de versión demasiado largo'; END IF;
    v_origen := 'usuario';
  END IF;
  SELECT COALESCE(max(h.revision),0) + 1 INTO v_revision FROM public.presupuesto_versiones h
    WHERE h.presupuesto_id = NEW.id;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'presupuesto_id',NEW.id,'clinica_id',NEW.clinica_id,'paciente_id',NEW.paciente_id,
    'revision',v_revision,'fecha',v_fecha,'actor_user_id',v_actor,'tipo',v_tipo,
    'motivo',v_motivo,'anterior',v_anterior,'nuevo',v_nuevo)::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.presupuesto_versiones(presupuesto_id,clinica_id,paciente_id,revision,fecha,
    actor_user_id,tipo,motivo,motivo_origen,anterior,nuevo,hash_sha256)
  VALUES(NEW.id,NEW.clinica_id,NEW.paciente_id,v_revision,v_fecha,v_actor,v_tipo,
    v_motivo,v_origen,v_anterior,v_nuevo,v_hash);
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION bp07_private.registrar_version_presupuesto() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_registrar_version_presupuesto
  AFTER INSERT OR UPDATE ON public.presupuestos FOR EACH ROW
  EXECUTE FUNCTION bp07_private.registrar_version_presupuesto();

CREATE FUNCTION public.sincronizar_borrador_desde_plan_con_motivo(
  p_presupuesto_id uuid, p_version_esperada integer, p_plan_revision text,
  p_items jsonb, p_motivo text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' OR length(btrim(p_motivo)) > 500 THEN
    RAISE EXCEPTION 'Indique el motivo de la nueva versión';
  END IF;
  PERFORM set_config('app.bp07_motivo', btrim(p_motivo), true);
  RETURN public.sincronizar_borrador_desde_plan(p_presupuesto_id,p_version_esperada,p_plan_revision,p_items);
END;
$function$;
REVOKE ALL ON FUNCTION public.sincronizar_borrador_desde_plan_con_motivo(uuid,integer,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_borrador_desde_plan_con_motivo(uuid,integer,text,jsonb,text) TO authenticated;

CREATE FUNCTION public.crear_version_presupuesto_desde_plan_con_motivo(
  p_presupuesto_id uuid, p_plan_revision text, p_items jsonb, p_motivo text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' OR length(btrim(p_motivo)) > 500 THEN
    RAISE EXCEPTION 'Indique el motivo de la nueva versión';
  END IF;
  PERFORM set_config('app.bp07_motivo', btrim(p_motivo), true);
  RETURN public.crear_version_presupuesto_desde_plan(p_presupuesto_id,p_plan_revision,p_items);
END;
$function$;
REVOKE ALL ON FUNCTION public.crear_version_presupuesto_desde_plan_con_motivo(uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_version_presupuesto_desde_plan_con_motivo(uuid,text,jsonb,text) TO authenticated;
