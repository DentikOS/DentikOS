-- Prueba transaccional del libro BP07 de imputaciones. Todas las filas se revierten.
BEGIN;
DO $verify$
DECLARE
  v_admin uuid;
  v_recepcion uuid;
  v_clinica uuid;
  v_paciente uuid;
  v_clinica_externa uuid := gen_random_uuid();
  v_paciente_externo uuid := gen_random_uuid();
  v_presupuesto uuid := gen_random_uuid();
  v_presupuesto_externo uuid := gen_random_uuid();
  v_pago uuid := gen_random_uuid();
  v_pago_externo uuid := gen_random_uuid();
  v_item1 uuid := 'f6000000-0000-4000-8000-000000000001';
  v_item2 uuid := 'f6000000-0000-4000-8000-000000000002';
  v_item3 uuid := 'f6000000-0000-4000-8000-000000000003';
  v_operacion uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_resultado record;
  v_rechazado boolean;
  v_eventos_antes integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta esta verificación con el rol SQL postgres';
  END IF;

  SELECT mc.user_id, mc.clinica_id INTO v_admin, v_clinica
    FROM public.miembros_clinica mc
    WHERE mc.rol::text = 'admin' AND mc.activo LIMIT 1;
  SELECT mc.user_id INTO v_recepcion FROM public.miembros_clinica mc
    WHERE mc.clinica_id = v_clinica AND mc.rol::text = 'recepcion' AND mc.activo LIMIT 1;
  SELECT p.id INTO v_paciente FROM public.pacientes p
    WHERE p.clinica_id = v_clinica LIMIT 1;
  IF v_admin IS NULL OR v_recepcion IS NULL OR v_clinica IS NULL OR v_paciente IS NULL THEN
    RAISE EXCEPTION 'Faltan admin, recepción o paciente de prueba';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub',v_admin,'role','authenticated','user_metadata',jsonb_build_object('clinica_id',v_clinica)
  )::text,true);

  INSERT INTO public.presupuestos(
    id,user_id,clinica_id,paciente_id,folio,paciente_nombre,monto_total,monto_abonado,
    monto_abonado_legacy,estado,detalle_items,total_bruto,total_descuentos,version
  ) VALUES (
    v_presupuesto,v_admin,v_clinica,v_paciente,'BP07-IMPUTACION-' || substr(v_presupuesto::text,1,8),
    'Prueba transaccional',5,0,0,'aprobado',
    jsonb_build_array(
      jsonb_build_object('id',v_item1,'nombrePrestacion','Ítem uno','subtotal',1),
      jsonb_build_object('id',v_item2,'nombrePrestacion','Ítem dos','subtotal',2),
      jsonb_build_object('id',v_item3,'nombrePrestacion','Ítem tres','subtotal',4)
    ),7,2,1
  );
  INSERT INTO public.presupuesto_items(id,presupuesto_id,paciente_id,clinica_id,prestacion_nombre,valor,estado)
    VALUES
      (v_item1,v_presupuesto,v_paciente,v_clinica,'Ítem uno',1,'Pendiente'),
      (v_item2,v_presupuesto,v_paciente,v_clinica,'Ítem dos',2,'Pendiente'),
      (v_item3,v_presupuesto,v_paciente,v_clinica,'Ítem tres',4,'Pendiente');

  -- Fixture externo para asegurar que un UUID de otra clínica no es autoridad.
  INSERT INTO public.clinicas(id,nombre) VALUES (v_clinica_externa,'Prueba BP07 imputaciones');
  INSERT INTO public.pacientes(id,user_id,nombre,rut,clinica_id)
    VALUES (v_paciente_externo,v_admin,'Paciente externo','TEST-' || substr(v_paciente_externo::text,1,8),v_clinica_externa);
  INSERT INTO public.presupuestos(
    id,user_id,clinica_id,paciente_id,folio,paciente_nombre,monto_total,monto_abonado,
    monto_abonado_legacy,estado,detalle_items,total_bruto,total_descuentos,version,origen_plan
  ) VALUES (
    v_presupuesto_externo,v_admin,v_clinica_externa,v_paciente_externo,
    'BP07-EXTERNO-' || substr(v_presupuesto_externo::text,1,8),'Paciente externo',1,0,0,
    'borrador','[]'::jsonb,1,0,1,true
  );
  ALTER TABLE public.pagos DISABLE TRIGGER trg_validar_abono_presupuesto;
  ALTER TABLE public.pagos DISABLE TRIGGER trg_aplicar_abono_presupuesto;
  INSERT INTO public.pagos(id,user_id,paciente_id,presupuesto_id,folio,monto,metodo_pago,clinica_id,concepto)
    VALUES (v_pago_externo,v_admin,v_paciente_externo,v_presupuesto_externo,
      'TEST-EXTERNO-' || substr(v_pago_externo::text,1,8),1,'efectivo',v_clinica_externa,'Fixture rollback');
  ALTER TABLE public.pagos ENABLE TRIGGER trg_validar_abono_presupuesto;
  ALTER TABLE public.pagos ENABLE TRIGGER trg_aplicar_abono_presupuesto;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub',v_admin,'role','authenticated','user_metadata',jsonb_build_object('clinica_id',v_clinica)
  )::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_snapshot := public.listar_imputaciones_presupuesto(v_presupuesto);
  IF (SELECT (x->>'monto_neto')::integer FROM jsonb_array_elements(v_snapshot->'items') x
      WHERE x->>'id'=v_item1::text) <> 0
    OR (SELECT (x->>'monto_neto')::integer FROM jsonb_array_elements(v_snapshot->'items') x
      WHERE x->>'id'=v_item2::text) <> 2
    OR (SELECT (x->>'monto_neto')::integer FROM jsonb_array_elements(v_snapshot->'items') x
      WHERE x->>'id'=v_item3::text) <> 3
    OR (SELECT sum((x->>'monto_neto')::integer) FROM jsonb_array_elements(v_snapshot->'items') x) <> 5 THEN
    RAISE EXCEPTION 'Prorrateo determinista no coincide con los importes del presupuesto';
  END IF;

  SELECT * INTO v_resultado FROM public.registrar_abono_presupuesto_con_imputaciones(
    v_pago,v_presupuesto,4,'transferencia','Comprobante de prueba',
    jsonb_build_array(jsonb_build_object('item_id',v_item2,'monto',1),
      jsonb_build_object('item_id',v_item3,'monto',2))
  );
  -- El mismo envío idempotente no vuelve a crear abono ni imputaciones.
  SELECT * INTO v_resultado FROM public.registrar_abono_presupuesto_con_imputaciones(
    v_pago,v_presupuesto,4,'transferencia','Comprobante de prueba',
    jsonb_build_array(jsonb_build_object('item_id',v_item2,'monto',1),
      jsonb_build_object('item_id',v_item3,'monto',2))
  );
  v_snapshot := public.listar_imputaciones_presupuesto(v_presupuesto);
  IF jsonb_array_length(v_snapshot->'pagos') <> 1
    OR (v_snapshot->'pagos'->0->>'monto_sin_imputar')::integer <> 1
    OR (SELECT (x->>'monto_imputado')::integer FROM jsonb_array_elements(v_snapshot->'items') x
      WHERE x->>'id'=v_item3::text) <> 2 THEN
    RAISE EXCEPTION 'Abono inicial o su idempotencia produjo un saldo incorrecto';
  END IF;

  PERFORM public.registrar_imputaciones_pago(v_pago,v_operacion,
    jsonb_build_array(jsonb_build_object('item_id',v_item2,'monto',1)));
  v_snapshot := public.listar_imputaciones_presupuesto(v_presupuesto);
  IF (SELECT x->>'estado_financiero' FROM jsonb_array_elements(v_snapshot->'items') x
      WHERE x->>'id'=v_item2::text) <> 'pagado' THEN
    RAISE EXCEPTION 'La prestación no se proyectó como pagada al cubrir su valor neto';
  END IF;

  SELECT count(*) INTO v_eventos_antes FROM public.pago_imputaciones WHERE pago_id=v_pago;
  v_rechazado := false;
  BEGIN
    PERFORM public.registrar_imputaciones_pago(v_pago,gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('item_id',v_item3,'monto',1)));
  EXCEPTION WHEN others THEN v_rechazado := true; END;
  IF NOT v_rechazado OR (SELECT count(*) FROM public.pago_imputaciones WHERE pago_id=v_pago) <> v_eventos_antes THEN
    RAISE EXCEPTION 'Una imputación por sobre el monto del pago no se rechazó sin efectos';
  END IF;

  PERFORM public.revertir_imputacion_pago(
    (SELECT id FROM public.pago_imputaciones WHERE pago_id=v_pago
      AND presupuesto_item_id=v_item3 AND tipo='imputacion'),
    gen_random_uuid(),'Corrección de prestación seleccionada'
  );
  v_snapshot := public.listar_imputaciones_presupuesto(v_presupuesto);
  IF (v_snapshot->'pagos'->0->>'monto_sin_imputar')::integer <> 2
    OR NOT EXISTS (SELECT 1 FROM public.pago_imputaciones pi
      WHERE pi.pago_id=v_pago AND pi.tipo='reversion'
        AND pi.actor_user_id=v_admin AND pi.clinica_id=v_clinica
        AND pi.motivo='Corrección de prestación seleccionada') THEN
    RAISE EXCEPTION 'La reversión no quedó registrada con actor, clínica y motivo';
  END IF;

  -- Recepción puede imputar abonos del presupuesto y queda identificada en el libro.
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub',v_recepcion,'role','authenticated','user_metadata',jsonb_build_object('clinica_id',v_clinica)
  )::text,true);
  PERFORM public.registrar_imputaciones_pago(v_pago,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('item_id',v_item3,'monto',1)));
  IF NOT EXISTS (SELECT 1 FROM public.pago_imputaciones pi
      WHERE pi.pago_id=v_pago AND pi.tipo='imputacion'
        AND pi.actor_user_id=v_recepcion AND pi.clinica_id=v_clinica) THEN
    RAISE EXCEPTION 'La imputación de recepción no se auditó';
  END IF;

  v_rechazado := false;
  BEGIN
    PERFORM public.registrar_imputaciones_pago(v_pago_externo,gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('item_id',v_item3,'monto',1)));
  EXCEPTION WHEN others THEN v_rechazado := true; END;
  IF NOT v_rechazado OR EXISTS (SELECT 1 FROM public.pago_imputaciones WHERE pago_id=v_pago_externo) THEN
    RAISE EXCEPTION 'Se aceptó un pago de otra clínica o dejó efectos secundarios';
  END IF;

  v_rechazado := false;
  BEGIN
    UPDATE public.pago_imputaciones SET monto=2 WHERE pago_id=v_pago;
  EXCEPTION WHEN insufficient_privilege THEN v_rechazado := true; END;
  IF NOT v_rechazado THEN RAISE EXCEPTION 'La tabla permitió alterar un evento inmutable'; END IF;

  RAISE NOTICE 'BP07 imputaciones verificadas: prorrateo, pago parcial, idempotencia, autorización, reversión y rechazo sin efectos';
END;
$verify$;
ROLLBACK;
