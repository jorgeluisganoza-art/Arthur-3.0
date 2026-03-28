interface StatusBadgeProps {
  estado: string;
}

export default function StatusBadge({ estado }: StatusBadgeProps) {
  const normalized = estado?.toUpperCase() || 'SIN DATOS';

  const classMap: Record<string, string> = {
    OBSERVADO: 'badge badge-observado',
    PENDIENTE: 'badge badge-pendiente',
    INSCRITO: 'badge badge-inscrito',
    TACHA: 'badge badge-tacha',
    'SIN DATOS': 'badge badge-sin-datos',
  };

  const className = classMap[normalized] || 'badge badge-sin-datos';

  return <span className={className}>{normalized}</span>;
}
