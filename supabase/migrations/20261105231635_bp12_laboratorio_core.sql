-- BP12 CORE, ola 1: catálogo, órdenes, historial de etapas y garantías.
-- Tenant derivado de clinica_actual(); costos no viven en la proyección común.

-- The app stores the selected clinic in user_metadata. Honor that selector
-- only when the authenticated user has an active membership in that clinic.
-- CREATE OR REPLACE preserves the existing function owner and grants.
CREATE OR REPLACE FUNCTION public.clinica_actual()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT mc.clinica_id
  FROM public.miembros_clinica mc
  WHERE mc.user_id = auth.uid()
    AND mc.activo
    AND mc.clinica_id = CASE
      WHEN (auth.jwt()->'user_metadata'->>'clinica_id') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt()->'user_metadata'->>'clinica_id')::uuid
      ELSE NULL
    END
  LIMIT 1;
$function$;

CREATE TABLE public.laboratorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 160),
  tipo text NOT NULL CHECK (tipo IN ('externo', 'interno', 'digital')),
  rut text,
  direccion text,
  telefono text,
  email text,
  representante text,
  tecnico_responsable text,
  horario_retiro_entrega text,
  especialidades text[] NOT NULL DEFAULT '{}',
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX laboratorios_clinica_nombre_uidx
  ON public.laboratorios (clinica_id, lower(btrim(nombre)));
CREATE INDEX laboratorios_clinica_estado_idx
  ON public.laboratorios (clinica_id, estado, nombre);

CREATE TABLE public.laboratorio_tipos_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  categoria text NOT NULL CHECK (categoria IN (
    'protesis_fija', 'protesis_removible', 'implantoprotesis', 'ortodoncia',
    'ferulas_protectores', 'provisionales', 'reparaciones'
  )),
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 160),
  descripcion text,
  dias_estimados integer CHECK (dias_estimados IS NULL OR dias_estimados BETWEEN 1 AND 365),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX laboratorio_tipos_trabajo_nombre_uidx
  ON public.laboratorio_tipos_trabajo (clinica_id, categoria, lower(btrim(nombre)));
CREATE INDEX laboratorio_tipos_trabajo_clinica_estado_idx
  ON public.laboratorio_tipos_trabajo (clinica_id, estado, categoria, nombre);

-- El catálogo de costos es independiente de las órdenes y solo lo leen los
-- administradores, quienes gestionan el catálogo o quienes tienen permiso de costos.
CREATE TABLE public.laboratorio_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  laboratorio_id uuid NOT NULL,
  tipo_trabajo_id uuid NOT NULL,
  costo integer NOT NULL CHECK (costo >= 0),
  moneda text NOT NULL DEFAULT 'CLP' CHECK (moneda = 'CLP'),
  dias_estimados integer CHECK (dias_estimados IS NULL OR dias_estimados BETWEEN 1 AND 365),
  condicion_pago text,
  vigente_desde date NOT NULL DEFAULT current_date,
  vigente_hasta date CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (laboratorio_id, clinica_id)
    REFERENCES public.laboratorios (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (tipo_trabajo_id, clinica_id)
    REFERENCES public.laboratorio_tipos_trabajo (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX laboratorio_precios_vigente_uidx
  ON public.laboratorio_precios (clinica_id, laboratorio_id, tipo_trabajo_id)
  WHERE vigente_hasta IS NULL;
CREATE INDEX laboratorio_precios_historial_idx
  ON public.laboratorio_precios (clinica_id, laboratorio_id, tipo_trabajo_id, vigente_desde DESC);

CREATE TABLE public.plantillas_laboratorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 160),
  categoria text NOT NULL CHECK (categoria IN (
    'protesis_fija', 'protesis_removible', 'implantoprotesis', 'ortodoncia',
    'ferulas_protectores', 'provisionales', 'reparaciones'
  )),
  descripcion text,
  dias_estimados integer CHECK (dias_estimados IS NULL OR dias_estimados BETWEEN 1 AND 365),
  etapas text[] NOT NULL DEFAULT ARRAY[
    'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
  ]::text[],
  fotos_requeridas text[] NOT NULL DEFAULT '{}',
  campos_personalizados jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(campos_personalizados) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, nombre, version),
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT,
  CHECK (cardinality(etapas) BETWEEN 1 AND 7),
  CHECK (etapas <@ ARRAY[
    'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
  ]::text[])
);

