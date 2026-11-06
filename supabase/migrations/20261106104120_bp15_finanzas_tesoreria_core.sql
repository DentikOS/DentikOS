-- BP15 CORE. Additive migration: no historical local records are inferred or backfilled.
BEGIN;

CREATE SCHEMA IF NOT EXISTS bp15_private;
REVOKE ALL ON SCHEMA bp15_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA bp15_private TO postgres, service_role;

-- Composite unique keys make cross-clinic references impossible even when an ID is known.
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_bp15_clinica_id_id_uq
  ON public.pacientes (clinica_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_bp15_clinica_id_id_moneda_uq
  ON public.pagos (clinica_id, id, moneda);

CREATE TABLE public.bp15_caja_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  fecha_operacion date NOT NULL DEFAULT (timezone('America/Santiago', clock_timestamp()))::date,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  monto_apertura_minor bigint NOT NULL CHECK (monto_apertura_minor >= 0),
  abierta_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  abierta_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  cerrada_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cerrada_en timestamptz,
  conteo_denominaciones jsonb,
  monto_contado_minor bigint,
  diferencia_minor bigint,
  motivo_diferencia text,
  cierre_idempotency_key uuid,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, idempotency_key),
  UNIQUE (clinica_id, moneda, fecha_operacion),
  CHECK (
    (estado = 'abierta' AND cerrada_por IS NULL AND cerrada_en IS NULL
      AND conteo_denominaciones IS NULL AND monto_contado_minor IS NULL
      AND diferencia_minor IS NULL AND cierre_idempotency_key IS NULL)
    OR
    (estado = 'cerrada' AND cerrada_por IS NOT NULL AND cerrada_en IS NOT NULL
      AND jsonb_typeof(conteo_denominaciones) = 'array'
      AND monto_contado_minor IS NOT NULL AND monto_contado_minor >= 0
      AND diferencia_minor IS NOT NULL AND cierre_idempotency_key IS NOT NULL)
  )
);
CREATE UNIQUE INDEX bp15_caja_una_sesion_abierta_por_moneda
  ON public.bp15_caja_sesiones (clinica_id, moneda) WHERE estado = 'abierta';

CREATE TABLE public.bp15_caja_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  caja_sesion_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('apertura', 'cierre', 'reversion')),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(datos) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, caja_sesion_id)
    REFERENCES public.bp15_caja_sesiones (clinica_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.bp15_caja_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  caja_sesion_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'reversion')),
  monto_minor bigint NOT NULL CHECK (monto_minor > 0),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  origen_tipo text NOT NULL CHECK (origen_tipo IN ('pago', 'gasto', 'reversion')),
  pago_id uuid,
  gasto_id uuid,
  reversion_de_movimiento_id uuid,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, caja_sesion_id, moneda)
    REFERENCES public.bp15_caja_sesiones (clinica_id, id, moneda) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, pago_id, moneda)
    REFERENCES public.pagos (clinica_id, id, moneda) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, reversion_de_movimiento_id)
    REFERENCES public.bp15_caja_movimientos (clinica_id, id) ON DELETE RESTRICT,
  CHECK (
    (origen_tipo = 'pago' AND tipo = 'ingreso' AND pago_id IS NOT NULL
      AND gasto_id IS NULL AND reversion_de_movimiento_id IS NULL) OR
    (origen_tipo = 'gasto' AND tipo = 'egreso' AND gasto_id IS NOT NULL
      AND pago_id IS NULL AND reversion_de_movimiento_id IS NULL) OR
    (origen_tipo = 'reversion' AND tipo = 'reversion' AND pago_id IS NULL
      AND gasto_id IS NULL AND reversion_de_movimiento_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX bp15_caja_movimientos_pago_uq
  ON public.bp15_caja_movimientos (clinica_id, pago_id) WHERE pago_id IS NOT NULL;
CREATE UNIQUE INDEX bp15_caja_movimientos_gasto_uq
  ON public.bp15_caja_movimientos (clinica_id, gasto_id) WHERE gasto_id IS NOT NULL;
CREATE INDEX bp15_caja_movimientos_sesion_fecha_idx
  ON public.bp15_caja_movimientos (clinica_id, caja_sesion_id, created_at);

CREATE TABLE public.bp15_cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  alias text NOT NULL CHECK (length(btrim(alias)) BETWEEN 1 AND 80),
  entidad text NOT NULL CHECK (length(btrim(entidad)) BETWEEN 1 AND 120),
  ultimos_cuatro text NOT NULL CHECK (ultimos_cuatro ~ '^\d{4}$'),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  activa boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, alias)
);

CREATE TABLE public.bp15_extractos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  cuenta_bancaria_id uuid NOT NULL,
  hash_archivo text NOT NULL CHECK (hash_archivo ~ '^[0-9a-f]{64}$'),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  cantidad_filas integer NOT NULL CHECK (cantidad_filas BETWEEN 1 AND 10000),
  importado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  importado_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, cuenta_bancaria_id, moneda),
  UNIQUE (clinica_id, idempotency_key),
  UNIQUE (clinica_id, cuenta_bancaria_id, hash_archivo),
  FOREIGN KEY (clinica_id, cuenta_bancaria_id)
    REFERENCES public.bp15_cuentas_bancarias (clinica_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, cuenta_bancaria_id, moneda)
    REFERENCES public.bp15_cuentas_bancarias (clinica_id, id, moneda) ON DELETE RESTRICT,
  CHECK (fecha_hasta >= fecha_desde)
);

CREATE TABLE public.bp15_extracto_filas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  extracto_id uuid NOT NULL,
  cuenta_bancaria_id uuid NOT NULL,
  fecha date NOT NULL,
  monto_minor bigint NOT NULL CHECK (monto_minor <> 0),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  descripcion text NOT NULL DEFAULT '' CHECK (length(descripcion) <= 500),
  referencia text NOT NULL DEFAULT '' CHECK (length(referencia) <= 200),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  numero_fila integer NOT NULL CHECK (numero_fila > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, extracto_id, numero_fila),
  FOREIGN KEY (clinica_id, extracto_id, cuenta_bancaria_id, moneda)
    REFERENCES public.bp15_extractos (clinica_id, id, cuenta_bancaria_id, moneda) ON DELETE RESTRICT
);
CREATE INDEX bp15_extracto_filas_fecha_idx
  ON public.bp15_extracto_filas (clinica_id, cuenta_bancaria_id, fecha);

