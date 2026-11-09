import {
  CriterioOrdenTablero,
  CriteriosOportunidad,
  DolorPrincipal,
  EtapaOportunidad,
  Juego,
  PesosICP,
  ProbabilidadesEtapa,
  TipoCentro
} from '../types';

export const NIVELES_CONFIG = [
  { nivel: 1, nombre: 'Sombra', minXP: 0, nextXP: 100 },
  { nivel: 2, nombre: 'Círculo', minXP: 100, nextXP: 250 },
  { nivel: 3, nombre: 'Esfera', minXP: 250, nextXP: 450 },
  { nivel: 4, nombre: 'Portal', minXP: 450, nextXP: 700 },
  { nivel: 5, nombre: 'Isla', minXP: 700, nextXP: 1000 },
  { nivel: 6, nombre: 'Archipiélago', minXP: 1000, nextXP: 1000 },
];

export function obtenerNivelYProgreso(xp: number): {
  nivelNumero: number;
  nombre: string;
  minXP: number;
  nextXP: number;
  porcentaje: number;
  xpRestante: number;
} {
  let actual = NIVELES_CONFIG[0];
  for (let i = NIVELES_CONFIG.length - 1; i >= 0; i--) {
    if (xp >= NIVELES_CONFIG[i].minXP) {
      actual = NIVELES_CONFIG[i];
      break;
    }
  }

  if (actual.nivel === 6) {
    return {
      nivelNumero: 6,
      nombre: actual.nombre,
      minXP: actual.minXP,
      nextXP: actual.minXP,
      porcentaje: 100,
      xpRestante: 0,
    };
  }

  const rango = actual.nextXP - actual.minXP;
  const progreso = Math.min(Math.max(xp - actual.minXP, 0), rango);
  const porcentaje = Math.round((progreso / rango) * 100);
  const xpRestante = Math.max(actual.nextXP - xp, 0);

  return {
    nivelNumero: actual.nivel,
    nombre: actual.nombre,
    minXP: actual.minXP,
    nextXP: actual.nextXP,
    porcentaje,
    xpRestante,
  };
}

