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

    const { clinicId, widgetOrder, hiddenWidgets } = await req.json()

    if (!clinicId) {
      return new Response(JSON.stringify({ error: 'clinicId requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Guardar orden de widgets
    const { error: orderError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        clinic_id: clinicId,
        preference_key: 'dashboard_widget_order',
        preference_value: { order: widgetOrder },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,clinic_id,preference_key'
      })

    if (orderError) throw orderError

    // Guardar widgets ocultos
    const { error: hiddenError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        clinic_id: clinicId,
        preference_key: 'dashboard_hidden_widgets',
        preference_value: { hidden: hiddenWidgets },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,clinic_id,preference_key'
      })

    if (hiddenError) throw hiddenError

    return new Response(
      JSON.stringify({ success: true, updated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
