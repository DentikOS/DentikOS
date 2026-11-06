-- BP12 CORE, ola 2: costos privados, pagos parciales y egresos vinculados.

ALTER TABLE public.movimientos_financieros
  ADD COLUMN orden_laboratorio_id uuid;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_id_clinica_orden_uniq
  UNIQUE (id, clinica_id, orden_laboratorio_id);

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_orden_laboratorio_fk
  FOREIGN KEY (orden_laboratorio_id, clinica_id)
  REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_orden_laboratorio_tipo_check
  CHECK (orden_laboratorio_id IS NULL OR (tipo = 'Egreso' AND categoria = 'Laboratorio Dental'));

CREATE INDEX movimientos_financieros_orden_laboratorio_idx
  ON public.movimientos_financieros (clinica_id, orden_laboratorio_id)
  WHERE orden_laboratorio_id IS NOT NULL;

CREATE TABLE public.ordenes_laboratorio_costos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  orden_id uuid NOT NULL,
  costo_total integer NOT NULL CHECK (costo_total >= 0),
  precio_paciente integer CHECK (precio_paciente IS NULL OR precio_paciente >= 0),
  moneda text NOT NULL DEFAULT 'CLP' CHECK (moneda = 'CLP'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (orden_id, clinica_id),
  FOREIGN KEY (orden_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE public.laboratorio_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  orden_id uuid NOT NULL,
  movimiento_id uuid NOT NULL,
  monto integer NOT NULL CHECK (monto > 0),
  fecha date NOT NULL,
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cheque')),
  idempotency_key uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, idempotency_key),
  UNIQUE (movimiento_id, clinica_id),
  FOREIGN KEY (orden_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (movimiento_id, clinica_id, orden_id)
    REFERENCES public.movimientos_financieros (id, clinica_id, orden_laboratorio_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX laboratorio_pagos_orden_fecha_idx
  ON public.laboratorio_pagos (clinica_id, orden_id, fecha DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.guardar_costo_orden_laboratorio(
  p_orden_id uuid,
  p_costo_total integer,
  p_precio_paciente integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_resultado public.ordenes_laboratorio_costos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR v_rol <> 'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para guardar costos de orden';
  END IF;
  IF p_orden_id IS NULL OR p_costo_total IS NULL OR p_costo_total < 0
     OR (p_precio_paciente IS NOT NULL AND p_precio_paciente < 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los valores financieros no son válidos';
  END IF;
  PERFORM 1 FROM public.ordenes_laboratorio o
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden no disponible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.laboratorio_pagos p
    WHERE p.clinica_id = v_clinica AND p.orden_id = p_orden_id
      AND p.monto > 0
  ) AND p_costo_total::bigint < (
    SELECT coalesce(sum(p.monto), 0)::bigint FROM public.laboratorio_pagos p
    WHERE p.clinica_id = v_clinica AND p.orden_id = p_orden_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El costo no puede ser menor a los pagos ya registrados';
  END IF;

  INSERT INTO public.ordenes_laboratorio_costos (
    clinica_id, orden_id, costo_total, precio_paciente, created_by
  ) VALUES (v_clinica, p_orden_id, p_costo_total, p_precio_paciente, v_actor)
  ON CONFLICT (orden_id, clinica_id) DO UPDATE
  SET costo_total = EXCLUDED.costo_total,
      precio_paciente = EXCLUDED.precio_paciente,
      updated_at = clock_timestamp()
  RETURNING * INTO v_resultado;
  RETURN pg_catalog.jsonb_build_object(
    'orden_id', v_resultado.orden_id,
    'updated_at', v_resultado.updated_at
  );
END;
$function$;
ALTER FUNCTION public.guardar_costo_orden_laboratorio(uuid, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guardar_costo_orden_laboratorio(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_costo_orden_laboratorio(uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.precio_paciente_orden_laboratorio(p_orden_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_precio integer;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL OR p_orden_id IS NULL
     OR (v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role)
         AND NOT public.tiene_permiso_laboratorio('ver_costos_laboratorio')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para consultar el precio de la orden';
  END IF;
  SELECT c.precio_paciente INTO v_precio
  FROM public.ordenes_laboratorio o
  LEFT JOIN public.ordenes_laboratorio_costos c
    ON c.clinica_id = o.clinica_id AND c.orden_id = o.id
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden no disponible';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'orden_id', p_orden_id,
    'precio_paciente', v_precio
  );
END;
$function$;
ALTER FUNCTION public.precio_paciente_orden_laboratorio(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.precio_paciente_orden_laboratorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.precio_paciente_orden_laboratorio(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resumen_pagos_laboratorio(p_orden_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_costo integer;
  v_pagado bigint;
  v_pagos jsonb;
  v_puede_ver_costos boolean;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role
         AND NOT public.tiene_permiso_laboratorio('pagar_laboratorios')
         AND NOT public.tiene_permiso_laboratorio('ver_costos_laboratorio')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para consultar pagos de laboratorio';
  END IF;
  SELECT c.costo_total INTO v_costo
  FROM public.ordenes_laboratorio_costos c
  WHERE c.clinica_id = v_clinica AND c.orden_id = p_orden_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La orden todavía no tiene costo registrado';
  END IF;
  v_puede_ver_costos := v_rol = 'admin'::public.app_role
    OR public.tiene_permiso_laboratorio('ver_costos_laboratorio');
  SELECT coalesce(sum(p.monto), 0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'monto', p.monto, 'fecha', p.fecha,
           'metodo_pago', p.metodo_pago, 'created_at', p.created_at
         ) ORDER BY p.fecha DESC, p.created_at DESC), '[]'::jsonb)
    INTO v_pagado, v_pagos
  FROM public.laboratorio_pagos p
  WHERE p.clinica_id = v_clinica AND p.orden_id = p_orden_id;
  RETURN pg_catalog.jsonb_build_object(
    'orden_id', p_orden_id,
    'total_pagado', v_pagado,
    'saldo', greatest(v_costo - v_pagado, 0),
    'pagos', v_pagos
  ) || CASE WHEN v_puede_ver_costos
    THEN pg_catalog.jsonb_build_object('costo_total', v_costo)
    ELSE '{}'::jsonb
  END;
END;
$function$;
ALTER FUNCTION public.resumen_pagos_laboratorio(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resumen_pagos_laboratorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_pagos_laboratorio(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_pago_laboratorio(
  p_orden_id uuid,
  p_monto integer,
  p_fecha date,
  p_metodo_pago text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_folio text;
  v_costo bigint;
  v_pagado bigint;
  v_movimiento_id uuid;
  v_pago public.laboratorio_pagos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role
         AND NOT public.tiene_permiso_laboratorio('pagar_laboratorios')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para registrar pagos de laboratorio';
  END IF;
  IF p_orden_id IS NULL OR p_monto IS NULL OR p_monto <= 0 OR p_fecha IS NULL
     OR p_idempotency_key IS NULL OR p_metodo_pago IS NULL
     OR p_metodo_pago NOT IN ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cheque') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los datos del pago no son válidos';
  END IF;

  SELECT p.* INTO v_pago FROM public.laboratorio_pagos p
  WHERE p.clinica_id = v_clinica AND p.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_pago.orden_id IS DISTINCT FROM p_orden_id OR v_pago.monto IS DISTINCT FROM p_monto
       OR v_pago.fecha IS DISTINCT FROM p_fecha OR v_pago.metodo_pago IS DISTINCT FROM p_metodo_pago THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia ya usada para otro pago';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'id', v_pago.id, 'orden_id', v_pago.orden_id, 'movimiento_id', v_pago.movimiento_id,
      'monto', v_pago.monto, 'fecha', v_pago.fecha, 'metodo_pago', v_pago.metodo_pago
    );
  END IF;

  SELECT o.folio INTO v_folio
  FROM public.ordenes_laboratorio o
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden no disponible';
  END IF;
  SELECT c.costo_total INTO v_costo
  FROM public.ordenes_laboratorio_costos c
  WHERE c.clinica_id = v_clinica AND c.orden_id = p_orden_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La orden todavía no tiene costo registrado';
  END IF;
  -- Recheck after the order lock so concurrent retries for this order are idempotent.
  SELECT p.* INTO v_pago FROM public.laboratorio_pagos p
  WHERE p.clinica_id = v_clinica AND p.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_pago.orden_id IS DISTINCT FROM p_orden_id OR v_pago.monto IS DISTINCT FROM p_monto
       OR v_pago.fecha IS DISTINCT FROM p_fecha OR v_pago.metodo_pago IS DISTINCT FROM p_metodo_pago THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia ya usada para otro pago';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'id', v_pago.id, 'orden_id', v_pago.orden_id, 'movimiento_id', v_pago.movimiento_id,
      'monto', v_pago.monto, 'fecha', v_pago.fecha, 'metodo_pago', v_pago.metodo_pago
    );
  END IF;

  SELECT coalesce(sum(p.monto), 0)::bigint INTO v_pagado
  FROM public.laboratorio_pagos p
  WHERE p.clinica_id = v_clinica AND p.orden_id = p_orden_id;
  IF v_pagado + p_monto > v_costo THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El pago supera el saldo pendiente de la orden';
  END IF;

  INSERT INTO public.movimientos_financieros (
    user_id, clinica_id, fecha, tipo, categoria, monto, metodo_pago,
    descripcion, orden_laboratorio_id
  ) VALUES (
    v_actor, v_clinica, p_fecha, 'Egreso', 'Laboratorio Dental', p_monto,
    p_metodo_pago, 'Pago de laboratorio ' || v_folio, p_orden_id
  ) RETURNING id INTO v_movimiento_id;

  INSERT INTO public.laboratorio_pagos (
    clinica_id, orden_id, movimiento_id, monto, fecha, metodo_pago,
    idempotency_key, created_by
  ) VALUES (
    v_clinica, p_orden_id, v_movimiento_id, p_monto, p_fecha, p_metodo_pago,
    p_idempotency_key, v_actor
  ) RETURNING * INTO v_pago;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_pago.id, 'orden_id', v_pago.orden_id, 'movimiento_id', v_pago.movimiento_id,
    'monto', v_pago.monto, 'fecha', v_pago.fecha, 'metodo_pago', v_pago.metodo_pago
  );
END;
$function$;
ALTER FUNCTION public.registrar_pago_laboratorio(uuid, integer, date, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_pago_laboratorio(uuid, integer, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_laboratorio(uuid, integer, date, text, uuid) TO authenticated;

CREATE TRIGGER laboratorio_ordenes_costos_audit AFTER INSERT OR UPDATE ON public.ordenes_laboratorio_costos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_pagos_audit AFTER INSERT ON public.laboratorio_pagos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();

ALTER TABLE public.ordenes_laboratorio_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY ordenes_laboratorio_costos_select_privado ON public.ordenes_laboratorio_costos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role
      OR public.tiene_permiso_laboratorio('ver_costos_laboratorio')));

CREATE POLICY laboratorio_pagos_select_autorizado ON public.laboratorio_pagos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role
      OR public.tiene_permiso_laboratorio('ver_costos_laboratorio')
      OR public.tiene_permiso_laboratorio('pagar_laboratorios')));

REVOKE ALL ON public.ordenes_laboratorio_costos, public.laboratorio_pagos
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ordenes_laboratorio_costos, public.laboratorio_pagos TO authenticated;

-- Replace the BP08 role policies so only linked laboratory expenses use the
-- additive lab permissions; access to every other category stays unchanged.
DROP POLICY IF EXISTS movimientos_financieros_select_rol ON public.movimientos_financieros;
DROP POLICY IF EXISTS movimientos_financieros_insert_rol ON public.movimientos_financieros;
DROP POLICY IF EXISTS movimientos_financieros_update_rol ON public.movimientos_financieros;
DROP POLICY IF EXISTS movimientos_financieros_delete_rol ON public.movimientos_financieros;

CREATE POLICY movimientos_financieros_select_bp12 ON public.movimientos_financieros FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND CASE
      WHEN tipo = 'Egreso' AND (categoria = 'Laboratorio Dental' OR orden_laboratorio_id IS NOT NULL)
        THEN public.rol_en_clinica_actual() = 'admin'::public.app_role
          OR public.tiene_permiso_laboratorio('ver_costos_laboratorio')
          OR public.tiene_permiso_laboratorio('pagar_laboratorios')
      ELSE user_id = auth.uid()
        AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])
    END);

CREATE POLICY movimientos_financieros_insert_bp12 ON public.movimientos_financieros FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND user_id = auth.uid()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND orden_laboratorio_id IS NULL
    AND categoria <> 'Laboratorio Dental');

CREATE POLICY movimientos_financieros_update_bp12 ON public.movimientos_financieros FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND user_id = auth.uid()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND orden_laboratorio_id IS NULL
    AND categoria <> 'Laboratorio Dental')
  WITH CHECK (clinica_id = public.clinica_actual()
    AND user_id = auth.uid()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND orden_laboratorio_id IS NULL
    AND categoria <> 'Laboratorio Dental');

CREATE POLICY movimientos_financieros_delete_bp12 ON public.movimientos_financieros FOR DELETE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND user_id = auth.uid()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND orden_laboratorio_id IS NULL
    AND categoria <> 'Laboratorio Dental');

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ordenes_laboratorio_costos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ordenes_laboratorio_costos;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'laboratorio_pagos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.laboratorio_pagos;
  END IF;
END;
$publication$;

COMMENT ON TABLE public.ordenes_laboratorio_costos IS
  'BP12: costos y precio al paciente, visibles solo a admin o permiso ver_costos_laboratorio.';
COMMENT ON TABLE public.laboratorio_pagos IS
  'BP12: cuotas enlazadas de forma atómica e idempotente a egresos de movimientos_financieros.';
COMMENT ON FUNCTION public.registrar_pago_laboratorio(uuid, integer, date, text, uuid) IS
  'BP12: registra una cuota parcial, su egreso enlazado y su clave idempotente en una transacción.';
COMMENT ON FUNCTION public.precio_paciente_orden_laboratorio(uuid) IS
  'BP12: expone únicamente el precio al paciente para admin, dentista o permiso ver_costos_laboratorio.';
