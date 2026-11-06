-- BP07 CORE: imputación manual, auditable e inmutable de abonos a prestaciones.
BEGIN;

CREATE TABLE public.pago_imputaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id),
  pago_id uuid NOT NULL REFERENCES public.pagos(id),
  presupuesto_item_id uuid NOT NULL REFERENCES public.presupuesto_items(id),
  tipo text NOT NULL CHECK (tipo IN ('imputacion', 'reversion')),
  monto integer NOT NULL CHECK (monto > 0),
  operacion_id uuid NOT NULL,
  revierte_id uuid,
  motivo text,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pago_imputaciones_evento_valido CHECK (
    (tipo = 'imputacion' AND revierte_id IS NULL AND motivo IS NULL)
    OR (tipo = 'reversion' AND revierte_id IS NOT NULL AND motivo IS NOT NULL
      AND length(btrim(motivo)) BETWEEN 5 AND 250)
  ),
  CONSTRAINT pago_imputaciones_contexto_unico UNIQUE
    (id, clinica_id, paciente_id, presupuesto_id, pago_id, presupuesto_item_id),
  CONSTRAINT pago_imputaciones_operacion_unica UNIQUE
    (clinica_id, pago_id, operacion_id, presupuesto_item_id, tipo),
  CONSTRAINT pago_imputaciones_reversion_contexto_fkey FOREIGN KEY
    (revierte_id, clinica_id, paciente_id, presupuesto_id, pago_id, presupuesto_item_id)
    REFERENCES public.pago_imputaciones
      (id, clinica_id, paciente_id, presupuesto_id, pago_id, presupuesto_item_id)
);

COMMENT ON TABLE public.pago_imputaciones IS
  'Libro append-only BP07 de imputaciones y reversiones manuales de abonos a prestaciones.';
COMMENT ON COLUMN public.pago_imputaciones.operacion_id IS
  'Clave idempotente de cada solicitud de imputación o reversión.';

CREATE INDEX idx_pago_imputaciones_presupuesto_item
  ON public.pago_imputaciones(clinica_id, presupuesto_id, presupuesto_item_id);
CREATE INDEX idx_pago_imputaciones_pago
  ON public.pago_imputaciones(clinica_id, pago_id, created_at);
CREATE INDEX idx_pago_imputaciones_revierte
  ON public.pago_imputaciones(revierte_id) WHERE revierte_id IS NOT NULL;

ALTER TABLE public.pago_imputaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pago_imputaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pago_imputaciones TO authenticated;

CREATE POLICY pago_imputaciones_select_clinica ON public.pago_imputaciones
  FOR SELECT TO authenticated USING (
    clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[])
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = pago_imputaciones.paciente_id AND p.clinica_id = pago_imputaciones.clinica_id)
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = pago_imputaciones.presupuesto_id
        AND b.clinica_id = pago_imputaciones.clinica_id
        AND b.paciente_id = pago_imputaciones.paciente_id)
    AND EXISTS (SELECT 1 FROM public.pagos pg
      WHERE pg.id = pago_imputaciones.pago_id
        AND pg.clinica_id = pago_imputaciones.clinica_id
        AND pg.paciente_id = pago_imputaciones.paciente_id
        AND pg.presupuesto_id = pago_imputaciones.presupuesto_id)
    AND EXISTS (SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.id = pago_imputaciones.presupuesto_item_id
        AND bi.clinica_id = pago_imputaciones.clinica_id
        AND bi.paciente_id = pago_imputaciones.paciente_id
        AND bi.presupuesto_id = pago_imputaciones.presupuesto_id)
  );

CREATE OR REPLACE FUNCTION public.bloquear_modificacion_pago_imputacion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  RAISE EXCEPTION 'El libro de imputaciones es inmutable';
END;
$function$;

CREATE TRIGGER trg_pago_imputaciones_immutability
  BEFORE UPDATE OR DELETE ON public.pago_imputaciones
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_pago_imputacion();

