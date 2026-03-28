import { getDashboardStats, getPlazos } from '@/lib/db';

export async function GET() {
  try {
    const stats = getDashboardStats();

    // Calculate alertas hoy (plazos venciendo hoy o mañana)
    const plazos = getPlazos();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const alertasHoy = plazos.filter(p => {
      const fechaVenc = new Date(p.fecha_vencimiento);
      return fechaVenc >= today && fechaVenc < tomorrow;
    }).length;

    return Response.json({ ...stats, alertasHoy });
  } catch (error) {
    console.error('[API] GET /dashboard/stats error:', error);
    return Response.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
