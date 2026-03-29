import { getDeletedTramites } from '@/lib/db';

export async function GET() {
  try {
    const tramites = getDeletedTramites();
    return Response.json(tramites);
  } catch (error) {
    console.error('[API] GET /tramites/deleted error:', error);
    return Response.json({ error: 'Error al obtener trámites eliminados' }, { status: 500 });
  }
}
