import React, { useState } from 'react';
import { EstadoCRM } from '../types';
import { crmRepo } from '../repo';
import { obtenerNivelYProgreso } from '../utils/crmHelpers';
import {
  Download,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  CheckCircle2,
  ChevronDown,
  Info,
  Calendar,
  Bell,
  BellRing,
  BellOff,
} from 'lucide-react';
import {
  obtenerEstadoPermiso,
  solicitarPermisoNotificaciones,
  emitirNotificacionPrueba,
} from '../utils/browserNotifications';

interface HeaderProps {
  estado: EstadoCRM;
  onAbrirNuevoLead: () => void;
  onAbrirImportar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  estado,
  onAbrirNuevoLead,
  onAbrirImportar,
}) => {
  const [mostrarMisionesDetalle, setMostrarMisionesDetalle] = useState(false);
  const [mostrarNotifPanel, setMostrarNotifPanel] = useState(false);
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | 'unsupported'>(
    obtenerEstadoPermiso()
  );

  const notificacionesActivas = estado.config.notificacionesNavegador !== false;

  const handleToggleNotif = async () => {
    if (permisoNotif === 'default') {
      const nuevo = await solicitarPermisoNotificaciones();
      setPermisoNotif(nuevo);
      if (nuevo === 'granted') {
        crmRepo.actualizarPreferenciaNotificaciones(true);
        emitirNotificacionPrueba();
      }
    } else if (permisoNotif === 'granted') {
      crmRepo.actualizarPreferenciaNotificaciones(!notificacionesActivas);
    }
  };

  const handleProbarAviso = () => {
    emitirNotificacionPrueba();
  };

  const nivelInfo = obtenerNivelYProgreso(estado.juego.xp);

  // Misiones de hoy
  const { misionesHoy } = estado.juego;
  const misiones = [
    {
      id: 'mision_etapas' as const,
      titulo: 'Avanza 2 etapas',
      detalle: 'Mueve oportunidades a una etapa superior',
      actual: misionesHoy.etapasAvanzadas,
      objetivo: 2,
      completada: misionesHoy.etapasAvanzadas >= 2,
      reclamada: !!misionesHoy.reclamadas['mision_etapas'],
      xp: 10,
    },
    {
      id: 'mision_actividades' as const,
      titulo: 'Registra 2 actividades',
      detalle: 'Llamadas, demos, reuniones o emails',
      actual: misionesHoy.actividadesRegistradas,
      objetivo: 2,
      completada: misionesHoy.actividadesRegistradas >= 2,
      reclamada: !!misionesHoy.reclamadas['mision_actividades'],
      xp: 10,
    },
    {
      id: 'mision_empatia' as const,
      titulo: '1 cuadrante empatía',
      detalle: 'Rellena un cuadrante de empatía en una ficha',
      actual: misionesHoy.cuadrantesCompletados,
      objetivo: 1,
      completada: misionesHoy.cuadrantesCompletados >= 1,
      reclamada: !!misionesHoy.reclamadas['mision_empatia'],
      xp: 10,
    },
  ];

  const misionesCompletadasCount = misiones.filter((m) => m.completada).length;

  const handleExportar = () => {
    const jsonStr = crmRepo.exportarCopiaJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eonesia_crm_copia_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBorrarEjemplos = () => {
    if (window.confirm('¿Seguro que deseas eliminar los datos de ejemplo? El CRM quedará limpio para tus propios centros.')) {
      crmRepo.borrarDatosEjemplo();
    }
  };

  const handleRestaurarEjemplos = () => {
    if (window.confirm('¿Restaurar los 8 centros y oportunidades de ejemplo?')) {
      crmRepo.restaurarDatosEjemplo();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#000000]/90 backdrop-blur-md border-b border-[rgba(0,200,255,0.18)] px-4 md:px-6 py-2.5 transition-all">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Lado Izquierdo: Nivel + Barra de XP */}
        <div className="flex items-center gap-3">
          {/* Insignia hexagonal con número de nivel */}
          <div
            className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            title={`Nivel ${nivelInfo.nivelNumero}: ${nivelInfo.nombre}`}
          >
            <div
              className="absolute inset-0 clip-hexagon"
              style={{
                background: 'linear-gradient(135deg, #00C8FF 0%, #E96999 52%, #4802B1 100%)',
                padding: '2px',
              }}
            >
              <div className="w-full h-full bg-[#0D0D14] clip-hexagon flex items-center justify-center">
                <span className="font-heading font-bold text-base text-[#F2F2F7]">
                  {nivelInfo.nivelNumero}
                </span>
              </div>
            </div>
            {/* Pequeño pulso resplandeciente */}
            <div className="absolute -inset-1 rounded-full bg-[rgba(233,105,153,0.2)] blur-sm -z-10" />
          </div>

          {/* Información del nivel y barra */}
          <div className="flex flex-col justify-center min-w-[160px] sm:min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00C8FF] font-heading">
                Nivel {nivelInfo.nivelNumero} · {nivelInfo.nombre}
              </span>
              <span className="text-[11px] font-mono text-[#B4B4C8]">
                {estado.juego.xp}
                {nivelInfo.nivelNumero < 6 ? ` / ${nivelInfo.nextXP}` : ''} XP
              </span>
            </div>

            {/* Barra de XP con degradado */}
            <div className="w-full h-2 bg-[#0D0D14] rounded-full overflow-hidden border border-[rgba(0,200,255,0.2)] mt-1">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${nivelInfo.porcentaje}%`,
                  background: 'linear-gradient(90deg, #00C8FF 0%, #E96999 60%, #4802B1 100%)',
                }}
              />
            </div>
          </div>

          {/* Bloque: Misiones de hoy (compacto) */}
          <div className="relative ml-1 sm:ml-3">
            <button
              onClick={() => setMostrarMisionesDetalle(!mostrarMisionesDetalle)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0D0D14] border border-[rgba(0,200,255,0.25)] hover:border-[rgba(0,200,255,0.5)] transition-colors text-left"
            >
              <div className="w-2 h-2 rounded-full bg-[#E96999] animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#B4B4C8] leading-tight">
                  Misiones de hoy
                </span>
                <span className="text-xs font-semibold text-[#F2F2F7] leading-tight">
                  {misionesCompletadasCount}/3 listas
                </span>
              </div>
              <ChevronDown size={14} className={`text-[#B4B4C8] transition-transform ${mostrarMisionesDetalle ? 'rotate-180' : ''}`} />
            </button>

            {/* Desplegable de Misiones de hoy */}
            {mostrarMisionesDetalle && (
              <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] rounded-xl p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)] mb-2.5">
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#00C8FF]">
                    Misiones diarias (+10 XP c/u)
                  </span>
                  <span className="text-[11px] text-[#B4B4C8]">Se reinician a las 00:00</span>
                </div>

                <div className="space-y-2">
                  {misiones.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-[#F2F2F7] truncate">{m.titulo}</span>
                          <span className="text-[10px] text-[#00C8FF] font-mono">
                            ({m.actual}/{m.objetivo})
                          </span>
                        </div>
                        <p className="text-[10px] text-[#B4B4C8] leading-tight truncate">{m.detalle}</p>
                      </div>

                      {m.reclamada ? (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#00C8FF]">
                          <CheckCircle2 size={14} /> Reclamado
                        </div>
                      ) : m.completada ? (
                        <button
                          onClick={() => crmRepo.reclamarMisionDiaria(m.id)}
                          className="px-2 py-1 text-xs font-bold rounded bg-[#E96999] text-[#0D0D14] hover:brightness-110 shadow"
                        >
                          +{m.xp} XP
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#6B6B80] font-mono">Pendiente</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Acciones rápidas, Etiqueta Ejemplo, Backup y Nuevo Lead */}
        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Etiqueta visible DATOS DE EJEMPLO */}
          {estado.esDatosEjemplo ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(233,105,153,0.12)] border border-[rgba(233,105,153,0.4)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E96999]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E96999]">
                DATOS DE EJEMPLO
              </span>
              <button
                onClick={handleBorrarEjemplos}
                title="Borrar datos de ejemplo y empezar limpio"
                className="ml-1 text-[#B4B4C8] hover:text-[#ffb4ab] transition-colors p-0.5 rounded"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : estado.centros.length === 0 ? (
            <button
              onClick={handleRestaurarEjemplos}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#00C8FF] border border-[rgba(0,200,255,0.3)] rounded hover:bg-[rgba(0,200,255,0.1)] transition-colors"
            >
              <RotateCcw size={12} /> Cargar ejemplos
            </button>
          ) : null}

          {/* Botón y Panel de Notificaciones del Navegador */}
          <div className="relative">
            <button
              onClick={() => setMostrarNotifPanel(!mostrarNotifPanel)}
              title="Avisos de navegador para próximos pasos en segundo plano"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${
                permisoNotif === 'granted' && notificacionesActivas
                  ? 'bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border-[rgba(0,200,255,0.4)]'
                  : permisoNotif === 'granted' && !notificacionesActivas
                  ? 'bg-[#0D0D14] text-[#B4B4C8] border-[rgba(255,255,255,0.08)]'
                  : 'bg-[rgba(233,105,153,0.12)] text-[#E96999] border-[rgba(233,105,153,0.3)]'
              }`}
            >
              {permisoNotif === 'granted' && notificacionesActivas ? (
                <BellRing size={13} className="text-[#00C8FF]" />
              ) : permisoNotif === 'granted' && !notificacionesActivas ? (
                <BellOff size={13} />
              ) : (
                <Bell size={13} className="animate-pulse" />
              )}
              <span className="hidden sm:inline">Avisos</span>
            </button>

            {mostrarNotifPanel && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#0D0D14] border border-[rgba(0,200,255,0.4)] rounded-xl p-3.5 shadow-2xl z-50 text-xs space-y-2.5 anim-slide-down">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-[#F2F2F7] flex items-center gap-1.5">
                    <Bell size={14} className="text-[#00C8FF]" /> Avisos de escritorio
                  </span>
                  <button
                    onClick={() => setMostrarNotifPanel(false)}
                    className="text-[#B4B4C8] hover:text-[#F2F2F7] p-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-[11px] text-[#B4B4C8] leading-snug">
                  Te avisamos cuando un próximo paso venza o sea para hoy, incluso si tienes la pestaña minimizada o estás en otra aplicación.
                </p>

                {permisoNotif === 'default' ? (
                  <button
                    onClick={handleToggleNotif}
                    className="w-full py-2 px-3 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs transition-colors cursor-pointer text-center shadow"
                  >
                    Activar notificaciones en navegador
                  </button>
                ) : permisoNotif === 'granted' ? (
                  <div className="space-y-2 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#F2F2F7] font-medium">Estado de avisos:</span>
                      <button
                        onClick={handleToggleNotif}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          notificacionesActivas
                            ? 'bg-[rgba(0,200,255,0.2)] text-[#00C8FF]'
                            : 'bg-[#161622] text-[#B4B4C8]'
                        }`}
                      >
                        {notificacionesActivas ? 'Activados' : 'Pausados'}
                      </button>
                    </div>

                    <button
                      onClick={handleProbarAviso}
                      className="w-full py-1.5 px-2.5 rounded bg-[#161622] hover:bg-[#1f1f2e] text-[#F2F2F7] text-[11px] font-semibold border border-[rgba(255,255,255,0.1)] transition-colors text-center cursor-pointer"
                    >
                      Enviar aviso de prueba
                    </button>
                  </div>
                ) : (
                  <div className="p-2 rounded bg-[#161622] text-[10px] text-[#ffb4ab]">
                    ⚠️ Las notificaciones están bloqueadas en tu navegador. Puedes desbloquearlas desde los permisos del navegador.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Exportar copia */}
          <button
            onClick={handleExportar}
            title="Exportar copia completa de seguridad en JSON"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#B4B4C8] hover:text-[#00C8FF] bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] hover:border-[rgba(0,200,255,0.5)] rounded-lg transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Importar copia */}
          <button
            onClick={onAbrirImportar}
            title="Importar archivo JSON de respaldo"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#B4B4C8] hover:text-[#00C8FF] bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] hover:border-[rgba(0,200,255,0.5)] rounded-lg transition-colors"
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Importar</span>
          </button>

          {/* Botón Nuevo Lead */}
          <button
            onClick={onAbrirNuevoLead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow-md transition-all transform active:scale-95"
            style={{ boxShadow: '0 0 16px rgba(233, 105, 153, 0.4)' }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Nuevo lead</span>
            <span className="text-[10px] font-mono bg-[#0D0D14]/20 px-1 rounded text-[#0D0D14]">
              +5 XP
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
