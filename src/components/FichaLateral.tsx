import React, { useEffect, useState } from 'react';
import {
  Actividad,
  Centro,
  Contacto,
  CriterioValor,
  DolorPrincipal,
  EstadoCRM,
  EtapaOportunidad,
  Oportunidad,
  RolContacto,
  TipoActividad,
  TipoCentro,
} from '../types';
import { crmRepo } from '../repo';
import {
  calcularEncajeICP,
  calcularProductoSugerido,
  COLORES_TIPO_CENTRO,
  ETAPAS_ORDEN,
  evaluarWinInsight,
  formatearEuros,
  formatearFecha,
} from '../utils/crmHelpers';
import { AnilloEncaje } from './common/AnilloEncaje';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  User,
  X,
  FileText,
  Sparkles,
  Download,
  AlertTriangle,
  Phone,
  Video,
  MessageSquare,
  Printer,
  FileSpreadsheet,
  Percent,
  Check,
  Share2,
  CalendarPlus,
  Zap,
} from 'lucide-react';

export const PAQUETES_PROPUESTAS = [
  {
    id: 'piloto_trimestral' as const,
    nombre: 'Piloto Trimestral WebXR (3 Aulas)',
    precioBase: 2450,
    aulasDefault: 3,
    descripcion: 'Acceso completo a catálogo de troncales FP / Colegios por 90 días, soporte pedagógico inicial y formación de 2 docentes coordinadores.',
    idealPara: 'Centros con dudas o procesos de homologación que quieren verificar resultados antes de la inversión anual.',
  },
  {
    id: 'campus_anual' as const,
    nombre: 'Campus Virtual Inmersivo Anual Completo',
    precioBase: 9800,
    aulasDefault: 12,
    descripcion: 'Licencia institucional para todo el centro. Aulas y alumnos ilimitados, acceso a todos los mundos WebXR, branding y dominio personalizado, métricas de retención y analítica de uso.',
    idealPara: 'Colegios privados, concertados y facultades que buscan diferenciación en captación y puertas abiertas.',
  },
  {
    id: 'pack_docente' as const,
    nombre: 'Pack Innovación & Formación Docente Homologada',
    precioBase: 4900,
    aulasDefault: 5,
    descripcion: '5 licencias de aula WebXR + 20 horas de taller práctico acreditado en LOMLOE para claustro docente con dinámicas inmersivas guiadas.',
    idealPara: 'Centros concertados y públicos con fondos de digitalización pendientes de ejecución.',
  },
  {
    id: 'espacio_personalizado' as const,
    nombre: 'Mundo Virtual WebXR a Medida (Gemelo Digital)',
    precioBase: 14500,
    aulasDefault: 20,
    descripcion: 'Modelado y programación 3D interactiva del campus real del centro o laboratorio técnico especializado, corriendo 100% en navegador.',
    idealPara: 'Universidades e instituciones con proyectos singulares o licitaciones de innovación.',
  },
];

function tiempoRelativo(fechaISO: string): string {
  try {
    const diffMs = Date.now() - new Date(fechaISO).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Hace unos segundos';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `Hace ${diffHoras} h`;
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias === 1) return 'Ayer';
    if (diffDias < 7) return `Hace ${diffDias} días`;
    return new Date(fechaISO).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return 'Reciente';
  }
}

interface FichaLateralProps {
  oportunidadId: string | null;
  estado: EstadoCRM;
  onCerrar: () => void;
}

