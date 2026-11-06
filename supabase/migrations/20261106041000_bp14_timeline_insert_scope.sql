-- BP14: only admin/dentist may append GES timeline events, and the patient
-- referenced by such an event must belong to the same clinic as the event.
-- Existing non-GES timeline insert behavior is preserved.
DROP POLICY IF EXISTS timeline_bp06_insert ON public.timeline_paciente;
CREATE POLICY timeline_bp06_insert ON public.timeline_paciente FOR INSERT TO authenticated
  WITH CHECK (
    timeline_paciente.clinica_id = public.clinica_actual()
    AND timeline_paciente.actor_user_id = auth.uid()
    AND (timeline_paciente.tipo <> 'urgencia_ges'
      OR public.rol_en_clinica_actual() = ANY(ARRAY['admin','dentista']::public.app_role[]))
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = timeline_paciente.paciente_id
        AND (timeline_paciente.tipo <> 'urgencia_ges'
          OR p.clinica_id = timeline_paciente.clinica_id)
    )
  );
