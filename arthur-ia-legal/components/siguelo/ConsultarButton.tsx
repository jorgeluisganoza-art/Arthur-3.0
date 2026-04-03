'use client'

import { useState, useTransition } from 'react'
import { consultarAhora, eliminarTituloAction, descargarEsquelaAction } from '@/app/siguelo/actions'
import { ESTADOS_CON_ESQUELA, LABEL_ESQUELA } from '@/lib/siguelo-estados'
import EstadoBadge from '@/components/siguelo/EstadoBadge'

export default function ConsultarButton({
  tituloId,
  ultimoEstado,
  areaRegistral,
  onEliminar,
}: {
  tituloId: string
  ultimoEstado: string | null
  areaRegistral: string | null
  onEliminar?: () => void
}) {
  const [result, setResult] = useState<{ estado?: string; detalle?: string; error?: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [esquelaCount, setEsquelaCount] = useState<number | null>(null)
  const [esquelaError, setEsquelaError] = useState<string | null>(null)
  const [mostrarEsquelas, setMostrarEsquelas] = useState(false)
  const [esquelaPending, startEsquelaTransition] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  const estadoVisible = result?.estado ?? ultimoEstado
  const estadoParaEsquela = (result?.estado ?? ultimoEstado ?? '').toUpperCase()
  const tieneEsquela = ESTADOS_CON_ESQUELA.has(estadoParaEsquela) && areaRegistral !== null
  const tieneAsiento = estadoParaEsquela === 'INSCRITO' && areaRegistral !== null
  const labelEsquela = LABEL_ESQUELA[estadoParaEsquela] ?? { singular: 'Esquela', plural: 'Esquelas' }

  const handleConsultar = () => {
    startTransition(async () => {
      const res = await consultarAhora(tituloId)
      setResult(res)
      setEsquelaCount(null)
      setMostrarEsquelas(false)
    })
  }

  const handleEliminar = () => {
    if (!confirm('¿Eliminar este título y todo su historial de estados?')) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const res = await eliminarTituloAction(tituloId)
      if (res.error) {
        setDeleteError(res.error)
      } else {
        onEliminar?.()
      }
    })
  }

  const handleVerEsquelas = () => {
    if (esquelaCount !== null) { setMostrarEsquelas(v => !v); return }
    startEsquelaTransition(async () => {
      const res = await descargarEsquelaAction(tituloId)
      if (res.error) { setEsquelaError(res.error); return }
      const count = res.pdfs?.length ?? 0
      setEsquelaCount(count)
      setMostrarEsquelas(true)
    })
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col gap-1.5 items-start min-w-[160px]">
        {estadoVisible && !result?.error && <EstadoBadge estado={estadoVisible} />}
        {result?.detalle && (
          <span className="text-xs text-gray-500 leading-tight">{result.detalle}</span>
        )}
        {result?.error && (
          <span className="text-xs text-red-500 leading-tight">{result.error}</span>
        )}
        {deleteError && (
          <span className="text-xs text-red-500 leading-tight">{deleteError}</span>
        )}

        <button
          onClick={handleConsultar}
          disabled={isPending || isDeleting || esquelaPending}
          className="mt-0.5 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isPending ? '⏳ Consultando…' : ultimoEstado ? '↻ Actualizar estado' : 'Consultar ahora'}
        </button>

        {tieneEsquela && (
          <button
            onClick={handleVerEsquelas}
            disabled={isPending || isDeleting || esquelaPending}
            className="text-xs text-emerald-600 hover:text-emerald-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {esquelaPending
              ? '⏳ Cargando…'
              : esquelaCount !== null
                ? (mostrarEsquelas ? `▲ Ocultar (${esquelaCount})` : `▼ ${labelEsquela.plural} (${esquelaCount})`)
                : `↓ ${labelEsquela.plural}`
            }
          </button>
        )}

        {esquelaError && (
          <span className="text-xs text-red-500 leading-tight">{esquelaError}</span>
        )}

        {tieneAsiento && (
          <a
            href={`/api/siguelo/descargar-asiento?id=${tituloId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Asiento
          </a>
        )}

        {mostrarEsquelas && esquelaCount !== null && esquelaCount > 0 && (
          <div className="mt-1 flex flex-col gap-0.5 w-full">
            {Array.from({ length: esquelaCount }, (_, i) => (
              <a
                key={i}
                href={`/api/siguelo/descargar-esquela?id=${tituloId}&index=${i}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-left text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {labelEsquela.singular} {esquelaCount > 1 ? i + 1 : ''}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Botón eliminar */}
      <button
        onClick={handleEliminar}
        disabled={isPending || isDeleting}
        title="Eliminar título"
        className="mt-0.5 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isDeleting ? (
          <span className="text-xs">…</span>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  )
}
