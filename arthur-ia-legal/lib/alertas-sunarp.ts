import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { getAppBaseUrl } from '@/lib/app-url';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusEmoji(estado: string): string {
  if (estado === 'INSCRITO') return '✅';
  if (estado === 'OBSERVADO') return '🔴';
  if (estado === 'TACHA') return '🚫';
  if (estado === 'PENDIENTE' || estado === 'EN CALIFICACIÓN') return '🟡';
  if (estado === 'LIQUIDADO') return '🔵';
  return '⚪';
}

function statusColor(estado: string): string {
  const map: Record<string, string> = {
    INSCRITO: '#1e8449',
    OBSERVADO: '#c0392b',
    TACHA: '#922b21',
    PENDIENTE: '#b8860b',
    'EN CALIFICACIÓN': '#b8860b',
    LIQUIDADO: '#1a5276',
    BLOQUEADO: '#6c3483',
  };
  return map[estado] || '#6b6560';
}

function statusBg(estado: string): string {
  const map: Record<string, string> = {
    INSCRITO: 'rgba(39,174,96,0.1)',
    OBSERVADO: 'rgba(192,57,43,0.1)',
    TACHA: 'rgba(192,57,43,0.18)',
    PENDIENTE: 'rgba(184,134,11,0.1)',
    'EN CALIFICACIÓN': 'rgba(184,134,11,0.1)',
    LIQUIDADO: 'rgba(26,82,118,0.1)',
    BLOQUEADO: 'rgba(108,52,131,0.1)',
  };
  return map[estado] || 'rgba(107,101,96,0.1)';
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

export interface AlertaParams {
  nombreCliente: string;
  estado: string;
  estadoAnterior: string;
  numeroTitulo: string;
  anioTitulo: string;
  oficinaNombre: string;
  detalle?: string;
  tituloId: number;
}

export async function enviarAlertaWhatsApp(
  to: string,
  params: AlertaParams,
): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      console.warn('[AlertasSUNARP] Twilio no configurado');
      return false;
    }

    const client = twilio(accountSid, authToken);
    const emoji = statusEmoji(params.estado);

    const body = `${emoji} *ARTHUR-IA LEGAL — SUNARP Síguelo*

*Cliente:* ${params.nombreCliente}
*Título:* ${params.numeroTitulo}/${params.anioTitulo} (${params.oficinaNombre})

*Estado anterior:* ${params.estadoAnterior}
*Estado actual:* ${params.estado}

${params.detalle ? `📋 *Detalle:* ${params.detalle.substring(0, 200)}` : ''}

${getAppBaseUrl()}/dashboard/sunarp`;

    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await client.messages.create({ from, to: toNumber, body });
    console.log(`[AlertasSUNARP] WhatsApp enviado a ${to}`);
    return true;
  } catch (err) {
    console.error('[AlertasSUNARP] WhatsApp error:', err);
    return false;
  }
}

// ── Email — cambio de estado ──────────────────────────────────────────────────

export async function enviarAlertaEmail(
  to: string,
  params: AlertaParams,
): Promise<boolean> {
  try {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      console.warn('[AlertasSUNARP] Email no configurado');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const color = statusColor(params.estado);
    const bg = statusBg(params.estado);
    const emoji = statusEmoji(params.estado);

    const base = getAppBaseUrl();
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arthur-IA — SUNARP Síguelo</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid rgba(15,15,15,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a3a5c;padding:28px 32px;">
            <div style="font-family:Georgia,serif;font-size:24px;color:#fff;font-style:italic;">Arthur-IA</div>
            <div style="font-family:'Courier New',monospace;font-size:10px;color:rgba(245,240,232,0.5);text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">Legal · SUNARP Síguelo</div>
          </td>
        </tr>
        <!-- Status -->
        <tr>
          <td style="padding:32px 32px 0;">
            <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#6b6560;margin-bottom:8px;">CAMBIO DE ESTADO DETECTADO</div>
            <div style="font-size:20px;font-weight:600;color:#0f0f0f;margin-bottom:6px;">${params.nombreCliente}</div>
            <div style="font-family:'Courier New',monospace;font-size:12px;color:#6b6560;margin-bottom:16px;">
              Título ${params.numeroTitulo}/${params.anioTitulo} · ${params.oficinaNombre}
            </div>
            <div style="display:flex;gap:12px;margin-bottom:8px;">
              <span style="font-family:'Courier New',monospace;font-size:10px;padding:5px 10px;background:rgba(107,101,96,0.08);color:#6b6560;border:1px solid rgba(107,101,96,0.2);">
                ANTES: ${params.estadoAnterior}
              </span>
              <span style="font-size:14px;color:#999;line-height:2;">→</span>
              <span style="font-family:'Courier New',monospace;font-size:10px;padding:5px 10px;background:${bg};color:${color};border:1px solid ${color};">
                ${emoji} AHORA: ${params.estado}
              </span>
            </div>
          </td>
        </tr>
        ${params.detalle ? `
        <!-- Detail -->
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="border-left:4px solid ${color};background:${bg};padding:16px 20px;">
              <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:${color};margin-bottom:8px;">DETALLE</div>
              <p style="color:#0f0f0f;font-size:13px;line-height:1.7;margin:0;">${params.detalle}</p>
            </div>
          </td>
        </tr>` : ''}
        <!-- CTA -->
        <tr>
          <td style="padding:32px;text-align:center;">
            <a href="${base}/dashboard/sunarp" style="display:inline-block;background:#0f0f0f;color:#f5f0e8;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;padding:14px 28px;text-decoration:none;">Ver seguimiento →</a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f5f0e8;padding:20px 32px;border-top:1px solid rgba(15,15,15,0.08);">
            <p style="font-family:'Courier New',monospace;font-size:10px;color:#6b6560;margin:0;text-align:center;">Arthur-IA Legal · SUNARP Síguelo Plus — Seguimiento automático de títulos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Arthur-IA Legal" <${user}>`,
      to,
      subject: `${emoji} ${params.nombreCliente} — ${params.estado} | Arthur-IA SUNARP`,
      html,
      text: `${params.nombreCliente}\nTítulo: ${params.numeroTitulo}/${params.anioTitulo}\nEstado anterior: ${params.estadoAnterior}\nEstado actual: ${params.estado}${params.detalle ? `\n\nDetalle: ${params.detalle}` : ''}`,
    });

    console.log(`[AlertasSUNARP] Email enviado a ${to}`);
    return true;
  } catch (err) {
    console.error('[AlertasSUNARP] Email error:', err);
    return false;
  }
}

