import { CloseOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fetchMonthSummary } from "../../../api/client";
import { useAuth } from "../../../contexts/AuthContext";
import type { MonthSummary } from "../../../types";
import { prefersReducedMotion } from "../effects";
import { apiErrorMessage, hourRange, moodEmoji, WEEKDAY_LONG } from "../format";
import { defaultWrappedMonth, monthName, renderWrappedImage, shareOrDownload, weekdayPlural } from "../wrapped";
import { Flame, FLAME_STAGES, PERFECT_STAGE } from "./Flame";

type Props = { month?: string; onClose: () => void };
type Tone = "ember" | "blue" | "violet" | "green" | "gold";
type Slide = { key: string; tone: Tone; final?: boolean; body: ReactNode };

/** Numero que sube de 0 a su valor cuando aparece la tarjeta. */
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  useEffect(() => {
    if (prefersReducedMotion() || to <= 0) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1100);
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      {value.toLocaleString("es-CO")}
      {suffix}
    </>
  );
}

function shiftMonth(month: string, n: number): string {
  return dayjs(`${month}-01`).add(n, "month").format("YYYY-MM");
}

/** "sábado 14" */
function dayName(key: string): string {
  const d = dayjs(key);
  return `${WEEKDAY_LONG[(d.day() + 6) % 7]} ${d.date()}`;
}

