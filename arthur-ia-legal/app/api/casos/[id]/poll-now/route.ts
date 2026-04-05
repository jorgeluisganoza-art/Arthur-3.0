import { NextResponse } from 'next/server'
import { scrapeCEJ } from '@/lib/cej-scraper'
import { clasificarMovimientoCEJ } from '@/lib/ai-service'
import { sendJudicialEmail, sendJudicialWhatsApp } from '@/lib/notifications'
import {
  getCasoById,
  addMovimientoJudicial,
  getMovimientosByCaso,
  updateCaso,
  logNotificacionJudicial
} from '@/lib/db'

const ACTOS_URGENTES = [
  'SENTENCIA', 'AUTO', 'RESOLUCIÓN', 'ADMISORIO',
  'EMPLAZAMIENTO', 'REQUERIMIENTO', 'APERCIBIMIENTO', 'NOTIFICACIÓN'
]

function getTipoEscrito(actoUpper: string): string {
  if (actoUpper.includes('SENTENCIA')) return 'apelacion'
  if (actoUpper.includes('ADMISORIO') || actoUpper.includes('EMPLAZAMIENTO')) return 'contestacion'
  if (actoUpper.includes('REQUERIMIENTO') || actoUpper.includes('APERCIBIMIENTO')) return 'impulso'
  return 'generico'
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = parseInt(id, 10)

    const caso = getCasoById(casoId)
    if (!caso || caso.activo === 0) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    console.log('[poll-now] Scraping CEJ for:', caso.numero_expediente)
    const result = await scrapeCEJ(caso.numero_expediente)

    // Always update last_checked
    updateCaso(casoId, { last_checked: new Date().toISOString() })

    if (result.portalDown) {
      return NextResponse.json({
        changed: false,
        portalDown: true,
        captchaDetected: result.captchaDetected,
        message: result.error || 'Portal CEJ no disponible',
        lastKnownData: {
          ultimoMovimiento: caso.ultimo_movimiento,
          ultimoMovimientoFecha: caso.ultimo_movimiento_fecha
        }
      })
    }

    // Update case header data from scrape
    if (result.organoJurisdiccional || result.juez || result.etapa) {
      updateCaso(casoId, {
        organo_jurisdiccional: result.organoJurisdiccional || caso.organo_jurisdiccional || null,
        juez: result.juez || caso.juez || null,
        etapa_procesal: result.etapa || caso.etapa_procesal || null,
      })
    }

    // Detect changes by hash
    const hasChanged = !!(result.hash && result.hash !== caso.estado_hash)

    let newActuaciones: typeof result.actuaciones = []
    let urgenciaMaxima: 'alta' | 'normal' | 'info' = 'info'
    let sugerenciaPrincipal = ''
    let requiereEscrito = false
    let tipoEscritoSugerido = 'generico'

    if (result.actuaciones.length > 0) {
      // Find genuinely new actuaciones
      const existing = getMovimientosByCaso(casoId)
      const existingKeys = new Set(existing.map(m => `${m.fecha || ''}|${m.acto || ''}`))

      newActuaciones = result.actuaciones.filter(
        a => !existingKeys.has(`${a.fecha}|${a.acto}`)
      )

      console.log(`[poll-now] ${newActuaciones.length} new actuaciones`)

      for (const actuacion of newActuaciones) {
        const cls = await clasificarMovimientoCEJ(
          actuacion.acto,
          actuacion.sumilla,
          caso.numero_expediente
        ).catch(() => ({ urgencia: 'info' as const, sugerencia: '' }))

        addMovimientoJudicial(casoId, {
          numero: actuacion.numero,
          fecha: actuacion.fecha,
          acto: actuacion.acto,
          folio: actuacion.folio,
          sumilla: actuacion.sumilla,
          tiene_documento: actuacion.tieneDocumento,
          documento_url: actuacion.documentoUrl,
          tiene_resolucion: actuacion.tieneResolucion,
          es_nuevo: true,
          urgencia: cls.urgencia,
          ai_sugerencia: cls.sugerencia,
        })

        if (cls.urgencia === 'alta') {
          urgenciaMaxima = 'alta'
          sugerenciaPrincipal = cls.sugerencia
        } else if (cls.urgencia === 'normal' && urgenciaMaxima === 'info') {
          urgenciaMaxima = 'normal'
          sugerenciaPrincipal = cls.sugerencia
        }
      }

      // Determine if escrito is needed based on latest actuacion
      const ultimoActo = (result.actuaciones[0]?.acto || '').toUpperCase()
      requiereEscrito = ACTOS_URGENTES.some(a => ultimoActo.includes(a))
      if (requiereEscrito) tipoEscritoSugerido = getTipoEscrito(ultimoActo)

      // Update caso with latest scraped data
      const ultima = result.actuaciones[0]
      updateCaso(casoId, {
        ultimo_movimiento: ultima ? `${ultima.acto}: ${ultima.sumilla}`.slice(0, 200) : (caso.ultimo_movimiento ?? undefined),
        ultimo_movimiento_fecha: ultima?.fecha || (caso.ultimo_movimiento_fecha ?? undefined),
        estado_hash: result.hash || undefined,
        etapa_procesal: result.etapa || (caso.etapa_procesal ?? undefined),
        last_checked: result.scrapedAt,
      })

      // Send alerts for alta urgencia
      if (urgenciaMaxima === 'alta') {
        const altaAct = newActuaciones.find(
          (_, i) => i === newActuaciones.findIndex(a => {
            const u = (a.acto || '').toUpperCase()
            return ACTOS_URGENTES.some(k => u.includes(k))
          })
        ) || newActuaciones[0]

        if (caso.whatsapp_number && altaAct) {
          const ok = await sendJudicialWhatsApp(
            caso.whatsapp_number,
            caso.alias || caso.cliente || `Caso ${caso.id}`,
            altaAct.acto,
            'alta',
            sugerenciaPrincipal,
            caso.id
          )
          logNotificacionJudicial(caso.id, 'whatsapp', altaAct.sumilla || altaAct.acto, 'alta', sugerenciaPrincipal, ok)
        }
        if (caso.email && altaAct) {
          const ok = await sendJudicialEmail(
            caso.email,
            caso.alias || caso.cliente || `Caso ${caso.id}`,
            altaAct.acto,
            altaAct.sumilla,
            'alta',
            sugerenciaPrincipal,
            caso.id
          )
          logNotificacionJudicial(caso.id, 'email', altaAct.sumilla || altaAct.acto, 'alta', sugerenciaPrincipal, ok)
        }
      }
    }

    return NextResponse.json({
      changed: hasChanged,
      newActuaciones: newActuaciones.length,
      totalActuaciones: result.totalActuaciones,
      ultimaActuacion: result.actuaciones[0] || null,
      urgencia: urgenciaMaxima,
      sugerencia: sugerenciaPrincipal,
      requiereEscrito,
      tipoEscritoSugerido,
      portalDown: false,
      captchaDetected: result.captchaDetected,
      captchaSolved: result.captchaSolved,
      caseData: {
        organoJurisdiccional: result.organoJurisdiccional,
        juez: result.juez,
        etapa: result.etapa,
        partes: result.partes
      },
      message: newActuaciones.length > 0
        ? `${newActuaciones.length} movimientos nuevos detectados`
        : 'Sin cambios desde la última revisión'
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[poll-now] Error:', msg)
    return NextResponse.json({ error: msg, portalDown: true }, { status: 500 })
  }
}
