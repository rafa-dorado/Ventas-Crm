import React, { useMemo, useState } from 'react';
import { EstadoCRM, EtapaOportunidad, Oportunidad, TipoCentro } from '../../types';
import { crmRepo } from '../../repo';
import {
  calcularDiasEnEtapa,
  calcularEncajeICP,
  COLORES_TIPO_CENTRO,
  ETAPAS_ORDEN,
  evaluarEstancamientoOportunidad,
  formatearEuros,
  formatearFecha,
  UMBRALES_ESTANCAMIENTO_DIAS,
} from '../../utils/crmHelpers';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Edit3,
  Flame,
  HelpCircle,
  Layers,
  LineChart,
  PieChart,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';

interface PanelViewProps {
  estado: EstadoCRM;
  onAbrirFicha: (opId: string) => void;
}

export const PanelView: React.FC<PanelViewProps> = ({ estado, onAbrirFicha }) => {
  const [objetivoEditando, setObjetivoEditando] = useState<boolean>(false);
  const [objetivoInput, setObjetivoInput] = useState<number>(estado.config.objetivoVentas || 100000);

  // Progreso dinámico hacia el objetivo anual calculado desde repo.ts a partir de oportunidades cerradas con éxito
  const progresoAnual = useMemo(() => {
    return crmRepo.calcularProgresoObjetivoAnual();
  }, [estado]);

  // Cálculos métricos principales
  const abiertas = useMemo(
    () => estado.oportunidades.filter((o) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido'),
    [estado.oportunidades]
  );
  const ganadas = useMemo(
    () => estado.oportunidades.filter((o) => o.etapa === 'Ganado'),
    [estado.oportunidades]
  );
  const perdidas = useMemo(
    () => estado.oportunidades.filter((o) => o.etapa === 'Perdido'),
    [estado.oportunidades]
  );

  const valorEmbudoAbierto = abiertas.reduce((acc, o) => acc + (o.valor || 0), 0);
  const valorGanado = ganadas.reduce((acc, o) => acc + (o.valor || 0), 0);

  // Previsión ponderada: suma(valor * (probabilidad[etapa] / 100))
  const previsionPonderada = useMemo(() => {
    return abiertas.reduce((acc, o) => {
      const prob = estado.config.probabilidades[o.etapa] ?? 20;
      return acc + (o.valor || 0) * (prob / 100);
    }, 0);
  }, [abiertas, estado.config.probabilidades]);

  // Encaje medio de todas las oportunidades con criterios evaluados
  const encajeMedio = useMemo(() => {
    let suma = 0;
    let count = 0;
    estado.oportunidades.forEach((o) => {
      const enc = calcularEncajeICP(o.criterios, estado.config.pesosICP).porcentaje;
      if (enc !== null) {
        suma += enc;
        count++;
      }
    });
    return count > 0 ? Math.round(suma / count) : 0;
  }, [estado.oportunidades, estado.config.pesosICP]);

  // Win rate: ganados / (ganados + perdidos)
  const totalCerrados = ganadas.length + perdidas.length;
  const winRate = totalCerrados > 0 ? Math.round((ganadas.length / totalCerrados) * 100) : null;

  // Ticket medio de ganados
  const ticketMedio = ganadas.length > 0 ? Math.round(valorGanado / ganadas.length) : null;

  // Ciclo de venta medio (días entre creadoEn y cerradoEn de ganados)
  const cicloMedio = useMemo(() => {
    if (ganadas.length === 0) return null;
    let totalDias = 0;
    let validos = 0;
    ganadas.forEach((g) => {
      if (g.creadoEn && g.cerradoEn) {
        const diffMs = new Date(g.cerradoEn).getTime() - new Date(g.creadoEn).getTime();
        const dias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        totalDias += dias;
        validos++;
      }
    });
    return validos > 0 ? Math.round(totalDias / validos) : null;
  }, [ganadas]);

  // Velocity: (abiertas * (winRate/100) * ticketMedio) / cicloMedio (€/día)
  const velocity = useMemo(() => {
    if (winRate === null || ticketMedio === null || cicloMedio === null || cicloMedio === 0) {
      return null;
    }
    const val = (abiertas.length * (winRate / 100) * ticketMedio) / cicloMedio;
    return Math.round(val);
  }, [abiertas.length, winRate, ticketMedio, cicloMedio]);

  // XP de los últimos 7 días
  const xpHoyUltimos7Dias = useMemo(() => {
    const sieteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return estado.juego.historialXP
      .filter((h) => new Date(h.fecha).getTime() >= sieteDiasAtras)
      .reduce((sum, h) => sum + (h.xp || 0), 0);
  }, [estado.juego.historialXP]);

  // Embudo: Oportunidades que han llegado al menos a cada etapa
  const embudoData = useMemo(() => {
    return ETAPAS_ORDEN.map((et, idx) => {
      const alcanzaron = estado.oportunidades.filter((o) =>
        o.historialEtapas?.some((h) => h.etapa === et)
      ).length;
      return { etapa: et, count: alcanzaron };
    });
  }, [estado.oportunidades]);

  // Scatter plot: Valor vs Encaje
  const scatterPuntos = useMemo(() => {
    return estado.oportunidades.map((op) => {
      const enc = calcularEncajeICP(op.criterios, estado.config.pesosICP).porcentaje || 0;
      const centro = estado.centros.find((c) => c.id === op.centroId);
      return {
        id: op.id,
        nombre: centro?.nombre || 'Centro',
        valor: op.valor || 0,
        encaje: enc,
        etapa: op.etapa,
      };
    });
  }, [estado.oportunidades, estado.centros, estado.config.pesosICP]);

  // Misión sugerida: la oportunidad abierta con más encaje y más días sin avanzar
  const misionSugerida = useMemo(() => {
    if (abiertas.length === 0) return null;
    return [...abiertas].sort((a, b) => {
      const encA = calcularEncajeICP(a.criterios, estado.config.pesosICP).porcentaje || 0;
      const encB = calcularEncajeICP(b.criterios, estado.config.pesosICP).porcentaje || 0;
      const diasA = calcularDiasEnEtapa(a.historialEtapas);
      const diasB = calcularDiasEnEtapa(b.historialEtapas);
      // Ponderación de prioridad: encaje * días
      return encB * (diasB + 1) - encA * (diasA + 1);
    })[0];
  }, [abiertas, estado.config.pesosICP]);

  // Próximos seguimientos
  const proximosSeguimientos = useMemo(() => {
    return [...abiertas]
      .filter((o) => o.proximoPaso?.fecha)
      .sort((a, b) => new Date(a.proximoPaso.fecha).getTime() - new Date(b.proximoPaso.fecha).getTime())
      .slice(0, 5);
  }, [abiertas]);

  // Antigüedad en etapa actual: (0-15, 16-30, 31-60, +60)
  const antiguedadBuckets = useMemo(() => {
    const res = { '0-15': 0, '16-30': 0, '31-60': 0, '+60': 0 };
    abiertas.forEach((o) => {
      const d = calcularDiasEnEtapa(o.historialEtapas);
      if (d <= 15) res['0-15']++;
      else if (d <= 30) res['16-30']++;
      else if (d <= 60) res['31-60']++;
      else res['+60']++;
    });
    return res;
  }, [abiertas]);

  // Motivos de pérdida
  const motivosPerdidaConteo = useMemo(() => {
    const mapa: Record<string, number> = {
      precio: 0,
      momento: 0,
      competencia: 0,
      'no encaja': 0,
      'sin respuesta': 0,
      otro: 0,
    };
    perdidas.forEach((p) => {
      const mot = p.motivoPerdida || 'otro';
      mapa[mot] = (mapa[mot] || 0) + 1;
    });
    return mapa;
  }, [perdidas]);

  // Ganados por tipo de centro y producto
  const ganadosPorTipo = useMemo(() => {
    const mapa: Record<string, number> = {};
    ganadas.forEach((g) => {
      const c = estado.centros.find((item) => item.id === g.centroId);
      const t = c?.tipo || 'FP';
      mapa[t] = (mapa[t] || 0) + (g.valor || 0);
    });
    return mapa;
  }, [ganadas, estado.centros]);

  const ganadosPorProducto = useMemo(() => {
    const mapa: Record<string, number> = {};
    ganadas.forEach((g) => {
      const p = g.productoElegido || g.productoSugerido || 'Otro';
      mapa[p] = (mapa[p] || 0) + (g.valor || 0);
    });
    return mapa;
  }, [ganadas]);

  // Calendario de constancia (5 semanas = 35 días)
  const calendarioConstancia = useMemo(() => {
    const dias = [];
    const hoy = new Date();
    for (let i = 34; i >= 0; i--) {
      const f = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      const isoStr = f.toISOString().split('T')[0];
      // Contar actividades en ese día
      let actCount = 0;
      estado.oportunidades.forEach((o) => {
        (o.actividades || []).forEach((a) => {
          if (a.fecha?.startsWith(isoStr)) actCount++;
        });
      });
      dias.push({ fecha: isoStr, count: actCount });
    }
    return dias;
  }, [estado.oportunidades]);

  // Línea de XP acumulado de 14 días
  const xpUltimos14Dias = useMemo(() => {
    const puntos = [];
    const hoy = new Date();
    let acumulado = 0;
    for (let i = 13; i >= 0; i--) {
      const f = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      const isoStr = f.toISOString().split('T')[0];
      const xpDia = estado.juego.historialXP
        .filter((h) => h.fecha?.startsWith(isoStr))
        .reduce((sum, h) => sum + (h.xp || 0), 0);
      acumulado += xpDia;
      puntos.push({ fecha: isoStr.slice(5), diaXP: xpDia, acumulado });
    }
    return puntos;
  }, [estado.juego.historialXP]);

  // Guardar nuevo objetivo
  const handleGuardarObjetivo = () => {
    crmRepo.actualizarConfig({ objetivoVentas: Number(objetivoInput) || 100000 });
    setObjetivoEditando(false);
  };

  const objetivo = estado.config.objetivoVentas || 100000;
  const pctGanado = Math.min(100, Math.round((valorGanado / objetivo) * 100));
  const pctPrevision = Math.min(
    100 - pctGanado,
    Math.round((previsionPonderada / objetivo) * 100)
  );
  const restante = Math.max(0, objetivo - valorGanado - previsionPonderada);

  // Salud del Embudo (Pipeline Hygiene & Aging)
  const metricasSalud = useMemo(() => {
    let saludablesCount = 0;
    let alertasCount = 0;
    let criticasCount = 0;
    let valorEnRiesgo = 0;
    const estancadasLista: Array<{
      op: Oportunidad;
      centroNombre: string;
      centroTipo: TipoCentro;
      dias: number;
      umbral: number;
      nivelRiesgo: 'normal' | 'alerta' | 'critico';
      valor: number;
    }> = [];

    abiertas.forEach((op) => {
      const evalEst = evaluarEstancamientoOportunidad(op.historialEtapas, op.etapa);
      const centro = estado.centros.find((c) => c.id === op.centroId);
      if (evalEst.nivelRiesgo === 'critico') {
        criticasCount++;
        valorEnRiesgo += op.valor || 0;
        estancadasLista.push({
          op,
          centroNombre: centro?.nombre || 'Centro',
          centroTipo: centro?.tipo || 'FP',
          dias: evalEst.dias,
          umbral: evalEst.umbral,
          nivelRiesgo: 'critico',
          valor: op.valor || 0,
        });
      } else if (evalEst.nivelRiesgo === 'alerta') {
        alertasCount++;
        valorEnRiesgo += op.valor || 0;
        estancadasLista.push({
          op,
          centroNombre: centro?.nombre || 'Centro',
          centroTipo: centro?.tipo || 'FP',
          dias: evalEst.dias,
          umbral: evalEst.umbral,
          nivelRiesgo: 'alerta',
          valor: op.valor || 0,
        });
      } else {
        saludablesCount++;
      }
    });

    // Ordenar estancadas por días de exceso sobre su umbral
    estancadasLista.sort((a, b) => (b.dias - b.umbral) - (a.dias - a.umbral));

    const pctSaludable = abiertas.length > 0 ? Math.round((saludablesCount / abiertas.length) * 100) : 100;

    return {
      saludablesCount,
      alertasCount,
      criticasCount,
      totalEstancadas: alertasCount + criticasCount,
      valorEnRiesgo,
      pctSaludable,
      estancadasLista,
    };
  }, [abiertas, estado.centros]);

  // Análisis de Cohortes por Segmento Educativo
  const cohortesSegmentos = useMemo(() => {
    const tipos: TipoCentro[] = ['FP', 'Privado', 'Concertado', 'Universidad', 'Publico', 'Editorial', 'Institucional'];

    return tipos.map((tipo) => {
      const opsSegmento = estado.oportunidades.filter((o) => {
        const c = estado.centros.find((item) => item.id === o.centroId);
        return (c?.tipo || 'FP') === tipo;
      });

      const abiertasSeg = opsSegmento.filter((o) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido');
      const ganadasSeg = opsSegmento.filter((o) => o.etapa === 'Ganado');
      const perdidasSeg = opsSegmento.filter((o) => o.etapa === 'Perdido');
      const cerradasTotal = ganadasSeg.length + perdidasSeg.length;

      const valorPipeline = abiertasSeg.reduce((sum, o) => sum + (o.valor || 0), 0);
      const valorGanadoSeg = ganadasSeg.reduce((sum, o) => sum + (o.valor || 0), 0);
      const winRateSeg = cerradasTotal > 0 ? Math.round((ganadasSeg.length / cerradasTotal) * 100) : null;
      const ticketMedioSeg = ganadasSeg.length > 0
        ? Math.round(valorGanadoSeg / ganadasSeg.length)
        : (opsSegmento.length > 0 ? Math.round(opsSegmento.reduce((s, o) => s + (o.valor || 0), 0) / opsSegmento.length) : 0);

      // Ciclo medio en días
      let diasTotal = 0;
      let conDias = 0;
      ganadasSeg.forEach((g) => {
        if (g.creadoEn && g.cerradoEn) {
          const d = Math.max(1, Math.round((new Date(g.cerradoEn).getTime() - new Date(g.creadoEn).getTime()) / (1000 * 60 * 60 * 24)));
          diasTotal += d;
          conDias++;
        }
      });
      const cicloMedioSeg = conDias > 0 ? Math.round(diasTotal / conDias) : null;

      // Encaje medio
      let encajeSuma = 0;
      let encajeCount = 0;
      opsSegmento.forEach((o) => {
        const enc = calcularEncajeICP(o.criterios, estado.config.pesosICP).porcentaje;
        if (enc !== null) {
          encajeSuma += enc;
          encajeCount++;
        }
      });
      const encajeMedioSeg = encajeCount > 0 ? Math.round(encajeSuma / encajeCount) : 0;

      // Diagnóstico del cuello de botella
      let cuelloBotella = 'Fluido';
      if (opsSegmento.length === 0) {
        cuelloBotella = 'Sin actividad';
      } else {
        const estancadasEnSeg = abiertasSeg.filter((o) => evaluarEstancamientoOportunidad(o.historialEtapas, o.etapa).estancado);
        if (estancadasEnSeg.length > 0) {
          const etapasEstancadas = estancadasEnSeg.map((o) => o.etapa);
          const cuentaEtapas: Record<string, number> = {};
          etapasEstancadas.forEach((et) => {
            cuentaEtapas[et] = (cuentaEtapas[et] || 0) + 1;
          });
          const peorEtapa = Object.entries(cuentaEtapas).sort((a, b) => b[1] - a[1])[0][0];
          cuelloBotella = `Atasco en ${peorEtapa} (${cuentaEtapas[peorEtapa]} ops)`;
        } else if (perdidasSeg.length > ganadasSeg.length && cerradasTotal >= 2) {
          cuelloBotella = 'Fuga en negociación final';
        } else if (abiertasSeg.length > 0 && ganadasSeg.length === 0) {
          cuelloBotella = 'En maduración inicial';
        } else {
          cuelloBotella = 'Conversión óptima';
        }
      }

      return {
        tipo,
        totalCentros: opsSegmento.length,
        abiertasCount: abiertasSeg.length,
        ganadasCount: ganadasSeg.length,
        perdidasCount: perdidasSeg.length,
        valorPipeline,
        valorGanado: valorGanadoSeg,
        winRate: winRateSeg,
        ticketMedio: ticketMedioSeg,
        cicloMedio: cicloMedioSeg,
        encajeMedio: encajeMedioSeg,
        cuelloBotella,
      };
    });
  }, [estado.oportunidades, estado.centros, estado.config.pesosICP]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. SECCIÓN: MISIÓN SUGERIDA Y PRÓXIMOS SEGUIMIENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Misión sugerida */}
        <div className="lg:col-span-1 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.35)] shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,rgba(233,105,153,0.15),transparent_70%)] pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#E96999] flex items-center gap-1.5">
                <Sparkles size={14} /> Misión Sugerida
              </span>
              <span className="text-[10px] text-[#B4B4C8]">Mayor encaje + días</span>
            </div>

            {misionSugerida ? (
              <>
                <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
                  {estado.centros.find((c) => c.id === misionSugerida.centroId)?.nombre}
                </h3>
                <div className="mt-2 space-y-1 text-xs text-[#B4B4C8]">
                  <p>
                    <strong className="text-[#F2F2F7]">Etapa:</strong> {misionSugerida.etapa} ·{' '}
                    <strong className="text-[#00C8FF]">Valor:</strong>{' '}
                    {formatearEuros(misionSugerida.valor)}
                  </p>
                  <p>
                    <strong className="text-[#F2F2F7]">Tiempo en etapa:</strong>{' '}
                    {calcularDiasEnEtapa(misionSugerida.historialEtapas)} días
                  </p>
                  <p className="text-[11px] italic text-[#9A9AB0] mt-1">
                    Próximo paso: {misionSugerida.proximoPaso.accion}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#B4B4C8] py-4">No hay oportunidades abiertas actualmente.</p>
            )}
          </div>

          {misionSugerida && (
            <button
              onClick={() => onAbrirFicha(misionSugerida.id)}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow transition-all active:scale-95 text-center"
            >
              Abrir ficha y desatascar
            </button>
          )}
        </div>

        {/* Próximos Seguimientos */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF] flex items-center gap-1.5">
                <Clock size={14} /> Próximos Seguimientos
              </span>
              <span className="text-[11px] text-[#B4B4C8]">Ordenados por fecha programada</span>
            </div>

            <div className="space-y-2 text-xs">
              {proximosSeguimientos.map((op) => {
                const centro = estado.centros.find((c) => c.id === op.centroId);
                return (
                  <div
                    key={op.id}
                    onClick={() => onAbrirFicha(op.id)}
                    className="p-2.5 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(0,200,255,0.4)] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F2F2F7] truncate">{centro?.nombre}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#161622] text-[#00C8FF] font-mono">
                          {op.etapa}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#B4B4C8] truncate">{op.proximoPaso.accion}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono font-bold text-[#F2F2F7]">
                        {formatearFecha(op.proximoPaso.fecha)}
                      </div>
                      <div className="text-[10px] text-[#00C8FF] font-mono">
                        {formatearEuros(op.valor)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {proximosSeguimientos.length === 0 && (
                <p className="text-xs text-[#B4B4C8] py-4 text-center">
                  No hay seguimientos fechados pendientes.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE CIFRAS PRINCIPALES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Abiertas */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Abiertas
          </span>
          <span className="font-heading font-bold text-2xl text-[#F2F2F7]">
            {abiertas.length}
          </span>
          <span className="text-[11px] text-[#00C8FF] block mt-0.5 font-mono">
            {formatearEuros(valorEmbudoAbierto)}
          </span>
        </div>

        {/* Previsión Ponderada */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Previsión Ponderada
          </span>
          <span className="font-heading font-bold text-2xl text-[#00C8FF]">
            {formatearEuros(previsionPonderada)}
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            Valor × Prob. etapa
          </span>
        </div>

        {/* Encaje Medio */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Encaje Medio ICP
          </span>
          <span className="font-heading font-bold text-2xl text-[#F2F2F7]">
            {encajeMedio}%
          </span>
          <span className="text-[11px] text-[#00C8FF] block mt-0.5">
            Parecido con cliente ideal
          </span>
        </div>

        {/* Win Rate */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Win Rate
          </span>
          <span className="font-heading font-bold text-2xl text-[#F2F2F7]">
            {winRate !== null ? `${winRate}%` : 'Aún sin datos'}
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            {ganadas.length} ganados / {totalCerrados} cerrados
          </span>
        </div>

        {/* Ticket Medio Ganados */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Ticket Medio
          </span>
          <span className="font-heading font-bold text-2xl text-[#F2F2F7]">
            {ticketMedio !== null ? formatearEuros(ticketMedio) : 'Aún sin datos'}
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            Promedio de ganados
          </span>
        </div>

        {/* Ciclo de Venta Medio */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Ciclo Medio
          </span>
          <span className="font-heading font-bold text-xl text-[#F2F2F7]">
            {cicloMedio !== null ? `${cicloMedio} días` : 'Aún sin datos'}
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            Creación a cierre
          </span>
        </div>

        {/* Sales Velocity */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)]">
          <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1">
            Sales Velocity
          </span>
          <span className="font-heading font-bold text-xl text-[#00C8FF]">
            {velocity !== null ? `${formatearEuros(velocity)}/día` : 'Aún sin datos'}
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            (Op × WinRate × Ticket) / Ciclo
          </span>
        </div>

        {/* XP Últimos 7 Días */}
        <div className="p-3.5 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.3)]">
          <span className="text-[10px] uppercase font-bold text-[#E96999] block mb-1">
            XP Últimos 7 Días
          </span>
          <span className="font-heading font-bold text-2xl text-[#E96999]">
            +{xpHoyUltimos7Dias} XP
          </span>
          <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
            Impulso comercial
          </span>
        </div>
      </div>

      {/* 3. WIDGET: PROGRESO HACIA EL OBJETIVO ANUAL */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] shadow-[0_0_25px_-5px_rgba(0,200,255,0.2)] space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,rgba(0,200,255,0.12),transparent_70%)] pointer-events-none" />

        {/* Cabecera del Widget */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,200,255,0.1)] border border-[rgba(0,200,255,0.3)] flex items-center justify-center text-[#00C8FF] shadow-[0_0_12px_rgba(0,200,255,0.25)]">
              <Target size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-bold text-base text-[#F2F2F7]">
                  Progreso hacia el objetivo anual
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.25)] font-bold">
                  Año {new Date().getFullYear()}
                </span>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.4)] shadow-[0_0_10px_rgba(0,200,255,0.2)] flex items-center gap-1">
                  <TrendingUp size={12} />
                  {progresoAnual.porcentajeGanado}% conseguido
                </span>
              </div>
              <p className="text-xs text-[#B4B4C8] mt-0.5">
                Calculado dinámicamente mediante repo.ts a partir de las oportunidades cerradas con éxito
              </p>
            </div>
          </div>

          {/* Editor de meta anual */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {objetivoEditando ? (
              <div className="flex items-center gap-2 bg-[#05050A] p-1 rounded-lg border border-[rgba(0,200,255,0.4)]">
                <input
                  type="number"
                  value={objetivoInput}
                  onChange={(e) => setObjetivoInput(Number(e.target.value))}
                  placeholder="Meta en €"
                  className="bg-transparent px-2 py-1 text-xs text-[#F2F2F7] w-28 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGuardarObjetivo}
                  className="px-3 py-1 text-xs font-bold rounded bg-[#00C8FF] text-[#000000] hover:bg-[#68D3FF] transition-colors"
                >
                  Guardar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setObjetivoInput(progresoAnual.objetivoTotal);
                  setObjetivoEditando(true);
                }}
                className="text-xs text-[#B4B4C8] hover:text-[#00C8FF] px-2.5 py-1 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)] transition-all flex items-center gap-1.5"
                title="Modificar el objetivo de ventas anual configurado en repo.ts"
              >
                <Edit3 size={12} />
                <span>Editar meta ({formatearEuros(progresoAnual.objetivoTotal)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner destacado: Porcentaje completado y cifra absoluta ganada frente al objetivo total */}
        <div className="p-4 rounded-xl bg-[#05050A] border border-[rgba(0,200,255,0.3)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#B4B4C8]">
              Porcentaje completado
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-heading font-bold text-3xl sm:text-4xl text-[#00C8FF] drop-shadow-[0_0_15px_rgba(0,200,255,0.4)]">
                {progresoAnual.porcentajeGanado}%
              </span>
              <span className="text-sm font-bold text-[#F2F2F7]">
                completado
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#B4B4C8]">
              Cifra absoluta ganada vs Objetivo total
            </span>
            <div className="flex flex-wrap items-center sm:justify-end gap-1.5 font-mono">
              <span className="text-lg sm:text-xl font-bold text-[#00C8FF]">
                {formatearEuros(progresoAnual.valorGanado)}
              </span>
              <span className="text-sm text-[#B4B4C8]">/</span>
              <span className="text-lg sm:text-xl font-bold text-[#F2F2F7]">
                {formatearEuros(progresoAnual.objetivoTotal)}
              </span>
            </div>
            <p className="text-[11px] text-[#B4B4C8]">
              {progresoAnual.oportunidadesGanadasCount} acuerdos cerrados con éxito · Restan {formatearEuros(progresoAnual.restante)} ({Math.max(0, 100 - progresoAnual.porcentajeGanado)}% pendiente)
            </p>
          </div>
        </div>

        {/* Cifras clave del progreso */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
          {/* 1. Ganado */}
          <div className="p-3.5 rounded-xl bg-[#05050A] border border-[rgba(0,200,255,0.25)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C8FF] block mb-1">
              Cerrado con éxito (Ganado)
            </span>
            <div className="font-heading font-bold text-xl sm:text-2xl text-[#F2F2F7]">
              {formatearEuros(progresoAnual.valorGanado)}
            </div>
            <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
              {progresoAnual.oportunidadesGanadasCount} acuerdos cerrados
            </span>
          </div>

          {/* 2. Objetivo total */}
          <div className="p-3.5 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.08)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B4B4C8] block mb-1">
              Objetivo total anual
            </span>
            <div className="font-heading font-bold text-xl sm:text-2xl text-[#F2F2F7]">
              {formatearEuros(progresoAnual.objetivoTotal)}
            </div>
            <span className="text-[11px] text-[#00C8FF] block mt-0.5">
              Meta configurada en el CRM
            </span>
          </div>

          {/* 3. Restante */}
          <div className="p-3.5 rounded-xl bg-[#05050A] border border-[rgba(233,105,153,0.25)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E96999] block mb-1">
              Restante por cubrir
            </span>
            <div className="font-heading font-bold text-xl sm:text-2xl text-[#E96999]">
              {formatearEuros(progresoAnual.restante)}
            </div>
            <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
              {Math.max(0, 100 - progresoAnual.porcentajeGanado)}% pendiente de cierre
            </span>
          </div>

          {/* 4. Ritmo mensual sugerido */}
          <div className="p-3.5 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.08)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B4B4C8] block mb-1">
              Ritmo mensual sugerido
            </span>
            <div className="font-heading font-bold text-xl sm:text-2xl text-[#F2F2F7]">
              {formatearEuros(progresoAnual.ritmoMensualSugerido)}
              <span className="text-xs font-normal text-[#B4B4C8]">/mes</span>
            </div>
            <span className="text-[11px] text-[#00C8FF] block mt-0.5">
              Para cumplir el objetivo anual
            </span>
          </div>
        </div>

        {/* Barra de progreso interactiva en color #00C8FF con marcas de hitos */}
        <div className="space-y-1.5 relative z-10">
          <div className="flex justify-between text-[10px] font-mono text-[#B4B4C8] px-1">
            <span>0%</span>
            <span>25% (Q1)</span>
            <span>50% (Q2)</span>
            <span>75% (Q3)</span>
            <span className="text-[#00C8FF] font-bold">100% (Meta Anual: {formatearEuros(progresoAnual.objetivoTotal)})</span>
          </div>

          <div
            className="w-full h-5 sm:h-6 bg-[#05050A] rounded-full overflow-hidden border border-[rgba(255,255,255,0.12)] p-0.5 relative flex"
            title={`Progreso ganado: ${progresoAnual.porcentajeGanado}% (${formatearEuros(progresoAnual.valorGanado)} de ${formatearEuros(progresoAnual.objetivoTotal)})`}
          >
            {/* Hitos visuales marcados en la barra */}
            <div className="absolute left-1/4 top-0 bottom-0 w-px bg-[rgba(255,255,255,0.15)] z-20 pointer-events-none" />
            <div className="absolute left-2/4 top-0 bottom-0 w-px bg-[rgba(255,255,255,0.15)] z-20 pointer-events-none" />
            <div className="absolute left-3/4 top-0 bottom-0 w-px bg-[rgba(255,255,255,0.15)] z-20 pointer-events-none" />

            {/* Segmento 1: Valor Ganado utilizando color #00C8FF */}
            <div
              className="h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2.5 font-mono text-[10px] font-bold text-[#000000] relative z-10 shrink-0"
              style={{
                width: `${progresoAnual.porcentajeGanado}%`,
                backgroundColor: '#00C8FF',
                boxShadow: '0 0 16px rgba(0, 200, 255, 0.6)',
              }}
            >
              {progresoAnual.porcentajeGanado >= 7 && `${progresoAnual.porcentajeGanado}%`}
            </div>

            {/* Segmento 2: Previsión ponderada en curso */}
            {progresoAnual.pctPrevision > 0 && (
              <div
                className="h-full transition-all duration-700 ease-out relative z-10 shrink-0 rounded-r-full"
                style={{
                  width: `${progresoAnual.pctPrevision}%`,
                  background: 'linear-gradient(90deg, #E96999 0%, #4802B1 100%)',
                  opacity: 0.8,
                }}
                title={`Previsión ponderada: ${formatearEuros(progresoAnual.previsionPonderada)} (+${progresoAnual.pctPrevision}%)`}
              />
            )}
          </div>
        </div>

        {/* Leyenda y balance final */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#B4B4C8] pt-1 border-t border-[rgba(255,255,255,0.06)] relative z-10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C8FF] shadow-[0_0_6px_#00C8FF]" />
              <span className="text-[#F2F2F7]">
                Ganado: <strong>{formatearEuros(progresoAnual.valorGanado)}</strong> ({progresoAnual.porcentajeGanado}%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E96999]" />
              <span>
                Previsión ponderada: <strong>{formatearEuros(progresoAnual.previsionPonderada)}</strong> ({progresoAnual.pctPrevision}%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#393840]" />
              <span>
                Falta por cubrir: <strong>{formatearEuros(progresoAnual.restante)}</strong>
              </span>
            </div>
          </div>

          <div className="text-[11px] font-medium text-[#00C8FF] flex items-center gap-1">
            <CheckCircle2 size={13} className="text-[#00C8FF]" />
            <span>
              {progresoAnual.porcentajeGanado >= 100
                ? '¡Objetivo anual completado!'
                : `${progresoAnual.porcentajeGanado}% conseguido · Restan ${formatearEuros(progresoAnual.restante)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3B. SECCIÓN: SALUD DEL EMBUDO Y ALERTAS DE ESTANCAMIENTO (PIPELINE HYGIENE) */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.3)] shadow-[0_0_20px_-5px_rgba(233,105,153,0.15)] space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(233,105,153,0.12)] border border-[rgba(233,105,153,0.35)] flex items-center justify-center text-[#E96999] shadow-[0_0_12px_rgba(233,105,153,0.25)]">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-[#F2F2F7]">
                  Salud del Embudo y Control de Estancamiento
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  metricasSalud.totalEstancadas === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                }`}>
                  {metricasSalud.totalEstancadas === 0 ? 'Embudo 100% Sano' : `${metricasSalud.totalEstancadas} estancadas`}
                </span>
              </div>
              <p className="text-xs text-[#B4B4C8] mt-0.5">
                Detección proactiva de oportunidades que superan los umbrales máximos por etapa (Detectado: 7d, Demo: 10d, Piloto: 14d, Propuesta: 12d)
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block">Valor en Riesgo</span>
            <span className="font-heading font-bold text-xl text-[#E96999] font-mono">
              {formatearEuros(metricasSalud.valorEnRiesgo)}
            </span>
          </div>
        </div>

        {/* Indicadores de salud */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.08)]">
            <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" /> Tasa de Salud
            </span>
            <span className="font-heading font-bold text-2xl text-[#00C8FF]">
              {metricasSalud.pctSaludable}%
            </span>
            <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
              {metricasSalud.saludablesCount} de {abiertas.length} a buen ritmo
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(245,158,11,0.25)]">
            <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Alerta Leve
            </span>
            <span className="font-heading font-bold text-2xl text-amber-400">
              {metricasSalud.alertasCount}
            </span>
            <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
              Superan el umbral estándar
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(239,68,68,0.3)]">
            <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1 flex items-center gap-1">
              <Flame size={12} /> Riesgo Crítico
            </span>
            <span className="font-heading font-bold text-2xl text-rose-400">
              {metricasSalud.criticasCount}
            </span>
            <span className="text-[11px] text-[#B4B4C8] block mt-0.5">
              &gt;1.5x días del umbral
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.08)]">
            <span className="text-[10px] uppercase font-bold text-[#B4B4C8] block mb-1 flex items-center gap-1">
              <Clock size={12} className="text-[#00C8FF]" /> Pipeline Activo
            </span>
            <span className="font-heading font-bold text-2xl text-[#F2F2F7]">
              {abiertas.length}
            </span>
            <span className="text-[11px] text-[#00C8FF] block mt-0.5 font-mono">
              {formatearEuros(valorEmbudoAbierto)}
            </span>
          </div>
        </div>

        {/* Tabla de acuerdos estancados que requieren intervención */}
        {metricasSalud.estancadasLista.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#B4B4C8] px-1">
              <span>Oportunidades estancadas que requieren acción inmediata</span>
              <span className="text-[11px] text-[#E96999]">{metricasSalud.estancadasLista.length} casos priorizados</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {metricasSalud.estancadasLista.map((item) => {
                const colorTipo = COLORES_TIPO_CENTRO[item.centroTipo] || { bg: '#161622', text: '#F2F2F7', border: '#393840' };
                const excesoDias = item.dias - item.umbral;
                return (
                  <div
                    key={item.op.id}
                    className="p-3 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(233,105,153,0.5)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                        style={{
                          backgroundColor: colorTipo.bg,
                          color: colorTipo.text,
                          border: `1px solid ${colorTipo.border}`,
                        }}
                      >
                        {item.centroTipo}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#F2F2F7] truncate">{item.centroNombre}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#161622] text-[#00C8FF]">
                            {item.op.etapa}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#B4B4C8] truncate">
                          {item.op.proximoPaso?.accion || 'Sin próximo paso definido'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.nivelRiesgo === 'critico'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            +{excesoDias}d retraso
                          </span>
                          <span className="text-xs font-mono font-bold text-[#F2F2F7]">
                            {item.dias}d en etapa
                          </span>
                        </div>
                        <span className="text-[10px] text-[#00C8FF] font-mono">
                          {formatearEuros(item.valor)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAbrirFicha(item.op.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#E96999] hover:bg-[#ff80b3] text-[#0D0D14] text-xs font-bold transition-all active:scale-95 shadow flex items-center gap-1 shrink-0"
                      >
                        <Zap size={13} />
                        <span>Desatascar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#05050A] border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Excelente higiene comercial: ninguna de las {abiertas.length} oportunidades activas excede los umbrales máximos establecidos.</span>
          </div>
        )}
      </div>

      {/* 3C. SECCIÓN: ANÁLISIS DE COHORTES Y CUELLOS DE BOTELLA POR SEGMENTO */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.3)] shadow-[0_0_20px_-5px_rgba(0,200,255,0.15)] space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(0,200,255,0.1)] border border-[rgba(0,200,255,0.3)] flex items-center justify-center text-[#00C8FF] shadow-[0_0_12px_rgba(0,200,255,0.25)]">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-[#F2F2F7]">
                  Análisis de Cohortes y Cuellos de Botella por Segmento
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.25)] font-bold">
                  Diagnóstico Estratégico
                </span>
              </div>
              <p className="text-xs text-[#B4B4C8] mt-0.5">
                Rendimiento comparativo, ratio de cierre, ticket medio y detección de atascos según la tipología de centro educativo
              </p>
            </div>
          </div>
        </div>

        {/* Tabla comparativa de cohortes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#B4B4C8] text-[10px] uppercase tracking-wider">
                <th className="pb-2.5 font-bold">Segmento</th>
                <th className="pb-2.5 font-bold text-center">Centros</th>
                <th className="pb-2.5 font-bold text-right">Pipeline Abierto</th>
                <th className="pb-2.5 font-bold text-center">Win Rate</th>
                <th className="pb-2.5 font-bold text-right">Ticket Medio</th>
                <th className="pb-2.5 font-bold text-center">Ciclo Venta</th>
                <th className="pb-2.5 font-bold text-center">Encaje ICP</th>
                <th className="pb-2.5 font-bold">Diagnóstico / Cuello de Botella</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {cohortesSegmentos.map((coh) => {
                const color = COLORES_TIPO_CENTRO[coh.tipo] || { bg: '#161622', text: '#F2F2F7', border: '#393840' };
                return (
                  <tr key={coh.tipo} className="hover:bg-[#05050A]/70 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: color.bg,
                            color: color.text,
                            border: `1px solid ${color.border}`,
                          }}
                        >
                          {coh.tipo}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-[#F2F2F7]">
                      {coh.totalCentros}
                      <span className="text-[10px] text-[#B4B4C8] block font-normal">
                        ({coh.abiertasCount} act / {coh.ganadasCount} gan)
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-[#00C8FF]">
                      {formatearEuros(coh.valorPipeline)}
                    </td>
                    <td className="py-3 text-center">
                      {coh.winRate !== null ? (
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            coh.winRate >= 50
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : coh.winRate >= 30
                              ? 'bg-[#00C8FF]/15 text-[#00C8FF] border border-[#00C8FF]/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {coh.winRate}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#6B6B80]">Sin cierres</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-[#F2F2F7]">
                      {coh.ticketMedio > 0 ? formatearEuros(coh.ticketMedio) : '—'}
                    </td>
                    <td className="py-3 text-center font-mono text-[#B4B4C8]">
                      {coh.cicloMedio ? `${coh.cicloMedio}d` : '—'}
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-[#00C8FF]">
                      {coh.encajeMedio}%
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full inline-block ${
                          coh.cuelloBotella.includes('Atasco')
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold'
                            : coh.cuelloBotella.includes('Conversión')
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                            : 'bg-[#161622] text-[#B4B4C8] border border-[rgba(255,255,255,0.08)]'
                        }`}
                      >
                        {coh.cuelloBotella}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Insights accionables para el equipo comercial */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(0,200,255,0.2)]">
            <span className="text-[11px] font-bold text-[#00C8FF] flex items-center gap-1.5 mb-1">
              <Zap size={13} /> Velocidad en FP y Privados
            </span>
            <p className="text-[11px] text-[#B4B4C8] leading-relaxed">
              Presentan el ciclo más corto de decisión al disponer de presupuestos descentralizados. Priorizar contacto con Jefatura de Estudios o Coordinador TIC.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(233,105,153,0.2)]">
            <span className="text-[11px] font-bold text-[#E96999] flex items-center gap-1.5 mb-1">
              <Layers size={13} /> Palanca de Red en Concertados
            </span>
            <p className="text-[11px] text-[#B4B4C8] leading-relaxed">
              Los centros concertados se estancan si se negocia de forma aislada. Activar propuesta conjunta con la dirección del grupo o patronato para acelerar el piloto.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.1)]">
            <span className="text-[11px] font-bold text-[#F2F2F7] flex items-center gap-1.5 mb-1">
              <Award size={13} /> Justificación de Fondos y LOMLOE
            </span>
            <p className="text-[11px] text-[#B4B4C8] leading-relaxed">
              En Universidades y centros con fondos europeos, estructurar el presupuesto en fases con métricas de impacto pedagógico asegura la firma inmediata del presupuesto.
            </p>
          </div>
        </div>
      </div>

      {/* 4. GRÁFICOS: SCATTER PLOT (VALOR VS ENCAJE) & EMBUDO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scatter Plot: Valor (Y) vs Encaje (X) */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
                Valor (€) vs Encaje ICP (%)
              </span>
              <span className="text-[11px] text-[#B4B4C8]">Pulsa un punto para abrir ficha</span>
            </div>

            {/* SVG Scatter Plot */}
            <div className="relative w-full h-56 bg-[#000000]/70 rounded-lg border border-[rgba(255,255,255,0.06)] p-2">
              {/* Zona Prioriza arriba a la derecha */}
              <div className="absolute top-2 right-2 w-28 h-20 bg-[rgba(0,200,255,0.08)] border border-dashed border-[rgba(0,200,255,0.3)] rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C8FF]">
                  ★ Prioriza
                </span>
              </div>

              <svg viewBox="0 0 320 200" className="w-full h-full overflow-visible">
                {/* Ejes */}
                <line x1="30" y1="170" x2="310" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <line x1="30" y1="10" x2="30" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

                {/* Etiquetas de Ejes */}
                <text x="305" y="185" fill="#B4B4C8" fontSize="9" textAnchor="end">Encaje (%)</text>
                <text x="35" y="15" fill="#B4B4C8" fontSize="9">Valor (€)</text>

                {/* Puntos */}
                {scatterPuntos.map((pt) => {
                  const maxValor = 50000;
                  const x = 30 + (pt.encaje / 100) * 270;
                  const y = 170 - (Math.min(pt.valor, maxValor) / maxValor) * 150;

                  let color = '#00C8FF';
                  if (pt.etapa === 'Ganado') color = '#00C8FF';
                  else if (pt.etapa === 'Piloto' || pt.etapa === 'Propuesta') color = '#E96999';
                  else if (pt.etapa === 'Perdido') color = '#6B6B80';

                  return (
                    <g
                      key={pt.id}
                      onClick={() => onAbrirFicha(pt.id)}
                      className="cursor-pointer group"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill={color}
                        stroke="#0D0D14"
                        strokeWidth="1.5"
                        className="transition-transform group-hover:scale-125"
                      />
                      <title>{`${pt.nombre}: ${formatearEuros(pt.valor)} (${pt.encaje}% encaje)`}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Embudo de ventas (Funnel) */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
                Embudo de Conversión
              </span>
              <span className="text-[11px] text-[#B4B4C8]">Llegaron al menos a cada etapa</span>
            </div>

            <div className="space-y-2 text-xs pt-1">
              {embudoData.map((item, idx) => {
                const prevCount = idx > 0 ? embudoData[idx - 1].count : item.count;
                const conversion = prevCount > 0 ? Math.round((item.count / prevCount) * 100) : 0;
                const pctMax = embudoData[0].count > 0 ? (item.count / embudoData[0].count) * 100 : 0;

                return (
                  <div key={item.etapa} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#F2F2F7]">{item.etapa}</span>
                      <div className="flex items-center gap-2">
                        {idx > 0 && (
                          <span className="text-[#00C8FF] text-[10px] font-mono">
                            {conversion}% conv.
                          </span>
                        )}
                        <span className="font-mono font-bold text-[#F2F2F7]">{item.count}</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-[#05050A] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(5, pctMax)}%`,
                          background: 'linear-gradient(90deg, #00C8FF 0%, #E96999 100%)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. ANTIGÜEDAD EN ETAPA & MOTIVOS DE PÉRDIDA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Antigüedad en etapa actual */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
              Antigüedad en Etapa Actual
            </span>
            <span className="text-[11px] text-[#B4B4C8]">Días en el estado (tonos neutros)</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: '0-15 días', val: antiguedadBuckets['0-15'] },
              { label: '16-30 días', val: antiguedadBuckets['16-30'] },
              { label: '31-60 días', val: antiguedadBuckets['31-60'] },
              { label: '+60 días', val: antiguedadBuckets['+60'] },
            ].map((b) => (
              <div
                key={b.label}
                className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.08)]"
              >
                <span className="text-xl font-heading font-bold text-[#F2F2F7] block">{b.val}</span>
                <span className="text-[10px] text-[#B4B4C8] block mt-1">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Motivos de pérdida */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#E96999]">
              Motivos de Pérdida ({perdidas.length})
            </span>
            <span className="text-[11px] text-[#B4B4C8]">Análisis de objeciones</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {Object.entries(motivosPerdidaConteo).map(([motivo, count]) => {
              const max = Math.max(1, ...Object.values(motivosPerdidaConteo));
              const pct = (count / max) * 100;
              return (
                <div key={motivo} className="flex items-center gap-2">
                  <span className="w-24 capitalize text-[11px] text-[#B4B4C8] truncate">
                    {motivo}
                  </span>
                  <div className="flex-1 h-3 bg-[#05050A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[rgba(233,105,153,0.7)] rounded-full transition-all"
                      style={{ width: `${count > 0 ? Math.max(8, pct) : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-xs text-[#F2F2F7]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. CONSTANCIA (5 SEMANAS) & XP ACUMULADO (14 DÍAS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Calendario de constancia */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
              Calendario de Constancia (5 Semanas)
            </span>
            <span className="text-[11px] text-[#B4B4C8]">Sin rachas punitivas</span>
          </div>

          <p className="text-[11px] text-[#B4B4C8]">
            Cada cuadrado representa un día de trabajo. La intensidad refleja el volumen de actividades registradas.
          </p>

          <div className="flex flex-wrap gap-1.5 pt-2">
            {calendarioConstancia.map((d) => {
              let bg = '#161622';
              if (d.count >= 3) bg = '#00C8FF';
              else if (d.count === 2) bg = 'rgba(0, 200, 255, 0.6)';
              else if (d.count === 1) bg = 'rgba(0, 200, 255, 0.25)';

              return (
                <div
                  key={d.fecha}
                  title={`${d.fecha}: ${d.count} actividades`}
                  className="w-4 h-4 rounded-[3px] border border-[rgba(255,255,255,0.05)] cursor-pointer hover:border-[#00C8FF]"
                  style={{ backgroundColor: bg }}
                />
              );
            })}
          </div>
        </div>

        {/* Línea de XP acumulado (14 días) */}
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#E96999]">
              XP Acumulado (Últimos 14 Días)
            </span>
            <span className="text-[11px] font-mono text-[#E96999] font-bold">
              +{xpUltimos14Dias.reduce((acc, p) => acc + p.diaXP, 0)} XP
            </span>
          </div>

          <div className="w-full h-32 flex items-end gap-1.5 pt-4">
            {xpUltimos14Dias.map((p, idx) => {
              const maxXP = Math.max(10, ...xpUltimos14Dias.map((item) => item.diaXP));
              const heightPct = (p.diaXP / maxXP) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    title={`${p.fecha}: +${p.diaXP} XP`}
                    className="w-full rounded-t bg-gradient-to-t from-[#4802B1] to-[#E96999] hover:brightness-125 transition-all"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                  <span className="text-[9px] text-[#B4B4C8]">{p.fecha}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
