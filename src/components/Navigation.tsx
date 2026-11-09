import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Compass,
  FileSpreadsheet,
  Kanban,
  MoreHorizontal,
  Target,
  Trophy,
  X,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

export type TabActiva =
  | 'tablero'
  | 'panel'
  | 'prospectar'
  | 'cliente_ideal'
  | 'logros'
  | 'guia';

interface NavigationProps {
  tabActiva: TabActiva;
  onCambiarTab: (tab: TabActiva) => void;
  conteoAbiertas: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  tabActiva,
  onCambiarTab,
  conteoAbiertas,
}) => {
  const [menuMasAbierto, setMenuMasAbierto] = useState(false);

  const navItems: Array<{
    id: TabActiva;
    etiqueta: string;
    icono: React.ElementType;
    badge?: number | string;
  }> = [
    { id: 'tablero', etiqueta: 'Tablero', icono: Kanban, badge: conteoAbiertas },
    { id: 'panel', etiqueta: 'Panel', icono: BarChart3 },
    { id: 'prospectar', etiqueta: 'Prospectar', icono: Compass },
    { id: 'cliente_ideal', etiqueta: 'Cliente ideal', icono: Target },
    { id: 'logros', etiqueta: 'Logros', icono: Trophy },
    { id: 'guia', etiqueta: 'Guía', icono: BookOpen },
  ];

  const itemsMovilPrincipales = [
    { id: 'tablero' as TabActiva, etiqueta: 'Tablero', icono: Kanban, badge: conteoAbiertas },
    { id: 'panel' as TabActiva, etiqueta: 'Panel', icono: BarChart3 },
    { id: 'prospectar' as TabActiva, etiqueta: 'Prospectar', icono: Compass },
    { id: 'logros' as TabActiva, etiqueta: 'Logros', icono: Trophy },
  ];

  return (
    <>
      {/* =========================================================================
          ESCRITORIO: BARRA LATERAL (Desktop Sidebar - Pantallas >= 768px)
         ========================================================================= */}
      <aside className="hidden md:flex flex-col w-48 lg:w-52 bg-[#0D0D14] border-r border-[rgba(0,200,255,0.18)] min-h-screen p-3 flex-shrink-0 select-none">
        {/* Logo de Eonesia */}
        <div className="flex items-center gap-2.5 px-1 py-2 mb-4">
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center p-0.5 overflow-hidden shrink-0">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, #00C8FF 0%, #E96999 52%, #4802B1 100%)',
              }}
            />
            <div className="relative w-full h-full bg-[#0D0D14] rounded-[6px] flex items-center justify-center">
              <Layers size={16} className="text-[#00C8FF]" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-base tracking-wider text-[#F2F2F7] leading-none truncate">
              Eonesia
            </h1>
            <p className="text-[10px] text-[#00C8FF] font-mono tracking-tight mt-0.5 truncate">
              Ventas EdTech
            </p>
          </div>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icono = item.icono;
            const esActivo = tabActiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onCambiarTab(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  esActivo
                    ? 'bg-[rgba(0,200,255,0.12)] text-[#00C8FF] border border-[rgba(0,200,255,0.45)] shadow-[0_0_12px_-3px_rgba(0,200,255,0.25)]'
                    : 'text-[#B4B4C8] hover:text-[#F2F2F7] hover:bg-[#161622] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icono
                    size={16}
                    className={`shrink-0 ${esActivo ? 'text-[#00C8FF]' : 'text-[#B4B4C8]'}`}
                  />
                  <span className="truncate">{item.etiqueta}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${
                      esActivo
                        ? 'bg-[#00C8FF] text-[#0D0D14]'
                        : 'bg-[#1b1b22] text-[#B4B4C8]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer de la Barra Lateral */}
        <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] px-0.5">
          <div className="p-2.5 rounded-lg bg-[#000000]/60 border border-[rgba(0,200,255,0.15)] text-[10px]">
            <div className="flex items-center gap-1.5 text-[#00C8FF] font-semibold text-[10px] mb-0.5">
              <Shield size={12} className="shrink-0" />
              <span className="truncate">WebXR sin cascos</span>
            </div>
            <p className="text-[10px] text-[#B4B4C8] leading-tight">
              Espacios 100% en navegador para centros.
            </p>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          MÓVIL: BARRA INFERIOR (Mobile Bottom Bar - Pantallas < 768px)
         ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0D14]/95 backdrop-blur-md border-t border-[rgba(0,200,255,0.2)] px-2 py-1.5 flex items-center justify-around select-none">
        {itemsMovilPrincipales.map((item) => {
          const Icono = item.icono;
          const esActivo = tabActiva === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onCambiarTab(item.id);
                setMenuMasAbierto(false);
              }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg relative transition-colors ${
                esActivo ? 'text-[#00C8FF]' : 'text-[#B4B4C8] hover:text-[#F2F2F7]'
              }`}
            >
              <div className="relative">
                <Icono size={20} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-[#E96999] text-[#0D0D14] text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-1">{item.etiqueta}</span>
              {esActivo && (
                <div className="w-1 h-1 rounded-full bg-[#00C8FF] mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Botón "Más" en móvil */}
        <button
          onClick={() => setMenuMasAbierto(!menuMasAbierto)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors ${
            menuMasAbierto || tabActiva === 'cliente_ideal' || tabActiva === 'guia'
              ? 'text-[#00C8FF]'
              : 'text-[#B4B4C8]'
          }`}
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium mt-1">Más</span>
        </button>
      </nav>

      {/* Menú desplegable para "Más" en móvil */}
      {menuMasAbierto && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setMenuMasAbierto(false)}
        >
          <div
            className="bg-[#0D0D14] border-t border-[rgba(0,200,255,0.3)] rounded-t-2xl p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
              <span className="font-heading font-bold text-sm text-[#F2F2F7]">
                Más opciones
              </span>
              <button
                onClick={() => setMenuMasAbierto(false)}
                className="p-1 text-[#B4B4C8] hover:text-[#F2F2F7]"
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => {
                onCambiarTab('cliente_ideal');
                setMenuMasAbierto(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${
                tabActiva === 'cliente_ideal'
                  ? 'bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]'
                  : 'text-[#F2F2F7] hover:bg-[#161622]'
              }`}
            >
              <Target size={18} className="text-[#00C8FF]" />
              <span>Cliente ideal (ICP)</span>
            </button>

            <button
              onClick={() => {
                onCambiarTab('guia');
                setMenuMasAbierto(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${
                tabActiva === 'guia'
                  ? 'bg-[rgba(0,200,255,0.15)] text-[#00C8FF] border border-[rgba(0,200,255,0.3)]'
                  : 'text-[#F2F2F7] hover:bg-[#161622]'
              }`}
            >
              <BookOpen size={18} className="text-[#00C8FF]" />
              <span>Guía y Metodología</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
