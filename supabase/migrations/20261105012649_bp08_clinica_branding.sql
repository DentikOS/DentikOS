-- BP08: completar los campos de membrete que ya consume la aplicación.
-- La tabla conserva sus políticas RLS actuales; estas columnas quedan
-- protegidas por el mismo aislamiento de fila de public.clinicas.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS eslogan TEXT;

COMMENT ON COLUMN public.clinicas.razon_social IS 'Razón social que se muestra en membretes y documentos de la clínica.';
COMMENT ON COLUMN public.clinicas.ciudad IS 'Ciudad y región de la clínica para sus documentos.';
COMMENT ON COLUMN public.clinicas.eslogan IS 'Frase identificatoria opcional para los membretes de la clínica.';
