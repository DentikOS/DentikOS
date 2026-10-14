import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { searchParams } = new URL(req.url)
    let clinicId = searchParams.get('clinicId')
    if (!clinicId && req.method === 'POST') {
      try {
        const body = await req.json()
        clinicId = body?.clinicId
      } catch {
        // No body
      }
    }

    if (!clinicId) {
      return new Response(JSON.stringify({ error: 'clinicId requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('preference_key, preference_value, updated_at')
      .eq('user_id', user.id)
      .eq('clinic_id', clinicId)

    if (error) throw error

    const result = {
      widgetOrder: null,
      hiddenWidgets: [],
      lastSync: null
    }

    preferences?.forEach(pref => {
      if (pref.preference_key === 'dashboard_widget_order') {
        result.widgetOrder = pref.preference_value.order
      } else if (pref.preference_key === 'dashboard_hidden_widgets') {
        result.hiddenWidgets = pref.preference_value.hidden
      }
      if (!result.lastSync || new Date(pref.updated_at) > new Date(result.lastSync)) {
        result.lastSync = pref.updated_at
      }
    })

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
