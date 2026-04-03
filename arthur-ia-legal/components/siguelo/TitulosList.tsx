import { getTitulosSiguelo } from '@/lib/siguelo-db'
import type { Titulo } from '@/types/siguelo'
import { STATE_ORDER, normalizarEstado } from '@/lib/siguelo-estados'
import TituloSection from '@/components/siguelo/TituloSection'

export default function TitulosList() {
  let titulos: Titulo[] = []
  let errorMsg: string | null = null

  try {
    titulos = getTitulosSiguelo()
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Error al cargar los títulos.'
  }

  if (errorMsg) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-8 text-center text-sm text-red-600">
        {errorMsg}
      </div>
    )
  }

  if (titulos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-12 text-center text-sm text-gray-400">
        No hay títulos registrados aún.
      </div>
    )
  }

  // Agrupar por estado normalizado (sin acentos, mayúsculas)
  const grouped = new Map<string, { titulos: Titulo[] }>()

  for (const t of titulos) {
    const normKey = normalizarEstado(t.ultimo_estado ?? '')
    if (!grouped.has(normKey)) grouped.set(normKey, { titulos: [] })
    grouped.get(normKey)!.titulos.push(t)
  }

  // Secciones en el orden canónico definido en STATE_ORDER
  const sections: { estado: string; titulos: Titulo[] }[] = []
  const usedKeys = new Set<string>()

  for (const canonico of STATE_ORDER) {
    const normKey = normalizarEstado(canonico)
    const entry = grouped.get(normKey)
    if (entry && entry.titulos.length > 0) {
      sections.push({ estado: canonico, titulos: entry.titulos })
      usedKeys.add(normKey)
    }
  }

  // Estados no contemplados en STATE_ORDER → sección "Otros"
  const otros: Titulo[] = []
  for (const [normKey, entry] of grouped.entries()) {
    if (!usedKeys.has(normKey)) {
      otros.push(...entry.titulos)
    }
  }
  if (otros.length > 0) {
    sections.push({ estado: 'OTROS', titulos: otros })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-gray-700">Títulos monitoreados</h2>
        <span className="text-sm text-gray-400">
          {titulos.length} {titulos.length === 1 ? 'título' : 'títulos'} · {sections.length} {sections.length === 1 ? 'sección' : 'secciones'}
        </span>
      </div>

      {sections.map(({ estado, titulos: items }) => (
        <TituloSection key={estado} estado={estado} titulos={items} />
      ))}
    </div>
  )
}
