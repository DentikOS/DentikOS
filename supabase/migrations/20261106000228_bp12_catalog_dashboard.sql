-- BP12 CORE catalog administration and tenant-scoped dashboard.

CREATE OR REPLACE FUNCTION public.insertar_plantillas_base_laboratorio_bp12(
  p_clinica_id uuid,
  p_actor_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item record;
  v_creados integer := 0;
  v_filas integer := 0;
BEGIN
  IF p_clinica_id IS NULL OR p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.miembros_clinica m
    WHERE m.clinica_id = p_clinica_id AND m.user_id = p_actor_id
      AND m.activo AND m.rol::text = 'admin'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pueden inicializar plantillas para esta clínica';
  END IF;

  FOR v_item IN
    SELECT * FROM (VALUES
      ('Corona zirconio', 'protesis_fija', 7,
        ARRAY['solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega']::text[],
        ARRAY['inicial','diseno','prueba','final','rx']::text[], '{}'::jsonb),
      ('Corona metal-cerámica', 'protesis_fija', 7,
        ARRAY['solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega']::text[],
        ARRAY['inicial','diseno','prueba','final','rx']::text[], '{}'::jsonb),
      ('Puente 3+ unidades', 'protesis_fija', 10,
        ARRAY['solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega']::text[],
        ARRAY['inicial','diseno','prueba','final','rx']::text[],
        '{"ajuste_oclusal":{"tipo":"boolean","etiqueta":"Ajuste oclusal verificado"}}'::jsonb),
      ('Prótesis parcial removible', 'protesis_removible', 14,
        ARRAY['solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega']::text[],
        ARRAY['inicial','diseno','prueba','final']::text[], '{}'::jsonb),
      ('Férula oclusal Michigan', 'ferulas_protectores', 5,
        ARRAY['solicitud','enviada','fabricacion','prueba','entrega']::text[],
        ARRAY['inicial','prueba','final']::text[], '{}'::jsonb),
      ('Provisional acrílico', 'provisionales', 2,
        ARRAY['solicitud','fabricacion','entrega']::text[],
        ARRAY['inicial','final']::text[], '{}'::jsonb),
      ('Implante corona', 'implantoprotesis', 10,
        ARRAY['solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega']::text[],
        ARRAY['inicial','diseno','prueba','final','rx']::text[], '{}'::jsonb),
      ('Reparación de prótesis', 'reparaciones', 3,
        ARRAY['solicitud','enviada','prueba','entrega']::text[],
        ARRAY['inicial','final']::text[], '{}'::jsonb)
    ) AS v(nombre, categoria, dias, etapas, fotos, campos)
  LOOP
    INSERT INTO public.laboratorio_tipos_trabajo (
      clinica_id, categoria, nombre, dias_estimados, created_by
    )
    SELECT p_clinica_id, v_item.categoria, v_item.nombre, v_item.dias, p_actor_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.laboratorio_tipos_trabajo t
      WHERE t.clinica_id = p_clinica_id AND t.categoria = v_item.categoria
        AND pg_catalog.lower(pg_catalog.btrim(t.nombre)) = pg_catalog.lower(pg_catalog.btrim(v_item.nombre))
    );
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_creados := v_creados + v_filas;

    INSERT INTO public.plantillas_laboratorio (
      clinica_id, nombre, categoria, descripcion, dias_estimados,
      etapas, fotos_requeridas, campos_personalizados, version, created_by
    )
    SELECT p_clinica_id, v_item.nombre, v_item.categoria,
      'Plantilla base BP12 configurable por clínica.', v_item.dias,
      v_item.etapas, v_item.fotos, v_item.campos, 1, p_actor_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.plantillas_laboratorio t
      WHERE t.clinica_id = p_clinica_id
        AND pg_catalog.lower(pg_catalog.btrim(t.nombre)) = pg_catalog.lower(pg_catalog.btrim(v_item.nombre))
    );
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_creados := v_creados + v_filas;
  END LOOP;
  RETURN v_creados;
