'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  agregarTituloSunarp,
  consultarAhoraSunarp,
  eliminarTituloSunarp,
  descargarEsquelaSunarp,
  descargarAsientoSunarp,
} from '@/app/actions/sunarp';
import { OFICINAS_ESTATICAS } from '@/lib/sunarp-oficinas';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Titulo {
  id: number;
  oficina_registral: string;
  oficina_nombre: string | null;
  anio_titulo: string;
  numero_titulo: string;
  nombre_cliente: string;
  email_cliente: string | null;
  whatsapp_cliente: string | null;
  ultimo_estado: string;
  ultima_consulta: string | null;
  area_registral: string | null;
  numero_partida: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(estado: string): string {
  const map: Record<string, string> = {
    INSCRITO: '#1e8449', OBSERVADO: '#c0392b', TACHA: '#922b21',
    PENDIENTE: '#b8860b', 'EN CALIFICACIÓN': '#b8860b', LIQUIDADO: '#1a5276',
    BLOQUEADO: '#6c3483',
  };
  return map[estado] || '#6b6560';
}

function statusBg(estado: string): string {
  const map: Record<string, string> = {
    INSCRITO: 'rgba(39,174,96,0.1)', OBSERVADO: 'rgba(192,57,43,0.1)',
    TACHA: 'rgba(192,57,43,0.18)', PENDIENTE: 'rgba(184,134,11,0.1)',
    'EN CALIFICACIÓN': 'rgba(184,134,11,0.1)', LIQUIDADO: 'rgba(26,82,118,0.1)',
    BLOQUEADO: 'rgba(108,52,131,0.1)',
  };
  return map[estado] || 'rgba(107,101,96,0.1)';
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

function downloadPdf(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SunarpSigueloPage() {
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMsg, setActionMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pollLoading, setPollLoading] = useState<number | null>(null);
  const [docLoading, setDocLoading] = useState<{ id: number; type: string } | null>(null);

  // Form fields
  const [oficina, setOficina] = useState('0101');
  const otraNombre = '';
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [numero, setNumero] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const mono = 'DM Mono, ui-monospace, monospace';
  const serif = "'Inter', system-ui, sans-serif";

  // ── Load titulos ────────────────────────────────────────────────────────────

  async function loadTitulos() {
    setLoading(true);
    try {
      const res = await fetch('/api/sunarp/titulos');
      if (res.ok) setTitulos(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTitulos(); }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleAgregar(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData();
    const selected = OFICINAS_ESTATICAS.find(o => `${o.codigoZona}${o.codigoOficina}` === oficina);
    fd.append('oficina_registral', oficina);
    fd.append('oficina_nombre', otraNombre || (selected?.nombreOficina ?? oficina));
    fd.append('anio_titulo', anio);
    fd.append('numero_titulo', numero);
    fd.append('nombre_cliente', nombre);
    fd.append('email_cliente', email);
    fd.append('whatsapp_cliente', whatsapp);

    startTransition(async () => {
      const result = await agregarTituloSunarp(fd);
      if (result.ok) {
        setShowForm(false);
        setNumero(''); setNombre(''); setEmail(''); setWhatsapp('');
        await loadTitulos();
      } else {
        setFormError(result.error || 'Error al agregar');
      }
    });
  }

  async function handlePollNow(id: number) {
    setPollLoading(id);
    try {
      const result = await consultarAhoraSunarp(id);
      const text = result.portalDown
        ? 'Portal SUNARP no disponible'
        : result.changed
          ? `Estado actualizado: ${result.estado}`
          : 'Sin cambios';
      setActionMsg({ id, text, ok: result.ok });
      await loadTitulos();
    } finally {
      setPollLoading(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este título del seguimiento?')) return;
    await eliminarTituloSunarp(id);
    await loadTitulos();
  }

  async function handleEsquela(id: number, numero_titulo: string) {
    setDocLoading({ id, type: 'esquela' });
    try {
      const result = await descargarEsquelaSunarp(id);
      if (result.ok && result.pdfs?.length) {
        result.pdfs.forEach((pdf, i) => downloadPdf(pdf, `esquela_${numero_titulo}_${i + 1}.pdf`));
      } else {
        setActionMsg({ id, text: result.error || 'Sin esquelas', ok: false });
        setTimeout(() => setActionMsg(null), 4000);
      }
    } finally {
      setDocLoading(null);
    }
  }

  async function handleAsiento(id: number, numero_titulo: string) {
    setDocLoading({ id, type: 'asiento' });
    try {
      const result = await descargarAsientoSunarp(id);
      if (result.ok && result.pdf) {
        downloadPdf(result.pdf, `asiento_${result.numeroPartida || numero_titulo}.pdf`);
      } else {
        setActionMsg({ id, text: result.error || 'Sin asiento', ok: false });
        setTimeout(() => setActionMsg(null), 4000);
      }
    } finally {
      setDocLoading(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    fontFamily: mono, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.06em', padding: '6px 12px', cursor: 'pointer',
    border: '1px solid', borderRadius: '2px', transition: 'all 0.15s',
  };

  return (
    <div style={{ padding: '48px 48px 80px', fontFamily: serif, color: 'var(--ink)', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
            SUNARP · Síguelo Plus
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 400, fontStyle: 'italic', color: 'var(--ink)', margin: 0 }}>
            Seguimiento de Títulos
          </h1>
          <p style={{ fontFamily: serif, fontSize: '13px', color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
            Monitoreo automático de títulos en el portal SUNARP Síguelo Plus.
            Las alertas se envían por email y WhatsApp cuando el estado cambia.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); }}
          style={{ ...btnBase, background: '#0f0f0f', color: '#f5f0e8', borderColor: '#0f0f0f', padding: '10px 20px', fontSize: '11px', flexShrink: 0 }}
        >
          + Agregar título
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '40px', width: '480px', maxWidth: '90vw', borderRadius: '2px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '20px' }}>
              Nuevo título en seguimiento
            </div>
            <form onSubmit={handleAgregar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Número de título *</label>
                  <input value={numero} onChange={e => setNumero(e.target.value)} required placeholder="00123456"
                    style={{ width: '100%', padding: '8px 10px', fontFamily: mono, fontSize: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Año *</label>
                  <input value={anio} onChange={e => setAnio(e.target.value)} required placeholder="2024" maxLength={4}
                    style={{ width: '100%', padding: '8px 10px', fontFamily: mono, fontSize: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Oficina registral *</label>
                <select value={oficina} onChange={e => setOficina(e.target.value)} required
                  style={{ width: '100%', padding: '8px 10px', fontFamily: mono, fontSize: '11px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px' }}>
                  {OFICINAS_ESTATICAS.map(o => {
                    const code = `${o.codigoZona}${o.codigoOficina}`;
                    return <option key={code} value={code}>{o.nombreOficina} ({code})</option>;
                  })}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Nombre del cliente *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Juan Pérez / Empresa SAC"
                  style={{ width: '100%', padding: '8px 10px', fontFamily: serif, fontSize: '13px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com"
                    style={{ width: '100%', padding: '8px 10px', fontFamily: serif, fontSize: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>WhatsApp</label>
                  <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+51999000000"
                    style={{ width: '100%', padding: '8px 10px', fontFamily: mono, fontSize: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: '2px', boxSizing: 'border-box' }} />
                </div>
              </div>
              {formError && <p style={{ fontFamily: mono, fontSize: '10px', color: '#c0392b', margin: 0 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', borderColor: 'var(--line)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{ ...btnBase, background: '#0f0f0f', color: '#f5f0e8', borderColor: '#0f0f0f', padding: '8px 20px', opacity: isPending ? 0.6 : 1 }}>
                  {isPending ? 'Consultando SUNARP...' : 'Agregar y consultar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && titulos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 40px', border: '1px solid var(--line)', borderRadius: '2px', background: 'var(--surface)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'italic', color: 'var(--muted)', marginBottom: '8px' }}>
            Sin títulos en seguimiento
          </div>
          <p style={{ fontFamily: mono, fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Agregue un título para comenzar el monitoreo automático
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ fontFamily: mono, fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '40px 0' }}>
          Cargando títulos...
        </div>
      )}

      {/* Titulos list */}
      {!loading && titulos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--line)' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 140px 180px', gap: '0', background: 'var(--surface)', padding: '10px 20px' }}>
            {['Cliente / Título', 'Oficina', 'Estado', 'Última consulta', 'Acciones'].map(h => (
              <div key={h} style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>{h}</div>
            ))}
          </div>

          {titulos.map(t => {
            const isPolling = pollLoading === t.id;
            const msg = actionMsg?.id === t.id ? actionMsg : null;
            const esquelaBusy = docLoading?.id === t.id && docLoading.type === 'esquela';
            const asientoBusy = docLoading?.id === t.id && docLoading.type === 'asiento';

            return (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 140px 180px', gap: '0', background: 'var(--paper)', padding: '16px 20px', alignItems: 'center' }}>
                {/* Cliente / Título */}
                <div>
                  <div style={{ fontFamily: serif, fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '3px' }}>{t.nombre_cliente}</div>
                  <div style={{ fontFamily: mono, fontSize: '10px', color: 'var(--muted)' }}>
                    {t.numero_titulo.padStart(8, '0')}/{t.anio_titulo}
                    {t.numero_partida && <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>Partida {t.numero_partida}</span>}
                  </div>
                  {msg && (
                    <div style={{ fontFamily: mono, fontSize: '9px', color: msg.ok ? '#1e8449' : '#c0392b', marginTop: '4px' }}>
                      {msg.text}
                    </div>
                  )}
                </div>

                {/* Oficina */}
                <div style={{ fontFamily: mono, fontSize: '10px', color: 'var(--muted)', paddingRight: '12px' }}>
                  <div>{t.oficina_nombre || t.oficina_registral}</div>
                  {t.area_registral && <div style={{ marginTop: '2px', fontSize: '9px' }}>{t.area_registral}</div>}
                </div>

                {/* Estado */}
                <div>
                  <span style={{
                    display: 'inline-block',
                    fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '4px 8px',
                    background: statusBg(t.ultimo_estado),
                    color: statusColor(t.ultimo_estado),
                    border: `1px solid ${statusColor(t.ultimo_estado)}`,
                    borderRadius: '2px',
                  }}>
                    {t.ultimo_estado}
                  </span>
                </div>

                {/* Última consulta */}
                <div style={{ fontFamily: mono, fontSize: '10px', color: 'var(--muted)' }}>
                  {relativeTime(t.ultima_consulta)}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => handlePollNow(t.id)} disabled={isPolling}
                    style={{ ...btnBase, background: 'transparent', color: 'var(--ink)', borderColor: 'var(--line-mid)', fontSize: '9px', padding: '5px 8px', opacity: isPolling ? 0.5 : 1 }}>
                    {isPolling ? '...' : 'Consultar'}
                  </button>
                  <button onClick={() => handleEsquela(t.id, t.numero_titulo)} disabled={esquelaBusy}
                    style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', borderColor: 'var(--line)', fontSize: '9px', padding: '5px 8px', opacity: esquelaBusy ? 0.5 : 1 }}>
                    {esquelaBusy ? '...' : 'Esquela'}
                  </button>
                  <button onClick={() => handleAsiento(t.id, t.numero_titulo)} disabled={asientoBusy}
                    style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', borderColor: 'var(--line)', fontSize: '9px', padding: '5px 8px', opacity: asientoBusy ? 0.5 : 1 }}>
                    {asientoBusy ? '...' : 'Asiento'}
                  </button>
                  <button onClick={() => handleEliminar(t.id)}
                    style={{ ...btnBase, background: 'transparent', color: '#c0392b', borderColor: 'rgba(192,57,43,0.3)', fontSize: '9px', padding: '5px 8px' }}>
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats footer */}
      {!loading && titulos.length > 0 && (
        <div style={{ marginTop: '32px', display: 'flex', gap: '24px', fontFamily: mono, fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <span>{titulos.length} {titulos.length === 1 ? 'título' : 'títulos'} en seguimiento</span>
          <span>{titulos.filter(t => t.ultimo_estado === 'OBSERVADO').length} observados</span>
          <span>{titulos.filter(t => t.ultimo_estado === 'INSCRITO').length} inscritos</span>
          <span>{titulos.filter(t => t.ultimo_estado === 'PENDIENTE' || t.ultimo_estado === 'EN CALIFICACIÓN').length} pendientes</span>
        </div>
      )}
    </div>
  );
}
