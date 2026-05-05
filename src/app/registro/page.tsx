'use client';

import { useState } from "react";
import { 
  UserPlus, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  FileText,
  Image as ImageIcon
} from "lucide-react";

export default function RegistroPublico() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const [formData, setFormData] = useState({
    RUT: "",
    Nombres: "",
    Apellido_Paterno: "",
    Apellido_Materno: "",
    Fecha_Nacimiento: "",
    Nacionalidad: "Chile",
    Serie: "",
    WhatsApp: "",
    Direccion: "",
    Posicion: "",
    Observaciones: "Registro Autónomo desde Portal Público"
  });

  const [files, setFiles] = useState<{frontal: File | null, reverso: File | null, antecedentes: File | null}>({
    frontal: null,
    reverso: null,
    antecedentes: null
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (type: 'frontal' | 'reverso' | 'antecedentes', file: File | null) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  // ----- LÓGICA DE COMPRESIÓN REUTILIZADA -----
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          let scaleSize = 1;
          if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  };

  const uploadToCloudinary = async (base64: string) => {
    const res = await fetch(`https://api.cloudinary.com/v1_1/dppv8v6bt/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: base64,
        upload_preset: "vallegrande_docs",
      })
    });
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.frontal || !files.reverso || !files.antecedentes) {
      setError("Debes subir los 3 documentos obligatorios para continuar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      setUploadProgress("Comprimiendo y subiendo Carnet (Frontal)...");
      const frontalBase64 = await compressImage(files.frontal);
      const frontalUrl = await uploadToCloudinary(frontalBase64);

      setUploadProgress("Comprimiendo y subiendo Carnet (Reverso)...");
      const reversoBase64 = await compressImage(files.reverso);
      const reversoUrl = await uploadToCloudinary(reversoBase64);

      setUploadProgress("Subiendo Certificado de Antecedentes...");
      // Para PDF no comprimimos, subimos directo base64
      const reader = new FileReader();
      const antecedentesUrl = await new Promise<string>((resolve) => {
        reader.readAsDataURL(files.antecedentes!);
        reader.onload = async () => {
          const url = await uploadToCloudinary(reader.result as string);
          resolve(url);
        };
      });

      setUploadProgress("Guardando registro oficial...");
      const payload = {
        ...formData,
        action: "CREATE",
        Foto_Cedula_Frontal: frontalUrl,
        Foto_Cedula_Reverso: reversoUrl,
        Antecedentes_PDF: antecedentesUrl,
        Status_Validacion: "POR FEDERAR" // Al subir todo, entra directo a esta categoría
      };

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) setIsSuccess(true);
      else throw new Error(result.error);

    } catch (err: any) {
      setError("Hubo un problema: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">¡Registro Exitoso!</h1>
            <p className="text-slate-400">Tus datos y documentos han sido enviados correctamente.</p>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-sm text-slate-300">
            Tu estado actual es <span className="text-brand-400 font-bold">POR FEDERAR</span>. La administración revisará tus documentos en las próximas horas.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full btn-primary py-3"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain drop-shadow-2xl" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Inscripción Valle Grande FC</h1>
            <p className="text-slate-400 mt-2 text-lg">Completa tus datos y sube tus documentos para la federación.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card p-6 md:p-8 space-y-8 border-slate-800 shadow-2xl">
            {/* Sección 1: Datos Personales */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-400 border-b border-slate-800 pb-2">
                <UserPlus className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider text-sm">Información del Jugador</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">RUT (Sin puntos, con guion) *</label>
                  <input required name="RUT" value={formData.RUT} onChange={handleInputChange} placeholder="12345678-9" className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Nombres *</label>
                  <input required name="Nombres" value={formData.Nombres} onChange={handleInputChange} className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Apellido Paterno *</label>
                  <input required name="Apellido_Paterno" value={formData.Apellido_Paterno} onChange={handleInputChange} className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Apellido Materno *</label>
                  <input required name="Apellido_Materno" value={formData.Apellido_Materno} onChange={handleInputChange} className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Fecha de Nacimiento *</label>
                  <input required type="date" name="Fecha_Nacimiento" value={formData.Fecha_Nacimiento} onChange={handleInputChange} className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Serie *</label>
                  <select required name="Serie" value={formData.Serie} onChange={handleInputChange} className="input-field w-full text-base appearance-none">
                    <option value="">Selecciona tu serie...</option>
                    {["1ERA INFANTIL", "2DA INFANTIL", "3RA INFANTIL", "4TA INFANTIL", "JUVENIL", "3RA ADULTA", "2DA ADULTA", "1ERA ADULTA", "SENIOR", "SUPER SENIOR", "DORADOS", "FEMENINA INFANTIL", "FEMENINA ADULTA"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 2: Documentos OBLIGATORIOS */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-2">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider text-sm">Documentación Obligatoria</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Carnet Frontal */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Cédula (Frontal)</label>
                  <div className={`relative border-2 border-dashed ${files.frontal ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'} rounded-xl p-4 text-center cursor-pointer hover:border-brand-500 transition-all`}>
                    <input required type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileChange('frontal', e.target.files?.[0] || null)} />
                    {files.frontal ? <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" /> : <ImageIcon className="w-8 h-8 mx-auto text-slate-500 mb-1" />}
                    <span className="text-[10px] text-slate-400 block truncate">{files.frontal ? files.frontal.name : "Subir Foto"}</span>
                  </div>
                </div>

                {/* Carnet Reverso */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Cédula (Reverso)</label>
                  <div className={`relative border-2 border-dashed ${files.reverso ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'} rounded-xl p-4 text-center cursor-pointer hover:border-brand-500 transition-all`}>
                    <input required type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileChange('reverso', e.target.files?.[0] || null)} />
                    {files.reverso ? <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" /> : <ImageIcon className="w-8 h-8 mx-auto text-slate-500 mb-1" />}
                    <span className="text-[10px] text-slate-400 block truncate">{files.reverso ? files.reverso.name : "Subir Foto"}</span>
                  </div>
                </div>

                {/* Antecedentes */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Antecedentes (PDF/Foto)</label>
                  <div className={`relative border-2 border-dashed ${files.antecedentes ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'} rounded-xl p-4 text-center cursor-pointer hover:border-brand-500 transition-all`}>
                    <input required type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileChange('antecedentes', e.target.files?.[0] || null)} />
                    {files.antecedentes ? <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" /> : <FileText className="w-8 h-8 mx-auto text-slate-500 mb-1" />}
                    <span className="text-[10px] text-slate-400 block truncate">{files.antecedentes ? files.antecedentes.name : "Subir Archivo"}</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-4 text-lg font-bold shadow-xl shadow-brand-500/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{uploadProgress || "Procesando..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Finalizar Inscripción</span>
                </>
              )}
            </button>
          </div>
        </form>

        <footer className="text-center py-8">
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Valle Grande FC - Gestión Deportiva Digital</p>
        </footer>
      </div>
    </div>
  );
}
