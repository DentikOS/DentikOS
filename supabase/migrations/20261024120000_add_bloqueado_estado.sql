-- Añadir estado 'Bloqueado' al CHECK constraint de public.citas
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_estado_check;
ALTER TABLE public.citas ADD CONSTRAINT citas_estado_check
  CHECK (estado IN ('Agendada','Confirmada','EnEspera','EnAtencion','Completada','Completado','Confirmado','Agendado','EnEsperaLegacy','CompletadaLegacy','Cancelada','NoShow','No-show','Reagendada','Pendiente','Bloqueado'));
