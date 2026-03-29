'use client';

import { useState, useEffect } from 'react';

const SUNARP_OFFICES = [
  { code: '0101', name: 'Lima' },
  { code: '0102', name: 'Callao' },
  { code: '0103', name: 'Huaral' },
  { code: '0104', name: 'Huacho' },
  { code: '0105', name: 'Cañete' },
  { code: '0106', name: 'Barranca' },
  { code: '0201', name: 'Huancayo' },
  { code: '0202', name: 'Huánuco' },
  { code: '0204', name: 'Pasco' },
  { code: '0205', name: 'Satipo' },
  { code: '0206', name: 'La Merced (Selva Central)' },
  { code: '0207', name: 'Tarma' },
  { code: '0208', name: 'Tingo María' },
  { code: '0209', name: 'Huancavelica' },
  { code: '0301', name: 'Arequipa' },
  { code: '0302', name: 'Camaná' },
  { code: '0303', name: 'Castilla - Aplao' },
  { code: '0304', name: 'Islay - Mollendo' },
  { code: '0401', name: 'Huaraz' },
  { code: '0402', name: 'Casma' },
  { code: '0403', name: 'Chimbote' },
  { code: '0501', name: 'Piura' },
  { code: '0502', name: 'Sullana' },
  { code: '0503', name: 'Tumbes' },
  { code: '0601', name: 'Cusco' },
  { code: '0602', name: 'Abancay' },
  { code: '0603', name: 'Madre de Dios' },
  { code: '0604', name: 'Quillabamba' },
  { code: '0605', name: 'Sicuani' },
  { code: '0606', name: 'Espinar' },
  { code: '0607', name: 'Andahuaylas' },
  { code: '0701', name: 'Tacna' },
  { code: '0702', name: 'Ilo' },
  { code: '0703', name: 'Juliaca' },
  { code: '0704', name: 'Moquegua' },
  { code: '0705', name: 'Puno' },
  { code: '0801', name: 'Trujillo' },
  { code: '0802', name: 'Chepén' },
  { code: '0803', name: 'Huamachuco' },
  { code: '0804', name: 'Otuzco' },
  { code: '0805', name: 'San Pedro' },
  { code: '0901', name: 'Maynas (Iquitos)' },
  { code: '1001', name: 'Ica' },
  { code: '1002', name: 'Chincha' },
  { code: '1003', name: 'Pisco' },
  { code: '1004', name: 'Nazca' },
  { code: '1101', name: 'Chiclayo' },
  { code: '1102', name: 'Cajamarca' },
  { code: '1103', name: 'Jaén' },
  { code: '1104', name: 'Bagua' },
  { code: '1105', name: 'Chachapoyas' },
  { code: '1106', name: 'Chota' },
  { code: '1201', name: 'Moyobamba' },
  { code: '1202', name: 'Tarapoto' },
  { code: '1203', name: 'Juanjuí' },
  { code: '1204', name: 'Yurimaguas' },
  { code: '1301', name: 'Pucallpa' },
  { code: '1401', name: 'Ayacucho' },
  { code: '1402', name: 'Huanta' },
];

const TIPO_OPTIONS = [
  { value: 'predio', emoji: '🏠', label: 'Predio' },
  { value: 'empresa', emoji: '🏢', label: 'Empresa' },
  { value: 'vehiculo', emoji: '🚗', label: 'Vehículo' },
  { value: 'mandatos', emoji: '📜', label: 'Mandatos y Poderes' },
];

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Cada hora' },
  { value: 2, label: 'Cada 2h' },
  { value: 4, label: 'Cada 4h' },
  { value: 24, label: '1 vez al día' },
  { value: 12, label: '2 veces al día' },
];

