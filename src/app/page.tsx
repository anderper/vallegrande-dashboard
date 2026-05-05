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
  Upload
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
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
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
      // Indicamos que es un registro nuevo
      const payload = { ...formData, action: "CREATE" };
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        // Limpiar formulario
        setFormData({
          RUT: "", Nombres: "", Apellido_Paterno: "", Apellido_Materno: "",
          Fecha_Nacimiento: "", Nacionalidad: "Chilena", Serie: "",
          WhatsApp: "", Direccion: "", Posicion: "", Observaciones: ""
        });
        // Refrescar la tabla para ver el nuevo jugador
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
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    });
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
    });
  };

  const handleUpdatePlayerDocs = async (newStatus?: string) => {
    if (!selectedPlayer) return;
    setIsUploading(true);

    try {
      const payload: any = { 
        action: "UPDATE_DOCS", 
        RUT: selectedPlayer.RUT 
      };

      if (selectedFiles.frontal) {
        payload.fileFrontal = { base64: await compressImage(selectedFiles.frontal), mimeType: 'image/jpeg' };
      }
      if (selectedFiles.reverso) {
        payload.fileReverso = { base64: await compressImage(selectedFiles.reverso), mimeType: 'image/jpeg' };
      }
      if (selectedFiles.antecedentes) {
        payload.fileAntecedentes = { base64: await getBase64(selectedFiles.antecedentes), mimeType: 'application/pdf' };
      }

      // Evaluar Auto-Status
      const hasFrontal = payload.fileFrontal || selectedPlayer.Foto_Cedula_Frontal;
      const hasReverso = payload.fileReverso || selectedPlayer.Foto_Cedula_Reverso;
      const hasAntecedentes = payload.fileAntecedentes || selectedPlayer.Antecedentes_PDF;
      
      let finalStatus = newStatus || selectedPlayer.Status_Validacion;
      
      // Auto-cambio si se subieron los 3 y está en Pendiente
      if (!newStatus && (selectedPlayer.Status_Validacion === 'Pendiente' || !selectedPlayer.Status_Validacion)) {
        if (hasFrontal && hasReverso && hasAntecedentes) {
          finalStatus = "POR FEDERAR";
        }
      }

      if (finalStatus !== selectedPlayer.Status_Validacion) {
        payload.newStatus = finalStatus;
      }

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        alert("¡Datos actualizados con éxito!");
        setSelectedFiles({});
        setSelectedPlayer(null);
        fetchData();
      } else {
        alert("Error de Apps Script: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error al enviar los archivos.");
    } finally {
      setIsUploading(false);
    }
  };

  const stats = [
    { label: "Total Jugadores", value: players.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pendientes", value: players.filter(p => !p.Status_Validacion || p.Status_Validacion.toUpperCase() === 'PENDIENTE').length, icon: Clock, iconColor: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Por Federar", value: players.filter(p => p.Status_Validacion?.toUpperCase() === 'POR FEDERAR').length, icon: AlertCircle, iconColor: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Federados", value: players.filter(p => p.Status_Validacion?.toUpperCase() === 'FEDERADO' || p.Status_Validacion?.toUpperCase() === 'APROBADO').length, icon: CheckCircle2, iconColor: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  // Datos para gráfica de Series
  const seriesCount = players.reduce((acc, p) => {
    const s = p.Serie || "Sin Serie";
    if (!acc[s]) acc[s] = { total: 0, federados: 0 };
    acc[s].total += 1;
    if (p.Status_Validacion?.toUpperCase() === 'FEDERADO' || p.Status_Validacion?.toUpperCase() === 'APROBADO') {
      acc[s].federados += 1;
    }
    return acc;
  }, {} as Record<string, { total: number, federados: number }>);
  
  const seriesChartData = Object.entries(seriesCount)
    .sort((a, b) => b[1].total - a[1].total) // Ordenar de mayor a menor
    .map(([name, data]) => ({
      name,
      count: data.total,
      federados: data.federados,
      percentage: Math.round((data.total / (players.length || 1)) * 100)
    }));


  const filteredPlayers = players.filter(p => {
    const nombre = p.Nombres || p.Nombre || "";
    const apellido = p.Apellido_Paterno || p.Apellidos || "";
    const rut = p.RUT || "";
    
    // Función para quitar tildes y hacer minúsculas
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // Limpiamos RUTs de puntos y guiones para la búsqueda
    const cleanRut = (r: string) => r.replace(/[\.\-]/g, '').toLowerCase();
    
    const fullName = normalize(nombre + " " + apellido);
    const searchTerm = normalize(search);
    const isRutMatch = cleanRut(rut).includes(cleanRut(search));

    return nombre && (fullName.includes(searchTerm) || isRutMatch);
  });

  return (
    <div className="flex min-h-screen relative pb-20 md:pb-0">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 p-6 hidden md:block z-10 bg-slate-950">
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/logo.png"
            alt="Logo Valle Grande FC"
            className="w-12 h-12 object-contain drop-shadow-md"
            onError={(e) => {
              // Fallback visual si la imagen aún no se sube
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.querySelector('.fallback-logo')?.classList.remove('hidden');
            }}
          />
          <div className="fallback-logo hidden w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-brand-500/20">
            VG
          </div>
          <span className="font-bold text-lg tracking-tight">Valle Grande FC</span>
        </div>

        <nav className="space-y-1">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={Users} label="Jugadores" active={currentView === 'jugadores'} onClick={() => setCurrentView('jugadores')} />
          <NavItem icon={Clock} label="Validaciones" active={currentView === 'validaciones'} onClick={() => setCurrentView('validaciones')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
          <div className="flex justify-between items-start w-full md:w-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {currentView === 'dashboard' ? 'Panel de Control' : currentView === 'jugadores' ? 'Directorio de Jugadores' : 'Gestión de Validaciones'}
              </h1>
              <button
                onClick={fetchData}
                className="p-2 hover:bg-slate-900 rounded-lg transition-colors text-slate-400 shrink-0"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
              </button>
            </div>
          </div>
          
          <p className="text-slate-400 mt-1 hidden md:block">Gestión documental en tiempo real.</p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {currentView === 'dashboard' && (
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por RUT o Nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10 pr-4 py-2 w-full md:w-64 text-sm md:text-base"
                />
              </div>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setIsImportModalOpen(true)} className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Importar
              </button>
              <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none btn-primary py-2 text-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Nuevo
              </button>
            </div>
          </div>
        </header>

        {currentView === 'dashboard' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {stats.map((stat, i) => (
                <div key={i} className="glass-card p-6 flex items-center gap-4">
                  <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor || "text-slate-50"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <p className="text-2xl font-bold">{loading ? "..." : stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Recent Players Table */}
              <div className="lg:col-span-2 glass-card overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Directorio Rápido</h2>
                  <span className="text-brand-500 text-sm font-medium">{filteredPlayers.length} mostrados</span>
                </div>
                <div className="overflow-x-auto">
                  {loading && players.length === 0 ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                      <p>Conectando con Google Sheets...</p>
                    </div>
                  ) : players.length === 0 ? (
                    <div className="p-20 text-center text-slate-500">
                      <p>No hay jugadores registrados en el Excel.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 text-sm border-b border-slate-800 bg-slate-900/20">
                          <th className="px-6 py-4 font-medium">Jugador</th>
                          <th className="px-6 py-4 font-medium">Serie</th>
                          <th className="px-6 py-4 font-medium">Estado</th>
                          <th className="px-6 py-4 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredPlayers.map((player, i) => (
                          <tr key={i} onClick={() => setSelectedPlayer(player)} className="hover:bg-slate-900/50 transition-colors cursor-pointer group">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-200">{player.Nombres || player.Nombre} {player.Apellido_Paterno || player.Apellidos}</div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">{player.RUT}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-300 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                                {player.Serie}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                  player.Status_Validacion?.toUpperCase() === 'FEDERADO' || player.Status_Validacion?.toUpperCase() === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  player.Status_Validacion?.toUpperCase() === 'POR FEDERAR' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                {(player.Status_Validacion || 'PENDIENTE').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 transition-colors ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Métricas por Serie (Gráfica) */}
              <div className="glass-card p-6 h-fit flex flex-col max-h-[500px]">
                <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-500" />
                  Distribución por Serie
                </h2>
                
                {seriesChartData.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">No hay datos disponibles.</p>
                ) : (
                  <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                    {seriesChartData.map((serie, i) => (
                      <div key={i} className="group">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-slate-300 group-hover:text-brand-400 transition-colors">{serie.name}</span>
                          <span className="text-slate-400 font-mono text-xs">{serie.count} Jug. <span className="text-emerald-400">({serie.federados} Fed.)</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full relative overflow-hidden" 
                            style={{ width: `${serie.percentage}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -translate-x-full"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : currentView === 'jugadores' ? (
          <JugadoresView players={players} onSelectPlayer={setSelectedPlayer} />
        ) : (
          <ValidacionesView players={players} onSelectPlayer={setSelectedPlayer} />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-around items-center p-3 z-40 px-6">
        <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-brand-500' : 'text-slate-500'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Panel</span>
        </button>
        <button onClick={() => setCurrentView('jugadores')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'jugadores' ? 'text-brand-500' : 'text-slate-500'}`}>
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Jugadores</span>
        </button>
        <button onClick={() => setCurrentView('validaciones')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'validaciones' ? 'text-brand-500' : 'text-slate-500'}`}>
          <Clock className="w-5 h-5" />
          <span className="text-[10px] font-medium">Validar</span>
        </button>
      </nav>

      {/* Modal Importar */}
      {isImportModalOpen && <ImportModal onClose={() => setIsImportModalOpen(false)} onRefresh={fetchData} />}

      {/* Modal de Registro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md p-6 border-b border-slate-800 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-white">Registrar Nuevo Jugador</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Datos Personales */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-brand-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Datos Personales</h3>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">RUT *</label>
                    <input required name="RUT" value={formData.RUT} onChange={handleInputChange} type="text" placeholder="12.345.678-9" className="input-field w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nombres *</label>
                    <input required name="Nombres" value={formData.Nombres} onChange={handleInputChange} type="text" className="input-field w-full text-sm" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Ap. Paterno *</label>
                      <input required name="Apellido_Paterno" value={formData.Apellido_Paterno} onChange={handleInputChange} type="text" className="input-field w-full text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Ap. Materno</label>
                      <input name="Apellido_Materno" value={formData.Apellido_Materno} onChange={handleInputChange} type="text" className="input-field w-full text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nacimiento *</label>
                      <input required name="Fecha_Nacimiento" value={formData.Fecha_Nacimiento} onChange={handleInputChange} type="date" className="input-field w-full text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nacionalidad</label>
                      <select name="Nacionalidad" value={formData.Nacionalidad} onChange={handleInputChange} className="input-field w-full text-sm appearance-none">
                        <option value="Chile">Chile</option>
                        <option value="Argentina">Argentina</option>
                        <option value="Bolivia">Bolivia</option>
                        <option value="Brasil">Brasil</option>
                        <option value="Colombia">Colombia</option>
                        <option value="Ecuador">Ecuador</option>
                        <option value="Paraguay">Paraguay</option>
                        <option value="Perú">Perú</option>
                        <option value="Uruguay">Uruguay</option>
                        <option value="Venezuela">Venezuela</option>
                        <option disabled>──────────</option>
                        <option value="México">México</option>
                        <option value="Estados Unidos">Estados Unidos</option>
                        <option value="Canadá">Canadá</option>
                        <option value="Costa Rica">Costa Rica</option>
                        <option value="Cuba">Cuba</option>
                        <option value="El Salvador">El Salvador</option>
                        <option value="Guatemala">Guatemala</option>
                        <option value="Honduras">Honduras</option>
                        <option value="Nicaragua">Nicaragua</option>
                        <option value="Panamá">Panamá</option>
                        <option value="Puerto Rico">Puerto Rico</option>
                        <option value="República Dominicana">República Dominicana</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Club & Contacto */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-brand-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Club & Contacto</h3>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Serie *</label>
                    <select required name="Serie" value={formData.Serie} onChange={handleInputChange} className="input-field w-full text-sm appearance-none">
                      <option value="">Selecciona una serie...</option>
                      <option value="1ERA INFANTIL">1ERA INFANTIL</option>
                      <option value="2DA INFANTIL">2DA INFANTIL</option>
                      <option value="3RA INFANTIL">3RA INFANTIL</option>
                      <option value="4TA INFANTIL">4TA INFANTIL</option>
                      <option value="JUVENIL">JUVENIL</option>
                      <option value="3RA ADULTA">3RA ADULTA</option>
                      <option value="2DA ADULTA">2DA ADULTA</option>
                      <option value="1ERA ADULTA">1ERA ADULTA</option>
                      <option value="SENIOR">SENIOR</option>
                      <option value="SUPER SENIOR">SUPER SENIOR</option>
                      <option value="DORADOS">DORADOS</option>
                      <option value="FEMENINA INFANTIL">FEMENINA INFANTIL</option>
                      <option value="FEMENINA ADULTA">FEMENINA ADULTA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Posición</label>
                    <select name="Posicion" value={formData.Posicion} onChange={handleInputChange} className="input-field w-full text-sm appearance-none">
                      <option value="">Selecciona posición...</option>
                      <option value="Portero">Portero</option>
                      <option value="Defensa">Defensa</option>
                      <option value="Mediocampista">Mediocampista</option>
                      <option value="Delantero">Delantero</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">WhatsApp</label>
                    <input name="WhatsApp" value={formData.WhatsApp} onChange={handleInputChange} type="text" placeholder="+56912345678" className="input-field w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Dirección</label>
                    <input name="Direccion" value={formData.Direccion} onChange={handleInputChange} type="text" className="input-field w-full text-sm" />
                  </div>
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
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border ${
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
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            p.Status_Validacion === 'Aprobado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            p.Status_Validacion === 'Pendiente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {p.Status_Validacion || 'Pendiente'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-slate-800/50 flex gap-4 text-xs text-slate-400">
                        {p.Posicion && <div><span className="text-slate-500">Pos:</span> {p.Posicion}</div>}
                        {p.Edad && <div><span className="text-slate-500">Edad:</span> {p.Edad}</div>}
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
                    <span className="text-sm text-slate-300 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">{player.Serie}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${
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
               <label key={field} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800/50 transition-colors">
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
