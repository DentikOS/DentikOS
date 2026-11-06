ALTER TABLE public.prestaciones
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS ahorro_estimado text;

COMMENT ON COLUMN public.prestaciones.descripcion IS
  'Descripción compartida de la prestación o del pack promocional.';
COMMENT ON COLUMN public.prestaciones.ahorro_estimado IS
  'Texto del ahorro promocional mostrado para packs clínicos.';