CREATE TABLE public.bp15_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  fecha_emision date NOT NULL,
  fecha_pago date,
  categoria text NOT NULL CHECK (length(btrim(categoria)) BETWEEN 1 AND 80),
  proveedor_nombre text NOT NULL CHECK (length(btrim(proveedor_nombre)) BETWEEN 1 AND 180),
  proveedor_rut text CHECK (proveedor_rut IS NULL OR length(btrim(proveedor_rut)) <= 20),
  descripcion text NOT NULL CHECK (length(btrim(descripcion)) BETWEEN 1 AND 1000),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  neto_minor bigint NOT NULL CHECK (neto_minor >= 0),
  iva_minor bigint NOT NULL CHECK (iva_minor >= 0),
  exento_minor bigint NOT NULL DEFAULT 0 CHECK (exento_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  iva_recuperable boolean NOT NULL DEFAULT false,
  tipo_documento text CHECK (tipo_documento IS NULL OR length(tipo_documento) <= 40),
  folio_documento text CHECK (folio_documento IS NULL OR length(folio_documento) <= 80),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'anulado')),
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR length(btrim(motivo_anulacion)) BETWEEN 1 AND 500),
  metodo_pago text CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro')),
  caja_sesion_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, caja_sesion_id, moneda)
    REFERENCES public.bp15_caja_sesiones (clinica_id, id, moneda) ON DELETE RESTRICT,
  CHECK (total_minor = neto_minor + iva_minor + exento_minor),
  CHECK (
    (estado = 'pendiente' AND fecha_pago IS NULL AND metodo_pago IS NULL
      AND caja_sesion_id IS NULL AND motivo_anulacion IS NULL)
    OR (estado = 'pagado' AND fecha_pago IS NOT NULL AND metodo_pago IS NOT NULL
      AND motivo_anulacion IS NULL)
    OR (estado = 'anulado' AND motivo_anulacion IS NOT NULL
      AND ((fecha_pago IS NULL AND metodo_pago IS NULL AND caja_sesion_id IS NULL)
        OR (fecha_pago IS NOT NULL AND metodo_pago IS NOT NULL)))
  ),
  CHECK ((metodo_pago IS NULL OR metodo_pago <> 'efectivo') = (caja_sesion_id IS NULL))
);
CREATE INDEX bp15_gastos_fecha_categoria_idx ON public.bp15_gastos (clinica_id, fecha_emision, categoria);
ALTER TABLE public.bp15_caja_movimientos
  ADD CONSTRAINT bp15_caja_movimientos_gasto_fk
  FOREIGN KEY (clinica_id, gasto_id, moneda)
  REFERENCES public.bp15_gastos (clinica_id, id, moneda) ON DELETE RESTRICT;

CREATE TABLE public.bp15_gasto_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  gasto_id uuid NOT NULL,
  r2_key text NOT NULL CHECK (length(r2_key) BETWEEN 1 AND 512 AND r2_key !~ '^https?://'),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'application/xml', 'text/xml', 'image/jpeg', 'image/png')),
  bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  eliminado_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  eliminado_at timestamptz,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, r2_key),
  FOREIGN KEY (clinica_id, gasto_id) REFERENCES public.bp15_gastos (clinica_id, id) ON DELETE RESTRICT,
  CHECK ((eliminado_por IS NULL) = (eliminado_at IS NULL))
);

CREATE TABLE public.bp15_bonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  numero_bono text NOT NULL CHECK (length(btrim(numero_bono)) BETWEEN 1 AND 80),
  paciente_id uuid,
  prevision text NOT NULL CHECK (length(btrim(prevision)) BETWEEN 1 AND 80),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  monto_total_minor bigint NOT NULL CHECK (monto_total_minor > 0),
  aporte_minor bigint NOT NULL CHECK (aporte_minor >= 0),
  copago_minor bigint NOT NULL CHECK (copago_minor >= 0),
  fecha_emision date,
  fecha_vencimiento date,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_gestion', 'parcial', 'liquidado', 'rechazado')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, numero_bono),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, paciente_id) REFERENCES public.pacientes (clinica_id, id) ON DELETE RESTRICT,
  CHECK (monto_total_minor = aporte_minor + copago_minor),
  CHECK (fecha_vencimiento IS NULL OR fecha_emision IS NULL OR fecha_vencimiento >= fecha_emision)
);

CREATE TABLE public.bp15_bono_liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  bono_id uuid NOT NULL,
  monto_minor bigint NOT NULL CHECK (monto_minor > 0),
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  fecha date NOT NULL,
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('pendiente', 'confirmada', 'anulada')),
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR length(btrim(motivo_anulacion)) BETWEEN 1 AND 500),
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('transferencia', 'tarjeta', 'cheque', 'otro')),
  referencia text CHECK (referencia IS NULL OR length(referencia) <= 200),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, id, moneda),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, bono_id, moneda)
    REFERENCES public.bp15_bonos (clinica_id, id, moneda) ON DELETE RESTRICT,
  CHECK ((estado = 'anulada') = (motivo_anulacion IS NOT NULL))
);
CREATE INDEX bp15_bono_liquidaciones_bono_idx
  ON public.bp15_bono_liquidaciones (clinica_id, bono_id, estado);

CREATE TABLE public.bp15_conciliaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  extracto_fila_id uuid NOT NULL,
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  pago_id uuid,
  gasto_id uuid,
  bono_liquidacion_id uuid,
  estado text NOT NULL DEFAULT 'conciliada' CHECK (estado IN ('conciliada', 'revertida')),
  motivo_reversion text CHECK (motivo_reversion IS NULL OR length(btrim(motivo_reversion)) BETWEEN 1 AND 500),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (clinica_id, extracto_fila_id, moneda)
    REFERENCES public.bp15_extracto_filas (clinica_id, id, moneda) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, pago_id, moneda)
    REFERENCES public.pagos (clinica_id, id, moneda) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, gasto_id, moneda)
    REFERENCES public.bp15_gastos (clinica_id, id, moneda) ON DELETE RESTRICT,
  FOREIGN KEY (clinica_id, bono_liquidacion_id, moneda)
    REFERENCES public.bp15_bono_liquidaciones (clinica_id, id, moneda) ON DELETE RESTRICT,
  CHECK (num_nonnulls(pago_id, gasto_id, bono_liquidacion_id) = 1),
  CHECK ((estado = 'revertida') = (motivo_reversion IS NOT NULL))
);
CREATE UNIQUE INDEX bp15_conciliacion_fila_activa_uq
  ON public.bp15_conciliaciones (clinica_id, extracto_fila_id) WHERE estado = 'conciliada';
CREATE UNIQUE INDEX bp15_conciliacion_pago_activa_uq
  ON public.bp15_conciliaciones (clinica_id, pago_id) WHERE estado = 'conciliada' AND pago_id IS NOT NULL;
CREATE UNIQUE INDEX bp15_conciliacion_gasto_activa_uq
  ON public.bp15_conciliaciones (clinica_id, gasto_id) WHERE estado = 'conciliada' AND gasto_id IS NOT NULL;
CREATE UNIQUE INDEX bp15_conciliacion_bono_activa_uq
  ON public.bp15_conciliaciones (clinica_id, bono_liquidacion_id) WHERE estado = 'conciliada' AND bono_liquidacion_id IS NOT NULL;

CREATE TABLE public.bp15_parametros_proyeccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
  escenario text NOT NULL CHECK (escenario IN ('optimista', 'realista', 'pesimista')),
  tasa_cobranza_bps smallint NOT NULL CHECK (tasa_cobranza_bps BETWEEN 0 AND 10000),
  horizonte_dias smallint NOT NULL DEFAULT 90 CHECK (horizonte_dias BETWEEN 1 AND 3650),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (clinica_id, id),
  UNIQUE (clinica_id, moneda, escenario)
);

-- BP07 remains the source of truth for patient payments. Historical rows remain
-- unlinked; new cash payments are associated by a backend trigger.
ALTER TABLE public.pagos
  ADD COLUMN caja_sesion_id uuid,
  ADD CONSTRAINT pagos_bp15_caja_sesion_fk
    FOREIGN KEY (clinica_id, caja_sesion_id, moneda)
    REFERENCES public.bp15_caja_sesiones (clinica_id, id, moneda) ON DELETE RESTRICT;

CREATE UNIQUE INDEX bp15_caja_movimientos_reversion_uq
  ON public.bp15_caja_movimientos (clinica_id, reversion_de_movimiento_id)
  WHERE reversion_de_movimiento_id IS NOT NULL;

COMMENT ON COLUMN public.pagos.caja_sesion_id IS
  'BP15: caja session for confirmed cash payments. Historical and electronic payments remain NULL.';

