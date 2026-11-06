-- BP11: recetas pasa a ser el único registro para nuevas prescripciones.
-- Los JSON históricos de fichas_clinicas se conservan como archivo.

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS profesional text,
  ADD COLUMN IF NOT EXISTS hash_forense text,
  ADD COLUMN IF NOT EXISTS qr_token text;

COMMENT ON COLUMN public.recetas.profesional IS
  'Nombre profesional mostrado en la receta; identidad de emisión respaldada por user_id.';
COMMENT ON COLUMN public.recetas.hash_forense IS
  'Identificador/hash de trazabilidad heredado o calculado para el contenido de la receta.';
COMMENT ON COLUMN public.recetas.qr_token IS
  'Token opaco reservado para la futura verificación QR de la receta.';

-- RLS: retirar policies globales que se combinaban con las tenant-aware por OR.
DROP POLICY IF EXISTS recetas_select_rol ON public.recetas;
DROP POLICY IF EXISTS recetas_insert_rol ON public.recetas;
DROP POLICY IF EXISTS recetas_update_rol ON public.recetas;
DROP POLICY IF EXISTS recetas_delete_rol ON public.recetas;

-- Además de validar membresía y rol, toda fila debe pertenecer a la clínica activa.
DROP POLICY IF EXISTS recetas_select_clinica ON public.recetas;
CREATE POLICY recetas_select_clinica ON public.recetas FOR SELECT
  USING (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::app_role[])
  );

DROP POLICY IF EXISTS recetas_insert_clinica ON public.recetas;
CREATE POLICY recetas_insert_clinica ON public.recetas FOR INSERT
  WITH CHECK (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND user_id = auth.uid()
    AND tiene_rol_en_clinica(ARRAY['admin','dentista']::app_role[])
  );

DROP POLICY IF EXISTS recetas_update_clinica ON public.recetas;
CREATE POLICY recetas_update_clinica ON public.recetas FOR UPDATE
  USING (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND tiene_rol_en_clinica(ARRAY['admin','dentista']::app_role[])
  )
  WITH CHECK (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND tiene_rol_en_clinica(ARRAY['admin','dentista']::app_role[])
  );

DROP POLICY IF EXISTS recetas_delete_clinica ON public.recetas;
CREATE POLICY recetas_delete_clinica ON public.recetas FOR DELETE
  USING (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND tiene_rol_en_clinica(ARRAY['admin','dentista']::app_role[])
  );

-- Fail atomically if the legacy source is no longer complete or its audit actor
-- cannot be established. No patient data is printed by this validation block.
DO $bp11_backfill_validation$
DECLARE
  v_total integer;
  v_distinct_ids integer;
