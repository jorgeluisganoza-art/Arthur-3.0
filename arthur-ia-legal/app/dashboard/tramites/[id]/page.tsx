'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

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
    OBSERVADO: '#c0392b',
    TACHA: '#922b21',
    PENDIENTE: '#b8860b',
    INSCRITO: '#1e8449',
  };
  return colors[estado] || 'var(--muted)';
}

function getDaysColor(days: number): string {
  if (days < 7) return '#c0392b';
  if (days < 15) return '#b8860b';
  return 'var(--ink)';
}

export default function TramiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tramite, setTramite] = useState<TramiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoStep, setDemoStep] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<PollResult | null>(null);
  const [suggestion, setSuggestion] = useState('');

  async function loadTramite() {
    const res = await fetch(`/api/tramites/${id}`);
    if (res.ok) {
      const data = await res.json() as TramiteDetail;
      setTramite(data);
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
        <Link href="/dashboard" style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          ← Volver
        </Link>
      </div>
    );
  }

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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: 'fadeUp 0.4s ease forwards' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--ink)', fontWeight: 400 }}>
            {tramite.alias}
          </h1>
          <StatusBadge estado={tramite.estado_actual} />
        </div>
        <button
          onClick={handleDemo}
          disabled={!!demoStep}
          style={{
            background: 'transparent',
            border: '1px solid rgba(15,15,15,0.15)',
            borderRadius: 0,
            padding: '10px 20px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: demoStep ? 'not-allowed' : 'pointer',
            marginTop: '12px',
          }}
        >
          {demoStep ? demoStep : 'Revisar ahora'}
        </button>
      </div>
      <div style={{ width: '60px', height: '2px', background: '#c0392b', marginTop: '16px', marginBottom: '32px' }} />

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
      </div>

      {/* Demo Result Banner */}
      {demoResult && (
        <div
          style={{
            padding: '16px 24px',
            marginBottom: '24px',
            background: demoResult.error ? '#c0392b' : demoResult.changed ? 'rgba(39,174,96,0.1)' : 'rgba(107,101,96,0.1)',
            border: `1px solid ${demoResult.error ? '#c0392b' : demoResult.changed ? '#27ae60' : 'rgba(107,101,96,0.2)'}`,
            color: demoResult.error ? 'white' : 'var(--ink)',
            animation: 'fadeUp 0.4s ease forwards',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          }}
        >
          {demoResult.error
            ? `⚠ Portal SUNARP no disponible · Mostrando último estado`
            : demoResult.changed
            ? `✅ Estado actualizado · ${demoResult.notificacionesEnviadas.whatsapp ? 'WhatsApp enviado · ' : ''}${demoResult.notificacionesEnviadas.email ? 'Email enviado' : ''}`
            : 'Sin cambios desde la última revisión'}
        </div>
      )}

      {/* AI Suggestion */}
      {needsAction && (
        <div style={{
          background: '#1a3a5c',
          padding: '32px',
          marginBottom: '24px',
          animation: 'fadeUp 0.4s ease forwards',
          animationDelay: '100ms',
          opacity: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>💡</span>
              <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '22px', color: 'white' }}>Qué hacer ahora</span>
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', background: 'rgba(245,240,232,0.15)', color: 'rgba(245,240,232,0.7)', padding: '4px 10px', borderRadius: '2px' }}>
              Claude AI
            </span>
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', lineHeight: '1.75', color: 'rgba(245,240,232,0.85)', margin: 0 }}>
            {suggestion || 'Haz clic en "Revisar ahora" para obtener una sugerencia personalizada de Arthur-IA.'}
          </p>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', fontStyle: 'italic', color: 'rgba(245,240,232,0.35)', marginTop: '16px' }}>
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
              📝 Arthur-IA puede redactar tu escrito
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
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                      {formatDate(plazo.fecha_vencimiento)}
                    </div>
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
              {n.success ? '✅' : '❌'} {n.canal === 'whatsapp' ? 'WhatsApp' : 'Email'} · {n.estado} · {new Date(n.enviado_at).toLocaleString('es-PE')}
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
