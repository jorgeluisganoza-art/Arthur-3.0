'use server'

import { revalidatePath } from 'next/cache'
import {
  createTituloSiguelo,
  getTituloSigueloById,
  actualizarEstadoTituloSiguelo,
  registrarCambioEstadoSiguelo,
  getUltimoEstadoSiguelo,
  eliminarTituloSiguelo,
  getHistorialSigueloByTituloId,
} from '@/lib/siguelo-db'
import { consultarTitulo, descargarEsquela, descargarAsiento } from '@/lib/siguelo-scraper'
import { enviarConfirmacionAgregado } from '@/lib/siguelo-alertas'
import type { TituloFormState, HistorialEstado } from '@/types/siguelo'

// ── Agregar título (solo guarda, sin consultar SUNARP) ────────────────────────

export async function agregarTitulo(
  _prevState: TituloFormState,
  formData: FormData
): Promise<TituloFormState> {
  const oficina_registral = formData.get('oficina_registral') as string
  const anio_titulo       = Number(formData.get('anio_titulo'))
  const numero_titulo     = formData.get('numero_titulo') as string
  const nombre_cliente    = formData.get('nombre_cliente') as string
  const email_cliente     = formData.get('email_cliente') as string
  const whatsapp_cliente  = formData.get('whatsapp_cliente') as string
  const proyecto          = (formData.get('proyecto') as string) || null
  const asunto            = (formData.get('asunto') as string) || null
  const registro          = (formData.get('registro') as string) || null
  const abogado           = (formData.get('abogado') as string) || null
  const notaria           = (formData.get('notaria') as string) || null

  if (!oficina_registral || !anio_titulo || !numero_titulo || !nombre_cliente || !email_cliente || !whatsapp_cliente) {
    return { error: 'Los campos Oficina, Año, Número, Cliente, Email y WhatsApp son obligatorios.' }
  }

  if (anio_titulo < 1900 || anio_titulo > new Date().getFullYear() + 1) {
    return { error: 'El año del título no es válido.' }
  }

  try {
    createTituloSiguelo({
      oficina_registral,
      anio_titulo,
      numero_titulo,
      nombre_cliente,
      email_cliente,
      whatsapp_cliente,
      proyecto,
      asunto,
      registro,
      abogado,
      notaria,
      ultimo_estado:   null,
      ultima_consulta: null,
      area_registral:  null,
      numero_partida:  null,
    })
    revalidatePath('/dashboard/siguelo')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { error: `Error al guardar: ${message}` }
  }
}

// ── Agregar título + consultar SUNARP inmediatamente ─────────────────────────

