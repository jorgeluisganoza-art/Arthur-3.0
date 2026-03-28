import { getTramiteById, updateTramite, deleteTramite, getHistorialByTramite, getPlazos, getNotificationsByTramite } from '@/lib/db';

export async function GET(
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

    const historial = getHistorialByTramite(tramiteId);
    const plazos = getPlazos(tramiteId);
    const notifications = getNotificationsByTramite(tramiteId);

    return Response.json({ ...tramite, historial, plazos, notifications });
  } catch (error) {
    console.error('[API] GET /tramites/[id] error:', error);
    return Response.json({ error: 'Error al obtener trámite' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tramiteId = parseInt(id);
    const body = await request.json() as Record<string, unknown>;

    // Only allow updating certain fields
    const allowed = ['alias', 'polling_frequency_hours', 'polling_times', 'whatsapp_number', 'email'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    updateTramite(tramiteId, updates);
    const updated = getTramiteById(tramiteId);
    return Response.json(updated);
  } catch (error) {
    console.error('[API] PUT /tramites/[id] error:', error);
    return Response.json({ error: 'Error al actualizar trámite' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteTramite(parseInt(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /tramites/[id] error:', error);
    return Response.json({ error: 'Error al eliminar trámite' }, { status: 500 });
  }
}
