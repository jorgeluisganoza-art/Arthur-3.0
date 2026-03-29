import { chatWithProvider, listAvailableProviders, type ChatMsg, type Provider } from '@/lib/llm-providers';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      messages: ChatMsg[];
      provider?: Provider;
    };

    const result = await chatWithProvider(body.messages, body.provider);
    return Response.json(result);
  } catch (error) {
    console.error('[API] POST /chat error:', error instanceof Error ? error.message : error);
    return Response.json(
      { error: 'Error al procesar la consulta. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ providers: listAvailableProviders() });
}
