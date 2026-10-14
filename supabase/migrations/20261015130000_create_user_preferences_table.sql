-- ============================================================
-- Crear tabla user_preferences (BP04 §05)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clinic_id, preference_key)
);

-- Crear índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_clinic 
ON public.user_preferences(user_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at 
ON public.user_preferences(updated_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios solo pueden ver/editar sus propias preferencias
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" 
ON public.user_preferences FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" 
ON public.user_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" 
ON public.user_preferences FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete own preferences" 
ON public.user_preferences FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at 
BEFORE UPDATE ON public.user_preferences 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
