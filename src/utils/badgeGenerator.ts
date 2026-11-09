export interface BadgeDesign {
  color: string;
  anillos: number;
  rotacion: number;
  iniciales: string;
}

const PALETA_COLORES = [
  '#00C8FF', // Cian principal
  '#E96999', // Rosa acento
  '#68D3FF', // Cian claro
  '#FFB0C8', // Rosa claro
  '#C3ADFF', // Lavanda brillante
  '#99DEFF', // Azul cielo
  '#FF95B9', // Fucsia sutil
];

// Hash determinista del nombre de la insignia
export function calcularDisenoInsignia(nombre: string): BadgeDesign {
  const limpio = (nombre || 'Insignia').trim();
  let hash = 0;
  for (let i = 0; i < limpio.length; i++) {
    hash = (hash << 5) - hash + limpio.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  const color = PALETA_COLORES[posHash % PALETA_COLORES.length];
  const anillos = 2 + (posHash % 3); // 2, 3 o 4 anillos
  const rotacion = (posHash * 37) % 360;

  // Obtener hasta 2 iniciales
  const palabras = limpio.split(/\s+/).filter(Boolean);
  let iniciales = '';
  if (palabras.length >= 2) {
    iniciales = (palabras[0][0] + palabras[1][0]).toUpperCase();
  } else if (palabras.length === 1 && palabras[0].length >= 2) {
    iniciales = palabras[0].substring(0, 2).toUpperCase();
  } else if (palabras.length === 1) {
    iniciales = palabras[0][0].toUpperCase();
  } else {
    iniciales = 'EO';
  }

  return { color, anillos, rotacion, iniciales };
}
