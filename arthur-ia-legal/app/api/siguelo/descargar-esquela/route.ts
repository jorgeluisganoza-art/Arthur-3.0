import { NextRequest, NextResponse } from 'next/server'
import { getTituloSigueloById } from '@/lib/siguelo-db'
import { descargarEsquela } from '@/lib/siguelo-scraper'

/**
 * GET /api/siguelo/descargar-esquela?id={tituloId}&index={n}
 *
 * Devuelve el PDF de la esquela como respuesta HTTP con Content-Type: application/pdf.
 * Compatible con Safari iOS (que bloquea blob/data-URL downloads desde JS).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const index = parseInt(searchParams.get('index') ?? '0', 10)

  if (!id) {
    return NextResponse.json({ error: 'Parámetro id requerido.' }, { status: 400 })
  }

  const titulo = getTituloSigueloById(id)
  if (!titulo) {
    return NextResponse.json({ error: 'Título no encontrado.' }, { status: 404 })
  }
  if (!titulo.ultimo_estado) {
    return NextResponse.json({ error: 'El título no tiene estado registrado.' }, { status: 400 })
  }
  if (!titulo.area_registral) {
    return NextResponse.json(
      { error: 'Consulta el estado del título primero para obtener el área registral.' },
      { status: 400 }
    )
  }

  let pdfs: string[]
  try {
    pdfs = await descargarEsquela({
      oficina_registral: titulo.oficina_registral,
      anio_titulo: titulo.anio_titulo,
      numero_titulo: titulo.numero_titulo,
      area_registral: titulo.area_registral,
      estado: titulo.ultimo_estado,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al obtener esquela.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const pdf = pdfs[index]
  if (!pdf) {
    return NextResponse.json(
      { error: `No existe esquela en el índice ${index}. Total: ${pdfs.length}` },
      { status: 404 }
    )
  }

  const buffer = Buffer.from(pdf, 'base64')
  const estado = titulo.ultimo_estado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filename = `esquela-${estado}-${index + 1}-${titulo.numero_titulo}.pdf`

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
