'use client';

import { useEffect, useState } from 'react';

interface Notification {
  id: number;
  tramite_id: number | null;
  canal: string;
  estado: string | null;
  mensaje: string | null;
  enviado_at: string;
  success: number;
  tramiteAlias?: string;
}

export default function AlertasPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tramites')
      .then(r => r.json())
      .then(async (tramites: { id: number; alias: string }[]) => {
        const allNotifs: Notification[] = [];
        for (const t of tramites) {
          const res = await fetch(`/api/tramites/${t.id}`);
          const data = await res.json() as { notifications: Notification[] };
          for (const n of data.notifications) {
            allNotifs.push({ ...n, tramiteAlias: t.alias });
          }
        }
        allNotifs.sort((a, b) => new Date(b.enviado_at).getTime() - new Date(a.enviado_at).getTime());
        setNotifications(allNotifs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ animation: 'fadeUp 0.4s ease forwards' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
          HISTORIAL
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400 }}>
          Alertas
        </h1>
        <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px' }} />
      </div>

      <div style={{ marginTop: '40px' }}>
        {loading ? (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Cargando alertas...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>
              No hay alertas enviadas
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)' }}>
              Las alertas aparecerán aquí cuando haya cambios en tus trámites.
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            {notifications.map((n, idx) => (
              <div
                key={n.id}
                style={{
                  padding: '20px 24px',
                  borderBottom: idx < notifications.length - 1 ? '1px solid var(--line-faint)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: n.success ? '#166534' : '#991b1b', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '2px' }}>
                      {n.tramiteAlias || 'Trámite'} — {n.canal === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </div>
                    {n.mensaje && (
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                        {n.mensaje.substring(0, 100)}{n.mensaje.length > 100 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {n.estado && (
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '4px' }}>
                      {n.estado}
                    </div>
                  )}
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(n.enviado_at).toLocaleString('es-PE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
