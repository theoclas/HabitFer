import { message } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchAchievementsSummary } from "../api/client";
import { flameStage, StreakChip } from "../apps/habitfer/components/Flame";
import { useAchievements } from "../features/achievements/AchievementContext";
import { getStreakMilestones } from "../features/achievements/milestones";
import { habitEmoji } from "../features/habits/habitUtils";
import type { AchievementsSummary } from "../types";

type HabitRow = AchievementsSummary["habits"][number];
type Unlocked = HabitRow["unlocked"][number];

function stageColor(days: number) {
  return flameStage(days)?.outer ?? "var(--hf-ember)";
}

function Medal({ emoji, days, locked, size }: { emoji: string; days: number; locked?: boolean; size?: "lg" }) {
  return (
    <span
      className={`hf-medal${locked ? " hf-medal--locked" : ""}${size === "lg" ? " hf-medal--lg" : ""}`}
      style={{ "--m": stageColor(days) } as CSSProperties}
    >
      {emoji}
      <b>{days}</b>
    </span>
  );
}

function relativeDay(iso: string) {
  const d = dayjs(iso).startOf("day");
  const diff = dayjs().startOf("day").diff(d, "day");
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 7) return `hace ${diff} días`;
  return d.format("D MMM");
}

/** Cuanto del camino al siguiente hito ya se recorrio (desde el hito anterior). */
function progressToNext(current: number, next: number) {
  const prev = [0, ...getStreakMilestones()].filter((m) => m < next).pop() ?? 0;
  return Math.max(0, Math.min(1, (current - prev) / (next - prev)));
}

export function AchievementsPage() {
  const { celebrate } = useAchievements();
  const [data, setData] = useState<AchievementsSummary | null>(null);

  useEffect(() => {
    fetchAchievementsSummary()
      .then(setData)
      .catch(() => message.error("No se pudieron cargar los logros"));
  }, []);

  const totalUnlocked = data?.habits.reduce((s, h) => s + h.unlocked.length, 0) ?? 0;

  const nextUp = useMemo(() => {
    const candidates = (data?.habits ?? []).filter((h) => h.next && h.habit.streakEnabled);
    return candidates.sort((a, b) => a.next!.remaining - b.next!.remaining || b.currentStreak - a.currentStreak)[0] ?? null;
  }, [data]);

  const recent = useMemo(() => {
    const all: { row: HabitRow; a: Unlocked }[] = [];
    for (const row of data?.habits ?? []) for (const a of row.unlocked) all.push({ row, a });
    return all.sort((x, y) => y.a.unlockedAt.localeCompare(x.a.unlockedAt)).slice(0, 8);
  }, [data]);

  const replay = (row: HabitRow, a: Unlocked) =>
    celebrate(
      {
        id: a.id,
        habitId: row.habit.id,
        milestoneDays: a.milestoneDays,
        phraseIndex: a.phraseIndex,
        unlockedAt: a.unlockedAt,
        habitTitle: row.habit.title,
        habitColor: row.habit.color,
        habitIcon: row.habit.icon,
        label: a.label,
      },
      { replay: true },
    );

  if (!data) {
    return (
      <div aria-hidden="true">
        <div className="hf-skel hf-skel--orb" />
        <div className="hf-skel hf-skel--card" style={{ marginBottom: 10 }} />
        <div className="hf-skel hf-skel--card" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="hf-page-head">
        <div>
          <div className="hf-kicker">Tu vitrina</div>
          <h1 className="hf-title">
            {totalUnlocked} {totalUnlocked === 1 ? "medalla" : "medallas"}
          </h1>
        </div>
      </div>

      {nextUp?.next && (
        <div className="hf-next" style={{ "--c": nextUp.habit.color } as CSSProperties}>
          <Medal emoji={habitEmoji(nextUp.habit.icon)} days={nextUp.next.milestoneDays} size="lg" />
          <div style={{ minWidth: 0 }}>
            <b>
              {nextUp.next.remaining === 1 ? "Te falta 1 día" : `Te faltan ${nextUp.next.remaining} días`}
            </b>
            <p>
              {nextUp.habit.title} · {nextUp.next.milestoneDays} días · «{nextUp.next.label}»
            </p>
            <div className="hf-bar">
              <i style={{ width: `${Math.round(progressToNext(nextUp.currentStreak, nextUp.next.milestoneDays) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {recent.length > 0 ? (
        <>
          <div className="hf-section__head">
            <span>Recientes</span>
            <span style={{ textTransform: "none", letterSpacing: 0 }}>toca una para volver a verla</span>
          </div>
          <div className="hf-medal-grid">
            {recent.map(({ row, a }) => (
              <button key={a.id} type="button" className="hf-medal-btn hf-medal-cell" onClick={() => replay(row, a)}>
                <Medal emoji={habitEmoji(row.habit.icon)} days={a.milestoneDays} />
                <span>
                  {row.habit.title} · {relativeDay(a.unlockedAt)}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="hf-empty">
          <b>Tu primera medalla llega a los 3 días</b>
          Marca un hábito tres días seguidos y aparece aquí.
        </div>
      )}

      <div className="hf-section__head">
        <span>Por hábito</span>
        <span style={{ textTransform: "none", letterSpacing: 0 }}>{data.totalMilestones} hitos posibles por hábito</span>
      </div>
      {data.habits.map((row) => (
        <div key={row.habit.id} className="hf-habit-track">
          <div className="hf-habit-track__head">
            <span className="hf-habit-track__name">
              <span aria-hidden="true">{habitEmoji(row.habit.icon)}</span>
              <span>{row.habit.title}</span>
            </span>
            {row.habit.streakEnabled ? (
              row.currentStreak > 0 ? <StreakChip days={row.currentStreak} /> : <span style={{ color: "var(--hf-muted)", fontSize: 12 }}>sin racha activa</span>
            ) : (
              <span style={{ color: "var(--hf-muted)", fontSize: 12 }}>racha apagada</span>
            )}
          </div>
          <div className="hf-habit-track__row">
            {row.unlocked.map((a) => (
              <button key={a.id} type="button" className="hf-medal-btn" onClick={() => replay(row, a)} aria-label={`${a.milestoneDays} días, ver frase`}>
                <Medal emoji={habitEmoji(row.habit.icon)} days={a.milestoneDays} />
              </button>
            ))}
            {row.next && (
              <span className="hf-medal-cell" title={`Faltan ${row.next.remaining} días`}>
                <Medal emoji={habitEmoji(row.habit.icon)} days={row.next.milestoneDays} locked />
              </span>
            )}
            {row.unlocked.length === 0 && !row.next && (
              <span style={{ color: "var(--hf-muted)", fontSize: 13 }}>Activa la racha para ganar medallas.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
