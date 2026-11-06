-- BP14 Urgencias GES core.
-- Additive only: reception intake is separated from clinical triage/case data.

-- BP06 timeline link for a confirmed clinical case. Preserve existing categories.
ALTER TABLE public.timeline_paciente DROP CONSTRAINT IF EXISTS timeline_paciente_tipo_check;
ALTER TABLE public.timeline_paciente ADD CONSTRAINT timeline_paciente_tipo_check
  CHECK (tipo IN ('cita','evolucion','receta','consentimiento','cambio_estado',
    'cambio_doctor','pago','adjunto','presupuesto','llamada','email','admin','derivacion','urgencia_ges')) NOT VALID;
DROP POLICY IF EXISTS timeline_bp06_select ON public.timeline_paciente;
CREATE POLICY timeline_bp06_select ON public.timeline_paciente FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id)
    AND (tipo <> 'urgencia_ges'
      OR public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])));

CREATE TABLE public.urgencias_ges_patologias (
  id text PRIMARY KEY CHECK (id IN (
    'pulpitis',
    'absceso_odontogenico_localizado',
    'absceso_espacios_bucomaxilofaciales',
    'pericoronaritis_aguda',
    'flegmones_orofaringeos',
    'gingivitis_ulcero_necrotizante',
    'complicaciones_post_exodoncia',
    'traumatismo_dentoalveolar'
  )),
  numero smallint NOT NULL UNIQUE CHECK (numero BETWEEN 1 AND 8),
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('dolor', 'infeccion', 'postquirurgico', 'trauma')),
  version smallint NOT NULL DEFAULT 1 CHECK (version > 0),
  fuente text NOT NULL DEFAULT 'MINSAL — Orientación Técnica Programa GES Odontológico',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO public.urgencias_ges_patologias (id, numero, nombre, categoria)
VALUES
  ('pulpitis', 1, 'Pulpitis', 'dolor'),
  ('absceso_odontogenico_localizado', 2, 'Absceso submucoso, subperióstico o apical de origen odontogénico', 'infeccion'),
  ('absceso_espacios_bucomaxilofaciales', 3, 'Absceso de espacios anatómicos bucomaxilofaciales', 'infeccion'),
  ('pericoronaritis_aguda', 4, 'Pericoronaritis aguda', 'infeccion'),
  ('flegmones_orofaringeos', 5, 'Flegmones orofaríngeos de origen odontogénico', 'infeccion'),
  ('gingivitis_ulcero_necrotizante', 6, 'Gingivitis úlcero-necrotizante', 'infeccion'),
  ('complicaciones_post_exodoncia', 7, 'Complicaciones post-exodoncia', 'postquirurgico'),
  ('traumatismo_dentoalveolar', 8, 'Traumatismo dentoalveolar', 'trauma')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.urgencias_ges_configuracion_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  patologia_id text NOT NULL REFERENCES public.urgencias_ges_patologias (id) ON DELETE RESTRICT,
  codigo_fonasa text,
  descripcion_convenio text,
  arancel_pactado numeric(12, 2) CHECK (arancel_pactado IS NULL OR arancel_pactado >= 0),
  centro_costos text,
  previsiones_convenio text[] NOT NULL DEFAULT '{}'::text[],
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (clinica_id, patologia_id),
  UNIQUE (id, clinica_id)
);

CREATE TABLE public.urgencias_ges_ingresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  paciente_id uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE RESTRICT,
  hora_llegada_local timestamptz,
  estado_cola text NOT NULL DEFAULT 'en_espera'
    CHECK (estado_cola IN ('en_espera', 'en_atencion', 'finalizada', 'rechazada', 'derivada')),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, clinica_id)
);

CREATE INDEX urgencias_ges_ingresos_clinica_cola_idx
  ON public.urgencias_ges_ingresos (clinica_id, estado_cola, created_at);
CREATE INDEX urgencias_ges_ingresos_paciente_idx
  ON public.urgencias_ges_ingresos (paciente_id, created_at DESC);

