import { getAllTramites } from '@/lib/db';
import { scrapeTitulo } from '@/lib/sunarp-scraper';
import { updateTramite, addHistorial, logNotification } from '@/lib/db';
import { getNextStepSuggestion } from '@/lib/ai-service';
import { sendWhatsApp, sendEmail } from '@/lib/notifications';

// Simple in-memory scheduler state
declare global {
  // eslint-disable-next-line no-var
  var _arthurSchedulerStarted: boolean;
}

export async function POST() {
  try {
    if (global._arthurSchedulerStarted) {
      return Response.json({ message: 'Scheduler already running', started: 0 });
    }

    const tramites = getAllTramites();
    global._arthurSchedulerStarted = true;

    // Run polling loop in background
    runPollingLoop().catch(err => console.error('[Scheduler] Loop error:', err));

    return Response.json({ started: tramites.length, message: 'Scheduler started' });
  } catch (error) {
    console.error('[API] POST /scheduler/start error:', error);
    return Response.json({ error: 'Error al iniciar scheduler' }, { status: 500 });
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPollingLoop() {
  console.log('[Scheduler] Polling loop started');

  while (true) {
    try {
      const tramites = getAllTramites();

      for (const tramite of tramites) {
        try {
          const intervalMs = (tramite.polling_frequency_hours || 4) * 60 * 60 * 1000;
          const lastChecked = tramite.last_checked ? new Date(tramite.last_checked).getTime() : 0;
          const now = Date.now();

          if (now - lastChecked < intervalMs) continue;

          console.log(`[Scheduler] Polling tramite ${tramite.id}: ${tramite.alias}`);
          const result = await scrapeTitulo(
            tramite.numero_titulo,
            tramite.anio,
            tramite.oficina_registral
          );

          if (!result) {
            updateTramite(tramite.id, { last_checked: new Date().toISOString() });
            continue;
          }

          const changed = result.hash !== tramite.estado_hash;

          updateTramite(tramite.id, {
            estado_actual: result.estado,
            estado_hash: result.hash,
            observacion_texto: result.observacion ?? undefined,
            calificador: result.calificador ?? undefined,
            last_checked: result.scrapedAt,
          });

          addHistorial(tramite.id, result.estado, result.observacion, result.hash, changed);

          if (changed) {
            const suggestion = await getNextStepSuggestion(
              result.estado,
              result.observacion,
              tramite.tipo,
              tramite.alias
            );

            const msgText = `Estado actualizado: ${result.estado}`;

            if (tramite.whatsapp_number) {
              const ok = await sendWhatsApp(
                tramite.whatsapp_number,
                tramite.alias,
                result.estado,
                msgText,
                suggestion,
                tramite.id
              );
              logNotification(tramite.id, 'whatsapp', result.estado, msgText, ok);
            }

            if (tramite.email) {
              const ok = await sendEmail(
                tramite.email,
                tramite.alias,
                result.estado,
                msgText,
                suggestion,
                result.observacion,
                tramite.id
              );
              logNotification(tramite.id, 'email', result.estado, msgText, ok);
            }
          }

          await sleep(2000); // rate limit between requests
        } catch (err) {
          console.error(`[Scheduler] Error polling tramite ${tramite.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Loop iteration error:', err);
    }

    await sleep(5 * 60 * 1000); // Check every 5 minutes
  }
}
