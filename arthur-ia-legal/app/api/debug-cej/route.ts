import { NextResponse } from 'next/server'
import { scrapeCEJ } from '@/lib/cej-scraper'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const numero = searchParams.get('numero') || '10001-2022-0-1801-JR-CI-01'

  try {
    const result = await scrapeCEJ(numero)
    return NextResponse.json({
      success: true,
      input: { numero },
      result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