CREATE TABLE public.urgencias_ges_triage (
  id uuid PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  severidad text NOT NULL CHECK (severidad IN ('leve', 'moderada', 'severa')),
  presion_sistolica integer CHECK (presion_sistolica IS NULL OR presion_sistolica > 0),
  presion_diastolica integer CHECK (presion_diastolica IS NULL OR presion_diastolica > 0),
  frecuencia_cardiaca integer CHECK (frecuencia_cardiaca IS NULL OR frecuencia_cardiaca > 0),
  saturacion_oxigeno numeric(5, 2) CHECK (saturacion_oxigeno IS NULL OR saturacion_oxigeno BETWEEN 0 AND 100),
  temperatura_c numeric(4, 1) CHECK (temperatura_c IS NULL OR temperatura_c > 0),
  eva smallint CHECK (eva IS NULL OR eva BETWEEN 0 AND 10),
  patologia_sospechada_id text REFERENCES public.urgencias_ges_patologias (id) ON DELETE RESTRICT,
  nota_triage text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, clinica_id),
  CONSTRAINT urgencias_ges_triage_ingreso_clinica_fk
    FOREIGN KEY (id, clinica_id)
    REFERENCES public.urgencias_ges_ingresos (id, clinica_id) ON DELETE RESTRICT,
  CONSTRAINT urgencias_ges_triage_presion_pareada_check
    CHECK ((presion_sistolica IS NULL) = (presion_diastolica IS NULL))
);

