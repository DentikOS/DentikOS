ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS configuracion_convenios JSONB NOT NULL
  DEFAULT '{"version":1,"categorias":[],"convenios":[]}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinicas_configuracion_convenios_valida'
      AND conrelid = 'public.clinicas'::regclass
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_configuracion_convenios_valida
      CHECK (
        coalesce(jsonb_typeof(configuracion_convenios) = 'object', false)
        AND coalesce(jsonb_typeof(configuracion_convenios->'categorias') = 'array', false)
        AND coalesce(jsonb_typeof(configuracion_convenios->'convenios') = 'array', false)
        AND coalesce(configuracion_convenios->>'version' = '1', false)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.clinicas.configuracion_convenios IS
  'Configuración de convenios y descuentos por categoría compartida por los miembros de esta clínica. Los valores se inician vacíos y se editan mediante la política RLS existente de administradores.';
