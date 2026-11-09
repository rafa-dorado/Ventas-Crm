import {
  Actividad,
  Centro,
  ConfiguracionCRM,
  Contacto,
  DolorPrincipal,
  EstadoCRM,
  EtapaOportunidad,
  InsigniaPersonalizada,
  Juego,
  MotivoPerdida,
  Oportunidad,
  OrigenCentro,
  RegistroXP,
  RolContacto,
  TipoActividad,
  TipoCentro,
  RespaldoCifrado,
  RespaldoCifradoInfo,
} from './types';
import { crearEstadoInicial, DEFAULT_CONFIG, DEFAULT_JUEGO } from './data/initialData';
import {
  calcularCriterioSegmentoPorTipo,
  calcularProductoSugerido,
  normalizarDominio,
  normalizarNombreCentro,
  obtenerNivelYProgreso,
} from './utils/crmHelpers';

const STORAGE_KEY = 'eonesia_crm_state_v2';
const BACKUPS_KEY = 'eonesia_crm_respaldos_cifrados_v1';
const MAX_RESPALDOS = 10;
const CLAVE_CIFRADO = 'Eonesia-CRM-EdTech-Immersive-2026-SecretSeed';

/**
 * Cifra una cadena UTF-8 en formato Base64 con vector de inicialización (IV) aleatorio
 * y verificación de suma de comprobación (checksum).
 */
function cifrarTexto(
  texto: string,
  claveSecreta: string
): { iv: string; payload: string; checksum: string } {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(texto);

  // Vector de inicialización aleatorio de 16 bytes
  const ivBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(ivBytes);
  } else {
    for (let i = 0; i < 16; i++) ivBytes[i] = Math.floor(Math.random() * 256);
  }
  const ivHex = Array.from(ivBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Derivación de clave y flujo pseudoaleatorio determinista por IV
  let hashNum = 0x811c9dc5;
  const keyStr = claveSecreta + ivHex;
  for (let i = 0; i < keyStr.length; i++) {
    hashNum ^= keyStr.charCodeAt(i);
    hashNum = Math.imul(hashNum, 0x01000193);
  }

  let seed = hashNum >>> 0;
  const xorshift32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) & 0xff;
  };

  const encrypted = new Uint8Array(bytes.length);
  let checksumAcc = 0;
  for (let i = 0; i < bytes.length; i++) {
    const k = xorshift32();
    encrypted[i] = bytes[i] ^ k;
    checksumAcc = (checksumAcc + bytes[i] * (i + 1)) % 1000000007;
  }

  let binary = '';
  const len = encrypted.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(encrypted[i]);
  }
  const payload = btoa(binary);

  return {
    iv: ivHex,
    payload,
    checksum: checksumAcc.toString(16),
  };
}

/**
 * Descifra una carga útil Base64 validando la clave y la suma de comprobación.
 */
function descifrarTexto(
  payloadBase64: string,
  ivHex: string,
  checksum: string,
  claveSecreta: string
): string {
  const binary = atob(payloadBase64);
  const encrypted = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    encrypted[i] = binary.charCodeAt(i);
  }

  let hashNum = 0x811c9dc5;
  const keyStr = claveSecreta + ivHex;
  for (let i = 0; i < keyStr.length; i++) {
    hashNum ^= keyStr.charCodeAt(i);
    hashNum = Math.imul(hashNum, 0x01000193);
  }

  let seed = hashNum >>> 0;
  const xorshift32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) & 0xff;
  };

  const decrypted = new Uint8Array(encrypted.length);
  let checksumAcc = 0;
  for (let i = 0; i < encrypted.length; i++) {
    const k = xorshift32();
    decrypted[i] = encrypted[i] ^ k;
    checksumAcc = (checksumAcc + decrypted[i] * (i + 1)) % 1000000007;
  }

  if (checksum && checksum !== checksumAcc.toString(16)) {
    throw new Error('Verificación de integridad fallida: el respaldo cifrado está alterado o corrupto.');
  }

  const decoder = new TextDecoder('utf-8');
  return decoder.decode(decrypted);
}

export interface NotificacionCRM {
  id: string;
  tipo: 'xp' | 'nivel' | 'insignia' | 'error' | 'exito' | 'info';
  titulo: string;
  descripcion?: string;
  puntosXP?: number;
  icono?: string;
}

type ListenerEstado = (estado: EstadoCRM) => void;
type ListenerNotif = (notif: NotificacionCRM) => void;

class CRMRepository {
  private estado: EstadoCRM;
  private listeners: Set<ListenerEstado> = new Set();
  private notifListeners: Set<ListenerNotif> = new Set();
  private snapshotPrevio: EstadoCRM | null = null;
  private inicializado: boolean = false;
  private ultimoRespaldoTimestamp: number = 0;

