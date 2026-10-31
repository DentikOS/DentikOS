-- Verificación transaccional en el proyecto principal: todas las filas vuelven atrás.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_otro_paciente_misma uuid;
  v_otro_paciente uuid;
  v_presupuesto uuid := gen_random_uuid();
  v_grupo uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_ficha uuid;
  v_prestacion uuid := gen_random_uuid();
  v_revision text;
  v_version integer;
  v_bloqueado boolean;
  v_historial integer;
BEGIN
  SELECT mc.user_id, mc.clinica_id, p.id INTO v_admin, v_clinica, v_paciente
    FROM public.miembros_clinica mc JOIN public.pacientes p ON p.clinica_id = mc.clinica_id
    WHERE mc.rol::text = 'admin' AND mc.activo LIMIT 1;
  SELECT mc.user_id INTO v_recepcion FROM public.miembros_clinica mc
    WHERE mc.clinica_id = v_clinica AND mc.rol::text = 'recepcion' AND mc.activo LIMIT 1;
  SELECT p.id INTO v_otro_paciente FROM public.pacientes p
    WHERE p.clinica_id <> v_clinica LIMIT 1;
  SELECT p.id INTO v_otro_paciente_misma FROM public.pacientes p
    WHERE p.clinica_id = v_clinica AND p.id <> v_paciente LIMIT 1;
  IF v_admin IS NULL OR v_recepcion IS NULL OR v_paciente IS NULL THEN
    RAISE EXCEPTION 'Faltan usuarios de prueba';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated',
    'user_metadata',jsonb_build_object('clinica_id',v_clinica))::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.fichas_clinicas(clinica_id,paciente_id,plan_tratamiento)
    VALUES(v_clinica,v_paciente,jsonb_build_object('actualizadoAt','revision-precio-1','fases',
      jsonb_build_array(jsonb_build_object('id','fase-urgencias','procedimientos',
        jsonb_build_array(jsonb_build_object('id','proc-precio-1','descripcion','Control',
          'prestacionId',v_prestacion,'costo',10000,'requiereRevision',false,'estado','pendiente'))))))
    ON CONFLICT (clinica_id,paciente_id) DO UPDATE SET plan_tratamiento=excluded.plan_tratamiento;
  SELECT f.id INTO v_ficha FROM public.fichas_clinicas f
    WHERE f.clinica_id=v_clinica AND f.paciente_id=v_paciente;
  INSERT INTO public.presupuestos(id,user_id,clinica_id,paciente_id,folio,paciente_nombre,
    monto_total,monto_abonado,estado,detalle_items,total_bruto,total_descuentos,version,
    origen_plan,plan_revision,version_grupo_id,requiere_revision)
    VALUES(v_presupuesto,v_admin,v_clinica,v_paciente,'BP07-PRECIO-ROLLBACK-TEST','Prueba',
      12000,0,'borrador',jsonb_build_array(jsonb_build_object('id',v_item,
        'origenPlanProcedimientoId','proc-precio-1','codigoPrestacion',v_prestacion,
        'nombrePrestacion','Control','cantidad',1,'precioUnitario',12000,
        'precioPlanOriginal',10000,'descuento',0,'subtotal',12000)),
      12000,0,1,true,'revision-precio-1',v_grupo,false);
  INSERT INTO public.presupuesto_items(id,presupuesto_id,paciente_id,clinica_id,prestacion_nombre,valor,estado)
    VALUES(v_item,v_presupuesto,v_paciente,v_clinica,'Control',12000,'Pendiente');

  SELECT nueva_revision,nueva_version INTO v_revision,v_version
    FROM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_paciente,
      'revision-precio-1',1,'Precio revisado por dentista');
  IF v_revision IS NULL OR v_version <> 2 OR NOT EXISTS (
    SELECT 1 FROM public.fichas_clinicas f WHERE f.clinica_id=v_clinica AND f.paciente_id=v_paciente
      AND f.plan_tratamiento->>'actualizadoAt'=v_revision
      AND f.plan_tratamiento #>> '{fases,0,procedimientos,0,costo}'='12000'
      AND f.plan_tratamiento #>> '{ultimaRevisionPrecio,motivo}'='Precio revisado por dentista') THEN
    RAISE EXCEPTION 'Plan clínico no actualizado o sin motivo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos b WHERE b.id=v_presupuesto AND b.version=2
    AND b.plan_revision=v_revision AND b.requiere_revision
    AND b.detalle_items #>> '{0,precioPlanOriginal}'='12000') THEN
    RAISE EXCEPTION 'Borrador y plan no quedaron vinculados';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuesto_versiones h WHERE h.presupuesto_id=v_presupuesto
    AND h.actor_user_id=v_admin AND h.clinica_id=v_clinica AND h.motivo='Precio revisado por dentista')
    OR NOT EXISTS (SELECT 1 FROM public.audit_log a WHERE a.table_name='fichas_clinicas'
      AND a.record_id=v_ficha::text AND a.user_id=v_admin AND a.clinica_id=v_clinica AND a.action='UPDATE')
    OR NOT EXISTS (SELECT 1 FROM public.audit_log a WHERE a.table_name='presupuestos'
      AND a.record_id=v_presupuesto::text AND a.user_id=v_admin AND a.clinica_id=v_clinica AND a.action='UPDATE') THEN
    RAISE EXCEPTION 'Falta auditoría de la revisión';
  END IF;
  SELECT count(*) INTO v_historial FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto;

  v_bloqueado := false;
  BEGIN
    PERFORM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_paciente,
      'revision-precio-1',1,'Reintento obsoleto');
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Versión obsoleta aceptada'; END IF;
  IF (SELECT version FROM public.presupuestos WHERE id=v_presupuesto) <> 2
    OR (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> v_historial THEN
    RAISE EXCEPTION 'Reintento inválido dejó efectos';
  END IF;
  v_bloqueado := false;
  BEGIN
    PERFORM public.revisar_precios_plan_desde_presupuesto(NULL,v_paciente,
      v_revision,2,'Identificador ausente');
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Identificador ausente aceptado'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_recepcion,'role','authenticated',
    'user_metadata',jsonb_build_object('clinica_id',v_clinica))::text,true);
  v_bloqueado := false;
  BEGIN
    PERFORM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_paciente,
      v_revision,2,'Recepción intenta revisar');
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Recepción modificó el plan'; END IF;
  IF v_otro_paciente_misma IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated',
      'user_metadata',jsonb_build_object('clinica_id',v_clinica))::text,true);
    v_bloqueado := false;
    BEGIN
      PERFORM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_otro_paciente_misma,
        v_revision,2,'Paciente incorrecto');
    EXCEPTION WHEN others THEN v_bloqueado := true; END;
    IF NOT v_bloqueado THEN RAISE EXCEPTION 'Paciente distinto aceptado'; END IF;
  END IF;
  IF v_otro_paciente IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated',
      'user_metadata',jsonb_build_object('clinica_id',v_clinica))::text,true);
    v_bloqueado := false;
    BEGIN
      PERFORM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_otro_paciente,
        v_revision,2,'Paciente de otra clínica');
    EXCEPTION WHEN others THEN v_bloqueado := true; END;
    IF NOT v_bloqueado THEN RAISE EXCEPTION 'Paciente de otra clínica aceptado'; END IF;
  END IF;
  IF (SELECT version FROM public.presupuestos WHERE id=v_presupuesto) <> 2
    OR (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> v_historial THEN
    RAISE EXCEPTION 'Acceso denegado dejó efectos';
  END IF;
  PERFORM set_config('app.bp07_motivo','Prueba de incoherencia',true);
  UPDATE public.presupuestos SET detalle_items = jsonb_set(detalle_items,
    '{0,precioUnitario}','13000'::jsonb) WHERE id=v_presupuesto;
  SELECT count(*) INTO v_historial FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto;
  v_bloqueado := false;
  BEGIN
    PERFORM public.revisar_precios_plan_desde_presupuesto(v_presupuesto,v_paciente,
      v_revision,2,'Precio inconsistente');
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Precio y subtotal incoherentes aceptados'; END IF;
  IF (SELECT version FROM public.presupuestos WHERE id=v_presupuesto) <> 2
    OR (SELECT count(*) FROM public.presupuesto_versiones WHERE presupuesto_id=v_presupuesto) <> v_historial
    OR (SELECT f.plan_tratamiento #>> '{fases,0,procedimientos,0,costo}'
      FROM public.fichas_clinicas f WHERE f.clinica_id=v_clinica AND f.paciente_id=v_paciente) <> '12000' THEN
    RAISE EXCEPTION 'Precio inconsistente dejó efectos clínicos o financieros';
  END IF;
  RAISE NOTICE 'BP07: revisión, motivo, auditoría y rechazos sin efectos comprobados';
END;
$verify$;
ROLLBACK;