CREATE TABLE public.urgencias_ges (
  id uuid PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  folio text NOT NULL UNIQUE,
  patologia_id text NOT NULL REFERENCES public.urgencias_ges_patologias (id) ON DELETE RESTRICT,
  codigo_fonasa text,
  arancel_pactado_snapshot numeric(12, 2) CHECK (arancel_pactado_snapshot IS NULL OR arancel_pactado_snapshot >= 0),
  descripcion_convenio_snapshot text,
  previsiones_convenio_snapshot text[] NOT NULL DEFAULT '{}'::text[],
  diagnostico_clinico text NOT NULL,
  diagnostico_cie10 text,
  piezas_afectadas text[] NOT NULL DEFAULT '{}'::text[],
  tratamiento_realizado jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tratamiento_realizado) = 'array'),
  requiere_derivacion boolean NOT NULL DEFAULT false,
  centro_derivacion text,
  motivo_derivacion text,
  indicaciones_post text,
  control_programado timestamptz,
  profesional_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'en_atencion' CHECK (estado IN ('en_atencion', 'cerrada', 'rechazada', 'derivada')),
  fecha_hora_atencion timestamptz NOT NULL DEFAULT clock_timestamp(),
  fecha_hora_fin timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, clinica_id),
  CONSTRAINT urgencias_ges_ingreso_clinica_fk
    FOREIGN KEY (id, clinica_id)
    REFERENCES public.urgencias_ges_ingresos (id, clinica_id) ON DELETE RESTRICT,
  CONSTRAINT urgencias_ges_triage_clinica_fk
    FOREIGN KEY (id, clinica_id)
    REFERENCES public.urgencias_ges_triage (id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX urgencias_ges_clinica_estado_idx
  ON public.urgencias_ges (clinica_id, estado, fecha_hora_atencion DESC);
CREATE INDEX urgencias_ges_patologia_fecha_idx
  ON public.urgencias_ges (patologia_id, fecha_hora_atencion DESC);

CREATE TABLE public.urgencias_ges_enmiendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  ingreso_id uuid NOT NULL,
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 10 AND 2000),
  detalle jsonb NOT NULL CHECK (jsonb_typeof(detalle) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT urgencias_ges_enmienda_ficha_clinica_fk
    FOREIGN KEY (ingreso_id, clinica_id)
    REFERENCES public.urgencias_ges (id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX urgencias_ges_enmiendas_ingreso_fecha_idx
  ON public.urgencias_ges_enmiendas (ingreso_id, created_at);

CREATE TABLE public.urgencias_ges_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  ingreso_id uuid,
  configuracion_id uuid,
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  evento_tipo text NOT NULL CHECK (evento_tipo IN (
    'ingreso_registrado', 'cola_actualizada', 'triage_registrado', 'triage_actualizado',
    'ficha_creada', 'ficha_actualizada', 'ficha_cerrada', 'ficha_rechazada',
    'ficha_derivada', 'enmienda_agregada', 'configuracion_creada', 'configuracion_actualizada'
  )),
  datos jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((ingreso_id IS NULL) <> (configuracion_id IS NULL)),
  CONSTRAINT urgencias_ges_evento_ingreso_clinica_fk
    FOREIGN KEY (ingreso_id, clinica_id)
    REFERENCES public.urgencias_ges_ingresos (id, clinica_id) ON DELETE RESTRICT,
  CONSTRAINT urgencias_ges_evento_config_clinica_fk
    FOREIGN KEY (configuracion_id, clinica_id)
    REFERENCES public.urgencias_ges_configuracion_clinica (id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX urgencias_ges_eventos_ingreso_fecha_idx
  ON public.urgencias_ges_eventos (clinica_id, ingreso_id, created_at);
CREATE INDEX urgencias_ges_eventos_config_fecha_idx
  ON public.urgencias_ges_eventos (clinica_id, configuracion_id, created_at)
  WHERE configuracion_id IS NOT NULL;

CREATE SEQUENCE public.urgencias_ges_folio_seq;
REVOKE ALL ON SEQUENCE public.urgencias_ges_folio_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE public.urgencias_ges_folio_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.bp14_guard_ingreso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role public.app_role := public.rol_en_clinica_actual();
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Clínica de urgencia no autorizada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = NEW.paciente_id AND p.clinica_id = NEW.clinica_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Paciente no encontrado en la clínica activa';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_role IS NULL OR v_role <> ALL(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin permiso para registrar llegadas';
    END IF;
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
    NEW.estado_cola := 'en_espera';
  ELSE
    IF OLD.id IS DISTINCT FROM NEW.id
       OR OLD.clinica_id IS DISTINCT FROM NEW.clinica_id
       OR OLD.paciente_id IS DISTINCT FROM NEW.paciente_id
       OR OLD.hora_llegada_local IS DISTINCT FROM NEW.hora_llegada_local
       OR OLD.created_by IS DISTINCT FROM NEW.created_by
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede alterar el origen del ingreso';
    END IF;
    IF v_role IS NULL OR v_role <> ALL(ARRAY['admin','dentista']::public.app_role[]) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin permiso para cambiar el estado de la cola';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_guard_ingreso() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_guard_triage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role public.app_role := public.rol_en_clinica_actual();
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
     OR v_role IS NULL OR v_role <> ALL(ARRAY['admin','dentista','asistente']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Triage no autorizado';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
  ELSE
    IF OLD.id IS DISTINCT FROM NEW.id OR OLD.clinica_id IS DISTINCT FROM NEW.clinica_id
       OR OLD.created_by IS DISTINCT FROM NEW.created_by OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede alterar el origen del triage';
    END IF;
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Triage desactualizado; recargue antes de guardar';
    END IF;
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_guard_triage() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_guard_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role public.app_role := public.rol_en_clinica_actual();
  v_codigo text;
  v_arancel numeric(12, 2);
  v_descripcion text;
  v_previsiones text[];
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
     OR v_role IS NULL OR v_role <> ALL(ARRAY['admin','dentista']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ficha clínica de urgencia no autorizada';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.folio := 'URG-' || pg_catalog.to_char(clock_timestamp(), 'YYYY') || '-'
      || pg_catalog.lpad(pg_catalog.nextval('public.urgencias_ges_folio_seq')::text, 8, '0');
    NEW.estado := 'en_atencion';
    NEW.profesional_id := auth.uid();
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.created_at := clock_timestamp();
    NEW.updated_at := NEW.created_at;
    NEW.fecha_hora_atencion := NEW.created_at;
    NEW.fecha_hora_fin := NULL;
    SELECT c.codigo_fonasa, c.arancel_pactado, c.descripcion_convenio, c.previsiones_convenio
    INTO v_codigo, v_arancel, v_descripcion, v_previsiones
    FROM public.urgencias_ges_configuracion_clinica c
    WHERE c.clinica_id = NEW.clinica_id AND c.patologia_id = NEW.patologia_id;
    NEW.codigo_fonasa := v_codigo;
    NEW.arancel_pactado_snapshot := v_arancel;
    NEW.descripcion_convenio_snapshot := v_descripcion;
    NEW.previsiones_convenio_snapshot := coalesce(v_previsiones, '{}'::text[]);
  ELSE
    IF OLD.estado <> 'en_atencion' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Ficha cerrada: agregue una enmienda para corregirla';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id OR OLD.clinica_id IS DISTINCT FROM NEW.clinica_id
       OR OLD.folio IS DISTINCT FROM NEW.folio OR OLD.profesional_id IS DISTINCT FROM NEW.profesional_id
       OR OLD.created_by IS DISTINCT FROM NEW.created_by OR OLD.created_at IS DISTINCT FROM NEW.created_at
       OR OLD.fecha_hora_atencion IS DISTINCT FROM NEW.fecha_hora_atencion THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede alterar el origen de la ficha';
    END IF;
    IF OLD.patologia_id IS DISTINCT FROM NEW.patologia_id THEN
      SELECT c.codigo_fonasa, c.arancel_pactado, c.descripcion_convenio, c.previsiones_convenio
      INTO v_codigo, v_arancel, v_descripcion, v_previsiones
      FROM public.urgencias_ges_configuracion_clinica c
      WHERE c.clinica_id = NEW.clinica_id AND c.patologia_id = NEW.patologia_id;
      NEW.codigo_fonasa := v_codigo;
      NEW.arancel_pactado_snapshot := v_arancel;
      NEW.descripcion_convenio_snapshot := v_descripcion;
      NEW.previsiones_convenio_snapshot := coalesce(v_previsiones, '{}'::text[]);
    ELSE
      NEW.codigo_fonasa := OLD.codigo_fonasa;
      NEW.arancel_pactado_snapshot := OLD.arancel_pactado_snapshot;
      NEW.descripcion_convenio_snapshot := OLD.descripcion_convenio_snapshot;
      NEW.previsiones_convenio_snapshot := OLD.previsiones_convenio_snapshot;
    END IF;
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Ficha desactualizada; recargue antes de guardar';
    END IF;
    IF NEW.estado NOT IN ('en_atencion', 'cerrada', 'rechazada', 'derivada') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estado de urgencia inválido';
    END IF;
    NEW.fecha_hora_fin := CASE WHEN NEW.estado = 'en_atencion' THEN NULL ELSE clock_timestamp() END;
    NEW.updated_by := auth.uid();
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_guard_ficha() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_guard_configuracion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
     OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo administración puede configurar convenios GES';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := clock_timestamp();
  ELSE
    IF OLD.id IS DISTINCT FROM NEW.id OR OLD.clinica_id IS DISTINCT FROM NEW.clinica_id
       OR OLD.patologia_id IS DISTINCT FROM NEW.patologia_id
       OR OLD.created_by IS DISTINCT FROM NEW.created_by OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede alterar el origen del convenio';
    END IF;
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Configuración desactualizada; recargue antes de guardar';
    END IF;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_guard_configuracion() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_guard_enmienda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_estado text;
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
     OR public.rol_en_clinica_actual() IS NULL
     OR public.rol_en_clinica_actual() <> ALL(ARRAY['admin','dentista']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Enmienda clínica no autorizada';
  END IF;
  SELECT u.estado INTO v_estado
  FROM public.urgencias_ges u
  WHERE u.id = NEW.ingreso_id AND u.clinica_id = NEW.clinica_id;
  IF v_estado IS NULL OR v_estado NOT IN ('cerrada','rechazada','derivada') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Solo se pueden enmendar fichas finalizadas';
  END IF;
  NEW.created_by := auth.uid();
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_guard_enmienda() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_sync_estado_cola()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_estado text;
BEGIN
  IF auth.uid() IS NULL OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede sincronizar la cola';
  END IF;
  v_estado := CASE NEW.estado
    WHEN 'en_atencion' THEN 'en_atencion'
    WHEN 'rechazada' THEN 'rechazada'
    WHEN 'derivada' THEN 'derivada'
    ELSE 'finalizada'
  END;
  UPDATE public.urgencias_ges_ingresos i
  SET estado_cola = v_estado
  WHERE i.id = NEW.id AND i.clinica_id = NEW.clinica_id AND i.estado_cola IS DISTINCT FROM v_estado;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_sync_estado_cola() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bp14_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_nuevo jsonb := pg_catalog.to_jsonb(NEW);
  v_anterior jsonb;
  v_clinica uuid;
  v_ingreso uuid;
  v_configuracion uuid;
  v_tipo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede auditar una acción sin usuario autenticado';
  END IF;
  IF TG_OP = 'UPDATE' THEN v_anterior := pg_catalog.to_jsonb(OLD); END IF;
  v_clinica := (v_nuevo ->> 'clinica_id')::uuid;
  IF v_clinica IS DISTINCT FROM public.clinica_actual() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se puede auditar una clínica distinta a la activa';
  END IF;

  IF TG_TABLE_NAME = 'urgencias_ges_configuracion_clinica' THEN
    v_configuracion := (v_nuevo ->> 'id')::uuid;
    v_tipo := CASE WHEN TG_OP = 'INSERT' THEN 'configuracion_creada' ELSE 'configuracion_actualizada' END;
  ELSE
    v_ingreso := CASE
      WHEN TG_TABLE_NAME = 'urgencias_ges_enmiendas' THEN (v_nuevo ->> 'ingreso_id')::uuid
      ELSE (v_nuevo ->> 'id')::uuid
    END;
    v_tipo := CASE TG_TABLE_NAME
      WHEN 'urgencias_ges_ingresos' THEN CASE WHEN TG_OP = 'INSERT' THEN 'ingreso_registrado' ELSE 'cola_actualizada' END
      WHEN 'urgencias_ges_triage' THEN CASE WHEN TG_OP = 'INSERT' THEN 'triage_registrado' ELSE 'triage_actualizado' END
      WHEN 'urgencias_ges' THEN CASE
        WHEN TG_OP = 'INSERT' THEN 'ficha_creada'
        WHEN v_anterior ->> 'estado' IS DISTINCT FROM v_nuevo ->> 'estado'
          AND v_nuevo ->> 'estado' = 'cerrada' THEN 'ficha_cerrada'
        WHEN v_anterior ->> 'estado' IS DISTINCT FROM v_nuevo ->> 'estado'
          AND v_nuevo ->> 'estado' = 'rechazada' THEN 'ficha_rechazada'
        WHEN v_anterior ->> 'estado' IS DISTINCT FROM v_nuevo ->> 'estado'
          AND v_nuevo ->> 'estado' = 'derivada' THEN 'ficha_derivada'
        ELSE 'ficha_actualizada'
      END
      WHEN 'urgencias_ges_enmiendas' THEN 'enmienda_agregada'
      ELSE NULL
    END;
  END IF;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de evento GES desconocido';
  END IF;

  INSERT INTO public.urgencias_ges_eventos (
    clinica_id, ingreso_id, configuracion_id, actor_user_id, evento_tipo, datos
  ) VALUES (
    v_clinica, v_ingreso, v_configuracion, auth.uid(), v_tipo,
    CASE WHEN v_anterior IS NULL
      THEN pg_catalog.jsonb_build_object('despues', v_nuevo)
      ELSE pg_catalog.jsonb_build_object('antes', v_anterior, 'despues', v_nuevo)
    END
  );
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.bp14_registrar_evento() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER bp14_guard_ingreso
  BEFORE INSERT OR UPDATE ON public.urgencias_ges_ingresos
  FOR EACH ROW EXECUTE FUNCTION public.bp14_guard_ingreso();
CREATE TRIGGER bp14_guard_triage
  BEFORE INSERT OR UPDATE ON public.urgencias_ges_triage
  FOR EACH ROW EXECUTE FUNCTION public.bp14_guard_triage();
CREATE TRIGGER bp14_guard_ficha
  BEFORE INSERT OR UPDATE ON public.urgencias_ges
  FOR EACH ROW EXECUTE FUNCTION public.bp14_guard_ficha();
CREATE TRIGGER bp14_guard_configuracion
  BEFORE INSERT OR UPDATE ON public.urgencias_ges_configuracion_clinica
  FOR EACH ROW EXECUTE FUNCTION public.bp14_guard_configuracion();
CREATE TRIGGER bp14_guard_enmienda
  BEFORE INSERT ON public.urgencias_ges_enmiendas
  FOR EACH ROW EXECUTE FUNCTION public.bp14_guard_enmienda();

CREATE TRIGGER bp14_sync_cola
  AFTER INSERT OR UPDATE OF estado ON public.urgencias_ges
  FOR EACH ROW EXECUTE FUNCTION public.bp14_sync_estado_cola();

CREATE TRIGGER bp14_audit_ingreso
  AFTER INSERT OR UPDATE ON public.urgencias_ges_ingresos
  FOR EACH ROW EXECUTE FUNCTION public.bp14_registrar_evento();
CREATE TRIGGER bp14_audit_triage
  AFTER INSERT OR UPDATE ON public.urgencias_ges_triage
  FOR EACH ROW EXECUTE FUNCTION public.bp14_registrar_evento();
CREATE TRIGGER bp14_audit_ficha
  AFTER INSERT OR UPDATE ON public.urgencias_ges
  FOR EACH ROW EXECUTE FUNCTION public.bp14_registrar_evento();
CREATE TRIGGER bp14_audit_enmienda
  AFTER INSERT ON public.urgencias_ges_enmiendas
  FOR EACH ROW EXECUTE FUNCTION public.bp14_registrar_evento();
CREATE TRIGGER bp14_audit_configuracion
  AFTER INSERT OR UPDATE ON public.urgencias_ges_configuracion_clinica
  FOR EACH ROW EXECUTE FUNCTION public.bp14_registrar_evento();

ALTER TABLE public.urgencias_ges_patologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges_configuracion_clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges_ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges_triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges_enmiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgencias_ges_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY urgencias_ges_patologias_select_authenticated
  ON public.urgencias_ges_patologias FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY urgencias_ges_config_select_clinica
  ON public.urgencias_ges_configuracion_clinica FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]));
CREATE POLICY urgencias_ges_config_insert_admin
  ON public.urgencias_ges_configuracion_clinica FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = 'admin'::public.app_role);
CREATE POLICY urgencias_ges_config_update_admin
  ON public.urgencias_ges_configuracion_clinica FOR UPDATE TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = 'admin'::public.app_role)
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = 'admin'::public.app_role);

