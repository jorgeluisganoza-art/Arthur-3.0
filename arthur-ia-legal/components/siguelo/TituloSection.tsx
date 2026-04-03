'use client'

import { useState } from 'react'
import { getEstadoStyle, ESTADOS_CON_ESQUELA, LABEL_ESQUELA, normalizarEstado } from '@/lib/siguelo-estados'
import EstadoBadge from '@/components/siguelo/EstadoBadge'
import TituloDetailModal from '@/components/siguelo/TituloDetailModal'
import type { Titulo } from '@/types/siguelo'

const DownloadIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
)

// ── Descarga rápida en la fila — links directos a la API route (compatible Safari iOS) ──
function RowDownloads({ titulo }: { titulo: Titulo }) {
  const estadoNorm = normalizarEstado(titulo.ultimo_estado ?? '')
  const tieneEsquela = ESTADOS_CON_ESQUELA.has(estadoNorm) && !!titulo.area_registral
  const tieneAsiento = estadoNorm === 'INSCRITO' && !!titulo.area_registral
  const label = LABEL_ESQUELA[estadoNorm]

  if (!tieneEsquela && !tieneAsiento) return null

  return (
    <div className="flex items-center gap-2">
      {tieneEsquela && label && (
        <a
          href={`/api/siguelo/descargar-esquela?id=${titulo.id}&index=0`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Descargar ${label.plural}`}
          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
        >
          <DownloadIcon />
          <span className="hidden sm:inline">{label.plural}</span>
        </a>
      )}
      {tieneAsiento && (
        <a
          href={`/api/siguelo/descargar-asiento?id=${titulo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Descargar asiento de inscripción"
          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
        >
          <DownloadIcon />
          <span className="hidden sm:inline">Asiento</span>
        </a>
      )}
    </div>
  )
}

// ── Sección colapsable por estado ─────────────────────────────────────────────
export default function TituloSection({
  estado,
  titulos,
}: {
  estado: string
  titulos: Titulo[]
}) {
  const [expanded, setExpanded] = useState(true)
  const [selected, setSelected] = useState<Titulo | null>(null)

  const style = getEstadoStyle(estado) ?? { bg: '#F3F4F6', text: '#374151' }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Encabezado colapsable */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            {estado}
          </span>
          <span className="text-sm text-gray-400 font-medium">
            {titulos.length} {titulos.length === 1 ? 'título' : 'títulos'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Tabla de títulos */}
      {expanded && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50/70">
                <th className="px-4 py-2.5 whitespace-nowrap">Nº Título</th>
                <th className="px-4 py-2.5">Oficina</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Asunto</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Estado</th>
                <th className="px-4 py-2.5">Descargas</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {titulos.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-t border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-gray-900 tabular-nums">{t.numero_titulo}</div>
                    <div className="text-xs text-gray-400">{t.anio_titulo}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[100px]">
                    <span className="truncate block" title={t.oficina_registral}>{t.oficina_registral}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium max-w-[140px]">
                    <span className="truncate block" title={t.nombre_cliente}>{t.nombre_cliente}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px]">
                    <span className="truncate block" title={t.asunto ?? ''}>
                      {t.asunto ?? <span className="text-gray-300">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.ultimo_estado
                      ? <EstadoBadge estado={t.ultimo_estado} />
                      : <span className="text-xs text-gray-300">Sin consultar</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <RowDownloads titulo={t} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(t)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalle */}
      {selected && (
        <TituloDetailModal
          titulo={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
