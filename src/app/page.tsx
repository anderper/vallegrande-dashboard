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
  Save
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

  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  const stats = [
    { label: "Total Jugadores", value: players.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pendientes", value: players.filter(p => p.Status_Validacion === 'Pendiente').length, icon: Clock, iconColor: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Aprobados", value: players.filter(p => p.Status_Validacion === 'Aprobado').length, icon: CheckCircle2, iconColor: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Rechazados", value: players.filter(p => p.Status_Validacion === 'Rechazado').length, icon: AlertCircle, iconColor: "text-rose-500", bg: "bg-rose-500/10" },
  ];

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
    <div className="flex min-h-screen relative">
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
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Users} label="Jugadores" />
          <NavItem icon={Clock} label="Validaciones" />
          <NavItem icon={TrendingUp} label="Reportes" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
              <button
                onClick={fetchData}
                className="p-2 hover:bg-slate-900 rounded-lg transition-colors text-slate-400"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-500' : ''}`} />
              </button>
            </div>
            <p className="text-slate-400 mt-1">Gestión documental en tiempo real.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por RUT o Nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10 pr-4 py-2 w-64 text-sm"
              />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary py-2 text-sm">
              <Plus className="w-4 h-4" />
              Nuevo Jugador
            </button>
          </div>
        </header>

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
              <h2 className="font-semibold text-lg">Directorio de Jugadores</h2>
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
                      <tr key={i} className="hover:bg-slate-900/50 transition-colors cursor-pointer group">
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${player.Status_Validacion === 'Aprobado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              player.Status_Validacion === 'Pendiente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                            {player.Status_Validacion || 'Pendiente'}
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

          {/* Activity Feed */}
          <div className="glass-card p-6 h-fit">
            <h2 className="font-semibold text-lg mb-6">Información</h2>
            <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-xl mb-6">
              <p className="text-xs text-brand-400 font-bold uppercase tracking-wider mb-1">Estado de Sincronización</p>
              <p className="text-sm text-slate-300">Conectado a Google Sheets exitosamente.</p>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-400 leading-relaxed">
                Usa el botón <strong>Nuevo Jugador</strong> para agregar registros.
              </p>
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Última actualización local:</p>
                <p className="text-sm font-mono text-slate-300">{new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
          ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
          : "text-slate-400 hover:text-white hover:bg-slate-900"
        }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </a>
  );
}
