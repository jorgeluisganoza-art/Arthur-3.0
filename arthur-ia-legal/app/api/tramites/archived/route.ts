import { getArchivedTramites } from '@/lib/db';

export async function GET() {
  try {
    const tramites = getArchivedTramites();
    return Response.json(tramites);
  } catch (error) {
    console.error('[API] GET /tramites/archived error:', error);
    return Response.json({ error: 'Error al obtener trámites archivados' }, { status: 500 });
  }
}
