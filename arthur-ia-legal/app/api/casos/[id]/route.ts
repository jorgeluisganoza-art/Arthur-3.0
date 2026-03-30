import {
  getCasoById,
  getMovimientosByCaso,
  getAudienciasByCaso,
  getNotificacionesJudicialesByCaso,
  getEscritosByCaso,
  softDeleteCaso,
  updateCaso
} from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = Number.parseInt(id, 10)
    if (!Number.isFinite(casoId)) {
      return Response.json({ error: 'ID no válido' }, { status: 400 })
    }

    const caso = getCasoById(casoId)
    if (!caso) {
      return Response.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const movimientos = getMovimientosByCaso(casoId)
    const audiencias = getAudienciasByCaso(casoId)
    const notifications = getNotificacionesJudicialesByCaso(casoId, 5)
    const escritos = getEscritosByCaso(casoId)

    return Response.json({ ...caso, movimientos, audiencias, notifications, escritos })
  } catch (error) {
    console.error('[API] GET /casos/[id] error:', error)
    return Response.json({ error: 'Error al obtener caso' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = Number.parseInt(id, 10)
    const body = await request.json() as Record<string, unknown>

    const allowed = ['alias', 'prioridad', 'whatsapp_number', 'email', 'polling_frequency_hours']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    updateCaso(casoId, updates)
    return Response.json(getCasoById(casoId))
  } catch (error) {
    console.error('[API] PUT /casos/[id] error:', error)
    return Response.json({ error: 'Error al actualizar caso' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = Number.parseInt(id, 10)
    softDeleteCaso(casoId)
    return Response.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /casos/[id] error:', error)
    return Response.json({ error: 'Error al desactivar caso' }, { status: 500 })
  }
}
