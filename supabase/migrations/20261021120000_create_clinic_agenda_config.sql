-- BP05 §09: Configuración base de Agenda por clínica + Días festivos

-- ============================================================
-- Tabla 1: Configuración de agenda por clínica
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinic_agenda_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL UNIQUE,
  
  -- Horarios base
  horario_inicio_default TIME DEFAULT '08:00',
  horario_fin_default TIME DEFAULT '20:00',
  duracion_bloque_default INTEGER DEFAULT 30,
  
  -- Reglas de anticipación
  tiempo_minimo_anticipacion INTEGER DEFAULT 0, -- minutos, 0 = sin mínimo
  tiempo_maximo_anticipacion INTEGER DEFAULT 365, -- días
  
  -- Sobrecupos (Opción B BP05 §03)
  permitir_sobrecupos BOOLEAN DEFAULT true,
  max_sobrecupos INTEGER DEFAULT 2 CHECK (max_sobrecupos BETWEEN 1 AND 4),
  
  -- Permisos configurables de recepcionista (BP05 §09)
  recepcionista_puede_editar BOOLEAN DEFAULT true,
  recepcionista_puede_cancelar BOOLEAN DEFAULT true,
  recepcionista_puede_dragdrop BOOLEAN DEFAULT true,
  
  -- Días laborales por defecto
  dias_laborables INTEGER[] DEFAULT '{1,2,3,4,5}', -- 1=Lun ... 7=Dom
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- Tabla 2: Días festivos por clínica
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinic_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL,
  fecha DATE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'clinica', 'regional')),
  recurrente BOOLEAN DEFAULT false, -- Se repite cada año
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(clinica_id, fecha, nombre)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clinic_agenda_config_clinica 
  ON public.clinic_agenda_config(clinica_id);

CREATE INDEX IF NOT EXISTS idx_clinic_holidays_clinica_fecha 
  ON public.clinic_holidays(clinica_id, fecha);

-- RLS
ALTER TABLE public.clinic_agenda_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_holidays ENABLE ROW LEVEL SECURITY;

-- Políticas multi-tenant (usar miembros_clinica)
DROP POLICY IF EXISTS "Users can view clinic agenda config" ON public.clinic_agenda_config;
CREATE POLICY "Users can view clinic agenda config" 
  ON public.clinic_agenda_config FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage clinic agenda config" ON public.clinic_agenda_config;
CREATE POLICY "Admins can manage clinic agenda config" 
  ON public.clinic_agenda_config FOR ALL 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true AND rol = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view clinic holidays" ON public.clinic_holidays;
CREATE POLICY "Users can view clinic holidays" 
  ON public.clinic_holidays FOR SELECT 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage clinic holidays" ON public.clinic_holidays;
CREATE POLICY "Admins can manage clinic holidays" 
  ON public.clinic_holidays FOR ALL 
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.miembros_clinica 
      WHERE user_id = auth.uid() AND activo = true AND rol = 'admin'
    )
  );

-- Trigger updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_clinic_agenda_config_updated_at ON public.clinic_agenda_config;
    CREATE TRIGGER update_clinic_agenda_config_updated_at 
      BEFORE UPDATE ON public.clinic_agenda_config 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed: Config por defecto para clínicas existentes
INSERT INTO public.clinic_agenda_config (clinica_id)
SELECT DISTINCT clinica_id FROM public.miembros_clinica
ON CONFLICT (clinica_id) DO NOTHING;

-- Seed: Festivos nacionales de Chile 2026-2027 (BP05 §09 F3: B+C)
INSERT INTO public.clinic_holidays (clinica_id, fecha, nombre, tipo, recurrente)
SELECT mc.clinica_id, h.fecha, h.nombre, 'nacional', h.recurrente
FROM (SELECT DISTINCT clinica_id FROM public.miembros_clinica) mc
CROSS JOIN (VALUES
  ('2026-01-01'::date, 'Año Nuevo', true),
  ('2026-04-03'::date, 'Viernes Santo', false),
  ('2026-04-04'::date, 'Sábado Santo', false),
  ('2026-05-01'::date, 'Día del Trabajo', true),
  ('2026-05-21'::date, 'Día de las Glorias Navales', true),
  ('2026-06-20'::date, 'Día Nacional de los Pueblos Indígenas', true),
  ('2026-06-29'::date, 'San Pedro y San Pablo', true),
  ('2026-07-16'::date, 'Virgen del Carmen', true),
  ('2026-08-15'::date, 'Asunción de la Virgen', true),
  ('2026-09-18'::date, 'Fiestas Patrias', true),
  ('2026-09-19'::date, 'Día de las Glorias del Ejército', true),
  ('2026-10-12'::date, 'Encuentro de Dos Mundos', true),
  ('2026-10-31'::date, 'Día de las Iglesias Evangélicas', true),
  ('2026-11-01'::date, 'Día de Todos los Santos', true),
  ('2026-12-08'::date, 'Inmaculada Concepción', true),
  ('2026-12-25'::date, 'Navidad', true),
  ('2027-01-01'::date, 'Año Nuevo', true),
  ('2027-05-01'::date, 'Día del Trabajo', true),
  ('2027-09-18'::date, 'Fiestas Patrias', true),
  ('2027-09-19'::date, 'Día de las Glorias del Ejército', true),
  ('2027-12-25'::date, 'Navidad', true)
) AS h(fecha, nombre, recurrente)
ON CONFLICT (clinica_id, fecha, nombre) DO NOTHING;

-- Realtime
ALTER TABLE public.clinic_agenda_config REPLICA IDENTITY FULL;
ALTER TABLE public.clinic_holidays REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_agenda_config;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_holidays;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
