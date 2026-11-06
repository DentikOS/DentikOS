-- BP08 §01: ampliar los datos administrativos de clínica.
-- Todas las columnas son aditivas y opcionales para conservar compatibilidad
-- con clínicas existentes; la fila sigue protegida por RLS y auditoría de clinicas.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS giro_comercial TEXT,
  ADD COLUMN IF NOT EXISTS comuna TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS sitio_web TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS registro_seremi TEXT,
  ADD COLUMN IF NOT EXISTS registro_isp TEXT,
  ADD COLUMN IF NOT EXISTS idioma_documentos TEXT NOT NULL DEFAULT 'es-CL',
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP';

COMMENT ON COLUMN public.clinicas.giro_comercial IS 'Giro comercial usado en la identificación administrativa de la clínica.';
COMMENT ON COLUMN public.clinicas.comuna IS 'Comuna de la dirección principal de la clínica.';
COMMENT ON COLUMN public.clinicas.region IS 'Región de la dirección principal de la clínica.';
COMMENT ON COLUMN public.clinicas.sitio_web IS 'Sitio web público opcional de la clínica.';
COMMENT ON COLUMN public.clinicas.instagram IS 'Cuenta pública de Instagram opcional de la clínica.';
COMMENT ON COLUMN public.clinicas.facebook IS 'Página pública de Facebook opcional de la clínica.';
COMMENT ON COLUMN public.clinicas.registro_seremi IS 'Número de registro SEREMI de la clínica, cuando corresponda.';
COMMENT ON COLUMN public.clinicas.registro_isp IS 'Número de registro ISP asociado a la clínica, cuando corresponda.';
COMMENT ON COLUMN public.clinicas.idioma_documentos IS 'Idioma configurado para futuros documentos localizados; MVP Chile: es-CL.';
COMMENT ON COLUMN public.clinicas.moneda IS 'Moneda fija de la clínica; MVP Chile: CLP.';
