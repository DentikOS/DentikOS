-- BP06 §03 (Creación de Paciente) + BP06 §04 (Estados del Paciente)
-- Agrega columnas faltantes para persistir estado clínico, doctor tratante,
-- bloqueo, etiquetas y fechas de seguimiento.

-- 1. Columnas nuevas
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS doctor_tratante_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT,
  ADD COLUMN IF NOT EXISTS etiquetas JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fecha_ultima_visita TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT NOW();

-- 2. Restricción de valores válidos para estado
ALTER TABLE pacientes
  DROP CONSTRAINT IF EXISTS chk_pacientes_estado;

ALTER TABLE pacientes
  ADD CONSTRAINT chk_pacientes_estado
  CHECK (estado IN ('nuevo', 'activo', 'inactivo', 'bloqueado', 'desactivado'));

-- 3. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pacientes_estado
  ON pacientes(estado);
CREATE INDEX IF NOT EXISTS idx_pacientes_doctor_tratante
  ON pacientes(doctor_tratante_id);

-- 4. Normalizar datos existentes
UPDATE pacientes SET estado = 'nuevo' WHERE estado IS NULL;
UPDATE pacientes SET etiquetas = '[]'::jsonb WHERE etiquetas IS NULL;
UPDATE pacientes SET bloqueado = false WHERE bloqueado IS NULL;

-- 5. Documentación
COMMENT ON COLUMN pacientes.estado IS 'Estado clínico: nuevo/activo/inactivo/bloqueado/desactivado (BP06 §04)';
COMMENT ON COLUMN pacientes.doctor_tratante_id IS 'UUID del doctor tratante (BP06 §01)';
COMMENT ON COLUMN pacientes.bloqueado IS 'Flag de bloqueo administrativo (BP06 §04)';
COMMENT ON COLUMN pacientes.motivo_bloqueo IS 'Motivo obligatorio del bloqueo';
COMMENT ON COLUMN pacientes.etiquetas IS 'Array JSON de etiquetas del paciente';
COMMENT ON COLUMN pacientes.fecha_ultima_visita IS 'Para cálculo de transición activo→inactivo (12 meses)';
COMMENT ON COLUMN pacientes.fecha_creacion IS 'Para sugerencias suaves post-creación (7 días, BP06 §03)';
