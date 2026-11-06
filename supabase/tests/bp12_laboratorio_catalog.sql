-- BP12 catalog, versioning, permissions and finance-masked dashboard coverage.
-- All fixtures and mutations roll back at the end.
BEGIN;

CREATE TEMP TABLE bp12_catalog_fixture (
  clinica_a uuid NOT NULL,
  clinica_b uuid NOT NULL,
  admin_id uuid NOT NULL,
  dentista_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  laboratorio_a uuid NOT NULL,
  laboratorio_b uuid NOT NULL,
  tipo_a uuid NOT NULL,
  tipo_b uuid NOT NULL,
  orden_id uuid NOT NULL
) ON COMMIT DROP;

DO $setup$
DECLARE
  v_clinica_a uuid;
  v_clinica_b uuid;
  v_admin uuid;
  v_dentista uuid;
  v_paciente uuid;
  v_laboratorio_a uuid := gen_random_uuid();
  v_laboratorio_b uuid := gen_random_uuid();
  v_tipo_a uuid := gen_random_uuid();
  v_tipo_b uuid := gen_random_uuid();
  v_orden uuid := gen_random_uuid();
BEGIN
  SELECT mc.clinica_id,
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'admin'))[1],
         (array_agg(mc.user_id ORDER BY mc.user_id) FILTER (WHERE mc.rol::text = 'dentista'))[1]
    INTO v_clinica_a, v_admin, v_dentista
  FROM public.miembros_clinica mc
  WHERE mc.activo
  GROUP BY mc.clinica_id
  HAVING count(*) FILTER (WHERE mc.rol::text = 'admin') > 0
     AND count(*) FILTER (WHERE mc.rol::text = 'dentista') > 0
  ORDER BY mc.clinica_id LIMIT 1;
  IF v_clinica_a IS NULL THEN
    RAISE EXCEPTION 'BP12 catalog test requires active admin and dentist memberships';
  END IF;

  INSERT INTO public.clinicas (nombre)
  VALUES ('BP12 catalog rollback ' || gen_random_uuid()::text)
  RETURNING id INTO v_clinica_b;
  INSERT INTO public.miembros_clinica (clinica_id, user_id, rol, activo)
  VALUES (v_clinica_b, v_admin, 'admin'::public.app_role, true);

  INSERT INTO public.pacientes (clinica_id, user_id, nombre, rut)
  VALUES (v_clinica_a, v_admin, 'BP12 catalog rollback patient', 'BP12-' || replace(gen_random_uuid()::text, '-', ''))
  RETURNING id INTO v_paciente;
  INSERT INTO public.laboratorios (id, clinica_id, nombre, tipo, created_by)
  VALUES
    (v_laboratorio_a, v_clinica_a, 'BP12 catalog lab A', 'externo', v_admin),
    (v_laboratorio_b, v_clinica_b, 'BP12 catalog lab B', 'externo', v_admin);
  INSERT INTO public.laboratorio_tipos_trabajo (id, clinica_id, categoria, nombre, created_by)
  VALUES
    (v_tipo_a, v_clinica_a, 'protesis_fija', 'BP12 catalog type A', v_admin),
    (v_tipo_b, v_clinica_b, 'protesis_fija', 'BP12 catalog type B', v_admin);
  INSERT INTO pg_temp.bp12_catalog_fixture
  VALUES (v_clinica_a, v_clinica_b, v_admin, v_dentista, v_paciente,
          v_laboratorio_a, v_laboratorio_b, v_tipo_a, v_tipo_b, v_orden);
END;
$setup$;

GRANT SELECT ON pg_temp.bp12_catalog_fixture TO authenticated;

