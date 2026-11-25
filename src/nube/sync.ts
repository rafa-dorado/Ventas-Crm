/**
 * Persistencia opcional en Supabase.
 *
 * - Si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están definidas, el CRM
 *   funciona exactamente igual que antes (solo localStorage).
 * - Con nube activa, localStorage sigue siendo la caché local y la nube es la
 *   fuente de verdad. Solo se envían a la nube las filas que han cambiado.
 * - Nunca se borra nada en la nube que no existiera en la última sincronización.
 */
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { Centro, Contacto, EstadoCRM, Oportunidad, Senal } from '../types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const nubeConfigurada = Boolean(URL && CLAVE);
export const supabase: SupabaseClient | null = nubeConfigurada ? createClient(URL!, CLAVE!) : null;

type TipoItem = 'centro' | 'contacto' | 'oportunidad';
export type EstadoSync = 'local' | 'sin_sesion' | 'sincronizado' | 'guardando' | 'pendiente' | 'error';

/** JSON con claves ordenadas: jsonb de Postgres no conserva el orden, así se comparan bien. */
export function jsonEstable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(jsonEstable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v as Record<string, unknown>).sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + jsonEstable((v as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}

const TAM_LOTE = 500;
const TAM_PAGINA = 1000;
const ESPERA_MS = 1500;

let sesion: Session | null = null;
let ultimo = new Map<string, string>(); // `${tipo}:${id}` -> JSON de la última versión enviada
let ultimoMeta = '';
let activo = false; // solo sincroniza tras cargar o migrar
let temporizador: ReturnType<typeof setTimeout> | null = null;
let pendiente: EstadoCRM | null = null;
let enCurso = false;
let estadoSync: EstadoSync = nubeConfigurada ? 'sin_sesion' : 'local';
let ultimoError = '';
const oyentes = new Set<(e: EstadoSync, error: string) => void>();

function fijarEstado(e: EstadoSync, error = '') {
  estadoSync = e;
  ultimoError = error;
  oyentes.forEach((fn) => fn(e, error));
}

export function onEstadoSync(fn: (e: EstadoSync, error: string) => void): () => void {
  oyentes.add(fn);
  fn(estadoSync, ultimoError);
  return () => oyentes.delete(fn);
}

export function haySincronizacionPendiente(): boolean {
  return pendiente !== null || enCurso;
}

function mapaDeEstado(estado: EstadoCRM): Map<string, { tipo: TipoItem; id: string; json: string; data: unknown }> {
  const m = new Map<string, { tipo: TipoItem; id: string; json: string; data: unknown }>();
  const add = (tipo: TipoItem, lista: Array<{ id: string }>) => {
    for (const item of lista) {
      const json = jsonEstable(item);
      m.set(`${tipo}:${item.id}`, { tipo, id: item.id, json, data: item });
    }
  };
  add('centro', estado.centros);
  add('contacto', estado.contactos);
  add('oportunidad', estado.oportunidades);
  return m;
}

function metaDeEstado(estado: EstadoCRM): string {
  return JSON.stringify({ juego: estado.juego, config: estado.config, es: estado.esDatosEjemplo });
}

// --- Sesión ---
export async function obtenerSesion(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  sesion = data.session;
  return sesion;
}

export function onCambioSesion(fn: (s: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
    sesion = s;
    if (!s) {
      activo = false;
      fijarEstado('sin_sesion');
    }
    fn(s);
  });
  return () => data.subscription.unsubscribe();
}

export async function entrar(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Nube no configurada';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  sesion = data.session;
  return null;
}

export async function salir(): Promise<void> {
  if (!supabase) return;
  if (pendiente) await enviar();
  await supabase.auth.signOut();
}

// --- Carga ---
async function leerTabla(tipo: TipoItem): Promise<unknown[]> {
  const filas: unknown[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await supabase!
      .from('crm_items')
      .select('data')
      .eq('tipo', tipo)
      .order('id')
      .range(desde, desde + TAM_PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []).map((f: { data: unknown }) => f.data));
    if (!data || data.length < TAM_PAGINA) break;
  }
  return filas;
}

/** Devuelve el estado guardado en la nube, o null si la nube está vacía (hay que migrar). */
export async function cargarDeNube(): Promise<Partial<EstadoCRM> | null> {
  if (!supabase || !sesion) throw new Error('Sin sesión');
  const [centros, contactos, oportunidades] = await Promise.all([
    leerTabla('centro'),
    leerTabla('contacto'),
    leerTabla('oportunidad'),
  ]);
  const { data: meta, error } = await supabase.from('crm_meta').select('*').maybeSingle();
  if (error) throw error;
  if (!meta && centros.length === 0 && oportunidades.length === 0) return null;
  return {
    centros: centros as Centro[],
    contactos: contactos as Contacto[],
    oportunidades: oportunidades as Oportunidad[],
    juego: meta?.juego,
    config: meta?.config,
    esDatosEjemplo: meta?.es_datos_ejemplo ?? false,
  };
}

/** Marca un estado como «ya sincronizado» (tras cargarlo de la nube) y activa la sincronización. */
export function activarConEstado(estado: EstadoCRM): void {
  ultimo = new Map([...mapaDeEstado(estado)].map(([k, v]) => [k, v.json]));
  ultimoMeta = metaDeEstado(estado);
  activo = true;
  fijarEstado('sincronizado');
}

