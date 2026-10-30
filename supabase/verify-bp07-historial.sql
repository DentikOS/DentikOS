-- Prueba de historial append-only; todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_presupuesto uuid := gen_random_uuid();
  v_historial uuid;
  v_fila public.presupuesto_versiones%ROWTYPE;
  v_hash text;
  v_bloqueado boolean;
BEGIN
  SELECT mc.user_id, mc.clinica_id, p.id INTO v_admin, v_clinica, v_paciente
    FROM public.miembros_clinica mc JOIN public.pacientes p ON p.clinica_id=mc.clinica_id
    WHERE mc.rol::text='admin' AND mc.activo LIMIT 1;
  IF v_admin IS NULL OR v_clinica IS NULL OR v_paciente IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated',
    'user_metadata',jsonb_build_object('clinica_id',v_clinica))::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.presupuestos(id,user_id,clinica_id,paciente_id,folio,paciente_nombre,
    monto_total,monto_abonado,estado,detalle_items,total_bruto,total_descuentos,version)
  VALUES(v_presupuesto,v_admin,v_clinica,v_paciente,'BP07-HIST-ROLLBACK','Prueba',
    10000,0,'borrador','[]'::jsonb,10000,0,1);
  IF (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> 1 THEN
    RAISE EXCEPTION 'Creación sin snapshot';
  END IF;
  UPDATE public.presupuestos SET observacion='Nota administrativa' WHERE id=v_presupuesto;
  IF (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> 1 THEN
    RAISE EXCEPTION 'Una nota administrativa creó una versión financiera falsa';
  END IF;
  PERFORM set_config('app.bp07_motivo','Corrección de importe revisada',true);
  UPDATE public.presupuestos SET monto_total=12000,total_bruto=12000 WHERE id=v_presupuesto;
  SELECT * INTO v_fila FROM public.presupuesto_versiones
    WHERE presupuesto_id=v_presupuesto AND revision=2;
  IF NOT FOUND OR v_fila.actor_user_id IS DISTINCT FROM v_admin
    OR v_fila.clinica_id IS DISTINCT FROM v_clinica
    OR v_fila.paciente_id IS DISTINCT FROM v_paciente
    OR v_fila.motivo <> 'Corrección de importe revisada'
    OR v_fila.motivo_origen <> 'usuario'
    OR (v_fila.anterior->>'monto_total')::integer <> 10000
    OR (v_fila.nuevo->>'monto_total')::integer <> 12000 THEN
    RAISE EXCEPTION 'Versión financiera incompleta o actor/tenant incorrecto';
  END IF;
  v_historial := v_fila.id;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'presupuesto_id',v_fila.presupuesto_id,'clinica_id',v_fila.clinica_id,
    'paciente_id',v_fila.paciente_id,'revision',v_fila.revision,'fecha',v_fila.fecha,
    'actor_user_id',v_fila.actor_user_id,'tipo',v_fila.tipo,'motivo',v_fila.motivo,
    'anterior',v_fila.anterior,'nuevo',v_fila.nuevo)::text,'UTF8'),'sha256'),'hex');
  IF v_hash IS DISTINCT FROM v_fila.hash_sha256 THEN RAISE EXCEPTION 'Hash inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name='presupuestos'
    AND record_id=v_presupuesto::text AND clinica_id=v_clinica AND action='UPDATE') THEN
    RAISE EXCEPTION 'Falta auditoría del cambio financiero';
  END IF;
  UPDATE public.presupuestos SET estado='aprobado' WHERE id=v_presupuesto;
  PERFORM public.registrar_abono_presupuesto(gen_random_uuid(),v_presupuesto,1000,'efectivo',NULL);
  IF (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> 2 THEN
    RAISE EXCEPTION 'El abono creó una versión financiera falsa';
  END IF;
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.presupuestos(user_id,clinica_id,paciente_id,folio,paciente_nombre,
      monto_total,monto_abonado,estado,detalle_items,total_bruto,total_descuentos,version)
    VALUES(v_admin,gen_random_uuid(),v_paciente,'BP07-HIST-TENANT-INVALIDO','Prueba',
      10000,0,'borrador','[]'::jsonb,10000,0,1);
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Presupuesto de otra clínica aceptado'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuestos WHERE folio='BP07-HIST-TENANT-INVALIDO') THEN
    RAISE EXCEPTION 'Intento entre clínicas dejó efectos';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE public.presupuesto_versiones SET motivo='Alterado' WHERE id=v_historial;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Historial modificable'; END IF;
  v_bloqueado := false;
  BEGIN
    DELETE FROM public.presupuesto_versiones WHERE id=v_historial;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Historial eliminable'; END IF;
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.presupuesto_versiones(presupuesto_id,clinica_id,paciente_id,revision,
      fecha,actor_user_id,tipo,motivo,motivo_origen,nuevo,hash_sha256)
    VALUES(v_presupuesto,v_clinica,v_paciente,3,now(),v_admin,'cambio_financiero','Falso',
      'usuario','{}'::jsonb,repeat('a',64));
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Escritura directa del historial aceptada'; END IF;
  IF EXISTS (SELECT 1 FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto AND revision=3) THEN
    RAISE EXCEPTION 'Escritura rechazada dejó efectos';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='bp07_private' AND p.proname='registrar_version_presupuesto'
      AND (p.prosecdef IS DISTINCT FROM true
        OR has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR has_schema_privilege('authenticated',n.oid,'USAGE'))) THEN
    RAISE EXCEPTION 'Trigger privado expuesto';
  END IF;
  RAISE NOTICE 'BP07 historial verificado: creación, cambio, hash, actor, auditoría e inmutabilidad';
END;
$verify$;
ROLLBACK;
