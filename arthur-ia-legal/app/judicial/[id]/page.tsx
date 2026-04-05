'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CalendarButtons from '@/components/CalendarButtons';
import { formatPartesDisplay } from '@/lib/format-partes-judicial';

type Tab = 'resumen' | 'movimientos' | 'documentos' | 'agenda' | 'arthur';

interface Movimiento {
  id: number;
  numero: string | null;
  fecha: string | null;
  acto: string | null;
  folio: string | null;
  sumilla: string | null;
  tiene_documento: number;
  documento_url: string | null;
  tiene_resolucion: number;
  urgencia: 'alta' | 'normal' | 'info';
  ai_sugerencia: string | null;
  ai_analisis: string | null;
}
interface Audiencia { id: number; descripcion: string; fecha: string; tipo: string | null; }
interface Escrito { id: number; tipo: string; contenido: string; created_at: string; }
interface CasoDetail {
  id: number;
  numero_expediente: string;
  distrito_judicial: string;
  organo_jurisdiccional: string | null;
  juez: string | null;
  tipo_proceso: string | null;
  etapa_procesal: string | null;
  partes: string | null;
  cliente: string | null;
  alias: string | null;
  monto: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  ultimo_movimiento: string | null;
  ultimo_movimiento_fecha: string | null;
  last_checked: string | null;
  movimientos: Movimiento[];
  audiencias: Audiencia[];
  escritos: Escrito[];
}

