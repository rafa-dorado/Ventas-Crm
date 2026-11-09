export type TipoCentro = 
  | 'FP' 
  | 'Privado' 
  | 'Concertado' 
  | 'Publico' 
  | 'Universidad' 
  | 'Editorial' 
  | 'Institucional';

export type OrigenCentro = 'manual' | 'prospeccion' | 'csv' | 'json';

export interface Centro {
  id: string;
  nombre: string;
  tipo: TipoCentro;
  provincia: string;
  alumnos: number;
  web: string;
  red?: string;
  externalId?: string;
  origen: OrigenCentro;
  verificado: boolean;
  creadoEn: string;
}

export type RolContacto = 'Decisor' | 'Influyente' | 'Usuario';

export interface Contacto {
  id: string;
  centroId: string;
  nombre: string;
  cargo: string;
  email: string;
  rol: RolContacto;
}

export type EtapaOportunidad = 
  | 'Detectado' 
  | 'Demo' 
  | 'Piloto' 
  | 'Propuesta' 
  | 'Ganado' 
  | 'Perdido';

export type DolorPrincipal = 
  | 'Abandono del alumnado'
  | 'Alumnos sin preparar para prácticas'
  | 'Captar familias'
  | 'Fondos por ejecutar'
  | 'Diferenciarse en licitaciones'
  | 'Otro';

export type MotivoPerdida = 
  | 'precio' 
  | 'momento' 
  | 'competencia' 
  | 'no encaja' 
  | 'sin respuesta' 
  | 'otro';

export type TipoActividad =
  | 'llamada'
  | 'email'
  | 'reunion'
  | 'demo'
  | 'propuesta'
  | 'whatsapp'
  | 'nota'
  | 'otro';

export interface Actividad {
  id?: string;
  tipo: TipoActividad;
  fecha: string;
  autor?: string;
  titulo?: string;
  nota: string;
  resultado?: 'favorable' | 'pendiente' | 'desfavorable' | 'completada';
  duracionMinutos?: number;
  enlacePropuesta?: string;
}

export interface PropuestaComercial {
  id: string;
  oportunidadId: string;
  numero: string;
  fecha: string;
  validezDias: number;
  paquete: 'piloto_trimestral' | 'campus_anual' | 'pack_docente' | 'espacio_personalizado';
  tituloPaquete: string;
  precioBase: number;
  descuentoPct: number;
  precioFinal: number;
  incluyeIva: boolean;
  aulas: number;
  alumnosEstimados: number;
  enlaceEspacioDemo: string;
  condiciones: string;
}

export interface HistorialEtapa {
  etapa: EtapaOportunidad;
  fecha: string;
}

export type CriterioValor = 0 | 0.5 | 1 | null;
export type CriteriosOportunidad = [
  CriterioValor, // 0: Acceso al decisor
  CriterioValor, // 1: Dinero disponible
  CriterioValor, // 2: Prioridad del segmento
  CriterioValor, // 3: Dolor activo
  CriterioValor  // 4: Encaje con el catálogo
];

export type MapaEmpatia = [
  string, // 0: Piensa y siente
  string, // 1: Ve
  string, // 2: Oye
  string, // 3: Dice y hace
  string, // 4: Dolores
  string  // 5: Alegrías
];

export interface Oportunidad {
  id: string;
  centroId: string;
  contactoIds: string[];
  etapa: EtapaOportunidad;
  valor: number;
  dolor: DolorPrincipal;
  productoSugerido: string;
  productoElegido: string;
  criterios: CriteriosOportunidad;
  empatia: MapaEmpatia;
  proximoPaso: {
    accion: string;
    fecha: string;
  };
  historialEtapas: HistorialEtapa[];
  actividades: Actividad[];
  motivoPerdida?: MotivoPerdida;
  creadoEn: string;
  cerradoEn?: string;
}

export interface RegistroXP {
  fecha: string;
  xp: number;
  motivo: string;
}

export type GradoSerie = 'bloqueado' | 'bronce' | 'plata' | 'oro';

export interface SerieLogro {
  id: string;
  titulo: string;
  descripcion: string;
  metricaActual: number;
  umbrales: [number, number, number]; // bronce, plata, oro
  xpGrados: [number, number, number]; // 20, 50, 100
  gradoAlcanzado: GradoSerie;
  reclamado: [boolean, boolean, boolean];
}

