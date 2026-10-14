-- ============================================================
-- Habilitar Realtime para las tablas del Dashboard (BP04 §03)
-- ============================================================

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY['citas', 'pacientes', 'cargas_esterilizacion', 'inventario', 'pagos', 'mensajes'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;
