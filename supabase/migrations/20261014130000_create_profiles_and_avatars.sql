-- Migration: Create profiles extended columns, RPCs, and avatars bucket
-- Archivo: supabase/migrations/20261014130000_create_profiles_and_avatars.sql

-- Tabla profiles (crear si no existe)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  especialidad TEXT,
  telefono TEXT,
  rut TEXT,
  foto_url TEXT,
  biografia TEXT,
  redes_sociales JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar columnas extendidas si la tabla ya existía
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'especialidad') THEN
    ALTER TABLE public.profiles ADD COLUMN especialidad TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telefono') THEN
    ALTER TABLE public.profiles ADD COLUMN telefono TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'rut') THEN
    ALTER TABLE public.profiles ADD COLUMN rut TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'foto_url') THEN
    ALTER TABLE public.profiles ADD COLUMN foto_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'biografia') THEN
    ALTER TABLE public.profiles ADD COLUMN biografia TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'redes_sociales') THEN
    ALTER TABLE public.profiles ADD COLUMN redes_sociales JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios pueden ver su propio perfil
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- Policy: usuarios pueden actualizar su propio perfil
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Policy: usuarios pueden insertar su propio perfil
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Actualizar perfil completo (user_metadata + tabla profiles)
CREATE OR REPLACE FUNCTION public.actualizar_perfil(
  p_full_name TEXT DEFAULT NULL,
  p_especialidad TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_rut TEXT DEFAULT NULL,
  p_foto_url TEXT DEFAULT NULL,
  p_biografia TEXT DEFAULT NULL,
  p_redes_sociales JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Actualizar user_metadata en auth.users
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'full_name', p_full_name,
    'especialidad', p_especialidad,
    'telefono', p_telefono,
    'rut', p_rut
  ))
  WHERE id = v_uid;

  -- Actualizar o insertar en public.profiles
  INSERT INTO public.profiles (id, full_name, especialidad, telefono, rut, foto_url, biografia, redes_sociales, updated_at)
  VALUES (
    v_uid,
    p_full_name,
    p_especialidad,
    p_telefono,
    p_rut,
    p_foto_url,
    p_biografia,
    COALESCE(p_redes_sociales, '{}'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    especialidad = COALESCE(EXCLUDED.especialidad, public.profiles.especialidad),
    telefono = COALESCE(EXCLUDED.telefono, public.profiles.telefono),
    rut = COALESCE(EXCLUDED.rut, public.profiles.rut),
    foto_url = COALESCE(EXCLUDED.foto_url, public.profiles.foto_url),
    biografia = COALESCE(EXCLUDED.biografia, public.profiles.biografia),
    redes_sociales = COALESCE(EXCLUDED.redes_sociales, public.profiles.redes_sociales),
    updated_at = now();

  -- Retornar perfil actualizado
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'especialidad', especialidad,
    'telefono', telefono,
    'rut', rut,
    'foto_url', foto_url,
    'biografia', biografia,
    'redes_sociales', redes_sociales
  ) INTO result
  FROM public.profiles
  WHERE id = v_uid;

  RETURN result;
END;
$$;

-- RPC: Obtener perfil completo
CREATE OR REPLACE FUNCTION public.obtener_perfil()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'especialidad', especialidad,
    'telefono', telefono,
    'rut', rut,
    'foto_url', foto_url,
    'biografia', biografia,
    'redes_sociales', redes_sociales
  ) INTO result
  FROM public.profiles
  WHERE id = v_uid;

  RETURN result;
END;
$$;

-- Permisos RPC
GRANT EXECUTE ON FUNCTION public.actualizar_perfil(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_perfil() TO authenticated;

-- Storage Bucket para avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para avatars
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Avatar images are publicly accessible') THEN
    CREATE POLICY "Avatar images are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload their own avatar') THEN
    CREATE POLICY "Users can upload their own avatar"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can update their own avatar') THEN
    CREATE POLICY "Users can update their own avatar"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own avatar') THEN
    CREATE POLICY "Users can delete their own avatar"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
