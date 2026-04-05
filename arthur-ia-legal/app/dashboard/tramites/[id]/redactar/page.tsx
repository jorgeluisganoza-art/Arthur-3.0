'use client';

import { useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Tramite {
  id: number;
  alias: string;
  tipo: string;
  numero_titulo: string;
  anio: string;
  oficina_nombre: string | null;
  oficina_registral: string;
  observacion_texto: string | null;
  estado_actual: string;
}

const DOC_TYPES = [
  { value: 'subsanatorio', label: 'Subsanatorio' },
  { value: 'apelacion', label: 'Apelación' },
  { value: 'queja', label: 'Queja' },
  { value: 'prorroga', label: 'Prórroga' },
];

function renderMessage(text: string): React.ReactNode {
  // Replace **text** with <strong>
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderDocument(content: string): React.ReactNode {
  if (!content) return null;
  // Highlight [CAMPO] placeholders
  const parts = content.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={i} className="campo-placeholder">{part}</span>
      );
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export default function RedactarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documentContent, setDocumentContent] = useState('');
  const [documentType, setDocumentType] = useState('subsanatorio');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/tramites/${id}`)
      .then(r => r.json())
      .then((data: Tramite) => setTramite(data))
      .catch(console.error);
  }, [id]);

  // Auto-send first message when tramite loads
  useEffect(() => {
    if (tramite && !firstMessageSent) {
      setFirstMessageSent(true);
      const firstMsg = tramite.observacion_texto
        ? `Hola, necesito redactar un escrito ${documentType} para el trámite "${tramite.alias}" (Título N° ${tramite.numero_titulo}/${tramite.anio}). La esquela indica: "${tramite.observacion_texto.substring(0, 200)}...". ¿Por dónde empezamos?`
        : `Hola, necesito redactar un escrito ${documentType} para el trámite "${tramite.alias}" (Título N° ${tramite.numero_titulo}/${tramite.anio}). ¿Por dónde empezamos?`;

      sendMessage(firstMsg, []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramite]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function sendMessage(text: string, currentMessages: Message[]) {
    if (!text.trim() || !tramite) return;

    const newMessages: Message[] = [...currentMessages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await fetch(`/api/tramites/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, documentType }),
      });

      const data = await res.json() as {
        message: string;
        documentContent: string;
        isComplete: boolean;
        remainingFields: string[];
        error?: string;
      };

      if (!res.ok) {
        console.error('[Chat] API error:', data.error);
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Error desconocido'}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        if (data.documentContent) {
          setDocumentContent(data.documentContent);
          setSavedTime('hace 1 seg');
        }
      }
    } catch (err) {
      console.error('[Chat] fetch error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Por favor intenta de nuevo.' }]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSend() {
    sendMessage(inputText, messages);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function copyDocument() {
    navigator.clipboard.writeText(documentContent).catch(() => {});
  }

  if (!tramite) {
    return (
      <div style={{ padding: '48px 64px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Cargando...
        </div>
      </div>
    );
  }

  const casoAlias = tramite.alias;

  async function downloadWord() {
    const lines = documentContent.split('\n');
    const doc = new Document({
      sections: [{
        children: lines.map(line =>
          new Paragraph({
            children: [new TextRun({
              text: line,
              font: 'Times New Roman',
              size: 24,
            })],
          }),
        ),
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escrito-${casoAlias}-${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh', overflow: 'hidden' }}>
      {/* ── Chat Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          padding: '20px 28px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <Link
                  href={`/dashboard/tramites/${id}`}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}
                >
                  ← Volver
                </Link>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--ink)' }}>
                Redactor IA
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Escrito {documentType} · {tramite.alias}
              </div>
            </div>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              background: 'var(--accent-navy)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Claude AI
            </span>
          </div>

          {/* Doc type selector (shown if no messages from AI yet) */}
          {messages.filter(m => m.role === 'assistant').length === 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {DOC_TYPES.map(dt => (
                <button
                  key={dt.value}
                  onClick={() => setDocumentType(dt.value)}
                  style={{
                    background: documentType === dt.value ? 'var(--ink)' : 'var(--surface)',
                    color: documentType === dt.value ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: '2px',
                    padding: '6px 14px',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--paper)' }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                animation: 'fadeUp 0.3s ease forwards',
              }}
            >
              {msg.role === 'assistant' ? (
                <div style={{
                  background: 'var(--paper)',
                  borderLeft: '3px solid var(--accent)',
                  padding: '16px 20px',
                  border: '1px solid var(--line)',
                  borderLeftColor: 'var(--accent)',
                }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Arthur-IA
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.7', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                    {renderMessage(msg.content)}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'var(--accent-navy)',
                  color: 'var(--paper)',
                  padding: '14px 18px',
                  borderRadius: '2px',
                }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{
              alignSelf: 'flex-start',
              background: 'var(--paper)',
              borderLeft: '3px solid var(--accent)',
              padding: '16px 20px',
              border: '1px solid var(--line)',
              borderLeftColor: 'var(--accent)',
              maxWidth: '85%',
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--line)',
          padding: '16px 24px',
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
        }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu respuesta..."
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: 0,
              padding: '12px 16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: 'var(--ink)',
              resize: 'none',
              minHeight: '48px',
              maxHeight: '120px',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--line-strong)'; }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            style={{
              background: inputText.trim() && !isTyping ? 'var(--ink)' : 'rgba(255,255,255,0.1)',
              color: 'var(--paper)',
              border: 'none',
              borderRadius: 0,
              padding: '12px 20px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: inputText.trim() && !isTyping ? 'pointer' : 'not-allowed',
              flexShrink: 0,
            }}
          >
            Enviar →
          </button>
        </div>
      </div>

      {/* ── Document Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
        {/* Doc Header */}
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          padding: '20px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--ink)' }}>
            Escrito {DOC_TYPES.find(d => d.value === documentType)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {savedTime && (
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>
                Guardado · {savedTime}
              </span>
            )}
            <button
              type="button"
              onClick={() => void downloadWord()}
              disabled={!documentContent}
              style={{
                background: 'transparent',
                border: '1px solid var(--line-strong)',
                borderRadius: 0,
                padding: '8px 16px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: documentContent ? 'pointer' : 'not-allowed',
                color: documentContent ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              Descargar Word
            </button>
            <button
              onClick={copyDocument}
              disabled={!documentContent}
              style={{
                background: 'transparent',
                border: '1px solid var(--line-strong)',
                borderRadius: 0,
                padding: '8px 16px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: documentContent ? 'pointer' : 'not-allowed',
                color: documentContent ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              Copiar texto
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          {documentContent ? (
            <div style={{ maxWidth: '560px', margin: '0 auto' }}>
              <div style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '13px',
                lineHeight: '1.8',
                color: 'var(--ink)',
                textAlign: 'justify',
                whiteSpace: 'pre-wrap',
              }}>
                {renderDocument(documentContent)}
              </div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                fontStyle: 'italic',
                color: 'var(--muted)',
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid var(--line-mid)',
              }}>
                Aviso: Borrador generado por Arthur-IA Legal. Revisar con abogado antes de presentar.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', opacity: 0.5 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)' }}>
                El escrito aparecerá aquí
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--muted)', textAlign: 'center', maxWidth: '300px' }}>
                Responde las preguntas de Arthur-IA y el documento se generará automáticamente
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
