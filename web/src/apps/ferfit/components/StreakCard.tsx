import { Segmented, Select } from "antd";
import { WEEKDAY_SHORT, daysText, weeksText } from "../format";
import type { FitSettings, GoalKind, Streak } from "../types";

type Props = {
  streak: Streak;
  today: string;
  saving?: boolean;
  /** Cambia la meta: por días o por minutos, y cuántos. */
  onGoal: (patch: Partial<FitSettings>) => void;
};

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: daysText(n) }));
const MINUTES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const R = 18;
const C = 2 * Math.PI * R;

/** La racha por semanas: cuántas seguidas cumpliste, cómo va esta semana (por días o por minutos) y la meta. */
export function StreakCard({ streak, today, saving, onGoal }: Props) {
  const { week } = streak;
  const byMinutes = streak.kind === "minutes";
  const value = byMinutes ? week.minutes : week.trainedDays;
  const target = byMinutes ? streak.goalMinutes : streak.goal;
  const frac = target > 0 ? Math.min(1, value / target) : 0;
  const title = streak.weeks > 0 ? weeksText(streak.weeks) : "Empieza tu racha";
  const status = week.met
    ? "Ya cumpliste la meta de esta semana."
    : byMinutes
      ? `Llevas ${week.minutes} de ${streak.goalMinutes} min: te faltan ${week.left}.`
      : week.left === 1
        ? "Te falta 1 día para cumplir la semana."
        : `Te faltan ${week.left} días para cumplir la semana.`;
  const minuteOptions = [...new Set([...MINUTES, streak.goalMinutes])].sort((a, b) => a - b).map((n) => ({ value: n, label: `${n} min` }));

  return (
    <section className="fit-card fit-streak" aria-labelledby="fit-streak-title">
      <div className="fit-streak__top">
        <span className="fit-streak__flame" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2c1 3.2-.6 5.1-2 6.8C8.6 10.5 7 12.3 7 15a5 5 0 0 0 10 0c0-1.9-.8-3.4-1.6-4.6-.3 1.3-1 2.2-2 2.6.6-2.9.1-6.6-1.4-11z" />
          </svg>
        </span>
        <div>
          <div className="fit-eyebrow">Racha</div>
          <div className="fit-streak__big" id="fit-streak-title">
            {title}
          </div>
        </div>
        <div
          className={`fit-goalring${week.met ? " is-met" : ""}`}
          role="img"
          aria-label={byMinutes ? `${value} de ${target} minutos esta semana` : `${value} de ${target} días esta semana`}
        >
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="fit-goalring__track" cx="22" cy="22" r={R} />
            <circle className="fit-goalring__fill" cx="22" cy="22" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <span aria-hidden="true">{byMinutes ? `${value}′` : `${value}/${target}`}</span>
        </div>
      </div>
      <div className="fit-week" aria-label={`Esta semana: ${week.trainedDays} ${week.trainedDays === 1 ? "día" : "días"} entrenados`}>
        {week.days.map((d, i) => {
          const cls = ["fit-wd", d.trained ? "is-done" : "", d.date === today ? "is-today" : "", d.date > today ? "is-future" : ""].join(" ");
          return (
            <span key={d.date} className={cls} title={d.trained ? "Entrenaste" : undefined}>
              <i aria-hidden="true">{d.trained ? "✓" : ""}</i>
              {WEEKDAY_SHORT[i]}
            </span>
          );
        })}
      </div>
      <div className="fit-streak__small">{status}</div>
      <div className="fit-actions fit-goalrow">
        <label className="fit-hint" htmlFor="fit-goal">
          Meta por semana
        </label>
        <Segmented
          size="small"
          value={streak.kind}
          disabled={saving}
          onChange={(v) => onGoal({ goalKind: v as GoalKind })}
          options={[
            { value: "days", label: "Días" },
            { value: "minutes", label: "Minutos" },
          ]}
        />
        {byMinutes ? (
          <Select id="fit-goal" size="small" value={streak.goalMinutes} options={minuteOptions} onChange={(v) => onGoal({ weeklyGoalMinutes: v })} loading={saving} style={{ width: 100 }} />
        ) : (
          <Select id="fit-goal" size="small" value={streak.goal} options={DAY_OPTIONS} onChange={(v) => onGoal({ weeklyGoalDays: v })} loading={saving} style={{ width: 100 }} />
        )}
      </div>
      <div className="fit-streak__foot">
        <span>
          Mejor racha: <b>{weeksText(streak.bestWeeks)}</b>
        </span>
        <span>
          Este mes: <b>{daysText(streak.monthDays)}</b>
        </span>
        <span>
          En total: <b>{daysText(streak.totalDays)}</b>
        </span>
      </div>
    </section>
  );
}
