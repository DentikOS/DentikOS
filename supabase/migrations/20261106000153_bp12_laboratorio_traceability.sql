-- BP12: documentos clínicos vinculados a órdenes y reprocesos auditables.

ALTER TABLE public.ordenes_laboratorio
  ADD CONSTRAINT ordenes_laboratorio_id_clinica_paciente_uniq
  UNIQUE (id, clinica_id, paciente_id);

ALTER TABLE public.archivos_clinicos
  DROP CONSTRAINT archivos_clinicos_categoria_check,
  ADD COLUMN orden_laboratorio_id uuid,
  ADD CONSTRAINT archivos_clinicos_categoria_check CHECK (categoria IN (
    'radiografia', 'foto_intraoral', 'foto_clinica', 'pdf', 'documento', 'otro', 'laboratorio'
  )),
  ADD CONSTRAINT archivos_clinicos_id_clinica_uniq UNIQUE (id, clinica_id),
  ADD CONSTRAINT archivos_clinicos_orden_laboratorio_fk
    FOREIGN KEY (orden_laboratorio_id, clinica_id, paciente_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id, paciente_id) ON DELETE RESTRICT,
  ADD CONSTRAINT archivos_laboratorio_requiere_orden_check
    CHECK (categoria <> 'laboratorio' OR (
      orden_laboratorio_id IS NOT NULL
      AND metadata IS NOT NULL
      AND coalesce(metadata->>'tipo_documento', '') IN (
        'orden_trabajo', 'receta_protesica', 'diseno_cad', 'foto_diseno',
        'radiografia_control', 'certificado_materiales', 'garantia_trabajo',
        'evidencia_garantia', 'otro'
      )
    ));

CREATE INDEX archivos_clinicos_orden_laboratorio_idx
  ON public.archivos_clinicos (clinica_id, orden_laboratorio_id, created_at DESC)
  WHERE orden_laboratorio_id IS NOT NULL AND estado = 'activo';

COMMENT ON COLUMN public.archivos_clinicos.orden_laboratorio_id IS
  'BP12: orden del mismo paciente y clínica; los blobs siguen en R2 y la fila conserva soft-delete.';

ALTER TABLE public.ordenes_laboratorio
  ADD COLUMN garantia_id uuid,
  ADD COLUMN es_reposicion boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ordenes_laboratorio_garantia_fk
    FOREIGN KEY (garantia_id, clinica_id)
    REFERENCES public.garantias_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  ADD CONSTRAINT ordenes_laboratorio_reposicion_consistente_check
    CHECK (es_reposicion = (garantia_id IS NOT NULL));

CREATE UNIQUE INDEX ordenes_laboratorio_garantia_reposicion_uidx
  ON public.ordenes_laboratorio (clinica_id, garantia_id)
  WHERE es_reposicion;

ALTER TABLE public.garantias_laboratorio
  ADD COLUMN archivo_evidencia_id uuid,
  ADD COLUMN resolucion_motivo text,
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN idempotency_fingerprint text;

UPDATE public.garantias_laboratorio
SET idempotency_key = gen_random_uuid(),
    idempotency_fingerprint = pg_catalog.md5(
      clinica_id::text || '|' || orden_original_id::text || '|' || motivo || '|' || created_by::text
    )
WHERE idempotency_key IS NULL OR idempotency_fingerprint IS NULL;

ALTER TABLE public.garantias_laboratorio
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN idempotency_fingerprint SET NOT NULL,
  ADD CONSTRAINT garantias_laboratorio_clinica_idempotency_uniq UNIQUE (clinica_id, idempotency_key),
  ADD CONSTRAINT garantias_laboratorio_evidencia_fk
    FOREIGN KEY (archivo_evidencia_id, clinica_id)
    REFERENCES public.archivos_clinicos (id, clinica_id) ON DELETE RESTRICT,
  ADD CONSTRAINT garantias_laboratorio_resolucion_motivo_check
    CHECK (resolucion_motivo IS NULL OR char_length(btrim(resolucion_motivo)) BETWEEN 1 AND 2000);