CREATE INDEX plantillas_laboratorio_clinica_estado_idx
  ON public.plantillas_laboratorio (clinica_id, estado, categoria, nombre);

CREATE TABLE public.ordenes_laboratorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  folio text NOT NULL,
  paciente_id uuid NOT NULL,
  laboratorio_id uuid,
  tipo_trabajo_id uuid NOT NULL,
  plantilla_id uuid,
  plantilla_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(plantilla_snapshot) = 'object'),
  etapa_actual text NOT NULL DEFAULT 'solicitud' CHECK (etapa_actual IN (
    'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
  )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  solicitud_limitada boolean NOT NULL DEFAULT false,
  pieza_dentaria text,
  color_guia text,
  indicaciones_tecnicas text,
  observaciones text,
  responsable_user_id uuid,
  fecha_solicitud date NOT NULL DEFAULT current_date,
  fecha_estimada_entrega date,
  fecha_entrega timestamptz,
  idempotency_key uuid,
  idempotency_fingerprint text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, folio),
  UNIQUE (clinica_id, idempotency_key),
  CHECK (idempotency_key IS NULL OR idempotency_fingerprint IS NOT NULL),
  FOREIGN KEY (paciente_id, clinica_id)
    REFERENCES public.pacientes (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (laboratorio_id, clinica_id)
    REFERENCES public.laboratorios (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (tipo_trabajo_id, clinica_id)
    REFERENCES public.laboratorio_tipos_trabajo (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (plantilla_id, clinica_id)
    REFERENCES public.plantillas_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, responsable_user_id)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT,
  CHECK (fecha_estimada_entrega IS NULL OR fecha_estimada_entrega >= fecha_solicitud),
  CHECK (fecha_entrega IS NULL OR etapa_actual = 'entrega')
);

CREATE INDEX ordenes_laboratorio_clinica_etapa_idx
  ON public.ordenes_laboratorio (clinica_id, etapa_actual, updated_at DESC);
CREATE INDEX ordenes_laboratorio_clinica_paciente_idx
  ON public.ordenes_laboratorio (clinica_id, paciente_id, created_at DESC);
CREATE INDEX ordenes_laboratorio_clinica_laboratorio_idx
  ON public.ordenes_laboratorio (clinica_id, laboratorio_id, created_at DESC);
CREATE INDEX ordenes_laboratorio_clinica_entrega_idx
  ON public.ordenes_laboratorio (clinica_id, fecha_estimada_entrega)
  WHERE etapa_actual <> 'entrega';

CREATE TABLE public.historial_etapas_laboratorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  orden_id uuid NOT NULL,
  etapa_anterior text CHECK (etapa_anterior IS NULL OR etapa_anterior IN (
    'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
  )),
  etapa text NOT NULL CHECK (etapa IN (
    'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
  )),
  actor_id uuid NOT NULL,
  notas text CHECK (notas IS NULL OR char_length(notas) <= 2000),
  registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid,
  request_hash text,
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (orden_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, actor_id)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX historial_etapas_laboratorio_orden_idx
  ON public.historial_etapas_laboratorio (clinica_id, orden_id, registrado_en DESC);

CREATE TABLE public.garantias_laboratorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  orden_original_id uuid NOT NULL,
  orden_reposicion_id uuid,
  tipo_responsabilidad text CHECK (tipo_responsabilidad IN (
    'laboratorio', 'clinica', 'compartida', 'sin_garantia'
  )),
  estado text NOT NULL DEFAULT 'reclamo' CHECK (estado IN (
    'reclamo', 'aprobada', 'rechazada', 'repuesto'
  )),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 2000),
  porcentaje_costo_clinica numeric(5,2)
    CHECK (porcentaje_costo_clinica IS NULL OR porcentaje_costo_clinica BETWEEN 0 AND 100),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  revisado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, orden_reposicion_id),
  FOREIGN KEY (orden_original_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (orden_reposicion_id, clinica_id)
    REFERENCES public.ordenes_laboratorio (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, created_by)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, revisado_por)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX garantias_laboratorio_clinica_estado_idx
  ON public.garantias_laboratorio (clinica_id, estado, created_at DESC);

