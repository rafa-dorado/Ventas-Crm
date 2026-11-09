import {
  Centro,
  ConfiguracionCRM,
  Contacto,
  EstadoCRM,
  Juego,
  Oportunidad,
} from '../types';
import { calcularProductoSugerido } from '../utils/crmHelpers';

const ahora = new Date();
const haceDias = (dias: number) => {
  const d = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString();
};
const enDias = (dias: number) => {
  const d = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
};

export const DEFAULT_CONFIG: ConfiguracionCRM = {
  fichaICP: {
    quien: 'quien dirige la innovación en un centro de FP o en un colegio privado o concertado, y tiene capacidad para decidir o influir.',
    problema: 'los alumnos abandonan o llegan sin preparar a las prácticas, y el centro necesita diferenciarse.',
    donde: 'en jornadas de FP, en las redes de centros innovadores, en LinkedIn y a través de docentes que ya usan el plan gratuito.',
    comoCompra: 've una demo de 5 minutos, hace un piloto de 2 espacios en 3 días y firma un plan Teams o un proyecto.',
    noEncaja: 'si quiere gafas VR o un uso clínico, si es una multinacional pura o si solo quiere un desarrollo a medida sin catálogo.',
  },
  pesosICP: {
    decisor: 5,
    dinero: 4,
    segmento: 4,
    dolor: 3,
    catalogo: 3,
  },
  probabilidades: {
    Detectado: 10,
    Demo: 25,
    Piloto: 50,
    Propuesta: 70,
    Ganado: 100,
    Perdido: 0,
  },
  objetivoVentas: 100000,
  cuadrantesEmpatiaCompletados: {
    'op-1': [true, true, true, true, true, true],
    'op-2': [true, true, true, false, false, false],
    'op-3': [true, true, false, false, false, false],
  },
  notificacionesNavegador: true,
};

const hoyStr = ahora.toISOString().split('T')[0];
const semanaStr = `${ahora.getFullYear()}-W${Math.ceil((ahora.getDate() + 6) / 7)}`;
const mesStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

