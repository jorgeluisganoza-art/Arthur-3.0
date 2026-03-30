'use client';

import { useEffect, useState } from 'react';

interface Row {
  id: number;
  caso_id: number | null;
  canal: string;
  movimiento_descripcion: string | null;
  urgencia: string | null;
  ai_sugerencia: string | null;
  enviado_at: string;
  success: number;
}

export default function JudicialAlertasPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const casos = await fetch('/api/casos').then(r => r.json()) as Array<{ id: number }>;
      const all: Row[] = [];
      for (const c of casos) {
        const d = await fetch(`/api/casos/${c.id}`).then(r => r.json()) as { notifications: Row[] };
        all.push(...(d.notifications || []));
      }
      all.sort((a, b) => new Date(b.enviado_at).getTime() - new Date(a.enviado_at).getTime());
      setRows(all);
    })();
  }, []);

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>ALERTAS JUDICIALES</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400 }}>Alertas</h1>
      <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px', marginBottom: '24px' }} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '40px 24px', color: 'var(--muted)' }}>No hay alertas judiciales enviadas.</div>
        ) : rows.map(r => (
          <div key={r.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-faint)', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600 }}>{r.canal.toUpperCase()} · {r.urgencia || 'info'}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>{r.movimiento_descripcion}</div>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>{new Date(r.enviado_at).toLocaleString('es-PE')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
