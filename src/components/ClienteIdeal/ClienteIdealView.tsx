import React, { useState } from 'react';
import { EstadoCRM, FichaICP, PesosICP, ProbabilidadesEtapa } from '../../types';
import { crmRepo } from '../../repo';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  HelpCircle,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Target,
} from 'lucide-react';

interface ClienteIdealViewProps {
  estado: EstadoCRM;
}

export const ClienteIdealView: React.FC<ClienteIdealViewProps> = ({ estado }) => {
  const [ficha, setFicha] = useState<FichaICP>({ ...estado.config.fichaICP });
  const [pesos, setPesos] = useState<PesosICP>({ ...estado.config.pesosICP });
  const [probabilidades, setProbabilidades] = useState<ProbabilidadesEtapa>({
    ...estado.config.probabilidades,
  });
  const [objetivoVentas, setObjetivoVentas] = useState<number>(estado.config.objetivoVentas || 100000);

  // IA ICP Import prompt & json
  const [jsonPegado, setJsonPegado] = useState('');
  const [errorJson, setErrorJson] = useState<string | null>(null);
  const [exitoJson, setExitoJson] = useState(false);
  const [promptCopiado, setPromptCopiado] = useState(false);
  const [guardadoFeedback, setGuardadoFeedback] = useState(false);

  const promptParaIA = `Eres un estratega experto en ventas B2B para EdTech (espacios educativos inmersivos en navegador).
Analiza el cliente ideal (ICP) para Eonesia y genera un JSON estrictamente con la siguiente estructura:

{
  "ficha": {
    "quien": "Definición del decisor o perfil clave (1-2 frases)",
    "problema": "El dolor y problema crítico que experimenta (1-2 frases)",
    "donde": "Canales y lugares exactos donde encontrarlo (1-2 frases)",
    "comoCompra": "Ciclo y dinámica de compra habitual (1-2 frases)",
    "noEncaja": "Criterios de descarte inmediato (1-2 frases)"
  },
  "pesos": {
    "decisor": 5,
    "dinero": 4,
    "segmento": 4,
    "dolor": 3,
    "catalogo": 3
  }
}

Importante: Devuelve ÚNICAMENTE el objeto JSON sin texto antes ni después. Los pesos deben ser números enteros entre 1 y 5.`;

  const handleCopiarPrompt = () => {
    navigator.clipboard.writeText(promptParaIA);
    setPromptCopiado(true);
    setTimeout(() => setPromptCopiado(false), 2500);
  };

  const handleAplicarJson = () => {
    setErrorJson(null);
    setExitoJson(false);

    try {
      let texto = jsonPegado.trim();
      if (texto.startsWith('```json')) {
        texto = texto.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (texto.startsWith('```')) {
        texto = texto.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(texto);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('El texto no es un objeto JSON válido.');
      }

      const nuevaFicha: Partial<FichaICP> = {};
      if (parsed.ficha && typeof parsed.ficha === 'object') {
        if (parsed.ficha.quien) nuevaFicha.quien = String(parsed.ficha.quien);
        if (parsed.ficha.problema) nuevaFicha.problema = String(parsed.ficha.problema);
        if (parsed.ficha.donde) nuevaFicha.donde = String(parsed.ficha.donde);
        if (parsed.ficha.comoCompra) nuevaFicha.comoCompra = String(parsed.ficha.comoCompra);
        if (parsed.ficha.noEncaja) nuevaFicha.noEncaja = String(parsed.ficha.noEncaja);
      }

      const nuevosPesos: Partial<PesosICP> = {};
      if (parsed.pesos && typeof parsed.pesos === 'object') {
        if (parsed.pesos.decisor) nuevosPesos.decisor = Math.min(Math.max(Number(parsed.pesos.decisor), 1), 5);
        if (parsed.pesos.dinero) nuevosPesos.dinero = Math.min(Math.max(Number(parsed.pesos.dinero), 1), 5);
        if (parsed.pesos.segmento) nuevosPesos.segmento = Math.min(Math.max(Number(parsed.pesos.segmento), 1), 5);
        if (parsed.pesos.dolor) nuevosPesos.dolor = Math.min(Math.max(Number(parsed.pesos.dolor), 1), 5);
        if (parsed.pesos.catalogo) nuevosPesos.catalogo = Math.min(Math.max(Number(parsed.pesos.catalogo), 1), 5);
      }

      const fichaCompleta = { ...ficha, ...nuevaFicha };
      const pesosCompletos = { ...pesos, ...nuevosPesos };

      setFicha(fichaCompleta);
      setPesos(pesosCompletos);

      crmRepo.actualizarConfig({
        fichaICP: fichaCompleta,
        pesosICP: pesosCompletos,
      });

      setExitoJson(true);
      setTimeout(() => setExitoJson(false), 3000);
    } catch (err: any) {
      setErrorJson(`JSON inválido: ${err.message}. Comprueba las llaves y comillas.`);
    }
  };

  const handleGuardarTodo = () => {
    crmRepo.actualizarConfig({
      fichaICP: ficha,
      pesosICP: pesos,
      probabilidades,
      objetivoVentas,
    });
    setGuardadoFeedback(true);
    setTimeout(() => setGuardadoFeedback(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Cabecera de la sección */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)]">
        <div>
          <div className="flex items-center gap-2">
            <Target size={20} className="text-[#00C8FF]" />
            <h2 className="font-heading font-bold text-lg text-[#F2F2F7]">
              Cliente Ideal (ICP) y Algoritmo de Encaje
            </h2>
          </div>
          <p className="text-xs text-[#B4B4C8] mt-1">
            Define tu foco comercial. El encaje calcula el parecido con tu cliente ideal (0-100%); es independiente de la probabilidad de cierre.
          </p>
        </div>

        <button
          onClick={handleGuardarTodo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00C8FF] hover:bg-[#68d3ff] text-[#0D0D14] font-bold text-xs shadow transition-all active:scale-95"
        >
          <Save size={15} />
          <span>{guardadoFeedback ? '¡Guardado!' : 'Guardar configuración'}</span>
        </button>
      </div>

      {/* 1. FICHA DE 5 FRASES EDITABLES */}
      <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
            Ficha del ICP · 5 Frases Nucleares
          </span>
          <span className="text-[11px] text-[#B4B4C8]">Texto base oficial Eonesia</span>
        </div>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[#00C8FF] font-bold mb-1">1. Quién es:</label>
            <textarea
              rows={2}
              value={ficha.quien}
              onChange={(e) => setFicha({ ...ficha, quien: e.target.value })}
              className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2.5 text-[#F2F2F7] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[#00C8FF] font-bold mb-1">2. Qué problema tiene:</label>
            <textarea
              rows={2}
              value={ficha.problema}
              onChange={(e) => setFicha({ ...ficha, problema: e.target.value })}
              className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2.5 text-[#F2F2F7] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[#00C8FF] font-bold mb-1">3. Dónde lo encuentro:</label>
            <textarea
              rows={2}
              value={ficha.donde}
              onChange={(e) => setFicha({ ...ficha, donde: e.target.value })}
              className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2.5 text-[#F2F2F7] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[#00C8FF] font-bold mb-1">4. Cómo compra:</label>
            <textarea
              rows={2}
              value={ficha.comoCompra}
              onChange={(e) => setFicha({ ...ficha, comoCompra: e.target.value })}
              className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.25)] rounded-lg p-2.5 text-[#F2F2F7] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[#E96999] font-bold mb-1">5. Cuándo NO encaja (Descarte):</label>
            <textarea
              rows={2}
              value={ficha.noEncaja}
              onChange={(e) => setFicha({ ...ficha, noEncaja: e.target.value })}
              className="w-full bg-[#05050A] border border-[rgba(233,105,153,0.3)] rounded-lg p-2.5 text-[#F2F2F7] leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* 2. 5 CRITERIOS CON DESLIZADORES DE PESO (1 A 5) */}
      <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
            Ponderación de los 5 Criterios de Encaje (Peso 1 a 5)
          </span>
          <span className="text-[11px] text-[#B4B4C8]">
            Encaje = Σ(peso × valor) / Σ(pesos criterios evaluados)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {[
            {
              clave: 'decisor' as const,
              nombre: 'Acceso al decisor',
              desc: 'Hablo con quien firma = 1 · Influyente (TIC/docente) = 0.5 · Sin contacto = 0',
            },
            {
              clave: 'dinero' as const,
              nombre: 'Dinero disponible',
              desc: 'Presupuesto propio y ágil = 1 · Limitado o con fondos = 0.5 · Depende de Consejería = 0',
            },
            {
              clave: 'segmento' as const,
              nombre: 'Prioridad del segmento',
              desc: 'FP o Privado = 1 · Concertado, Universidad o Editorial = 0.5 · Institucional o Público = 0',
            },
            {
              clave: 'dolor' as const,
              nombre: 'Dolor activo',
              desc: 'Lo ha dicho explícitamente = 1 · Latente = 0.5 · No hay dolor = 0',
            },
            {
              clave: 'catalogo' as const,
              nombre: 'Encaje con catálogo',
              desc: 'Tenemos el mundo listo = 1 · Le sirve un mundo vacío = 0.5 · Producción a medida = 0',
            },
          ].map((item) => (
            <div
              key={item.clave}
              className="p-3.5 rounded-xl bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#F2F2F7]">{item.nombre}</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#161622] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]">
                  Peso {pesos[item.clave]}
                </span>
              </div>
              <p className="text-[11px] text-[#B4B4C8] leading-tight">{item.desc}</p>
              <div className="pt-1 flex items-center gap-3">
                <span className="text-[10px] text-[#6B6B80]">1</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={pesos[item.clave]}
                  onChange={(e) =>
                    setPesos({ ...pesos, [item.clave]: Number(e.target.value) })
                  }
                  className="flex-1 accent-[#00C8FF] cursor-pointer"
                />
                <span className="text-[10px] text-[#6B6B80]">5</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. PROBABILIDADES POR ETAPA & OBJETIVO DE VENTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Probabilidades por etapa */}
        <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
              Probabilidad de Cierre por Etapa (%)
            </span>
          </div>
          <p className="text-[11px] text-[#B4B4C8]">
            Se usa para calcular la <strong>previsión ponderada</strong> de ventas en el Panel.
          </p>

          <div className="space-y-2.5 text-xs">
            {(
              [
                { etapa: 'Detectado', defecto: 10 },
                { etapa: 'Demo', defecto: 25 },
                { etapa: 'Piloto', defecto: 50 },
                { etapa: 'Propuesta', defecto: 70 },
                { etapa: 'Ganado', defecto: 100 },
                { etapa: 'Perdido', defecto: 0 },
              ] as const
            ).map((e) => (
              <div key={e.etapa} className="flex items-center justify-between gap-3">
                <span className="w-20 font-medium text-[#F2F2F7]">{e.etapa}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={probabilidades[e.etapa]}
                  onChange={(ev) =>
                    setProbabilidades({
                      ...probabilidades,
                      [e.etapa]: Number(ev.target.value),
                    })
                  }
                  className="flex-1 accent-[#00C8FF]"
                />
                <span className="w-12 text-right font-mono font-bold text-[#00C8FF]">
                  {probabilidades[e.etapa]}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Objetivo de Ventas */}
        <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(0,200,255,0.2)] flex flex-col justify-between space-y-4">
          <div>
            <div className="pb-2 border-b border-[rgba(255,255,255,0.06)] mb-3">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#00C8FF]">
                Objetivo Global de Ventas
              </span>
            </div>
            <p className="text-xs text-[#B4B4C8] mb-3">
              Meta económica para el periodo comercial activo de Eonesia.
            </p>

            <label className="block text-xs font-medium text-[#B4B4C8] mb-1">
              Meta en euros (€)
            </label>
            <div className="relative">
              <input
                type="number"
                step={5000}
                value={objetivoVentas}
                onChange={(e) => setObjetivoVentas(Number(e.target.value))}
                className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-3 text-lg font-mono font-bold text-[#F2F2F7] pr-8"
              />
              <span className="absolute right-3 top-3 text-lg text-[#B4B4C8]">€</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#000000]/60 border border-[rgba(255,255,255,0.06)] text-xs text-[#B4B4C8]">
            Esta meta alimenta la barra tricolor del Panel (Ganado, Previsión Ponderada y Restante).
          </div>
        </div>
      </div>

      {/* 4. CAJA "RELLENAR EL ICP CON TU IA" */}
      <div className="p-5 rounded-xl bg-[#0D0D14] border border-[rgba(233,105,153,0.3)] shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 text-[#E96999]">
            <Bot size={18} />
            <h3 className="font-heading font-bold text-sm text-[#F2F2F7]">
              Rellenar el ICP con tu IA
            </h3>
          </div>
          <button
            onClick={handleCopiarPrompt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(233,105,153,0.15)] hover:bg-[rgba(233,105,153,0.25)] text-[#E96999] border border-[rgba(233,105,153,0.4)] text-xs font-bold transition-all"
          >
            <Copy size={13} />
            <span>{promptCopiado ? '¡Copiado!' : 'Copiar prompt'}</span>
          </button>
        </div>

        <p className="text-xs text-[#B4B4C8] leading-relaxed">
          Copia este prompt en ChatGPT, Gemini o Claude para afinar tu ICP. Luego pega abajo el JSON que te devuelva y pulsa en "Aplicar al ICP".
        </p>

        {/* Prompt en bloque visible */}
        <div className="p-3 rounded-lg bg-[#000000]/80 border border-[rgba(255,255,255,0.06)] font-mono text-[11px] text-[#B4B4C8] max-h-32 overflow-y-auto leading-relaxed">
          {promptParaIA}
        </div>

        {/* Área para pegar el JSON */}
        <div>
          <label className="block text-xs font-semibold text-[#F2F2F7] mb-1">
            Pega el JSON devuelto por la IA:
          </label>
          <textarea
            rows={4}
            value={jsonPegado}
            onChange={(e) => setJsonPegado(e.target.value)}
            placeholder='{"ficha": { "quien": "...", "problema": "..." }, "pesos": { "decisor": 5, ... }}'
            className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 font-mono text-xs text-[#F2F2F7]"
          />
        </div>

        {errorJson && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={15} />
            <span>{errorJson}</span>
          </div>
        )}

        {exitoJson && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 size={15} />
            <span>¡Ficha y pesos del ICP actualizados con éxito!</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAplicarJson}
            disabled={!jsonPegado.trim()}
            className="px-4 py-2 rounded-xl bg-[#E96999] hover:bg-[#ff85b3] disabled:opacity-40 disabled:cursor-not-allowed text-[#0D0D14] font-bold text-xs shadow-md transition-all active:scale-95"
          >
            Aplicar JSON al ICP
          </button>
        </div>
      </div>
    </div>
  );
};