function buildSlides(s: MonthSummary, name: string): Slide[] {
  const mName = monthName(s.month);
  const prevName = monthName(shiftMonth(s.month, -1)).toLowerCase();
  const empty = s.totals.completed === 0 && s.cleanDays === 0;

  const intro: Slide = {
    key: "intro",
    tone: "ember",
    final: empty,
    body: (
      <>
        <span className="hf-wr__kicker">Tu mes en HabitFer</span>
        <Flame stage={FLAME_STAGES[2]} size={92} glow className="hf-wr__flame" />
        <h2 className="hf-wr__huge">{mName}</h2>
        <p className="hf-wr__sub">
          {empty ? (
            s.complete ? "Este mes no marcaste nada. El que viene es una página en blanco." : "Todavía no hay nada que contar de este mes. ¡A darle!"
          ) : (
            <>
              <b>
                <Count to={s.totals.activeDays} />
              </b>{" "}
              {s.totals.activeDays === 1 ? "día" : "días"} con algo cumplido{s.complete ? "" : ", y el mes sigue"}.
            </>
          )}
        </p>
        {!empty && <span className="hf-wr__tap">Toca para seguir</span>}
      </>
    ),
  };
  if (empty) return [intro];

  const list: Slide[] = [intro];
  const diff = s.previousRate !== null ? s.totals.rate - s.previousRate : null;
  list.push({
    key: "done",
    tone: "ember",
    body: (
      <>
        <span className="hf-wr__kicker">Cumpliste</span>
        <span className="hf-wr__number">
          <Count to={s.totals.completed} />
        </span>
        <p className="hf-wr__label">{s.totals.completed === 1 ? "hábito" : "hábitos"}</p>
        <p className="hf-wr__sub">
          El <b>{s.totals.rate} %</b> de lo que tocaba.
        </p>
        {diff !== null && (
          <span className={`hf-wr__chip${diff > 0 ? " is-up" : diff < 0 ? " is-down" : ""}`}>
            {diff > 0
              ? `▲ ${diff} puntos más que en ${prevName}`
              : diff < 0
                ? `▼ ${-diff} puntos menos que en ${prevName}`
                : `Igual que en ${prevName}`}
          </span>
        )}
      </>
    ),
  });

  if (s.totals.perfectDays > 0) {
    list.push({
      key: "perfect",
      tone: "blue",
      body: (
        <>
          <Flame stage={PERFECT_STAGE} size={84} glow className="hf-wr__flame" />
          <span className="hf-wr__number">
            <Count to={s.totals.perfectDays} />
          </span>
          <p className="hf-wr__label">{s.totals.perfectDays === 1 ? "día perfecto" : "días perfectos"}</p>
          <p className="hf-wr__sub">
            Días en que cumpliste todo lo que tocaba, de {s.totals.days}
            {s.complete ? "" : " que van"}.
          </p>
        </>
      ),
    });
  }

  if (s.starHabit) {
    const star = s.starHabit;
    const others = s.topHabits.filter((h) => h.id !== star.id).slice(0, 2);
    list.push({
      key: "star",
      tone: "gold",
      body: (
        <>
          <span className="hf-wr__kicker">Tu hábito estrella</span>
          <span className="hf-wr__emoji" style={{ "--c": star.color } as CSSProperties} aria-hidden="true">
            {star.icon?.trim() || "⭐"}
          </span>
          <h2 className="hf-wr__title">{star.title}</h2>
          <p className="hf-wr__sub">
            <b>
              <Count to={star.rate} suffix=" %" />
            </b>{" "}
            · {star.completed} {star.completed === 1 ? "vez" : "veces"}
          </p>
          {others.length > 0 && <p className="hf-wr__small">Le siguen {others.map((h) => `${h.title} (${h.rate} %)`).join(" y ")}</p>}
        </>
      ),
    });
  }

  if (s.longestStreak && s.longestStreak.days >= 2) {
    const st = s.longestStreak;
    list.push({
      key: "streak",
      tone: "ember",
      body: (
        <>
          <span className="hf-wr__kicker">Tu racha más larga</span>
          <Flame days={st.days} size={104} glow className="hf-wr__flame" />
          <span className="hf-wr__number">
            <Count to={st.days} />
          </span>
          <p className="hf-wr__label">{st.unit === "weeks" ? "semanas de racha" : "días de racha"}</p>
          <p className="hf-wr__sub">
            con <b>{st.title}</b>
          </p>
        </>
      ),
    });
  }

  if (s.bestWeekday || s.bestHour !== null || s.bestDay) {
    list.push({
      key: "rhythm",
      tone: "violet",
      body: (
        <>
          <span className="hf-wr__kicker">Tu ritmo</span>
          {s.bestWeekday && (
            <div className="hf-wr__fact">
              <b>Los {weekdayPlural(s.bestWeekday.weekday)}</b>
              <span>fueron tu mejor día de la semana ({s.bestWeekday.rate} %)</span>
            </div>
          )}
          {s.bestHour !== null && (
            <div className="hf-wr__fact">
              <b>De {hourRange(s.bestHour)}</b>
              <span>es la hora en que más cumples</span>
            </div>
          )}
          {s.bestDay && (
            <div className="hf-wr__fact">
              <b>El {dayName(s.bestDay.date)}</b>
              <span>
                fue tu mejor día: {s.bestDay.completed} {s.bestDay.completed === 1 ? "hábito" : "hábitos"}
              </span>
            </div>
          )}
        </>
      ),
    });
  }

  if (s.cleanDays > 0 || s.challengesWon.length > 0 || s.moodAverage !== null) {
    list.push({
      key: "extras",
      tone: "green",
      body: (
        <>
          <span className="hf-wr__kicker">Y además</span>
          {s.cleanDays > 0 && (
            <div className="hf-wr__fact">
              <b>
                {s.cleanDays} {s.cleanDays === 1 ? "día limpio" : "días limpio"}
              </b>
              <span>en lo que estás dejando</span>
            </div>
          )}
          {s.challengesWon.map((c) => (
            <div key={c.id} className="hf-wr__fact">
              <b>🏁 Reto de {c.days} días</b>
              <span>{c.title}: cumplido</span>
            </div>
          ))}
          {s.moodAverage !== null && (
            <div className="hf-wr__fact">
              <b>
                {moodEmoji(s.moodAverage)} {s.moodAverage.toLocaleString("es-CO")} de 5
              </b>
              <span>fue tu ánimo promedio</span>
            </div>
          )}
        </>
      ),
    });
  }

  list.push({
    key: "xp",
    tone: "gold",
    body: (
      <>
        <span className="hf-wr__kicker">Experiencia</span>
        <span className="hf-wr__number">
          +<Count to={s.xp} />
        </span>
        <p className="hf-wr__label">XP</p>
        <p className="hf-wr__sub">
          {s.levelEnd > s.levelStart ? (
            <>
              Subiste del nivel <b>{s.levelStart}</b> al <b>{s.levelEnd}</b>.
            </>
          ) : (
            <>
              Vas en el nivel <b>{s.levelEnd}</b>.
            </>
          )}
        </p>
      </>
    ),
  });

  list.push({
    key: "final",
    tone: "ember",
    final: true,
    body: (
      <>
        <span className="hf-wr__kicker">{s.complete ? `${mName} en una imagen` : `${mName}, hasta hoy`}</span>
        <div className="hf-wr__card">
          <span className="hf-wr__card-top">
            <Flame stage={FLAME_STAGES[1]} size={18} glow /> {name ? `El mes de ${name}` : "Mi mes"} · {mName}
          </span>
          <b className="hf-wr__card-big">{s.totals.completed.toLocaleString("es-CO")}</b>
          <small>hábitos cumplidos · {s.totals.rate} %</small>
          <div className="hf-wr__card-row">
            <span>
              <b>{s.totals.perfectDays}</b> perfectos
            </span>
            <span>
              <b>{s.longestStreak?.days ?? 0}</b> de racha
            </span>
            <span>
              <b>+{s.xp.toLocaleString("es-CO")}</b> XP
            </span>
          </div>
        </div>
      </>
    ),
  });
  return list;
}

