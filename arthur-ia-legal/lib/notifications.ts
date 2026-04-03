import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { getAppBaseUrl } from '@/lib/app-url';

function getStatusEmoji(estado: string): string {
  if (estado === 'OBSERVADO' || estado === 'TACHA') return '🔴';
  if (estado === 'PENDIENTE') return '🟡';
  if (estado === 'INSCRITO') return '✅';
  return '⚪';
}

export async function sendWhatsApp(
  to: string,
  alias: string,
  estado: string,
  message: string,
  suggestion: string,
  tramiteId: number
): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      console.warn('[Notifications] Twilio credentials not configured');
      return false;
    }

    const client = twilio(accountSid, authToken);
    const emoji = getStatusEmoji(estado);

    const body = `${emoji} *ARTHUR-IA LEGAL*

*Trámite:* ${alias}
*Estado:* ${estado}

${message}

💡 *Qué hacer:* ${suggestion}

${getAppBaseUrl()}/dashboard/tramites/${tramiteId}`;

    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    await client.messages.create({
      from,
      to: toNumber,
      body,
    });

    console.log(`[Notifications] WhatsApp sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Notifications] WhatsApp error:', error);
    return false;
  }
}

function getStatusColor(estado: string): string {
  const colors: Record<string, string> = {
    OBSERVADO: '#c0392b',
    TACHA: '#922b21',
    PENDIENTE: '#b8860b',
    INSCRITO: '#1e8449',
    'SIN DATOS': '#6b6560',
  };
  return colors[estado] || '#6b6560';
}

function getStatusBgColor(estado: string): string {
  const colors: Record<string, string> = {
    OBSERVADO: 'rgba(192, 57, 43, 0.12)',
    TACHA: 'rgba(192, 57, 43, 0.2)',
    PENDIENTE: 'rgba(184, 134, 11, 0.1)',
    INSCRITO: 'rgba(39, 174, 96, 0.1)',
    'SIN DATOS': 'rgba(107, 101, 96, 0.1)',
  };
  return colors[estado] || 'rgba(107, 101, 96, 0.1)';
}

export async function sendEmail(
  to: string,
  alias: string,
  estado: string,
  message: string,
  suggestion: string,
  observacion: string | null,
  tramiteId: number
): Promise<boolean> {
  try {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      console.warn('[Notifications] Email credentials not configured');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const statusColor = getStatusColor(estado);
    const statusBg = getStatusBgColor(estado);
    const emoji = getStatusEmoji(estado);
    const base = getAppBaseUrl();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arthur-IA Legal — ${alias}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
    <tr>
      <td>
        <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:white;border:1px solid rgba(15,15,15,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a3a5c;padding:28px 32px;">
              <div style="font-family:Georgia,serif;font-size:24px;color:white;font-style:italic;">Arthur-IA</div>
              <div style="font-family:'Courier New',monospace;font-size:10px;color:rgba(245,240,232,0.5);text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">Legal · SUNARP</div>
            </td>
          </tr>
          <!-- Status row -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#6b6560;margin-bottom:8px;">ACTUALIZACIÓN DE TRÁMITE</div>
              <div style="font-size:20px;font-weight:600;color:#0f0f0f;margin-bottom:16px;">${alias}</div>
              <span style="display:inline-block;font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;padding:6px 12px;background:${statusBg};color:${statusColor};border:1px solid ${statusColor};border-radius:2px;">${emoji} ${estado}</span>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="color:#444;font-size:14px;line-height:1.7;margin:0;">${message}</p>
            </td>
          </tr>
          ${suggestion ? `
          <!-- AI Suggestion -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="border-left:4px solid #27ae60;background:rgba(39,174,96,0.06);padding:20px 24px;">
                <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#1e8449;margin-bottom:8px;">💡 QUÉ HACER AHORA</div>
                <p style="color:#0f0f0f;font-size:14px;line-height:1.7;margin:0;">${suggestion}</p>
              </div>
            </td>
          </tr>` : ''}
          ${observacion ? `
          <!-- Observation -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="border-left:4px solid #b8860b;background:rgba(184,134,11,0.04);padding:20px 24px;">
                <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#b8860b;margin-bottom:8px;">ESQUELA DE OBSERVACIÓN</div>
                <p style="color:#0f0f0f;font-size:13px;line-height:1.7;margin:0;">${observacion}</p>
              </div>
            </td>
          </tr>` : ''}
          <!-- CTA -->
          <tr>
            <td style="padding:32px;text-align:center;">
              <a href="${base}/dashboard/tramites/${tramiteId}" style="display:inline-block;background:#0f0f0f;color:#f5f0e8;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;padding:14px 28px;text-decoration:none;border-radius:0;">Ver detalle completo →</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f0e8;padding:20px 32px;border-top:1px solid rgba(15,15,15,0.08);">
              <p style="font-family:'Courier New',monospace;font-size:10px;color:#6b6560;margin:0;text-align:center;">Arthur-IA Legal · Sistema automatizado de seguimiento SUNARP</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Arthur-IA Legal" <${user}>`,
      to,
      subject: `${emoji} ${alias} — ${estado} | Arthur-IA Legal`,
      html,
      text: `${alias}\nEstado: ${estado}\n\n${message}\n\nQué hacer: ${suggestion}`,
    });

    console.log(`[Notifications] Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[Notifications] Email error:', error);
    return false;
  }
}

export async function sendJudicialWhatsApp(
  to: string,
  alias: string,
  acto: string,
  urgencia: string,
  sugerencia: string,
  casoId: number
): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      console.warn('[Notifications] Twilio credentials not configured');
      return false;
    }

    const client = twilio(accountSid, authToken);
    const emoji = urgencia === 'alta' ? '🔴' : '🟡';
    const urgenciaMsg = urgencia === 'alta'
      ? 'Atención inmediata: este movimiento requiere acción prioritaria.'
      : 'Movimiento detectado para revisión.'

    const body = `${emoji} *ARTHUR-IA JUDICIAL*

*Proceso:* ${alias}
*Movimiento:* ${acto}

${urgenciaMsg}

💡 *Qué hacer:* ${sugerencia}

${getAppBaseUrl()}/judicial/${casoId}`;

    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await client.messages.create({ from, to: toNumber, body });
    return true;
  } catch (error) {
    console.error('[Notifications] Judicial WhatsApp error:', error);
    return false;
  }
}

export async function sendJudicialEmail(
  to: string,
  alias: string,
  acto: string,
  sumilla: string,
  urgencia: string,
  sugerencia: string,
  casoId: number
): Promise<boolean> {
  try {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      console.warn('[Notifications] Email credentials not configured');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const isAlta = urgencia === 'alta';
    const color = isAlta ? '#991b1b' : '#b8860b';
    const bg = isAlta ? 'rgba(153,27,27,0.08)' : 'rgba(184,134,11,0.08)';
    const emoji = isAlta ? '🔴' : '🟡';
    const base = getAppBaseUrl();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arthur-IA Judicial — ${alias}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:white;border:1px solid rgba(15,15,15,0.08);">
        <tr>
          <td style="background:#1a3a5c;padding:28px 32px;">
            <div style="font-family:Georgia,serif;font-size:24px;color:white;font-style:italic;">Arthur-IA</div>
            <div style="font-family:'Courier New',monospace;font-size:10px;color:rgba(245,240,232,0.5);text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">Poder Judicial · CEJ</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#6b6560;margin-bottom:8px;">ACTUALIZACIÓN JUDICIAL</div>
            <div style="font-size:20px;font-weight:600;color:#0f0f0f;margin-bottom:12px;">${alias}</div>
            <span style="display:inline-block;padding:6px 12px;background:${bg};color:${color};border:1px solid ${color};font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;">${emoji} ${urgencia.toUpperCase()}</span>
          </td>
        </tr>
        <tr><td style="padding:20px 32px 0;"><p style="margin:0;color:#0f0f0f;font-size:15px;line-height:1.7;"><strong>Movimiento:</strong> ${acto}</p></td></tr>
        <tr><td style="padding:12px 32px 0;"><p style="margin:0;color:#444;font-size:14px;line-height:1.7;">${sumilla || 'Sin sumilla disponible.'}</p></td></tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="border-left:4px solid #1e8449;background:rgba(39,174,96,0.06);padding:16px 20px;">
              <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#1e8449;margin-bottom:6px;">💡 QUÉ HACER AHORA</div>
              <p style="margin:0;color:#0f0f0f;font-size:14px;line-height:1.7;">${sugerencia}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;text-align:center;">
            <a href="${base}/judicial/${casoId}" style="display:inline-block;background:#0f0f0f;color:#f5f0e8;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;padding:14px 28px;text-decoration:none;">Ver detalle completo →</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Arthur-IA Judicial" <${user}>`,
      to,
      subject: `${emoji} ${alias} — ${acto} | Arthur-IA Judicial`,
      html,
      text: `Proceso: ${alias}\nMovimiento: ${acto}\nUrgencia: ${urgencia}\n\n${sumilla}\n\nQué hacer: ${sugerencia}`
    });

    return true;
  } catch (error) {
    console.error('[Notifications] Judicial Email error:', error);
    return false;
  }
}
