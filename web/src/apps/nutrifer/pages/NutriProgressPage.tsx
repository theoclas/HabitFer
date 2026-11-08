import { message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchInsights, fetchReport, fetchWeights } from "../api";
import { DiscoveriesCard, EnergyCard } from "../components/InsightsCards";
import { WeekReport } from "../components/WeekReport";
import { WeightCard, type WeightRange } from "../components/WeightCard";
import type { Insights, Report, WeightsView } from "../types";

/** El lunes de la semana de una fecha. */
const mondayOf = (key: string) => {
  const d = dayjs(key);
  return d.subtract((d.day() + 6) % 7, "day").format("YYYY-MM-DD");
};

/**
 * Progreso: el peso con su tendencia (y Apple Salud), el informe de la semana, los descubrimientos y el gasto real
 * con el que se ajusta la meta. En el teléfono, una columna; en el computador, dos.
 */
export function NutriProgressPage() {
  const thisWeek = mondayOf(todayKey());
  const [week, setWeek] = useState(thisWeek);
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [range, setRange] = useState<WeightRange>(90);
  const [weights, setWeights] = useState<WeightsView | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  const loadWeights = useCallback(async () => {
    try {
      setWeights(await fetchWeights(range));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cargar el peso"));
    }
  }, [range]);

  const loadInsights = useCallback(async () => {
    try {
      setInsights(await fetchInsights());
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudieron cargar los descubrimientos"));
    }
  }, []);

  useEffect(() => {
    void loadWeights();
  }, [loadWeights]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    let alive = true;
    setReportLoading(true);
    fetchReport(week, dayjs(week).add(6, "day").format("YYYY-MM-DD"))
      .then((r) => alive && setReport(r))
      .catch((err) => alive && message.error(apiErrorMessage(err, "No se pudo cargar la semana")))
      .finally(() => alive && setReportLoading(false));
    return () => {
      alive = false;
    };
  }, [week]);

  return (
    <div className="nf-progress">
      <header className="nf-progress__intro">
        <h1>Progreso</h1>
        <p>Tu peso real (sin los saltos de cada día), cómo te fue en la semana y lo que dicen tus datos.</p>
      </header>
      <div className="nf-progress__weight">
        <WeightCard
          data={weights}
          range={range}
          onRange={setRange}
          onChanged={() => {
            void loadWeights();
            void loadInsights();
          }}
        />
      </div>
      <div className="nf-progress__week">
        <WeekReport
          report={report}
          loading={reportLoading}
          isCurrent={week >= thisWeek}
          onShift={(n) => setWeek((w) => dayjs(w).add(n * 7, "day").format("YYYY-MM-DD"))}
          onToday={() => setWeek(thisWeek)}
        />
      </div>
      <div className="nf-progress__disc">
        <DiscoveriesCard insights={insights} />
      </div>
      <div className="nf-progress__energy">
        <EnergyCard energy={insights?.energy ?? null} loaded={insights !== null} />
      </div>
    </div>
  );
}
