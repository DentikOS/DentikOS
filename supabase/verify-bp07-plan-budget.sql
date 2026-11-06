BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_presupuesto uuid := gen_random_uuid();
  v_grupo uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_manual uuid := gen_random_uuid();
  v_nueva uuid;
  v_items jsonb;
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
  IF public.clinica_actual() IS DISTINCT FROM v_clinica THEN RAISE EXCEPTION 'Selector clínico inválido'; END IF;

  v_items := jsonb_build_array(jsonb_build_object('id', v_item, 'origenPlanProcedimientoId', 'proc-1',
    'nombrePrestacion', 'Prueba clínica', 'cantidad', 1, 'precioUnitario', 10000,
    'precioPlanOriginal', 10000, 'descuento', 0, 'subtotal', 10000));
  INSERT INTO public.fichas_clinicas(clinica_id,paciente_id,plan_tratamiento)
    VALUES(v_clinica,v_paciente,jsonb_build_object('actualizadoAt','revision-bp07-1','fases','[]'::jsonb))
    ON CONFLICT (clinica_id,paciente_id) DO UPDATE SET plan_tratamiento = excluded.plan_tratamiento;
  INSERT INTO public.presupuestos(id,user_id,clinica_id,paciente_id,folio,paciente_nombre,
    monto_total,monto_abonado,estado,detalle_items,total_bruto,total_descuentos,version,
    origen_plan,plan_revision,version_grupo_id,requiere_revision)
    VALUES(v_presupuesto,v_admin,v_clinica,v_paciente,'BP07-PLAN-ROLLBACK-TEST','Prueba',
      9000,0,'borrador',v_items,10000,1000,1,true,'revision-bp07-1',v_grupo,false);
  INSERT INTO public.presupuesto_items(id,presupuesto_id,paciente_id,clinica_id,prestacion_nombre,valor,estado)
    VALUES(v_item,v_presupuesto,v_paciente,v_clinica,'Prueba clínica',10000,'Pendiente');
  UPDATE public.fichas_clinicas SET plan_tratamiento = jsonb_build_object('actualizadoAt','revision-bp07-2','fases','[]'::jsonb)
    WHERE clinica_id = v_clinica AND paciente_id = v_paciente;
  v_bloqueado := false;
  BEGIN
    UPDATE public.presupuestos SET estado='enviado' WHERE id=v_presupuesto;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Borrador de plan obsoleto enviado'; END IF;
  IF (SELECT estado FROM public.presupuestos WHERE id=v_presupuesto) <> 'borrador' THEN
    RAISE EXCEPTION 'Envío rechazado alteró el borrador';
  END IF;
  v_items := jsonb_build_array(
    jsonb_build_object('id',v_item,'origenPlanProcedimientoId','proc-1','nombrePrestacion','Prueba clínica',
      'cantidad',1,'precioUnitario',12000,'precioPlanOriginal',12000,'descuento',0,'subtotal',12000),
    jsonb_build_object('id',v_manual,'nombrePrestacion','Ítem manual',
      'cantidad',1,'precioUnitario',5000,'descuento',0,'subtotal',5000));
  PERFORM public.sincronizar_borrador_desde_plan_con_motivo(v_presupuesto,1,'revision-bp07-2',v_items,'Plan clínico actualizado');
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id=v_presupuesto AND version=2
    AND monto_total=16000 AND total_bruto=17000 AND total_descuentos=1000 AND requiere_revision) THEN
    RAISE EXCEPTION 'Borrador no recalculado';
  END IF;
  IF (SELECT count(*) FROM public.presupuesto_items WHERE presupuesto_id=v_presupuesto) <> 2 THEN
    RAISE EXCEPTION 'Ítems no reemplazados atómicamente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE table_name='presupuestos' AND record_id=v_presupuesto::text
    AND clinica_id=v_clinica AND user_id=v_admin AND action='UPDATE') THEN
    RAISE EXCEPTION 'Falta auditoría del presupuesto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuesto_versiones h WHERE h.presupuesto_id=v_presupuesto
    AND h.motivo='Plan clínico actualizado' AND h.motivo_origen='usuario'
    AND h.actor_user_id=v_admin AND h.clinica_id=v_clinica) THEN
    RAISE EXCEPTION 'Falta historial de la sincronización del plan';
  END IF;
  v_bloqueado := false;
  BEGIN
    PERFORM public.sincronizar_borrador_desde_plan(v_presupuesto,1,'revision-bp07-2',v_items);
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Versión obsoleta aceptada'; END IF;
  IF (SELECT version FROM public.presupuestos WHERE id=v_presupuesto) <> 2 THEN
    RAISE EXCEPTION 'Reintento fallido tuvo efectos';
  END IF;
  UPDATE public.presupuestos SET requiere_revision=false WHERE id=v_presupuesto;
  UPDATE public.presupuestos SET estado='aprobado' WHERE id=v_presupuesto;
  UPDATE public.fichas_clinicas SET plan_tratamiento = jsonb_build_object('actualizadoAt','revision-bp07-3','fases','[]'::jsonb)
    WHERE clinica_id=v_clinica AND paciente_id=v_paciente;
  v_items := jsonb_build_array(
    jsonb_build_object('id',v_item,'origenPlanProcedimientoId','proc-1','nombrePrestacion','Prueba clínica',
      'cantidad',1,'precioUnitario',14000,'precioPlanOriginal',14000,'descuento',0,'subtotal',14000),
    jsonb_build_object('id',v_manual,'nombrePrestacion','Ítem manual',
      'cantidad',1,'precioUnitario',5000,'descuento',0,'subtotal',5000));
  v_nueva := public.crear_version_presupuesto_desde_plan_con_motivo(v_presupuesto,'revision-bp07-3',v_items,'Nueva versión del plan');
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id=v_presupuesto AND estado='aprobado'
    AND version=2 AND monto_total=16000) THEN RAISE EXCEPTION 'Versión aprobada alterada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id=v_nueva AND estado='borrador'
    AND version=3 AND monto_total=18000 AND requiere_revision AND version_grupo_id=v_grupo) THEN
    RAISE EXCEPTION 'Nueva versión incorrecta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuesto_versiones h WHERE h.presupuesto_id=v_nueva
    AND h.motivo='Nueva versión del plan' AND h.motivo_origen='usuario' AND h.revision=1) THEN
    RAISE EXCEPTION 'Falta historial de la nueva versión';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE public.presupuestos SET monto_total=17000 WHERE id=v_presupuesto;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Versión aprobada modificable'; END IF;
  v_bloqueado := false;
  BEGIN
    PERFORM public.crear_version_presupuesto_desde_plan(v_presupuesto,'revision-bp07-3',v_items);
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Versión duplicada aceptada'; END IF;

  UPDATE public.fichas_clinicas SET plan_tratamiento = jsonb_build_object('actualizadoAt','revision-bp07-4','fases','[]'::jsonb)
    WHERE clinica_id=v_clinica AND paciente_id=v_paciente;
  v_bloqueado := false;
  BEGIN
    UPDATE public.presupuestos SET requiere_revision=false WHERE id=v_nueva;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Revisión de plan obsoleto confirmada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id=v_nueva AND requiere_revision) THEN
    RAISE EXCEPTION 'Confirmación rechazada alteró el presupuesto';
  END IF;
  UPDATE public.fichas_clinicas SET plan_tratamiento = jsonb_build_object('actualizadoAt','revision-bp07-3','fases','[]'::jsonb)
    WHERE clinica_id=v_clinica AND paciente_id=v_paciente;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_recepcion, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('clinica_id', v_clinica))::text, true);
  v_bloqueado := false;
  BEGIN
    PERFORM public.sincronizar_borrador_desde_plan(v_nueva,3,'revision-bp07-3',v_items);
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Recepción pudo modificar plan financiero'; END IF;
  IF (SELECT version FROM public.presupuestos WHERE id=v_nueva) <> 3 THEN
    RAISE EXCEPTION 'Intento de recepción tuvo efectos';
  END IF;
  v_bloqueado := false;
  BEGIN
    UPDATE public.presupuestos SET requiere_revision=false WHERE id=v_nueva;
  EXCEPTION WHEN others THEN v_bloqueado := true; END;
  IF NOT v_bloqueado THEN RAISE EXCEPTION 'Recepción confirmó revisión clínica'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presupuestos WHERE id=v_nueva AND requiere_revision) THEN
    RAISE EXCEPTION 'Intento de recepción cambió revisión';
  END IF;
  RAISE NOTICE 'BP07 plan verificado: borrador, revisión vigente, nueva versión, auditoría y rechazos sin efectos';
END;
$verify$;
ROLLBACK;
