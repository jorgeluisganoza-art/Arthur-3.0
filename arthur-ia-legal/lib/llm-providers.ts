import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ProviderResponse {
  text: string;
  provider: Provider;
}

const SYSTEM_PROMPT = `Eres Arthur, un asistente legal IA especializado en derecho peruano, con énfasis en:
- Derecho registral y trámites SUNARP
- Jurisprudencia del Tribunal Registral y Tribunal Constitucional
- Código Civil, Ley de Procedimiento Administrativo General, Reglamento General de los Registros Públicos
- Búsqueda y análisis de leyes, decretos y resoluciones peruanas

REGLAS:
1. Responde siempre en español
2. Cita artículos, leyes y resoluciones específicas cuando sea posible
3. Si no estás seguro de una norma exacta, indícalo claramente
4. Incluye siempre un disclaimer al final: "⚠ Esta información es orientativa. Consulta con un abogado colegiado antes de actuar."
5. Sé conciso pero completo
6. Si te piden jurisprudencia, menciona número de resolución, fecha y sumilla cuando los conozcas
7. Estructura tus respuestas con secciones claras cuando sean extensas`;

async function callAnthropic(messages: ChatMsg[]): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

async function callOpenAI(messages: ChatMsg[]): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  });
  return response.choices[0]?.message?.content || '';
}

async function callGemini(messages: ChatMsg[]): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  });
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));
  const chat = model.startChat({ history });
  const lastMsg = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMsg.content);
  return result.response.text();
}

function getAvailableProviders(): Provider[] {
  const available: Provider[] = [];
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder') available.push('anthropic');
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'placeholder') available.push('openai');
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder') available.push('gemini');
  return available;
}

export function listAvailableProviders(): Provider[] {
  return getAvailableProviders();
}

export async function chatWithProvider(
  messages: ChatMsg[],
  preferredProvider?: Provider
): Promise<ProviderResponse> {
  const available = getAvailableProviders();
  if (available.length === 0) {
    return {
      text: 'No hay ningún proveedor de IA configurado. Añade al menos una API key (ANTHROPIC_API_KEY, OPENAI_API_KEY o GEMINI_API_KEY) en las variables de entorno.',
      provider: 'anthropic',
    };
  }

  const provider = preferredProvider && available.includes(preferredProvider)
    ? preferredProvider
    : available[0];

  const callers: Record<Provider, (msgs: ChatMsg[]) => Promise<string>> = {
    anthropic: callAnthropic,
    openai: callOpenAI,
    gemini: callGemini,
  };

  try {
    const text = await callers[provider](messages);
    return { text, provider };
  } catch (error) {
    const fallback = available.find(p => p !== provider);
    if (fallback) {
      console.warn(`[LLM] ${provider} failed, falling back to ${fallback}`);
      const text = await callers[fallback](messages);
      return { text, provider: fallback };
    }
    throw error;
  }
}
