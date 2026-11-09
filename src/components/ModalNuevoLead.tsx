import React, { useState } from 'react';
import {
  DolorPrincipal,
  EstadoCRM,
  RolContacto,
  TipoCentro,
} from '../types';
import { crmRepo } from '../repo';
import { normalizarNombreCentro } from '../utils/crmHelpers';
import { AlertCircle, Plus, Sparkles, X } from 'lucide-react';

interface ModalNuevoLeadProps {
  abierto: boolean;
  estado: EstadoCRM;
  onCerrar: () => void;
  onLeadCreado: (opId: string) => void;
}

export const ModalNuevoLead: React.FC<ModalNuevoLeadProps> = ({
  abierto,
  estado,
  onCerrar,
  onLeadCreado,
}) => {
  const [nombreCentro, setNombreCentro] = useState('');
  const [tipoCentro, setTipoCentro] = useState<TipoCentro>('FP');
  const [provincia, setProvincia] = useState('Sevilla');
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoCargo, setContactoCargo] = useState('Director/a Pedagógico');
  const [contactoEmail, setContactoEmail] = useState('');
  const [contactoRol, setContactoRol] = useState<RolContacto>('Decisor');
  const [valor, setValor] = useState<number>(4500);
  const [dolor, setDolor] = useState<DolorPrincipal>('Alumnos sin preparar para prácticas');
  const [notas, setNotas] = useState('');

  // Centro duplicado detectado
  const [centroExistenteId, setCentroExistenteId] = useState<string | null>(null);
  const [mensajeDuplicado, setMensajeDuplicado] = useState<string | null>(null);

  if (!abierto) return null;

  // Comprobar coincidencia mientras se escribe el nombre del centro
  const handleNombreChange = (val: string) => {
    setNombreCentro(val);
    if (val.trim().length >= 3) {
      const normInput = normalizarNombreCentro(val);
      const provNorm = normalizarNombreCentro(provincia);
      const encontrado = estado.centros.find((c) => {
        const nom = normalizarNombreCentro(c.nombre);
        const prov = normalizarNombreCentro(c.provincia);
        return (nom === normInput || nom.includes(normInput) || normInput.includes(nom)) && (!provNorm || !prov || prov === provNorm);
      });
      if (encontrado) {
        setMensajeDuplicado(`El centro "${encontrado.nombre}" ya existe en tu CRM.`);
        setCentroExistenteId(encontrado.id);
      } else {
        setMensajeDuplicado(null);
        setCentroExistenteId(null);
      }
    } else {
      setMensajeDuplicado(null);
      setCentroExistenteId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCentro.trim()) return;

    try {
      const res = crmRepo.crearLead({
        nombreCentro: nombreCentro.trim(),
        tipo: tipoCentro,
        provincia: provincia.trim() || 'No especificada',
        contacto: {
          nombre: contactoNombre.trim() || 'Contacto Principal',
          cargo: contactoCargo.trim() || 'Innovación',
          email: contactoEmail.trim(),
          rol: contactoRol,
        },
        valor: Number(valor) || 0,
        dolor,
        notas: notas.trim(),
        centroIdExistente: centroExistenteId || undefined,
      });

      onLeadCreado(res.oportunidad.id);
      onCerrar();
    } catch (err: any) {
      alert(`Error al crear el lead: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0D0D14] border border-[rgba(0,200,255,0.35)] rounded-2xl p-5 md:p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[rgba(233,105,153,0.15)] border border-[rgba(233,105,153,0.4)] flex items-center justify-center text-[#E96999]">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-[#F2F2F7]">
                Nuevo Lead Eonesia
              </h3>
              <p className="text-xs text-[#00C8FF]">+5 XP al registrar</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1 rounded text-[#B4B4C8] hover:text-[#F2F2F7]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Mensaje de centro duplicado */}
          {mensajeDuplicado && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
                <span>{mensajeDuplicado}</span>
              </div>
              <button
                type="button"
                onClick={() => setCentroExistenteId(null)}
                className="text-[11px] underline hover:text-white"
              >
                Crear centro nuevo igualmente
              </button>
            </div>
          )}

          {/* Datos del Centro */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold uppercase tracking-wider text-[#00C8FF] text-[11px]">
              1. Datos de la Organización
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[#B4B4C8] mb-1 font-medium">Nombre del centro *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. CIFP Tecnológico de Triana"
                  value={nombreCentro}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Tipo *</label>
                <select
                  value={tipoCentro}
                  onChange={(e) => setTipoCentro(e.target.value as TipoCentro)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                >
                  <option value="FP">FP</option>
                  <option value="Privado">Privado</option>
                  <option value="Concertado">Concertado</option>
                  <option value="Publico">Público</option>
                  <option value="Universidad">Universidad</option>
                  <option value="Editorial">Editorial</option>
                  <option value="Institucional">Institucional</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#B4B4C8] mb-1 font-medium">Provincia / Ciudad *</label>
              <input
                type="text"
                required
                placeholder="Ej. Sevilla, Córdoba, Madrid, etc."
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
              />
            </div>
          </div>

          {/* Datos del Contacto */}
          <div className="space-y-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <h4 className="font-heading font-bold uppercase tracking-wider text-[#00C8FF] text-[11px]">
              2. Contacto Principal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Nombre completo</label>
                <input
                  type="text"
                  placeholder="Ej. Carmen Navarro"
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Cargo</label>
                <input
                  type="text"
                  placeholder="Ej. Jefa de Estudios / Coord. TIC"
                  value={contactoCargo}
                  onChange={(e) => setContactoCargo(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Email</label>
                <input
                  type="email"
                  placeholder="carmen@centro.es"
                  value={contactoEmail}
                  onChange={(e) => setContactoEmail(e.target.value)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Rol en la decisión</label>
                <select
                  value={contactoRol}
                  onChange={(e) => setContactoRol(e.target.value as RolContacto)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                >
                  <option value="Decisor">Decisor (Firma)</option>
                  <option value="Influyente">Influyente (TIC / Docente)</option>
                  <option value="Usuario">Usuario</option>
                </select>
              </div>
            </div>
          </div>

          {/* Oportunidad Comercial */}
          <div className="space-y-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <h4 className="font-heading font-bold uppercase tracking-wider text-[#00C8FF] text-[11px]">
              3. Oportunidad en Detectado
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Valor estimado (€)</label>
                <input
                  type="number"
                  value={valor}
                  onChange={(e) => setValor(Number(e.target.value))}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-sm font-mono font-bold text-[#F2F2F7]"
                />
              </div>

              <div>
                <label className="block text-[#B4B4C8] mb-1 font-medium">Dolor principal</label>
                <select
                  value={dolor}
                  onChange={(e) => setDolor(e.target.value as DolorPrincipal)}
                  className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
                >
                  <option value="Abandono del alumnado">Abandono del alumnado</option>
                  <option value="Alumnos sin preparar para prácticas">
                    Alumnos sin preparar para prácticas
                  </option>
                  <option value="Captar familias">Captar familias</option>
                  <option value="Fondos por ejecutar">Fondos por ejecutar</option>
                  <option value="Diferenciarse en licitaciones">Diferenciarse en licitaciones</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#B4B4C8] mb-1 font-medium">
                Notas iniciales / Primer contacto
              </label>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Origen del contacto, impresiones iniciales..."
                className="w-full bg-[#05050A] border border-[rgba(154,154,176,0.3)] rounded-lg p-2.5 text-[#F2F2F7]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(255,255,255,0.08)]">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-xs font-semibold text-[#B4B4C8] hover:text-[#F2F2F7]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#E96999] hover:bg-[#ff85b3] text-[#0D0D14] font-bold text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Crear lead (+5 XP)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
