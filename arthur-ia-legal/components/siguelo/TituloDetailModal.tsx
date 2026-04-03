'use client'

import { useEffect, useState } from 'react'
import { getHistorialAction } from '@/app/siguelo/actions'
import ConsultarButton from '@/components/siguelo/ConsultarButton'
import EstadoBadge from '@/components/siguelo/EstadoBadge'
import type { Titulo, HistorialEstado } from '@/types/siguelo'

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-5">{label}</span>
      <span className="text-sm text-gray-800 break-words">{value}</span>
    </div>
  )
}

export default function TituloDetailModal({
  titulo,
  onClose,
}: {
  titulo: Titulo
  onClose: () => void
}) {
  const [historial, setHistorial] = useState<HistorialEstado[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(true)

  useEffect(() => {
    getHistorialAction(titulo.id).then(h => {
      setHistorial(h)
      setLoadingHistorial(false)
    })
  }, [titulo.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const ultimaConsulta = titulo.ultima_consulta
    ? new Date(titulo.ultima_consulta).toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4" style={{ backgroundColor: '#1e3a5f' }}>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {titulo.oficina_registral} · {titulo.anio_titulo}
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">
              Título {titulo.numero_titulo}
            </h2>
            {titulo.ultimo_estado && (
              <div className="mt-2">
                <EstadoBadge estado={titulo.ultimo_estado} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">

          {/* ── Información del título ───────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Título Registral
            </h3>
            <div className="bg-gray-50 rounded-xl px-4 py-2">
              <InfoRow label="Número" value={`${titulo.numero_titulo} / ${titulo.anio_titulo}`} />
              <InfoRow label="Oficina" value={titulo.oficina_registral} />
              <InfoRow label="Registro" value={titulo.registro} />
              <InfoRow label="Área registral" value={titulo.area_registral} />
              <InfoRow label="Nº de partida" value={titulo.numero_partida} />
            </div>
          </section>

          {/* ── Cliente ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Cliente
            </h3>
            <div className="bg-gray-50 rounded-xl px-4 py-2">
              <InfoRow label="Cliente" value={titulo.nombre_cliente} />
              <InfoRow label="Email(s)" value={titulo.email_cliente} />
              <InfoRow label="WhatsApp(s)" value={titulo.whatsapp_cliente} />
            </div>
          </section>

          {/* ── Expediente ───────────────────────────────────────── */}
          {(titulo.proyecto || titulo.asunto || titulo.abogado || titulo.notaria) && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Expediente
              </h3>
              <div className="bg-gray-50 rounded-xl px-4 py-2">
                <InfoRow label="Proyecto" value={titulo.proyecto} />
                <InfoRow label="Asunto" value={titulo.asunto} />
                <InfoRow label="Abogado a cargo" value={titulo.abogado} />
                <InfoRow label="Notaría / Presentante" value={titulo.notaria} />
              </div>
            </section>
          )}

          {/* ── Estado y acciones ────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Estado y acciones
            </h3>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              {ultimaConsulta && (
                <p className="text-xs text-gray-400 mb-3">
                  Última consulta: {ultimaConsulta}
                </p>
              )}
              <ConsultarButton
                tituloId={titulo.id}
                ultimoEstado={titulo.ultimo_estado}
                areaRegistral={titulo.area_registral}
                onEliminar={onClose}
              />
            </div>
          </section>

          {/* ── Historial de estados ─────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Historial de estados
            </h3>
            {loadingHistorial ? (
              <div className="text-xs text-gray-400 py-2">Cargando historial…</div>
            ) : historial.length === 0 ? (
              <div className="text-xs text-gray-400 py-2 bg-gray-50 rounded-xl px-4">
                Sin cambios de estado registrados.
              </div>
            ) : (
              <div className="space-y-2">
                {historial.map((h) => {
                  const fecha = new Date(h.detectado_en).toLocaleString('es-PE', {
                    timeZone: 'America/Lima',
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5"
                    >
                      <EstadoBadge estado={h.estado_anterior} />
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <EstadoBadge estado={h.estado_nuevo} />
                      <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{fecha}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
