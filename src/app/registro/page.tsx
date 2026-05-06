'use client';

import { useState, useMemo } from "react";
import { 
  UserPlus, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  FileText,
  Image as ImageIcon,
  UserCheck
} from "lucide-react";

export default function RegistroPublico() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [apoderadoConsent, setApoderadoConsent] = useState(false);

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

  const [files, setFiles] = useState<{
    frontal: File | null, 
    reverso: File | null, 
    antecedentes: File | null,
    frontalApoderado: File | null,
    reversoApoderado: File | null
  }>({
    frontal: null,
    reverso: null,
    antecedentes: null,
    frontalApoderado: null,
    reversoApoderado: null
  });

  // Cálculo de edad en tiempo real
  const isMinor = useMemo(() => {
    if (!formData.Fecha_Nacimiento) return false;
    const birthDate = new Date(formData.Fecha_Nacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  }, [formData.Fecha_Nacimiento]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (type: keyof typeof files, file: File | null) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

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

  const uploadToCloudinary = async (fileData: string) => {
    const formData = new FormData();
    formData.append('file', fileData);
    formData.append('upload_preset', 'vallegrande_docs');
    formData.append('resource_type', 'auto');

    const res = await fetch(`https://api.cloudinary.com/v1_1/dppv8v6bt/auto/upload`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok) {
      console.error("Cloudinary Error Details:", data);
      throw new Error(data.error?.message || "Error al subir a la nube");
    }
    return data.secure_url;
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones base
    if (!files.frontal || !files.reverso || !files.antecedentes) {
      setError("Debes subir los 3 documentos obligatorios del jugador.");
      return;
    }

    // Validaciones menores de edad
    if (isMinor) {
      if (!files.frontalApoderado || !files.reversoApoderado) {
        setError("Como el jugador es menor de edad, se requiere la cédula del apoderado.");
        return;
      }
      if (!apoderadoConsent) {
        setError("El apoderado debe aceptar el consentimiento para continuar.");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      setUploadProgress("Subiendo cédula frontal...");
      const frontalUrl = await uploadToCloudinary(await compressImage(files.frontal!));
      
      setUploadProgress("Subiendo cédula reverso...");
      const reversoUrl = await uploadToCloudinary(await compressImage(files.reverso!));
      
      setUploadProgress("Subiendo antecedentes...");
      const antecedentesUrl = await uploadToCloudinary(await getBase64(files.antecedentes!));

      let frontalApoderadoUrl = "";
      let reversoApoderadoUrl = "";

      if (isMinor) {
        setUploadProgress("Subiendo documentos del apoderado...");
        frontalApoderadoUrl = await uploadToCloudinary(await compressImage(files.frontalApoderado!));
        reversoApoderadoUrl = await uploadToCloudinary(await compressImage(files.reversoApoderado!));
      }

      setUploadProgress("Finalizando registro...");
      const payload = {
        ...formData,
        action: "CREATE",
        Foto_Cedula_Frontal: frontalUrl,
        Foto_Cedula_Reverso: reversoUrl,
        Antecedentes_PDF: antecedentesUrl,
        Observaciones: isMinor 
          ? `${formData.Observaciones} | APODERADO OK | Doc Apoderado: ${frontalApoderadoUrl} , ${reversoApoderadoUrl}`
          : formData.Observaciones,
        Status_Validacion: "POR FEDERAR"
      };

      console.log("DEBUG: Enviando payload desde Portal REGISTRO:", payload);

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) setIsSuccess(true);
      else throw new Error(result.error);

    } catch (err: any) {
      setError("Error: " + err.message);
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
            <h1 className="text-3xl font-bold text-white">¡Registro Enviado!</h1>
            <p className="text-slate-400">La inscripción ha sido recibida correctamente.</p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full btn-primary py-3">Volver al inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Inscripción Valle Grande FC</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card p-6 md:p-8 space-y-8 border-slate-800 shadow-2xl">
            {/* Datos Jugador */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-400 border-b border-slate-800 pb-2">
                <UserPlus className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider text-sm">Información del Jugador</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required name="RUT" value={formData.RUT} onChange={handleInputChange} placeholder="RUT del Jugador" className="input-field w-full text-base" />
                <input required name="Nombres" value={formData.Nombres} onChange={handleInputChange} placeholder="Nombres" className="input-field w-full text-base" />
                <input required name="Apellido_Paterno" value={formData.Apellido_Paterno} onChange={handleInputChange} placeholder="Apellido Paterno" className="input-field w-full text-base" />
                <input required name="Apellido_Materno" value={formData.Apellido_Materno} onChange={handleInputChange} placeholder="Apellido Materno" className="input-field w-full text-base" />
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase ml-1">Fecha de Nacimiento</label>
                  <input required type="date" name="Fecha_Nacimiento" value={formData.Fecha_Nacimiento} onChange={handleInputChange} className="input-field w-full text-base" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] text-slate-500 uppercase ml-1">Serie</label>
                  <select required name="Serie" value={formData.Serie} onChange={handleInputChange} className="input-field w-full text-base">
                    <option value="">Selecciona serie...</option>
                    {[
                      "1ERA INFANTIL", "2DA INFANTIL", "3RA INFANTIL", "4TA INFANTIL", "JUVENIL", 
                      "3RA ADULTA", "2DA ADULTA", "1ERA ADULTA", "SENIOR", "SUPER SENIOR", 
                      "DORADOS", "FEMENINA INFANTIL", "FEMENINA ADULTA"
                    ]
                    .filter(s => {
                      if (!formData.Fecha_Nacimiento) return true; // Mostrar todas si no hay fecha aún
                      if (isMinor) {
                        return s.includes("INFANTIL") || s.includes("JUVENIL");
                      } else {
                        return s.includes("ADULTA") || s.includes("SENIOR") || s.includes("DORADOS");
                      }
                    })
                    .map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Documentos Jugador */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-2">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider text-sm">Documentos del Jugador</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FileUploader label="Cédula Frontal" file={files.frontal} onChange={(f) => handleFileChange('frontal', f)} icon={<ImageIcon />} />
                <FileUploader label="Cédula Reverso" file={files.reverso} onChange={(f) => handleFileChange('reverso', f)} icon={<ImageIcon />} />
                <FileUploader label="Antecedentes" file={files.antecedentes} onChange={(f) => handleFileChange('antecedentes', f)} icon={<FileText />} />
              </div>
            </div>

            {/* SECCIÓN ESPECIAL MENORES DE EDAD */}
            {isMinor && (
              <div className="space-y-6 p-6 bg-brand-500/5 border border-brand-500/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-2 text-brand-400 border-b border-brand-500/20 pb-2">
                  <UserCheck className="w-5 h-5" />
                  <h2 className="font-bold uppercase tracking-wider text-sm">Requisitos para Menores de Edad</h2>
                </div>
                
                <p className="text-sm text-slate-300">Se detectó que el jugador es menor de edad. Debe adjuntar los documentos del apoderado.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileUploader label="Cédula Apoderado (Frontal)" file={files.frontalApoderado} onChange={(f) => handleFileChange('frontalApoderado', f)} icon={<ImageIcon />} color="border-brand-500/30" />
                  <FileUploader label="Cédula Apoderado (Reverso)" file={files.reversoApoderado} onChange={(f) => handleFileChange('reversoApoderado', f)} icon={<ImageIcon />} color="border-brand-500/30" />
                </div>

                <label className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-xl cursor-pointer hover:bg-slate-900 transition-colors group border border-slate-800">
                  <input type="checkbox" checked={apoderadoConsent} onChange={(e) => setApoderadoConsent(e.target.checked)} className="mt-1 accent-brand-500 h-5 w-5 shrink-0" />
                  <span className="text-xs text-slate-300 leading-relaxed group-hover:text-white transition-colors italic">
                    "Yo como apoderado del jugador que procede a inscribirse, estoy de acuerdo que el club Centro Cultural Social y Deportivo Valle Grande Fc inscriba a mi hijo o hija como su jugador"
                  </span>
                </label>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-4 text-lg font-bold shadow-xl shadow-brand-500/20 disabled:opacity-50 flex items-center justify-center gap-3">
              {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{uploadProgress}</span></> : <><ShieldCheck className="w-5 h-5" /><span>Finalizar Inscripción</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FileUploader({ label, file, onChange, icon, color = "border-slate-700" }: { label: string, file: File | null, onChange: (f: File | null) => void, icon: any, color?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-medium text-slate-500 uppercase ml-1">{label}</label>
      <div className={`relative border-2 border-dashed ${file ? 'border-emerald-500 bg-emerald-500/5' : color} rounded-xl p-4 text-center cursor-pointer hover:border-brand-500 transition-all`}>
        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        <div className={`w-8 h-8 mx-auto mb-1 ${file ? 'text-emerald-500' : 'text-slate-500'}`}>{icon}</div>
        <span className="text-[10px] text-slate-400 block truncate">{file ? file.name : "Subir Archivo"}</span>
      </div>
    </div>
  );
}