CREATE OR REPLACE FUNCTION bp15_private.admin_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := v_actor;
    NEW.created_at := clock_timestamp();
    NEW.updated_by := v_actor;
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (to_jsonb(NEW) -> 'idempotency_key') IS DISTINCT FROM (to_jsonb(OLD) -> 'idempotency_key') THEN
    RAISE EXCEPTION 'Identidad y trazabilidad BP15 son inmutables';
  END IF;
  NEW.updated_by := v_actor;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.extracto_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.importado_por := v_actor;
    NEW.importado_at := clock_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Los extractos importados son inmutables';
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.caja_sesion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual()::text NOT IN ('admin', 'recepcion') THEN
    RAISE EXCEPTION 'Acceso a caja no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.abierta_por := v_actor;
    NEW.abierta_en := clock_timestamp();
    NEW.fecha_operacion := timezone('America/Santiago', NEW.abierta_en)::date;
    RETURN NEW;
  END IF;
  IF OLD.estado <> 'abierta' OR NEW.estado <> 'cerrada'
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
    OR NEW.moneda IS DISTINCT FROM OLD.moneda
    OR NEW.fecha_operacion IS DISTINCT FROM OLD.fecha_operacion
    OR NEW.monto_apertura_minor IS DISTINCT FROM OLD.monto_apertura_minor
    OR NEW.abierta_por IS DISTINCT FROM OLD.abierta_por
    OR NEW.abierta_en IS DISTINCT FROM OLD.abierta_en
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION 'Una sesión BP15 solo puede cerrarse una vez';
  END IF;
  NEW.cerrada_por := v_actor;
  NEW.cerrada_en := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'El historial BP15 es append-only';
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.registrar_evento_sesion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.abierta_por);
  v_key uuid;
  v_tipo text;
  v_datos jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_key := NEW.idempotency_key;
    v_tipo := 'apertura';
    v_datos := jsonb_build_object(
      'fechaOperacion', NEW.fecha_operacion,
      'moneda', NEW.moneda,
      'montoAperturaMinor', NEW.monto_apertura_minor
    );
  ELSE
    v_actor := COALESCE(auth.uid(), NEW.cerrada_por);
    v_key := NEW.cierre_idempotency_key;
    v_tipo := 'cierre';
    v_datos := jsonb_build_object(
      'conteoDenominaciones', NEW.conteo_denominaciones,
      'montoEsperadoMinor', NEW.monto_apertura_minor + COALESCE((
        SELECT SUM(CASE
          WHEN m.tipo = 'ingreso' THEN m.monto_minor
          WHEN m.tipo = 'egreso' THEN -m.monto_minor
          WHEN original.tipo = 'ingreso' THEN -m.monto_minor
          WHEN original.tipo = 'egreso' THEN m.monto_minor
          ELSE 0
        END)
        FROM public.bp15_caja_movimientos m
        LEFT JOIN public.bp15_caja_movimientos original
          ON original.clinica_id = m.clinica_id
         AND original.id = m.reversion_de_movimiento_id
        WHERE m.clinica_id = NEW.clinica_id AND m.caja_sesion_id = NEW.id
      ), 0),
      'montoContadoMinor', NEW.monto_contado_minor,
      'diferenciaMinor', NEW.diferencia_minor,
      'motivoDiferencia', NEW.motivo_diferencia
    );
  END IF;
  INSERT INTO public.bp15_caja_eventos (
    clinica_id, caja_sesion_id, tipo, actor_id, idempotency_key, datos
  ) VALUES (NEW.clinica_id, NEW.id, v_tipo, v_actor, v_key, v_datos);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER bp15_caja_sesion_guard
  BEFORE INSERT OR UPDATE ON public.bp15_caja_sesiones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.caja_sesion_guard();
CREATE TRIGGER bp15_caja_sesion_evento_insert
  AFTER INSERT ON public.bp15_caja_sesiones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.registrar_evento_sesion();
CREATE TRIGGER bp15_caja_sesion_evento_close
  AFTER UPDATE ON public.bp15_caja_sesiones
  FOR EACH ROW WHEN (OLD.estado = 'abierta' AND NEW.estado = 'cerrada')
  EXECUTE FUNCTION bp15_private.registrar_evento_sesion();
CREATE TRIGGER bp15_caja_eventos_append_only
  BEFORE UPDATE OR DELETE ON public.bp15_caja_eventos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.append_only_guard();
CREATE TRIGGER bp15_caja_movimientos_append_only
  BEFORE UPDATE OR DELETE ON public.bp15_caja_movimientos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.append_only_guard();
CREATE TRIGGER bp15_extractos_append_only
  BEFORE UPDATE OR DELETE ON public.bp15_extractos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.append_only_guard();
CREATE TRIGGER bp15_extracto_filas_append_only
  BEFORE UPDATE OR DELETE ON public.bp15_extracto_filas
  FOR EACH ROW EXECUTE FUNCTION bp15_private.append_only_guard();

CREATE TRIGGER bp15_cuentas_guard
  BEFORE INSERT OR UPDATE ON public.bp15_cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();
CREATE TRIGGER bp15_extractos_guard
  BEFORE INSERT OR UPDATE ON public.bp15_extractos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.extracto_record_guard();
CREATE TRIGGER bp15_gastos_guard
  BEFORE INSERT OR UPDATE ON public.bp15_gastos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();
CREATE TRIGGER bp15_bonos_guard
  BEFORE INSERT OR UPDATE ON public.bp15_bonos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();
CREATE TRIGGER bp15_bono_liquidaciones_guard
  BEFORE INSERT OR UPDATE ON public.bp15_bono_liquidaciones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();
CREATE TRIGGER bp15_conciliaciones_guard
  BEFORE INSERT OR UPDATE ON public.bp15_conciliaciones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();
CREATE TRIGGER bp15_parametros_guard
  BEFORE INSERT OR UPDATE ON public.bp15_parametros_proyeccion
  FOR EACH ROW EXECUTE FUNCTION bp15_private.admin_record_guard();

