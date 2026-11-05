-- BP08 §16: configuración compartida de membrete para documentos de la clínica.
-- La columna vive en clinicas y hereda su aislamiento RLS y auditoría existentes.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS configuracion_documentos JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinicas'::regclass
      AND conname = 'clinicas_configuracion_documentos_objeto'
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_configuracion_documentos_objeto
      CHECK (jsonb_typeof(configuracion_documentos) = 'object');
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.clinicas.configuracion_documentos IS
  'BP08: estilo, colores y elementos visibles del membrete compartido de la clínica.';
