'use client';

interface CalendarButtonsProps {
  title: string;
  date: string;
  description?: string;
}

function toGoogleCalendarUrl(title: string, date: string, description: string): string {
  const d = new Date(date);
  const fmt = (dt: Date) =>
    dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmt(d);
  const end = fmt(new Date(d.getTime() + 60 * 60 * 1000));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function toOutlookUrl(title: string, date: string, description: string): string {
  const d = new Date(date);
  const end = new Date(d.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    subject: title,
    startdt: d.toISOString(),
    enddt: end.toISOString(),
    body: description,
    path: '/calendar/action/compose',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

export default function CalendarButtons({ title, date, description = '' }: CalendarButtonsProps) {
  const btnStyle: React.CSSProperties = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '5px 10px',
    border: '1px solid rgba(15,15,15,0.12)',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.15s',
  };

  return (
    <span style={{ display: 'inline-flex', gap: '6px', marginLeft: '8px' }}>
      <button
        type="button"
        style={btnStyle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(toGoogleCalendarUrl(title, date, description), '_blank');
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = '#4285f4';
          e.currentTarget.style.color = '#4285f4';
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'rgba(15,15,15,0.12)';
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
          window.open(toOutlookUrl(title, date, description), '_blank');
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = '#0078d4';
          e.currentTarget.style.color = '#0078d4';
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'rgba(15,15,15,0.12)';
          e.currentTarget.style.color = 'var(--muted)';
        }}
      >
        Outlook Calendar
      </button>
    </span>
  );
}