export async function agregarYConsultarTitulo(
  formData: FormData
): Promise<{ error?: string; success?: boolean; estado?: string; detalle?: string }> {
  const oficina_registral = formData.get('oficina_registral') as string
  const anio_titulo       = Number(formData.get('anio_titulo'))
  const numero_titulo     = formData.get('numero_titulo') as string
  const nombre_cliente    = formData.get('nombre_cliente') as string
  const email_cliente     = formData.get('email_cliente') as string
  const whatsapp_cliente  = formData.get('whatsapp_cliente') as string
  const proyecto          = (formData.get('proyecto') as string) || null
  const asunto            = (formData.get('asunto') as string) || null
  const registro          = (formData.get('registro') as string) || null
  const abogado           = (formData.get('abogado') as string) || null
  const notaria           = (formData.get('notaria') as string) || null

  if (!oficina_registral || !anio_titulo || !numero_titulo || !nombre_cliente || !email_cliente || !whatsapp_cliente) {
    return { error: 'Los campos Oficina, Año, Número, Cliente, Email y WhatsApp son obligatorios.' }
  }

  if (anio_titulo < 1900 || anio_titulo > new Date().getFullYear() + 1) {
    return { error: 'El año del título no es válido.' }
  }

  // 1. Guardar en DB (síncrono)
  let tituloId: string
  try {
    tituloId = createTituloSiguelo({
      oficina_registral,
      anio_titulo,
      numero_titulo,
      nombre_cliente,
      email_cliente,
      whatsapp_cliente,
      proyecto,
      asunto,
      registro,
      abogado,
      notaria,
      ultimo_estado:   null,
      ultima_consulta: null,
      area_registral:  null,
      numero_partida:  null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { error: `Error al guardar: ${message}` }
  }

  // 2. Consultar SUNARP (async — puede fallar sin perder el título guardado)
  try {
    const resultado = await consultarTitulo({ oficina_registral, anio_titulo, numero_titulo })

    actualizarEstadoTituloSiguelo(
      tituloId,
      resultado.estado,
      resultado.areaRegistral,
      resultado.numeroPartida ?? undefined,
    )

    // Email de confirmación (fire-and-forget — no bloquea si falla)
    const tituloGuardado = getTituloSigueloById(tituloId)
    if (tituloGuardado) {
      enviarConfirmacionAgregado({
        titulo: tituloGuardado,
        estado: resultado.estado,
        detalle: resultado.detalle ?? undefined,
        registradoEn: new Date().toISOString(),
      }).catch((err) => {
        console.error('[siguelo/actions] Error al enviar email de confirmación:', err instanceof Error ? err.message : err)
      })
    }

    revalidatePath('/dashboard/siguelo')
    return { success: true, estado: resultado.estado, detalle: resultado.detalle ?? undefined }
  } catch {
    // El título ya fue guardado — devolvemos éxito parcial
    revalidatePath('/dashboard/siguelo')
    return { success: true }
  }
}

// ── Eliminar título ───────────────────────────────────────────────────────────

export async function eliminarTituloAction(id: string): Promise<{ error?: string }> {
  try {
    eliminarTituloSiguelo(id)
    revalidatePath('/dashboard/siguelo')
    return {}
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar.'
    console.error('[siguelo/actions] eliminarTituloAction error:', msg)
    return { error: msg }
  }
}

// ── Consultar estado actual en SUNARP ─────────────────────────────────────────

export async function consultarAhora(
  id: string
): Promise<{ estado?: string; detalle?: string; error?: string }> {
  try {
    const titulo = getTituloSigueloById(id)
    if (!titulo) return { error: 'Título no encontrado.' }

    const resultado = await consultarTitulo({
      oficina_registral: titulo.oficina_registral,
      anio_titulo:       titulo.anio_titulo,
      numero_titulo:     titulo.numero_titulo,
    })

    // Detectar cambio y registrar en historial
    const estadoAnterior = getUltimoEstadoSiguelo(id)
    if (estadoAnterior !== null && estadoAnterior !== resultado.estado) {
      registrarCambioEstadoSiguelo({
        titulo_id:       id,
        estado_anterior: estadoAnterior,
        estado_nuevo:    resultado.estado,
      })
    }

    actualizarEstadoTituloSiguelo(
      id,
      resultado.estado,
      resultado.areaRegistral,
      resultado.numeroPartida ?? undefined,
    )
    revalidatePath('/dashboard/siguelo')

    return { estado: resultado.estado, detalle: resultado.detalle ?? undefined }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al consultar.' }
  }
}

// ── Descargar asiento de inscripción ─────────────────────────────────────────

export async function descargarAsientoAction(
  id: string
): Promise<{ pdf?: string; error?: string }> {
  try {
    let titulo = getTituloSigueloById(id)
    if (!titulo) return { error: 'Título no encontrado.' }

    // Si falta area_registral, consultar SUNARP primero
    if (!titulo.area_registral) {
      const resultado = await consultarTitulo({
        oficina_registral: titulo.oficina_registral,
        anio_titulo:       titulo.anio_titulo,
        numero_titulo:     titulo.numero_titulo,
      })
      actualizarEstadoTituloSiguelo(id, resultado.estado, resultado.areaRegistral, resultado.numeroPartida ?? undefined)
      revalidatePath('/dashboard/siguelo')
      titulo = getTituloSigueloById(id)
      if (!titulo) return { error: 'Título no encontrado.' }
    }

    if (!titulo.area_registral) return { error: 'No se pudo obtener el área registral de SUNARP.' }

    const { pdf, numeroPartida } = await descargarAsiento({
      oficina_registral: titulo.oficina_registral,
      anio_titulo:       titulo.anio_titulo,
      numero_titulo:     titulo.numero_titulo,
      area_registral:    titulo.area_registral,
    })

    // Guardar numero_partida si aún no estaba
    if (numeroPartida && !titulo.numero_partida) {
      actualizarEstadoTituloSiguelo(id, titulo.ultimo_estado ?? '', titulo.area_registral, numeroPartida)
    }

    return { pdf }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al descargar asiento.' }
  }
}

// ── Descargar esquela ─────────────────────────────────────────────────────────

export async function descargarEsquelaAction(
  id: string
): Promise<{ pdfs?: string[]; error?: string }> {
  try {
    const titulo = getTituloSigueloById(id)
    if (!titulo) return { error: 'Título no encontrado.' }
    if (!titulo.ultimo_estado)  return { error: 'El título no tiene estado registrado.' }
    if (!titulo.area_registral) return { error: 'Consulta el estado del título primero para obtener el área registral.' }

    const pdfs = await descargarEsquela({
      oficina_registral: titulo.oficina_registral,
      anio_titulo:       titulo.anio_titulo,
      numero_titulo:     titulo.numero_titulo,
      area_registral:    titulo.area_registral,
      estado:            titulo.ultimo_estado,
    })
    return { pdfs }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al descargar esquela.' }
  }
}

// ── Historial de estados ──────────────────────────────────────────────────────

export async function getHistorialAction(id: string): Promise<HistorialEstado[]> {
  try {
    return getHistorialSigueloByTituloId(id)
  } catch {
    return []
  }
}
