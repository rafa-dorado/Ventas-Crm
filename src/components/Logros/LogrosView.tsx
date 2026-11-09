import React, { useMemo, useState } from 'react';
import { EstadoCRM, InsigniaPersonalizada, MetricaInsignia } from '../../types';
import { crmRepo } from '../../repo';
import { NIVELES_CONFIG, obtenerNivelYProgreso } from '../../utils/crmHelpers';
import { HexBadge } from '../common/HexBadge';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Gift,
  HelpCircle,
  Hexagon,
  Lock,
  Plus,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';

interface LogrosViewProps {
  estado: EstadoCRM;
}

export const LogrosView: React.FC<LogrosViewProps> = ({ estado }) => {
  const [tabLogros, setTabLogros] = useState<'retos' | 'insignias' | 'niveles'>('retos');

  // Modal para crear / editar insignia personalizada
  const [modalInsignia, setModalInsignia] = useState<boolean>(false);
  const [insigniaEditandoId, setInsigniaEditandoId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTipo, setFormTipo] = useState<'automatica' | 'manual'>('automatica');
  const [formMetrica, setFormMetrica] = useState<MetricaInsignia>('ganadas');
  const [formUmbral, setFormUmbral] = useState<number>(3);
  const [formPeriodo, setFormPeriodo] = useState<'total' | 'este_mes'>('total');

  const nivelInfo = obtenerNivelYProgreso(estado.juego.xp);

  // --- CÁLCULO DE MÉTRICAS REALES PARA SERIES ---
  const metricaCerrador = useMemo(
    () => estado.oportunidades.filter((o) => o.etapa === 'Ganado').length,
    [estado.oportunidades]
  );
  const metricaConstante = useMemo(
    () => estado.oportunidades.reduce((acc, o) => acc + (o.actividades || []).length, 0),
    [estado.oportunidades]
  );
  const metricaCartografo = useMemo(
    () =>
      estado.oportunidades.filter((o) =>
        o.criterios.every((val) => val !== null && val !== undefined)
      ).length,
    [estado.oportunidades]
  );
  const metricaEmpatico = useMemo(
    () =>
      Object.values(estado.config.cuadrantesEmpatiaCompletados || {}).filter(
        (arr) => arr && arr.length >= 6 && arr.slice(0, 6).every(Boolean)
      ).length,
    [estado.config.cuadrantesEmpatiaCompletados]
  );
  const metricaProspector = useMemo(
    () => estado.centros.filter((c) => c.verificado).length,
    [estado.centros]
  );

  const seriesData = [
    {
      id: 'cerrador',
      titulo: 'Cerrador',
      descripcion: 'Oportunidades ganadas con centros educativos',
      metrica: metricaCerrador,
      umbrales: [1, 5, 15] as [number, number, number],
      xp: [20, 50, 100] as [number, number, number],
    },
    {
      id: 'constante',
      titulo: 'Constante',
      descripcion: 'Actividades de seguimiento registradas (llamadas, reuniones, demos)',
      metrica: metricaConstante,
      umbrales: [10, 50, 150] as [number, number, number],
      xp: [20, 50, 100] as [number, number, number],
    },
    {
      id: 'cartografo',
      titulo: 'Cartógrafo',
      descripcion: 'Oportunidades con los 5 criterios ICP evaluados',
      metrica: metricaCartografo,
      umbrales: [5, 20, 50] as [number, number, number],
      xp: [20, 50, 100] as [number, number, number],
    },
    {
      id: 'empatico',
      titulo: 'Empático',
      descripcion: 'Mapas de empatía de 6 cuadrantes completados al 100%',
      metrica: metricaEmpatico,
      umbrales: [3, 10, 30] as [number, number, number],
      xp: [20, 50, 100] as [number, number, number],
    },
    {
      id: 'prospector',
      titulo: 'Prospector',
      descripcion: 'Centros añadidos y marcados como verificados',
      metrica: metricaProspector,
      umbrales: [10, 50, 150] as [number, number, number],
      xp: [20, 50, 100] as [number, number, number],
    },
  ];

  // Primeras veces
  const primerasVecesLista = [
    { id: 'primer_contacto', titulo: 'Primer Contacto', desc: 'Registrar un contacto en cualquier centro' },
    { id: 'primera_demo', titulo: 'Primera Demo', desc: 'Avanzar una oportunidad a la etapa Demo' },
    { id: 'primer_piloto', titulo: 'Primer Piloto', desc: 'Lanzar un piloto activo con un centro' },
    { id: 'primera_propuesta', titulo: 'Primera Propuesta', desc: 'Presentar una propuesta formal a un centro' },
    { id: 'primer_cierre', titulo: 'Primer Cierre', desc: 'Conseguir el primer acuerdo comercial ganado' },
    { id: 'primer_centro_prospectado', titulo: 'Primer Centro Prospectado', desc: 'Añadir un centro desde el motor de prospección' },
  ];

  // Retos Semanales
  const multSem = estado.juego.retosSemanales.multiplicadores || {};
  const retosSemanales = [
    {
      id: 'avanzar_5',
      titulo: 'Avanzar oportunidades',
      base: 5,
      actual: estado.juego.misionesHoy.etapasAvanzadas,
      premio: 30,
    },
    {
      id: 'actividades_10',
      titulo: 'Registrar actividades',
      base: 10,
      actual: estado.juego.misionesHoy.actividadesRegistradas,
      premio: 30,
    },
    {
      id: 'centros_10',
      titulo: 'Añadir nuevos centros',
      base: 10,
      actual: estado.centros.length,
      premio: 30,
    },
  ].map((r) => {
    const mult = multSem[r.id] ?? 1;
    const objetivo = Math.round(r.base * mult);
    const completado = r.actual >= objetivo;
    const reclamado = !!estado.juego.retosSemanales.reclamados[r.id];
    return { ...r, mult, objetivo, completado, reclamado };
  });

  const todosSemanalesReclamados = retosSemanales.every((r) => r.reclamado);
  const cofreSemanalReclamado = estado.juego.retosSemanales.cofreReclamado;

  // Retos Mensuales
  const multMes = estado.juego.retosMensuales.multiplicadores || {};
  const retosMensuales = [
    {
      id: 'demos_3',
      titulo: 'Hacer demos de producto',
      base: 3,
      actual: estado.oportunidades.filter((o) => o.historialEtapas.some((h) => h.etapa === 'Demo')).length,
      premio: 60,
    },
    {
      id: 'piloto_1',
      titulo: 'Lanzar pilotos',
      base: 1,
      actual: estado.oportunidades.filter((o) => o.historialEtapas.some((h) => h.etapa === 'Piloto')).length,
      premio: 60,
    },
    {
      id: 'propuestas_2',
      titulo: 'Enviar propuestas formales',
      base: 2,
      actual: estado.oportunidades.filter((o) => o.historialEtapas.some((h) => h.etapa === 'Propuesta')).length,
      premio: 60,
    },
  ].map((r) => {
    const mult = multMes[r.id] ?? 1;
    const objetivo = Math.round(r.base * mult);
    const completado = r.actual >= objetivo;
    const reclamado = !!estado.juego.retosMensuales.reclamados[r.id];
    return { ...r, mult, objetivo, completado, reclamado };
  });

  const todosMensualesReclamados = retosMensuales.every((r) => r.reclamado);
  const cofreMensualReclamado = estado.juego.retosMensuales.cofreReclamado;

  const handleCrearInsignia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    if (insigniaEditandoId) {
      crmRepo.editarInsigniaPersonalizada(insigniaEditandoId, {
        nombre: formNombre.trim(),
        descripcion: formDesc.trim(),
        tipoCondicion: formTipo,
        metrica: formTipo === 'automatica' ? formMetrica : undefined,
        umbral: formTipo === 'automatica' ? Number(formUmbral) : undefined,
        periodo: formTipo === 'automatica' ? formPeriodo : undefined,
      });
    } else {
      crmRepo.crearInsigniaPersonalizada({
        nombre: formNombre.trim(),
        descripcion: formDesc.trim(),
        tipoCondicion: formTipo,
        metrica: formTipo === 'automatica' ? formMetrica : undefined,
        umbral: formTipo === 'automatica' ? Number(formUmbral) : undefined,
        periodo: formTipo === 'automatica' ? formPeriodo : undefined,
      });
    }

    setModalInsignia(false);
    setInsigniaEditandoId(null);
    setFormNombre('');
    setFormDesc('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Cabecera de Logros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)]">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-[#E96999]" />
            <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">
              Sistema de Maestría y Logros Eonesia
            </h2>
          </div>
          <p className="text-xs text-[#B4B4C8] mt-1">
            Motivación intrínseca: sin rachas punitivas, sin rankings ni pérdidas por inactividad.
          </p>
        </div>

        {/* Pestañas de Logros */}
        <div className="flex bg-[#05050A] p-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-xs">
          <button
            onClick={() => setTabLogros('retos')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabLogros === 'retos'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Retos y premios
          </button>
          <button
            onClick={() => setTabLogros('insignias')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabLogros === 'insignias'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Insignias
          </button>
          <button
            onClick={() => setTabLogros('niveles')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabLogros === 'niveles'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Niveles y reglas
          </button>
        </div>
      </div>

      {/* =========================================================================
          PESTAÑA 1: RETOS Y PREMIOS
         ========================================================================= */}
      {tabLogros === 'retos' && (
        <div className="space-y-6">
          {/* RETOS SEMANALES & PORTAL COFRE SEMANAL */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Retos Semanales (+30 XP c/u · Se reinician el lunes)
              </span>
              <span className="text-[11px] text-[#B4B4C8]">
                Semana: {estado.juego.retosSemanales.semanaId}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {retosSemanales.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.08)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#F2F2F7]">{r.titulo}</span>
                      <span className="text-[10px] text-[#00C8FF] font-mono">
                        {r.actual}/{r.objetivo}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full h-1.5 bg-[#161622] rounded-full overflow-hidden mt-1 mb-2">
                      <div
                        className="h-full bg-[#00C8FF] rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (r.actual / r.objetivo) * 100)}%`,
                        }}
                      />
                    </div>

                    {/* Ajuste de exigencia: mitad (0.5x), normal (1x), triple (3x) */}
                    <div className="flex items-center justify-between text-[10px] text-[#B4B4C8] pt-1">
                      <span>Ajustar exigencia:</span>
                      <div className="flex gap-1">
                        {[0.5, 1, 3].map((multVal) => (
                          <button
                            key={multVal}
                            onClick={() =>
                              crmRepo.ajustarMultiplicadorReto('semanal', r.id, multVal)
                            }
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              r.mult === multVal
                                ? 'bg-[#00C8FF] text-[#0D0D14] font-bold'
                                : 'bg-[#161622] text-[#B4B4C8]'
                            }`}
                          >
                            {multVal}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-[#E96999]">
                      +{r.premio} XP
                    </span>
                    {r.reclamado ? (
                      <span className="text-[11px] text-[#00C8FF] flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={13} /> Reclamado
                      </span>
                    ) : r.completado ? (
                      <button
                        onClick={() => crmRepo.reclamarRetoSemanal(r.id)}
                        className="px-2.5 py-1 text-xs font-bold rounded bg-[#E96999] text-[#0D0D14] hover:bg-[#ff85b3] shadow"
                      >
                        Reclamar +{r.premio} XP
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#6B6B80]">En progreso</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* COFRE SEMANAL (PORTAL LUMINOSO) */}
            <div
              className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(0,200,255,0.08) 0%, rgba(233,105,153,0.05) 50%, rgba(72,2,177,0.15) 100%)',
                borderColor: todosSemanalesReclamados
                  ? 'rgba(0,200,255,0.5)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: todosSemanalesReclamados
                  ? '0 8px 32px -4px rgba(72, 2, 177, 0.45), 0 0 16px 0 rgba(233, 105, 153, 0.20)'
                  : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.4)] flex items-center justify-center text-[#00C8FF]">
                  <Gift size={24} />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#F2F2F7]">
                    Portal Luminoso · Cofre Semanal (+50 XP)
                  </h4>
                  <p className="text-xs text-[#B4B4C8]">
                    {todosSemanalesReclamados
                      ? '¡Has completado los 3 retos semanales! Abre el portal luminoso para reclamar tu premio.'
                      : 'Reclama los 3 retos semanales para abrir el cofre y recibir tu sello de fecha.'}
                  </p>
                </div>
              </div>

              <div>
                {cofreSemanalReclamado ? (
                  <div className="px-3 py-1.5 rounded-lg bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.4)] font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Sello semanal obtenido
                  </div>
                ) : (
                  <button
                    disabled={!todosSemanalesReclamados}
                    onClick={() => crmRepo.reclamarCofreSemanal()}
                    className="px-4 py-2 rounded-xl bg-[#00C8FF] hover:bg-[#68d3ff] disabled:opacity-40 disabled:cursor-not-allowed text-[#0D0D14] font-bold text-xs shadow-lg transition-transform active:scale-95"
                  >
                    Abrir Portal (+50 XP)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RETOS MENSUALES & COFRE DEL MES */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.25)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#E96999]">
                Retos Mensuales (+60 XP c/u · Se reinician el día 1)
              </span>
              <span className="text-[11px] text-[#B4B4C8]">
                Mes: {estado.juego.retosMensuales.mesId}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {retosMensuales.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.08)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#F2F2F7]">{r.titulo}</span>
                      <span className="text-[10px] text-[#E96999] font-mono">
                        {r.actual}/{r.objetivo}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#161622] rounded-full overflow-hidden mt-1 mb-2">
                      <div
                        className="h-full bg-[#E96999] rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (r.actual / r.objetivo) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#B4B4C8] pt-1">
                      <span>Ajustar exigencia:</span>
                      <div className="flex gap-1">
                        {[0.5, 1, 3].map((multVal) => (
                          <button
                            key={multVal}
                            onClick={() =>
                              crmRepo.ajustarMultiplicadorReto('mensual', r.id, multVal)
                            }
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              r.mult === multVal
                                ? 'bg-[#E96999] text-[#0D0D14] font-bold'
                                : 'bg-[#161622] text-[#B4B4C8]'
                            }`}
                          >
                            {multVal}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-[#E96999]">
                      +{r.premio} XP
                    </span>
                    {r.reclamado ? (
                      <span className="text-[11px] text-[#00C8FF] flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={13} /> Reclamado
                      </span>
                    ) : r.completado ? (
                      <button
                        onClick={() => crmRepo.reclamarRetoMensual(r.id)}
                        className="px-2.5 py-1 text-xs font-bold rounded bg-[#E96999] text-[#0D0D14] hover:bg-[#ff85b3] shadow"
                      >
                        Reclamar +{r.premio} XP
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#6B6B80]">En progreso</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* COFRE DEL MES (+150 XP & INSIGNIA EXCLUSIVA) */}
            <div
              className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(72,2,177,0.2) 0%, rgba(233,105,153,0.12) 50%, rgba(0,200,255,0.08) 100%)',
                borderColor: todosMensualesReclamados
                  ? 'rgba(233,105,153,0.6)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: todosMensualesReclamados
                  ? '0 8px 32px -4px rgba(72, 2, 177, 0.45), 0 0 16px 0 rgba(233, 105, 153, 0.20)'
                  : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.4)] flex items-center justify-center text-[#E96999]">
                  <Award size={24} />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#F2F2F7]">
                    Cofre del Mes (+150 XP + Insignia Exclusiva)
                  </h4>
                  <p className="text-xs text-[#B4B4C8]">
                    Al completar los 3 retos del mes, desbloqueas +150 XP y la insignia de honor mensual.
                  </p>
                </div>
              </div>

              <div>
                {cofreMensualReclamado ? (
                  <div className="px-3 py-1.5 rounded-lg bg-[rgba(233,105,153,0.15)] text-[#E96999] border border-[rgba(233,105,153,0.4)] font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Insignia del Mes desbloqueada
                  </div>
                ) : (
                  <button
                    disabled={!todosMensualesReclamados}
                    onClick={() => crmRepo.reclamarCofreMensual()}
                    className="px-4 py-2 rounded-xl bg-[#E96999] hover:bg-[#ff85b3] disabled:opacity-40 disabled:cursor-not-allowed text-[#0D0D14] font-bold text-xs shadow-lg transition-transform active:scale-95"
                  >
                    Reclamar Cofre (+150 XP)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: INSIGNIAS (SERIES, PRIMERAS VECES Y CREA TU INSIGNIA)
         ========================================================================= */}
      {tabLogros === 'insignias' && (
        <div className="space-y-6">
          {/* 1. SERIES BRONCE / PLATA / ORO */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Series de Maestría (Bronce +20 XP · Plata +50 XP · Oro +100 XP)
              </span>
              <span className="text-[11px] text-[#B4B4C8]">Calculadas con datos reales</span>
            </div>

            <div className="space-y-3">
              {seriesData.map((serie) => {
                const reclamados = estado.juego.seriesReclamadas[serie.id] || [false, false, false];
                const grados = [
                  { nombre: 'Bronce', umbral: serie.umbrales[0], xp: 20, idx: 0 },
                  { nombre: 'Plata', umbral: serie.umbrales[1], xp: 50, idx: 1 },
                  { nombre: 'Oro', umbral: serie.umbrales[2], xp: 100, idx: 2 },
                ];

                return (
                  <div
                    key={serie.id}
                    className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#F2F2F7] text-sm">{serie.titulo}</span>
                        <p className="text-[11px] text-[#B4B4C8]">{serie.descripcion}</p>
                      </div>
                      <span className="font-mono font-bold text-[#00C8FF]">
                        Progreso actual: {serie.metrica}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {grados.map((g) => {
                        const alcanzado = serie.metrica >= g.umbral;
                        const yaReclamado = reclamados[g.idx];

                        return (
                          <div
                            key={g.nombre}
                            className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                              yaReclamado
                                ? 'bg-[rgba(0,200,255,0.1)] border-[rgba(0,200,255,0.4)] text-[#F2F2F7]'
                                : alcanzado
                                ? 'bg-[rgba(233,105,153,0.12)] border-[#E96999] text-[#F2F2F7]'
                                : 'bg-[#0D0D14] border-[rgba(255,255,255,0.06)] text-[#6B6B80]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{g.nombre}</span>
                              <span className="font-mono text-[10px]">
                                {serie.metrica}/{g.umbral}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <span className="font-mono text-[10px] text-[#E96999]">
                                +{g.xp} XP
                              </span>
                              {yaReclamado ? (
                                <span className="text-[10px] text-[#00C8FF] flex items-center gap-0.5">
                                  <CheckCircle2 size={11} /> Listo
                                </span>
                              ) : alcanzado ? (
                                <button
                                  onClick={() =>
                                    crmRepo.reclamarGradoSerie(serie.id, g.idx, g.xp)
                                  }
                                  className="px-2 py-0.5 rounded bg-[#E96999] text-[#0D0D14] font-bold text-[10px] shadow"
                                >
                                  Reclamar
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#6B6B80]">Bloqueado</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. PRIMERAS VECES (+15 XP C/U) */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Primeras Veces (+15 XP cada una · Una sola vez)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {primerasVecesLista.map((item) => {
                const registro = estado.juego.primerasVeces?.[item.id];
                const conseguida = Boolean(registro);

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-start gap-3 ${
                      conseguida
                        ? 'bg-[rgba(0,200,255,0.08)] border-[rgba(0,200,255,0.35)]'
                        : 'bg-[#000000]/40 border-[rgba(255,255,255,0.06)] opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        conseguida
                          ? 'bg-[#00C8FF] text-[#0D0D14]'
                          : 'bg-[#161622] text-[#6B6B80]'
                      }`}
                    >
                      {conseguida ? <CheckCircle2 size={16} /> : <Lock size={15} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#F2F2F7]">{item.titulo}</span>
                        <span className="text-[10px] font-mono text-[#E96999] font-bold">
                          +15 XP
                        </span>
                      </div>
                      <p className="text-[11px] text-[#B4B4C8] leading-tight mt-0.5">
                        {item.desc}
                      </p>
                      {conseguida && registro?.fecha && (
                        <span className="text-[10px] text-[#00C8FF] mt-1 block">
                          Conseguido el {registro.fecha.split('T')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. CREA TU INSIGNIA (MÁXIMO 12, CONTADOR VISIBLE) */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.3)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <div>
                <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#E96999]">
                  Crea tu Insignia Personalizada
                </span>
                <span className="ml-2 font-mono text-xs text-[#00C8FF] font-bold">
                  {estado.juego.insigniasPersonalizadas.length} de 12
                </span>
              </div>

              {estado.juego.insigniasPersonalizadas.length < 12 && (
                <button
                  onClick={() => {
                    setInsigniaEditandoId(null);
                    setFormNombre('');
                    setFormDesc('');
                    setModalInsignia(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow"
                >
                  <Plus size={14} /> Crear insignia
                </button>
              )}
            </div>

            <p className="text-xs text-[#B4B4C8]">
              Crea tus propios reconocimientos de equipo. Las insignias generadas no otorgan XP (solo reconocimiento de maestría) y generan un icono procedural único en SVG hexagonal a partir de su nombre.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              {estado.juego.insigniasPersonalizadas.map((ins) => (
                <div
                  key={ins.id}
                  className="p-3.5 rounded-xl bg-[#000000]/70 border border-[rgba(0,200,255,0.18)] hover:border-[rgba(0,200,255,0.4)] transition-all flex items-start gap-3 relative group"
                >
                  {/* Icono procedural en SVG */}
                  <HexBadge
                    nombre={ins.nombre}
                    size={52}
                    bloqueada={!ins.conseguida}
                    progresoTexto={!ins.conseguida ? 'Pendiente' : undefined}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-heading font-bold text-xs text-[#F2F2F7] truncate">
                        {ins.nombre}
                      </h4>
                      <button
                        onClick={() => crmRepo.borrarInsigniaPersonalizada(ins.id)}
                        className="text-[#6B6B80] hover:text-[#ffb4ab] p-1"
                        title="Borrar insignia"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <p className="text-[11px] text-[#B4B4C8] line-clamp-2 mt-0.5 leading-tight">
                      {ins.descripcion}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      {ins.conseguida ? (
                        <span className="text-[10px] font-bold text-[#00C8FF] flex items-center gap-1">
                          <CheckCircle2 size={12} /> Conseguida
                        </span>
                      ) : ins.tipoCondicion === 'manual' ? (
                        <button
                          onClick={() => crmRepo.marcarInsigniaManual(ins.id)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#00C8FF] text-[#0D0D14]"
                        >
                          Marcar como conseguida
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#6B6B80] font-mono">
                          Auto: {ins.metrica} (≥{ins.umbral})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: NIVELES Y REGLAS (ESCALERA VERTICAL Y TABLA DE XP)
         ========================================================================= */}
      {tabLogros === 'niveles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Escalera vertical de niveles */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
            <div className="pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Escalera de Niveles Eonesia
              </span>
            </div>

            <div className="space-y-3">
              {NIVELES_CONFIG.map((n) => {
                const esActual = nivelInfo.nivelNumero === n.nivel;
                const yaSuperado = estado.juego.xp >= n.nextXP && n.nivel < 6;

                return (
                  <div
                    key={n.nivel}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      esActual
                        ? 'bg-[rgba(0,200,255,0.15)] border-[#00C8FF] shadow-[0_0_20px_-4px_rgba(0,200,255,0.3)]'
                        : yaSuperado
                        ? 'bg-[#000000]/60 border-[rgba(0,200,255,0.2)]'
                        : 'bg-[#000000]/30 border-[rgba(255,255,255,0.05)] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg clip-hexagon flex items-center justify-center font-heading font-bold text-sm ${
                          esActual
                            ? 'bg-[#00C8FF] text-[#0D0D14]'
                            : yaSuperado
                            ? 'bg-[#161622] text-[#00C8FF]'
                            : 'bg-[#121218] text-[#6B6B80]'
                        }`}
                      >
                        {n.nivel}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#F2F2F7]">{n.nombre}</span>
                          {esActual && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#00C8FF] text-[#0D0D14]">
                              Nivel Actual
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-[#B4B4C8]">
                          {n.minXP} XP requeridos
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono text-[#B4B4C8]">
                      {n.nivel === 6 ? 'Nivel Máximo' : `${n.nextXP} XP`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla de formas de ganar XP */}
          <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
            <div className="pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Reglas y Vías para Ganar XP
              </span>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#B4B4C8]">
                    <th className="py-2 font-semibold">Acción Comercial</th>
                    <th className="py-2 text-right font-semibold">Recompensa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-[#F2F2F7]">
                  <tr>
                    <td className="py-2">Primera vez en cada etapa del embudo</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+10 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Registrar actividad (llamada, demo, email)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+5 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Crear nuevo lead comercial</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+5 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Añadir centro desde prospección (máx 30/día)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+3 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Completar 1 cuadrante de empatía (1ª vez)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+8 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Completar los 6 cuadrantes de empatía</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+20 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Misión de hoy completada</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+10 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Reto semanal superado</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+30 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Cofre Semanal (Portal Luminoso)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+50 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Reto mensual superado</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+60 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Cofre del Mes</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+150 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Series de maestría (Bronce / Plata / Oro)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+20 / 50 / 100 XP</td>
                  </tr>
                  <tr>
                    <td className="py-2">Primeras veces (contacto, demo, cierre)</td>
                    <td className="py-2 text-right font-mono font-bold text-[#E96999]">+15 XP</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR INSIGNIA CON VISTA PREVIA DETERMINISTA EN TIEMPO REAL */}
      {modalInsignia && (
        <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0D14] border border-[rgba(233,105,153,0.4)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
                Crear Insignia de Reconocimiento
              </h3>
              <button
                onClick={() => setModalInsignia(false)}
                className="text-[#B4B4C8] hover:text-[#F2F2F7]"
              >
                ✕
              </button>
            </div>

            {/* Vista previa en tiempo real del icono generado */}
            <div className="p-4 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] flex items-center gap-4">
              <HexBadge nombre={formNombre || 'Insignia'} size={68} />
              <div>
                <span className="text-[10px] uppercase font-bold text-[#E96999] block">
                  Vista previa en directo
                </span>
                <span className="font-heading font-bold text-sm text-[#F2F2F7] block">
                  {formNombre || 'Nombre de la insignia'}
                </span>
                <span className="text-[11px] text-[#B4B4C8]">
                  Icono SVG procedural con hash de color y anillos
                </span>
              </div>
            </div>

            <form onSubmit={handleCrearInsignia} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Nombre de la insignia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Titán de Licitaciones"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Descripción y mérito *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cerrar 5 acuerdos institucionales de innovación"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Tipo de condición</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipo('automatica')}
                    className={`p-2 rounded-lg border text-center font-semibold ${
                      formTipo === 'automatica'
                        ? 'bg-[rgba(0,200,255,0.15)] border-[#00C8FF] text-[#00C8FF]'
                        : 'bg-[#05050A] border-[rgba(255,255,255,0.06)] text-[#B4B4C8]'
                    }`}
                  >
                    Automática (por datos)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipo('manual')}
                    className={`p-2 rounded-lg border text-center font-semibold ${
                      formTipo === 'manual'
                        ? 'bg-[rgba(0,200,255,0.15)] border-[#00C8FF] text-[#00C8FF]'
                        : 'bg-[#05050A] border-[rgba(255,255,255,0.06)] text-[#B4B4C8]'
                    }`}
                  >
                    Manual (marcar a mano)
                  </button>
                </div>
              </div>

              {formTipo === 'automatica' && (
                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#B4B4C8] mb-1">Métrica</label>
                      <select
                        value={formMetrica}
                        onChange={(e) => setFormMetrica(e.target.value as MetricaInsignia)}
                        className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded p-1.5 text-[#F2F2F7]"
                      >
                        <option value="ganadas">Ganadas</option>
                        <option value="demos">Demos</option>
                        <option value="actividades">Actividades</option>
                        <option value="centros">Centros añadidos</option>
                        <option value="mapas">Mapas de empatía</option>
                        <option value="valor_ganado">Valor ganado (€)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#B4B4C8] mb-1">Umbral</label>
                      <input
                        type="number"
                        min={1}
                        value={formUmbral}
                        onChange={(e) => setFormUmbral(Number(e.target.value))}
                        className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded p-1.5 text-[#F2F2F7]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#B4B4C8] mb-1">Periodo de comprobación</label>
                    <select
                      value={formPeriodo}
                      onChange={(e) => setFormPeriodo(e.target.value as any)}
                      className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded p-1.5 text-[#F2F2F7]"
                    >
                      <option value="total">Histórico total</option>
                      <option value="este_mes">Solo este mes</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalInsignia(false)}
                  className="px-3 py-1.5 text-[#B4B4C8]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14]"
                >
                  Guardar insignia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