CREATE TABLE public.permisos_laboratorio_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  permiso text NOT NULL CHECK (permiso IN (
    'ver_costos_laboratorio', 'pagar_laboratorios', 'gestionar_laboratorios',
    'aprobar_garantias', 'configurar_plantillas'
  )),
  asignado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, user_id, permiso),
  FOREIGN KEY (clinica_id, user_id)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id, asignado_por)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.tiene_permiso_laboratorio(p_permiso text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT p_permiso IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.permisos_laboratorio_aditivos p
      WHERE p.clinica_id = public.clinica_actual()
        AND p.user_id = auth.uid()
        AND p.permiso = p_permiso
    );
$function$;
REVOKE ALL ON FUNCTION public.tiene_permiso_laboratorio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_permiso_laboratorio(text) TO authenticated;

-- Updated-at and order guards run as the caller; only the stage RPC may change
-- stage/version, while assistant edits are limited to notes.
CREATE OR REPLACE FUNCTION public.proteger_orden_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_rol public.app_role := public.rol_en_clinica_actual();
BEGIN
  IF v_user IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para esta orden';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El creador debe ser el usuario autenticado';
    END IF;
    NEW.etapa_actual := 'solicitud';
    NEW.version := 1;
    NEW.fecha_entrega := NULL;
    IF v_rol = 'recepcion'::public.app_role THEN
      NEW.solicitud_limitada := true;
      IF NEW.laboratorio_id IS NOT NULL OR NEW.plantilla_id IS NOT NULL
         OR NEW.responsable_user_id IS NOT NULL OR NEW.fecha_estimada_entrega IS NOT NULL
         OR nullif(btrim(coalesce(NEW.pieza_dentaria, '')), '') IS NOT NULL
         OR nullif(btrim(coalesce(NEW.color_guia, '')), '') IS NOT NULL
         OR nullif(btrim(coalesce(NEW.indicaciones_tecnicas, '')), '') IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La recepción solo puede crear solicitudes limitadas';
      END IF;
    ELSIF v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role, 'asistente'::public.app_role) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin permiso para crear órdenes';
    ELSE
      NEW.solicitud_limitada := false;
    END IF;
    NEW.folio := 'LAB-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
    IF NEW.idempotency_key IS NOT NULL THEN
      NEW.idempotency_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
        'clinica_id', NEW.clinica_id,
        'paciente_id', NEW.paciente_id,
        'laboratorio_id', NEW.laboratorio_id,
        'tipo_trabajo_id', NEW.tipo_trabajo_id,
        'plantilla_id', NEW.plantilla_id,
        'pieza_dentaria', NEW.pieza_dentaria,
        'color_guia', NEW.color_guia,
        'indicaciones_tecnicas', NEW.indicaciones_tecnicas,
        'observaciones', NEW.observaciones
      )::text);
    END IF;
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
     OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.folio IS DISTINCT FROM OLD.folio
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.idempotency_fingerprint IS DISTINCT FROM OLD.idempotency_fingerprint
     OR NEW.solicitud_limitada IS DISTINCT FROM OLD.solicitud_limitada THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pueden cambiar las referencias ni el origen de la orden';
  END IF;

  IF NEW.etapa_actual IS DISTINCT FROM OLD.etapa_actual
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega THEN
    IF current_user <> 'postgres' THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Use la operación de cambio de etapa';
    END IF;
  END IF;

  IF v_rol = 'asistente'::public.app_role THEN
    IF NEW.laboratorio_id IS DISTINCT FROM OLD.laboratorio_id
       OR NEW.tipo_trabajo_id IS DISTINCT FROM OLD.tipo_trabajo_id
       OR NEW.plantilla_id IS DISTINCT FROM OLD.plantilla_id
       OR NEW.plantilla_snapshot IS DISTINCT FROM OLD.plantilla_snapshot
       OR NEW.pieza_dentaria IS DISTINCT FROM OLD.pieza_dentaria
       OR NEW.color_guia IS DISTINCT FROM OLD.color_guia
       OR NEW.indicaciones_tecnicas IS DISTINCT FROM OLD.indicaciones_tecnicas
       OR NEW.responsable_user_id IS DISTINCT FROM OLD.responsable_user_id
       OR NEW.fecha_solicitud IS DISTINCT FROM OLD.fecha_solicitud
       OR NEW.fecha_estimada_entrega IS DISTINCT FROM OLD.fecha_estimada_entrega THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Asistente solo puede editar notas y etapas';
    END IF;
  ELSIF v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin permiso para editar órdenes';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_orden_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_etapa_inicial_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.historial_etapas_laboratorio (
    clinica_id, orden_id, etapa_anterior, etapa, actor_id, notas
  ) VALUES (
    NEW.clinica_id, NEW.id, NULL, 'solicitud', NEW.created_by, 'Solicitud creada'
  );
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.registrar_etapa_inicial_laboratorio() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.registrar_etapa_inicial_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transicionar_orden_laboratorio(
  p_orden_id uuid,
  p_etapa text,
  p_notas text,
  p_idempotency_key uuid,
  p_version_esperada integer
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
  v_orden public.ordenes_laboratorio%ROWTYPE;
  v_existente public.historial_etapas_laboratorio%ROWTYPE;
  v_etapa_anterior text;
  v_hash text;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
     OR v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role, 'asistente'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para cambiar etapas de laboratorio';
  END IF;
  IF p_orden_id IS NULL OR p_idempotency_key IS NULL OR p_version_esperada IS NULL
     OR p_version_esperada < 1 OR p_etapa NOT IN (
       'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
     ) OR char_length(coalesce(p_notas, '')) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Datos de transición inválidos';
  END IF;

  v_hash := pg_catalog.md5(
    p_orden_id::text || '|' || p_etapa || '|' || coalesce(p_notas, '') || '|' || v_actor::text
  );
  SELECT * INTO v_existente
  FROM public.historial_etapas_laboratorio h
  WHERE h.clinica_id = v_clinica AND h.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.orden_id IS DISTINCT FROM p_orden_id
       OR v_existente.etapa IS DISTINCT FROM p_etapa
       OR v_existente.actor_id IS DISTINCT FROM v_actor
       OR v_existente.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia ya usada para otra transición';
    END IF;
    SELECT * INTO v_orden FROM public.ordenes_laboratorio o
    WHERE o.id = p_orden_id AND o.clinica_id = v_clinica;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden no disponible';
    END IF;
    RETURN pg_catalog.to_jsonb(v_orden);
  END IF;

  SELECT * INTO v_orden
  FROM public.ordenes_laboratorio o
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orden no disponible';
  END IF;
  -- Recheck after acquiring the row lock. Concurrent retries may have committed
  -- the first request while this call waited on FOR UPDATE.
  SELECT * INTO v_existente
  FROM public.historial_etapas_laboratorio h
  WHERE h.clinica_id = v_clinica AND h.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.orden_id IS DISTINCT FROM p_orden_id
       OR v_existente.etapa IS DISTINCT FROM p_etapa
       OR v_existente.actor_id IS DISTINCT FROM v_actor
       OR v_existente.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Clave de idempotencia ya usada para otra transición';
    END IF;
    RETURN pg_catalog.to_jsonb(v_orden);
  END IF;
  IF v_orden.version <> p_version_esperada THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'BP12_STALE_VERSION';
  END IF;
  IF v_orden.etapa_actual = 'entrega' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Una orden entregada no se reabre; registre una garantía';
  END IF;
  IF v_orden.etapa_actual = p_etapa THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La orden ya está en esa etapa';
  END IF;
  v_etapa_anterior := v_orden.etapa_actual;

  UPDATE public.ordenes_laboratorio o
  SET etapa_actual = p_etapa,
      version = o.version + 1,
      fecha_entrega = CASE WHEN p_etapa = 'entrega' THEN clock_timestamp() ELSE NULL END
  WHERE o.id = p_orden_id AND o.clinica_id = v_clinica
  RETURNING * INTO v_orden;

  INSERT INTO public.historial_etapas_laboratorio (
    clinica_id, orden_id, etapa_anterior, etapa, actor_id, notas,
    idempotency_key, request_hash
  ) VALUES (
    v_clinica, v_orden.id, v_etapa_anterior, p_etapa, v_actor, nullif(btrim(p_notas), ''),
    p_idempotency_key, v_hash
  );

  RETURN pg_catalog.to_jsonb(v_orden);
END;
$function$;
ALTER FUNCTION public.transicionar_orden_laboratorio(uuid, text, text, uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.transicionar_orden_laboratorio(uuid, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transicionar_orden_laboratorio(uuid, text, text, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.auditar_cambio_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_clinica uuid := nullif(coalesce(v_new, v_old)->>'clinica_id', '')::uuid;
  v_id text := coalesce(v_new, v_old)->>'id';
  v_campos jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_campos := (SELECT coalesce(jsonb_agg(k.key), '[]'::jsonb)
                 FROM jsonb_object_keys(v_new) AS k(key));
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT coalesce(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb)
    INTO v_campos
    FROM jsonb_each(v_new) n
    WHERE v_old->n.key IS DISTINCT FROM n.value;
  ELSE
    v_campos := (SELECT coalesce(jsonb_agg(k.key), '[]'::jsonb)
                 FROM jsonb_object_keys(v_old) AS k(key));
  END IF;

  INSERT INTO public.audit_log (
    clinica_id, user_id, table_name, record_id, action, old_data, new_data, created_at
  ) VALUES (
    v_clinica, auth.uid(), TG_TABLE_NAME, v_id, TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('changed_fields', v_campos) ELSE NULL END,
    jsonb_build_object('record_id', v_id, 'changed_fields', v_campos),
    clock_timestamp()
  );
  RETURN coalesce(NEW, OLD);
END;
$function$;
ALTER FUNCTION public.auditar_cambio_laboratorio() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auditar_cambio_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_referencia_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    IF current_user <> 'postgres' THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para esta clínica';
    END IF;
    IF TG_OP = 'INSERT' THEN NEW.created_at := clock_timestamp(); END IF;
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
  END IF;
  IF public.clinica_actual() IS DISTINCT FROM NEW.clinica_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para esta clínica';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pueden cambiar el origen ni la clínica';
    END IF;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_referencia_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_precio_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.clinica_actual() IS DISTINCT FROM NEW.clinica_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para este tarifario';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
       OR NEW.laboratorio_id IS DISTINCT FROM OLD.laboratorio_id
       OR NEW.tipo_trabajo_id IS DISTINCT FROM OLD.tipo_trabajo_id
       OR NEW.costo IS DISTINCT FROM OLD.costo OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.dias_estimados IS DISTINCT FROM OLD.dias_estimados
       OR NEW.condicion_pago IS DISTINCT FROM OLD.condicion_pago
       OR NEW.vigente_desde IS DISTINCT FROM OLD.vigente_desde
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR OLD.vigente_hasta IS NOT NULL
       OR NEW.vigente_hasta IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El historial de precios solo permite cerrar una vigencia abierta';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_precio_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_garantia_laboratorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_rol public.app_role := public.rol_en_clinica_actual();
  v_etapa text;
BEGIN
  IF auth.uid() IS NULL OR public.clinica_actual() IS DISTINCT FROM NEW.clinica_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para esta garantía';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF v_rol NOT IN ('admin'::public.app_role, 'dentista'::public.app_role) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo admin o dentista puede iniciar un reclamo';
    END IF;
    SELECT o.etapa_actual INTO v_etapa FROM public.ordenes_laboratorio o
    WHERE o.id = NEW.orden_original_id AND o.clinica_id = NEW.clinica_id;
    IF v_etapa IS DISTINCT FROM 'entrega' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La garantía requiere una orden entregada';
    END IF;
    NEW.created_by := auth.uid();
    NEW.estado := 'reclamo';
    NEW.orden_reposicion_id := NULL;
    NEW.tipo_responsabilidad := NULL;
    NEW.porcentaje_costo_clinica := NULL;
    NEW.revisado_por := NULL;
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
       OR NEW.orden_original_id IS DISTINCT FROM OLD.orden_original_id
       OR NEW.motivo IS DISTINCT FROM OLD.motivo
       OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede cambiar el origen de la garantía';
    END IF;
    IF NEW.revisado_por IS DISTINCT FROM OLD.revisado_por THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El revisor se deriva del usuario autenticado';
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado
       OR NEW.tipo_responsabilidad IS DISTINCT FROM OLD.tipo_responsabilidad
       OR NEW.porcentaje_costo_clinica IS DISTINCT FROM OLD.porcentaje_costo_clinica
       OR NEW.orden_reposicion_id IS DISTINCT FROM OLD.orden_reposicion_id THEN
      IF v_rol <> 'admin'::public.app_role
         AND NOT public.tiene_permiso_laboratorio('aprobar_garantias') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin permiso para resolver garantías';
      END IF;
      IF NOT (
        (OLD.estado = 'reclamo' AND NEW.estado IN ('aprobada', 'rechazada'))
        OR (OLD.estado = 'aprobada' AND NEW.estado = 'repuesto'
            AND NEW.orden_reposicion_id IS NOT NULL)
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'La resolución de una garantía no se modifica';
      END IF;
      IF NEW.estado = 'aprobada' AND NEW.tipo_responsabilidad IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La aprobación requiere asignar responsabilidad';
      END IF;
      IF NEW.tipo_responsabilidad = 'compartida'
         AND NEW.porcentaje_costo_clinica IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La responsabilidad compartida requiere porcentaje';
      END IF;
      NEW.revisado_por := auth.uid();
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.proteger_garantia_laboratorio() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER laboratorio_ordenes_guard BEFORE INSERT OR UPDATE ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_orden_laboratorio();
CREATE TRIGGER laboratorio_orden_inicial_historial AFTER INSERT ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.registrar_etapa_inicial_laboratorio();

CREATE TRIGGER laboratorio_referencias_guard BEFORE INSERT OR UPDATE ON public.laboratorios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_referencia_laboratorio();
CREATE TRIGGER laboratorio_tipos_guard BEFORE INSERT OR UPDATE ON public.laboratorio_tipos_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.proteger_referencia_laboratorio();
CREATE TRIGGER laboratorio_precios_guard BEFORE INSERT OR UPDATE ON public.laboratorio_precios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_precio_laboratorio();
CREATE TRIGGER laboratorio_plantillas_guard BEFORE INSERT OR UPDATE ON public.plantillas_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_referencia_laboratorio();
CREATE TRIGGER laboratorio_garantias_guard BEFORE INSERT OR UPDATE ON public.garantias_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.proteger_garantia_laboratorio();

CREATE TRIGGER laboratorio_laboratorios_audit AFTER INSERT OR UPDATE ON public.laboratorios
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_tipos_audit AFTER INSERT OR UPDATE ON public.laboratorio_tipos_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_precios_audit AFTER INSERT OR UPDATE ON public.laboratorio_precios
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_plantillas_audit AFTER INSERT OR UPDATE ON public.plantillas_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_ordenes_audit AFTER INSERT OR UPDATE ON public.ordenes_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_garantias_audit AFTER INSERT OR UPDATE ON public.garantias_laboratorio
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();
CREATE TRIGGER laboratorio_permisos_audit AFTER INSERT OR DELETE ON public.permisos_laboratorio_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_laboratorio();

ALTER TABLE public.laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_tipos_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_etapas_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garantias_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_laboratorio_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY laboratorios_select_clinica ON public.laboratorios FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY laboratorios_insert_gestion ON public.laboratorios FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));
CREATE POLICY laboratorios_update_gestion ON public.laboratorios FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));

CREATE POLICY laboratorio_tipos_select_clinica ON public.laboratorio_tipos_trabajo FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY laboratorio_tipos_insert_gestion ON public.laboratorio_tipos_trabajo FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));
CREATE POLICY laboratorio_tipos_update_gestion ON public.laboratorio_tipos_trabajo FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));

