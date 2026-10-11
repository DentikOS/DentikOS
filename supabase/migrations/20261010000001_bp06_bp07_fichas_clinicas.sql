-- ==============================================================================
-- Migración BP06/BP07: Tabla fichas_clinicas con aislamiento multi-clínica RLS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS fichas_clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  odontograma JSONB DEFAULT '[]',
  periodontograma JSONB DEFAULT '[]',
  evoluciones JSONB DEFAULT '[]',
  recetas JSONB DEFAULT '[]',
  consentimientos JSONB DEFAULT '[]',
  plan_tratamiento JSONB DEFAULT '{}',
  timeline JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_fichas_clinica_paciente UNIQUE (clinica_id, paciente_id)
);

CREATE INDEX IF NOT EXISTS idx_fichas_paciente ON fichas_clinicas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_fichas_clinica ON fichas_clinicas(clinica_id);

ALTER TABLE fichas_clinicas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fichas_clinicas' AND policyname = 'Miembros leen fichas de su clinica'
  ) THEN
    CREATE POLICY "Miembros leen fichas de su clinica"
    ON fichas_clinicas FOR SELECT
    USING (
      clinica_id IN (
        SELECT clinica_id FROM miembros_clinica 
        WHERE user_id = auth.uid() AND activo = true
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fichas_clinicas' AND policyname = 'Miembros insertan fichas de su clinica'
  ) THEN
    CREATE POLICY "Miembros insertan fichas de su clinica"
    ON fichas_clinicas FOR INSERT
    WITH CHECK (
      clinica_id IN (
        SELECT clinica_id FROM miembros_clinica 
        WHERE user_id = auth.uid() AND activo = true
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fichas_clinicas' AND policyname = 'Miembros actualizan fichas de su clinica'
  ) THEN
    CREATE POLICY "Miembros actualizan fichas de su clinica"
    ON fichas_clinicas FOR UPDATE
    USING (
      clinica_id IN (
        SELECT clinica_id FROM miembros_clinica 
        WHERE user_id = auth.uid() AND activo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE fichas_clinicas;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
