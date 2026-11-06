-- BP09: escrituras atómicas de kits y cancelación segura de compras.
-- Los kits se guardan como una unidad para evitar configuraciones parciales.

CREATE UNIQUE INDEX IF NOT EXISTS inventario_kits_prestacion_activa_uidx
  ON public.inventario_kits (clinica_id, prestacion_id)
  WHERE prestacion_id IS NOT NULL AND activo;

REVOKE INSERT, UPDATE, DELETE ON public.inventario_kits,
  public.inventario_kit_items FROM authenticated;

CREATE OR REPLACE FUNCTION public.guardar_kit_inventario(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_kit_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_prestacion_id uuid := nullif(p_payload->>'prestacionId', '')::uuid;
  v_nombre text := btrim(coalesce(p_payload->>'nombre', ''));
  v_descripcion text := left(coalesce(p_payload->>'descripcion', ''), 1000);
  v_activo boolean := coalesce((p_payload->>'activo')::boolean, true);
  v_line jsonb;
  v_item_id uuid;
  v_cantidad numeric;
  v_item_tipo text;
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL
     OR NOT public.puede_operar_inventario('kits.gestionar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para gestionar kits de inventario.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR char_length(v_nombre) NOT BETWEEN 2 AND 140
     OR v_prestacion_id IS NULL
     OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El kit necesita nombre, prestación e insumos válidos.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.prestaciones p
    WHERE p.id = v_prestacion_id AND p.clinica_id = v_clinica_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La prestación no pertenece a la clínica activa.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payload->'items') x
    GROUP BY x.value->>'itemId' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cada insumo debe aparecer una sola vez en el kit.';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_id := (v_line->>'itemId')::uuid;
    v_cantidad := (v_line->>'quantity')::numeric;
    IF v_item_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_cantidad <> round(v_cantidad, 3) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El kit contiene una cantidad inválida.';
    END IF;
    SELECT i.tipo_item INTO v_item_tipo
    FROM public.inventario i
    WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id AND i.estado_catalogo = 'activo';
    IF v_item_tipo NOT IN ('insumo_clinico', 'implante_protesis') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los kits solo pueden incluir insumos clínicos e implantes/prótesis activos.';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_kit_id IS NULL THEN
    INSERT INTO public.inventario_kits (
      clinica_id, nombre, prestacion_id, descripcion, activo, created_by
    ) VALUES (
      v_clinica_id, v_nombre, v_prestacion_id, v_descripcion, v_activo, v_user_id
    ) RETURNING id INTO v_kit_id;
  ELSE
    UPDATE public.inventario_kits
    SET nombre = v_nombre,
        prestacion_id = v_prestacion_id,
        descripcion = v_descripcion,
        activo = v_activo
    WHERE id = v_kit_id AND clinica_id = v_clinica_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El kit ya no está disponible en la clínica activa.';
    END IF;
    DELETE FROM public.inventario_kit_items
    WHERE kit_id = v_kit_id AND clinica_id = v_clinica_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.inventario_kit_items (
      clinica_id, kit_id, inventario_id, cantidad
    ) VALUES (
      v_clinica_id, v_kit_id, (v_line->>'itemId')::uuid, (v_line->>'quantity')::numeric
    );
  END LOOP;
  RETURN v_kit_id;
END;
$function$;
ALTER FUNCTION public.guardar_kit_inventario(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guardar_kit_inventario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_kit_inventario(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_orden_compra_inventario(p_orden_id uuid, p_justificacion text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id uuid := public.clinica_actual();
  v_estado text;
BEGIN
  IF auth.uid() IS NULL OR v_clinica_id IS NULL
     OR NOT public.puede_operar_inventario('compras.gestionar')
     OR char_length(btrim(coalesce(p_justificacion, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso o falta la justificación para cancelar la orden.';
  END IF;
  SELECT o.estado INTO v_estado
  FROM public.inventario_ordenes_compra o
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica_id
  FOR UPDATE;
  IF v_estado NOT IN ('borrador', 'pendiente', 'enviada') OR v_estado IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Solo se pueden cancelar órdenes sin mercadería recibida.';
  END IF;
  UPDATE public.inventario_ordenes_compra
  SET estado = 'cancelada', nota = left(concat_ws(E'\n', nullif(nota, ''), 'Cancelación: ' || btrim(p_justificacion)), 1000)
  WHERE id = p_orden_id AND clinica_id = v_clinica_id;
  RETURN p_orden_id;
END;
$function$;
ALTER FUNCTION public.cancelar_orden_compra_inventario(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancelar_orden_compra_inventario(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_orden_compra_inventario(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_mantencion_inventario(
  p_inventario_id uuid,
  p_tipo text,
  p_fecha date,
  p_descripcion text,
  p_costo numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_item_tipo text;
  v_mantencion_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL
     OR NOT public.puede_operar_inventario('catalogo.gestionar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar mantenciones.';
  END IF;
  IF p_tipo NOT IN ('mantencion', 'reparacion', 'instalacion')
     OR p_fecha IS NULL OR char_length(btrim(coalesce(p_descripcion, ''))) NOT BETWEEN 3 AND 1000
     OR (p_costo IS NOT NULL AND p_costo < 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los datos de mantención no son válidos.';
  END IF;
  SELECT i.tipo_item INTO v_item_tipo
  FROM public.inventario i
  WHERE i.id = p_inventario_id AND i.clinica_id = v_clinica_id AND i.estado_catalogo = 'activo'
  FOR UPDATE;
  IF v_item_tipo NOT IN ('instrumental', 'equipamiento') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La mantención solo corresponde a instrumental o equipamiento activo.';
  END IF;
  INSERT INTO public.inventario_mantenciones (
    clinica_id, inventario_id, tipo, fecha, descripcion, costo, created_by
  ) VALUES (
    v_clinica_id, p_inventario_id, p_tipo, p_fecha, btrim(p_descripcion), p_costo, v_user_id
  ) RETURNING id INTO v_mantencion_id;
  UPDATE public.inventario
  SET fecha_instalacion = CASE WHEN p_tipo = 'instalacion' THEN p_fecha ELSE fecha_instalacion END,
      ultima_mantencion = CASE WHEN p_tipo = 'instalacion' THEN ultima_mantencion ELSE p_fecha END
  WHERE id = p_inventario_id AND clinica_id = v_clinica_id;
  RETURN v_mantencion_id;
END;
$function$;
ALTER FUNCTION public.registrar_mantencion_inventario(uuid, text, date, text, numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_mantencion_inventario(uuid, text, date, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_mantencion_inventario(uuid, text, date, text, numeric) TO authenticated;
