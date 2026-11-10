/** Plata y fechas de FerFinance: pesos colombianos sin centavos, con punto de miles. */

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** «$ 1.500.000». */
export function formatCop(amount: number): string {
  return COP.format(Math.round(amount)).replace(/ /g, " ");
}

/** «+$ 1.500.000» o «−$ 300.000». */
export function formatCopSigned(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return formatCop(0);
  return (rounded > 0 ? "+" : "−") + formatCop(Math.abs(rounded));
}

/** Solo los dígitos con punto de miles, para el campo de plata: 1500000 → «1.500.000». */
export function formatThousands(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const digits = String(value).split(/[.,]/)[0].replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Lee lo que se escribe en un campo de plata. Los puntos (y las comas) de miles se ignoran; unos centavos
 * al final («,50», o «.50» si los miles van con comas) se descartan. «1.500.900» → 1500900.
 */
export function parseMoneyInput(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  let s = raw.trim().replace(/[^\d.,]/g, "");
  if (!s) return null;
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (last >= 0) {
    const sep = s[last];
    const tail = s.slice(last + 1);
    const before = s.slice(0, last);
    const other = sep === "," ? "." : ",";
    if (tail.length >= 1 && tail.length <= 2 && (sep === "," || before.includes(other))) s = before;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Días de `a` a `b` (AAAA-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

/** «vence hoy», «vence mañana», «en 5 días», «vencida hace 9 días». */
export function dueLabel(dueKey: string, todayKey: string): string {
  const d = daysBetween(todayKey, dueKey);
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  if (d > 1) return `en ${d} días`;
  if (d === -1) return "vencida desde ayer";
  return `vencida hace ${-d} días`;
}

/** La fecha `months` meses después, el mismo día o el último del mes (igual que la API). */
export function addMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const yy = first.getUTCFullYear();
  const mm = first.getUTCMonth();
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Cómo quedarían las cuotas de un crédito nuevo (igual que la API): todas iguales y la última con lo que falte. */
export function previewInstallments(total: number, cuota: number, firstKey: string): { count: number; last: number; lastKey: string } | null {
  const t = Math.round(total);
  const c = Math.round(cuota);
  if (!(t >= 1) || !(c >= 1) || c > t || !firstKey) return null;
  const count = Math.ceil(t / c);
  return { count, last: t - c * (count - 1), lastKey: addMonthsKey(firstKey, count - 1) };
}
