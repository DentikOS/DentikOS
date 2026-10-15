-- Crear tabla appointment_audit_log para auditoría de cambios de estado
CREATE TABLE IF NOT EXISTS public.appointment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id TEXT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  usuario_id TEXT,
  motivo TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  clinica_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_appointment_audit_log_cita_id 
  ON public.appointment_audit_log(cita_id);

CREATE INDEX IF NOT EXISTS idx_appointment_audit_log_timestamp 
  ON public.appointment_audit_log(timestamp);

CREATE INDEX IF NOT EXISTS idx_appointment_audit_log_clinica 
  ON public.appointment_audit_log(clinica_id);

-- RLS
ALTER TABLE public.appointment_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver logs de su clínica
DROP POLICY IF EXISTS "Users can view audit logs from their clinic" ON public.appointment_audit_log;
CREATE POLICY "Users can view audit logs from their clinic" 
  ON public.appointment_audit_log FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
    OR clinica_id IS NULL  -- Permitir logs sin clinica_id (legacy)
  );

-- Política: usuarios pueden insertar logs
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.appointment_audit_log;
CREATE POLICY "Users can insert audit logs" 
  ON public.appointment_audit_log FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Realtime
ALTER TABLE public.appointment_audit_log REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'appointment_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_audit_log;
  END IF;
END $$;
