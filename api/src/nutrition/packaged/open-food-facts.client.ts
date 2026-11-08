import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OFF_FIELDS, type OffProduct } from './off.map';

/**
 * Open Food Facts: base abierta y gratuita de productos empacados (licencia ODbL), sin llave.
 * Pide identificarse con un User-Agent propio; se usa la dirección pública de la app (nunca un correo).
 * Límites: unas 15 consultas de producto y 10 búsquedas por minuto; aquí se usa a pedido y se guarda.
 */
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const USER_AGENT = 'NutriFer/1.0 (+https://habitfer.fersuastudio.com)';
const TIMEOUT_MS = 10_000;

/** Lo que el buscador de Open Food Facts entiende como sintaxis se quita de lo que escribe la persona. */
export function cleanSearch(q: string): string {
  return q
    .replace(/[:"()[\]{}^~*?\\/+\-!&|<>=]/g, ' ')
    .replace(/\b(AND|OR|NOT|TO)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

@Injectable()
export class OpenFoodFactsClient {
  private readonly logger = new Logger('OpenFoodFacts');

  private async get(url: string): Promise<Response> {
    try {
      return await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn(`Sin respuesta de Open Food Facts: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No pude consultar Open Food Facts. Revisa la conexión o intenta en un rato.');
    }
  }

  /** El producto con ese código, o null si Open Food Facts no lo tiene. */
  async product(code: string): Promise<OffProduct | null> {
    const res = await this.get(`${PRODUCT_URL}/${code}.json?fields=${OFF_FIELDS}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      this.logger.warn(`Open Food Facts respondió ${res.status} para ${code}`);
      throw new ServiceUnavailableException('Open Food Facts no respondió bien. Intenta en un rato.');
    }
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    return json.status === 1 && json.product ? { ...json.product, code: json.product.code ?? code } : null;
  }

  /** Productos vendidos en Colombia que coinciden con lo escrito (máximo 20). */
  async search(q: string): Promise<OffProduct[]> {
    const terms = cleanSearch(q);
    if (!terms) return [];
    const query = `${terms} countries_tags:"en:colombia"`;
    const res = await this.get(`${SEARCH_URL}?q=${encodeURIComponent(query)}&langs=es&page_size=20&fields=${OFF_FIELDS}`);
    if (!res.ok) {
      this.logger.warn(`El buscador de Open Food Facts respondió ${res.status}`);
      throw new ServiceUnavailableException('El buscador de Open Food Facts no respondió. Intenta en un rato.');
    }
    const json = (await res.json()) as { hits?: OffProduct[] };
    return Array.isArray(json.hits) ? json.hits : [];
  }
}
