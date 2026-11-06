-- BP06: la derivación es un acto clínico emitido por un profesional autorizado.
CREATE OR REPLACE FUNCTION public.validar_emision_derivacion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_archivo text;
BEGIN
  IF NEW.tipo IS DISTINCT FROM 'derivacion' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.actor_user_id IS DISTINCT FROM auth.uid()
    OR NEW.clinica_id IS DISTINCT FROM public.clinica_actual()
    OR public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede emitir la derivación clínica';
  END IF;
  IF NEW.metadata IS NULL OR jsonb_typeof(NEW.metadata) IS DISTINCT FROM 'object'
    OR jsonb_typeof(COALESCE(NEW.metadata->'archivoIds', '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Referencias clínicas de derivación inválidas';
  END IF;
  IF jsonb_array_length(COALESCE(NEW.metadata->'archivoIds', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'Referencias clínicas de derivación inválidas';
  END IF;
  FOR v_archivo IN SELECT jsonb_array_elements_text(COALESCE(NEW.metadata->'archivoIds', '[]'::jsonb)) LOOP
    IF v_archivo !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.archivos_clinicos a
        WHERE a.id = v_archivo::uuid AND a.clinica_id = NEW.clinica_id
          AND a.paciente_id = NEW.paciente_id AND a.estado = 'activo') THEN
      RAISE EXCEPTION 'Archivo clínico no disponible para esta derivación';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validar_emision_derivacion
  BEFORE INSERT ON public.timeline_paciente FOR EACH ROW
  WHEN (NEW.tipo = 'derivacion')
  EXECUTE FUNCTION public.validar_emision_derivacion();
