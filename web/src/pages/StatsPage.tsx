import { TrophyOutlined } from "@ant-design/icons";
import { Button, Segmented, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchHabits, fetchStatsOverview, fetchStatsRange, fetchTaskStats } from "../api/client";
import { Flame, PERFECT_STAGE } from "../apps/habitfer/components/Flame";
import {
  HourBars,
  LevelBar,
  MoodSummaryCard,
  RankingList,
  TrendChart,
  WeekdayBars,
} from "../apps/habitfer/components/StatsWidgets";
import { YearHeatmap } from "../apps/habitfer/components/YearHeatmap";
import { fmtInt } from "../apps/habitfer/format";
import type { DayStat, StatsOverview, StatsRange, TaskStatsSummary } from "../types";

type RangeDays = 7 | 30 | 365;

const RANGE_LABEL: Record<RangeDays, string> = {
  7: "últimos 7 días",
  30: "últimos 30 días",
  365: "último año",
};

function Panel({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="hf-panel">
      <div className="hf-panel__head">
        <h2>{title}</h2>
        {hint ? <span>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="hf-kpi">
      <span className="hf-kpi__label">{label}</span>
      <span className="hf-kpi__value">
        {icon}
        {value}
      </span>
      {sub ? <span className="hf-kpi__sub">{sub}</span> : null}
    </div>
  );
}

const TIP_STYLE = {
  background: "var(--hf-elevated)",
  border: "1px solid var(--hf-line-strong)",
  borderRadius: 12,
  color: "var(--hf-fg)",
};

export function StatsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeDays>(30);
  const [rangeData, setRangeData] = useState<StatsRange | null>(null);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStatsSummary | null>(null);
  const [year, setYear] = useState(() => dayjs().year());
  const [yearDays, setYearDays] = useState<DayStat[] | null>(null);
  const [minYear, setMinYear] = useState(() => dayjs().year());

  useEffect(() => {
    fetchStatsOverview().then(setOverview).catch(() => message.error("No se pudo cargar el resumen"));
    fetchTaskStats().then(setTaskStats).catch(() => undefined);
    fetchHabits()
      .then((hs) => {
        const years = hs.map((h) => dayjs(h.createdAt).year());
        if (years.length) setMinYear(Math.min(...years));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const today = dayjs();
    fetchStatsRange({ from: today.subtract(range - 1, "day").format("YYYY-MM-DD"), to: today.format("YYYY-MM-DD") })
      .then((d) => !cancelled && setRangeData(d))
      .catch(() => !cancelled && message.error("No se pudieron cargar las estadísticas"));
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setYearDays(null);
    fetchStatsRange({ from: `${year}-01-01`, to: `${year}-12-31` })
      .then((d) => !cancelled && setYearDays(d.days))
      .catch(() => !cancelled && setYearDays([]));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const openHabit = (id: string) => navigate(`/app/habitfer/habits/${id}`, { viewTransition: true });
  const totals = rangeData?.totals;
  const rangeLabel = RANGE_LABEL[range];
  const tasksWeekly = useMemo(() => taskStats?.weeklyCompleted ?? [], [taskStats]);

  return (
    <div className="hf-stats">
      <div className="hf-page-head" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <Segmented<RangeDays>
          value={range}
          onChange={(v) => setRange(v)}
          options={[
            { label: "Semana", value: 7 },
            { label: "Mes", value: 30 },
            { label: "Año", value: 365 },
          ]}
        />
        <Button icon={<TrophyOutlined />} onClick={() => navigate("/app/habitfer/logros", { viewTransition: true })}>
          Logros
        </Button>
      </div>

      {overview ? (
        <section className="hf-panel">
          <LevelBar level={overview.habits.level} />
        </section>
      ) : (
        <div className="hf-skel" style={{ height: 92, marginBottom: 14 }} aria-hidden="true" />
      )}

      <div className="hf-kpis">
        <Kpi
          label="Cumplimiento"
          value={totals ? `${totals.rate} %` : "—"}
          sub={totals ? `${fmtInt(totals.completed)} de ${fmtInt(totals.scheduled)} · ${rangeLabel}` : rangeLabel}
        />
        <Kpi label="Días perfectos" value={totals ? totals.perfectDays : "—"} sub={rangeLabel} />
        <Kpi
          label="Racha perfecta"
          value={overview ? overview.habits.perfectStreak : "—"}
          icon={overview && overview.habits.perfectStreak > 0 ? <Flame stage={PERFECT_STAGE} size={22} glow /> : undefined}
          sub="días seguidos"
        />
        <Kpi label="Perfectos en total" value={overview ? overview.habits.perfectDaysTotal : "—"} sub="desde el inicio" />
      </div>

      <Panel title="Tu año" hint="azul = día perfecto">
        <YearHeatmap year={year} days={yearDays} mode="global" minYear={minYear} onYearChange={setYear} />
      </Panel>

      <Panel title="Cumplimiento" hint={range === 365 ? "promedio por semana" : "día a día"}>
        {rangeData ? <TrendChart days={rangeData.days} weekly={range === 365} /> : <div className="hf-skel" style={{ height: 210 }} />}
      </Panel>

      <div className="hf-grid2">
        <Panel title="Por día de la semana" hint={rangeLabel}>
          {rangeData ? <WeekdayBars rows={rangeData.byWeekday} /> : <div className="hf-skel" style={{ height: 150 }} />}
        </Panel>
        <Panel title="A qué hora cumples" hint={rangeLabel}>
          {rangeData ? <HourBars hours={rangeData.byHour} /> : <div className="hf-skel" style={{ height: 150 }} />}
        </Panel>
      </div>

      <Panel title="Ranking de hábitos" hint={rangeLabel}>
        {rangeData ? <RankingList rows={rangeData.ranking} onOpen={openHabit} /> : <div className="hf-skel" style={{ height: 180 }} />}
      </Panel>

      <div className="hf-grid2">
        <Panel title="Ánimo y constancia" hint={rangeLabel}>
          {rangeData ? <MoodSummaryCard mood={rangeData.mood} /> : <div className="hf-skel" style={{ height: 90 }} />}
        </Panel>
        <Panel title="Tareas completadas" hint="últimas 4 semanas">
          {taskStats ? (
            <div style={{ width: "100%", height: 170 }}>
              <ResponsiveContainer>
                <BarChart data={tasksWeekly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--hf-line)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--hf-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--hf-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: "var(--hf-line)" }} />
                  <Bar dataKey="completed" name="Completadas" fill="var(--hf-blue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="hf-skel" style={{ height: 170 }} />
          )}
        </Panel>
      </div>
    </div>
  );
}
