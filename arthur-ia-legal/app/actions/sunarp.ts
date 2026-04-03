'use server'

import {
  createTituloSunarp,
  getTituloSunarpById,
  updateTituloSunarp,
  deleteTituloSunarp,
  addHistorialSunarp,
  type TituloSunarp,
} from '@/lib/db'
import {
  consultarTituloSUNARP,
  descargarEsquela,
  descargarAsiento,
  descargarPartidas,
} from '@/lib/sunarp-scraper'
import { enviarConfirmacionAgregado } from '@/lib/alertas-sunarp'

// ── Agregar título ────────────────────────────────────────────────────────────

export async function agregarTituloSunarp(formData: FormData): Promise<{
  ok: boolean
  id?: number
  estado?: string
  error?: string
}> {
  const oficina = String(formData.get('oficina_registral') ?? '').trim()
  const oficinaNombre = String(formData.get('oficina_nombre') ?? '').trim()
  const anio = String(formData.get('anio_titulo') ?? '').trim()
  const numero = String(formData.get('numero_titulo') ?? '').trim()
  const nombre = String(formData.get('nombre_cliente') ?? '').trim()
  const email = String(formData.get('email_cliente') ?? '').trim() || null
  const whatsapp = String(formData.get('whatsapp_cliente') ?? '').trim() || null

  if (!oficina || !anio || !numero || !nombre) {
    return { ok: false, error: 'Faltan campos obligatorios' }
  }

  try {
    // Consult initial state
    const result = await consultarTituloSUNARP(oficina, anio, numero)

    const titulo = createTituloSunarp({
      oficina_registral: oficina,
      oficina_nombre: oficinaNombre || null,
      anio_titulo: anio,
      numero_titulo: numero,
      nombre_cliente: nombre,
      email_cliente: email,
      whatsapp_cliente: whatsapp,
    })

    // Update with consulted state
    updateTituloSunarp(titulo.id, {
      ultimo_estado: result.estado,
      ultima_consulta: result.scrapedAt,
      area_registral: result.areaRegistral || null,
      numero_partida: result.numeroPartida || null,
    })

    // Log first historial entry
    addHistorialSunarp(titulo.id, null, result.estado)

    // Send confirmation email (non-blocking)
    if (email) {
      enviarConfirmacionAgregado(email, {
        nombreCliente: nombre,
        numeroTitulo: numero,
        anioTitulo: anio,
        oficinaNombre: oficinaNombre || oficina,
        estadoInicial: result.estado,
        tituloId: titulo.id,
      }).catch(() => {})
    }

    return { ok: true, id: titulo.id, estado: result.estado }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ── Consultar ahora ───────────────────────────────────────────────────────────

export async function consultarAhoraSunarp(id: number): Promise<{
  ok: boolean
  estado?: string
  changed?: boolean
  portalDown?: boolean
  error?: string
}> {
  const titulo = getTituloSunarpById(id)
  if (!titulo) return { ok: false, error: 'Título no encontrado' }

  try {
    const result = await consultarTituloSUNARP(
      titulo.oficina_registral,
      titulo.anio_titulo,
      titulo.numero_titulo,
    )

    updateTituloSunarp(id, { ultima_consulta: new Date().toISOString() })

    if (result.portalDown) return { ok: true, estado: titulo.ultimo_estado, changed: false, portalDown: true }

    const changed = result.estado !== titulo.ultimo_estado && result.estado !== 'SIN DATOS'

    updateTituloSunarp(id, {
      ultimo_estado: result.estado,
      area_registral: result.areaRegistral || titulo.area_registral,
      numero_partida: result.numeroPartida || titulo.numero_partida,
    })

    if (changed) addHistorialSunarp(id, titulo.ultimo_estado, result.estado)

    return { ok: true, estado: result.estado, changed, portalDown: false }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al consultar' }
  }
}

// ── Eliminar título ───────────────────────────────────────────────────────────

export async function eliminarTituloSunarp(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    deleteTituloSunarp(id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al eliminar' }
  }
}

// ── Descargar esquela ─────────────────────────────────────────────────────────

export async function descargarEsquelaSunarp(id: number): Promise<{
  ok: boolean
  pdfs?: string[]
  error?: string
}> {
  const titulo = getTituloSunarpById(id)
  if (!titulo) return { ok: false, error: 'Título no encontrado' }

  try {
    const pdfs = await descargarEsquela({
      numeroTitulo: titulo.numero_titulo,
      anioTitulo: titulo.anio_titulo,
      oficina: titulo.oficina_registral,
    })

    if (pdfs.length === 0) return { ok: false, error: 'No se encontraron esquelas para este título' }

    return { ok: true, pdfs }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al descargar esquela' }
  }
}

// ── Descargar asiento ─────────────────────────────────────────────────────────

export async function descargarAsientoSunarp(id: number): Promise<{
  ok: boolean
  pdf?: string
  numeroPartida?: string
  error?: string
}> {
  const titulo = getTituloSunarpById(id)
  if (!titulo) return { ok: false, error: 'Título no encontrado' }

  const numeroPartida = titulo.numero_partida
  if (!numeroPartida) {
    // Try to get partidas first
    try {
      const partidas = await descargarPartidas({
        numeroTitulo: titulo.numero_titulo,
        anioTitulo: titulo.anio_titulo,
        oficina: titulo.oficina_registral,
      })
      if (partidas.length === 0) return { ok: false, error: 'No se encontró número de partida para este título' }
      // Use first partida
      const result = await descargarAsiento({
        numeroPartida: partidas[0].numeroPartida,
        oficina: titulo.oficina_registral,
      })
      updateTituloSunarp(id, { numero_partida: result.numeroPartida })
      return { ok: true, pdf: result.pdf, numeroPartida: result.numeroPartida }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo obtener el asiento' }
    }
  }

  try {
    const result = await descargarAsiento({
      numeroPartida,
      oficina: titulo.oficina_registral,
    })
    return { ok: true, pdf: result.pdf, numeroPartida: result.numeroPartida }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al descargar asiento' }
  }
}
