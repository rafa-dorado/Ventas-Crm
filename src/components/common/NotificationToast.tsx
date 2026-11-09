import React, { useEffect, useState } from 'react';
import { crmRepo, NotificacionCRM } from '../../repo';
import { Award, CheckCircle2, Gift, Hexagon, Info, Sparkles, Trophy, X, XCircle } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const [toasts, setToasts] = useState<NotificacionCRM[]>([]);

  useEffect(() => {
    const unsub = crmRepo.onNotificacion((notif) => {
      setToasts((prev) => [...prev, notif]);
      // Auto ocultar a los 4.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notif.id));
      }, 4500);
    });
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderColor = 'rgba(0, 200, 255, 0.4)';
        let glowStyle = '0 0 16px -2px rgba(0, 200, 255, 0.3)';
        let IconComp = Sparkles;
        let iconColor = '#00C8FF';

        if (toast.tipo === 'xp') {
          borderColor = 'rgba(233, 105, 153, 0.5)';
          glowStyle = '0 0 20px -2px rgba(233, 105, 153, 0.4)';
          IconComp = Sparkles;
          iconColor = '#E96999';
        } else if (toast.tipo === 'nivel') {
          borderColor = 'rgba(195, 173, 255, 0.6)';
          glowStyle = '0 8px 30px -4px rgba(72, 2, 177, 0.6), 0 0 16px rgba(233, 105, 153, 0.3)';
          IconComp = Hexagon;
          iconColor = '#C3ADFF';
        } else if (toast.tipo === 'insignia') {
          borderColor = 'rgba(233, 105, 153, 0.6)';
          glowStyle = '0 0 20px -2px rgba(233, 105, 153, 0.4)';
          IconComp = Award;
          iconColor = '#E96999';
        } else if (toast.tipo === 'error') {
          borderColor = 'rgba(255, 180, 171, 0.5)';
          glowStyle = '0 0 16px rgba(147, 0, 10, 0.3)';
          IconComp = XCircle;
          iconColor = '#ffb4ab';
        } else if (toast.tipo === 'exito') {
          borderColor = 'rgba(0, 200, 255, 0.5)';
          IconComp = CheckCircle2;
          iconColor = '#00C8FF';
        }

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#0D0D14] text-[#F2F2F7] rounded-lg p-3.5 border transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3 shadow-2xl"
            style={{ borderColor, boxShadow: glowStyle }}
          >
            <div
              className="p-2 rounded-md flex-shrink-0"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <IconComp size={18} style={{ color: iconColor }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-sm leading-tight text-[#F2F2F7]">
                  {toast.titulo}
                </span>
                {toast.puntosXP && (
                  <span className="px-1.5 py-0.5 text-[11px] font-extrabold text-[#0D0D14] bg-[#E96999] rounded font-mono">
                    +{toast.puntosXP} XP
                  </span>
                )}
              </div>
              {toast.descripcion && (
                <p className="text-xs text-[#B4B4C8] mt-1 line-clamp-2 leading-relaxed">
                  {toast.descripcion}
                </p>
              )}
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[#B4B4C8] hover:text-[#F2F2F7] p-1 -mr-1 -mt-1 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
