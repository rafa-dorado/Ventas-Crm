import React, { useMemo, useState } from 'react';
import { Centro, EstadoCRM, OrigenCentro, TipoCentro } from '../../types';
import { crmRepo } from '../../repo';
import { normalizarDominio, normalizarNombreCentro } from '../../utils/crmHelpers';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';

interface ProspectarViewProps {
  estado: EstadoCRM;
  onAbrirFicha: (opId: string) => void;
}

interface ResultadoIA {
  nombre: string;
  tipo: TipoCentro;
  provincia: string;
  web?: string;
  fuente_url?: string;
}

export const ProspectarView: React.FC<ProspectarViewProps> = ({ estado, onAbrirFicha }) => {
  const [tabActual, setTabActual] = useState<'ia' | 'csv' | 'json'>('ia');

  // Búsqueda con IA
  const [query, setQuery] = useState('centros de FP privados en Sevilla');
  const [cargandoIA, setCargandoIA] = useState(false);
  const [resultadosIA, setResultadosIA] = useState<ResultadoIA[]>([]);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [modoSimulado, setModoSimulado] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  // Importar CSV
  const [csvTexto, setCsvTexto] = useState('');
  const [resumenCsv, setResumenCsv] = useState<{ creados: number; duplicados: number } | null>(null);

  // Importar JSON
  const [jsonLeadTexto, setJsonLeadTexto] = useState('');
  const [vistaPreviaJson, setVistaPreviaJson] = useState<any | null>(null);
  const [errorJson, setErrorJson] = useState<string | null>(null);

  // Comprobar si un resultado ya existe en el CRM
  const verificarDuplicadoEnCRM = (item: ResultadoIA): boolean => {
    // 1. Por web
    if (item.web) {
      const domCandidato = normalizarDominio(item.web);
      if (domCandidato) {
        const existeWeb = estado.centros.some((c) => normalizarDominio(c.web) === domCandidato);
        if (existeWeb) return true;
      }
    }
    // 2. Por nombre + provincia normalizados
    const nomNorm = normalizarNombreCentro(item.nombre);
    const provNorm = normalizarNombreCentro(item.provincia);
    return estado.centros.some((c) => {
      const cNom = normalizarNombreCentro(c.nombre);
      const cProv = normalizarNombreCentro(c.provincia);
      const mismoNombre = cNom === nomNorm || cNom.includes(nomNorm) || nomNorm.includes(cNom);
      const mismaProv = !provNorm || !cProv || cProv === provNorm;
      return mismoNombre && mismaProv;
    });
  };

  const buscarConIA = async () => {
    if (!query.trim()) return;
    setCargandoIA(true);
    setErrorIA(null);
    setSeleccionados(new Set());

    try {
      const res = await fetch('/api/prospectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fallo en la búsqueda con IA.');
      }

      setResultadosIA(data.resultados || []);
      setModoSimulado(Boolean(data.modoSimulado));
    } catch (err: any) {
      setErrorIA(err.message || 'Error al conectar con la IA de prospección.');
    } finally {
      setCargandoIA(false);
    }
  };

  // Añadir al tablero con límite de 30 XP al día
  const handleAnadirUno = (item: ResultadoIA) => {
    const res = crmRepo.anadirCentrosProspeccion([
      {
        nombre: item.nombre,
        tipo: item.tipo,
        provincia: item.provincia,
        web: item.web || '',
        origen: 'prospeccion',
        verificado: false,
      },
    ]);
  };

  const handleAnadirSeleccionados = () => {
    const items = Array.from(seleccionados).map((idx) => resultadosIA[idx]).filter(Boolean);
    if (items.length === 0) return;

    const candidatos = items.map((item) => ({
      nombre: item.nombre,
      tipo: item.tipo,
      provincia: item.provincia,
      web: item.web || '',
      origen: 'prospeccion' as OrigenCentro,
      verificado: false,
    }));

    crmRepo.anadirCentrosProspeccion(candidatos);
    setSeleccionados(new Set());
  };

  const toggleSeleccion = (idx: number) => {
    const copia = new Set(seleccionados);
    if (copia.has(idx)) copia.delete(idx);
    else copia.add(idx);
    setSeleccionados(copia);
  };

  // CSV
  const descargarPlantillaCSV = () => {
    const cabecera = 'nombre,tipo,provincia,web,alumnos,contacto,cargo,valor\n';
    const filas = [
      'CIFP Guadalquivir,FP,Sevilla,https://cifpguadalquivir.es,1200,Elena Ramos,Coord. FP Dual,15000\n',
      'Colegio Monteclaro,Privado,Madrid,https://monteclaro.es,950,Carlos Vega,Director General,4200\n',
    ].join('');
    const blob = new Blob([cabecera + filas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_prospeccion_eonesia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const procesarCSV = () => {
    if (!csvTexto.trim()) return;
    const lineas = csvTexto.trim().split('\n');
    if (lineas.length <= 1) return;

    const candidatos: Array<Partial<Centro>> = [];

    for (let i = 1; i < lineas.length; i++) {
      const col = lineas[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (col.length >= 3 && col[0]) {
        candidatos.push({
          nombre: col[0],
          tipo: (col[1] as TipoCentro) || 'FP',
          provincia: col[2] || 'España',
          web: col[3] || '',
          alumnos: Number(col[4]) || 500,
          origen: 'csv',
          verificado: false,
        });
      }
    }

    const res = crmRepo.anadirCentrosProspeccion(candidatos);
    setResumenCsv({
      creados: res.creados.length,
      duplicados: res.duplicadosCount,
    });
    setCsvTexto('');
  };

  // JSON Lead
  const handleAnalizarJson = () => {
    setErrorJson(null);
    try {
      const data = JSON.parse(jsonLeadTexto.trim());
      if (!data.nombre) throw new Error('El JSON debe contener al menos la propiedad "nombre".');
      setVistaPreviaJson(data);
    } catch (e: any) {
      setErrorJson(`Error en JSON: ${e.message}`);
      setVistaPreviaJson(null);
    }
  };

  const handleConfirmarImportarJSON = () => {
    if (!vistaPreviaJson) return;
    const res = crmRepo.ingestar(
      [
        {
          nombre: vistaPreviaJson.nombre,
          tipo: vistaPreviaJson.tipo || 'FP',
          provincia: vistaPreviaJson.provincia || 'España',
          web: vistaPreviaJson.web || '',
          alumnos: Number(vistaPreviaJson.alumnos) || 600,
          origen: 'json',
          verificado: false,
        },
      ],
      'json'
    );

    const centro = res.creados[0] || (res.duplicados[0]?.existente as Centro);
    if (centro) {
      // Recompensa +10 XP por importar lead estructurado
      crmRepo.darXP(10, 'Lead enriquecido importado vía JSON');
    }

    setVistaPreviaJson(null);
    setJsonLeadTexto('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)]">
        <div>
          <div className="flex items-center gap-2">
            <Compass size={20} className="text-[#00C8FF]" />
            <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">
              Motor de Prospección y Enriquecimiento
            </h2>
          </div>
          <p className="text-xs text-[#B4B4C8] mt-1">
            Descubre nuevos centros con búsqueda en Google vía Gemini API. Solo organizaciones; nunca datos de personas.
          </p>
        </div>

        {/* Selector de pestañas */}
        <div className="flex bg-[#05050A] p-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-xs">
          <button
            onClick={() => setTabActual('ia')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabActual === 'ia'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Buscar con IA
          </button>
          <button
            onClick={() => setTabActual('csv')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabActual === 'csv'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Importar CSV
          </button>
          <button
            onClick={() => setTabActual('json')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              tabActual === 'json'
                ? 'bg-[#00C8FF] text-[#0D0D14] shadow'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            Importar JSON
          </button>
        </div>
      </div>

      {/* AVISO LEGAL VISIBLE OBLIGATORIO */}
      <div className="p-3.5 rounded-xl bg-[rgba(0,200,255,0.08)] border border-[rgba(0,200,255,0.3)] flex items-start gap-2.5 text-xs text-[#B4B4C8]">
        <AlertTriangle size={16} className="text-[#00C8FF] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#F2F2F7]">Aviso de calidad y privacidad:</strong> Los resultados de la IA pueden contener errores: verifica cada centro antes de contactar. Recuerda cumplir con el RGPD y la LSSI al iniciar contacto en frío.
        </div>
      </div>

      {/* =========================================================================
          PESTAÑA 1: BUSCADOR CON IA (GEMINI API + GOOGLE SEARCH GROUNDING)
         ========================================================================= */}
      {tabActual === 'ia' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
              Consulta de prospección
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarConIA()}
                  placeholder="Ej. centros de FP privados en Sevilla"
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg py-2.5 pl-9 pr-3 text-xs text-[#F2F2F7] focus:border-[#00C8FF]"
                />
                <Search size={15} className="absolute left-3 top-3 text-[#B4B4C8]" />
              </div>

              <button
                onClick={buscarConIA}
                disabled={cargandoIA}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {cargandoIA ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Rastreando la web...</span>
                  </>
                ) : (
                  <>
                    <Bot size={15} />
                    <span>Buscar con IA</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#B4B4C8]">
              <span>+3 XP por centro añadido al CRM (máx 30 XP al día)</span>
              <span>Límite: hasta 15 organizaciones</span>
            </div>
          </div>

          {/* Mensaje de error con botón Reintentar */}
          {errorIA && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                <span>{errorIA}</span>
              </div>
              <button
                onClick={buscarConIA}
                className="px-3 py-1 rounded bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors flex items-center gap-1"
              >
                <RotateCcw size={13} /> Reintentar
              </button>
            </div>
          )}

          {/* Resultados de la búsqueda */}
          {resultadosIA.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[rgba(255,255,255,0.06)]">
                <div>
                  <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                    Resultados encontrados ({resultadosIA.length})
                  </span>
                  {modoSimulado && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Modo demo (conecta GEMINI_API_KEY para búsqueda en vivo)
                    </span>
                  )}
                </div>

                {seleccionados.size > 0 && (
                  <button
                    onClick={handleAnadirSeleccionados}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C8FF] hover:bg-[#68d3ff] text-[#0D0D14] font-bold text-xs shadow transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span>Añadir {seleccionados.size} seleccionados</span>
                    <span className="text-[10px] bg-[#0D0D14]/20 px-1 rounded">
                      +{seleccionados.size * 3} XP
                    </span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                {resultadosIA.map((item, idx) => {
                  const yaExiste = verificarDuplicadoEnCRM(item);
                  const estaSeleccionado = seleccionados.has(idx);

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        yaExiste
                          ? 'bg-[#000000]/40 border-[rgba(255,255,255,0.05)] opacity-75'
                          : estaSeleccionado
                          ? 'bg-[rgba(0,200,255,0.08)] border-[#00C8FF]'
                          : 'bg-[#000000]/70 border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,200,255,0.3)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!yaExiste && (
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleSeleccion(idx)}
                            className="mt-1 w-4 h-4 rounded text-[#00C8FF] bg-[#05050A] border-[rgba(0,200,255,0.4)] focus:ring-0 cursor-pointer"
                          />
                        )}

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#F2F2F7]">
                              {item.nombre}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#161622] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                              {item.tipo}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                              Por verificar
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[#B4B4C8] mt-1">
                            <span>{item.provincia}</span>
                            {item.web && (
                              <>
                                <span>·</span>
                                <a
                                  href={item.web.startsWith('http') ? item.web : `https://${item.web}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#00C8FF] hover:underline flex items-center gap-0.5"
                                >
                                  Web oficial <ExternalLink size={10} />
                                </a>
                              </>
                            )}
                            {item.fuente_url && (
                              <>
                                <span>·</span>
                                <a
                                  href={item.fuente_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#B4B4C8] hover:text-[#F2F2F7] hover:underline flex items-center gap-0.5"
                                >
                                  Fuente web <ExternalLink size={10} />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {yaExiste ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#161622] text-[#6B6B80] border border-[rgba(255,255,255,0.06)] cursor-not-allowed">
                            Ya está en tu CRM
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAnadirUno(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00C8FF] hover:bg-[#68d3ff] text-[#0D0D14] font-bold text-xs shadow transition-colors active:scale-95"
                          >
                            <Plus size={13} />
                            <span>Añadir al tablero</span>
                            <span className="text-[10px] opacity-80">(+3 XP)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: IMPORTAR CSV
         ========================================================================= */}
      {tabActual === 'csv' && (
        <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
              Importación Masiva de Centros en CSV
            </span>
            <button
              onClick={descargarPlantillaCSV}
              className="flex items-center gap-1.5 text-xs text-[#00C8FF] hover:underline"
            >
              <Download size={14} />
              <span>Descargar plantilla CSV</span>
            </button>
          </div>

          <p className="text-[#B4B4C8] leading-relaxed">
            Pega el contenido CSV (con cabecera: nombre, tipo, provincia, web, alumnos, contacto, cargo, valor). Todos los centros pasarán por la función de ingesta con deduplicación automática.
          </p>

          <textarea
            rows={6}
            value={csvTexto}
            onChange={(e) => setCsvTexto(e.target.value)}
            placeholder="nombre,tipo,provincia,web,alumnos,contacto,cargo,valor&#10;CIFP Guadalquivir,FP,Sevilla,https://cifpguadalquivir.es,1200,Elena Ramos,Coord. FP Dual,15000"
            className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-3 font-mono text-xs text-[#F2F2F7]"
          />

          {resumenCsv && (
            <div className="p-3 rounded-lg bg-[rgba(0,200,255,0.1)] border border-[rgba(0,200,255,0.3)] text-xs text-[#00C8FF]">
              ✓ Resumen de importación: <strong>{resumenCsv.creados} centros creados</strong> y{' '}
              <strong>{resumenCsv.duplicados} duplicados omitidos</strong>.
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={procesarCSV}
              disabled={!csvTexto.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#00C8FF] hover:bg-[#68d3ff] disabled:opacity-40 text-[#0D0D14] font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <Upload size={14} />
              <span>Importar CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: IMPORTAR JSON (LEAD ESTRUCTURADO)
         ========================================================================= */}
      {tabActual === 'json' && (
        <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
              Importar Lead Analizado en JSON (+10 XP)
            </span>
          </div>

          <p className="text-[#B4B4C8] leading-relaxed">
            Pega aquí el JSON de un lead analizado. Podrás ver una vista previa antes de guardarlo en tu tablero.
          </p>

          <textarea
            rows={6}
            value={jsonLeadTexto}
            onChange={(e) => setJsonLeadTexto(e.target.value)}
            placeholder='{
  "nombre": "Colegio San Bernardo",
  "tipo": "Privado",
  "provincia": "Valencia",
  "web": "https://colegiosanbernardo.com",
  "alumnos": 850
}'
            className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-3 font-mono text-xs text-[#F2F2F7]"
          />

          {errorJson && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {errorJson}
            </div>
          )}

          {vistaPreviaJson && (
            <div className="p-3.5 rounded-lg bg-[#000000]/80 border border-[rgba(0,200,255,0.3)] space-y-2">
              <span className="font-heading font-bold text-[#00C8FF]">
                Vista previa del lead:
              </span>
              <p>
                <strong>Centro:</strong> {vistaPreviaJson.nombre} ({vistaPreviaJson.tipo || 'FP'},{' '}
                {vistaPreviaJson.provincia})
              </p>
              {vistaPreviaJson.web && <p><strong>Web:</strong> {vistaPreviaJson.web}</p>}
              <button
                onClick={handleConfirmarImportarJSON}
                className="mt-2 px-4 py-2 rounded-lg bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow"
              >
                Confirmar y añadir (+10 XP)
              </button>
            </div>
          )}

          {!vistaPreviaJson && (
            <div className="flex justify-end">
              <button
                onClick={handleAnalizarJson}
                disabled={!jsonLeadTexto.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#00C8FF] hover:bg-[#68d3ff] disabled:opacity-40 text-[#0D0D14] font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Analizar JSON
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
