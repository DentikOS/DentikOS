-- BP11: evita recalcular auth.uid() por cada fila evaluada en INSERT policy.
-- Mantiene las mismas reglas tenant y rol desplegadas en la migración anterior.
DROP POLICY IF EXISTS recetas_insert_clinica ON public.recetas;
CREATE POLICY recetas_insert_clinica ON public.recetas FOR INSERT
  WITH CHECK (
    clinica_id = clinica_actual()
    AND paciente_id IN (
      SELECT id FROM public.pacientes WHERE clinica_id = clinica_actual()
    )
    AND user_id = (SELECT auth.uid())
    AND tiene_rol_en_clinica(ARRAY['admin','dentista']::app_role[])
  );
