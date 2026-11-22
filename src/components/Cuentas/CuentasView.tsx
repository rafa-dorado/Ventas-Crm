import React, { useMemo, useRef, useState } from 'react';
import { Building2, FileUp, Play, Search } from 'lucide-react';
import { Centro, EstadoCRM } from '../../types';
import { crmRepo } from '../../repo';
import { nubeConfigurada } from '../../nube/sync';
import { parsearCSV } from '../../utils/csv';
import { filaTAMaCentro } from '../../utils/tam';

interface Props {
  estado: EstadoCRM;
  onAbrirFicha: (opId: string) => void;
}

const POR_PAGINA = 50;
const LIMITE_LOCAL = 300; // sin nube, el navegador no aguanta el TAM completo con respaldos

const sel = 'px-2 py-1.5 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.1)] text-xs text-[#F2F2F7]';

export const CuentasView: React.FC<Props> = ({ estado, onAbrirFicha }) => {
  const [busqueda, setBusqueda] = useState('');
  const [tier, setTier] = useState<'todos' | '1' | '2' | '3' | 'sin'>('todos');
  const [provincia, setProvincia] = useState('todas');
  const [segmento, setSegmento] = useState('todos');
  const [soloSinOportunidad, setSoloSinOportunidad] = useState(false);
  const [pagina, setPagina] = useState(0);

  // Importador
  const [filasTAM, setFilasTAM] = useState<Array<Partial<Centro>> | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [crearTier1, setCrearTier1] = useState(false);
  const [soloTier1, setSoloTier1] = useState(!nubeConfigurada);
  const [resultado, setResultado] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const opAbiertaPorCentro = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of estado.oportunidades) {
      if (o.etapa !== 'Ganado' && o.etapa !== 'Perdido') m.set(o.centroId, o.id);
    }
    return m;
  }, [estado.oportunidades]);

  const provincias = useMemo(
    () => [...new Set(estado.centros.map((c) => c.provincia).filter(Boolean))].sort(),
    [estado.centros]
  );
  const segmentos = useMemo(
    () => [...new Set(estado.centros.map((c) => c.segmento).filter(Boolean) as string[])].sort(),
    [estado.centros]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return estado.centros
      .filter((c) => {
        if (tier === 'sin' ? c.tier : tier !== 'todos' && String(c.tier) !== tier) return false;
        if (provincia !== 'todas' && c.provincia !== provincia) return false;
        if (segmento !== 'todos' && c.segmento !== segmento) return false;
        if (soloSinOportunidad && opAbiertaPorCentro.has(c.id)) return false;
        if (q && !`${c.nombre} ${c.municipio || ''} ${c.redPadre || ''} ${c.externalId || ''}`.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => (a.tier || 9) - (b.tier || 9) || (b.fitScore || 0) - (a.fitScore || 0) || a.nombre.localeCompare(b.nombre));
  }, [estado.centros, busqueda, tier, provincia, segmento, soloSinOportunidad, opAbiertaPorCentro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = filtrados.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA);
  const porTier = [1, 2, 3].map((t) => estado.centros.filter((c) => c.tier === t).length);

  const leerArchivo = async (f: File) => {
    setResultado('');
    const texto = await f.text();
    const filas = parsearCSV(texto).map(filaTAMaCentro).filter((c) => c.nombre && c.externalId);
    setNombreArchivo(f.name);
    setFilasTAM(filas);
  };

  const aImportar = filasTAM ? (soloTier1 ? filasTAM.filter((f) => f.tier === 1) : filasTAM) : [];
  const bloqueadoLocal = !nubeConfigurada && aImportar.length > LIMITE_LOCAL;

  const importar = () => {
    if (!aImportar.length || bloqueadoLocal) return;
    const r = crmRepo.importarTAM(aImportar, { crearOportunidadTier1: crearTier1 });
    setResultado(
      `${r.creados} cuentas nuevas · ${r.actualizados} actualizadas${r.oportunidades ? ` · ${r.oportunidades} oportunidades Tier 1 en el Tablero` : ''}${r.omitidos ? ` · ${r.omitidos} filas sin código omitidas` : ''}`
    );
    setFilasTAM(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const trabajar = (c: Centro) => {
    const opId = crmRepo.trabajarCuenta(c.id);
    if (opId) onAbrirFicha(opId);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-[#00C8FF]" />
            <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">Cuentas (TAM)</h2>
          </div>
          <p className="text-xs text-[#B4B4C8] mt-1">
            {estado.centros.length} centros · Tier 1: {porTier[0]} · Tier 2: {porTier[1]} · Tier 3: {porTier[2]}. «Trabajar» pasa la
            cuenta al Tablero en Detectado.
          </p>
        </div>
      </div>

      {/* Importador TAM */}
      <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-3">
        <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#00C8FF]">
          <FileUp size={14} /> Importar TAM (CSV de cuentas)
        </div>
        <p className="text-xs text-[#B4B4C8]">
          Columnas: codigo_centro, nombre, tipo, provincia, municipio, telefono, email_centro, alumnos_prim_eso, cuenta_padre,
          segmento, tier, fit_score, fuente. Se actualiza por código de centro: volver a importar no duplica ni toca tus
          oportunidades.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && void leerArchivo(e.target.files[0])}
          className="text-xs text-[#B4B4C8] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#161622] file:text-[#00C8FF]"
        />
        {filasTAM && (
          <div className="space-y-2 text-xs">
            <p className="text-[#F2F2F7]">
              {nombreArchivo}: {filasTAM.length} filas válidas ({filasTAM.filter((f) => f.tier === 1).length} Tier 1).
            </p>
            <label className="flex items-center gap-2 text-[#B4B4C8]">
              <input type="checkbox" checked={soloTier1} onChange={(e) => setSoloTier1(e.target.checked)} /> Importar solo Tier 1
            </label>
            <label className="flex items-center gap-2 text-[#B4B4C8]">
              <input type="checkbox" checked={crearTier1} onChange={(e) => setCrearTier1(e.target.checked)} /> Crear oportunidad en
              Detectado para cada Tier 1
            </label>
            {bloqueadoLocal && (
              <p className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                Sin nube, el navegador no tiene espacio para {aImportar.length} cuentas con sus copias de seguridad. Activa
                Supabase o marca «Importar solo Tier 1».
              </p>
            )}
            <button
              onClick={importar}
              disabled={!aImportar.length || bloqueadoLocal}
              className="px-4 py-2 rounded-lg bg-[#00C8FF] text-[#0D0D14] font-semibold disabled:opacity-40"
            >
              Importar {aImportar.length} cuentas
            </button>
          </div>
        )}
        {resultado && <p className="text-xs text-[#00C8FF]">{resultado}</p>}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-2 text-[#B4B4C8]" />
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(0);
            }}
            placeholder="Nombre, municipio, red o código"
            className={`${sel} pl-7 w-56`}
          />
        </div>
        <select value={tier} onChange={(e) => { setTier(e.target.value as typeof tier); setPagina(0); }} className={sel}>
          <option value="todos">Todos los tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
          <option value="sin">Sin tier</option>
        </select>
        <select value={provincia} onChange={(e) => { setProvincia(e.target.value); setPagina(0); }} className={sel}>
          <option value="todas">Todas las provincias</option>
          {provincias.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={segmento} onChange={(e) => { setSegmento(e.target.value); setPagina(0); }} className={sel}>
          <option value="todos">Todos los segmentos</option>
          {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#B4B4C8]">
          <input type="checkbox" checked={soloSinOportunidad} onChange={(e) => { setSoloSinOportunidad(e.target.checked); setPagina(0); }} />
          Sin oportunidad abierta
        </label>
        <span className="text-xs text-[#B4B4C8] ml-auto">{filtrados.length} resultados</span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)]">
        <table className="w-full text-xs">
          <thead className="bg-[#0D0D14] text-[#B4B4C8]">
            <tr>
              <th className="text-left p-2">Tier</th>
              <th className="text-left p-2">Fit</th>
              <th className="text-left p-2">Centro</th>
              <th className="text-left p-2 hidden md:table-cell">Municipio</th>
              <th className="text-left p-2 hidden lg:table-cell">Red</th>
              <th className="text-left p-2 hidden md:table-cell">Contacto general</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => {
              const opId = opAbiertaPorCentro.get(c.id);
              return (
                <tr key={c.id} className="border-t border-[rgba(255,255,255,0.05)] hover:bg-[#0D0D14]">
                  <td className="p-2 font-semibold text-[#00C8FF]">{c.tier ?? '–'}</td>
                  <td className="p-2 text-[#F2F2F7]">{c.fitScore ?? '–'}</td>
                  <td className="p-2">
                    <div className="text-[#F2F2F7] font-medium">{c.nombre}</div>
                    <div className="text-[10px] text-[#B4B4C8]">
                      {c.tipo} · {c.provincia}
                      {c.alumnos ? ` · ${c.alumnos} alumnos` : ''}
                    </div>
                  </td>
                  <td className="p-2 hidden md:table-cell text-[#B4B4C8]">{c.municipio || '–'}</td>
                  <td className="p-2 hidden lg:table-cell text-[#B4B4C8] max-w-[180px] truncate">{c.redPadre || c.red || '–'}</td>
                  <td className="p-2 hidden md:table-cell text-[#B4B4C8]">
                    {c.telefono && <div>{c.telefono}</div>}
                    {c.emailGeneral && <div className="truncate max-w-[200px]">{c.emailGeneral}</div>}
                  </td>
                  <td className="p-2 text-right">
                    {opId ? (
                      <button onClick={() => onAbrirFicha(opId)} className="px-2.5 py-1 rounded-md border border-[rgba(0,200,255,0.4)] text-[#00C8FF]">
                        Ver ficha
                      </button>
                    ) : (
                      <button
                        onClick={() => trabajar(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#00C8FF] text-[#0D0D14] font-semibold"
                      >
                        <Play size={11} /> Trabajar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#B4B4C8]">
                  No hay cuentas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-[#B4B4C8]">
          <button disabled={paginaSegura === 0} onClick={() => setPagina(paginaSegura - 1)} className="px-2 py-1 disabled:opacity-30">
            ← Anterior
          </button>
          <span>
            Página {paginaSegura + 1} de {totalPaginas}
          </span>
          <button
            disabled={paginaSegura >= totalPaginas - 1}
            onClick={() => setPagina(paginaSegura + 1)}
            className="px-2 py-1 disabled:opacity-30"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};
