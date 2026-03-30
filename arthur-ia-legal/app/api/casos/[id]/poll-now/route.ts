import {
  addMovimientoJudicial,
  getCasoById,
  getMovimientosByCaso,
  logNotificacionJudicial,
  updateCaso
} from '@/lib/db'
import { scrapeCEJ } from '@/lib/cej-scraper'
import { clasificarMovimientoCEJ } from '@/lib/ai-service'
import { sendJudicialEmail, sendJudicialWhatsApp } from '@/lib/notifications'

function movementKey(m: { fecha?: string | null; acto?: string | null; folio?: string | null; sumilla?: string | null }) {
  return `${m.fecha || ''}|${m.acto || ''}|${m.folio || ''}|${m.sumilla || ''}`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = Number.parseInt(id, 10)
    const caso = getCasoById(casoId)

    if (!caso) {
      return Response.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const result = await scrapeCEJ(caso.numero_expediente)

    if (result.portalDown) {
      return Response.json({
        changed: false,
        portalDown: true,
        movimientos: [],
        urgencia: 'info',
        sugerencia: 'Portal CEJ no disponible. Se mantiene el último estado conocido.',
        lastChecked: caso.last_checked,
      })
    }

    const changed = result.hash !== (caso.estado_hash || '') && result.hash !== ''
    const existing = getMovimientosByCaso(casoId)
    const existingKeys = new Set(existing.map(m => movementKey(m)))

    const nuevos = result.movimientos.filter(m => !existingKeys.has(movementKey(m)))
    const enriched = []

    for (const mov of nuevos) {
      const cls = await clasificarMovimientoCEJ(
        mov.acto,
        mov.sumilla,
        caso.numero_expediente
      ).catch(() => ({ urgencia: 'info' as const, sugerencia: 'Revisar movimiento en CEJ.' }))

      addMovimientoJudicial(casoId, {
        fecha: mov.fecha,
        acto: mov.acto,
        folio: mov.folio,
        sumilla: mov.sumilla,
        es_nuevo: true,
        urgencia: cls.urgencia,
        ai_sugerencia: cls.sugerencia,
      })

      enriched.push({ ...mov, urgencia: cls.urgencia, sugerencia: cls.sugerencia })
    }

    const last = result.ultimoMovimiento
    updateCaso(casoId, {
      ultimo_movimiento: last?.sumilla || last?.acto || null,
      ultimo_movimiento_fecha: last?.fecha || null,
      etapa_procesal: result.etapaProcesal || null,
      juez: result.juez || null,
      estado_hash: result.hash || null,
      last_checked: result.scrapedAt,
    })

    const alta = enriched.find(m => m.urgencia === 'alta')
    if (alta) {
      const suggestion = alta.sugerencia || 'Revisar inmediatamente este movimiento judicial.'
      if (caso.whatsapp_number) {
        const ok = await sendJudicialWhatsApp(
          caso.whatsapp_number,
          caso.alias || caso.cliente || `Caso ${caso.id}`,
          alta.acto,
          'alta',
          suggestion,
          caso.id
        )
        logNotificacionJudicial(caso.id, 'whatsapp', alta.sumilla || alta.acto, 'alta', suggestion, ok)
      }
      if (caso.email) {
        const ok = await sendJudicialEmail(
          caso.email,
          caso.alias || caso.cliente || `Caso ${caso.id}`,
          alta.acto,
          alta.sumilla,
          'alta',
          suggestion,
          caso.id
        )
        logNotificacionJudicial(caso.id, 'email', alta.sumilla || alta.acto, 'alta', suggestion, ok)
      }
    }

    const first = enriched[0]
    return Response.json({
      changed,
      portalDown: false,
      movimientos: enriched,
      urgencia: first?.urgencia || 'info',
      sugerencia: first?.sugerencia || 'Sin movimientos nuevos.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API] POST /casos/[id]/poll-now error:', msg)
    return Response.json({ error: msg, portalDown: true }, { status: 500 })
  }
}
