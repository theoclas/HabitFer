import { CloseOutlined, LeftOutlined, RightOutlined, ShareAltOutlined } from "@ant-design/icons";
import { Button, Spin, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchMonthRecap } from "../api";
import { kcalText } from "../math";
import type { MonthRecap as Recap } from "../types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthLabel = (m: string) => cap(dayjs(`${m}-01`).format("MMMM [de] YYYY"));
const shortName = (n: string) => n.split(",")[0].trim();
const kg1 = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Las tarjetas del mes (las mismas van en la imagen). */
function cardsOf(r: Recap): { big: string; label: string; small?: string }[] {
  const out: { big: string; label: string; small?: string }[] = [
    { big: String(r.loggedDays), label: `días anotados de ${r.daysInMonth}`, small: r.streak > 1 ? `Racha de ${r.streak} días seguidos` : undefined },
  ];
  // Sin culpa: un «0 días en tu meta» no va en grande; en su lugar, el promedio.
  if (r.inTarget) out.push({ big: String(r.inTarget), label: "días en tu meta", small: r.avgKcal ? `Promedio: ${kcalText(r.avgKcal)} kcal al día` : undefined });
  else if (r.avgKcal) out.push({ big: kcalText(r.avgKcal), label: "kcal al día en promedio", small: r.kcalTarget ? `Tu meta: ${kcalText(r.kcalTarget)}` : undefined });
  if (r.topFood) out.push({ big: shortName(r.topFood.name), label: "lo que más repetiste", small: `${r.topFood.days} ${r.topFood.days === 1 ? "día" : "días"}` });
  if (r.topDish && r.topDish.name !== r.topFood?.name) out.push({ big: shortName(r.topDish.name), label: "tu plato del mes", small: `${r.topDish.times} ${r.topDish.times === 1 ? "vez" : "veces"}` });
  if (r.bestWeek && r.bestWeek.inTarget > 0) {
    out.push({
      big: `${dayjs(r.bestWeek.start).format("D")} al ${dayjs(r.bestWeek.end).format("D MMM").replace(".", "")}`,
      label: "tu mejor semana",
      small: `${r.bestWeek.inTarget} de ${r.bestWeek.logged} días en meta`,
    });
  }
  if (r.weight) out.push({ big: `${r.weight.change > 0 ? "+" : r.weight.change < 0 ? "−" : ""}${kg1(Math.abs(r.weight.change))} kg`, label: "tendencia del peso", small: `${kg1(r.weight.start)} → ${kg1(r.weight.end)} kg` });
  if (r.proteinDays != null && r.proteinDays > 0) out.push({ big: String(r.proteinDays), label: "días llegando a la proteína" });
  if (r.waterDays > 0) out.push({ big: String(r.waterDays), label: "días con la meta de agua" });
  if (r.fasts.reached > 0) out.push({ big: String(r.fasts.reached), label: r.fasts.reached === 1 ? "ayuno cumplido" : "ayunos cumplidos", small: `El más largo: ${kg1(r.fasts.longestHours)} h` });
  return out;
}

