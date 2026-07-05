import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

fs.appendFileSync(path.join(root, "web/src/types.ts"), `

export type StatsOverview = {
  habits: {
    active: number;
    weekCompletionRate: number;
    daily: { date: string; label: string; scheduled: number; completed: number; rate: number }[];
    topStreaks: { id: string; title: string; color: string; currentStreak: number; longestStreak: number }[];
  };
  tasks: {
    open: number;
    completedThisWeek: number;
    daily: { date: string; label: string; completed: number }[];
  };
};

export type HabitStatsDetail = {
  id: string;
  title: string;
  color: string;
  streakEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;
  calendar: { date: string; scheduled: boolean; completed: boolean }[];
};

export type TaskStatsSummary = {
  byStatus: { todo: number; inProgress: number; done: number };
  byPriorityOpen: { high: number; medium: number; low: number };
  weeklyCompleted: { label: string; completed: number }[];
};
`, "utf8");

fs.appendFileSync(path.join(root, "web/src/api/client.ts"), `

import type { HabitStatsDetail, StatsOverview, TaskStatsSummary } from "../types";

export async function fetchStatsOverview() {
  const { data } = await api.get<StatsOverview>("/stats/overview");
  return data;
}

export async function fetchHabitStats(id: string) {
  const { data } = await api.get<HabitStatsDetail>("/stats/habits/" + id);
  return data;
}

export async function fetchTaskStats() {
  const { data } = await api.get<TaskStatsSummary>("/stats/tasks");
  return data;
}
`, "utf8");

w("web/src/features/stats/HabitHeatmap.tsx", `import { Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import type { HabitStatsDetail } from "../../types";

type Props = { data: HabitStatsDetail["calendar"] };

export function HabitHeatmap({ data }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {data.map((d) => {
        const bg = !d.scheduled ? "#1e293b" : d.completed ? "#22d3ee" : "#334155";
        return (
          <Tooltip key={d.date} title={dayjs(d.date).format("DD MMM") + (d.scheduled ? (d.completed ? " - Hecho" : " - Pendiente") : " - No programado")}>
            <div style={{ aspectRatio: "1", borderRadius: 6, background: bg, border: "1px solid #475569" }} />
          </Tooltip>
        );
      })}
    </div>
  );
}
`);

w("web/src/pages/StatsPage.tsx", `import { FireOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Row, Select, Spin, Statistic, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchHabitStats, fetchHabits, fetchStatsOverview, fetchTaskStats } from "../api/client";
import { HabitHeatmap } from "../features/stats/HabitHeatmap";
import type { Habit, HabitStatsDetail, StatsOverview, TaskStatsSummary } from "../types";

export function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStatsSummary | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitDetail, setHabitDetail] = useState<HabitStatsDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, t, h] = await Promise.all([fetchStatsOverview(), fetchTaskStats(), fetchHabits()]);
      setOverview(o);
      setTaskStats(t);
      setHabits(h);
      if (h.length && !selectedHabitId) setSelectedHabitId(h[0].id);
    } catch {
      message.error("No se pudieron cargar estadisticas");
    } finally {
      setLoading(false);
    }
  }, [selectedHabitId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedHabitId) {
      setHabitDetail(null);
      return;
    }
    void fetchHabitStats(selectedHabitId)
      .then(setHabitDetail)
      .catch(() => message.error("No se pudo cargar detalle del habito"));
  }, [selectedHabitId]);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!overview || !taskStats) return <Empty description="Sin datos" />;

  const statusChart = [
    { name: "Pendiente", value: taskStats.byStatus.todo },
    { name: "En progreso", value: taskStats.byStatus.inProgress },
    { name: "Hechas", value: taskStats.byStatus.done },
  ];

  return (
    <div>
      <Typography.Title level={2}>Estadisticas</Typography.Title>

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Habitos activos" value={overview.habits.active} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Cumplimiento semanal" value={overview.habits.weekCompletionRate} suffix="%" /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Tareas abiertas" value={overview.tasks.open} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Tareas hechas (7d)" value={overview.tasks.completedThisWeek} /></Card>
        </Col>
      </Row>

      <Card title="Habitos - ultimos 7 dias" style={{ marginTop: 16 }}>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={overview.habits.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" name="Completados" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              <Bar dataKey="scheduled" name="Programados" fill="#475569" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Mejores rachas" style={{ marginTop: 16 }}>
        {overview.habits.topStreaks.length === 0 ? (
          <Empty description="Sin rachas activas" />
        ) : (
          overview.habits.topStreaks.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #334155" }}>
              <Typography.Text><span style={{ color: h.color, marginRight: 8 }}>●</span>{h.title}</Typography.Text>
              <Typography.Text><FireOutlined style={{ color: "#f97316" }} /> {h.currentStreak}d (mejor {h.longestStreak})</Typography.Text>
            </div>
          ))
        )}
      </Card>

      <Card title="Detalle por habito (30 dias)" style={{ marginTop: 16 }}>
        <Select
          style={{ width: "100%", marginBottom: 16 }}
          value={selectedHabitId ?? undefined}
          onChange={setSelectedHabitId}
          options={habits.map((h) => ({ value: h.id, label: h.title }))}
        />
        {habitDetail ? (
          <>
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="Racha" value={habitDetail.currentStreak} /></Col>
              <Col span={8}><Statistic title="Mejor racha" value={habitDetail.longestStreak} /></Col>
              <Col span={8}><Statistic title="Cumplimiento 30d" value={habitDetail.completionRate30d} suffix="%" /></Col>
            </Row>
            <HabitHeatmap data={habitDetail.calendar} />
          </>
        ) : (
          <Empty description="Selecciona un habito" />
        )}
      </Card>

      <Card title="Tareas completadas por semana" style={{ marginTop: 16 }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={taskStats.weeklyCompleted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="completed" name="Completadas" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Tareas por estado" style={{ marginTop: 16 }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={statusChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Cantidad" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Tareas completadas - ultimos 7 dias" style={{ marginTop: 16 }}>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={overview.tasks.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="completed" name="Completadas" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
`);

console.log("stats web ok");
