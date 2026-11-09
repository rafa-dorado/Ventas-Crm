import React, { useState } from 'react';
import { Centro, Contacto, CriterioOrdenTablero, EtapaOportunidad, Oportunidad, ProbabilidadesEtapa } from '../../types';
import {
  calcularDiasEnEtapa,
  calcularEncajeICP,
  calcularProbabilidadCierreDinamica,
  calcularUrgenciaProximoPaso,
  COLORES_TIPO_CENTRO,
  ETAPAS_ORDEN,
  evaluarEstancamientoOportunidad,
  evaluarWinInsight,
  formatearEuros,
  formatearFecha,
} from '../../utils/crmHelpers';
import { AnilloEncaje } from '../common/AnilloEncaje';
import {
  MoreVertical,
  User,
  ArrowRight,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Sparkles,
  Zap,
  Target,
  Clock,
} from 'lucide-react';

interface TarjetaOportunidadProps {
  oportunidad: Oportunidad;
  centro?: Centro;
  contacto?: Contacto;
  pesosICP: any;
  criterioOrden?: CriterioOrdenTablero;
  probabilidadesConfig?: ProbabilidadesEtapa | Record<string, number>;
  onAbrirFicha: (id: string) => void;
  onMoverEtapa: (opId: string, nuevaEtapa: EtapaOportunidad) => void;
  onDragStart: (e: React.DragEvent, opId: string) => void;
}

