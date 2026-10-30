-- BP07 CORE: abono manual atómico e idempotente, sin emisión fiscal.
BEGIN;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS presupuesto_id uuid REFERENCES public.presupuestos(id),
  ADD COLUMN IF NOT EXISTS referencia text;
CREATE INDEX IF NOT EXISTS idx_pagos_presupuesto ON public.pagos(presupuesto_id);

-- Los saldos previos son una línea de base; solo los pagos enlazados nuevos
-- pueden incrementarlos. Se evita reescribir saldos desde la caché del cliente.
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS monto_abonado_legacy integer NOT NULL DEFAULT 0;
UPDATE public.presupuestos SET monto_abonado_legacy = COALESCE(monto_abonado, 0)
  WHERE monto_abonado_legacy = 0 AND COALESCE(monto_abonado, 0) > 0;

DROP POLICY IF EXISTS pagos_select_rol ON public.pagos;
DROP POLICY IF EXISTS pagos_insert_rol ON public.pagos;
DROP POLICY IF EXISTS pagos_update_rol ON public.pagos;
DROP POLICY IF EXISTS pagos_delete_rol ON public.pagos;

CREATE POLICY pagos_bp07_select ON public.pagos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (paciente_id IS NULL OR EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id))
    AND (presupuesto_id IS NULL OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id)));
CREATE POLICY pagos_bp07_insert ON public.pagos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual() AND user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (paciente_id IS NULL OR EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id))
    AND (presupuesto_id IS NULL OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id AND b.paciente_id = paciente_id)));
CREATE POLICY pagos_bp07_update ON public.pagos FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual() AND user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]))
  WITH CHECK (clinica_id = public.clinica_actual() AND user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (paciente_id IS NULL OR EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id))
    AND (presupuesto_id IS NULL OR EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id AND b.paciente_id = paciente_id)));
-- Los pagos asociados a presupuesto no se eliminan: se conserva el rastro financiero.
CREATE POLICY pagos_bp07_delete_legacy ON public.pagos FOR DELETE TO authenticated
  USING (presupuesto_id IS NULL AND clinica_id = public.clinica_actual()
    AND user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.validar_saldo_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_pagos bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.monto_abonado, 0) <> 0 OR NEW.monto_abonado_legacy <> 0 THEN
      RAISE EXCEPTION 'Saldo inicial de presupuesto inválido';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.monto_abonado_legacy IS DISTINCT FROM OLD.monto_abonado_legacy THEN
    RAISE EXCEPTION 'El saldo histórico no puede modificarse';
  END IF;
  IF NEW.monto_abonado IS DISTINCT FROM OLD.monto_abonado THEN
    IF NEW.monto_abonado < OLD.monto_abonado THEN
      RAISE EXCEPTION 'El saldo abonado no puede disminuir';
    END IF;
    SELECT COALESCE(SUM(p.monto), 0) INTO v_pagos FROM public.pagos p
      WHERE p.presupuesto_id = NEW.id AND p.clinica_id = NEW.clinica_id;
    IF NEW.monto_abonado IS DISTINCT FROM NEW.monto_abonado_legacy + v_pagos THEN
      RAISE EXCEPTION 'Saldo abonado inconsistente con los pagos';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_saldo_presupuesto ON public.presupuestos;
CREATE TRIGGER trg_validar_saldo_presupuesto
  BEFORE INSERT OR UPDATE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.validar_saldo_presupuesto();

