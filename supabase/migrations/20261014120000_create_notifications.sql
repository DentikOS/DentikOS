-- Migration: Create notifications table (BP03 §05)
-- Archivo: supabase/migrations/20261014120000_create_notifications.sql

-- Tabla de notificaciones (multi-tenant)
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'operational', 'informational')),
  title TEXT NOT NULL,
  message TEXT,
  action_label TEXT,
  action_url TEXT,
  action_payload JSONB,
  read BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_unread 
  ON public.notificaciones(user_id, read, created_at DESC) 
  WHERE read = false AND dismissed = false;

CREATE INDEX IF NOT EXISTS idx_notificaciones_clinic 
  ON public.notificaciones(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_expires 
  ON public.notificaciones(expires_at) 
  WHERE expires_at IS NOT NULL;

-- RLS: Habilitar
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- RLS Policy: usuarios solo ven sus propias notificaciones
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notificaciones;
CREATE POLICY "Users can view own notifications"
  ON public.notificaciones
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: usuarios pueden actualizar sus propias notificaciones (marcar leídas)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notificaciones;
CREATE POLICY "Users can update own notifications"
  ON public.notificaciones
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: usuarios pueden eliminar sus propias notificaciones
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notificaciones;
CREATE POLICY "Users can delete own notifications"
  ON public.notificaciones
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policy: inserción desde service_role (backend/triggers)
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notificaciones;
CREATE POLICY "Service role can insert notifications"
  ON public.notificaciones
  FOR INSERT
  WITH CHECK (true);

-- Habilitar Realtime para esta tabla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END $$;

-- ============================================================
-- FUNCIÓN DE PURGA AUTOMÁTICA
-- Ejecuta limpieza de notificaciones antiguas:
--   - Informativas: > 14 días
--   - Operativas: > 7 días
--   - Críticas leídas: > 30 días
--   - Expiradas (expires_at < now())
-- ============================================================
CREATE OR REPLACE FUNCTION public.purgar_notificaciones_antiguas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.notificaciones
    WHERE
      -- Expiradas por expires_at
      (expires_at IS NOT NULL AND expires_at < now())
      OR
      -- Informativas antiguas (>14 días)
      (severity = 'informational' AND created_at < now() - INTERVAL '14 days')
      OR
      -- Operativas antiguas (>7 días)
      (severity = 'operational' AND created_at < now() - INTERVAL '7 days')
      OR
      -- Críticas LEÍDAS antiguas (>30 días) - las no leídas NUNCA se purgan
      (severity = 'critical' AND read = true AND created_at < now() - INTERVAL '30 days')
      OR
      -- Descartadas por el usuario (>1 día de gracia)
      (dismissed = true AND created_at < now() - INTERVAL '1 day')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- JOB DIARIO DE PURGA (pg_cron)
-- Corre todos los días a las 2:00 AM (hora del servidor)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-notifications-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-notifications-daily');
  
  PERFORM cron.schedule(
    'purge-old-notifications-daily',
    '0 2 * * *',
    'SELECT public.purgar_notificaciones_antiguas()'
  );
END $$;

-- ============================================================
-- FUNCIÓN HELPER: Crear notificación (para usar desde RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.crear_notificacion(
  p_user_id UUID,
  p_clinic_id UUID,
  p_severity TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_payload JSONB DEFAULT NULL,
  p_expires_in_hours INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id UUID;
  expires_at_calc TIMESTAMPTZ;
BEGIN
  -- Validar severity
  IF p_severity NOT IN ('critical', 'operational', 'informational') THEN
    RAISE EXCEPTION 'Invalid severity: %', p_severity;
  END IF;
  
  -- Calcular expires_at si se proporcionó
  IF p_expires_in_hours IS NOT NULL THEN
    expires_at_calc := now() + (p_expires_in_hours || ' hours')::INTERVAL;
  END IF;
  
  INSERT INTO public.notificaciones (
    user_id, clinic_id, severity, title, message,
    action_label, action_url, action_payload, expires_at
  )
  VALUES (
    p_user_id, p_clinic_id, p_severity, p_title, p_message,
    p_action_label, p_action_url, p_action_payload, expires_at_calc
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.crear_notificacion TO authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_notificaciones_antiguas TO service_role;
