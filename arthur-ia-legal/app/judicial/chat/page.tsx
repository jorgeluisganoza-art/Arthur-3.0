'use client';

import { useEffect, useRef, useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isDocument?: boolean;
}

interface Caso {
  id: number;
  alias: string | null;
  numero_expediente: string;
  cliente: string | null;
}

const CAPABILITY_PILLS = [
  { label: 'Redactar escrito', prompt: 'Necesito redactar un escrito judicial. ¿Puedes ayudarme?' },
  { label: 'Consulta legal', prompt: 'Tengo una consulta legal sobre derecho peruano.' },
  { label: 'Analizar un caso', prompt: 'Quiero analizar las opciones legales para un caso.' },
];

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.7, color: '#0f0f0f' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 600 }}>{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} style={{ margin: '14px 0 4px', fontSize: '16px', fontWeight: 700 }}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} style={{ margin: '16px 0 6px', fontSize: '18px', fontWeight: 700 }}>{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: '16px', marginBottom: '2px' }}>• {renderInline(line.slice(2))}</div>;
        if (/^\d+\. /.test(line)) return <div key={i} style={{ paddingLeft: '16px', marginBottom: '2px' }}>{renderInline(line)}</div>;
        if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
        return <p key={i} style={{ margin: '0 0 4px' }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: '2px', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function JudicialChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [selectedCaso, setSelectedCaso] = useState<Caso | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionDropdown, setMentionDropdown] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/casos')
      .then(r => r.json())
      .then((data: Caso[]) => setCasos(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1 && atIndex === val.length - 1) {
      setMentionQuery('');
      setMentionDropdown(true);
    } else if (atIndex !== -1 && val.slice(atIndex).indexOf(' ') === -1) {
      setMentionQuery(val.slice(atIndex + 1));
      setMentionDropdown(true);
    } else {
      setMentionDropdown(false);
      setMentionQuery(null);
    }
  }

  function selectCaso(caso: Caso) {
    const atIndex = input.lastIndexOf('@');
    const newInput = input.slice(0, atIndex) + `@${caso.alias || caso.numero_expediente} `;
    setInput(newInput);
    setSelectedCaso(caso);
    setMentionDropdown(false);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  function removeSelectedCaso() {
    setSelectedCaso(null);
    setInput(input.replace(/@[^\s]+\s?/g, ''));
  }

  const filteredCasos = mentionQuery !== null
    ? casos.filter(c =>
        (c.alias || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
        c.numero_expediente.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        (c.cliente || '').toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : casos;

  async function send(overrideInput?: string) {
    const text = (overrideInput || input).trim();
    if (!text || isTyping) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setIsTyping(true);
    try {
      const res = await fetch('/api/chat/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          casoId: selectedCaso?.id,
        }),
      });
      const data = await res.json() as { message: string; isDocument: boolean };
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || 'Sin respuesta.',
        isDocument: data.isDocument,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function downloadWordFromMessage(content: string) {
    const lines = content.split('---DOCUMENTO_COMPLETO---')[0].trim().split('\n');
    const doc = new Document({
      sections: [{
        children: lines.map(line =>
          new Paragraph({ children: [new TextRun({ text: line, font: 'Times New Roman', size: 24 })] })
        ),
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escrito-chat-${Date.now()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isDocumentMsg = (content: string) =>
    content.includes('SEÑOR JUEZ') || content.includes('POR TANTO:') ||
    content.includes('PETITORIO') || content.includes('---DOCUMENTO_COMPLETO---');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#ffffff', borderBottom: '1px solid rgba(15,15,15,0.08)',
        padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#0f0f0f', fontWeight: 400 }}>
          Chat
        </div>
        <button
          onClick={() => { setMessages([]); setSelectedCaso(null); setInput(''); }}
          style={{ border: '1px solid rgba(15,15,15,0.15)', background: 'transparent', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', color: '#0f0f0f' }}
        >
          Nueva conversación
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '40px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {CAPABILITY_PILLS.map(pill => (
              <button key={pill.label} onClick={() => void send(pill.prompt)}
                style={{ border: '1px solid rgba(15,15,15,0.15)', background: 'transparent', padding: '8px 18px', fontFamily: 'DM Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', color: '#0f0f0f', borderRadius: '2px' }}>
                {pill.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '16px', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' ? (
              <div style={{ marginRight: '60px', background: '#f7f7f7', borderLeft: '3px solid #1a3d2b', padding: '16px 20px', maxWidth: '100%' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1a3d2b', marginBottom: '8px' }}>arthur.ia</div>
                <SimpleMarkdown text={m.content.replace('---DOCUMENTO_COMPLETO---', '').trim()} />
                {(m.isDocument || isDocumentMsg(m.content)) && (
                  <button onClick={() => void downloadWordFromMessage(m.content)}
                    style={{ marginTop: '12px', border: '1px solid #1a3d2b', background: 'transparent', padding: '7px 14px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: '#1a3d2b', cursor: 'pointer', letterSpacing: '0.08em' }}>
                    Descargar Word
                  </button>
                )}
              </div>
            ) : (
              <div style={{ marginLeft: '60px', background: '#1a3d2b', color: 'white', padding: '14px 18px', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', marginBottom: '16px' }}>
            <div style={{ marginRight: '60px', background: '#f7f7f7', borderLeft: '3px solid #1a3d2b', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: '#1a3d2b', marginBottom: '8px' }}>arthur.ia</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1a3d2b', animation: 'dotPulse 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ position: 'sticky', bottom: 0, background: '#ffffff', borderTop: '1px solid rgba(15,15,15,0.08)', padding: '16px 32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', position: 'relative' }}>
          {mentionDropdown && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'white', border: '1px solid rgba(15,15,15,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: '200px', overflowY: 'auto', zIndex: 50, marginBottom: '4px' }}>
              {filteredCasos.length === 0 ? (
                <div style={{ padding: '12px 16px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#9ca3af' }}>Sin resultados</div>
              ) : filteredCasos.map(c => (
                <button key={c.id} onClick={() => selectCaso(c)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px' }}
                  onMouseOver={e => { e.currentTarget.style.background = '#f7f7f7'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#0f0f0f' }}>{c.alias || c.cliente || 'Sin alias'}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#9ca3af' }}>{c.numero_expediente}</span>
                </button>
              ))}
            </div>
          )}

          {selectedCaso && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(26,61,43,0.1)', color: '#1a3d2b', padding: '4px 10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', borderRadius: '2px' }}>
                @ {selectedCaso.alias || selectedCaso.numero_expediente}
                <button onClick={removeSelectedCaso} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a3d2b', padding: '0', lineHeight: 1, fontSize: '14px' }}>×</button>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
                if (e.key === 'Escape') setMentionDropdown(false);
              }}
              placeholder='Escribe tu consulta... (usa @ para mencionar un caso)'
              rows={2}
              style={{ flex: 1, border: '1px solid rgba(15,15,15,0.15)', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', resize: 'none', outline: 'none', borderRadius: '0' }}
            />
            <button onClick={() => void send()} disabled={isTyping || !input.trim()}
              style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '12px 24px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: isTyping || !input.trim() ? 'not-allowed' : 'pointer', opacity: isTyping || !input.trim() ? 0.6 : 1, borderRadius: '0', whiteSpace: 'nowrap' }}>
              Enviar →
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes dotPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