// ── Email — confirmación de registro ─────────────────────────────────────────

export interface ConfirmacionParams {
  nombreCliente: string;
  numeroTitulo: string;
  anioTitulo: string;
  oficinaNombre: string;
  estadoInicial: string;
  tituloId: number;
}

export async function enviarConfirmacionAgregado(
  to: string,
  params: ConfirmacionParams,
): Promise<boolean> {
  try {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) return false;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const emoji = statusEmoji(params.estadoInicial);
    const color = statusColor(params.estadoInicial);
    const bg = statusBg(params.estadoInicial);
    const base = getAppBaseUrl();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Título registrado — Arthur-IA</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid rgba(15,15,15,0.08);">
        <tr>
          <td style="background:#1a3a5c;padding:28px 32px;">
            <div style="font-family:Georgia,serif;font-size:24px;color:#fff;font-style:italic;">Arthur-IA</div>
            <div style="font-family:'Courier New',monospace;font-size:10px;color:rgba(245,240,232,0.5);text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">Legal · SUNARP Síguelo</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 0;">
            <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#6b6560;margin-bottom:8px;">TÍTULO EN SEGUIMIENTO</div>
            <div style="font-size:20px;font-weight:600;color:#0f0f0f;margin-bottom:6px;">${params.nombreCliente}</div>
            <div style="font-family:'Courier New',monospace;font-size:12px;color:#6b6560;margin-bottom:16px;">
              Título ${params.numeroTitulo}/${params.anioTitulo} · ${params.oficinaNombre}
            </div>
            <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 16px;">
              Su título ha sido registrado correctamente en el sistema de seguimiento automático de Arthur-IA. Recibirá una notificación cada vez que el estado cambie en el portal SUNARP Síguelo Plus.
            </p>
            <div style="margin-top:16px;">
              <span style="font-family:'Courier New',monospace;font-size:10px;padding:6px 12px;background:${bg};color:${color};border:1px solid ${color};">
                ${emoji} Estado actual: ${params.estadoInicial}
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;text-align:center;">
            <a href="${base}/dashboard/sunarp" style="display:inline-block;background:#0f0f0f;color:#f5f0e8;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;padding:14px 28px;text-decoration:none;">Ver seguimiento →</a>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f0e8;padding:20px 32px;border-top:1px solid rgba(15,15,15,0.08);">
            <p style="font-family:'Courier New',monospace;font-size:10px;color:#6b6560;margin:0;text-align:center;">Arthur-IA Legal · SUNARP Síguelo Plus — Seguimiento automático de títulos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Arthur-IA Legal" <${user}>`,
      to,
      subject: `Título ${params.numeroTitulo}/${params.anioTitulo} en seguimiento | Arthur-IA`,
      html,
      text: `Su título ${params.numeroTitulo}/${params.anioTitulo} (${params.oficinaNombre}) ha sido registrado en seguimiento.\nEstado actual: ${params.estadoInicial}`,
    });

    return true;
  } catch (err) {
    console.error('[AlertasSUNARP] Confirmación email error:', err);
    return false;
  }
}
