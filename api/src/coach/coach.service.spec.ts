import Anthropic from '@anthropic-ai/sdk';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CoachContext } from './coach-context';
import { COACH_MODEL, COACH_SYSTEM } from './coach.prompt';
import { CoachService } from './coach.service';

// Pruebas sin red ni costo: el cliente de Anthropic se reemplaza por uno falso.
const context = { nombre: 'Fer', semana: '2 al 8 de noviembre' } as unknown as CoachContext;
type Answer = { text: string; inputTokens: number; outputTokens: number };

function configWith(key?: string) {
  return { get: (name: string) => (name === 'ANTHROPIC_API_KEY' ? key : undefined) } as unknown as ConfigService;
}

function serviceWith(create: jest.Mock) {
  const service = new CoachService({} as never, {} as never, configWith('sk-ant-prueba'), {} as never, {} as never);
  (service as unknown as { client: unknown }).client = { beta: { messages: { create } } };
  return service;
}

const ask = (service: CoachService) => (service as unknown as { ask: (c: CoachContext) => Promise<Answer> }).ask(context);

describe('CoachService.ask', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it('pide a Claude con el modelo, el sistema y el respaldo del servidor, y junta el texto', async () => {
    const create = jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: ' Hola Fer. ' },
        { type: 'text', text: 'Sigue así.' },
      ],
      usage: { input_tokens: 900, output_tokens: 120 },
    });
    const answer = await ask(serviceWith(create));
    expect(answer).toEqual({ text: 'Hola Fer. \nSigue así.', inputTokens: 900, outputTokens: 120 });

    const body = create.mock.calls[0][0];
    expect(body).toMatchObject({
      model: COACH_MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: COACH_SYSTEM,
    });
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toContain('"nombre":"Fer"');
  });

  it('si Claude declina, responde 503', async () => {
    const create = jest.fn().mockResolvedValue({ stop_reason: 'refusal', content: [], usage: { input_tokens: 10, output_tokens: 0 } });
    await expect(ask(serviceWith(create))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('si no llega texto, responde 503', async () => {
    const create = jest.fn().mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '   ' }], usage: { input_tokens: 10, output_tokens: 1 } });
    await expect(ask(serviceWith(create))).rejects.toThrow('El coach se quedó sin palabras. Intenta más tarde.');
  });

  it('limite de uso: 503 con un mensaje claro', async () => {
    const create = jest.fn().mockRejectedValue(new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers()));
    await expect(ask(serviceWith(create))).rejects.toThrow('El coach está ocupado. Intenta en unos minutos.');
  });

  it('llave invalida: 503 sin mostrar detalles', async () => {
    const create = jest.fn().mockRejectedValue(new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', new Headers()));
    await expect(ask(serviceWith(create))).rejects.toThrow('El coach no está bien configurado en el servidor.');
  });

  it('sin conexion: 503', async () => {
    const create = jest.fn().mockRejectedValue(new Anthropic.APIConnectionError({ message: 'fetch failed' }));
    await expect(ask(serviceWith(create))).rejects.toThrow('No se pudo contactar al coach. Intenta en unos minutos.');
  });

  it('sin ANTHROPIC_API_KEY el coach queda apagado', async () => {
    const service = new CoachService({} as never, {} as never, configWith(undefined), {} as never, {} as never);
    expect(service.enabled).toBe(false);
    await expect(ask(service)).rejects.toThrow('El coach no está activado en este servidor.');
  });
});
