import { getTramiteById } from '@/lib/db';
import { chatDocument, ChatMessage } from '@/lib/ai-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const tramiteId = parseInt(id);
    const tramite = getTramiteById(tramiteId);

    if (!tramite) {
      return Response.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const body = await request.json() as {
      messages: ChatMessage[];
      documentType: string;
    };

    const { messages, documentType } = body;

    const tramiteContext = {
      tipo: tramite.tipo,
      alias: tramite.alias,
      numero: tramite.numero_titulo,
      oficina: tramite.oficina_nombre || tramite.oficina_registral,
      observacionText: tramite.observacion_texto,
    };

    const result = await chatDocument(messages, tramiteContext, documentType);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en el chat';
    console.error('[API] POST /tramites/[id]/chat error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
