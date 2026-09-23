'use client';

import { useRef, useState, type PointerEvent } from 'react';

export function SignaturePad({ label, onChange, disabled = false }: { label: string; onChange: (value: string) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const distance = useRef(0);
  const previous = useRef({ x: 0, y: 0 });
  const [signed, setSigned] = useState(false);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 800 / rect.width, y: (event.clientY - rect.top) * 260 / rect.height };
  };
  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    previous.current = point(event); drawing.current = true;
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const next = point(event);
    distance.current += Math.hypot(next.x - previous.current.x, next.y - previous.current.y);
    context.strokeStyle = '#172554'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round';
    context.beginPath(); context.moveTo(previous.current.x, previous.current.y); context.lineTo(next.x, next.y); context.stroke();
    previous.current = next;
  }
  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    if (distance.current >= 30 && canvas.current) { setSigned(true); onChange(canvas.current.toDataURL('image/png')); }
  }
  function clear() {
    canvas.current?.getContext('2d')?.clearRect(0, 0, 800, 260);
    distance.current = 0; drawing.current = false; setSigned(false); onChange('');
  }
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3"><span className="font-medium text-sm">{label}</span><button type="button" onClick={clear} disabled={disabled} className="text-sm text-brand-400 underline disabled:opacity-50">Borrar firma</button></div>
    <canvas ref={canvas} width={800} height={260} aria-label={label} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} className="w-full rounded-xl bg-white border-2 border-slate-600 touch-none" style={{ aspectRatio: '800 / 260' }} />
    <p className="text-xs text-slate-400" aria-live="polite">{signed ? 'Firma capturada. Puedes borrarla y repetirla.' : 'Firma dentro del recuadro con el dedo o el mouse.'}</p>
  </div>;
}
