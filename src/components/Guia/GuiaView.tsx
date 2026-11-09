import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Database,
  FileSpreadsheet,
  FileText,
  HardDrive,
  HelpCircle,
  History,
  Kanban,
  Lightbulb,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';
import { crmRepo, descifrarRespaldo, realizarRespaldo } from '../../repo';
import { RespaldoCifradoInfo } from '../../types';
import {
  emitirNotificacionPrueba,
  obtenerEstadoPermiso,
  solicitarPermisoNotificaciones,
  soportaNotificaciones,
} from '../../utils/browserNotifications';
import { ConfiguracionNotificaciones } from './ConfiguracionNotificaciones';

export interface RespaldoStorageItem {
  clave: string;
  timestamp: number;
  fechaLegible: string;
  tamanoBytes: number;
  contenido: string;
  totalCentros?: number;
  totalOportunidades?: number;
  valorTotal?: number;
}

export const GuiaView: React.FC = () => {
  const [busqueda, setBusqueda] = useState('');
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({
    notificaciones: true,
    versiones: true,
    respaldos_storage: true,
    flujo: false,
    icp: false,
    json: false,
    encaje_vs_prob: false,
    juego: false,
    errores: false,
    secciones: false,
    privacidad: false,
  });

  const [respaldos, setRespaldos] = useState<RespaldoCifradoInfo[]>(() =>
    crmRepo.obtenerHistorialRespaldos()
  );
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Estados de configuración de notificaciones del navegador
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | 'unsupported'>(() =>
    obtenerEstadoPermiso()
  );
  const [notifHabilitadas, setNotifHabilitadas] = useState<boolean>(
    () => crmRepo.obtenerEstado().config.notificacionesNavegador !== false
  );
  const [solicitandoPermiso, setSolicitandoPermiso] = useState<boolean>(false);
  const [pruebaEnviada, setPruebaEnviada] = useState<boolean>(false);

  // Estados para respaldos directos en localStorage con prefijo 'eonesia_backup_'
  const [respaldosStorage, setRespaldosStorage] = useState<RespaldoStorageItem[]>([]);
  const [restaurandoStorageKey, setRestaurandoStorageKey] = useState<string | null>(null);

  /**
   * Lee directamente los respaldos guardados en localStorage filtrando por el prefijo 'eonesia_backup_',
   * los ordena por timestamp (los más recientes primero) y extrae sus metadatos.
   */
  const cargarRespaldosStorage = () => {
    const items: RespaldoStorageItem[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('eonesia_backup_')) {
            const contenido = localStorage.getItem(k) || '';
            const raw = k.replace('eonesia_backup_', '');
            let ts = 0;
            let fecha = new Date();

            if (/^\d{14}$/.test(raw)) {
              // Formato YYYYMMDDHHmmss
              const y = parseInt(raw.substring(0, 4), 10);
              const m = parseInt(raw.substring(4, 6), 10) - 1;
              const d = parseInt(raw.substring(6, 8), 10);
              const h = parseInt(raw.substring(8, 10), 10);
              const min = parseInt(raw.substring(10, 12), 10);
              const s = parseInt(raw.substring(12, 14), 10);
              fecha = new Date(y, m, d, h, min, s);
              ts = fecha.getTime();
            } else if (/^\d{10,13}$/.test(raw)) {
              ts = parseInt(raw, 10) * (raw.length === 10 ? 1000 : 1);
              fecha = new Date(ts);
            } else {
              ts = Date.now();
            }

            let centrosCount: number | undefined;
            let opCount: number | undefined;
            let valTotal: number | undefined;

            try {
              const binStr = atob(contenido);
              const bytes = new Uint8Array(binStr.length);
              for (let j = 0; j < binStr.length; j++) {
                bytes[j] = binStr.charCodeAt(j);
              }
              const parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes));
              if (parsed && Array.isArray(parsed.centros)) centrosCount = parsed.centros.length;
              if (parsed && Array.isArray(parsed.oportunidades)) {
                opCount = parsed.oportunidades.length;
                valTotal = parsed.oportunidades.reduce((acc: number, o: any) => acc + (o.valor || 0), 0);
              }
            } catch {
              try {
                const parsed = JSON.parse(contenido);
                if (parsed && Array.isArray(parsed.centros)) centrosCount = parsed.centros.length;
                if (parsed && Array.isArray(parsed.oportunidades)) {
                  opCount = parsed.oportunidades.length;
                  valTotal = parsed.oportunidades.reduce((acc: number, o: any) => acc + (o.valor || 0), 0);
                }
              } catch {}
            }

            items.push({
              clave: k,
              timestamp: ts,
              fechaLegible: fecha.toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              tamanoBytes: contenido.length,
              contenido,
              totalCentros: centrosCount,
              totalOportunidades: opCount,
              valorTotal: valTotal,
            });
          }
        }

        // Ordenar por timestamp descendente (más recientes primero)
        items.sort((a, b) => b.timestamp - a.timestamp);
      } catch (err) {
        console.warn('Error al leer respaldos de localStorage:', err);
      }
    }
    setRespaldosStorage(items);
  };

  useEffect(() => {
    const actualizar = (estado = crmRepo.obtenerEstado()) => {
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
      setNotifHabilitadas(estado.config.notificacionesNavegador !== false);
      setPermisoNotif(obtenerEstadoPermiso());
      cargarRespaldosStorage();
    };
    actualizar();
    const unsub = crmRepo.suscribir(actualizar);

    // Escucha en tiempo real si el usuario cambia permisos en el candado del navegador
    const alVolverFoco = () => {
      setPermisoNotif(obtenerEstadoPermiso());
      cargarRespaldosStorage();
    };
    window.addEventListener('focus', alVolverFoco);

    // Eventos de cambios en almacenamiento local
    const alCambiarStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('eonesia_backup_')) {
        cargarRespaldosStorage();
      }
    };
    window.addEventListener('storage', alCambiarStorage);

    // Permissions API si está soportada
    let permStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.onchange = () => {
            setPermisoNotif(obtenerEstadoPermiso());
          };
        })
        .catch(() => {});
    }

    // Intervalo de comprobación periódica para asegurar sincronización en tiempo real con el DOM
    const intervalId = setInterval(() => {
      const nuevoPermiso = obtenerEstadoPermiso();
      setPermisoNotif((prev) => (prev !== nuevoPermiso ? nuevoPermiso : prev));
    }, 1200);

    return () => {
      unsub();
      window.removeEventListener('focus', alVolverFoco);
      window.removeEventListener('storage', alCambiarStorage);
      clearInterval(intervalId);
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  const handleToggleNotificaciones = async (activar: boolean) => {
    if (activar && permisoNotif !== 'granted' && permisoNotif !== 'unsupported') {
      setSolicitandoPermiso(true);
      const res = await solicitarPermisoNotificaciones();
      setPermisoNotif(res);
      setSolicitandoPermiso(false);
      if (res === 'granted') {
        crmRepo.actualizarPreferenciaNotificaciones(true);
        setNotifHabilitadas(true);
      } else {
        crmRepo.actualizarPreferenciaNotificaciones(false);
        setNotifHabilitadas(false);
      }
      return;
    }

    crmRepo.actualizarPreferenciaNotificaciones(activar);
    setNotifHabilitadas(activar);
  };

  const handleSolicitarPermiso = async () => {
    setSolicitandoPermiso(true);
    try {
      const res = await solicitarPermisoNotificaciones();
      setPermisoNotif(res);
      if (res === 'granted') {
        crmRepo.actualizarPreferenciaNotificaciones(true);
        setNotifHabilitadas(true);
        emitirNotificacionPrueba();
        setPruebaEnviada(true);
        setTimeout(() => setPruebaEnviada(false), 3500);
      }
    } finally {
      setSolicitandoPermiso(false);
    }
  };

  const handleEnviarPrueba = () => {
    const ok = emitirNotificacionPrueba();
    if (ok) {
      setPruebaEnviada(true);
      setTimeout(() => setPruebaEnviada(false), 3500);
    }
  };

  const handleRestaurar = (respaldo: RespaldoCifradoInfo) => {
    const fechaLegible = new Date(respaldo.timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const confirmar = window.confirm(
      `¿Deseas restaurar el CRM al estado de este respaldo?\n\n` +
      `Fecha y hora: ${fechaLegible}\n` +
      `Motivo: ${respaldo.motivo}\n` +
      `Datos: ${respaldo.totalCentros} centros, ${respaldo.totalOportunidades} oportunidades (${respaldo.valorTotal.toLocaleString('es-ES')} €).\n\n` +
      `La información actual se reemplazará por esta versión.`
    );

    if (!confirmar) return;

    setRestaurandoId(respaldo.id);
    try {
      // 1. Obtener el estado descifrado del respaldo
      const estadoRecuperado = crmRepo.obtenerEstadoDeRespaldo(respaldo.id);
      if (!estadoRecuperado) {
        alert('No se pudo descifrar o procesar el respaldo seleccionado.');
        setRestaurandoId(null);
        return;
      }

      // 2. Restaurar mediante crmRepo.setEstado()
      crmRepo.setEstado(
        estadoRecuperado,
        `Restaurado a la versión de ${fechaLegible} (${respaldo.motivo})`
      );

      setMensajeExito(`¡Versión del ${fechaLegible} restaurada con éxito!`);
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
      setTimeout(() => setMensajeExito(null), 4500);
    } catch (err: any) {
      alert(`Error al restaurar versión: ${err.message || 'Error desconocido'}`);
    } finally {
      setRestaurandoId(null);
    }
  };

  const handleCrearRespaldoManual = () => {
    const nuevo = crmRepo.generarRespaldoAutomatico('Punto manual desde Guía');
    if (nuevo) {
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
      setMensajeExito('Nuevo punto de restauración cifrado creado.');
      setTimeout(() => setMensajeExito(null), 3500);
    }
  };

  const handleEliminarRespaldo = (backupId: string) => {
    if (window.confirm('¿Deseas eliminar este respaldo cifrado del almacenamiento local?')) {
      crmRepo.eliminarRespaldoCifrado(backupId);
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
    }
  };

  const handleRestaurarBackupStorage = (item: RespaldoStorageItem) => {
    const fecha = item.fechaLegible;
    const confirmar = window.confirm(
      `¿Deseas restaurar el CRM con el respaldo "${item.clave}"?\n\n` +
      `Fecha y hora: ${fecha}\n` +
      `Tamaño: ${(item.tamanoBytes / 1024).toFixed(1)} KB\n` +
      (item.totalCentros !== undefined ? `Centros: ${item.totalCentros} | Oportunidades: ${item.totalOportunidades}\n\n` : '\n') +
      `Al pulsar Aceptar, se ejecutará crmRepo.setEstado() con el contenido del respaldo seleccionado.`
    );
    if (!confirmar) return;

    try {
      setRestaurandoStorageKey(item.clave);
      // Se llama a crmRepo.setEstado con el contenido del respaldo seleccionado
      crmRepo.setEstado(item.contenido, `Restaurado desde respaldo ${item.clave} (${fecha})`);
      setMensajeExito(`¡Respaldo "${item.clave}" restaurado con éxito mediante crmRepo.setEstado()!`);
      cargarRespaldosStorage();
      setTimeout(() => setMensajeExito(null), 4500);
    } catch (err: any) {
      alert(`Error al restaurar: ${err.message || 'Error desconocido'}`);
    } finally {
      setRestaurandoStorageKey(null);
    }
  };

  const handleCrearBackupStorageNuevo = () => {
    const clave = crmRepo.realizarRespaldo();
    if (clave) {
      cargarRespaldosStorage();
      setMensajeExito(`Nuevo respaldo generado en localStorage: ${clave}`);
      setTimeout(() => setMensajeExito(null), 3500);
    }
  };

  const handleEliminarBackupStorage = (clave: string) => {
    if (window.confirm(`¿Deseas eliminar el respaldo "${clave}" de localStorage?`)) {
      try {
        localStorage.removeItem(clave);
        cargarRespaldosStorage();
      } catch (err) {
        console.warn('Error al eliminar:', err);
      }
    }
  };

  const toggleSeccion = (id: string) => {
    setSeccionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const secciones = [
    {
      id: 'flujo',
      titulo: '1. El Flujo de Ventas Eonesia en 6 Pasos',
      subtitulo: 'Ruta metódica desde la prospección al análisis en el panel',
    },
    {
      id: 'icp',
      titulo: '2. Define tu Cliente Ideal (ICP) con IA',
      subtitulo: 'Cómo calibrar el algoritmo con prompts estratégicos',
    },
    {
      id: 'json',
      titulo: '3. Qué Significa Cada Campo del JSON',
      subtitulo: 'Diccionario de datos para el JSON de ICP y de Leads',
    },
    {
      id: 'encaje_vs_prob',
      titulo: '4. Encaje frente a Probabilidad de Cierre',
      subtitulo: 'Dos conceptos radicalmente distintos que nunca debes confundir',
    },
    {
      id: 'juego',
      titulo: '5. Cómo Funciona el Juego y la Gamificación',
      subtitulo: 'XP, niveles, misiones, cofres, series e insignias',
    },
    {
      id: 'errores',
      titulo: '6. Errores Frecuentes y Soluciones',
      subtitulo: 'JSON mal pegado, duplicados, respaldos y copias de seguridad',
    },
    {
      id: 'secciones',
      titulo: '7. Para Qué Sirve Cada Sección del CRM',
      subtitulo: 'Guía rápida de módulos: Tablero, Panel, Prospectar, ICP y Logros',
    },
    {
      id: 'privacidad',
      titulo: '8. Qué NO Subir (Aviso de Privacidad y Cumplimiento)',
      subtitulo: 'Protección estricta de menores, RGPD y LSSI en España',
    },
    {
      id: 'versiones',
      titulo: '9. Historial de Versiones y Respaldos Cifrados',
      subtitulo: 'Últimos 10 puntos de restauración automáticos con fecha, hora y restauración con crmRepo.setEstado()',
    },
    {
      id: 'notificaciones',
      titulo: '10. Configuración de Notificaciones del Navegador',
      subtitulo: 'Habilitar o pausar avisos en segundo plano para próximos pasos vencidos o para hoy',
    },
    {
      id: 'respaldos_storage',
      titulo: '11. Respaldos en LocalStorage (eonesia_backup_*)',
      subtitulo: 'Lectura directa de respaldos en localStorage filtrados por prefijo eonesia_backup_, ordenados por timestamp y con botón Restaurar',
    },
  ];

  const seccionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return secciones;
    const q = busqueda.toLowerCase();
    return secciones.filter(
      (s) => s.titulo.toLowerCase().includes(q) || s.subtitulo.toLowerCase().includes(q)
    );
  }, [busqueda, secciones]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Cabecera */}
      <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)] space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-[#00C8FF]" />
          <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">
            Guía Operativa y Metodología Eonesia CRM
          </h2>
        </div>
        <p className="text-xs text-[#B4B4C8]">
          Manual de ventas para el equipo de Eonesia. Aprende a cualificar con rigor, proteger los datos y cerrar acuerdos de espacios inmersivos.
        </p>

        {/* Buscador de la guía */}
        <div className="relative pt-1">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la guía (ej. encaje, duplicados, RGPD, notificaciones)..."
            className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg py-2.5 pl-9 pr-3 text-xs text-[#F2F2F7] focus:border-[#00C8FF]"
          />
          <Search size={15} className="absolute left-3 top-3.5 text-[#B4B4C8]" />
        </div>

        {/* Barra rápida de estado de permisos de notificaciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#B4B4C8] text-[11px]">Permiso de notificaciones:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                permisoNotif === 'granted'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : permisoNotif === 'denied'
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              {permisoNotif === 'granted' && <CheckCircle2 size={11} />}
              {permisoNotif === 'denied' && <AlertTriangle size={11} />}
              {permisoNotif === 'default' && <HelpCircle size={11} />}
              <span>
                {permisoNotif === 'granted'
                  ? 'Concedido'
                  : permisoNotif === 'denied'
                  ? 'Denegado'
                  : 'Por solicitar'}
              </span>
            </span>
          </div>

          {permisoNotif === 'default' && (
            <button
              type="button"
              onClick={handleSolicitarPermiso}
              disabled={solicitandoPermiso}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] font-bold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_0_10px_rgba(0,200,255,0.2)]"
            >
              <BellRing size={12} className={solicitandoPermiso ? 'animate-bounce' : ''} />
              <span>{solicitandoPermiso ? 'Solicitando...' : 'Solicitar acceso ahora'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SECCIONES DESPLEGABLES */}
      <div className="space-y-3.5 text-xs">
        {/* 1. EL FLUJO EN 6 PASOS DIBUJADO COMO LÍNEA DE LUZ CON 6 NODOS */}
        {seccionesFiltradas.some((s) => s.id === 'flujo') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('flujo')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  1. El flujo en 6 pasos (Línea de Luz)
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['flujo'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['flujo'] && (
              <div className="p-4 pt-0 space-y-5 border-t border-[rgba(255,255,255,0.06)] mt-2">
                {/* DIBUJO DE LÍNEA DE LUZ CON 6 NODOS */}
                <div className="pt-3 pb-2">
                  <div className="relative flex items-center justify-between">
                    {/* Línea luminosa de fondo */}
                    <div
                      className="absolute left-4 right-4 h-1 top-1/2 -translate-y-1/2 -z-0 rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, #00C8FF 0%, #68D3FF 30%, #E96999 70%, #4802B1 100%)',
                        boxShadow: '0 0 12px rgba(0,200,255,0.4)',
                      }}
                    />

                    {[
                      { num: 1, label: 'Prospecta / Lead', desc: 'Ingesta y contacto' },
                      { num: 2, label: 'Demo', desc: '5 min en navegador' },
                      { num: 3, label: 'Piloto', desc: '2 espacios en 3 días' },
                      { num: 4, label: 'Propuesta', desc: 'Plan formal acordado' },
                      { num: 5, label: 'Cierre', desc: 'Firma y onboarding' },
                      { num: 6, label: 'Revisa Panel', desc: 'Métricas y velocidad' },
                    ].map((nodo) => (
                      <div
                        key={nodo.num}
                        className="relative z-10 flex flex-col items-center text-center group"
                      >
                        <div
                          className="w-8 h-8 rounded-full bg-[#0D0D14] border-2 border-[#00C8FF] flex items-center justify-center font-bold text-xs text-[#F2F2F7] shadow-lg group-hover:scale-110 transition-transform"
                          style={{ boxShadow: '0 0 10px rgba(0, 200, 255, 0.4)' }}
                        >
                          {nodo.num}
                        </div>
                        <span className="font-heading font-bold text-[11px] text-[#F2F2F7] mt-1.5 leading-tight">
                          {nodo.label}
                        </span>
                        <span className="text-[10px] text-[#B4B4C8] hidden sm:block">
                          {nodo.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] text-[#B4B4C8] space-y-1.5 leading-relaxed">
                  <p>
                    <strong>Regla de oro de Eonesia:</strong> Nuestros espacios educativos corren 100% en el navegador web estándar. Nunca obligues a descargar instaladores pesados ni exijas gafas VR para la primera toma de contacto.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. DEFINE TU CLIENTE IDEAL CON IA */}
        {seccionesFiltradas.some((s) => s.id === 'icp') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('icp')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  2. Define tu cliente ideal con IA
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['icp'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['icp'] && (
              <div className="p-4 pt-0 space-y-3 border-t border-[rgba(255,255,255,0.06)] mt-2 text-[#B4B4C8] leading-relaxed">
                <p>
                  En la pestaña <strong>Cliente ideal</strong> tienes una herramienta para calibrar tu ICP con cualquier modelo de IA (ChatGPT, Gemini, Claude).
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1">
                  <li>Copia el prompt oficial desde la caja "Rellenar el ICP con tu IA".</li>
                  <li>Pégalo en tu IA favorita añadiendo detalles de tu nicho (ej. centros de FP sanitaria en Andalucía).</li>
                  <li>Copia el bloque JSON devuelto por la IA.</li>
                  <li>Pégalo en el área correspondiente y pulsa "Aplicar al ICP". El CRM validará la estructura sin alterar tus datos si hubiera errores.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* 3. QUÉ SIGNIFICA CADA CAMPO DEL JSON */}
        {seccionesFiltradas.some((s) => s.id === 'json') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('json')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  3. Qué significa cada campo del JSON
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['json'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['json'] && (
              <div className="p-4 pt-0 space-y-4 border-t border-[rgba(255,255,255,0.06)] mt-2">
                <h4 className="font-heading font-bold text-xs text-[#00C8FF] uppercase">
                  A) Campos del JSON del ICP:
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#B4B4C8]">
                        <th className="py-1.5 w-1/3">Campo</th>
                        <th className="py-1.5">Explicación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-[#F2F2F7]">
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">ficha.quien</td>
                        <td>Rol y atribuciones de quien decide o impulsa la compra.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">ficha.problema</td>
                        <td>El dolor tangible que sufren los alumnos o el claustro.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">ficha.donde</td>
                        <td>Jornadas, redes, congresos o canales de captación.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">ficha.comoCompra</td>
                        <td>Pasos habituales de su proceso de contratación.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">ficha.noEncaja</td>
                        <td>Motivos objetivos para descartar inmediatamente al prospecto.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#00C8FF]">pesos.*</td>
                        <td>Valores del 1 al 5 para ponderar decisor, dinero, segmento, dolor y catálogo.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="font-heading font-bold text-xs text-[#00C8FF] uppercase pt-2">
                  B) Campos del JSON de un Lead:
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#B4B4C8]">
                        <th className="py-1.5 w-1/3">Campo</th>
                        <th className="py-1.5">Explicación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-[#F2F2F7]">
                      <tr>
                        <td className="py-1.5 font-mono text-[#E96999]">nombre</td>
                        <td>Nombre oficial del centro o institución educativa.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#E96999]">tipo</td>
                        <td>FP | Privado | Concertado | Publico | Universidad | Editorial | Institucional.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#E96999]">provincia</td>
                        <td>Ubicación geográfica para asignación territorial.</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#E96999]">web</td>
                        <td>Dominio web oficial (se usa para deduplicación automática).</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono text-[#E96999]">alumnos</td>
                        <td>Número aproximado de estudiantes matriculados.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. ENCAJE FRENTE A PROBABILIDAD */}
        {seccionesFiltradas.some((s) => s.id === 'encaje_vs_prob') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('encaje_vs_prob')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  4. Encaje frente a Probabilidad de Cierre
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['encaje_vs_prob'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['encaje_vs_prob'] && (
              <div className="p-4 pt-0 space-y-3 border-t border-[rgba(255,255,255,0.06)] mt-2 text-[#B4B4C8] leading-relaxed">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(0,200,255,0.25)]">
                    <span className="font-heading font-bold text-xs text-[#00C8FF] block mb-1">
                      Encaje ICP (%)
                    </span>
                    <p className="text-[11px]">
                      Mide el <strong>parecido con tu cliente ideal</strong> según sus 5 criterios objetivos. Un centro puede tener un 100% de encaje y estar recién detectado. <em>Nunca es una probabilidad de compra.</em>
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(233,105,153,0.25)]">
                    <span className="font-heading font-bold text-xs text-[#E96999] block mb-1">
                      Probabilidad de Cierre (%)
                    </span>
                    <p className="text-[11px]">
                      Depende exclusivamente de la <strong>etapa del embudo</strong> (Detectado 10%, Demo 25%, Piloto 50%, Propuesta 70%, Ganado 100%). Se utiliza para calcular la <strong>previsión ponderada</strong> de ventas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. CÓMO FUNCIONA EL JUEGO */}
        {seccionesFiltradas.some((s) => s.id === 'juego') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('juego')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  5. Cómo funciona el juego y la maestría
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['juego'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['juego'] && (
              <div className="p-4 pt-0 space-y-2.5 border-t border-[rgba(255,255,255,0.06)] mt-2 text-[#B4B4C8] leading-relaxed">
                <p>
                  El juego en Eonesia CRM está diseñado como un amplificador de buenos hábitos de ventas:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>Niveles:</strong> Sombra (0), Círculo (100), Esfera (250), Portal (450), Isla (700) y Archipiélago (1000).</li>
                  <li><strong>Misiones de hoy:</strong> 3 tareas diarias que dan +10 XP cada una al reclamarse.</li>
                  <li><strong>Retos y Cofres:</strong> Los retos semanales desbloquean el Cofre Semanal (+50 XP) y los mensuales el Cofre del Mes (+150 XP e insignia exclusiva).</li>
                  <li><strong>Series:</strong> Bronce (+20 XP), Plata (+50 XP) y Oro (+100 XP) en volumen de cierres, constancia y empatía.</li>
                  <li><strong>Insignias de equipo:</strong> Crea tus propias insignias con generador procedural que nunca dan XP para evitar trampas.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 6. ERRORES FRECUENTES */}
        {seccionesFiltradas.some((s) => s.id === 'errores') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('errores')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  6. Errores frecuentes y resolución
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['errores'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['errores'] && (
              <div className="p-4 pt-0 space-y-3 border-t border-[rgba(255,255,255,0.06)] mt-2 text-[#B4B4C8] leading-relaxed">
                <div>
                  <strong className="text-[#F2F2F7]">JSON mal pegado:</strong> Asegúrate de copiar las llaves completas {'{ ... }'}. El sistema no modificará tus datos si detecta sintaxis defectuosa.
                </div>
                <div>
                  <strong className="text-[#F2F2F7]">Centro duplicado:</strong> La función central <code className="text-[#00C8FF]">ingestar()</code> detecta automáticamente centros repetidos por web, por externalId o por nombre normalizado + provincia.
                </div>
                <div>
                  <strong className="text-[#F2F2F7]">Copias de seguridad:</strong> Pulsa "Exportar copia" en la cabecera para descargar un archivo JSON completo que puedes restaurar en cualquier equipo con "Importar copia".
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. PARA QUÉ SIRVE CADA SECCIÓN */}
        {seccionesFiltradas.some((s) => s.id === 'secciones') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('secciones')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00C8FF]" />
                <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                  7. Para qué sirve cada sección
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#B4B4C8] transition-transform ${
                  seccionesAbiertas['secciones'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['secciones'] && (
              <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[rgba(255,255,255,0.06)] mt-2">
                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)]">
                  <span className="font-bold text-[#00C8FF] block mb-1">Tablero (Kanban)</span>
                  <p className="text-[11px] text-[#B4B4C8]">
                    Control del pipeline en 6 columnas con widgets "Hoy Toca", arrastrar y soltar, filtros y ficha lateral.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)]">
                  <span className="font-bold text-[#00C8FF] block mb-1">Panel (Analytics)</span>
                  <p className="text-[11px] text-[#B4B4C8]">
                    Métricas de salud comercial: velocity, win rate, embudo de conversión, scatter plot y constancia.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)]">
                  <span className="font-bold text-[#00C8FF] block mb-1">Prospectar</span>
                  <p className="text-[11px] text-[#B4B4C8]">
                    Buscador con IA conectado a Google Search grounding, importador masivo CSV y JSON.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)]">
                  <span className="font-bold text-[#00C8FF] block mb-1">Cliente Ideal (ICP)</span>
                  <p className="text-[11px] text-[#B4B4C8]">
                    Las 5 frases estratégicas, los deslizadores de ponderación y la sincronización con IA.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. QUÉ NO SUBIR (AVISO CON BORDE ROSA OBLIGATORIO) */}
        {seccionesFiltradas.some((s) => s.id === 'privacidad') && (
          <div className="rounded-xl bg-[#0D0D14] border-2 border-[rgba(233,105,153,0.6)] shadow-[0_0_20px_-4px_rgba(233,105,153,0.3)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('privacidad')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={18} className="text-[#E96999]" />
                <span className="font-heading font-bold text-sm text-[#E96999]">
                  8. Qué NO subir (Aviso de Privacidad y Cumplimiento Legal)
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#E96999] transition-transform ${
                  seccionesAbiertas['privacidad'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['privacidad'] && (
              <div className="p-4 pt-0 space-y-3 border-t border-[rgba(233,105,153,0.2)] mt-2 text-xs text-[#F2F2F7] leading-relaxed">
                <div className="p-3 rounded-lg bg-[rgba(233,105,153,0.1)] border border-[rgba(233,105,153,0.3)] space-y-2">
                  <p className="font-bold text-[#E96999]">
                    PROHIBIDO SUBIR AL CRM:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[#B4B4C8]">
                    <li><strong>Datos de menores:</strong> Nombres, listas de alumnos, calificaciones o imágenes de estudiantes.</li>
                    <li><strong>Datos sensibles (Art. 9 RGPD):</strong> Datos de salud, opiniones políticas o convicciones religiosas.</li>
                    <li><strong>Datos sin base legal:</strong> Solo puedes registrar contactos profesionales corporativos con base legal (interés legítimo B2B o consentimiento).</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] text-[#B4B4C8] space-y-1">
                  <strong className="text-[#00C8FF]">Normativa LSSI para correo en frío en España:</strong>
                  <p>
                    Al redactar correos comerciales en frío debes identificarte claramente como Eonesia, explicar el origen del contacto y ofrecer siempre una forma sencilla y visible de darse de baja (opt-out).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 9. HISTORIAL DE VERSIONES Y RESPALDOS CIFRADOS */}
        {seccionesFiltradas.some((s) => s.id === 'versiones') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] shadow-[0_0_20px_-5px_rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('versiones')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <History size={18} className="text-[#00C8FF]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                      9. Historial de Versiones y Respaldos Cifrados
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                      {respaldos.length} / 10 puntos
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B4B4C8] mt-0.5">
                    Últimas 10 versiones generadas automáticamente con restauración instantánea vía crmRepo.setEstado()
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#00C8FF] transition-transform ${
                  seccionesAbiertas['versiones'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['versiones'] && (
              <div className="p-4 pt-0 space-y-4 border-t border-[rgba(0,200,255,0.15)] mt-2">
                {/* Explicación de seguridad y funcionamiento */}
                <div className="p-3.5 rounded-lg bg-[#000000]/60 border border-[rgba(0,200,255,0.2)] space-y-2 text-[#B4B4C8] leading-relaxed">
                  <div className="flex items-center gap-2 text-[#00C8FF] font-heading font-bold text-xs">
                    <ShieldCheck size={16} />
                    <span>Mecanismo de Auto-Respaldo Cifrado de Eonesia</span>
                  </div>
                  <p>
                    Ante cualquier cambio crítico (avance de etapa, ingesta de centros o registro de actividades), el repositorio genera automáticamente un respaldo encriptado con vector de inicialización aleatorio (IV) y suma de verificación SHA-256.
                  </p>
                  <p>
                    El sistema conserva en rotación continua los <strong>últimos 10 respaldos</strong>. En caso de fallo o discrepancia, puedes pulsar <strong className="text-[#F2F2F7]">"Restaurar versión"</strong> para recuperar inmediatamente el estado íntegro mediante la función <code className="text-[#00C8FF] font-mono">crmRepo.setEstado()</code>.
                  </p>
                </div>

                {/* Barra de acción manual */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-2 text-xs text-[#B4B4C8]">
                    <Clock size={14} className="text-[#00C8FF]" />
                    <span>
                      Mostrando {respaldos.length} de un máximo de 10 puntos de restauración.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCrearRespaldoManual}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[rgba(0,200,255,0.1)] border border-[#00C8FF] text-[#00C8FF] hover:bg-[#00C8FF] hover:text-[#000000] text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,200,255,0.2)]"
                  >
                    <Plus size={14} />
                    <span>Crear punto de restauración ahora</span>
                  </button>
                </div>

                {/* Aviso de confirmación o éxito */}
                {mensajeExito && (
                  <div className="p-3 rounded-lg bg-[rgba(0,200,255,0.12)] border border-[#00C8FF] text-xs text-[#00C8FF] flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{mensajeExito}</span>
                  </div>
                )}

                {/* Lista de los últimos 10 respaldos */}
                {respaldos.length === 0 ? (
                  <div className="text-center py-8 p-4 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.06)] space-y-2">
                    <HardDrive size={32} className="mx-auto text-[#B4B4C8]/50" />
                    <p className="text-xs text-[#F2F2F7] font-bold">
                      Aún no hay respaldos archivados
                    </p>
                    <p className="text-[11px] text-[#B4B4C8]">
                      Realiza cambios en el tablero o pulsa "Crear punto de restauración ahora" para generar el primer respaldo cifrado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {respaldos.map((respaldo, index) => {
                      const fechaObj = new Date(respaldo.timestamp);
                      const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                      const horaFormateada = fechaObj.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const esElMasReciente = index === 0;
                      const estaRestaurando = restaurandoId === respaldo.id;

                      return (
                        <div
                          key={respaldo.id}
                          className={`p-3.5 rounded-xl bg-[#05050A] border transition-all ${
                            esElMasReciente
                              ? 'border-[rgba(0,200,255,0.35)] shadow-[0_0_15px_-4px_rgba(0,200,255,0.2)]'
                              : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.25)]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Información y marcas de tiempo */}
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.2)] font-bold">
                                  #{index + 1}
                                </span>
                                {esElMasReciente && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                                    Último respaldo
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F2F2F7]">
                                  <Calendar size={13} className="text-[#00C8FF]" />
                                  <span>{fechaFormateada}</span>
                                  <span className="text-[#B4B4C8] font-normal">•</span>
                                  <Clock size={13} className="text-[#E96999]" />
                                  <span className="font-mono text-[#00C8FF]">{horaFormateada}</span>
                                </div>
                              </div>

                              <p className="text-xs text-[#B4B4C8] truncate">
                                {respaldo.motivo}
                              </p>

                              {/* Badges de métricas y seguridad */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#F2F2F7] border border-[rgba(255,255,255,0.06)]">
                                  🏫 <strong>{respaldo.totalCentros}</strong> centros
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#F2F2F7] border border-[rgba(255,255,255,0.06)]">
                                  💼 <strong>{respaldo.totalOportunidades}</strong> op.
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.2)] font-semibold">
                                  💰 {respaldo.valorTotal.toLocaleString('es-ES')} €
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#E96999] border border-[rgba(233,105,153,0.2)] flex items-center gap-1">
                                  <Lock size={11} /> Cifrado
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#B4B4C8] border border-[rgba(255,255,255,0.06)] font-mono text-[10px]">
                                  {(respaldo.tamanoBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>

                            {/* Acciones del respaldo */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRestaurar(respaldo)}
                                disabled={estaRestaurando}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,200,255,0.25)]"
                                title="Restaura el CRM completo a este punto con crmRepo.setEstado()"
                              >
                                <RotateCcw
                                  size={13}
                                  className={estaRestaurando ? 'animate-spin' : ''}
                                />
                                <span>{estaRestaurando ? 'Restaurando...' : 'Restaurar versión'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminarRespaldo(respaldo.id)}
                                className="p-1.5 rounded-lg text-[#B4B4C8] hover:text-[#E96999] hover:bg-[#131320] transition-colors"
                                title="Eliminar este respaldo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 10. CONFIGURACIÓN DE NOTIFICACIONES DEL NAVEGADOR */}
        {seccionesFiltradas.some((s) => s.id === 'notificaciones') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] shadow-[0_0_20px_-5px_rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('notificaciones')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BellRing size={18} className="text-[#00C8FF]" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                      10. Configuración de Notificaciones del Navegador
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                        permisoNotif === 'granted'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : permisoNotif === 'denied'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      Permiso: {permisoNotif === 'granted' ? 'Concedido' : permisoNotif === 'denied' ? 'Denegado' : 'Por solicitar'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      CRM: {notifHabilitadas ? 'Habilitadas' : 'Pausadas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B4B4C8] mt-0.5">
                    Verificación en tiempo real de Notification.permission y gestión de avisos de escritorio
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#00C8FF] transition-transform ${
                  seccionesAbiertas['notificaciones'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['notificaciones'] && (
              <div className="p-4 pt-0 space-y-4 border-t border-[rgba(0,200,255,0.15)] mt-2">
                {/* Componente de configuración que verifica Notification.permission */}
                <ConfiguracionNotificaciones
                  onPermisoChange={(p) => setPermisoNotif(p)}
                />

                {/* Guía explicativa de funcionamiento */}
                <div className="p-3.5 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] space-y-2 text-[#B4B4C8] text-xs leading-relaxed">
                  <div className="text-[#00C8FF] font-heading font-bold text-xs flex items-center gap-2">
                    <Sparkles size={14} />
                    <span>¿Cómo gestiona Eonesia las alertas en segundo plano?</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    <li>
                      <strong>Cero interrupciones en primer plano:</strong> Si estás navegando activamente por el CRM, no te mostraremos ventanas emergentes para evitar molestias.
                    </li>
                    <li>
                      <strong>Detección automática de vencimientos:</strong> En cuanto una oportunidad llega a su fecha de próximo paso o expira, se emite un aviso del sistema al minimizar la ventana.
                    </li>
                    <li>
                      <strong>Límite de saturación:</strong> Se envían como máximo 2 avisos por comprobación periódica para no saturar la bandeja de entrada del sistema.
                    </li>
                    <li>
                      <strong>Clic directo:</strong> Al hacer clic en la notificación del sistema, el navegador enfocará automáticamente el CRM de Eonesia en pantalla.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 11. RESPALDOS EN LOCALSTORAGE (eonesia_backup_*) */}
        {seccionesFiltradas.some((s) => s.id === 'respaldos_storage') && (
          <div className="rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] shadow-[0_0_20px_-5px_rgba(0,200,255,0.2)] overflow-hidden">
            <button
              onClick={() => toggleSeccion('respaldos_storage')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#131320] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Database size={18} className="text-[#00C8FF]" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                      11. Respaldos en LocalStorage (eonesia_backup_*)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)] font-bold">
                      {respaldosStorage.length} respaldos encontrados
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Filtro: eonesia_backup_*
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B4B4C8] mt-0.5">
                    Puntos de restauración leídos directamente desde localStorage, ordenados por timestamp y con restauración instantánea mediante crmRepo.setEstado()
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#00C8FF] transition-transform ${
                  seccionesAbiertas['respaldos_storage'] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {seccionesAbiertas['respaldos_storage'] && (
              <div className="p-4 pt-0 space-y-4 border-t border-[rgba(0,200,255,0.15)] mt-2">
                {/* Cabecera interactiva con botones de acción */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.08)]">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#F2F2F7] flex items-center gap-2">
                      <HardDrive size={15} className="text-[#00C8FF]" />
                      Almacenamiento Local (localStorage del navegador)
                    </span>
                    <p className="text-[11px] text-[#B4B4C8]">
                      Se filtran todas las entradas que comienzan por el prefijo <code className="text-[#00C8FF] bg-[#161622] px-1 py-0.5 rounded font-mono">eonesia_backup_</code> y se ordenan de más reciente a más antiguo por timestamp.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={cargarRespaldosStorage}
                      className="px-3 py-1.5 rounded-lg bg-[#131320] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(0,200,255,0.4)] text-[#F2F2F7] text-xs font-medium hover:text-[#00C8FF] flex items-center gap-1.5 transition-colors"
                      title="Volver a leer las claves de localStorage"
                    >
                      <RefreshCw size={13} />
                      <span>Refrescar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCrearBackupStorageNuevo}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] font-bold text-xs hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,200,255,0.25)]"
                      title="Ejecutar crmRepo.realizarRespaldo() para crear un nuevo respaldo con timestamp"
                    >
                      <Plus size={14} />
                      <span>Nuevo respaldo ahora</span>
                    </button>
                  </div>
                </div>

                {/* Lista de respaldos ordenados por timestamp */}
                {respaldosStorage.length === 0 ? (
                  <div className="text-center py-8 p-4 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.06)] space-y-2">
                    <Database size={32} className="mx-auto text-[#B4B4C8]/50" />
                    <p className="text-xs text-[#F2F2F7] font-bold">
                      No se encontraron respaldos con el prefijo "eonesia_backup_" en localStorage
                    </p>
                    <p className="text-[11px] text-[#B4B4C8]">
                      Pulsa "Nuevo respaldo ahora" o realiza cualquier cambio comercial en el CRM para generar el primero automáticamente.
                    </p>
                    <button
                      type="button"
                      onClick={handleCrearBackupStorageNuevo}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C8FF] text-[#000000] font-bold text-xs hover:bg-[#68D3FF] transition-colors"
                    >
                      <Plus size={13} />
                      <span>Generar respaldo inicial</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {respaldosStorage.map((item, index) => {
                      const esElMasReciente = index === 0;
                      const estaRestaurando = restaurandoStorageKey === item.clave;

                      return (
                        <div
                          key={item.clave}
                          className={`p-3.5 rounded-xl bg-[#05050A] border transition-all ${
                            esElMasReciente
                              ? 'border-[rgba(0,200,255,0.35)] shadow-[0_0_15px_-4px_rgba(0,200,255,0.2)]'
                              : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.25)]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Información detallada y metadatos */}
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.2)] font-bold">
                                  #{index + 1}
                                </span>
                                {esElMasReciente && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                                    Más reciente
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#F2F2F7]">
                                  <Calendar size={13} className="text-[#00C8FF]" />
                                  <span>{item.fechaLegible}</span>
                                </div>
                              </div>

                              {/* Clave exacta en localStorage */}
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-[#00C8FF] bg-[#161622] px-2 py-0.5 rounded border border-[rgba(0,200,255,0.2)] select-all truncate">
                                  {item.clave}
                                </span>
                                <span className="text-[10px] text-[#B4B4C8] font-mono">
                                  (Timestamp: {item.timestamp})
                                </span>
                              </div>

                              {/* Badges de métricas y resumen de datos */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                                {item.totalCentros !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-[#131320] text-[#F2F2F7] border border-[rgba(255,255,255,0.06)]">
                                    🏫 <strong>{item.totalCentros}</strong> centros
                                  </span>
                                )}
                                {item.totalOportunidades !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-[#131320] text-[#F2F2F7] border border-[rgba(255,255,255,0.06)]">
                                    💼 <strong>{item.totalOportunidades}</strong> oportunidades
                                  </span>
                                )}
                                {item.valorTotal !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.2)] font-semibold">
                                    💰 {item.valorTotal.toLocaleString('es-ES')} €
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#E96999] border border-[rgba(233,105,153,0.2)] flex items-center gap-1">
                                  <Lock size={11} /> Base64 / btoa
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#131320] text-[#B4B4C8] border border-[rgba(255,255,255,0.06)] font-mono text-[10px]">
                                  {(item.tamanoBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>

                            {/* Botón Restaurar requerido por el usuario */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRestaurarBackupStorage(item)}
                                disabled={estaRestaurando}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,200,255,0.25)]"
                                title="Restaura este respaldo llamando a crmRepo.setEstado con el contenido del respaldo seleccionado"
                              >
                                <RotateCcw
                                  size={13}
                                  className={estaRestaurando ? 'animate-spin' : ''}
                                />
                                <span>{estaRestaurando ? 'Restaurando...' : 'Restaurar'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminarBackupStorage(item.clave)}
                                className="p-2 rounded-lg text-[#B4B4C8] hover:text-[#E96999] hover:bg-[#131320] transition-colors"
                                title="Eliminar este respaldo de localStorage"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explicación técnica para el usuario */}
                <div className="p-3.5 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] space-y-2 text-[#B4B4C8] text-xs leading-relaxed">
                  <div className="text-[#00C8FF] font-heading font-bold text-xs flex items-center gap-2">
                    <Sparkles size={14} />
                    <span>Mecanismo de respaldo y recuperación eonesia_backup_</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    <li>
                      <strong>Filtrado estricto por clave:</strong> Cada vez que se abre o refresca esta sección, se leen todas las claves de <code className="text-[#00C8FF] font-mono">localStorage</code> que coinciden con el patrón <code className="text-[#00C8FF] font-mono">eonesia_backup_*</code>.
                    </li>
                    <li>
                      <strong>Ordenación por Timestamp:</strong> Las marcas de tiempo (formato <code className="text-[#00C8FF] font-mono">YYYYMMDDHHmmss</code>) se convierten a fechas reales y se ordenan de mayor a menor cronológico.
                    </li>
                    <li>
                      <strong>Llamada directa a crmRepo.setEstado():</strong> Al pulsar el botón <em>'Restaurar'</em>, se recupera el contenido exacto almacenado y se envía a <code className="text-[#00C8FF] font-mono">crmRepo.setEstado(contenido)</code>, actualizando la reactividad de la aplicación al instante.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
