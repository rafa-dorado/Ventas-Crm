import React from 'react';

interface AnilloEncajeProps {
  porcentaje: number | null;
  size?: number;
  strokeWidth?: number;
  mostrarEtiqueta?: boolean;
  className?: string;
}

export const AnilloEncaje: React.FC<AnilloEncajeProps> = ({
  porcentaje,
  size = 40,
  strokeWidth = 3.5,
  mostrarEtiqueta = false,
  className = '',
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPorcentaje = porcentaje !== null ? Math.min(Math.max(porcentaje, 0), 100) : 0;
  const strokeDashoffset = circumference - (validPorcentaje / 100) * circumference;

  // Color dinámico según encaje
  let ringColor = 'var(--color-cian)';
  if (porcentaje !== null) {
    if (porcentaje >= 80) ringColor = '#00C8FF';
    else if (porcentaje >= 50) ringColor = '#68D3FF';
    else ringColor = '#B4B4C8';
  } else {
    ringColor = 'rgba(180, 180, 200, 0.3)';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 group relative select-none ${className}`}
      title={
        porcentaje !== null
          ? `${porcentaje}% de parecido con tu cliente ideal (ICP)`
          : 'Sin criterios ICP evaluados'
      }
    >
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Fondo del anillo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />
          {/* Anillo de progreso */}
          {porcentaje !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
            />
          )}
        </svg>

        {/* Texto al centro */}
        <span
          className="absolute font-bold text-center leading-none text-[#F2F2F7]"
          style={{ fontSize: size * 0.28 }}
        >
          {porcentaje !== null ? `${porcentaje}%` : '—'}
        </span>
      </div>

      {mostrarEtiqueta && (
        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#B4B4C8]">
            Parecido con tu ICP
          </span>
          <span className="text-xs text-[#F2F2F7] font-medium">
            {porcentaje !== null ? `${porcentaje}% parecido` : 'Criterios pendientes'}
          </span>
        </div>
      )}
    </div>
  );
};
