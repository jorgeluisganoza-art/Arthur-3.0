'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AddTramiteDrawer from '@/components/AddTramiteDrawer';

interface Tramite {
  id: number;
  tipo: string;
  numero_titulo: string;
  anio: string;
  alias: string;
  estado_actual: string;
  last_checked: string | null;
  whatsapp_number: string | null;
  email: string | null;
}

interface Stats {
  total: number;
  observados: number;
  pendientes: number;
  inscritos: number;
  tachas: number;
}

interface PollResult {
  changed: boolean;
  estado: string;
  suggestion: string;
  notificacionesEnviadas: { whatsapp: boolean; email: boolean };
  error?: string;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

const IconHouse = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M2 7L8 2l6 5" />
    <path d="M4 7v7h8V7" />
    <path d="M6 14v-4h4v4" />
  </svg>
);

const IconBuilding = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="2" width="12" height="13" />
    <path d="M5 5h2M9 5h2M5 8h2M9 8h2M6 15v-4h4v4" />
  </svg>
);

const IconCar = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 9l1.5-4h7L13 9" />
    <rect x="1" y="9" width="14" height="4" rx="1" />
    <circle cx="4" cy="13" r="1.5" />
    <circle cx="12" cy="13" r="1.5" />
  </svg>
);

const IconScroll = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
    <path d="M6 5h4M6 8h4M6 11h2" />
  </svg>
);

const IconPerson = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="5.5" r="2.25" />
    <path d="M3.5 14.5v0c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
  </svg>
);

function TipoIcon({ tipo }: { tipo: string }) {
  if (tipo === 'empresa') return <IconBuilding />;
  if (tipo === 'vehiculo') return <IconCar />;
  if (tipo === 'mandatos') return <IconScroll />;
  if (tipo === 'persona') return <IconPerson />;
  return <IconHouse />;
}

function tipoText(tipo: string): string {
  const labels: Record<string, string> = {
    predio: 'Predio',
    empresa: 'Empresa',
    vehiculo: 'Vehículo',
    persona: 'Personas',
    mandatos: 'Mandatos',
  };
  return labels[tipo] || tipo;
}