END;
$function$;
ALTER FUNCTION public.insertar_plantillas_base_laboratorio_bp12(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.insertar_plantillas_base_laboratorio_bp12(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Existing clinics receive the eight CORE templates and their matching work
-- types. A clinic without an active admin is safely skipped and can initialize
-- the catalog later through the authenticated RPC.
DO $seed$
DECLARE
  v_clinica record;
BEGIN
  FOR v_clinica IN
    SELECT m.clinica_id, (array_agg(m.user_id ORDER BY m.user_id))[1] AS admin_id
    FROM public.miembros_clinica m
    WHERE m.activo AND m.rol::text = 'admin'
    GROUP BY m.clinica_id
  LOOP
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_clinica.admin_id::text, true);
    PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
      'sub', v_clinica.admin_id, 'role', 'authenticated',
      'user_metadata', pg_catalog.jsonb_build_object('clinica_id', v_clinica.clinica_id)
    )::text, true);
    PERFORM public.insertar_plantillas_base_laboratorio_bp12(
      v_clinica.clinica_id, v_clinica.admin_id
    );
  END LOOP;
END;
$seed$;

CREATE OR REPLACE FUNCTION public.asegurar_plantillas_laboratorio_bp12()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role
       AND NOT public.tiene_permiso_laboratorio('configurar_plantillas')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para inicializar plantillas';
  END IF;
  -- The private seed helper requires an active admin creator; a configured
  -- dentist can customize existing templates but cannot impersonate admin.
  RETURN public.insertar_plantillas_base_laboratorio_bp12(
    v_clinica,
    CASE WHEN v_rol = 'admin'::public.app_role THEN v_actor ELSE (
      SELECT m.user_id FROM public.miembros_clinica m
      WHERE m.clinica_id = v_clinica AND m.activo AND m.rol::text = 'admin'
      ORDER BY m.user_id LIMIT 1
    ) END
  );
END;
$function$;
ALTER FUNCTION public.asegurar_plantillas_laboratorio_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.asegurar_plantillas_laboratorio_bp12() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asegurar_plantillas_laboratorio_bp12() TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_plantilla_laboratorio_bp12(
  p_id uuid,
  p_nombre text,
  p_categoria text,
  p_descripcion text,
  p_dias_estimados integer,
  p_etapas text[],
  p_fotos_requeridas text[],
  p_campos_personalizados jsonb,
  p_estado text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_actual public.plantillas_laboratorio%ROWTYPE;
  v_version integer;
  v_nuevo_id uuid;
  v_etapas_validas text[] := ARRAY[
    'solicitud','enviada','diseno','fabricacion','prueba','ajustes','entrega'
  ]::text[];
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role
       AND NOT public.tiene_permiso_laboratorio('configurar_plantillas')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para editar plantillas';
  END IF;
  IF p_nombre IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_nombre)) NOT BETWEEN 2 AND 160
     OR pg_catalog.char_length(COALESCE(p_descripcion, '')) > 2000
     OR p_categoria IS NULL OR p_categoria NOT IN ('protesis_fija','protesis_removible','implantoprotesis',
       'ortodoncia','ferulas_protectores','provisionales','reparaciones')
     OR (p_dias_estimados IS NOT NULL AND p_dias_estimados NOT BETWEEN 1 AND 365)
     OR p_etapas IS NULL OR pg_catalog.cardinality(p_etapas) NOT BETWEEN 1 AND 7
     OR NOT (p_etapas <@ v_etapas_validas)
     OR pg_catalog.cardinality(p_etapas) <> (SELECT count(DISTINCT etapa)::integer FROM pg_catalog.unnest(p_etapas) AS etapa)
     OR p_fotos_requeridas IS NULL OR pg_catalog.cardinality(p_fotos_requeridas) > 20
     OR pg_catalog.jsonb_typeof(COALESCE(p_campos_personalizados, '{}'::jsonb)) <> 'object'
     OR p_estado IS NULL OR p_estado NOT IN ('activo','inactivo') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los datos de la plantilla no son válidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(p_fotos_requeridas) AS foto
    WHERE pg_catalog.char_length(pg_catalog.btrim(foto)) NOT BETWEEN 1 AND 80
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Las fotos requeridas no son válidas';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT p.* INTO v_actual FROM public.plantillas_laboratorio p
    WHERE p.id = p_id AND p.clinica_id = v_clinica FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La plantilla no pertenece a la clínica activa';
    END IF;
  END IF;

  SELECT COALESCE(max(p.version), 0) + 1 INTO v_version
  FROM public.plantillas_laboratorio p
  WHERE p.clinica_id = v_clinica
    AND pg_catalog.lower(pg_catalog.btrim(p.nombre)) = pg_catalog.lower(pg_catalog.btrim(p_nombre));
  IF p_id IS NOT NULL THEN
    v_version := GREATEST(v_version, v_actual.version + 1);
    UPDATE public.plantillas_laboratorio SET estado = 'inactivo'
    WHERE id = v_actual.id AND clinica_id = v_clinica;
  END IF;

  INSERT INTO public.plantillas_laboratorio (
    clinica_id, nombre, categoria, descripcion, dias_estimados, etapas,
    fotos_requeridas, campos_personalizados, version, estado, created_by
  ) VALUES (
    v_clinica, pg_catalog.btrim(p_nombre), p_categoria,
    nullif(pg_catalog.btrim(COALESCE(p_descripcion, '')), ''), p_dias_estimados,
    p_etapas, p_fotos_requeridas, COALESCE(p_campos_personalizados, '{}'::jsonb),
    v_version, p_estado, v_actor
  ) RETURNING id INTO v_nuevo_id;
  RETURN v_nuevo_id;