-- La misma validación se aplica a inserciones directas y a la función RPC.
CREATE OR REPLACE FUNCTION public.validar_abono_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_presupuesto public.presupuestos%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.presupuesto_id IS NOT NULL OR (TG_OP = 'UPDATE' AND NEW.presupuesto_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Un abono de presupuesto no puede modificarse ni eliminarse';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF NEW.presupuesto_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = NEW.presupuesto_id AND b.clinica_id = NEW.clinica_id
      AND b.paciente_id = NEW.paciente_id FOR UPDATE;
  IF NOT FOUND OR NEW.user_id IS DISTINCT FROM auth.uid()
    OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
    OR NEW.monto IS NULL OR NEW.monto <= 0
    OR v_presupuesto.estado NOT IN ('aprobado','en-curso','Aprobado','EnTratamiento')
    OR v_presupuesto.monto_total IS NULL
    OR COALESCE(v_presupuesto.monto_abonado, 0) + NEW.monto > v_presupuesto.monto_total THEN
    RAISE EXCEPTION 'Abono no autorizado o saldo insuficiente';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_abono_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF NEW.presupuesto_id IS NOT NULL THEN
    UPDATE public.presupuestos b
    SET monto_abonado = COALESCE(b.monto_abonado, 0) + NEW.monto,
        estado = CASE WHEN COALESCE(b.monto_abonado, 0) + NEW.monto = b.monto_total
          THEN 'completado' ELSE 'en-curso' END
    WHERE b.id = NEW.presupuesto_id AND b.clinica_id = NEW.clinica_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_abono_presupuesto ON public.pagos;
CREATE TRIGGER trg_validar_abono_presupuesto
  BEFORE INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.validar_abono_presupuesto();
DROP TRIGGER IF EXISTS trg_aplicar_abono_presupuesto ON public.pagos;
CREATE TRIGGER trg_aplicar_abono_presupuesto
  AFTER INSERT ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_abono_presupuesto();

CREATE OR REPLACE FUNCTION public.registrar_abono_presupuesto(
  p_pago_id uuid,
  p_presupuesto_id uuid,
  p_monto integer,
  p_metodo_pago text,
  p_referencia text DEFAULT NULL
)
RETURNS TABLE(pago_id uuid, monto_abonado integer, estado_presupuesto text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id uuid;
  v_presupuesto public.presupuestos%ROWTYPE;
  v_existente public.pagos%ROWTYPE;
  v_insertado uuid;
  v_nuevo_abonado integer;
  v_nuevo_estado text;
BEGIN
  v_clinica_id := public.clinica_actual();
  IF auth.uid() IS NULL OR v_clinica_id IS NULL
    OR NOT public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    OR p_pago_id IS NULL OR p_presupuesto_id IS NULL
    OR p_monto IS NULL OR p_monto <= 0
    OR p_metodo_pago IS NULL
    OR p_metodo_pago NOT IN ('efectivo','transferencia','tarjeta','cheque') THEN
    RAISE EXCEPTION 'Abono no autorizado o datos inválidos';
  END IF;

  SELECT * INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica_id
      AND EXISTS (SELECT 1 FROM public.pacientes p
        WHERE p.id = b.paciente_id AND p.clinica_id = v_clinica_id)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no disponible'; END IF;

  SELECT * INTO v_existente FROM public.pagos p
    WHERE p.id = p_pago_id AND p.clinica_id = v_clinica_id FOR UPDATE;
  IF FOUND THEN
    IF v_existente.presupuesto_id IS DISTINCT FROM p_presupuesto_id
      OR v_existente.monto IS DISTINCT FROM p_monto
      OR v_existente.metodo_pago IS DISTINCT FROM p_metodo_pago THEN
      RAISE EXCEPTION 'Identificador de pago en uso';
    END IF;
    RETURN QUERY SELECT v_existente.id, v_presupuesto.monto_abonado, v_presupuesto.estado;
    RETURN;
  END IF;

  IF v_presupuesto.estado NOT IN ('aprobado','en-curso','Aprobado','EnTratamiento')
    OR v_presupuesto.monto_total IS NULL
    OR COALESCE(v_presupuesto.monto_abonado, 0) + p_monto > v_presupuesto.monto_total THEN
    RAISE EXCEPTION 'Presupuesto sin saldo disponible para abono';
  END IF;

  INSERT INTO public.pagos (
    id, user_id, clinica_id, paciente_id, presupuesto_id,
    folio, monto, metodo_pago, fecha, concepto, referencia
  ) VALUES (
    p_pago_id, auth.uid(), v_clinica_id, v_presupuesto.paciente_id, p_presupuesto_id,
    'PAGO-' || substr(p_pago_id::text, 1, 12), p_monto, p_metodo_pago,
    CURRENT_DATE, 'Abono presupuesto ' || v_presupuesto.folio, left(p_referencia, 250)
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_insertado;
  IF v_insertado IS NULL THEN RAISE EXCEPTION 'Identificador de pago en uso'; END IF;

  SELECT b.monto_abonado, b.estado INTO v_nuevo_abonado, v_nuevo_estado
    FROM public.presupuestos b WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica_id;

  RETURN QUERY SELECT p_pago_id, v_nuevo_abonado, v_nuevo_estado;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_abono_presupuesto(uuid,uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_abono_presupuesto(uuid,uuid,integer,text,text) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pagos TO authenticated;

COMMIT;
