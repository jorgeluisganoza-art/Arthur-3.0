'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

interface Tramite {
  id: number;
  tipo: string;
  numero_titulo: string;
  anio: string;
  alias: string;
  estado_actual: string;
  archived_at: string | null;
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

export default function ArchivadosPage() {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch('/api/tramites/archived');
      const data = await res.json() as Tramite[];
      setTramites(data);
    } catch (err) {
      console.error('Error loading archived:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAction(tramiteId: number, action: 'restore' | 'soft-delete') {
    try {
      await fetch(`/api/tramites/${tramiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
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
          ARCHIVADOS
        </div>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--ink)', fontWeight: 400, lineHeight: 1.1 }}>
          Trámites Archivados
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>
          Trámites que ya no necesitan seguimiento activo. Puedes restaurarlos en cualquier momento.
        </p>
      </div>

      <div style={{ marginTop: '32px', background: 'white', border: '1px solid rgba(15,15,15,0.08)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 100px 1fr 130px 130px 200px',
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
          <span>ARCHIVADO</span>
          <span>ACCIONES</span>
        </div>

        {tramites.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '24px', color: 'var(--ink)', marginBottom: '12px' }}>
              No hay trámites archivados
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'var(--muted)' }}>
              Cuando archives un trámite desde la vista principal, aparecerá aquí
            </div>
          </div>
        ) : (
          tramites.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 100px 1fr 130px 130px 200px',
                padding: '0 24px',
                height: '64px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(15,15,15,0.06)',
                gap: '16px',
              }}
            >
              <div><StatusBadge estado={t.estado_actual} /></div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--muted)' }}>
                {tipoText(t.tipo)}
              </div>
              <div>
                <Link
                  href={`/dashboard/tramites/${t.id}`}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}
                >
                  {t.alias}
                </Link>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--muted)' }}>
                {t.numero_titulo}/{t.anio}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--muted)' }}>
                {formatDate(t.archived_at)}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAction(t.id, 'restore')}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(15,15,15,0.15)',
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
                <button
                  onClick={() => handleAction(t.id, 'soft-delete')}
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
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
