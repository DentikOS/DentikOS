-- Ejecutar en una transacción: no deja eventos ni auditorías de prueba.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_evento uuid := gen_random_uuid();
  v_bloqueado boolean;
BEGIN
  SELECT mc.user_id, mc.clinica_id, p.id INTO v_admin, v_clinica, v_paciente
    FROM public.miembros_clinica mc JOIN public.pacientes p ON p.clinica_id = mc.clinica_id
    WHERE mc.rol::text = 'admin' AND mc.activo LIMIT 1;
  SELECT mc.user_id INTO v_recepcion FROM public.miembros_clinica mc
    WHERE mc.clinica_id = v_clinica AND mc.rol::text = 'recepcion' AND mc.activo LIMIT 1;
  IF v_admin IS NULL OR v_recepcion IS NULL OR v_paciente IS NULL THEN
    RAISE EXCEPTION 'Faltan usuarios de prueba';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.timeline_paciente(id, clinica_id, actor_user_id, paciente_id, tipo, titulo,
    metadata) VALUES (v_evento, v_clinica, v_admin, v_paciente, 'derivacion', 'BP06-ROLLBACK-TEST',
    jsonb_build_object('especialidad','Endodoncia','motivo','Revisión clínica','prioridad','normal',
      'archivoIds','[]'::jsonb,'incluirOdontograma',true));
  IF NOT EXISTS (SELECT 1 FROM public.timeline_paciente WHERE id=v_evento
    AND actor_user_id=v_admin AND clinica_id=v_clinica AND paciente_id=v_paciente) THEN
    RAISE EXCEPTION 'Derivación autorizada no persistida con actor y clínica';
  END IF;
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.timeline_paciente(clinica_id, actor_user_id, paciente_id, tipo, titulo, metadata)
    VALUES (v_clinica,v_admin,v_paciente,'derivacion','BP06-ARCHIVO-INVALIDO',
      jsonb_build_object('archivoIds',jsonb_build_array(gen_random_uuid())));
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Archivo ajeno o inexistente aceptado'; END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente WHERE titulo='BP06-ARCHIVO-INVALIDO') THEN
    RAISE EXCEPTION 'Archivo rechazado dejó un evento';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_recepcion, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica))::text, true);
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.timeline_paciente(clinica_id, actor_user_id, paciente_id, tipo, titulo, metadata)
    VALUES (v_clinica,v_recepcion,v_paciente,'derivacion','BP06-RECEPCION-INVALIDA',
      jsonb_build_object('archivoIds','[]'::jsonb));
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Recepción emitió una derivación'; END IF;
  IF EXISTS (SELECT 1 FROM public.timeline_paciente WHERE titulo='BP06-RECEPCION-INVALIDA') THEN
    RAISE EXCEPTION 'Emisión rechazada dejó un evento';
  END IF;
  RAISE NOTICE 'BP06: emisor autorizado, archivo inválido y recepción rechazados sin efectos';
END;
$verify$;
ROLLBACK;
