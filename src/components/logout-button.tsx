'use client';
import { useState } from 'react';
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div><button type="button" disabled={busy} className="text-sm text-slate-300 underline disabled:opacity-50" onClick={async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.replace('/login');
    } catch { setError('No se pudo cerrar sesión. Intenta nuevamente.'); setBusy(false); }
  }}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>{error && <p role="alert" className="text-rose-300 text-xs">{error}</p>}</div>;
}
