-- BP06: Tabla para timeline de eventos del paciente
-- Registra cambios de estado, asignación de doctor, citas, etc.

CREATE TABLE IF NOT EXISTS timeline_paciente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'cita', 'evolucion', 'receta', 'consentimiento', 
    'cambio_estado', 'cambio_doctor', 'pago', 'adjunto',
    'presupuesto', 'llamada', 'email', 'admin'
  )),
  fecha TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  titulo TEXT NOT NULL,
  detalles TEXT,
  usuario TEXT,
  profesional TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_timeline_paciente_id 
  ON timeline_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_timeline_fecha 
  ON timeline_paciente(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_tipo 
  ON timeline_paciente(tipo);

-- RLS Policies
ALTER TABLE timeline_paciente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros leen timeline de su clínica" ON timeline_paciente;
DROP POLICY IF EXISTS "Miembros crean eventos en timeline" ON timeline_paciente;

-- Policy: Solo miembros de la clínica pueden leer
CREATE POLICY "Miembros leen timeline de su clínica"
ON timeline_paciente FOR SELECT
USING (
  paciente_id IN (
    SELECT id FROM pacientes 
    WHERE user_id = auth.uid() OR clinica_id = public.clinica_actual()
  )
);

-- Policy: Solo miembros pueden insertar
CREATE POLICY "Miembros crean eventos en timeline"
ON timeline_paciente FOR INSERT
WITH CHECK (
  paciente_id IN (
    SELECT id FROM pacientes 
    WHERE user_id = auth.uid() OR clinica_id = public.clinica_actual()
  )
);

-- Comentarios
COMMENT ON TABLE timeline_paciente IS 'Timeline de eventos clínicos del paciente (BP06)';
COMMENT ON COLUMN timeline_paciente.tipo IS 'Tipo de evento: cita/evolucion/receta/cambio_estado/etc';
COMMENT ON COLUMN timeline_paciente.metadata IS 'Datos adicionales del evento en formato JSON';
