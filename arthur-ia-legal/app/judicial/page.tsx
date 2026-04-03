'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPartesDisplay } from '@/lib/format-partes-judicial';

interface Caso {
  id: number;
  tipo_proceso: string | null;
  alias: string | null;
  cliente: string | null;
  partes: string | null;
  numero_expediente: string;
  ultimo_movimiento_fecha: string | null;
  proximo_evento: string | null;
  proximo_evento_fecha: string | null;
  prioridad: 'alta' | 'media' | 'baja';
}

interface Movimiento {
  id: number;
  urgencia: 'alta' | 'normal' | 'info';
  es_nuevo: number;
}

interface Audiencia {
  id: number;
  fecha: string;
}

const DISTRITOS = [
  'Lima', 'Lima Norte', 'Lima Sur', 'Lima Este', 'Callao',
  'Arequipa', 'Cusco', 'La Libertad', 'Piura', 'Junín',
  'Lambayeque', 'Ica', 'Áncash', 'Cajamarca', 'Loreto',
  'Puno', 'San Martín', 'Tacna', 'Ayacucho', 'Huánuco',
  'Moquegua', 'Tumbes', 'Ucayali', 'Amazonas', 'Apurímac',
  'Huancavelica', 'Madre de Dios', 'Pasco', 'Pasca',
]

