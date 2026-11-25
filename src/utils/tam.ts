import { Centro, TipoCentro } from '../types';

const TIPOS: Record<string, TipoCentro> = {
  publico: 'Publico',
  'público': 'Publico',
  concertado: 'Concertado',
  privado: 'Privado',
  'privado no concertado': 'Privado',
  fp: 'FP',
  universidad: 'Universidad',
  editorial: 'Editorial',
  institucional: 'Institucional',
};

const num = (v?: string) => {
  if (!v) return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Convierte una fila del CSV del TAM (crm_cuentas_colegios.csv) en un centro parcial. */
export function filaTAMaCentro(f: Record<string, string>): Partial<Centro> {
  const tier = num(f.tier);
  return {
    externalId: f.codigo_centro || f.externalid || f.codigo || '',
    nombre: f.nombre || (f.denominacion ? `${f.denominacion} (${f.municipio || f.provincia || ''})` : ''),
    tipo: TIPOS[(f.tipo || '').toLowerCase()] || undefined,
    provincia: f.provincia || undefined,
    municipio: f.municipio || undefined,
    alumnos: Math.round(num(f.alumnos_prim_eso || f.alumnos) || 0),
    telefono: f.telefono || undefined,
    emailGeneral: f.email_centro || f.email || undefined,
    web: f.web || undefined,
    redPadre: f.cuenta_padre || f.red || undefined,
    segmento: f.segmento || undefined,
    tier: tier === 1 || tier === 2 || tier === 3 ? tier : undefined,
    fitScore: num(f.fit_score),
    fuente: f.fuente || undefined,
  };
}
