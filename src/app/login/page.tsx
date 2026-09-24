'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Login() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
      window.location.replace('/');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar. Intenta nuevamente.'); setBusy(false); }
  }
  return <main className="min-h-screen flex items-center justify-center px-4 py-12"><div className="glass-card p-7 sm:p-10 w-full max-w-md space-y-6">
    <Image src="/logo.png" alt="Valle Grande FC" width={80} height={80} className="mx-auto h-auto" />
    <div className="text-center"><h1 className="text-2xl font-bold">Acceso de dirigentes</h1><p className="text-slate-400 mt-2">Ingresa la clave para administrar las inscripciones.</p></div>
    <form onSubmit={submit} className="space-y-4"><label className="block text-sm">Clave del dashboard<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} className="input-field w-full mt-2" disabled={busy} /></label>
      {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
      <button className="btn-primary w-full disabled:opacity-50" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar al dashboard'}</button>
    </form><p className="text-center text-sm text-slate-400">¿Eres jugador? <Link href="/registro" className="text-brand-400 underline">Inscríbete aquí sin clave</Link>.</p>
  </div></main>;
}
