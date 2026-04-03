'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import JudicialSidebar from '@/components/JudicialSidebar';

export default function JudicialLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('arthur_auth');
    if (!auth) router.replace('/login');
    else queueMicrotask(() => setAuthorized(true));
  }, [router]);

  if (!authorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>
        Verificando acceso...
      </div>
    );
  }

  return (
    <div className="workspace-light" style={{ display: 'flex', height: '100%', minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <JudicialSidebar />
      <main style={{ marginLeft: '260px', flex: 1, minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
        {children}
      </main>
    </div>
  );
}
