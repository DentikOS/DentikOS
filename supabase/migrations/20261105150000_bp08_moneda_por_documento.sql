-- BP08 CORE: moneda fija por presupuesto y comprobante.
-- Los documentos preexistentes reciben CLP; cambiar la moneda de la clínica
-- solo afecta a documentos nuevos.
BEGIN;

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS idioma_documentos text NOT NULL DEFAULT 'es-CL';

ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'CLP';

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'CLP';

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clinicas'::regclass AND conname = 'clinicas_moneda_soportada') THEN
    ALTER TABLE public.clinicas ADD CONSTRAINT clinicas_moneda_soportada
      CHECK (moneda IN ('CLP', 'ARS', 'MXN', 'COP', 'PEN', 'USD', 'EUR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clinicas'::regclass AND conname = 'clinicas_idioma_documentos_soportado') THEN
    ALTER TABLE public.clinicas ADD CONSTRAINT clinicas_idioma_documentos_soportado
      CHECK (idioma_documentos IN ('es-CL', 'es-419', 'es-ES', 'pt-BR', 'en'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.presupuestos'::regclass AND conname = 'presupuestos_moneda_soportada') THEN
    ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_moneda_soportada
      CHECK (moneda IN ('CLP', 'ARS', 'MXN', 'COP', 'PEN', 'USD', 'EUR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.pagos'::regclass AND conname = 'pagos_moneda_soportada') THEN
    ALTER TABLE public.pagos ADD CONSTRAINT pagos_moneda_soportada
      CHECK (moneda IN ('CLP', 'ARS', 'MXN', 'COP', 'PEN', 'USD', 'EUR'));
  END IF;
END;
$constraints$;

-- Los abonos de presupuesto siempre usan la moneda congelada en ese presupuesto,
-- aunque se registren por la RPC o desde una cola sincronizada.
CREATE OR REPLACE FUNCTION bp07_private.fijar_moneda_pago_presupuesto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_moneda text;
BEGIN
  IF NEW.presupuesto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.moneda INTO v_moneda
    FROM public.presupuestos b
    WHERE b.id = NEW.presupuesto_id
      AND b.clinica_id = NEW.clinica_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no disponible para fijar moneda del pago';
  END IF;

  NEW.moneda := v_moneda;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION bp07_private.fijar_moneda_pago_presupuesto() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_pagos_moneda_presupuesto ON public.pagos;
CREATE TRIGGER trg_pagos_moneda_presupuesto
  BEFORE INSERT OR UPDATE OF presupuesto_id, clinica_id, moneda ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION bp07_private.fijar_moneda_pago_presupuesto();

COMMENT ON COLUMN public.clinicas.moneda IS 'Moneda predeterminada de documentos nuevos. Cada presupuesto conserva su moneda.';
COMMENT ON COLUMN public.presupuestos.moneda IS 'Moneda fijada al crear el presupuesto; cambios posteriores en la clínica no la alteran.';
COMMENT ON COLUMN public.pagos.moneda IS 'Moneda fijada al crear el comprobante; los abonos toman la moneda de su presupuesto.';

COMMIT;