BEGIN
  WITH legacy AS (
    SELECT f.paciente_id, f.clinica_id, e.item, e.item->>'id' AS recipe_id
    FROM public.fichas_clinicas f
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(f.recetas) = 'array' THEN f.recetas ELSE '[]'::jsonb END
    ) AS e(item)
  )
  SELECT count(*), count(DISTINCT recipe_id)
    INTO v_total, v_distinct_ids
    FROM legacy;

  IF v_total <> v_distinct_ids THEN
    RAISE EXCEPTION 'BP11 backfill detenido: hay IDs de recetas históricas duplicados.';
  END IF;

  IF EXISTS (
    WITH legacy AS (
      SELECT f.paciente_id, f.clinica_id, e.item, e.item->>'id' AS recipe_id
      FROM public.fichas_clinicas f
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(f.recetas) = 'array' THEN f.recetas ELSE '[]'::jsonb END
      ) AS e(item)
    )
    SELECT 1
    FROM legacy l
    WHERE l.recipe_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR substring(coalesce(l.item->>'fecha', '') FROM 1 FOR 10) !~ '^\d{4}-\d{2}-\d{2}$'
       OR jsonb_typeof(l.item->'medicamentos') <> 'array'
       OR jsonb_array_length(CASE WHEN jsonb_typeof(l.item->'medicamentos') = 'array' THEN l.item->'medicamentos' ELSE '[]'::jsonb END) = 0
       OR nullif(btrim(l.item->>'profesional'), '') IS NULL
       OR nullif(btrim(l.item->>'hashForense'), '') IS NULL
       OR nullif(btrim(l.item->>'qrToken'), '') IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.pacientes p
         WHERE p.id = l.paciente_id AND p.clinica_id = l.clinica_id
       )
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(l.item->'medicamentos') = 'array' THEN l.item->'medicamentos' ELSE '[]'::jsonb END
         ) AS m(item)
         WHERE jsonb_typeof(m.item) <> 'object'
            OR nullif(btrim(m.item->>'nombre'), '') IS NULL
            OR nullif(btrim(m.item->>'dosis'), '') IS NULL
            OR nullif(btrim(m.item->>'frecuencia'), '') IS NULL
            OR nullif(btrim(m.item->>'duracion'), '') IS NULL
       )
  ) THEN
    RAISE EXCEPTION 'BP11 backfill detenido: una receta histórica no cumple las condiciones de integridad.';
  END IF;

  IF EXISTS (
    WITH legacy AS (
      SELECT f.paciente_id, f.clinica_id, e.item, e.item->>'id' AS recipe_id
      FROM public.fichas_clinicas f
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(f.recetas) = 'array' THEN f.recetas ELSE '[]'::jsonb END
      ) AS e(item)
    ), audit_matches AS (
      SELECT l.recipe_id, a.user_id, a.created_at, a.id
      FROM legacy l
      JOIN public.audit_log a
        ON a.table_name = 'fichas_clinicas'
       AND a.clinica_id = l.clinica_id
       AND a.new_data ? 'recetas'
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(a.new_data->'recetas') = 'array' THEN a.new_data->'recetas' ELSE '[]'::jsonb END
      ) AS ae(item)
      WHERE ae.item->>'id' = l.recipe_id
    )
    SELECT 1
    FROM legacy l
    LEFT JOIN audit_matches a ON a.recipe_id = l.recipe_id
    GROUP BY l.recipe_id
    HAVING count(a.id) = 0
       OR count(DISTINCT a.user_id) <> 1
       OR bool_or(a.user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'BP11 backfill detenido: no se pudo vincular cada receta con un autor de auditoría único.';
  END IF;

  IF EXISTS (
    WITH legacy AS (
      SELECT f.paciente_id, f.clinica_id, e.item, (e.item->>'id')::uuid AS recipe_id
      FROM public.fichas_clinicas f
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(f.recetas) = 'array' THEN f.recetas ELSE '[]'::jsonb END
      ) AS e(item)
    )
    SELECT 1
    FROM legacy l
    JOIN public.recetas r ON r.id = l.recipe_id
    WHERE r.paciente_id IS DISTINCT FROM l.paciente_id
       OR r.clinica_id IS DISTINCT FROM l.clinica_id
       OR r.fecha IS DISTINCT FROM substring(l.item->>'fecha' FROM 1 FOR 10)::date
       OR r.medicamentos IS DISTINCT FROM l.item->'medicamentos'
       OR r.profesional IS DISTINCT FROM l.item->>'profesional'
       OR r.hash_forense IS DISTINCT FROM l.item->>'hashForense'
       OR r.qr_token IS DISTINCT FROM l.item->>'qrToken'
  ) THEN
    RAISE EXCEPTION 'BP11 backfill detenido: un ID histórico ya existe con contenido distinto.';
  END IF;
END
$bp11_backfill_validation$;

-- Copia íntegra del JSONB de medicamentos. Diagnóstico e indicaciones no
-- existentes en el origen se conservan como NULL; firma digital no se simula.
WITH legacy AS (
  SELECT f.paciente_id, f.clinica_id, e.item, (e.item->>'id')::uuid AS recipe_id
  FROM public.fichas_clinicas f
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(f.recetas) = 'array' THEN f.recetas ELSE '[]'::jsonb END
  ) AS e(item)
), audit_matches AS (
  SELECT l.recipe_id, a.user_id, a.created_at, a.id
  FROM legacy l
  JOIN public.audit_log a
    ON a.table_name = 'fichas_clinicas'
   AND a.clinica_id = l.clinica_id
   AND a.new_data ? 'recetas'
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.new_data->'recetas') = 'array' THEN a.new_data->'recetas' ELSE '[]'::jsonb END
  ) AS ae(item)
  WHERE ae.item->>'id' = l.item->>'id'
), first_actor AS (
  SELECT DISTINCT ON (recipe_id) recipe_id, user_id
  FROM audit_matches
  ORDER BY recipe_id, created_at ASC, id ASC
)
INSERT INTO public.recetas (
  id, user_id, paciente_id, clinica_id, fecha, medicamentos,
  diagnostico, indicaciones, firma, profesional, hash_forense, qr_token
)
SELECT
  l.recipe_id,
  a.user_id,
  l.paciente_id,
  l.clinica_id,
  substring(l.item->>'fecha' FROM 1 FOR 10)::date,
  l.item->'medicamentos',
  NULL,
  NULL,
  NULL,
  l.item->>'profesional',
  l.item->>'hashForense',
  l.item->>'qrToken'
FROM legacy l
JOIN first_actor a ON a.recipe_id = l.recipe_id
ON CONFLICT (id) DO NOTHING;
