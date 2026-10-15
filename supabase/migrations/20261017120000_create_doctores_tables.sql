-- BP05 §03: Tablas de doctores con horarios por sede
-- Aplicar vía MCP de Supabase en el proyecto remoto

-- Tabla principal de doctores
CREATE TABLE IF NOT EXISTS public.doctores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  especialidad TEXT,
  rut TEXT,
  email TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  permite_sobrecupos BOOLEAN DEFAULT true,
  max_sobrecupos INTEGER DEFAULT 2 CHECK (max_sobrecupos BETWEEN 1 AND 4),
  color_identidad TEXT DEFAULT '#64748B',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabla de horarios por doctor + sede (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS public.doctor_sede_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctores(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_bloque_minutos INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT horarios_validos CHECK (hora_fin > hora_inicio)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_doctores_clinica_activo 
  ON public.doctores(clinica_id) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_doctor_sede_horarios_doctor 
  ON public.doctor_sede_horarios(doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctor_sede_horarios_sede_dia 
  ON public.doctor_sede_horarios(sede_id, dia_semana);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_doctores_updated_at ON public.doctores;
CREATE TRIGGER update_doctores_updated_at 
  BEFORE UPDATE ON public.doctores 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: habilitar
ALTER TABLE public.doctores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_sede_horarios ENABLE ROW LEVEL SECURITY;

-- Políticas multi-tenant para doctores
DROP POLICY IF EXISTS "Users can view doctors from their clinic" ON public.doctores;
CREATE POLICY "Users can view doctors from their clinic" 
  ON public.doctores FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can insert doctors in their clinic" ON public.doctores;
CREATE POLICY "Users can insert doctors in their clinic" 
  ON public.doctores FOR INSERT 
  WITH CHECK (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can update doctors in their clinic" ON public.doctores;
CREATE POLICY "Users can update doctors in their clinic" 
  ON public.doctores FOR UPDATE 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can delete doctors in their clinic" ON public.doctores;
CREATE POLICY "Users can delete doctors in their clinic" 
  ON public.doctores FOR DELETE 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Políticas multi-tenant para doctor_sede_horarios
DROP POLICY IF EXISTS "Users can view schedules from their clinic doctors" ON public.doctor_sede_horarios;
CREATE POLICY "Users can view schedules from their clinic doctors" 
  ON public.doctor_sede_horarios FOR SELECT 
  USING (
    doctor_id IN (
      SELECT id FROM public.doctores 
      WHERE clinica_id IN (
        SELECT clinica_id FROM public.miembros_clinica 
        WHERE user_id = auth.uid() AND activo = true
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage schedules in their clinic" ON public.doctor_sede_horarios;
CREATE POLICY "Admins can manage schedules in their clinic" 
  ON public.doctor_sede_horarios FOR ALL 
  USING (
    doctor_id IN (
      SELECT d.id FROM public.doctores d
      JOIN public.miembros_clinica mc ON d.clinica_id = mc.clinica_id
      WHERE mc.user_id = auth.uid() AND mc.activo = true
    )
  );

-- Realtime para sincronización en tiempo real
ALTER TABLE public.doctores REPLICA IDENTITY FULL;
ALTER TABLE public.doctor_sede_horarios REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doctores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doctor_sede_horarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_sede_horarios;
  END IF;
END $$;
