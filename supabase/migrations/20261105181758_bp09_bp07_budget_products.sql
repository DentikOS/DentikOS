-- BP09/BP07: productos presupuestados, stock por ubicación y aprobación atómica.
BEGIN;

ALTER TABLE public.presupuesto_items
  ADD COLUMN IF NOT EXISTS inventario_id uuid,
  ADD COLUMN IF NOT EXISTS cantidad_inventario numeric(14,3),
  ADD COLUMN IF NOT EXISTS precio_unitario_inventario numeric(14,2),
  ADD COLUMN IF NOT EXISTS iva_porcentaje_inventario numeric(5,2);

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS presupuesto_item_id uuid;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.presupuesto_items'::regclass
      AND conname = 'presupuesto_items_id_clinica_unique'
  ) THEN
    ALTER TABLE public.presupuesto_items
      ADD CONSTRAINT presupuesto_items_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.presupuesto_items'::regclass
      AND conname = 'presupuesto_items_inventario_clinica_fk'
  ) THEN
    ALTER TABLE public.presupuesto_items
      ADD CONSTRAINT presupuesto_items_inventario_clinica_fk
      FOREIGN KEY (inventario_id, clinica_id)
      REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.presupuesto_items'::regclass
      AND conname = 'presupuesto_items_inventario_snapshot_check'
  ) THEN
    ALTER TABLE public.presupuesto_items
      ADD CONSTRAINT presupuesto_items_inventario_snapshot_check CHECK (
        (inventario_id IS NULL AND cantidad_inventario IS NULL
          AND precio_unitario_inventario IS NULL AND iva_porcentaje_inventario IS NULL)
        OR
        (inventario_id IS NOT NULL AND cantidad_inventario > 0
          AND precio_unitario_inventario >= 0
          AND iva_porcentaje_inventario BETWEEN 0 AND 100)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventario_movimientos'::regclass
      AND conname = 'inventario_movimientos_presupuesto_item_clinica_fk'
  ) THEN
    ALTER TABLE public.inventario_movimientos
      ADD CONSTRAINT inventario_movimientos_presupuesto_item_clinica_fk
      FOREIGN KEY (presupuesto_item_id, clinica_id)
      REFERENCES public.presupuesto_items (id, clinica_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventario_movimientos'::regclass
      AND conname = 'inventario_movimientos_venta_source_check'
  ) THEN
    ALTER TABLE public.inventario_movimientos
      ADD CONSTRAINT inventario_movimientos_venta_source_check CHECK (
        (tipo <> 'salida_venta' OR pg_catalog.num_nonnulls(venta_id, presupuesto_item_id) = 1)
        AND (venta_id IS NULL OR tipo = 'salida_venta')
        AND (presupuesto_item_id IS NULL OR tipo = 'salida_venta')
      );
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS inventario_movimientos_presupuesto_item_idx
  ON public.inventario_movimientos (clinica_id, presupuesto_item_id)
  WHERE presupuesto_item_id IS NOT NULL;

-- Marca privada de un único RPC dentro de su transacción; no la puede fijar el cliente.
CREATE TABLE IF NOT EXISTS bp09_private.aprobaciones_presupuesto_en_curso (
  transaction_id bigint NOT NULL,
  clinica_id uuid NOT NULL,
  presupuesto_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  PRIMARY KEY (transaction_id, clinica_id, presupuesto_id)
);
REVOKE ALL ON TABLE bp09_private.aprobaciones_presupuesto_en_curso FROM PUBLIC, anon, authenticated, service_role;

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

  SELECT i.tipo_item, i.estado_catalogo, i.precio_venta, i.iva_porcentaje
    INTO v_tipo_item, v_estado_catalogo, v_precio, v_iva
  FROM public.inventario i
  WHERE i.id = NEW.inventario_id AND i.clinica_id = NEW.clinica_id
  FOR SHARE;
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

DROP TRIGGER IF EXISTS trg_bp09_validar_producto_presupuesto_item ON public.presupuesto_items;
CREATE TRIGGER trg_bp09_validar_producto_presupuesto_item
  BEFORE INSERT OR UPDATE OR DELETE ON public.presupuesto_items
  FOR EACH ROW EXECUTE FUNCTION bp09_private.validar_producto_presupuesto_item();