-- Distribuye el descuento global en CLP enteros. El remanente se asigna por UUID,
-- para que la suma neta de las prestaciones sea exactamente el total del presupuesto.
CREATE OR REPLACE FUNCTION public.calcular_montos_netos_presupuesto(p_presupuesto_id uuid)
RETURNS TABLE(presupuesto_item_id uuid, valor_bruto integer, valor_neto integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_presupuesto public.presupuestos%ROWTYPE;
  v_suma_items bigint;
  v_cantidad_items bigint;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR p_presupuesto_id IS NULL THEN
    RAISE EXCEPTION 'Presupuesto no disponible';
  END IF;

  SELECT b.* INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica
      AND b.paciente_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.pacientes p
        WHERE p.id = b.paciente_id AND p.clinica_id = v_clinica);
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no disponible'; END IF;

  SELECT COALESCE(sum(bi.valor), 0), count(*) INTO v_suma_items, v_cantidad_items
    FROM public.presupuesto_items bi
    WHERE bi.presupuesto_id = p_presupuesto_id
      AND bi.paciente_id = v_presupuesto.paciente_id
      AND bi.clinica_id = v_clinica;

  IF v_cantidad_items = 0 OR v_suma_items <> v_presupuesto.total_bruto
    OR EXISTS (SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = p_presupuesto_id
        AND bi.paciente_id = v_presupuesto.paciente_id
        AND bi.clinica_id = v_clinica AND bi.valor < 0)
    OR v_presupuesto.total_descuentos < 0
    OR v_presupuesto.total_descuentos > v_presupuesto.total_bruto
    OR v_presupuesto.monto_total IS DISTINCT FROM
      v_presupuesto.total_bruto - v_presupuesto.total_descuentos THEN
    RAISE EXCEPTION 'Importes del presupuesto requieren revisión antes de imputar';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT bi.id AS item_id, bi.valor::bigint AS bruto,
      floor(v_presupuesto.total_descuentos::numeric * bi.valor::numeric
        / v_presupuesto.total_bruto)::bigint AS descuento_base
    FROM public.presupuesto_items bi
    WHERE bi.presupuesto_id = p_presupuesto_id
      AND bi.paciente_id = v_presupuesto.paciente_id
      AND bi.clinica_id = v_clinica
  ), reparto AS (
    SELECT base.*,
      v_presupuesto.total_descuentos::bigint - sum(descuento_base) OVER () AS resto,
      row_number() OVER (ORDER BY (bruto <= descuento_base), item_id) AS orden_resto
    FROM base
  )
  SELECT r.item_id, r.bruto::integer,
    (r.bruto - r.descuento_base - CASE
      WHEN r.bruto > r.descuento_base AND r.orden_resto <= r.resto THEN 1 ELSE 0 END)::integer
  FROM reparto r
  ORDER BY r.item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.calcular_montos_netos_presupuesto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_montos_netos_presupuesto(uuid) TO authenticated;

