import { NextRequest, NextResponse } from 'next/server'
import { getAllTitulosSunarp, updateTituloSunarp, addHistorialSunarp } from '@/lib/db'
import { consultarTituloSUNARP } from '@/lib/sunarp-scraper'
import { enviarAlertaEmail, enviarAlertaWhatsApp } from '@/lib/alertas-sunarp'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — Vercel Pro allows up to 300s

function isCronAuthorized(request: NextRequest, cronSecret: string): boolean {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.replace(/^Bearer\s+/i, '')?.trim()
  if (bearer === cronSecret) return true
  const q = request.nextUrl.searchParams.get('secret')?.trim()
  if (q === cronSecret) return true
  const xh = request.headers.get('x-cron-secret')?.trim()
  if (xh === cronSecret) return true
  return false
}

export async function GET(request: NextRequest) {
  // Auth: Bearer CRON_SECRET (Vercel injects when CRON_SECRET is set), or ?secret=, or x-cron-secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const ok = isCronAuthorized(request, cronSecret)
    if (!ok) {
      console.warn('[CronSUNARP] 401 — use Authorization: Bearer, ?secret=, or x-cron-secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const titulos = getAllTitulosSunarp()
  console.log(`[CronSUNARP] Procesando ${titulos.length} títulos`)

  const results: { id: number; estado: string; changed: boolean; error?: string }[] = []

  // Sequential — do NOT process in parallel to avoid flooding SUNARP
  for (const titulo of titulos) {
    try {
      console.log(`[CronSUNARP] Consultando título ${titulo.id}: ${titulo.numero_titulo}/${titulo.anio_titulo}`)

      const result = await consultarTituloSUNARP(
        titulo.oficina_registral,
        titulo.anio_titulo,
        titulo.numero_titulo,
      )

      // Always update ultima_consulta
      const update: Parameters<typeof updateTituloSunarp>[1] = {
        ultima_consulta: new Date().toISOString(),
      }

      if (result.portalDown) {
        console.warn(`[CronSUNARP] Portal caído para título ${titulo.id}`)
        updateTituloSunarp(titulo.id, update)
        results.push({ id: titulo.id, estado: titulo.ultimo_estado, changed: false })
        continue
      }

      const changed = result.estado !== titulo.ultimo_estado && result.estado !== 'SIN DATOS'

      update.ultimo_estado = result.estado
      if (result.areaRegistral) update.area_registral = result.areaRegistral
      if (result.numeroPartida) update.numero_partida = result.numeroPartida
      updateTituloSunarp(titulo.id, update)

      if (changed) {
        console.log(`[CronSUNARP] Cambio detectado: ${titulo.ultimo_estado} → ${result.estado}`)
        addHistorialSunarp(titulo.id, titulo.ultimo_estado, result.estado)

        const alertaParams = {
          nombreCliente: titulo.nombre_cliente,
          estado: result.estado,
          estadoAnterior: titulo.ultimo_estado,
          numeroTitulo: titulo.numero_titulo,
          anioTitulo: titulo.anio_titulo,
          oficinaNombre: titulo.oficina_nombre || titulo.oficina_registral,
          detalle: result.detalle || undefined,
          tituloId: titulo.id,
        }

        // Send notifications in parallel, don't fail cron if one errors
        await Promise.allSettled([
          titulo.whatsapp_cliente
            ? enviarAlertaWhatsApp(titulo.whatsapp_cliente, alertaParams)
            : Promise.resolve(false),
          titulo.email_cliente
            ? enviarAlertaEmail(titulo.email_cliente, alertaParams)
            : Promise.resolve(false),
        ])
      }

      results.push({ id: titulo.id, estado: result.estado, changed })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[CronSUNARP] Error en título ${titulo.id}:`, msg)
      results.push({ id: titulo.id, estado: titulo.ultimo_estado, changed: false, error: msg })
    }

    // Rate-limit: 2s between titles
    await new Promise(r => setTimeout(r, 2000))
  }

  const changed = results.filter(r => r.changed).length
  console.log(`[CronSUNARP] Completado: ${changed}/${results.length} con cambios`)

  return NextResponse.json({
    ok: true,
    total: results.length,
    changed,
    results,
    timestamp: new Date().toISOString(),
  })
}
