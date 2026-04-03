/**
 * siguelo-alertas.ts
 *
 * Equivalente de arthur-siguelo/lib/alertas.ts usando Nodemailer en lugar de Resend.
 * - Email: Nodemailer (EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS)
 * - WhatsApp: Twilio (igual que en siguelo original)
 * - Excel adjunto: Buffer directo (Nodemailer lo acepta nativamente)
 * - czavala19365@gmail.com siempre incluido como destinatario en todos los emails
 */

import nodemailer from 'nodemailer'
import twilio from 'twilio'
import type { Titulo } from '@/types/siguelo'
import { getTitulosSiguelo } from '@/lib/siguelo-db'
import { generarExcelTitulos } from '@/lib/siguelo-excel'

// ── Email admin fijo — siempre recibe copia ───────────────────────────────────
const ADMIN_EMAIL = 'czavala19365@gmail.com'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type DatosAlerta = {
  titulo: Titulo
  estadoAnterior: string
  estadoNuevo: string
  detectadoEn: string
  detalle?: string
}

export type DatosConfirmacion = {
  titulo: Titulo
  estado: string
  detalle?: string
  registradoEn: string
}

// ── Transporter Nodemailer ────────────────────────────────────────────────────

function crearTransporter() {
  const host = process.env.EMAIL_HOST
  const port = parseInt(process.env.EMAIL_PORT || '587')
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!host || !user || !pass) {
    throw new Error('Credenciales de email no configuradas (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

// ── Excel adjunto ─────────────────────────────────────────────────────────────

async function generarAdjuntoExcel(): Promise<nodemailer.SendMailOptions['attachments']> {
  try {
    const todos = getTitulosSiguelo()
    const buffer = generarExcelTitulos(todos)
    console.log('[siguelo-alertas] Excel generado OK — tamaño:', buffer.length, 'bytes')
    return [{ filename: 'titulos-arthur-siguelo.xlsx', content: buffer }]
  } catch (err) {
    console.error('[siguelo-alertas] Error al generar Excel:', err instanceof Error ? err.message : err)
    return []
  }
}

// ── Destinatarios ─────────────────────────────────────────────────────────────

function resolverDestinatarios(emailCliente: string): string[] {
  const clientes = emailCliente
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  // Agregar admin solo si no está ya en la lista
  if (!clientes.includes(ADMIN_EMAIL)) {
    clientes.push(ADMIN_EMAIL)
  }
  return clientes
}

// ── HTML: alerta de cambio de estado ─────────────────────────────────────────

function htmlAlerta({ titulo, estadoAnterior, estadoNuevo, detectadoEn, detalle }: DatosAlerta): string {
  const fecha = new Date(detectadoEn).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">

        <!-- Cabecera -->
        <tr>
          <td style="background:#1d4ed8;padding:24px 32px">
            <p style="margin:0;color:#bfdbfe;font-size:12px;text-transform:uppercase;letter-spacing:1px">Arthur Síguelo</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700">
              Cambio de estado detectado
            </h1>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:28px 32px 0">
            <p style="margin:0;color:#374151;font-size:15px">
              Hola <strong>${titulo.nombre_cliente}</strong>, detectamos un cambio en el estado de tu título registral.
            </p>
          </td>
        </tr>

        <!-- Datos del título -->
        <tr>
          <td style="padding:20px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Oficina registral</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${titulo.oficina_registral}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px${detalle ? ';border-bottom:1px solid #e2e8f0' : ''}">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Número de título</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${titulo.anio_titulo} — ${titulo.numero_titulo}</p>
                </td>
              </tr>
              ${detalle ? `<tr>
                <td style="padding:16px 20px">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Acto registral</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${detalle}</p>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- Cambio de estado -->
        <tr>
          <td style="padding:0 32px 28px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px">
                  <p style="margin:0;font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:.5px">Estado anterior</p>
                  <p style="margin:6px 0 0;font-size:15px;color:#7f1d1d;font-weight:700">${estadoAnterior}</p>
                </td>
                <td width="4%" align="center" style="color:#9ca3af;font-size:20px">→</td>
                <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px">
                  <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:.5px">Estado nuevo</p>
                  <p style="margin:6px 0 0;font-size:15px;color:#14532d;font-weight:700">${estadoNuevo}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e4e4e7;padding:16px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              Detectado el ${fecha} · Arthur Síguelo — Monitor de títulos registrales SUNARP
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── HTML: confirmación al agregar título ──────────────────────────────────────

function htmlConfirmacion({ titulo, estado, detalle, registradoEn }: DatosConfirmacion): string {
  const fecha = new Date(registradoEn).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
    'PRESENTADO':      { bg: '#CCFBF1', text: '#0D9488' },
    'REINGRESADO':     { bg: '#DBEAFE', text: '#2563EB' },
    'APELADO':         { bg: '#FFEDD5', text: '#F97316' },
    'EN PROCESO':      { bg: '#F3F4F6', text: '#6B7280' },
    'EN CALIFICACIÓN': { bg: '#EDE9FE', text: '#7C3AED' },
    'DISTRIBUIDO':     { bg: '#FCE7F3', text: '#EC4899' },
    'LIQUIDADO':       { bg: '#DCFCE7', text: '#15803D' },
    'PRORROGADO':      { bg: '#E0F2FE', text: '#38BDF8' },
    'OBSERVADO':       { bg: '#FEE2E2', text: '#DC2626' },
    'TACHADO':         { bg: '#F1F5F9', text: '#111827' },
    'INSCRITO':        { bg: '#DCFCE7', text: '#166534' },
  }
  const estadoColor = ESTADO_COLORS[estado.toUpperCase()] ?? { bg: '#F3F4F6', text: '#374151' }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">

        <!-- Cabecera -->
        <tr>
          <td style="background:#1d4ed8;padding:24px 32px">
            <p style="margin:0;color:#bfdbfe;font-size:12px;text-transform:uppercase;letter-spacing:1px">Arthur Síguelo</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700">
              Título agregado a seguimiento
            </h1>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:28px 32px 0">
            <p style="margin:0;color:#374151;font-size:15px">
              Hola <strong>${titulo.nombre_cliente}</strong>, tu título registral ha sido agregado exitosamente al sistema de monitoreo.
            </p>
          </td>
        </tr>

        <!-- Datos del título -->
        <tr>
          <td style="padding:20px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Oficina registral</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${titulo.oficina_registral}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Número de título</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${titulo.anio_titulo} — ${titulo.numero_titulo}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Estado actual</p>
                  <p style="margin:4px 0 0">
                    <span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:13px;font-weight:700;background:${estadoColor.bg};color:${estadoColor.text}">
                      ${estado}
                    </span>
                    ${detalle ? `<span style="font-size:13px;color:#6b7280;margin-left:8px">${detalle}</span>` : ''}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Fecha de registro</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">${fecha}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px">
                  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Próxima consulta automática</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600">Mañana a las 8:00 am</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e4e4e7;padding:16px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              Arthur Síguelo — Monitor de títulos registrales SUNARP · Recibirás alertas automáticas ante cualquier cambio de estado.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Funciones públicas ────────────────────────────────────────────────────────

export async function enviarAlertaEmail(datos: DatosAlerta): Promise<void> {
  const transporter = crearTransporter()
  const destinatarios = resolverDestinatarios(datos.titulo.email_cliente)
  const adjuntos = await generarAdjuntoExcel()

  console.log('[siguelo-alertas] enviarAlertaEmail → destinatarios:', destinatarios)

  await transporter.sendMail({
    from: `"Arthur Síguelo" <${process.env.EMAIL_USER}>`,
    to: destinatarios,
    subject: `⚠️ Cambio de estado — Título ${datos.titulo.numero_titulo}`,
    html: htmlAlerta(datos),
    text: `${datos.titulo.nombre_cliente}\nTítulo: ${datos.titulo.anio_titulo}-${datos.titulo.numero_titulo}\n\n${datos.estadoAnterior} → ${datos.estadoNuevo}`,
    attachments: adjuntos,
  })

  console.log('[siguelo-alertas] enviarAlertaEmail OK')
}

export async function enviarConfirmacionAgregado(datos: DatosConfirmacion): Promise<void> {
  const transporter = crearTransporter()
  const destinatarios = resolverDestinatarios(datos.titulo.email_cliente)
  const adjuntos = await generarAdjuntoExcel()

  console.log('[siguelo-alertas] enviarConfirmacionAgregado → destinatarios:', destinatarios)

  await transporter.sendMail({
    from: `"Arthur Síguelo" <${process.env.EMAIL_USER}>`,
    to: destinatarios,
    subject: `Título ${datos.titulo.anio_titulo}-${datos.titulo.numero_titulo} agregado a seguimiento - Arthur Legal AI`,
    html: htmlConfirmacion(datos),
    text: `Título ${datos.titulo.anio_titulo}-${datos.titulo.numero_titulo} agregado.\nEstado: ${datos.estado}`,
    attachments: adjuntos,
  })

  console.log('[siguelo-alertas] enviarConfirmacionAgregado OK')
}

export async function enviarAlertaWhatsApp(datos: DatosAlerta): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    throw new Error('Credenciales de Twilio no configuradas.')
  }

  const client = twilio(accountSid, authToken)

  const fecha = new Date(datos.detectadoEn).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const mensaje =
    `📋 *Arthur Síguelo — Cambio de estado*\n\n` +
    `👤 Cliente: ${datos.titulo.nombre_cliente}\n` +
    `🏛️ Oficina: ${datos.titulo.oficina_registral}\n` +
    `📄 Título: ${datos.titulo.anio_titulo} — ${datos.titulo.numero_titulo}\n\n` +
    `🔴 Anterior: *${datos.estadoAnterior}*\n` +
    `🟢 Nuevo: *${datos.estadoNuevo}*\n\n` +
    `🕐 Detectado: ${fecha}`

  const numero = datos.titulo.whatsapp_cliente.replace(/\s/g, '')
  const destino = numero.startsWith('+') ? numero : `+51${numero}`

  await client.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${destino}`,
    body: mensaje,
  })
}
