-- BP08: categorías/códigos internos y carga inicial transaccional del catálogo.
-- Una tarifa Fonasa NULL significa "pendiente de revisión"; cero sigue siendo explícito.

ALTER TABLE public.prestaciones
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ALTER COLUMN precio_fonasa DROP NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'prestaciones_codigo_interno_no_vacio'
      AND conrelid = 'public.prestaciones'::regclass
  ) THEN
    ALTER TABLE public.prestaciones
      ADD CONSTRAINT prestaciones_codigo_interno_no_vacio
      CHECK (codigo_interno IS NULL OR pg_catalog.length(pg_catalog.btrim(codigo_interno)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'prestaciones_categoria_no_vacia'
      AND conrelid = 'public.prestaciones'::regclass
  ) THEN
    ALTER TABLE public.prestaciones
      ADD CONSTRAINT prestaciones_categoria_no_vacia
      CHECK (categoria IS NULL OR pg_catalog.length(pg_catalog.btrim(categoria)) > 0);
  END IF;
END;
$constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS prestaciones_clinica_codigo_interno_uidx
  ON public.prestaciones (clinica_id, pg_catalog.lower(pg_catalog.btrim(codigo_interno)))
  WHERE codigo_interno IS NOT NULL AND pg_catalog.btrim(codigo_interno) <> '';

COMMENT ON COLUMN public.prestaciones.codigo_interno IS
  'Código operativo del catálogo BP08; no sustituye el código oficial Fonasa.';
COMMENT ON COLUMN public.prestaciones.categoria IS
  'Categoría de catálogo utilizada para clasificar y resolver convenios.';
COMMENT ON COLUMN public.prestaciones.precio_fonasa IS
  'Tarifa Fonasa explícita; NULL indica que debe revisarse antes de cotizar.';

CREATE OR REPLACE FUNCTION public.importar_plantilla_prestaciones(
  p_plantilla text,
  p_prestaciones jsonb
)
RETURNS SETOF public.prestaciones
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id uuid;
  v_user_id uuid;
  v_cantidad_esperada integer;
  v_cantidad integer;
  v_cantidad_catalogo bigint;
  v_item jsonb;
  v_codigo text;
  v_categoria text;
  v_nombre text;
  v_especialidad text;
  v_precio_particular integer;
  v_codigos text[] := ARRAY[]::text[];
BEGIN
  v_user_id := auth.uid();
  v_clinica_id := public.clinica_actual();

  IF v_user_id IS NULL OR v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'CLINICA_NO_AUTORIZADA' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(public.tiene_rol_en_clinica(ARRAY['admin']::public.app_role[]), false) THEN
    RAISE EXCEPTION 'SOLO_ADMIN_PUEDE_IMPORTAR_PLANTILLA' USING ERRCODE = '42501';
  END IF;

  CASE p_plantilla
    WHEN 'general' THEN v_cantidad_esperada := 20;
    WHEN 'ortodoncia' THEN v_cantidad_esperada := 30;
    WHEN 'cirugia_rehabilitacion' THEN v_cantidad_esperada := 35;
    ELSE RAISE EXCEPTION 'PLANTILLA_INVALIDA' USING ERRCODE = '22023';
  END CASE;

  IF pg_catalog.jsonb_typeof(p_prestaciones) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'PRESTACIONES_INVALIDAS' USING ERRCODE = '22023';
  END IF;
  v_cantidad := pg_catalog.jsonb_array_length(p_prestaciones);
  IF v_cantidad <> v_cantidad_esperada THEN
    RAISE EXCEPTION 'CANTIDAD_PLANTILLA_INVALIDA' USING ERRCODE = '22023';
  END IF;

  -- Serializa la comprobación de catálogo vacío frente a altas concurrentes.
  -- La carga es única y breve; evita insertar sobre un catálogo recién creado.
  LOCK TABLE public.prestaciones IN SHARE ROW EXCLUSIVE MODE;

  SELECT pg_catalog.count(*)
    INTO v_cantidad_catalogo
    FROM public.prestaciones
   WHERE clinica_id = v_clinica_id;
  IF v_cantidad_catalogo <> 0 THEN
    RAISE EXCEPTION 'CATALOGO_NO_VACIO' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_prestaciones) AS payload(value)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'PRESTACION_INVALIDA' USING ERRCODE = '22023';
    END IF;

    v_codigo := pg_catalog.upper(pg_catalog.btrim(COALESCE(v_item->>'codigo_interno', '')));
    v_categoria := pg_catalog.btrim(COALESCE(v_item->>'categoria', ''));
    v_nombre := pg_catalog.btrim(COALESCE(v_item->>'nombre', ''));
    v_especialidad := pg_catalog.btrim(COALESCE(v_item->>'especialidad', ''));

    IF v_codigo !~ '^[A-Z]{2,4}-[0-9]{2}$'
       OR v_categoria = '' OR pg_catalog.length(v_categoria) > 80
       OR v_nombre = '' OR pg_catalog.length(v_nombre) > 200
       OR v_especialidad = '' OR pg_catalog.length(v_especialidad) > 120 THEN
      RAISE EXCEPTION 'DATOS_PLANTILLA_INVALIDOS' USING ERRCODE = '22023';
    END IF;
    IF v_codigo = ANY(v_codigos) THEN
      RAISE EXCEPTION 'CODIGO_INTERNO_DUPLICADO' USING ERRCODE = '22023';
    END IF;
    v_codigos := pg_catalog.array_append(v_codigos, v_codigo);

    IF pg_catalog.jsonb_typeof(v_item->'precio_particular') IS DISTINCT FROM 'number'
       OR (v_item->>'precio_particular') !~ '^(0|[1-9][0-9]*)$'
       OR pg_catalog.length(v_item->>'precio_particular') > 10 THEN
      RAISE EXCEPTION 'PRECIO_PARTICULAR_INVALIDO' USING ERRCODE = '22023';
    END IF;
    v_precio_particular := (v_item->>'precio_particular')::integer;

    IF v_item ? 'precio_fonasa'
       AND pg_catalog.jsonb_typeof(v_item->'precio_fonasa') IS DISTINCT FROM 'null' THEN
      IF pg_catalog.jsonb_typeof(v_item->'precio_fonasa') IS DISTINCT FROM 'number'
         OR (v_item->>'precio_fonasa') !~ '^(0|[1-9][0-9]*)$'
         OR pg_catalog.length(v_item->>'precio_fonasa') > 10 THEN
        RAISE EXCEPTION 'PRECIO_FONASA_INVALIDO' USING ERRCODE = '22023';
      END IF;
      IF (v_item->>'precio_fonasa')::numeric > 2147483647 THEN
        RAISE EXCEPTION 'PRECIO_FONASA_INVALIDO' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_precio_particular::numeric > 2147483647 THEN
      RAISE EXCEPTION 'PRECIO_PARTICULAR_INVALIDO' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN QUERY
  INSERT INTO public.prestaciones (
    clinica_id, user_id, nombre, especialidad, precio_particular, precio_fonasa,
    precio, codigo_fonasa, codigo_interno, categoria, equipamiento_requerido
  )
  SELECT
    v_clinica_id,
    v_user_id,
    pg_catalog.btrim(payload.value->>'nombre'),
    pg_catalog.btrim(payload.value->>'especialidad'),
    (payload.value->>'precio_particular')::integer,
    CASE
      WHEN pg_catalog.jsonb_typeof(payload.value->'precio_fonasa') = 'number'
        THEN (payload.value->>'precio_fonasa')::integer
      ELSE NULL
    END,
    (payload.value->>'precio_particular')::integer,
    NULL,
    pg_catalog.upper(pg_catalog.btrim(payload.value->>'codigo_interno')),
    pg_catalog.btrim(payload.value->>'categoria'),
    ARRAY[]::text[]
  FROM pg_catalog.jsonb_array_elements(p_prestaciones) AS payload(value)
  ORDER BY payload.value->>'codigo_interno'
  RETURNING *;
