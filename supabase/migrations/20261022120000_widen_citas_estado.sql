-- Migración: Ampliar constraint citas_estado_check para soportar estados canónicos y normalizar legacy
ALTER TABLE public.citas DROP CONSTRAINT IF EXISTS citas_estado_check;
ALTER TABLE public.citas ADD CONSTRAINT citas_estado_check
  CHECK (estado IN ('Agendada','Confirmada','EnEspera','EnAtencion','Completada','Completado','Confirmado','Agendado','EnEsperaLegacy','CompletadaLegacy','Cancelada','NoShow','No-show','Reagendada','Pendiente'));

-- Normalizar datos existentes legacy a canónicos
UPDATE public.citas SET estado = 'Confirmada' WHERE estado IN ('Confirmado');
UPDATE public.citas SET estado = 'Agendada' WHERE estado IN ('Agendado','Pendiente');
UPDATE public.citas SET estado = 'Completada' WHERE estado IN ('Completado','Atendido');
UPDATE public.citas SET estado = 'EnEspera' WHERE estado IN ('En Espera');
UPDATE public.citas SET estado = 'EnAtencion' WHERE estado IN ('En atención','En Sillon');
UPDATE public.citas SET estado = 'NoShow' WHERE estado IN ('No-show');
