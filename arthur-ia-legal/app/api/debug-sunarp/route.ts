import { NextResponse } from 'next/server'
import { scrapeTitulo, getOficinas } from '@/lib/sunarp-scraper'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const numero = searchParams.get('numero') || '001234'
  const anio = searchParams.get('anio') || '2024'
  const oficina = searchParams.get('oficina') || '0101'
  const tipo = searchParams.get('tipo') || 'predio'
  const listOficinas = searchParams.get('oficinas') === '1'

  if (listOficinas) {
    try {
      const oficinas = await getOficinas()
      return NextResponse.json({ success: true, count: oficinas.length, oficinas })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
  }

  console.log(`[DEBUG] Testing SUNARP: ${numero}/${anio}/${oficina} (${tipo})`)

  try {
    const result = await scrapeTitulo(numero, anio, oficina, tipo)
    return NextResponse.json({
      success: true,
      input: { numero, anio, oficina, tipo },
      result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({ success: false, error: msg, stack }, { status: 500 })
  }
}
