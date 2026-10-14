-- ============================================================
-- FIX CRÍTICO: Preservar role y clinica_id al actualizar perfil
-- Bug: admin → recepcion al actualizar perfil
-- ============================================================

DROP FUNCTION IF EXISTS public.actualizar_perfil(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
);

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
  current_metadata JSONB;
  protected_fields JSONB;
  new_fields JSONB;
  result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- ============================================================
  -- PASO 1: Leer metadata ACTUAL del usuario
  -- ============================================================
  SELECT raw_user_meta_data INTO current_metadata
  FROM auth.users
  WHERE id = v_uid;

  current_metadata := COALESCE(current_metadata, '{}'::jsonb);

  -- ============================================================
  -- PASO 2: Extraer campos PROTEGIDOS (role, clinica_id)
  -- Estos NUNCA deben ser sobreescritos por actualización de perfil
  -- ============================================================
  protected_fields := jsonb_strip_nulls(jsonb_build_object(
    'role', current_metadata->'role',
    'clinica_id', current_metadata->'clinica_id'
  ));

  -- ============================================================
  -- PASO 3: Construir nuevos campos (solo los NO NULL)
  -- ============================================================
  new_fields := jsonb_strip_nulls(jsonb_build_object(
    'full_name', p_full_name,
    'especialidad', p_especialidad,
    'telefono', p_telefono,
    'rut', p_rut
  ));

  -- ============================================================
  -- PASO 4: Fusionar metadata con MÁXIMA PROTECCIÓN
  -- Orden: existente || nuevos || protegidos
  -- Los protegidos al final = máxima prioridad (sobrescriben cualquier valor)
  -- ============================================================
  UPDATE auth.users
  SET raw_user_meta_data = (
    COALESCE(current_metadata, '{}'::jsonb)
    || COALESCE(new_fields, '{}'::jsonb)
    || protected_fields
  )
  WHERE id = v_uid;

  -- ============================================================
  -- PASO 5: Upsert en tabla profiles
  -- ============================================================
  INSERT INTO public.profiles (
    id, full_name, especialidad, telefono, rut, foto_url, biografia, redes_sociales, updated_at
  )
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

  -- ============================================================
  -- PASO 6: Retornar perfil con rol desde miembros_clinica
  -- FUENTE AUTORITATIVA: el rol contextual de la clínica activa
  -- ============================================================
  SELECT jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'especialidad', p.especialidad,
    'telefono', p.telefono,
    'rut', p.rut,
    'foto_url', p.foto_url,
    'biografia', p.biografia,
    'redes_sociales', p.redes_sociales,
    'role', COALESCE(
      (SELECT rol FROM public.miembros_clinica
       WHERE user_id = v_uid AND activo = true
       ORDER BY created_at DESC LIMIT 1),
      current_metadata->>'role',
      'recepcion'
    ),
    'clinica_id', current_metadata->>'clinica_id'
  ) INTO result
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN result;
END;
$$;

-- Grant execute (idempotente)
GRANT EXECUTE ON FUNCTION public.actualizar_perfil TO authenticated;

-- Log de la fix
DO $$
BEGIN
  RAISE NOTICE 'Fix aplicar_perfil: role y clinica_id ahora protegidos contra sobreescritura';
END $$;