CREATE OR REPLACE FUNCTION bp09_private.proteger_aprobacion_presupuesto_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado
    AND EXISTS (
      SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = NEW.id AND bi.clinica_id = NEW.clinica_id
        AND bi.inventario_id IS NOT NULL
    )
    AND OLD.estado IN (
      'aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado','archivado'
    )
    AND (NEW.estado IS NULL OR NEW.estado NOT IN (
      'aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado','archivado'
    )) THEN
    RAISE EXCEPTION 'El presupuesto con productos aprobados no puede volver a un estado previo';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
    AND NEW.estado IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado')
    AND EXISTS (
      SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = NEW.id AND bi.clinica_id = NEW.clinica_id
        AND bi.inventario_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.inventario_movimientos m
          WHERE m.clinica_id = bi.clinica_id
            AND m.presupuesto_item_id = bi.id
            AND m.tipo = 'salida_venta'
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM bp09_private.aprobaciones_presupuesto_en_curso marca
      WHERE marca.transaction_id = pg_catalog.txid_current()
        AND marca.clinica_id = NEW.clinica_id
        AND marca.presupuesto_id = NEW.id
        AND marca.actor_user_id = auth.uid()
        AND NEW.clinica_id = public.clinica_actual()
    ) THEN
    RAISE EXCEPTION 'Apruebe este presupuesto desde el flujo de inventario para seleccionar ubicación y descontar stock';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION bp09_private.proteger_aprobacion_presupuesto_producto() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp09_private.proteger_aprobacion_presupuesto_producto() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_bp09_proteger_aprobacion_presupuesto_producto ON public.presupuestos;
CREATE TRIGGER trg_bp09_proteger_aprobacion_presupuesto_producto
  BEFORE UPDATE OF estado ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION bp09_private.proteger_aprobacion_presupuesto_producto();

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
    SELECT i.tipo_item, i.estado_catalogo, i.precio_venta, i.iva_porcentaje
      INTO v_tipo_item, v_estado_catalogo, v_precio_catalogo, v_iva_catalogo
    FROM public.inventario i
    WHERE i.id = v_inventario_id AND i.clinica_id = v_clinica_id
    FOR SHARE;
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

