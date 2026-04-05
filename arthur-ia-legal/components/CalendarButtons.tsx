'use client';

import { getGoogleCalendarLink, getOutlookLink, type AudienciaCalendarInput } from '@/lib/calendar-links';

type CalendarButtonsProps = AudienciaCalendarInput;

export default function CalendarButtons({ fecha, descripcion, caso_alias }: CalendarButtonsProps) {
  const audiencia: AudienciaCalendarInput = { fecha, descripcion, caso_alias };

  const btnStyle: React.CSSProperties = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '5px 10px',
    border: '1px solid var(--line-mid)',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.15s',
  };

  return (
    <span style={{ display: 'inline-flex', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
      <button
        type="button"
        style={btnStyle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(getGoogleCalendarLink(audiencia), '_blank', 'noopener,noreferrer');
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = '#4285f4';
          e.currentTarget.style.color = '#4285f4';
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'var(--line-mid)';
          e.currentTarget.style.color = 'var(--muted)';
        }}
      >
        Google Calendar
      </button>
      <button
        type="button"
        style={btnStyle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(getOutlookLink(audiencia), '_blank', 'noopener,noreferrer');
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = '#0078d4';
          e.currentTarget.style.color = '#0078d4';
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'var(--line-mid)';
          e.currentTarget.style.color = 'var(--muted)';
        }}
      >
        Outlook
      </button>
    </span>
  );
}
