-- BP05 §04: Tabla de historial de confirmaciones de citas
-- Registra cada intento de confirmación (WhatsApp, teléfono, presencial)

CREATE TABLE IF NOT EXISTS public.appointment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL,
  
  -- Tipo de confirmación
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp_enviado', 'whatsapp_respondido', 'telefono', 'presencial', 'cancelacion_paciente')),
  
  -- Datos del intento
  canal TEXT, -- 'whatsapp', 'telefono', 'presencial', 'cancelacion'
  mensaje_enviado TEXT, -- Plantilla usada (si aplica)
  respuesta_paciente TEXT, -- Respuesta recibida (si aplica)
  motivo_cancelacion TEXT, -- Motivo si el paciente canceló
  
  -- Usuario que registró
  registrado_por UUID REFERENCES auth.users(id),
  registrado_por_nombre TEXT,
  rol_usuario TEXT, -- admin, dentista, recepcionista
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_appointment 
  ON public.appointment_confirmations(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_clinica 
  ON public.appointment_confirmations(clinica_id);

CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_tipo 
  ON public.appointment_confirmations(tipo);

CREATE INDEX IF NOT EXISTS idx_appointment_confirmations_created_at 
  ON public.appointment_confirmations(created_at DESC);

-- RLS
ALTER TABLE public.appointment_confirmations ENABLE ROW LEVEL SECURITY;

-- Políticas multi-tenant (usar miembros_clinica)
DROP POLICY IF EXISTS "Users can view confirmations from their clinic" ON public.appointment_confirmations;
CREATE POLICY "Users can view confirmations from their clinic" 
  ON public.appointment_confirmations FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can insert confirmations in their clinic" ON public.appointment_confirmations;
CREATE POLICY "Users can insert confirmations in their clinic" 
  ON public.appointment_confirmations FOR INSERT 
  WITH CHECK (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Realtime para sincronización
ALTER TABLE public.appointment_confirmations REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'appointment_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_confirmations;
  END IF;
END $$;