export function normalizarTexto(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')   // Quita caracteres especiales
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarNombreCentro(nombre: string): string {
  let limpio = normalizarTexto(nombre);
  // Quitar prefijos comunes de centros educativos
  limpio = limpio
    .replace(/\b(colegio|ies|cifp|instituto|ceip|escuela|centro|universidad|editorial|agencia)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio;
}

export function normalizarDominio(url: string): string {
  if (!url) return '';
  let dominio = url.toLowerCase().trim();
  dominio = dominio.replace(/^https?:\/\//, '');
  dominio = dominio.replace(/^www\./, '');
  dominio = dominio.split('/')[0];
  return dominio.trim();
}

export function calcularCriterioSegmentoPorTipo(tipo: TipoCentro): 0 | 0.5 | 1 {
  if (tipo === 'FP' || tipo === 'Privado') {
    return 1;
  }
  if (tipo === 'Concertado' || tipo === 'Universidad' || tipo === 'Editorial') {
    return 0.5;
  }
  return 0; // Institucional o Público
}

export function calcularProductoSugerido(
  tipo: TipoCentro,
  dolor?: DolorPrincipal,
  red?: string
): { producto: string; motivo: string } {
  if (dolor === 'Fondos por ejecutar') {
    return {
      producto: 'Proyecto por fases',
      motivo: 'Ajuste: Dolor de fondos por ejecutar requiere estructuración por fases',
    };
  }

  switch (tipo) {
    case 'FP':
      return {
        producto: 'Troncales FP (Mundo vacío + Mundo con contenido)',
        motivo: 'Troncales oficiales con simuladores y plantilla personalizable',
      };
    case 'Privado':
      return {
        producto: 'Plan Centro completo 349 €/mes',
        motivo: 'Autonomía de compra y despliegue rápido por cuota mensual',
      };
    case 'Concertado':
      if (red && red.trim().length > 0) {
        return {
          producto: 'Piloto de red',
          motivo: `Pertenece a la red "${red}": ideal para traccionar a todo el grupo`,
        };
      }
      return {
        producto: 'Plan Teams 119 €/mes',
        motivo: 'Entrada ágil para departamento innovador en concertada',
      };
    case 'Publico':
      return {
        producto: 'Plan Explorador gratis + vía Consejería',
        motivo: 'Sin presupuesto propio directo; adopción docente para licitación',
      };
    case 'Universidad':
      return {
        producto: 'Licencia Universidad desde 4.900 €/año + Marketplace',
        motivo: 'Campus inmersivo multi-departamento con marketplace de asignaturas',
      };
    case 'Editorial':
      return {
        producto: 'Marca blanca / RevShare',
        motivo: 'Integración en catálogo editorial y reparto de ingresos por alumno',
      };
    case 'Institucional':
      return {
        producto: 'Proyecto por fases',
        motivo: 'Contratación pública o subvención estructurada en hitos',
      };
    default:
      return {
        producto: 'Plan Centro completo 349 €/mes',
        motivo: 'Recomendación base Eonesia',
      };
  }
}

export function calcularEncajeICP(
  criterios: CriteriosOportunidad,
  pesos: PesosICP
): {
  porcentaje: number | null;
  sumaPonderada: number;
  sumaPesosRellenos: number;
  criteriosRellenos: number;
} {
  const listaPesos = [
    pesos.decisor,
    pesos.dinero,
    pesos.segmento,
    pesos.dolor,
    pesos.catalogo,
  ];

  let sumaPonderada = 0;
  let sumaPesosRellenos = 0;
  let criteriosRellenos = 0;

  for (let i = 0; i < 5; i++) {
    const valor = criterios[i];
    if (valor !== null && valor !== undefined) {
      const peso = listaPesos[i] || 1;
      sumaPonderada += peso * valor;
      sumaPesosRellenos += peso;
      criteriosRellenos++;
    }
  }

  if (criteriosRellenos === 0 || sumaPesosRellenos === 0) {
    return {
      porcentaje: null,
      sumaPonderada: 0,
      sumaPesosRellenos: 0,
      criteriosRellenos: 0,
    };
  }

  const porcentaje = Math.round((sumaPonderada / sumaPesosRellenos) * 100);
  return {
    porcentaje,
    sumaPonderada,
    sumaPesosRellenos,
    criteriosRellenos,
  };
}

export function calcularDiasEnEtapa(historialEtapas?: Array<{ etapa: string; fecha: string }>): number {
  if (!historialEtapas || historialEtapas.length === 0) return 0;
  const ultima = historialEtapas[historialEtapas.length - 1];
  const fechaEtapa = new Date(ultima.fecha).getTime();
  const ahora = Date.now();
  const diffMs = ahora - fechaEtapa;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatearEuros(valor: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export function formatearFecha(isoString: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export const COLORES_TIPO_CENTRO: Record<TipoCentro, { bg: string; text: string; border: string; dot: string }> = {
  FP: {
    bg: 'rgba(0, 200, 255, 0.12)',
    text: '#00C8FF',
    border: 'rgba(0, 200, 255, 0.4)',
    dot: '#00C8FF',
  },
  Privado: {
    bg: 'rgba(233, 105, 153, 0.12)',
    text: '#E96999',
    border: 'rgba(233, 105, 153, 0.4)',
    dot: '#E96999',
  },
  Concertado: {
    bg: 'rgba(195, 173, 255, 0.12)',
    text: '#c3adff',
    border: 'rgba(195, 173, 255, 0.4)',
    dot: '#c3adff',
  },
  Publico: {
    bg: 'rgba(154, 154, 176, 0.12)',
    text: '#B4B4C8',
    border: 'rgba(154, 154, 176, 0.3)',
    dot: '#B4B4C8',
  },
  Universidad: {
    bg: 'rgba(104, 211, 255, 0.12)',
    text: '#68d3ff',
    border: 'rgba(104, 211, 255, 0.4)',
    dot: '#68d3ff',
  },
  Editorial: {
    bg: 'rgba(255, 176, 200, 0.12)',
    text: '#ffb0c8',
    border: 'rgba(255, 176, 200, 0.4)',
    dot: '#ffb0c8',
  },
  Institucional: {
    bg: 'rgba(220, 206, 255, 0.12)',
    text: '#dcceff',
    border: 'rgba(220, 206, 255, 0.4)',
    dot: '#dcceff',
  },
};

export const ETAPAS_ORDEN: EtapaOportunidad[] = [
  'Detectado',
  'Demo',
  'Piloto',
  'Propuesta',
  'Ganado',
  'Perdido',
];

// Umbrales saludables en días antes de considerar un acuerdo en riesgo/estancado
export const UMBRALES_ESTANCAMIENTO_DIAS: Record<EtapaOportunidad, number> = {
  Detectado: 7,
  Demo: 10,
  Piloto: 14,
  Propuesta: 12,
  Ganado: 9999,
  Perdido: 9999,
};

export interface EstadoEstancamiento {
  estancado: boolean;
  dias: number;
  umbral: number;
  nivelRiesgo: 'normal' | 'alerta' | 'critico';
  mensaje: string;
}

export function evaluarEstancamientoOportunidad(
  historialEtapas: Array<{ etapa: EtapaOportunidad | string; fecha: string }> | undefined,
  etapaActual: EtapaOportunidad
): EstadoEstancamiento {
  if (etapaActual === 'Ganado' || etapaActual === 'Perdido') {
    return {
      estancado: false,
      dias: 0,
      umbral: 9999,
      nivelRiesgo: 'normal',
      mensaje: 'Cerrado',
    };
  }

  const dias = calcularDiasEnEtapa(historialEtapas);
  const umbral = UMBRALES_ESTANCAMIENTO_DIAS[etapaActual] ?? 10;
  const estancado = dias > umbral;

  let nivelRiesgo: 'normal' | 'alerta' | 'critico' = 'normal';
  if (dias >= Math.round(umbral * 1.5)) {
    nivelRiesgo = 'critico';
  } else if (dias > umbral) {
    nivelRiesgo = 'alerta';
  }

  return {
    estancado,
    dias,
    umbral,
    nivelRiesgo,
    mensaje: estancado
      ? `${dias} días en ${etapaActual} (umbral: ${umbral}d)`
      : `${dias} días en ${etapaActual}`,
  };
}

export interface WinInsightData {
  esWinInsight: boolean;
  encajePorcentaje: number | null;
  diasEnEtapa: number;
  motivo: string;
  sugerenciaNudge: string;
}

export function evaluarWinInsight(
  oportunidad: {
    etapa: EtapaOportunidad;
    criterios: CriteriosOportunidad;
    historialEtapas?: Array<{ etapa: EtapaOportunidad | string; fecha: string }>;
  },
  pesosICP: PesosICP
): WinInsightData {
  if (oportunidad.etapa !== 'Propuesta') {
    return {
      esWinInsight: false,
      encajePorcentaje: null,
      diasEnEtapa: 0,
      motivo: '',
      sugerenciaNudge: '',
    };
  }

  const encaje = calcularEncajeICP(oportunidad.criterios, pesosICP).porcentaje;
  const diasEnEtapa = calcularDiasEnEtapa(oportunidad.historialEtapas);
  const estancamiento = evaluarEstancamientoOportunidad(oportunidad.historialEtapas, oportunidad.etapa);

  // Patrón detectado: Alto encaje (>= 70%) en etapa Propuesta con retraso/estancamiento (>= 4 días o sobrepasando umbral)
  const esAltoEncaje = encaje !== null && encaje >= 70;
  const esEstancada = estancamiento.estancado || diasEnEtapa >= 4;
  const esWinInsight = esAltoEncaje && esEstancada;

  let sugerenciaNudge = 'Dar empujón comercial proactivo';
  if (diasEnEtapa >= 10) {
    sugerenciaNudge = 'Urgente: Enviar enlace al espacio WebXR 3D o proponer llamada con dirección';
  } else if (diasEnEtapa >= 5) {
    sugerenciaNudge = 'Ofrecer sesión de dudas sobre presupuesto o condiciones de piloto';
  } else {
    sugerenciaNudge = 'Recordatorio cordial de propuesta formal pendiente de validación';
  }

  return {
    esWinInsight,
    encajePorcentaje: encaje,
    diasEnEtapa,
    motivo: esWinInsight
      ? `Lead de alto encaje (${encaje}%) con ${diasEnEtapa} días en Propuesta esperando cierre.`
      : '',
    sugerenciaNudge,
  };
}

/**
 * Calcula la probabilidad de cierre dinámica (%) para una oportunidad
 * combinando:
 * 1. Probabilidad base configurada para la etapa
 * 2. Modificador según encaje ICP (-15% a +15%)
 * 3. Penalización por estancamiento (-9% en alerta, -18% en crítico)
 * 4. Bonus/penalización por actividad comercial en los últimos 7 días (+6% / -4%)
 */
export function calcularProbabilidadCierreDinamica(
  op: {
    etapa: EtapaOportunidad;
    criterios: CriteriosOportunidad;
    historialEtapas?: Array<{ etapa: EtapaOportunidad | string; fecha: string }>;
    actividades?: Array<{ fecha: string; resultado?: string }>;
  },
  probabilidadesConfig?: ProbabilidadesEtapa | Record<string, number>,
  pesosICP?: PesosICP
): number {
  if (op.etapa === 'Ganado') return 100;
  if (op.etapa === 'Perdido') return 0;

  // 1. Probabilidad base según la etapa del embudo
  const baseEtapa =
    (probabilidadesConfig && probabilidadesConfig[op.etapa]) ??
    (op.etapa === 'Detectado'
      ? 15
      : op.etapa === 'Demo'
      ? 30
      : op.etapa === 'Piloto'
      ? 55
      : op.etapa === 'Propuesta'
      ? 75
      : 20);

  // 2. Modificador por encaje ICP (-15% a +15%)
  let modEncaje = 0;
  if (pesosICP) {
    const enc = calcularEncajeICP(op.criterios, pesosICP).porcentaje;
    if (enc !== null) {
      modEncaje = Math.round(((enc - 50) / 50) * 15);
    }
  }

  // 3. Penalización por estancamiento
  const est = evaluarEstancamientoOportunidad(op.historialEtapas, op.etapa);
  let penalizacionEst = 0;
  if (est.nivelRiesgo === 'critico') {
    penalizacionEst = -18;
  } else if (est.nivelRiesgo === 'alerta') {
    penalizacionEst = -9;
  }

  // 4. Bonus por actividad reciente (últimos 7 días)
  const ahora = Date.now();
  const tieneActividadReciente = (op.actividades || []).some((a) => {
    if (!a.fecha) return false;
    const diff = ahora - new Date(a.fecha).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  });
  const bonusActividad = tieneActividadReciente ? 6 : -4;

  const total = Math.round(baseEtapa + modEncaje + penalizacionEst + bonusActividad);
  return Math.min(95, Math.max(5, total));
}

export interface InfoUrgenciaProximoPaso {
  score: number; // Mayor score = mayor urgencia (para ordenar descendente)
  diasDiferencia: number | null;
  etiqueta: string;
  nivel: 'vencido' | 'hoy' | 'urgente' | 'proximo' | 'sin_fecha' | 'cerrado';
}

/**
 * Evalúa la urgencia del próximo paso asignado a una oportunidad:
 * - Vencidos: máxima prioridad (score 2000+)
 * - Programados para hoy: alta prioridad (score 1500)
 * - Programados para mañana / próximos días: ordenados cronológicamente
 * - Sin fecha agendada: alerta de abandono (score 850)
 * - Tratos cerrados: prioridad neutra
 */
export function calcularUrgenciaProximoPaso(op: {
  etapa: EtapaOportunidad;
  proximoPaso?: { accion?: string; fecha?: string };
  historialEtapas?: Array<{ etapa: EtapaOportunidad | string; fecha: string }>;
}): InfoUrgenciaProximoPaso {
  if (op.etapa === 'Ganado' || op.etapa === 'Perdido') {
    return {
      score: -1000,
      diasDiferencia: null,
      etiqueta: 'Cerrado',
      nivel: 'cerrado',
    };
  }

  const fechaStr = op.proximoPaso?.fecha;
  if (!fechaStr) {
    const diasSinPaso = calcularDiasEnEtapa(op.historialEtapas);
    return {
      score: 850 + Math.min(diasSinPaso, 30),
      diasDiferencia: null,
      etiqueta: diasSinPaso > 0 ? `Sin fecha (${diasSinPaso}d)` : 'Sin fecha',
      nivel: 'sin_fecha',
    };
  }

  // Normalizar fechas al inicio del día
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaPaso = new Date(fechaStr);
  fechaPaso.setHours(0, 0, 0, 0);

  const diffMs = fechaPaso.getTime() - hoy.getTime();
  const diasDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diasDiff < 0) {
    const diasVencido = Math.abs(diasDiff);
    return {
      score: 2000 + diasVencido * 10,
      diasDiferencia: diasDiff,
      etiqueta: diasVencido === 1 ? 'Vencido ayer' : `Vencido hace ${diasVencido}d`,
      nivel: 'vencido',
    };
  }

  if (diasDiff === 0) {
    return {
      score: 1500,
      diasDiferencia: 0,
      etiqueta: '¡Toca hoy!',
      nivel: 'hoy',
    };
  }

  if (diasDiff === 1) {
    return {
      score: 1200,
      diasDiferencia: 1,
      etiqueta: 'Mañana',
      nivel: 'urgente',
    };
  }

  if (diasDiff <= 3) {
    return {
      score: 1000 - diasDiff * 10,
      diasDiferencia: diasDiff,
      etiqueta: `En ${diasDiff} días`,
      nivel: 'urgente',
    };
  }

  if (diasDiff <= 7) {
    return {
      score: 800 - diasDiff * 10,
      diasDiferencia: diasDiff,
      etiqueta: `En ${diasDiff} días`,
      nivel: 'proximo',
    };
  }

  return {
    score: Math.max(10, 500 - diasDiff * 5),
    diasDiferencia: diasDiff,
    etiqueta: `En ${diasDiff} días`,
    nivel: 'proximo',
  };
}

