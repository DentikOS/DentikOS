-- BP09: operaciones atómicas para movimientos, ventas y compras.
-- Todas las mutaciones de saldo pasan por funciones SECURITY DEFINER con search_path vacío.

CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_zona_horaria text;
  v_hoy date;
  v_key uuid;
  v_fingerprint text;
  v_existing_count integer;
  v_existing_fingerprint text;
  v_existing_ids jsonb;
  v_item_id uuid;
  v_item_tipo text;
  v_requires_lot boolean;
  v_requires_expiry boolean;
  v_tipo text;
  v_cantidad numeric;
  v_signo smallint;
  v_ubicacion_origen_id uuid;
  v_ubicacion_destino_id uuid;
  v_origen_sucursal uuid;
  v_destino_sucursal uuid;
  v_origen_tipo text;
  v_destino_tipo text;
  v_lote_id uuid;
  v_lote_codigo text;
  v_lote_fecha date;
  v_lote_proveedor uuid;
  v_requested_provider uuid;
  v_patient_id uuid;
  v_prestacion_id uuid;
  v_kit_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_venta_id uuid;
  v_presupuesto_item_id uuid;
  v_justificacion text;
  v_order_state text;
  v_order_sucursal uuid;
  v_order_provider uuid;
  v_ordered numeric;
  v_received numeric;
  v_remaining numeric;
  v_take numeric;
  v_assignment integer := 0;
  v_balance record;
  v_movement_id uuid;
  v_movement_ids jsonb := '[]'::jsonb;
  v_stock_total numeric;
  v_all_received boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solicitud de movimiento inválida.';
  END IF;

  v_clinica_id := public.clinica_actual();
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No hay una clínica activa autorizada.';
  END IF;
  SELECT c.zona_horaria INTO v_zona_horaria
  FROM public.clinicas c WHERE c.id = v_clinica_id;
  v_hoy := (now() AT TIME ZONE coalesce(v_zona_horaria, 'America/Santiago'))::date;

  v_key := (p_payload->>'idempotencyKey')::uuid;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  v_item_id := (p_payload->>'itemId')::uuid;
  v_tipo := p_payload->>'type';
  v_cantidad := (p_payload->>'quantity')::numeric;
  v_ubicacion_origen_id := nullif(p_payload->>'sourceLocationId', '')::uuid;
  v_ubicacion_destino_id := nullif(p_payload->>'destinationLocationId', '')::uuid;
  v_patient_id := nullif(p_payload->>'patientId', '')::uuid;
  v_prestacion_id := nullif(p_payload->>'prestacionId', '')::uuid;
  v_kit_id := nullif(p_payload->>'kitId', '')::uuid;
  v_order_id := nullif(p_payload->>'purchaseOrderId', '')::uuid;
  v_order_item_id := nullif(p_payload->>'purchaseOrderItemId', '')::uuid;
  v_venta_id := nullif(p_payload->>'saleId', '')::uuid;
  v_presupuesto_item_id := nullif(p_payload->>'presupuestoItemId', '')::uuid;
  v_justificacion := nullif(btrim(p_payload->>'reason'), '');

  IF v_key IS NULL OR v_item_id IS NULL OR v_tipo IS NULL OR v_cantidad IS NULL
     OR v_cantidad <= 0 OR v_cantidad > 99999999999.999 OR v_cantidad <> round(v_cantidad, 3) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Faltan datos válidos del movimiento.';
  END IF;
  IF v_tipo NOT IN ('entrada_compra', 'entrada_devolucion', 'salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento', 'ajuste', 'transferencia') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de movimiento no permitido.';
  END IF;
  IF (v_patient_id IS NOT NULL AND v_tipo NOT IN ('salida_tratamiento', 'salida_venta'))
     OR (v_prestacion_id IS NOT NULL AND v_tipo <> 'salida_tratamiento')
     OR (v_kit_id IS NOT NULL AND v_tipo <> 'salida_tratamiento')
     OR (v_venta_id IS NOT NULL AND v_tipo <> 'salida_venta')
     OR (v_presupuesto_item_id IS NOT NULL AND v_tipo <> 'salida_venta') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El movimiento contiene referencias que no corresponden a su tipo.';
  END IF;
  IF v_tipo = 'salida_venta' AND (
    (v_venta_id IS NULL AND v_presupuesto_item_id IS NULL)
    OR (v_venta_id IS NOT NULL AND v_presupuesto_item_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La salida por venta requiere una venta directa o un ítem de presupuesto.';
  END IF;

  CASE v_tipo
    WHEN 'entrada_compra' THEN
      IF NOT public.puede_operar_inventario('compras.gestionar') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para recibir compras.';
      END IF;
    WHEN 'entrada_devolucion' THEN
      IF NOT public.puede_operar_inventario('movimientos.registrar') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar devoluciones.';
      END IF;
    WHEN 'salida_tratamiento' THEN
      IF NOT public.puede_operar_inventario('tratamiento.consumir') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para descontar insumos de un tratamiento.';
      END IF;
      IF v_patient_id IS NULL OR v_prestacion_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El consumo clínico requiere paciente y prestación.';
      END IF;
    WHEN 'salida_venta' THEN
      IF v_venta_id IS NOT NULL THEN
        IF NOT public.puede_operar_inventario('ventas.registrar') THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salida debe pertenecer a una venta autorizada.';
        END IF;
      ELSIF v_presupuesto_item_id IS NULL
        OR public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salida presupuestada requiere una aprobación autorizada.';
      END IF;
    WHEN 'salida_perdida_vencimiento' THEN
      IF NOT public.puede_operar_inventario('ajustes.gestionar')
         AND NOT public.puede_operar_inventario('movimientos.registrar') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar mermas.';
      END IF;
    WHEN 'ajuste' THEN
      IF NOT public.puede_operar_inventario('ajustes.gestionar') OR length(coalesce(v_justificacion, '')) < 5 THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El ajuste requiere permiso y una justificación.';
      END IF;
    WHEN 'transferencia' THEN
      IF NOT public.puede_operar_inventario('transferencias.gestionar') THEN
        IF NOT public.puede_operar_inventario('movimientos.registrar') THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para transferir stock.';
        END IF;
      END IF;
  END CASE;

  -- Serializa reintentos con la misma llave, incluso si cambió el artículo del payload.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0)
  );
  SELECT count(*), min(m.idempotency_fingerprint), jsonb_agg(m.id ORDER BY m.linea, m.asignacion)
    INTO v_existing_count, v_existing_fingerprint, v_existing_ids
  FROM public.inventario_movimientos m
  WHERE m.clinica_id = v_clinica_id AND m.idempotency_key = v_key;
  IF v_existing_count > 0 THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint
       OR EXISTS (
         SELECT 1 FROM public.inventario_movimientos m
         WHERE m.clinica_id = v_clinica_id AND m.idempotency_key = v_key
           AND m.idempotency_fingerprint IS DISTINCT FROM v_fingerprint
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otra solicitud.';
    END IF;
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'movementIds', v_existing_ids, 'idempotencyKey', v_key);
  END IF;

  SELECT i.tipo_item, i.requiere_lote, i.requiere_vencimiento
    INTO v_item_tipo, v_requires_lot, v_requires_expiry
  FROM public.inventario i
  WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id AND i.estado_catalogo = 'activo'
  FOR UPDATE;
  IF v_item_tipo IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El artículo no existe o está inactivo en esta clínica.';
  END IF;

  IF v_ubicacion_origen_id IS NOT NULL THEN
    SELECT u.tipo, u.sucursal_id INTO v_origen_tipo, v_origen_sucursal
    FROM public.inventario_ubicaciones u
    WHERE u.id = v_ubicacion_origen_id AND u.clinica_id = v_clinica_id AND u.estado = 'activo';
    IF v_origen_tipo IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La ubicación de origen no está disponible.';
    END IF;
  END IF;
  IF v_ubicacion_destino_id IS NOT NULL THEN
    SELECT u.tipo, u.sucursal_id INTO v_destino_tipo, v_destino_sucursal
    FROM public.inventario_ubicaciones u
    WHERE u.id = v_ubicacion_destino_id AND u.clinica_id = v_clinica_id AND u.estado = 'activo';
    IF v_destino_tipo IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La ubicación de destino no está disponible.';
    END IF;
  END IF;

  IF v_tipo = 'entrada_compra' THEN
    IF v_order_id IS NULL OR v_order_item_id IS NULL OR v_ubicacion_destino_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La recepción requiere una orden, una línea y una ubicación destino.';
    END IF;
    SELECT oc.estado, oc.sucursal_id, oc.proveedor_id,
           oi.cantidad_solicitada, oi.cantidad_recibida
      INTO v_order_state, v_order_sucursal, v_order_provider, v_ordered, v_received
    FROM public.inventario_ordenes_compra oc
    JOIN public.inventario_orden_compra_items oi
      ON oi.orden_compra_id = oc.id AND oi.clinica_id = oc.clinica_id
    WHERE oc.id = v_order_id AND oi.id = v_order_item_id
      AND oc.clinica_id = v_clinica_id AND oi.inventario_id = v_item_id
    FOR UPDATE OF oc, oi;
    IF v_order_state NOT IN ('enviada', 'recibida_parcial') OR v_order_state IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La orden no está disponible para recepción.';
    END IF;
    IF v_received + v_cantidad > v_ordered THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La recepción supera la cantidad pendiente de la orden.';
    END IF;
    IF v_order_sucursal IS NOT NULL AND v_destino_tipo <> 'bodega_central'
       AND v_destino_sucursal IS DISTINCT FROM v_order_sucursal THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La ubicación destino no corresponde a la sucursal de la orden.';
    END IF;
  ELSIF v_order_id IS NOT NULL OR v_order_item_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo una entrada por compra puede referenciar una orden.';
  END IF;

  IF v_tipo IN ('salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento') THEN
    IF v_ubicacion_origen_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La salida requiere una ubicación origen.';
    END IF;
  ELSIF v_tipo = 'transferencia' THEN
    IF v_ubicacion_origen_id IS NULL OR v_ubicacion_destino_id IS NULL
       OR v_ubicacion_origen_id = v_ubicacion_destino_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La transferencia requiere dos ubicaciones distintas.';
    END IF;
  ELSIF v_tipo = 'entrada_devolucion' AND v_ubicacion_destino_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La devolución requiere una ubicación destino.';
  ELSIF v_tipo = 'ajuste' THEN
    IF nullif(p_payload->>'sign', '') IS NULL OR (p_payload->>'sign')::smallint NOT IN (-1, 1) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El ajuste debe indicar entrada (+1) o salida (-1).';
    END IF;
    v_signo := (p_payload->>'sign')::smallint;
    IF v_signo = 1 AND v_ubicacion_destino_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El ajuste positivo requiere una ubicación destino.';
    ELSIF v_signo = -1 AND v_ubicacion_origen_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El ajuste negativo requiere una ubicación origen.';
    END IF;
  END IF;
  IF v_tipo IN ('entrada_devolucion', 'salida_perdida_vencimiento')
     AND length(coalesce(v_justificacion, '')) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La devolución o merma requiere una justificación.';
  END IF;

  IF v_tipo = 'salida_venta' THEN
    IF v_item_tipo <> 'producto_venta' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo un producto para venta puede generar esta salida.';
    END IF;
    IF v_venta_id IS NOT NULL AND (
       NOT EXISTS (
         SELECT 1 FROM public.inventario_ventas s
         JOIN public.inventario_venta_items si ON si.venta_id = s.id AND si.clinica_id = s.clinica_id
         WHERE s.id = v_venta_id AND s.clinica_id = v_clinica_id
           AND s.created_by = v_user_id AND si.inventario_id = v_item_id
           AND si.cantidad = v_cantidad
           AND s.paciente_id IS NOT DISTINCT FROM v_patient_id
       ) OR EXISTS (
         SELECT 1 FROM public.inventario_movimientos m
         WHERE m.clinica_id = v_clinica_id AND m.venta_id = v_venta_id
           AND m.inventario_id = v_item_id AND m.tipo = 'salida_venta'
       )) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salida no coincide con una línea de venta pendiente.';
    END IF;
    IF v_presupuesto_item_id IS NOT NULL THEN
      PERFORM 1
      FROM public.presupuesto_items bi
      JOIN public.presupuestos b
        ON b.id = bi.presupuesto_id AND b.clinica_id = bi.clinica_id
      WHERE bi.id = v_presupuesto_item_id
        AND bi.clinica_id = v_clinica_id
        AND bi.inventario_id = v_item_id
        AND bi.cantidad_inventario = v_cantidad
        AND b.estado IN ('aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado')
        AND b.paciente_id IS NOT DISTINCT FROM v_patient_id
      FOR SHARE OF bi, b;
      IF NOT FOUND OR EXISTS (
        SELECT 1 FROM public.inventario_movimientos m
        WHERE m.clinica_id = v_clinica_id
          AND m.presupuesto_item_id = v_presupuesto_item_id
          AND m.tipo = 'salida_venta'
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salida no coincide con un producto de presupuesto aprobado pendiente.';
      END IF;
    END IF;
  END IF;

  IF v_tipo = 'salida_tratamiento' THEN
    IF NOT EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = v_patient_id AND p.clinica_id = v_clinica_id)
       OR NOT EXISTS (SELECT 1 FROM public.prestaciones p WHERE p.id = v_prestacion_id AND p.clinica_id = v_clinica_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Paciente o prestación no pertenecen a la clínica activa.';
    END IF;
    IF v_kit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.inventario_kit_items ki
      JOIN public.inventario_kits k ON k.id = ki.kit_id AND k.clinica_id = ki.clinica_id
      WHERE ki.clinica_id = v_clinica_id AND ki.kit_id = v_kit_id
        AND ki.inventario_id = v_item_id AND k.activo
        AND (k.prestacion_id IS NULL OR k.prestacion_id = v_prestacion_id)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El insumo no forma parte del kit asociado a esta prestación.';
    END IF;
    IF v_item_tipo NOT IN ('insumo_clinico', 'implante_protesis') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo los insumos clínicos e implantes/prótesis se descuentan por tratamiento.';
    END IF;
  END IF;

  v_lote_codigo := nullif(btrim(p_payload->>'lotCode'), '');
  v_lote_fecha := nullif(p_payload->>'expiryDate', '')::date;
  v_requested_provider := nullif(p_payload->>'providerId', '')::uuid;

  IF v_tipo IN ('entrada_compra', 'entrada_devolucion') OR (v_tipo = 'ajuste' AND v_signo = 1) THEN
    IF v_requires_lot AND v_lote_codigo IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Este artículo requiere código de lote.';
    END IF;
    IF v_requires_expiry AND v_lote_fecha IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Este artículo requiere fecha de vencimiento.';
    END IF;
    IF v_tipo = 'entrada_compra' THEN
      IF v_requested_provider IS NOT NULL AND v_requested_provider <> v_order_provider THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El proveedor del lote no coincide con la orden.';
      END IF;
      v_requested_provider := v_order_provider;
    END IF;
    IF v_lote_codigo IS NULL THEN
      v_lote_codigo := 'SIN-LOTE-' || upper(substr(replace(v_key::text, '-', ''), 1, 12));
    END IF;
    IF v_requested_provider IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.inventario_proveedores p
      WHERE p.id = v_requested_provider AND p.clinica_id = v_clinica_id AND p.estado = 'activo'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El proveedor no pertenece a la clínica activa.';
    END IF;

    INSERT INTO public.inventario_lotes (
      clinica_id, inventario_id, codigo_lote, fecha_vencimiento,
      proveedor_id, created_by
    ) VALUES (
      v_clinica_id, v_item_id, v_lote_codigo, v_lote_fecha,
      v_requested_provider, v_user_id
    )
    ON CONFLICT (clinica_id, inventario_id, codigo_lote) DO NOTHING;
    SELECT l.id, l.fecha_vencimiento, l.proveedor_id
      INTO v_lote_id, v_lote_fecha, v_lote_proveedor
    FROM public.inventario_lotes l
    WHERE l.clinica_id = v_clinica_id AND l.inventario_id = v_item_id
      AND l.codigo_lote = v_lote_codigo
    FOR UPDATE;
    IF v_lote_fecha IS DISTINCT FROM nullif(p_payload->>'expiryDate', '')::date
       OR (v_requested_provider IS NOT NULL AND v_lote_proveedor IS DISTINCT FROM v_requested_provider) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'El lote ya existe con datos distintos.';
    END IF;
    INSERT INTO public.inventario_stock_por_ubicacion (
      clinica_id, inventario_id, ubicacion_id, lote_id, cantidad
    ) VALUES (
      v_clinica_id, v_item_id, v_ubicacion_destino_id, v_lote_id, v_cantidad
    )
    ON CONFLICT (clinica_id, inventario_id, ubicacion_id, lote_id)
    DO UPDATE SET cantidad = public.inventario_stock_por_ubicacion.cantidad + EXCLUDED.cantidad;
    v_assignment := 1;
    INSERT INTO public.inventario_movimientos (
      clinica_id, inventario_id, tipo, cantidad, signo,
      ubicacion_destino_id, lote_id, paciente_id, prestacion_id, kit_id,
      orden_compra_id, orden_compra_item_id, venta_id, justificacion,
      actor_user_id, idempotency_key, idempotency_fingerprint, linea, asignacion
    ) VALUES (
      v_clinica_id, v_item_id, v_tipo, v_cantidad, 1,
      v_ubicacion_destino_id, v_lote_id, v_patient_id, v_prestacion_id, v_kit_id,
      v_order_id, v_order_item_id, v_venta_id, v_justificacion,
      v_user_id, v_key, v_fingerprint, 1, v_assignment
    ) RETURNING id INTO v_movement_id;
    v_movement_ids := jsonb_build_array(v_movement_id);

    IF v_tipo = 'entrada_compra' THEN
      UPDATE public.inventario_orden_compra_items oi
      SET cantidad_recibida = cantidad_recibida + v_cantidad
      WHERE oi.id = v_order_item_id AND oi.clinica_id = v_clinica_id;
      SELECT bool_and(oi.cantidad_recibida >= oi.cantidad_solicitada)
        INTO v_all_received
      FROM public.inventario_orden_compra_items oi
      WHERE oi.orden_compra_id = v_order_id AND oi.clinica_id = v_clinica_id;
      UPDATE public.inventario_ordenes_compra oc
      SET estado = CASE WHEN v_all_received THEN 'recibida_completa' ELSE 'recibida_parcial' END,
          received_at = CASE WHEN v_all_received THEN now() ELSE NULL END
      WHERE oc.id = v_order_id AND oc.clinica_id = v_clinica_id;
    END IF;
  ELSE
    IF v_tipo = 'ajuste' THEN
      v_signo := coalesce(v_signo, 1);
    ELSE
      v_signo := -1;
    END IF;
    IF v_tipo = 'salida_perdida_vencimiento' THEN
      v_lote_id := (p_payload->>'lotId')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.inventario_lotes l
        WHERE l.id = v_lote_id AND l.inventario_id = v_item_id
          AND l.clinica_id = v_clinica_id AND l.fecha_vencimiento < v_hoy
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La merma por vencimiento requiere un lote vencido.';
      END IF;
    END IF;

    v_remaining := v_cantidad;
    FOR v_balance IN
      SELECT s.id, s.lote_id, s.cantidad, l.fecha_vencimiento, l.fecha_ingreso
      FROM public.inventario_stock_por_ubicacion s
      JOIN public.inventario_lotes l
        ON l.id = s.lote_id AND l.inventario_id = s.inventario_id AND l.clinica_id = s.clinica_id
      WHERE s.clinica_id = v_clinica_id AND s.inventario_id = v_item_id
        AND s.ubicacion_id = v_ubicacion_origen_id AND s.cantidad > 0
        AND (
          (v_tipo = 'salida_perdida_vencimiento'
            AND s.lote_id = v_lote_id AND l.fecha_vencimiento < v_hoy)
          OR (v_tipo <> 'salida_perdida_vencimiento'
            AND (l.fecha_vencimiento >= v_hoy OR (NOT v_requires_expiry AND l.fecha_vencimiento IS NULL)))
        )
      ORDER BY l.fecha_vencimiento ASC NULLS LAST, l.fecha_ingreso ASC, l.id ASC
      FOR UPDATE OF s
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := least(v_balance.cantidad, v_remaining);
      UPDATE public.inventario_stock_por_ubicacion s
      SET cantidad = s.cantidad - v_take
      WHERE s.id = v_balance.id AND s.cantidad >= v_take;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'El stock cambió durante el movimiento; vuelve a intentarlo.';
      END IF;
      v_assignment := v_assignment + 1;

      IF v_tipo = 'transferencia' THEN
        INSERT INTO public.inventario_stock_por_ubicacion (
          clinica_id, inventario_id, ubicacion_id, lote_id, cantidad
        ) VALUES (
          v_clinica_id, v_item_id, v_ubicacion_destino_id, v_balance.lote_id, v_take
        )
        ON CONFLICT (clinica_id, inventario_id, ubicacion_id, lote_id)
        DO UPDATE SET cantidad = public.inventario_stock_por_ubicacion.cantidad + EXCLUDED.cantidad;
        INSERT INTO public.inventario_movimientos (
          clinica_id, inventario_id, tipo, cantidad, signo,
          ubicacion_origen_id, ubicacion_destino_id, lote_id,
          actor_user_id, idempotency_key, idempotency_fingerprint, linea, asignacion
        ) VALUES (
          v_clinica_id, v_item_id, v_tipo, v_take, -1,
          v_ubicacion_origen_id, v_ubicacion_destino_id, v_balance.lote_id,
          v_user_id, v_key, v_fingerprint, 1, v_assignment * 2 - 1
        ) RETURNING id INTO v_movement_id;
        v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
        INSERT INTO public.inventario_movimientos (
          clinica_id, inventario_id, tipo, cantidad, signo,
          ubicacion_origen_id, ubicacion_destino_id, lote_id,
          actor_user_id, idempotency_key, idempotency_fingerprint, linea, asignacion
        ) VALUES (
          v_clinica_id, v_item_id, v_tipo, v_take, 1,
          v_ubicacion_origen_id, v_ubicacion_destino_id, v_balance.lote_id,
          v_user_id, v_key, v_fingerprint, 1, v_assignment * 2
        ) RETURNING id INTO v_movement_id;
      ELSE
        INSERT INTO public.inventario_movimientos (
          clinica_id, inventario_id, tipo, cantidad, signo,
          ubicacion_origen_id, lote_id, paciente_id, prestacion_id, kit_id,
          venta_id, presupuesto_item_id, justificacion, actor_user_id, idempotency_key,
          idempotency_fingerprint, linea, asignacion
        ) VALUES (
          v_clinica_id, v_item_id, v_tipo, v_take, v_signo,
          v_ubicacion_origen_id, v_balance.lote_id, v_patient_id, v_prestacion_id, v_kit_id,
          v_venta_id, v_presupuesto_item_id, v_justificacion, v_user_id, v_key,
          v_fingerprint, 1, v_assignment
        ) RETURNING id INTO v_movement_id;
      END IF;
      v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Stock insuficiente o sin lotes vigentes en la ubicación seleccionada.';
    END IF;
  END IF;

  SELECT coalesce(sum(s.cantidad), 0) INTO v_stock_total
  FROM public.inventario_stock_por_ubicacion s
  WHERE s.clinica_id = v_clinica_id AND s.inventario_id = v_item_id;
  UPDATE public.inventario i SET cantidad_actual = v_stock_total
  WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id;

  RETURN jsonb_build_object(
    'ok', true, 'replayed', false, 'movementIds', v_movement_ids,
    'idempotencyKey', v_key, 'stockTotal', v_stock_total
  );
END;
$function$;
ALTER FUNCTION public.registrar_movimiento_inventario(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_movimiento_inventario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_inventario(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_orden_compra_inventario(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_key uuid;
  v_fingerprint text;
  v_existing uuid;
  v_existing_fingerprint text;
  v_supplier_id uuid;
  v_sucursal_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_item_id uuid;
  v_quantity numeric;
  v_price numeric;
  v_catalog_price numeric;
  v_line jsonb;
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere sesión y datos válidos para crear la orden.';
  END IF;
  v_clinica_id := public.clinica_actual();
  v_key := (p_payload->>'idempotencyKey')::uuid;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  v_supplier_id := (p_payload->>'providerId')::uuid;
  v_sucursal_id := nullif(p_payload->>'branchId', '')::uuid;
  IF v_clinica_id IS NULL OR v_key IS NULL OR v_supplier_id IS NULL
     OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La orden necesita proveedor y al menos una línea válida.';
  END IF;
  IF jsonb_array_length(p_payload->'items') = 0 OR jsonb_array_length(p_payload->'items') > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La orden necesita entre una y doscientas líneas.';
  END IF;
  IF NOT public.puede_operar_inventario('compras.gestionar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para crear órdenes de compra.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0)
  );
  SELECT o.id, o.idempotency_fingerprint INTO v_existing, v_existing_fingerprint
  FROM public.inventario_ordenes_compra o
  WHERE o.clinica_id = v_clinica_id AND o.idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otra orden.';
    END IF;
    RETURN v_existing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventario_proveedores p WHERE p.id = v_supplier_id AND p.clinica_id = v_clinica_id AND p.estado = 'activo') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El proveedor no está disponible en la clínica activa.';
  END IF;
  IF v_sucursal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sucursales s WHERE s.id = v_sucursal_id AND s.clinica_id = v_clinica_id AND s.estado = 'activa') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La sucursal no está disponible en la clínica activa.';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_id := (v_line->>'itemId')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    IF v_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity <> round(v_quantity, 3) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La orden contiene una línea inválida.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'items') x
      WHERE x.value->>'itemId' = v_line->>'itemId'
      GROUP BY x.value->>'itemId' HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cada artículo debe aparecer una sola vez en la orden.';
    END IF;
    SELECT i.precio_compra INTO v_catalog_price
    FROM public.inventario i
    WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id AND i.estado_catalogo = 'activo'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Un artículo de la orden no existe o está inactivo.';
    END IF;
    v_price := coalesce(nullif(v_line->>'unitPrice', '')::numeric, v_catalog_price);
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Falta el precio de compra de una línea.';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.inventario_ordenes_compra (
    id, clinica_id, folio, proveedor_id, sucursal_id, estado,
    fecha_estimada_entrega, nota, created_by, idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_order_id, v_clinica_id,
    'OC-' || to_char(current_date, 'YYYY') || '-' || upper(replace(v_order_id::text, '-', '')),
    v_supplier_id, v_sucursal_id, 'borrador',
    nullif(p_payload->>'expectedDeliveryDate', '')::date,
    left(coalesce(p_payload->>'note', ''), 1000), v_user_id, v_key, v_fingerprint
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_id := (v_line->>'itemId')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    SELECT i.precio_compra INTO v_catalog_price
    FROM public.inventario i WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id;
    v_price := coalesce(nullif(v_line->>'unitPrice', '')::numeric, v_catalog_price);
    INSERT INTO public.inventario_orden_compra_items (
      clinica_id, orden_compra_id, inventario_id, cantidad_solicitada, precio_unitario
    ) VALUES (v_clinica_id, v_order_id, v_item_id, v_quantity, v_price);
  END LOOP;
  RETURN v_order_id;
END;
$function$;
ALTER FUNCTION public.crear_orden_compra_inventario(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crear_orden_compra_inventario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_orden_compra_inventario(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.aprobar_orden_compra_inventario(p_orden_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id uuid := public.clinica_actual();
  v_estado text;
BEGIN
  IF auth.uid() IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_inventario('compras.aprobar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para aprobar órdenes de compra.';
  END IF;
  SELECT o.estado INTO v_estado
  FROM public.inventario_ordenes_compra o
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica_id
  FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'borrador' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La orden no existe o ya no está en borrador.';
  END IF;
  UPDATE public.inventario_ordenes_compra
  SET estado = 'enviada'
  WHERE id = p_orden_id AND clinica_id = v_clinica_id;
  RETURN p_orden_id;
END;
$function$;
ALTER FUNCTION public.aprobar_orden_compra_inventario(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aprobar_orden_compra_inventario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_orden_compra_inventario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_venta_inventario(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_key uuid;
  v_fingerprint text;
  v_existing uuid;
  v_existing_fingerprint text;
  v_sale_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_folio text;
  v_currency text;
  v_location_id uuid;
  v_patient_id uuid;
  v_method text;
  v_line jsonb;
  v_item_id uuid;
  v_quantity numeric;
  v_price numeric;
  v_tax_rate numeric;
  v_line_subtotal numeric;
  v_line_tax numeric;
  v_item_tipo text;
  v_order_state text;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total integer;
  v_movement_key uuid;
  v_line_number integer := 0;
  v_output jsonb;
BEGIN
  IF v_user_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere sesión y datos válidos para registrar la venta.';
  END IF;
  v_clinica_id := public.clinica_actual();
  v_key := (p_payload->>'idempotencyKey')::uuid;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  v_location_id := (p_payload->>'locationId')::uuid;
  v_patient_id := nullif(p_payload->>'patientId', '')::uuid;
  v_method := p_payload->>'paymentMethod';
  IF v_clinica_id IS NULL OR v_key IS NULL OR v_location_id IS NULL
     OR v_method IS NULL OR v_method NOT IN ('efectivo', 'debito', 'credito', 'transferencia')
     OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La venta necesita ubicación, medio de pago y productos válidos.';
  END IF;
  IF jsonb_array_length(p_payload->'items') = 0 OR jsonb_array_length(p_payload->'items') > 50 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La venta necesita entre uno y cincuenta productos.';
  END IF;
  IF NOT public.puede_operar_inventario('ventas.registrar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar ventas.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0)
  );
  SELECT s.id, s.idempotency_fingerprint INTO v_existing, v_existing_fingerprint
  FROM public.inventario_ventas s
  WHERE s.clinica_id = v_clinica_id AND s.idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otra venta.';
    END IF;
    SELECT jsonb_build_object(
      'ok', true, 'replayed', true, 'id', s.id, 'folio', s.folio,
      'subtotal', s.subtotal, 'iva', s.iva_total, 'total', s.total,
      'paymentId', s.pago_id
    ) INTO v_output
    FROM public.inventario_ventas s WHERE s.id = v_existing AND s.clinica_id = v_clinica_id;
    RETURN v_output;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventario_ubicaciones u WHERE u.id = v_location_id AND u.clinica_id = v_clinica_id AND u.estado = 'activo') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La ubicación de venta no pertenece a la clínica activa.';
  END IF;
  SELECT c.moneda INTO v_currency
  FROM public.clinicas c
  WHERE c.id = v_clinica_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La clínica activa no está disponible.';
  END IF;
  IF v_patient_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = v_patient_id AND p.clinica_id = v_clinica_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El paciente no pertenece a la clínica activa.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payload->'items') x
    GROUP BY x.value->>'itemId' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cada producto debe aparecer una sola vez en la venta.';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_id := (v_line->>'itemId')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    IF v_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity <> round(v_quantity, 3) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La venta contiene una cantidad inválida.';
    END IF;
    SELECT i.precio_venta, i.iva_porcentaje, i.tipo_item, i.estado_catalogo
      INTO v_price, v_tax_rate, v_item_tipo, v_order_state
    FROM public.inventario i
    WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id
    FOR UPDATE;
    IF v_item_tipo IS DISTINCT FROM 'producto_venta' OR v_order_state IS DISTINCT FROM 'activo' OR v_price IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Un producto no está activo o no tiene precio de venta.';
    END IF;
    v_line_subtotal := round(v_quantity * v_price, 2);
    v_line_tax := round(v_line_subtotal * v_tax_rate / 100, 2);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax := v_tax + v_line_tax;
  END LOOP;
  v_total := round(v_subtotal + v_tax, 0)::integer;
  v_folio := 'VTA-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(replace(v_sale_id::text, '-', ''));

  INSERT INTO public.pagos (
    id, user_id, clinica_id, paciente_id, folio, monto, metodo_pago,
    fecha, concepto, referencia, moneda
  ) VALUES (
    v_payment_id, v_user_id, v_clinica_id, v_patient_id, v_folio, v_total,
    CASE v_method
      WHEN 'debito' THEN 'tarjeta'
      WHEN 'credito' THEN 'tarjeta'
      ELSE v_method
    END,
    CURRENT_DATE, 'Venta de inventario ' || v_folio, v_sale_id::text, v_currency
  );

  INSERT INTO public.inventario_ventas (
    id, clinica_id, folio, paciente_id, pago_id, subtotal, iva_total, total,
    metodo_pago, created_by, idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_sale_id, v_clinica_id, v_folio, v_patient_id, v_payment_id, v_subtotal, v_tax,
    v_total, v_method, v_user_id, v_key, v_fingerprint
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_item_id := (v_line->>'itemId')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    SELECT i.precio_venta, i.iva_porcentaje INTO v_price, v_tax_rate
    FROM public.inventario i WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id;
    v_line_subtotal := round(v_quantity * v_price, 2);
    v_line_tax := round(v_line_subtotal * v_tax_rate / 100, 2);
    INSERT INTO public.inventario_venta_items (
      clinica_id, venta_id, inventario_id, cantidad, precio_unitario,
      iva_porcentaje, subtotal, iva_total, total
    ) VALUES (
      v_clinica_id, v_sale_id, v_item_id, v_quantity, v_price,
      v_tax_rate, v_line_subtotal, v_line_tax, round(v_line_subtotal + v_line_tax, 0)::integer
    );
    v_line_number := v_line_number + 1;
    v_movement_key := (
      substr(md5(v_key::text || ':' || v_item_id::text), 1, 8) || '-' ||
      substr(md5(v_key::text || ':' || v_item_id::text), 9, 4) || '-' ||
      substr(md5(v_key::text || ':' || v_item_id::text), 13, 4) || '-' ||
      substr(md5(v_key::text || ':' || v_item_id::text), 17, 4) || '-' ||
      substr(md5(v_key::text || ':' || v_item_id::text), 21, 12)
    )::uuid;
    PERFORM public.registrar_movimiento_inventario(jsonb_build_object(
      'idempotencyKey', v_movement_key,
      'type', 'salida_venta',
      'itemId', v_item_id,
      'quantity', v_quantity,
      'sourceLocationId', v_location_id,
      'patientId', v_patient_id,
      'saleId', v_sale_id
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'replayed', false, 'id', v_sale_id, 'folio', v_folio,
    'subtotal', v_subtotal, 'iva', v_tax, 'total', v_total,
    'paymentMethod', v_method, 'paymentId', v_payment_id
  );
END;
$function$;
ALTER FUNCTION public.registrar_venta_inventario(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_venta_inventario(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta_inventario(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.consumir_kit_tratamiento_inventario(
  p_kit_id uuid,
  p_paciente_id uuid,
  p_prestacion_id uuid,
  p_ubicacion_id uuid,
  p_idempotency_key uuid,
  p_kit_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id uuid := public.clinica_actual();
  v_user_id uuid := auth.uid();
  v_kit record;
  v_item record;
  v_line_key uuid;
  v_movimientos jsonb := '[]'::jsonb;
  v_result jsonb;
  v_count integer := 0;
  v_key_hash text;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR p_idempotency_key IS NULL OR p_kit_updated_at IS NULL
     OR NOT public.puede_operar_inventario('tratamiento.consumir') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para consumir este kit.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = p_paciente_id AND p.clinica_id = v_clinica_id)
     OR NOT EXISTS (SELECT 1 FROM public.prestaciones p WHERE p.id = p_prestacion_id AND p.clinica_id = v_clinica_id)
     OR NOT EXISTS (SELECT 1 FROM public.inventario_ubicaciones u WHERE u.id = p_ubicacion_id AND u.clinica_id = v_clinica_id AND u.estado = 'activo') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Paciente, prestación o ubicación no pertenecen a la clínica activa.';
  END IF;
  SELECT k.* INTO v_kit
  FROM public.inventario_kits k
  WHERE k.id = p_kit_id AND k.clinica_id = v_clinica_id AND k.activo
    AND (k.prestacion_id IS NULL OR k.prestacion_id = p_prestacion_id)
  FOR SHARE;
  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El kit no existe, está inactivo o pertenece a otra prestación.';
  END IF;
  IF v_kit.updated_at IS DISTINCT FROM p_kit_updated_at THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'El kit cambió mientras confirmabas el tratamiento. Actualiza y revisa los insumos.';
  END IF;
  v_key_hash := md5(v_clinica_id::text || ':' || p_idempotency_key::text);
  FOR v_item IN
    SELECT ki.inventario_id, ki.cantidad
    FROM public.inventario_kit_items ki
    WHERE ki.kit_id = p_kit_id AND ki.clinica_id = v_clinica_id
    ORDER BY ki.inventario_id
  LOOP
    v_line_key := (
      substr(md5(v_key_hash || ':' || v_item.inventario_id::text), 1, 8) || '-' ||
      substr(md5(v_key_hash || ':' || v_item.inventario_id::text), 9, 4) || '-' ||
      substr(md5(v_key_hash || ':' || v_item.inventario_id::text), 13, 4) || '-' ||
      substr(md5(v_key_hash || ':' || v_item.inventario_id::text), 17, 4) || '-' ||
      substr(md5(v_key_hash || ':' || v_item.inventario_id::text), 21, 12)
    )::uuid;
    v_result := public.registrar_movimiento_inventario(jsonb_build_object(
      'idempotencyKey', v_line_key,
      'type', 'salida_tratamiento',
      'itemId', v_item.inventario_id,
      'quantity', v_item.cantidad,
      'sourceLocationId', p_ubicacion_id,
      'patientId', p_paciente_id,
      'prestacionId', p_prestacion_id,
      'kitId', p_kit_id
    ));
    v_movimientos := v_movimientos || v_result->'movementIds';
    v_count := v_count + 1;
  END LOOP;
  IF v_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El kit no tiene insumos configurados.';
  END IF;
  RETURN jsonb_build_object('ok', true, 'kitId', p_kit_id, 'movementIds', v_movimientos);
END;
$function$;
ALTER FUNCTION public.consumir_kit_tratamiento_inventario(uuid, uuid, uuid, uuid, uuid, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consumir_kit_tratamiento_inventario(uuid, uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consumir_kit_tratamiento_inventario(uuid, uuid, uuid, uuid, uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.registrar_movimiento_inventario(jsonb) IS
  'BP09: movimiento idempotente y transaccional; valida clínica, rol, lote, caducidad y saldo antes de modificar existencias.';
COMMENT ON FUNCTION public.registrar_venta_inventario(jsonb) IS
  'BP09: registra venta directa de productos, calcula IVA desde el catálogo y descuenta stock atómicamente. No emite DTE/SII.';
