import { getTramiteById, updateTramite, addHistorial, addPlazo, logNotification } from '@/lib/db';
import { scrapeTitulo } from '@/lib/sunarp-scraper';
import { getNextStepSuggestion, analyzeEsquela } from '@/lib/ai-service';
import { sendWhatsApp, sendEmail } from '@/lib/notifications';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tramiteId = parseInt(id);
    const tramite = getTramiteById(tramiteId);

    if (!tramite) {
      return Response.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    // 1. Scrape SUNARP
    const result = await scrapeTitulo(
      tramite.numero_titulo,
      tramite.anio,
      tramite.oficina_registral
    );

    // Handle portal down gracefully
    if (!result) {
      updateTramite(tramiteId, { last_checked: new Date().toISOString() });
      return Response.json({
        changed: false,
        estado: tramite.estado_actual,
        suggestion: 'El portal SUNARP no está disponible en este momento. Se muestra el último estado conocido.',
        notificacionesEnviadas: { whatsapp: false, email: false },
        error: 'Portal SUNARP no disponible',
      });
    }

    // 2. Detect change
    const changed = result.hash !== tramite.estado_hash;

    // 3. Always update last_checked
    const updates: Record<string, unknown> = {
      last_checked: result.scrapedAt,
    };

    let suggestion = '';
    const notificacionesEnviadas = { whatsapp: false, email: false };

    if (changed) {
      updates.estado_actual = result.estado;
      updates.estado_hash = result.hash;
      updates.observacion_texto = result.observacion;
      updates.calificador = result.calificador;

      // a. Update DB
      updateTramite(tramiteId, updates);

      // b. Add historial
      addHistorial(tramiteId, result.estado, result.observacion, result.hash, true);

      // c. AI suggestion
      suggestion = await getNextStepSuggestion(
        result.estado,
        result.observacion,
        tramite.tipo,
        tramite.alias
      );

      // d. If OBSERVADO: analyze and create plazos
      if (result.isObservado && result.observacion) {
        try {
          const analysis = await analyzeEsquela(result.observacion, tramite.tipo, tramite.alias);

          const subsanacionDate = new Date();
          subsanacionDate.setDate(subsanacionDate.getDate() + (analysis.plazoDias || 30));

          addPlazo(
            tramiteId,
            'Plazo de subsanación de observaciones',
            subsanacionDate.toISOString().split('T')[0],
            'subsanacion'
          );

          const apelacionDate = new Date();
          apelacionDate.setDate(apelacionDate.getDate() + 15);
          addPlazo(
            tramiteId,
            'Plazo para recurso de apelación',
            apelacionDate.toISOString().split('T')[0],
            'apelacion'
          );
        } catch (aiErr) {
          console.error('[poll-now] analyzeEsquela error:', aiErr);
        }
      }

      // e. Send WhatsApp
      if (tramite.whatsapp_number) {
        const waMsgText = changed
          ? `El estado de tu trámite "${tramite.alias}" ha cambiado a ${result.estado}.`
          : `Tu trámite "${tramite.alias}" sigue en estado ${result.estado}.`;

        const waSuccess = await sendWhatsApp(
          tramite.whatsapp_number,
          tramite.alias,
          result.estado,
          waMsgText,
          suggestion,
          tramiteId
        );
        notificacionesEnviadas.whatsapp = waSuccess;
        logNotification(tramiteId, 'whatsapp', result.estado, waMsgText, waSuccess);
      }

      // f. Send email
      if (tramite.email) {
        const emailMsgText = `El estado de tu trámite "${tramite.alias}" ha cambiado a ${result.estado}.`;
        const emailSuccess = await sendEmail(
          tramite.email,
          tramite.alias,
          result.estado,
          emailMsgText,
          suggestion,
          result.observacion,
          tramiteId
        );
        notificacionesEnviadas.email = emailSuccess;
        logNotification(tramiteId, 'email', result.estado, emailMsgText, emailSuccess);
      }
    } else {
      // No change, just update last_checked and get suggestion
      updateTramite(tramiteId, updates);
      addHistorial(tramiteId, result.estado, result.observacion, result.hash, false);

      suggestion = await getNextStepSuggestion(
        result.estado,
        result.observacion,
        tramite.tipo,
        tramite.alias
      );
    }

    return Response.json({
      changed,
      estado: result.estado,
      suggestion,
      notificacionesEnviadas,
    });
  } catch (error) {
    console.error('[API] POST /tramites/[id]/poll-now error:', error);
    return Response.json(
      { error: 'Error al consultar SUNARP', changed: false },
      { status: 500 }
    );
  }
}
