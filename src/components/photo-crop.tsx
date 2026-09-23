'use client';

import { useEffect, useRef, useState } from 'react';
import { loadImage } from '@/lib/client-files';

export function PhotoCrop({ source, onConfirm, disabled = false }: { source: string; onConfirm: (data: string) => void; disabled?: boolean }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const [x, setX] = useState(12);
  const [y, setY] = useState(18);
  const [size, setSize] = useState(25);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadImage(source).then(img => {
      if (cancelled) return;
      const rotated = document.createElement('canvas');
      const sideways = rotation % 180 !== 0;
      rotated.width = sideways ? img.height : img.width; rotated.height = sideways ? img.width : img.height;
      const ctx = rotated.getContext('2d')!;
      ctx.translate(rotated.width / 2, rotated.height / 2); ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const width = Math.min(rotated.width * size / 100, rotated.height * 3 / 4);
      const height = width * 4 / 3;
      const left = (rotated.width - width) * x / 100;
      const top = (rotated.height - height) * y / 100;
      const output = preview.current?.getContext('2d');
      if (!output) return;
      output.fillStyle = '#fff'; output.fillRect(0, 0, 300, 400);
      output.drawImage(rotated, left, top, width, height, 0, 0, 300, 400);
      setReady(true);
    }).catch(() => { if (!cancelled) setError('No se pudo recortar esta imagen.'); });
    return () => { cancelled = true; };
  }, [source, x, y, size, rotation]);
  const change = (setter: (value: number) => void, value: number) => { setReady(false); setConfirmed(false); onConfirm(''); setter(value); };
  return <section className="rounded-xl border border-slate-700 p-4 space-y-4">
    <div><h3 className="font-semibold">Foto para la ficha</h3><p className="text-sm text-slate-400">Recorta solo el rostro de la cédula frontal. Ajusta la vista previa y confirma.</p></div>
    <div className="flex flex-col sm:flex-row gap-5 items-center">
      <canvas ref={preview} width={300} height={400} aria-label="Vista previa de la foto recortada" className="w-28 h-auto rounded-lg bg-white border border-slate-600" />
      <div className="w-full space-y-3">
        {([{ label: 'Posición horizontal', value: x, setter: setX, min: 0, max: 100 }, { label: 'Posición vertical', value: y, setter: setY, min: 0, max: 100 }, { label: 'Tamaño del recorte', value: size, setter: setSize, min: 8, max: 100 }]).map(control => <label key={control.label} className="block text-xs text-slate-300">{control.label}<input aria-label={control.label} type="range" min={control.min} max={control.max} value={control.value} disabled={disabled} onChange={e => change(control.setter, Number(e.target.value))} className="w-full accent-green-500 block mt-2" /></label>)}
        <button type="button" disabled={disabled} onClick={() => change(setRotation, (rotation + 90) % 360)} className="text-sm underline text-slate-300">Girar cédula 90°</button>
      </div>
    </div>
    {error && <p role="alert" className="text-rose-400">{error}</p>}
    <button type="button" disabled={disabled || !ready} onClick={() => { if (preview.current) { onConfirm(preview.current.toDataURL('image/jpeg', 0.92)); setConfirmed(true); } }} className="btn-primary w-full disabled:opacity-50">{confirmed ? 'Foto confirmada' : 'Usar esta foto'}</button>
  </section>;
}