export interface PrimeraVezItem {
  id: string;
  titulo: string;
  descripcion: string;
  conseguida: boolean;
  fecha?: string;
  reclamada: boolean;
}

export interface RetoDef {
  id: string;
  titulo: string;
  descripcion: string;
  objetivoBase: number;
  multiplicador: number; // 0.5 (mitad), 1 (normal), 3 (triple)
  actual: number;
  xp: number;
  reclamado: boolean;
  periodo: 'semanal' | 'mensual';
}

export interface CofreProgreso {
  reclamado: boolean;
  fechaReclamo?: string;
  sello?: string;
  insigniaMes?: string;
}

export type MetricaInsignia = 
  | 'ganadas' 
  | 'demos' 
  | 'actividades' 
  | 'centros' 
  | 'mapas' 
  | 'valor_ganado';

export interface InsigniaPersonalizada {
  id: string;
  nombre: string;
  descripcion: string;
  tipoCondicion: 'automatica' | 'manual';
  metrica?: MetricaInsignia;
  umbral?: number;
  periodo?: 'total' | 'este_mes';
  conseguida: boolean;
  fechaConseguida?: string;
  colorHex?: string;
  anillos?: number;
  rotacion?: number;
}

export interface MisionDiaria {
  id: string;
  titulo: string;
  objetivo: number;
  actual: number;
  completada: boolean;
  reclamada: boolean;
  xp: number;
}

export interface Juego {
  xp: number;
  nivel: string;
  historialXP: RegistroXP[];
  insignias: string[];
  retos: string[];
  misiones: string[];
  
  // Detalle del sistema de juego
  xpHoyProspeccion: { fecha: string; xp: number };
  primerasVeces: Record<string, { fecha: string; reclamada: boolean }>;
  misionesHoy: {
    fecha: string;
    etapasAvanzadas: number;
    actividadesRegistradas: number;
    cuadrantesCompletados: number;
    reclamadas: Record<string, boolean>;
  };
  retosSemanales: {
    semanaId: string; // ej. 2026-W45
    multiplicadores: Record<string, number>; // id -> 0.5 | 1 | 3
    reclamados: Record<string, boolean>;
    cofreReclamado: boolean;
    cofreFecha?: string;
  };
  retosMensuales: {
    mesId: string; // ej. 2026-11
    multiplicadores: Record<string, number>;
    reclamados: Record<string, boolean>;
    cofreReclamado: boolean;
    cofreFecha?: string;
  };
  insigniasPersonalizadas: InsigniaPersonalizada[];
  seriesReclamadas: Record<string, [boolean, boolean, boolean]>; // serieId -> [bronce, plata, oro]
}

export interface FichaICP {
  quien: string;
  problema: string;
  donde: string;
  comoCompra: string;
  noEncaja: string;
}

export interface PesosICP {
  decisor: number;   // 1 a 5
  dinero: number;    // 1 a 5
  segmento: number;  // 1 a 5
  dolor: number;     // 1 a 5
  catalogo: number;  // 1 a 5
}

export interface ProbabilidadesEtapa {
  Detectado: number;
  Demo: number;
  Piloto: number;
  Propuesta: number;
  Ganado: number;
  Perdido: number;
}

export interface ConfiguracionCRM {
  fichaICP: FichaICP;
  pesosICP: PesosICP;
  probabilidades: ProbabilidadesEtapa;
  objetivoVentas: number;
  cuadrantesEmpatiaCompletados: Record<string, boolean[]>; // oportunidadId -> [true, ...]
  notificacionesNavegador?: boolean; // Preferencia del usuario para avisos de escritorio
}

export interface EstadoCRM {
  centros: Centro[];
  contactos: Contacto[];
  oportunidades: Oportunidad[];
  juego: Juego;
  config: ConfiguracionCRM;
  esDatosEjemplo: boolean;
}

export interface RespaldoCifradoInfo {
  id: string;
  timestamp: string;
  motivo: string;
  totalCentros: number;
  totalOportunidades: number;
  valorTotal: number;
  tamanoBytes: number;
}

export interface RespaldoCifrado {
  id: string;
  timestamp: string;
  motivo: string;
  totalCentros: number;
  totalOportunidades: number;
  valorTotal: number;
  tamanoBytes: number;
  iv: string;
  checksum: string;
  payload: string;
}

export type CriterioOrdenTablero =
  | 'defecto'
  | 'probabilidad'
  | 'urgencia'
  | 'encaje'
  | 'valor';


