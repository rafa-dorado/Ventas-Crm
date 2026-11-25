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
      const json = JSON.stringify(item);
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

// --- Interesados del formulario web (los crea la función crear_lead_formulario) ---
export async function traerNuevosDelFormulario(idsLocales: Set<string>): Promise<Partial<EstadoCRM> | null> {
  if (!supabase || !sesion || !activo) return null;
  const { data, error } = await supabase
    .from('crm_items')
    .select('tipo,id,data')
    .like('id', '%-form-%')
    .order('id');
  if (error || !data) return null;
  const nuevos = data.filter((f: { tipo: TipoItem; id: string }) => !idsLocales.has(`${f.tipo}:${f.id}`));
  if (!nuevos.length) return null;
  const de = (t: TipoItem) => nuevos.filter((f: { tipo: TipoItem }) => f.tipo === t).map((f: { data: unknown }) => f.data);
  // Ya están en la nube: se marcan como sincronizados para no reenviarlos
  nuevos.forEach((f: { tipo: TipoItem; id: string; data: unknown }) => ultimo.set(`${f.tipo}:${f.id}`, JSON.stringify(f.data)));
  return { centros: de('centro') as Centro[], contactos: de('contacto') as Contacto[], oportunidades: de('oportunidad') as Oportunidad[] };
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
