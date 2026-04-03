import MetricsCards from '@/components/siguelo/MetricsCards'
import TituloForm from '@/components/siguelo/TituloForm'
import TitulosList from '@/components/siguelo/TitulosList'

export default function SigueloPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--paper)',
        paddingLeft: '260px',
      }}
    >
      <div style={{ padding: '48px 64px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              borderLeft: '3px solid #c2a46d',
              paddingLeft: '16px',
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '28px',
                  color: 'var(--ink)',
                  fontStyle: 'italic',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                SUNARP Síguelo
              </h1>
              <p
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--muted)',
                  margin: '6px 0 0',
                }}
              >
                Seguimiento de títulos registrales
              </p>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div style={{ marginBottom: '36px' }}>
          <MetricsCards />
        </div>

        {/* Layout: formulario + lista */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '380px 1fr',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          <TituloForm />
          <TitulosList />
        </div>
      </div>
    </div>
  )
}