function colorUrgencia(u: string) {
  if (u === 'alta') return '#991b1b';
  if (u === 'normal') return '#92400e';
  return '#6b6560';
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function JudicialCaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [caso, setCaso] = useState<CasoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('resumen');
  const [demoStep, setDemoStep] = useState<string | null>(null);
  const [analisisMap, setAnalisisMap] = useState<Record<number, string>>({});
  const [analizando, setAnalizando] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/casos/${id}`);
      if (res.ok) setCaso(await res.json() as CasoDetail);
      else setCaso(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [id]);

  const lastMov = caso?.movimientos?.[0] || null;
  const totalMov = caso?.movimientos?.length || 0;
  const daysInProcess = useMemo(() => {
    if (!caso?.ultimo_movimiento_fecha) return 0;
    return Math.max(1, Math.floor((Date.now() - new Date(caso.ultimo_movimiento_fecha).getTime()) / (1000 * 60 * 60 * 24)));
  }, [caso?.ultimo_movimiento_fecha]);

  async function handleReviewNow() {
    setDemoStep('Conectando con el CEJ...');
    await fetch(`/api/casos/${id}/poll-now`, { method: 'POST' });
    await loadData();
    setDemoStep(null);
  }

  async function analizarActuacion(m: Movimiento) {
    if (analizando === m.id) return;
    // Toggle off if already shown
    if (analisisMap[m.id]) {
      setAnalisisMap(prev => { const n = { ...prev }; delete n[m.id]; return n; });
      return;
    }
    setAnalizando(m.id);
    try {
      const res = await fetch(`/api/casos/${id}/analizar-actuacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actuacionId: m.id, acto: m.acto, sumilla: m.sumilla }),
      });
      const data = await res.json() as { analisis: string };
      setAnalisisMap(prev => ({ ...prev, [m.id]: data.analisis || 'Sin análisis disponible.' }));
    } catch {
      setAnalisisMap(prev => ({ ...prev, [m.id]: 'Error al analizar. Intenta de nuevo.' }));
    } finally {
      setAnalizando(null);
    }
  }

  if (loading) return <div style={{ padding: '48px 64px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>Cargando caso...</div>;
  if (!caso) return <div style={{ padding: '48px 64px', fontFamily: 'var(--font-display)', fontSize: '24px' }}>Caso no encontrado</div>;

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/judicial" style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>← Mis Procesos</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '44px', fontWeight: 400 }}>{caso.alias || caso.cliente || `Caso ${caso.id}`}</h1>
            <span style={{ border: '1px solid var(--line-strong)', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase' }}>{caso.prioridad}</span>
            <span style={{ border: '1px solid var(--line-strong)', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: colorUrgencia(lastMov?.urgencia || 'info') }}>
              {lastMov?.urgencia || 'info'}
            </span>
          </div>
        </div>
        <button onClick={() => void handleReviewNow()} disabled={!!demoStep} style={{ background: 'transparent', border: '1px solid var(--line-strong)', padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: demoStep ? 'not-allowed' : 'pointer', opacity: demoStep ? 0.7 : 1 }}>
          {demoStep || 'Revisar ahora'}
        </button>
      </div>
      <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px', marginBottom: '28px' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          ['JUZGADO', caso.organo_jurisdiccional || '—'],
          ['JUEZ', caso.juez || '—'],
          ['ETAPA', caso.etapa_procesal || '—'],
          ['MONTO', caso.monto || '—'],
          ['DISTRITO', caso.distrito_judicial || '—'],
        ].map(item => (
          <div key={item[0]} style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{item[0]}</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, marginTop: '6px' }}>{item[1]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--line)' }}>
        {[
          ['resumen', 'Resumen'],
          ['movimientos', `Movimientos (${caso.movimientos.length})`],
          ['documentos', `Documentos (${caso.escritos.length})`],
          ['agenda', 'Agenda'],
          ['arthur', 'Arthur IA'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)} style={{ background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent-navy)' : '2px solid transparent', padding: '10px 8px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: tab === key ? 'var(--ink)' : 'var(--muted)', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '20px 24px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Último movimiento</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600 }}>{lastMov?.acto || caso.ultimo_movimiento || 'Sin movimientos'}</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>{lastMov?.sumilla || ''}</div>
          </div>
          {lastMov?.ai_sugerencia && (
            <div style={{ background: lastMov.urgencia === 'alta' ? '#1a3a5c' : 'var(--accent-light)', color: lastMov.urgencia === 'alta' ? 'white' : 'var(--ink)', padding: '20px 24px', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.8 }}>Arthur-IA sugiere</div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{lastMov.ai_sugerencia}</p>
            </div>
          )}
          {lastMov?.urgencia === 'alta' && (
            <Link href={`/judicial/${caso.id}/redactar`} style={{ display: 'inline-block', background: 'var(--accent-navy)', color: 'white', padding: '10px 18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase' }}>
              Redactar escrito →
            </Link>
          )}
          <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '18px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Partes</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.55 }}>
                {formatPartesDisplay(caso.partes) || (caso.partes && !String(caso.partes).trim().startsWith('[') ? caso.partes : '') || 'No registradas'}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '18px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Quick stats</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Total movimientos: {totalMov} · Días en proceso: {daysInProcess}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'movimientos' && (
        <div>
          {/* Header bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>
                {caso.movimientos.length} actuaciones registradas
              </span>
              {caso.last_checked && (
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginLeft: '12px' }}>
                  · Revisado {(() => {
                    const diff = Date.now() - new Date(caso.last_checked).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return 'ahora';
                    if (mins < 60) return `hace ${mins}min`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `hace ${hrs}h`;
                    return `hace ${Math.floor(hrs / 24)}d`;
                  })()}
                </span>
              )}
            </div>
            <button
              onClick={() => void handleReviewNow()}
              disabled={!!demoStep}
              style={{ background: 'var(--accent-navy)', color: 'white', border: 'none', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: demoStep ? 'not-allowed' : 'pointer', opacity: demoStep ? 0.7 : 1 }}
            >
              {demoStep || 'Actualizar desde CEJ'}
            </button>
          </div>

          {caso.movimientos.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif', padding: '24px 0' }}>
              No hay actuaciones registradas. Haz clic en "Actualizar desde CEJ" para obtener los movimientos.
            </div>
          ) : (
            <div style={{ paddingLeft: '20px', borderLeft: '1px solid var(--line-mid)' }}>
              {caso.movimientos.map(m => {
                const actoUpper = (m.acto || '').toUpperCase();
                const ACTOS_ESCRITO = ['SENTENCIA', 'AUTO', 'RESOLUCIÓN', 'DECRETO', 'ADMISORIO', 'NOTIFICACIÓN', 'EMPLAZAMIENTO', 'REQUERIMIENTO', 'APERCIBIMIENTO'];
                const requiereEscrito = m.urgencia === 'alta' || ACTOS_ESCRITO.some(a => actoUpper.includes(a));
                const tipoSugerido = actoUpper.includes('SENTENCIA') ? 'apelacion'
                  : actoUpper.includes('ADMISORIO') || actoUpper.includes('EMPLAZAMIENTO') ? 'contestacion'
                  : actoUpper.includes('REQUERIMIENTO') || actoUpper.includes('APERCIBIMIENTO') ? 'impulso'
                  : 'generico';
                const contexto = encodeURIComponent(m.sumilla || m.acto || '');
                const analisis = analisisMap[m.id] || m.ai_analisis;
                return (
                  <div key={m.id} style={{ position: 'relative', padding: '0 0 24px 14px' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: '6px', width: '9px', height: '9px', borderRadius: '50%', background: colorUrgencia(m.urgencia) }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        {m.numero && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', marginRight: '10px' }}>#{m.numero}</span>
                        )}
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>{m.fecha || 'Sin fecha'}</span>
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ display: 'inline-block', border: `1px solid ${colorUrgencia(m.urgencia)}`, color: colorUrgencia(m.urgencia), padding: '3px 8px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase' }}>{m.acto || 'Movimiento'}</span>
                        </div>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', marginTop: '8px', lineHeight: 1.65 }}>{m.sumilla}</p>

                        {m.ai_sugerencia && (
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#166534', fontStyle: 'italic', marginTop: '6px' }}>
                            Arthur-IA: {m.ai_sugerencia}
                          </p>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {(m.tiene_documento === 1 || m.tiene_resolucion === 1) && m.documento_url && (
                            <a
                              href={m.documento_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-block', border: '1px solid var(--line-strong)', background: 'transparent', padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--ink)', textDecoration: 'none', letterSpacing: '0.06em' }}
                            >
                              Ver documento
                            </a>
                          )}
                          <button
                            onClick={() => void analizarActuacion(m)}
                            disabled={analizando === m.id}
                            style={{ border: '1px solid var(--line-strong)', background: 'transparent', padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: analizando === m.id ? 'not-allowed' : 'pointer', color: 'var(--accent-navy)', letterSpacing: '0.06em', opacity: analizando === m.id ? 0.6 : 1 }}
                          >
                            {analizando === m.id ? '...' : analisisMap[m.id] ? 'Ocultar análisis' : 'Analizar con IA'}
                          </button>
                          {requiereEscrito && (
                            <Link
                              href={`/judicial/${caso.id}/redactar?tipo=${tipoSugerido}&movimientoId=${m.id}&contexto=${contexto}`}
                              style={{ display: 'inline-block', background: '#166534', color: 'white', padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', textDecoration: 'none' }}
                            >
                              Redactar respuesta →
                            </Link>
                          )}
                        </div>

                        {/* AI Analysis inline */}
                        {analisis && (
                          <div style={{ marginTop: '12px', background: 'var(--surface)', borderLeft: '3px solid var(--accent-navy)', padding: '14px 18px' }}>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-navy)', marginBottom: '6px', letterSpacing: '0.08em' }}>
                              Análisis Arthur-IA
                            </div>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.65, margin: 0, color: 'var(--ink)' }}>
                              {analisis}
                            </p>
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Folio: {m.folio || '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'documentos' && (
        <div>
          {caso.escritos.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>No hay escritos generados aún.</div>
          ) : caso.escritos.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', border: '1px solid var(--line)', background: 'var(--surface)', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>{e.tipo} · {new Date(e.created_at).toLocaleString('es-PE')}</div>
              <button onClick={() => window.alert(e.contenido)} style={{ border: '1px solid var(--line-strong)', background: 'transparent', padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}>Ver</button>
            </div>
          ))}
          <Link href={`/judicial/${caso.id}/redactar`} style={{ display: 'inline-block', marginTop: '10px', background: 'var(--ink)', color: 'white', padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase' }}>
            + Redactar nuevo escrito
          </Link>
        </div>
      )}

      {tab === 'agenda' && (
        <div>
          {caso.audiencias.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>No hay audiencias/plazos cargados.</div>
          ) : caso.audiencias.map(a => {
            const d = daysUntil(a.fecha);
            const border = d < 7 ? '#991b1b' : d < 15 ? '#d97706' : 'var(--line-mid)';
            return (
              <div key={a.id} style={{ borderLeft: `4px solid ${border}`, background: 'var(--surface)', border: '1px solid var(--line)', padding: '14px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{a.descripcion}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>{a.fecha} · {a.tipo || 'evento'}</div>
                </div>
                <CalendarButtons fecha={a.fecha} descripcion={a.descripcion} caso_alias={caso.alias || caso.numero_expediente} />
              </div>
            );
          })}
        </div>
      )}

      {tab === 'arthur' && (
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--muted)', marginBottom: '12px' }}>
            Chat judicial para redactar escritos con contexto del expediente.
          </p>
          <Link href={`/judicial/${caso.id}/redactar`} style={{ display: 'inline-block', background: 'var(--accent-navy)', color: 'white', padding: '10px 18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase' }}>
            Abrir Arthur IA →
          </Link>
        </div>
      )}

      <button onClick={() => void handleReviewNow()} disabled={!!demoStep} style={{ marginTop: '24px', width: '100%', background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '20px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '20px', cursor: demoStep ? 'not-allowed' : 'pointer' }}>
        {demoStep || 'Revisar en CEJ ahora →'}
      </button>
    </div>
  );
}