const TIPOS = ['Civil', 'Laboral', 'Penal', 'Familia', 'Comercial', 'Constitucional', 'Contencioso Administrativo']

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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function JudicialDashboardPage() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [stats, setStats] = useState({ total: 0, activos: 0, conAlerta: 0, proximasAudiencias: 0 });
  const [details, setDetails] = useState<Record<number, { movimientos: Movimiento[]; audiencias: Audiencia[] }>>({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pollingId, setPollingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    numero_expediente: '',
    distrito_judicial: 'Lima',
    tipo_proceso: 'Civil',
    partes: '',
    cliente: '',
    alias: '',
    prioridad: 'baja' as 'alta' | 'media' | 'baja',
    whatsapp_number: '',
    email: '',
    polling_frequency_hours: 4,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [casosRes, statsRes] = await Promise.all([
        fetch('/api/casos'),
        fetch('/api/casos/stats'),
      ]);
      const casosData = await casosRes.json() as Caso[];
      const statsData = await statsRes.json() as typeof stats;
      setCasos(casosData);
      setStats(statsData);

      const map: Record<number, { movimientos: Movimiento[]; audiencias: Audiencia[] }> = {};
      for (const c of casosData) {
        const r = await fetch(`/api/casos/${c.id}`);
        if (!r.ok) continue;
        const d = await r.json() as { movimientos: Movimiento[]; audiencias: Audiencia[] };
        map[c.id] = { movimientos: d.movimientos || [], audiencias: d.audiencias || [] };
      }
      setDetails(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const highAlertCase = useMemo(() => {
    return casos.find(c => (details[c.id]?.movimientos || []).some(m => m.es_nuevo === 1 && m.urgencia === 'alta'));
  }, [casos, details]);

  async function createCaso() {
    const res = await fetch('/api/casos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) return;
    setDrawerOpen(false);
    setForm({
      numero_expediente: '',
      distrito_judicial: 'Lima',
      tipo_proceso: 'Civil',
      partes: '',
      cliente: '',
      alias: '',
      prioridad: 'baja',
      whatsapp_number: '',
      email: '',
      polling_frequency_hours: 4,
    });
    await loadData();
  }

  async function pollNow(id: number) {
    setPollingId(id);
    await fetch(`/api/casos/${id}/poll-now`, { method: 'POST' });
    setPollingId(null);
    await loadData();
  }

  async function togglePriority(c: Caso) {
    const next = c.prioridad === 'alta' ? 'media' : c.prioridad === 'media' ? 'baja' : 'alta';
    await fetch(`/api/casos/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prioridad: next }),
    });
    await loadData();
  }

  if (loading) {
    return <div style={{ padding: '48px 64px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>Cargando procesos...</div>;
  }

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid #c2a46d', paddingLeft: '24px' }}>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#c2a46d', marginBottom: '8px' }}>
            MIS PROCESOS
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400 }}>Mis Procesos</h1>
        </div>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 0, padding: '12px 24px', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}>
          + Nuevo proceso
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '32px' }}>
        {[
          { label: 'TOTAL PROCESOS', value: stats.total, color: 'var(--ink)', top: 'transparent', bg: 'var(--surface)' },
          { label: 'CON ALERTAS', value: stats.conAlerta, color: '#991b1b', top: '#991b1b', bg: 'rgba(153,27,27,0.04)' },
          { label: 'ACTIVOS', value: stats.activos, color: '#166534', top: '#166534', bg: 'rgba(22,101,52,0.04)' },
          { label: 'PRÓXIMAS AUDIENCIAS', value: stats.proximasAudiencias, color: '#92400e', top: '#d97706', bg: 'rgba(217,119,6,0.06)' },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: '1px solid var(--line)', borderTop: card.label === 'TOTAL PROCESOS' ? '3px solid #c2a46d' : card.top === 'transparent' ? '1px solid var(--line)' : `3px solid ${card.top}`, padding: '24px 28px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: card.color, marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', lineHeight: 1, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {highAlertCase && (
        <div style={{ background: 'var(--accent-navy)', color: 'white', padding: '16px 28px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
            🔴 {highAlertCase.alias || highAlertCase.cliente} tiene movimiento urgente pendiente.
          </span>
          <Link href={`/judicial/${highAlertCase.id}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', opacity: 0.9 }}>Ver detalle →</Link>
        </div>
      )}

      <div style={{ marginTop: '32px', background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 1.4fr 220px 150px 170px 110px 140px', padding: '12px 24px', background: 'var(--paper-dark)', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', gap: '12px' }}>
          <span>ESTADO</span><span>TIPO</span><span>ALIAS / CLIENTE</span><span>EXPEDIENTE</span><span>ÚLTIMA ACTUALIZACIÓN</span><span>PRÓXIMO EVENTO</span><span>PRIORIDAD</span><span>ACCIONES</span>
        </div>

        {casos.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: 'var(--muted)' }}>
            No hay procesos registrados todavía.
          </div>
        ) : casos.map(c => {
          const det = details[c.id] || { movimientos: [], audiencias: [] };
          const urgentNew = det.movimientos.some(m => m.es_nuevo === 1 && m.urgencia === 'alta');
          const normalNew = det.movimientos.some(m => m.es_nuevo === 1 && m.urgencia !== 'alta');
          const hasAny = det.movimientos.length > 0;
          const nextAud = [...det.audiencias].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];
          const dleft = daysUntil(nextAud?.fecha || null);

          return (
            <div key={c.id} onClick={() => (window.location.href = `/judicial/${c.id}`)} style={{ display: 'grid', gridTemplateColumns: '90px 120px 1.4fr 220px 150px 170px 110px 140px', padding: '0 24px', minHeight: '66px', alignItems: 'center', borderBottom: '1px solid var(--line-faint)', gap: '12px', cursor: 'pointer' }}>
              <div>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: urgentNew ? '#991b1b' : normalNew ? '#d97706' : hasAny ? '#166534' : '#9ca3af', animation: urgentNew ? 'pulse 1.5s infinite' : undefined }} />
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{c.tipo_proceso || '—'}</div>
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600 }}>{c.alias || c.cliente || 'Sin alias'}</div>
                {(() => {
                  const partesLine = formatPartesDisplay(c.partes);
                  if (!partesLine) return null;
                  return (
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.45 }}>
                      {partesLine}
                    </div>
                  );
                })()}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>{c.numero_expediente}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>{relativeTime(c.ultimo_movimiento_fecha)}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: dleft === null ? 'var(--muted)' : dleft < 3 ? '#991b1b' : dleft < 7 ? '#92400e' : 'var(--ink)' }}>
                {nextAud ? `${nextAud.fecha} (${dleft}d)` : 'Sin evento'}
              </div>
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); void togglePriority(c); }}
                  style={{
                    border: '1px solid var(--line-strong)',
                    background: c.prioridad === 'alta' ? 'rgba(153,27,27,0.08)' : c.prioridad === 'media' ? 'rgba(217,119,6,0.09)' : 'rgba(107,101,96,0.08)',
                    color: c.prioridad === 'alta' ? '#991b1b' : c.prioridad === 'media' ? '#92400e' : '#6b6560',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    padding: '5px 8px',
                    cursor: 'pointer'
                  }}
                >
                  {c.prioridad}
                </button>
              </div>
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); void pollNow(c.id); }}
                  disabled={pollingId === c.id}
                  style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 0, padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: pollingId === c.id ? 'not-allowed' : 'pointer', opacity: pollingId === c.id ? 0.6 : 1 }}
                >
                  {pollingId === c.id ? '...' : 'Revisar ahora'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', zIndex: 200 }} />
          <div className="animate-slideInRight" style={{ position: 'fixed', top: 0, right: 0, width: '480px', height: '100vh', background: 'var(--paper)', borderLeft: '1px solid var(--line-mid)', zIndex: 300, overflowY: 'auto', padding: '40px 36px' }}>
            <button onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', right: '20px', top: '16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 400 }}>Nuevo proceso</h2>
            <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '12px', marginBottom: '24px' }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Número de expediente</label>
            <input value={form.numero_expediente} onChange={e => setForm({ ...form, numero_expediente: e.target.value })} placeholder="Ej: 00847-2023-0-1801-JR-CI-12" style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 6 }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)', marginBottom: 16 }}>Formato: número-año-0-distJudicial-tipo-juzgado</p>

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Distrito judicial</label>
            <select value={form.distrito_judicial} onChange={e => setForm({ ...form, distrito_judicial: e.target.value })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }}>
              {DISTRITOS.map(d => <option key={d}>{d}</option>)}
            </select>

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Tipo de proceso</label>
            <select value={form.tipo_proceso} onChange={e => setForm({ ...form, tipo_proceso: e.target.value })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }}>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Partes del proceso</label>
            <textarea value={form.partes} onChange={e => setForm({ ...form, partes: e.target.value })} placeholder="Ej: García vs. Inmobiliaria Horizonte SAC" style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16, minHeight: 70 }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Cliente</label>
            <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Alias del caso</label>
            <input value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Prioridad</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8, marginBottom: 16 }}>
              {(['alta', 'media', 'baja'] as const).map(p => (
                <button key={p} onClick={() => setForm({ ...form, prioridad: p })} style={{ border: form.prioridad === p ? '2px solid var(--ink)' : '1px solid var(--line-strong)', background: 'var(--surface)', padding: '10px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>WhatsApp</label>
            <input value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+51999000000" style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Email</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 16 }} />

            <label style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Frecuencia</label>
            <select value={form.polling_frequency_hours} onChange={e => setForm({ ...form, polling_frequency_hours: Number(e.target.value) })} style={{ width: '100%', border: '1px solid var(--line-strong)', padding: '12px 14px', marginTop: 6, marginBottom: 22 }}>
              <option value={1}>Cada hora</option>
              <option value={2}>Cada 2h</option>
              <option value={4}>Cada 4h</option>
              <option value={12}>Cada 12h</option>
              <option value={24}>Cada 24h</option>
            </select>

            <button onClick={() => void createCaso()} style={{ width: '100%', background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 0, padding: '16px', fontFamily: 'Inter, sans-serif', fontSize: '14px', cursor: 'pointer' }}>
              Comenzar seguimiento →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
