import React, { useEffect, useState } from 'react';
import { crmRepo } from '../repo';
import { RespaldoCifradoInfo } from '../types';
import { formatearEuros } from '../utils/crmHelpers';
import {
  AlertCircle,
  Clock,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface ModalImportarCopiaProps {
  abierto: boolean;
  onCerrar: () => void;
}

export const ModalImportarCopia: React.FC<ModalImportarCopiaProps> = ({
  abierto,
  onCerrar,
}) => {
  const [pestaña, setPestaña] = useState<'archivo' | 'cifrados'>('cifrados');
  const [jsonTexto, setJsonTexto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [respaldos, setRespaldos] = useState<RespaldoCifradoInfo[]>([]);

  useEffect(() => {
    if (abierto) {
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
      setErrorMsg(null);
    }
  }, [abierto]);

  if (!abierto) return null;

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const contenido = event.target?.result as string;
      if (contenido) {
        setJsonTexto(contenido);
        setErrorMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImportar = () => {
    setErrorMsg(null);
    if (!jsonTexto.trim()) {
      setErrorMsg('Pega el texto JSON o selecciona un archivo de copia de seguridad.');
      return;
    }

    const res = crmRepo.importarCopiaJSON(jsonTexto);
    if (res.exito) {
      onCerrar();
    } else {
      setErrorMsg(res.error || 'Error al validar el archivo.');
    }
  };

  const handleRestaurarCifrado = (id: string, fechaStr: string) => {
    if (
      window.confirm(
        `¿Deseas restaurar el estado completo del CRM guardado el ${new Date(
          fechaStr
        ).toLocaleString()}? Los datos actuales se reemplazarán por los del respaldo.`
      )
    ) {
      const res = crmRepo.restaurarRespaldoCifrado(id);
      if (res.exito) {
        onCerrar();
      } else {
        setErrorMsg(res.error || 'Fallo al restaurar el respaldo cifrado.');
      }
    }
  };

  const handleCrearNuevoRespaldo = () => {
    crmRepo.crearRespaldoCifrado('Respaldo manual bajo demanda');
    setRespaldos(crmRepo.obtenerHistorialRespaldos());
  };

  const handleEliminarRespaldo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este punto de restauración cifrado?')) {
      crmRepo.eliminarRespaldoCifrado(id);
      setRespaldos(crmRepo.obtenerHistorialRespaldos());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] rounded-2xl p-5 md:p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#00C8FF]" />
            <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
              Copias de Seguridad y Puntos de Restauración
            </h3>
          </div>
          <button
            onClick={onCerrar}
            className="p-1 rounded text-[#B4B4C8] hover:text-[#F2F2F7] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de modo */}
        <div className="flex gap-2 p-1 bg-[#05050A] rounded-xl border border-[rgba(255,255,255,0.06)] text-xs">
          <button
            type="button"
            onClick={() => setPestaña('cifrados')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              pestaña === 'cifrados'
                ? 'bg-[rgba(0,200,255,0.18)] text-[#00C8FF] border border-[#00C8FF]/40 shadow-sm'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            <Lock size={13} />
            <span>Respaldos automáticos cifrados ({respaldos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setPestaña('archivo')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              pestaña === 'archivo'
                ? 'bg-[rgba(0,200,255,0.18)] text-[#00C8FF] border border-[#00C8FF]/40 shadow-sm'
                : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
            }`}
          >
            <Upload size={13} />
            <span>Importar archivo JSON</span>
          </button>
        </div>

        {/* Contenido Pestaña 1: Respaldos cifrados */}
        {pestaña === 'cifrados' && (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div className="flex items-center justify-between text-xs text-[#B4B4C8]">
              <p className="leading-snug">
                El CRM guarda automáticamente una copia cifrada con marca de tiempo ante cada cambio o error de sincronización.
              </p>
              <button
                type="button"
                onClick={handleCrearNuevoRespaldo}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(0,200,255,0.15)] hover:bg-[rgba(0,200,255,0.25)] text-[#00C8FF] font-bold text-xs border border-[rgba(0,200,255,0.3)] transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Crear ahora</span>
              </button>
            </div>

            {respaldos.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-[#000000]/40 border border-[rgba(255,255,255,0.06)] text-xs text-[#B4B4C8]">
                No hay respaldos automáticos registrados todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {respaldos.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-[#000000]/60 border border-[rgba(0,200,255,0.18)] hover:border-[rgba(0,200,255,0.4)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-mono font-bold text-[#F2F2F7]">
                          <Clock size={12} className="text-[#00C8FF]" />
                          {new Date(b.timestamp).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#161622] text-[#00C8FF] border border-[rgba(0,200,255,0.2)]">
                          🔒 Cifrado
                        </span>
                      </div>

                      <div className="text-[11px] text-[#B4B4C8] truncate">
                        {b.motivo}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#6B6B80]">
                        <span>{b.totalCentros} centros</span>
                        <span>·</span>
                        <span>{b.totalOportunidades} oportunidades</span>
                        <span>·</span>
                        <span>{formatearEuros(b.valorTotal)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestaurarCifrado(b.id, b.timestamp)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[rgba(233,105,153,0.15)] hover:bg-[rgba(233,105,153,0.25)] text-[#E96999] hover:text-[#ff85b3] font-bold text-xs border border-[rgba(233,105,153,0.3)] transition-colors cursor-pointer"
                        title="Restaurar el CRM al estado exacto de esta marca de tiempo"
                      >
                        <RotateCcw size={12} />
                        <span>Restaurar</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleEliminarRespaldo(b.id, e)}
                        className="p-1.5 rounded-lg text-[#6B6B80] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                        title="Eliminar este respaldo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contenido Pestaña 2: Archivo JSON externo */}
        {pestaña === 'archivo' && (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <p className="text-xs text-[#B4B4C8] leading-relaxed">
              Selecciona un archivo <code>.json</code> exportado previamente o pega su contenido aquí. Se restaurarán todos tus centros, oportunidades, historial de XP e insignias.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#F2F2F7] mb-1.5">
                Seleccionar archivo .json
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleArchivoSeleccionado}
                className="w-full text-xs text-[#B4B4C8] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#00C8FF] file:text-[#0D0D14] hover:file:bg-[#68d3ff] file:cursor-pointer cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F2F2F7] mb-1">
                O pega el contenido JSON directamente:
              </label>
              <textarea
                rows={5}
                value={jsonTexto}
                onChange={(e) => setJsonTexto(e.target.value)}
                placeholder='{"centros": [...], "oportunidades": [...]}'
                className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 font-mono text-xs text-[#F2F2F7]"
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Pie del modal */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
          <button
            onClick={onCerrar}
            className="px-3.5 py-1.5 text-xs text-[#B4B4C8] hover:text-[#F2F2F7] cursor-pointer"
          >
            Cerrar
          </button>

          {pestaña === 'archivo' && (
            <button
              onClick={handleImportar}
              disabled={!jsonTexto.trim()}
              className="px-4 py-2 rounded-xl bg-[#00C8FF] hover:bg-[#68d3ff] disabled:opacity-40 text-[#0D0D14] font-bold text-xs shadow cursor-pointer"
            >
              Validar e Importar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
