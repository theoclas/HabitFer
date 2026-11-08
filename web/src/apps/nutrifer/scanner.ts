/**
 * Lector de códigos de barras. Usa el del navegador cuando lo trae (Chrome en Android) y, si no
 * (Safari del iPhone, la mayoría de computadores), el de ZXing en WebAssembly, que se baja de la
 * propia app la primera vez que se escanea (unos 900 KB) y queda guardado.
 */
type Found = { rawValue: string; format: string };
export type Detector = { detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<Found[]> };

type NativeCtor = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

/** Solo los códigos de los productos (EAN y UPC): así lee más rápido y no confunde. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

let ready: Promise<Detector> | null = null;

async function load(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      if (supported.includes("ean_13")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch {
      // Sigue con el de ZXing.
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  // El .wasm sale de la app (no de un CDN): funciona aunque el CDN no esté y queda en la caché del teléfono.
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path) },
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

/** El lector listo (se prepara una sola vez). */
export function getDetector(): Promise<Detector> {
  if (!ready) {
    ready = load().catch((err: unknown) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/** Un código de producto válido: de 8 a 14 números. */
export const isProductCode = (v: string) => /^\d{8,14}$/.test(v);
