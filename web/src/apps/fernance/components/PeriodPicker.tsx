import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, DatePicker, Segmented } from "antd";
import dayjs from "dayjs";
import { monthLabel, rangeLabel, useFinanceContext, type PeriodMode } from "../context/FinanceContext";

/** Mes (con flechas) o un rango de fechas. */
export function PeriodPicker() {
  const { periodMode, year, month, bounds, shiftMonth, setPeriodMode, setCustomRange } = useFinanceContext();

  return (
    <div className="ff-period">
      <Segmented
        size="small"
        aria-label="Periodo"
        options={[
          { label: "Mes", value: "month" },
          { label: "Rango", value: "range" },
        ]}
        value={periodMode}
        onChange={(v) => setPeriodMode(v as PeriodMode)}
      />
      {periodMode === "month" ? (
        <>
          <Button shape="circle" icon={<LeftOutlined />} onClick={() => shiftMonth(-1)} aria-label="Mes anterior" />
          <span className="ff-period__label" aria-live="polite">
            {monthLabel(year, month)}
          </span>
          <Button shape="circle" icon={<RightOutlined />} onClick={() => shiftMonth(1)} aria-label="Mes siguiente" />
        </>
      ) : (
        <DatePicker.RangePicker
          aria-label={rangeLabel(bounds.from, bounds.to)}
          value={[dayjs(bounds.from), dayjs(bounds.to)]}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) setCustomRange(dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD"));
          }}
          format="D MMM YYYY"
          allowClear={false}
          presets={[
            { label: "Este mes", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
            { label: "Mes anterior", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
            { label: "Últimos 3 meses", value: [dayjs().subtract(2, "month").startOf("month"), dayjs().endOf("month")] },
            { label: "Este año", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
          ]}
        />
      )}
    </div>
  );
}
