import dayjs from "dayjs";
import type { CSSProperties } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayStat, LevelInfo, RankingRow, StatsRange } from "../../../types";
import { habitEmoji } from "../../../features/habits/habitUtils";
import { fmtInt, hourRange, moodEmoji, WEEKDAY_LONG, WEEKDAY_SHORT } from "../format";
import { StreakChip } from "./Flame";

/* ---------- Nivel ---------- */

export function LevelBar({ level, compact = false }: { level: LevelInfo; compact?: boolean }) {
  const span = Math.max(1, level.nextLevelXp - level.levelStartXp);
  const pct = Math.max(0, Math.min(100, ((level.xp - level.levelStartXp) / span) * 100));
  const missing = level.nextLevelXp - level.xp;
  return (
    <div className={`hf-level${compact ? " hf-level--compact" : ""}`}>
      <div className="hf-level__top">
        <b>
          Nivel {level.level} · {level.title}
        </b>
        {!compact && (
          <span>
            {fmtInt(level.xp)} / {fmtInt(level.nextLevelXp)} XP
          </span>
        )}
      </div>
      <div className="hf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Avance al siguiente nivel">
        <i style={{ width: `${pct}%` }} />
      </div>
      <small>
        {level.todayXp > 0 ? <em>+{fmtInt(level.todayXp)} XP hoy</em> : "Aún sin XP hoy"}
        {!compact && ` · te faltan ${fmtInt(missing)} XP para el nivel ${level.level + 1}`}
      </small>
    </div>
  );
}

/* ---------- Tendencia ---------- */

type TrendPoint = { label: string; rate: number | null; detail: string };

export function trendData(days: DayStat[], weekly: boolean): TrendPoint[] {
  if (!weekly) {
    return days.map((d) => ({
      label: dayjs(d.date).format(days.length <= 7 ? "ddd" : "D MMM"),
      rate: d.scheduled ? d.rate : null,
      detail: d.scheduled ? `${dayjs(d.date).format("ddd D MMM")} · ${d.completed} de ${d.scheduled}` : `${dayjs(d.date).format("ddd D MMM")} · nada programado`,
    }));
  }
  const weeks = new Map<string, { s: number; c: number }>();
  for (const d of days) {
    const date = dayjs(d.date);
    const monday = date.subtract((date.day() + 6) % 7, "day").format("YYYY-MM-DD");
    const w = weeks.get(monday) ?? { s: 0, c: 0 };
    w.s += d.scheduled;
    w.c += d.completed;
    weeks.set(monday, w);
  }
  return [...weeks].map(([monday, w]) => ({
    label: dayjs(monday).format("D MMM"),
    rate: w.s ? Math.round((w.c / w.s) * 100) : null,
    detail: `Semana del ${dayjs(monday).format("D MMM")} · ${w.c} de ${w.s}`,
  }));
}

function TrendTip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="hf-tip">
      <b>{p.rate === null ? "—" : `${p.rate} %`}</b>
      <span>{p.detail}</span>
    </div>
  );
}

