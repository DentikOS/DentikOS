-- Repoint foreign keys from public.appointments to public.citas
ALTER TABLE public.appointment_confirmations
  DROP CONSTRAINT IF EXISTS appointment_confirmations_appointment_id_fkey;
ALTER TABLE public.appointment_confirmations
  ADD CONSTRAINT appointment_confirmations_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.citas(id) ON DELETE CASCADE;

ALTER TABLE public.waiting_room_events
  DROP CONSTRAINT IF EXISTS waiting_room_events_appointment_id_fkey;
ALTER TABLE public.waiting_room_events
  ADD CONSTRAINT waiting_room_events_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.citas(id) ON DELETE CASCADE;
