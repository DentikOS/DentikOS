-- BP14: keep the BP06 patient-to-clinic check tenant-qualified when restricting GES timeline reads.
DROP POLICY IF EXISTS timeline_bp06_select ON public.timeline_paciente;
CREATE POLICY timeline_bp06_select ON public.timeline_paciente FOR SELECT TO authenticated
  USING (timeline_paciente.clinica_id = public.clinica_actual()
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = timeline_paciente.paciente_id
        AND p.clinica_id = timeline_paciente.clinica_id
    )
    AND (timeline_paciente.tipo <> 'urgencia_ges'
      OR public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[])));
