-- Arancel: reajuste masivo atómico, con control optimista de cambios y auditoría por fila.
CREATE FUNCTION bp07_private.auditar_cambio_prestacion_arancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT u.email INTO v_user_email FROM auth.users u WHERE u.id = v_user_id;
  END IF;

  IF NEW.clinica_id IS NULL THEN
    RAISE EXCEPTION 'La prestación no tiene clínica para auditar';
  END IF;

  INSERT INTO public.audit_log(
    user_id, user_email, clinica_id, table_name, record_id,
    action, old_data, new_data, created_at
  ) VALUES (
    v_user_id, v_user_email, NEW.clinica_id, TG_TABLE_NAME, NEW.id::text,
    'UPDATE', to_jsonb(OLD), to_jsonb(NEW), clock_timestamp()
  );
  RETURN NEW;
END;
$function$;

ALTER FUNCTION bp07_private.auditar_cambio_prestacion_arancel() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp07_private.auditar_cambio_prestacion_arancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_prestaciones_audit_price_update ON public.prestaciones;
CREATE TRIGGER zz_prestaciones_audit_price_update
  AFTER UPDATE OF precio_particular, precio_fonasa, precio ON public.prestaciones
  FOR EACH ROW
  WHEN (OLD.precio_particular IS DISTINCT FROM NEW.precio_particular
    OR OLD.precio_fonasa IS DISTINCT FROM NEW.precio_fonasa
    OR OLD.precio IS DISTINCT FROM NEW.precio)
  EXECUTE FUNCTION bp07_private.auditar_cambio_prestacion_arancel();

CREATE FUNCTION public.reajustar_arancel_clinica(
  p_porcentaje numeric,
  p_prestaciones_esperadas jsonb
)
RETURNS TABLE(
  id uuid,
  nombre text,
  especialidad text,
  precio_particular integer,
  precio_fonasa integer,
  codigo_fonasa text,
  precio integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_clinica uuid := public.clinica_actual();
  v_cantidad bigint;
BEGIN
  IF auth.uid() IS NULL OR v_clinica IS NULL
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para reajustar el arancel';
  END IF;

  IF p_porcentaje IS NULL OR p_porcentaje::text IN ('NaN','Infinity','-Infinity')
    OR p_porcentaje < -100 OR p_porcentaje > 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El porcentaje debe estar entre -100 y 10000';
  END IF;

  IF p_prestaciones_esperadas IS NULL
    OR jsonb_typeof(p_prestaciones_esperadas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El arancel esperado está vacío o es inválido';
  END IF;
  IF jsonb_array_length(p_prestaciones_esperadas) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El arancel esperado está vacío o es inválido';
  END IF;

  LOCK TABLE public.prestaciones IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_prestaciones_esperadas)
      AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
    WHERE e.id IS NULL OR e.precio_particular IS NULL OR e.precio_fonasa IS NULL
      OR e.precio_particular < 0 OR e.precio_fonasa < 0
  ) OR (
    SELECT count(*) <> count(DISTINCT e.id)
    FROM jsonb_to_recordset(p_prestaciones_esperadas)
      AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El arancel esperado contiene filas inválidas';
  END IF;

  SELECT count(*) INTO v_cantidad
  FROM public.prestaciones p WHERE p.clinica_id = v_clinica;

  IF v_cantidad <> jsonb_array_length(p_prestaciones_esperadas)
    OR EXISTS (
      SELECT 1 FROM public.prestaciones p
      WHERE p.clinica_id = v_clinica
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_to_recordset(p_prestaciones_esperadas)
            AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
          WHERE e.id = p.id
            AND e.precio_particular = p.precio_particular
            AND e.precio_fonasa = p.precio_fonasa
        )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'El arancel cambió desde que se cargó. Actualízalo antes de reajustar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestaciones p
    WHERE p.clinica_id = v_clinica
      AND (round(p.precio_particular::numeric * (1 + p_porcentaje / 100), 0) > 2147483647
        OR round(p.precio_fonasa::numeric * (1 + p_porcentaje / 100), 0) > 2147483647)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'El reajuste excede el máximo permitido para un precio';
  END IF;

  IF p_porcentaje = 0 THEN
    RETURN QUERY SELECT p.id, p.nombre, p.especialidad, p.precio_particular,
      p.precio_fonasa, p.codigo_fonasa, p.precio
    FROM public.prestaciones p WHERE p.clinica_id = v_clinica ORDER BY p.id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.prestaciones p
  SET precio_particular = round(p.precio_particular::numeric * (1 + p_porcentaje / 100), 0)::integer,
      precio_fonasa = round(p.precio_fonasa::numeric * (1 + p_porcentaje / 100), 0)::integer,
      precio = round(p.precio_particular::numeric * (1 + p_porcentaje / 100), 0)::integer
  WHERE p.clinica_id = v_clinica
  RETURNING p.id, p.nombre, p.especialidad, p.precio_particular,
    p.precio_fonasa, p.codigo_fonasa, p.precio;
END;
$function$;

REVOKE ALL ON FUNCTION public.reajustar_arancel_clinica(numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reajustar_arancel_clinica(numeric,jsonb) TO authenticated;
