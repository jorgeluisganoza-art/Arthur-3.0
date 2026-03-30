import { addMovimientoJudicial, createCaso, getAllCasosActivos, updateCaso } from '@/lib/db'
import { clasificarMovimientoCEJ } from '@/lib/ai-service'
import { scrapeCEJ } from '@/lib/cej-scraper'

export async function GET() {
  try {
    const casos = getAllCasosActivos()
    return Response.json(casos)
  } catch (error) {
    console.error('[API] GET /casos error:', error)
    return Response.json({ error: 'Error al obtener procesos judiciales' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>

    const caso = createCaso({
      numero_expediente: String(body.numero_expediente ?? ''),
      distrito_judicial: String(body.distrito_judicial ?? ''),
      organo_jurisdiccional: body.organo_jurisdiccional ? String(body.organo_jurisdiccional) : null,
      tipo_proceso: body.tipo_proceso ? String(body.tipo_proceso) : null,
      partes: body.partes ? String(body.partes) : null,
      cliente: body.cliente ? String(body.cliente) : null,
      alias: body.alias ? String(body.alias) : null,
      prioridad: (body.prioridad as 'alta' | 'media' | 'baja') || 'baja',
      polling_frequency_hours: Number(body.polling_frequency_hours ?? 4),
      whatsapp_number: body.whatsapp_number ? String(body.whatsapp_number) : null,
      email: body.email ? String(body.email) : null,
      activo: 1,
      estado: 'activo',
    })

    // Primer chequeo CEJ inmediato (no bloquea la creación si falla)
    scrapeCEJ(caso.numero_expediente)
      .then(async (result) => {
        if (result.portalDown) {
          updateCaso(caso.id, { last_checked: result.scrapedAt })
          return
        }

        const first = result.ultimoMovimiento
        updateCaso(caso.id, {
          ultimo_movimiento: first?.sumilla || first?.acto || null,
          ultimo_movimiento_fecha: first?.fecha || null,
          etapa_procesal: result.etapaProcesal || null,
          juez: result.juez || null,
          estado_hash: result.hash || null,
          last_checked: result.scrapedAt,
        })

        for (const mov of result.movimientos.slice(0, 10)) {
          const cls = await clasificarMovimientoCEJ(
            mov.acto,
            mov.sumilla,
            caso.numero_expediente
          ).catch(() => ({ urgencia: 'info' as const, sugerencia: 'Revisar movimiento en CEJ.' }))

          addMovimientoJudicial(caso.id, {
            fecha: mov.fecha,
            acto: mov.acto,
            folio: mov.folio,
            sumilla: mov.sumilla,
            es_nuevo: true,
            urgencia: cls.urgencia,
            ai_sugerencia: cls.sugerencia,
          })
        }
      })
      .catch((err) => console.error('[API] Initial CEJ poll error:', err))

    return Response.json(caso, { status: 201 })
  } catch (error) {
    console.error('[API] POST /casos error:', error)
    return Response.json({ error: 'Error al crear proceso judicial' }, { status: 500 })
  }
}
