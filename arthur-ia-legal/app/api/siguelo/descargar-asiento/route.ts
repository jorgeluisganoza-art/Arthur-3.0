import { NextRequest, NextResponse } from 'next/server'
import { getTituloSigueloById, actualizarEstadoTituloSiguelo } from '@/lib/siguelo-db'
import { descargarAsiento } from '@/lib/siguelo-scraper'

/**
 * GET /api/siguelo/descargar-asiento?id={tituloId}
 *
 * Devuelve el PDF del asiento de inscripción como respuesta HTTP.
 * Compatible con Safari iOS (que bloquea blob/data-URL downloads desde JS).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Parámetro id requerido.' }, { status: 400 })
  }

  const titulo = getTituloSigueloById(id)
  if (!titulo) {
    return NextResponse.json({ error: 'Título no encontrado.' }, { status: 404 })
  }

  if (!titulo.area_registral) {
    return NextResponse.json(
      { error: 'Consulta el estado del título primero para obtener el área registral.' },
      { status: 400 }
    )
  }

  let pdf: string
  let numeroPartida: string
  try {
    const resultado = await descargarAsiento({
      oficina_registral: titulo.oficina_registral,
      anio_titulo: titulo.anio_titulo,
      numero_titulo: titulo.numero_titulo,
      area_registral: titulo.area_registral,
    })
    pdf = resultado.pdf
    numeroPartida = resultado.numeroPartida
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al obtener asiento.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Guardar numeroPartida si aún no estaba en la DB
  if (numeroPartida && !titulo.numero_partida) {
    try {
      actualizarEstadoTituloSiguelo(id, titulo.ultimo_estado ?? '', titulo.area_registral, numeroPartida)
    } catch { /* no bloquear la descarga si falla el guardado */ }
  }

  const buffer = Buffer.from(pdf, 'base64')
  const filename = `asiento-inscripcion-${titulo.numero_titulo}.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
}