/** Primera subida: envía todo el estado local a una nube vacía. */
export async function migrarANube(estado: EstadoCRM): Promise<void> {
  ultimo = new Map();
  ultimoMeta = '';
  activo = true;
  pendiente = estado;
  await enviar();
  if (estadoSync === 'error') {
    activo = false;
    throw new Error(ultimoError || 'No se pudo subir a la nube');
  }
}

// --- Envío incremental ---
export function programarSync(estado: EstadoCRM): void {
  if (!activo || !sesion) return;
  pendiente = estado;
  fijarEstado('pendiente');
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void enviar(), ESPERA_MS);
}

async function enviar(): Promise<void> {
  if (!supabase || !sesion || !pendiente) return;
  if (enCurso) return; // al terminar el envío en curso se reintenta
  enCurso = true;
  const estado = pendiente;
  pendiente = null;
  fijarEstado('guardando');
  const owner = sesion.user.id;
  try {
    const actual = mapaDeEstado(estado);
    const cambios = [...actual.values()].filter((v) => ultimo.get(`${v.tipo}:${v.id}`) !== v.json);
    const borrados = [...ultimo.keys()].filter((k) => !actual.has(k));

    for (let i = 0; i < cambios.length; i += TAM_LOTE) {
      const lote = cambios.slice(i, i + TAM_LOTE).map((v) => ({
        owner,
        tipo: v.tipo,
        id: v.id,
        data: v.data,
        actualizado: new Date().toISOString(),
      }));
      const { error } = await supabase.from('crm_items').upsert(lote, { onConflict: 'owner,tipo,id' });
      if (error) throw error;
      lote.forEach((f, j) => ultimo.set(`${f.tipo}:${f.id}`, cambios[i + j].json));
    }

    const porTipo = new Map<string, string[]>();
    for (const k of borrados) {
      const [tipo, ...resto] = k.split(':');
      porTipo.set(tipo, [...(porTipo.get(tipo) || []), resto.join(':')]);
    }
    for (const [tipo, ids] of porTipo) {
      for (let i = 0; i < ids.length; i += 200) {
        const trozo = ids.slice(i, i + 200);
        const { error } = await supabase.from('crm_items').delete().eq('tipo', tipo).in('id', trozo);
        if (error) throw error;
        trozo.forEach((id) => ultimo.delete(`${tipo}:${id}`));
      }
    }

    const meta = metaDeEstado(estado);
    if (meta !== ultimoMeta) {
      const { error } = await supabase.from('crm_meta').upsert({
        owner,
        juego: estado.juego,
        config: estado.config,
        es_datos_ejemplo: estado.esDatosEjemplo,
        actualizado: new Date().toISOString(),
      });
      if (error) throw error;
      ultimoMeta = meta;
    }
    fijarEstado(pendiente ? 'pendiente' : 'sincronizado');
  } catch (err) {
    // Se conserva lo no enviado para el siguiente intento; los datos siguen en memoria y en localStorage.
    if (!pendiente) pendiente = estado;
    const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message || err);
    fijarEstado('error', msg);
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => void enviar(), 15000);
  } finally {
    enCurso = false;
    if (pendiente && estadoSync !== 'error') {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => void enviar(), 300);
    }
  }
}

export async function forzarSync(): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  await enviar();
}

// --- Cambios hechos en la nube por otros (formulario web, otro dispositivo) ---
export interface CambioRemoto { tipo: TipoItem; id: string; data: Record<string, unknown>; anterior?: string }
let desdeRemoto = new Date(Date.now() - 5 * 60 * 1000).toISOString();

/**
 * Devuelve las filas de la nube que han cambiado desde la última comprobación y que no
 * son ya nuestra última versión enviada. `anterior` es la versión que conocíamos (si había).
 */
export async function traerCambiosRemotos(): Promise<CambioRemoto[]> {
  if (!supabase || !sesion || !activo || enCurso) return [];
  const { data, error } = await supabase
    .from('crm_items')
    .select('tipo,id,data,actualizado')
    .gt('actualizado', desdeRemoto)
    .order('actualizado')
    .limit(1000);
  if (error || !data) return [];
  const cambios: CambioRemoto[] = [];
  for (const f of data as Array<{ tipo: TipoItem; id: string; data: Record<string, unknown>; actualizado: string }>) {
    const k = `${f.tipo}:${f.id}`;
    const remoto = jsonEstable(f.data);
    if (ultimo.get(k) === remoto) continue;
    cambios.push({ tipo: f.tipo, id: f.id, data: f.data, anterior: ultimo.get(k) });
    ultimo.set(k, remoto);
  }
  if (data.length) {
    // margen de 2 min por si los relojes no coinciden; lo ya visto se descarta por contenido
    const ult = (data[data.length - 1] as { actualizado: string }).actualizado;
    desdeRemoto = new Date(new Date(ult).getTime() - 2 * 60 * 1000).toISOString();
  }
  return cambios;
}

// --- Señales del radar ---
export async function listarSenales(estado: Senal['estado'] = 'nueva'): Promise<Senal[]> {
  if (!supabase || !sesion) return [];
  const { data, error } = await supabase
    .from('senales')
    .select('*')
    .eq('estado', estado)
    .order('fecha_senal', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []) as Senal[];
}

export async function marcarSenal(id: number, estado: Senal['estado']): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('senales').update({ estado }).eq('id', id);
  if (error) throw error;
}

export function idUsuario(): string | null {
  return sesion?.user.id ?? null;
}
