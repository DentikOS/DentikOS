// Edge Function: r2-profile-upload-url
// Genera URL firmada para subir foto de perfil a R2 bucket "profile-avatars"
// Reutiliza la lógica de r2-upload-url pero sin requerir pacienteId

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  nombre_archivo: string
  mime_type: string
  tamano_bytes: number
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const R2_BUCKET = Deno.env.get('R2_PROFILE_AVATARS_BUCKET') || Deno.env.get('R2_BUCKET_NAME') || 'profile-avatars'
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validar JWT del usuario autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header requerido')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Token inválido o expirado')
    }

    // 2. Parsear body
    const body = (await req.json()) as UploadRequest
    const { nombre_archivo, mime_type, tamano_bytes } = body

    // 3. Validaciones
    if (!nombre_archivo || !mime_type || !tamano_bytes) {
      throw new Error('Parámetros requeridos: nombre_archivo, mime_type, tamano_bytes')
    }

    if (tamano_bytes > MAX_FILE_SIZE) {
      throw new Error(`Tamaño máximo excedido: ${tamano_bytes} bytes (máx ${MAX_FILE_SIZE})`)
    }

    if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
      throw new Error(`MIME type no permitido: ${mime_type}. Permitidos: ${ALLOWED_MIME_TYPES.join(', ')}`)
    }

    // 4. Generar object key único
    const ext = nombre_archivo.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const objectKey = `${user.id}/${timestamp}.${ext}`

    // 5. Configurar cliente S3 para R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    })

    // 6. Generar URL firmada (PUT) con expiración 15 minutos
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      ContentType: mime_type,
      ContentLength: tamano_bytes,
    })

    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 900 })

    // 7. Retornar respuesta
    return new Response(
      JSON.stringify({
        upload_url: uploadUrl,
        r2_object_key: objectKey,
        expires_in: 900,
        upload_headers: {
          'Content-Type': mime_type,
          'Content-Length': String(tamano_bytes),
        },
        // URL pública para acceder a la foto una vez subida
        public_url: `https://pub-${R2_ACCOUNT_ID}.r2.dev/${objectKey}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('r2-profile-upload-url error:', message)

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
