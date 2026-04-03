import { NextRequest, NextResponse } from 'next/server'
import {
  getTitulosSiguelo,
  actualizarEstadoTituloSiguelo,
  registrarCambioEstadoSiguelo,
  getUltimoEstadoSiguelo,
} from '@/lib/siguelo-db'
import { consultarTitulo } from '@/lib/siguelo-scraper'
import { enviarAlertaEmail, enviarAlertaWhatsApp } from '@/lib/siguelo-alertas'
import type { CronResumen, CronDetalleTitulo } from '@/types/siguelo'

/**
 * GET /api/siguelo/consultar
 *
 * Consulta el estado actual de todos los títulos en SUNARP de forma secuencial.
 * Protegido con CRON_SECRET — solo Vercel Cron (o llamadas autorizadas) pueden ejecutarlo.
 *
 * Cabecera requerida: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // ── Validar secret ───────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const titulos = getTitulosSiguelo()

  if (titulos.length === 0) {
    return NextResponse.json({ message: 'Sin títulos para consultar.', total: 0 })
  }

  const resumen: CronResumen = {
    total: titulos.length,
    exitosos: 0,
    conCambios: 0,
    errores: 0,
    detalle: [],
  }

  // ── Consultar cada título de forma secuencial ────────────────────────────
  // Secuencial (no paralelo) para no saturar la API de SUNARP ni 2captcha
  for (const titulo of titulos) {
    const item: CronDetalleTitulo = {
      id: titulo.id,
      numero_titulo: titulo.numero_titulo,
      oficina_registral: titulo.oficina_registral,
    }

    try {
      const resultado = await consultarTitulo({
        oficina_registral: titulo.oficina_registral,
        anio_titulo: titulo.anio_titulo,
        numero_titulo: titulo.numero_titulo,
      })

      item.estado = resultado.estado
      resumen.exitosos++

      // ── Comparar con estado anterior ──────────────────────────────────────
      const estadoAnterior = getUltimoEstadoSiguelo(titulo.id)
      const hayCambio = estadoAnterior !== null && estadoAnterior !== resultado.estado

      if (hayCambio) {
        const detectadoEn = new Date().toISOString()

        // 1. Registrar en historial
        registrarCambioEstadoSiguelo({
          titulo_id: titulo.id,
          estado_anterior: estadoAnterior!,
          estado_nuevo: resultado.estado,
        })

        // 2. Enviar alertas (email + WhatsApp en paralelo, sin bloquear si una falla)
        const datosAlerta = {
          titulo,
          estadoAnterior: estadoAnterior!,
          estadoNuevo: resultado.estado,
          detectadoEn,
        }

        const [emailResult, waResult] = await Promise.allSettled([
          enviarAlertaEmail(datosAlerta),
          enviarAlertaWhatsApp(datosAlerta),
        ])

        if (emailResult.status === 'rejected') {
          console.error(`[siguelo/consultar] Email falló para ${titulo.numero_titulo}:`, emailResult.reason)
        }
        if (waResult.status === 'rejected') {
          console.error(`[siguelo/consultar] WhatsApp falló para ${titulo.numero_titulo}:`, waResult.reason)
        }

        resumen.conCambios++
        item.cambio = true
      }

      // Siempre actualizar estado y timestamp de última consulta
      actualizarEstadoTituloSiguelo(
        titulo.id,
        resultado.estado,
        resultado.areaRegistral,
        resultado.numeroPartida ?? undefined,
      )
    } catch (err) {
      item.error = err instanceof Error ? err.message : 'Error desconocido'
      resumen.errores++
      console.error(`[siguelo/consultar] Error en ${titulo.numero_titulo}:`, item.error)
    }

    resumen.detalle.push(item)
  }

  return NextResponse.json(resumen)
}
