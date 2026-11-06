-- BP10: flujo de esterilización sincronizado, multi-clínica y auditable.
-- Los parámetros del blueprint se inicializan inactivos hasta revisión local
-- de fabricante/protocolo; esta migración no declara cumplimiento normativo.

CREATE TABLE IF NOT EXISTS public.esterilizacion_programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  codigo text NOT NULL CHECK (codigo IN ('estandar_121', 'rapido_134', 'plasticos_121', 'secado', 'bowie_dick')),
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 3 AND 120),
  categoria text NOT NULL CHECK (categoria IN ('esterilizacion', 'secado', 'prueba_diaria')),
  temperatura_objetivo numeric(6,2),
  duracion_minutos numeric(7,2) NOT NULL CHECK (duracion_minutos > 0 AND duracion_minutos <= 600),
  presion_objetivo numeric(7,3),
  activo boolean NOT NULL DEFAULT false,
  referencia_fabricante text,
  validado_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  validado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, codigo),
  CHECK ((activo = false) OR (validado_por IS NOT NULL AND validado_at IS NOT NULL AND char_length(btrim(coalesce(referencia_fabricante, ''))) >= 8)),
  CHECK ((codigo IN ('secado', 'bowie_dick')) OR temperatura_objetivo IS NOT NULL),
  CHECK (temperatura_objetivo IS NULL OR temperatura_objetivo >= 0),
  CHECK (presion_objetivo IS NULL OR presion_objetivo >= 0)
);

