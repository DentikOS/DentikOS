-- BP11: asegura dosis, frecuencia y duración también para escrituras API directas.
CREATE OR REPLACE FUNCTION public.receta_medicamentos_posologia_completa(p_medicamentos jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN p_medicamentos IS NULL
      OR pg_catalog.jsonb_typeof(p_medicamentos) IS DISTINCT FROM 'array'
      THEN false
    ELSE pg_catalog.jsonb_array_length(p_medicamentos) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_medicamentos) AS medicamento(value)
        WHERE pg_catalog.jsonb_typeof(medicamento.value) IS DISTINCT FROM 'object'
          OR NULLIF(pg_catalog.btrim(medicamento.value->>'nombre'), '') IS NULL
          OR NULLIF(pg_catalog.btrim(medicamento.value->>'dosis'), '') IS NULL
          OR NULLIF(pg_catalog.btrim(medicamento.value->>'frecuencia'), '') IS NULL
          OR NULLIF(pg_catalog.btrim(medicamento.value->>'duracion'), '') IS NULL
      )
  END
$function$;

COMMENT ON FUNCTION public.receta_medicamentos_posologia_completa(jsonb) IS
  'Valida que cada medicamento de una receta tenga nombre, dosis, frecuencia y duración no vacíos.';

DO $bp11_recetas_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.recetas'::pg_catalog.regclass
      AND conname = 'recetas_medicamentos_posologia_completa'
  ) THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_medicamentos_posologia_completa
      CHECK (public.receta_medicamentos_posologia_completa(medicamentos));
  END IF;
END
$bp11_recetas_constraint$;
