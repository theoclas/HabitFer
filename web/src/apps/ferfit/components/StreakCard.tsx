import { Select } from "antd";
import { WEEKDAY_SHORT, daysText, weeksText } from "../format";
import type { Streak } from "../types";

type Props = {
  streak: Streak;
  today: string;
  saving?: boolean;
  onGoal: (days: number) => void;
};

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: daysText(n) }));

/** La racha por semanas: cuántas seguidas cumpliste, los días de esta semana y la meta. */
export function StreakCard({ streak, today, saving, onGoal }: Props) {
  const { week } = streak;
  const title = streak.weeks > 0 ? weeksText(streak.weeks) : "Empieza tu racha";
  const status = week.met
    ? "Ya cumpliste la meta de esta semana."
    : week.left === 1
      ? "Te falta 1 día para cumplir la semana."
      : `Te faltan ${week.left} días para cumplir la semana.`;

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
      </div>
      <div className="fit-week" aria-label={`Esta semana: ${week.trainedDays} de ${streak.goal} días`}>
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
      <div className="fit-actions">
        <label className="fit-hint" htmlFor="fit-goal">
          Meta por semana
        </label>
        <Select id="fit-goal" size="small" value={streak.goal} options={GOAL_OPTIONS} onChange={onGoal} loading={saving} style={{ width: 110 }} />
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
