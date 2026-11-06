-- BP14 pre-deployment security remediation for two existing public views.
-- SECURITY INVOKER makes each caller subject to the base-table grants and RLS.
ALTER VIEW public.perfiles
  SET (security_invoker = true);

ALTER VIEW public.vw_sala_espera_actual
  SET (security_invoker = true);

REVOKE ALL PRIVILEGES ON TABLE public.perfiles FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.vw_sala_espera_actual FROM anon, PUBLIC;

-- Authenticated access remains available and is constrained by base-table RLS.
GRANT SELECT ON TABLE public.perfiles TO authenticated;
GRANT SELECT ON TABLE public.vw_sala_espera_actual TO authenticated;
