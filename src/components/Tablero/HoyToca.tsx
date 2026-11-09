import React, { useState } from 'react';
import { Centro, Contacto, Oportunidad } from '../../types';
import { crmRepo } from '../../repo';
import { calcularEncajeICP, formatearEuros, formatearFecha, COLORES_TIPO_CENTRO } from '../../utils/crmHelpers';
import { AnilloEncaje } from '../common/AnilloEncaje';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  AlertTriangle,
  Loader2,
  Bell,
  BellRing,
  BellOff,
} from 'lucide-react';
import {
  obtenerEstadoPermiso,
  solicitarPermisoNotificaciones,
  emitirNotificacionPrueba,
} from '../../utils/browserNotifications';

interface HoyTocaProps {
  oportunidades: Oportunidad[];
  centros: Centro[];
  contactos: Contacto[];
  pesosICP: any;
  onAbrirFicha: (opId: string) => void;
}

export const HoyToca: React.FC<HoyTocaProps> = ({
  oportunidades,
  centros,
  contactos,
  pesosICP,
  onAbrirFicha,
}) => {
  const [selectorOp, setSelectorOp] = useState<Oportunidad | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState<string>('');
  const [nuevaAccion, setNuevaAccion] = useState<string>('');
  const [cargandoOpId, setCargandoOpId] = useState<string | null>(null);
  const [guardandoPaso, setGuardandoPaso] = useState<boolean>(false);
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | 'unsupported'>(
    obtenerEstadoPermiso()
  );

  const notificacionesActivas =
    crmRepo.obtenerEstado().config.notificacionesNavegador !== false;

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

  const handleProbarAviso = (e: React.MouseEvent) => {
    e.stopPropagation();
    emitirNotificacionPrueba();
  };

  const hoyStr = new Date().toISOString().split('T')[0];

  // 1. Filtrar ÚNICAMENTE oportunidades abiertas con próximo paso vencido o para hoy
  const abiertasHoyOVencidas = oportunidades.filter(
    (o) =>
      o.etapa !== 'Ganado' &&
      o.etapa !== 'Perdido' &&
      Boolean(o.proximoPaso?.fecha) &&
      o.proximoPaso.fecha <= hoyStr
  );

  // 2. Ordenar estrictamente:
  //    1º Por urgencia (fecha más antigua en el pasado = más días vencida)
  //    2º Por encaje con el Cliente Ideal (ICP) (de mayor a menor)
  //    3º Por valor económico en € (de mayor a menor)
  const ordenadas = [...abiertasHoyOVencidas].sort((a, b) => {
    // 1º Urgencia (fecha ascendente)
    const fechaA = a.proximoPaso.fecha;
    const fechaB = b.proximoPaso.fecha;
    if (fechaA !== fechaB) {
      return fechaA.localeCompare(fechaB);
    }

    // 2º Encaje ICP (mayor a menor)
    const encajeA = calcularEncajeICP(a.criterios, pesosICP).porcentaje || 0;
    const encajeB = calcularEncajeICP(b.criterios, pesosICP).porcentaje || 0;
    if (encajeA !== encajeB) {
      return encajeB - encajeA;
    }

    // 3º Valor económico en € (mayor a menor)
    return (b.valor || 0) - (a.valor || 0);
  });

  // Mostrar como máximo las 3 prioritarias
  const top3 = ordenadas.slice(0, 3);

  // Generador de fechas relativas para botones de atajo
  const generarFechaFutura = (dias: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  };

  // Manejo del botón "Hecho":
  // Registra automáticamente la actividad (+5 XP) con estado de carga para evitar clics duplicados
  const handlePasoHecho = async (op: Oportunidad) => {
    if (cargandoOpId !== null) return; // Evitar clics duplicados
    setCargandoOpId(op.id);

    try {
      // 1. Registra automáticamente la actividad en el CRM (+5 XP al instante)
      const accionCompletada = op.proximoPaso?.accion || 'Paso acordado con el centro';
      crmRepo.registrarActividad(op.id, {
        tipo: 'llamada',
        nota: `Seguimiento completado: ${accionCompletada}`,
      });

      // Breve pausa para garantizar retroalimentación visual de carga y debounce de clics
      await new Promise((resolve) => setTimeout(resolve, 350));

      // 2. Abre el selector de fecha para programar el siguiente paso
      setSelectorOp(op);
      setNuevaFecha(generarFechaFutura(3)); // Preselección sugerida a 3 días
      setNuevaAccion(`Seguimiento tras: ${accionCompletada.slice(0, 45)}`);
    } finally {
      setCargandoOpId(null);
    }
  };

  // Guardar la nueva fecha y acción del próximo paso con estado de carga
  const handleGuardarProximoPaso = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectorOp || !nuevaFecha || guardandoPaso) return;

    setGuardandoPaso(true);
    try {
      crmRepo.actualizarOportunidad(selectorOp.id, {
        proximoPaso: {
          accion: nuevaAccion.trim() || 'Siguiente llamada o revisión de avance',
          fecha: nuevaFecha,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      setSelectorOp(null);
      setNuevaFecha('');
      setNuevaAccion('');
    } finally {
      setGuardandoPaso(false);
    }
  };

  const calcularUrgencia = (fecha: string) => {
    if (fecha === hoyStr) {
      return { esHoy: true, texto: '¡Para hoy!', dias: 0 };
    }
    const diffMs = new Date(hoyStr).getTime() - new Date(fecha).getTime();
    const dias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    return {
      esHoy: false,
      texto: `Venció hace ${dias} ${dias === 1 ? 'día' : 'días'} (${formatearFecha(fecha)})`,
      dias,
    };
  };

  return (
    <div className="mb-6 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)] shadow-xl relative overflow-hidden anim-slide-down">
      {/* Luz ambiental sutil Noetic */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(0,200,255,0.1),transparent_70%)] pointer-events-none" />

      {/* Encabezado del bloque */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 relative z-10">
        <div className="flex items-center gap-2">
          <Clock size={17} className="text-[#00C8FF]" />
          <h2 className="font-heading font-bold text-sm tracking-wide uppercase text-[#F2F2F7]">
            Hoy Toca
          </h2>
          <span className="text-[11px] text-[#B4B4C8] hidden sm:inline">
            (Seguimientos vencidos o para hoy · Urgencia &gt; Encaje &gt; Valor)
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Control de notificaciones del navegador en segundo plano */}
          {permisoNotif === 'granted' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleNotif}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  notificacionesActivas
                    ? 'bg-[rgba(0,200,255,0.12)] hover:bg-[rgba(0,200,255,0.22)] text-[#00C8FF] border-[rgba(0,200,255,0.35)]'
                    : 'bg-[#161622] hover:bg-[#202030] text-[#B4B4C8] border-[rgba(255,255,255,0.1)]'
                }`}
                title={
                  notificacionesActivas
                    ? 'Avisos de escritorio activados. Haz clic para pausar.'
                    : 'Avisos pausados según tu preferencia. Haz clic para activar.'
                }
              >
                {notificacionesActivas ? (
                  <>
                    <BellRing size={12} className="text-[#00C8FF]" />
                    <span>Avisos segundo plano: Activos</span>
                  </>
                ) : (
                  <>
                    <BellOff size={12} />
                    <span>Avisos segundo plano: Pausados</span>
                  </>
                )}
              </button>
              {notificacionesActivas && (
                <button
                  type="button"
                  onClick={handleProbarAviso}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[#161622] hover:bg-[#202030] text-[#B4B4C8] hover:text-[#00C8FF] border border-[rgba(255,255,255,0.08)] transition-colors cursor-pointer"
                  title="Enviar una notificación de prueba para comprobar que tu navegador la muestra"
                >
                  Probar
                </button>
              )}
            </div>
          ) : permisoNotif === 'default' ? (
            <button
              type="button"
              onClick={handleToggleNotif}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[rgba(233,105,153,0.15)] hover:bg-[rgba(233,105,153,0.25)] text-[#E96999] border border-[rgba(233,105,153,0.35)] transition-all cursor-pointer shadow-sm animate-pulse"
              title="Permite avisos en segundo plano para no perder ningún próximo paso"
            >
              <Bell size={12} />
              <span>Activar avisos de escritorio</span>
            </button>
          ) : permisoNotif === 'denied' ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#B4B4C8] bg-[#161622] border border-[rgba(255,255,255,0.08)]"
              title="Avisos bloqueados en los permisos del navegador para esta página"
            >
              <BellOff size={11} className="text-[#E96999]" />
              <span>Avisos bloqueados en navegador</span>
            </span>
          ) : null}

          {top3.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(233,105,153,0.15)] text-[#E96999] border border-[rgba(233,105,153,0.3)]">
              {top3.length} {top3.length === 1 ? 'prioritario' : 'prioritarios'}
            </span>
          )}
        </div>
      </div>

      {/* Estado vacío o las 3 tarjetas prioritarias */}
      {top3.length === 0 ? (
        <div className="p-4 text-center rounded-lg bg-[#000000]/40 border border-[rgba(255,255,255,0.06)]">
          <p className="text-xs text-[#B4B4C8]">
            ✨ Todo al día. No tienes seguimientos vencidos para hoy. ¡Excelente ritmo de trabajo!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
          {top3.map((op, index) => {
            const centro = centros.find((c) => c.id === op.centroId);
            const contacto = contactos.find((ct) => op.contactoIds?.includes(ct.id));
            const encaje = calcularEncajeICP(op.criterios, pesosICP);
            const urgencia = calcularUrgencia(op.proximoPaso.fecha);
            const coloresTipo = centro?.tipo ? COLORES_TIPO_CENTRO[centro.tipo] : null;
            const estaCargando = cargandoOpId === op.id;

            return (
              <div
                key={op.id}
                style={{
                  animation: 'slideDownFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
                  animationDelay: `${index * 80}ms`,
                }}
                className="p-3.5 rounded-xl bg-[#000000]/65 border border-[rgba(0,200,255,0.2)] hover:border-[rgba(0,200,255,0.45)] transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  {/* Fila superior: Tipo, Nombre del centro y Anillo de encaje */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      {centro?.tipo && coloresTipo && (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border mb-1"
                          style={{
                            backgroundColor: coloresTipo.bg,
                            color: coloresTipo.text,
                            borderColor: coloresTipo.border,
                          }}
                        >
                          {centro.tipo}
                        </span>
                      )}
                      <h3
                        onClick={() => onAbrirFicha(op.id)}
                        className="font-heading font-bold text-xs text-[#F2F2F7] hover:text-[#00C8FF] cursor-pointer truncate transition-colors"
                        title={centro?.nombre}
                      >
                        {centro?.nombre || 'Centro educativo'}
                      </h3>
                    </div>
                    <div className="flex-shrink-0" title={`Encaje ICP: ${encaje.porcentaje}%`}>
                      <AnilloEncaje porcentaje={encaje.porcentaje} size={30} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Contacto o provincia */}
                  <p className="text-[11px] text-[#B4B4C8] truncate mb-2.5">
                    {contacto ? `${contacto.nombre} (${contacto.cargo})` : centro?.provincia}
                  </p>

                  {/* Caja de paso vencido o de hoy */}
                  <div className="p-2.5 rounded-lg bg-[#0D0D14] border border-[rgba(255,255,255,0.06)] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      {urgencia.esHoy ? (
                        <span className="flex items-center gap-1 text-[#00C8FF]">
                          <Calendar size={11} /> ¡Para hoy!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[#E96999]">
                          <AlertTriangle size={11} /> Venció hace {urgencia.dias} {urgencia.dias === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#F2F2F7] line-clamp-2 leading-snug">
                      {op.proximoPaso.accion}
                    </p>
                  </div>
                </div>

                {/* Pie: Importe económico y Botón "Hecho" */}
                <div className="mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#B4B4C8] uppercase font-mono">Valor</span>
                    <span className="text-xs font-mono font-bold text-[#F2F2F7]">
                      {formatearEuros(op.valor)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={cargandoOpId !== null}
                    onClick={() => handlePasoHecho(op)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-md active:scale-95 ${
                      estaCargando
                        ? 'bg-[#00C8FF]/70 text-[#0D0D14] cursor-wait'
                        : cargandoOpId !== null
                        ? 'bg-[#00C8FF]/40 text-[#0D0D14]/60 cursor-not-allowed'
                        : 'bg-[#00C8FF] hover:bg-[#68d3ff] text-[#0D0D14] cursor-pointer'
                    }`}
                    title={estaCargando ? 'Guardando actividad...' : 'Registrar actividad automáticamente (+5 XP) y elegir nuevo paso'}
                  >
                    {estaCargando ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-[#0D0D14]" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Hecho</span>
                        <span className="text-[10px] opacity-85 font-mono">(+5 XP)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selector de fecha para el siguiente paso tras pulsar "Hecho" */}
      {selectorOp && (
        <div className="fixed inset-0 z-50 bg-[#000000]/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0D0D14] border border-[rgba(0,200,255,0.4)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-[#F2F2F7] anim-slide-down">
            {/* Cabecera del selector */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] text-[10px] font-bold border border-[rgba(0,200,255,0.3)] mb-1">
                  <Sparkles size={11} /> ¡Actividad registrada! (+5 XP sumados)
                </div>
                <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
                  Programa el próximo paso
                </h3>
                <p className="text-xs text-[#B4B4C8] truncate">
                  {centros.find((c) => c.id === selectorOp.centroId)?.nombre}
                </p>
              </div>
              <button
                type="button"
                disabled={guardandoPaso}
                onClick={() => setSelectorOp(null)}
                className="text-[#B4B4C8] hover:text-[#F2F2F7] p-1 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario del selector */}
            <form onSubmit={handleGuardarProximoPaso} className="space-y-3.5 text-xs">
              {/* Atajos rápidos de fecha */}
              <div>
                <label className="block text-[11px] text-[#B4B4C8] mb-1.5 font-medium">
                  Atajos rápidos:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Mañana', dias: 1 },
                    { label: '+3 días', dias: 3 },
                    { label: '+1 sem', dias: 7 },
                    { label: '+15 días', dias: 15 },
                  ].map((at) => {
                    const f = generarFechaFutura(at.dias);
                    const activo = nuevaFecha === f;
                    return (
                      <button
                        key={at.label}
                        type="button"
                        disabled={guardandoPaso}
                        onClick={() => setNuevaFecha(f)}
                        className={`py-1.5 px-2 rounded-lg text-center font-semibold border transition-all ${
                          activo
                            ? 'bg-[rgba(0,200,255,0.2)] text-[#00C8FF] border-[#00C8FF]'
                            : 'bg-[#05050A] text-[#B4B4C8] border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)]'
                        }`}
                      >
                        {at.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de fecha nativo */}
              <div>
                <label className="block text-[11px] text-[#B4B4C8] mb-1 font-medium">
                  Fecha límite:
                </label>
                <input
                  type="date"
                  min={hoyStr}
                  value={nuevaFecha}
                  disabled={guardandoPaso}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  required
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] focus:border-[#00C8FF] rounded-lg p-2.5 text-xs text-[#F2F2F7] focus:outline-none disabled:opacity-60"
                />
              </div>

              {/* Acción del nuevo próximo paso */}
              <div>
                <label className="block text-[11px] text-[#B4B4C8] mb-1 font-medium">
                  Acción a realizar:
                </label>
                <input
                  type="text"
                  value={nuevaAccion}
                  disabled={guardandoPaso}
                  onChange={(e) => setNuevaAccion(e.target.value)}
                  placeholder="Ej. Revisión de propuesta, demo con claustro..."
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] focus:border-[#00C8FF] rounded-lg p-2.5 text-xs text-[#F2F2F7] focus:outline-none disabled:opacity-60"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
                <button
                  type="button"
                  disabled={guardandoPaso}
                  onClick={() => setSelectorOp(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#B4B4C8] hover:text-[#F2F2F7] hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Omitir fecha
                </button>
                <button
                  type="submit"
                  disabled={!nuevaFecha || guardandoPaso}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {guardandoPaso ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-[#0D0D14]" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span>Guardar próximo paso</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