INSERT INTO public.esterilizacion_programas (
  clinica_id, codigo, nombre, categoria, temperatura_objetivo, duracion_minutos, presion_objetivo
)
SELECT c.id, p.codigo, p.nombre, p.categoria, p.temperatura, p.duracion, NULL
FROM public.clinicas c
CROSS JOIN (VALUES
  ('estandar_121', 'Estándar 121 °C', 'esterilizacion', 121::numeric, 20::numeric),
  ('rapido_134', 'Rápido 134 °C', 'esterilizacion', 134::numeric, 5::numeric),
  ('plasticos_121', 'Plásticos 121 °C', 'esterilizacion', 121::numeric, 15::numeric),
  ('secado', 'Secado (sin esterilización)', 'secado', NULL::numeric, 10::numeric),
  ('bowie_dick', 'Bowie-Dick (prueba diaria)', 'prueba_diaria', 134::numeric, 3.5::numeric)
) AS p(codigo, nombre, categoria, temperatura, duracion)
ON CONFLICT (clinica_id, codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bp10_inicializar_protocolos_esterilizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.esterilizacion_programas (
    clinica_id, codigo, nombre, categoria, temperatura_objetivo, duracion_minutos, presion_objetivo
  ) VALUES
    (NEW.id, 'estandar_121', 'Estándar 121 °C', 'esterilizacion', 121, 20, NULL),
    (NEW.id, 'rapido_134', 'Rápido 134 °C', 'esterilizacion', 134, 5, NULL),
    (NEW.id, 'plasticos_121', 'Plásticos 121 °C', 'esterilizacion', 121, 15, NULL),
    (NEW.id, 'secado', 'Secado (sin esterilización)', 'secado', NULL, 10, NULL),
    (NEW.id, 'bowie_dick', 'Bowie-Dick (prueba diaria)', 'prueba_diaria', 134, 3.5, NULL)
  ON CONFLICT (clinica_id, codigo) DO NOTHING;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.bp10_inicializar_protocolos_esterilizacion() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_inicializar_protocolos_esterilizacion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bp10_seed_esterilizacion_programas ON public.clinicas;
CREATE TRIGGER bp10_seed_esterilizacion_programas
  AFTER INSERT ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION public.bp10_inicializar_protocolos_esterilizacion();

CREATE TABLE IF NOT EXISTS public.esterilizacion_insumos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  tipo_consumo text NOT NULL CHECK (tipo_consumo IN (
    'prelavado', 'enjuague', 'bolsa', 'indicador_tipo1', 'indicador_tipo4',
    'indicador_biologico', 'indicador_bowie_dick'
  )),
  inventario_id uuid NOT NULL,
  ubicacion_id uuid NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  unidad text NOT NULL CHECK (char_length(btrim(unidad)) BETWEEN 1 AND 40),
  por_instrumento boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, tipo_consumo),
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario(id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (ubicacion_id, clinica_id)
    REFERENCES public.inventario_ubicaciones(id, clinica_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.esterilizacion_ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  lote text NOT NULL CHECK (char_length(btrim(lote)) BETWEEN 6 AND 80),
  equipo_id uuid NOT NULL,
  programa_id uuid NOT NULL,
  programa_codigo text NOT NULL,
  programa_nombre text NOT NULL,
  objetivo_snapshot jsonb NOT NULL CHECK (jsonb_typeof(objetivo_snapshot) = 'object'),
  estado text NOT NULL DEFAULT 'preparacion'
    CHECK (estado IN ('preparacion', 'en_curso', 'liberado', 'rechazado', 'retenido_biologico', 'cancelado', 'revisar_migracion')),
  operador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  etiqueta_operador text NOT NULL DEFAULT '' CHECK (char_length(etiqueta_operador) <= 100),
  temperatura_observada numeric(6,2),
  presion_observada numeric(7,3),
  duracion_observada_minutos numeric(7,2),
  indicador_tipo4 text CHECK (indicador_tipo4 IS NULL OR indicador_tipo4 IN ('aprobado', 'rechazado')),
  motivo_override_bowie text,
  motivo_cancelacion text,
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  finalizado_at timestamptz,
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL,
  finalization_idempotency_key uuid,
  finalization_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, idempotency_key),
  UNIQUE (clinica_id, finalization_idempotency_key),
  FOREIGN KEY (equipo_id, clinica_id)
    REFERENCES public.inventario(id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (programa_id, clinica_id)
    REFERENCES public.esterilizacion_programas(id, clinica_id) ON DELETE RESTRICT,
  CHECK (estado NOT IN ('liberado', 'rechazado', 'retenido_biologico') OR finalizado_at IS NOT NULL),
  CHECK (estado <> 'cancelado' OR char_length(btrim(coalesce(motivo_cancelacion, ''))) >= 5),
  CHECK (motivo_override_bowie IS NULL OR char_length(btrim(motivo_override_bowie)) >= 10)
);

CREATE INDEX IF NOT EXISTS esterilizacion_ciclos_clinica_fecha_idx
  ON public.esterilizacion_ciclos (clinica_id, iniciado_at DESC);
CREATE INDEX IF NOT EXISTS esterilizacion_ciclos_clinica_estado_idx
  ON public.esterilizacion_ciclos (clinica_id, estado, iniciado_at DESC);

CREATE TABLE IF NOT EXISTS public.esterilizacion_ciclo_instrumentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  ciclo_id uuid NOT NULL,
  inventario_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'en_proceso'
    CHECK (estado IN ('en_proceso', 'disponible', 'retenido', 'usado')),
  indicador_tipo1_aprobado boolean,
  lote_snapshot text NOT NULL,
  programa_snapshot text NOT NULL,
  liberado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (ciclo_id, inventario_id),
  FOREIGN KEY (ciclo_id, clinica_id)
    REFERENCES public.esterilizacion_ciclos(id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario(id, clinica_id) ON DELETE RESTRICT,
  CHECK ((estado <> 'disponible') OR (indicador_tipo1_aprobado = true AND liberado_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS esterilizacion_ciclo_instrumentos_disponibles_idx
  ON public.esterilizacion_ciclo_instrumentos (clinica_id, estado, liberado_at DESC);
CREATE INDEX IF NOT EXISTS esterilizacion_ciclo_instrumentos_item_idx
  ON public.esterilizacion_ciclo_instrumentos (clinica_id, inventario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.esterilizacion_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  ciclo_id uuid NOT NULL,
  numero smallint NOT NULL CHECK (numero BETWEEN 1 AND 7),
  estado text NOT NULL CHECK (estado IN ('completado', 'en_curso')),
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detalle) = 'object'),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  completado_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL,
  completion_key uuid,
  completion_fingerprint text,
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  completado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ciclo_id, numero),
  UNIQUE (clinica_id, idempotency_key),
  UNIQUE (clinica_id, completion_key),
  FOREIGN KEY (ciclo_id, clinica_id)
    REFERENCES public.esterilizacion_ciclos(id, clinica_id) ON DELETE RESTRICT,
  CHECK ((estado = 'en_curso' AND completado_at IS NULL) OR (estado = 'completado' AND completado_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.esterilizacion_pruebas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('bowie_dick', 'biologico')),
  equipo_id uuid NOT NULL,
  ciclo_id uuid,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  marca_indicador text NOT NULL DEFAULT '' CHECK (char_length(marca_indicador) <= 120),
  horas_incubacion numeric(7,2),
  observacion text NOT NULL DEFAULT '' CHECK (char_length(observacion) <= 1000),
  ruta_evidencia text,
  observado_at timestamptz NOT NULL DEFAULT now(),
  resultado_at timestamptz,
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  leido_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (equipo_id, clinica_id)
    REFERENCES public.inventario(id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (ciclo_id, clinica_id)
    REFERENCES public.esterilizacion_ciclos(id, clinica_id) ON DELETE RESTRICT,
  CHECK ((tipo = 'bowie_dick' AND ciclo_id IS NULL AND estado IN ('aprobado', 'rechazado') AND resultado_at IS NOT NULL)
      OR (tipo = 'biologico' AND ciclo_id IS NOT NULL AND (horas_incubacion IS NULL OR horas_incubacion > 0))),
  CHECK ((estado = 'pendiente' AND resultado_at IS NULL AND leido_por IS NULL)
      OR (estado IN ('aprobado', 'rechazado') AND resultado_at IS NOT NULL AND leido_por IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS esterilizacion_pruebas_equipo_fecha_idx
  ON public.esterilizacion_pruebas (clinica_id, equipo_id, tipo, observado_at DESC);
CREATE INDEX IF NOT EXISTS esterilizacion_pruebas_ciclo_idx
  ON public.esterilizacion_pruebas (clinica_id, ciclo_id, tipo, observado_at DESC);

CREATE TABLE IF NOT EXISTS public.esterilizacion_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  ciclo_instrumento_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  tratamiento_ref text NOT NULL CHECK (char_length(btrim(tratamiento_ref)) BETWEEN 1 AND 200),
  profesional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  usado_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL,
  UNIQUE (ciclo_instrumento_id, clinica_id),
  UNIQUE (clinica_id, idempotency_key, ciclo_instrumento_id),
  FOREIGN KEY (ciclo_instrumento_id, clinica_id)
    REFERENCES public.esterilizacion_ciclo_instrumentos(id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (paciente_id, clinica_id)
    REFERENCES public.pacientes(id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS esterilizacion_usos_paciente_fecha_idx
  ON public.esterilizacion_usos (clinica_id, paciente_id, usado_at DESC);
CREATE INDEX IF NOT EXISTS esterilizacion_usos_tratamiento_idx
  ON public.esterilizacion_usos (clinica_id, paciente_id, tratamiento_ref);

CREATE TABLE IF NOT EXISTS public.esterilizacion_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  ciclo_id uuid,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evento text NOT NULL CHECK (char_length(btrim(evento)) BETWEEN 3 AND 80),
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detalle) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ciclo_id, clinica_id)
    REFERENCES public.esterilizacion_ciclos(id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS esterilizacion_eventos_ciclo_idx
  ON public.esterilizacion_eventos (clinica_id, ciclo_id, created_at DESC);

-- BP09 no tenía estados para instrumental ya usado/retenido ni un movimiento
-- de esterilización. Se amplía el vocabulario de forma aditiva.
ALTER TABLE public.inventario
  DROP CONSTRAINT IF EXISTS inventario_estado_instrumental_check;
ALTER TABLE public.inventario
  ADD CONSTRAINT inventario_estado_instrumental_check
  CHECK (estado_instrumental IS NULL OR estado_instrumental IN ('disponible', 'en_esterilizacion', 'en_uso', 'usado', 'retenido', 'mantencion'));

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS esterilizacion_ciclo_id uuid;
ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS esterilizacion_prueba_id uuid;
ALTER TABLE public.inventario_movimientos
  DROP CONSTRAINT IF EXISTS inventario_movimientos_tipo_check,
  DROP CONSTRAINT IF EXISTS inventario_movimientos_check;
ALTER TABLE public.inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_tipo_check
  CHECK (tipo IN ('entrada_compra', 'entrada_devolucion', 'salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento', 'salida_esterilizacion', 'ajuste', 'transferencia')),
  ADD CONSTRAINT inventario_movimientos_check
  CHECK (
    (tipo = 'transferencia' AND ubicacion_origen_id IS NOT NULL AND ubicacion_destino_id IS NOT NULL AND ubicacion_origen_id <> ubicacion_destino_id)
    OR (tipo IN ('entrada_compra', 'entrada_devolucion') AND ubicacion_destino_id IS NOT NULL AND signo = 1)
    OR (tipo IN ('salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento', 'salida_esterilizacion') AND ubicacion_origen_id IS NOT NULL AND signo = -1)
    OR (tipo = 'ajuste' AND (ubicacion_origen_id IS NOT NULL OR ubicacion_destino_id IS NOT NULL) AND justificacion IS NOT NULL AND char_length(btrim(justificacion)) >= 5)
  ),
  ADD CONSTRAINT inventario_movimientos_esterilizacion_source_check
  CHECK (
    (tipo = 'salida_esterilizacion' AND (
      (esterilizacion_ciclo_id IS NOT NULL AND esterilizacion_prueba_id IS NULL)
      OR (esterilizacion_ciclo_id IS NULL AND esterilizacion_prueba_id IS NOT NULL)
    ))
    OR (tipo <> 'salida_esterilizacion' AND esterilizacion_ciclo_id IS NULL AND esterilizacion_prueba_id IS NULL)
  );
ALTER TABLE public.inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_esterilizacion_ciclo_fk
  FOREIGN KEY (esterilizacion_ciclo_id, clinica_id)
  REFERENCES public.esterilizacion_ciclos(id, clinica_id) ON DELETE RESTRICT;
ALTER TABLE public.inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_esterilizacion_prueba_fk
  FOREIGN KEY (esterilizacion_prueba_id, clinica_id)
  REFERENCES public.esterilizacion_pruebas(id, clinica_id) ON DELETE RESTRICT;

ALTER TABLE public.esterilizacion_programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_insumos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_ciclo_instrumentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_pruebas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_usos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esterilizacion_eventos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.puede_operar_esterilizacion(p_accion text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_rol public.app_role;
BEGIN
  IF v_user_id IS NULL OR p_accion IS NULL THEN RETURN false; END IF;
  v_clinica_id := public.clinica_actual();
  IF v_clinica_id IS NULL THEN RETURN false; END IF;
  v_rol := public.rol_en_clinica_actual();
  IF v_rol IS NULL THEN RETURN false; END IF;
  CASE p_accion
    WHEN 'ciclos.ver', 'pruebas.ver', 'libro.ver', 'alertas.ver', 'ciclos.operar', 'pruebas.registrar' THEN
      RETURN v_rol IN ('admin'::public.app_role, 'asistente'::public.app_role);
    WHEN 'configurar' THEN
      RETURN v_rol = 'admin'::public.app_role;
    WHEN 'instrumental.ver' THEN
      RETURN v_rol IN ('admin'::public.app_role, 'asistente'::public.app_role, 'dentista'::public.app_role);
    WHEN 'trazabilidad.ver' THEN
      RETURN v_rol IN ('admin'::public.app_role, 'dentista'::public.app_role, 'asistente'::public.app_role);
    WHEN 'trazabilidad.registrar' THEN
      RETURN v_rol IN ('admin'::public.app_role, 'dentista'::public.app_role);
    ELSE RETURN false;
  END CASE;
END;
$function$;
ALTER FUNCTION public.puede_operar_esterilizacion(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.puede_operar_esterilizacion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_operar_esterilizacion(text) TO authenticated;

CREATE POLICY esterilizacion_programas_read ON public.esterilizacion_programas
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('ciclos.operar'));
CREATE POLICY esterilizacion_insumos_config_read ON public.esterilizacion_insumos_config
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('configurar'));
CREATE POLICY esterilizacion_ciclos_read ON public.esterilizacion_ciclos
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('ciclos.ver'));
CREATE POLICY esterilizacion_instrumentos_read ON public.esterilizacion_ciclo_instrumentos
  FOR SELECT TO authenticated
  USING (
    clinica_id = public.clinica_actual()
    AND (
      public.puede_operar_esterilizacion('ciclos.ver')
      OR (estado = 'disponible' AND public.puede_operar_esterilizacion('instrumental.ver'))
    )
  );
CREATE POLICY esterilizacion_pasos_read ON public.esterilizacion_pasos
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('ciclos.ver'));
CREATE POLICY esterilizacion_pruebas_read ON public.esterilizacion_pruebas
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('pruebas.ver'));
CREATE POLICY esterilizacion_usos_read ON public.esterilizacion_usos
  FOR SELECT TO authenticated
  USING (
    clinica_id = public.clinica_actual()
    AND public.puede_operar_esterilizacion('trazabilidad.ver')
    AND (
      public.rol_en_clinica_actual() <> 'dentista'::public.app_role
      OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = esterilizacion_usos.paciente_id
          AND p.clinica_id = esterilizacion_usos.clinica_id
          AND p.doctor_tratante_id = auth.uid()
          AND p.deleted_at IS NULL
      )
    )
  );
CREATE POLICY esterilizacion_eventos_read ON public.esterilizacion_eventos
  FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual() AND public.puede_operar_esterilizacion('ciclos.ver'));

GRANT SELECT ON public.esterilizacion_programas,
  public.esterilizacion_insumos_config,
  public.esterilizacion_ciclos,
  public.esterilizacion_ciclo_instrumentos,
  public.esterilizacion_pasos,
  public.esterilizacion_pruebas,
  public.esterilizacion_usos,
  public.esterilizacion_eventos
TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.esterilizacion_programas,
  public.esterilizacion_insumos_config,
  public.esterilizacion_ciclos,
  public.esterilizacion_ciclo_instrumentos,
  public.esterilizacion_pasos,
  public.esterilizacion_pruebas,
  public.esterilizacion_usos,
  public.esterilizacion_eventos
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bp10_consumir_insumos_esterilizacion(
  p_clinica_id uuid,
  p_ciclo_id uuid,
  p_prueba_id uuid,
  p_tipos_consumo text[],
  p_idempotency_key uuid,
  p_instrumentos smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_config record;
  v_tipo_item text;
  v_requiere_vencimiento boolean;
  v_balance record;
  v_required numeric;
  v_remaining numeric;
  v_take numeric;
  v_assignment smallint;
  v_linea smallint := 0;
  v_ids jsonb := '[]'::jsonb;
  v_fingerprint text;
  v_stock_total numeric;
  v_today date;
  v_movement_id uuid;
BEGIN
  IF v_user_id IS NULL OR p_clinica_id IS DISTINCT FROM public.clinica_actual()
     OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para consumir insumos de esterilización.';
  END IF;
  IF p_tipos_consumo IS NULL OR cardinality(p_tipos_consumo) = 0
     OR NOT (p_tipos_consumo <@ ARRAY[
       'prelavado', 'enjuague', 'bolsa', 'indicador_tipo1', 'indicador_tipo4',
       'indicador_biologico', 'indicador_bowie_dick'
     ]::text[])
     OR p_idempotency_key IS NULL OR p_instrumentos < 1
     OR ((p_ciclo_id IS NULL) = (p_prueba_id IS NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Configuración de consumo inválida.';
  END IF;
  IF p_ciclo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.esterilizacion_ciclos c
    WHERE c.id = p_ciclo_id AND c.clinica_id = p_clinica_id
      AND c.estado IN ('preparacion', 'en_curso')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El ciclo de consumo no pertenece a esta clínica o no está activo.';
  END IF;
  IF p_prueba_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.esterilizacion_pruebas t
    WHERE t.id = p_prueba_id AND t.clinica_id = p_clinica_id
      AND t.tipo IN ('bowie_dick', 'biologico') AND t.creado_por = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La prueba de consumo no pertenece a esta clínica o usuario.';
  END IF;
  SELECT (now() AT TIME ZONE coalesce(c.zona_horaria, 'America/Santiago'))::date
    INTO v_today FROM public.clinicas c WHERE c.id = p_clinica_id;

  SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
    'kind', x.tipo_consumo, 'id', x.id, 'item', x.inventario_id, 'location', x.ubicacion_id,
    'quantity', x.cantidad, 'perInstrument', x.por_instrumento
  ) ORDER BY x.tipo_consumo)::text, 'sin-configuracion'))
  INTO v_fingerprint
  FROM public.esterilizacion_insumos_config x
  WHERE x.clinica_id = p_clinica_id AND x.tipo_consumo = ANY(p_tipos_consumo) AND x.activo;
  v_fingerprint := md5(v_fingerprint || ':' || coalesce(p_ciclo_id::text, '') || ':' || coalesce(p_prueba_id::text, '') || ':' || p_instrumentos::text);

  FOR v_config IN
    SELECT x.*
    FROM public.esterilizacion_insumos_config x
    WHERE x.clinica_id = p_clinica_id AND x.tipo_consumo = ANY(p_tipos_consumo) AND x.activo
    ORDER BY x.tipo_consumo, x.inventario_id
    FOR UPDATE
  LOOP
    v_linea := v_linea + 1;
    v_tipo_item := NULL;
    v_requiere_vencimiento := false;
    v_required := v_config.cantidad * CASE WHEN v_config.por_instrumento THEN p_instrumentos ELSE 1 END;
    SELECT i.tipo_item, i.requiere_vencimiento
      INTO v_tipo_item, v_requiere_vencimiento
    FROM public.inventario i
    WHERE i.id = v_config.inventario_id AND i.clinica_id = p_clinica_id
      AND i.estado_catalogo = 'activo' AND i.tipo_item = 'insumo_clinico'
    FOR UPDATE;
    IF v_tipo_item IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El insumo configurado no está activo en esta clínica.';
    END IF;

    v_remaining := v_required;
    v_assignment := 0;
    FOR v_balance IN
      SELECT s.id, s.lote_id, s.cantidad, l.fecha_vencimiento, l.fecha_ingreso
      FROM public.inventario_stock_por_ubicacion s
      JOIN public.inventario_lotes l
        ON l.id = s.lote_id AND l.inventario_id = s.inventario_id AND l.clinica_id = s.clinica_id
      WHERE s.clinica_id = p_clinica_id
        AND s.inventario_id = v_config.inventario_id
        AND s.ubicacion_id = v_config.ubicacion_id
        AND s.cantidad > 0
        AND (l.fecha_vencimiento >= v_today OR (NOT v_requiere_vencimiento AND l.fecha_vencimiento IS NULL))
      ORDER BY l.fecha_vencimiento ASC NULLS LAST, l.fecha_ingreso ASC, l.id ASC
      FOR UPDATE OF s
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := least(v_balance.cantidad, v_remaining);
      UPDATE public.inventario_stock_por_ubicacion s
      SET cantidad = s.cantidad - v_take
      WHERE s.id = v_balance.id AND s.cantidad >= v_take;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Cambió el saldo de un insumo; vuelve a intentar.';
      END IF;
      v_assignment := v_assignment + 1;
      INSERT INTO public.inventario_movimientos (
        clinica_id, inventario_id, tipo, cantidad, signo,
        ubicacion_origen_id, lote_id, esterilizacion_ciclo_id, esterilizacion_prueba_id, justificacion,
        actor_user_id, idempotency_key, idempotency_fingerprint, linea, asignacion
      ) VALUES (
        p_clinica_id, v_config.inventario_id, 'salida_esterilizacion', v_take, -1,
        v_config.ubicacion_id, v_balance.lote_id, p_ciclo_id, p_prueba_id,
        'Consumo BP10 ' || array_to_string(p_tipos_consumo, ',') || CASE
          WHEN p_ciclo_id IS NOT NULL THEN ' en ciclo ' || p_ciclo_id::text
          ELSE ' en prueba ' || p_prueba_id::text
        END,
        v_user_id, p_idempotency_key, v_fingerprint, v_linea, v_assignment
      ) RETURNING id INTO v_movement_id;
      v_ids := v_ids || jsonb_build_array(v_movement_id);
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Stock insuficiente o sin lotes vigentes para el insumo configurado.';
    END IF;
    SELECT coalesce(sum(s.cantidad), 0) INTO v_stock_total
    FROM public.inventario_stock_por_ubicacion s
    WHERE s.clinica_id = p_clinica_id AND s.inventario_id = v_config.inventario_id;
    UPDATE public.inventario i SET cantidad_actual = v_stock_total
    WHERE i.id = v_config.inventario_id AND i.clinica_id = p_clinica_id;
  END LOOP;
  IF v_linea = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admin debe configurar el insumo requerido antes de avanzar.';
  END IF;
  RETURN jsonb_build_object('movementIds', v_ids, 'fingerprint', v_fingerprint);
END;
$function$;
ALTER FUNCTION public.bp10_consumir_insumos_esterilizacion(uuid, uuid, uuid, text[], uuid, smallint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_consumir_insumos_esterilizacion(uuid, uuid, uuid, text[], uuid, smallint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bp10_configurar_programa_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_program public.esterilizacion_programas%ROWTYPE;
  v_codigo text;
  v_nombre text;
  v_active boolean;
  v_reference text;
  v_temperature numeric;
  v_duration numeric;
  v_pressure numeric;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('configurar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo un administrador puede configurar protocolos.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Configuración de protocolo inválida.';
  END IF;
  v_codigo := p_payload->>'codigo';
  v_nombre := nullif(btrim(p_payload->>'nombre'), '');
  v_active := coalesce((p_payload->>'activo')::boolean, false);
  v_reference := nullif(btrim(p_payload->>'referenciaFabricante'), '');
  v_temperature := nullif(p_payload->>'temperaturaObjetivo', '')::numeric;
  v_duration := nullif(p_payload->>'duracionMinutos', '')::numeric;
  v_pressure := nullif(p_payload->>'presionObjetivo', '')::numeric;
  IF v_active AND (
    char_length(coalesce(v_reference, '')) < 8
    OR (v_codigo <> 'secado' AND v_temperature IS NULL)
    OR v_duration IS NULL OR v_duration <= 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Para activar el protocolo registra parámetros y referencia del fabricante revisados.';
  END IF;
  UPDATE public.esterilizacion_programas p
  SET nombre = coalesce(v_nombre, p.nombre),
      temperatura_objetivo = coalesce(v_temperature, p.temperatura_objetivo),
      duracion_minutos = coalesce(v_duration, p.duracion_minutos),
      presion_objetivo = coalesce(v_pressure, p.presion_objetivo),
      activo = v_active,
      referencia_fabricante = CASE WHEN v_active THEN v_reference ELSE p.referencia_fabricante END,
      validado_por = CASE WHEN v_active THEN v_user_id ELSE p.validado_por END,
      validado_at = CASE WHEN v_active THEN now() ELSE p.validado_at END,
      updated_at = now()
  WHERE p.clinica_id = v_clinica_id AND p.codigo = v_codigo
  RETURNING p.* INTO v_program;
  IF v_program.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se encontró el protocolo de esta clínica.';
  END IF;
  INSERT INTO public.esterilizacion_eventos (clinica_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_user_id, 'protocolo_configurado', jsonb_build_object('codigo', v_codigo, 'activo', v_program.activo));
  RETURN jsonb_build_object('id', v_program.id, 'codigo', v_program.codigo, 'activo', v_program.activo, 'updatedAt', v_program.updated_at);
END;
$function$;
ALTER FUNCTION public.bp10_configurar_programa_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_configurar_programa_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_configurar_programa_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_configurar_insumo_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_kind text := p_payload->>'tipoConsumo';
  v_item uuid := nullif(p_payload->>'inventarioId', '')::uuid;
  v_location uuid := nullif(p_payload->>'ubicacionId', '')::uuid;
  v_quantity numeric := nullif(p_payload->>'cantidad', '')::numeric;
  v_unit text := nullif(btrim(p_payload->>'unidad'), '');
  v_per_instrument boolean := coalesce((p_payload->>'porInstrumento')::boolean, false);
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('configurar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo un administrador puede configurar consumibles.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_kind IS NULL OR v_kind NOT IN (
       'prelavado', 'enjuague', 'bolsa', 'indicador_tipo1', 'indicador_tipo4',
       'indicador_biologico', 'indicador_bowie_dick'
     )
     OR v_item IS NULL OR v_location IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 99999999999.999
     OR v_quantity <> round(v_quantity, 3) OR char_length(coalesce(v_unit, '')) = 0 OR char_length(v_unit) > 40
     OR v_per_instrument IS DISTINCT FROM (v_kind IN ('bolsa', 'indicador_tipo1')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Datos de consumible BP10 inválidos.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventario i
    WHERE i.id = v_item AND i.clinica_id = v_clinica_id
      AND i.tipo_item = 'insumo_clinico' AND i.estado_catalogo = 'activo'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.inventario_ubicaciones u
    WHERE u.id = v_location AND u.clinica_id = v_clinica_id AND u.estado = 'activo'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El insumo o la ubicación no está activo en esta clínica.';
  END IF;
  INSERT INTO public.esterilizacion_insumos_config (
    clinica_id, tipo_consumo, inventario_id, ubicacion_id, cantidad, unidad, por_instrumento, updated_by, updated_at
  ) VALUES (
    v_clinica_id, v_kind, v_item, v_location, v_quantity, v_unit, v_per_instrument, v_user_id, now()
  )
  ON CONFLICT (clinica_id, tipo_consumo) DO UPDATE
  SET inventario_id = EXCLUDED.inventario_id, ubicacion_id = EXCLUDED.ubicacion_id,
      cantidad = EXCLUDED.cantidad, unidad = EXCLUDED.unidad,
      por_instrumento = EXCLUDED.por_instrumento, activo = true,
      updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.esterilizacion_eventos (clinica_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_user_id, 'consumible_configurado', jsonb_build_object('tipoConsumo', v_kind, 'inventarioId', v_item));
  RETURN jsonb_build_object('ok', true, 'tipoConsumo', v_kind);
END;
$function$;
ALTER FUNCTION public.bp10_configurar_insumo_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_configurar_insumo_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_configurar_insumo_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_registrar_bowie_dick(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_equipo uuid := nullif(p_payload->>'equipoId', '')::uuid;
  v_resultado text := p_payload->>'resultado';
  v_existing uuid;
  v_existing_fingerprint text;
  v_id uuid;
  v_fingerprint text;
  v_consumption jsonb;
  v_marca text := nullif(btrim(p_payload->>'marcaIndicador'), '');
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('pruebas.registrar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar Bowie-Dick.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR v_key IS NULL OR v_equipo IS NULL OR v_resultado IS NULL
     OR v_marca IS NULL OR char_length(v_marca) > 120
     OR v_resultado NOT IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Resultado Bowie-Dick inválido.';
  END IF;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT t.id, t.idempotency_fingerprint INTO v_existing, v_existing_fingerprint
  FROM public.esterilizacion_pruebas t
  WHERE t.clinica_id = v_clinica_id AND t.idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
    END IF;
    RETURN jsonb_build_object('id', v_existing, 'replayed', true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventario i
    WHERE i.id = v_equipo AND i.clinica_id = v_clinica_id
      AND i.tipo_item = 'equipamiento' AND i.categoria = 'Esterilización' AND i.estado_catalogo = 'activo'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El autoclave no existe o está inactivo en esta clínica.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.esterilizacion_programas p
    WHERE p.clinica_id = v_clinica_id AND p.codigo = 'bowie_dick'
      AND p.categoria = 'prueba_diaria' AND p.activo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Admin debe activar el protocolo Bowie-Dick validado por esta clínica antes de registrar la prueba.';
  END IF;
  INSERT INTO public.esterilizacion_pruebas (
    clinica_id, tipo, equipo_id, estado, marca_indicador, observacion,
    observado_at, resultado_at, creado_por, leido_por, idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_clinica_id, 'bowie_dick', v_equipo, v_resultado,
    v_marca,
    left(coalesce(p_payload->>'observacion', ''), 1000), now(), now(), v_user_id, v_user_id, v_key, v_fingerprint
  ) RETURNING id INTO v_id;
  v_consumption := public.bp10_consumir_insumos_esterilizacion(
    v_clinica_id, NULL, v_id, ARRAY['indicador_bowie_dick'], v_key, 1
  );
  INSERT INTO public.esterilizacion_eventos (clinica_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_user_id, 'bowie_dick_registrado', jsonb_build_object('equipoId', v_equipo, 'resultado', v_resultado));
  RETURN jsonb_build_object('id', v_id, 'consumos', v_consumption, 'replayed', false);
END;
$function$;
ALTER FUNCTION public.bp10_registrar_bowie_dick(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_registrar_bowie_dick(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_registrar_bowie_dick(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_crear_ciclo_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_equipo uuid := nullif(p_payload->>'equipoId', '')::uuid;
  v_programa uuid := nullif(p_payload->>'programaId', '')::uuid;
  v_lote text := nullif(btrim(p_payload->>'lote'), '');
  v_etiqueta text := left(coalesce(btrim(p_payload->>'operador'), ''), 100);
  v_ids uuid[];
  v_item_id uuid;
  v_program public.esterilizacion_programas%ROWTYPE;
  v_id uuid;
  v_existing uuid;
  v_existing_fingerprint text;
  v_count integer;
  v_distinct_count integer;
  v_fingerprint text;
  v_snapshot jsonb;
  v_reprocess_reason text := nullif(btrim(p_payload->>'justificacionReproceso'), '');
  v_zone text;
  v_today date;
  v_reprocess_count integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para operar esterilización.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_key IS NULL OR v_equipo IS NULL
     OR v_programa IS NULL OR v_lote IS NULL OR char_length(v_lote) > 80
     OR jsonb_typeof(p_payload->'instrumentoIds') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Datos de inicio de ciclo incompletos.';
  END IF;
  SELECT array_agg(x.value::uuid), count(*), count(DISTINCT x.value::uuid)
    INTO v_ids, v_count, v_distinct_count
  FROM jsonb_array_elements_text(p_payload->'instrumentoIds') AS x(value);
  IF v_count < 1 OR v_count > 200 OR v_count <> cardinality(v_ids) OR v_count <> v_distinct_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selecciona entre 1 y 200 instrumentos únicos.';
  END IF;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT c.id, c.idempotency_fingerprint INTO v_existing, v_existing_fingerprint
  FROM public.esterilizacion_ciclos c
  WHERE c.clinica_id = v_clinica_id AND c.idempotency_key = nullif(p_payload->>'idempotencyKey', '')::uuid;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
    END IF;
    RETURN jsonb_build_object('id', v_existing, 'replayed', true);
  END IF;
  SELECT p.* INTO v_program
  FROM public.esterilizacion_programas p
  WHERE p.id = v_programa AND p.clinica_id = v_clinica_id AND p.activo
    AND p.categoria = 'esterilizacion'
  FOR SHARE;
  IF v_program.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El programa no está activado y validado por la clínica.';
  END IF;
  SELECT coalesce(c.zona_horaria, 'America/Santiago') INTO v_zone
  FROM public.clinicas c WHERE c.id = v_clinica_id;
  v_today := (now() AT TIME ZONE v_zone)::date;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventario i
    WHERE i.id = v_equipo AND i.clinica_id = v_clinica_id
      AND i.tipo_item = 'equipamiento' AND i.categoria = 'Esterilización' AND i.estado_catalogo = 'activo'
      AND (i.proxima_mantencion IS NULL OR i.proxima_mantencion >= v_today)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El autoclave no está activo o su mantención registrada está vencida.';
  END IF;
  FOREACH v_item_id IN ARRAY v_ids LOOP
    PERFORM 1 FROM public.inventario i
    WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id
      AND i.tipo_item = 'instrumental' AND i.requiere_esterilizacion
      AND i.estado_catalogo = 'activo'
      AND i.cantidad_actual = 1
      AND i.estado_instrumental IN ('usado', 'retenido')
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Un instrumento está inactivo, en uso, retenido o pertenece a otra clínica.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.inventario i
      WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id AND i.estado_instrumental = 'retenido'
    ) AND (public.rol_en_clinica_actual() <> 'admin'::public.app_role OR char_length(coalesce(v_reprocess_reason, '')) < 10) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un instrumento retenido solo puede reprocesarse con autorización y justificación de Admin.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.esterilizacion_ciclo_instrumentos ci
      WHERE ci.clinica_id = v_clinica_id AND ci.inventario_id = v_item_id
        AND ci.estado IN ('en_proceso', 'disponible')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Un instrumento aún figura en proceso o disponible; no puede duplicarse en una nueva carga.';
    END IF;
  END LOOP;
  SELECT count(*) INTO v_reprocess_count
  FROM public.inventario i
  WHERE i.id = ANY(v_ids) AND i.clinica_id = v_clinica_id AND i.estado_instrumental = 'retenido';
  IF v_reprocess_count = 0 AND v_reprocess_reason IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La justificación de reproceso solo corresponde a instrumental retenido.';
  END IF;
  v_snapshot := jsonb_build_object(
    'temperatura', v_program.temperatura_objetivo,
    'duracionMinutos', v_program.duracion_minutos,
    'presion', v_program.presion_objetivo,
    'referenciaFabricante', v_program.referencia_fabricante
  );
  INSERT INTO public.esterilizacion_ciclos (
    clinica_id, lote, equipo_id, programa_id, programa_codigo, programa_nombre,
    objetivo_snapshot, estado, operador_id, etiqueta_operador, creado_por, idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_clinica_id, v_lote, v_equipo, v_programa, v_program.codigo, v_program.nombre,
    v_snapshot, 'preparacion', v_user_id, v_etiqueta, v_user_id, v_key, v_fingerprint
  ) RETURNING id INTO v_id;
  FOREACH v_item_id IN ARRAY v_ids LOOP
    INSERT INTO public.esterilizacion_ciclo_instrumentos (
      clinica_id, ciclo_id, inventario_id, estado, lote_snapshot, programa_snapshot
    ) VALUES (v_clinica_id, v_id, v_item_id, 'en_proceso', v_lote, v_program.nombre);
    UPDATE public.inventario i SET estado_instrumental = 'en_esterilizacion'
    WHERE i.id = v_item_id AND i.clinica_id = v_clinica_id;
  END LOOP;
  INSERT INTO public.esterilizacion_pasos (
    clinica_id, ciclo_id, numero, estado, detalle, actor_user_id,
    completado_por, idempotency_key, idempotency_fingerprint, completado_at
  ) VALUES (
    v_clinica_id, v_id, 1, 'completado', jsonb_build_object('instrumentosRecibidos', v_count),
    v_user_id, v_user_id, gen_random_uuid(), v_fingerprint, now()
  );
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_id, v_user_id, 'instrumental_recibido',
    jsonb_build_object('cantidad', v_count, 'lote', v_lote, 'reprocesoAutorizado', v_reprocess_reason IS NOT NULL));
  IF v_reprocess_reason IS NOT NULL THEN
    INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
    VALUES (v_clinica_id, v_id, v_user_id, 'reproceso_autorizado', jsonb_build_object('justificacion', v_reprocess_reason));
  END IF;
  RETURN jsonb_build_object('id', v_id, 'lote', v_lote, 'estado', 'preparacion', 'replayed', false);
END;
$function$;
ALTER FUNCTION public.bp10_crear_ciclo_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_crear_ciclo_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_crear_ciclo_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_completar_paso_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_step smallint := nullif(p_payload->>'numero', '')::smallint;
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
  v_step_row public.esterilizacion_pasos%ROWTYPE;
  v_existing_fingerprint text;
  v_next smallint;
  v_fingerprint text;
  v_detail jsonb := '{}'::jsonb;
  v_raw_detail jsonb := coalesce(p_payload->'detalle', '{}'::jsonb);
  v_result jsonb;
  v_count integer;
  v_tipo1_aprobado boolean;
  v_programa_secado public.esterilizacion_programas%ROWTYPE;
  v_duracion_secado numeric;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar pasos del protocolo.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_cycle IS NULL OR v_key IS NULL
     OR v_step IS NULL OR v_step NOT BETWEEN 2 AND 6 OR jsonb_typeof(v_detail) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paso de protocolo inválido.';
  END IF;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT s.completion_fingerprint INTO v_existing_fingerprint FROM public.esterilizacion_pasos s
  WHERE s.clinica_id = v_clinica_id AND s.completion_key = v_key;
  IF v_existing_fingerprint IS NOT NULL THEN
    IF v_existing_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia se reutilizó con otros datos.';
    END IF;
    RETURN jsonb_build_object('cicloId', v_cycle, 'numero', v_step, 'replayed', true);
  END IF;
  SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id
  FOR UPDATE;
  IF v_cycle_row.id IS NULL OR v_cycle_row.estado <> 'preparacion' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El ciclo no está disponible para preparación.';
  END IF;
  SELECT coalesce(max(s.numero), 0) + 1 INTO v_next
  FROM public.esterilizacion_pasos s WHERE s.ciclo_id = v_cycle AND s.clinica_id = v_clinica_id
    AND s.estado = 'completado';
  IF v_step <> v_next THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Completa los pasos en orden, sin saltos.';
  END IF;
  SELECT s.* INTO v_step_row FROM public.esterilizacion_pasos s
  WHERE s.clinica_id = v_clinica_id AND s.ciclo_id = v_cycle AND s.numero = v_step AND s.estado = 'en_curso'
  FOR UPDATE;
  IF v_step_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Inicia el paso actual antes de completarlo.';
  END IF;
  IF jsonb_typeof(v_raw_detail) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Detalle del paso inválido.';
  END IF;
  IF v_step = 2 THEN
    IF nullif(v_raw_detail->>'duracionMinutosReal', '') IS NULL
       OR (v_raw_detail->>'duracionMinutosReal')::numeric <= 0
       OR (v_raw_detail->>'duracionMinutosReal')::numeric > 600 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Registra el tiempo real del prelavado.';
    END IF;
    v_detail := jsonb_build_object('duracionMinutosReal', (v_raw_detail->>'duracionMinutosReal')::numeric);
  ELSIF v_step = 3 AND (v_raw_detail->>'metodo' IS NULL OR v_raw_detail->>'metodo' NOT IN ('manual', 'ultrasonico')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selecciona lavado manual o ultrasónico.';
  ELSIF v_step = 3 THEN
    IF nullif(v_raw_detail->>'duracionMinutosReal', '') IS NULL
       OR (v_raw_detail->>'duracionMinutosReal')::numeric <= 0
       OR (v_raw_detail->>'duracionMinutosReal')::numeric > 600 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Registra el tiempo real del lavado.';
    END IF;
    v_detail := jsonb_build_object('metodo', v_raw_detail->>'metodo', 'duracionMinutosReal', (v_raw_detail->>'duracionMinutosReal')::numeric);
  ELSIF v_step = 4 THEN
    v_detail := jsonb_build_object('enjuagueCompletado', true);
  END IF;
  IF v_step = 5 THEN
    SELECT p.* INTO v_programa_secado FROM public.esterilizacion_programas p
    WHERE p.clinica_id = v_clinica_id AND p.codigo = 'secado' AND p.categoria = 'secado' AND p.activo;
    v_duracion_secado := nullif(v_raw_detail->>'duracionMinutosReal', '')::numeric;
    IF v_programa_secado.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Admin debe configurar y validar el tiempo del proceso de secado antes de avanzar.';
    END IF;
    IF v_duracion_secado IS NULL OR v_duracion_secado <= 0 OR v_duracion_secado > 600
       OR v_duracion_secado < v_programa_secado.duracion_minutos THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Registra un secado igual o superior al tiempo mínimo validado por la clínica.';
    END IF;
    IF coalesce((v_raw_detail->>'pistolaOperativa')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Confirma la operatividad del equipo de secado antes de avanzar.';
    END IF;
    v_detail := jsonb_build_object(
      'pistolaOperativa', true,
      'duracionMinutosReal', v_duracion_secado,
      'duracionMinutosObjetivo', v_programa_secado.duracion_minutos
    );
  END IF;
  IF v_step = 6 AND (v_raw_detail->>'indicadoresTipo1Aprobados') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Registra si todos los indicadores tipo 1 aprobaron o fallaron.';
  END IF;
  IF v_step = 6 THEN
    v_tipo1_aprobado := (v_raw_detail->>'indicadoresTipo1Aprobados')::boolean;
    v_detail := jsonb_build_object('indicadoresTipo1Aprobados', v_tipo1_aprobado);
  END IF;
  SELECT count(*) INTO v_count FROM public.esterilizacion_ciclo_instrumentos ci
  WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso';
  IF v_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El ciclo no contiene instrumental en proceso.';
  END IF;
  IF v_step = 2 THEN
    v_result := public.bp10_consumir_insumos_esterilizacion(v_clinica_id, v_cycle, NULL, ARRAY['prelavado'], v_key, v_count::smallint);
  ELSIF v_step = 4 THEN
    v_result := public.bp10_consumir_insumos_esterilizacion(v_clinica_id, v_cycle, NULL, ARRAY['enjuague'], v_key, v_count::smallint);
  ELSIF v_step = 6 THEN
    v_result := public.bp10_consumir_insumos_esterilizacion(v_clinica_id, v_cycle, NULL, ARRAY['bolsa', 'indicador_tipo1'], v_key, v_count::smallint);
    UPDATE public.esterilizacion_ciclo_instrumentos ci
    SET indicador_tipo1_aprobado = v_tipo1_aprobado
    WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso';
  END IF;
  UPDATE public.esterilizacion_pasos s
  SET estado = 'completado', detalle = v_detail, completado_por = v_user_id, completado_at = now(),
      completion_key = v_key, completion_fingerprint = v_fingerprint
  WHERE s.id = v_step_row.id AND s.clinica_id = v_clinica_id AND s.estado = 'en_curso';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'El paso cambió en paralelo; vuelve a cargar el ciclo.'; END IF;
  IF v_step = 6 AND v_tipo1_aprobado IS DISTINCT FROM true THEN
    UPDATE public.esterilizacion_ciclos c
    SET estado = 'rechazado', finalizado_at = now(), updated_at = now()
    WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id;
    UPDATE public.esterilizacion_ciclo_instrumentos ci SET estado = 'retenido'
    WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso';
    UPDATE public.inventario i SET estado_instrumental = 'retenido'
    WHERE i.clinica_id = v_clinica_id AND i.id IN (
      SELECT ci.inventario_id FROM public.esterilizacion_ciclo_instrumentos ci
      WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'retenido'
    );
  END IF;
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_cycle, v_user_id,
    CASE WHEN v_step = 6 AND v_tipo1_aprobado IS DISTINCT FROM true THEN 'indicador_tipo1_rechazado' ELSE 'paso_completado' END,
    jsonb_build_object('numero', v_step, 'resultadoTipo1', CASE WHEN v_step = 6 THEN v_tipo1_aprobado ELSE NULL END));
  RETURN jsonb_build_object(
    'cicloId', v_cycle, 'numero', v_step, 'consumos', coalesce(v_result, '{}'::jsonb),
    'estado', CASE WHEN v_step = 6 AND v_tipo1_aprobado IS DISTINCT FROM true THEN 'rechazado' ELSE 'preparacion' END,
    'replayed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.bp10_iniciar_paso_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_step smallint := nullif(p_payload->>'numero', '')::smallint;
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_fp text;
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
  v_existing public.esterilizacion_pasos%ROWTYPE;
  v_active public.esterilizacion_pasos%ROWTYPE;
  v_next smallint;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para iniciar un paso del protocolo.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_cycle IS NULL OR v_key IS NULL
     OR v_step IS NULL OR v_step NOT BETWEEN 2 AND 6 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Número de paso inválido.';
  END IF;
  v_fp := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT s.* INTO v_existing FROM public.esterilizacion_pasos s
  WHERE s.clinica_id = v_clinica_id AND s.idempotency_key = v_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.idempotency_fingerprint IS DISTINCT FROM v_fp OR v_existing.ciclo_id <> v_cycle OR v_existing.numero <> v_step THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'cicloId', v_cycle, 'numero', v_step, 'replayed', true);
  END IF;
  SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id FOR UPDATE;
  IF v_cycle_row.id IS NULL OR v_cycle_row.estado <> 'preparacion' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El ciclo no está disponible para preparar pasos.';
  END IF;
  SELECT s.* INTO v_active FROM public.esterilizacion_pasos s
  WHERE s.clinica_id = v_clinica_id AND s.ciclo_id = v_cycle AND s.estado = 'en_curso'
  ORDER BY s.numero DESC LIMIT 1 FOR UPDATE;
  IF v_active.id IS NOT NULL THEN
    IF v_active.numero = v_step THEN
      RETURN jsonb_build_object('id', v_active.id, 'cicloId', v_cycle, 'numero', v_step, 'reanudado', true);
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Completa el paso que está en curso antes de iniciar otro.';
  END IF;
  SELECT coalesce(max(s.numero), 0) + 1 INTO v_next
  FROM public.esterilizacion_pasos s
  WHERE s.ciclo_id = v_cycle AND s.clinica_id = v_clinica_id AND s.estado = 'completado';
  IF v_step <> v_next THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Inicia los pasos en orden, sin saltos.';
  END IF;
  IF v_step = 5 AND NOT EXISTS (
    SELECT 1 FROM public.esterilizacion_programas p
    WHERE p.clinica_id = v_clinica_id AND p.codigo = 'secado'
      AND p.categoria = 'secado' AND p.activo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Admin debe configurar y validar el proceso de secado antes de iniciar este paso.';
  END IF;
  INSERT INTO public.esterilizacion_pasos (
    clinica_id, ciclo_id, numero, estado, detalle, actor_user_id,
    idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_clinica_id, v_cycle, v_step, 'en_curso', '{}'::jsonb, v_user_id, v_key, v_fp
  ) RETURNING id INTO v_id;
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_cycle, v_user_id, 'paso_iniciado', jsonb_build_object('numero', v_step));
  RETURN jsonb_build_object('id', v_id, 'cicloId', v_cycle, 'numero', v_step, 'replayed', false);
END;
$function$;
ALTER FUNCTION public.bp10_iniciar_paso_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_iniciar_paso_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_iniciar_paso_esterilizacion(jsonb) TO authenticated;

ALTER FUNCTION public.bp10_completar_paso_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_completar_paso_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_completar_paso_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_iniciar_autoclave_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_override text := nullif(btrim(p_payload->>'justificacionBowie'), '');
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
  v_last_bowie text;
  v_local_date date;
  v_zone text;
  v_result jsonb;
  v_existing uuid;
  v_existing_fingerprint text;
  v_fp text;
  v_id uuid := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para iniciar el autoclave.';
  END IF;
  IF v_cycle IS NULL OR v_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Inicio de ciclo inválido.';
  END IF;
  v_fp := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT s.id, s.idempotency_fingerprint INTO v_existing, v_existing_fingerprint FROM public.esterilizacion_pasos s
  WHERE s.clinica_id = v_clinica_id AND s.idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
    END IF;
    RETURN jsonb_build_object('cicloId', v_cycle, 'replayed', true);
  END IF;
  SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id FOR UPDATE;
  IF v_cycle_row.id IS NULL OR v_cycle_row.estado <> 'preparacion'
     OR (SELECT count(*) FROM public.esterilizacion_pasos s WHERE s.clinica_id = v_clinica_id AND s.ciclo_id = v_cycle AND s.estado = 'completado' AND s.numero BETWEEN 1 AND 6) <> 6 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Completa los pasos 1 a 6 antes de iniciar el autoclave.';
  END IF;
  SELECT coalesce(c.zona_horaria, 'America/Santiago') INTO v_zone FROM public.clinicas c WHERE c.id = v_clinica_id;
  v_local_date := (now() AT TIME ZONE v_zone)::date;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventario i
    WHERE i.id = v_cycle_row.equipo_id AND i.clinica_id = v_clinica_id
      AND i.tipo_item = 'equipamiento' AND i.categoria = 'Esterilización' AND i.estado_catalogo = 'activo'
      AND (i.proxima_mantencion IS NULL OR i.proxima_mantencion >= v_local_date)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El autoclave está inactivo o su mantención registrada está vencida.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.esterilizacion_programas p
    WHERE p.clinica_id = v_clinica_id AND p.codigo = 'bowie_dick'
      AND p.categoria = 'prueba_diaria' AND p.activo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El protocolo Bowie-Dick no está activado y validado por la clínica.';
  END IF;
  SELECT t.estado INTO v_last_bowie
  FROM public.esterilizacion_pruebas t
  WHERE t.clinica_id = v_clinica_id AND t.equipo_id = v_cycle_row.equipo_id
    AND t.tipo = 'bowie_dick' AND (t.observado_at AT TIME ZONE v_zone)::date = v_local_date
  ORDER BY t.observado_at DESC, t.created_at DESC LIMIT 1;
  IF v_last_bowie IS DISTINCT FROM 'aprobado' THEN
    IF public.rol_en_clinica_actual() <> 'admin'::public.app_role OR char_length(coalesce(v_override, '')) < 10 THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Bowie-Dick del día no aprobado para este autoclave; solo Admin puede continuar con justificación.';
    END IF;
    UPDATE public.esterilizacion_ciclos c SET motivo_override_bowie = v_override
    WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id;
  ELSIF v_override IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se admite override cuando Bowie-Dick está aprobado.';
  END IF;
  v_result := public.bp10_consumir_insumos_esterilizacion(v_clinica_id, v_cycle, NULL, ARRAY['indicador_tipo4'], v_key, 1);
  INSERT INTO public.esterilizacion_pasos (
    clinica_id, ciclo_id, numero, estado, detalle, actor_user_id,
    idempotency_key, idempotency_fingerprint
  ) VALUES (
    v_clinica_id, v_cycle, 7, 'en_curso', jsonb_build_object('autoclaveIniciado', true),
    v_user_id, v_key, v_fp
  );
  UPDATE public.esterilizacion_ciclos c SET estado = 'en_curso', updated_at = now()
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id;
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_cycle, v_user_id, 'autoclave_iniciado', jsonb_build_object('overrideBowie', v_override IS NOT NULL));
  RETURN jsonb_build_object('cicloId', v_cycle, 'consumos', v_result, 'replayed', false);
END;
$function$;
ALTER FUNCTION public.bp10_iniciar_autoclave_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_iniciar_autoclave_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_iniciar_autoclave_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_finalizar_ciclo_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_resultado text := p_payload->>'indicadorTipo4';
  v_temp numeric := nullif(p_payload->>'temperaturaObservada', '')::numeric;
  v_pressure numeric := nullif(p_payload->>'presionObservada', '')::numeric;
  v_duration numeric := nullif(p_payload->>'duracionObservadaMinutos', '')::numeric;
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
  v_existing uuid;
  v_existing_fp text;
  v_fp text;
  v_released_count integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para finalizar este ciclo.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_cycle IS NULL OR v_key IS NULL
     OR v_resultado IS NULL OR v_resultado NOT IN ('aprobado', 'rechazado')
     OR v_temp IS NULL OR v_temp < 0 OR v_pressure IS NULL OR v_pressure < 0
     OR v_duration IS NULL OR v_duration <= 0 OR v_duration > 600 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Registra mediciones observadas y el resultado del indicador tipo 4.';
  END IF;
  v_fp := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT c.id, c.finalization_fingerprint INTO v_existing, v_existing_fp
  FROM public.esterilizacion_ciclos c
  WHERE c.clinica_id = v_clinica_id AND c.finalization_idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    IF v_existing_fp IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
    END IF;
    RETURN jsonb_build_object('cicloId', v_existing, 'estado', 'finalizado', 'replayed', true);
  END IF;
  SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id FOR UPDATE;
  IF v_cycle_row.id IS NULL OR v_cycle_row.estado <> 'en_curso' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El ciclo no está en curso.';
  END IF;
  UPDATE public.esterilizacion_pasos s
  SET estado = 'completado', completado_por = v_user_id, detalle = jsonb_build_object(
        'temperaturaObservada', v_temp,
        'presionObservada', v_pressure,
        'duracionObservadaMinutos', v_duration,
        'indicadorTipo4', v_resultado
      ), completado_at = now()
  WHERE s.clinica_id = v_clinica_id AND s.ciclo_id = v_cycle AND s.numero = 7 AND s.estado = 'en_curso';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se encontró el paso 7 en curso.'; END IF;
  UPDATE public.esterilizacion_ciclos c
  SET estado = CASE WHEN v_resultado = 'aprobado' THEN 'liberado' ELSE 'rechazado' END,
      temperatura_observada = v_temp, presion_observada = v_pressure,
      duracion_observada_minutos = v_duration, indicador_tipo4 = v_resultado,
      finalizado_at = now(), finalization_idempotency_key = v_key,
      finalization_fingerprint = v_fp, updated_at = now()
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id;
  IF v_resultado = 'aprobado' THEN
    UPDATE public.esterilizacion_ciclo_instrumentos ci
    SET estado = 'disponible', liberado_at = now()
    WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso'
      AND ci.indicador_tipo1_aprobado = true;
    GET DIAGNOSTICS v_released_count = ROW_COUNT;
    UPDATE public.inventario i SET estado_instrumental = 'disponible'
    WHERE i.clinica_id = v_clinica_id AND i.id IN (
      SELECT ci.inventario_id FROM public.esterilizacion_ciclo_instrumentos ci
      WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'disponible'
    );
    IF v_released_count = 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se liberó instrumental: falta el indicador tipo 1.'; END IF;
  ELSE
    UPDATE public.esterilizacion_ciclo_instrumentos ci SET estado = 'retenido'
    WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso';
    UPDATE public.inventario i SET estado_instrumental = 'retenido'
    WHERE i.clinica_id = v_clinica_id AND i.id IN (
      SELECT ci.inventario_id FROM public.esterilizacion_ciclo_instrumentos ci
      WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'retenido'
    );
  END IF;
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_cycle, v_user_id,
    CASE WHEN v_resultado = 'aprobado' THEN 'ciclo_liberado' ELSE 'ciclo_rechazado' END,
    jsonb_build_object('indicadorTipo4', v_resultado, 'instrumentosLiberados', v_released_count));
  RETURN jsonb_build_object('cicloId', v_cycle, 'estado', CASE WHEN v_resultado = 'aprobado' THEN 'liberado' ELSE 'rechazado' END, 'instrumentosLiberados', v_released_count);
END;
$function$;
ALTER FUNCTION public.bp10_finalizar_ciclo_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_finalizar_ciclo_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_finalizar_ciclo_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_cancelar_ciclo_esterilizacion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_reason text := nullif(btrim(p_payload->>'justificacion'), '');
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('ciclos.operar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para cancelar este ciclo.';
  END IF;
  IF v_cycle IS NULL OR char_length(coalesce(v_reason, '')) < 5 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La cancelación requiere una justificación.';
  END IF;
  SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id FOR UPDATE;
  IF v_cycle_row.id IS NULL OR v_cycle_row.estado NOT IN ('preparacion', 'en_curso') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Solo puede cancelarse un ciclo en preparación o en curso.';
  END IF;
  UPDATE public.esterilizacion_ciclos c
  SET estado = 'cancelado', motivo_cancelacion = v_reason, finalizado_at = now(), updated_at = now()
  WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id;
  UPDATE public.esterilizacion_ciclo_instrumentos ci SET estado = 'retenido'
  WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'en_proceso';
  UPDATE public.inventario i SET estado_instrumental = 'retenido'
  WHERE i.clinica_id = v_clinica_id AND i.id IN (
    SELECT ci.inventario_id FROM public.esterilizacion_ciclo_instrumentos ci
    WHERE ci.ciclo_id = v_cycle AND ci.clinica_id = v_clinica_id AND ci.estado = 'retenido'
  );
  INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
  VALUES (v_clinica_id, v_cycle, v_user_id, 'ciclo_cancelado', jsonb_build_object('justificacion', v_reason));
  RETURN jsonb_build_object('cicloId', v_cycle, 'estado', 'cancelado');
END;
$function$;
ALTER FUNCTION public.bp10_cancelar_ciclo_esterilizacion(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_cancelar_ciclo_esterilizacion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_cancelar_ciclo_esterilizacion(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_registrar_prueba_biologica(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_action text := coalesce(p_payload->>'accion', 'iniciar');
  v_id uuid := nullif(p_payload->>'pruebaId', '')::uuid;
  v_cycle uuid := nullif(p_payload->>'cicloId', '')::uuid;
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_result text := p_payload->>'resultado';
  v_row public.esterilizacion_pruebas%ROWTYPE;
  v_cycle_row public.esterilizacion_ciclos%ROWTYPE;
  v_existing_fp text;
  v_existing uuid;
  v_fp text;
  v_zone text;
  v_week_start timestamp without time zone;
  v_marca text := nullif(btrim(p_payload->>'marcaIndicador'), '');
  v_consumption jsonb;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('pruebas.registrar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para registrar indicadores biológicos.';
  END IF;
  IF v_action = 'iniciar' THEN
    IF v_cycle IS NULL OR v_key IS NULL OR v_marca IS NULL OR char_length(v_marca) > 120 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Indica el ciclo, el lote del indicador y una llave de idempotencia.';
    END IF;
    v_fp := md5((p_payload - 'idempotencyKey')::text);
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
    SELECT t.id, t.idempotency_fingerprint INTO v_existing, v_existing_fp FROM public.esterilizacion_pruebas t
    WHERE t.clinica_id = v_clinica_id AND t.idempotency_key = v_key;
    IF v_existing IS NOT NULL THEN
      IF v_existing_fp IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otros datos.';
      END IF;
      RETURN jsonb_build_object('id', v_existing, 'replayed', true);
    END IF;
    SELECT c.* INTO v_cycle_row FROM public.esterilizacion_ciclos c
    WHERE c.id = v_cycle AND c.clinica_id = v_clinica_id AND c.estado = 'liberado';
    IF v_cycle_row.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El indicador biológico requiere un ciclo liberado de esta clínica.'; END IF;
    SELECT coalesce(c.zona_horaria, 'America/Santiago') INTO v_zone
    FROM public.clinicas c WHERE c.id = v_clinica_id;
    v_zone := coalesce(v_zone, 'America/Santiago');
    v_week_start := date_trunc('week', now() AT TIME ZONE v_zone);
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      v_clinica_id::text || ':bio:' || v_cycle_row.equipo_id::text || ':' || v_week_start::date::text, 0
    ));
    IF EXISTS (
      SELECT 1 FROM public.esterilizacion_pruebas t
      WHERE t.clinica_id = v_clinica_id AND t.equipo_id = v_cycle_row.equipo_id
        AND t.tipo = 'biologico'
        AND (t.observado_at AT TIME ZONE v_zone) >= v_week_start
        AND (t.observado_at AT TIME ZONE v_zone) < v_week_start + interval '1 week'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Ya existe una prueba biológica registrada para este autoclave durante la semana local.';
    END IF;
    INSERT INTO public.esterilizacion_pruebas (
      clinica_id, tipo, equipo_id, ciclo_id, estado, marca_indicador, horas_incubacion,
      observacion, creado_por, idempotency_key, idempotency_fingerprint
    ) VALUES (
      v_clinica_id, 'biologico', v_cycle_row.equipo_id, v_cycle, 'pendiente',
      v_marca,
      nullif(p_payload->>'horasIncubacion', '')::numeric,
      left(coalesce(p_payload->>'observacion', ''), 1000),
      v_user_id, v_key, v_fp
    ) RETURNING id INTO v_id;
    v_consumption := public.bp10_consumir_insumos_esterilizacion(
      v_clinica_id, NULL, v_id, ARRAY['indicador_biologico'], v_key, 1
    );
    INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
    VALUES (v_clinica_id, v_cycle, v_user_id, 'indicador_biologico_iniciado', jsonb_build_object('pruebaId', v_id));
    RETURN jsonb_build_object('id', v_id, 'estado', 'pendiente', 'consumos', v_consumption, 'replayed', false);
  ELSIF v_action = 'leer' THEN
    IF v_id IS NULL OR v_result IS NULL OR v_result NOT IN ('aprobado', 'rechazado') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Lectura biológica inválida.';
    END IF;
    SELECT t.* INTO v_row FROM public.esterilizacion_pruebas t
    WHERE t.id = v_id AND t.clinica_id = v_clinica_id AND t.tipo = 'biologico'
    FOR UPDATE;
    IF v_row.id IS NULL OR v_row.estado <> 'pendiente' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La prueba no está pendiente o no pertenece a esta clínica.';
    END IF;
    UPDATE public.esterilizacion_pruebas t
    SET estado = v_result, resultado_at = now(), leido_por = v_user_id,
        observacion = CASE WHEN p_payload ? 'observacion' THEN left(coalesce(p_payload->>'observacion', ''), 1000) ELSE t.observacion END
    WHERE t.id = v_id AND t.clinica_id = v_clinica_id;
    IF v_result = 'rechazado' THEN
      UPDATE public.esterilizacion_ciclos c SET estado = 'retenido_biologico', updated_at = now()
      WHERE c.id = v_row.ciclo_id AND c.clinica_id = v_clinica_id AND c.estado = 'liberado';
      UPDATE public.esterilizacion_ciclo_instrumentos ci SET estado = 'retenido'
      WHERE ci.ciclo_id = v_row.ciclo_id AND ci.clinica_id = v_clinica_id AND ci.estado = 'disponible';
      UPDATE public.inventario i SET estado_instrumental = 'retenido'
      WHERE i.clinica_id = v_clinica_id AND i.id IN (
        SELECT ci.inventario_id FROM public.esterilizacion_ciclo_instrumentos ci
        WHERE ci.ciclo_id = v_row.ciclo_id AND ci.clinica_id = v_clinica_id AND ci.estado = 'retenido'
      );
    END IF;
    INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
    VALUES (v_clinica_id, v_row.ciclo_id, v_user_id,
      CASE WHEN v_result = 'aprobado' THEN 'indicador_biologico_aprobado' ELSE 'indicador_biologico_rechazado' END,
      jsonb_build_object('pruebaId', v_id));
    RETURN jsonb_build_object('id', v_id, 'estado', v_result);
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Acción biológica no permitida.';
  END IF;
END;
$function$;
ALTER FUNCTION public.bp10_registrar_prueba_biologica(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_registrar_prueba_biologica(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_registrar_prueba_biologica(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_vincular_instrumental_tratamiento(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_patient uuid := nullif(p_payload->>'pacienteId', '')::uuid;
  v_treatment text := nullif(btrim(p_payload->>'tratamientoRef'), '');
  v_key uuid := nullif(p_payload->>'idempotencyKey', '')::uuid;
  v_ids uuid[];
  v_item uuid;
  v_role public.app_role;
  v_count integer;
  v_existing integer;
  v_existing_fp text;
  v_fingerprint text;
  v_patient_doctor uuid;
  v_record uuid;
  v_instrument record;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL OR NOT public.puede_operar_esterilizacion('trazabilidad.registrar') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tienes permiso para asociar instrumental a un tratamiento.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_patient IS NULL OR v_key IS NULL
     OR char_length(coalesce(v_treatment, '')) < 1 OR char_length(v_treatment) > 200
     OR jsonb_typeof(p_payload->'instrumentoCicloIds') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Trazabilidad de tratamiento incompleta.';
  END IF;
  SELECT array_agg(x.value::uuid), count(*) INTO v_ids, v_count
  FROM jsonb_array_elements_text(p_payload->'instrumentoCicloIds') x(value);
  IF v_count < 1 OR v_count > 50 OR (SELECT count(DISTINCT x.value::uuid) FROM jsonb_array_elements_text(p_payload->'instrumentoCicloIds') x(value)) <> v_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selecciona entre 1 y 50 instrumentos únicos.';
  END IF;
  v_fingerprint := md5((p_payload - 'idempotencyKey')::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_clinica_id::text || ':' || v_key::text, 0));
  SELECT count(*), min(u.idempotency_fingerprint) INTO v_existing, v_existing_fp
  FROM public.esterilizacion_usos u
  WHERE u.clinica_id = v_clinica_id AND u.idempotency_key = v_key;
  IF v_existing > 0 THEN
    IF v_existing <> v_count OR v_existing_fp IS DISTINCT FROM v_fingerprint OR EXISTS (
      SELECT 1 FROM public.esterilizacion_usos u
      WHERE u.clinica_id = v_clinica_id AND u.idempotency_key = v_key
        AND u.idempotency_fingerprint IS DISTINCT FROM v_fingerprint
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'La llave de idempotencia ya se usó con otra trazabilidad.';
    END IF;
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'instrumentos', v_existing);
  END IF;
  SELECT p.doctor_tratante_id INTO v_patient_doctor
  FROM public.pacientes p
  WHERE p.id = v_patient AND p.clinica_id = v_clinica_id AND p.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Paciente no disponible en esta clínica.'; END IF;
  v_role := public.rol_en_clinica_actual();
  IF v_role = 'dentista'::public.app_role AND v_patient_doctor IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El paciente no está asignado a este profesional.';
  END IF;
  FOREACH v_item IN ARRAY v_ids LOOP
    SELECT ci.id, ci.estado, ci.ciclo_id, ci.inventario_id
      INTO v_instrument
    FROM public.esterilizacion_ciclo_instrumentos ci
    WHERE ci.id = v_item AND ci.clinica_id = v_clinica_id
    FOR UPDATE;
    IF v_instrument.id IS NULL OR v_instrument.estado <> 'disponible' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Un instrumento ya no está disponible o no pertenece a esta clínica.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.esterilizacion_ciclos c
      WHERE c.id = v_instrument.ciclo_id AND c.clinica_id = v_clinica_id AND c.estado = 'liberado'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El ciclo del instrumental no está liberado.';
    END IF;
    INSERT INTO public.esterilizacion_usos (
      clinica_id, ciclo_instrumento_id, paciente_id, tratamiento_ref, profesional_id,
      idempotency_key, idempotency_fingerprint
    ) VALUES (
      v_clinica_id, v_item, v_patient, v_treatment, v_user_id, v_key, v_fingerprint
    ) RETURNING id INTO v_record;
    UPDATE public.esterilizacion_ciclo_instrumentos ci SET estado = 'usado'
    WHERE ci.id = v_item AND ci.clinica_id = v_clinica_id AND ci.estado = 'disponible';
    UPDATE public.inventario i SET estado_instrumental = 'usado'
    WHERE i.id = v_instrument.inventario_id AND i.clinica_id = v_clinica_id;
    INSERT INTO public.esterilizacion_eventos (clinica_id, ciclo_id, actor_user_id, evento, detalle)
    VALUES (v_clinica_id, v_instrument.ciclo_id, v_user_id, 'instrumental_vinculado_tratamiento',
      jsonb_build_object('usoId', v_record, 'pacienteId', v_patient, 'tratamientoRef', v_treatment));
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'replayed', false, 'instrumentos', v_count);
END;
$function$;
ALTER FUNCTION public.bp10_vincular_instrumental_tratamiento(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_vincular_instrumental_tratamiento(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_vincular_instrumental_tratamiento(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.bp10_listar_instrumental_disponible()
RETURNS TABLE (
  ciclo_instrumento_id uuid,
  inventario_id uuid,
  nombre text,
  codigo text,
  numero_serie text,
  lote text,
  programa text,
  liberado_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT ci.id, i.id, i.nombre, i.codigo, i.numero_serie,
         ci.lote_snapshot, ci.programa_snapshot, ci.liberado_at
  FROM public.esterilizacion_ciclo_instrumentos ci
  JOIN public.inventario i ON i.id = ci.inventario_id AND i.clinica_id = ci.clinica_id
  WHERE ci.clinica_id = public.clinica_actual()
    AND ci.estado = 'disponible'
    AND public.puede_operar_esterilizacion('instrumental.ver')
  ORDER BY ci.liberado_at ASC, i.nombre ASC;
$function$;
ALTER FUNCTION public.bp10_listar_instrumental_disponible() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_listar_instrumental_disponible() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp10_listar_instrumental_disponible() TO authenticated;

ALTER TABLE public.evoluciones_clinicas
  ADD COLUMN IF NOT EXISTS tratamiento_ref text;
ALTER TABLE public.evoluciones_clinicas
  DROP CONSTRAINT IF EXISTS evoluciones_clinicas_bp10_tratamiento_ref_check;
ALTER TABLE public.evoluciones_clinicas
  ADD CONSTRAINT evoluciones_clinicas_bp10_tratamiento_ref_check
  CHECK (tipo <> 'tratamiento_realizado' OR char_length(btrim(coalesce(tratamiento_ref, ''))) BETWEEN 1 AND 200) NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS evoluciones_clinicas_bp10_tratamiento_uidx
  ON public.evoluciones_clinicas (clinica_id, paciente_id, tratamiento_ref)
  WHERE tipo = 'tratamiento_realizado';

CREATE OR REPLACE FUNCTION public.bp10_exigir_trazabilidad_antes_de_cerrar_tratamiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
BEGIN
  IF NEW.tipo = 'tratamiento_realizado' THEN
    IF v_user_id IS NULL OR v_clinica_id IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica_id
       OR NEW.paciente_id IS NULL OR NEW.user_id IS DISTINCT FROM v_user_id
       OR char_length(btrim(coalesce(NEW.tratamiento_ref, ''))) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El registro del tratamiento requiere una sesión, paciente, clínica y referencia autorizados.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.esterilizacion_usos u
      JOIN public.pacientes p
        ON p.id = u.paciente_id AND p.clinica_id = u.clinica_id
      WHERE u.clinica_id = v_clinica_id
        AND u.paciente_id = NEW.paciente_id
        AND u.tratamiento_ref = NEW.tratamiento_ref
        AND u.profesional_id = v_user_id
        AND p.deleted_at IS NULL
        AND (
          public.rol_en_clinica_actual() <> 'dentista'::public.app_role
          OR p.doctor_tratante_id = v_user_id
        )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Vincula instrumental esterilizado y liberado al paciente antes de cerrar el tratamiento.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.bp10_exigir_trazabilidad_antes_de_cerrar_tratamiento() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_exigir_trazabilidad_antes_de_cerrar_tratamiento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bp10_evolucion_trazabilidad_required ON public.evoluciones_clinicas;
CREATE TRIGGER bp10_evolucion_trazabilidad_required
  BEFORE INSERT OR UPDATE OF tipo, tratamiento_ref, paciente_id, clinica_id ON public.evoluciones_clinicas
  FOR EACH ROW EXECUTE FUNCTION public.bp10_exigir_trazabilidad_antes_de_cerrar_tratamiento();
COMMENT ON FUNCTION public.bp10_exigir_trazabilidad_antes_de_cerrar_tratamiento() IS
  'Bloquea la sincronización de una evolución de tratamiento realizado si falta su vínculo paciente-instrumental de la clínica actual.';

CREATE OR REPLACE FUNCTION public.bp10_exigir_trazabilidad_plan_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid := public.clinica_actual();
  v_role public.app_role;
  v_new_plan jsonb := coalesce(NEW.plan_tratamiento, '{}'::jsonb);
  v_old_plan jsonb := '{}'::jsonb;
  v_procedimiento jsonb;
  v_tratamiento_ref text;
BEGIN
  IF v_user_id IS NULL OR v_clinica_id IS NULL
     OR NEW.clinica_id IS DISTINCT FROM v_clinica_id OR NEW.paciente_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La ficha clínica no pertenece a la sesión y clínica activas.';
  END IF;
  IF jsonb_typeof(v_new_plan) IS DISTINCT FROM 'object'
     OR (v_new_plan ? 'fases' AND jsonb_typeof(v_new_plan->'fases') IS DISTINCT FROM 'array')
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(coalesce(v_new_plan->'fases', '[]'::jsonb)) AS f(value)
       WHERE f.value ? 'procedimientos'
         AND jsonb_typeof(f.value->'procedimientos') IS DISTINCT FROM 'array'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El plan clínico debe contener fases y procedimientos con estructura válida.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_old_plan := coalesce(OLD.plan_tratamiento, '{}'::jsonb);
  END IF;

  -- Una vez realizado, el procedimiento y su referencia quedan inmutables.
  FOR v_procedimiento IN
    SELECT proc.value
    FROM jsonb_array_elements(coalesce(v_old_plan->'fases', '[]'::jsonb)) AS fase(value)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(fase.value->'procedimientos', '[]'::jsonb)) AS proc(value)
    WHERE proc.value->>'estado' = 'realizado'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_new_plan->'fases', '[]'::jsonb)) AS fase(value)
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(fase.value->'procedimientos', '[]'::jsonb)) AS proc(value)
      WHERE proc.value->>'estado' = 'realizado'
        AND proc.value->>'id' = v_procedimiento->>'id'
        AND proc.value = v_procedimiento
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Un tratamiento realizado no puede eliminarse ni alterarse.';
    END IF;
  END LOOP;

  v_role := public.rol_en_clinica_actual();
  FOR v_procedimiento IN
    SELECT proc.value
    FROM jsonb_array_elements(coalesce(v_new_plan->'fases', '[]'::jsonb)) AS fase(value)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(fase.value->'procedimientos', '[]'::jsonb)) AS proc(value)
    WHERE proc.value->>'estado' = 'realizado'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(v_old_plan->'fases', '[]'::jsonb)) AS old_fase(value)
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(old_fase.value->'procedimientos', '[]'::jsonb)) AS old_proc(value)
        WHERE old_proc.value->>'estado' = 'realizado'
          AND old_proc.value->>'id' = proc.value->>'id'
          AND old_proc.value = proc.value
      )
  LOOP
    v_tratamiento_ref := nullif(btrim(v_procedimiento->>'id'), '');
    IF v_tratamiento_ref IS NULL OR char_length(v_tratamiento_ref) > 200
       OR v_role IS NULL OR v_role NOT IN ('admin'::public.app_role, 'dentista'::public.app_role) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo administración o un dentista autorizado puede cerrar un tratamiento.';
    END IF;
    IF v_role = 'dentista'::public.app_role AND NOT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = NEW.paciente_id AND p.clinica_id = v_clinica_id
        AND p.doctor_tratante_id = v_user_id AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El paciente no está asignado a este dentista.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.esterilizacion_usos u
      WHERE u.clinica_id = v_clinica_id
        AND u.paciente_id = NEW.paciente_id
        AND u.tratamiento_ref = v_tratamiento_ref
        AND u.profesional_id = v_user_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.evoluciones_clinicas e
      WHERE e.clinica_id = v_clinica_id
        AND e.paciente_id = NEW.paciente_id
        AND e.tratamiento_ref = v_tratamiento_ref
        AND e.tipo = 'tratamiento_realizado'
        AND e.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Registra la trazabilidad de instrumental y la evolución clínica sincronizada antes de cerrar el tratamiento.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.bp10_exigir_trazabilidad_plan_ficha() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bp10_exigir_trazabilidad_plan_ficha() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bp10_plan_tratamiento_trazabilidad_required ON public.fichas_clinicas;
CREATE TRIGGER bp10_plan_tratamiento_trazabilidad_required
  BEFORE INSERT OR UPDATE OF plan_tratamiento, paciente_id, clinica_id ON public.fichas_clinicas
  FOR EACH ROW EXECUTE FUNCTION public.bp10_exigir_trazabilidad_plan_ficha();
COMMENT ON FUNCTION public.bp10_exigir_trazabilidad_plan_ficha() IS
  'Impide marcar un procedimiento realizado sin instrumental esterilizado y evolución sincronizada, y mantiene inmutable el cierre clínico.';

-- La publicación habilita que la aplicación invalide caches de ciclos y pruebas.
DO $publication$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY[
      'esterilizacion_programas', 'esterilizacion_insumos_config',
      'esterilizacion_ciclos', 'esterilizacion_ciclo_instrumentos',
      'esterilizacion_pasos', 'esterilizacion_pruebas', 'esterilizacion_usos', 'esterilizacion_eventos'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END;
$publication$;

COMMENT ON TABLE public.esterilizacion_ciclos IS
  'Registro de ciclos de esterilización BP10. Los parámetros iniciales no se consideran validados hasta activación administrativa con referencia del fabricante.';
COMMENT ON TABLE public.esterilizacion_eventos IS
  'Bitácora append-only generada por RPCs BP10; actor y clínica vienen del contexto autenticado del servidor.';
COMMENT ON FUNCTION public.bp10_vincular_instrumental_tratamiento(jsonb) IS
  'Vincula instrumental liberado y de la clínica actual al paciente/tratamiento antes del cierre clínico.';
