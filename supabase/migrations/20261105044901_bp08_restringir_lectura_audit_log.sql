-- BP08: los registros completos de auditoría contienen old_data/new_data y
-- pueden incluir información clínica. La lectura global queda limitada a
-- administradores de la clínica; los demás miembros ven solo sus eventos,
-- siempre dentro de la clínica activa.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_clinica ON public.audit_log;
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (SELECT public.es_admin_de_clinica_actual())
  );

DROP POLICY IF EXISTS audit_log_select_own ON public.audit_log;
CREATE POLICY audit_log_select_own
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND user_id = (SELECT auth.uid())
  );

COMMENT ON POLICY audit_log_select_admin ON public.audit_log IS
  'Solo admin activo de la clínica puede leer la auditoría completa de la clínica activa.';
COMMENT ON POLICY audit_log_select_own ON public.audit_log IS
  'Otros usuarios autenticados pueden leer solo sus eventos en la clínica activa.';
