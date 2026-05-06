'use client';

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Loader2,
  RefreshCw,
  X,
  Save,
  Baby,
  Flame,
  User,
  Star,
  UserRound,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileText,
  ShieldCheck,
  Image as ImageIcon,
  Download,
  Filter,
  Upload,
  UserPlus
} from "lucide-react";

interface Player {
  ID_Jugador: string;
  RUT: string;
  Nombres: string;
  Apellido_Paterno: string;
  Apellido_Materno: string;
  Serie: string;
  Status_Validacion: string;
  [key: string]: any;
}

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentView, setCurrentView] = useState("dashboard");

  // Estados para el Modal de Registro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para el Perfil del Jugador
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{frontal?: File, reverso?: File, antecedentes?: File}>({});
  const [registrationFiles, setRegistrationFiles] = useState<{frontal?: File, reverso?: File, antecedentes?: File, frontalApoderado?: File, reversoApoderado?: File}>({});
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
    Observaciones: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Agregamos un timestamp para que el navegador nunca use datos cacheados
      const res = await fetch(`/api/players?t=${new Date().getTime()}`, { cache: 'no-store' });
      
      if (!res.ok) {
        throw new Error(`Error del servidor: ${res.status}`);
      }

      const data = await res.json();
      
      if (data && Array.isArray(data)) {
        setPlayers(data);
      } else {
        console.error("Los datos recibidos no son un array:", data);
        setPlayers([]);
      }
    } catch (error) {
      console.error("Error detallado al conectar con Google Sheets:", error);
      // No dejamos que el error rompa la ejecución, simplemente mostramos lista vacía
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Detectar si es menor de edad
      const today = new Date();
      const birthDate = new Date(formData.Fecha_Nacimiento);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      const isMinor = age < 18;

      // 2. Subir archivos a Cloudinary si existen
      const docPayload: any = {};
      
      if (registrationFiles.frontal) {
        docPayload.Foto_Cedula_Frontal = await uploadToCloudinary(await compressImage(registrationFiles.frontal));
      }
      if (registrationFiles.reverso) {
        docPayload.Foto_Cedula_Reverso = await uploadToCloudinary(await compressImage(registrationFiles.reverso));
      }
      if (registrationFiles.antecedentes) {
        docPayload.Antecedentes_PDF = await uploadToCloudinary(await getBase64(registrationFiles.antecedentes));
      }

      // Si es menor y hay documentos de apoderado, los metemos en observaciones o campos extra
      let obs = formData.Observaciones;
      if (isMinor && registrationFiles.frontalApoderado && registrationFiles.reversoApoderado) {
        const apFrontal = await uploadToCloudinary(await compressImage(registrationFiles.frontalApoderado));
        const apReverso = await uploadToCloudinary(await compressImage(registrationFiles.reversoApoderado));
        obs = `${obs} | APODERADO OK | Doc Apoderado: ${apFrontal} , ${apReverso}`;
      }

      // 3. Crear el jugador con los links de Cloudinary
      const payload = { 
        ...formData, 
        ...docPayload,
        Observaciones: obs,
        action: "CREATE",
        Status_Validacion: (docPayload.Foto_Cedula_Frontal && docPayload.Foto_Cedula_Reverso && docPayload.Antecedentes_PDF) ? "POR FEDERAR" : "Pendiente"
      };

      console.log("DEBUG: Enviando payload CREACIÓN desde Dashboard:", payload);

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        setFormData({
          RUT: "", Nombres: "", Apellido_Paterno: "", Apellido_Materno: "",
          Fecha_Nacimiento: "", Nacionalidad: "Chile", Serie: "",
          WhatsApp: "", Direccion: "", Posicion: "", Observaciones: ""
        });
        setRegistrationFiles({});
        fetchData();
      } else {
        alert("Hubo un error al guardar: " + result.error);
      }
    } catch (error) {
      console.error("Error al enviar:", error);
      alert("Error de conexión al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- FUNCIONES DE COMPRESIÓN Y SUBIDA -----
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024; // Reducimos tamaño
          let scaleSize = 1;
          if (img.width > MAX_WIDTH) {
            scaleSize = MAX_WIDTH / img.width;
          }
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Comprimir a JPEG con calidad 70%
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
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
    if (!res.ok) throw new Error(data.error?.message || `Error al subir`);
    return data.secure_url;
  };

  const handleUpdatePlayerDocs = async (newStatus?: string) => {
    if (!selectedPlayer) return;
    setIsUploading(true);
    try {
      const payload: any = { action: "UPDATE_DOCS", RUT: selectedPlayer.RUT };
      if (selectedFiles.frontal) payload.Foto_Cedula_Frontal = await uploadToCloudinary(await getBase64(selectedFiles.frontal));
      if (selectedFiles.reverso) payload.Foto_Cedula_Reverso = await uploadToCloudinary(await getBase64(selectedFiles.reverso));
      if (selectedFiles.antecedentes) payload.Antecedentes_PDF = await uploadToCloudinary(await getBase64(selectedFiles.antecedentes));
      
      if (newStatus) payload.newStatus = newStatus;

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setSelectedFiles({});
        setSelectedPlayer(null);
        fetchData();
      }
    } catch (error) {
      alert("Error al actualizar.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 p-6 hidden md:block">
        <h1 className="font-bold text-xl mb-10">Valle Grande FC</h1>
        <nav className="space-y-4">
          <button onClick={() => setCurrentView('dashboard')} className="flex items-center gap-2">Dashboard</button>
        </nav>
      </aside>

      <main className="flex-1 p-10">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold">Panel de Control</h1>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary px-4 py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo Jugador
          </button>
        </header>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-6">Registrar Nuevo Jugador</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input required name="RUT" value={formData.RUT} onChange={handleInputChange} placeholder="RUT" className="input-field w-full" />
                <input required name="Nombres" value={formData.Nombres} onChange={handleInputChange} placeholder="Nombres" className="input-field w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <input required name="Apellido_Paterno" value={formData.Apellido_Paterno} onChange={handleInputChange} placeholder="Ap. Paterno" className="input-field w-full" />
                  <input required name="Apellido_Materno" value={formData.Apellido_Materno} onChange={handleInputChange} placeholder="Ap. Materno" className="input-field w-full" />
                </div>
                <input type="date" name="Fecha_Nacimiento" value={formData.Fecha_Nacimiento} onChange={handleInputChange} className="input-field w-full" />
                <select name="Serie" value={formData.Serie} onChange={handleInputChange} className="input-field w-full">
                  <option value="">Seleccione Serie...</option>
                  <option value="1ERA ADULTA">1ERA ADULTA</option>
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input name="WhatsApp" value={formData.WhatsApp} onChange={handleInputChange} placeholder="WhatsApp" className="input-field w-full" />
                  <input name="Posicion" value={formData.Posicion} onChange={handleInputChange} placeholder="Posición" className="input-field w-full" />
                </div>
                <input name="Direccion" value={formData.Direccion} onChange={handleInputChange} placeholder="Dirección" className="input-field w-full" />
                
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <label className="text-xs text-slate-400">Cédula Frontal</label>
                  <input type="file" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, frontal: e.target.files[0]})} className="w-full" />
                  <label className="text-xs text-slate-400">Cédula Reverso</label>
                  <input type="file" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, reverso: e.target.files[0]})} className="w-full" />
                  <label className="text-xs text-slate-400">Antecedentes</label>
                  <input type="file" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, antecedentes: e.target.files[0]})} className="w-full" />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 text-sm">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase">Antecedentes</label>
                      <input type="file" accept="application/pdf" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, antecedentes: e.target.files[0]})} className="input-field w-full text-xs" />
                    </div>
                  </div>
                  
                  {/* Si es menor de edad, mostrar campos para apoderado */}
                  {(() => {
                    if (!formData.Fecha_Nacimiento) return null;
                    const today = new Date();
                    const birthDate = new Date(formData.Fecha_Nacimiento);
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
                    
                    if (age < 18) {
                      return (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-4">
                          <p className="text-xs text-blue-300 font-bold flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> REQUERIDO: Documentos del Apoderado
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 uppercase">Apoderado Frontal</label>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, frontalApoderado: e.target.files[0]})} className="input-field w-full text-xs" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 uppercase">Apoderado Reverso</label>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files && setRegistrationFiles({...registrationFiles, reversoApoderado: e.target.files[0]})} className="input-field w-full text-xs" />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Guardar Jugador</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Perfil de Jugador / Gestión Documental */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden">
            {/* Header del Perfil */}
            <div className="bg-slate-900/90 backdrop-blur-md p-6 border-b border-slate-800 flex items-start justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-2xl font-bold border border-brand-500/30">
                  {selectedPlayer.Nombres?.charAt(0) || "J"}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedPlayer.Nombres?.trim() || selectedPlayer.Nombre?.trim()} {selectedPlayer.Apellido_Paterno?.trim() || selectedPlayer.Apellidos?.trim()}</h2>
                  <div className="flex gap-3 text-sm text-slate-400 mt-1">
                    <span className="font-mono">{selectedPlayer.RUT}</span>
                    <span>•</span>
                    <span className="font-medium text-slate-300">{selectedPlayer.Serie}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => {setSelectedPlayer(null); setSelectedFiles({});}} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Estado de Validación */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-sm text-slate-400 mb-1">Estado de Federación</h3>
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border whitespace-nowrap ${
                    selectedPlayer.Status_Validacion?.toUpperCase() === 'FEDERADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    selectedPlayer.Status_Validacion?.toUpperCase() === 'POR FEDERAR' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <ShieldCheck className="w-4 h-4" />
                    {(selectedPlayer.Status_Validacion || 'PENDIENTE').toUpperCase()}
                  </span>
                </div>
                
                {/* Controles Manuales de Estado */}
                <div className="flex gap-2">
                  {selectedPlayer.Status_Validacion?.toUpperCase() === 'POR FEDERAR' && (
                     <button onClick={() => handleUpdatePlayerDocs("FEDERADO")} disabled={isUploading} className="btn-primary py-2 px-4 text-xs font-bold">
                       Aprobar: Federado
                     </button>
                  )}
                  {selectedPlayer.Status_Validacion?.toUpperCase() === 'FEDERADO' && (
                     <button onClick={() => handleUpdatePlayerDocs("POR FEDERAR")} disabled={isUploading} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">
                       Revertir Estado
                     </button>
                  )}
                </div>
              </div>

              {/* Gestión de Documentos */}
              <div>
                <h3 className="text-sm font-bold text-brand-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Gestión Documental</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Carnet Frontal */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Cédula (Frontal)</label>
                    {selectedPlayer.Foto_Cedula_Frontal?.trim() ? (
                      <a href={selectedPlayer.Foto_Cedula_Frontal} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors">
                        <ImageIcon className="w-5 h-5" /> Ver Documento
                      </a>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-4 text-center cursor-pointer transition-colors group">
                        <input type="file" accept="image/jpeg, image/png, image/webp" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setSelectedFiles({...selectedFiles, frontal: e.target.files[0]});
                        }} />
                        <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${selectedFiles.frontal ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                        <span className="text-xs text-slate-400 truncate block w-full px-2" title={selectedFiles.frontal?.name}>{selectedFiles.frontal ? selectedFiles.frontal.name : "Subir (JPG/PNG)"}</span>
                      </div>
                    )}
                  </div>

                  {/* Carnet Reverso */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Cédula (Reverso)</label>
                    {selectedPlayer.Foto_Cedula_Reverso?.trim() ? (
                      <a href={selectedPlayer.Foto_Cedula_Reverso} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors">
                        <ImageIcon className="w-5 h-5" /> Ver Documento
                      </a>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-4 text-center cursor-pointer transition-colors group">
                        <input type="file" accept="image/jpeg, image/png, image/webp" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setSelectedFiles({...selectedFiles, reverso: e.target.files[0]});
                        }} />
                        <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${selectedFiles.reverso ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                        <span className="text-xs text-slate-400 truncate block w-full px-2" title={selectedFiles.reverso?.name}>{selectedFiles.reverso ? selectedFiles.reverso.name : "Subir (JPG/PNG)"}</span>
                      </div>
                    )}
                  </div>

                  {/* Antecedentes */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Antecedentes Penales</label>
                    {selectedPlayer.Antecedentes_PDF?.trim() ? (
                      <a href={selectedPlayer.Antecedentes_PDF} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors">
                        <FileText className="w-5 h-5" /> Ver Documento (PDF)
                      </a>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-4 text-center cursor-pointer transition-colors group">
                        <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setSelectedFiles({...selectedFiles, antecedentes: e.target.files[0]});
                        }} />
                        <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${selectedFiles.antecedentes ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
                        <span className="text-xs text-slate-400 truncate block w-full px-2" title={selectedFiles.antecedentes?.name}>{selectedFiles.antecedentes ? selectedFiles.antecedentes.name : "Subir (PDF)"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Text */}
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    <strong>Sistema Automático:</strong> Al guardar los 3 documentos faltantes, el estado cambiará automáticamente de "PENDIENTE" a "POR FEDERAR".
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button onClick={() => {setSelectedPlayer(null); setSelectedFiles({});}} className="px-6 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Cerrar
              </button>
              <button 
                onClick={() => handleUpdatePlayerDocs()}
                disabled={isUploading || Object.keys(selectedFiles).length === 0} 
                className="btn-primary py-2 px-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Guardando en Drive...</>
                ) : (
                  <><Save className="w-4 h-4" /> Guardar Archivos ({Object.keys(selectedFiles).length})</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
          ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
          : "text-slate-400 hover:text-white hover:bg-slate-900"
        }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function JugadoresView({ players, onSelectPlayer }: { players: Player[], onSelectPlayer: (p: Player) => void }) {
  const [openSeries, setOpenSeries] = useState<string[]>([]);
  
  const toggleSerie = (serie: string) => {
    setOpenSeries(prev => prev.includes(serie) ? prev.filter(s => s !== serie) : [...prev, serie]);
  };

  const getCategoryInfo = (serie: string) => {
    const s = serie.toUpperCase();
    if (s.includes('INFANTIL') && !s.includes('FEMENINA')) return { icon: Baby, color: 'text-[#FF5722]', bg: 'bg-[#FF5722]/10' };
    if (s.includes('JUVENIL')) return { icon: Flame, color: 'text-[#4CAF50]', bg: 'bg-[#4CAF50]/10' };
    if (s.includes('ADULTA') && !s.includes('FEMENINA')) return { icon: User, color: 'text-[#2196F3]', bg: 'bg-[#2196F3]/10' };
    if (s.includes('SENIOR') || s.includes('DORADOS')) return { icon: Star, color: 'text-[#9C27B0]', bg: 'bg-[#9C27B0]/10' };
    if (s.includes('FEMENINA')) return { icon: UserRound, color: 'text-[#E91E63]', bg: 'bg-[#E91E63]/10' };
    return { icon: Users, color: 'text-slate-400', bg: 'bg-slate-800' };
  };

  // Agrupar jugadores por serie
  const grouped = players.reduce((acc, p) => {
    const s = p.Serie || 'Sin Serie Asignada';
    if (!acc[s]) acc[s] = [];
    acc[s].push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  // Ordenar las series alfabéticamente (puedes personalizar este orden luego)
  const sortedSeries = Object.keys(grouped).sort();

  return (
    <div className="space-y-4 pb-20">
      {sortedSeries.length === 0 && (
        <div className="p-20 text-center text-slate-500 glass-card">
          <p>No hay jugadores registrados para agrupar.</p>
        </div>
      )}
      
      {sortedSeries.map(serie => {
        const list = grouped[serie];
        const info = getCategoryInfo(serie);
        const isOpen = openSeries.includes(serie);
        
        return (
          <div key={serie} className="glass-card overflow-hidden">
            <button 
              onClick={() => toggleSerie(serie)}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${info.bg} ${info.color}`}>
                  <info.icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-slate-200">{serie}</h3>
                  <p className="text-xs text-slate-400">{list.length} jugador{list.length !== 1 && 'es'}</p>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
            </button>
            
            {isOpen && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {list.map((p, i) => (
                    <div onClick={() => onSelectPlayer(p)} key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col gap-3 hover:border-slate-700 cursor-pointer transition-colors group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-200 leading-tight">{p.Nombres || p.Nombre} {p.Apellido_Paterno || p.Apellidos}</p>
                          <p className="text-xs font-mono text-slate-500 mt-1">{p.RUT}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap inline-flex items-center gap-1 ${
                            p.Status_Validacion === 'Aprobado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            p.Status_Validacion === 'Pendiente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {p.Status_Validacion || 'Pendiente'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-y-2">
                        <div className="flex gap-4 text-xs text-slate-400">
                          {p.Posicion && <div><span className="text-slate-500">Pos:</span> {p.Posicion}</div>}
                          {p.Edad && <div><span className="text-slate-500">Edad:</span> {p.Edad}</div>}
                        </div>
                        <div className="flex gap-1.5">
                          <div title="Cédula Frontal" className={`w-6 h-6 rounded flex items-center justify-center border ${p.Foto_Cedula_Frontal ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-600'}`}>
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                          <div title="Cédula Reverso" className={`w-6 h-6 rounded flex items-center justify-center border ${p.Foto_Cedula_Reverso ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-600'}`}>
                            <div className="relative">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-current rounded-full border border-slate-900" />
                            </div>
                          </div>
                          <div title="Antecedentes" className={`w-6 h-6 rounded flex items-center justify-center border ${p.Antecedentes_PDF ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-600'}`}>
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          {(p.Foto_Cedula_Padre_Frontal || p.Foto_Cedula_Padre_Reverso) && (
                            <div title="Doc. Apoderado" className={`w-6 h-6 rounded flex items-center justify-center border ${p.Foto_Cedula_Padre_Frontal && p.Foto_Cedula_Padre_Reverso ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-600'}`}>
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ValidacionesView({ players, onSelectPlayer }: { players: Player[], onSelectPlayer: (p: Player) => void }) {
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterSerie, setFilterSerie] = useState("Todos");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const series = Array.from(new Set(players.map(p => p.Serie).filter(Boolean)));
  
  const filtered = players.filter(p => {
    const statusVal = (p.Status_Validacion || "Pendiente").toUpperCase();
    let statusMatch = filterStatus === "Todos";
    if (filterStatus === "PENDIENTE" && statusVal === "PENDIENTE") statusMatch = true;
    if (filterStatus === "POR FEDERAR" && statusVal === "POR FEDERAR") statusMatch = true;
    if (filterStatus === "FEDERADO" && (statusVal === "FEDERADO" || statusVal === "APROBADO")) statusMatch = true;
    
    const serieMatch = filterSerie === "Todos" || p.Serie === filterSerie;
    return statusMatch && serieMatch;
  });

  return (
     <div className="space-y-6">
       <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center glass-card p-4">
         <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
           <Filter className="w-5 h-5 text-brand-500 hidden md:block" />
           <select className="input-field py-2 text-sm w-full md:w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
             <option value="Todos">Todos los Estados</option>
             <option value="PENDIENTE">Solo Pendientes</option>
             <option value="POR FEDERAR">Solo Por Federar</option>
             <option value="FEDERADO">Solo Federados</option>
           </select>
           
           <select className="input-field py-2 text-sm w-full md:w-auto" value={filterSerie} onChange={e => setFilterSerie(e.target.value)}>
             <option value="Todos">Todas las Series</option>
             {series.map(s => <option key={s} value={s}>{s}</option>)}
           </select>
         </div>
         <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors w-full md:w-auto">
           <Download className="w-4 h-4" /> Exportar a Excel ({filtered.length})
         </button>
       </div>

       {/* Table */}
       <div className="glass-card overflow-hidden">
         <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="text-slate-500 text-sm border-b border-slate-800 bg-slate-900/20">
                <th className="px-6 py-4 font-medium">Jugador</th>
                <th className="px-6 py-4 font-medium">Serie</th>
                <th className="px-6 py-4 font-medium">Estado de Validación</th>
                <th className="px-6 py-4 font-medium">Fecha Reg.</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">No hay jugadores que coincidan con estos filtros.</td>
                </tr>
              )}
              {filtered.map((player, i) => (
                <tr key={i} onClick={() => onSelectPlayer(player)} className="hover:bg-slate-900/50 transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{player.Nombres || player.Nombre} {player.Apellido_Paterno || player.Apellidos}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{player.RUT}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50 whitespace-nowrap">{player.Serie}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap inline-flex items-center gap-1 ${
                        player.Status_Validacion?.toUpperCase() === 'FEDERADO' || player.Status_Validacion?.toUpperCase() === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        player.Status_Validacion?.toUpperCase() === 'POR FEDERAR' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                      {(player.Status_Validacion || 'PENDIENTE').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {player.Fecha_Registro ? new Date(player.Fecha_Registro).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
         </div>
       </div>

       {isExportModalOpen && <ExportModal players={filtered} onClose={() => setIsExportModalOpen(false)} />}
     </div>
  );
}

function ExportModal({ players, onClose }: { players: Player[], onClose: () => void }) {
   const allFields = ['RUT', 'Nombres', 'Apellido_Paterno', 'Apellido_Materno', 'Fecha_Nacimiento', 'Nacionalidad', 'Serie', 'WhatsApp', 'Direccion', 'Posicion', 'Status_Validacion', 'Fecha_Registro'];
   const [selectedFields, setSelectedFields] = useState<string[]>(allFields);
   
   const toggleField = (field: string) => {
     if (selectedFields.includes(field)) setSelectedFields(selectedFields.filter(f => f !== field));
     else setSelectedFields([...selectedFields, field]);
   };

   const handleExport = () => {
     if (selectedFields.length === 0) return alert("Selecciona al menos 1 campo.");
     
     // Evitar problemas de tildes añadiendo BOM de Excel
     const BOM = "\uFEFF";
     const header = selectedFields.join(";");
     const rows = players.map(p => selectedFields.map(f => {
       const val = p[f as keyof Player] || "";
       // Envolver en comillas y reemplazar comillas internas
       return `"${val.toString().replace(/"/g, '""')}"`;
     }).join(";"));
     
     const csvContent = BOM + header + "\n" + rows.join("\n");
     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
     const link = document.createElement("a");
     const url = URL.createObjectURL(blob);
     
     link.setAttribute("href", url);
     link.setAttribute("download", `ValleGrande_Validaciones_${new Date().toISOString().split('T')[0]}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     onClose();
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="glass-card w-full max-w-md shadow-2xl shadow-black overflow-hidden border border-slate-700">
          <div className="bg-slate-900/90 p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Download className="w-5 h-5 text-brand-500" /> Exportar Selección</h2>
            <p className="text-sm text-slate-400 mt-1">Elige las columnas que aparecerán en tu Excel.</p>
          </div>
          
          <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {allFields.map(field => (
               <label key={field} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800/50 transition-colors whitespace-nowrap">
                 <input type="checkbox" className="accent-brand-500" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} />
                 <span className="text-sm text-slate-300">{field.replace(/_/g, ' ')}</span>
               </label>
            ))}
          </div>

          <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-6 rounded-lg text-sm font-bold transition-colors">
              Descargar Archivo CSV
            </button>
          </div>
        </div>
      </div>
   );
}

function ImportModal({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const downloadTemplate = () => {
    const header = "RUT;Nombres;Apellido_Paterno;Apellido_Materno;Fecha_Nacimiento;Nacionalidad;Serie;WhatsApp;Direccion;Posicion;Observaciones";
    const blob = new Blob(["\uFEFF" + header], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Plantilla_ValleGrande.csv";
    link.click();
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    
    try {
      const text = await file.text();
      // Soporte para comas o punto y comas
      const separator = text.includes(";") ? ";" : ",";
      const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
      
      if (rows.length < 2) throw new Error("El archivo está vacío o no tiene datos.");
      
      const headers = rows[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim());
      const rutIndex = headers.findIndex(h => h.toUpperCase().includes("RUT"));
      
      if (rutIndex === -1) throw new Error("La columna RUT es obligatoria.");

      const playersToUpload = [];
      for (let i = 1; i < rows.length; i++) {
        // Expresión regular para hacer split considerando posibles comillas CSV
        const columns = rows[i].split(new RegExp(`\\s*${separator}\\s*(?=(?:[^"]*"[^"]*")*[^"]*$)`)).map(c => c.replace(/^"|"$/g, '').trim());
        if (!columns[rutIndex]) continue;
        
        let obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = columns[idx] || "";
        });
        playersToUpload.push(obj);
      }

      if (playersToUpload.length === 0) throw new Error("No se encontraron jugadores válidos.");

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "BULK_CREATE", players: playersToUpload })
      });

      const result = await res.json();
      if (result.success) {
        alert(`¡Se importaron ${playersToUpload.length} jugadores con éxito!`);
        onRefresh();
        onClose();
      } else {
        alert("Error de Apps Script: " + result.error);
      }
    } catch(err: any) {
       alert("Error procesando el archivo: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md shadow-2xl shadow-black overflow-hidden border border-slate-700">
        <div className="bg-slate-900/90 p-6 border-b border-slate-800 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><UploadCloud className="w-5 h-5 text-brand-500" /> Carga Masiva</h2>
            <p className="text-sm text-slate-400 mt-1">Sube cientos de jugadores de un golpe usando un CSV.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-300 mb-3"><strong>Paso 1:</strong> Descarga la plantilla oficial. Rellénala en Excel y asegúrate de guardarla como <strong>"CSV (delimitado por comas)"</strong>.</p>
            <button onClick={downloadTemplate} className="w-full bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
              <Download className="w-4 h-4" /> Descargar Plantilla CSV
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-300"><strong>Paso 2:</strong> Sube el archivo CSV rellenado.</p>
            <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-8 text-center cursor-pointer transition-colors group">
              <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
              }} />
              <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
              <span className="text-sm font-medium text-slate-300 block mb-1">{file ? file.name : "Haz clic para subir"}</span>
              <span className="text-xs text-slate-500">Solo archivos .csv</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleImport} disabled={!file || isUploading} className="btn-primary py-2 px-6 text-sm disabled:opacity-50 flex items-center gap-2">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Procesando..." : "Importar Jugadores"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Boton de Navegación Inferior agregado directamente en Dashboard
// y cerrado de div principal.
