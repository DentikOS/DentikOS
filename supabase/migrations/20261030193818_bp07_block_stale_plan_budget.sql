-- Impide enviar o dar por revisado un presupuesto ligado a una revisión anterior del plan.
CREATE OR REPLACE FUNCTION public.proteger_revision_presupuesto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.requiere_revision AND NOT NEW.requiere_revision
      AND public.tiene_rol_en_clinica(ARRAY['admin','dentista']::public.app_role[]) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'La revisión del presupuesto requiere un profesional autorizado';
    END IF;

    IF NEW.requiere_revision AND NEW.estado IS DISTINCT FROM OLD.estado
      AND NEW.estado IN ('enviado','Emitido','Pendiente','aprobado','Aprobado') THEN
      RAISE EXCEPTION 'Revise el presupuesto antes de enviarlo o aprobarlo';
    END IF;

    IF NEW.origen_plan AND (
      (OLD.requiere_revision AND NOT NEW.requiere_revision)
      OR (NEW.estado IS DISTINCT FROM OLD.estado
        AND NEW.estado IN ('enviado','Emitido','Pendiente','aprobado','Aprobado'))
    ) AND NOT EXISTS (
      SELECT 1 FROM public.fichas_clinicas f
      WHERE f.clinica_id = NEW.clinica_id
        AND f.paciente_id = NEW.paciente_id
        AND NEW.plan_revision IS NOT NULL
        AND f.plan_tratamiento->>'actualizadoAt' = NEW.plan_revision
    ) THEN
      RAISE EXCEPTION 'El plan cambió; actualice el presupuesto antes de revisarlo o enviarlo';
    END IF;

    IF OLD.estado IN ('enviado','Emitido','Pendiente','aprobado','Aprobado','en-curso','EnTratamiento','completado','Completado')
      AND (NEW.monto_total IS DISTINCT FROM OLD.monto_total
        OR NEW.detalle_items IS DISTINCT FROM OLD.detalle_items
        OR NEW.total_bruto IS DISTINCT FROM OLD.total_bruto
        OR NEW.total_descuentos IS DISTINCT FROM OLD.total_descuentos
        OR NEW.descuentos IS DISTINCT FROM OLD.descuentos
        OR NEW.plan_pago IS DISTINCT FROM OLD.plan_pago
        OR NEW.plan_revision IS DISTINCT FROM OLD.plan_revision
        OR NEW.origen_plan IS DISTINCT FROM OLD.origen_plan) THEN
      RAISE EXCEPTION 'Cree una nueva versión para modificar los importes de este presupuesto';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
