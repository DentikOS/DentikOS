-- BP06/BP07 CORE: presupuesto persistente y asociaciones clínicas del mismo tenant.
-- Se conserva cada estado legacy para no invalidar filas existentes.
BEGIN;

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS detalle_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_bruto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_descuentos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento timestamptz,
  ADD COLUMN IF NOT EXISTS descuentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_pago jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz;

ALTER TABLE public.presupuestos DROP CONSTRAINT IF EXISTS presupuestos_estado_check;
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_estado_check CHECK (estado IN (
  'Borrador', 'Emitido', 'Pendiente', 'Aprobado', 'Rechazado', 'EnTratamiento', 'Completado',
  'borrador', 'enviado', 'aprobado', 'en-curso', 'completado', 'rechazado', 'vencido', 'archivado'
));
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_saldo_valido
  CHECK (monto_total >= 0 AND monto_abonado >= 0 AND monto_abonado <= monto_total) NOT VALID;

-- La ficha y el timeline solo pueden referirse a pacientes de la clínica activa.
DROP POLICY IF EXISTS "Miembros leen fichas de su clinica" ON public.fichas_clinicas;
DROP POLICY IF EXISTS "Miembros insertan fichas de su clinica" ON public.fichas_clinicas;
DROP POLICY IF EXISTS "Miembros actualizan fichas de su clinica" ON public.fichas_clinicas;

CREATE POLICY fichas_bp06_select ON public.fichas_clinicas FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
CREATE POLICY fichas_bp06_insert ON public.fichas_clinicas FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
CREATE POLICY fichas_bp06_update ON public.fichas_clinicas FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));

DROP TRIGGER IF EXISTS trg_fichas_clinicas_audit ON public.fichas_clinicas;
CREATE TRIGGER trg_fichas_clinicas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.fichas_clinicas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio();

-- Sustituye políticas legacy que comprobaban solo el autor y no la clínica activa.
DROP POLICY IF EXISTS presupuestos_select_rol ON public.presupuestos;
DROP POLICY IF EXISTS presupuestos_insert_rol ON public.presupuestos;
DROP POLICY IF EXISTS presupuestos_update_rol ON public.presupuestos;
DROP POLICY IF EXISTS presupuestos_delete_rol ON public.presupuestos;

CREATE POLICY presupuestos_bp07_select ON public.presupuestos FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND (paciente_id IS NULL OR EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id)));
CREATE POLICY presupuestos_bp07_insert ON public.presupuestos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual() AND user_id = auth.uid()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND paciente_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
CREATE POLICY presupuestos_bp07_update ON public.presupuestos FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND (paciente_id IS NULL OR EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id)))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND public.tiene_rol_en_clinica(ARRAY['admin','dentista','asistente','recepcion']::public.app_role[])
    AND paciente_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
-- No se crea política DELETE: el CORE archiva y conserva auditoría.

DROP POLICY IF EXISTS presupuesto_items_select_rol ON public.presupuesto_items;
DROP POLICY IF EXISTS presupuesto_items_insert_rol ON public.presupuesto_items;
DROP POLICY IF EXISTS presupuesto_items_update_rol ON public.presupuesto_items;
DROP POLICY IF EXISTS presupuesto_items_delete_rol ON public.presupuesto_items;

CREATE POLICY presupuesto_items_bp07_select ON public.presupuesto_items FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id));
CREATE POLICY presupuesto_items_bp07_insert ON public.presupuesto_items FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id
        AND (paciente_id IS NULL OR paciente_id = b.paciente_id)));
CREATE POLICY presupuesto_items_bp07_update ON public.presupuesto_items FOR UPDATE TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id))
  WITH CHECK (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.presupuestos b
      WHERE b.id = presupuesto_id AND b.clinica_id = clinica_id
        AND (paciente_id IS NULL OR paciente_id = b.paciente_id)));

ALTER TABLE public.timeline_paciente
  ADD COLUMN IF NOT EXISTS clinica_id uuid,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid;
UPDATE public.timeline_paciente t SET clinica_id = p.clinica_id
  FROM public.pacientes p WHERE t.paciente_id = p.id AND t.clinica_id IS NULL;
-- Las filas antiguas sin paciente válido quedan aisladas por RLS; no se borran.
-- NOT VALID evita que una fila huérfana histórica bloquee la migración.
ALTER TABLE public.timeline_paciente ADD CONSTRAINT timeline_clinica_required
  CHECK (clinica_id IS NOT NULL) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_timeline_clinica_paciente_fecha
  ON public.timeline_paciente(clinica_id, paciente_id, fecha DESC);

DROP POLICY IF EXISTS "Miembros leen timeline de su clínica" ON public.timeline_paciente;
DROP POLICY IF EXISTS "Miembros crean eventos en timeline" ON public.timeline_paciente;
CREATE POLICY timeline_bp06_select ON public.timeline_paciente FOR SELECT TO authenticated
  USING (clinica_id = public.clinica_actual()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));
CREATE POLICY timeline_bp06_insert ON public.timeline_paciente FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.clinica_actual() AND actor_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.clinica_id = clinica_id));

GRANT SELECT, INSERT, UPDATE ON public.fichas_clinicas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.presupuestos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.presupuesto_items TO authenticated;
GRANT SELECT, INSERT ON public.timeline_paciente TO authenticated;

COMMIT;
