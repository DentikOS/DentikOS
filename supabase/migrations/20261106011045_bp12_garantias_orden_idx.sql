-- Supports clinic-scoped warranty lookups by original order and the
-- foreign-key check when an original laboratory order is updated or deleted.
CREATE INDEX IF NOT EXISTS garantias_laboratorio_clinica_orden_original_idx
  ON public.garantias_laboratorio (clinica_id, orden_original_id, created_at DESC);