export const FichaLateral: React.FC<FichaLateralProps> = ({
  oportunidadId,
  estado,
  onCerrar,
}) => {
  const op = estado.oportunidades.find((o) => o.id === oportunidadId);
  const centro = op ? estado.centros.find((c) => c.id === op.centroId) : null;
  const contactos = op
    ? estado.contactos.filter((ct) => ct.centroId === op.centroId)
    : [];

  // Pestañas internas de la ficha con Timeline Omnicanal y Presupuesto integrados
  const [tabInterna, setTabInterna] = useState<
    'general' | 'actividades' | 'propuesta' | 'redactar' | 'empatia' | 'icp'
  >('general');

  // Estados de edición rápida
  const [valorInput, setValorInput] = useState<string>('');
  const [dolorSeleccionado, setDolorSeleccionado] = useState<DolorPrincipal>('Otro');
  const [productoElegido, setProductoElegido] = useState<string>('');
  const [proximoPasoAccion, setProximoPasoAccion] = useState<string>('');
  const [proximoPasoFecha, setProximoPasoFecha] = useState<string>('');

  // Estados de Timeline Omnicanal
  const [filtroActividad, setFiltroActividad] = useState<'todas' | TipoActividad>('todas');
  const [nuevaActTipo, setNuevaActTipo] = useState<TipoActividad>('llamada');
  const [nuevaActTitulo, setNuevaActTitulo] = useState('');
  const [nuevaActNota, setNuevaActNota] = useState('');
  const [nuevaActAutor, setNuevaActAutor] = useState('Rafa Dorado');
  const [nuevaActResultado, setNuevaActResultado] = useState<'favorable' | 'pendiente' | 'desfavorable' | 'completada'>('favorable');
  const [nuevaActDuracion, setNuevaActDuracion] = useState<number>(15);

  // Estados del Generador de Propuestas / Presupuestos
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<
    'piloto_trimestral' | 'campus_anual' | 'pack_docente' | 'espacio_personalizado'
  >('piloto_trimestral');
  const [descuentoPct, setDescuentoPct] = useState<number>(10);
  const [incluyeIva, setIncluyeIva] = useState<boolean>(true);
  const [aulasEstimadas, setAulasEstimadas] = useState<number>(3);
  const [condicionesPago, setCondicionesPago] = useState<string>('50% a la confirmación y 50% a la entrega del entorno virtual.');
  const [propuestaGuardadaExito, setPropuestaGuardadaExito] = useState(false);

  // Formulario nuevo contacto
  const [mostrarFormContacto, setMostrarFormContacto] = useState(false);
  const [ncNombre, setNcNombre] = useState('');
  const [ncCargo, setNcCargo] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncRol, setNcRol] = useState<RolContacto>('Decisor');

  // Redactar: plantilla y duración de calendario
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<
    'primer_contacto' | 'seguimiento' | 'propuesta'
  >('primer_contacto');
  const [plantillasEditadas, setPlantillasEditadas] = useState<{
    primer_contacto: string;
    seguimiento: string;
    propuesta: string;
  }>({
    primer_contacto: '',
    seguimiento: '',
    propuesta: '',
  });
  const [duracionMinutos, setDuracionMinutos] = useState<number>(30);
  const [textoCopiado, setTextoCopiado] = useState(false);

  // Mapa de empatía local
  const [empatiaLocal, setEmpatiaLocal] = useState<[string, string, string, string, string, string]>([
    '', '', '', '', '', '',
  ]);

  // Criterios locales
  const [criteriosLocales, setCriteriosLocales] = useState<[CriterioValor, CriterioValor, CriterioValor, CriterioValor, CriterioValor]>([
    null, null, null, null, null,
  ]);

  // Cierre con Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCerrar]);

  // --- REDACCIÓN Y ARGUMENTARIO SEGÚN TIPO DE CENTRO ---
  const obtenerArgumentoTipoCentro = (tipo: TipoCentro) => {
    switch (tipo) {
      case 'FP':
        return 'tus alumnos llegan preparados al primer día de prácticas';
      case 'Privado':
        return 'las familias lo verán en puertas abiertas';
      case 'Concertado':
        return 'por lo que cuesta una excursión al trimestre, algo que ningún cole del barrio ofrece';
      case 'Publico':
        return 'gratis para empezar, cumple LOMLOE, sin riesgo';
      case 'Universidad':
        return 'tus docentes usan los mismos enlaces; el alumno explora en vez de leer';
      case 'Editorial':
        return 'somos tu capa inmersiva, sin desarrollo ni riesgo';
      case 'Institucional':
        return 'resultados visibles, datos de impacto y justificación LOMLOE';
      default:
        return 'tus alumnos llegan preparados al primer día de prácticas';
    }
  };

  const generarTextoPlantilla = (tipoPlantilla: 'primer_contacto' | 'seguimiento' | 'propuesta') => {
    if (!centro) return '';
    const contactoPrincipal = contactos[0] || null;
    const nombreContacto = contactoPrincipal ? contactoPrincipal.nombre.split(' ')[0] : 'Estimado/a';
    const argumento = obtenerArgumentoTipoCentro(centro.tipo);
    const prod = productoElegido || op?.productoSugerido || 'Troncales FP';

    if (tipoPlantilla === 'primer_contacto') {
      return `Hola ${nombreContacto},

Te escribo porque en Eonesia ayudamos a centros como ${centro.nombre} a que ${argumento}.

Hemos desarrollado una tecnología de espacios educativos inmersivos que corre 100% en el navegador web (en cualquier ordenador o tablet sencilla, sin necesidad de comprar gafas VR ni instalar nada).

Para vuestro caso particular, el encaje directo es ${prod}.

¿Tendrías 10 minutos esta semana para una demo interactiva donde puedes entrar tú mismo/a al espacio con un enlace?

Un cordial saludo,
Equipo de Innovación Eonesia
(Para no recibir más comunicaciones responde indicando "baja")`;
    } else if (tipoPlantilla === 'seguimiento') {
      return `Hola ${nombreContacto},

Retomo nuestro contacto sobre la propuesta para ${centro.nombre}.

Como comentamos, la clave es que ${argumento}, evitando curvas de aprendizaje complejas para el profesorado.

¿Pudisteis comentar en el equipo la viabilidad de poner en marcha el piloto de ${prod}? Quedo a vuestra disposición para resolver cualquier duda técnica o pedagógica.

Un saludo cordial,
Equipo Eonesia`;
    } else {
      return `Hola ${nombreContacto},

Adjunto el resumen formal de la propuesta para ${centro.nombre}.

• Solución: ${prod}
• Inversión prevista: ${formatearEuros(op?.valor || 0)}
• Impacto clave: ${argumento}
• Despliegue: Acceso inmediato sin descarga ni requisitos de hardware especiales.

Podemos coordinar la sesión de onboarding en cuanto tengáis el visto bueno interno.

Atentamente,
Equipo Eonesia`;
    }
  };

  // Sincronizar datos al abrir o cambiar de oportunidad
  useEffect(() => {
    if (op && centro) {
      setValorInput(String(op.valor || 0));
      setDolorSeleccionado(op.dolor || 'Otro');
      setProductoElegido(op.productoElegido || op.productoSugerido || '');
      setProximoPasoAccion(op.proximoPaso?.accion || '');
      setProximoPasoFecha(op.proximoPaso?.fecha || '');
      setEmpatiaLocal([...op.empatia]);
      setCriteriosLocales([...op.criterios]);

      // Inicializar textos de las 3 plantillas editables
      setPlantillasEditadas({
        primer_contacto: generarTextoPlantilla('primer_contacto'),
        seguimiento: generarTextoPlantilla('seguimiento'),
        propuesta: generarTextoPlantilla('propuesta'),
      });
    }
  }, [op?.id, centro?.id]);

  if (!op || !centro) return null;

  const encaje = calcularEncajeICP(criteriosLocales, estado.config.pesosICP);
  const winInsight = evaluarWinInsight(op, estado.config.pesosICP);
  const colores = COLORES_TIPO_CENTRO[centro.tipo] || COLORES_TIPO_CENTRO.FP;
  const sugerencia = calcularProductoSugerido(centro.tipo, dolorSeleccionado, centro.red);
  const contactoPrincipal = contactos[0] || null;

  // Guardado de campos
  const handleGuardarCambiosGenerales = () => {
    crmRepo.actualizarOportunidad(op.id, {
      valor: Number(valorInput) || 0,
      dolor: dolorSeleccionado,
      productoElegido,
      proximoPaso: {
        accion: proximoPasoAccion.trim() || 'Llamada de seguimiento',
        fecha: proximoPasoFecha || new Date().toISOString().split('T')[0],
      },
    });
  };

  const handleCrearContacto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncNombre.trim()) return;
    const nuevo = crmRepo.anadirContacto(centro.id, {
      nombre: ncNombre.trim(),
      cargo: ncCargo.trim() || 'Innovación',
      email: ncEmail.trim(),
      rol: ncRol,
    });
    // Añadir a contactoIds de la oportunidad
    crmRepo.actualizarOportunidad(op.id, {
      contactoIds: Array.from(new Set([...op.contactoIds, nuevo.id])),
    });
    setMostrarFormContacto(false);
    setNcNombre('');
    setNcCargo('');
    setNcEmail('');
  };

  const handleRegistrarActividad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaActNota.trim()) return;
    crmRepo.registrarActividad(op.id, {
      tipo: nuevaActTipo,
      autor: nuevaActAutor,
      titulo: nuevaActTitulo.trim() || undefined,
      nota: nuevaActNota.trim(),
      resultado: nuevaActResultado,
      duracionMinutos: nuevaActDuracion,
    });
    setNuevaActNota('');
    setNuevaActTitulo('');
  };

  const handleRegistrarAccionRapida = (tipo: TipoActividad, textoDefault: string, titulo: string) => {
    crmRepo.registrarActividad(op.id, {
      tipo,
      autor: nuevaActAutor,
      titulo,
      nota: textoDefault,
      resultado: 'favorable',
      duracionMinutos: tipo === 'demo' || tipo === 'reunion' ? 30 : 10,
    });
  };

  // Cálculos dinámicos de propuesta
  const paqueteActual = PAQUETES_PROPUESTAS.find((p) => p.id === paqueteSeleccionado) || PAQUETES_PROPUESTAS[0];
  const precioBaseTotal = paqueteActual.precioBase;
  const importeDescuento = Math.round(precioBaseTotal * (descuentoPct / 100));
  const baseImponible = Math.max(0, precioBaseTotal - importeDescuento);
  const ivaTotal = incluyeIva ? Math.round(baseImponible * 0.21) : 0;
  const precioTotalPropuesta = baseImponible + ivaTotal;

  const handleGuardarPropuestaEnCRM = () => {
    // 1. Actualizar el valor de la oportunidad con la propuesta
    crmRepo.actualizarOportunidad(op.id, {
      valor: precioTotalPropuesta,
      productoElegido: paqueteActual.nombre,
      etapa: op.etapa === 'Detectado' || op.etapa === 'Demo' || op.etapa === 'Piloto' ? 'Propuesta' : op.etapa,
    });
    setValorInput(String(precioTotalPropuesta));
    setProductoElegido(paqueteActual.nombre);

    // 2. Registrar en el Timeline omnicanal
    crmRepo.registrarActividad(op.id, {
      tipo: 'propuesta',
      autor: nuevaActAutor,
      titulo: `Propuesta formal generada: ${paqueteActual.nombre}`,
      nota: `Presupuesto formal emitido por importe de ${formatearEuros(precioTotalPropuesta)} (${descuentoPct}% dto. aplicado). ${condicionesPago}`,
      resultado: 'favorable',
      enlacePropuesta: `https://eonesia.com/space/demo-interactiva-aula-3d`,
    });

    setPropuestaGuardadaExito(true);
    setTimeout(() => setPropuestaGuardadaExito(false), 4000);
  };

  const handleImprimirPropuesta = () => {
    window.print();
  };

  const handleGuardarCriterio = (index: number, val: CriterioValor) => {
    const copia: [CriterioValor, CriterioValor, CriterioValor, CriterioValor, CriterioValor] = [
      ...criteriosLocales,
    ];
    copia[index] = val;
    setCriteriosLocales(copia);
    crmRepo.actualizarOportunidad(op.id, { criterios: copia });
  };

  const handleGuardarEmpatiaCuadrante = (index: number, texto: string) => {
    const copia: [string, string, string, string, string, string] = [...empatiaLocal];
    copia[index] = texto;
    setEmpatiaLocal(copia);
    crmRepo.actualizarOportunidad(op.id, { empatia: copia });
  };

  const handleCopiarPlantilla = () => {
    const textoACopiar = plantillasEditadas[plantillaSeleccionada] || generarTextoPlantilla(plantillaSeleccionada);
    navigator.clipboard.writeText(textoACopiar);
    setTextoCopiado(true);
    setTimeout(() => setTextoCopiado(false), 2500);
  };

  const handleRestablecerPlantilla = () => {
    setPlantillasEditadas((prev) => ({
      ...prev,
      [plantillaSeleccionada]: generarTextoPlantilla(plantillaSeleccionada),
    }));
  };

  // --- CALENDARIO: GOOGLE CALENDAR Y ARCHIVO .ICS ---
  const generarGoogleCalendarUrl = () => {
    const titulo = `Eonesia CRM · Seguimiento con ${centro.nombre}`;
    const detalles = `Paso acordado: ${op.proximoPaso?.accion || 'Seguimiento'}\nContacto: ${contactoPrincipal?.nombre || 'Innovación'}${contactoPrincipal?.email ? ` (${contactoPrincipal.email})` : ''}\nProducto sugerido: ${productoElegido || op.productoSugerido || 'Espacios Eonesia'}`;

    // Formato fecha sin Z (hora local 10:00 AM)
    const fechaLimpia = (op.proximoPaso?.fecha || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const startStr = `${fechaLimpia}T100000`;
    
    // Fin según duración editable en minutos (por defecto 30 min)
    const totalMinutosFin = 10 * 60 + duracionMinutos;
    const duracionHoras = Math.floor(totalMinutosFin / 60);
    const duracionRestoMin = totalMinutosFin % 60;
    const endHour = String(duracionHoras).padStart(2, '0');
    const endMin = String(duracionRestoMin).padStart(2, '0');
    const endStr = `${fechaLimpia}T${endHour}${endMin}00`;

    const datesParam = `${startStr}/${endStr}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${encodeURIComponent(datesParam)}&details=${encodeURIComponent(detalles)}`;
  };

  const handleDescargarICS = () => {
    const fechaLimpia = (op.proximoPaso?.fecha || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const startStr = `${fechaLimpia}T100000`;
    const totalMinutosFin = 10 * 60 + duracionMinutos;
    const duracionHoras = Math.floor(totalMinutosFin / 60);
    const duracionRestoMin = totalMinutosFin % 60;
    const endHour = String(duracionHoras).padStart(2, '0');
    const endMin = String(duracionRestoMin).padStart(2, '0');
    const endStr = `${fechaLimpia}T${endHour}${endMin}00`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Eonesia CRM//ES',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${op.id}-${Date.now()}@eonesia.com`,
      `DTSTAMP:${startStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:Eonesia CRM · Seguimiento con ${centro.nombre}`,
      `DESCRIPTION:Paso: ${op.proximoPaso?.accion || 'Seguimiento'} - Contacto: ${contactoPrincipal?.nombre || 'Innovación'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evento_eonesia_${centro.nombre.toLowerCase().replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-[#000000]/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Contenedor del Drawer: Pantalla completa en móvil, ancho fijo 620px en escritorio */}
      <div className="w-full md:w-[620px] lg:w-[660px] h-full bg-[#0D0D14] border-l border-[rgba(0,200,255,0.3)] shadow-2xl flex flex-col overflow-hidden text-[#F2F2F7]">
        
        {/* CABECERA DE LA FICHA */}
        <div className="p-4 md:p-5 border-b border-[rgba(255,255,255,0.08)] bg-[#05050A] flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-bold border"
                style={{
                  backgroundColor: colores.bg,
                  color: colores.text,
                  borderColor: colores.border,
                }}
              >
                {centro.tipo}
              </span>

              {centro.verificado ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#00C8FF]">
                  <ShieldCheck size={13} /> Verificado
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    Por verificar
                  </span>
                  <button
                    onClick={() => crmRepo.marcarCentroVerificado(centro.id)}
                    className="text-[10px] text-[#00C8FF] hover:underline"
                  >
                    Marcar verificado
                  </button>
                </div>
              )}
            </div>

            <h2 className="font-heading font-bold text-lg text-[#F2F2F7] leading-tight truncate">
              {centro.nombre}
            </h2>

            <div className="flex items-center gap-3 text-xs text-[#B4B4C8] mt-1">
              <span>{centro.provincia}</span>
              <span>·</span>
              <span>{centro.alumnos} alumnos aprox.</span>
              {centro.web && (
                <>
                  <span>·</span>
                  <a
                    href={centro.web.startsWith('http') ? centro.web : `https://${centro.web}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00C8FF] hover:underline flex items-center gap-0.5 truncate"
                  >
                    Web <ExternalLink size={11} />
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AnilloEncaje porcentaje={encaje.porcentaje} size={42} strokeWidth={4} mostrarEtiqueta />
            <button
              onClick={onCerrar}
              className="p-1.5 rounded-lg text-[#B4B4C8] hover:text-[#F2F2F7] hover:bg-[#161622] transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN DENTRO DE LA FICHA */}
        <div className="flex border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A10] px-3 gap-1 overflow-x-auto text-xs scrollbar-none">
          {[
            { id: 'general', label: 'General y Trato', icon: User },
            { id: 'actividades', label: `Timeline (${op.actividades?.length || 0})`, icon: Clock },
            { id: 'propuesta', label: 'Presupuesto / Propuesta', icon: FileSpreadsheet },
            { id: 'redactar', label: 'Redactar', icon: Mail },
            { id: 'empatia', label: 'Mapa Empatía', icon: Sparkles },
            { id: 'icp', label: 'Criterios ICP', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTabInterna(tab.id as any)}
                className={`py-2.5 px-3 font-medium whitespace-nowrap border-b-2 flex items-center gap-1.5 transition-colors ${
                  tabInterna === tab.id
                    ? 'border-[#00C8FF] text-[#00C8FF]'
                    : 'border-transparent text-[#B4B4C8] hover:text-[#F2F2F7]'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENIDO SCROLLABLE DE LA FICHA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

          {/* Banner Win Insight Activo con recomendación de empujón proactivo */}
          {winInsight.esWinInsight && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-[rgba(0,200,255,0.12)] via-[rgba(72,2,177,0.18)] to-[rgba(233,105,153,0.12)] border border-[rgba(0,200,255,0.4)] shadow-[0_0_15px_rgba(0,200,255,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[rgba(0,200,255,0.2)] border border-[rgba(0,200,255,0.4)] flex items-center justify-center text-[#00C8FF] shrink-0 shadow-[0_0_10px_rgba(0,200,255,0.3)]">
                  <Sparkles size={18} className="text-[#00C8FF] animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
                      Win Insight Detectado
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#000000]/60 text-[#E96999] border border-[rgba(233,105,153,0.35)] font-bold">
                      {winInsight.encajePorcentaje}% encaje ICP
                    </span>
                  </div>
                  <p className="text-xs text-[#F2F2F7] mt-0.5">
                    {winInsight.motivo} — <strong className="text-[#00C8FF]">{winInsight.sugerenciaNudge}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTabInterna('propuesta')}
                  className="px-3 py-1.5 rounded-lg bg-[#00C8FF] hover:bg-[#68D3FF] text-[#000000] text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  title="Abrir generador de propuesta para emitir o imprimir presupuesto formal"
                >
                  <FileSpreadsheet size={13} />
                  <span>Ver Propuesta PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTabInterna('redactar')}
                  className="px-3 py-1.5 rounded-lg bg-[#161622] hover:bg-[#202030] text-[#F2F2F7] text-xs font-medium border border-[rgba(255,255,255,0.12)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Abrir plantillas de email de seguimiento personalizadas"
                >
                  <Mail size={13} />
                  <span>Email de Cierre</span>
                </button>
              </div>
            </div>
          )}
          
          {/* =========================================================================
              PESTAÑA: GENERAL Y TRATO
             ========================================================================= */}
          {tabInterna === 'general' && (
            <div className="space-y-5">
              {/* Etapa actual y cambio rápido */}
              <div className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.18)]">
                <label className="block text-[11px] uppercase font-bold text-[#B4B4C8] mb-2">
                  Etapa del embudo
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {ETAPAS_ORDEN.map((et) => (
                    <button
                      key={et}
                      type="button"
                      onClick={() => crmRepo.moverOportunidadEtapa(op.id, et)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                        op.etapa === et
                          ? 'bg-[#00C8FF] text-[#0D0D14] border-[#00C8FF] shadow-[0_0_12px_rgba(0,200,255,0.4)]'
                          : 'bg-[#0D0D14] text-[#B4B4C8] border-[rgba(255,255,255,0.08)] hover:text-[#F2F2F7]'
                      }`}
                    >
                      {et}
                    </button>
                  ))}
                </div>
              </div>

              {/* PRODUCTO SUGERIDO POR REGLAS */}
              <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.3)] shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF] flex items-center gap-1.5">
                    <Sparkles size={14} /> Producto Sugerido Eonesia
                  </span>
                </div>

                {/* Chip con motivo */}
                <div className="p-2.5 rounded-lg bg-[#000000]/80 border border-[rgba(0,200,255,0.2)]">
                  <div className="text-xs font-bold text-[#F2F2F7]">
                    {sugerencia.producto}
                  </div>
                  <div className="text-[11px] text-[#00C8FF] mt-0.5">
                    Motivo: {sugerencia.motivo}
                  </div>
                </div>

                {/* Selector para cambiar producto elegido */}
                <div>
                  <label className="block text-[11px] text-[#B4B4C8] mb-1 font-medium">
                    Producto finalmente acordado o evaluado:
                  </label>
                  <input
                    type="text"
                    value={productoElegido}
                    onChange={(e) => setProductoElegido(e.target.value)}
                    onBlur={handleGuardarCambiosGenerales}
                    className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-xs text-[#F2F2F7]"
                    placeholder="Ej. Plan Centro completo 349 €/mes"
                  />
                </div>
              </div>

              {/* Dolor Principal */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#B4B4C8]">
                  Dolor principal del centro
                </label>
                <select
                  value={dolorSeleccionado}
                  onChange={(e) => {
                    setDolorSeleccionado(e.target.value as DolorPrincipal);
                    crmRepo.actualizarOportunidad(op.id, { dolor: e.target.value as DolorPrincipal });
                  }}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-xs text-[#F2F2F7]"
                >
                  <option value="Abandono del alumnado">Abandono del alumnado</option>
                  <option value="Alumnos sin preparar para prácticas">
                    Alumnos sin preparar para prácticas
                  </option>
                  <option value="Captar familias">Captar familias</option>
                  <option value="Fondos por ejecutar">Fondos por ejecutar</option>
                  <option value="Diferenciarse en licitaciones">Diferenciarse en licitaciones</option>
                  <option value="Otro">Otro dolor</option>
                </select>
              </div>

              {/* Valor económico en € */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#B4B4C8] mb-1">
                    Valor estimado o acordado (€)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      onBlur={handleGuardarCambiosGenerales}
                      className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-sm font-mono font-bold text-[#F2F2F7] pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-[#B4B4C8]">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#B4B4C8] mb-1">
                    Fecha de Próximo Paso
                  </label>
                  <input
                    type="date"
                    value={proximoPasoFecha}
                    onChange={(e) => {
                      setProximoPasoFecha(e.target.value);
                      crmRepo.actualizarOportunidad(op.id, {
                        proximoPaso: { accion: proximoPasoAccion, fecha: e.target.value },
                      });
                    }}
                    className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-xs text-[#F2F2F7]"
                  />
                </div>
              </div>

              {/* Acción de Próximo Paso */}
              <div>
                <label className="block text-xs font-medium text-[#B4B4C8] mb-1">
                  Acción de Próximo Paso
                </label>
                <input
                  type="text"
                  value={proximoPasoAccion}
                  onChange={(e) => setProximoPasoAccion(e.target.value)}
                  onBlur={handleGuardarCambiosGenerales}
                  placeholder="Ej. Llamada con equipo directivo o revisión del pliego"
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-xs text-[#F2F2F7]"
                />
              </div>

              {/* Acciones directas de Calendario si hay fecha */}
              {proximoPasoFecha && (
                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(0,200,255,0.2)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#00C8FF] flex items-center gap-1.5 uppercase tracking-wide">
                      <Calendar size={13} /> Añadir a mi calendario
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#B4B4C8]">
                      <span>Duración:</span>
                      <select
                        value={duracionMinutos}
                        onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                        className="bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded px-1.5 py-0.5 text-[11px] text-[#F2F2F7]"
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={generarGoogleCalendarUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded bg-[rgba(0,200,255,0.15)] hover:bg-[rgba(0,200,255,0.25)] text-[#00C8FF] font-bold text-xs border border-[rgba(0,200,255,0.4)] transition-colors text-center"
                    >
                      <ExternalLink size={12} />
                      <span>Google Calendar</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleDescargarICS}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded bg-[#161622] hover:bg-[#1f1f2e] text-[#F2F2F7] font-semibold text-xs border border-[rgba(255,255,255,0.1)] transition-colors"
                    >
                      <Download size={12} />
                      <span>Descargar .ics</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-[#B4B4C8] italic">
                    Crea un evento en tu calendario; no sincroniza.
                  </p>
                </div>
              )}

              {/* Contactos Asociados */}
              <div className="p-4 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.08)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-bold uppercase text-[#00C8FF] flex items-center gap-1.5">
                    <User size={14} /> Contactos ({contactos.length})
                  </span>
                  <button
                    onClick={() => setMostrarFormContacto(!mostrarFormContacto)}
                    className="text-xs font-semibold text-[#E96999] hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Añadir contacto
                  </button>
                </div>

                {mostrarFormContacto && (
                  <form
                    onSubmit={handleCrearContacto}
                    className="p-3 rounded-lg bg-[#0D0D14] border border-[rgba(0,200,255,0.3)] space-y-2 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre y apellidos"
                        value={ncNombre}
                        onChange={(e) => setNcNombre(e.target.value)}
                        className="p-2 rounded bg-[#05050A] border border-[rgba(154,154,176,0.3)] text-[#F2F2F7]"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Cargo (ej. Jefa de Estudios)"
                        value={ncCargo}
                        onChange={(e) => setNcCargo(e.target.value)}
                        className="p-2 rounded bg-[#05050A] border border-[rgba(154,154,176,0.3)] text-[#F2F2F7]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Email corporativo"
                        value={ncEmail}
                        onChange={(e) => setNcEmail(e.target.value)}
                        className="p-2 rounded bg-[#05050A] border border-[rgba(154,154,176,0.3)] text-[#F2F2F7]"
                      />
                      <select
                        value={ncRol}
                        onChange={(e) => setNcRol(e.target.value as RolContacto)}
                        className="p-2 rounded bg-[#05050A] border border-[rgba(154,154,176,0.3)] text-[#F2F2F7]"
                      >
                        <option value="Decisor">Decisor (Firma)</option>
                        <option value="Influyente">Influyente (TIC / Docente)</option>
                        <option value="Usuario">Usuario</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setMostrarFormContacto(false)}
                        className="px-2.5 py-1 text-[#B4B4C8]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 font-bold rounded bg-[#00C8FF] text-[#0D0D14]"
                      >
                        Guardar contacto
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {contactos.map((ct) => (
                    <div
                      key={ct.id}
                      className="p-2.5 rounded-lg bg-[#0D0D14] border border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#F2F2F7]">{ct.nombre}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#161622] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                            {ct.rol}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#B4B4C8]">{ct.cargo}</p>
                        {ct.email && (
                          <a
                            href={`mailto:${ct.email}`}
                            className="text-[11px] text-[#00C8FF] hover:underline"
                          >
                            {ct.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {contactos.length === 0 && (
                    <p className="text-xs text-[#6B6B80]">Sin contactos registrados.</p>
                  )}
                </div>
              </div>

              {/* Botón de acceso directo a REDACTAR */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setTabInterna('redactar')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[rgba(0,200,255,0.12)] hover:bg-[rgba(0,200,255,0.22)] border border-[rgba(0,200,255,0.35)] text-[#00C8FF] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Mail size={15} />
                  <span>Redactar mensaje con plantillas para {centro.nombre}</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA: REDACTAR (PLANTILLAS COMERCIALES ADAPTADAS)
             ========================================================================= */}
          {tabInterna === 'redactar' && (
            <div className="space-y-5">
              {/* Sección Redactar */}
              <div className="p-4 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.25)] space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[rgba(0,200,255,0.12)] text-[#00C8FF]">
                      <FileText size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
                        Plantillas de Redacción
                      </h3>
                      <p className="text-[11px] text-[#B4B4C8]">
                        Textos personalizados con argumentos específicos para {centro.nombre}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#161622] text-[#00C8FF] border border-[rgba(0,200,255,0.25)]">
                    {centro.tipo}
                  </span>
                </div>

                {/* Tarjeta de argumento específico por tipo de centro */}
                <div className="p-2.5 rounded-lg bg-[#05050A] border border-[rgba(0,200,255,0.2)] text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#B4B4C8] font-medium">
                      Argumento adaptado a <strong className="text-[#00C8FF]">{centro.tipo}</strong>:
                    </span>
                    <span className="text-[10px] text-[#E96999] font-mono font-semibold">
                      {productoElegido || op.productoSugerido || 'Troncales FP'}
                    </span>
                  </div>
                  <p className="text-xs text-[#F2F2F7] italic bg-[#0D0D14] p-2 rounded border border-[rgba(255,255,255,0.05)]">
                    «{obtenerArgumentoTipoCentro(centro.tipo)}»
                  </p>
                </div>

                {/* Selector de las 3 plantillas */}
                <div>
                  <label className="block text-[11px] font-medium text-[#B4B4C8] mb-1.5">
                    Selecciona una plantilla:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'primer_contacto', label: '1. Primer contacto' },
                      { id: 'seguimiento', label: '2. Seguimiento' },
                      { id: 'propuesta', label: '3. Propuesta' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlantillaSeleccionada(p.id as any)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                          plantillaSeleccionada === p.id
                            ? 'bg-[rgba(0,200,255,0.2)] text-[#00C8FF] border-[#00C8FF] shadow-[0_0_12px_rgba(0,200,255,0.25)]'
                            : 'bg-[#0D0D14] text-[#B4B4C8] border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuadro de texto de la plantilla (100% editable) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#B4B4C8]">
                    <span>
                      Destinatario:{' '}
                      <strong className="text-[#F2F2F7]">
                        {contactoPrincipal ? `${contactoPrincipal.nombre} (${contactoPrincipal.cargo})` : 'Equipo Directivo'}
                      </strong>
                    </span>
                    <span className="text-[10px] text-[#6B6B80]">Texto editable</span>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={11}
                      value={plantillasEditadas[plantillaSeleccionada] ?? generarTextoPlantilla(plantillaSeleccionada)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlantillasEditadas((prev) => ({
                          ...prev,
                          [plantillaSeleccionada]: val,
                        }));
                      }}
                      placeholder="Escribe o personaliza el mensaje aquí..."
                      className="w-full bg-[#05050A] border border-[rgba(0,200,255,0.25)] focus:border-[#00C8FF] rounded-lg p-3 text-xs text-[#F2F2F7] font-mono leading-relaxed focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Barra de acciones de plantilla */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRestablecerPlantilla}
                      className="text-[11px] text-[#B4B4C8] hover:text-[#00C8FF] transition-colors underline cursor-pointer"
                    >
                      Restablecer texto original
                    </button>

                    <div className="flex items-center gap-2">
                      {contactoPrincipal?.email && (
                        <a
                          href={`mailto:${contactoPrincipal.email}?subject=${encodeURIComponent(
                            plantillaSeleccionada === 'propuesta'
                              ? `Propuesta Eonesia para ${centro.nombre}`
                              : plantillaSeleccionada === 'seguimiento'
                              ? `Seguimiento de propuesta · Eonesia y ${centro.nombre}`
                              : `Espacios educativos inmersivos para ${centro.nombre}`
                          )}&body=${encodeURIComponent(
                            plantillasEditadas[plantillaSeleccionada] ?? generarTextoPlantilla(plantillaSeleccionada)
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161622] hover:bg-[#1f1f2e] text-[#F2F2F7] font-semibold text-xs border border-[rgba(255,255,255,0.1)] transition-colors"
                        >
                          <Send size={12} />
                          <span>Abrir en email</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={handleCopiarPlantilla}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00C8FF] hover:bg-[#68d3ff] text-[#0D0D14] font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>{textoCopiado ? '¡Copiado!' : 'Copiar texto'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Aviso legal obligatorio de cumplimiento legal (LSSI) */}
                <div className="p-3 rounded-lg bg-[rgba(233,105,153,0.08)] border border-[rgba(233,105,153,0.3)] flex items-start gap-2.5 text-xs text-[#B4B4C8]">
                  <AlertTriangle size={16} className="text-[#E96999] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#E96999] block mb-0.5">Cumplimiento legal obligatorio:</strong>
                    <p>
                      Si es correo en frío, cumple la LSSI: identifícate, ofrece darse de baja y usa datos con base legal.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECCIÓN AÑADIR A MI CALENDARIO */}
              <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF] flex items-center gap-1.5">
                    <Calendar size={15} /> Añadir a mi calendario
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-[#B4B4C8]">
                    <span>Duración:</span>
                    <select
                      value={duracionMinutos}
                      onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                      className="bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded px-2 py-0.5 text-xs text-[#F2F2F7]"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] text-xs text-[#B4B4C8]">
                  <div className="font-semibold text-[#F2F2F7] mb-1">
                    Próximo paso programado:
                  </div>
                  <div>Acción: {op.proximoPaso.accion}</div>
                  <div>Fecha: {formatearFecha(op.proximoPaso.fecha)}</div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={generarGoogleCalendarUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[rgba(0,200,255,0.15)] hover:bg-[rgba(0,200,255,0.25)] text-[#00C8FF] font-bold text-xs border border-[rgba(0,200,255,0.4)] transition-colors text-center"
                  >
                    <ExternalLink size={13} />
                    <span>Google Calendar</span>
                  </a>

                  <button
                    onClick={handleDescargarICS}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#161622] hover:bg-[#1f1f2e] text-[#F2F2F7] font-semibold text-xs border border-[rgba(255,255,255,0.1)] transition-colors"
                  >
                    <Download size={13} />
                    <span>Descargar .ics</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#B4B4C8] italic">
                  Crea un evento en tu calendario; no sincroniza.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA: MAPA DE EMPATÍA (6 CUADRANTES) (+8 XP c/u, +20 XP los 6)
             ========================================================================= */}
          {tabInterna === 'empatia' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[rgba(233,105,153,0.08)] border border-[rgba(233,105,153,0.3)] flex items-center justify-between">
                <div>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#E96999]">
                    Mapa de Empatía · Recompensas de maestría
                  </h4>
                  <p className="text-[11px] text-[#B4B4C8]">
                    +8 XP por cada cuadrante completado la 1ª vez · +20 XP extra al completar los 6
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-[#E96999] text-[#0D0D14] font-bold text-xs font-mono">
                  {empatiaLocal.filter((t) => t.trim().length > 5).length}/6 cuadrantes
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { id: 0, titulo: '1. Piensa y siente', placeholder: '¿Qué le preocupa, qué aspira o qué emociones tiene?' },
                  { id: 1, titulo: '2. Ve', placeholder: '¿Qué ve en su entorno, en la competencia o en su centro?' },
                  { id: 2, titulo: '3. Oye', placeholder: '¿Qué le dicen los docentes, directores, familias o prensa?' },
                  { id: 3, titulo: '4. Dice y hace', placeholder: '¿Cuál es su actitud pública, qué objeciones o frases repite?' },
                  { id: 4, titulo: '5. Dolores', placeholder: '¿Miedos, frustraciones, trabas burocráticas o riesgos?' },
                  { id: 5, titulo: '6. Alegrías', placeholder: '¿Qué representaría un éxito rotundo para su carrera y centro?' },
                ].map((q) => {
                  const completado = empatiaLocal[q.id]?.trim().length > 5;
                  return (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.18)] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-heading font-bold text-xs text-[#00C8FF]">
                          {q.titulo}
                        </span>
                        {completado && (
                          <span className="text-[10px] text-[#E96999] font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={12} /> +8 XP
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={empatiaLocal[q.id]}
                        onChange={(e) => {
                          const val = e.target.value;
                          const copia: [string, string, string, string, string, string] = [
                            ...empatiaLocal,
                          ];
                          copia[q.id] = val;
                          setEmpatiaLocal(copia);
                        }}
                        onBlur={() => handleGuardarEmpatiaCuadrante(q.id, empatiaLocal[q.id])}
                        placeholder={q.placeholder}
                        className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2 text-xs text-[#F2F2F7] leading-relaxed"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA: CRITERIOS ICP
             ========================================================================= */}
          {tabInterna === 'icp' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.2)] flex items-center justify-between">
                <div>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                    Puntuación de Encaje con ICP
                  </h4>
                  <p className="text-[11px] text-[#B4B4C8]">
                    Refleja el parecido con tu cliente ideal (no es probabilidad de compra).
                  </p>
                </div>
                <AnilloEncaje porcentaje={encaje.porcentaje} size={48} strokeWidth={4} />
              </div>

              {/* 5 Criterios con sus opciones */}
              <div className="space-y-3 text-xs">
                {[
                  {
                    idx: 0,
                    nombre: 'Acceso al decisor',
                    peso: estado.config.pesosICP.decisor,
                    opciones: [
                      { valor: 1, label: 'Hablo con quien firma (1 pto)' },
                      { valor: 0.5, label: 'Hablo con influyente: TIC/docente (0.5 ptos)' },
                      { valor: 0, label: 'Sin contacto directo (0 ptos)' },
                    ],
                  },
                  {
                    idx: 1,
                    nombre: 'Dinero disponible',
                    peso: estado.config.pesosICP.dinero,
                    opciones: [
                      { valor: 1, label: 'Presupuesto propio y ágil (1 pto)' },
                      { valor: 0.5, label: 'Limitado o con fondos asignados (0.5 ptos)' },
                      { valor: 0, label: 'Depende de Consejería o convocatoria (0 ptos)' },
                    ],
                  },
                  {
                    idx: 2,
                    nombre: 'Prioridad del segmento',
                    peso: estado.config.pesosICP.segmento,
                    opciones: [
                      { valor: 1, label: 'FP o Privado (1 pto)' },
                      { valor: 0.5, label: 'Concertado, Universidad o Editorial (0.5 ptos)' },
                      { valor: 0, label: 'Institucional o Público (0 ptos)' },
                    ],
                  },
                  {
                    idx: 3,
                    nombre: 'Dolor activo',
                    peso: estado.config.pesosICP.dolor,
                    opciones: [
                      { valor: 1, label: 'Lo ha dicho explícitamente (1 pto)' },
                      { valor: 0.5, label: 'Dolor latente / intuido (0.5 ptos)' },
                      { valor: 0, label: 'No hay dolor manifestado (0 ptos)' },
                    ],
                  },
                  {
                    idx: 4,
                    nombre: 'Encaje con catálogo',
                    peso: estado.config.pesosICP.catalogo,
                    opciones: [
                      { valor: 1, label: 'Tenemos el mundo listo en catálogo (1 pto)' },
                      { valor: 0.5, label: 'Le sirve un mundo vacío adaptable (0.5 ptos)' },
                      { valor: 0, label: 'Producción a medida desde cero (0 ptos)' },
                    ],
                  },
                ].map((c) => {
                  const valorActual = criteriosLocales[c.idx];
                  return (
                    <div
                      key={c.idx}
                      className="p-3 rounded-xl bg-[#000000]/50 border border-[rgba(255,255,255,0.06)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#F2F2F7]">
                          {c.nombre}{' '}
                          <span className="text-[#00C8FF] font-mono text-[11px]">
                            (Peso {c.peso})
                          </span>
                        </span>
                        <span className="font-mono text-xs text-[#B4B4C8]">
                          {valorActual !== null ? `${valorActual} / 1` : 'Sin evaluar'}
                        </span>
                      </div>

                      {/* Barra de progreso de puntos */}
                      <div className="w-full h-1.5 bg-[#161622] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00C8FF] rounded-full transition-all"
                          style={{
                            width: `${valorActual !== null ? valorActual * 100 : 0}%`,
                          }}
                        />
                      </div>

                      {/* Desplegable de opción */}
                      <select
                        value={valorActual !== null ? String(valorActual) : 'null'}
                        onChange={(e) => {
                          const v = e.target.value === 'null' ? null : (Number(e.target.value) as CriterioValor);
                          handleGuardarCriterio(c.idx, v);
                        }}
                        className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2 text-xs text-[#F2F2F7]"
                      >
                        <option value="null">— Sin seleccionar —</option>
                        {c.opciones.map((opcion) => (
                          <option key={opcion.valor} value={String(opcion.valor)}>
                            {opcion.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA: TIMELINE UNIFICADO DE ACTIVIDAD OMNICANAL
             ========================================================================= */}
          {tabInterna === 'actividades' && (
            <div className="space-y-4">
              {/* Acciones rápidas en 1 clic */}
              <div className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.25)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-heading font-bold text-[#00C8FF] uppercase tracking-wide flex items-center gap-1.5">
                    <Zap size={14} /> Registro Rápido Omnicanal
                  </span>
                  <span className="text-[10px] text-[#B4B4C8]">Gana XP por cada interacción registrada</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRegistrarAccionRapida('llamada', 'Llamada telefónica realizada con el centro. Conversación sobre encaje pedagógico.', 'Llamada de prospección')}
                    className="p-2 rounded-lg bg-[#0D0D14] hover:bg-[#161622] border border-[rgba(0,200,255,0.2)] hover:border-[#00C8FF] text-left text-xs transition-all flex items-center gap-2 text-[#F2F2F7]"
                  >
                    <Phone size={14} className="text-[#00C8FF] shrink-0" />
                    <div>
                      <strong className="block text-[11px]">📞 Llamada</strong>
                      <span className="text-[9px] text-[#00C8FF]">+10 XP</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegistrarAccionRapida('demo', 'Demostración WebXR interactiva en navegador completada. Muestra del espacio 3D.', 'Demo WebXR en Vivo')}
                    className="p-2 rounded-lg bg-[#0D0D14] hover:bg-[#161622] border border-[rgba(233,105,153,0.3)] hover:border-[#E96999] text-left text-xs transition-all flex items-center gap-2 text-[#F2F2F7]"
                  >
                    <Video size={14} className="text-[#E96999] shrink-0" />
                    <div>
                      <strong className="block text-[11px]">🤝 Demo 3D</strong>
                      <span className="text-[9px] text-[#E96999]">+20 XP</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegistrarAccionRapida('email', 'Correo informativo enviado con enlaces al catálogo y credenciales de acceso demo.', 'Email con propuesta')}
                    className="p-2 rounded-lg bg-[#0D0D14] hover:bg-[#161622] border border-[rgba(0,200,255,0.2)] hover:border-[#00C8FF] text-left text-xs transition-all flex items-center gap-2 text-[#F2F2F7]"
                  >
                    <Mail size={14} className="text-[#00C8FF] shrink-0" />
                    <div>
                      <strong className="block text-[11px]">✉️ Email</strong>
                      <span className="text-[9px] text-[#00C8FF]">+10 XP</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegistrarAccionRapida('whatsapp', 'Mensaje directo de WhatsApp enviado para confirmar fecha de reunión.', 'Mensaje WhatsApp')}
                    className="p-2 rounded-lg bg-[#0D0D14] hover:bg-[#161622] border border-[rgba(16,185,129,0.3)] hover:border-emerald-400 text-left text-xs transition-all flex items-center gap-2 text-[#F2F2F7]"
                  >
                    <MessageSquare size={14} className="text-emerald-400 shrink-0" />
                    <div>
                      <strong className="block text-[11px]">💬 WhatsApp</strong>
                      <span className="text-[9px] text-emerald-400">+10 XP</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulario Detallado de Actividad */}
              <form
                onSubmit={handleRegistrarActividad}
                className="p-4 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.08)] space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold uppercase text-[#F2F2F7] flex items-center gap-1.5">
                    <Plus size={14} className="text-[#00C8FF]" /> Registrar interacción detallada
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={nuevaActAutor}
                      onChange={(e) => setNuevaActAutor(e.target.value)}
                      className="bg-[#05050A] border border-[rgba(255,255,255,0.1)] rounded px-2 py-0.5 text-[10px] text-[#00C8FF] font-medium"
                      title="Comercial responsable"
                    >
                      <option value="Rafa Dorado">Rafa Dorado</option>
                      <option value="Comercial 2">Comercial 2</option>
                    </select>
                    <span className="font-mono font-bold text-[#E96999] bg-[#E96999]/10 px-2 py-0.5 rounded text-[10px]">
                      {nuevaActTipo === 'demo' || nuevaActTipo === 'reunion' ? '+20 XP' : '+10 XP'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Canal:</label>
                    <select
                      value={nuevaActTipo}
                      onChange={(e) => setNuevaActTipo(e.target.value as TipoActividad)}
                      className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-[#F2F2F7]"
                    >
                      <option value="llamada">📞 Llamada telefónica</option>
                      <option value="demo">🤝 Demo de producto WebXR</option>
                      <option value="reunion">👥 Reunión directiva</option>
                      <option value="email">✉️ Correo electrónico</option>
                      <option value="whatsapp">💬 WhatsApp / Chat</option>
                      <option value="propuesta">📑 Envío de presupuesto</option>
                      <option value="nota">📝 Nota interna de seguimiento</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Resultado del contacto:</label>
                    <select
                      value={nuevaActResultado}
                      onChange={(e) => setNuevaActResultado(e.target.value as any)}
                      className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-[#F2F2F7]"
                    >
                      <option value="favorable">🟢 Favorable (Avanza con interés)</option>
                      <option value="pendiente">🟡 Pendiente de seguimiento</option>
                      <option value="desfavorable">🔴 Con objeciones / Dudas</option>
                      <option value="completada">⚪ Informativa / Completada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Duración (min):</label>
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={nuevaActDuracion}
                      onChange={(e) => setNuevaActDuracion(Number(e.target.value))}
                      className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-[#F2F2F7] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={nuevaActTitulo}
                    onChange={(e) => setNuevaActTitulo(e.target.value)}
                    placeholder="Título breve (ej. Demo con Jefa de Estudios y Coord. TIC)..."
                    className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-[#F2F2F7] mb-2"
                  />
                  <textarea
                    rows={2}
                    value={nuevaActNota}
                    onChange={(e) => setNuevaActNota(e.target.value)}
                    placeholder="Detalles clave de la conversación, acuerdos alcanzados o próximas objeciones a resolver..."
                    className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2 text-[#F2F2F7]"
                    required
                  />
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] text-[#B4B4C8]">
                    Quedará registrada en la timeline con tu nombre y fecha relativa.
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 font-bold rounded-lg bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,200,255,0.3)] cursor-pointer"
                  >
                    Guardar interacción
                  </button>
                </div>
              </form>

              {/* Filtro de la Timeline */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-1.5 text-xs text-[#B4B4C8]">
                  <Clock size={14} className="text-[#00C8FF]" />
                  <span>Timeline cronológico ({op.actividades?.length || 0})</span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {(['todas', 'llamada', 'demo', 'email', 'whatsapp', 'propuesta'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFiltroActividad(tipo)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-colors ${
                        filtroActividad === tipo
                          ? 'bg-[#00C8FF] text-[#000000]'
                          : 'bg-[#131320] text-[#B4B4C8] hover:text-[#F2F2F7]'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista Cronológica del Feed de Actividad */}
              <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-0.5 before:bg-[rgba(255,255,255,0.08)]">
                {(op.actividades || [])
                  .filter((act) => filtroActividad === 'todas' || act.tipo === filtroActividad)
                  .map((act, index) => {
                    const esLlamada = act.tipo === 'llamada';
                    const esDemo = act.tipo === 'demo' || act.tipo === 'reunion';
                    const esEmail = act.tipo === 'email';
                    const esPropuesta = act.tipo === 'propuesta';
                    const esWhatsApp = act.tipo === 'whatsapp';

                    return (
                      <div
                        key={act.id || index}
                        className="relative flex items-start gap-3.5 pl-1 group"
                      >
                        {/* Nodo / Icono en la línea de tiempo */}
                        <div
                          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110 ${
                            esDemo
                              ? 'bg-[rgba(233,105,153,0.15)] text-[#E96999] border-[#E96999] shadow-[0_0_10px_rgba(233,105,153,0.3)]'
                              : esPropuesta
                              ? 'bg-[rgba(195,173,255,0.15)] text-[#c3adff] border-[#c3adff]'
                              : esWhatsApp
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400'
                              : 'bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border-[#00C8FF]'
                          }`}
                        >
                          {esLlamada && <Phone size={14} />}
                          {esDemo && <Video size={14} />}
                          {esEmail && <Mail size={14} />}
                          {esWhatsApp && <MessageSquare size={14} />}
                          {esPropuesta && <FileSpreadsheet size={14} />}
                          {!esLlamada && !esDemo && !esEmail && !esWhatsApp && !esPropuesta && <FileText size={14} />}
                        </div>

                        {/* Tarjeta de la actividad */}
                        <div className="flex-1 p-3 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,200,255,0.3)] transition-all space-y-1.5 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-[#F2F2F7]">
                                {act.titulo || (act.tipo.charAt(0).toUpperCase() + act.tipo.slice(1))}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.2)]">
                                {act.autor || 'Rafa Dorado'}
                              </span>
                              {act.duracionMinutos && (
                                <span className="text-[10px] text-[#B4B4C8]">
                                  ({act.duracionMinutos} min)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {act.resultado && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    act.resultado === 'favorable'
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      : act.resultado === 'desfavorable'
                                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {act.resultado}
                                </span>
                              )}
                              <span className="text-[10px] text-[#B4B4C8] font-mono" title={formatearFecha(act.fecha)}>
                                {tiempoRelativo(act.fecha)}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-[#F2F2F7] leading-relaxed whitespace-pre-wrap">
                            {act.nota}
                          </p>

                          {act.enlacePropuesta && (
                            <div className="pt-1">
                              <a
                                href={act.enlacePropuesta}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[#00C8FF] hover:underline bg-[rgba(0,200,255,0.08)] px-2 py-0.5 rounded border border-[rgba(0,200,255,0.2)]"
                              >
                                <ExternalLink size={11} />
                                <span>Ver espacio WebXR demo adjunto</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {(!op.actividades || op.actividades.length === 0) && (
                  <div className="text-center py-8 p-4 rounded-xl bg-[#05050A] border border-[rgba(255,255,255,0.06)] space-y-2">
                    <Clock size={28} className="mx-auto text-[#B4B4C8]/40" />
                    <p className="text-xs text-[#F2F2F7] font-bold">Sin interacciones registradas todavía</p>
                    <p className="text-[11px] text-[#B4B4C8]">
                      Utiliza los botones de registro rápido arriba para registrar llamadas, demos o correos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA: GENERADOR DE PROPUESTAS COMERCIALES Y ENLACE INMERSIVO
             ========================================================================= */}
          {tabInterna === 'propuesta' && (
            <div className="space-y-5">
              {/* Selector de Paquete Formativo Eonesia */}
              <div className="p-4 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.25)] space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[rgba(0,200,255,0.15)] text-[#00C8FF]">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
                        Generador de Propuesta y Presupuesto Formal
                      </h3>
                      <p className="text-[11px] text-[#B4B4C8]">
                        Cálculo dinámico adaptado a {centro.nombre} ({centro.tipo})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#131320] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                    PROP-2026-{op.id.substring(0, 5).toUpperCase()}
                  </span>
                </div>

                {/* Tarjetas de Paquetes Disponibles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PAQUETES_PROPUESTAS.map((paq) => {
                    const esSeleccionado = paqueteSeleccionado === paq.id;
                    return (
                      <div
                        key={paq.id}
                        onClick={() => {
                          setPaqueteSeleccionado(paq.id);
                          setAulasEstimadas(paq.aulasDefault);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          esSeleccionado
                            ? 'bg-[rgba(0,200,255,0.15)] border-[#00C8FF] shadow-[0_0_15px_-3px_rgba(0,200,255,0.3)]'
                            : 'bg-[#05050A] border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-[#F2F2F7] leading-tight">
                            {paq.nombre}
                          </h4>
                          <span className="font-mono font-bold text-xs text-[#00C8FF] shrink-0">
                            {formatearEuros(paq.precioBase)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#B4B4C8] mt-1.5 line-clamp-2">
                          {paq.descripcion}
                        </p>
                        <span className="block mt-2 text-[9px] text-[#E96999] font-medium">
                          Ideal: {paq.idealPara}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Parámetros de Personalización */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.06)]">
                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Descuento aplicado:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min={0}
                        max={30}
                        step={5}
                        value={descuentoPct}
                        onChange={(e) => setDescuentoPct(Number(e.target.value))}
                        className="flex-1 accent-[#00C8FF]"
                      />
                      <span className="font-mono text-xs font-bold text-[#00C8FF] w-9 text-right">
                        {descuentoPct}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Aulas estimadas:</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={aulasEstimadas}
                      onChange={(e) => setAulasEstimadas(Number(e.target.value))}
                      className="w-full bg-[#0D0D14] border border-[rgba(255,255,255,0.1)] rounded p-1.5 text-xs text-[#F2F2F7] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#B4B4C8] mb-1">Impuestos (IVA 21%):</label>
                    <button
                      type="button"
                      onClick={() => setIncluyeIva(!incluyeIva)}
                      className={`w-full py-1.5 px-2 rounded text-xs font-semibold border transition-colors ${
                        incluyeIva
                          ? 'bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border-[#00C8FF]'
                          : 'bg-[#0D0D14] text-[#B4B4C8] border-[rgba(255,255,255,0.1)]'
                      }`}
                    >
                      {incluyeIva ? 'IVA 21% Desglosado' : 'Sin IVA (Exento / Canarias)'}
                    </button>
                  </div>
                </div>

                {/* Condiciones de Pago */}
                <div>
                  <label className="block text-[10px] text-[#B4B4C8] mb-1">Condiciones comerciales y de entrega:</label>
                  <input
                    type="text"
                    value={condicionesPago}
                    onChange={(e) => setCondicionesPago(e.target.value)}
                    className="w-full bg-[#05050A] border border-[rgba(255,255,255,0.1)] rounded p-2 text-xs text-[#F2F2F7]"
                  />
                </div>
              </div>

              {/* VISTA PREVIA IMPRIMIBLE DEL DOCUMENTO FORMAL DE PROPUESTA */}
              <div className="p-5 sm:p-6 rounded-xl bg-[#000000] border border-[rgba(0,200,255,0.35)] shadow-2xl space-y-4 font-sans text-xs print:p-0 print:border-none print:shadow-none">
                {/* Encabezado Formal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[rgba(255,255,255,0.1)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-gradient-to-tr from-[#00C8FF] to-[#E96999]" />
                      <h2 className="font-heading font-bold text-base text-[#F2F2F7] tracking-wider">
                        EONESIA IMMERSIVE EDUCATION
                      </h2>
                    </div>
                    <p className="text-[10px] text-[#B4B4C8] mt-0.5">
                      Tecnología WebXR de Espacios de Aprendizaje en Navegador
                    </p>
                    <p className="text-[10px] text-[#6B6B80]">
                      NIF B-41982731 · Sevilla Tech Park, España · soporte@eonesia.com
                    </p>
                  </div>

                  <div className="text-left sm:text-right font-mono text-[11px] space-y-0.5">
                    <span className="text-[#00C8FF] font-bold block">
                      PRESUPUESTO PROP-2026-{op.id.substring(0, 5).toUpperCase()}
                    </span>
                    <span className="text-[#B4B4C8] block">Fecha: {new Date().toLocaleDateString('es-ES')}</span>
                    <span className="text-[#B4B4C8] block">Validez: 30 días</span>
                  </div>
                </div>

                {/* Datos del Cliente y Centro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-[#0D0D14] border border-[rgba(255,255,255,0.06)]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C8FF] block mb-1">
                      Destinatario:
                    </span>
                    <strong className="text-sm text-[#F2F2F7] block">{centro.nombre}</strong>
                    <span className="text-[11px] text-[#B4B4C8] block">{centro.tipo} · {centro.provincia}</span>
                    <span className="text-[11px] text-[#B4B4C8] block">{centro.web}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C8FF] block mb-1">
                      Atención a:
                    </span>
                    <strong className="text-xs text-[#F2F2F7] block">
                      {contactoPrincipal ? `${contactoPrincipal.nombre} (${contactoPrincipal.cargo})` : 'Equipo Directivo / Coordinación Pedagógica'}
                    </strong>
                    {contactoPrincipal?.email && (
                      <span className="text-[11px] text-[#B4B4C8] block">{contactoPrincipal.email}</span>
                    )}
                    <span className="text-[10px] text-[#E96999] block mt-0.5">
                      Plataforma 100% web: sin cascos VR obligatorios
                    </span>
                  </div>
                </div>

                {/* Tabla de Conceptos y Precios */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.1)] text-[10px] uppercase font-bold text-[#B4B4C8]">
                        <th className="py-2 px-1">Concepto / Módulo WebXR</th>
                        <th className="py-2 px-1 text-center">Aulas</th>
                        <th className="py-2 px-1 text-right">Precio Base</th>
                        <th className="py-2 px-1 text-right">Descuento</th>
                        <th className="py-2 px-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.06)] font-mono">
                      <tr>
                        <td className="py-2.5 px-1 font-sans">
                          <strong className="text-[#F2F2F7] block">{paqueteActual.nombre}</strong>
                          <span className="text-[10px] text-[#B4B4C8] block">{paqueteActual.descripcion}</span>
                        </td>
                        <td className="py-2.5 px-1 text-center text-[#F2F2F7]">{aulasEstimadas}</td>
                        <td className="py-2.5 px-1 text-right text-[#B4B4C8]">{formatearEuros(precioBaseTotal)}</td>
                        <td className="py-2.5 px-1 text-right text-[#E96999]">{descuentoPct > 0 ? `-${descuentoPct}%` : '0%'}</td>
                        <td className="py-2.5 px-1 text-right font-bold text-[#F2F2F7]">{formatearEuros(baseImponible)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Totales y Desglose */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2 border-t border-[rgba(255,255,255,0.1)]">
                  <div className="space-y-1 text-[11px] text-[#B4B4C8] max-w-sm">
                    <p><strong>Condiciones:</strong> {condicionesPago}</p>
                    <p className="text-[10px] text-[#00C8FF]">
                      * Incluye acceso libre mediante enlace web corporativo compatible con Chrome, Edge, Safari y tablets.
                    </p>
                  </div>

                  <div className="space-y-1 font-mono text-right min-w-[200px]">
                    <div className="flex justify-between text-[#B4B4C8] text-xs">
                      <span>Base imponible:</span>
                      <span>{formatearEuros(baseImponible)}</span>
                    </div>
                    {incluyeIva && (
                      <div className="flex justify-between text-[#B4B4C8] text-xs">
                        <span>IVA (21%):</span>
                        <span>{formatearEuros(ivaTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-[#00C8FF] pt-1 border-t border-[rgba(0,200,255,0.3)]">
                      <span>Total Propuesta:</span>
                      <span>{formatearEuros(precioTotalPropuesta)}</span>
                    </div>
                  </div>
                </div>

                {/* Sala de Demostración WebXR Adjunta */}
                <div className="p-3 rounded-lg bg-[rgba(0,200,255,0.06)] border border-[rgba(0,200,255,0.25)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#00C8FF] flex items-center gap-1.5">
                      <Sparkles size={12} /> Entorno WebXR de Demostración para Claustro
                    </span>
                    <p className="text-[11px] text-[#F2F2F7]">
                      Espacio virtual activo para probar la experiencia en clase sin cascos VR.
                    </p>
                  </div>
                  <a
                    href="https://eonesia.com/space/demo-interactiva-aula-3d"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C8FF] text-[#000000] font-bold text-xs shrink-0 hover:bg-[#68d3ff] transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>Abrir Aula Virtual 3D</span>
                  </a>
                </div>

                {/* Barra de Acciones del Presupuesto */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleImprimirPropuesta}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161622] hover:bg-[#202030] text-[#F2F2F7] border border-[rgba(255,255,255,0.15)] text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Imprimir / Guardar en PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://eonesia.com/propuesta/PROP-2026-${op.id.substring(0, 5).toUpperCase()}`);
                        alert('¡Enlace de propuesta copiado al portapapeles!');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161622] hover:bg-[#202030] text-[#00C8FF] border border-[rgba(0,200,255,0.25)] text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Share2 size={13} />
                      <span>Copiar enlace</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleGuardarPropuestaEnCRM}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00C8FF] to-[#E96999] text-[#000000] font-bold text-xs hover:opacity-95 shadow-[0_0_15px_rgba(0,200,255,0.35)] transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Guardar y actualizar valor en CRM (+20 XP)</span>
                  </button>
                </div>

                {propuestaGuardadaExito && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                    <Check size={14} />
                    ¡Propuesta registrada con éxito! El valor del trato se ha actualizado a {formatearEuros(precioTotalPropuesta)} y se ha anotado en el Timeline.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
