export interface AudienciaCalendarInput {
  fecha: string;
  descripcion: string;
  caso_alias?: string | null;
}

export function getGoogleCalendarLink(audiencia: AudienciaCalendarInput): string {
  const start = new Date(audiencia.fecha);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `arthur.ia — ${audiencia.descripcion}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Caso: ${audiencia.caso_alias || ''}\nGestionado por arthur.ia`,
    location: 'Lima, Perú',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function getOutlookLink(audiencia: AudienciaCalendarInput): string {
  const start = new Date(audiencia.fecha);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `arthur.ia — ${audiencia.descripcion}`,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: `Caso: ${audiencia.caso_alias || ''}`,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