export const DEFAULT_JUEGO: Juego = {
  xp: 320,
  nivel: 'Esfera',
  historialXP: [
    { fecha: haceDias(12), xp: 10, motivo: 'Bienvenida al CRM Eonesia' },
    { fecha: haceDias(10), xp: 10, motivo: 'Primera vez en etapa Demo (CIFP Valle Alto)' },
    { fecha: haceDias(8), xp: 10, motivo: 'Primera vez en etapa Piloto (CIFP Valle Alto)' },
    { fecha: haceDias(6), xp: 5, motivo: 'Actividad: demo técnica con Departamento de Mecatrónica' },
    { fecha: haceDias(5), xp: 10, motivo: 'Primera vez en etapa Propuesta (CIFP Valle Alto)' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Piensa y siente' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Ve' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Oye' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Dice y hace' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Dolores' },
    { fecha: haceDias(4), xp: 8, motivo: 'Completado cuadrante de empatía: Alegrías' },
    { fecha: haceDias(4), xp: 20, motivo: '¡Mapa de empatía de 6 cuadrantes completado al 100%!' },
    { fecha: haceDias(2), xp: 10, motivo: 'Primera vez en etapa Ganado (Colegio San Ireneo)' },
    { fecha: haceDias(1), xp: 5, motivo: 'Actividad: reunión de seguimiento de propuesta' },
  ],
  insignias: ['Primer Piloto', 'Explorador ICP', 'Maestro de la Demo', 'Cerrador de Red'],
  retos: [
    'Lanzar 2 pilotos esta semana',
    'Completar el encaje de 5 centros',
    'Conseguir 1 recomendación de Consejería',
  ],
  misiones: [
    'Avanza 2 oportunidades de etapa',
    'Registra 2 actividades con centros',
    'Completa 1 cuadrante de empatía',
  ],
  xpHoyProspeccion: { fecha: hoyStr, xp: 0 },
  primerasVeces: {
    'primer_contacto': { fecha: haceDias(28), reclamada: true },
    'primera_demo': { fecha: haceDias(20), reclamada: true },
    'primer_piloto': { fecha: haceDias(12), reclamada: true },
    'primera_propuesta': { fecha: haceDias(5), reclamada: true },
    'primer_cierre': { fecha: haceDias(2), reclamada: true },
    'primer_centro_prospectado': { fecha: haceDias(20), reclamada: true },
  },
  misionesHoy: {
    fecha: hoyStr,
    etapasAvanzadas: 1,
    actividadesRegistradas: 2,
    cuadrantesCompletados: 1,
    reclamadas: {
      'mision_actividades': true,
    },
  },
  retosSemanales: {
    semanaId: semanaStr,
    multiplicadores: {
      'avanzar_5': 1,
      'actividades_10': 1,
      'centros_10': 1,
    },
    reclamados: {},
    cofreReclamado: false,
  },
  retosMensuales: {
    mesId: mesStr,
    multiplicadores: {
      'demos_3': 1,
      'piloto_1': 1,
      'propuestas_2': 1,
    },
    reclamados: {},
    cofreReclamado: false,
  },
  insigniasPersonalizadas: [
    {
      id: 'ins-1',
      nombre: 'Club 10K',
      descripcion: 'Cerrar una oportunidad o superar 10.000 € en valor ganado',
      tipoCondicion: 'automatica',
      metrica: 'valor_ganado',
      umbral: 10000,
      periodo: 'total',
      conseguida: false,
    },
    {
      id: 'ins-2',
      nombre: 'Pionero de FP',
      descripcion: 'Conseguir 3 o más centros de FP integrados en el embudo',
      tipoCondicion: 'automatica',
      metrica: 'centros',
      umbral: 3,
      periodo: 'total',
      conseguida: false,
    },
    {
      id: 'ins-3',
      nombre: 'Empatía Suprema',
      descripcion: 'Completar 3 mapas de empatía íntegros de 6 cuadrantes',
      tipoCondicion: 'automatica',
      metrica: 'mapas',
      umbral: 3,
      periodo: 'total',
      conseguida: false,
    },
  ],
  seriesReclamadas: {
    'cerrador': [true, false, false],
    'constante': [false, false, false],
    'cartografo': [false, false, false],
    'empatico': [false, false, false],
    'prospector': [false, false, false],
  },
};

export function generarDatosEjemplo(): {
  centros: Centro[];
  contactos: Contacto[];
  oportunidades: Oportunidad[];
} {
  const centros: Centro[] = [
    {
      id: 'c-1',
      nombre: 'CIFP Valle Alto',
      tipo: 'FP',
      provincia: 'Córdoba',
      alumnos: 1250,
      web: 'https://cifpvallealto.es',
      externalId: 'EXT-FP-COR-01',
      origen: 'manual',
      verificado: true,
      creadoEn: haceDias(28),
    },
    {
      id: 'c-2',
      nombre: 'Colegio Los Olivos',
      tipo: 'Privado',
      provincia: 'Sevilla',
      alumnos: 890,
      web: 'https://colegiolosolivos.edu.es',
      externalId: 'EXT-PRI-SEV-02',
      origen: 'prospeccion',
      verificado: true,
      creadoEn: haceDias(20),
    },
    {
      id: 'c-3',
      nombre: 'Colegio San Ireneo',
      tipo: 'Concertado',
      provincia: 'Málaga',
      alumnos: 1100,
      web: 'https://sanireneomalaga.org',
      red: 'Red Escuelas del Sur (14 centros)',
      externalId: 'EXT-CON-MAL-03',
      origen: 'manual',
      verificado: true,
      creadoEn: haceDias(35),
    },
    {
      id: 'c-4',
      nombre: 'Universidad Atlántica Online',
      tipo: 'Universidad',
      provincia: 'Madrid',
      alumnos: 8400,
      web: 'https://universidadatlantica.es',
      externalId: 'EXT-UNI-MAD-04',
      origen: 'prospeccion',
      verificado: false,
      creadoEn: haceDias(15),
    },
    {
      id: 'c-5',
      nombre: 'Editorial Brújula',
      tipo: 'Editorial',
      provincia: 'Barcelona',
      alumnos: 35000,
      web: 'https://editorialbrujula.com',
      externalId: 'EXT-EDI-BCN-05',
      origen: 'manual',
      verificado: true,
      creadoEn: haceDias(40),
    },
    {
      id: 'c-6',
      nombre: 'Agencia de Innovación del Sur',
      tipo: 'Institucional',
      provincia: 'Sevilla',
      alumnos: 5000,
      web: 'https://innovacionsur.andalucia.es',
      externalId: 'EXT-INS-SEV-06',
      origen: 'manual',
      verificado: true,
      creadoEn: haceDias(50),
    },
    {
      id: 'c-7',
      nombre: 'IES Mirador',
      tipo: 'Publico',
      provincia: 'Jaén',
      alumnos: 650,
      web: 'https://iesmirador.es',
      externalId: 'EXT-PUB-JAE-07',
      origen: 'manual',
      verificado: false,
      creadoEn: haceDias(8),
    },
    {
      id: 'c-8',
      nombre: 'CIFP Puerto Nuevo',
      tipo: 'FP',
      provincia: 'Cádiz',
      alumnos: 1400,
      web: 'https://cifppuertonuevo.es',
      externalId: 'EXT-FP-CAD-08',
      origen: 'prospeccion',
      verificado: true,
      creadoEn: haceDias(22),
    },
  ];

  const contactos: Contacto[] = [
    {
      id: 'ct-1',
      centroId: 'c-1',
      nombre: 'Marta Delgado Gómez',
      cargo: 'Jefa de Estudios y Coord. Innovación FP Dual',
      email: 'marta.delgado@cifpvallealto.es',
      rol: 'Decisor',
    },
    {
      id: 'ct-2',
      centroId: 'c-2',
      nombre: 'Gonzalo Rivas Peña',
      cargo: 'Director Pedagógico y Nuevas Tecnologías',
      email: 'grivas@colegiolosolivos.edu.es',
      rol: 'Decisor',
    },
    {
      id: 'ct-3',
      centroId: 'c-3',
      nombre: 'Hermana Teresa Morales',
      cargo: 'Coordinadora TIC de Zona Red Escuelas',
      email: 'tmorales@sanireneomalaga.org',
      rol: 'Influyente',
    },
    {
      id: 'ct-4',
      centroId: 'c-4',
      nombre: 'Dr. Alejandro Varela',
      cargo: 'Vicerrector de Aprendizaje Digital y Campus Virtual',
      email: 'avarela@universidadatlantica.es',
      rol: 'Decisor',
    },
    {
      id: 'ct-5',
      centroId: 'c-5',
      nombre: 'Carla Soler Vidal',
      cargo: 'Directora de Contenidos Digitales y Nuevos Formatos',
      email: 'csoler@editorialbrujula.com',
      rol: 'Decisor',
    },
    {
      id: 'ct-6',
      centroId: 'c-6',
      nombre: 'Javier Benítez Ruiz',
      cargo: 'Jefe de Servicio de Programas de Competencias Digitales',
      email: 'javier.benitez@innovacionsur.andalucia.es',
      rol: 'Influyente',
    },
    {
      id: 'ct-7',
      centroId: 'c-7',
      nombre: 'Laura Morales Prieto',
      cargo: 'Profesora de Tecnología y Dinamizadora STEAM',
      email: 'lmorales@iesmirador.es',
      rol: 'Usuario',
    },
    {
      id: 'ct-8',
      centroId: 'c-8',
      nombre: 'Antonio Marín Saavedra',
      cargo: 'Director del Centro Integrado',
      email: 'director@cifppuertonuevo.es',
      rol: 'Decisor',
    },
  ];

  const oportunidades: Oportunidad[] = [
    {
      id: 'op-1',
      centroId: 'c-1',
      contactoIds: ['ct-1'],
      etapa: 'Propuesta',
      valor: 12000,
      dolor: 'Alumnos sin preparar para prácticas',
      productoSugerido: calcularProductoSugerido('FP', 'Alumnos sin preparar para prácticas').producto,
      productoElegido: 'Troncales FP (Mundo vacío + Mundo con contenido)',
      criterios: [1, 1, 1, 1, 1], // 100% encaje
      empatia: [
        'Le preocupa que las empresas de FP dual rechacen alumnos por falta de horas previas en simuladores industriales reales.',
        'Ve cómo otros centros privados ganan matrícula promocionando laboratorios modernos.',
        'Oye a los docentes quejarse de la escasez de presupuesto para maquinaria física cara y peligrosa.',
        'Dice que necesitan soluciones web directas que funcionen en portátiles sencillos sin comprar cascos caros.',
        'Miedo al rechazo del claustro y a plataformas complejas con curvas de aprendizaje eternas.',
        'Lograr que el 100% de los estudiantes hagan prácticas inmersivas antes de pisar el taller real.',
      ],
      proximoPaso: {
        accion: 'Llamada para revisar aprobación de presupuesto con gerencia',
        fecha: hoyStr,
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(28) },
        { etapa: 'Demo', fecha: haceDias(20) },
        { etapa: 'Piloto', fecha: haceDias(12) },
        { etapa: 'Propuesta', fecha: haceDias(5) },
      ],
      actividades: [
        { tipo: 'reunion', fecha: haceDias(5), nota: 'Enviada propuesta formal de 12.000 € para 3 ciclos formativos.' },
        { tipo: 'demo', fecha: haceDias(12), nota: 'Demo técnica del mundo de Electricidad y Neumática. Feedback excelente.' },
        { tipo: 'llamada', fecha: haceDias(20), nota: 'Marta confirma que tienen partida de modernización FP.' },
      ],
      creadoEn: haceDias(28),
    },
    {
      id: 'op-2',
      centroId: 'c-2',
      contactoIds: ['ct-2'],
      etapa: 'Demo',
      valor: 4200,
      dolor: 'Captar familias',
      productoSugerido: calcularProductoSugerido('Privado', 'Captar familias').producto,
      productoElegido: 'Plan Centro completo 349 €/mes',
      criterios: [1, 1, 1, 0.5, 1], // ~90% encaje
      empatia: [
        'Desea un reclamo tecnológico puntero en las jornadas de puertas abiertas para diferenciar el colegio.',
        'Ve folletos de colegios británicos cercanos con realidad virtual y espacios interactivos.',
        'Oye a las familias jóvenes preguntar por metodologías activas y tecnología educativa real.',
        'Pregunta si los padres pueden entrar desde el móvil a ver los proyectos 3D de sus hijos.',
        'No querer una solución que requiera gafas VR ni soporte técnico continuo.',
        'Cerrar matrículas de primaria y secundaria antes de junio con un proyecto estrella.',
      ],
      proximoPaso: {
        accion: 'Sesión demo con el claustro de ciencias y el Director General',
        fecha: haceDias(1),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(20) },
        { etapa: 'Demo', fecha: haceDias(4) },
      ],
      actividades: [
        { tipo: 'llamada', fecha: haceDias(6), nota: 'Conversación inicial muy positiva. Quieren ver el aula inmersiva en marcha.' },
      ],
      creadoEn: haceDias(20),
    },
    {
      id: 'op-3',
      centroId: 'c-3',
      contactoIds: ['ct-3'],
      etapa: 'Ganado',
      valor: 1428,
      dolor: 'Diferenciarse en licitaciones',
      productoSugerido: calcularProductoSugerido('Concertado', 'Diferenciarse en licitaciones', 'Red Escuelas del Sur').producto,
      productoElegido: 'Piloto de red',
      criterios: [0.5, 1, 0.5, 0.5, 1], // ~68% encaje
      empatia: [
        'Busca un proyecto común que unifique la propuesta pedagógica de los 14 colegios de la red.',
        'Ve dispersión: cada centro usa herramientas distintas sin coherencia de marca.',
        'Oye a los directores pedir actividades motivadoras que no den problemas de RGPD ni cuentas complejas.',
        'Propone empezar con un piloto de 1.428 € en San Ireneo para escalarlo al resto en septiembre.',
        'Burocracia del patronato para autorizar contratos grandes de golpe.',
        'Tener un caso de éxito medible para presentar a la asamblea anual de la red.',
      ],
      proximoPaso: {
        accion: 'Sesión de onboarding del profesorado y entrega de credenciales',
        fecha: enDias(5),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(35) },
        { etapa: 'Demo', fecha: haceDias(25) },
        { etapa: 'Piloto', fecha: haceDias(15) },
        { etapa: 'Propuesta', fecha: haceDias(8) },
        { etapa: 'Ganado', fecha: haceDias(2) },
      ],
      actividades: [
        { tipo: 'email', fecha: haceDias(2), nota: 'Firma electrónica recibida. Factura proforma emitida.' },
        { tipo: 'reunion', fecha: haceDias(8), nota: 'Reunión con patronato de la fundación educativa.' },
      ],
      creadoEn: haceDias(35),
      cerradoEn: haceDias(2),
    },
    {
      id: 'op-4',
      centroId: 'c-4',
      contactoIds: ['ct-4'],
      etapa: 'Piloto',
      valor: 9500,
      dolor: 'Abandono del alumnado',
      productoSugerido: calcularProductoSugerido('Universidad', 'Abandono del alumnado').producto,
      productoElegido: 'Licencia Universidad desde 4.900 €/año + Marketplace',
      criterios: [1, 0.5, 0.5, 1, 0.5], // ~70% encaje
      empatia: [
        'En los grados online la tasa de abandono en primer curso llega al 38% por aislamiento y falta de pertenencia.',
        'Ve estudiantes que nunca interactúan en foros tradicionales de Moodle.',
        'Oye a los alumnos pedir clases prácticas más sociales y cercanas.',
        'Quiere crear un campus virtual 3D donde los alumnos se encuentren y hagan prácticas conjuntas.',
        'Resistencia al cambio de los catedráticos tradicionales.',
        'Aumentar la retención un 15% y posicionar la universidad como pionera.',
      ],
      proximoPaso: {
        accion: 'Reunión de balance del piloto de 3 semanas con decanato',
        fecha: enDias(4),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(15) },
        { etapa: 'Demo', fecha: haceDias(10) },
        { etapa: 'Piloto', fecha: haceDias(3) },
      ],
      actividades: [
        { tipo: 'demo', fecha: haceDias(10), nota: 'Taller práctico con 4 profesores del grado de Ingeniería Informática.' },
      ],
      creadoEn: haceDias(15),
    },
    {
      id: 'op-5',
      centroId: 'c-5',
      contactoIds: ['ct-5'],
      etapa: 'Piloto',
      valor: 33600,
      dolor: 'Diferenciarse en licitaciones',
      productoSugerido: calcularProductoSugerido('Editorial', 'Diferenciarse en licitaciones').producto,
      productoElegido: 'Marca blanca / RevShare',
      criterios: [1, 1, 0.5, 1, 1], // ~92% encaje
      empatia: [
        'Los libros de texto digitales en PDF enriquecido ya no sorprenden a nadie ni justifican su precio.',
        'Ve a las grandes editoriales perdiendo licitaciones públicas de contenidos interactivos.',
        'Oye a los colegios pedir recursos inmersivos listos para usar en pizarra digital y ordenadores.',
        'Quieren integrar los mundos de Eonesia dentro de su plataforma LMS corporativa con SSO.',
        'Plazos de entrega muy ajustados para la campaña escolar del próximo curso.',
        'Convertirse en la editorial de referencia con contenido 3D homologado en España.',
      ],
      proximoPaso: {
        accion: 'Validación de la integración técnica LTI/SSO con equipo de desarrollo',
        fecha: haceDias(2),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(40) },
        { etapa: 'Demo', fecha: haceDias(28) },
        { etapa: 'Piloto', fecha: haceDias(7) },
      ],
      actividades: [
        { tipo: 'reunion', fecha: haceDias(7), nota: 'Lanzamiento del piloto de 2 unidades didácticas de Biología.' },
      ],
      creadoEn: haceDias(40),
    },
    {
      id: 'op-6',
      centroId: 'c-6',
      contactoIds: ['ct-6'],
      etapa: 'Propuesta',
      valor: 45000,
      dolor: 'Fondos por ejecutar',
      productoSugerido: calcularProductoSugerido('Institucional', 'Fondos por ejecutar').producto,
      productoElegido: 'Proyecto por fases',
      criterios: [0.5, 0.5, 0, 1, 1], // ~55% encaje
      empatia: [
        'Tienen partida de fondos europeos MRR que vence a final de año y deben certificar resultados tangibles.',
        'Ven convocatorias públicas desiertas por requisitos técnicos desmedidos.',
        'Oyen instrucciones directas de la dirección general para ejecutar presupuesto en innovación educativa.',
        'Solicitan una memoria técnica detallada con justificación de impacto en 20 municipios.',
        'Tiempos de fiscalización e intervención económica pública.',
        'Entregar un proyecto emblemático de divulgación tecnológica sin incidencias.',
      ],
      proximoPaso: {
        accion: 'Envío del anexo de desglose de hitos para la licitación menor',
        fecha: enDias(6),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(50) },
        { etapa: 'Demo', fecha: haceDias(35) },
        { etapa: 'Piloto', fecha: haceDias(20) },
        { etapa: 'Propuesta', fecha: haceDias(9) },
      ],
      actividades: [
        { tipo: 'email', fecha: haceDias(9), nota: 'Borrador de pliego técnico enviado para revisión jurídica.' },
      ],
      creadoEn: haceDias(50),
    },
    {
      id: 'op-7',
      centroId: 'c-7',
      contactoIds: ['ct-7'],
      etapa: 'Detectado',
      valor: 0,
      dolor: 'Abandono del alumnado',
      productoSugerido: calcularProductoSugerido('Publico', 'Abandono del alumnado').producto,
      productoElegido: 'Plan Explorador gratis + vía Consejería',
      criterios: [0, 0, 0, 0.5, 0.5], // ~15% encaje
      empatia: [
        'Docente muy motivada que busca recursos interactivos gratuitos para evitar que los chicos desconecten.',
        'Ve alumnos aburridos con libros tradicionales en materias STEM.',
        'Oye al equipo directivo decir que no hay ni un euro de presupuesto para licencias.',
        'Pide acceso para probarlo ella misma con su clase de 4º de ESO.',
        'Imposibilidad de contratar nada directamente desde el centro sin la delegación provincial.',
        'Tener una herramienta que despierte vocaciones científicas en su aula.',
      ],
      proximoPaso: {
        accion: 'Enviar enlace de activación al Plan Explorador docente',
        fecha: enDias(2),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(8) },
      ],
      actividades: [
        { tipo: 'email', fecha: haceDias(8), nota: 'Contacto entrante desde formulario web docente.' },
      ],
      creadoEn: haceDias(8),
    },
    {
      id: 'op-8',
      centroId: 'c-8',
      contactoIds: ['ct-8'],
      etapa: 'Perdido',
      valor: 18000,
      dolor: 'Alumnos sin preparar para prácticas',
      productoSugerido: calcularProductoSugerido('FP', 'Alumnos sin preparar para prácticas').producto,
      productoElegido: 'Troncales FP (Mundo vacío + Mundo con contenido)',
      motivoPerdida: 'momento',
      criterios: [1, 0.5, 1, 0.5, 1], // ~80% encaje
      empatia: [
        'Interesados en la propuesta pero acaban de cambiar de equipo directivo en el CIFP.',
        'Ven necesidad urgente pero tienen la plantilla en huelga y auditoría pendiente.',
        'Oyen que el nuevo director prefiere congelar nuevos convenios hasta el curso 2027.',
        'Dijeron que retomaremos contacto formal en noviembre.',
        'Falta de estabilidad interna para pilotar durante este trimestre.',
        'Poder retomar con tranquilidad cuando se asiente la nueva dirección.',
      ],
      proximoPaso: {
        accion: 'Recordatorio en agenda para retomar contacto en nuevo curso',
        fecha: enDias(90),
      },
      historialEtapas: [
        { etapa: 'Detectado', fecha: haceDias(22) },
        { etapa: 'Demo', fecha: haceDias(16) },
        { etapa: 'Perdido', fecha: haceDias(3) },
      ],
      actividades: [
        { tipo: 'llamada', fecha: haceDias(3), nota: 'Antonio explica que por reestructuración interna no pueden contratar ahora.' },
      ],
      creadoEn: haceDias(22),
      cerradoEn: haceDias(3),
    },
  ];

  return { centros, contactos, oportunidades };
}

export function crearEstadoInicial(): EstadoCRM {
  const { centros, contactos, oportunidades } = generarDatosEjemplo();
  return {
    centros,
    contactos,
    oportunidades,
    juego: DEFAULT_JUEGO,
    config: DEFAULT_CONFIG,
    esDatosEjemplo: true,
  };
}
