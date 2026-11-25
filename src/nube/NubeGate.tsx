import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, LogOut, ShieldCheck, Upload } from 'lucide-react';
import { crmRepo } from '../repo';
import { ModalImportarCopia } from '../components/ModalImportarCopia';
import {
  activarConEstado,
  cargarDeNube,
  entrar,
  EstadoSync,
  haySincronizacionPendiente,
  migrarANube,
  nubeConfigurada,
  obtenerSesion,
  onCambioSesion,
  onEstadoSync,
  programarSync,
  salir,
} from './sync';

type Fase = 'comprobando' | 'login' | 'cargando' | 'migrar' | 'listo' | 'error';

const caja = 'w-full max-w-md p-6 rounded-2xl bg-[#0D0D14] border border-[rgba(0,200,255,0.25)] space-y-4';
const boton =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50';

/**
 * Envuelve la app. Sin variables de Supabase no hace nada (modo local de siempre).
 * Con ellas: pide sesión, carga los datos de la nube o propone migrar los locales.
 */
export const NubeGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fase, setFase] = useState<Fase>(nubeConfigurada ? 'comprobando' : 'listo');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [resumenLocal, setResumenLocal] = useState(crmRepo.obtenerEstado());

  const conectar = async () => {
    setFase('cargando');
    setError('');
    try {
      const nube = await cargarDeNube();
      if (!nube) {
        setResumenLocal(crmRepo.obtenerEstado());
        setFase('migrar');
        return;
      }
      const estado = crmRepo.cargarEstadoNube(nube);
      activarConEstado(estado);
      crmRepo.conectarSincronizador(programarSync);
      setFase('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string })?.message || e));
      setFase('error');
    }
  };

  useEffect(() => {
    if (!nubeConfigurada) return;
    let vivo = true;
    obtenerSesion().then((s) => {
      if (!vivo) return;
      if (s) void conectar();
      else setFase('login');
    });
    const unsub = onCambioSesion((s) => {
      if (!s) {
        crmRepo.conectarSincronizador(null);
        setFase('login');
      }
    });
    const avisar = (e: BeforeUnloadEvent) => {
      if (haySincronizacionPendiente()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', avisar);
    return () => {
      vivo = false;
      unsub();
      window.removeEventListener('beforeunload', avisar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fase !== 'migrar') return;
    return crmRepo.suscribir((e) => setResumenLocal(e));
  }, [fase]);

  const hacerLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setError('');
    const err = await entrar(email.trim(), password);
    setOcupado(false);
    if (err) setError(err);
    else void conectar();
  };

  const migrar = async () => {
    setOcupado(true);
    setError('');
    try {
      const estado = crmRepo.obtenerEstado();
      await migrarANube(estado);
      crmRepo.conectarSincronizador(programarSync);
      setFase('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  if (fase === 'listo') {
    return (
      <>
        {children}
        {nubeConfigurada && <PildoraNube />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#F2F2F7] flex items-center justify-center p-4">
      {(fase === 'comprobando' || fase === 'cargando') && (
        <div className="flex items-center gap-2 text-sm text-[#B4B4C8]">
          <Loader2 className="animate-spin text-[#00C8FF]" size={18} />
          {fase === 'cargando' ? 'Cargando tus datos de la nube…' : 'Comprobando sesión…'}
        </div>
      )}

      {fase === 'login' && (
        <form onSubmit={hacerLogin} className={caja}>
          <div className="flex items-center gap-2">
            <Cloud className="text-[#00C8FF]" size={20} />
            <h1 className="font-heading font-bold text-lg">CRM Eonesia · Entrar</h1>
          </div>
          <p className="text-xs text-[#B4B4C8]">
            Tus datos se guardan en tu proyecto de Supabase. Solo tu usuario puede leerlos.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.1)] text-sm"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-3 py-2 rounded-lg bg-[#05050A] border border-[rgba(255,255,255,0.1)] text-sm"
          />
          {error && <p className="text-xs text-[#E96999]">{error}</p>}
          <button disabled={ocupado} className={`${boton} bg-[#00C8FF] text-[#0D0D14]`}>
            {ocupado ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Entrar
          </button>
        </form>
      )}

      {fase === 'migrar' && (
        <div className={caja}>
          <div className="flex items-center gap-2">
            <Upload className="text-[#00C8FF]" size={20} />
            <h1 className="font-heading font-bold text-lg">Tu nube está vacía</h1>
          </div>
          <p className="text-sm text-[#B4B4C8]">
            En este navegador hay <strong className="text-[#F2F2F7]">{resumenLocal.centros.length} centros</strong>,{' '}
            <strong className="text-[#F2F2F7]">{resumenLocal.contactos.length} contactos</strong> y{' '}
            <strong className="text-[#F2F2F7]">{resumenLocal.oportunidades.length} oportunidades</strong>. Al subirlos,
            la copia local se conserva.
          </p>
          {resumenLocal.esDatosEjemplo && (
            <p className="text-xs p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
              Son datos de ejemplo. Si tus datos reales están en otra dirección del CRM, expórtalos allí
              (Copia de seguridad → Exportar JSON) e impórtalos aquí antes de subir.
            </p>
          )}
          {error && <p className="text-xs text-[#E96999]">{error}</p>}
          <button onClick={() => setImportarAbierto(true)} className={`${boton} border border-[rgba(0,200,255,0.4)] text-[#00C8FF]`}>
            Importar una copia JSON primero
          </button>
          <button onClick={migrar} disabled={ocupado} className={`${boton} bg-[#00C8FF] text-[#0D0D14]`}>
            {ocupado ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Subir estos datos a la nube
          </button>
          <button onClick={() => void salir()} className="w-full text-xs text-[#B4B4C8] hover:text-[#F2F2F7]">
            Cerrar sesión
          </button>
          <ModalImportarCopia abierto={importarAbierto} onCerrar={() => setImportarAbierto(false)} />
        </div>
      )}

      {fase === 'error' && (
        <div className={caja}>
          <div className="flex items-center gap-2">
            <CloudOff className="text-[#E96999]" size={20} />
            <h1 className="font-heading font-bold text-lg">No se pudo conectar con la nube</h1>
          </div>
          <p className="text-xs text-[#B4B4C8] break-words">{error}</p>
          <p className="text-xs text-[#B4B4C8]">No se ha modificado nada. ¿Has aplicado la migración SQL en Supabase?</p>
          <button onClick={() => void conectar()} className={`${boton} bg-[#00C8FF] text-[#0D0D14]`}>
            Reintentar
          </button>
          <button onClick={() => void salir()} className="w-full text-xs text-[#B4B4C8] hover:text-[#F2F2F7]">
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};

const TEXTOS: Record<EstadoSync, string> = {
  local: 'Solo local',
  sin_sesion: 'Sin sesión',
  sincronizado: 'Guardado en la nube',
  guardando: 'Guardando…',
  pendiente: 'Cambios por guardar',
  error: 'Error al guardar',
};

const PildoraNube: React.FC = () => {
  const [estado, setEstado] = useState<EstadoSync>('local');
  const [error, setError] = useState('');
  useEffect(() => onEstadoSync((e, err) => {
    setEstado(e);
    setError(err);
  }), []);
  const color =
    estado === 'error' ? 'text-[#E96999] border-[#E96999]/40' : estado === 'sincronizado' ? 'text-[#00C8FF] border-[rgba(0,200,255,0.35)]' : 'text-[#B4B4C8] border-[rgba(255,255,255,0.15)]';
  return (
    <div
      className={`fixed top-2 right-2 md:top-auto md:bottom-4 md:left-3 md:right-auto z-40 flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0D0D14]/95 border text-[11px] ${color}`}
      title={error || TEXTOS[estado]}
    >
      {estado === 'guardando' ? <Loader2 size={12} className="animate-spin" /> : estado === 'error' ? <CloudOff size={12} /> : <Cloud size={12} />}
      <span>{TEXTOS[estado]}</span>
      <button onClick={() => void salir()} title="Cerrar sesión" className="hover:text-[#F2F2F7]">
        <LogOut size={12} />
      </button>
    </div>
  );
};