interface AddTramiteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTramiteDrawer({ open, onClose, onSuccess }: AddTramiteDrawerProps) {
  const [tipo, setTipo] = useState('predio');
  const [numero, setNumero] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [oficina, setOficina] = useState('0101');
  const [alias, setAlias] = useState('');
  const [frecuencia, setFrecuencia] = useState(4);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function handleSubmit() {
    if (!numero || !alias) return;
    setSubmitting(true);

    try {
      const selectedOffice = SUNARP_OFFICES.find(o => o.code === oficina);
      const body = {
        tipo,
        numero_titulo: numero,
        anio,
        oficina_registral: oficina,
        oficina_nombre: selectedOffice?.name || '',
        alias,
        polling_frequency_hours: frecuencia,
        whatsapp_number: whatsappEnabled && whatsappNumber ? `+51${whatsappNumber}` : null,
        email: emailEnabled && emailAddress ? emailAddress : null,
      };

      const res = await fetch('/api/tramites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSuccess();
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTipo('predio');
    setNumero('');
    setAnio(new Date().getFullYear().toString());
    setOficina('0101');
    setAlias('');
    setFrecuencia(4);
    setWhatsappEnabled(true);
    setWhatsappNumber('');
    setEmailEnabled(false);
    setEmailAddress('');
  }

  const inputStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid rgba(15,15,15,0.15)',
    borderRadius: 0,
    padding: '12px 16px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    color: 'var(--ink)',
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'var(--muted)',
    display: 'block',
    marginBottom: '6px',
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,15,15,0.4)',
          zIndex: 200,
        }}
      />

      {/* Drawer */}
      <div
        className="animate-slideInRight"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '480px',
          height: '100vh',
          background: 'var(--paper)',
          borderLeft: '1px solid rgba(15,15,15,0.1)',
          zIndex: 300,
          overflowY: 'auto',
          padding: '40px 36px',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '24px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--muted)',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Header */}
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '28px', color: 'var(--ink)', fontWeight: 400 }}>
          Nuevo trámite
        </h2>
        <div style={{ width: '60px', height: '2px', background: '#1a3d2b', marginTop: '12px', marginBottom: '28px' }} />

        {/* Tipo selector */}
        <label style={labelStyle}>TIPO DE TRÁMITE</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {TIPO_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTipo(opt.value)}
              style={{
                position: 'relative',
                background: 'white',
                border: tipo === opt.value ? '2px solid var(--ink)' : '1px solid rgba(15,15,15,0.1)',
                borderRadius: 0,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border 0.15s',
              }}
            >
              {tipo === opt.value && (
                <span style={{ position: 'absolute', top: '6px', right: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>✓</span>
              )}
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{opt.emoji}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{opt.label}</div>
            </button>
          ))}
        </div>

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Número */}
          <div>
            <label style={labelStyle}>NÚMERO DE TÍTULO</label>
            <input
              type="text"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder={tipo === 'predio' ? 'Ej: 001234' : tipo === 'empresa' ? 'Ej: 005678' : tipo === 'mandatos' ? 'Ej: 003456' : 'Ej: 009012'}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.15)'; }}
            />
          </div>

          {/* Año */}
          <div>
            <label style={labelStyle}>AÑO</label>
            <input
              type="number"
              value={anio}
              onChange={e => setAnio(e.target.value)}
              min="2000"
              max="2030"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.15)'; }}
            />
          </div>

          {/* Oficina */}
          <div>
            <label style={labelStyle}>OFICINA REGISTRAL</label>
            <select
              value={oficina}
              onChange={e => setOficina(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M6 8L1 3h10z\' fill=\'%236b6560\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }}
            >
              {SUNARP_OFFICES.map(off => (
                <option key={off.code} value={off.code}>{off.code} — {off.name}</option>
              ))}
            </select>
          </div>

          {/* Alias */}
          <div>
            <label style={labelStyle}>NOMBRE DEL TRÁMITE</label>
            <input
              type="text"
              value={alias}
              onChange={e => setAlias(e.target.value)}
              placeholder="Ej: Casa San Borja"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.15)'; }}
            />
          </div>
        </div>

        {/* Alert Config */}
        <div style={{ marginTop: '28px' }}>
          <label style={{ ...labelStyle, marginBottom: '16px' }}>¿CÓMO QUIERES RECIBIR LAS ALERTAS?</label>

          {/* WhatsApp toggle */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>
                WhatsApp
              </span>
              <div
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                style={{
                  width: '44px',
                  height: '24px',
                  background: whatsappEnabled ? '#1a3d2b' : 'rgba(15,15,15,0.15)',
                  borderRadius: '12px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: whatsappEnabled ? '22px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
            {whatsappEnabled && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ ...inputStyle, width: 'auto', padding: '12px 14px', background: 'var(--paper-dark)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--muted)' }}>+51</span>
                </div>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="999000000"
                  style={{ ...inputStyle }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.15)'; }}
                />
              </div>
            )}
          </div>

          {/* Email toggle */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>
                Email
              </span>
              <div
                onClick={() => setEmailEnabled(!emailEnabled)}
                style={{
                  width: '44px',
                  height: '24px',
                  background: emailEnabled ? '#1a3d2b' : 'rgba(15,15,15,0.15)',
                  borderRadius: '12px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: emailEnabled ? '22px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
            {emailEnabled && (
              <input
                type="email"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                placeholder="tu@email.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--ink)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(15,15,15,0.15)'; }}
              />
            )}
          </div>
        </div>

        {/* Frecuencia */}
        <div style={{ marginTop: '8px' }}>
          <label style={labelStyle}>FRECUENCIA DE REVISIÓN</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {FREQUENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFrecuencia(opt.value)}
                style={{
                  background: frecuencia === opt.value ? 'var(--ink)' : 'white',
                  color: frecuencia === opt.value ? 'var(--paper)' : 'var(--ink)',
                  border: '1px solid rgba(15,15,15,0.15)',
                  borderRadius: 0,
                  padding: '8px 14px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !numero || !alias}
          style={{
            width: '100%',
            background: submitting || !numero || !alias ? 'rgba(15,15,15,0.3)' : 'var(--ink)',
            color: 'var(--paper)',
            border: 'none',
            borderRadius: 0,
            padding: '16px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            cursor: submitting || !numero || !alias ? 'not-allowed' : 'pointer',
            marginTop: '28px',
          }}
        >
          {submitting ? 'Creando trámite...' : 'Comenzar seguimiento →'}
        </button>
      </div>
    </>
  );
}