END;
$function$;
ALTER FUNCTION public.guardar_plantilla_laboratorio_bp12(uuid, text, text, text, integer, text[], text[], jsonb, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guardar_plantilla_laboratorio_bp12(uuid, text, text, text, integer, text[], text[], jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_plantilla_laboratorio_bp12(uuid, text, text, text, integer, text[], text[], jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reemplazar_permisos_laboratorio_bp12(
  p_user_id uuid,
  p_permisos text[]
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_permisos text[] := COALESCE(p_permisos, ARRAY[]::text[]);
  v_validos text[] := ARRAY[
    'ver_costos_laboratorio','pagar_laboratorios','gestionar_laboratorios',
    'aprobar_garantias','configurar_plantillas'
  ]::text[];
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR p_user_id IS NULL
     OR public.rol_en_clinica_actual() <> 'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo administración puede asignar permisos de laboratorio';
  END IF;
  IF pg_catalog.cardinality(v_permisos) > 5
     OR NOT (v_permisos <@ v_validos)
     OR pg_catalog.cardinality(v_permisos) <> (
       SELECT count(DISTINCT permiso)::integer FROM pg_catalog.unnest(v_permisos) AS permiso
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La lista de permisos no es válida';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.miembros_clinica m
    WHERE m.clinica_id = v_clinica AND m.user_id = p_user_id AND m.activo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El usuario no pertenece a la clínica activa';
  END IF;

  DELETE FROM public.permisos_laboratorio_aditivos p
  WHERE p.clinica_id = v_clinica AND p.user_id = p_user_id;
  INSERT INTO public.permisos_laboratorio_aditivos (clinica_id, user_id, permiso, asignado_por)
  SELECT v_clinica, p_user_id, permiso, v_actor
  FROM pg_catalog.unnest(v_permisos) AS permiso;
  RETURN v_permisos;
END;
$function$;
ALTER FUNCTION public.reemplazar_permisos_laboratorio_bp12(uuid, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reemplazar_permisos_laboratorio_bp12(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_permisos_laboratorio_bp12(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_precio_laboratorio_bp12(
  p_laboratorio_id uuid,
  p_tipo_trabajo_id uuid,
  p_costo integer,
  p_dias_estimados integer,
  p_condicion_pago text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_actual public.laboratorio_precios%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role
       AND NOT public.tiene_permiso_laboratorio('gestionar_laboratorios')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para gestionar el tarifario';
  END IF;
  IF p_laboratorio_id IS NULL OR p_tipo_trabajo_id IS NULL
     OR p_costo IS NULL OR p_costo < 0
     OR (p_dias_estimados IS NOT NULL AND p_dias_estimados NOT BETWEEN 1 AND 365)
     OR pg_catalog.char_length(COALESCE(p_condicion_pago, '')) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los datos del precio no son válidos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.laboratorios l
    WHERE l.id = p_laboratorio_id AND l.clinica_id = v_clinica AND l.estado = 'activo')
    OR NOT EXISTS (SELECT 1 FROM public.laboratorio_tipos_trabajo t
      WHERE t.id = p_tipo_trabajo_id AND t.clinica_id = v_clinica AND t.estado = 'activo') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El laboratorio o tipo no está activo en la clínica';
  END IF;

  SELECT p.* INTO v_actual FROM public.laboratorio_precios p
  WHERE p.clinica_id = v_clinica AND p.laboratorio_id = p_laboratorio_id
    AND p.tipo_trabajo_id = p_tipo_trabajo_id AND p.vigente_hasta IS NULL
  FOR UPDATE;
  IF FOUND AND v_actual.costo = p_costo
     AND v_actual.dias_estimados IS NOT DISTINCT FROM p_dias_estimados
     AND v_actual.condicion_pago IS NOT DISTINCT FROM nullif(pg_catalog.btrim(COALESCE(p_condicion_pago, '')), '') THEN
    RETURN v_actual.id;
  END IF;
  IF FOUND THEN
    UPDATE public.laboratorio_precios SET vigente_hasta = CURRENT_DATE
    WHERE id = v_actual.id AND clinica_id = v_clinica AND vigente_hasta IS NULL;
  END IF;
  INSERT INTO public.laboratorio_precios (
    clinica_id, laboratorio_id, tipo_trabajo_id, costo,
    dias_estimados, condicion_pago, created_by
  ) VALUES (
    v_clinica, p_laboratorio_id, p_tipo_trabajo_id, p_costo,
    p_dias_estimados, nullif(pg_catalog.btrim(COALESCE(p_condicion_pago, '')), ''), v_actor
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
ALTER FUNCTION public.registrar_precio_laboratorio_bp12(uuid, uuid, integer, integer, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_precio_laboratorio_bp12(uuid, uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_precio_laboratorio_bp12(uuid, uuid, integer, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resumen_laboratorio_core_bp12()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_puede_ver_finanzas boolean;
  v_resultado jsonb;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role,
       'asistente'::public.app_role, 'recepcion'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para ver el dashboard de laboratorio';
  END IF;
  v_puede_ver_finanzas := v_rol = 'admin'::public.app_role
    OR public.tiene_permiso_laboratorio('ver_costos_laboratorio')
    OR public.tiene_permiso_laboratorio('pagar_laboratorios');

  WITH etapas AS (
    SELECT e.etapa, count(o.id)::integer AS cantidad
    FROM (VALUES ('solicitud'),('enviada'),('diseno'),('fabricacion'),('prueba'),('ajustes'),('entrega')) e(etapa)
    LEFT JOIN public.ordenes_laboratorio o
      ON o.clinica_id = v_clinica AND o.etapa_actual = e.etapa
    GROUP BY e.etapa
  ), volumen AS (
    SELECT COALESCE(l.nombre, CASE WHEN o.laboratorio_id IS NULL THEN 'Por asignar' ELSE 'Laboratorio inactivo' END) AS laboratorio,
      count(*)::integer AS ordenes_30_dias,
      round(avg((o.fecha_entrega::date - o.fecha_solicitud)::numeric) FILTER (WHERE o.fecha_entrega IS NOT NULL), 1) AS dias_promedio_entrega,
      count(*) FILTER (WHERE o.es_reposicion)::integer AS reposiciones,
      round(100.0 * count(*) FILTER (WHERE o.es_reposicion) / NULLIF(count(*), 0), 1) AS tasa_reproceso_pct,
      count(*) FILTER (WHERE o.fecha_entrega IS NOT NULL AND o.fecha_estimada_entrega IS NOT NULL
        AND o.fecha_entrega::date <= o.fecha_estimada_entrega)::integer AS entregas_a_tiempo,
      count(*) FILTER (WHERE o.fecha_entrega IS NOT NULL AND o.fecha_estimada_entrega IS NOT NULL)::integer AS entregas_con_fecha
    FROM public.ordenes_laboratorio o
    LEFT JOIN public.laboratorios l ON l.id = o.laboratorio_id AND l.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica AND o.created_at >= now() - interval '30 days'
    GROUP BY l.nombre, o.laboratorio_id
  ), costos_mes AS (
    SELECT COALESCE(l.nombre, 'Por asignar') AS laboratorio, sum(c.costo_total)::bigint AS costo_total
    FROM public.ordenes_laboratorio o
    JOIN public.ordenes_laboratorio_costos c ON c.orden_id = o.id AND c.clinica_id = o.clinica_id
    LEFT JOIN public.laboratorios l ON l.id = o.laboratorio_id AND l.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica AND o.created_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY l.nombre
  ), costos_anio AS (
    SELECT COALESCE(l.nombre, 'Por asignar') AS laboratorio, sum(c.costo_total)::bigint AS costo_total
    FROM public.ordenes_laboratorio o
    JOIN public.ordenes_laboratorio_costos c ON c.orden_id = o.id AND c.clinica_id = o.clinica_id
    LEFT JOIN public.laboratorios l ON l.id = o.laboratorio_id AND l.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica AND o.created_at >= date_trunc('year', CURRENT_DATE)
    GROUP BY l.nombre
  ), saldos AS (
    SELECT o.id, c.costo_total::bigint AS costo_total,
      COALESCE(sum(p.monto), 0)::bigint AS pagado
    FROM public.ordenes_laboratorio o
    JOIN public.ordenes_laboratorio_costos c ON c.orden_id = o.id AND c.clinica_id = o.clinica_id
    LEFT JOIN public.laboratorio_pagos p ON p.orden_id = o.id AND p.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica AND o.created_at < now() - interval '30 days'
    GROUP BY o.id, c.costo_total
  )
  SELECT pg_catalog.jsonb_build_object(
    'generado_en', clock_timestamp(),
    'ordenes_activas', (SELECT count(*)::integer FROM public.ordenes_laboratorio o
      WHERE o.clinica_id = v_clinica AND o.etapa_actual <> 'entrega'),
    'activas_por_etapa', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('etapa', e.etapa, 'cantidad', e.cantidad) ORDER BY e.etapa) FROM etapas e), '[]'::jsonb),
    'trabajos_30_dias', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'laboratorio', v.laboratorio, 'ordenes', v.ordenes_30_dias,
      'dias_promedio_entrega', v.dias_promedio_entrega,
      'reposiciones', v.reposiciones, 'tasa_reproceso_pct', v.tasa_reproceso_pct,
      'entregas_a_tiempo', v.entregas_a_tiempo, 'entregas_con_fecha', v.entregas_con_fecha
    ) ORDER BY v.ordenes_30_dias DESC, v.laboratorio) FROM volumen v), '[]'::jsonb),
    'costos_mes', CASE WHEN v_puede_ver_finanzas THEN COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('laboratorio', c.laboratorio, 'costo', c.costo_total) ORDER BY c.laboratorio) FROM costos_mes c), '[]'::jsonb) ELSE NULL END,
    'costos_anio', CASE WHEN v_puede_ver_finanzas THEN COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('laboratorio', c.laboratorio, 'costo', c.costo_total) ORDER BY c.laboratorio) FROM costos_anio c), '[]'::jsonb) ELSE NULL END,
    'ordenes_vencidas', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', o.id, 'folio', o.folio, 'laboratorio', COALESCE(l.nombre, 'Por asignar'),
      'fecha_estimada_entrega', o.fecha_estimada_entrega,
      'dias_vencida', CURRENT_DATE - o.fecha_estimada_entrega
    ) ORDER BY overdue.fecha_estimada_entrega, overdue.folio)
      FROM (
        SELECT o.id, o.folio, o.laboratorio_id, o.clinica_id, o.fecha_estimada_entrega
        FROM public.ordenes_laboratorio o
        WHERE o.clinica_id = v_clinica AND o.etapa_actual <> 'entrega'
          AND o.fecha_estimada_entrega < CURRENT_DATE
        ORDER BY o.fecha_estimada_entrega, o.folio LIMIT 20
      ) overdue
      LEFT JOIN public.laboratorios l ON l.id = overdue.laboratorio_id AND l.clinica_id = overdue.clinica_id
      JOIN public.ordenes_laboratorio o ON o.id = overdue.id AND o.clinica_id = overdue.clinica_id), '[]'::jsonb),
    'pagos_pendientes_30_dias', pg_catalog.jsonb_build_object(
      'cantidad', (SELECT count(*)::integer FROM saldos s WHERE s.costo_total > s.pagado),
      'monto', CASE WHEN v_puede_ver_finanzas THEN (SELECT COALESCE(sum(s.costo_total - s.pagado), 0)::bigint FROM saldos s WHERE s.costo_total > s.pagado) ELSE NULL END
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$function$;
ALTER FUNCTION public.resumen_laboratorio_core_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resumen_laboratorio_core_bp12() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_laboratorio_core_bp12() TO authenticated;

COMMENT ON FUNCTION public.resumen_laboratorio_core_bp12() IS
  'BP12 CORE: clinic-scoped volume, delivery, rework, overdue, active-stage and aged-payment metrics; financial values are permission-gated.';
