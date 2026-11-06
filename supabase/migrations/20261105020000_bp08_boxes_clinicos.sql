-- BP08 §03: configuración persistente de boxes y equipamiento por sucursal.
-- Citas conserva su box_asignado de texto para no alterar el contrato histórico
-- de Agenda; la vinculación de IDs se implementa en su incremento de integración.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sucursales_id_clinica_unique'
      AND conrelid = 'public.sucursales'::regclass
  ) THEN
    ALTER TABLE public.sucursales
      ADD CONSTRAINT sucursales_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.boxes_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  sucursal_id UUID NOT NULL,
  nombre TEXT NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 100),
  tipo TEXT NOT NULL CHECK (tipo IN ('general', 'cirugia', 'ortodoncia')),
  unidad_dental TEXT NOT NULL CHECK (char_length(btrim(unidad_dental)) BETWEEN 2 AND 120),
  anio_instalacion SMALLINT CHECK (anio_instalacion IS NULL OR anio_instalacion BETWEEN 1900 AND 2100),
  equipamiento JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(equipamiento) = 'array'),
  notas TEXT NOT NULL DEFAULT '' CHECK (char_length(notas) <= 1000),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'inactivo', 'mantenimiento')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT boxes_clinicos_sucursal_tenant_fk
    FOREIGN KEY (sucursal_id, clinica_id)
    REFERENCES public.sucursales (id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_boxes_clinicos_clinica_sucursal_estado
  ON public.boxes_clinicos (clinica_id, sucursal_id, estado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boxes_clinicos_nombre_vigente
  ON public.boxes_clinicos (sucursal_id, lower(btrim(nombre)))
  WHERE estado <> 'inactivo';

ALTER TABLE public.boxes_clinicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boxes_clinicos_select_clinica_actual ON public.boxes_clinicos;
CREATE POLICY boxes_clinicos_select_clinica_actual
  ON public.boxes_clinicos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual());

DROP POLICY IF EXISTS boxes_clinicos_insert_admin_actual ON public.boxes_clinicos;
CREATE POLICY boxes_clinicos_insert_admin_actual
  ON public.boxes_clinicos FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  );

DROP POLICY IF EXISTS boxes_clinicos_update_admin_actual ON public.boxes_clinicos;
CREATE POLICY boxes_clinicos_update_admin_actual
  ON public.boxes_clinicos FOR UPDATE TO authenticated
  USING (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  )
  WITH CHECK (
    clinica_id = public.clinica_actual()
    AND public.es_admin_de_clinica_actual()
  );

DROP TRIGGER IF EXISTS trg_boxes_clinicos_audit ON public.boxes_clinicos;
CREATE TRIGGER trg_boxes_clinicos_audit
  AFTER INSERT OR UPDATE ON public.boxes_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio();

DROP TRIGGER IF EXISTS trg_boxes_clinicos_updated_at ON public.boxes_clinicos;
CREATE TRIGGER trg_boxes_clinicos_updated_at
  BEFORE UPDATE ON public.boxes_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- El historial de agenda e inventario referencia boxes; se desactivan en vez de borrar.
REVOKE ALL ON public.boxes_clinicos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.boxes_clinicos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.boxes_clinicos TO service_role;

ALTER TABLE public.boxes_clinicos REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'boxes_clinicos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.boxes_clinicos;
  END IF;
END $$;

COMMENT ON TABLE public.boxes_clinicos IS
  'Configuración BP08 de boxes clínicos y su equipamiento; se conserva el registro al desactivarlo.';
COMMENT ON COLUMN public.boxes_clinicos.equipamiento IS
  'JSON array validado en aplicación con equipamiento disponible, marca y número de serie.';
