import Anthropic from '@anthropic-ai/sdk'
import getDb from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      messages: ChatMessage[]
      casoId?: number
      mode?: 'legal' | 'document' | 'case'
    }

    const { messages, casoId } = body

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const lastContent = messages[messages.length - 1]?.content || ''
    const hasDocument = /redactar|escrito|demanda|contestaci|apelaci/i.test(lastContent)
    const hasCaso = !!casoId

    let systemPrompt = ''

    if (hasCaso) {
      const db = getDb()
      const caso = db.prepare('SELECT * FROM casos WHERE id = ?').get(casoId) as Record<string, unknown> | undefined
      const movimientos = db.prepare(
        'SELECT * FROM movimientos WHERE caso_id = ? ORDER BY scraped_at DESC LIMIT 10'
      ).all(casoId) as Array<{ fecha: string; acto: string; sumilla: string }>
      const audiencias = db.prepare(
        'SELECT * FROM audiencias WHERE caso_id = ? AND completado = 0 ORDER BY fecha ASC'
      ).all(casoId) as Array<{ descripcion: string; fecha: string; tipo: string }>

      const today = new Date().toISOString().split('T')[0]

      systemPrompt = `Eres Arthur-IA, asistente legal peruano.
El abogado pregunta sobre este caso específico:

EXPEDIENTE: ${caso?.numero_expediente || 'Desconocido'}
ALIAS: ${caso?.alias || '—'}
TIPO: ${caso?.tipo_proceso || '—'}
JUZGADO: ${caso?.organo_jurisdiccional || 'No especificado'}
PARTES: ${caso?.partes || 'No especificado'}
CLIENTE: ${caso?.cliente || 'No especificado'}
ÚLTIMO MOVIMIENTO: ${caso?.ultimo_movimiento || 'Sin movimientos'} (${caso?.ultimo_movimiento_fecha || 'fecha desconocida'})

MOVIMIENTOS RECIENTES:
${movimientos.map(m => `- ${m.fecha}: ${m.acto} — ${m.sumilla}`).join('\n') || 'Sin movimientos registrados'}

PLAZOS PENDIENTES:
${audiencias.map(a => `- ${a.descripcion}: ${a.fecha} (${a.tipo})`).join('\n') || 'Sin plazos registrados'}

Fecha de hoy: ${today}

INSTRUCCIONES:
- Responde SOLO basándote en la información de este caso
- Si te preguntan por plazos, calcula los días restantes desde hoy
- Si no tienes la información solicitada, dilo claramente
- Responde en español, de forma concisa y práctica
- Si detectas urgencia en la pregunta, destácalo claramente`

    } else if (hasDocument) {
      systemPrompt = `Eres Arthur-IA, asistente legal especializado en redacción de escritos judiciales peruanos.

Ayuda al abogado a redactar el documento que necesita.
Haz máximo 5 preguntas antes de generar el documento completo.
Usa formato legal peruano formal (CPC, CC, normas vigentes).
Cuando el documento esté completo, incluye al final: ---DOCUMENTO_COMPLETO---`

    } else {
      systemPrompt = `Eres Arthur-IA, asistente legal especializado en derecho peruano (civil, laboral, penal, familia, comercial, registral, contencioso-administrativo).

Responde consultas legales con precisión citando:
- El artículo y código/ley aplicable
- Jurisprudencia relevante si aplica
- Plazos procesales cuando corresponda

Sé conciso y práctico. Siempre indica al final:
"Esta respuesta es orientativa. Consulta con un abogado para tu caso específico."`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const messageText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const isDocument = messageText.includes('---DOCUMENTO_COMPLETO---')

    return Response.json({ message: messageText, isDocument })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API] POST /api/chat/global error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
