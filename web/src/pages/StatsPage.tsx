import { FireOutlined } from "@ant-design/icons";
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
import { useIsMobile } from "../hooks/useIsMobile";
import type { Habit, HabitStatsDetail, StatsOverview, TaskStatsSummary } from "../types";

export function StatsPage() {
  const isMobile = useIsMobile();
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
      if (h.length) setSelectedHabitId((prev) => prev ?? h[0].id);
    } catch {
      message.error("No se pudieron cargar estadisticas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedHabitId) {
      setHabitDetail(null);
      return;
    }
    void fetchHabitStats(selectedHabitId)
      .then(setHabitDetail)
      .catch(() => message.error("No se pudo cargar detalle del habito"));
  }, []);

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
      {isMobile && <Typography.Title level={2} style={{ marginTop: 0 }}>Estadisticas</Typography.Title>}

      <Row gutter={[16, 16]}>
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

      <div className="stats-grid stats-grid--charts">
        <Card title="Habitos - ultimos 7 dias">
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

        <Card title="Tareas completadas por semana">
          <div style={{ width: "100%", height: 260 }}>
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
      </div>

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
          style={{ width: "100%", maxWidth: 400, marginBottom: 16 }}
          value={selectedHabitId ?? undefined}
          onChange={setSelectedHabitId}
          options={habits.map((h) => ({ value: h.id, label: h.title }))}
        />
        {habitDetail ? (
          <>
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col xs={8}><Statistic title="Racha" value={habitDetail.currentStreak} /></Col>
              <Col xs={8}><Statistic title="Mejor racha" value={habitDetail.longestStreak} /></Col>
              <Col xs={8}><Statistic title="Cumplimiento 30d" value={habitDetail.completionRate30d} suffix="%" /></Col>
            </Row>
            <HabitHeatmap data={habitDetail.calendar} />
          </>
        ) : (
          <Empty description="Selecciona un habito" />
        )}
      </Card>

      <div className="stats-grid stats-grid--charts" style={{ marginTop: 16 }}>
        <Card title="Tareas por estado">
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

        <Card title="Tareas completadas - ultimos 7 dias">
          <div style={{ width: "100%", height: 240 }}>
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
    </div>
  );
}

