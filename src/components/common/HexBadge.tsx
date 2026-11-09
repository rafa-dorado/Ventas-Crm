import React from 'react';
import { calcularDisenoInsignia } from '../../utils/badgeGenerator';

interface HexBadgeProps {
  nombre: string;
  size?: number;
  bloqueada?: boolean;
  progresoTexto?: string;
  className?: string;
}

export const HexBadge: React.FC<HexBadgeProps> = ({
  nombre,
  size = 64,
  bloqueada = false,
  progresoTexto,
  className = '',
}) => {
  const design = calcularDisenoInsignia(nombre);
  const color = bloqueada ? '#6B6B80' : design.color;
  const strokeColor = bloqueada ? 'rgba(107, 107, 128, 0.4)' : design.color;
  const fillColor = bloqueada ? '#121218' : '#0D0D14';

  const center = size / 2;
  const radius = size * 0.46;

  // Puntos del hexágono regular
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push(`${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`);
  }
  const pointsStr = points.join(' ');

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      title={nombre}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`glow-${nombre.replace(/\s+/g, '')}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={bloqueada ? '0.05' : '0.25'} />
            <stop offset="100%" stopColor="#4802B1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Resplandor de fondo */}
        <circle cx={center} cy={center} r={radius * 1.1} fill={`url(#glow-${nombre.replace(/\s+/g, '')})`} />

        {/* Hexágono base */}
        <polygon
          points={pointsStr}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={size > 60 ? '2' : '1.5'}
          strokeLinejoin="round"
        />

        {/* Anillos concéntricos girados */}
        {!bloqueada &&
          Array.from({ length: design.anillos }).map((_, idx) => {
            const r = radius * (0.8 - idx * 0.16);
            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={Math.max(4, r)}
                fill="none"
                stroke={color}
                strokeWidth="1"
                strokeDasharray={`${4 + idx * 2} ${3 + idx}`}
                transform={`rotate(${design.rotacion + idx * 45} ${center} ${center})`}
                opacity={0.45 - idx * 0.1}
              />
            );
          })}

        {/* Iniciales al centro en fuente Ubuntu */}
        <text
          x={center}
          y={center + (size > 50 ? 5 : 4)}
          textAnchor="middle"
          fill={bloqueada ? '#6B6B80' : '#F2F2F7'}
          fontSize={size * 0.28}
          fontWeight="700"
          fontFamily="Ubuntu, sans-serif"
          letterSpacing="0.05em"
        >
          {design.iniciales}
        </text>
      </svg>

      {/* Si está bloqueada y hay progreso textual ej '3/5' */}
      {bloqueada && progresoTexto && (
        <span className="absolute -bottom-1.5 px-1.5 py-0.5 text-[9px] font-semibold bg-[#161622] text-[#B4B4C8] border border-[rgba(255,255,255,0.1)] rounded-full shadow">
          {progresoTexto}
        </span>
      )}
    </div>
  );
};
