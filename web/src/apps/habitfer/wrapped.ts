/**
 * "Tu mes en HabitFer": abrir el resumen desde cualquier pantalla, dibujar la imagen para
 * compartir (1080 x 1920, formato historia) y compartirla o descargarla.
 */
import dayjs from "dayjs";
import "dayjs/locale/es";
import type { MonthSummary } from "../../types";

export const WRAPPED_EVENT = "habitfer:wrapped";

/** Abre el resumen (por defecto: el mes pasado la primera semana del mes, si no el actual). */
export function openWrapped(month?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(WRAPPED_EVENT, { detail: month }));
}

export function defaultWrappedMonth(): string {
  const now = dayjs();
  return (now.date() <= 7 ? now.subtract(1, "month") : now).format("YYYY-MM");
}

export function monthName(month: string): string {
  const name = dayjs(`${month}-01`).locale("es").format("MMMM");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const WEEKDAY_PLURAL = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
export function weekdayPlural(n: number): string {
  return WEEKDAY_PLURAL[n] ?? "";
}

const fmt = (n: number) => n.toLocaleString("es-CO");

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Imagen para compartir con los numeros del mes. */
export async function renderWrappedImage(s: MonthSummary, name: string): Promise<Blob> {
  await Promise.all([
    document.fonts?.load('800 200px "Bricolage Grotesque"'),
    document.fonts?.load('700 40px "DM Sans"'),
  ]).catch(() => undefined);
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) throw new Error("Este navegador no puede crear la imagen");
  const display = '"Bricolage Grotesque", "DM Sans", sans-serif';
  const body = '"DM Sans", sans-serif';

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#22110A");
  bg.addColorStop(0.5, "#0B0908");
  bg.addColorStop(1, "#0B0908");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 30, W / 2, 470, 720);
  glow.addColorStop(0, "rgba(255,122,26,0.42)");
  glow.addColorStop(1, "rgba(255,122,26,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.textAlign = "left";
  g.fillStyle = "#FF7A1A";
  g.font = `700 38px ${body}`;
  g.fillText(`HABITFER · ${monthName(s.month).toUpperCase()} ${s.month.slice(0, 4)}`, 80, 150);
  g.fillStyle = "#F6EEE7";
  g.font = `800 92px ${display}`;
  g.fillText(name ? `El mes de ${name}` : "Mi mes", 80, 260);

  g.textAlign = "center";
  g.font = `800 300px ${display}`;
  g.fillStyle = "#FFFFFF";
  g.fillText(fmt(s.totals.completed), W / 2, 640);
  g.font = `600 52px ${body}`;
  g.fillStyle = "#C9B8AC";
  g.fillText("hábitos cumplidos", W / 2, 720);

  const tiles: [string, string][] = [
    [`${s.totals.rate} %`, "de lo que tocaba"],
    [String(s.totals.perfectDays), s.totals.perfectDays === 1 ? "día perfecto" : "días perfectos"],
    [s.longestStreak ? String(s.longestStreak.days) : "—", "días de mejor racha"],
    [`+${fmt(s.xp)}`, "XP ganada"],
  ];
  tiles.forEach(([big, label], i) => {
    const x = 80 + (i % 2) * 470;
    const y = 820 + Math.floor(i / 2) * 290;
    roundRect(g, x, y, 450, 260, 40);
    g.fillStyle = "rgba(255,236,222,0.06)";
    g.fill();
    g.strokeStyle = "rgba(255,236,222,0.12)";
    g.lineWidth = 2;
    g.stroke();
    g.textAlign = "left";
    g.fillStyle = i === 1 ? "#4FD1E8" : "#FFB347";
    g.font = `800 110px ${display}`;
    g.fillText(big, x + 40, y + 140);
    g.fillStyle = "#C9B8AC";
    g.font = `600 38px ${body}`;
    g.fillText(label, x + 40, y + 205);
  });

  if (s.starHabit) {
    const y = 1430;
    roundRect(g, 80, y, 920, 200, 40);
    g.fillStyle = "rgba(255,122,26,0.12)";
    g.fill();
    g.font = `100px ${body}`;
    g.textAlign = "left";
    // Opaco: el emoji toma la transparencia del fillStyle anterior.
    g.fillStyle = "#FFFFFF";
    g.fillText(s.starHabit.icon?.trim() || "⭐", 120, y + 135);
    g.fillStyle = "#FF7A1A";
    g.font = `700 34px ${body}`;
    g.fillText("HÁBITO ESTRELLA", 270, y + 75);
    g.fillStyle = "#F6EEE7";
    g.font = `800 58px ${display}`;
    const title = s.starHabit.title.length > 22 ? `${s.starHabit.title.slice(0, 21)}…` : s.starHabit.title;
    g.fillText(`${title} · ${s.starHabit.rate} %`, 270, y + 150);
  }

  g.textAlign = "center";
  g.fillStyle = "#8C7D72";
  g.font = `600 36px ${body}`;
  g.fillText("🔥 HabitFer · constancia con flow", W / 2, 1810);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/png"));
}

/** Comparte la imagen (celular) o la descarga (computador). */
export async function shareOrDownload(blob: Blob, fileName: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Mi mes en HabitFer", text });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
