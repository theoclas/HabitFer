import { CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { fetchMonthSummary } from "../../../api/client";
import { monthName, openWrapped } from "../wrapped";

const SEEN_KEY = "hf_wrapped_seen";
/** Dias del mes en que se ofrece el resumen del mes anterior. */
const DAYS = 3;

function seen(month: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === month;
  } catch {
    return false;
  }
}

function markSeen(month: string) {
  try {
    localStorage.setItem(SEEN_KEY, month);
  } catch {
    /* sin almacenamiento */
  }
}

/** En Hoy, los primeros dias del mes: "Tu octubre en HabitFer está listo". */
export function WrappedBanner() {
  const now = dayjs();
  const month = now.subtract(1, "month").format("YYYY-MM");
  const offer = now.date() <= DAYS && !seen(month);
  const [completed, setCompleted] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!offer) return;
    let alive = true;
    fetchMonthSummary(month)
      .then((s) => alive && setCompleted(s.totals.completed))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [offer, month]);

  if (!offer || hidden || !completed) return null;
  const name = monthName(month).toLowerCase();

  return (
    <div className="hf-wr-banner-wrap">
      <button
        type="button"
        className="hf-wr-banner"
        onClick={() => {
          markSeen(month);
          setHidden(true);
          openWrapped(month);
        }}
      >
        <span aria-hidden="true">✨</span>
        <span>
          <b>Tu {name} en HabitFer está listo</b>
          <small>
            {completed} {completed === 1 ? "hábito cumplido" : "hábitos cumplidos"}. Míralo y compártelo.
          </small>
        </span>
      </button>
      <button
        type="button"
        className="hf-wr-banner__close"
        aria-label="Ocultar el resumen del mes"
        onClick={() => {
          markSeen(month);
          setHidden(true);
        }}
      >
        <CloseOutlined />
      </button>
    </div>
  );
}
