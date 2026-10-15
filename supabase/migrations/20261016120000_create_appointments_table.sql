-- BP05 §02: Tabla oficial de appointments con los 11 campos del Blueprint
-- Reemplaza el modelo anterior basado en localStorage

-- Tabla principal
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL,
  sede_id UUID,
  patient_id UUID,
  doctor_id TEXT,
  box_id TEXT,
  prestation_id UUID,
  
  -- Campos temporales
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Campos de estado
  status TEXT NOT NULL DEFAULT 'Pendiente' 
    CHECK (status IN ('Pendiente', 'Confirmada', 'En sala de espera', 'En atención', 'Completada', 'Cancelada', 'No-show', 'Reagendada')),
  confirmation_status TEXT DEFAULT 'pendiente'
    CHECK (confirmation_status IN ('pendiente', 'enviado', 'confirmado', 'no_confirmado')),
  
  -- Campos opcionales
  motivo TEXT,
  notas_internas TEXT,
  observaciones TEXT,
  presupuesto_asociado UUID,
  
  -- Recurrencia (BP05 §07)
  recurrence_group_id TEXT,
  cita_padre_id UUID,
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Soft delete (ya existía en 20261001000002)
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT appointments_end_after_start CHECK (end_time > start_time),
  CONSTRAINT appointments_duration_valid CHECK (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60 IN (15, 30, 45, 60, 90, 120)
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinica_fecha 
  ON public.appointments(clinica_id, start_time) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_fecha 
  ON public.appointments(doctor_id, start_time) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_patient 
  ON public.appointments(patient_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status 
  ON public.appointments(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_recurrence 
  ON public.appointments(recurrence_group_id) WHERE recurrence_group_id IS NOT NULL AND deleted_at IS NULL;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON public.appointments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: habilitar
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS: políticas multi-tenant por clinica_id (usando miembros_clinica activos)
DROP POLICY IF EXISTS "Users can view appointments from their clinic" ON public.appointments;
CREATE POLICY "Users can view appointments from their clinic" 
  ON public.appointments FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can insert appointments in their clinic" ON public.appointments;
CREATE POLICY "Users can insert appointments in their clinic" 
  ON public.appointments FOR INSERT 
  WITH CHECK (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can update appointments in their clinic" ON public.appointments;
CREATE POLICY "Users can update appointments in their clinic" 
  ON public.appointments FOR UPDATE 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can delete appointments in their clinic" ON public.appointments;
CREATE POLICY "Users can delete appointments in their clinic" 
  ON public.appointments FOR DELETE 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Habilitar Realtime para la tabla (BP05 §08 - Drag & Drop en tiempo real)
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;
