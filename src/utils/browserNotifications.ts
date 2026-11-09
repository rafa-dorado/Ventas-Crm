import { Centro, EstadoCRM, Oportunidad } from '../types';
import { formatearEuros, formatearFecha } from './crmHelpers';

const STORAGE_NOTIFICADOS = 'eonesia_notificados_hoy';

/**
 * Comprueba si la API de notificaciones está soportada en el navegador actual
 */
export function soportaNotificaciones(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Obtiene el estado actual del permiso en el navegador
 */
export function obtenerEstadoPermiso(): NotificationPermission | 'unsupported' {
  if (!soportaNotificaciones()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * Solicita permisos de notificación al usuario
 */
export async function solicitarPermisoNotificaciones(): Promise<NotificationPermission | 'unsupported'> {
  if (!soportaNotificaciones()) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch (error) {
    console.warn('Error al solicitar permiso de notificaciones:', error);
    return 'denied';
  }
}

/**
 * Obtiene el mapa de oportunidades ya notificadas en la sesión actual
 */
function obtenerNotificados(): Record<string, string> {
  try {
    const data = sessionStorage.getItem(STORAGE_NOTIFICADOS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Marca una oportunidad como notificada para una fecha específica
 */
function guardarNotificado(opId: string, fecha: string): void {
  try {
    const map = obtenerNotificados();
    map[opId] = fecha;
    sessionStorage.setItem(STORAGE_NOTIFICADOS, JSON.stringify(map));
  } catch {
    // Ignorar fallo de almacenamiento
  }
}

/**
 * Emite una notificación del navegador para una oportunidad con próximo paso
 */
export function emitirNotificacionProximoPaso(
  op: Oportunidad,
  centro?: Centro,
  esPrueba: boolean = false
): boolean {
  if (!soportaNotificaciones() || Notification.permission !== 'granted') {
    return false;
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  const esVencido = (op.proximoPaso?.fecha || hoyStr) < hoyStr;
  const esHoy = (op.proximoPaso?.fecha || hoyStr) === hoyStr;

  const subtitulo = esPrueba
    ? 'Demostración de aviso activo'
    : esVencido
    ? '⚠️ Próximo paso vencido'
    : '🔔 Próximo paso para hoy';

  const titulo = `Eonesia CRM · ${centro?.nombre || 'Centro educativo'}`;
  const cuerpo = `${subtitulo}\nAcción: ${op.proximoPaso?.accion || 'Seguimiento pendiente'}\nFecha: ${formatearFecha(op.proximoPaso?.fecha || hoyStr)} · ${formatearEuros(op.valor)}`;

  try {
    const notif = new Notification(titulo, {
      body: cuerpo,
      tag: `eonesia-paso-${op.id}`,
      requireInteraction: false,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      window.dispatchEvent(
        new CustomEvent('eonesia:abrir-oportunidad', { detail: { opId: op.id } })
      );
    };

    if (!esPrueba && op.proximoPaso?.fecha) {
      guardarNotificado(op.id, op.proximoPaso.fecha);
    }

    return true;
  } catch (err) {
    console.warn('No se pudo instanciar Notification:', err);
    return false;
  }
}

/**
 * Envía una notificación de prueba para que el comercial compruebe que su sistema operativo
 * y navegador permiten avisos incluso con la pestaña minimizada.
 */
export function emitirNotificacionPrueba(): boolean {
  if (!soportaNotificaciones() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notif = new Notification('Eonesia CRM · Avisos de escritorio activos', {
      body: '¡Todo listo! Te avisaremos cuando un próximo paso venza o sea para hoy, incluso si esta pestaña está en segundo plano.',
      tag: 'eonesia-prueba',
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('Error en notificación de prueba:', err);
    return false;
  }
}

/**
 * Evalúa las oportunidades del CRM y emite notificaciones según preferencias y vencimientos.
 * Devuelve el número de notificaciones emitidas.
 */
export function comprobarYNotificarVencimientos(
  estado: EstadoCRM,
  soloSiPestanaOculta: boolean = true
): number {
  // 1. Respetar estrictamente la preferencia del usuario
  if (estado.config.notificacionesNavegador === false) {
    return 0;
  }

  // 2. Verificar soporte y permisos
  if (obtenerEstadoPermiso() !== 'granted') {
    return 0;
  }

  // 3. Si se solicita solo para pestaña oculta, comprobar visibilidad
  if (soloSiPestanaOculta && typeof document !== 'undefined' && !document.hidden) {
    return 0;
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  const notificados = obtenerNotificados();

  // Filtrar oportunidades abiertas con paso vencido o para hoy
  const abiertasVencidas = estado.oportunidades.filter(
    (o) =>
      o.etapa !== 'Ganado' &&
      o.etapa !== 'Perdido' &&
      Boolean(o.proximoPaso?.fecha) &&
      o.proximoPaso.fecha <= hoyStr
  );

  let emitidas = 0;

  for (const op of abiertasVencidas) {
    const yaNotificado = notificados[op.id] === op.proximoPaso.fecha;
    if (yaNotificado) continue;

    const centro = estado.centros.find((c) => c.id === op.centroId);
    const ok = emitirNotificacionProximoPaso(op, centro);
    if (ok) {
      emitidas++;
      // Limitar a máximo 2 notificaciones simultáneas por comprobación para no saturar al usuario
      if (emitidas >= 2) break;
    }
  }

  return emitidas;
}