CREATE POLICY urgencias_ges_ingresos_select_clinica
  ON public.urgencias_ges_ingresos FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]));
CREATE POLICY urgencias_ges_ingresos_insert_clinica
  ON public.urgencias_ges_ingresos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = urgencias_ges_ingresos.paciente_id
        AND p.clinica_id = urgencias_ges_ingresos.clinica_id
    ));

CREATE POLICY urgencias_ges_triage_select_clinica
  ON public.urgencias_ges_triage FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente']::public.app_role[]));
CREATE POLICY urgencias_ges_triage_insert_clinica
  ON public.urgencias_ges_triage FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.urgencias_ges_ingresos i
      WHERE i.id = urgencias_ges_triage.id AND i.clinica_id = urgencias_ges_triage.clinica_id
        AND i.estado_cola IN ('en_espera','en_atencion')
    ));
CREATE POLICY urgencias_ges_triage_update_clinica
  ON public.urgencias_ges_triage FOR UPDATE TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.urgencias_ges_ingresos i
      WHERE i.id = urgencias_ges_triage.id AND i.clinica_id = urgencias_ges_triage.clinica_id
        AND i.estado_cola IN ('en_espera','en_atencion')
    ))
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista','asistente']::public.app_role[]));

CREATE POLICY urgencias_ges_select_clinica
  ON public.urgencias_ges FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]));
