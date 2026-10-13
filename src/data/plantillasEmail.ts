/**
 * Plantillas oficiales de correo electrónico DentikOS
 * Diseño responsive en tablas compatibles con clientes de email (Outlook, Gmail, Apple Mail).
 */

export interface EmailInvitacionParams {
  emailDestinatario: string
  nombreInvitado: string
  nombreInvitador: string
  rol: string
  clinicaNombre: string
  sedesAsignadas: string[]
  permisos: string[]
  tokenInvitacion?: string
  enlaceAceptar?: string
}

export interface EmailVerificacionParams {
  emailDestinatario: string
  nombreUsuario: string
  enlaceVerificacion?: string
}

export const generarHtmlEmailInvitacion = (params: EmailInvitacionParams): string => {
  const {
    nombreInvitado,
    nombreInvitador,
    rol,
    clinicaNombre,
    sedesAsignadas = [],
    permisos = [],
    enlaceAceptar = '#',
  } = params

  const sedesTexto = sedesAsignadas.length > 0 ? sedesAsignadas.join(', ') : 'Sede Principal'
  const listaPermisos = permisos.map((p) => `<li>${p}</li>`).join('')

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Invitación a DentikOS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #070B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #E2E8F0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070B14; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B132B; border: 1px solid #24334A; border-radius: 20px; overflow: hidden; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px; background: linear-gradient(180deg, #0f1c3f 0%, #0B132B 100%);">
              <h2 style="margin: 0; color: #D4AF37; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">DENTIK<span style="color: #FFFFFF;">OS</span></h2>
              <p style="margin: 5px 0 0; color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Odontología de Precisión</p>
            </td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <h1 style="margin: 0 0 15px; color: #FFFFFF; font-size: 20px; font-weight: 700;">¡Hola, ${nombreInvitado}!</h1>
              <p style="margin: 0 0 20px; line-height: 1.6; color: #CBD5E1; font-size: 14px;">
                <strong style="color: #FFFFFF;">${nombreInvitador}</strong> te ha invitado a unirte al equipo de <strong style="color: #D4AF37;">${clinicaNombre}</strong> en DentikOS con el rol de <strong style="color: #FFFFFF; text-transform: capitalize;">${rol}</strong>.
              </p>

              <!-- Tarjeta de Acceso -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080E1E; border: 1px solid #1E293B; border-radius: 14px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #D4AF37; text-transform: uppercase;">Detalles de tu asignación:</p>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #E2E8F0;"><strong>Sedes:</strong> ${sedesTexto}</p>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #E2E8F0;"><strong>Rol asignado:</strong> ${rol}</p>
                    ${permisos.length > 0 ? `
                    <p style="margin: 12px 0 6px; font-size: 12px; font-weight: 600; color: #94A3B8;">Funcionalidades incluidas:</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #CBD5E1; line-height: 1.6;">
                      ${listaPermisos}
                    </ul>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Botón CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0 20px;">
                <tr>
                  <td align="center">
                    <a href="${enlaceAceptar}" target="_blank" style="background: linear-gradient(135deg, #E5C378 0%, #D4AF37 100%); color: #000000; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
                      Aceptar Invitación y Unirse
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 25px 0 0; font-size: 11px; color: #64748B; text-align: center; line-height: 1.5;">
                ⏰ Este enlace es seguro y expirará en <strong>7 días</strong>.<br>
                Si no esperabas esta invitación o consideras que es un error, puedes ignorar este mensaje o <a href="#reportar-spam" style="color: #94A3B8;">reportarlo aquí</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #050811; border-top: 1px solid #1E293B; text-align: center; font-size: 10px; color: #475569;">
              <p style="margin: 0 0 6px;">DentikOS · Sistema Operativo para la Odontología de Precisión</p>
              <p style="margin: 0;">Cumplimiento estricto de la Ley 19.628 de Protección de Datos en Salud.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export const generarHtmlEmailVerificacion = (params: EmailVerificacionParams): string => {
  const { nombreUsuario, enlaceVerificacion = '#' } = params

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Verifica tu correo en DentikOS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #070B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #E2E8F0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070B14; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="560" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B132B; border: 1px solid #24334A; border-radius: 20px; overflow: hidden; max-width: 560px;">
          <tr>
            <td align="center" style="padding: 35px 30px 15px; background: linear-gradient(180deg, #0f1c3f 0%, #0B132B 100%);">
              <h2 style="margin: 0; color: #D4AF37; font-size: 22px; font-weight: 800;">DENTIK<span style="color: #FFFFFF;">OS</span></h2>
              <p style="margin: 4px 0 0; color: #94A3B8; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Verificación de Cuenta</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 35px 30px; text-align: center;">
              <h1 style="margin: 0 0 12px; color: #FFFFFF; font-size: 18px; font-weight: 700;">¡Bienvenido, ${nombreUsuario}!</h1>
              <p style="margin: 0 0 25px; line-height: 1.6; color: #CBD5E1; font-size: 13px;">
                Para activar todas las facultades clínicas y administrativas de tu cuenta en DentikOS, por favor confirma tu dirección de correo electrónico.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="${enlaceVerificacion}" target="_blank" style="background: linear-gradient(135deg, #E5C378 0%, #D4AF37 100%); color: #000000; text-decoration: none; font-size: 13px; font-weight: 700; padding: 13px 32px; border-radius: 12px; display: inline-block;">
                      Verificar mi Correo Electrónico
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 11px; color: #64748B;">
                Este enlace expira en <strong>24 horas</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 30px; background-color: #050811; border-top: 1px solid #1E293B; text-align: center; font-size: 10px; color: #475569;">
              © 2026 DentikOS · Soberanía digital para profesionales de la salud
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