SELECT set_config('request.jwt.claim.sub', admin_id::text, true) FROM pg_temp.bp12_catalog_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_catalog_fixture;
SET LOCAL ROLE authenticated;
DO $admin$
DECLARE
  v_fixture record;
  v_template_v1 uuid;
  v_template_v2 uuid;
  v_version integer;
  v_dashboard jsonb;
  v_fallo boolean := false;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_catalog_fixture;
  IF public.clinica_actual() IS DISTINCT FROM v_fixture.clinica_a THEN
    RAISE EXCEPTION 'Admin did not resolve to Clinic A';
  END IF;

  PERFORM public.asegurar_plantillas_laboratorio_bp12();
  IF (SELECT count(DISTINCT nombre) FROM public.plantillas_laboratorio
      WHERE clinica_id = v_fixture.clinica_a) < 8 THEN
    RAISE EXCEPTION 'The eight BP12 base templates were not available';
  END IF;

  v_template_v1 := public.guardar_plantilla_laboratorio_bp12(
    NULL, 'BP12 rollback template', 'protesis_fija', 'Primera versión de prueba', 5,
    ARRAY['solicitud','entrega']::text[], ARRAY['inicial']::text[], '{}'::jsonb, 'activo'
  );
  v_template_v2 := public.guardar_plantilla_laboratorio_bp12(
    v_template_v1, 'BP12 rollback template', 'protesis_fija', 'Segunda versión de prueba', 6,
    ARRAY['solicitud','fabricacion','entrega']::text[], ARRAY['inicial','final']::text[],
    '{"control":{"tipo":"boolean"}}'::jsonb, 'activo'
  );
  SELECT version INTO v_version FROM public.plantillas_laboratorio
  WHERE id = v_template_v2 AND clinica_id = v_fixture.clinica_a AND estado = 'activo';
  IF v_version <> 2 OR (SELECT estado FROM public.plantillas_laboratorio WHERE id = v_template_v1) <> 'inactivo' THEN
    RAISE EXCEPTION 'Saving a template did not preserve and advance its version';
  END IF;

  PERFORM public.registrar_precio_laboratorio_bp12(v_fixture.laboratorio_a, v_fixture.tipo_a, 82000, 5, '30 días');
  PERFORM public.registrar_precio_laboratorio_bp12(v_fixture.laboratorio_a, v_fixture.tipo_a, 90000, 6, '15 días');
  IF (SELECT count(*) FROM public.laboratorio_precios
      WHERE clinica_id = v_fixture.clinica_a AND laboratorio_id = v_fixture.laboratorio_a
        AND tipo_trabajo_id = v_fixture.tipo_a) <> 2
     OR (SELECT count(*) FROM public.laboratorio_precios
      WHERE clinica_id = v_fixture.clinica_a AND laboratorio_id = v_fixture.laboratorio_a
        AND tipo_trabajo_id = v_fixture.tipo_a AND vigente_hasta IS NULL) <> 1 THEN
    RAISE EXCEPTION 'Price updates did not retain exactly one current version';
  END IF;

  INSERT INTO public.ordenes_laboratorio (id, clinica_id, paciente_id, laboratorio_id, tipo_trabajo_id)
  VALUES (v_fixture.orden_id, v_fixture.clinica_a, v_fixture.paciente_id, v_fixture.laboratorio_a, v_fixture.tipo_a);
  PERFORM public.guardar_costo_orden_laboratorio(v_fixture.orden_id, 90000, 140000);

  v_dashboard := public.resumen_laboratorio_core_bp12();
  IF jsonb_typeof(v_dashboard->'costos_mes') <> 'array'
     OR jsonb_typeof(v_dashboard->'costos_anio') <> 'array' THEN
    RAISE EXCEPTION 'Admin dashboard did not return clinic financial summaries';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_fixture.admin_id, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_fixture.clinica_b)
  )::text, true);
  v_fallo := false;
  BEGIN
    PERFORM public.registrar_precio_laboratorio_bp12(v_fixture.laboratorio_a, v_fixture.tipo_b, 100, 1, NULL);
  EXCEPTION WHEN OTHERS THEN v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'Clinic B accepted a Clinic A laboratory price reference'; END IF;
END;
$admin$;
RESET ROLE;

-- A dentist without an additive permission gets operational metrics only and
-- cannot inspect the administrative member-permissions list.
SELECT set_config('request.jwt.claim.sub', dentista_id::text, true) FROM pg_temp.bp12_catalog_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_catalog_fixture;
SET LOCAL ROLE authenticated;
DO $dentist_hidden$
DECLARE
  v_dashboard jsonb;
  v_fallo boolean := false;
BEGIN
  v_dashboard := public.resumen_laboratorio_core_bp12();
  IF v_dashboard->'costos_mes' IS DISTINCT FROM 'null'::jsonb
     OR v_dashboard->'costos_anio' IS DISTINCT FROM 'null'::jsonb
     OR v_dashboard->'pagos_pendientes_30_dias'->'monto' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'A dentist without permission received financial dashboard values';
  END IF;
  BEGIN
    PERFORM public.listar_permisos_laboratorio_bp12();
  EXCEPTION WHEN OTHERS THEN v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'A dentist read the administrative permissions list'; END IF;
END;
$dentist_hidden$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', admin_id::text, true) FROM pg_temp.bp12_catalog_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', admin_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_catalog_fixture;
SET LOCAL ROLE authenticated;
DO $grant$
DECLARE
  v_fixture record;
  v_members jsonb;
BEGIN
  SELECT * INTO v_fixture FROM pg_temp.bp12_catalog_fixture;
  PERFORM public.reemplazar_permisos_laboratorio_bp12(
    v_fixture.dentista_id, ARRAY['ver_costos_laboratorio']::text[]
  );
  v_members := public.listar_permisos_laboratorio_bp12();
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(v_members) AS item(value)
    WHERE item.value->>'user_id' = v_fixture.dentista_id::text
      AND item.value->'permisos' @> '["ver_costos_laboratorio"]'::jsonb
  ) THEN RAISE EXCEPTION 'Admin permissions list omitted the clinic-specific assignment'; END IF;
END;
$grant$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', dentista_id::text, true) FROM pg_temp.bp12_catalog_fixture;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', dentista_id, 'role', 'authenticated',
  'user_metadata', jsonb_build_object('clinica_id', clinica_a)
)::text, true) FROM pg_temp.bp12_catalog_fixture;
SET LOCAL ROLE authenticated;
DO $dentist_allowed$
DECLARE
  v_dashboard jsonb;
BEGIN
  v_dashboard := public.resumen_laboratorio_core_bp12();
  IF jsonb_typeof(v_dashboard->'costos_mes') <> 'array'
     OR jsonb_typeof(v_dashboard->'costos_anio') <> 'array' THEN
    RAISE EXCEPTION 'A dentist with the additive permission did not receive financial dashboard values';
  END IF;
END;
$dentist_allowed$;
RESET ROLE;

ROLLBACK;
