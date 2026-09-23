'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { SignaturePad } from './signature-pad';
import { PhotoCrop } from './photo-crop';
import { apiPost, prepareImage, readDataUrl, uploadDataUrl, validateFile } from '@/lib/client-files';
import { AUTHORIZATION_VERSION, automaticStatus, guardianAuthorization, isMinor, localDate, missingRequirements, playerAuthorization, REGISTRATION_TYPES, type DocumentField, type Player } from '@/lib/registration';

const SERIES = ['1ERA INFANTIL', '2DA INFANTIL', '3RA INFANTIL', '4TA INFANTIL', 'JUVENIL', '3RA ADULTA', '2DA ADULTA', '1ERA ADULTA', 'SENIOR', 'SUPER SENIOR', 'DORADOS', 'FEMENINA INFANTIL', 'FEMENINA ADULTA'];
const empty: Player = { RUT: '', Nombres: '', Apellido_Paterno: '', Apellido_Materno: '', Fecha_Nacimiento: '', Nacionalidad: 'CHILENA', Serie: '', WhatsApp: '', Direccion: '', Posicion: '', Nombre_Apoderado: '', RUT_Apoderado: '' };
const labels: Partial<Record<DocumentField, string>> = { Foto_Cedula_Frontal: 'Cédula frontal', Foto_Cedula_Reverso: 'Cédula reverso', Antecedentes_PDF: 'Certificado de antecedentes', Foto_Cedula_Padre_Frontal: 'Cédula del apoderado: frontal', Foto_Cedula_Padre_Reverso: 'Cédula del apoderado: reverso' };

