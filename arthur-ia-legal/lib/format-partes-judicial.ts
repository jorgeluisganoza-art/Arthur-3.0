/**
 * Convierte `partes` almacenadas como JSON ([{rol,nombre},...]) o texto libre
 * en una sola línea legible; nunca devuelve el JSON crudo.
 */
export function formatPartesDisplay(partes: string | null | undefined): string {
  if (partes == null) return '';
  const raw = String(partes).trim();
  if (!raw) return '';

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return '';
      const lines: string[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const o = item as { rol?: string; nombre?: string };
        const nombre = (o.nombre ?? '').trim();
        if (!nombre) continue;
        const rol = (o.rol ?? '').trim();
        const rolFmt = rol
          ? rol.charAt(0).toUpperCase() + rol.slice(1).replace(/_/g, ' ')
          : '';
        lines.push(rolFmt ? `${rolFmt}: ${nombre}` : nombre);
      }
      return lines.join(' · ');
    } catch {
      return '';
    }
  }

  return raw;
}