CREATE POLICY laboratorio_precios_select_privado ON public.laboratorio_precios FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role
      OR public.tiene_permiso_laboratorio('ver_costos_laboratorio')
      OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));
CREATE POLICY laboratorio_precios_insert_gestion ON public.laboratorio_precios FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));
CREATE POLICY laboratorio_precios_close_gestion ON public.laboratorio_precios FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('gestionar_laboratorios')));

CREATE POLICY plantillas_select_clinica ON public.plantillas_laboratorio FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY plantillas_insert_admin ON public.plantillas_laboratorio FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('configurar_plantillas')));
CREATE POLICY plantillas_update_admin ON public.plantillas_laboratorio FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('configurar_plantillas')))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('configurar_plantillas')));

CREATE POLICY ordenes_laboratorio_select_clinica ON public.ordenes_laboratorio FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY ordenes_laboratorio_insert_clinica ON public.ordenes_laboratorio FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY ordenes_laboratorio_update_clinica ON public.ordenes_laboratorio FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente']::public.app_role[]))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente']::public.app_role[]));

CREATE POLICY historial_etapas_select_clinica ON public.historial_etapas_laboratorio FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));

CREATE POLICY garantias_select_clinica ON public.garantias_laboratorio FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY garantias_insert_clinica ON public.garantias_laboratorio FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[]));
CREATE POLICY garantias_update_aprobacion ON public.garantias_laboratorio FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('aprobar_garantias')))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND (public.rol_en_clinica_actual() = 'admin'::public.app_role OR public.tiene_permiso_laboratorio('aprobar_garantias')));

