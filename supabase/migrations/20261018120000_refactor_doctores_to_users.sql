-- BP05 §03 REFACTOR: Eliminar tabla doctores y usar miembros_clinica + perfiles
-- Razón: Los doctores son usuarios con rol dentista/admin, no entidad separada

-- 1. Eliminar tablas antiguas (si existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_sede_horarios' AND table_schema = 'public') THEN
    DROP TABLE public.doctor_sede_horarios CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctores' AND table_schema = 'public') THEN
    DROP TABLE public.doctores CASCADE;
  END IF;
END $$;

-- 2. Crear tabla de configuración de agenda por usuario
CREATE TABLE IF NOT EXISTS public.user_agenda_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL,
  permite_sobrecupos BOOLEAN DEFAULT true,
  max_sobrecupos INTEGER DEFAULT 2 CHECK (max_sobrecupos BETWEEN 1 AND 4),
  color_identidad TEXT DEFAULT '#64748B',
  activo_en_agenda BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, clinica_id)
);

-- 3. Crear tabla de horarios por usuario + sede
CREATE TABLE IF NOT EXISTS public.user_sede_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL,
  sede_id UUID NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_bloque_minutos INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT horarios_validos CHECK (hora_fin > hora_inicio),
  UNIQUE(user_id, sede_id, dia_semana)
);

-- Foreign keys a profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_agenda_config_profile') THEN
    ALTER TABLE public.user_agenda_config
      ADD CONSTRAINT fk_user_agenda_config_profile
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_sede_horarios_profile') THEN
    ALTER TABLE public.user_sede_horarios
      ADD CONSTRAINT fk_user_sede_horarios_profile
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_miembros_clinica_profile') THEN
    ALTER TABLE public.miembros_clinica
      ADD CONSTRAINT fk_miembros_clinica_profile
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Vista perfiles para compatibilidad con código
CREATE OR REPLACE VIEW public.perfiles AS
SELECT 
  id,
  email,
  full_name,
  full_name AS nombre_completo,
  role,
  especialidad,
  telefono,
  rut,
  foto_url,
  biografia,
  redes_sociales,
  created_at,
  updated_at
FROM public.profiles;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_agenda_config_clinica 
  ON public.user_agenda_config(clinica_id) WHERE activo_en_agenda = true;

CREATE INDEX IF NOT EXISTS idx_user_sede_horarios_user 
  ON public.user_sede_horarios(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sede_horarios_clinica_sede_dia 
  ON public.user_sede_horarios(clinica_id, sede_id, dia_semana);

-- 5. RLS: habilitar
ALTER TABLE public.user_agenda_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sede_horarios ENABLE ROW LEVEL SECURITY;

-- 6. Políticas multi-tenant
DROP POLICY IF EXISTS "Users can view agenda config from their clinic" ON public.user_agenda_config;
CREATE POLICY "Users can view agenda config from their clinic" 
  ON public.user_agenda_config FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can manage their own agenda config" ON public.user_agenda_config;
CREATE POLICY "Users can manage their own agenda config" 
  ON public.user_agenda_config FOR ALL 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage clinic agenda config" ON public.user_agenda_config;
CREATE POLICY "Admins can manage clinic agenda config" 
  ON public.user_agenda_config FOR ALL 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND rol = 'admin' AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can view schedules from their clinic" ON public.user_sede_horarios;
CREATE POLICY "Users can view schedules from their clinic" 
  ON public.user_sede_horarios FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Users can manage their own schedules" ON public.user_sede_horarios;
CREATE POLICY "Users can manage their own schedules" 
  ON public.user_sede_horarios FOR ALL 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage clinic schedules" ON public.user_sede_horarios;
CREATE POLICY "Admins can manage clinic schedules" 
  ON public.user_sede_horarios FOR ALL 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND rol = 'admin' AND activo = true
    )
  );

-- 7. Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_user_agenda_config_updated_at ON public.user_agenda_config;
CREATE TRIGGER update_user_agenda_config_updated_at 
  BEFORE UPDATE ON public.user_agenda_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Realtime para sincronización en tiempo real
ALTER TABLE public.user_agenda_config REPLICA IDENTITY FULL;
ALTER TABLE public.user_sede_horarios REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_agenda_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_agenda_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_sede_horarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sede_horarios;
  END IF;
END $$;

-- 9. Insertar configuración inicial para usuarios existentes (dentista/admin)
INSERT INTO public.user_agenda_config (user_id, clinica_id, color_identidad)
SELECT 
  mc.user_id,
  mc.clinica_id,
  CASE 
    WHEN mc.rol = 'admin' THEN '#B88E3A'
    WHEN mc.rol = 'dentista' THEN '#0D9488'
    ELSE '#64748B'
  END
FROM public.miembros_clinica mc
WHERE mc.rol IN ('dentista', 'admin')
  AND mc.activo = true
ON CONFLICT (user_id, clinica_id) DO NOTHING;

-- 10. Insertar horarios por defecto (Lun-Vie 09:00-18:00) para usuarios existentes
INSERT INTO public.user_sede_horarios (user_id, clinica_id, sede_id, dia_semana, hora_inicio, hora_fin)
SELECT 
  mc.user_id,
  mc.clinica_id,
  mc.clinica_id,
  dia.dia,
  '09:00'::time,
  '18:00'::time
FROM public.miembros_clinica mc
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS dia(dia)
WHERE mc.rol IN ('dentista', 'admin')
  AND mc.activo = true
ON CONFLICT (user_id, sede_id, dia_semana) DO NOTHING;
