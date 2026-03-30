'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

interface Tramite {
  id: number;
  tipo: string;
  numero_titulo: string;
  anio: string;
  alias: string;
  estado_actual: string;
  deleted_at: string | null;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntilPurge(deletedAt: string | null): number {
  if (!deletedAt) return 30;
  const deleted = new Date(deletedAt);
  const purgeDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((purgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function EliminadosPage() {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function loadData() {
    try {
      const res = await fetch('/api/tramites/deleted');
      const data = await res.json() as Tramite[];
      setTramites(data);
    } catch (err) {
      console.error('Error loading deleted:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleRestore(tramiteId: number) {
    try {
      await fetch(`/api/tramites/${tramiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      await loadData();
    } catch (err) {
      console.error('Error:', err);
    }
  }

  async function handlePermanentDelete(tramiteId: number) {
    try {
      await fetch(`/api/tramites/${tramiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'permanent-delete' }),
      });
      setConfirmId(null);
      await loadData();
    } catch (err) {
      console.error('Error:', err);
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

  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ animation: 'fadeUp 0.4s ease forwards' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
          ELIMINADOS
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400, lineHeight: 1.1 }}>
          Trámites Eliminados
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>
          Los trámites eliminados se borran permanentemente del sistema después de 30 días.
        </p>
      </div>

      <div style={{ marginTop: '32px', background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 100px 1fr 130px 100px 220px',
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
          <span>ELIMINADO</span>
          <span>SE BORRA</span>
          <span>ACCIONES</span>
        </div>

        {tramites.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)', marginBottom: '12px' }}>
              No hay trámites eliminados
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'var(--muted)' }}>
              Los trámites que elimines aparecerán aquí por 30 días antes de borrarse definitivamente
            </div>
          </div>
        ) : (
          tramites.map((t) => {
            const daysLeft = daysUntilPurge(t.deleted_at);
            return (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 100px 1fr 130px 100px 220px',
                  padding: '0 24px',
                  height: '64px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--line-faint)',
                  gap: '16px',
                  opacity: 0.7,
                }}
              >
                <div><StatusBadge estado={t.estado_actual} /></div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                  {tipoText(t.tipo)}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  {t.alias}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)' }}>
                  {formatDate(t.deleted_at)}
                </div>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '12px',
                  color: daysLeft <= 7 ? '#991b1b' : 'var(--muted)',
                  fontWeight: daysLeft <= 7 ? 600 : 400,
                }}>
                  {daysLeft}d
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleRestore(t.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--line-strong)',
                      borderRadius: 0,
                      padding: '6px 12px',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#166534',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(22,101,52,0.06)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Restaurar
                  </button>
                  {confirmId === t.id ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button
                        onClick={() => handlePermanentDelete(t.id)}
                        style={{
                          background: '#991b1b',
                          border: 'none',
                          borderRadius: 0,
                          padding: '6px 10px',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--line-strong)',
                          borderRadius: 0,
                          padding: '6px 10px',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(t.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(153,27,27,0.2)',
                        borderRadius: 0,
                        padding: '6px 12px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#991b1b',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(153,27,27,0.04)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Borrar ya
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
