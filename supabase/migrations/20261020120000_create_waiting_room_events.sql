-- BP05 §05: Tabla de eventos de Sala de Espera Virtual
-- Registra el flujo completo de 3 pasos: Check-in -> Llamar -> Avisado -> Iniciar

CREATE TABLE IF NOT EXISTS public.waiting_room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL,
  
  -- Tipo de evento del flujo
  tipo TEXT NOT NULL CHECK (tipo IN (
    'check_in',              -- Paciente llega a recepcion
    'llamar_siguiente',      -- Doctor solicita siguiente paciente
    'paciente_avisado',      -- Recepcionista confirma aviso
    'iniciar_atencion',      -- Doctor inicia atencion
    'reasignacion',          -- Cambio de doctor/box
    'no_show',               -- Paciente no asistio
    'llegada_temprana'       -- Paciente llego muy antes de su hora
  )),
  
  -- Datos del evento
  doctor_id UUID,
  doctor_nombre TEXT,
  box_asignado TEXT,
  minutos_espera INTEGER,
  nota TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Usuario que registro
  registrado_por UUID REFERENCES auth.users(id),
  registrado_por_nombre TEXT,
  rol_usuario TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_waiting_room_events_appointment 
  ON public.waiting_room_events(appointment_id);

CREATE INDEX IF NOT EXISTS idx_waiting_room_events_clinica 
  ON public.waiting_room_events(clinica_id);

CREATE INDEX IF NOT EXISTS idx_waiting_room_events_tipo 
  ON public.waiting_room_events(tipo);

CREATE INDEX IF NOT EXISTS idx_waiting_room_events_created_at 
  ON public.waiting_room_events(created_at DESC);

-- RLS
ALTER TABLE public.waiting_room_events ENABLE ROW LEVEL SECURITY;

-- Politicas multi-tenant
CREATE POLICY "Users can view waiting room events from their clinic" 
  ON public.waiting_room_events FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "Users can insert waiting room events in their clinic" 
  ON public.waiting_room_events FOR INSERT 
  WITH CHECK (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Realtime para sincronizacion
ALTER TABLE public.waiting_room_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_room_events;

-- Vista para obtener estado actual de sala de espera
CREATE OR REPLACE VIEW public.vw_sala_espera_actual AS
SELECT 
  wre.appointment_id,
  wre.clinica_id,
  MAX(CASE WHEN wre.tipo = 'check_in' THEN wre.created_at END) as check_in_at,
  MAX(CASE WHEN wre.tipo = 'llamar_siguiente' THEN wre.created_at END) as llamada_at,
  MAX(CASE WHEN wre.tipo = 'paciente_avisado' THEN wre.created_at END) as avisado_at,
  MAX(CASE WHEN wre.tipo = 'iniciar_atencion' THEN wre.created_at END) as inicio_at,
  MAX(CASE WHEN wre.tipo = 'no_show' THEN wre.created_at END) as no_show_at,
  MAX(wre.doctor_nombre) as doctor_nombre,
  MAX(wre.box_asignado) as box_asignado,
  COUNT(*) as total_eventos
FROM public.waiting_room_events wre
WHERE wre.created_at >= CURRENT_DATE
GROUP BY wre.appointment_id, wre.clinica_id;
