-- La fila del presupuesto ya está bloqueada; leer un pago previo no requiere UPDATE.
-- Esto permite reintentos idempotentes de recepción sin otorgarle edición de pagos.
BEGIN;

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
    OR NOT public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[])
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
    WHERE p.id = p_pago_id AND p.clinica_id = v_clinica_id;
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



COMMIT;
