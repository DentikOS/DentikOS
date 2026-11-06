-- BP08 §11: enforce shared clinic limits at the database boundary, including
-- writes that arrive through offline synchronization or plan synchronization.
CREATE OR REPLACE FUNCTION bp07_private.validar_limites_financieros_presupuesto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_validar_descuento boolean;
  v_validar_plan_pago boolean;
  v_modalidad text;
  v_cuotas_text text;
  v_cuotas numeric;
  v_configuracion jsonb;
  v_descuento_maximo numeric;
  v_cuotas_maximas numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_validar_descuento := true;
    v_validar_plan_pago := true;
  ELSE
    v_validar_descuento := NEW.descuento_global_pct IS DISTINCT FROM OLD.descuento_global_pct;
    v_validar_plan_pago := NEW.plan_pago IS DISTINCT FROM OLD.plan_pago;
  END IF;

  IF NOT v_validar_descuento AND NOT v_validar_plan_pago THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL
    OR NEW.clinica_id IS NULL
    OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
    OR public.tiene_rol_en_clinica(
      ARRAY['admin','dentista','asistente','recepcion']::public.app_role[]
    ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No se pueden validar las condiciones financieras de esta clínica';
  END IF;

  IF v_validar_plan_pago AND NEW.plan_pago IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(NEW.plan_pago) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'El plan de pago debe ser un objeto válido';
    END IF;

    v_modalidad := NEW.plan_pago->>'modalidad';
    IF v_modalidad IN ('cuotas', 'cuotas-sin-interes') THEN
      v_cuotas_text := COALESCE(
        NULLIF(pg_catalog.btrim(NEW.plan_pago->>'cuotas'), ''),
        NULLIF(pg_catalog.btrim(NEW.plan_pago->>'numeroCuotas'), '')
      );
      IF v_cuotas_text IS NULL OR v_cuotas_text !~ '^[0-9]+$' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'El plan de cuotas debe indicar una cantidad válida';
      END IF;

      v_cuotas := v_cuotas_text::numeric;
      IF v_cuotas < 1 THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'El plan de cuotas debe incluir al menos una cuota';
      END IF;
    ELSIF v_modalidad NOT IN ('unico', 'pago-unico') OR v_modalidad IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'La modalidad del plan de pago no es válida';
    END IF;
  END IF;

  SELECT c.configuracion_financiera
    INTO v_configuracion
    FROM public.clinicas AS c
    WHERE c.id = NEW.clinica_id;

  IF NOT FOUND OR pg_catalog.jsonb_typeof(v_configuracion) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La clínica no tiene una configuración financiera válida';
  END IF;

  IF v_validar_descuento AND NEW.descuento_global_pct IS NOT NULL THEN
    v_descuento_maximo := NULLIF(v_configuracion->>'descuentoMaximoPermitidoPct', '')::numeric;
    IF v_descuento_maximo IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'La clínica no tiene un máximo de descuento configurado';
    END IF;
    IF NEW.descuento_global_pct > v_descuento_maximo THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'El descuento manual supera el máximo configurado para la clínica';
    END IF;
  END IF;

  IF v_validar_plan_pago AND v_cuotas IS NOT NULL THEN
    v_cuotas_maximas := NULLIF(v_configuracion->>'maximoCuotasSinInteres', '')::numeric;
    IF v_cuotas_maximas IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'La clínica no tiene un máximo de cuotas configurado';
    END IF;
    IF v_cuotas > v_cuotas_maximas THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'El plan de pago supera el máximo de cuotas sin interés configurado';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION bp07_private.validar_limites_financieros_presupuesto() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp07_private.validar_limites_financieros_presupuesto()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trigger_validar_limites_financieros_presupuesto ON public.presupuestos;
CREATE TRIGGER trigger_validar_limites_financieros_presupuesto
  BEFORE INSERT OR UPDATE ON public.presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION bp07_private.validar_limites_financieros_presupuesto();

COMMENT ON FUNCTION bp07_private.validar_limites_financieros_presupuesto() IS
  'BP08 §11: valida descuento manual y cuotas contra configuración financiera compartida, respetando el tenant activo.';