CREATE OR REPLACE FUNCTION public.bp15_abrir_caja(
  p_moneda text,
  p_monto_apertura_minor bigint,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_actor uuid := auth.uid();
  v_existente public.bp15_caja_sesiones%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
    OR public.rol_en_clinica_actual()::text NOT IN ('admin', 'recepcion')
    OR p_moneda IS NULL OR p_moneda !~ '^[A-Z]{3}$'
    OR p_monto_apertura_minor IS NULL OR p_monto_apertura_minor < 0
    OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Datos o permisos inválidos para abrir caja';
  END IF;

  SELECT * INTO v_existente
  FROM public.bp15_caja_sesiones s
  WHERE s.clinica_id = v_clinica AND s.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.moneda IS DISTINCT FROM p_moneda
      OR v_existente.monto_apertura_minor IS DISTINCT FROM p_monto_apertura_minor THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó con otros datos';
    END IF;
    RETURN v_existente.id;
  END IF;

  INSERT INTO public.bp15_caja_sesiones (
    clinica_id, moneda, monto_apertura_minor, abierta_por, idempotency_key
  ) VALUES (
    v_clinica, p_moneda, p_monto_apertura_minor, v_actor, p_idempotency_key
  ) RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existente
    FROM public.bp15_caja_sesiones s
    WHERE s.clinica_id = v_clinica AND s.idempotency_key = p_idempotency_key;
    IF FOUND AND v_existente.moneda = p_moneda
      AND v_existente.monto_apertura_minor = p_monto_apertura_minor THEN
      RETURN v_existente.id;
    END IF;
    RAISE EXCEPTION 'Ya existe una caja para esta clínica y moneda';
END;
$function$;

CREATE OR REPLACE FUNCTION public.bp15_cerrar_caja(
  p_caja_sesion_id uuid,
  p_conteo jsonb,
  p_motivo text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_actor uuid := auth.uid();
  v_sesion public.bp15_caja_sesiones%ROWTYPE;
  v_fila jsonb;
  v_valor numeric;
  v_cantidad numeric;
  v_contado numeric := 0;
  v_esperado numeric;
  v_diferencia numeric;
  v_motivo text := NULLIF(btrim(p_motivo), '');
  v_valores bigint[] := ARRAY[]::bigint[];
  v_resultado jsonb;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
    OR public.rol_en_clinica_actual()::text NOT IN ('admin', 'recepcion')
    OR p_caja_sesion_id IS NULL OR p_idempotency_key IS NULL
    OR p_conteo IS NULL OR jsonb_typeof(p_conteo) <> 'array'
    OR jsonb_array_length(p_conteo) < 1 OR jsonb_array_length(p_conteo) > 30 THEN
    RAISE EXCEPTION 'Datos o permisos inválidos para cerrar caja';
  END IF;

  SELECT * INTO v_sesion FROM public.bp15_caja_sesiones s
  WHERE s.id = p_caja_sesion_id AND s.clinica_id = v_clinica
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión de caja no disponible'; END IF;
  IF v_sesion.estado = 'cerrada' THEN
    IF v_sesion.cierre_idempotency_key = p_idempotency_key
      AND v_sesion.conteo_denominaciones = p_conteo
      AND v_sesion.motivo_diferencia IS NOT DISTINCT FROM v_motivo THEN
      RETURN jsonb_build_object(
        'cajaSesionId', v_sesion.id,
        'estado', v_sesion.estado,
        'montoEsperadoMinor', v_sesion.monto_contado_minor - v_sesion.diferencia_minor,
        'montoContadoMinor', v_sesion.monto_contado_minor,
        'diferenciaMinor', v_sesion.diferencia_minor,
        'motivoDiferencia', v_sesion.motivo_diferencia,
        'cerradaEn', v_sesion.cerrada_en
      );
    END IF;
    RAISE EXCEPTION 'La sesión ya fue cerrada con otra operación';
  END IF;
  IF p_idempotency_key = v_sesion.idempotency_key THEN
    RAISE EXCEPTION 'La clave de cierre debe ser distinta de la clave de apertura';
  END IF;

  FOR v_fila IN SELECT value FROM jsonb_array_elements(p_conteo)
  LOOP
    IF jsonb_typeof(v_fila) <> 'object'
      OR (v_fila - ARRAY['valorMinor', 'cantidad']) <> '{}'::jsonb
      OR jsonb_typeof(v_fila->'valorMinor') <> 'number'
      OR jsonb_typeof(v_fila->'cantidad') <> 'number'
      OR (v_fila->>'valorMinor') !~ '^[0-9]+$'
      OR (v_fila->>'cantidad') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'El conteo de denominaciones es inválido';
    END IF;
    v_valor := (v_fila->>'valorMinor')::numeric;
    v_cantidad := (v_fila->>'cantidad')::numeric;
    IF v_valor < 1 OR v_valor > 9223372036854775807
      OR v_cantidad < 1 OR v_cantidad > 1000000
      OR v_valor = ANY(v_valores) THEN
      RAISE EXCEPTION 'Denominación repetida o fuera de rango';
    END IF;
    v_valores := array_append(v_valores, v_valor::bigint);
    v_contado := v_contado + v_valor * v_cantidad;
    IF v_contado > 9223372036854775807 THEN
      RAISE EXCEPTION 'El monto contado excede el límite permitido';
    END IF;
  END LOOP;

  SELECT v_sesion.monto_apertura_minor::numeric + COALESCE(SUM(CASE
    WHEN m.tipo = 'ingreso' THEN m.monto_minor::numeric
    WHEN m.tipo = 'egreso' THEN -m.monto_minor::numeric
    WHEN original.tipo = 'ingreso' THEN -m.monto_minor::numeric
    WHEN original.tipo = 'egreso' THEN m.monto_minor::numeric
    ELSE 0::numeric
  END), 0)
  INTO v_esperado
  FROM public.bp15_caja_movimientos m
  LEFT JOIN public.bp15_caja_movimientos original
    ON original.clinica_id = m.clinica_id
   AND original.id = m.reversion_de_movimiento_id
  WHERE m.clinica_id = v_clinica AND m.caja_sesion_id = v_sesion.id;

  IF v_esperado < 0 OR v_esperado > 9223372036854775807 THEN
    RAISE EXCEPTION 'El saldo esperado de caja está fuera de rango';
  END IF;

  v_diferencia := v_contado - v_esperado;
  IF v_diferencia < -9223372036854775808 OR v_diferencia > 9223372036854775807 THEN
    RAISE EXCEPTION 'La diferencia excede el límite permitido';
  END IF;
  IF ((v_sesion.moneda = 'CLP' AND abs(v_diferencia) > 500000)
      OR (v_sesion.moneda <> 'CLP' AND v_diferencia <> 0))
    AND (v_motivo IS NULL OR length(v_motivo) > 500) THEN
    RAISE EXCEPTION 'Indique un motivo cuando la diferencia supere el umbral operativo';
  END IF;

  UPDATE public.bp15_caja_sesiones s SET
    estado = 'cerrada',
    conteo_denominaciones = p_conteo,
    monto_contado_minor = v_contado::bigint,
    diferencia_minor = v_diferencia::bigint,
    motivo_diferencia = v_motivo,
    cierre_idempotency_key = p_idempotency_key,
    cerrada_por = v_actor,
    cerrada_en = clock_timestamp()
  WHERE s.id = v_sesion.id AND s.clinica_id = v_clinica
  RETURNING s.* INTO v_sesion;

  v_resultado := jsonb_build_object(
    'cajaSesionId', v_sesion.id,
    'estado', 'cerrada',
    'montoEsperadoMinor', v_esperado::bigint,
    'montoContadoMinor', v_contado::bigint,
    'diferenciaMinor', v_diferencia::bigint,
    'motivoDiferencia', v_motivo,
    'cerradaEn', v_sesion.cerrada_en
  );
  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.bp15_abrir_caja(text, bigint, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bp15_cerrar_caja(uuid, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp15_abrir_caja(text, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bp15_cerrar_caja(uuid, jsonb, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION bp15_private.validar_pago_efectivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_actor uuid := auth.uid();
  v_sesion_id uuid;
  v_es_efectivo boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.caja_sesion_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un pago asociado a caja no puede eliminarse; registre una reversión auditada';
    END IF;
    RETURN OLD;
  END IF;

  v_es_efectivo := lower(btrim(COALESCE(NEW.metodo_pago, ''))) IN ('efectivo', 'cash');
  IF TG_OP = 'UPDATE' THEN
    IF OLD.caja_sesion_id IS NOT NULL THEN
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
        OR NEW.presupuesto_id IS DISTINCT FROM OLD.presupuesto_id
        OR NEW.monto IS DISTINCT FROM OLD.monto
        OR NEW.moneda IS DISTINCT FROM OLD.moneda
        OR NEW.metodo_pago IS DISTINCT FROM OLD.metodo_pago
        OR NEW.fecha IS DISTINCT FROM OLD.fecha
        OR NEW.caja_sesion_id IS DISTINCT FROM OLD.caja_sesion_id THEN
        RAISE EXCEPTION 'Los datos financieros de un pago confirmado en caja son inmutables';
      END IF;
      RETURN NEW;
    END IF;

    IF v_es_efectivo AND lower(btrim(COALESCE(OLD.metodo_pago, ''))) NOT IN ('efectivo', 'cash') THEN
      RAISE EXCEPTION 'Un pago existente no puede convertirse retroactivamente en efectivo';
    END IF;
    -- Historical payments were never reconciled to a drawer. Updating them must not
    -- attach them to today's session or create a cash movement.
    NEW.caja_sesion_id := NULL;
    RETURN NEW;
  END IF;

  IF v_es_efectivo THEN
    IF v_actor IS NULL OR v_clinica IS NULL
      OR NEW.user_id IS DISTINCT FROM v_actor
      OR NEW.clinica_id IS DISTINCT FROM v_clinica
      OR NEW.monto IS NULL OR NEW.monto <= 0
      OR public.rol_en_clinica_actual()::text NOT IN ('admin', 'dentista', 'recepcion') THEN
      RAISE EXCEPTION 'Pago en efectivo no autorizado o inválido';
    END IF;
    SELECT s.id INTO v_sesion_id
    FROM public.bp15_caja_sesiones s
    WHERE s.clinica_id = v_clinica
      AND s.moneda = NEW.moneda
      AND s.estado = 'abierta'
      AND s.fecha_operacion = timezone('America/Santiago', clock_timestamp())::date
    FOR UPDATE;
    IF v_sesion_id IS NULL THEN
      RAISE EXCEPTION 'no-session: abre la caja antes de confirmar un pago en efectivo';
    END IF;
    NEW.caja_sesion_id := v_sesion_id;
  ELSE
    NEW.caja_sesion_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.proyectar_pago_efectivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_movimiento public.bp15_caja_movimientos%ROWTYPE;
  v_sesion public.bp15_caja_sesiones%ROWTYPE;
  v_monto_minor bigint;
BEGIN
  IF NEW.caja_sesion_id IS NULL THEN RETURN NEW; END IF;
  v_monto_minor := NEW.monto::bigint * 100;
  SELECT * INTO v_movimiento FROM public.bp15_caja_movimientos m
  WHERE m.clinica_id = NEW.clinica_id AND m.pago_id = NEW.id;
  IF FOUND THEN
    IF v_movimiento.caja_sesion_id IS DISTINCT FROM NEW.caja_sesion_id
      OR v_movimiento.monto_minor IS DISTINCT FROM v_monto_minor
      OR v_movimiento.moneda IS DISTINCT FROM NEW.moneda THEN
      RAISE EXCEPTION 'El pago ya tiene una proyección de caja incompatible';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO v_sesion FROM public.bp15_caja_sesiones s
  WHERE s.clinica_id = NEW.clinica_id AND s.id = NEW.caja_sesion_id
  FOR UPDATE;
  IF NOT FOUND OR v_sesion.estado <> 'abierta'
    OR v_sesion.moneda IS DISTINCT FROM NEW.moneda THEN
    RAISE EXCEPTION 'La sesión de caja ya no admite pagos';
  END IF;
  INSERT INTO public.bp15_caja_movimientos (
    clinica_id, caja_sesion_id, tipo, monto_minor, moneda, origen_tipo,
    pago_id, actor_id, idempotency_key
  ) VALUES (
    NEW.clinica_id, NEW.caja_sesion_id, 'ingreso', v_monto_minor, NEW.moneda, 'pago',
    NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.id
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER zz_bp15_validar_pago_efectivo
  BEFORE INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.validar_pago_efectivo();
CREATE TRIGGER bp15_proyectar_pago_efectivo
  AFTER INSERT OR UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.proyectar_pago_efectivo();

CREATE OR REPLACE FUNCTION bp15_private.gasto_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_sesion_id uuid;
  v_saldo numeric;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := v_actor;
    NEW.created_at := clock_timestamp();
    NEW.updated_by := v_actor;
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
      RAISE EXCEPTION 'Identidad y trazabilidad del gasto son inmutables';
    END IF;
    IF OLD.estado = 'anulado' THEN
      RAISE EXCEPTION 'Un gasto anulado es inmutable';
    END IF;
    IF OLD.estado = 'pagado' THEN
      IF NEW.estado <> 'anulado' OR NEW.motivo_anulacion IS NULL
        OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
        OR NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago
        OR NEW.categoria IS DISTINCT FROM OLD.categoria
        OR NEW.proveedor_nombre IS DISTINCT FROM OLD.proveedor_nombre
        OR NEW.proveedor_rut IS DISTINCT FROM OLD.proveedor_rut
        OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
        OR NEW.moneda IS DISTINCT FROM OLD.moneda
        OR NEW.neto_minor IS DISTINCT FROM OLD.neto_minor
        OR NEW.iva_minor IS DISTINCT FROM OLD.iva_minor
        OR NEW.exento_minor IS DISTINCT FROM OLD.exento_minor
        OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
        OR NEW.iva_recuperable IS DISTINCT FROM OLD.iva_recuperable
        OR NEW.tipo_documento IS DISTINCT FROM OLD.tipo_documento
        OR NEW.folio_documento IS DISTINCT FROM OLD.folio_documento
        OR NEW.metodo_pago IS DISTINCT FROM OLD.metodo_pago
        OR NEW.caja_sesion_id IS DISTINCT FROM OLD.caja_sesion_id THEN
        RAISE EXCEPTION 'Un gasto pagado solo puede anularse con motivo';
      END IF;
    END IF;
    NEW.updated_by := v_actor;
    NEW.updated_at := clock_timestamp();
  END IF;

  IF NEW.estado = 'pagado' AND lower(COALESCE(NEW.metodo_pago, '')) = 'efectivo' THEN
    IF TG_OP = 'INSERT' THEN
      v_sesion_id := NULL;
    ELSIF OLD.estado = 'pagado' THEN
      v_sesion_id := OLD.caja_sesion_id;
    END IF;
    IF v_sesion_id IS NULL THEN
      SELECT s.id INTO v_sesion_id
      FROM public.bp15_caja_sesiones s
      WHERE s.clinica_id = v_clinica AND s.moneda = NEW.moneda
        AND s.estado = 'abierta'
        AND s.fecha_operacion = timezone('America/Santiago', clock_timestamp())::date
      FOR UPDATE;
      IF v_sesion_id IS NULL THEN
        RAISE EXCEPTION 'no-session: abre la caja antes de confirmar un gasto en efectivo';
      END IF;
    END IF;
    SELECT s.monto_apertura_minor::numeric + COALESCE(SUM(CASE
      WHEN m.tipo = 'ingreso' THEN m.monto_minor::numeric
      WHEN m.tipo = 'egreso' THEN -m.monto_minor::numeric
      WHEN original.tipo = 'ingreso' THEN -m.monto_minor::numeric
      WHEN original.tipo = 'egreso' THEN m.monto_minor::numeric
      ELSE 0::numeric
    END), 0)
    INTO v_saldo
    FROM public.bp15_caja_sesiones s
    LEFT JOIN public.bp15_caja_movimientos m
      ON m.clinica_id = s.clinica_id AND m.caja_sesion_id = s.id
    LEFT JOIN public.bp15_caja_movimientos original
      ON original.clinica_id = m.clinica_id
     AND original.id = m.reversion_de_movimiento_id
    WHERE s.clinica_id = v_clinica AND s.id = v_sesion_id
    GROUP BY s.id;
    IF v_saldo < NEW.total_minor THEN
      RAISE EXCEPTION 'El efectivo disponible en la caja no alcanza para este gasto';
    END IF;
    NEW.caja_sesion_id := v_sesion_id;
  ELSIF NEW.estado = 'pagado' AND lower(COALESCE(NEW.metodo_pago, '')) <> 'efectivo' THEN
    NEW.caja_sesion_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION bp15_private.proyectar_gasto_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_movimiento public.bp15_caja_movimientos%ROWTYPE;
  v_sesion_id uuid;
  v_key uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado = 'pagado' AND lower(COALESCE(NEW.metodo_pago, '')) = 'efectivo' THEN
      INSERT INTO public.bp15_caja_movimientos (
        clinica_id, caja_sesion_id, tipo, monto_minor, moneda, origen_tipo,
        gasto_id, actor_id, idempotency_key
      ) VALUES (
        NEW.clinica_id, NEW.caja_sesion_id, 'egreso', NEW.total_minor,
        NEW.moneda, 'gasto', NEW.id, COALESCE(auth.uid(), NEW.created_by), NEW.id
      );
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.estado <> 'pagado' AND NEW.estado = 'pagado'
    AND lower(COALESCE(NEW.metodo_pago, '')) = 'efectivo' THEN
    INSERT INTO public.bp15_caja_movimientos (
      clinica_id, caja_sesion_id, tipo, monto_minor, moneda, origen_tipo,
      gasto_id, actor_id, idempotency_key
    ) VALUES (
      NEW.clinica_id, NEW.caja_sesion_id, 'egreso', NEW.total_minor,
      NEW.moneda, 'gasto', NEW.id, COALESCE(auth.uid(), NEW.created_by), NEW.id
    );
  ELSIF OLD.estado = 'pagado' AND NEW.estado = 'anulado'
    AND lower(COALESCE(OLD.metodo_pago, '')) = 'efectivo' THEN
    SELECT m.* INTO v_movimiento
    FROM public.bp15_caja_movimientos m
    WHERE m.clinica_id = OLD.clinica_id AND m.gasto_id = OLD.id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe movimiento de caja para revertir el gasto'; END IF;
    SELECT s.id INTO v_sesion_id
    FROM public.bp15_caja_sesiones s
    WHERE s.clinica_id = OLD.clinica_id AND s.moneda = OLD.moneda
      AND s.estado = 'abierta'
      AND s.fecha_operacion = timezone('America/Santiago', clock_timestamp())::date
    FOR UPDATE;
    IF v_sesion_id IS NULL THEN
      RAISE EXCEPTION 'no-session: abre la caja para registrar la devolución del gasto';
    END IF;
    v_key := md5(NEW.id::text || ':bp15:gasto:reversion')::uuid;
    INSERT INTO public.bp15_caja_movimientos (
      clinica_id, caja_sesion_id, tipo, monto_minor, moneda, origen_tipo,
      reversion_de_movimiento_id, actor_id, idempotency_key
    ) VALUES (
      OLD.clinica_id, v_sesion_id, 'reversion', OLD.total_minor, OLD.moneda,
      'reversion', v_movimiento.id, COALESCE(auth.uid(), NEW.updated_by), v_key
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER bp15_gastos_guard ON public.bp15_gastos;
CREATE TRIGGER bp15_gastos_guard
  BEFORE INSERT OR UPDATE ON public.bp15_gastos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.gasto_guard();
CREATE TRIGGER bp15_gastos_caja_projection
  AFTER INSERT OR UPDATE ON public.bp15_gastos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.proyectar_gasto_caja();

CREATE OR REPLACE FUNCTION bp15_private.bono_liquidacion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_bono public.bp15_bonos%ROWTYPE;
  v_confirmado numeric;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.estado = 'anulada' OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
      OR NEW.bono_id IS DISTINCT FROM OLD.bono_id
      OR NEW.monto_minor IS DISTINCT FROM OLD.monto_minor
      OR NEW.moneda IS DISTINCT FROM OLD.moneda
      OR NEW.fecha IS DISTINCT FROM OLD.fecha
      OR NEW.metodo_pago IS DISTINCT FROM OLD.metodo_pago
      OR NEW.referencia IS DISTINCT FROM OLD.referencia
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR (OLD.estado = 'confirmada' AND NEW.estado <> 'anulada')
      OR (NEW.estado = 'anulada' AND NEW.motivo_anulacion IS NULL) THEN
      RAISE EXCEPTION 'Una liquidación confirmada es inmutable; use anulación con motivo';
    END IF;
  END IF;
  SELECT * INTO v_bono FROM public.bp15_bonos b
  WHERE b.clinica_id = NEW.clinica_id AND b.id = NEW.bono_id
  FOR UPDATE;
  IF NOT FOUND OR v_bono.moneda IS DISTINCT FROM NEW.moneda THEN
    RAISE EXCEPTION 'Bono no disponible para esta clínica y moneda';
  END IF;
  NEW.created_by := CASE WHEN TG_OP = 'INSERT' THEN v_actor ELSE OLD.created_by END;
  NEW.created_at := CASE WHEN TG_OP = 'INSERT' THEN clock_timestamp() ELSE OLD.created_at END;
  NEW.updated_by := v_actor;
  NEW.updated_at := clock_timestamp();
  SELECT COALESCE(SUM(l.monto_minor), 0) INTO v_confirmado
  FROM public.bp15_bono_liquidaciones l
  WHERE l.clinica_id = NEW.clinica_id AND l.bono_id = NEW.bono_id
    AND l.estado = 'confirmada' AND (TG_OP = 'INSERT' OR l.id <> NEW.id);
  IF NEW.estado = 'confirmada' AND v_confirmado + NEW.monto_minor > v_bono.aporte_minor THEN
    RAISE EXCEPTION 'Las liquidaciones confirmadas exceden el aporte del bono';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER bp15_bono_liquidaciones_guard ON public.bp15_bono_liquidaciones;
CREATE TRIGGER bp15_bono_liquidaciones_guard
  BEFORE INSERT OR UPDATE ON public.bp15_bono_liquidaciones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.bono_liquidacion_guard();

CREATE OR REPLACE FUNCTION bp15_private.conciliacion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_actor uuid := auth.uid();
  v_extracto_monto bigint;
  v_fuente_monto bigint;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.estado <> 'conciliada' OR NEW.estado <> 'revertida'
      OR NEW.motivo_reversion IS NULL
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
      OR NEW.extracto_fila_id IS DISTINCT FROM OLD.extracto_fila_id
      OR NEW.moneda IS DISTINCT FROM OLD.moneda
      OR NEW.pago_id IS DISTINCT FROM OLD.pago_id
      OR NEW.gasto_id IS DISTINCT FROM OLD.gasto_id
      OR NEW.bono_liquidacion_id IS DISTINCT FROM OLD.bono_liquidacion_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
      RAISE EXCEPTION 'Una conciliación activa solo puede revertirse con motivo';
    END IF;
    NEW.updated_by := v_actor;
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
  END IF;

  IF NEW.estado <> 'conciliada' OR NEW.motivo_reversion IS NOT NULL THEN
    RAISE EXCEPTION 'La nueva conciliación debe iniciar activa';
  END IF;
  SELECT f.monto_minor INTO v_extracto_monto
  FROM public.bp15_extracto_filas f
  WHERE f.clinica_id = NEW.clinica_id AND f.id = NEW.extracto_fila_id
    AND f.moneda = NEW.moneda;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento bancario no disponible'; END IF;

  IF NEW.pago_id IS NOT NULL THEN
    SELECT p.monto::bigint * 100
      INTO v_fuente_monto
    FROM public.pagos p
    WHERE p.clinica_id = NEW.clinica_id AND p.id = NEW.pago_id AND p.moneda = NEW.moneda;
    IF NOT FOUND OR v_extracto_monto <= 0 OR v_fuente_monto IS DISTINCT FROM v_extracto_monto THEN
      RAISE EXCEPTION 'El monto del extracto no coincide con el pago';
    END IF;
  ELSIF NEW.gasto_id IS NOT NULL THEN
    SELECT g.total_minor INTO v_fuente_monto
    FROM public.bp15_gastos g
    WHERE g.clinica_id = NEW.clinica_id AND g.id = NEW.gasto_id
      AND g.moneda = NEW.moneda AND g.estado = 'pagado';
    IF NOT FOUND OR v_extracto_monto >= 0 OR -v_extracto_monto IS DISTINCT FROM v_fuente_monto THEN
      RAISE EXCEPTION 'El monto del extracto no coincide con el gasto pagado';
    END IF;
  ELSE
    SELECT l.monto_minor INTO v_fuente_monto
    FROM public.bp15_bono_liquidaciones l
    WHERE l.clinica_id = NEW.clinica_id AND l.id = NEW.bono_liquidacion_id
      AND l.moneda = NEW.moneda AND l.estado = 'confirmada';
    IF NOT FOUND OR v_extracto_monto <= 0 OR v_fuente_monto IS DISTINCT FROM v_extracto_monto THEN
      RAISE EXCEPTION 'El monto del extracto no coincide con la liquidación confirmada';
    END IF;
  END IF;
  NEW.created_by := v_actor;
  NEW.created_at := clock_timestamp();
  NEW.updated_by := v_actor;
  NEW.updated_at := NEW.created_at;
  RETURN NEW;
END;
$function$;

DROP TRIGGER bp15_conciliaciones_guard ON public.bp15_conciliaciones;
CREATE TRIGGER bp15_conciliaciones_guard
  BEFORE INSERT OR UPDATE ON public.bp15_conciliaciones
  FOR EACH ROW EXECUTE FUNCTION bp15_private.conciliacion_guard();

CREATE OR REPLACE FUNCTION bp15_private.documento_gasto_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF v_actor IS NULL OR v_clinica IS NULL OR NEW.clinica_id IS DISTINCT FROM v_clinica
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Acceso BP15 no autorizado' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := v_actor;
    NEW.created_at := clock_timestamp();
    RETURN NEW;
  END IF;
  IF OLD.eliminado_at IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
    OR NEW.gasto_id IS DISTINCT FROM OLD.gasto_id
    OR NEW.r2_key IS DISTINCT FROM OLD.r2_key
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.bytes IS DISTINCT FROM OLD.bytes
    OR NEW.sha256 IS DISTINCT FROM OLD.sha256
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.eliminado_por IS NULL OR NEW.eliminado_at IS NULL THEN
    RAISE EXCEPTION 'Un respaldo solo puede marcarse eliminado una vez';
  END IF;
  NEW.eliminado_por := v_actor;
  NEW.eliminado_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER bp15_documentos_gasto_guard
  BEFORE INSERT OR UPDATE ON public.bp15_gasto_documentos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.documento_gasto_guard();
CREATE TRIGGER bp15_documentos_gasto_no_delete
  BEFORE DELETE ON public.bp15_gasto_documentos
  FOR EACH ROW EXECUTE FUNCTION bp15_private.append_only_guard();

CREATE OR REPLACE FUNCTION bp15_private.registrar_evento_reversion_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.tipo <> 'reversion' THEN RETURN NEW; END IF;
  INSERT INTO public.bp15_caja_eventos (
    clinica_id, caja_sesion_id, tipo, actor_id, idempotency_key, datos
  ) VALUES (
    NEW.clinica_id, NEW.caja_sesion_id, 'reversion', NEW.actor_id,
    md5(NEW.id::text || ':bp15:evento:reversion')::uuid,
    jsonb_build_object(
      'movimientoId', NEW.id,
      'movimientoRevertidoId', NEW.reversion_de_movimiento_id,
      'montoMinor', NEW.monto_minor,
      'moneda', NEW.moneda
    )
  );
  RETURN NEW;
END;
$function$;
CREATE TRIGGER bp15_caja_reversion_evento
  AFTER INSERT ON public.bp15_caja_movimientos
  FOR EACH ROW WHEN (NEW.tipo = 'reversion')
  EXECUTE FUNCTION bp15_private.registrar_evento_reversion_caja();

CREATE OR REPLACE FUNCTION public.bp15_importar_extracto(
  p_cuenta_bancaria_id uuid,
  p_hash_archivo text,
  p_moneda text,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_filas jsonb,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_actor uuid := auth.uid();
  v_cuenta public.bp15_cuentas_bancarias%ROWTYPE;
  v_existente public.bp15_extractos%ROWTYPE;
  v_extracto_id uuid;
  v_fila jsonb;
  v_fecha date;
  v_monto numeric;
  v_moneda text;
  v_descripcion text;
  v_referencia text;
  v_cantidad integer;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
    OR public.rol_en_clinica_actual() IS DISTINCT FROM 'admin'::public.app_role
    OR p_cuenta_bancaria_id IS NULL
    OR p_hash_archivo IS NULL OR p_hash_archivo !~ '^[0-9a-f]{64}$'
    OR p_moneda IS NULL OR p_moneda !~ '^[A-Z]{3}$'
    OR p_fecha_desde IS NULL OR p_fecha_hasta IS NULL OR p_fecha_hasta < p_fecha_desde
    OR p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array'
    OR jsonb_array_length(p_filas) < 1 OR jsonb_array_length(p_filas) > 10000
    OR octet_length(p_filas::text) > 10485760
    OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Datos o permisos inválidos para importar el extracto';
  END IF;
  SELECT * INTO v_cuenta FROM public.bp15_cuentas_bancarias a
  WHERE a.clinica_id = v_clinica AND a.id = p_cuenta_bancaria_id AND a.activa;
  IF NOT FOUND OR v_cuenta.moneda IS DISTINCT FROM p_moneda THEN
    RAISE EXCEPTION 'La cuenta no está activa para esta clínica y moneda';
  END IF;

  SELECT * INTO v_existente FROM public.bp15_extractos e
  WHERE e.clinica_id = v_clinica AND e.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND (e.hash_archivo = p_hash_archivo OR e.idempotency_key = p_idempotency_key);
  IF FOUND THEN
    IF v_existente.hash_archivo IS DISTINCT FROM p_hash_archivo
      OR v_existente.moneda IS DISTINCT FROM p_moneda
      OR v_existente.fecha_desde IS DISTINCT FROM p_fecha_desde
      OR v_existente.fecha_hasta IS DISTINCT FROM p_fecha_hasta
      OR v_existente.cantidad_filas IS DISTINCT FROM jsonb_array_length(p_filas)
      OR v_existente.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'La importación ya existe con datos distintos';
    END IF;
    RETURN v_existente.id;
  END IF;

  v_cantidad := jsonb_array_length(p_filas);
  FOR v_fila IN SELECT value FROM jsonb_array_elements(p_filas)
  LOOP
    IF jsonb_typeof(v_fila) <> 'object'
      OR (v_fila - ARRAY['fecha', 'monto_minor', 'moneda', 'descripcion', 'referencia']) <> '{}'::jsonb
      OR NOT (v_fila ?& ARRAY['fecha', 'monto_minor', 'moneda', 'descripcion', 'referencia'])
      OR jsonb_typeof(v_fila->'fecha') <> 'string'
      OR jsonb_typeof(v_fila->'monto_minor') <> 'number'
      OR (v_fila->>'monto_minor') !~ '^-?[0-9]+$'
      OR jsonb_typeof(v_fila->'moneda') <> 'string'
      OR jsonb_typeof(v_fila->'descripcion') <> 'string'
      OR jsonb_typeof(v_fila->'referencia') <> 'string' THEN
      RAISE EXCEPTION 'Una fila del extracto tiene un formato inválido';
    END IF;
    v_fecha := (v_fila->>'fecha')::date;
    v_monto := (v_fila->>'monto_minor')::numeric;
    v_moneda := v_fila->>'moneda';
    v_descripcion := btrim(v_fila->>'descripcion');
    v_referencia := btrim(v_fila->>'referencia');
    IF to_char(v_fecha, 'YYYY-MM-DD') <> v_fila->>'fecha'
      OR v_fecha < p_fecha_desde OR v_fecha > p_fecha_hasta
      OR v_monto = 0 OR abs(v_monto) > 9223372036854775807
      OR v_moneda IS DISTINCT FROM p_moneda
      OR length(v_descripcion) > 500 OR length(v_referencia) > 200 THEN
      RAISE EXCEPTION 'Una fila del extracto está fuera de rango o de la moneda de la cuenta';
    END IF;
  END LOOP;

  INSERT INTO public.bp15_extractos (
    clinica_id, cuenta_bancaria_id, hash_archivo, moneda,
    fecha_desde, fecha_hasta, cantidad_filas, importado_por, idempotency_key
  ) VALUES (
    v_clinica, p_cuenta_bancaria_id, p_hash_archivo, p_moneda,
    p_fecha_desde, p_fecha_hasta, v_cantidad, v_actor, p_idempotency_key
  ) RETURNING id INTO v_extracto_id;

  INSERT INTO public.bp15_extracto_filas (
    clinica_id, extracto_id, cuenta_bancaria_id, fecha, monto_minor,
    moneda, descripcion, referencia, fingerprint, numero_fila
  )
  SELECT v_clinica, v_extracto_id, p_cuenta_bancaria_id,
    (r.value->>'fecha')::date, (r.value->>'monto_minor')::bigint,
    r.value->>'moneda', btrim(r.value->>'descripcion'), btrim(r.value->>'referencia'),
    encode(extensions.digest(convert_to(jsonb_build_array(
      (r.value->>'fecha')::date,
      (r.value->>'monto_minor')::bigint,
      r.value->>'moneda',
      btrim(r.value->>'descripcion'),
      btrim(r.value->>'referencia')
    )::text, 'UTF8'), 'sha256'), 'hex'), r.ordinality::integer
  FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS r(value, ordinality);

  RETURN v_extracto_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bp15_importar_extracto(uuid, text, text, date, date, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bp15_importar_extracto(uuid, text, text, date, date, jsonb, uuid) TO authenticated;

ALTER TABLE public.bp15_caja_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_caja_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_caja_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_extractos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_extracto_filas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_gasto_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_bono_liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_conciliaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp15_parametros_proyeccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY bp15_caja_sesiones_select ON public.bp15_caja_sesiones
  FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (public.es_admin_de_clinica_actual()
      OR public.rol_en_clinica_actual() = 'recepcion'::public.app_role)
  );
CREATE POLICY bp15_caja_sesiones_insert ON public.bp15_caja_sesiones
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = (SELECT public.clinica_actual())
    AND abierta_por = auth.uid()
    AND estado = 'abierta'
    AND fecha_operacion = timezone('America/Santiago', clock_timestamp())::date
    AND (public.es_admin_de_clinica_actual()
      OR public.rol_en_clinica_actual() = 'recepcion'::public.app_role)
  );
CREATE POLICY bp15_caja_eventos_select ON public.bp15_caja_eventos
  FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (public.es_admin_de_clinica_actual()
      OR public.rol_en_clinica_actual() = 'recepcion'::public.app_role)
  );
CREATE POLICY bp15_caja_movimientos_select ON public.bp15_caja_movimientos
  FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (public.es_admin_de_clinica_actual()
      OR public.rol_en_clinica_actual() = 'recepcion'::public.app_role)
  );

DO $policies$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'bp15_cuentas_bancarias', 'bp15_extractos', 'bp15_extracto_filas',
    'bp15_gastos', 'bp15_gasto_documentos', 'bp15_bonos',
    'bp15_bono_liquidaciones', 'bp15_conciliaciones', 'bp15_parametros_proyeccion'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING '
      '(clinica_id = (SELECT public.clinica_actual()) AND public.es_admin_de_clinica_actual()) '
      'WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.es_admin_de_clinica_actual())',
      v_table || '_bp15_admin', v_table
    );
  END LOOP;
END;
$policies$;

REVOKE ALL ON TABLE
  public.bp15_caja_sesiones,
  public.bp15_caja_eventos,
  public.bp15_caja_movimientos,
  public.bp15_cuentas_bancarias,
  public.bp15_extractos,
  public.bp15_extracto_filas,
  public.bp15_gastos,
  public.bp15_gasto_documentos,
  public.bp15_bonos,
  public.bp15_bono_liquidaciones,
  public.bp15_conciliaciones,
  public.bp15_parametros_proyeccion
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON public.bp15_caja_sesiones TO authenticated;
GRANT SELECT ON public.bp15_caja_eventos, public.bp15_caja_movimientos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON
  public.bp15_cuentas_bancarias,
  public.bp15_gastos,
  public.bp15_gasto_documentos,
  public.bp15_bonos,
  public.bp15_bono_liquidaciones,
  public.bp15_conciliaciones,
  public.bp15_parametros_proyeccion
TO authenticated;
GRANT SELECT ON public.bp15_extractos, public.bp15_extracto_filas TO authenticated;

GRANT ALL ON TABLE
  public.bp15_caja_sesiones,
  public.bp15_caja_eventos,
  public.bp15_caja_movimientos,
  public.bp15_cuentas_bancarias,
  public.bp15_extractos,
  public.bp15_extracto_filas,
  public.bp15_gastos,
  public.bp15_gasto_documentos,
  public.bp15_bonos,
  public.bp15_bono_liquidaciones,
  public.bp15_conciliaciones,
  public.bp15_parametros_proyeccion
TO service_role;

-- Central append-only audit trail. Caja events remain the operational drawer log;
-- audit_log records the complete old/new row context for all BP15 financial tables.
DO $audit_triggers$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'bp15_caja_sesiones', 'bp15_caja_eventos', 'bp15_caja_movimientos',
    'bp15_cuentas_bancarias', 'bp15_extractos', 'bp15_extracto_filas',
    'bp15_gastos', 'bp15_gasto_documentos', 'bp15_bonos',
    'bp15_bono_liquidaciones', 'bp15_conciliaciones', 'bp15_parametros_proyeccion'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio()',
      v_table || '_audit', v_table
    );
  END LOOP;
END;
$audit_triggers$;

DO $publication$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY[
      'bp15_caja_sesiones', 'bp15_caja_eventos', 'bp15_caja_movimientos',
      'bp15_cuentas_bancarias', 'bp15_extractos', 'bp15_extracto_filas',
      'bp15_gastos', 'bp15_gasto_documentos', 'bp15_bonos',
      'bp15_bono_liquidaciones', 'bp15_conciliaciones', 'bp15_parametros_proyeccion'
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

COMMIT;