CREATE TABLE public.garantias_laboratorio_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  garantia_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  evento text NOT NULL CHECK (evento IN ('reclamo_creado', 'reclamo_rechazado', 'reposicion_aprobada', 'reposicion_creada')),
  estado_anterior text,
  estado text NOT NULL,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detalles) = 'object'),
  registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (garantia_id, clinica_id)
    REFERENCES public.garantias_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, actor_id)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX garantias_laboratorio_historial_idx
  ON public.garantias_laboratorio_historial (clinica_id, garantia_id, registrado_en DESC);

ALTER TABLE public.garantias_laboratorio_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY garantias_laboratorio_historial_select_clinica
  ON public.garantias_laboratorio_historial FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
REVOKE ALL ON public.garantias_laboratorio_historial FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.garantias_laboratorio_historial TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_archivo_orden_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.categoria = 'laboratorio' THEN
    IF NEW.orden_laboratorio_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.ordenes_laboratorio o
         WHERE o.id = NEW.orden_laboratorio_id
           AND o.clinica_id = NEW.clinica_id
           AND o.paciente_id = NEW.paciente_id
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'La orden no pertenece al paciente y clínica del archivo';
    END IF;
  ELSIF NEW.orden_laboratorio_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Solo los archivos de laboratorio pueden vincularse a una orden';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
    OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
    OR NEW.orden_laboratorio_id IS DISTINCT FROM OLD.orden_laboratorio_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede cambiar el origen clínico del archivo';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_archivo_orden_laboratorio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER archivos_clinicos_orden_laboratorio_guard
  BEFORE INSERT OR UPDATE ON public.archivos_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_archivo_orden_laboratorio();