/** La imagen para compartir: 1080 × 1920 (historia), con los colores de NutriFer. */
async function renderImage(r: Recap): Promise<Blob> {
  await Promise.all([document.fonts?.load('800 120px "Bricolage Grotesque"'), document.fonts?.load('600 40px "DM Sans"')]).catch(() => undefined);
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
  bg.addColorStop(0, "#0D1A12");
  bg.addColorStop(1, "#163322");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Un sol de aguacate arriba a la derecha.
  const glow = g.createRadialGradient(W - 120, 160, 10, W - 120, 160, 520);
  glow.addColorStop(0, "rgba(93, 190, 133, 0.35)");
  glow.addColorStop(1, "rgba(93, 190, 133, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "#9CCB5A";
  g.font = `700 40px ${body}`;
  g.fillText("TU MES EN COMIDA", 90, 180);
  g.fillStyle = "#EDF3EE";
  g.font = `800 112px ${display}`;
  g.fillText(cap(dayjs(`${r.month}-01`).format("MMMM")), 86, 300);
  g.font = `600 44px ${body}`;
  g.fillStyle = "#97A69C";
  g.fillText(dayjs(`${r.month}-01`).format("YYYY"), 90, 370);

  const cards = cardsOf(r).slice(0, 6);
  let y = 470;
  for (const card of cards) {
    g.fillStyle = "rgba(237, 243, 238, 0.06)";
    g.beginPath();
    g.roundRect(70, y, W - 140, 200, 36);
    g.fill();
    g.fillStyle = "#EDF3EE";
    let size = 92;
    g.font = `800 ${size}px ${display}`;
    while (g.measureText(card.big).width > W - 240 && size > 48) {
      size -= 4;
      g.font = `800 ${size}px ${display}`;
    }
    g.fillText(card.big, 110, y + 105);
    g.fillStyle = "#9CCB5A";
    g.font = `600 38px ${body}`;
    g.fillText(card.label, 112, y + 160);
    if (card.small) {
      g.fillStyle = "#97A69C";
      g.font = `500 32px ${body}`;
      g.textAlign = "right";
      g.fillText(card.small, W - 110, y + 160);
      g.textAlign = "left";
    }
    y += 230;
  }
  g.fillStyle = "#5DBE85";
  g.font = `800 48px ${display}`;
  g.fillText("NutriFer", 90, H - 110);
  g.fillStyle = "#97A69C";
  g.font = `500 32px ${body}`;
  g.fillText("comida colombiana, sin culpa", 90, H - 62);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/png"));
}

type Props = { open: boolean; onClose: () => void };

/** «Tu mes en comida»: lo que más repetiste, los días en meta, tu mejor semana y una imagen para compartir. */
export function MonthRecap({ open, onClose }: Props) {
  const [month, setMonth] = useState(() => (dayjs().date() <= 5 ? dayjs().subtract(1, "month") : dayjs()).format("YYYY-MM"));
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetchMonthRecap(month)
      .then((r) => alive && setRecap(r))
      .catch((err) => alive && message.error(apiErrorMessage(err, "No se pudo cargar el mes")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const current = dayjs().format("YYYY-MM");
  const canPrev = recap?.firstMonth ? month > recap.firstMonth : false;

  const share = async () => {
    if (!recap) return;
    setSharing(true);
    try {
      const blob = await renderImage(recap);
      const file = new File([blob], `nutrifer-${recap.month}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Mi ${monthLabel(recap.month).toLowerCase()} en NutriFer` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        message.success("Imagen descargada");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) message.error("No se pudo crear la imagen");
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <div className="nf-recap" role="dialog" aria-modal="true" aria-label={`Tu mes en comida: ${monthLabel(month)}`}>
      <div className="nf-recap__top">
        <button type="button" className="nf-recap__icon" aria-label="Mes anterior" disabled={!canPrev} onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, "month").format("YYYY-MM"))}>
          <LeftOutlined />
        </button>
        <span className="nf-recap__month">{monthLabel(month)}</span>
        <button type="button" className="nf-recap__icon" aria-label="Mes siguiente" disabled={month >= current} onClick={() => setMonth(dayjs(`${month}-01`).add(1, "month").format("YYYY-MM"))}>
          <RightOutlined />
        </button>
        <button type="button" className="nf-recap__icon nf-recap__close" aria-label="Cerrar" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      <div className="nf-recap__body">
        <p className="nf-recap__kicker">Tu mes en comida</p>
        {loading && !recap ? (
          <Spin />
        ) : !recap || recap.loggedDays === 0 ? (
          <p className="nf-recap__empty">Este mes aún no tiene nada anotado.</p>
        ) : (
          <div className={`nf-recap__cards${loading ? " is-loading" : ""}`}>
            {cardsOf(recap).map((c, i) => (
              <article key={c.label} className="nf-recap__card" style={{ animationDelay: `${i * 70}ms` }}>
                <b>{c.big}</b>
                <span>{c.label}</span>
                {c.small && <small>{c.small}</small>}
              </article>
            ))}
          </div>
        )}
      </div>
      {recap && recap.loggedDays > 0 && (
        <div className="nf-recap__foot">
          <Button type="primary" size="large" icon={<ShareAltOutlined />} loading={sharing} onClick={() => void share()}>
            Compartir imagen
          </Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
