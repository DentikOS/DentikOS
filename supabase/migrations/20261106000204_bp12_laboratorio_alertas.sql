-- BP12: umbrales por clínica y alertas in-app diarias, persistentes e idempotentes.

CREATE TABLE public.configuracion_alertas_laboratorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL UNIQUE REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  dias_antes_entrega integer NOT NULL DEFAULT 3 CHECK (dias_antes_entrega IN (1, 3, 5, 7)),
  dias_prueba_inactiva integer NOT NULL DEFAULT 7 CHECK (dias_prueba_inactiva IN (5, 7, 10, 14)),
  dias_pago_pendiente integer NOT NULL DEFAULT 30 CHECK (dias_pago_pendiente IN (15, 30, 45, 60)),
  ordenes_por_mes integer NOT NULL DEFAULT 20 CHECK (ordenes_por_mes IN (10, 20, 30, 50)),
  tasa_reproceso_porcentaje integer NOT NULL DEFAULT 10 CHECK (tasa_reproceso_porcentaje IN (5, 10, 15, 20)),
  creado_por uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  actualizado_por uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alertas_laboratorio_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  alert_key text NOT NULL CHECK (char_length(alert_key) BETWEEN 1 AND 300),
  tipo text NOT NULL CHECK (tipo IN (
    'entrega_proxima', 'entrega_vencida', 'prueba_pendiente', 'pago_pendiente',
    'volumen_laboratorio', 'reproceso_laboratorio', 'prueba_estancada'
  )),
  recurso_id uuid,
  laboratorio_id uuid,
  severity text NOT NULL CHECK (severity IN ('critical', 'operational', 'informational')),
  title text NOT NULL,
  message text NOT NULL,
  action_url text NOT NULL DEFAULT '/laboratorio',
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(action_payload) = 'object'),
  activo boolean NOT NULL DEFAULT true,
  generacion integer NOT NULL DEFAULT 1 CHECK (generacion > 0),
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  UNIQUE (clinica_id, alert_key),
  FOREIGN KEY (laboratorio_id, clinica_id)
    REFERENCES public.laboratorios (id, clinica_id) ON DELETE RESTRICT,
  CHECK ((activo AND resolved_at IS NULL) OR (NOT activo AND resolved_at IS NOT NULL))
);

ALTER TABLE public.notificaciones
  ADD COLUMN dedupe_key text;

CREATE UNIQUE INDEX notificaciones_dedupe_bp12_uidx
  ON public.notificaciones (user_id, clinic_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX alertas_laboratorio_clinica_estado_idx
  ON public.alertas_laboratorio_estado (clinica_id, activo, severity, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.proteger_configuracion_alertas_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.clinica_actual() IS DISTINCT FROM NEW.clinica_id
     OR (public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el admin puede configurar alertas de laboratorio';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.creado_por := auth.uid();
    NEW.created_at := clock_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
       OR NEW.creado_por IS DISTINCT FROM OLD.creado_por OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede cambiar el origen de la configuración';
    END IF;
  END IF;
  NEW.actualizado_por := auth.uid();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_configuracion_alertas_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER laboratorio_alertas_config_guard
  BEFORE INSERT OR UPDATE ON public.configuracion_alertas_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_configuracion_alertas_laboratorio();
CREATE TRIGGER laboratorio_alertas_config_audit
  AFTER INSERT OR UPDATE ON public.configuracion_alertas_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();

ALTER TABLE public.configuracion_alertas_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_laboratorio_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY laboratorio_alertas_config_select_clinica
  ON public.configuracion_alertas_laboratorio FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY laboratorio_alertas_config_insert_admin
  ON public.configuracion_alertas_laboratorio FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = 'admin'::public.app_role);
CREATE POLICY laboratorio_alertas_config_update_admin
  ON public.configuracion_alertas_laboratorio FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = 'admin'::public.app_role)
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = 'admin'::public.app_role);
CREATE POLICY laboratorio_alertas_estado_select_clinica
  ON public.alertas_laboratorio_estado FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));

REVOKE ALL ON public.configuracion_alertas_laboratorio, public.alertas_laboratorio_estado FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.configuracion_alertas_laboratorio TO authenticated;
GRANT SELECT ON public.alertas_laboratorio_estado TO authenticated;

