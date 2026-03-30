'use client';

import { useEffect, useState } from 'react';

interface Item {
  casoId: number;
  alias: string;
  tipo: string | null;
  fecha: string;
  descripcion: string;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function JudicialAgendaPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const casos = await fetch('/api/casos').then(r => r.json()) as Array<{ id: number; alias: string | null; tipo_proceso: string | null }>;
        const rows: Item[] = [];
        for (const c of casos) {
          const d = await fetch(`/api/casos/${c.id}`).then(r => r.json()) as { audiencias: Array<{ fecha: string; descripcion: string; tipo: string | null }> };
          for (const a of d.audiencias || []) {
            rows.push({
              casoId: c.id,
              alias: c.alias || `Caso ${c.id}`,
              tipo: a.tipo || c.tipo_proceso || null,
              fecha: a.fecha,
              descripcion: a.descripcion,
            });
          }
        }
        rows.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        setItems(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const thisWeek = items.filter(i => daysUntil(i.fecha) <= 7);
  const thisMonth = items.filter(i => daysUntil(i.fecha) > 7 && daysUntil(i.fecha) <= 30);
  const upcoming = items.filter(i => daysUntil(i.fecha) > 30);

  const sections = [
    { label: 'Esta semana', items: thisWeek, color: '#991b1b' },
    { label: 'Este mes', items: thisMonth, color: '#d97706' },
    { label: 'Próximos meses', items: upcoming, color: 'rgba(136,136,136,0.3)' },
  ];

  if (loading) return <div style={{ padding: '48px 64px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>Cargando agenda judicial...</div>;

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
        AGENDA JUDICIAL
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400 }}>Agenda</h1>
      <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px' }} />

      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {sections.map(section => section.items.length > 0 && (
          <div key={section.label}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', borderLeft: `3px solid ${section.color}`, paddingLeft: '12px', marginBottom: '14px' }}>
              {section.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {section.items.map((i, idx) => (
                <a key={`${i.casoId}-${idx}`} href={`/judicial/${i.casoId}`} style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600 }}>{i.alias}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>{i.descripcion}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{i.fecha}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>{i.tipo || 'evento'} · {daysUntil(i.fecha)}d</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