export default function DashboardPage() {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, observados: 0, pendientes: 0, inscritos: 0, tachas: 0 });
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pollingId, setPollingId] = useState<number | null>(null);
  const [pollStatus, setPollStatus] = useState<Record<number, { step: string; result?: PollResult }>>({});
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const actionsBtnBase: CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(15,15,15,0.15)',
    borderRadius: 0,
    padding: '6px 12px',
    fontFamily: 'DM Mono, monospace',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--ink)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  };

  async function loadData() {
    try {
      const [tramitesRes, statsRes] = await Promise.all([
        fetch('/api/tramites'),
        fetch('/api/dashboard/stats'),
      ]);
      const t = await tramitesRes.json() as Tramite[];
      const s = await statsRes.json() as Stats;
      setTramites(t);
      setStats(s);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePollNow(tramiteId: number) {
    setPollingId(tramiteId);
    setPollStatus(prev => ({ ...prev, [tramiteId]: { step: 'Consultando...' } }));

    await new Promise(r => setTimeout(r, 1500));
    setPollStatus(prev => ({ ...prev, [tramiteId]: { step: 'Descargando estado...' } }));

    await new Promise(r => setTimeout(r, 1500));
    setPollStatus(prev => ({ ...prev, [tramiteId]: { step: 'Analizando con Arthur-IA...' } }));

    try {
      const res = await fetch(`/api/tramites/${tramiteId}/poll-now`, { method: 'POST' });
      const result = await res.json() as PollResult;

      setPollStatus(prev => ({ ...prev, [tramiteId]: { step: 'done', result } }));
      await loadData();
    } catch {
      setPollStatus(prev => ({
        ...prev,
        [tramiteId]: { step: 'done', result: { changed: false, estado: '', suggestion: '', notificacionesEnviadas: { whatsapp: false, email: false }, error: 'Error de conexión' } },
      }));
    } finally {
      setPollingId(null);
      // Clear status after 5 seconds
      setTimeout(() => {
        setPollStatus(prev => {
          const next = { ...prev };
          delete next[tramiteId];
          return next;
        });
      }, 5000);
    }
  }

  async function handleAction(tramiteId: number, action: 'archive' | 'soft-delete') {
    if (action === 'soft-delete') {
      const ok = window.confirm(
        '¿Enviar este trámite a Eliminados? Dejará de aparecer en Mis Trámites. Se borrará del sistema en 30 días (puedes restaurarlo antes desde el menú Eliminados).'
      );
      if (!ok) return;
    }
    try {
      const res = await fetch(`/api/tramites/${tramiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        console.error('PATCH tramite error', await res.text());
        return;
      }
      setMenuOpen(null);
      await loadData();
    } catch (err) {
      console.error('Error:', err);
    }
  }

  const firstObservado = tramites.find(t => t.estado_actual === 'OBSERVADO');

  if (loading) {
    return (
      <div style={{ padding: '48px 64px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)' }}>
          Cargando trámites...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: 'fadeUp 0.4s ease forwards' }}>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
            MIS TRÁMITES
          </div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400, lineHeight: 1.1 }}>
            Mis Trámites
          </h1>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            background: 'var(--ink)',
            color: 'var(--paper)',
            border: 'none',
            borderRadius: 0,
            padding: '12px 24px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          + Agregar trámite
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '32px' }}>
        {[
          { label: 'TOTAL', value: stats.total, borderColor: 'transparent', color: 'var(--ink)', delay: 0 },
          { label: 'OBSERVADOS', value: stats.observados, borderColor: '#991b1b', color: '#991b1b', delay: 100 },
          { label: 'PENDIENTES', value: stats.pendientes, borderColor: '#d97706', color: '#92400e', delay: 200 },
          { label: 'INSCRITOS', value: stats.inscritos, borderColor: '#166534', color: '#166534', delay: 300 },
        ].map(card => (
          <div
            key={card.label}
            className="animate-fadeUp"
            style={{
              background: card.label === 'OBSERVADOS' && stats.observados > 0 ? 'rgba(153,27,27,0.04)' : 'white',
              border: '1px solid rgba(15,15,15,0.08)',
              borderTop: card.borderColor !== 'transparent' ? `3px solid ${card.borderColor}` : '1px solid rgba(15,15,15,0.08)',
              padding: '24px 28px',
              borderRadius: 0,
              animationDelay: `${card.delay}ms`,
              opacity: 0,
            }}
          >
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: card.color, marginBottom: '8px' }}>
              {card.label}
            </div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '52px', color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Alert Banner */}
      {firstObservado && (
        <div style={{
          background: '#991b1b',
          padding: '16px 28px',
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeUp 0.4s ease forwards',
        }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', border: '1.5px solid white', borderRadius: '50%', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>!</span>
            {firstObservado.alias} — OBSERVADO. Requiere atención inmediata.
          </span>
          <Link href={`/dashboard/tramites/${firstObservado.id}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
            Ver detalle →
          </Link>
        </div>
      )}

      {/* Table */}
      <div style={{ marginTop: '32px', background: 'white', border: '1px solid rgba(15,15,15,0.08)', overflow: 'visible', position: 'relative', zIndex: 0 }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 120px 1fr 140px 160px 180px',
          background: 'var(--paper-dark)',
          padding: '12px 24px',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--muted)',
          gap: '16px',
        }}>
          <span>ESTADO</span>
          <span>TIPO</span>
          <span>ALIAS</span>
          <span>NÚMERO</span>
          <span>ÚLTIMA REVISIÓN</span>
          <span>ACCIONES</span>
        </div>

        {/* Rows */}
        {tramites.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: 'var(--ink)', marginBottom: '12px' }}>
              Aún no tienes trámites
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'var(--muted)', marginBottom: '24px' }}>
              Agrega tu primer trámite SUNARP para comenzar el seguimiento automático
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{ background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '12px 24px', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Agregar trámite
            </button>
          </div>
        ) : (
          tramites.map((t, idx) => {
            const ps = pollStatus[t.id];
            const isPolling = pollingId === t.id;
            const isObservado = t.estado_actual === 'OBSERVADO';

            return (
              <div
                key={t.id}
                className="fade-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 120px 1fr 140px 160px 180px',
                  padding: '0 24px',
                  minHeight: '64px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(15,15,15,0.06)',
                  borderLeft: isObservado ? '3px solid #991b1b' : '3px solid transparent',
                  background: isPolling ? '#f7f7f7' : ps?.result ? 'rgba(247,247,247,0.6)' : 'white',
                  gap: '16px',
                  animationDelay: `${idx * 50}ms`,
                  transition: 'background 0.3s',
                  overflow: 'visible',
                  ...(menuOpen === t.id ? { position: 'relative', zIndex: 400 } : {}),
                }}
              >
                <div><StatusBadge estado={t.estado_actual} /></div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TipoIcon tipo={t.tipo} />
                  {tipoText(t.tipo)}
                </div>
                <div>
                  <Link
                    href={`/dashboard/tramites/${t.id}`}
                    style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', transition: 'color 0.15s' }}
                    onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--ink)')}
                  >
                    {t.alias}
                  </Link>
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>
                  {t.numero_titulo}/{t.anio}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                  {isPolling && ps ? (
                    <span className="animate-pulse-text">{ps.step}</span>
                  ) : ps?.result ? (
                    <span style={{ color: ps.result.error ? '#991b1b' : ps.result.changed ? '#166534' : 'var(--muted)', fontSize: '12px' }}>
                      {ps.result.error ? '⚠ Portal no disponible' : ps.result.changed ? '✓ Actualizado' : 'Sin cambios'}
                    </span>
                  ) : (
                    relativeTime(t.last_checked)
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handlePollNow(t.id)}
                    disabled={isPolling}
                    title="Consultar estado en SUNARP"
                    style={{
                      ...actionsBtnBase,
                      cursor: isPolling ? 'not-allowed' : 'pointer',
                      opacity: isPolling ? 0.6 : 1,
                    }}
                    onMouseOver={e => { if (!isPolling) { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--paper)'; }}}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; }}
                  >
                    {isPolling ? '...' : 'Revisar'}
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === t.id ? null : t.id);
                      }}
                      aria-expanded={menuOpen === t.id}
                      aria-haspopup="true"
                      title="Más acciones"
                      style={{
                        ...actionsBtnBase,
                        padding: '6px 10px',
                        color: 'var(--muted)',
                        letterSpacing: '0.12em',
                      }}
                    >
                      ···
                    </button>
                    {menuOpen === t.id && (
                      <>
                        <div
                          role="presentation"
                          onClick={() => setMenuOpen(null)}
                          style={{ position: 'fixed', inset: 0, zIndex: 450 }}
                        />
                        <div
                          role="menu"
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            background: 'white',
                            border: '1px solid rgba(15,15,15,0.1)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            zIndex: 460,
                            minWidth: '168px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleAction(t.id, 'archive')}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: 'none',
                              border: 'none',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'var(--ink)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'var(--paper-dark)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
                          >
                            Archivar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(t.id, 'soft-delete')}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: 'none',
                              border: 'none',
                              borderTop: '1px solid rgba(15,15,15,0.06)',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: '#991b1b',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(153,27,27,0.04)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer */}
      <AddTramiteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => { setDrawerOpen(false); loadData(); }}
      />
    </div>
  );
}
