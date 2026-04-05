'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface Caso {
  id: number;
  numero_expediente: string;
  tipo_proceso: string | null;
  organo_jurisdiccional: string | null;
  partes: string | null;
  movimientos: Array<{ acto: string | null; fecha: string | null; sumilla: string | null }>;
}

interface Message { role: 'user' | 'assistant'; content: string; }

const DOC_TYPES = [
  { value: 'contestacion', label: 'Contestación de demanda' },
  { value: 'apelacion', label: 'Recurso de apelación' },
  { value: 'queja', label: 'Recurso de queja' },
  { value: 'impulso', label: 'Escrito de impulso' },
  { value: 'generico', label: 'Otro' },
];

export default function JudicialRedactarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string; contexto?: string; movimientoId?: string }>;
}) {
  const { id } = use(params);
  const sp = use(searchParams);
  const tipoFromUrl = sp.tipo || '';
  const contextoFromUrl = sp.contexto ? decodeURIComponent(sp.contexto) : '';

  const [caso, setCaso] = useState<Caso | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [tipo, setTipo] = useState(
    DOC_TYPES.find(d => d.value === tipoFromUrl) ? tipoFromUrl : 'contestacion'
  );
  const [isTyping, setIsTyping] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/casos/${id}`).then(r => r.json()).then((d: Caso) => setCaso(d)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!caso || messages.length > 0) return;
    const last = caso.movimientos?.[0];
    const docLabel = DOC_TYPES.find(d => d.value === tipo)?.label?.toLowerCase() || 'escrito';
    let intro = `Revisé el expediente ${caso.numero_expediente}. El último movimiento fue ${last?.acto || 'sin dato'} del ${last?.fecha || 'sin fecha'}. Para redactar tu ${docLabel}, necesito algunos datos.`;
    if (contextoFromUrl) {
      intro += `\n\nContexto del movimiento judicial: ${contextoFromUrl}`;
    }
    setMessages([{ role: 'assistant', content: intro }]);
  }, [caso, messages.length, tipo, contextoFromUrl]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  async function send() {
    if (!input.trim() || !caso || isTyping) return;
    const next = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(next);
    setInput('');
    setIsTyping(true);
    try {
      const res = await fetch(`/api/casos/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          tipo,
          instrucciones: `Documento esperado:
SEÑOR JUEZ DEL ${caso.organo_jurisdiccional || '[juzgado]'}
EXPEDIENTE: ${caso.numero_expediente}
ESCRITO: ${tipo}

[NOMBRE], con DNI N° [DNI], en el proceso seguido por ${caso.partes || '[partes]'}, ante Ud. con respeto me presento y digo:

I. HECHOS
II. FUNDAMENTOS DE DERECHO
III. PETITORIO
POR TANTO:
PRIMER OTROSÍ DIGO:`,
        }),
      });
      const data = await res.json() as { message: string; documentContent: string; };
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Sin respuesta.' }]);
      if (data.documentContent) setDocumentContent(data.documentContent);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión.' }]);
    } finally {
      setIsTyping(false);
    }
  }

  if (!caso) return <div style={{ padding: '48px 64px', fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)' }}>Cargando...</div>;

  const casoAlias = caso.numero_expediente;

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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)' }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '20px 28px' }}>
          <Link href={`/judicial/${id}`} style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)' }}>← Volver</Link>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginTop: '6px' }}>Arthur IA Judicial</div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {DOC_TYPES.map(t => (
              <button key={t.value} onClick={() => setTipo(t.value)} style={{ background: tipo === t.value ? 'var(--ink)' : 'var(--surface)', color: tipo === t.value ? 'var(--paper)' : 'var(--ink)', border: '1px solid var(--line-strong)', padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', cursor: 'pointer' }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--paper)' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: '12px', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '84%', background: m.role === 'user' ? 'var(--accent-navy)' : 'var(--surface)', color: m.role === 'user' ? 'white' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--line)', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)' }}>Arthur está redactando...</div>}
          <div ref={endRef} />
        </div>
        <div style={{ borderTop: '1px solid var(--line)', padding: '14px', display: 'flex', gap: '8px' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} style={{ flex: 1, border: '1px solid var(--line-strong)', padding: '12px', minHeight: 48 }} placeholder="Escribe tu instrucción..." />
          <button onClick={() => void send()} style={{ border: 'none', background: 'var(--ink)', color: 'white', padding: '0 18px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}>Enviar</button>
        </div>
      </div>

      <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px' }}>Documento judicial</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => void downloadWord()} disabled={!documentContent} style={{ border: '1px solid var(--line-strong)', background: 'transparent', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: documentContent ? 'pointer' : 'not-allowed', opacity: documentContent ? 1 : 0.5 }}>Descargar Word</button>
            <button type="button" onClick={() => navigator.clipboard.writeText(documentContent).catch(() => {})} style={{ border: '1px solid var(--line-strong)', background: 'transparent', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}>Copiar</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          {documentContent ? (
            <div style={{ maxWidth: '560px', margin: '0 auto', fontFamily: "'Times New Roman', Times, serif", fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{documentContent}</div>
          ) : (
            <div style={{ color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>El borrador aparecerá aquí cuando Arthur complete la redacción.</div>
          )}
        </div>
      </div>
    </div>
  );
}