CREATE OR REPLACE FUNCTION public.aprobar_presupuesto_bp09(
  p_presupuesto_id uuid,
  p_ubicacion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_presupuesto public.presupuestos%ROWTYPE;
  v_line record;
  v_productos integer;
  v_productos_activos integer;
  v_estado_aprobado text;
  v_idempotency_key uuid;
  v_resultado_movimiento jsonb;
  v_movimientos jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR p_presupuesto_id IS NULL
    OR p_ubicacion_id IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede aprobar el presupuesto';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_clinica_id::text || ':presupuesto:' || p_presupuesto_id::text, 0)
  );
  SELECT b.* INTO v_presupuesto
  FROM public.presupuestos b
  WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica_id
    AND b.paciente_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = b.paciente_id AND p.clinica_id = v_clinica_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El presupuesto no está disponible en la clínica activa';
  END IF;
  SELECT count(*) INTO v_productos
  FROM public.presupuesto_items bi
  WHERE bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica_id
    AND bi.inventario_id IS NOT NULL;
  IF v_productos = 0 THEN
    RAISE EXCEPTION 'Este presupuesto no contiene productos de inventario';
  END IF;
  IF v_presupuesto.estado IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado') THEN
    IF EXISTS (
      SELECT 1 FROM public.presupuesto_items bi
      WHERE bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica_id
        AND bi.inventario_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.inventario_movimientos m
          WHERE m.clinica_id = v_clinica_id AND m.presupuesto_item_id = bi.id
            AND m.tipo = 'salida_venta'
        )
    ) THEN
      RAISE EXCEPTION 'El presupuesto ya está aprobado, pero no se encuentra completa su salida de inventario';
    END IF;
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'id', v_presupuesto.id,
      'estado', v_presupuesto.estado, 'version', v_presupuesto.version);
  END IF;
  IF v_presupuesto.estado NOT IN ('borrador','Borrador','enviado','Emitido','Pendiente')
    OR v_presupuesto.requiere_revision IS TRUE THEN
    RAISE EXCEPTION 'El presupuesto no está disponible para aprobación';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventario_ubicaciones u
    WHERE u.id = p_ubicacion_id AND u.clinica_id = v_clinica_id AND u.estado = 'activo'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La ubicación no pertenece a la clínica activa o está inactiva';
  END IF;
  SELECT count(*) INTO v_productos_activos
  FROM public.presupuesto_items bi
  JOIN public.inventario i
    ON i.id = bi.inventario_id AND i.clinica_id = bi.clinica_id
  WHERE bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica_id
    AND bi.inventario_id IS NOT NULL
    AND i.tipo_item = 'producto_venta' AND i.estado_catalogo = 'activo';
  IF v_productos_activos <> v_productos THEN
    RAISE EXCEPTION 'Uno o más productos del presupuesto ya no están activos en el catálogo';
  END IF;

  -- Bloquea los productos en orden estable antes de consumir varias líneas.
  PERFORM i.id
  FROM public.inventario i
  JOIN public.presupuesto_items bi
    ON bi.inventario_id = i.id AND bi.clinica_id = i.clinica_id
  WHERE bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica_id
    AND bi.inventario_id IS NOT NULL
  ORDER BY i.id
  FOR UPDATE OF i;

  IF v_presupuesto.estado IN ('Borrador','Emitido','Pendiente') THEN
    v_estado_aprobado := 'Aprobado';
  ELSE
    v_estado_aprobado := 'aprobado';
  END IF;
  INSERT INTO bp09_private.aprobaciones_presupuesto_en_curso (
    transaction_id, clinica_id, presupuesto_id, actor_user_id
  ) VALUES (
    pg_catalog.txid_current(), v_clinica_id, p_presupuesto_id, v_user_id
  );
  UPDATE public.presupuestos b
  SET estado = v_estado_aprobado, version = b.version + 1
  WHERE b.id = p_presupuesto_id AND b.clinica_id = v_clinica_id
  RETURNING b.* INTO v_presupuesto;
  DELETE FROM bp09_private.aprobaciones_presupuesto_en_curso
  WHERE transaction_id = pg_catalog.txid_current()
    AND clinica_id = v_clinica_id AND presupuesto_id = p_presupuesto_id
    AND actor_user_id = v_user_id;

  FOR v_line IN
    SELECT bi.id, bi.inventario_id, bi.cantidad_inventario
    FROM public.presupuesto_items bi
    JOIN public.inventario i
      ON i.id = bi.inventario_id AND i.clinica_id = bi.clinica_id
    WHERE bi.presupuesto_id = p_presupuesto_id AND bi.clinica_id = v_clinica_id
      AND bi.inventario_id IS NOT NULL
      AND i.tipo_item = 'producto_venta' AND i.estado_catalogo = 'activo'
    ORDER BY i.id, bi.id
    FOR UPDATE OF bi
  LOOP
    v_idempotency_key := (
      pg_catalog.substr(pg_catalog.md5('studio-dental:bp09:presupuesto:' || p_presupuesto_id::text || ':' || v_line.id::text), 1, 8) || '-' ||
      pg_catalog.substr(pg_catalog.md5('studio-dental:bp09:presupuesto:' || p_presupuesto_id::text || ':' || v_line.id::text), 9, 4) || '-' ||
      pg_catalog.substr(pg_catalog.md5('studio-dental:bp09:presupuesto:' || p_presupuesto_id::text || ':' || v_line.id::text), 13, 4) || '-' ||
      pg_catalog.substr(pg_catalog.md5('studio-dental:bp09:presupuesto:' || p_presupuesto_id::text || ':' || v_line.id::text), 17, 4) || '-' ||
      pg_catalog.substr(pg_catalog.md5('studio-dental:bp09:presupuesto:' || p_presupuesto_id::text || ':' || v_line.id::text), 21, 12)
    )::uuid;
    v_resultado_movimiento := public.registrar_movimiento_inventario(pg_catalog.jsonb_build_object(
      'idempotencyKey', v_idempotency_key,
      'type', 'salida_venta',
      'itemId', v_line.inventario_id,
      'quantity', v_line.cantidad_inventario,
      'sourceLocationId', p_ubicacion_id,
      'patientId', v_presupuesto.paciente_id,
      'presupuestoItemId', v_line.id,
      'reason', 'Aprobación del presupuesto ' || v_presupuesto.folio
    ));
    IF COALESCE((v_resultado_movimiento->>'ok')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'No se pudo registrar la salida del producto del presupuesto';
    END IF;
    v_movimientos := v_movimientos || COALESCE(v_resultado_movimiento->'movementIds', '[]'::jsonb);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'id', v_presupuesto.id,
    'estado', v_presupuesto.estado, 'version', v_presupuesto.version, 'movementIds', v_movimientos);
END;
$function$;
ALTER FUNCTION public.aprobar_presupuesto_bp09(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aprobar_presupuesto_bp09(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_presupuesto_bp09(uuid, uuid) TO authenticated;

COMMIT;
