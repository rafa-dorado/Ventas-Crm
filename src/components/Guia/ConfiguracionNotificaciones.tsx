import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  HelpCircle,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { crmRepo } from '../../repo';
import {
  emitirNotificacionPrueba,
  obtenerEstadoPermiso,
  solicitarPermisoNotificaciones,
  soportaNotificaciones,
} from '../../utils/browserNotifications';

export interface ConfiguracionNotificacionesProps {
  onPermisoChange?: (permiso: NotificationPermission | 'unsupported') => void;
  className?: string;
}

/**
 * Componente de configuración que verifica reactivamente Notification.permission
 * y muestra claramente el estado actual al usuario, proporcionando un botón para
 * solicitar permisos si el estado es 'default' o 'denied'.
 */
export const ConfiguracionNotificaciones: React.FC<ConfiguracionNotificacionesProps> = ({
  onPermisoChange,
  className = '',
}) => {
  // 1. Estado reactivo del permiso obtenido directamente de Notification.permission
  const [permiso, setPermiso] = useState<NotificationPermission | 'unsupported'>(() =>
    obtenerEstadoPermiso()
  );

  // 2. Estado de preferencia del CRM
  const [notifHabilitadas, setNotifHabilitadas] = useState<boolean>(
    () => crmRepo.obtenerEstado().config.notificacionesNavegador !== false
  );

  const [solicitando, setSolicitando] = useState<boolean>(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);
  const [pruebaEnviada, setPruebaEnviada] = useState<boolean>(false);
  const [mostrarGuiaDesbloqueo, setMostrarGuiaDesbloqueo] = useState<boolean>(false);

  // Verificación y sincronización en tiempo real de Notification.permission
  const verificarPermiso = () => {
    const estadoActual = obtenerEstadoPermiso();
    setPermiso((prev) => {
      if (prev !== estadoActual) {
        onPermisoChange?.(estadoActual);
      }
      return estadoActual;
    });
    return estadoActual;
  };

  useEffect(() => {
    verificarPermiso();

    // Sincronizar con el repositorio del CRM
    const unsubCRM = crmRepo.suscribir((estado) => {
      setNotifHabilitadas(estado.config.notificacionesNavegador !== false);
    });

    // Detectar cuando el usuario vuelve a la ventana tras modificar permisos en el navegador
    const alVolverFoco = () => {
      verificarPermiso();
    };
    window.addEventListener('focus', alVolverFoco);

    // Escuchar cambios mediante la API de Permissions si está disponible
    let permStatus: PermissionStatus | null = null;
    if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      navigator.permissions?.query
    ) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.onchange = () => {
            verificarPermiso();
          };
        })
        .catch(() => {});
    }

    // Polling ligero para garantizar sincronización en tiempo real con el DOM
    const interval = setInterval(() => {
      verificarPermiso();
    }, 1000);

    return () => {
      unsubCRM();
      window.removeEventListener('focus', alVolverFoco);
      clearInterval(interval);
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  // Solicitar permisos de notificación (para estado 'default' o 'denied')
  const handleSolicitarPermiso = async () => {
    setSolicitando(true);
    setMensajeFeedback(null);

    try {
      if (!soportaNotificaciones()) {
        setPermiso('unsupported');
        return;
      }

      // Si el estado ya es 'denied', los navegadores bloquean el diálogo nativo directo.
      // Intentamos solicitarlo y si continúa en denied, mostramos guía visual de desbloqueo.
      const res = await solicitarPermisoNotificaciones();
      const nuevoPermiso = verificarPermiso();

      if (nuevoPermiso === 'granted') {
        crmRepo.actualizarPreferenciaNotificaciones(true);
        setNotifHabilitadas(true);
        setMostrarGuiaDesbloqueo(false);
        emitirNotificacionPrueba();
        setMensajeFeedback('¡Permiso concedido con éxito! Se ha emitido una alerta de prueba.');
        setTimeout(() => setMensajeFeedback(null), 4500);
      } else if (nuevoPermiso === 'denied') {
        setMostrarGuiaDesbloqueo(true);
        setMensajeFeedback(
          'El navegador bloqueó la solicitud automática. Para autorizarlo, desbloquea el sitio en los ajustes del navegador (icono del candado 🔒).'
        );
      } else {
        setMensajeFeedback('Solicitud de permiso completada. Estado actual: ' + nuevoPermiso);
        setTimeout(() => setMensajeFeedback(null), 4000);
      }
    } catch (err: any) {
      console.warn('Error al solicitar permiso:', err);
      setMensajeFeedback('Error al solicitar permisos: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSolicitando(false);
    }
  };

  const handleToggleCRM = (activo: boolean) => {
    crmRepo.actualizarPreferenciaNotificaciones(activo);
    setNotifHabilitadas(activo);
  };

  const handleEnviarPrueba = () => {
    const ok = emitirNotificacionPrueba();
    if (ok) {
      setPruebaEnviada(true);
      setTimeout(() => setPruebaEnviada(false), 3500);
    }
  };

  return (
    <div className={`p-4 sm:p-5 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.08)] space-y-4 ${className}`}>
      {/* Cabecera del componente de configuración */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BellRing size={18} className="text-[#00C8FF]" />
            <h4 className="font-heading font-bold text-sm text-[#F2F2F7]">
              Configuración de Permisos de Notificación
            </h4>
          </div>
          <p className="text-xs text-[#B4B4C8]">
            Verificación reactiva de <code className="text-[#00C8FF] font-mono text-[11px] bg-[#131320] px-1.5 py-0.5 rounded">Notification.permission</code> en el navegador.
          </p>
        </div>

        {/* Toggle de preferencia en el CRM */}
        <div className="flex items-center gap-2.5 self-start sm:self-center bg-[#0D0D14] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)]">
          <span className="text-xs text-[#B4B4C8]">
            Avisos CRM: <strong className={notifHabilitadas ? 'text-[#00C8FF]' : 'text-[#B4B4C8]'}>{notifHabilitadas ? 'Activos' : 'Pausados'}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleToggleCRM(!notifHabilitadas)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              notifHabilitadas ? 'bg-[#00C8FF]' : 'bg-zinc-700'
            }`}
            role="switch"
            aria-checked={notifHabilitadas}
            title={notifHabilitadas ? 'Desactivar notificaciones del CRM' : 'Activar notificaciones del CRM'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#000000] shadow-lg ring-0 transition duration-200 ease-in-out ${
                notifHabilitadas ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Visualización clara del estado actual al usuario */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-[#B4B4C8]">
          <span className="font-semibold text-[#F2F2F7]">Estado actual de Notification.permission:</span>
          <span className="font-mono text-xs flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                permiso === 'granted'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : permiso === 'denied'
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <strong
              className={
                permiso === 'granted'
                  ? 'text-emerald-400'
                  : permiso === 'denied'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }
            >
              '{permiso}'
            </strong>
          </span>
        </div>

        {/* 3 Bloques visuales de estado (Concedido, Por solicitar, Denegado) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-lg bg-[#000000]/70 border border-[rgba(255,255,255,0.06)]">
          {/* 1. Concedido (granted) */}
          <div
            className={`p-3 rounded-lg border text-center transition-all ${
              permiso === 'granted'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'border-transparent text-[#B4B4C8]/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs">
              <CheckCircle2 size={15} className={permiso === 'granted' ? 'text-emerald-400' : ''} />
              <span>Concedido ('granted')</span>
            </div>
            <p className="text-[10px] text-[#B4B4C8] mt-1 font-normal">
              Notificaciones de escritorio autorizadas
            </p>
          </div>

          {/* 2. Por solicitar (default) */}
          <div
            className={`p-3 rounded-lg border text-center transition-all ${
              permiso === 'default'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'border-transparent text-[#B4B4C8]/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs">
              <HelpCircle size={15} className={permiso === 'default' ? 'text-amber-400' : ''} />
              <span>Por solicitar ('default')</span>
            </div>
            <p className="text-[10px] text-[#B4B4C8] mt-1 font-normal">
              Pendiente de respuesta del usuario
            </p>
          </div>

          {/* 3. Denegado (denied) */}
          <div
            className={`p-3 rounded-lg border text-center transition-all ${
              permiso === 'denied'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-bold shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : 'border-transparent text-[#B4B4C8]/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs">
              <AlertTriangle size={15} className={permiso === 'denied' ? 'text-rose-400' : ''} />
              <span>Denegado ('denied')</span>
            </div>
            <p className="text-[10px] text-[#B4B4C8] mt-1 font-normal">
              Bloqueado por el usuario o navegador
            </p>
          </div>
        </div>

        {/* Tarjeta explicativa según el estado actual */}
        {permiso === 'granted' && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-emerald-400">
                Permiso activo: El navegador permite notificaciones de escritorio.
              </p>
              <p className="text-[#B4B4C8] text-[11px] leading-relaxed">
                Recibirás avisos automáticos sobre próximos pasos comerciales que venzan hoy o hayan expirado cuando tengas la ventana del CRM minimizada o estés en otra pestaña.
              </p>
            </div>
          </div>
        )}

        {permiso === 'default' && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <HelpCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-amber-400">
                Permiso por solicitar: Aún no has autorizado los avisos del navegador.
              </p>
              <p className="text-[#B4B4C8] text-[11px] leading-relaxed">
                Haz clic en el botón inferior para solicitar los permisos y permitir que Eonesia CRM te alerte de tus tareas importantes en segundo plano.
              </p>
            </div>
          </div>
        )}

        {permiso === 'denied' && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-rose-400">
                Permiso denegado: El navegador tiene bloqueadas las notificaciones para este sitio.
              </p>
              <p className="text-[#B4B4C8] text-[11px] leading-relaxed">
                Pulsa el botón de solicitud para reintentar la petición o consulta la guía de desbloqueo mediante el icono del candado en la barra de direcciones.
              </p>
            </div>
          </div>
        )}

        {permiso === 'unsupported' && (
          <div className="p-3.5 rounded-lg bg-zinc-800/60 border border-zinc-700 flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-zinc-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs text-[#B4B4C8]">
              <p className="font-bold text-[#F2F2F7]">
                Navegador sin soporte de la Web Notifications API
              </p>
              <p className="text-[11px]">
                Tu navegador actual no implementa la API estándar de notificaciones de escritorio.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BOTONES DE ACCIÓN: Muestra botón para solicitar permisos si el estado es 'default' o 'denied' */}
      <div className="pt-2 flex flex-wrap items-center gap-3">
        {(permiso === 'default' || permiso === 'denied') && (
          <button
            type="button"
            onClick={handleSolicitarPermiso}
            disabled={solicitando}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[#000000] font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-all shadow-lg ${
              permiso === 'denied'
                ? 'bg-gradient-to-r from-[#E96999] to-[#00C8FF] shadow-[0_0_15px_rgba(233,105,153,0.3)]'
                : 'bg-gradient-to-r from-[#00C8FF] to-[#E96999] shadow-[0_0_15px_rgba(0,200,255,0.3)]'
            }`}
          >
            <BellRing size={15} className={solicitando ? 'animate-bounce' : ''} />
            <span>
              {solicitando
                ? 'Solicitando permisos al navegador...'
                : permiso === 'denied'
                ? 'Solicitar / Reintentar permisos de notificación'
                : 'Solicitar permisos de notificación'}
            </span>
          </button>
        )}

        {/* Botón para comprobar o actualizar manualmente el estado en tiempo real */}
        <button
          type="button"
          onClick={() => {
            const act = verificarPermiso();
            setMensajeFeedback(`Verificación actualizada: ${act}`);
            setTimeout(() => setMensajeFeedback(null), 2500);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131320] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)] text-[#B4B4C8] hover:text-[#00C8FF] text-xs font-medium transition-colors"
          title="Verificar de nuevo Notification.permission"
        >
          <RotateCcw size={13} />
          <span>Comprobar estado</span>
        </button>

        {/* Botón de prueba si el permiso está concedido */}
        {permiso === 'granted' && (
          <button
            type="button"
            onClick={handleEnviarPrueba}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[rgba(0,200,255,0.1)] border border-[#00C8FF] text-[#00C8FF] hover:bg-[#00C8FF] hover:text-[#000000] text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,200,255,0.15)]"
          >
            <Bell size={14} />
            <span>Enviar aviso de prueba</span>
          </button>
        )}

        {/* Feedback dinámico */}
        {pruebaEnviada && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Check size={14} />
            ¡Aviso enviado! Comprueba las notificaciones de tu sistema.
          </span>
        )}

        {mensajeFeedback && (
          <span className="text-xs text-[#00C8FF] font-medium animate-fade-in">
            {mensajeFeedback}
          </span>
        )}
      </div>

      {/* Guía paso a paso para desbloquear en caso de que esté 'denied' o solicitada la guía */}
      {(permiso === 'denied' || mostrarGuiaDesbloqueo) && (
        <div className="p-3.5 rounded-lg bg-[#000000]/80 border border-rose-500/30 space-y-2 text-xs text-[#B4B4C8]">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <Lock size={14} className="text-rose-400" />
            <span>Cómo desbloquear permisos denegados en tu navegador:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
            <li>
              Haz clic en el icono del candado 🔒 o ajustes del sitio junto a la URL en la barra de direcciones.
            </li>
            <li>
              Busca el permiso de <strong>Notificaciones</strong> y cámbialo de <em>Bloqueado</em> a <strong>Permitir</strong>.
            </li>
            <li>
              Vuelve a esta pestaña y haz clic en el botón <strong>"Comprobar estado"</strong> o <strong>"Solicitar / Reintentar permisos"</strong>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionNotificaciones;
