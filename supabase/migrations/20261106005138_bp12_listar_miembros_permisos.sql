-- Administrative selector for the BP12 additive permission manager.
-- Exposes only active clinic member IDs, base roles, and BP12 permission names.
CREATE OR REPLACE FUNCTION public.listar_permisos_laboratorio_bp12()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_resultado jsonb;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL
     OR public.rol_en_clinica_actual() <> 'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo administración puede consultar asignaciones de laboratorio';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'user_id', m.user_id,
    'rol', m.rol,
    'permisos', COALESCE(p.permisos, ARRAY[]::text[])
  ) ORDER BY m.rol, m.user_id), '[]'::jsonb)
  INTO v_resultado
  FROM public.miembros_clinica m
  LEFT JOIN LATERAL (
    SELECT pg_catalog.array_agg(a.permiso ORDER BY a.permiso) AS permisos
    FROM public.permisos_laboratorio_aditivos a
    WHERE a.clinica_id = v_clinica AND a.user_id = m.user_id
  ) p ON true
  WHERE m.clinica_id = v_clinica AND m.activo;
  RETURN v_resultado;
END;
$function$;
ALTER FUNCTION public.listar_permisos_laboratorio_bp12() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.listar_permisos_laboratorio_bp12() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_permisos_laboratorio_bp12() TO authenticated;