-- Devuelve la proyección financiera del presupuesto sin persistir un estado duplicado.
CREATE OR REPLACE FUNCTION public.listar_imputaciones_presupuesto(p_presupuesto_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_paciente uuid;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR p_presupuesto_id IS NULL THEN
    RAISE EXCEPTION 'Presupuesto no disponible';
  END IF;

  SELECT b.paciente_id INTO v_paciente FROM public.presupuestos b
    WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica
      AND EXISTS (SELECT 1 FROM public.pacientes p
        WHERE p.id = b.paciente_id AND p.clinica_id = v_clinica);
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no disponible'; END IF;

  SELECT jsonb_build_object(
    'presupuesto_id', p_presupuesto_id,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.presupuesto_item_id,
        'nombre', bi.prestacion_nombre,
        'valor_bruto', n.valor_bruto,
        'monto_neto', n.valor_neto,
        'monto_imputado', COALESCE(a.monto_imputado, 0),
        'saldo_pendiente', GREATEST(0, n.valor_neto - COALESCE(a.monto_imputado, 0)),
        'estado_financiero', CASE
          WHEN n.valor_neto = 0 THEN 'sin_saldo'
          WHEN COALESCE(a.monto_imputado, 0) >= n.valor_neto THEN 'pagado'
          WHEN COALESCE(a.monto_imputado, 0) > 0 THEN 'parcial'
          ELSE 'pendiente' END
      ) ORDER BY n.presupuesto_item_id)
      FROM public.calcular_montos_netos_presupuesto(p_presupuesto_id) n
      JOIN public.presupuesto_items bi ON bi.id = n.presupuesto_item_id
        AND bi.presupuesto_id = p_presupuesto_id
        AND bi.paciente_id = v_paciente AND bi.clinica_id = v_clinica
      LEFT JOIN LATERAL (
        SELECT sum(CASE WHEN pi.tipo = 'imputacion' THEN pi.monto ELSE -pi.monto END)::integer AS monto_imputado
        FROM public.pago_imputaciones pi
        WHERE pi.clinica_id = v_clinica AND pi.presupuesto_id = p_presupuesto_id
          AND pi.presupuesto_item_id = bi.id
      ) a ON true
    ), '[]'::jsonb),
    'pagos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id, 'monto', pg.monto, 'metodo_pago', pg.metodo_pago,
        'fecha', pg.fecha, 'referencia', pg.referencia,
        'monto_imputado', COALESCE(a.monto_imputado, 0),
        'monto_sin_imputar', GREATEST(0, pg.monto - COALESCE(a.monto_imputado, 0))
      ) ORDER BY pg.fecha DESC, pg.created_at DESC, pg.id)
      FROM public.pagos pg
      LEFT JOIN LATERAL (
        SELECT sum(CASE WHEN pi.tipo = 'imputacion' THEN pi.monto ELSE -pi.monto END)::integer AS monto_imputado
        FROM public.pago_imputaciones pi
        WHERE pi.clinica_id = v_clinica AND pi.pago_id = pg.id
      ) a ON true
      WHERE pg.clinica_id = v_clinica AND pg.paciente_id = v_paciente
        AND pg.presupuesto_id = p_presupuesto_id
    ), '[]'::jsonb),
    'imputaciones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pi.id, 'pago_id', pi.pago_id, 'item_id', pi.presupuesto_item_id,
        'item_nombre', bi.prestacion_nombre, 'monto', pi.monto,
        'monto_revertido', COALESCE(r.monto_revertido, 0),
        'monto_vigente', GREATEST(0, pi.monto - COALESCE(r.monto_revertido, 0)),
        'actor_user_id', pi.actor_user_id, 'created_at', pi.created_at,
        'reversiones', COALESCE(r.eventos, '[]'::jsonb)
      ) ORDER BY pi.created_at, pi.id)
      FROM public.pago_imputaciones pi
      JOIN public.presupuesto_items bi ON bi.id = pi.presupuesto_item_id
        AND bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica
      LEFT JOIN LATERAL (
        SELECT sum(rv.monto)::integer AS monto_revertido,
          jsonb_agg(jsonb_build_object('id', rv.id, 'monto', rv.monto,
            'motivo', rv.motivo, 'actor_user_id', rv.actor_user_id,
            'created_at', rv.created_at) ORDER BY rv.created_at, rv.id) AS eventos
        FROM public.pago_imputaciones rv
        WHERE rv.tipo = 'reversion' AND rv.revierte_id = pi.id
          AND rv.clinica_id = v_clinica
      ) r ON true
      WHERE pi.clinica_id = v_clinica AND pi.presupuesto_id = p_presupuesto_id
        AND pi.tipo = 'imputacion'
    ), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_imputaciones_presupuesto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_imputaciones_presupuesto(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_imputaciones_pago(
  p_pago_id uuid,
  p_operacion_id uuid,
  p_imputaciones jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_presupuesto public.presupuestos%ROWTYPE;
  v_pago public.pagos%ROWTYPE;
  v_item_id uuid;
  v_monto integer;
  v_monto_neto integer;
  v_imputado_item bigint;
  v_imputado_pago bigint;
  v_monto_solicitado bigint := 0;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR p_pago_id IS NULL OR p_operacion_id IS NULL
    OR jsonb_typeof(p_imputaciones) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Imputación no autorizada o datos inválidos';
  END IF;
  IF jsonb_array_length(p_imputaciones) > 100 THEN
    RAISE EXCEPTION 'Demasiadas imputaciones';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_imputaciones) AS x(v)
    WHERE jsonb_typeof(x.v) IS DISTINCT FROM 'object'
      OR COALESCE(x.v->>'item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR COALESCE(x.v->>'monto', '') !~ '^[0-9]{1,10}$')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_imputaciones) AS x(v)
      WHERE CASE WHEN COALESCE(x.v->>'monto', '0') ~ '^[0-9]{1,10}$'
        THEN (x.v->>'monto')::numeric NOT BETWEEN 1 AND 2147483647 ELSE false END)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_imputaciones) AS x(v)
      GROUP BY lower(COALESCE(x.v->>'item_id', '')) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Detalle de imputación inválido';
  END IF;

  SELECT b.* INTO v_presupuesto FROM public.presupuestos b
    WHERE b.id = (SELECT pg.presupuesto_id FROM public.pagos pg
      WHERE pg.id = p_pago_id AND pg.clinica_id = v_clinica)
      AND b.clinica_id = v_clinica
      AND EXISTS (SELECT 1 FROM public.pacientes p
        WHERE p.id = b.paciente_id AND p.clinica_id = v_clinica)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no disponible para esta clínica'; END IF;

  SELECT pg.* INTO v_pago FROM public.pagos pg
    WHERE pg.id = p_pago_id AND pg.clinica_id = v_clinica
      AND pg.presupuesto_id = v_presupuesto.id
      AND pg.paciente_id = v_presupuesto.paciente_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no disponible para esta clínica'; END IF;

  IF EXISTS (SELECT 1 FROM public.pago_imputaciones pi
    WHERE pi.clinica_id = v_clinica AND pi.pago_id = p_pago_id
      AND pi.operacion_id = p_operacion_id) THEN
    IF EXISTS (SELECT 1 FROM public.pago_imputaciones pi
      WHERE pi.clinica_id = v_clinica AND pi.pago_id = p_pago_id
        AND pi.operacion_id = p_operacion_id AND pi.tipo <> 'imputacion')
      OR EXISTS (
        SELECT 1 FROM (
          SELECT (x.v->>'item_id')::uuid AS item_id, (x.v->>'monto')::integer AS monto
          FROM jsonb_array_elements(p_imputaciones) AS x(v)
        ) solicitada
        FULL JOIN (
          SELECT pi.presupuesto_item_id AS item_id, pi.monto
          FROM public.pago_imputaciones pi
          WHERE pi.clinica_id = v_clinica AND pi.pago_id = p_pago_id
            AND pi.operacion_id = p_operacion_id AND pi.tipo = 'imputacion'
        ) registrada USING (item_id)
        WHERE solicitada.monto IS DISTINCT FROM registrada.monto
      ) THEN
      RAISE EXCEPTION 'Identificador de operación de imputación en uso';
    END IF;
    RETURN;
  END IF;

  IF jsonb_array_length(p_imputaciones) = 0 THEN RETURN; END IF;

  SELECT COALESCE(sum((x.v->>'monto')::bigint), 0) INTO v_monto_solicitado
    FROM jsonb_array_elements(p_imputaciones) AS x(v);
  SELECT COALESCE(sum(CASE WHEN pi.tipo = 'imputacion' THEN pi.monto ELSE -pi.monto END), 0)
    INTO v_imputado_pago FROM public.pago_imputaciones pi
    WHERE pi.clinica_id = v_clinica AND pi.pago_id = p_pago_id;
  IF v_monto_solicitado > v_pago.monto - v_imputado_pago THEN
    RAISE EXCEPTION 'La imputación excede el saldo disponible del abono';
  END IF;

  FOR v_item_id, v_monto IN
    SELECT (x.v->>'item_id')::uuid, (x.v->>'monto')::integer
    FROM jsonb_array_elements(p_imputaciones) AS x(v)
  LOOP
    PERFORM 1 FROM public.presupuesto_items bi
      WHERE bi.id = v_item_id AND bi.presupuesto_id = v_presupuesto.id
        AND bi.paciente_id = v_presupuesto.paciente_id AND bi.clinica_id = v_clinica
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prestación no disponible en este presupuesto'; END IF;

    SELECT n.valor_neto INTO v_monto_neto
      FROM public.calcular_montos_netos_presupuesto(v_presupuesto.id) n
      WHERE n.presupuesto_item_id = v_item_id;
    IF NOT FOUND OR v_monto_neto <= 0 THEN
      RAISE EXCEPTION 'Prestación sin saldo imputable';
    END IF;

    SELECT COALESCE(sum(CASE WHEN pi.tipo = 'imputacion' THEN pi.monto ELSE -pi.monto END), 0)
      INTO v_imputado_item FROM public.pago_imputaciones pi
      WHERE pi.clinica_id = v_clinica AND pi.presupuesto_id = v_presupuesto.id
        AND pi.presupuesto_item_id = v_item_id;
    IF v_monto > v_monto_neto - v_imputado_item THEN
      RAISE EXCEPTION 'La imputación excede el saldo de la prestación';
    END IF;

    INSERT INTO public.pago_imputaciones(
      clinica_id, paciente_id, presupuesto_id, pago_id, presupuesto_item_id,
      tipo, monto, operacion_id, actor_user_id
    ) VALUES (
      v_clinica, v_presupuesto.paciente_id, v_presupuesto.id, v_pago.id, v_item_id,
      'imputacion', v_monto, p_operacion_id, auth.uid()
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_imputaciones_pago(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_imputaciones_pago(uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_abono_presupuesto_con_imputaciones(
  p_pago_id uuid,
  p_presupuesto_id uuid,
  p_monto integer,
  p_metodo_pago text,
  p_referencia text,
  p_imputaciones jsonb
)
RETURNS TABLE(pago_id uuid, monto_abonado integer, estado_presupuesto text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_resultado record;
BEGIN
  IF jsonb_typeof(p_imputaciones) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Detalle de imputación inválido';
  END IF;

  SELECT * INTO v_resultado FROM public.registrar_abono_presupuesto(
    p_pago_id, p_presupuesto_id, p_monto, p_metodo_pago, p_referencia
  );
  PERFORM public.registrar_imputaciones_pago(p_pago_id, p_pago_id, p_imputaciones);
  RETURN QUERY SELECT v_resultado.pago_id, v_resultado.monto_abonado,
    v_resultado.estado_presupuesto;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_abono_presupuesto_con_imputaciones(uuid,uuid,integer,text,text,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_abono_presupuesto_con_imputaciones(uuid,uuid,integer,text,text,jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.revertir_imputacion_pago(
  p_imputacion_id uuid,
  p_operacion_id uuid,
  p_motivo text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_original public.pago_imputaciones%ROWTYPE;
  v_presupuesto public.presupuestos%ROWTYPE;
  v_pago public.pagos%ROWTYPE;
  v_revertido bigint;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR p_imputacion_id IS NULL OR p_operacion_id IS NULL
    OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 250 THEN
    RAISE EXCEPTION 'Reversión no autorizada o motivo inválido';
  END IF;

  SELECT b.* INTO v_presupuesto FROM public.presupuestos b
    JOIN public.pago_imputaciones pi ON pi.presupuesto_id = b.id
      AND pi.clinica_id = b.clinica_id
    WHERE pi.id = p_imputacion_id AND pi.clinica_id = v_clinica
      AND b.clinica_id = v_clinica
    FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imputación no disponible'; END IF;

  SELECT pg.* INTO v_pago FROM public.pagos pg
    WHERE pg.presupuesto_id = v_presupuesto.id AND pg.clinica_id = v_clinica
      AND pg.id = (SELECT pi.pago_id FROM public.pago_imputaciones pi
        WHERE pi.id = p_imputacion_id AND pi.clinica_id = v_clinica)
      AND pg.paciente_id = v_presupuesto.paciente_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imputación no disponible'; END IF;

  SELECT * INTO v_original FROM public.pago_imputaciones pi
    WHERE pi.id = p_imputacion_id AND pi.clinica_id = v_clinica
      AND pi.pago_id = v_pago.id AND pi.presupuesto_id = v_presupuesto.id
      AND pi.tipo = 'imputacion'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imputación no disponible'; END IF;

  IF EXISTS (SELECT 1 FROM public.pago_imputaciones pi
    WHERE pi.clinica_id = v_clinica AND pi.pago_id = v_pago.id
      AND pi.operacion_id = p_operacion_id) THEN
    IF EXISTS (SELECT 1 FROM public.pago_imputaciones pi
      WHERE pi.clinica_id = v_clinica AND pi.pago_id = v_pago.id
        AND pi.operacion_id = p_operacion_id AND pi.tipo = 'reversion'
        AND pi.revierte_id = v_original.id AND pi.motivo = btrim(p_motivo))
      AND NOT EXISTS (SELECT 1 FROM public.pago_imputaciones pi
        WHERE pi.clinica_id = v_clinica AND pi.pago_id = v_pago.id
          AND pi.operacion_id = p_operacion_id
          AND (pi.tipo <> 'reversion' OR pi.revierte_id <> v_original.id
            OR pi.motivo <> btrim(p_motivo))) THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Identificador de operación de reversión en uso';
  END IF;

  SELECT COALESCE(sum(pi.monto), 0) INTO v_revertido
    FROM public.pago_imputaciones pi
    WHERE pi.tipo = 'reversion' AND pi.revierte_id = v_original.id
      AND pi.clinica_id = v_clinica;
  IF v_revertido >= v_original.monto THEN
    RAISE EXCEPTION 'La imputación ya fue revertida';
  END IF;

  INSERT INTO public.pago_imputaciones(
    clinica_id, paciente_id, presupuesto_id, pago_id, presupuesto_item_id,
    tipo, monto, operacion_id, revierte_id, motivo, actor_user_id
  ) VALUES (
    v_original.clinica_id, v_original.paciente_id, v_original.presupuesto_id,
    v_original.pago_id, v_original.presupuesto_item_id, 'reversion',
    (v_original.monto - v_revertido)::integer, p_operacion_id, v_original.id,
    btrim(p_motivo), auth.uid()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.revertir_imputacion_pago(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revertir_imputacion_pago(uuid,uuid,text) TO authenticated;

COMMIT;
