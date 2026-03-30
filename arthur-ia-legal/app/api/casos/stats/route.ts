import { getCasosStats } from '@/lib/db'

export async function GET() {
  try {
    return Response.json(getCasosStats())
  } catch (error) {
    console.error('[API] GET /casos/stats error:', error)
    return Response.json({ error: 'Error al obtener estadísticas judiciales' }, { status: 500 })
  }
}
