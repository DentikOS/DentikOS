-- BP08 §10: auditoría acotada de cambios a la configuración compartida.
-- La función genérica public.auditar_cambio() lee NEW.clinica_id, campo que
-- no existe en public.clinicas (el tenant es public.clinicas.id).

CREATE OR REPLACE FUNCTION bp07_private.auditar_configuracion_convenios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.configuracion_convenios IS NOT DISTINCT FROM NEW.configuracion_convenios THEN
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
    jsonb_build_object('configuracion_convenios', OLD.configuracion_convenios),
    jsonb_build_object('configuracion_convenios', NEW.configuracion_convenios),
    now()
  );

  RETURN NEW;
END;
$function$;

ALTER FUNCTION bp07_private.auditar_configuracion_convenios() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp07_private.auditar_configuracion_convenios() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_clinicas_configuracion_convenios_audit ON public.clinicas;
CREATE TRIGGER trg_clinicas_configuracion_convenios_audit
  AFTER UPDATE OF configuracion_convenios ON public.clinicas
  FOR EACH ROW
  WHEN (OLD.configuracion_convenios IS DISTINCT FROM NEW.configuracion_convenios)
  EXECUTE FUNCTION bp07_private.auditar_configuracion_convenios();
