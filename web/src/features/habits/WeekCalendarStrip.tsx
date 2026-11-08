import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

type Props = {
  selected: Dayjs;
  onSelect: (day: Dayjs) => void;
  progressByDate?: Record<string, number>;
  vertical?: boolean;
};

function Ring({ rate, label }: { rate: number; label: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const perfect = rate >= 100;
  return (
    <span className="hf-week__ring">
      <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx={18} cy={18} r={r} fill="none" stroke="var(--hf-track)" strokeWidth={3} />
        {rate > 0 && (
          <circle
            cx={18}
            cy={18}
            r={r}
            fill="none"
            stroke={perfect ? "var(--hf-blue)" : "var(--hf-ember)"}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${(c * Math.min(rate, 100)) / 100} ${c}`}
            transform="rotate(-90 18 18)"
            style={{ transition: "stroke-dasharray 0.5s, stroke 0.4s" }}
          />
        )}
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function WeekCalendarStrip({ selected, onSelect, progressByDate = {}, vertical = false }: Props) {
  const start = selected.startOf("week");
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  const today = dayjs().startOf("day");

  return (
    <div className={`hf-week${vertical ? " hf-week--vertical" : ""}`} role="group" aria-label="Semana">
      {days.map((day) => {
        const key = day.format("YYYY-MM-DD");
        const isSelected = day.isSame(selected, "day");
        const isToday = day.isSame(today, "day");
        const isFuture = day.isAfter(today, "day");
        const rate = progressByDate[key] ?? 0;
        const cls = ["hf-week__day", isSelected ? "hf-week__day--selected" : "", isFuture ? "hf-week__day--future" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={key}
            type="button"
            className={cls}
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={`${day.format("dddd D")}${isToday ? ", hoy" : ""}, ${rate}% cumplido`}
          >
            <span>{DAY_SHORT[day.day()]}</span>
            <Ring rate={rate} label={day.date()} />
            <span className={`hf-week__dot${isToday ? "" : " hf-week__dot--hidden"}`} />
          </button>
        );
      })}
    </div>
  );
}
