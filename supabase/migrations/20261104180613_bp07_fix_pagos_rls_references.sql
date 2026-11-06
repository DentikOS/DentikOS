-- BP07: corrige referencias correlacionadas de RLS para pagos.
-- Mantiene las políticas de recepción y la eliminación legacy sin cambios.
BEGIN;

DROP POLICY IF EXISTS pagos_bp07_select ON public.pagos;
CREATE POLICY pagos_bp07_select ON public.pagos FOR SELECT TO authenticated
  USING (
    pagos.clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (
      pagos.paciente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = pagos.paciente_id
          AND p.clinica_id = pagos.clinica_id
      )
    )
    AND (
      pagos.presupuesto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.presupuestos b
        WHERE b.id = pagos.presupuesto_id
          AND b.clinica_id = pagos.clinica_id
          AND b.paciente_id = pagos.paciente_id
      )
    )
  );

DROP POLICY IF EXISTS pagos_bp07_insert ON public.pagos;
CREATE POLICY pagos_bp07_insert ON public.pagos FOR INSERT TO authenticated
  WITH CHECK (
    pagos.clinica_id = public.clinica_actual()
    AND pagos.user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (
      pagos.paciente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = pagos.paciente_id
          AND p.clinica_id = pagos.clinica_id
      )
    )
    AND (
      pagos.presupuesto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.presupuestos b
        WHERE b.id = pagos.presupuesto_id
          AND b.clinica_id = pagos.clinica_id
          AND b.paciente_id = pagos.paciente_id
      )
    )
  );

DROP POLICY IF EXISTS pagos_bp07_update ON public.pagos;
CREATE POLICY pagos_bp07_update ON public.pagos FOR UPDATE TO authenticated
  USING (
    pagos.clinica_id = public.clinica_actual()
    AND pagos.user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
  )
  WITH CHECK (
    pagos.clinica_id = public.clinica_actual()
    AND pagos.user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[])
    AND (
      pagos.paciente_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = pagos.paciente_id
          AND p.clinica_id = pagos.clinica_id
      )
    )
    AND (
      pagos.presupuesto_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.presupuestos b
        WHERE b.id = pagos.presupuesto_id
          AND b.clinica_id = pagos.clinica_id
          AND b.paciente_id = pagos.paciente_id
      )
    )
  );

COMMIT;
