-- BP08 §03: relaciona boxes con citas y define equipamiento por prestación.
-- Los campos de sede/box son aditivos; las citas históricas quedan sin asignar.

ALTER TABLE public.prestaciones
  ADD COLUMN IF NOT EXISTS equipamiento_requerido TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prestaciones_equipamiento_requerido_valido'
      AND conrelid = 'public.prestaciones'::regclass
  ) THEN
    ALTER TABLE public.prestaciones
      ADD CONSTRAINT prestaciones_equipamiento_requerido_valido CHECK (
        equipamiento_requerido <@ ARRAY[
          'lampara_fotocurado', 'escaner_intraoral', 'laser_dental',
          'rayos_x_periapical', 'rayos_x_panoramico', 'autoclave_box',
          'monitor_signos_vitales', 'sedacion_consciente', 'microscopio_dental'
        ]::TEXT[]
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_prestaciones_equipamiento_audit_insert ON public.prestaciones;
CREATE TRIGGER trg_prestaciones_equipamiento_audit_insert
  AFTER INSERT ON public.prestaciones
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio();

-- Reutiliza el trigger de BP07 para que un guardado que cambie precio y
-- requisitos genere un único evento de auditoría por fila.
DROP TRIGGER IF EXISTS zz_prestaciones_audit_price_update ON public.prestaciones;
CREATE TRIGGER zz_prestaciones_audit_price_update
  AFTER UPDATE OF precio_particular, precio_fonasa, precio, equipamiento_requerido ON public.prestaciones
  FOR EACH ROW
  WHEN (OLD.precio_particular IS DISTINCT FROM NEW.precio_particular
    OR OLD.precio_fonasa IS DISTINCT FROM NEW.precio_fonasa
    OR OLD.precio IS DISTINCT FROM NEW.precio
    OR OLD.equipamiento_requerido IS DISTINCT FROM NEW.equipamiento_requerido)
  EXECUTE FUNCTION bp07_private.auditar_cambio_prestacion_arancel();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'boxes_clinicos_id_clinica_sucursal_unique'
      AND conrelid = 'public.boxes_clinicos'::regclass
  ) THEN
    ALTER TABLE public.boxes_clinicos
      ADD CONSTRAINT boxes_clinicos_id_clinica_sucursal_unique
      UNIQUE (id, clinica_id, sucursal_id);
  END IF;
END $$;

ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS sede_id UUID,
  ADD COLUMN IF NOT EXISTS box_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'citas_sede_clinica_fk'
      AND conrelid = 'public.citas'::regclass
  ) THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_sede_clinica_fk
      FOREIGN KEY (sede_id, clinica_id)
      REFERENCES public.sucursales (id, clinica_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'citas_box_sede_clinica_fk'
      AND conrelid = 'public.citas'::regclass
  ) THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_box_sede_clinica_fk
      FOREIGN KEY (box_id, clinica_id, sede_id)
      REFERENCES public.boxes_clinicos (id, clinica_id, sucursal_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'citas_box_requiere_sede'
      AND conrelid = 'public.citas'::regclass
  ) THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_box_requiere_sede CHECK (box_id IS NULL OR sede_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_citas_clinica_sede_fecha
  ON public.citas (clinica_id, sede_id, fecha);

COMMENT ON COLUMN public.prestaciones.equipamiento_requerido IS
  'Equipamiento que debe existir en el box al agendar esta prestación; se configura explícitamente por clínica.';
COMMENT ON COLUMN public.citas.sede_id IS
  'Sucursal elegida al agendar; queda NULL en citas históricas sin asignación conocida.';
COMMENT ON COLUMN public.citas.box_id IS
  'Box clínico elegido. La etiqueta histórica continúa en el metadato boxAsignado.';
