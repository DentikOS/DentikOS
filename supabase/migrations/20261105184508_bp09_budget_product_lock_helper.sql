-- BP09/BP07: conserva el bloqueo del catálogo sin exigir permisos de edición al lector.
BEGIN;

CREATE OR REPLACE FUNCTION bp09_private.validar_y_bloquear_producto_presupuesto(
  p_inventario_id uuid,
  p_clinica_id uuid
)
RETURNS TABLE (
  tipo_item text,
  estado_catalogo text,
  precio_venta numeric(14,2),
  iva_porcentaje numeric(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
BEGIN
  IF v_user_id IS NULL
    OR p_inventario_id IS NULL
    OR p_clinica_id IS NULL
    OR p_clinica_id IS DISTINCT FROM v_clinica_id
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR (
      public.puede_operar_inventario('catalogo.ver') IS DISTINCT FROM true
      AND public.puede_operar_inventario('compras.ver') IS DISTINCT FROM true
      AND public.tiene_rol_en_clinica(ARRAY['recepcion']::public.app_role[]) IS DISTINCT FROM true
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede validar el producto del presupuesto';
  END IF;

  SELECT i.tipo_item, i.estado_catalogo, i.precio_venta, i.iva_porcentaje
    INTO tipo_item, estado_catalogo, precio_venta, iva_porcentaje
  FROM public.inventario i
  WHERE i.id = p_inventario_id
    AND i.clinica_id = v_clinica_id
    AND i.tipo_item = 'producto_venta'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede validar el producto del presupuesto';
  END IF;
  RETURN NEXT;
END;
$function$;
ALTER FUNCTION bp09_private.validar_y_bloquear_producto_presupuesto(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION bp09_private.validar_y_bloquear_producto_presupuesto(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA bp09_private TO authenticated;
GRANT EXECUTE ON FUNCTION bp09_private.validar_y_bloquear_producto_presupuesto(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION bp09_private.validar_producto_presupuesto_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_estado_presupuesto text;
  v_tipo_item text;
  v_estado_catalogo text;
  v_precio numeric(14,2);
  v_iva numeric(5,2);
  v_producto_snapshot_cambio boolean := true;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.inventario_id IS NULL THEN
      RETURN OLD;
    END IF;
    SELECT b.estado INTO v_estado_presupuesto
    FROM public.presupuestos b
    WHERE b.id = OLD.presupuesto_id AND b.clinica_id = OLD.clinica_id;
    IF v_estado_presupuesto IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado') THEN
      RAISE EXCEPTION 'Un producto de un presupuesto aprobado no se puede eliminar';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.inventario_id IS NOT NULL
      AND ROW(OLD.presupuesto_id, OLD.clinica_id, OLD.paciente_id)
        IS DISTINCT FROM ROW(NEW.presupuesto_id, NEW.clinica_id, NEW.paciente_id) THEN
      RAISE EXCEPTION 'No se puede mover un producto entre presupuestos, pacientes o clínicas';
    END IF;
    SELECT b.estado INTO v_estado_presupuesto
    FROM public.presupuestos b
    WHERE b.id = NEW.presupuesto_id AND b.clinica_id = NEW.clinica_id
    FOR KEY SHARE;
    IF v_estado_presupuesto IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado')
      AND ROW(OLD.inventario_id, OLD.cantidad_inventario, OLD.precio_unitario_inventario,
        OLD.iva_porcentaje_inventario, OLD.valor, OLD.prestacion_nombre)
        IS DISTINCT FROM ROW(NEW.inventario_id, NEW.cantidad_inventario,
          NEW.precio_unitario_inventario, NEW.iva_porcentaje_inventario,
          NEW.valor, NEW.prestacion_nombre) THEN
      RAISE EXCEPTION 'Los productos y sus importes quedan fijados al aprobar el presupuesto';
    END IF;
    v_producto_snapshot_cambio := ROW(OLD.inventario_id, OLD.cantidad_inventario,
      OLD.precio_unitario_inventario, OLD.iva_porcentaje_inventario, OLD.valor)
      IS DISTINCT FROM ROW(NEW.inventario_id, NEW.cantidad_inventario,
        NEW.precio_unitario_inventario, NEW.iva_porcentaje_inventario, NEW.valor);
  END IF;

  IF NEW.inventario_id IS NULL THEN
    IF NEW.cantidad_inventario IS NOT NULL
      OR NEW.precio_unitario_inventario IS NOT NULL
      OR NEW.iva_porcentaje_inventario IS NOT NULL THEN
      RAISE EXCEPTION 'La línea presupuestada tiene una referencia de producto incompleta';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.presupuesto_id IS NULL OR NEW.clinica_id IS NULL
    OR NEW.cantidad_inventario IS NULL OR NEW.cantidad_inventario <= 0
    OR NEW.precio_unitario_inventario IS NULL OR NEW.iva_porcentaje_inventario IS NULL
    OR NEW.prestacion_id IS NOT NULL THEN
    RAISE EXCEPTION 'La línea de producto del presupuesto está incompleta';
  END IF;

  SELECT b.estado INTO v_estado_presupuesto
  FROM public.presupuestos b
  WHERE b.id = NEW.presupuesto_id AND b.clinica_id = NEW.clinica_id
    AND b.paciente_id IS NOT DISTINCT FROM NEW.paciente_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El presupuesto no está disponible en la clínica activa';
  END IF;
  IF TG_OP = 'INSERT'
    AND v_estado_presupuesto IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado') THEN
    RAISE EXCEPTION 'No se pueden añadir productos a un presupuesto aprobado';
  END IF;

  SELECT p.tipo_item, p.estado_catalogo, p.precio_venta, p.iva_porcentaje
    INTO v_tipo_item, v_estado_catalogo, v_precio, v_iva
  FROM bp09_private.validar_y_bloquear_producto_presupuesto(NEW.inventario_id, NEW.clinica_id) p;
  IF TG_OP = 'UPDATE' AND NOT v_producto_snapshot_cambio THEN
    RETURN NEW;
  END IF;
  IF NOT FOUND OR v_tipo_item IS DISTINCT FROM 'producto_venta'
    OR v_estado_catalogo IS DISTINCT FROM 'activo'
    OR NEW.precio_unitario_inventario IS DISTINCT FROM v_precio
    OR NEW.iva_porcentaje_inventario IS DISTINCT FROM v_iva
    OR NEW.valor IS DISTINCT FROM round(
      NEW.cantidad_inventario * NEW.precio_unitario_inventario
        * (1 + NEW.iva_porcentaje_inventario / 100), 0
    )::integer THEN
    RAISE EXCEPTION 'El producto, su precio o el IVA ya no coinciden con el catálogo de la clínica';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION bp09_private.validar_producto_presupuesto_item() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp09_private.validar_producto_presupuesto_item()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sincronizar_presupuesto_offline_bp09(
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
  v_item jsonb;
  v_item_id_local text;
  v_item_hash text;
  v_item_id uuid;
  v_inventario_text text;
  v_inventario_id uuid;
  v_cantidad_text text;
  v_cantidad numeric(14,3);
  v_precio_text text;
  v_precio numeric(14,2);
  v_iva_text text;
  v_iva numeric(5,2);
  v_tipo_item text;
  v_estado_catalogo text;
  v_precio_catalogo numeric(14,2);
  v_iva_catalogo numeric(5,2);
  v_valor integer;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true
    OR pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede sincronizar el presupuesto';
  END IF;

  v_presupuesto_id := public.sincronizar_presupuesto_offline(p_presupuesto, p_items, p_presupuesto_id);
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
        ), 'hex'
      );
      v_item_id := (
        pg_catalog.substr(v_item_hash, 1, 8) || '-' || pg_catalog.substr(v_item_hash, 9, 4) || '-5' ||
        pg_catalog.substr(v_item_hash, 14, 3) || '-8' || pg_catalog.substr(v_item_hash, 18, 3) || '-' ||
        pg_catalog.substr(v_item_hash, 21, 12)
      )::uuid;
    END IF;

    v_inventario_text := nullif(pg_catalog.btrim(v_item->>'inventario_id'), '');
    v_cantidad_text := nullif(pg_catalog.btrim(v_item->>'cantidad_inventario'), '');
    v_precio_text := nullif(pg_catalog.btrim(v_item->>'precio_unitario_inventario'), '');
    v_iva_text := nullif(pg_catalog.btrim(v_item->>'iva_porcentaje_inventario'), '');
    IF v_inventario_text IS NULL AND v_cantidad_text IS NULL
      AND v_precio_text IS NULL AND v_iva_text IS NULL THEN
      UPDATE public.presupuesto_items bi
      SET inventario_id = NULL, cantidad_inventario = NULL,
          precio_unitario_inventario = NULL, iva_porcentaje_inventario = NULL
      WHERE bi.id = v_item_id AND bi.clinica_id = v_clinica_id
        AND bi.presupuesto_id = v_presupuesto_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asociar el ítem al presupuesto'; END IF;
      CONTINUE;
    END IF;
    IF v_inventario_text IS NULL OR v_cantidad_text IS NULL
      OR v_precio_text IS NULL OR v_iva_text IS NULL
      OR v_inventario_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR v_cantidad_text !~ '^[0-9]+(\.[0-9]{1,3})?$'
      OR v_precio_text !~ '^[0-9]+(\.[0-9]{1,2})?$'
      OR v_iva_text !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Los datos del producto del presupuesto son inválidos';
    END IF;
    v_inventario_id := v_inventario_text::uuid;
    v_cantidad := v_cantidad_text::numeric(14,3);
    v_precio := v_precio_text::numeric(14,2);
    v_iva := v_iva_text::numeric(5,2);
    IF v_cantidad <= 0 OR v_cantidad > 99999999999.999 THEN
      RAISE EXCEPTION 'La cantidad del producto del presupuesto es inválida';
    END IF;
    SELECT p.tipo_item, p.estado_catalogo, p.precio_venta, p.iva_porcentaje
      INTO v_tipo_item, v_estado_catalogo, v_precio_catalogo, v_iva_catalogo
    FROM bp09_private.validar_y_bloquear_producto_presupuesto(v_inventario_id, v_clinica_id) p;
    IF NOT FOUND OR v_tipo_item IS DISTINCT FROM 'producto_venta'
      OR v_estado_catalogo IS DISTINCT FROM 'activo'
      OR v_precio IS DISTINCT FROM v_precio_catalogo
      OR v_iva IS DISTINCT FROM v_iva_catalogo THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El producto no pertenece al catálogo activo de la clínica o su precio cambió';
    END IF;
    SELECT bi.valor INTO v_valor FROM public.presupuesto_items bi
    WHERE bi.id = v_item_id AND bi.clinica_id = v_clinica_id
      AND bi.presupuesto_id = v_presupuesto_id;
    IF NOT FOUND OR v_valor IS DISTINCT FROM round(v_cantidad * v_precio * (1 + v_iva / 100), 0)::integer THEN
      RAISE EXCEPTION 'El total del producto no coincide con el precio e IVA del catálogo';
    END IF;
    UPDATE public.presupuesto_items bi
    SET inventario_id = v_inventario_id, cantidad_inventario = v_cantidad,
        precio_unitario_inventario = v_precio, iva_porcentaje_inventario = v_iva
    WHERE bi.id = v_item_id AND bi.clinica_id = v_clinica_id
      AND bi.presupuesto_id = v_presupuesto_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asociar el producto al presupuesto'; END IF;
  END LOOP;
  RETURN v_presupuesto_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sincronizar_presupuesto_offline_bp09(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_presupuesto_offline_bp09(jsonb, jsonb, uuid) TO authenticated;

COMMIT;
