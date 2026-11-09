import React, { useMemo, useState } from 'react';
import {
  Centro,
  Contacto,
  CriterioOrdenTablero,
  EstadoCRM,
  EtapaOportunidad,
  MotivoPerdida,
  Oportunidad,
  TipoCentro,
} from '../../types';
import { crmRepo } from '../../repo';
import {
  calcularEncajeICP,
  calcularProbabilidadCierreDinamica,
  calcularUrgenciaProximoPaso,
  ETAPAS_ORDEN,
  evaluarWinInsight,
  formatearEuros,
} from '../../utils/crmHelpers';
import { HoyToca } from './HoyToca';
import { TarjetaOportunidad } from './TarjetaOportunidad';
import {
  Filter,
  SlidersHorizontal,
  X,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowUpDown,
  Target,
  Clock,
} from 'lucide-react';

interface TableroViewProps {
  estado: EstadoCRM;
  onAbrirFicha: (opId: string) => void;
}

export const TableroView: React.FC<TableroViewProps> = ({ estado, onAbrirFicha }) => {
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroProvincia, setFiltroProvincia] = useState<string>('todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todo' | 'semana' | 'mes' | 'trimestre'>('todo');
  const [filtroSoloWinInsight, setFiltroSoloWinInsight] = useState<boolean>(false);
  
  // Selector de ordenamiento automático de columnas
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrdenTablero>('defecto');

  // Pestaña activa en móvil (< 768px)
  const [etapaMovilActiva, setEtapaMovilActiva] = useState<EtapaOportunidad>('Detectado');

  // Drag & drop
  const [draggedOpId, setDraggedOpId] = useState<string | null>(null);

  // Modal para motivo de pérdida
  const [modalPerdidaOpId, setModalPerdidaOpId] = useState<string | null>(null);
  const [motivoPerdidaSeleccionado, setMotivoPerdidaSeleccionado] = useState<MotivoPerdida>('momento');

  // Obtener provincias únicas
  const provinciasUnicas = useMemo(() => {
    const setP = new Set<string>();
    estado.centros.forEach((c) => {
      if (c.provincia) setP.add(c.provincia.trim());
    });
    return Array.from(setP).sort();
  }, [estado.centros]);

  // Detección de patrones Win Insight (alto encaje estancadas en Propuesta)
  const totalWinInsights = useMemo(() => {
    return estado.oportunidades.filter(
      (op) => evaluarWinInsight(op, estado.config.pesosICP).esWinInsight
    ).length;
  }, [estado.oportunidades, estado.config.pesosICP]);

  // Filtrado de oportunidades
  const oportunidadesFiltradas = useMemo(() => {
    const ahora = Date.now();
    const msSemana = 7 * 24 * 60 * 60 * 1000;
    const msMes = 30 * 24 * 60 * 60 * 1000;
    const msTrimestre = 90 * 24 * 60 * 60 * 1000;

    return estado.oportunidades.filter((op) => {
      const centro = estado.centros.find((c) => c.id === op.centroId);

      // Filtro Win Insight
      if (filtroSoloWinInsight && !evaluarWinInsight(op, estado.config.pesosICP).esWinInsight) {
        return false;
      }

      // Filtro tipo
      if (filtroTipo !== 'todos' && centro?.tipo !== filtroTipo) {
        return false;
      }

      // Filtro provincia
      if (filtroProvincia !== 'todas' && centro?.provincia !== filtroProvincia) {
        return false;
      }

      // Filtro periodo
      if (filtroPeriodo !== 'todo' && op.creadoEn) {
        const diff = ahora - new Date(op.creadoEn).getTime();
        if (filtroPeriodo === 'semana' && diff > msSemana) return false;
        if (filtroPeriodo === 'mes' && diff > msMes) return false;
        if (filtroPeriodo === 'trimestre' && diff > msTrimestre) return false;
      }

      return true;
    });
  }, [estado.oportunidades, estado.centros, filtroTipo, filtroProvincia, filtroPeriodo, filtroSoloWinInsight, estado.config.pesosICP]);

  // Agrupadas por columna
  const oportunidadesPorColumna = useMemo(() => {
    const mapa: Record<EtapaOportunidad, Oportunidad[]> = {
      Detectado: [],
      Demo: [],
      Piloto: [],
      Propuesta: [],
      Ganado: [],
      Perdido: [],
    };

    oportunidadesFiltradas.forEach((op) => {
      if (mapa[op.etapa]) {
        mapa[op.etapa].push(op);
      }
    });

    // Ordenamiento automático según el criterio seleccionado
    if (criterioOrden !== 'defecto') {
      ETAPAS_ORDEN.forEach((et) => {
        mapa[et].sort((a, b) => {
          if (criterioOrden === 'probabilidad') {
            const probA = calcularProbabilidadCierreDinamica(
              a,
              estado.config.probabilidades,
              estado.config.pesosICP
            );
            const probB = calcularProbabilidadCierreDinamica(
              b,
              estado.config.probabilidades,
              estado.config.pesosICP
            );
            return probB - probA;
          }
          if (criterioOrden === 'urgencia') {
            const urgA = calcularUrgenciaProximoPaso(a).score;
            const urgB = calcularUrgenciaProximoPaso(b).score;
            return urgB - urgA;
          }
          if (criterioOrden === 'encaje') {
            const encajeA = calcularEncajeICP(a.criterios, estado.config.pesosICP).porcentaje || -1;
            const encajeB = calcularEncajeICP(b.criterios, estado.config.pesosICP).porcentaje || -1;
            return encajeB - encajeA;
          }
          if (criterioOrden === 'valor') {
            return (b.valor || 0) - (a.valor || 0);
          }
          return 0;
        });
      });
    }

    return mapa;
  }, [
    oportunidadesFiltradas,
    criterioOrden,
    estado.config.probabilidades,
    estado.config.pesosICP,
  ]);

  const handleMoverEtapa = (opId: string, nuevaEtapa: EtapaOportunidad) => {
    if (nuevaEtapa === 'Perdido') {
      setModalPerdidaOpId(opId);
      setMotivoPerdidaSeleccionado('momento');
    } else {
      crmRepo.moverOportunidadEtapa(opId, nuevaEtapa);
    }
  };

  const handleConfirmarPerdido = () => {
    if (modalPerdidaOpId) {
      crmRepo.moverOportunidadEtapa(modalPerdidaOpId, 'Perdido', motivoPerdidaSeleccionado);
      setModalPerdidaOpId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, opId: string) => {
    setDraggedOpId(opId);
    e.dataTransfer.setData('text/plain', opId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, etapaDestino: EtapaOportunidad) => {
    e.preventDefault();
    const opId = draggedOpId || e.dataTransfer.getData('text/plain');
    if (opId) {
      handleMoverEtapa(opId, etapaDestino);
    }
    setDraggedOpId(null);
  };

  return (
    <div className="space-y-4">
      {/* 1. SECCIÓN HOY TOCA */}
      <HoyToca
        oportunidades={estado.oportunidades}
        centros={estado.centros}
        contactos={estado.contactos}
        pesosICP={estado.config.pesosICP}
        onAbrirFicha={onAbrirFicha}
      />

      {/* 2. BARRA DE FILTROS Y ORDENACIÓN */}
      <div className="p-3 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.18)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[#00C8FF] font-semibold">
            <Filter size={14} />
            <span>Filtros:</span>
          </div>

          {/* Filtro Tipo de Centro */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg px-2.5 py-1.5 text-[#F2F2F7] focus:border-[#00C8FF]"
          >
            <option value="todos">Todos los tipos</option>
            <option value="FP">FP</option>
            <option value="Privado">Privado</option>
            <option value="Concertado">Concertado</option>
            <option value="Publico">Público</option>
            <option value="Universidad">Universidad</option>
            <option value="Editorial">Editorial</option>
            <option value="Institucional">Institucional</option>
          </select>

          {/* Filtro Provincia */}
          <select
            value={filtroProvincia}
            onChange={(e) => setFiltroProvincia(e.target.value)}
            className="bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg px-2.5 py-1.5 text-[#F2F2F7] focus:border-[#00C8FF]"
          >
            <option value="todas">Todas las provincias</option>
            {provinciasUnicas.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>

          {/* Filtro Periodo */}
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value as any)}
            className="bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg px-2.5 py-1.5 text-[#F2F2F7] focus:border-[#00C8FF]"
          >
            <option value="todo">Cualquier fecha</option>
            <option value="semana">Última semana</option>
            <option value="mes">Último mes</option>
            <option value="trimestre">Último trimestre</option>
          </select>

          {/* Botón de acceso rápido a Win Insights */}
          {totalWinInsights > 0 && (
            <button
              type="button"
              onClick={() => setFiltroSoloWinInsight(!filtroSoloWinInsight)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow cursor-pointer ${
                filtroSoloWinInsight
                  ? 'bg-gradient-to-r from-[#00C8FF] to-[#68D3FF] text-[#000000] border-[#00C8FF] shadow-[0_0_14px_rgba(0,200,255,0.45)]'
                  : 'bg-[rgba(0,200,255,0.12)] text-[#00C8FF] border-[rgba(0,200,255,0.4)] hover:bg-[rgba(0,200,255,0.22)]'
              }`}
              title="Filtrar oportunidades con alto encaje estancadas en Propuesta para darles un empujón comercial"
            >
              <Sparkles size={12} className={filtroSoloWinInsight ? 'text-[#000000]' : 'text-[#00C8FF] animate-pulse'} />
              <span>Win Insights ({totalWinInsights})</span>
            </button>
          )}

          {(filtroTipo !== 'todos' || filtroProvincia !== 'todas' || filtroPeriodo !== 'todo' || filtroSoloWinInsight) && (
            <button
              onClick={() => {
                setFiltroTipo('todos');
                setFiltroProvincia('todas');
                setFiltroPeriodo('todo');
                setFiltroSoloWinInsight(false);
              }}
              className="text-[#E96999] hover:underline flex items-center gap-1 text-[11px]"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>

        {/* Selector de ordenamiento automático de columnas */}
        <div className="flex items-center gap-2 bg-[#05050A] border border-[rgba(0,200,255,0.25)] rounded-xl px-3 py-1.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00C8FF] shrink-0">
            <ArrowUpDown size={13} className="text-[#00C8FF]" />
            <span className="hidden sm:inline">Ordenar tarjetas:</span>
          </div>
          <select
            value={criterioOrden}
            onChange={(e) => setCriterioOrden(e.target.value as CriterioOrdenTablero)}
            className="bg-transparent text-xs text-[#F2F2F7] font-medium focus:outline-none cursor-pointer py-0.5 pr-1"
          >
            <option value="defecto" className="bg-[#0D0D14] text-[#B4B4C8]">
              Por defecto (Manual / Creación)
            </option>
            <option value="probabilidad" className="bg-[#0D0D14] text-[#00C8FF]">
              🎯 Probabilidad de cierre (dinámica)
            </option>
            <option value="urgencia" className="bg-[#0D0D14] text-amber-300">
              ⚡ Urgencia del próximo paso
            </option>
            <option value="encaje" className="bg-[#0D0D14] text-[#F2F2F7]">
              ★ Mayor encaje ICP (%)
            </option>
            <option value="valor" className="bg-[#0D0D14] text-[#F2F2F7]">
              💰 Mayor valor económico (€)
            </option>
          </select>

          {criterioOrden !== 'defecto' && (
            <button
              type="button"
              onClick={() => setCriterioOrden('defecto')}
              className="text-[10px] text-[#B4B4C8] hover:text-[#E96999] ml-0.5 p-0.5 rounded hover:bg-[#161622] transition-colors"
              title="Restablecer orden por defecto"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 3. VISTA MÓVIL: PESTAÑAS DESLIZABLES (< 768px) */}
      <div className="md:hidden">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
          {ETAPAS_ORDEN.map((et) => {
            const lista = oportunidadesPorColumna[et];
            const sumaTotal = lista.reduce((s, o) => s + (o.valor || 0), 0);
            const esActiva = etapaMovilActiva === et;

            return (
              <button
                key={et}
                onClick={() => setEtapaMovilActiva(et)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  esActiva
                    ? 'bg-[rgba(0,200,255,0.18)] text-[#00C8FF] border-[#00C8FF] shadow-[0_0_12px_rgba(0,200,255,0.3)]'
                    : 'bg-[#0D0D14] text-[#B4B4C8] border-[rgba(255,255,255,0.08)]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{et}</span>
                  {et === 'Propuesta' && (
                    (() => {
                      const winCount = lista.filter((o) => evaluarWinInsight(o, estado.config.pesosICP).esWinInsight).length;
                      return winCount > 0 ? (
                        <span
                          className="w-2 h-2 rounded-full bg-[#00C8FF] shadow-[0_0_6px_#00C8FF] animate-pulse"
                          title={`${winCount} Win Insight en Propuesta`}
                        />
                      ) : null;
                    })()
                  )}
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#161622] text-[#F2F2F7]">
                    {lista.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Columna activa móvil */}
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-[#B4B4C8]">
            <span className="font-heading font-bold text-[#F2F2F7]">
              Etapa: {etapaMovilActiva}
            </span>
            <span className="font-mono text-[#00C8FF] font-bold">
              {formatearEuros(
                oportunidadesPorColumna[etapaMovilActiva].reduce((s, o) => s + (o.valor || 0), 0)
              )}
            </span>
          </div>

          {oportunidadesPorColumna[etapaMovilActiva].length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#0D0D14] border border-[rgba(255,255,255,0.06)] text-xs text-[#B4B4C8]">
              No hay oportunidades en esta etapa
            </div>
          ) : (
            oportunidadesPorColumna[etapaMovilActiva].map((op) => (
              <TarjetaOportunidad
                key={op.id}
                oportunidad={op}
                centro={estado.centros.find((c) => c.id === op.centroId)}
                contacto={estado.contactos.find((ct) => op.contactoIds?.includes(ct.id))}
                pesosICP={estado.config.pesosICP}
                criterioOrden={criterioOrden}
                probabilidadesConfig={estado.config.probabilidades}
                onAbrirFicha={onAbrirFicha}
                onMoverEtapa={handleMoverEtapa}
                onDragStart={handleDragStart}
              />
            ))
          )}
        </div>
      </div>

      {/* 4. VISTA ESCRITORIO: 6 COLUMNAS KANBAN (>= 768px) */}
      <div className="hidden md:grid md:grid-cols-6 gap-3.5 items-start">
        {ETAPAS_ORDEN.map((etapa) => {
          const lista = oportunidadesPorColumna[etapa];
          const suma = lista.reduce((acc, o) => acc + (o.valor || 0), 0);
          const winCount = lista.filter((o) => evaluarWinInsight(o, estado.config.pesosICP).esWinInsight).length;

          return (
            <div
              key={etapa}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa)}
              className="bg-[#05050A]/70 rounded-xl border border-[rgba(0,200,255,0.15)] flex flex-col min-h-[580px] p-2.5 transition-colors duration-150"
            >
              {/* Cabecera de la columna */}
              <div className="pb-2.5 mb-2.5 border-b border-[rgba(255,255,255,0.06)] flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#F2F2F7] truncate">
                      {etapa}
                    </span>
                    {etapa === 'Propuesta' && winCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-gradient-to-r from-[rgba(0,200,255,0.25)] to-[rgba(233,105,153,0.25)] text-[#00C8FF] border border-[rgba(0,200,255,0.45)] shadow-[0_0_8px_rgba(0,200,255,0.25)] animate-pulse shrink-0"
                        title={`${winCount} lead(s) de alto encaje estancados en Propuesta que requieren un empujón comercial`}
                      >
                        <Sparkles size={8} />
                        <span>{winCount} Win</span>
                      </span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#0D0D14] text-[#00C8FF] border border-[rgba(0,200,255,0.25)]">
                    {lista.length}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#B4B4C8] font-medium">
                  {formatearEuros(suma)}
                </div>
              </div>

              {/* Lista de tarjetas */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[750px] pr-0.5">
                {lista.map((op) => (
                  <TarjetaOportunidad
                    key={op.id}
                    oportunidad={op}
                    centro={estado.centros.find((c) => c.id === op.centroId)}
                    contacto={estado.contactos.find((ct) => op.contactoIds?.includes(ct.id))}
                    pesosICP={estado.config.pesosICP}
                    criterioOrden={criterioOrden}
                    probabilidadesConfig={estado.config.probabilidades}
                    onAbrirFicha={onAbrirFicha}
                    onMoverEtapa={handleMoverEtapa}
                    onDragStart={handleDragStart}
                  />
                ))}

                {lista.length === 0 && (
                  <div className="h-28 flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl text-[11px] text-[#6B6B80] p-3 text-center">
                    Arrastra aquí para mover a {etapa}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. MODAL DE MOTIVO DE PÉRDIDA */}
      {modalPerdidaOpId && (
        <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0D14] border border-[rgba(233,105,153,0.4)] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#E96999]">
              <AlertCircle size={20} />
              <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
                Motivo de pérdida
              </h3>
            </div>
            <p className="text-xs text-[#B4B4C8]">
              Indicar el motivo nos ayuda a alimentar el Panel y mejorar el encaje con futuros clientes.
            </p>

            <div className="space-y-2 text-xs">
              {(
                [
                  { id: 'precio', label: 'Precio / Presupuesto insuficiente' },
                  { id: 'momento', label: 'Momento inadecuado / Congelado' },
                  { id: 'competencia', label: 'Competencia / Otra plataforma elegida' },
                  { id: 'no encaja', label: 'No encaja con catálogo / Requiere VR' },
                  { id: 'sin respuesta', label: 'Sin respuesta / Ghosting' },
                  { id: 'otro', label: 'Otro motivo' },
                ] as const
              ).map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    motivoPerdidaSeleccionado === m.id
                      ? 'bg-[rgba(233,105,153,0.15)] border-[#E96999] text-[#F2F2F7]'
                      : 'border-[rgba(255,255,255,0.06)] text-[#B4B4C8] hover:bg-[#161622]'
                  }`}
                >
                  <input
                    type="radio"
                    name="motivoPerdida"
                    value={m.id}
                    checked={motivoPerdidaSeleccionado === m.id}
                    onChange={() => setMotivoPerdidaSeleccionado(m.id)}
                    className="text-[#E96999] focus:ring-0"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalPerdidaOpId(null)}
                className="px-3 py-1.5 text-xs text-[#B4B4C8] hover:text-[#F2F2F7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarPerdido}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14]"
              >
                Mover a Perdido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
