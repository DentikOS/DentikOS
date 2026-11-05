-- Transactional integration test for the BP08 catalogue import.
-- Run as a database owner. It requires an active admin whose clinic catalog is empty.
-- Test rows and audit events are rolled back.
BEGIN;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  (
    SELECT mc.user_id::text
    FROM public.miembros_clinica AS mc
    WHERE mc.activo
      AND mc.rol::text = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.prestaciones AS p WHERE p.clinica_id = mc.clinica_id
      )
    ORDER BY mc.clinica_id, mc.user_id
    LIMIT 1
  ),
  true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('request.jwt.claim.sub', true),
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_actor uuid := auth.uid();
  v_clinica uuid := public.clinica_actual();
  v_payload jsonb;
  v_invalido jsonb;
  v_snapshot jsonb;
  v_importadas bigint;
  v_antes bigint;
  v_despues bigint;
  v_auditoria bigint;
  v_auditoria_despues bigint;
BEGIN
  IF v_actor IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'El test requiere un admin activo en una clínica con catálogo vacío';
  END IF;

  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'codigo_interno', 'PRE-' || pg_catalog.lpad(n::text, 2, '0'),
    'categoria', 'Preventivo',
    'nombre', 'Prestación de prueba ' || n,
    'especialidad', 'Diagnóstico y Prevención',
    'precio_particular', 1000 + n,
    'precio_fonasa', NULL
  ) ORDER BY n)
  INTO v_payload
  FROM pg_catalog.generate_series(1, 20) AS n;

  -- An unauthenticated caller must fail before any write.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN
    PERFORM * FROM public.importar_plantilla_prestaciones('general', v_payload);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'La RPC aceptó un usuario sin sesión';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);

  -- Invalid template size is rejected with zero rows and audit events.
  v_invalido := v_payload - 0;
  SELECT pg_catalog.count(*) INTO v_antes FROM public.prestaciones WHERE clinica_id = v_clinica;
  BEGIN
    PERFORM * FROM public.importar_plantilla_prestaciones('general', v_invalido);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'La RPC aceptó una plantilla incompleta';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  SELECT pg_catalog.count(*) INTO v_despues FROM public.prestaciones WHERE clinica_id = v_clinica;
  IF v_despues <> v_antes THEN
    RAISE EXCEPTION 'La plantilla inválida dejó filas en el catálogo';
  END IF;

  SELECT pg_catalog.count(*) INTO v_auditoria FROM public.audit_log WHERE clinica_id = v_clinica;
  SELECT pg_catalog.count(*) INTO v_importadas
  FROM public.importar_plantilla_prestaciones('general', v_payload);
  IF v_importadas <> 20 THEN
    RAISE EXCEPTION 'La RPC no devolvió las 20 prestaciones importadas';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.prestaciones WHERE clinica_id = v_clinica) <> 20
     OR EXISTS (
       SELECT 1 FROM public.prestaciones
       WHERE clinica_id = v_clinica
         AND (codigo_interno IS NULL OR categoria <> 'Preventivo'
           OR precio_fonasa IS NOT NULL OR codigo_fonasa IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'La carga no conservó códigos, categorías o tarifas pendientes';
  END IF;

  SELECT pg_catalog.count(*) INTO v_auditoria_despues
  FROM public.audit_log WHERE clinica_id = v_clinica;
  IF v_auditoria_despues < v_auditoria + 20 THEN
    RAISE EXCEPTION 'No se registró auditoría para cada prestación importada';
  END IF;

  -- The existing atomic bulk price RPC must preserve the NULL tariff.
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', p.id,
    'precio_particular', p.precio_particular,
    'precio_fonasa', p.precio_fonasa
  ) ORDER BY p.id)
  INTO v_snapshot
  FROM public.prestaciones AS p WHERE p.clinica_id = v_clinica;
  PERFORM pg_catalog.count(*) FROM public.reajustar_arancel_clinica(10, v_snapshot);
  IF EXISTS (
    SELECT 1 FROM public.prestaciones
    WHERE clinica_id = v_clinica AND (precio_fonasa IS NOT NULL OR precio_particular <= 1001)
  ) THEN
    RAISE EXCEPTION 'El reajuste convirtió una tarifa pendiente o no aplicó el precio particular';
  END IF;

  -- A second import is rejected because the tenant catalog is no longer empty.
  SELECT pg_catalog.count(*) INTO v_antes FROM public.prestaciones WHERE clinica_id = v_clinica;
  SELECT pg_catalog.count(*) INTO v_auditoria FROM public.audit_log WHERE clinica_id = v_clinica;
  BEGIN
    PERFORM * FROM public.importar_plantilla_prestaciones('general', v_payload);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'La RPC permitió reimportar sobre un catálogo existente';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CATALOGO_NO_VACIO' THEN RAISE; END IF;
  END;
  SELECT pg_catalog.count(*) INTO v_despues FROM public.prestaciones WHERE clinica_id = v_clinica;
  SELECT pg_catalog.count(*) INTO v_auditoria_despues FROM public.audit_log WHERE clinica_id = v_clinica;
  IF v_despues <> v_antes OR v_auditoria_despues <> v_auditoria THEN
    RAISE EXCEPTION 'El rechazo de reimportación produjo efectos secundarios';
  END IF;
END;
$test$;

ROLLBACK;
