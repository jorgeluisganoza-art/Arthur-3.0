import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import getDb from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const casoId = parseInt(id, 10)
    const body = await request.json() as { actuacionId?: number; acto?: string; sumilla?: string }
    const { actuacionId, acto, sumilla } = body

    if (!acto) {
      return NextResponse.json({ error: 'acto requerido' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `Eres Arthur-IA, experto en derecho procesal peruano.
Analiza este acto judicial y responde CONCISAMENTE en 4 puntos:

1. ¿Qué significa este acto en el proceso?
2. ¿Requiere alguna acción del abogado? ¿Cuál y en qué plazo?
3. ¿Es favorable o desfavorable para las partes?
4. ¿Qué artículo del CPC o ley aplica?

Máximo 3 oraciones por punto. Responde en español, sin encabezados extra.`,
      messages: [
        { role: 'user', content: `Acto: ${acto}\nSumilla: ${sumilla || 'Sin sumilla'}` }
      ]
    })

    const analisis = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Save to DB if we have a valid actuacionId
    if (actuacionId && casoId) {
      try {
        getDb().prepare(
          'UPDATE movimientos SET ai_analisis = ? WHERE id = ? AND caso_id = ?'
        ).run(analisis, actuacionId, casoId)
      } catch {
        // Non-fatal if DB update fails
      }
    }

    return NextResponse.json({ analisis })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[analizar-actuacion] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