CREATE POLICY urgencias_ges_insert_clinica
  ON public.urgencias_ges FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.urgencias_ges_ingresos i
      WHERE i.id = urgencias_ges.id AND i.clinica_id = urgencias_ges.clinica_id
    )
    AND EXISTS (
      SELECT 1 FROM public.urgencias_ges_triage t
      WHERE t.id = urgencias_ges.id AND t.clinica_id = urgencias_ges.clinica_id
    ));
CREATE POLICY urgencias_ges_update_abierta
  ON public.urgencias_ges FOR UPDATE TO authenticated
  USING (clinica_id = (select public.clinica_actual()) AND estado = 'en_atencion'
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]))
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND estado IN ('en_atencion','cerrada','rechazada','derivada')
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]));

CREATE POLICY urgencias_ges_enmiendas_select_clinica
  ON public.urgencias_ges_enmiendas FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]));
CREATE POLICY urgencias_ges_enmiendas_insert_cerrada
  ON public.urgencias_ges_enmiendas FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.urgencias_ges u
      WHERE u.id = urgencias_ges_enmiendas.ingreso_id AND u.clinica_id = urgencias_ges_enmiendas.clinica_id
        AND u.estado IN ('cerrada','rechazada','derivada')
    ));

CREATE POLICY urgencias_ges_eventos_select_clinica
  ON public.urgencias_ges_eventos FOR SELECT TO authenticated
  USING (clinica_id = (select public.clinica_actual())
    AND (select public.rol_en_clinica_actual()) = ANY(ARRAY['admin','dentista']::public.app_role[]));

REVOKE ALL ON public.urgencias_ges_patologias,
  public.urgencias_ges_configuracion_clinica,
  public.urgencias_ges_ingresos,
  public.urgencias_ges_triage,
  public.urgencias_ges,
  public.urgencias_ges_enmiendas,
  public.urgencias_ges_eventos
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.urgencias_ges_patologias TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.urgencias_ges_configuracion_clinica TO authenticated;
GRANT SELECT, INSERT ON public.urgencias_ges_ingresos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.urgencias_ges_triage TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.urgencias_ges TO authenticated;
GRANT SELECT, INSERT ON public.urgencias_ges_enmiendas TO authenticated;
GRANT SELECT ON public.urgencias_ges_eventos TO authenticated;

DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.urgencias_ges_configuracion_clinica,
    public.urgencias_ges_ingresos,
    public.urgencias_ges_triage,
    public.urgencias_ges,
    public.urgencias_ges_enmiendas,
    public.urgencias_ges_eventos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$realtime$;