CREATE OR REPLACE FUNCTION public.generar_alertas_laboratorio()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica record;
  v_alert record;
  v_estado public.alertas_laboratorio_estado%ROWTYPE;
  v_usuario record;
  v_fecha_local date;
  v_inicio_mes timestamptz;
  v_inicio_mes_siguiente timestamptz;
  v_dias_entrega integer;
  v_dias_prueba integer;
  v_dias_pago integer;
  v_umbral_ordenes integer;
  v_umbral_reproceso integer;
  v_notificaciones integer := 0;
  v_insertadas integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS bp12_alertas_candidatas (
    clinica_id uuid NOT NULL,
    alert_key text NOT NULL,
    tipo text NOT NULL,
    recurso_id uuid,
    laboratorio_id uuid,
    severity text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text NOT NULL,
    action_payload jsonb NOT NULL,
    roles_destino text[] NOT NULL,
    permiso_destino text,
    PRIMARY KEY (clinica_id, alert_key)
  ) ON COMMIT DROP;

  FOR v_clinica IN
    SELECT c.id, coalesce(nullif(c.zona_horaria, ''), 'UTC') AS zona_horaria,
      coalesce(cfg.dias_antes_entrega, 3) AS dias_antes_entrega,
      coalesce(cfg.dias_prueba_inactiva, 7) AS dias_prueba_inactiva,
      coalesce(cfg.dias_pago_pendiente, 30) AS dias_pago_pendiente,
      coalesce(cfg.ordenes_por_mes, 20) AS ordenes_por_mes,
      coalesce(cfg.tasa_reproceso_porcentaje, 10) AS tasa_reproceso_porcentaje
    FROM public.clinicas c
    LEFT JOIN public.configuracion_alertas_laboratorio cfg ON cfg.clinica_id = c.id
    WHERE c.estado IN ('active', 'trial')
  LOOP
    TRUNCATE TABLE pg_temp.bp12_alertas_candidatas;
    v_dias_entrega := v_clinica.dias_antes_entrega;
    v_dias_prueba := v_clinica.dias_prueba_inactiva;
    v_dias_pago := v_clinica.dias_pago_pendiente;
    v_umbral_ordenes := v_clinica.ordenes_por_mes;
    v_umbral_reproceso := v_clinica.tasa_reproceso_porcentaje;
    BEGIN
      v_fecha_local := pg_catalog.timezone(v_clinica.zona_horaria, clock_timestamp())::date;
    EXCEPTION WHEN invalid_parameter_value THEN
      v_fecha_local := current_date;
    END;
    v_inicio_mes := pg_catalog.date_trunc('month', v_fecha_local::timestamp) AT TIME ZONE v_clinica.zona_horaria;
    v_inicio_mes_siguiente := (pg_catalog.date_trunc('month', v_fecha_local::timestamp) + interval '1 month') AT TIME ZONE v_clinica.zona_horaria;

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id, 'entrega_proxima:' || o.id::text, 'entrega_proxima', o.id, o.laboratorio_id,
      'operational', 'Trabajo por entregar',
      'La orden ' || o.folio || ' tiene entrega estimada en ' || v_dias_entrega || ' día(s).',
      '/laboratorio', pg_catalog.jsonb_build_object('ordenId', o.id),
      ARRAY['dentista','recepcion']::text[], NULL
    FROM public.ordenes_laboratorio o
    WHERE o.clinica_id = v_clinica.id AND o.etapa_actual <> 'entrega'
      AND o.fecha_estimada_entrega = v_fecha_local + v_dias_entrega;

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id, 'entrega_vencida:' || o.id::text, 'entrega_vencida', o.id, o.laboratorio_id,
      'critical', 'Trabajo vencido',
      'La orden ' || o.folio || ' está vencida hace ' || (v_fecha_local - o.fecha_estimada_entrega) || ' día(s). Contactar al laboratorio.',
      '/laboratorio', pg_catalog.jsonb_build_object('ordenId', o.id),
      ARRAY['admin','dentista']::text[], NULL
    FROM public.ordenes_laboratorio o
    WHERE o.clinica_id = v_clinica.id AND o.etapa_actual <> 'entrega'
      AND o.fecha_estimada_entrega < v_fecha_local;

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id, 'prueba_pendiente:' || o.id::text, 'prueba_pendiente', o.id, o.laboratorio_id,
      'operational', 'Trabajo en prueba pendiente',
      'La orden ' || o.folio || ' lleva más de ' || v_dias_prueba || ' días en prueba. Revisar si corresponde agendar una cita.',
      '/laboratorio', pg_catalog.jsonb_build_object('ordenId', o.id),
      ARRAY['dentista']::text[], NULL
    FROM public.ordenes_laboratorio o
    WHERE o.clinica_id = v_clinica.id AND o.etapa_actual = 'prueba'
      AND clock_timestamp() - (
        SELECT max(h.registrado_en) FROM public.historial_etapas_laboratorio h
        WHERE h.clinica_id = o.clinica_id AND h.orden_id = o.id AND h.etapa = 'prueba'
      ) > pg_catalog.make_interval(days => v_dias_prueba);

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id, 'prueba_estancada:' || o.id::text, 'prueba_estancada', o.id, o.laboratorio_id,
      'critical', 'Trabajo estancado en prueba',
      'La orden ' || o.folio || ' sigue en prueba sin movimiento por más de ' || v_dias_prueba || ' días.',
      '/laboratorio', pg_catalog.jsonb_build_object('ordenId', o.id),
      ARRAY['dentista']::text[], NULL
    FROM public.ordenes_laboratorio o
    WHERE o.clinica_id = v_clinica.id AND o.etapa_actual = 'prueba'
      AND clock_timestamp() - (
        SELECT max(h.registrado_en) FROM public.historial_etapas_laboratorio h
        WHERE h.clinica_id = o.clinica_id AND h.orden_id = o.id AND h.etapa = 'prueba'
      ) > pg_catalog.make_interval(days => v_dias_prueba);

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id, 'pago_pendiente:' || o.id::text, 'pago_pendiente', o.id, o.laboratorio_id,
      'critical', 'Pago pendiente al laboratorio',
      'La orden ' || o.folio || ' mantiene un saldo de laboratorio pendiente por más de ' || v_dias_pago || ' días.',
      '/laboratorio', pg_catalog.jsonb_build_object('ordenId', o.id),
      ARRAY['admin']::text[], 'pagar_laboratorios'
    FROM public.ordenes_laboratorio_costos c
    JOIN public.ordenes_laboratorio o ON o.id = c.orden_id AND o.clinica_id = c.clinica_id
    WHERE o.clinica_id = v_clinica.id
      AND c.costo_total > coalesce((
        SELECT sum(p.monto)::bigint FROM public.laboratorio_pagos p
        WHERE p.clinica_id = o.clinica_id AND p.orden_id = o.id
      ), 0)
      AND c.created_at < clock_timestamp() - pg_catalog.make_interval(days => v_dias_pago);

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id,
      'volumen_laboratorio:' || o.laboratorio_id::text || ':' || to_char(v_inicio_mes AT TIME ZONE v_clinica.zona_horaria, 'YYYY-MM'),
      'volumen_laboratorio', o.laboratorio_id, o.laboratorio_id,
      'informational', 'Alto volumen con un laboratorio',
      'El laboratorio ' || l.nombre || ' registra ' || count(*) || ' órdenes este mes.',
      '/laboratorio', pg_catalog.jsonb_build_object('laboratorioId', o.laboratorio_id),
      ARRAY['admin']::text[], NULL
    FROM public.ordenes_laboratorio o
    JOIN public.laboratorios l ON l.id = o.laboratorio_id AND l.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica.id AND o.created_at >= v_inicio_mes AND o.created_at < v_inicio_mes_siguiente
    GROUP BY o.clinica_id, o.laboratorio_id, l.nombre
    HAVING count(*) > v_umbral_ordenes;

    INSERT INTO pg_temp.bp12_alertas_candidatas
    SELECT o.clinica_id,
      'reproceso_laboratorio:' || o.laboratorio_id::text || ':' || to_char(v_fecha_local, 'YYYY-MM-DD'),
      'reproceso_laboratorio', o.laboratorio_id, o.laboratorio_id,
      'operational', 'Alta tasa de reprocesos',
      'El laboratorio ' || l.nombre || ' registra una tasa de reprocesos de ' ||
        round(100.0 * count(*) FILTER (WHERE o.es_reposicion) / nullif(count(*), 0), 1) || '%.',
      '/laboratorio', pg_catalog.jsonb_build_object('laboratorioId', o.laboratorio_id),
      ARRAY['admin']::text[], NULL
    FROM public.ordenes_laboratorio o
    JOIN public.laboratorios l ON l.id = o.laboratorio_id AND l.clinica_id = o.clinica_id
    WHERE o.clinica_id = v_clinica.id
      AND o.created_at >= clock_timestamp() - interval '30 days'
    GROUP BY o.clinica_id, o.laboratorio_id, l.nombre
    HAVING count(*) FILTER (WHERE o.es_reposicion) > 0
      AND 100.0 * count(*) FILTER (WHERE o.es_reposicion) / nullif(count(*), 0) > v_umbral_reproceso;

    FOR v_alert IN SELECT * FROM pg_temp.bp12_alertas_candidatas WHERE clinica_id = v_clinica.id LOOP
      SELECT * INTO v_estado FROM public.alertas_laboratorio_estado s
      WHERE s.clinica_id = v_alert.clinica_id AND s.alert_key = v_alert.alert_key
      FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.alertas_laboratorio_estado (
          clinica_id, alert_key, tipo, recurso_id, laboratorio_id, severity,
          title, message, action_url, action_payload
        ) VALUES (
          v_alert.clinica_id, v_alert.alert_key, v_alert.tipo, v_alert.recurso_id,
          v_alert.laboratorio_id, v_alert.severity, v_alert.title, v_alert.message,
          v_alert.action_url, v_alert.action_payload
        ) RETURNING * INTO v_estado;
      ELSE
        UPDATE public.alertas_laboratorio_estado s
        SET tipo = v_alert.tipo, recurso_id = v_alert.recurso_id,
            laboratorio_id = v_alert.laboratorio_id, severity = v_alert.severity,
            title = v_alert.title, message = v_alert.message,
            action_url = v_alert.action_url, action_payload = v_alert.action_payload,
            activo = true, generacion = s.generacion + CASE WHEN s.activo THEN 0 ELSE 1 END,
            last_seen_at = clock_timestamp(), resolved_at = NULL
        WHERE s.id = v_estado.id
        RETURNING * INTO v_estado;
      END IF;

      FOR v_usuario IN
        SELECT DISTINCT m.user_id
        FROM public.miembros_clinica m
        LEFT JOIN public.permisos_laboratorio_aditivos p
          ON p.clinica_id = m.clinica_id AND p.user_id = m.user_id
         AND p.permiso = v_alert.permiso_destino
        WHERE m.clinica_id = v_alert.clinica_id AND m.activo
          AND (m.rol = ANY(v_alert.roles_destino) OR p.user_id IS NOT NULL)
      LOOP
        INSERT INTO public.notificaciones (
          user_id, clinic_id, severity, title, message, action_label, action_url,
          action_payload, read, dismissed, metadata, dedupe_key
        ) VALUES (
          v_usuario.user_id, v_alert.clinica_id, v_alert.severity, v_alert.title,
          v_alert.message, 'Ver laboratorio', v_alert.action_url, v_alert.action_payload,
          false, false,
          pg_catalog.jsonb_build_object(
            'source', 'bp12_laboratorio', 'laboratorio_alerta_id', v_estado.id,
            'alert_key', v_estado.alert_key, 'generacion', v_estado.generacion,
            'recurso_id', v_estado.recurso_id
          ),
          v_estado.id::text || ':' || v_estado.generacion::text
        ) ON CONFLICT (user_id, clinic_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
        GET DIAGNOSTICS v_insertadas = ROW_COUNT;
        v_notificaciones := v_notificaciones + v_insertadas;
      END LOOP;
    END LOOP;

    UPDATE public.alertas_laboratorio_estado s
    SET activo = false, resolved_at = clock_timestamp()
    WHERE s.clinica_id = v_clinica.id AND s.activo
      AND NOT EXISTS (
        SELECT 1 FROM pg_temp.bp12_alertas_candidatas a
        WHERE a.clinica_id = s.clinica_id AND a.alert_key = s.alert_key
      );

    UPDATE public.notificaciones n
    SET read = true, dismissed = true
    FROM public.alertas_laboratorio_estado s
    WHERE s.clinica_id = v_clinica.id AND NOT s.activo
      AND n.clinic_id = s.clinica_id
      AND n.metadata->>'laboratorio_alerta_id' = s.id::text
      AND (n.read IS DISTINCT FROM true OR n.dismissed IS DISTINCT FROM true);
  END LOOP;

  RETURN v_notificaciones;
END;
$function$;
ALTER FUNCTION public.generar_alertas_laboratorio() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.generar_alertas_laboratorio() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generar_alertas_laboratorio() TO postgres;

DO $publication$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['configuracion_alertas_laboratorio', 'alertas_laboratorio_estado'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabla
    ) THEN
      EXECUTE pg_catalog.format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
    END IF;
  END LOOP;
END;
$publication$;

DO $schedule$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'bp12-laboratorio-alertas-diarias';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'bp12-laboratorio-alertas-diarias',
    '0 10 * * *',
    'SELECT public.generar_alertas_laboratorio()'
  );
END;
$schedule$;

COMMENT ON TABLE public.alertas_laboratorio_estado IS
  'BP12: estado por clínica de las siete alertas; la notificación es in-app y se deduplica por episodio.';
COMMENT ON FUNCTION public.generar_alertas_laboratorio() IS
  'BP12: evalúa umbrales por clínica y genera notificaciones persistentes con ejecución diaria idempotente.';

