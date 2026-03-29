'use client';

import { useEffect, useState, use, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import CalendarButtons from '@/components/CalendarButtons';

interface Tramite {
  id: number;
  tipo: string;
  numero_titulo: string;
  anio: string;
  oficina_registral: string;
  oficina_nombre: string | null;
  alias: string;
  estado_actual: string;
  observacion_texto: string | null;
  calificador: string | null;
  polling_frequency_hours: number;
  last_checked: string | null;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

interface Historial {
  id: number;
  estado: string;
  observacion: string | null;
  es_cambio: number;
  scraped_at: string;
}

interface Plazo {
  id: number;
  descripcion: string;
  fecha_vencimiento: string;
  tipo: string | null;
}

interface Notif {
  id: number;
  canal: string;
  estado: string | null;
  enviado_at: string;
  success: number;
}

interface TramiteDetail extends Tramite {
  historial: Historial[];
  plazos: Plazo[];
  notifications: Notif[];
}

interface PollResult {
  changed: boolean;
  estado: string;
  suggestion: string;
  error?: string;
  notificacionesEnviadas: { whatsapp: boolean; email: boolean };
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

function getStatusColor(estado: string): string {
  const colors: Record<string, string> = {
    OBSERVADO: '#991b1b',
    TACHA: '#7f1d1d',
    PENDIENTE: '#92400e',
    INSCRITO: '#166534',
  };
  return colors[estado] || 'var(--muted)';
}

function getDaysColor(days: number): string {
  if (days < 7) return '#991b1b';
  if (days < 15) return '#92400e';
  return 'var(--ink)';
}

const TIPO_SEGUIMIENTO_OPTIONS = [
  { value: 'predio', label: 'Predio' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'vehiculo', label: 'Vehículo' },
  { value: 'persona', label: 'Personas naturales' },
  { value: 'mandatos', label: 'Mandatos y poderes' },
] as const;

export default function TramiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tramite, setTramite] = useState<TramiteDetail | null>(null);
  const [caseActionBusy, setCaseActionBusy] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [demoStep, setDemoStep] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<PollResult | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function loadTramite() {
    setFetchError(null);
    try {
      const res = await fetch(`/api/tramites/${id}`);
      if (res.ok) {
        const data = await res.json() as TramiteDetail;
        setTramite(data);
      } else {
        setTramite(null);
        try {
          const j = (await res.json()) as { error?: string };
          setFetchError(j.error ?? `Error ${res.status}`);
        } catch {
          setFetchError(`Error ${res.status}`);
        }
      }
    } catch {
      setTramite(null);
      setFetchError('No se pudo conectar con el servidor');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTramite();
  }, [id]);

  async function handleDemo() {
    setDemoResult(null);
    setDemoStep('Conectando con SUNARP...');

    await new Promise(r => setTimeout(r, 1500));
    setDemoStep('Descargando estado del título...');

    await new Promise(r => setTimeout(r, 1500));
    setDemoStep('Analizando con Arthur-IA...');

    await new Promise(r => setTimeout(r, 1000));

    try {
      const res = await fetch(`/api/tramites/${id}/poll-now`, { method: 'POST' });
      const result = await res.json() as PollResult;
      setDemoResult(result);
      setSuggestion(result.suggestion || '');
      await loadTramite();
    } catch {
      setDemoResult({ changed: false, estado: '', suggestion: '', error: 'Error de conexión', notificacionesEnviadas: { whatsapp: false, email: false } });
    } finally {
      setDemoStep(null);
    }
  }

  async function handleArchiveCase() {
    setCaseActionBusy(true);
    try {
      const res = await fetch(`/api/tramites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      if (res.ok) {
        setDetailMenuOpen(false);
        router.push('/dashboard/archivados');
      } else window.alert('No se pudo archivar. Intenta de nuevo.');
    } finally {
      setCaseActionBusy(false);
    }
  }

  async function handleTipoChange(nextTipo: string) {
    if (!tramite || nextTipo === tramite.tipo) return;
    try {
      const res = await fetch(`/api/tramites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: nextTipo }),
      });
      if (res.ok) await loadTramite();
      else window.alert('No se pudo actualizar el tipo de registro.');
    } catch {
      window.alert('No se pudo actualizar el tipo de registro.');
    }
  }

  async function handleDeleteCase() {
    const ok = window.confirm(
      '¿Enviar este trámite a Eliminados? Dejará el seguimiento activo. Se borrará por completo en 30 días (puedes restaurarlo antes desde el menú Eliminados).'
    );
    if (!ok) return;
    setCaseActionBusy(true);
    try {
      const res = await fetch(`/api/tramites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'soft-delete' }),
      });
      if (res.ok) {
        setDetailMenuOpen(false);
        router.push('/dashboard/eliminados');
      } else window.alert('No se pudo eliminar. Intenta de nuevo.');
    } finally {
      setCaseActionBusy(false);
    }
  }

  const headerActionBtn: CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(15,15,15,0.15)',
    borderRadius: 0,
    padding: '10px 20px',
    fontFamily: 'DM Mono, monospace',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--ink)',
  };

  if (loading) {
    return (
      <div style={{ padding: '48px 64px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)' }}>
          Cargando...
        </div>
      </div>
    );
  }

  if (!tramite) {
    return (
      <div style={{ padding: '48px 64px' }}>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: 'var(--ink)' }}>
          Trámite no encontrado
        </div>
        {fetchError && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)', marginTop: '12px', maxWidth: '520px', lineHeight: 1.6 }}>
            {fetchError}. Puede que el enlace sea antiguo, el caso se haya purgado o —en un servidor nuevo— la base de datos esté vacía.
          </p>
        )}
        <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Link href="/dashboard" style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            ← Mis trámites
          </Link>
          <Link href="/dashboard/archivados" style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Archivados
          </Link>
          <Link href="/dashboard/eliminados" style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Eliminados
          </Link>
        </div>
      </div>
    );
  }

  const isDeleted = Boolean(tramite.deleted_at);
  const isArchived = Boolean(tramite.archived_at) && !isDeleted;
  const needsAction = tramite.estado_actual === 'OBSERVADO' || tramite.estado_actual === 'TACHA';
  const statusColor = getStatusColor(tramite.estado_actual);

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      {/* Back link */}
      <Link
        href="/dashboard"
        style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', display: 'inline-block', marginBottom: '8px' }}
      >
        ← Mis Trámites
      </Link>

      {isDeleted && (
        <div style={{
          background: 'rgba(153,27,27,0.08)',
          border: '1px solid rgba(153,27,27,0.25)',
          padding: '14px 20px',
          marginBottom: '16px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          color: 'var(--ink)',
        }}>
          Este trámite está en la <strong>papelera</strong>. Puedes restaurarlo desde{' '}
          <Link href="/dashboard/eliminados" style={{ color: '#991b1b', fontWeight: 600 }}>Eliminados</Link>.
          La consulta automática a SUNARP no está disponible hasta restaurarlo.
        </div>
      )}

      {isArchived && (
        <div style={{
          background: 'rgba(26,61,43,0.06)',
          border: '1px solid rgba(26,61,43,0.2)',
          padding: '14px 20px',
          marginBottom: '16px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          color: 'var(--ink)',
        }}>
          Trámite <strong>archivado</strong>. Sigue en{' '}
          <Link href="/dashboard/archivados" style={{ color: 'var(--accent)', fontWeight: 600 }}>Archivados</Link>
          {' '}y puedes seguir revisando el estado aquí.
        </div>
      )}

      {/* Header — z-index when menu open so dropdown is not covered by cards below (fadeUp uses transform) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          animation: 'fadeUp 0.4s ease forwards',
          overflow: 'visible',
          ...(detailMenuOpen ? { position: 'relative', zIndex: 400 } : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--ink)', fontWeight: 400 }}>
            {tramite.alias}
          </h1>
          <StatusBadge estado={tramite.estado_actual} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleDemo}
            disabled={!!demoStep || caseActionBusy || isDeleted}
            title={isDeleted ? 'Restaura el trámite desde Eliminados para consultar SUNARP' : undefined}
            style={{
              ...headerActionBtn,
              cursor: demoStep || caseActionBusy || isDeleted ? 'not-allowed' : 'pointer',
              opacity: demoStep || caseActionBusy || isDeleted ? 0.7 : 1,
            }}
          >
            {demoStep ? demoStep : 'Revisar ahora'}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setDetailMenuOpen(v => !v);
              }}
              disabled={caseActionBusy || !!demoStep || isDeleted}
              aria-expanded={detailMenuOpen}
              aria-haspopup="true"
              title="Más acciones"
              style={{
                ...headerActionBtn,
                padding: '10px 16px',
                color: 'var(--muted)',
                letterSpacing: '0.12em',
                cursor: caseActionBusy || demoStep || isDeleted ? 'not-allowed' : 'pointer',
                opacity: caseActionBusy || demoStep || isDeleted ? 0.6 : 1,
              }}
            >
              ···
            </button>
            {detailMenuOpen && (
              <>
                <div
                  role="presentation"
                  onClick={() => setDetailMenuOpen(false)}
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
                    onClick={() => { void handleArchiveCase(); }}
                    disabled={caseActionBusy}
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
                      cursor: caseActionBusy ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseOver={e => { if (!caseActionBusy) e.currentTarget.style.background = 'var(--paper-dark)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    Archivar
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleDeleteCase(); }}
                    disabled={caseActionBusy}
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
                      cursor: caseActionBusy ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseOver={e => { if (!caseActionBusy) e.currentTarget.style.background = 'rgba(153,27,27,0.04)'; }}
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
      <div style={{ width: '60px', height: '2px', background: '#1a3d2b', marginTop: '16px', marginBottom: '32px' }} />

      {/* Current Status Card */}
      <div style={{
        background: 'white',
        border: '1px solid rgba(15,15,15,0.08)',
        borderLeft: `4px solid ${statusColor}`,
        padding: '28px 32px',
        marginBottom: '24px',
        animation: 'fadeUp 0.4s ease forwards',
      }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '8px' }}>
          ESTADO ACTUAL
        </div>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '32px', color: statusColor, marginBottom: '20px' }}>
          {tramite.estado_actual}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            { label: 'DESDE', value: formatDate(tramite.created_at) },
            { label: 'ÚLTIMA REVISIÓN', value: relativeTime(tramite.last_checked) },
            { label: 'FRECUENCIA', value: `Cada ${tramite.polling_frequency_hours}h` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--ink)' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(15,15,15,0.08)' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '8px' }}>
            Tipo de registro (como en Síguelo Plus)
          </div>
          <select
            value={tramite.tipo}
            onChange={e => { void handleTipoChange(e.target.value); }}
            disabled={isDeleted}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              padding: '10px 12px',
              border: '1px solid rgba(15,15,15,0.15)',
              minWidth: '280px',
              background: 'white',
              cursor: isDeleted ? 'not-allowed' : 'pointer',
              opacity: isDeleted ? 0.65 : 1,
            }}
          >
            {TIPO_SEGUIMIENTO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)', marginTop: '10px', maxWidth: '560px', lineHeight: 1.55 }}>
            Debe coincidir con «Tipo de registro» en la ficha oficial (p. ej. poderes en registro de personas suelen figurar como <strong>Personas naturales</strong>).
            Tras cambiarlo, usa <strong>Revisar ahora</strong>.
          </p>
        </div>
      </div>

      {/* Demo Result Banner */}
      {demoResult && (
        <div
          style={{
            padding: '16px 24px',
            marginBottom: '24px',
            background: demoResult.error ? '#991b1b' : demoResult.changed ? 'rgba(22,101,52,0.08)' : 'rgba(136,136,136,0.1)',
            border: `1px solid ${demoResult.error ? '#991b1b' : demoResult.changed ? '#166534' : 'rgba(136,136,136,0.2)'}`,
            color: demoResult.error ? 'white' : 'var(--ink)',
            animation: 'fadeUp 0.4s ease forwards',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          }}
        >
          {demoResult.error
            ? 'Portal SUNARP no disponible · Mostrando último estado'
            : demoResult.changed
            ? `Estado actualizado · ${demoResult.notificacionesEnviadas.whatsapp ? 'WhatsApp enviado · ' : ''}${demoResult.notificacionesEnviadas.email ? 'Email enviado' : ''}`
            : 'Sin cambios desde la última revisión'}
        </div>
      )}

      {/* AI Suggestion */}
      {needsAction && (
        <div style={{
          background: '#1a3d2b',
          padding: '32px',
          marginBottom: '24px',
          animation: 'fadeUp 0.4s ease forwards',
          animationDelay: '100ms',
          opacity: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '22px', color: 'white' }}>Qué hacer ahora</span>
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', padding: '4px 10px', borderRadius: '2px' }}>
              Claude AI
            </span>
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', lineHeight: '1.75', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            {suggestion || 'Haz clic en "Revisar ahora" para obtener una sugerencia personalizada de Arthur-IA.'}
          </p>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)', marginTop: '16px' }}>
            Siempre consulta con tu abogado antes de actuar
          </div>
        </div>
      )}

      {/* Draft CTA */}
      {needsAction && (
        <div style={{
          background: 'var(--accent-light)',
          borderLeft: '4px solid var(--accent)',
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeUp 0.4s ease forwards',
          animationDelay: '150ms',
          opacity: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              Arthur-IA puede redactar tu escrito
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
              Basado en la esquela · 5 min con asistencia IA
            </div>
          </div>
          <Link
            href={`/dashboard/tramites/${tramite.id}/redactar`}
            style={{
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 0,
              padding: '10px 20px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Redactar escrito →
          </Link>
        </div>
      )}

      {/* Observation text */}
      {tramite.observacion_texto && (
        <div style={{
          borderLeft: '4px solid #b8860b',
          background: 'rgba(184,134,11,0.04)',
          padding: '24px 28px',
          marginBottom: '32px',
          animation: 'fadeUp 0.4s ease forwards',
          animationDelay: '200ms',
          opacity: 0,
        }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8860b', marginBottom: '12px' }}>
            ESQUELA DE OBSERVACIÓN
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.7', color: 'var(--ink)', margin: 0 }}>
            {tramite.observacion_texto}
          </p>
          {(tramite.estado_actual === 'SIN DATOS' || (tramite.observacion_texto && /no existe el titulo/i.test(tramite.observacion_texto))) && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.65, color: 'var(--muted)', margin: '16px 0 0' }}>
              <p style={{ margin: '0 0 12px' }}>
                Si en el <strong>portal oficial</strong> el mismo número, año y oficina sí aparecen, comprueba arriba el <strong>tipo de registro</strong> (por ejemplo <strong>Personas naturales</strong> para muchos poderes).
              </p>
              <p style={{ margin: 0 }}>
                Arthur consulta SUNARP por un canal automático <strong>sin CAPTCHA</strong>. La página de Síguelo Plus usa otra vía (con verificación Turnstile); por eso a veces allí figura el título y aquí la base responde que no existe.
              </p>
              <p style={{ margin: '12px 0 0' }}>
                <a
                  href="https://sigueloplus.sunarp.gob.pe/siguelo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Abrir Síguelo Plus (sitio oficial SUNARP) ↗
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Plazos */}
      {tramite.plazos.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: 'var(--ink)', fontWeight: 400 }}>Plazos</h2>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>FECHAS IMPORTANTES</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {tramite.plazos.map(plazo => {
              const days = daysUntil(plazo.fecha_vencimiento);
              return (
                <div
                  key={plazo.id}
                  style={{
                    background: 'white',
                    border: '1px solid rgba(15,15,15,0.08)',
                    padding: '20px 24px',
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center',
                    minWidth: '260px',
                  }}
                >
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '48px', color: getDaysColor(days), lineHeight: 1 }}>
                      {days}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      días
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                      {plazo.descripcion}
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>
                      {formatDate(plazo.fecha_vencimiento)}
                    </div>
                    <CalendarButtons
                      title={`${plazo.descripcion} — ${tramite.alias}`}
                      date={plazo.fecha_vencimiento}
                      description={`Trámite: ${tramite.alias}\nTítulo: ${tramite.numero_titulo}-${tramite.anio}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historial */}
      {tramite.historial.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: 'var(--ink)', fontWeight: 400, marginBottom: '20px' }}>
            Historial
          </h2>
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            <div style={{ position: 'absolute', left: '3px', top: 0, bottom: 0, width: '1px', background: 'rgba(15,15,15,0.1)' }} />
            {tramite.historial.map(item => (
              <div key={item.id} style={{ position: 'relative', paddingBottom: '24px', paddingLeft: '16px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getStatusColor(item.estado),
                }} />
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                  {new Date(item.scraped_at).toLocaleString('es-PE')}
                </div>
                <StatusBadge estado={item.estado} />
                {item.observacion && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5', marginTop: '6px' }}>
                    {item.observacion.substring(0, 150)}{item.observacion.length > 150 ? '...' : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {tramite.notifications.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '12px' }}>
            ALERTAS ENVIADAS
          </div>
          {tramite.notifications.map(n => (
            <div key={n.id} style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: n.success ? '#166534' : '#991b1b', marginRight: '6px', verticalAlign: 'middle' }} />
              {n.success ? 'Enviado' : 'Error'} · {n.canal === 'whatsapp' ? 'WhatsApp' : 'Email'} · {n.estado} · {new Date(n.enviado_at).toLocaleString('es-PE')}
            </div>
          ))}
        </div>
      )}

      {/* Demo Button */}
      <button
        onClick={handleDemo}
        disabled={!!demoStep}
        style={{
          width: '100%',
          background: 'var(--ink)',
          color: 'var(--paper)',
          border: 'none',
          borderRadius: 0,
          padding: '20px',
          fontFamily: 'DM Serif Display, serif',
          fontStyle: 'italic',
          fontSize: '20px',
          cursor: demoStep ? 'not-allowed' : 'pointer',
          marginTop: '16px',
        }}
      >
        {demoStep ? demoStep : 'Simular revisión SUNARP en tiempo real →'}
      </button>
    </div>
  );
}
