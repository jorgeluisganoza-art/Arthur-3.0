import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

// ── Function 1: getNextStepSuggestion ─────────────────────────────────────

export async function getNextStepSuggestion(
  estado: string,
  observacion: string | null,
  tipo: string,
  alias: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Eres Arthur-IA, asistente legal especializado en SUNARP Perú.
Dado este estado de un trámite registral, genera UNA sugerencia concreta de qué debe hacer el abogado ahora mismo. Máximo 2 oraciones. En español. Sé específico, no genérico.

Tipo de trámite: ${tipo}
Alias: ${alias}
Estado: ${estado}
Observación: ${observacion || 'No hay observación'}

Responde SOLO con la sugerencia, sin introducción.`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type === 'text') return block.text.trim();
    return getDefaultSuggestion(estado);
  } catch (error) {
    console.error('[AI] getNextStepSuggestion error:', error instanceof Error ? error.message : error);
    return getDefaultSuggestion(estado);
  }
}

function getDefaultSuggestion(estado: string): string {
  const defaults: Record<string, string> = {
    OBSERVADO:
      'Tienes un plazo limitado para subsanar las observaciones. Descarga la esquela completa desde el portal SUNARP, revisa los documentos requeridos y presenta el escrito subsanatorio dentro del plazo.',
    TACHA:
      'Tu título ha sido tachado. Tienes 15 días hábiles para interponer recurso de apelación ante el Tribunal Registral. Consulta con un especialista registral de inmediato.',
    INSCRITO:
      'Trámite completado exitosamente. Puedes recoger el título inscrito en la oficina registral correspondiente.',
    PENDIENTE:
      'El registrador tiene hasta 7 días hábiles para calificar el título. No se requiere ninguna acción por tu parte en este momento.',
    'SIN DATOS':
      'No se pudo obtener información del portal SUNARP. Verifica el número de título y la oficina registral.',
  };
  return defaults[estado] || 'Verifica el estado de tu trámite en el portal SUNARP.';
}

// ── Function 2: analyzeEsquela ─────────────────────────────────────────────

export interface EsquelaAnalysis {
  resumen: string;
  observaciones: string[];
  plazoDias: number;
  documentosRequeridos: string[];
  tipoDocumento: 'subsanatorio' | 'apelacion' | 'queja' | 'prorroga';
  siguientePaso: string;
}

export async function analyzeEsquela(
  observacionText: string,
  tipo: string,
  alias: string
): Promise<EsquelaAnalysis> {
  const defaultResult: EsquelaAnalysis = {
    resumen: 'Esquela de observación pendiente de análisis.',
    observaciones: ['Revisar la esquela en el portal SUNARP.'],
    plazoDias: 30,
    documentosRequeridos: ['Documentos señalados en la esquela'],
    tipoDocumento: 'subsanatorio',
    siguientePaso: 'Leer la esquela completa y preparar los documentos de subsanación.',
  };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system:
        'Eres un experto en derecho registral peruano. Analiza esta esquela de observación SUNARP y extrae la información clave. Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto extra.',
      messages: [
        {
          role: 'user',
          content: `Analiza esta esquela de observación SUNARP:

Tipo de trámite: ${tipo}
Alias: ${alias}
Texto de la esquela: ${observacionText}

Responde con este JSON exacto:
{
  "resumen": "resumen en 1-2 oraciones",
  "observaciones": ["observación 1", "observación 2"],
  "plazoDias": 30,
  "documentosRequeridos": ["documento 1", "documento 2"],
  "tipoDocumento": "subsanatorio",
  "siguientePaso": "qué hacer ahora"
}

El campo tipoDocumento debe ser uno de: "subsanatorio", "apelacion", "queja", "prorroga"`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== 'text') return defaultResult;

    const text = block.text.trim();
    const parsed = JSON.parse(text) as EsquelaAnalysis;
    return { ...defaultResult, ...parsed };
  } catch (error) {
    console.error('[AI] analyzeEsquela error:', error instanceof Error ? error.message : error);
    return defaultResult;
  }
}

// ── Function 3: chatDocument ───────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatDocumentContext {
  tipo: string;
  alias: string;
  numero: string;
  oficina: string;
  observacionText: string | null;
}

export interface ChatDocumentResponse {
  message: string;
  documentContent: string;
  isComplete: boolean;
  remainingFields: string[];
}

export async function chatDocument(
  messages: ChatMessage[],
  tramiteContext: ChatDocumentContext,
  documentType: string
): Promise<ChatDocumentResponse> {
  const systemPrompt = `Eres Arthur-IA, asistente legal especializado en redacción de escritos ante SUNARP Perú.

Contexto del trámite:
- Tipo: ${tramiteContext.tipo}
- Alias: ${tramiteContext.alias}
- Número de título: ${tramiteContext.numero}
- Oficina registral: ${tramiteContext.oficina}
- Esquela de observación: ${tramiteContext.observacionText || 'No disponible'}
- Tipo de escrito a redactar: ${documentType}

REGLAS ESTRICTAS:
1. Haz UNA sola pregunta a la vez
2. Cuando tengas nombre completo, DNI, y confirmación de documentos, genera el escrito COMPLETO usando terminología legal peruana
3. Usa [CAMPO] para datos que aún no tienes
4. Cita artículos del Reglamento General de los Registros Públicos
5. El escrito debe estar listo para presentar con mínimas ediciones
6. Termina siempre con el disclaimer de revisión profesional

Tipos de escritos y sus bases legales:
- subsanatorio: Art. 40 Reglamento General RR.PP.
- apelacion: Arts. 142-149 Reglamento General RR.PP., incluye sección 'AGRAVIOS'
- queja: Art. 144, dirigida al Jefe de Zona Registral
- prorroga: Art. 41 Reglamento General RR.PP.

FORMATO DEL ESCRITO cuando lo generes:
SEÑOR REGISTRADOR PÚBLICO / TRIBUNAL REGISTRAL
Zona Registral N° IX - Sede Lima

[TIPO DE ESCRITO EN MAYÚSCULAS]
TÍTULO: [número]
ASUNTO: [asunto]

[NOMBRE], identificado con DNI N° [DNI]...

I. HECHOS
II. FUNDAMENTOS DE DERECHO
III. DOCUMENTOS QUE SE ADJUNTAN
POR TANTO:
PRIMER OTROSÍ DIGO: [si aplica]

[Lugar], [fecha]
[ABOGADO], CAL N° [número]

---
⚠ BORRADOR GENERADO POR ARTHUR-IA LEGAL.
Debe ser revisado por un abogado antes de presentarse ante SUNARP.

IMPORTANTE: Al final de cada respuesta, incluye siempre este JSON en una línea separada:
ARTHUR_DOC_STATE:{"documentContent":"[escrito completo o borrador parcial aquí]","isComplete":false,"remainingFields":["CAMPO1","CAMPO2"]}

Cuando el escrito esté completo (isComplete:true), establece remainingFields como array vacío.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      return {
        message: 'Error al procesar la respuesta.',
        documentContent: '',
        isComplete: false,
        remainingFields: [],
      };
    }

    const fullText = block.text;

    // Extract doc state JSON
    const docStateMatch = fullText.match(/ARTHUR_DOC_STATE:(\{[\s\S]*\})/);
    let documentContent = '';
    let isComplete = false;
    let remainingFields: string[] = [];

    if (docStateMatch) {
      try {
        const state = JSON.parse(docStateMatch[1]) as {
          documentContent: string;
          isComplete: boolean;
          remainingFields: string[];
        };
        documentContent = state.documentContent || '';
        isComplete = state.isComplete || false;
        remainingFields = state.remainingFields || [];
      } catch {
        // parse error, use defaults
      }
    }

    // Clean message (remove the JSON state line)
    const message = fullText.replace(/ARTHUR_DOC_STATE:\{[\s\S]*\}/, '').trim();

    return { message, documentContent, isComplete, remainingFields };
  } catch (error) {
    console.error('[AI] chatDocument error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

export async function clasificarMovimientoCEJ(
  acto: string,
  sumilla: string,
  expediente: string
): Promise<{ urgencia: 'alta' | 'normal' | 'info', sugerencia: string }> {
  const prompt = `Eres un asistente legal especializado en derecho
procesal peruano. Analiza este movimiento judicial del CEJ y
determina su urgencia y qué debe hacer el abogado.

Expediente: ${expediente}
Acto procesal: ${acto}
Sumilla: ${sumilla}

Responde SOLO con JSON válido sin markdown:
{
  "urgencia": "alta|normal|info",
  "sugerencia": "Acción concreta en 1-2 oraciones en español"
}

Criterios de urgencia:
- ALTA: sentencias, autos que requieren respuesta con plazo,
  notificaciones de audiencia próxima, resoluciones que
  ordenan presentar escritos
- NORMAL: decretos de trámite, proveídos rutinarios,
  actualizaciones de estado
- INFO: simples constancias, cargos de recepción`

  try {
    const judicialClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await judicialClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = response.content[0]
    const text = block.type === 'text' ? block.text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as { urgencia: 'alta' | 'normal' | 'info', sugerencia: string }
  } catch {
    return { urgencia: 'info', sugerencia: 'Revisar el movimiento en el CEJ.' }
  }
}

export async function generarEscritoJudicial(
  tipo: string,
  casoData: any,
  instrucciones: string,
  historialChat: any[]
): Promise<{ message: string, documentContent: string, isComplete: boolean }> {
  const systemPrompt = `Eres Arthur-IA, asistente legal especializado
en redacción de escritos judiciales para el Poder Judicial del Perú.

Contexto del proceso:
- Expediente: ${casoData.numero_expediente}
- Tipo: ${casoData.tipo_proceso}
- Juzgado: ${casoData.organo_jurisdiccional}
- Partes: ${casoData.partes}
- Tipo de escrito: ${tipo}
- Instrucciones del abogado: ${instrucciones || 'Sin instrucciones adicionales'}

REGLAS:
1. Una pregunta a la vez
2. Cuando tengas suficiente información, genera el escrito completo
3. Usa terminología procesal civil peruana correcta
4. Cita el Código Procesal Civil (CPC) cuando corresponda
5. Estructura: encabezado → hechos → derecho → petitorio → otrosíes
6. Usa [CAMPO] para datos que aún necesitas
7. Siempre incluir disclaimer de revisión profesional`

  const judicialClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const messages =
    Array.isArray(historialChat) && historialChat.length > 0
      ? historialChat.map((m: { role?: string; content?: string }) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
        }))
      : [
          {
            role: 'user' as const,
            content:
              instrucciones?.trim() ||
              'Comienza la redacción del escrito judicial según el tipo y el CPC peruano.',
          },
        ]

  const response = await judicialClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: systemPrompt,
    messages,
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''
  const isComplete = text.includes('SEÑOR JUEZ') || text.includes('POR TANTO')
  const hasFields = text.includes('[')

  return {
    message: text,
    documentContent: isComplete ? text : '',
    isComplete: isComplete && !hasFields
  }
}
