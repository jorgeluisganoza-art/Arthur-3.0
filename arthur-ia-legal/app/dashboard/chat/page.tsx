'use client';

import { useEffect, useRef, useState } from 'react';

type Provider = 'anthropic' | 'openai' | 'gemini';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: Provider;
}

const providerLabels: Record<Provider, { name: string; color: string }> = {
  anthropic: { name: 'Claude · Anthropic', color: '#d97706' },
  openai: { name: 'GPT-4o · OpenAI', color: '#10a37f' },
  gemini: { name: 'Gemini · Google', color: '#4285f4' },
};

const suggestedQuestions = [
  '¿Cuál es el plazo para subsanar observaciones en SUNARP?',
  '¿Cómo interponer recurso de apelación ante el Tribunal Registral?',
  '¿Qué dice el Art. 2014 del Código Civil sobre fe pública registral?',
  '¿Cuáles son los requisitos para inscribir una compraventa de inmueble?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then((data: { providers: Provider[] }) => {
        setProviders(data.providers);
        if (data.providers.length > 0) setSelectedProvider(data.providers[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          provider: selectedProvider,
        }),
      });
      const data = await res.json() as { text?: string; provider?: Provider; error?: string };
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: data.error }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.text || '',
          provider: data.provider,
        }]);
      }
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Error de conexión. Intenta de nuevo.',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--paper)',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 48px',
        borderBottom: '1px solid rgba(15,15,15,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--muted)',
              marginBottom: '6px',
            }}>
              ASISTENTE LEGAL IA
            </div>
            <h1 style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: '28px',
              color: 'var(--ink)',
              fontWeight: 400,
              margin: 0,
            }}>
              Consulta Legal
            </h1>
          </div>

          {/* Provider selector */}
          {providers.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {providers.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedProvider(p)}
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '6px 12px',
                    border: `1px solid ${selectedProvider === p ? providerLabels[p].color : 'rgba(15,15,15,0.1)'}`,
                    background: selectedProvider === p ? `${providerLabels[p].color}10` : 'transparent',
                    color: selectedProvider === p ? providerLabels[p].color : 'var(--muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {providerLabels[p].name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 48px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '32px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '36px',
                fontStyle: 'italic',
                color: '#1a3d2b',
                marginBottom: '8px',
              }}>
                arthur
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: 'var(--muted)',
                maxWidth: '400px',
              }}>
                Pregunta sobre leyes, jurisprudencia, plazos registrales o cualquier consulta legal peruana.
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              maxWidth: '600px',
              width: '100%',
            }}>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    color: 'var(--ink)',
                    background: 'white',
                    border: '1px solid rgba(15,15,15,0.08)',
                    padding: '14px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    lineHeight: '1.4',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.25)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.08)'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {msg.role === 'assistant' && msg.provider && (
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: providerLabels[msg.provider]?.color || 'var(--muted)',
                    marginBottom: '4px',
                    marginLeft: '2px',
                  }}>
                    {providerLabels[msg.provider]?.name || msg.provider}
                  </div>
                )}
                <div style={{
                  background: msg.role === 'user' ? '#1a3d2b' : 'white',
                  color: msg.role === 'user' ? 'white' : 'var(--ink)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(15,15,15,0.08)',
                  padding: '16px 20px',
                  maxWidth: '85%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                color: 'var(--muted)',
                padding: '8px 0',
              }}>
                Consultando {selectedProvider ? providerLabels[selectedProvider].name : ''}...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 48px 24px',
        borderTop: '1px solid rgba(15,15,15,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          maxWidth: '800px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta legal..."
            rows={1}
            style={{
              flex: 1,
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              padding: '14px 18px',
              border: '1px solid rgba(15,15,15,0.12)',
              background: 'white',
              color: 'var(--ink)',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.5',
              minHeight: '48px',
              maxHeight: '120px',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '14px 24px',
              background: input.trim() && !loading ? '#1a3d2b' : 'rgba(15,15,15,0.05)',
              color: input.trim() && !loading ? 'white' : 'var(--muted)',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            Enviar
          </button>
        </div>
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '9px',
          color: 'var(--muted)',
          marginTop: '8px',
          letterSpacing: '0.05em',
        }}>
          Las respuestas son orientativas · Enter para enviar · Shift+Enter para nueva línea
        </div>
      </div>
    </div>
  );
}
