-- BP08 CORE: registrar cambios de configuración de clínica con su ID de tenant.
-- La función genérica public.auditar_cambio() espera NEW.clinica_id; clinicas usa NEW.id.
BEGIN;

CREATE OR REPLACE FUNCTION bp07_private.auditar_datos_clinica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_clinica_id UUID;
BEGIN
  v_clinica_id := (to_jsonb(NEW)->>'id')::UUID;
  v_new_data := to_jsonb(NEW) - ARRAY[
    'id', 'created_at', 'updated_at',
    'configuracion_convenios', 'configuracion_financiera'
  ]::TEXT[];

  IF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD) - ARRAY[
      'id', 'created_at', 'updated_at',
      'configuracion_convenios', 'configuracion_financiera'
    ]::TEXT[];
    IF v_old_data IS NOT DISTINCT FROM v_new_data THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    user_id, clinica_id, table_name, record_id, action,
    old_data, new_data, created_at
  ) VALUES (
    auth.uid(), v_clinica_id, TG_TABLE_NAME, v_clinica_id::TEXT, TG_OP,
    v_old_data, v_new_data, now()
  );

  RETURN NEW;
END;
$function$;

ALTER FUNCTION bp07_private.auditar_datos_clinica() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp07_private.auditar_datos_clinica() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_clinicas_config_audit ON public.clinicas;
CREATE TRIGGER trg_clinicas_config_audit
  AFTER INSERT OR UPDATE ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION bp07_private.auditar_datos_clinica();

COMMIT;