CREATE POLICY permisos_laboratorio_select_propios ON public.permisos_laboratorio_aditivos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND (user_id = auth.uid() OR public.rol_en_clinica_actual() = 'admin'::public.app_role));
CREATE POLICY permisos_laboratorio_insert_admin ON public.permisos_laboratorio_aditivos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = 'admin'::public.app_role
    AND asignado_por = auth.uid());
CREATE POLICY permisos_laboratorio_delete_admin ON public.permisos_laboratorio_aditivos FOR DELETE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.rol_en_clinica_actual() = 'admin'::public.app_role);

REVOKE ALL ON public.laboratorios, public.laboratorio_tipos_trabajo,
  public.laboratorio_precios, public.plantillas_laboratorio,
  public.ordenes_laboratorio, public.historial_etapas_laboratorio,
  public.garantias_laboratorio, public.permisos_laboratorio_aditivos
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.laboratorios, public.laboratorio_tipos_trabajo,
  public.plantillas_laboratorio, public.ordenes_laboratorio,
  public.historial_etapas_laboratorio, public.garantias_laboratorio
  TO authenticated;
GRANT INSERT, UPDATE ON public.laboratorios, public.laboratorio_tipos_trabajo,
  public.plantillas_laboratorio TO authenticated;
GRANT SELECT, INSERT ON public.laboratorio_precios TO authenticated;
GRANT UPDATE (vigente_hasta) ON public.laboratorio_precios TO authenticated;
GRANT INSERT, UPDATE ON public.ordenes_laboratorio TO authenticated;
GRANT INSERT, UPDATE ON public.garantias_laboratorio TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.permisos_laboratorio_aditivos TO authenticated;

DO $publication$
DECLARE
  v_tabla text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'La publicación supabase_realtime no existe';
  END IF;
  FOREACH v_tabla IN ARRAY ARRAY[
    'laboratorios', 'laboratorio_tipos_trabajo', 'laboratorio_precios',
    'plantillas_laboratorio', 'ordenes_laboratorio',
    'historial_etapas_laboratorio', 'garantias_laboratorio',
    'permisos_laboratorio_aditivos'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabla
    ) THEN
      EXECUTE pg_catalog.format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
    END IF;
  END LOOP;
END;
$publication$;

COMMENT ON TABLE public.laboratorio_precios IS
  'BP12: historial privado de costos pactados por laboratorio y tipo de trabajo.';
COMMENT ON TABLE public.ordenes_laboratorio IS
  'BP12: orden clínica sincronizada. No contiene costo del laboratorio ni margen.';
COMMENT ON TABLE public.historial_etapas_laboratorio IS
  'BP12: historial append-only de etapas, actor, fecha y notas.';
COMMENT ON FUNCTION public.transicionar_orden_laboratorio(uuid, text, text, uuid, integer) IS
  'BP12: transición atómica e idempotente; deriva actor/tenant de sesión y rechaza versiones obsoletas.';
