'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CalendarButtons from '@/components/CalendarButtons';

interface Plazo {
  id: number;
  tramite_id: number;
  descripcion: string;
  fecha_vencimiento: string;
  tipo: string | null;
  alias?: string;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDaysColor(days: number): string {
  if (days < 7) return '#991b1b';
  if (days < 15) return '#92400e';
  return 'var(--ink)';
}

function getTipoPill(tipo: string | null): React.ReactNode {
  const labels: Record<string, { label: string; color: string; bg: string }> = {
    subsanacion: { label: 'Subsanación', color: '#991b1b', bg: 'rgba(153,27,27,0.1)' },
    apelacion: { label: 'Apelación', color: '#7f1d1d', bg: 'rgba(127,29,29,0.15)' },
    queja: { label: 'Queja', color: '#b8860b', bg: 'rgba(184,134,11,0.1)' },
    prorroga: { label: 'Prórroga', color: '#1e8449', bg: 'rgba(39,174,96,0.1)' },
  };
  const config = tipo ? labels[tipo] : null;
  if (!config) return null;
  return (
    <span style={{
      fontFamily: 'DM Mono, monospace',
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      padding: '4px 10px',
      borderRadius: '2px',
      background: config.bg,
      color: config.color,
      display: 'inline-block',
    }}>
      {config.label}
    </span>
  );
}

export default function AgendaPage() {
  const [plazos, setPlazos] = useState<Plazo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tramites')
      .then(r => r.json())
      .then(async (tramites: { id: number; alias: string }[]) => {
        const allPlazos: Plazo[] = [];
        for (const t of tramites) {
          const res = await fetch(`/api/tramites/${t.id}`);
          const data = await res.json() as { plazos: Plazo[] };
          for (const p of data.plazos) {
            allPlazos.push({ ...p, alias: t.alias });
          }
        }
        allPlazos.sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
        setPlazos(allPlazos);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '48px 64px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Cargando agenda...
        </div>
      </div>
    );
  }

  const thisWeek = plazos.filter(p => daysUntil(p.fecha_vencimiento) <= 7);
  const thisMonth = plazos.filter(p => { const d = daysUntil(p.fecha_vencimiento); return d > 7 && d <= 30; });
  const upcoming = plazos.filter(p => daysUntil(p.fecha_vencimiento) > 30);

  const sections = [
    { label: 'Esta semana', items: thisWeek, borderColor: '#991b1b' },
    { label: 'Este mes', items: thisMonth, borderColor: '#d97706' },
    { label: 'Próximos meses', items: upcoming, borderColor: 'rgba(136,136,136,0.3)' },
  ];

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ animation: 'fadeUp 0.4s ease forwards' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
          AGENDA DE PLAZOS
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400 }}>
          Agenda
        </h1>
        <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px' }} />
      </div>

      {plazos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '80px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>
            No hay plazos próximos. Todo al día. ✓
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)' }}>
            Los plazos aparecerán aquí cuando tengas trámites OBSERVADO o TACHA.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {sections.map(section => (
            section.items.length > 0 && (
              <div key={section.label}>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--muted)',
                  paddingLeft: '16px',
                  borderLeft: `3px solid ${section.borderColor}`,
                  marginBottom: '20px',
                  lineHeight: 1.8,
                }}>
                  {section.label} — {section.items.length} plazo{section.items.length > 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {section.items.map(plazo => {
                    const days = daysUntil(plazo.fecha_vencimiento);
                    return (
                      <Link
                        key={plazo.id}
                        href={`/dashboard/tramites/${plazo.tramite_id}`}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          padding: '20px 24px',
                          display: 'flex',
                          gap: '24px',
                          alignItems: 'center',
                          textDecoration: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15,15,15,0.2)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; }}
                      >
                        {/* Days counter */}
                        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '80px' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: getDaysColor(days), lineHeight: 1 }}>
                            {days}
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                            días
                          </div>
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                            {plazo.descripcion}
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                            {plazo.alias}
                          </div>
                        </div>

                        {/* Right side */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--ink)', marginBottom: '6px' }}>
                            {formatDate(plazo.fecha_vencimiento)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '6px' }}>
                            {getTipoPill(plazo.tipo)}
                            <CalendarButtons
                              fecha={plazo.fecha_vencimiento}
                              descripcion={plazo.descripcion}
                              caso_alias={plazo.alias}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
