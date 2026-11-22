import React, { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Radar, RefreshCw, X } from 'lucide-react';
import { EstadoCRM, Senal } from '../../types';
import { crmRepo } from '../../repo';
import { listarSenales, marcarSenal, nubeConfigurada } from '../../nube/sync';

interface Props {
  estado: EstadoCRM;
  onAbrirFicha: (opId: string) => void;
}

type Filtro = Senal['estado'];

export const SenalesView: React.FC<Props> = ({ estado, onAbrirFicha }) => {
  const [filtro, setFiltro] = useState<Filtro>('nueva');
  const [senales, setSenales] = useState<Senal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    if (!nubeConfigurada) return;
    setCargando(true);
    setError('');
    try {
      setSenales(await listarSenales(filtro));
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string })?.message || e));
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const centroDe = (s: Senal) =>
    estado.centros.find((c) => c.externalId && s.codigo_centro && c.externalId.trim() === s.codigo_centro.trim());

  const aprobar = async (s: Senal) => {
    setAviso('');
    const r = crmRepo.aprobarSenal(s);
    if (!r.oportunidadId) {
      setAviso(r.motivo || 'No se pudo aprobar.');
      return;
    }
    try {
      await marcarSenal(s.id, 'aprobada');
      setSenales((l) => l.filter((x) => x.id !== s.id));
      onAbrirFicha(r.oportunidadId);
    } catch (e) {
      setAviso(`La actividad se ha registrado, pero no se pudo marcar la señal: ${e instanceof Error ? e.message : e}`);
    }
  };

  const descartar = async (s: Senal) => {
    try {
      await marcarSenal(s.id, 'descartada');
      setSenales((l) => l.filter((x) => x.id !== s.id));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radar size={20} className="text-[#00C8FF]" />
            <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">Señales del radar</h2>
          </div>
          <p className="text-xs text-[#B4B4C8] mt-1">
            Publicaciones de los centros que encajan con Eonesia. Aprobar = nota en la ficha + próximo paso para mañana.
          </p>
        </div>
        {nubeConfigurada && (
          <div className="flex items-center gap-2">
            <div className="flex bg-[#05050A] p-1 rounded-lg border border-[rgba(255,255,255,0.06)] text-xs">
              {(['nueva', 'aprobada', 'descartada'] as Filtro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 rounded-md font-semibold capitalize ${filtro === f ? 'bg-[#00C8FF] text-[#0D0D14]' : 'text-[#B4B4C8]'}`}
                >
                  {f === 'nueva' ? 'Nuevas' : f === 'aprobada' ? 'Aprobadas' : 'Descartadas'}
                </button>
              ))}
            </div>
            <button onClick={() => void cargar()} className="p-2 rounded-lg text-[#B4B4C8] hover:text-[#00C8FF]" title="Recargar">
              <RefreshCw size={15} />
            </button>
          </div>
        )}
      </div>

      {!nubeConfigurada && (
        <div className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] text-xs text-[#B4B4C8]">
          La bandeja de señales necesita la nube (Supabase): el radar escribe allí cada mañana desde GitHub Actions.
        </div>
      )}
      {error && <p className="text-xs text-[#E96999]">{error}</p>}
      {aviso && <p className="text-xs text-amber-200">{aviso}</p>}
      {cargando && (
        <div className="flex items-center gap-2 text-xs text-[#B4B4C8]">
          <Loader2 size={14} className="animate-spin text-[#00C8FF]" /> Cargando…
        </div>
      )}
      {nubeConfigurada && !cargando && senales.length === 0 && !error && (
        <p className="text-xs text-[#B4B4C8]">No hay señales {filtro === 'nueva' ? 'nuevas' : filtro === 'aprobada' ? 'aprobadas' : 'descartadas'}.</p>
      )}

      <div className="grid gap-3">
        {senales.map((s) => {
          const centro = centroDe(s);
          return (
            <div key={s.id} className="p-4 rounded-xl bg-[#0D0D14] border border-[rgba(255,255,255,0.08)] space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#B4B4C8]">
                <span>{s.fecha_senal}</span>
                <span>·</span>
                <span className="text-[#F2F2F7] font-semibold">{centro?.nombre || s.centro}</span>
                {centro?.tier && <span className="px-1.5 rounded bg-[rgba(0,200,255,0.12)] text-[#00C8FF]">Tier {centro.tier}</span>}
                {!centro && <span className="px-1.5 rounded bg-amber-500/15 text-amber-200">No está en el CRM</span>}
                {s.tema && <span className="px-1.5 rounded bg-[#161622]">{s.tema}</span>}
              </div>
              <a href={s.enlace} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-[#00C8FF] hover:underline">
                {s.titulo || s.enlace} <ExternalLink size={12} />
              </a>
              {s.resumen && <p className="text-xs text-[#F2F2F7]">{s.resumen}</p>}
              {s.primera_frase && (
                <p className="text-xs text-[#B4B4C8] italic">Primera frase sugerida: «{s.primera_frase}»</p>
              )}
              {s.palabras && <p className="text-[10px] text-[#B4B4C8]">Palabras clave: {s.palabras}</p>}
              {filtro === 'nueva' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void aprobar(s)}
                    disabled={!centro}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00C8FF] text-[#0D0D14] text-xs font-semibold disabled:opacity-40"
                  >
                    <Check size={13} /> Aprobar
                  </button>
                  <button
                    onClick={() => void descartar(s)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.15)] text-[#B4B4C8] text-xs"
                  >
                    <X size={13} /> Descartar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