CREATE OR REPLACE FUNCTION public.proteger_orden_reposicion_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.garantia_id IS NULL AND NOT NEW.es_reposicion THEN
      RETURN NEW;
    END IF;
    IF current_user <> 'postgres'
       OR NOT EXISTS (
         SELECT 1 FROM public.garantias_laboratorio g
         JOIN public.ordenes_laboratorio o
           ON o.id = g.orden_original_id AND o.clinica_id = g.clinica_id
         WHERE g.id = NEW.garantia_id
           AND g.clinica_id = NEW.clinica_id
           AND g.estado = 'aprobada'
           AND o.paciente_id = NEW.paciente_id
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La orden de reposición solo puede crearla el flujo autorizado de garantía';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (
    NEW.garantia_id IS DISTINCT FROM OLD.garantia_id
    OR NEW.es_reposicion IS DISTINCT FROM OLD.es_reposicion
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El origen de una orden no se puede cambiar';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_orden_reposicion_laboratorio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER laboratorio_orden_reposicion_guard
  BEFORE INSERT OR UPDATE ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_orden_reposicion_laboratorio();

CREATE OR REPLACE FUNCTION public.proteger_evidencia_garantia_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.archivo_evidencia_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.ordenes_laboratorio o
      JOIN public.archivos_clinicos a
        ON a.orden_laboratorio_id = o.id
       AND a.clinica_id = o.clinica_id
       AND a.paciente_id = o.paciente_id
      WHERE o.id = NEW.orden_original_id
        AND o.clinica_id = NEW.clinica_id
        AND o.etapa_actual = 'entrega'
        AND a.id = NEW.archivo_evidencia_id
        AND a.categoria = 'laboratorio'
        AND a.metadata->>'tipo_documento' IN ('evidencia_garantia', 'foto_diseno', 'otro')
        AND a.estado = 'activo'
        AND a.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El reclamo requiere evidencia activa vinculada a la orden original';
    END IF;
  ELSIF NEW.archivo_evidencia_id IS DISTINCT FROM OLD.archivo_evidencia_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La evidencia de un reclamo no se puede sustituir';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_evidencia_garantia_laboratorio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER laboratorio_garantia_evidencia_guard
  BEFORE INSERT OR UPDATE ON public.garantias_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_evidencia_garantia_laboratorio();

CREATE OR REPLACE FUNCTION public.registrar_historial_garantia_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := coalesce(auth.uid(), NEW.revisado_por, NEW.created_by);
  v_evento text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_evento := 'reclamo_creado';
  ELSIF NEW.estado = 'rechazada' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    v_evento := 'reclamo_rechazado';
  ELSIF NEW.estado = 'aprobada' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    v_evento := 'reposicion_aprobada';
  ELSE
    v_evento := 'reposicion_creada';
  END IF;

  INSERT INTO public.garantias_laboratorio_historial (
    clinica_id, garantia_id, actor_id, evento, estado_anterior, estado, detalles
  ) VALUES (
    NEW.clinica_id, NEW.id, v_actor, v_evento,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
    NEW.estado,
    pg_catalog.jsonb_build_object(
      'tipo_responsabilidad', NEW.tipo_responsabilidad,
      'porcentaje_costo_clinica', NEW.porcentaje_costo_clinica,
      'orden_reposicion_id', NEW.orden_reposicion_id,
      'archivo_evidencia_id', NEW.archivo_evidencia_id
    )
  );
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.registrar_historial_garantia_laboratorio() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_historial_garantia_laboratorio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER laboratorio_garantia_historial_append
  AFTER INSERT OR UPDATE ON public.garantias_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_garantia_laboratorio();

CREATE OR REPLACE FUNCTION public.crear_reclamo_garantia_laboratorio(
  p_orden_original_id uuid,
  p_motivo text,
  p_archivo_evidencia_id uuid,
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
  v_fingerprint text;
  v_existente public.garantias_laboratorio%ROWTYPE;
  v_garantia public.garantias_laboratorio%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para iniciar un reclamo de garantía';
  END IF;
  IF p_orden_original_id IS NULL OR p_archivo_evidencia_id IS NULL
     OR p_idempotency_key IS NULL OR char_length(btrim(coalesce(p_motivo, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Datos del reclamo de garantía inválidos';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ordenes_laboratorio o
    WHERE o.id = p_orden_original_id AND o.clinica_id = v_clinica AND o.etapa_actual = 'entrega'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden original no disponible';
  END IF;
  v_fingerprint := pg_catalog.md5(
    p_orden_original_id::text || '|' || btrim(p_motivo) || '|' || p_archivo_evidencia_id::text || '|' || v_actor::text
  );

  SELECT * INTO v_existente FROM public.garantias_laboratorio g
  WHERE g.clinica_id = v_clinica AND g.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.idempotency_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia usada para otro reclamo';
    END IF;
    RETURN pg_catalog.jsonb_build_object('id', v_existente.id, 'estado', v_existente.estado);
  END IF;

  INSERT INTO public.garantias_laboratorio (
    clinica_id, orden_original_id, archivo_evidencia_id, motivo,
    idempotency_key, idempotency_fingerprint, created_by
  ) VALUES (
    v_clinica, p_orden_original_id, p_archivo_evidencia_id, btrim(p_motivo),
    p_idempotency_key, v_fingerprint, v_actor
  ) ON CONFLICT (clinica_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_garantia;

  IF NOT FOUND THEN
    SELECT * INTO v_garantia FROM public.garantias_laboratorio g
    WHERE g.clinica_id = v_clinica AND g.idempotency_key = p_idempotency_key;
    IF v_garantia.idempotency_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia usada para otro reclamo';
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('id', v_garantia.id, 'estado', v_garantia.estado);
END;
$function$;
ALTER FUNCTION public.crear_reclamo_garantia_laboratorio(uuid, text, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crear_reclamo_garantia_laboratorio(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_reclamo_garantia_laboratorio(uuid, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolver_garantia_laboratorio(
  p_garantia_id uuid,
  p_decision text,
  p_tipo_responsabilidad text DEFAULT NULL,
  p_porcentaje_costo_clinica numeric DEFAULT NULL,
  p_motivo_rechazo text DEFAULT NULL
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
  v_garantia public.garantias_laboratorio%ROWTYPE;
  v_original public.ordenes_laboratorio%ROWTYPE;
  v_reposicion public.ordenes_laboratorio%ROWTYPE;
  v_costo bigint;
  v_precio bigint;
  v_costo_reposicion bigint;
  v_precio_reposicion bigint;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL OR v_rol IS NULL
     OR (v_rol <> 'admin'::public.app_role AND (
       v_rol NOT IN ('dentista'::public.app_role, 'asistente'::public.app_role)
       OR NOT public.tiene_permiso_laboratorio('aprobar_garantias')
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin permiso para resolver garantías';
  END IF;
  IF p_garantia_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('aprobar', 'rechazar') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Decisión de garantía inválida';
  END IF;
  IF p_decision = 'aprobar' AND (
    p_tipo_responsabilidad IS NULL
    OR p_tipo_responsabilidad NOT IN ('laboratorio', 'clinica', 'compartida', 'sin_garantia')
    OR (p_tipo_responsabilidad = 'compartida'
      AND (p_porcentaje_costo_clinica IS NULL OR p_porcentaje_costo_clinica NOT BETWEEN 0 AND 100))
    OR (p_tipo_responsabilidad <> 'compartida' AND p_porcentaje_costo_clinica IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La responsabilidad de la garantía no es válida';
  END IF;
  IF p_decision = 'rechazar' AND char_length(btrim(coalesce(p_motivo_rechazo, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El rechazo requiere un motivo';
  END IF;

  SELECT * INTO v_garantia FROM public.garantias_laboratorio g
  WHERE g.id = p_garantia_id AND g.clinica_id = v_clinica FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Garantía no disponible';
  END IF;

  IF p_decision = 'rechazar' AND v_garantia.estado = 'rechazada'
     AND v_garantia.resolucion_motivo = btrim(p_motivo_rechazo) THEN
    RETURN pg_catalog.jsonb_build_object('id', v_garantia.id, 'estado', v_garantia.estado);
  END IF;
  IF p_decision = 'aprobar' AND v_garantia.estado = 'repuesto'
     AND v_garantia.tipo_responsabilidad = p_tipo_responsabilidad
     AND v_garantia.porcentaje_costo_clinica IS NOT DISTINCT FROM p_porcentaje_costo_clinica THEN
    RETURN pg_catalog.jsonb_build_object(
      'id', v_garantia.id, 'estado', v_garantia.estado,
      'orden_reposicion_id', v_garantia.orden_reposicion_id
    );
  END IF;
  IF v_garantia.estado NOT IN ('reclamo', 'aprobada') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'La garantía ya fue resuelta';
  END IF;

  SELECT * INTO v_original FROM public.ordenes_laboratorio o
  WHERE o.id = v_garantia.orden_original_id AND o.clinica_id = v_clinica FOR UPDATE;
  IF NOT FOUND OR v_original.etapa_actual <> 'entrega' OR NOT EXISTS (
    SELECT 1 FROM public.archivos_clinicos a
    WHERE a.id = v_garantia.archivo_evidencia_id
      AND a.clinica_id = v_clinica AND a.paciente_id = v_original.paciente_id
      AND a.orden_laboratorio_id = v_original.id AND a.categoria = 'laboratorio'
      AND a.estado = 'activo' AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'La orden o la evidencia ya no están disponibles';
  END IF;

  IF p_decision = 'rechazar' THEN
    UPDATE public.garantias_laboratorio g
    SET estado = 'rechazada', resolucion_motivo = btrim(p_motivo_rechazo)
    WHERE g.id = v_garantia.id AND g.clinica_id = v_clinica;
    RETURN pg_catalog.jsonb_build_object('id', v_garantia.id, 'estado', 'rechazada');
  END IF;

  UPDATE public.garantias_laboratorio g
  SET estado = 'aprobada', tipo_responsabilidad = p_tipo_responsabilidad,
      porcentaje_costo_clinica = p_porcentaje_costo_clinica,
      resolucion_motivo = NULL
  WHERE g.id = v_garantia.id AND g.clinica_id = v_clinica;

  SELECT c.costo_total::bigint, c.precio_paciente::bigint
  INTO v_costo, v_precio FROM public.ordenes_laboratorio_costos c
  WHERE c.orden_id = v_original.id AND c.clinica_id = v_clinica;
  IF p_tipo_responsabilidad <> 'laboratorio' AND v_costo IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La orden original no tiene costo registrado';
  END IF;
  IF p_tipo_responsabilidad = 'laboratorio' THEN
    v_costo_reposicion := 0;
    v_precio_reposicion := 0;
  ELSIF p_tipo_responsabilidad = 'compartida' THEN
    v_costo_reposicion := round(v_costo * p_porcentaje_costo_clinica / 100.0)::bigint;
    v_precio_reposicion := 0;
  ELSIF p_tipo_responsabilidad = 'sin_garantia' THEN
    v_costo_reposicion := v_costo;
    v_precio_reposicion := coalesce(v_precio, 0);
  ELSE
    v_costo_reposicion := v_costo;
    v_precio_reposicion := 0;
  END IF;

  INSERT INTO public.ordenes_laboratorio (
    clinica_id, folio, paciente_id, laboratorio_id, tipo_trabajo_id,
    plantilla_id, plantilla_snapshot, etapa_actual, version, solicitud_limitada,
    pieza_dentaria, color_guia, indicaciones_tecnicas, observaciones,
    responsable_user_id, fecha_solicitud, fecha_estimada_entrega, created_by,
    garantia_id, es_reposicion
  ) VALUES (
    v_clinica, '', v_original.paciente_id, v_original.laboratorio_id, v_original.tipo_trabajo_id,
    v_original.plantilla_id, v_original.plantilla_snapshot, 'solicitud', 1, false,
    v_original.pieza_dentaria, v_original.color_guia, v_original.indicaciones_tecnicas,
    'Reposición de garantía ' || v_garantia.id::text,
    v_original.responsable_user_id, current_date, NULL, v_actor,
    v_garantia.id, true
  ) RETURNING * INTO v_reposicion;

  INSERT INTO public.ordenes_laboratorio_costos (
    clinica_id, orden_id, costo_total, precio_paciente, moneda, created_by
  ) VALUES (
    v_clinica, v_reposicion.id, v_costo_reposicion, v_precio_reposicion, 'CLP', v_actor
  );

  UPDATE public.garantias_laboratorio g
  SET estado = 'repuesto', orden_reposicion_id = v_reposicion.id
  WHERE g.id = v_garantia.id AND g.clinica_id = v_clinica;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_garantia.id, 'estado', 'repuesto',
    'orden_reposicion_id', v_reposicion.id, 'folio', v_reposicion.folio
  );
END;
$function$;
ALTER FUNCTION public.resolver_garantia_laboratorio(uuid, text, text, numeric, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolver_garantia_laboratorio(uuid, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_garantia_laboratorio(uuid, text, text, numeric, text) TO authenticated;

DROP POLICY IF EXISTS garantias_insert_clinica ON public.garantias_laboratorio;
DROP POLICY IF EXISTS garantias_update_aprobacion ON public.garantias_laboratorio;
REVOKE INSERT, UPDATE, DELETE ON public.garantias_laboratorio FROM authenticated;
GRANT SELECT ON public.garantias_laboratorio TO authenticated;
COMMENT ON FUNCTION public.resolver_garantia_laboratorio(uuid, text, text, numeric, text) IS
  'BP12: resuelve cada reclamo en forma atómica, crea una única orden nueva y registra el costo según la responsabilidad.';

DO $publication$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['archivos_clinicos', 'garantias_laboratorio_historial'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabla
    ) THEN
      EXECUTE pg_catalog.format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
    END IF;
  END LOOP;
END;
$publication$;

