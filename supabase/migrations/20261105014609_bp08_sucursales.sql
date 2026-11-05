-- BP08 §02: sucursales persistentes y aisladas por clínica.
-- Los UUID existentes se conservan para no invalidar referencias de agenda
-- históricas (appointments.sede_id y user_sede_horarios.sede_id).
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS zona_horaria TEXT NOT NULL DEFAULT 'America/Santiago'
    CHECK (zona_horaria ~ '^[A-Za-z_+-]+(/[A-Za-z0-9_+.-]+)*$');

COMMENT ON COLUMN public.clinicas.zona_horaria IS
  'Zona horaria IANA principal de la clínica; sucursales la heredan al crearse.';

DROP TRIGGER IF EXISTS trg_clinicas_config_audit ON public.clinicas;
CREATE TRIGGER trg_clinicas_config_audit
  AFTER INSERT OR UPDATE ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio();

DROP TRIGGER IF EXISTS trg_clinicas_config_updated_at ON public.clinicas;
CREATE TRIGGER trg_clinicas_config_updated_at
  BEFORE UPDATE ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 100),
  direccion TEXT NOT NULL CHECK (char_length(btrim(direccion)) BETWEEN 5 AND 240),
  comuna TEXT NOT NULL CHECK (char_length(btrim(comuna)) BETWEEN 2 AND 120),
  region TEXT NOT NULL CHECK (char_length(btrim(region)) BETWEEN 2 AND 120),
  telefono TEXT NOT NULL DEFAULT ''
    CHECK (telefono = '' OR char_length(btrim(telefono)) BETWEEN 3 AND 40),
  email TEXT,
  zona_horaria TEXT NOT NULL DEFAULT 'America/Santiago'
    CHECK (zona_horaria ~ '^[A-Za-z_+-]+(/[A-Za-z0-9_+.-]+)*$'),
  horarios_atencion JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(horarios_atencion) = 'array'),
  estado TEXT NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'inactiva', 'remodelacion')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sucursales_email_valido CHECK (email IS NULL OR email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

CREATE INDEX IF NOT EXISTS idx_sucursales_clinica_estado
  ON public.sucursales (clinica_id, estado, nombre);

ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sucursales_select_clinica_actual ON public.sucursales;
CREATE POLICY sucursales_select_clinica_actual
  ON public.sucursales FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual());

DROP POLICY IF EXISTS sucursales_insert_admin_actual ON public.sucursales;
CREATE POLICY sucursales_insert_admin_actual
  ON public.sucursales FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  );

DROP POLICY IF EXISTS sucursales_update_admin_actual ON public.sucursales;
CREATE POLICY sucursales_update_admin_actual
  ON public.sucursales FOR UPDATE TO authenticated
  USING (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  )
  WITH CHECK (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  );

DROP TRIGGER IF EXISTS trg_sucursales_audit ON public.sucursales;
CREATE TRIGGER trg_sucursales_audit
  AFTER INSERT OR UPDATE ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio();

DROP TRIGGER IF EXISTS trg_sucursales_updated_at ON public.sucursales;
CREATE TRIGGER trg_sucursales_updated_at
  BEFORE UPDATE ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- No se concede DELETE: las sucursales se desactivan para preservar
-- referencias históricas en agenda y horarios profesionales.
REVOKE ALL ON public.sucursales FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.sucursales TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sucursales TO service_role;

ALTER TABLE public.sucursales REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sucursales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sucursales;
  END IF;
END $$;

COMMENT ON TABLE public.sucursales IS
  'Sucursales BP08. Las bajas se representan con estado y mantienen sus UUID para referencias históricas.';
