'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Download, Loader2, X } from 'lucide-react';
import { apiPost } from '@/lib/client-files';
import { fullName, requirements, STATUSES, statusOf, type Player, type RegistrationStatus } from '@/lib/registration';
import { RegistrationForm } from './registration-form';

export function PlayerDossier({ player, onClose, onUpdated }: { player: Player; onClose: () => void; onUpdated: (player: Player) => void }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<RegistrationStatus>(statusOf(player));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const blobRef = useRef('');
  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);
  const checks = requirements(player);
  const missing = checks.filter(c => !c.complete);
  const savedStatus = statusOf(player);
  async function saveStatus() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await apiPost({ action: 'UPDATE_STATUS', RUT: player.RUT, status }); onUpdated(result.player); setMessage('Estado guardado correctamente.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el estado.'); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/players/ficha?rut=${encodeURIComponent(player.RUT)}`);
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = URL.createObjectURL(await response.blob()); setPdfUrl(blobRef.current);
      setMessage('Ficha generada. El estado de federación se mantiene.');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo generar la ficha.'); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ficha del jugador">
    <div className="w-full max-w-4xl max-h-[94dvh] bg-slate-950 border border-slate-700 rounded-2xl flex flex-col shadow-2xl">
      <header className="flex items-start justify-between gap-4 p-5 border-b border-slate-800"><div><p className="text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">Ficha de inscripción</p><h2 className="text-xl font-bold">{fullName(player)}</h2><p className="text-sm text-slate-400 mt-1">{player.RUT} · {player.Serie || 'Sin serie'}</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar ficha" className="p-2 hover:bg-slate-800 rounded-lg"><X /></button></header>
      <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
        {editing ? <><button className="text-sm text-brand-400 underline" onClick={() => setEditing(false)}>Volver al resumen</button><RegistrationForm initial={player} admin onSaved={saved => { onUpdated(saved); setStatus(statusOf(saved)); setEditing(false); setPdfUrl(''); setMessage('Ficha guardada.'); }} /></> : <>
          <section className="glass-card p-5 space-y-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">Estado en la liga</h3><p className="text-sm text-slate-400 mt-1">Marca Federado cuando la liga confirme la inscripción.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${savedStatus === 'FEDERADO' ? 'text-green-300 bg-green-500/10' : 'text-amber-300 bg-amber-500/10'}`}>{savedStatus}</span></div>
            <div className="flex flex-col sm:flex-row gap-3"><select aria-label="Estado de federación" value={status} disabled={busy} onChange={e => setStatus(e.target.value as RegistrationStatus)} className="input-field flex-1">{STATUSES.map(s => <option key={s} value={s}>{s === 'PENDIENTE' ? 'Pendiente' : s === 'POR FEDERAR' ? 'Por federar' : 'Federado'}</option>)}</select><button onClick={() => void saveStatus()} disabled={busy || status === savedStatus} className="btn-primary disabled:opacity-50">Guardar estado</button></div>
            {status === 'FEDERADO' && savedStatus !== 'FEDERADO' && <p className="text-sm text-slate-300">Al guardar confirmas que el jugador ya está inscrito en la liga.{missing.length > 0 && ' Su ficha digital aún tiene información pendiente.'}</p>}
          </section>
          <section className="glass-card p-5 space-y-4"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold">{missing.length ? `${missing.length} requisitos pendientes` : 'Ficha completa para presentar'}</h3><button onClick={() => setEditing(true)} disabled={busy} className="text-sm text-brand-400 underline">Completar o editar ficha</button></div><div className="grid sm:grid-cols-2 gap-3">{checks.map(check => <div key={check.key} className={`flex gap-2 items-start text-sm ${check.complete ? 'text-slate-300' : 'text-amber-300'}`}>{check.complete ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 mt-0.5 shrink-0" />}{check.label}</div>)}</div></section>
          <section className="glass-card p-5 space-y-4"><h3 className="font-bold">Expediente para la liga</h3><p className="text-sm text-slate-400">Ficha, foto recortada, firmas, cédula por ambos lados y todas las páginas del certificado. Para menores se añade la autorización del apoderado.</p><button onClick={() => void generate()} disabled={busy || missing.length > 0} className="btn-primary w-full sm:w-auto disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Generar ficha PDF</button>{missing.length > 0 && <p className="text-xs text-amber-300">Completa los requisitos pendientes para generar el expediente.</p>}
            {pdfUrl && <><a href={pdfUrl} download={`Ficha_${player.RUT.replace(/[^0-9kK]/g, '')}.pdf`} className="inline-flex text-brand-400 underline">Descargar ficha PDF</a><iframe title="Vista previa de la ficha PDF" src={pdfUrl} className="w-full h-[65vh] bg-white rounded-xl" /><a href={pdfUrl} target="_blank" rel="noreferrer" className="block text-sm underline text-slate-300">Abrir PDF en otra pestaña</a></>}
          </section>
        </>}
        {error && <p role="alert" className="text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">{error}</p>}
        {message && <p role="status" className="text-green-300 text-sm">{message}</p>}
      </div>
    </div>
  </div>;
}
