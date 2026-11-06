-- La restricción histórica omitía 'derivacion', aunque BP06 emite ese evento.
BEGIN;
ALTER TABLE public.timeline_paciente DROP CONSTRAINT timeline_paciente_tipo_check;
ALTER TABLE public.timeline_paciente ADD CONSTRAINT timeline_paciente_tipo_check
  CHECK (tipo IN ('cita','evolucion','receta','consentimiento','cambio_estado',
    'cambio_doctor','pago','adjunto','presupuesto','llamada','email','admin','derivacion'));
COMMIT;