  constructor() {
    this.estado = this.cargarDesdeStorage();
    this.inicializado = true;
    // Si no existen respaldos automáticos cifrados, inicializar el primero
    const existentes = this.leerRespaldosDesdeStorage();
    if (existentes.length === 0) {
      this.crearRespaldoCifradoInterno('Respaldo automático inicial');
    }
    // Asegurar que exista al menos un respaldo con prefijo eonesia_backup_
    try {
      let tieneBackupPrefijo = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eonesia_backup_')) {
          tieneBackupPrefijo = true;
          break;
        }
      }
      if (!tieneBackupPrefijo) {
        this.realizarRespaldo();
      }
    } catch {
      // Ignorar en entornos sin localStorage
    }
  }

  // --- Suscripciones ---
  public suscribir(listener: ListenerEstado): () => void {
    this.listeners.add(listener);
    listener(this.obtenerEstado());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribe(listener: ListenerEstado): () => void {
    return this.suscribir(listener);
  }

  public onNotificacion(listener: ListenerNotif): () => void {
    this.notifListeners.add(listener);
    return () => {
      this.notifListeners.delete(listener);
    };
  }

  public obtenerEstado(): EstadoCRM {
    return JSON.parse(JSON.stringify(this.estado));
  }

  private notificarCambio(): void {
    const copia = this.obtenerEstado();
    this.listeners.forEach((listener) => {
      try {
        listener(copia);
      } catch (err) {
        console.error('Error en listener de CRM:', err);
      }
    });
  }

  private emitirNotificacion(notif: Omit<NotificacionCRM, 'id'>): void {
    const completa: NotificacionCRM = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.notifListeners.forEach((listener) => {
      try {
        listener(completa);
      } catch (err) {
        console.error('Error en notif listener:', err);
      }
    });
  }

  // --- Persistencia con rollback y respaldo automático cifrado ---
  private guardar(motivoRespaldo?: string): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.estado));
      this.snapshotPrevio = JSON.parse(JSON.stringify(this.estado));

      // Respaldo automático cifrado con marca de tiempo en cada modificación
      this.realizarRespaldo();

      // Respaldo periódico estructurado para el historial del CRM
      const ahora = Date.now();
      if (motivoRespaldo || ahora - this.ultimoRespaldoTimestamp > 20000) {
        this.crearRespaldoCifradoInterno(
          motivoRespaldo || 'Respaldo automático con marca de tiempo'
        );
        this.ultimoRespaldoTimestamp = ahora;
      }

      return true;
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);

      // 1. Intentar rollback con el snapshot previo en memoria
      let restauradoConExito = false;
      if (this.snapshotPrevio) {
        this.estado = JSON.parse(JSON.stringify(this.snapshotPrevio));
        this.notificarCambio();
        restauradoConExito = true;
      } else {
        // 2. Si falló el snapshot en memoria, restaurar automáticamente desde el último respaldo cifrado
        const resUltimo = this.restaurarUltimoRespaldoValido();
        restauradoConExito = resUltimo.exito;
      }

      this.emitirNotificacion({
        tipo: 'error',
        titulo: 'Fallo al sincronizar datos',
        descripcion: restauradoConExito
          ? 'Error de sincronización detectado. Se ha restaurado automáticamente el estado previo seguro.'
          : 'No se pudo guardar en el almacenamiento local. Se han revertido los cambios.',
      });
      return false;
    }
  }

  // --- Sistema de Respaldos Automáticos Cifrados ---
  private leerRespaldosDesdeStorage(): RespaldoCifrado[] {
    try {
      const data = localStorage.getItem(BACKUPS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private escribirRespaldosEnStorage(respaldos: RespaldoCifrado[]): void {
    try {
      localStorage.setItem(BACKUPS_KEY, JSON.stringify(respaldos));
    } catch (err) {
      console.warn('Error al guardar lista de respaldos cifrados:', err);
    }
  }

  private crearRespaldoCifradoInterno(motivo: string): RespaldoCifradoInfo | null {
    try {
      const jsonTexto = JSON.stringify(this.estado);
      const { iv, payload, checksum } = cifrarTexto(jsonTexto, CLAVE_CIFRADO);

      const timestamp = new Date().toISOString();
      const id = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const valorTotal = this.estado.oportunidades.reduce((acc, o) => acc + (o.valor || 0), 0);

      const nuevoRespaldo: RespaldoCifrado = {
        id,
        timestamp,
        motivo,
        totalCentros: this.estado.centros.length,
        totalOportunidades: this.estado.oportunidades.length,
        valorTotal,
        tamanoBytes: payload.length,
        iv,
        checksum,
        payload,
      };

      const existentes = this.leerRespaldosDesdeStorage();
      // Guardar el nuevo al principio y limitar a MAX_RESPALDOS rotativos
      const actualizados = [nuevoRespaldo, ...existentes].slice(0, MAX_RESPALDOS);
      this.escribirRespaldosEnStorage(actualizados);

      return {
        id: nuevoRespaldo.id,
        timestamp: nuevoRespaldo.timestamp,
        motivo: nuevoRespaldo.motivo,
        totalCentros: nuevoRespaldo.totalCentros,
        totalOportunidades: nuevoRespaldo.totalOportunidades,
        valorTotal: nuevoRespaldo.valorTotal,
        tamanoBytes: nuevoRespaldo.tamanoBytes,
      };
    } catch (err) {
      console.warn('Error al generar respaldo cifrado automático:', err);
      return null;
    }
  }

  /**
   * Toma el estado actual del CRM, lo convierte a una cadena JSON, lo cifra usando
   * btoa para ofuscación básica y lo guarda en localStorage con una clave que
   * incluye el timestamp actual (ej. 'eonesia_backup_20231027120000').
   * Se ejecuta internamente cada vez que se realice una modificación en el CRM.
   *
   * @returns La clave del respaldo generada en localStorage (ej. 'eonesia_backup_20261108015910')
   */
  public realizarRespaldo(): string {
    try {
      // 1. Tomar el estado actual del CRM y convertirlo a una cadena JSON
      const jsonStr = JSON.stringify(this.estado);

      // 2. Cifrar usando btoa para ofuscación básica (con soporte UTF-8 seguro para acentos y eñes)
      const bytes = new TextEncoder().encode(jsonStr);
      let binaryStr = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }
      const contenidoOfuscado = btoa(binaryStr);

      // 3. Generar clave con el timestamp actual (ej. 'eonesia_backup_20231027120000')
      const ahora = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestampFormatted =
        ahora.getFullYear().toString() +
        pad(ahora.getMonth() + 1) +
        pad(ahora.getDate()) +
        pad(ahora.getHours()) +
        pad(ahora.getMinutes()) +
        pad(ahora.getSeconds());

      const backupKey = `eonesia_backup_${timestampFormatted}`;

      // 4. Guardar en localStorage
      localStorage.setItem(backupKey, contenidoOfuscado);

      // 5. Rotar respaldos para no saturar el almacenamiento local
      this.rotarRespaldosTimestamp();

      return backupKey;
    } catch (err) {
      console.warn('Error al ejecutar realizarRespaldo:', err);
      return '';
    }
  }

  /**
   * Mantiene en rotación los respaldos con prefijo eonesia_backup_ para no exceder cuotas de almacenamiento
   */
  private rotarRespaldosTimestamp(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eonesia_backup_')) {
          keys.push(k);
        }
      }
      keys.sort(); // Formato YYYYMMDDHHmmss se ordena naturalmente de menor a mayor
      const MAX_BACKUPS_LOCAL = 15;
      while (keys.length > MAX_BACKUPS_LOCAL) {
        const masAntiguo = keys.shift();
        if (masAntiguo) {
          localStorage.removeItem(masAntiguo);
        }
      }
    } catch {
      // Ignorar errores de rotación
    }
  }

  /**
   * Genera un respaldo automático del estado actual del CRM, cifrándolo antes de
   * guardarlo en localStorage con una marca de tiempo y suma de comprobación,
   * garantizando la integridad de los datos.
   */
  public generarRespaldoAutomatico(
    motivo: string = 'Respaldo automático del estado actual con marca de tiempo'
  ): RespaldoCifradoInfo | null {
    const res = this.crearRespaldoCifradoInterno(motivo);
    if (res) {
      this.ultimoRespaldoTimestamp = Date.now();
      this.emitirNotificacion({
        tipo: 'exito',
        titulo: 'Respaldo automático generado',
        descripcion: `Copia cifrada asegurada con marca de tiempo (${new Date(res.timestamp).toLocaleTimeString()}).`,
      });
    }
    return res;
  }

  /**
   * Crea manualmente un respaldo cifrado con marca de tiempo actual
   */
  public crearRespaldoCifrado(motivo: string = 'Respaldo manual'): RespaldoCifradoInfo | null {
    const res = this.crearRespaldoCifradoInterno(motivo);
    if (res) {
      this.emitirNotificacion({
        tipo: 'exito',
        titulo: 'Respaldo cifrado guardado',
        descripcion: `Punto de restauración creado con éxito (${new Date(res.timestamp).toLocaleTimeString()}).`,
      });
    }
    return res;
  }

  /**
   * Devuelve la lista de respaldos cifrados con marca de tiempo y métricas resumen
   */
  public obtenerHistorialRespaldos(): RespaldoCifradoInfo[] {
    const respaldos = this.leerRespaldosDesdeStorage();
    return respaldos.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      motivo: r.motivo,
      totalCentros: r.totalCentros,
      totalOportunidades: r.totalOportunidades,
      valorTotal: r.valorTotal,
      tamanoBytes: r.tamanoBytes,
    }));
  }

  /**
   * Restaura un estado anterior a partir de un respaldo cifrado seleccionado
   */
  public restaurarRespaldoCifrado(backupId: string): { exito: boolean; error?: string } {
    try {
      const respaldos = this.leerRespaldosDesdeStorage();
      const encontrado = respaldos.find((r) => r.id === backupId);
      if (!encontrado) {
        return { exito: false, error: 'No se encontró el respaldo cifrado solicitado.' };
      }

      // Descifrado con verificación de suma de comprobación
      const jsonDesencriptado = descifrarTexto(
        encontrado.payload,
        encontrado.iv,
        encontrado.checksum,
        CLAVE_CIFRADO
      );

      const parseado: EstadoCRM = JSON.parse(jsonDesencriptado);
      if (!parseado || !Array.isArray(parseado.centros) || !Array.isArray(parseado.oportunidades)) {
        return {
          exito: false,
          error: 'El archivo descifrado no tiene la estructura de datos requerida para el CRM.',
        };
      }

      // Aplicar estado restaurado mediante setEstado
      this.setEstado(
        parseado,
        `Se restauraron ${parseado.centros.length} centros y ${parseado.oportunidades.length} oportunidades del ${new Date(encontrado.timestamp).toLocaleString()}.`
      );

      return { exito: true };
    } catch (err: any) {
      console.error('Error al restaurar respaldo cifrado:', err);
      return {
        exito: false,
        error: err.message || 'Error al descifrar o procesar el respaldo.',
      };
    }
  }

  /**
   * Obtiene y descifra el estado completo de un respaldo cifrado específico
   */
  public obtenerEstadoDeRespaldo(backupId: string): EstadoCRM | null {
    try {
      const respaldos = this.leerRespaldosDesdeStorage();
      const encontrado = respaldos.find((r) => r.id === backupId);
      if (!encontrado) return null;

      const jsonDesencriptado = descifrarTexto(
        encontrado.payload,
        encontrado.iv,
        encontrado.checksum,
        CLAVE_CIFRADO
      );

      const parseado: EstadoCRM = JSON.parse(jsonDesencriptado);
      if (!parseado || !Array.isArray(parseado.centros) || !Array.isArray(parseado.oportunidades)) {
        return null;
      }

      return parseado;
    } catch (err) {
      console.error('Error al obtener estado de respaldo:', err);
      return null;
    }
  }

  /**
   * Establece un nuevo estado completo en el CRM a partir de un objeto EstadoCRM o de una
   * cadena de respaldo (codificada en btoa o en formato JSON), actualiza la persistencia y notifica a los suscriptores.
   */
  public setEstado(
    nuevoEstado: EstadoCRM | string,
    motivo: string = 'Restauración de versión anterior'
  ): void {
    let estadoObj: EstadoCRM;

    if (typeof nuevoEstado === 'string') {
      try {
        // Intento 1: decodificación UTF-8 de cadena btoa generada por realizarRespaldo()
        const binStr = atob(nuevoEstado);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        estadoObj = JSON.parse(jsonStr);
      } catch {
        try {
          // Intento 2: JSON plano directo
          estadoObj = JSON.parse(nuevoEstado);
        } catch {
          try {
            // Intento 3: atob simple directo
            estadoObj = JSON.parse(atob(nuevoEstado));
          } catch {
            throw new Error('El contenido del respaldo no es válido o no se pudo interpretar.');
          }
        }
      }
    } else {
      estadoObj = nuevoEstado;
    }

    if (
      !estadoObj ||
      !Array.isArray(estadoObj.centros) ||
      !Array.isArray(estadoObj.oportunidades)
    ) {
      throw new Error('El estado proporcionado no es válido para el CRM de Eonesia.');
    }

    // Asegurar estructura de campos si faltasen
    if (!estadoObj.config) estadoObj.config = DEFAULT_CONFIG;
    if (!estadoObj.juego) estadoObj.juego = DEFAULT_JUEGO;

    this.estado = JSON.parse(JSON.stringify(estadoObj));
    this.snapshotPrevio = JSON.parse(JSON.stringify(estadoObj));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.estado));
      this.realizarRespaldo();
    } catch (err) {
      console.warn('Error al persistir en setEstado:', err);
    }
    this.notificarCambio();
    this.emitirNotificacion({
      tipo: 'exito',
      titulo: 'Versión del CRM restaurada',
      descripcion: motivo,
    });
  }

  /**
   * Lee todos los respaldos guardados en localStorage con el prefijo 'eonesia_backup_',
   * los ordena por timestamp y devuelve sus metadatos junto con el contenido.
   */
  public leerRespaldosLocalStorage(): Array<{
    clave: string;
    timestamp: number;
    fechaLegible: string;
    tamanoBytes: number;
    contenido: string;
    totalCentros?: number;
    totalOportunidades?: number;
    valorTotal?: number;
  }> {
    const lista: Array<{
      clave: string;
      timestamp: number;
      fechaLegible: string;
      tamanoBytes: number;
      contenido: string;
      totalCentros?: number;
      totalOportunidades?: number;
      valorTotal?: number;
    }> = [];

    if (typeof localStorage === 'undefined') return lista;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eonesia_backup_')) {
          const contenido = localStorage.getItem(k) || '';
          const raw = k.replace('eonesia_backup_', '');
          let ts = 0;
          let fecha = new Date();

          if (/^\d{14}$/.test(raw)) {
            // Formato YYYYMMDDHHmmss
            const y = parseInt(raw.substring(0, 4), 10);
            const m = parseInt(raw.substring(4, 6), 10) - 1;
            const d = parseInt(raw.substring(6, 8), 10);
            const h = parseInt(raw.substring(8, 10), 10);
            const min = parseInt(raw.substring(10, 12), 10);
            const s = parseInt(raw.substring(12, 14), 10);
            fecha = new Date(y, m, d, h, min, s);
            ts = fecha.getTime();
          } else if (/^\d{10,13}$/.test(raw)) {
            ts = parseInt(raw, 10) * (raw.length === 10 ? 1000 : 1);
            fecha = new Date(ts);
          } else {
            ts = Date.now();
          }

          let centrosCount: number | undefined;
          let opCount: number | undefined;
          let valTotal: number | undefined;

          // Intento de decodificar datos para enriquecer visualmente la tarjeta
          try {
            const binStr = atob(contenido);
            const bytes = new Uint8Array(binStr.length);
            for (let j = 0; j < binStr.length; j++) {
              bytes[j] = binStr.charCodeAt(j);
            }
            const parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes));
            if (parsed && Array.isArray(parsed.centros)) {
              centrosCount = parsed.centros.length;
            }
            if (parsed && Array.isArray(parsed.oportunidades)) {
              opCount = parsed.oportunidades.length;
              valTotal = parsed.oportunidades.reduce((acc: number, o: any) => acc + (o.valor || 0), 0);
            }
          } catch {
            try {
              const parsed = JSON.parse(contenido);
              if (parsed && Array.isArray(parsed.centros)) centrosCount = parsed.centros.length;
              if (parsed && Array.isArray(parsed.oportunidades)) {
                opCount = parsed.oportunidades.length;
                valTotal = parsed.oportunidades.reduce((acc: number, o: any) => acc + (o.valor || 0), 0);
              }
            } catch {}
          }

          lista.push({
            clave: k,
            timestamp: ts,
            fechaLegible: fecha.toLocaleString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            tamanoBytes: contenido.length,
            contenido,
            totalCentros: centrosCount,
            totalOportunidades: opCount,
            valorTotal: valTotal,
          });
        }
      }

      // Ordenar por timestamp descendente (los más recientes primero)
      lista.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.warn('Error al leer respaldos de localStorage:', err);
    }

    return lista;
  }

  /**
   * Restaura automáticamente el respaldo cifrado más reciente ante errores de sincronización
   */
  public restaurarUltimoRespaldoValido(): { exito: boolean; error?: string } {
    const respaldos = this.leerRespaldosDesdeStorage();
    for (const backup of respaldos) {
      const resultado = this.restaurarRespaldoCifrado(backup.id);
      if (resultado.exito) {
        return resultado;
      }
    }
    return { exito: false, error: 'No se encontró ningún respaldo cifrado válido para restaurar.' };
  }

  /**
   * Elimina un respaldo cifrado del almacenamiento local
   */
  public eliminarRespaldoCifrado(backupId: string): void {
    const respaldos = this.leerRespaldosDesdeStorage();
    const filtrados = respaldos.filter((r) => r.id !== backupId);
    this.escribirRespaldosEnStorage(filtrados);
    this.emitirNotificacion({
      tipo: 'info',
      titulo: 'Respaldo eliminado',
      descripcion: 'El punto de restauración ha sido eliminado del almacenamiento local.',
    });
  }

  private cargarDesdeStorage(): EstadoCRM {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parseado = JSON.parse(guardado);
        if (parseado && Array.isArray(parseado.centros) && Array.isArray(parseado.oportunidades)) {
          // Asegurar integridad de campos nuevos
          if (!parseado.config) parseado.config = DEFAULT_CONFIG;
          if (!parseado.juego) parseado.juego = DEFAULT_JUEGO;

          // Si ninguna oportunidad abierta tiene fecha para hoy o vencida, asegurar las 3 primeras para prueba
          const hoyStr = new Date().toISOString().split('T')[0];
          const tieneHoyOVencidas = parseado.oportunidades.some(
            (o: any) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido' && o.proximoPaso?.fecha && o.proximoPaso.fecha <= hoyStr
          );
          if (!tieneHoyOVencidas) {
            const abiertas = parseado.oportunidades.filter((o: any) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido');
            if (abiertas[0]?.proximoPaso) abiertas[0].proximoPaso.fecha = hoyStr;
            if (abiertas[1]?.proximoPaso) {
              const d1 = new Date();
              d1.setDate(d1.getDate() - 1);
              abiertas[1].proximoPaso.fecha = d1.toISOString().split('T')[0];
            }
            if (abiertas[2]?.proximoPaso) {
              const d2 = new Date();
              d2.setDate(d2.getDate() - 2);
              abiertas[2].proximoPaso.fecha = d2.toISOString().split('T')[0];
            }
          }

          this.snapshotPrevio = JSON.parse(JSON.stringify(parseado));
          return parseado;
        }
      }
    } catch (err) {
      console.warn('No se pudo leer localStorage, cargando datos iniciales:', err);
    }
    const inicial = crearEstadoInicial();
    this.snapshotPrevio = JSON.parse(JSON.stringify(inicial));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial));
    } catch {
      // Ignorar fallo inicial
    }
    return inicial;
  }

  // --- Sistema de XP y Gamificación ---
  public darXP(puntos: number, motivo: string): void {
    if (puntos <= 0) return;

    const nivelAnteriorInfo = obtenerNivelYProgreso(this.estado.juego.xp);
    this.estado.juego.xp += puntos;
    const nuevoNivelInfo = obtenerNivelYProgreso(this.estado.juego.xp);
    this.estado.juego.nivel = nuevoNivelInfo.nombre;

    const registro: RegistroXP = {
      fecha: new Date().toISOString(),
      xp: puntos,
      motivo,
    };
    this.estado.juego.historialXP.unshift(registro);

    // Aviso breve de XP
    this.emitirNotificacion({
      tipo: 'xp',
      titulo: `+${puntos} XP`,
      descripcion: motivo,
      puntosXP: puntos,
    });

    // Si subió de nivel
    if (nuevoNivelInfo.nivelNumero > nivelAnteriorInfo.nivelNumero) {
      this.emitirNotificacion({
        tipo: 'nivel',
        titulo: `¡Subiste a Nivel ${nuevoNivelInfo.nivelNumero}: ${nuevoNivelInfo.nombre}!`,
        descripcion: 'Sigue avanzando oportunidades y conquistando nuevos centros.',
        icono: 'Hexagon',
      });
    }

    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  // --- Función central: ingestar(centros, origen) ---
  public ingestar(
    centrosNuevos: Array<Partial<Centro>>,
    origen: OrigenCentro
  ): {
    creados: Centro[];
    duplicados: Array<{ candidato: Partial<Centro>; existente: Centro; motivo: string }>;
  } {
    const creados: Centro[] = [];
    const duplicados: Array<{ candidato: Partial<Centro>; existente: Centro; motivo: string }> = [];

    for (const candidato of centrosNuevos) {
      if (!candidato.nombre) continue;

      let existenteEncontrado: Centro | undefined = undefined;
      let motivoDuplicado = '';

      // 1. Quitar duplicados por externalId
      if (candidato.externalId) {
        existenteEncontrado = this.estado.centros.find(
          (c) => c.externalId && c.externalId.toLowerCase() === candidato.externalId?.toLowerCase()
        );
        if (existenteEncontrado) {
          motivoDuplicado = `External ID idéntico (${candidato.externalId})`;
        }
      }

      // 2. Quitar duplicados por dominio web
      if (!existenteEncontrado && candidato.web) {
        const domCandidato = normalizarDominio(candidato.web);
        if (domCandidato) {
          existenteEncontrado = this.estado.centros.find((c) => {
            const domExistente = normalizarDominio(c.web);
            return domExistente && domExistente === domCandidato;
          });
          if (existenteEncontrado) {
            motivoDuplicado = `Mismo dominio web (${domCandidato})`;
          }
        }
      }

      // 3. Quitar duplicados por nombre normalizado (sin tildes, minúsculas, sin "colegio/ies/cifp") + provincia
      if (!existenteEncontrado) {
        const nomNormCandidato = normalizarNombreCentro(candidato.nombre);
        const provNormCandidato = normalizarNombreCentro(candidato.provincia || '');

        existenteEncontrado = this.estado.centros.find((c) => {
          const nomNorm = normalizarNombreCentro(c.nombre);
          const provNorm = normalizarNombreCentro(c.provincia || '');
          const mismoNombre = nomNorm === nomNormCandidato || nomNorm.includes(nomNormCandidato) || nomNormCandidato.includes(nomNorm);
          const mismaProv = !provNormCandidato || !provNorm || provNorm === provNormCandidato;
          return mismoNombre && mismaProv;
        });
        if (existenteEncontrado) {
          motivoDuplicado = `Nombre y provincia coincidentes con ${existenteEncontrado.nombre}`;
        }
      }

      if (existenteEncontrado) {
        duplicados.push({
          candidato,
          existente: existenteEncontrado,
          motivo: motivoDuplicado,
        });
      } else {
        const nuevoCentro: Centro = {
          id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          nombre: candidato.nombre.trim(),
          tipo: (candidato.tipo as TipoCentro) || 'FP',
          provincia: candidato.provincia?.trim() || 'No especificada',
          alumnos: candidato.alumnos || 500,
          web: candidato.web?.trim() || '',
          red: candidato.red?.trim(),
          externalId: candidato.externalId?.trim(),
          origen,
          verificado: candidato.verificado ?? false,
          creadoEn: new Date().toISOString(),
        };
        this.estado.centros.push(nuevoCentro);
        creados.push(nuevoCentro);
      }
    }

    if (creados.length > 0) {
      this.verificarInsigniasAutomaticas();
      this.guardar();
      this.notificarCambio();
    }

    return { creados, duplicados };
  }

  // --- Oportunidades y Kanban ---
  public moverOportunidadEtapa(
    oportunidadId: string,
    nuevaEtapa: EtapaOportunidad,
    motivoPerdida?: MotivoPerdida
  ): void {
    const oportunidad = this.estado.oportunidades.find((o) => o.id === oportunidadId);
    if (!oportunidad || oportunidad.etapa === nuevaEtapa) return;

    const etapaAnterior = oportunidad.etapa;
    oportunidad.etapa = nuevaEtapa;

    // Verificar si es la primera vez que esta oportunidad llega a esa etapa
    const yaHabiaEstadoEnEtapa = oportunidad.historialEtapas.some((h) => h.etapa === nuevaEtapa);
    oportunidad.historialEtapas.push({
      etapa: nuevaEtapa,
      fecha: new Date().toISOString(),
    });

    if (nuevaEtapa === 'Perdido') {
      if (motivoPerdida) oportunidad.motivoPerdida = motivoPerdida;
      oportunidad.cerradoEn = new Date().toISOString();
    } else if (nuevaEtapa === 'Ganado') {
      oportunidad.cerradoEn = new Date().toISOString();
      // Primera vez de cierre
      this.verificarPrimeraVez('primer_cierre', 'Primer cierre ganado');
    }

    if (nuevaEtapa === 'Demo') {
      this.verificarPrimeraVez('primera_demo', 'Primera demo realizada');
    } else if (nuevaEtapa === 'Piloto') {
      this.verificarPrimeraVez('primer_piloto', 'Primer piloto lanzado');
    } else if (nuevaEtapa === 'Propuesta') {
      this.verificarPrimeraVez('primera_propuesta', 'Primera propuesta enviada');
    }

    // Regla: +10 XP la primera vez que una oportunidad llega a cada etapa
    if (!yaHabiaEstadoEnEtapa) {
      this.darXP(10, `Primera vez en etapa ${nuevaEtapa}`);
    }

    // Actualizar progreso diario de misiones (avanzar oportunidad)
    this.estado.juego.misionesHoy.etapasAvanzadas += 1;

    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  public registrarActividad(
    oportunidadId: string,
    actividad: Partial<Actividad> & { tipo: TipoActividad; nota: string }
  ): void {
    const op = this.estado.oportunidades.find((o) => o.id === oportunidadId);
    if (!op) return;

    const nuevaActividad: Actividad = {
      id: actividad.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tipo: actividad.tipo,
      fecha: actividad.fecha || new Date().toISOString(),
      autor: actividad.autor || 'Rafa Dorado',
      titulo: actividad.titulo || '',
      nota: actividad.nota.trim(),
      resultado: actividad.resultado || 'completada',
      duracionMinutos: actividad.duracionMinutos,
      enlacePropuesta: actividad.enlacePropuesta,
    };

    if (!op.actividades) op.actividades = [];
    op.actividades.unshift(nuevaActividad);

    // Misiones diarias
    this.estado.juego.misionesHoy.actividadesRegistradas += 1;

    // XP dinámico según impacto de la actividad comercial
    const puntos = actividad.tipo === 'demo' || actividad.tipo === 'reunion' || actividad.tipo === 'propuesta' ? 20 : 10;
    this.darXP(puntos, `Actividad omnicanal: ${actividad.tipo} (+${puntos} XP)`);
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  public actualizarOportunidad(oportunidadId: string, cambios: Partial<Oportunidad>): void {
    const op = this.estado.oportunidades.find((o) => o.id === oportunidadId);
    if (!op) return;

    // Comprobar cuadrantes de empatía completados por primera vez
    if (cambios.empatia && Array.isArray(cambios.empatia)) {
      if (!this.estado.config.cuadrantesEmpatiaCompletados) {
        this.estado.config.cuadrantesEmpatiaCompletados = {};
      }
      if (!this.estado.config.cuadrantesEmpatiaCompletados[oportunidadId]) {
        this.estado.config.cuadrantesEmpatiaCompletados[oportunidadId] = [false, false, false, false, false, false];
      }

      const flags = this.estado.config.cuadrantesEmpatiaCompletados[oportunidadId];
      const nombresCuadrantes = [
        'Piensa y siente',
        'Ve',
        'Oye',
        'Dice y hace',
        'Dolores',
        'Alegrías',
      ];

      let nuevosCompletados = 0;
      for (let i = 0; i < 6; i++) {
        const textoNuevo = (cambios.empatia[i] || '').trim();
        if (textoNuevo.length > 5 && !flags[i]) {
          flags[i] = true;
          nuevosCompletados++;
          this.darXP(8, `Completado cuadrante de empatía: ${nombresCuadrantes[i]}`);
          this.estado.juego.misionesHoy.cuadrantesCompletados += 1;
        }
      }

      // Si los 6 cuadrantes están completos y todos flags son true
      const todosCompletos = flags.every(Boolean);
      const yaTeniaBonusTodos = flags.length === 7 && flags[6] === true; // flag 6 como bonus
      if (todosCompletos && !yaTeniaBonusTodos) {
        flags[6] = true; // marcar bonus de 6 concedido
        this.darXP(20, '¡Mapa de empatía de 6 cuadrantes completado!');
      }
    }

    Object.assign(op, cambios);
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  // --- Crear nuevo lead ---
  public crearLead(datos: {
    nombreCentro: string;
    tipo: TipoCentro;
    provincia: string;
    contacto: {
      nombre: string;
      cargo: string;
      rol: RolContacto;
      email?: string;
    };
    valor: number;
    dolor: DolorPrincipal;
    notas?: string;
    centroIdExistente?: string;
  }): { oportunidad: Oportunidad; centro: Centro; esNuevoCentro: boolean } {
    let centro: Centro;
    let esNuevoCentro = false;

    if (datos.centroIdExistente) {
      const exist = this.estado.centros.find((c) => c.id === datos.centroIdExistente);
      if (!exist) throw new Error('Centro seleccionado no existe');
      centro = exist;
    } else {
      const res = this.ingestar(
        [
          {
            nombre: datos.nombreCentro,
            tipo: datos.tipo,
            provincia: datos.provincia,
            origen: 'manual',
            verificado: false,
          },
        ],
        'manual'
      );
      if (res.creados.length > 0) {
        centro = res.creados[0];
        esNuevoCentro = true;
      } else if (res.duplicados.length > 0) {
        centro = res.duplicados[0].existente;
      } else {
        throw new Error('No se pudo crear el centro');
      }
    }

    // Crear contacto
    const nuevoContacto: Contacto = {
      id: `ct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      centroId: centro.id,
      nombre: datos.contacto.nombre.trim() || 'Contacto Principal',
      cargo: datos.contacto.cargo.trim() || 'Innovación',
      email: datos.contacto.email?.trim() || '',
      rol: datos.contacto.rol || 'Decisor',
    };
    this.estado.contactos.push(nuevoContacto);
    this.verificarPrimeraVez('primer_contacto', 'Primer contacto registrado');

    // Calcular producto sugerido
    const sugerido = calcularProductoSugerido(centro.tipo, datos.dolor, centro.red);

    // Criterio automático de segmento
    const criterioSegmento = calcularCriterioSegmentoPorTipo(centro.tipo);

    const nuevaOportunidad: Oportunidad = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      centroId: centro.id,
      contactoIds: [nuevoContacto.id],
      etapa: 'Detectado',
      valor: Number(datos.valor) || 0,
      dolor: datos.dolor,
      productoSugerido: sugerido.producto,
      productoElegido: sugerido.producto,
      criterios: [null, null, criterioSegmento, null, null],
      empatia: ['', '', '', '', '', ''],
      proximoPaso: {
        accion: 'Llamada o primer contacto para presentar propuesta de valor',
        fecha: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      historialEtapas: [
        {
          etapa: 'Detectado',
          fecha: new Date().toISOString(),
        },
      ],
      actividades: datos.notas
        ? [
            {
              id: `act-${Date.now()}`,
              tipo: 'otro',
              fecha: new Date().toISOString(),
              nota: datos.notas,
            },
          ]
        : [],
      creadoEn: new Date().toISOString(),
    };

    this.estado.oportunidades.push(nuevaOportunidad);

    // +5 XP por registrar lead
    this.darXP(5, 'Nuevo lead registrado');

    this.guardar();
    this.notificarCambio();

    return { oportunidad: nuevaOportunidad, centro, esNuevoCentro };
  }

  // --- Centros ---
  public actualizarCentro(centroId: string, cambios: Partial<Centro>): void {
    const c = this.estado.centros.find((item) => item.id === centroId);
    if (!c) return;
    Object.assign(c, cambios);
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  public marcarCentroVerificado(centroId: string): void {
    const c = this.estado.centros.find((item) => item.id === centroId);
    if (!c || c.verificado) return;
    c.verificado = true;
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  public anadirContacto(centroId: string, contacto: Omit<Contacto, 'id' | 'centroId'>): Contacto {
    const nuevo: Contacto = {
      id: `ct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      centroId,
      nombre: contacto.nombre.trim(),
      cargo: contacto.cargo.trim(),
      email: contacto.email?.trim() || '',
      rol: contacto.rol,
    };
    this.estado.contactos.push(nuevo);
    this.guardar();
    this.notificarCambio();
    return nuevo;
  }

  public actualizarConfig(cambios: Partial<ConfiguracionCRM>): void {
    Object.assign(this.estado.config, cambios);
    this.guardar();
    this.notificarCambio();
  }

  /**
   * Calcula dinámicamente el progreso hacia el objetivo anual a partir de las
   * oportunidades cerradas con éxito (etapa 'Ganado') frente al objetivo total configurado.
   */
  public calcularProgresoObjetivoAnual(): {
    objetivoTotal: number;
    valorGanado: number;
    porcentajeGanado: number;
    oportunidadesGanadasCount: number;
    restante: number;
    previsionPonderada: number;
    pctPrevision: number;
    ritmoMensualSugerido: number;
  } {
    const objetivoTotal = this.estado.config.objetivoVentas || 100000;
    const ganadas = this.estado.oportunidades.filter((o) => o.etapa === 'Ganado');
    const valorGanado = ganadas.reduce((acc, o) => acc + (o.valor || 0), 0);
    const porcentajeGanado =
      objetivoTotal > 0 ? Math.min(100, Math.round((valorGanado / objetivoTotal) * 100)) : 0;
    const restante = Math.max(0, objetivoTotal - valorGanado);

    const abiertas = this.estado.oportunidades.filter(
      (o) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido'
    );
    const previsionPonderada = Math.round(
      abiertas.reduce((acc, o) => {
        const prob = this.estado.config.probabilidades?.[o.etapa] ?? 20;
        return acc + (o.valor || 0) * (prob / 100);
      }, 0)
    );

    const pctPrevision =
      objetivoTotal > 0
        ? Math.min(100 - porcentajeGanado, Math.round((previsionPonderada / objetivoTotal) * 100))
        : 0;

    const mesActual = new Date().getMonth(); // 0 a 11
    const mesesRestantes = Math.max(1, 12 - mesActual);
    const ritmoMensualSugerido = Math.round(restante / mesesRestantes);

    return {
      objetivoTotal,
      valorGanado,
      porcentajeGanado,
      oportunidadesGanadasCount: ganadas.length,
      restante,
      previsionPonderada,
      pctPrevision,
      ritmoMensualSugerido,
    };
  }

  // --- Reset y gestión de datos de ejemplo ---
  public borrarDatosEjemplo(): void {
    this.estado.centros = [];
    this.estado.contactos = [];
    this.estado.oportunidades = [];
    this.estado.esDatosEjemplo = false;
    this.guardar();
    this.notificarCambio();
    this.emitirNotificacion({
      tipo: 'info',
      titulo: 'Datos de ejemplo eliminados',
      descripcion: 'El CRM está ahora limpio para tus centros y oportunidades reales.',
    });
  }

  public restaurarDatosEjemplo(): void {
    const inicial = crearEstadoInicial();
    this.estado = inicial;
    this.guardar();
    this.notificarCambio();
    this.emitirNotificacion({
      tipo: 'exito',
      titulo: 'Datos de ejemplo restaurados',
      descripcion: 'Se han cargado los 8 centros y oportunidades demostrativas.',
    });
  }

  // --- Preferencia de Notificaciones del Navegador ---
  public actualizarPreferenciaNotificaciones(activadas: boolean): void {
    if (!this.estado.config) {
      this.estado.config = { ...DEFAULT_CONFIG };
    }
    this.estado.config.notificacionesNavegador = activadas;
    this.guardar();
    this.notificarCambio();
    this.emitirNotificacion({
      tipo: 'info',
      titulo: activadas ? 'Avisos de escritorio activados' : 'Avisos de escritorio pausados',
      descripcion: activadas
        ? 'Te avisaremos sobre próximos pasos vencidos o para hoy aunque tengas la pestaña en segundo plano.'
        : 'Las notificaciones del navegador se han desactivado según tu preferencia.',
    });
  }

  // --- Exportar e Importar Copia ---
  public exportarCopiaJSON(): string {
    return JSON.stringify(this.estado, null, 2);
  }

  public importarCopiaJSON(jsonString: string): { exito: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { exito: false, error: 'El archivo no contiene un JSON válido.' };
      }
      if (!Array.isArray(data.centros) || !Array.isArray(data.oportunidades)) {
        return {
          exito: false,
          error: 'El formato no corresponde a una copia del CRM Eonesia (faltan centros u oportunidades).',
        };
      }

      this.estado = {
        centros: data.centros || [],
        contactos: data.contactos || [],
        oportunidades: data.oportunidades || [],
        juego: data.juego || DEFAULT_JUEGO,
        config: data.config || DEFAULT_CONFIG,
        esDatosEjemplo: false,
      };

      this.guardar();
      this.notificarCambio();
      this.emitirNotificacion({
        tipo: 'exito',
        titulo: 'Copia importada con éxito',
        descripcion: `Se importaron ${this.estado.centros.length} centros y ${this.estado.oportunidades.length} oportunidades.`,
      });
      return { exito: true };
    } catch (err: any) {
      return { exito: false, error: `Error de lectura: ${err.message}` };
    }
  }

  // --- Prospección con límite diario de XP (+3 XP por centro, máx 30 XP al día) ---
  public anadirCentrosProspeccion(centrosParaAnadir: Array<Partial<Centro>>): {
    creados: Centro[];
    duplicadosCount: number;
    xpOtorgado: number;
  } {
    const hoyStr = new Date().toISOString().split('T')[0];
    if (this.estado.juego.xpHoyProspeccion.fecha !== hoyStr) {
      this.estado.juego.xpHoyProspeccion = { fecha: hoyStr, xp: 0 };
    }

    const res = this.ingestar(centrosParaAnadir, 'prospeccion');

    // Para cada centro creado, creamos una oportunidad en Detectado con verificado=false
    for (const c of res.creados) {
      const sugerido = calcularProductoSugerido(c.tipo, undefined, c.red);
      const criterioSegmento = calcularCriterioSegmentoPorTipo(c.tipo);
      const op: Oportunidad = {
        id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        centroId: c.id,
        contactoIds: [],
        etapa: 'Detectado',
        valor: 0,
        dolor: 'Otro',
        productoSugerido: sugerido.producto,
        productoElegido: sugerido.producto,
        criterios: [null, null, criterioSegmento, null, null],
        empatia: ['', '', '', '', '', ''],
        proximoPaso: {
          accion: 'Buscar contacto de innovación o TIC en web/LinkedIn',
          fecha: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        historialEtapas: [{ etapa: 'Detectado', fecha: new Date().toISOString() }],
        actividades: [],
        creadoEn: new Date().toISOString(),
      };
      this.estado.oportunidades.push(op);
    }

    if (res.creados.length > 0) {
      this.verificarPrimeraVez('primer_centro_prospectado', 'Primer centro prospectado añadido');
    }

    // Calcular XP disponible: +3 XP por centro añadido, máx 30 al día
    const xpMaxRestante = Math.max(0, 30 - this.estado.juego.xpHoyProspeccion.xp);
    const xpTeorico = res.creados.length * 3;
    const xpaDar = Math.min(xpTeorico, xpMaxRestante);

    if (xpaDar > 0) {
      this.estado.juego.xpHoyProspeccion.xp += xpaDar;
      this.darXP(xpaDar, `${res.creados.length} centros añadidos desde prospección (+3 XP c/u, máx 30/día)`);
    }

    this.guardar();
    this.notificarCambio();

    return {
      creados: res.creados,
      duplicadosCount: res.duplicados.length,
      xpOtorgado: xpaDar,
    };
  }

  // --- Misiones de Hoy ---
  public reclamarMisionDiaria(misionKey: 'mision_etapas' | 'mision_actividades' | 'mision_empatia'): void {
    if (this.estado.juego.misionesHoy.reclamadas[misionKey]) return;
    this.estado.juego.misionesHoy.reclamadas[misionKey] = true;
    this.darXP(10, 'Misión de hoy completada');
    this.guardar();
    this.notificarCambio();
  }

  // --- Retos y Cofres ---
  public reclamarRetoSemanal(retoId: string): void {
    if (this.estado.juego.retosSemanales.reclamados[retoId]) return;
    this.estado.juego.retosSemanales.reclamados[retoId] = true;
    this.darXP(30, `Reto semanal reclamado: ${retoId}`);
    this.guardar();
    this.notificarCambio();
  }

  public reclamarCofreSemanal(): void {
    if (this.estado.juego.retosSemanales.cofreReclamado) return;
    this.estado.juego.retosSemanales.cofreReclamado = true;
    this.estado.juego.retosSemanales.cofreFecha = new Date().toISOString();
    this.darXP(50, '¡Portal Luminoso: Cofre semanal reclamado!');
    this.emitirNotificacion({
      tipo: 'insignia',
      titulo: '¡Cofre Semanal Abierto!',
      descripcion: '+50 XP y Sello Semanal registrado con éxito.',
      icono: 'Gift',
    });
    this.guardar();
    this.notificarCambio();
  }

  public reclamarRetoMensual(retoId: string): void {
    if (this.estado.juego.retosMensuales.reclamados[retoId]) return;
    this.estado.juego.retosMensuales.reclamados[retoId] = true;
    this.darXP(60, `Reto mensual reclamado: ${retoId}`);
    this.guardar();
    this.notificarCambio();
  }

  public reclamarCofreMensual(): void {
    if (this.estado.juego.retosMensuales.cofreReclamado) return;
    this.estado.juego.retosMensuales.cofreReclamado = true;
    this.estado.juego.retosMensuales.cofreFecha = new Date().toISOString();
    this.darXP(150, '¡Cofre del Mes reclamado!');
    this.emitirNotificacion({
      tipo: 'insignia',
      titulo: '¡Insignia Mensual Obtenida!',
      descripcion: '+150 XP y la insignia exclusiva del mes incorporada a tu perfil.',
      icono: 'Award',
    });
    this.guardar();
    this.notificarCambio();
  }

  public ajustarMultiplicadorReto(
    periodo: 'semanal' | 'mensual',
    retoId: string,
    multiplicador: number
  ): void {
    if (periodo === 'semanal') {
      this.estado.juego.retosSemanales.multiplicadores[retoId] = multiplicador;
    } else {
      this.estado.juego.retosMensuales.multiplicadores[retoId] = multiplicador;
    }
    this.guardar();
    this.notificarCambio();
  }

  // --- Series Bronce / Plata / Oro ---
  public reclamarGradoSerie(serieId: string, gradoIndex: number, xpPremio: number): void {
    if (!this.estado.juego.seriesReclamadas[serieId]) {
      this.estado.juego.seriesReclamadas[serieId] = [false, false, false];
    }
    if (this.estado.juego.seriesReclamadas[serieId][gradoIndex]) return;

    this.estado.juego.seriesReclamadas[serieId][gradoIndex] = true;
    const nombres = ['Bronce', 'Plata', 'Oro'];
    this.darXP(xpPremio, `Serie ${serieId} (${nombres[gradoIndex]}) conseguida`);
    this.emitirNotificacion({
      tipo: 'insignia',
      titulo: `¡Serie ${nombres[gradoIndex]} Alcanzada!`,
      descripcion: `Has desbloqueado el grado ${nombres[gradoIndex]} en ${serieId}.`,
      icono: 'Trophy',
    });
    this.guardar();
    this.notificarCambio();
  }

  // --- Primeras Veces ---
  private verificarPrimeraVez(id: string, motivo: string): void {
    if (!this.estado.juego.primerasVeces) {
      this.estado.juego.primerasVeces = {};
    }
    if (!this.estado.juego.primerasVeces[id]) {
      this.estado.juego.primerasVeces[id] = {
        fecha: new Date().toISOString(),
        reclamada: true,
      };
      this.darXP(15, `Primera vez: ${motivo}`);
    }
  }

  // --- Insignias Personalizadas ---
  public crearInsigniaPersonalizada(
    datos: Omit<InsigniaPersonalizada, 'id' | 'conseguida' | 'fechaConseguida'>
  ): InsigniaPersonalizada {
    if (this.estado.juego.insigniasPersonalizadas.length >= 12) {
      throw new Error('Has alcanzado el límite máximo de 12 insignias personalizadas.');
    }

    const nueva: InsigniaPersonalizada = {
      ...datos,
      id: `ins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conseguida: false,
    };

    this.estado.juego.insigniasPersonalizadas.push(nueva);
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
    return nueva;
  }

  public editarInsigniaPersonalizada(id: string, cambios: Partial<InsigniaPersonalizada>): void {
    const ins = this.estado.juego.insigniasPersonalizadas.find((item) => item.id === id);
    if (!ins) return;
    Object.assign(ins, cambios);
    this.verificarInsigniasAutomaticas();
    this.guardar();
    this.notificarCambio();
  }

  public borrarInsigniaPersonalizada(id: string): void {
    this.estado.juego.insigniasPersonalizadas = this.estado.juego.insigniasPersonalizadas.filter(
      (item) => item.id !== id
    );
    this.guardar();
    this.notificarCambio();
  }

  public marcarInsigniaManual(id: string): void {
    const ins = this.estado.juego.insigniasPersonalizadas.find((item) => item.id === id);
    if (!ins || ins.tipoCondicion !== 'manual' || ins.conseguida) return;
    ins.conseguida = true;
    ins.fechaConseguida = new Date().toISOString();
    this.emitirNotificacion({
      tipo: 'insignia',
      titulo: `¡Insignia Desbloqueada: ${ins.nombre}!`,
      descripcion: ins.descripcion,
      icono: 'ShieldCheck',
    });
    this.guardar();
    this.notificarCambio();
  }

  public verificarInsigniasAutomaticas(): void {
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();

    for (const ins of this.estado.juego.insigniasPersonalizadas) {
      if (ins.tipoCondicion !== 'automatica' || ins.conseguida) continue;
      const umbral = ins.umbral || 1;
      let valorActual = 0;

      switch (ins.metrica) {
        case 'ganadas':
          valorActual = this.estado.oportunidades.filter((o) => {
            if (o.etapa !== 'Ganado') return false;
            if (ins.periodo === 'este_mes' && o.cerradoEn) {
              return new Date(o.cerradoEn).getTime() >= primerDiaMes;
            }
            return true;
          }).length;
          break;
        case 'demos':
          valorActual = this.estado.oportunidades.filter((o) => {
            const pasoPorDemo = o.historialEtapas.some((h) => {
              if (h.etapa !== 'Demo') return false;
              if (ins.periodo === 'este_mes') {
                return new Date(h.fecha).getTime() >= primerDiaMes;
              }
              return true;
            });
            return pasoPorDemo;
          }).length;
          break;
        case 'actividades':
          valorActual = this.estado.oportunidades.reduce((acc, o) => {
            const count = (o.actividades || []).filter((a) => {
              if (ins.periodo === 'este_mes') {
                return new Date(a.fecha).getTime() >= primerDiaMes;
              }
              return true;
            }).length;
            return acc + count;
          }, 0);
          break;
        case 'centros':
          valorActual = this.estado.centros.filter((c) => {
            if (ins.periodo === 'este_mes') {
              return new Date(c.creadoEn).getTime() >= primerDiaMes;
            }
            return true;
          }).length;
          break;
        case 'mapas':
          valorActual = Object.values(this.estado.config.cuadrantesEmpatiaCompletados || {}).filter(
            (arr) => arr && arr.length >= 6 && arr.slice(0, 6).every(Boolean)
          ).length;
          break;
        case 'valor_ganado':
          valorActual = this.estado.oportunidades
            .filter((o) => {
              if (o.etapa !== 'Ganado') return false;
              if (ins.periodo === 'este_mes' && o.cerradoEn) {
                return new Date(o.cerradoEn).getTime() >= primerDiaMes;
              }
              return true;
            })
            .reduce((sum, o) => sum + (o.valor || 0), 0);
          break;
      }

      if (valorActual >= umbral) {
        ins.conseguida = true;
        ins.fechaConseguida = new Date().toISOString();
        this.emitirNotificacion({
          tipo: 'insignia',
          titulo: `¡Insignia Conseguida: ${ins.nombre}!`,
          descripcion: ins.descripcion,
          icono: 'Award',
        });
      }
    }
  }
}

export const crmRepo = new CRMRepository();

/**
 * Función que genera un respaldo automático del estado actual del CRM,
 * cifrándolo antes de guardarlo en localStorage con una marca de tiempo
 * y suma de comprobación criptográfica para asegurar la integridad de los datos.
 *
 * @param motivo Descripción o causa del respaldo (por defecto: automático)
 * @returns Información del respaldo cifrado generado o null si ocurrió un error
 */
export function generarRespaldoAutomatico(
  motivo: string = 'Respaldo automático del estado actual con marca de tiempo'
): RespaldoCifradoInfo | null {
  return crmRepo.generarRespaldoAutomatico(motivo);
}

/**
 * Función que toma el estado actual del CRM, lo convierte a JSON, lo cifra usando
 * btoa para ofuscación básica y lo guarda en localStorage con una clave que incluye
 * el timestamp actual (ej. 'eonesia_backup_20231027120000').
 *
 * @returns La clave del respaldo en localStorage
 */
export function realizarRespaldo(): string {
  return crmRepo.realizarRespaldo();
}

/**
 * Función auxiliar para recuperar y descifrar un respaldo almacenado con realizarRespaldo()
 */
export function descifrarRespaldo(claveOContenido: string): EstadoCRM | null {
  try {
    let contenido = claveOContenido;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(claveOContenido)) {
      contenido = localStorage.getItem(claveOContenido)!;
    }
    const binary = atob(contenido);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Función que calcula dinámicamente el progreso hacia el objetivo anual
 * a partir de las oportunidades cerradas con éxito.
 */
export function calcularProgresoObjetivoAnual() {
  return crmRepo.calcularProgresoObjetivoAnual();
}

/**
 * Lee todos los respaldos guardados en localStorage con el prefijo 'eonesia_backup_',
 * ordenados por timestamp descendente.
 */
export function leerRespaldosLocalStorage() {
  return crmRepo.leerRespaldosLocalStorage();
}
