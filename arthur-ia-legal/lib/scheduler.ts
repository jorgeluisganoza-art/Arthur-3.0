import { getAllTramites, updateTramite, addHistorial, logNotification } from '@/lib/db'
import { scrapeTitulo } from '@/lib/sunarp-scraper'
import { getNextStepSuggestion } from '@/lib/ai-service'
import { sendWhatsApp, sendEmail } from '@/lib/notifications'

declare global {
  // eslint-disable-next-line no-var
  var _arthurSchedulerStarted: boolean
}

export function startScheduler() {
  if (global._arthurSchedulerStarted) return
  global._arthurSchedulerStarted = true
  console.log('[Scheduler] Starting background polling loop')
  runLoop().catch(err => console.error('[Scheduler] Fatal loop error:', err))
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runLoop() {
  while (true) {
    try {
      const tramites = getAllTramites()

      for (const tramite of tramites) {
        try {
          const intervalMs = (tramite.polling_frequency_hours || 4) * 60 * 60 * 1000
          const lastChecked = tramite.last_checked ? new Date(tramite.last_checked).getTime() : 0

          if (Date.now() - lastChecked < intervalMs) continue

          console.log(`[Scheduler] Polling tramite ${tramite.id}: ${tramite.alias}`)
          const result = await scrapeTitulo(
            tramite.numero_titulo,
            tramite.anio,
            tramite.oficina_registral,
            tramite.tipo,
          )

          if (result.portalDown) {
            updateTramite(tramite.id, { last_checked: new Date().toISOString() })
            continue
          }

          const changed = result.hash !== tramite.estado_hash && result.hash !== ''

          updateTramite(tramite.id, {
            estado_actual: result.estado,
            estado_hash: result.hash,
            observacion_texto: result.observacion || undefined,
            calificador: result.calificador || undefined,
            last_checked: result.scrapedAt,
          })

          addHistorial(tramite.id, result.estado, result.observacion || null, result.hash, changed)

          if (changed) {
            const suggestion = await getNextStepSuggestion(
              result.estado,
              result.observacion || null,
              tramite.tipo,
              tramite.alias,
            ).catch(() => '')

            const msgText = `Estado actualizado: ${result.estado}`

            if (tramite.whatsapp_number) {
              const ok = await sendWhatsApp(
                tramite.whatsapp_number,
                tramite.alias,
                result.estado,
                msgText,
                suggestion,
                tramite.id,
              ).catch(() => false)
              logNotification(tramite.id, 'whatsapp', result.estado, msgText, ok)
            }

            if (tramite.email) {
              const ok = await sendEmail(
                tramite.email,
                tramite.alias,
                result.estado,
                msgText,
                suggestion,
                result.observacion || null,
                tramite.id,
              ).catch(() => false)
              logNotification(tramite.id, 'email', result.estado, msgText, ok)
            }
          }

          await sleep(2000) // rate-limit between requests
        } catch (err) {
          console.error(`[Scheduler] Error polling tramite ${tramite.id}:`, err)
        }
      }
    } catch (err) {
      console.error('[Scheduler] Loop iteration error:', err)
    }

    await sleep(5 * 60 * 1000) // check every 5 minutes
  }
}