export function TrendChart({ days, weekly }: { days: DayStat[]; weekly: boolean }) {
  const data = trendData(days, weekly);
  return (
    <div style={{ width: "100%", height: 210 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="hfTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--hf-ember)", stopOpacity: 0.42 }} />
              <stop offset="100%" style={{ stopColor: "var(--hf-ember)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--hf-line)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--hf-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={22}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) => `${v} %`}
            tick={{ fill: "var(--hf-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<TrendTip />} cursor={{ stroke: "var(--hf-line-strong)" }} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--hf-ember)"
            strokeWidth={2.2}
            fill="url(#hfTrendFill)"
            dot={data.length <= 31 ? { r: 2.5, fill: "var(--hf-ember)", strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: "var(--hf-ember)", stroke: "var(--hf-bg)", strokeWidth: 2 }}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Por dia de la semana ---------- */

export function WeekdayBars({ rows, color }: { rows: StatsRange["byWeekday"]; color?: string }) {
  const active = rows.filter((r) => r.scheduled > 0);
  const best = active.length ? active.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;
  const distinct = best && worst && best.rate !== worst.rate;
  return (
    <>
      <div className="hf-wd">
        {rows.map((r, i) => {
          const isBest = distinct && r === best;
          const isWorst = distinct && r === worst;
          return (
            <div key={r.weekday} className={`hf-wd__col${isBest ? " is-best" : ""}${isWorst ? " is-worst" : ""}`}>
              <span className="hf-wd__val">{r.scheduled ? `${r.rate}%` : "—"}</span>
              <div className="hf-wd__track">
                <i style={{ height: `${r.scheduled ? Math.max(3, r.rate) : 0}%`, ...(color && !isWorst ? { background: color } : {}) } as CSSProperties} />
              </div>
              <span className="hf-wd__lab">{WEEKDAY_SHORT[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="hf-note">
        {distinct && best && worst ? (
          <>
            Tu mejor día es el <b>{WEEKDAY_LONG[best.weekday - 1]}</b> ({best.rate} %); el más difícil, el <b>{WEEKDAY_LONG[worst.weekday - 1]}</b> ({worst.rate} %).
          </>
        ) : active.length ? (
          "Vas parejo toda la semana."
        ) : (
          "Todavía no hay días con hábitos en este rango."
        )}
      </p>
    </>
  );
}

/* ---------- Por hora ---------- */

export function HourBars({ hours }: { hours: number[] }) {
  const total = hours.reduce((s, x) => s + x, 0);
  const max = Math.max(...hours);
  const peak = hours.indexOf(max);
  if (total < 3) {
    return <p className="hf-note">Cuando marques tus hábitos el mismo día que los haces, aquí aparece la hora en que sueles cumplir.</p>;
  }
  return (
    <>
      <div className="hf-hours" role="img" aria-label={`Hora pico ${hourRange(peak)}`}>
        {hours.map((n, h) => (
          <i key={h} className={h === peak ? "is-peak" : undefined} style={{ height: `${n ? Math.max(6, (n / max) * 100) : 3}%` }} title={`${hourRange(h)}: ${n}`} />
        ))}
      </div>
      <div className="hf-hours__axis">
        <span>12 a. m.</span>
        <span>6 a. m.</span>
        <span>12 p. m.</span>
        <span>6 p. m.</span>
      </div>
      <p className="hf-note">
        Hora pico: <b>{hourRange(peak)}</b> · {max} {max === 1 ? "vez" : "veces"} de {total}
      </p>
    </>
  );
}

/* ---------- Ranking ---------- */

export function RankingList({ rows, onOpen }: { rows: RankingRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return <p className="hf-note">Sin hábitos en este rango.</p>;
  return (
    <div className="hf-rank">
      {rows.map((r, i) => (
        <button key={r.id} type="button" className="hf-rank__row" onClick={() => onOpen(r.id)} style={{ "--c": r.color } as CSSProperties}>
          <span className="hf-rank__pos">{i + 1}</span>
          <span className="hf-rank__emoji" aria-hidden="true">
            {habitEmoji(r.icon)}
          </span>
          <span className="hf-rank__main">
            <span className="hf-rank__title">{r.title}</span>
            <span className="hf-rank__bar">
              <i style={{ width: `${r.rate}%` }} />
            </span>
          </span>
          <span className="hf-rank__val">
            <b>{r.scheduled ? `${r.rate} %` : "—"}</b>
            <span>
              {r.completed} de {r.scheduled}
            </span>
          </span>
          {r.streakEnabled && r.currentStreak > 0 ? <StreakChip days={r.currentStreak} /> : <span />}
        </button>
      ))}
    </div>
  );
}

/* ---------- Animo ---------- */

export function MoodSummaryCard({ mood }: { mood: StatsRange["mood"] }) {
  if (mood.entries === 0) {
    return <p className="hf-note">Registra tu ánimo al final del día en Hoy y aquí verás cómo se cruza con tu constancia.</p>;
  }
  return (
    <div className="hf-mood-sum">
      <div className="hf-mood-sum__avg">
        <span aria-hidden="true">{moodEmoji(mood.average)}</span>
        <div>
          <b>{mood.average?.toLocaleString("es-CO")} / 5</b>
          <small>
            promedio en {mood.entries} {mood.entries === 1 ? "día" : "días"}
          </small>
        </div>
      </div>
      <p className="hf-note">
        {mood.highRate !== null && mood.lowRate !== null ? (
          <>
            Con buen ánimo cumples el <b>{mood.highRate} %</b>; con ánimo bajo, el <b>{mood.lowRate} %</b>.
          </>
        ) : mood.highRate !== null ? (
          <>
            En tus días buenos cumples el <b>{mood.highRate} %</b>.
          </>
        ) : mood.lowRate !== null ? (
          <>
            En tus días difíciles cumples el <b>{mood.lowRate} %</b>.
          </>
        ) : (
          "Con unos días más registrados aparece el cruce con tu constancia."
        )}
      </p>
    </div>
  );
}
