-- BP08: sucursal principal explícita y asignación segura de citas históricas.
-- No reemplaza la sucursal de citas que ya tenga una asignación.

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS principal_sucursal_id UUID;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinicas_principal_sucursal_tenant_fk'
      AND conrelid = 'public.clinicas'::regclass
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_principal_sucursal_tenant_fk
      FOREIGN KEY (principal_sucursal_id, id)
      REFERENCES public.sucursales (id, clinica_id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.clinicas.principal_sucursal_id IS
  'Sucursal principal de la clínica. La FK compuesta impide apuntar a otra clínica.';

CREATE OR REPLACE FUNCTION public.validar_no_desactivar_sucursal_principal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.estado <> 'activa'
    AND OLD.estado IS DISTINCT FROM NEW.estado
    AND EXISTS (
      SELECT 1
      FROM public.clinicas AS clinica
      WHERE clinica.id = OLD.clinica_id
        AND clinica.principal_sucursal_id = OLD.id
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Designa otra sucursal principal antes de cambiar el estado de esta sucursal.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sucursales_principal_no_desactivar ON public.sucursales;
CREATE TRIGGER trg_sucursales_principal_no_desactivar
  BEFORE UPDATE OF estado ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION public.validar_no_desactivar_sucursal_principal();

REVOKE ALL ON FUNCTION public.validar_no_desactivar_sucursal_principal()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_no_desactivar_sucursal_principal()
  TO authenticated, service_role;

-- Conserva primero la sede histórica activa cuyo UUID coincide con el de la clínica.
-- Si no existe o está inactiva, adopta la sucursal activa más antigua; clínicas
-- sin sucursales activas conservan el puntero NULL hasta que administración la configure.
WITH candidatas AS (
  SELECT
    c.id AS clinica_id,
    COALESCE(
      (
        SELECT s.id
        FROM public.sucursales AS s
        WHERE s.clinica_id = c.id
          AND s.id = c.id
          AND s.estado = 'activa'
        LIMIT 1
      ),
      (
        SELECT s.id
        FROM public.sucursales AS s
        WHERE s.clinica_id = c.id
          AND s.estado = 'activa'
        ORDER BY s.created_at ASC, s.id ASC
        LIMIT 1
      )
    ) AS sucursal_id
  FROM public.clinicas AS c
  WHERE c.principal_sucursal_id IS NULL
)
UPDATE public.clinicas AS c
SET principal_sucursal_id = candidatas.sucursal_id
FROM candidatas
WHERE c.id = candidatas.clinica_id
  AND candidatas.sucursal_id IS NOT NULL;

-- La restricción y el trigger de auditoría existentes conservan el tenant y
-- registran cada cita migrada. No se modifican box_id ni notas.
UPDATE public.citas AS cita
SET sede_id = clinica.principal_sucursal_id
FROM public.clinicas AS clinica
WHERE cita.clinica_id = clinica.id
  AND cita.sede_id IS NULL
  AND clinica.principal_sucursal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.designar_sucursal_principal(p_sucursal_id UUID)
RETURNS TABLE (principal_sucursal_id UUID, citas_reasignadas INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_clinica_id UUID;
  v_citas_reasignadas INTEGER := 0;
  v_filas_clinica INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;

  v_clinica_id := public.clinica_actual();
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pudo validar la clínica activa.';
  END IF;

  IF public.tiene_rol_en_clinica(ARRAY['admin']::public.app_role[]) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo administración clínica puede designar la sucursal principal.';
  END IF;

  IF p_sucursal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La sucursal debe estar activa y pertenecer a la clínica actual.';
  END IF;

  -- El lock serializa esta decisión frente a una desactivación concurrente.
  PERFORM 1
  FROM public.sucursales AS sucursal
  WHERE sucursal.id = p_sucursal_id
    AND sucursal.clinica_id = v_clinica_id
    AND sucursal.estado = 'activa'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La sucursal debe estar activa y pertenecer a la clínica actual.';
  END IF;

  UPDATE public.clinicas AS clinica
  SET principal_sucursal_id = p_sucursal_id
  WHERE clinica.id = v_clinica_id
    AND clinica.principal_sucursal_id IS DISTINCT FROM p_sucursal_id;
  GET DIAGNOSTICS v_filas_clinica = ROW_COUNT;
  IF v_filas_clinica = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.clinicas AS clinica
    WHERE clinica.id = v_clinica_id
      AND clinica.principal_sucursal_id = p_sucursal_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No se pudo actualizar la clínica activa.';
  END IF;

  UPDATE public.citas AS cita
  SET sede_id = p_sucursal_id
  WHERE cita.clinica_id = v_clinica_id
    AND cita.sede_id IS NULL;
  GET DIAGNOSTICS v_citas_reasignadas = ROW_COUNT;

  RETURN QUERY SELECT p_sucursal_id, v_citas_reasignadas;
END;
$function$;

REVOKE ALL ON FUNCTION public.designar_sucursal_principal(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.designar_sucursal_principal(UUID) TO authenticated;

COMMENT ON FUNCTION public.designar_sucursal_principal(UUID) IS
  'Designa una sucursal activa de la clínica actual y asigna únicamente citas aún sin sucursal, dentro de la misma transacción.';