export const TarjetaOportunidad: React.FC<TarjetaOportunidadProps> = ({
  oportunidad,
  centro,
  contacto,
  pesosICP,
  criterioOrden = 'defecto',
  probabilidadesConfig,
  onAbrirFicha,
  onMoverEtapa,
  onDragStart,
}) => {
  const [menuMoverAbierto, setMenuMoverAbierto] = useState(false);

  const encaje = calcularEncajeICP(oportunidad.criterios, pesosICP);
  const diasEnEtapa = calcularDiasEnEtapa(oportunidad.historialEtapas);
  const estancamiento = evaluarEstancamientoOportunidad(oportunidad.historialEtapas, oportunidad.etapa);
  const winInsight = evaluarWinInsight(oportunidad, pesosICP);
  const colores = centro ? COLORES_TIPO_CENTRO[centro.tipo] : COLORES_TIPO_CENTRO.FP;

  // Métricas dinámicas para ordenamiento
  const probCierre = calcularProbabilidadCierreDinamica(oportunidad, probabilidadesConfig, pesosICP);
  const urgenciaInfo = calcularUrgenciaProximoPaso(oportunidad);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, oportunidad.id)}
      onClick={() => onAbrirFicha(oportunidad.id)}
      className={`group relative bg-[#0D0D14] hover:bg-[#131320] border rounded-xl p-3.5 cursor-pointer transition-all duration-200 select-none shadow-md flex flex-col justify-between ${
        winInsight.esWinInsight
          ? 'border-[rgba(0,200,255,0.5)] shadow-[0_0_18px_-2px_rgba(0,200,255,0.3)] hover:border-[#00C8FF] hover:shadow-[0_0_24px_-2px_rgba(0,200,255,0.45)]'
          : estancamiento.estancado
          ? estancamiento.nivelRiesgo === 'critico'
            ? 'border-rose-500/40 shadow-[0_0_15px_-4px_rgba(244,63,94,0.3)] hover:border-rose-500/60'
            : 'border-amber-500/40 shadow-[0_0_15px_-4px_rgba(245,158,11,0.25)] hover:border-amber-500/60'
          : 'border-[rgba(0,200,255,0.2)] hover:border-[rgba(0,200,255,0.45)] hover:shadow-[0_0_20px_-4px_rgba(0,200,255,0.25)]'
      }`}
    >
      <div>
        {/* Cabecera de la tarjeta: Badge Tipo de Centro + Badge de Estancamiento + Anillo de Encaje */}
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {centro && (
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0"
                style={{
                  backgroundColor: colores.bg,
                  color: colores.text,
                  borderColor: colores.border,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colores.dot }} />
                <span>{centro.tipo}</span>
                {centro.verificado === false && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-normal">
                    Por verificar
                  </span>
                )}
              </div>
            )}

            {/* Badge de Alerta: Oportunidad Estancada (Pipeline Hygiene) */}
            {estancamiento.estancado && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  estancamiento.nivelRiesgo === 'critico'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
                title={`Atención: Esta oportunidad lleva ${estancamiento.dias} días en ${oportunidad.etapa} (umbral saludable: ${estancamiento.umbral}d). Requiere acción comercial.`}
              >
                <AlertTriangle size={10} className="shrink-0" />
                <span>{estancamiento.dias}d estancado</span>
              </span>
            )}

            {/* Tag Win Insight: Oportunidad de alto encaje estancada en Propuesta */}
            {winInsight.esWinInsight && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-[rgba(0,200,255,0.22)] to-[rgba(233,105,153,0.22)] text-[#00C8FF] border border-[rgba(0,200,255,0.5)] shadow-[0_0_10px_rgba(0,200,255,0.35)] shrink-0 animate-pulse"
                title={`Win Insight: ${winInsight.motivo}. ${winInsight.sugerenciaNudge}`}
              >
                <Sparkles size={10} className="text-[#00C8FF] shrink-0" />
                <span>Win Insight</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Anillo de encaje con texto "parecido con tu cliente ideal" */}
            <AnilloEncaje porcentaje={encaje.porcentaje} size={32} strokeWidth={3} />

            {/* Menú Mover a... para móvil y teclado */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuMoverAbierto(!menuMoverAbierto)}
                className="p-1 rounded text-[#B4B4C8] hover:text-[#00C8FF] hover:bg-[#1b1b22] transition-colors"
                title="Mover a otra etapa (teclado / móvil)"
              >
                <MoreVertical size={15} />
              </button>

              {menuMoverAbierto && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#0D0D14] border border-[rgba(0,200,255,0.4)] rounded-lg py-1.5 shadow-2xl z-40 text-xs">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#B4B4C8] border-b border-[rgba(255,255,255,0.06)]">
                    Mover a etapa:
                  </div>
                  {ETAPAS_ORDEN.map((et) => (
                    <button
                      key={et}
                      type="button"
                      disabled={oportunidad.etapa === et}
                      onClick={() => {
                        onMoverEtapa(oportunidad.id, et);
                        setMenuMoverAbierto(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                        oportunidad.etapa === et
                          ? 'text-[#6B6B80] bg-[#161622] cursor-not-allowed'
                          : 'text-[#F2F2F7] hover:bg-[rgba(0,200,255,0.12)] hover:text-[#00C8FF]'
                      }`}
                    >
                      <span>{et}</span>
                      {oportunidad.etapa === et ? (
                        <span className="text-[10px] text-[#00C8FF]">Actual</span>
                      ) : (
                        <ArrowRight size={11} className="opacity-60" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nombre del centro */}
        <h3 className="font-heading font-bold text-sm text-[#F2F2F7] group-hover:text-[#00C8FF] transition-colors line-clamp-1 mb-1">
          {centro?.nombre || 'Centro educativo'}
        </h3>

        {/* Contacto principal */}
        {contacto ? (
          <div className="flex items-center gap-1.5 text-xs text-[#B4B4C8] mb-2 truncate">
            <User size={13} className="text-[#00C8FF] flex-shrink-0" />
            <span className="truncate">{contacto.nombre}</span>
            <span className="text-[10px] opacity-70">({contacto.cargo})</span>
          </div>
        ) : (
          <p className="text-xs text-[#B4B4C8] mb-2 truncate">
            {centro?.provincia || 'Sin contacto asignado'}
          </p>
        )}

        {/* Dolor principal chip sutil */}
        {oportunidad.dolor && (
          <div className="text-[10px] text-[#B4B4C8] bg-[#000000]/50 border border-[rgba(255,255,255,0.05)] rounded px-2 py-0.5 inline-block max-w-full truncate mb-2">
            Dolor: {oportunidad.dolor}
          </div>
        )}

        {/* Indicador de Probabilidad de Cierre Dinámica */}
        {criterioOrden === 'probabilidad' && (
          <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg bg-[rgba(0,200,255,0.08)] border border-[rgba(0,200,255,0.35)] shadow-[0_0_10px_rgba(0,200,255,0.15)] mb-2">
            <span className="text-[#B4B4C8] flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider">
              <Target size={11} className="text-[#00C8FF]" /> Prob. Cierre Dinámica
            </span>
            <span
              className={`font-mono font-bold text-xs ${
                probCierre >= 70
                  ? 'text-emerald-400'
                  : probCierre >= 45
                  ? 'text-[#00C8FF]'
                  : 'text-amber-400'
              }`}
            >
              {probCierre}%
            </span>
          </div>
        )}

        {/* Indicador de Urgencia del Próximo Paso */}
        {criterioOrden === 'urgencia' && (
          <div
            className={`flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg mb-2 border ${
              urgenciaInfo.nivel === 'vencido'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)] animate-pulse'
                : urgenciaInfo.nivel === 'hoy'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : urgenciaInfo.nivel === 'urgente'
                ? 'bg-[rgba(0,200,255,0.12)] border-[rgba(0,200,255,0.35)] text-[#00C8FF]'
                : urgenciaInfo.nivel === 'sin_fecha'
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                : 'bg-[#161622] border-[rgba(255,255,255,0.08)] text-[#B4B4C8]'
            }`}
          >
            <span className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider">
              <Clock size={11} /> Urgencia:
            </span>
            <span className="font-bold text-xs font-mono">
              {urgenciaInfo.etiqueta}
            </span>
          </div>
        )}

        {/* Próximo paso si existe */}
        {oportunidad.proximoPaso?.accion && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#00C8FF] bg-[#000000]/60 border border-[rgba(0,200,255,0.15)] rounded px-2 py-1 mb-2 truncate">
            <Calendar size={11} className="text-[#00C8FF] flex-shrink-0" />
            <span className="truncate flex-1 text-[#F2F2F7]">{oportunidad.proximoPaso.accion}</span>
            <span className="font-mono text-[9px] text-[#B4B4C8] flex-shrink-0">
              {formatearFecha(oportunidad.proximoPaso.fecha)}
            </span>
          </div>
        )}

        {/* Nudge Proactivo Win Insight: Recomendación de acción para desatascar propuesta de alto encaje */}
        {winInsight.esWinInsight && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAbrirFicha(oportunidad.id);
            }}
            className="mb-2 p-2 rounded-lg bg-[rgba(0,200,255,0.08)] hover:bg-[rgba(0,200,255,0.15)] border border-[rgba(0,200,255,0.35)] shadow-[0_0_12px_rgba(0,200,255,0.15)] transition-all flex items-center justify-between gap-2 group/nudge cursor-pointer"
            title={`${winInsight.motivo}. Haz clic para dar un empujón comercial.`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-[rgba(0,200,255,0.2)] flex items-center justify-center shrink-0 text-[#00C8FF] shadow-[0_0_6px_rgba(0,200,255,0.4)]">
                <Zap size={11} className="fill-[#00C8FF]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-[#00C8FF] uppercase tracking-wider">
                    Win Insight
                  </span>
                  <span className="text-[9px] text-[#E96999] font-mono font-bold">
                    {winInsight.encajePorcentaje}% encaje
                  </span>
                </div>
                <p className="text-[10px] text-[#F2F2F7] truncate leading-tight">
                  {winInsight.sugerenciaNudge}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAbrirFicha(oportunidad.id);
              }}
              className="px-2 py-1 rounded bg-[#00C8FF] hover:bg-[#68D3FF] text-[#000000] font-bold text-[10px] shrink-0 shadow transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Abrir ficha para enviar plantilla de propuesta o agendar llamada"
            >
              <span>Empujón</span>
              <ArrowRight size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Pie de tarjeta: Valor en € y Días en esta etapa en gris claro sin colores de alarma */}
      <div className="pt-2 mt-1 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs">
        <span className="font-mono font-bold text-sm text-[#F2F2F7]">
          {formatearEuros(oportunidad.valor)}
        </span>
        <span className="text-[#B4B4C8] text-[11px] font-normal" title="Días transcurridos en la etapa actual">
          {diasEnEtapa === 0 ? 'Hoy' : `${diasEnEtapa} días en esta etapa`}
        </span>
      </div>
    </div>
  );
};
