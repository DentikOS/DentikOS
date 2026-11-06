-- Regression checks for the BP14 pre-deployment view security remediation.
-- This inspects catalog ACLs and RLS metadata without reading clinical/profile rows.
DO $test$
DECLARE
  v_view text;
BEGIN
  FOREACH v_view IN ARRAY ARRAY['perfiles', 'vw_sala_espera_actual'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_view
        AND c.relkind = 'v'
        AND c.reloptions @> ARRAY['security_invoker=true']
    ) THEN
      RAISE EXCEPTION 'public.% is not a SECURITY INVOKER view', v_view;
    END IF;

    IF has_table_privilege('anon', format('public.%I', v_view), 'SELECT') THEN
      RAISE EXCEPTION 'anon still has SELECT on public.%', v_view;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) acl
      WHERE n.nspname = 'public'
        AND c.relname = v_view
        AND acl.grantee = 0
        AND acl.privilege_type = 'SELECT'
    ) THEN
      RAISE EXCEPTION 'PUBLIC still has SELECT on public.%', v_view;
    END IF;

    IF NOT has_table_privilege('authenticated', format('public.%I', v_view), 'SELECT') THEN
      RAISE EXCEPTION 'authenticated lost SELECT on public.%', v_view;
    END IF;
  END LOOP;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass)
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'profiles'
         AND cmd = 'SELECT'
     ) THEN
    RAISE EXCEPTION 'profiles SELECT is not protected by RLS';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.waiting_room_events'::regclass)
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'waiting_room_events'
         AND cmd = 'SELECT'
     ) THEN
    RAISE EXCEPTION 'waiting room events SELECT is not protected by RLS';
  END IF;
END
$test$;