/** "Tu mes en HabitFer": tarjetas a pantalla completa, como historias, y una imagen para compartir. */
export function MonthWrapped({ month: initial, onClose }: Props) {
  const { user } = useAuth();
  const name = user?.fullName?.trim().split(/\s+/)[0] ?? "";
  const [month, setMonth] = useState(initial ?? defaultWrappedMonth());
  const [data, setData] = useState<MonthSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ t: number; timer: number } | null>(null);
  const thisMonth = dayjs().format("YYYY-MM");

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    setIndex(0);
    fetchMonthSummary(month)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [month]);

  const slides = useMemo(() => (data ? buildSlides(data, name) : []), [data, name]);
  const last = Math.max(0, slides.length - 1);
  const slide = slides[Math.min(index, last)];
  const next = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Foco en el resumen y sin scroll detras; al cerrar, el foco vuelve a donde estaba.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && !(e.target as HTMLElement).closest("button")) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Tocar a la izquierda vuelve, a la derecha sigue; mantener presionado pausa. Toda la pantalla
  // cuenta (en el computador la tarjeta queda al centro), menos los botones.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const timer = window.setTimeout(() => setPaused(true), 220);
    press.current = { t: performance.now(), timer };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    setPaused(false);
    if (performance.now() - p.t > 220) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };
  const onPointerCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPaused(false);
  };

  const share = async () => {
    if (!data) return;
    setSharing(true);
    try {
      const blob = await renderWrappedImage(data, name);
      const res = await shareOrDownload(
        blob,
        `habitfer-${data.month}.png`,
        `Mi ${monthName(data.month).toLowerCase()} en HabitFer: ${data.totals.completed} hábitos cumplidos 🔥`,
      );
      if (res === "downloaded") message.success("Imagen guardada en tus descargas");
    } catch (err) {
      message.error(err instanceof Error ? err.message : apiErrorMessage(err, "No se pudo crear la imagen"));
    } finally {
      setSharing(false);
    }
  };

  const canPrevMonth = data ? month > data.firstMonth : false;
  const canNextMonth = month < thisMonth;
  const label = `${monthName(month)} ${month.slice(0, 4)}`;

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      className={`hf-wrapped hf-wrapped--${slide?.tone ?? "ember"}${paused ? " is-paused" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Tu mes en HabitFer: ${label}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
    >
      <div className="hf-wrapped__bars" aria-hidden="true">
        {slides.map((s, i) => (
          <i key={s.key} className={i < index || (i === index && s.final) ? "is-done" : ""}>
            {i === index && !s.final && <em key={`${month}-${index}`} onAnimationEnd={next} />}
          </i>
        ))}
      </div>
      <button type="button" className="hf-wrapped__close" aria-label="Cerrar" onClick={onClose}>
        <CloseOutlined />
      </button>
      {data && slide && (
        <>
          <button type="button" className="hf-wrapped__nav hf-wrapped__nav--prev" aria-label="Tarjeta anterior" disabled={index === 0} onClick={prev}>
            <LeftOutlined />
          </button>
          <button type="button" className="hf-wrapped__nav hf-wrapped__nav--next" aria-label="Tarjeta siguiente" disabled={index >= last} onClick={next}>
            <RightOutlined />
          </button>
        </>
      )}

      <div className="hf-wrapped__stage">
        {!data || !slide ? (
          <div className="hf-wr__slide">
            {failed ? (
              <p className="hf-wr__sub">No se pudo cargar el resumen. Revisa tu conexión e inténtalo otra vez.</p>
            ) : (
              <Flame stage={FLAME_STAGES[1]} size={64} glow className="hf-wr__loading" />
            )}
          </div>
        ) : (
          <div key={`${month}-${slide.key}`} className="hf-wr__slide" aria-live="polite">
            {slide.body}
          </div>
        )}
      </div>

      {data && slide && (
        <div className="hf-wrapped__foot">
          {slide.final ? (
            <div className="hf-wrapped__actions">
              {data.totals.completed > 0 && (
                <button type="button" className="hf-wrapped__share" disabled={sharing} onClick={() => void share()}>
                  {sharing ? "Creando la imagen…" : "Compartir imagen"}
                </button>
              )}
              {index > 0 && (
                <button type="button" className="hf-wrapped__again" onClick={() => setIndex(0)}>
                  Ver otra vez
                </button>
              )}
            </div>
          ) : (
            <span className="hf-wrapped__hint">{paused ? "En pausa" : "Toca a los lados para avanzar · mantén presionado para pausar"}</span>
          )}
          <div className="hf-wrapped__months">
            <button type="button" aria-label="Mes anterior" disabled={!canPrevMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
              <LeftOutlined />
            </button>
            <span>{label}</span>
            <button type="button" aria-label="Mes siguiente" disabled={!canNextMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
              <RightOutlined />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
