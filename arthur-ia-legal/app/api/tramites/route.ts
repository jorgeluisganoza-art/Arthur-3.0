import { getAllTramites, createTramite } from '@/lib/db';
import { scrapeTitulo } from '@/lib/sunarp-scraper';
import { updateTramite, addHistorial } from '@/lib/db';

export async function GET() {
  try {
    const tramites = getAllTramites();
    return Response.json(tramites);
  } catch (error) {
    console.error('[API] GET /tramites error:', error);
    return Response.json({ error: 'Error al obtener trámites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tipo: string;
      numero_titulo: string;
      anio: string;
      oficina_registral: string;
      oficina_nombre?: string;
      alias: string;
      polling_frequency_hours?: number;
      polling_times?: string;
      whatsapp_number?: string;
      email?: string;
    };

    const tramite = createTramite(body);

    // Run first poll immediately (non-blocking)
    scrapeTitulo(tramite.numero_titulo, tramite.anio, tramite.oficina_registral, tramite.tipo)
      .then(result => {
        if (result) {
          updateTramite(tramite.id, {
            estado_actual: result.estado,
            estado_hash: result.hash,
            observacion_texto: result.observacion ?? undefined,
            calificador: result.calificador ?? undefined,
            last_checked: result.scrapedAt,
          });
          addHistorial(tramite.id, result.estado, result.observacion, result.hash, true);
        }
      })
      .catch(err => console.error('[API] Initial poll error:', err));

    return Response.json(tramite, { status: 201 });
  } catch (error) {
    console.error('[API] POST /tramites error:', error);
    return Response.json({ error: 'Error al crear trámite' }, { status: 500 });
  }
}
