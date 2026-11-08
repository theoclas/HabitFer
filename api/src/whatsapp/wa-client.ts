import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** offline: el servicio wa no responde (o falta WA_TOKEN). */
export type WaState = 'starting' | 'qr' | 'connecting' | 'open' | 'idle' | 'error' | 'offline';
export type WaStatus = { state: WaState; me: string | null; qr: string | null; error: string | null };

const OFFLINE = (error: string): WaStatus => ({ state: 'offline', me: null, qr: null, error });

/**
 * Cliente del servicio `wa` (carpeta wa/ del repo): el celular vinculado que envía los avisos.
 * Habla por la red interna de Docker con el token WA_TOKEN. Sin token, WhatsApp queda apagado.
 */
@Injectable()
export class WaClient {
  private readonly logger = new Logger(WaClient.name);
  private readonly url: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('WA_URL')?.trim() || 'http://wa:4010').replace(/\/+$/, '');
    this.token = config.get<string>('WA_TOKEN')?.trim() ?? '';
    if (!this.token) this.logger.log('Avisos por WhatsApp apagados: falta WA_TOKEN');
  }

  get enabled(): boolean {
    return this.token !== '';
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = 10_000) {
    const res = await fetch(this.url + path, {
      method,
      headers: { 'x-wa-token': this.token, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data };
  }

  private async state(method: 'GET' | 'POST', path: string): Promise<WaStatus> {
    if (!this.enabled) return OFFLINE('Falta WA_TOKEN en el servidor.');
    try {
      const { data } = await this.call<WaStatus>(method, path);
      return data && typeof data.state === 'string' ? data : OFFLINE('El servicio de WhatsApp no respondió bien.');
    } catch {
      return OFFLINE('El servicio de WhatsApp no responde.');
    }
  }

  status() {
    return this.state('GET', '/status');
  }

  /** Vuelve a pedir un QR si el servicio estaba en pausa. */
  start() {
    return this.state('POST', '/start');
  }

  /** Desvincula el celular que envía. */
  logout() {
    return this.state('POST', '/logout');
  }

  /** true/false si se pudo revisar; null si no (celular sin conectar o servicio caído). */
  async exists(phone: string): Promise<boolean | null> {
    if (!this.enabled) return null;
    try {
      const { status, data } = await this.call<{ exists?: boolean }>('POST', '/check', { to: phone });
      return status === 200 && typeof data?.exists === 'boolean' ? data.exists : null;
    } catch {
      return null;
    }
  }

  /** Envía un mensaje. Nunca lanza. */
  async send(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled) return { ok: false, error: 'Falta WA_TOKEN en el servidor.' };
    try {
      // El servicio pone los mensajes en fila con una pausa entre uno y otro: se espera más.
      const { status, data } = await this.call<{ ok?: boolean; error?: string }>('POST', '/send', { to: phone, text }, 90_000);
      if (status === 200 && data?.ok) return { ok: true };
      return { ok: false, error: data?.error ?? `respuesta ${status}` };
    } catch (err) {
      return { ok: false, error: (err as Error).name === 'TimeoutError' ? 'WhatsApp tardó demasiado.' : 'El servicio de WhatsApp no responde.' };
    }
  }
}
