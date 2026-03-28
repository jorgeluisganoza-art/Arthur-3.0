'use client';

import { useEffect, useState } from 'react';
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

function tipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    predio: '🏠 Predio',
    empresa: '🏢 Empresa',
    vehiculo: '🚗 Vehículo',
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
          { label: 'OBSERVADOS', value: stats.observados, borderColor: '#c0392b', color: '#c0392b', delay: 100 },
          { label: 'PENDIENTES', value: stats.pendientes, borderColor: '#e6a817', color: '#b8860b', delay: 200 },
          { label: 'INSCRITOS', value: stats.inscritos, borderColor: '#27ae60', color: '#27ae60', delay: 300 },
        ].map(card => (
          <div
            key={card.label}
            className="animate-fadeUp"
            style={{
              background: card.label === 'OBSERVADOS' && stats.observados > 0 ? 'rgba(192,57,43,0.04)' : 'white',
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
          background: '#c0392b',
          padding: '16px 28px',
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeUp 0.4s ease forwards',
        }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'white', fontWeight: 500 }}>
            ⚠ {firstObservado.alias} — OBSERVADO. Requiere atención inmediata.
          </span>
          <Link href={`/dashboard/tramites/${firstObservado.id}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
            Ver detalle →
          </Link>
        </div>
      )}

      {/* Table */}
      <div style={{ marginTop: '32px', background: 'white', border: '1px solid rgba(15,15,15,0.08)' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 120px 1fr 140px 160px 140px',
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
                  gridTemplateColumns: '140px 120px 1fr 140px 160px 140px',
                  padding: '0 24px',
                  height: '64px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(15,15,15,0.06)',
                  borderLeft: isObservado ? '3px solid #c0392b' : '3px solid transparent',
                  background: isPolling ? 'rgba(245,240,232,0.8)' : ps?.result ? 'rgba(245,240,232,0.6)' : 'white',
                  gap: '16px',
                  animationDelay: `${idx * 50}ms`,
                  transition: 'background 0.3s',
                }}
              >
                <div><StatusBadge estado={t.estado_actual} /></div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--ink)' }}>{tipoLabel(t.tipo)}</div>
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
                    <span style={{ color: ps.result.error ? '#c0392b' : ps.result.changed ? '#1e8449' : 'var(--muted)', fontSize: '12px' }}>
                      {ps.result.error ? '⚠ Portal no disponible' : ps.result.changed ? '✓ Actualizado' : 'Sin cambios'}
                    </span>
                  ) : (
                    relativeTime(t.last_checked)
                  )}
                </div>
                <div>
                  <button
                    onClick={() => handlePollNow(t.id)}
                    disabled={isPolling}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(15,15,15,0.15)',
                      borderRadius: 0,
                      padding: '6px 14px',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--ink)',
                      cursor: isPolling ? 'not-allowed' : 'pointer',
                      opacity: isPolling ? 0.6 : 1,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseOver={e => { if (!isPolling) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--paper)'; }}}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; }}
                  >
                    {isPolling ? 'Consultando...' : 'Revisar ahora'}
                  </button>
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
