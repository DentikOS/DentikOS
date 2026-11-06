-- Habilita las notificaciones Realtime para las tablas compartidas del BP11.
-- RLS y permisos existentes permanecen a cargo de sus policies actuales.
DO $$
DECLARE
  tabla text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'No existe la publicación supabase_realtime';
  END IF;

  FOREACH tabla IN ARRAY ARRAY[
    'vademecum',
    'vademecum_urgencia',
    'vademecum_antirresortivos',
    'alergias_cruzadas',
    'interacciones_farmacologicas',
    'profilaxis_endocarditis',
    'manejo_anticoagulantes',
    'reference_data_meta'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabla);
    END IF;
  END LOOP;
END;
$$;