export function RegistrationForm({ initial, onSaved, admin = false }: { initial?: Player; onSaved?: (player: Player) => void; admin?: boolean }) {
  const [data, setData] = useState<Player>(() => ({ ...empty, ...initial, Fecha_Nacimiento: initial?.Fecha_Nacimiento?.slice(0, 10) || '', Fecha_Inscripcion: initial?.Fecha_Inscripcion?.slice(0, 10) || initial?.Fecha_Registro?.slice(0, 10) || localDate() }));
  const [assets, setAssets] = useState<Partial<Record<DocumentField, string>>>({});
  const [cropSource, setCropSource] = useState('');
  const [signature, setSignature] = useState('');
  const [guardianSignature, setGuardianSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [capable, setCapable] = useState<boolean | null>(null);
  const uploadCache = useRef(new Map<string, string>());
  const requestId = useRef('');
  const minor = isMinor(data);
  const authorization = playerAuthorization(data);
  const guardianText = guardianAuthorization(data);
  const existingSignature = !!data.Firma_Jugador && data.Autorizacion_Texto === authorization;
  const existingGuardianSignature = !!data.Firma_Apoderado && data.Autorizacion_Apoderado_Texto === guardianText;
  useEffect(() => {
    let active = true;
    fetch('/api/players?capabilities=1').then(r => r.json()).then(value => { if (active) setCapable(value.registrationVersion === 1); }).catch(() => { if (active) setCapable(false); });
    return () => { active = false; };
  }, []);
  function change(field: string, value: string) {
    setData(prev => ({ ...prev, [field]: value }));
    if (['Nombres', 'Apellido_Paterno', 'Apellido_Materno', 'RUT', 'Fecha_Nacimiento'].includes(field)) { setSignature(''); setConsent(false); setGuardianSignature(''); setGuardianConsent(false); }
    if (['Nombre_Apoderado', 'RUT_Apoderado'].includes(field)) { setGuardianSignature(''); setGuardianConsent(false); }
  }
  async function selectFile(field: DocumentField, file?: File) {
    if (!file) return;
    setProcessing(true); setError('');
    try {
      const pdf = field === 'Antecedentes_PDF'; validateFile(file, pdf);
      const source = pdf ? await readDataUrl(file) : await prepareImage(file);
      setAssets(prev => ({ ...prev, [field]: source, ...(field === 'Foto_Cedula_Frontal' ? { Foto_Jugador: '' } : {}) }));
      if (field === 'Foto_Cedula_Frontal') { setCropSource(source); setData(prev => ({ ...prev, Foto_Jugador: '' })); }
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.'); }
    finally { setProcessing(false); }
  }
  async function cropExisting() {
    setProcessing(true); setError('');
    try {
      const response = await fetch(`/api/players/document?rut=${encodeURIComponent(initial!.RUT)}&field=Foto_Cedula_Frontal`);
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      const source = await readDataUrl(await response.blob());
      setCropSource(source);
      setAssets(prev => ({ ...prev, Foto_Jugador: '' }));
      setData(prev => ({ ...prev, Foto_Jugador: '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo abrir la cédula.'); }
    finally { setProcessing(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!capable) { setError('La conexión de inscripciones todavía no está lista. Contacta al club.'); return; }
    const prepared: Player = { ...data, ...assets };
    if (!admin && !prepared.Tipo_Inscripcion) prepared.Tipo_Inscripcion = minor ? 'INSC INF/JUV' : 'INSC ADULTO';
    if (signature) {
      if (!consent) { setError('Acepta la autorización del jugador antes de guardar.'); return; }
      prepared.Firma_Jugador = signature; prepared.Autorizacion_Texto = authorization;
      prepared.Autorizacion_Version = AUTHORIZATION_VERSION; prepared.Fecha_Firma = new Date().toISOString();
    } else if (!existingSignature) prepared.Firma_Jugador = '';
    if (minor && guardianSignature) {
      if (!guardianConsent) { setError('El apoderado debe aceptar la autorización.'); return; }
      prepared.Firma_Apoderado = guardianSignature; prepared.Autorizacion_Apoderado_Texto = guardianText; prepared.Fecha_Firma_Apoderado = new Date().toISOString();
    } else if (!existingGuardianSignature) prepared.Firma_Apoderado = '';
    const missing = missingRequirements(prepared);
    if (!admin && missing.length) { setError(`Falta completar: ${missing.join(', ')}.`); return; }
    if (!prepared.Nombres.trim() || !prepared.RUT.trim()) { setError('Completa al menos el nombre y el RUT.'); return; }
    setBusy(true);
    try {
      const pending: Partial<Record<DocumentField, string>> = { ...assets, ...(signature ? { Firma_Jugador: signature } : {}), ...(minor && guardianSignature ? { Firma_Apoderado: guardianSignature } : {}) };
      for (const [field, source] of Object.entries(pending)) {
        if (!source) continue;
        setProgress(`Guardando ${labels[field as DocumentField] || (field.includes('Firma') ? 'firma' : 'foto recortada')}…`);
        let url = uploadCache.current.get(source);
        if (!url) {
          const extension = source.startsWith('data:application/pdf') ? 'pdf' : source.startsWith('data:image/png') ? 'png' : 'jpg';
          url = await uploadDataUrl(source, `${prepared.RUT.replace(/[^0-9kK]/g, '')}_${field}.${extension}`);
          uploadCache.current.set(source, url);
        }
        prepared[field] = url;
      }
      prepared.Status_Validacion = automaticStatus(prepared);
      setProgress('Guardando inscripción…');
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const result = await apiPost({ action: initial ? 'UPDATE_REGISTRATION' : 'CREATE_REGISTRATION', player: prepared, originalRut: initial?.RUT, complete: !admin, requestId: requestId.current });
      onSaved?.(result.player); setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la inscripción.'); }
    finally { setBusy(false); setProgress(''); }
  }
  const input = (field: string, label: string, type = 'text', required = false) => <label className="block text-sm text-slate-300" key={field}>{label}{required && ' *'}<input aria-label={label} type={type} value={data[field] || ''} required={required} readOnly={field === 'RUT' && !!initial} maxLength={type === 'text' ? 180 : undefined} max={type === 'date' ? localDate() : undefined} onChange={e => change(field, e.target.value)} className="input-field w-full mt-1 read-only:opacity-60" /></label>;
  const fileInput = (field: DocumentField) => <label key={field} className="block p-4 border border-slate-700 rounded-xl text-sm"><span className="block mb-2 font-medium">{labels[field]}</span><span className="block text-xs text-slate-400 mb-2">{assets[field] ? 'Archivo preparado' : data[field] ? 'Documento guardado. Puedes reemplazarlo.' : field === 'Antecedentes_PDF' ? 'PDF, hasta 2,5 MB' : 'JPG, PNG o WebP, hasta 10 MB'}</span><input aria-label={labels[field]} type="file" accept={field === 'Antecedentes_PDF' ? 'application/pdf' : 'image/jpeg,image/png,image/webp'} onChange={e => void selectFile(field, e.target.files?.[0])} className="block w-full text-xs file:rounded-lg file:border-0 file:bg-slate-700 file:text-white file:p-2 file:mr-2" /></label>;
  if (success) return <div className="glass-card p-10 text-center space-y-4"><CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto" /><h2 className="text-2xl font-bold">Inscripción guardada</h2><p className="text-slate-400">El club revisará la ficha y tramitará la inscripción en la liga.</p>{!admin && <button type="button" className="btn-primary mx-auto" onClick={() => window.location.reload()}>Registrar otro jugador</button>}</div>;
  return <form onSubmit={submit} className="space-y-6">
    {capable === false && <p role="status" className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-200">Las nuevas inscripciones estarán disponibles cuando el club termine de conectar el sistema. Tus datos aún no se han enviado.</p>}
    <fieldset disabled={busy || processing} className="space-y-6 disabled:opacity-70">
      <section className="glass-card p-5 sm:p-7 space-y-5"><h2 className="font-bold text-lg">1. Datos del jugador</h2><div className="grid sm:grid-cols-2 gap-4">
        {input('RUT', 'RUT del jugador', 'text', true)}{input('Nombres', 'Nombres', 'text', true)}{input('Apellido_Paterno', 'Apellido paterno', 'text', true)}{input('Apellido_Materno', 'Apellido materno', 'text', !admin)}{input('Fecha_Nacimiento', 'Fecha de nacimiento', 'date', !admin)}{input('Nacionalidad', 'Nacionalidad', 'text', !admin)}
        <label className="text-sm text-slate-300">Serie *<select aria-label="Serie" required={!admin} value={data.Serie} onChange={e => change('Serie', e.target.value)} className="input-field w-full mt-1"><option value="">Selecciona una serie</option>{SERIES.map(s => <option key={s}>{s}</option>)}</select></label>
        {input('WhatsApp', 'WhatsApp', 'tel')}{input('Direccion', 'Dirección')}
        {admin && <label className="text-sm text-slate-300">Tipo de inscripción<select aria-label="Tipo de inscripción" value={data.Tipo_Inscripcion || ''} onChange={e => change('Tipo_Inscripcion', e.target.value)} className="input-field w-full mt-1"><option value="">Seleccionar trámite</option>{REGISTRATION_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>}
      </div></section>
      <section className="glass-card p-5 sm:p-7 space-y-5"><h2 className="font-bold text-lg">2. Documentos y foto</h2><div className="grid sm:grid-cols-2 gap-4">{fileInput('Foto_Cedula_Frontal')}{fileInput('Foto_Cedula_Reverso')}{fileInput('Antecedentes_PDF')}</div>
        {cropSource ? <PhotoCrop key={cropSource} source={cropSource} onConfirm={value => setAssets(prev => ({ ...prev, Foto_Jugador: value }))} disabled={busy || processing} /> : data.Foto_Cedula_Frontal && <button type="button" onClick={() => void cropExisting()} className="btn-primary">{data.Foto_Jugador ? 'Ajustar foto desde la cédula' : 'Recortar foto desde la cédula guardada'}</button>}
        {!data.Foto_Cedula_Frontal && !assets.Foto_Cedula_Frontal && <p className="text-sm text-slate-400">Al adjuntar la cédula frontal podrás recortar la foto para la ficha.</p>}
      </section>
      {minor && <section className="glass-card p-5 sm:p-7 space-y-5"><h2 className="font-bold text-lg">Apoderado del menor de edad</h2><div className="grid sm:grid-cols-2 gap-4">{input('Nombre_Apoderado', 'Nombre completo del apoderado', 'text', !admin)}{input('RUT_Apoderado', 'RUT del apoderado', 'text', !admin)}{fileInput('Foto_Cedula_Padre_Frontal')}{fileInput('Foto_Cedula_Padre_Reverso')}</div><p className="text-sm text-slate-300 leading-relaxed">{guardianText}</p>
        {existingGuardianSignature && !guardianSignature && <p className="text-sm text-brand-400">Autorización y firma del apoderado guardadas.</p>}
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={guardianConsent} onChange={e => setGuardianConsent(e.target.checked)} className="accent-green-500" />Soy el apoderado y acepto esta autorización.</label>
        <SignaturePad key={guardianText} label="Firma del apoderado" onChange={setGuardianSignature} disabled={busy || processing} />
      </section>}
      <section className="glass-card p-5 sm:p-7 space-y-5"><h2 className="font-bold text-lg">3. Autorización y firma del jugador</h2><p className="text-sm leading-relaxed text-slate-300">{authorization}</p>
        {existingSignature && !signature && <p className="text-sm text-brand-400">Firma y autorización guardadas. Solo vuelve a firmar si necesitas reemplazarlas.</p>}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-green-500" />Acepto esta autorización y que mi firma se incorpore en la ficha y en la autorización de inscripción.</label>
        <SignaturePad key={`${authorization}|${data.Fecha_Nacimiento}`} label="Firma del jugador" onChange={setSignature} disabled={busy || processing} />
      </section>
    </fieldset>
    {error && <p role="alert" className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">{error}</p>}
    <button type="submit" disabled={busy || processing || capable !== true} className="btn-primary w-full py-4 disabled:opacity-50">{busy || processing ? <><Loader2 className="w-5 h-5 animate-spin" />{progress || 'Preparando documento…'}</> : admin ? 'Guardar ficha del jugador' : 'Enviar inscripción firmada'}</button>
    {admin && <p className="text-xs text-slate-400">Puedes guardar una ficha incompleta como pendiente. La firma debe realizarla el jugador; para menores, también firma el apoderado.</p>}
  </form>;
}
