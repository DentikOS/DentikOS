-- BP08 §11: configuración financiera de la clínica compartida por sus miembros.
-- El DEFAULT inicializa clínicas existentes sin cambiar presupuestos guardados.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS configuracion_financiera JSONB NOT NULL DEFAULT '{
    "version": 1,
    "validezPresupuestoDias": 15,
    "maximoCuotasSinInteres": 6,
    "frecuenciaCuotas": "mensual",
    "descuentoMaximoPermitidoPct": 50,
    "requiereMotivoDescuento": true,
    "firmaObligatoriaPresupuesto": false,
    "abonoMinimoParaAprobarPct": 0,
    "mediosPagoAceptados": ["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia", "cheque"],
    "recordatorios": {
      "activados": true,
      "presupuestoSinRespuesta": true,
      "presupuestoPorVencer": true,
      "presupuestoVencido": true,
      "cuotasPendientes": true
    }
  }'::jsonb;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinicas'::regclass
      AND conname = 'clinicas_configuracion_financiera_valida'
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_configuracion_financiera_valida
      CHECK (
        coalesce(jsonb_typeof(configuracion_financiera) = 'object', false)
        AND coalesce(configuracion_financiera->>'version' = '1', false)
        AND coalesce(configuracion_financiera->>'frecuenciaCuotas' IN ('mensual', 'quincenal'), false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'validezPresupuestoDias') = 'number', false)
        AND coalesce((configuracion_financiera->>'validezPresupuestoDias')::numeric BETWEEN 1 AND 90, false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'maximoCuotasSinInteres') = 'number', false)
        AND coalesce((configuracion_financiera->>'maximoCuotasSinInteres')::numeric BETWEEN 1 AND 12, false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'descuentoMaximoPermitidoPct') = 'number', false)
        AND coalesce((configuracion_financiera->>'descuentoMaximoPermitidoPct')::numeric BETWEEN 0 AND 100, false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'abonoMinimoParaAprobarPct') = 'number', false)
        AND coalesce((configuracion_financiera->>'abonoMinimoParaAprobarPct')::numeric BETWEEN 0 AND 100, false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'requiereMotivoDescuento') = 'boolean', false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'firmaObligatoriaPresupuesto') = 'boolean', false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'mediosPagoAceptados') = 'array', false)
        AND coalesce(jsonb_typeof(configuracion_financiera->'recordatorios') = 'object', false)
      );
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.clinicas.configuracion_financiera IS
  'BP08 §11: condiciones financieras compartidas. Los cambios aplican a presupuestos nuevos; no reescriben presupuestos existentes.';

-- La función genérica de clínicas no aplica: el tenant de esta tabla es NEW.id.
CREATE OR REPLACE FUNCTION bp07_private.auditar_configuracion_financiera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.configuracion_financiera IS NOT DISTINCT FROM NEW.configuracion_financiera THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (
    user_id,
    clinica_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    created_at
  ) VALUES (
    auth.uid(),
    NEW.id,
    'clinicas',
    NEW.id::text,
    'UPDATE',
    jsonb_build_object('configuracion_financiera', OLD.configuracion_financiera),
    jsonb_build_object('configuracion_financiera', NEW.configuracion_financiera),
    now()
  );

  RETURN NEW;
END;
$function$;

ALTER FUNCTION bp07_private.auditar_configuracion_financiera() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp07_private.auditar_configuracion_financiera() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_clinicas_configuracion_financiera_audit ON public.clinicas;
CREATE TRIGGER trg_clinicas_configuracion_financiera_audit
  AFTER UPDATE OF configuracion_financiera ON public.clinicas
  FOR EACH ROW
  WHEN (OLD.configuracion_financiera IS DISTINCT FROM NEW.configuracion_financiera)
  EXECUTE FUNCTION bp07_private.auditar_configuracion_financiera();