END;
$function$;

REVOKE ALL ON FUNCTION public.importar_plantilla_prestaciones(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_plantilla_prestaciones(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.importar_plantilla_prestaciones(text, jsonb) IS
  'Importa una plantilla BP08 solo para un admin, de forma atómica, en catálogo vacío de su clínica activa.';

-- El reajuste existente también debe conservar NULL como tarifa pendiente.
CREATE OR REPLACE FUNCTION public.reajustar_arancel_clinica(
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
    OR pg_catalog.jsonb_typeof(p_prestaciones_esperadas) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_prestaciones_esperadas) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El arancel esperado está vacío o es inválido';
  END IF;

  LOCK TABLE public.prestaciones IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_prestaciones_esperadas)
      AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
    WHERE e.id IS NULL OR e.precio_particular IS NULL OR e.precio_particular < 0
      OR (e.precio_fonasa IS NOT NULL AND e.precio_fonasa < 0)
  ) OR (
    SELECT pg_catalog.count(*) <> pg_catalog.count(DISTINCT e.id)
    FROM pg_catalog.jsonb_to_recordset(p_prestaciones_esperadas)
      AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El arancel esperado contiene filas inválidas';
  END IF;

  SELECT pg_catalog.count(*) INTO v_cantidad
  FROM public.prestaciones p WHERE p.clinica_id = v_clinica;

  IF v_cantidad <> pg_catalog.jsonb_array_length(p_prestaciones_esperadas)
    OR EXISTS (
      SELECT 1 FROM public.prestaciones p
      WHERE p.clinica_id = v_clinica
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_prestaciones_esperadas)
            AS e(id uuid, precio_particular bigint, precio_fonasa bigint)
          WHERE e.id = p.id
            AND e.precio_particular = p.precio_particular
            AND e.precio_fonasa IS NOT DISTINCT FROM p.precio_fonasa
        )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'El arancel cambió desde que se cargó. Actualízalo antes de reajustar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestaciones p
    WHERE p.clinica_id = v_clinica
      AND (round(p.precio_particular::numeric * (1 + p_porcentaje / 100), 0) > 2147483647
        OR (p.precio_fonasa IS NOT NULL
          AND round(p.precio_fonasa::numeric * (1 + p_porcentaje / 100), 0) > 2147483647))
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
      precio_fonasa = CASE WHEN p.precio_fonasa IS NULL THEN NULL
        ELSE round(p.precio_fonasa::numeric * (1 + p_porcentaje / 100), 0)::integer END,
      precio = round(p.precio_particular::numeric * (1 + p_porcentaje / 100), 0)::integer
  WHERE p.clinica_id = v_clinica
  RETURNING p.id, p.nombre, p.especialidad, p.precio_particular,
    p.precio_fonasa, p.codigo_fonasa, p.precio;
END;
$function$;

REVOKE ALL ON FUNCTION public.reajustar_arancel_clinica(numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reajustar_arancel_clinica(numeric, jsonb) TO authenticated;
