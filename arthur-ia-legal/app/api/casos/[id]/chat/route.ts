import { generarEscritoJudicial } from '@/lib/ai-service'
import { getCasoById, saveEscritoJudicial } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { id } = await params
    const casoId = Number.parseInt(id, 10)
    const caso = getCasoById(casoId)
    if (!caso) {
      return Response.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const body = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      tipo: string
      instrucciones?: string
    }

    const result = await generarEscritoJudicial(
      body.tipo || 'escrito_generico',
      caso,
      body.instrucciones || '',
      body.messages || []
    )

    if (result.isComplete && result.documentContent) {
      saveEscritoJudicial(casoId, body.tipo || 'escrito_generico', result.documentContent)
    }

    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en chat judicial'
    console.error('[API] POST /casos/[id]/chat error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
