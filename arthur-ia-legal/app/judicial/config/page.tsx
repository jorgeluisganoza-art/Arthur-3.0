'use client';

export default function JudicialConfigPage() {
  return (
    <div style={{ padding: '48px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '8px' }}>
        CONFIGURACIÓN
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400 }}>
        Configuración judicial
      </h1>
      <div style={{ width: '60px', height: '2px', background: 'var(--accent)', marginTop: '16px' }} />
      <p style={{ marginTop: '20px', fontFamily: 'Inter, sans-serif', color: 'var(--muted)' }}>
        Próximamente: plantillas judiciales, firmas y preferencias CEJ.
      </p>
    </div>
  );
}
