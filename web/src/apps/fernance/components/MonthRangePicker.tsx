import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, DatePicker, Segmented, Space, Typography } from "antd";
import dayjs from "dayjs";
import { monthLabel, rangeLabel, useFinanceContext, type PeriodMode } from "../context/FinanceContext";

export function MonthRangePicker() {
  const { periodMode, year, month, bounds, shiftMonth, setPeriodMode, setCustomRange } = useFinanceContext();

  return (
    <Space wrap size="middle" className="fern-period-picker">
      <Segmented
        size="small"
        className="fern-period-picker__mode"
        options={[
          { label: "Mes", value: "month" },
          { label: "Rango", value: "range" },
        ]}
        value={periodMode}
        onChange={(v) => setPeriodMode(v as PeriodMode)}
      />

      {periodMode === "month" ? (
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => shiftMonth(-1)} aria-label="Mes anterior" />
          <Typography.Text
            strong
            style={{ minWidth: 160, textAlign: "center", display: "inline-block", textTransform: "capitalize" }}
          >
            {monthLabel(year, month)}
          </Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => shiftMonth(1)} aria-label="Mes siguiente" />
        </Space>
      ) : (
        <Space direction="vertical" size={4}>
          <DatePicker.RangePicker
            value={[dayjs(bounds.from), dayjs(bounds.to)]}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setCustomRange(dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD"));
              }
            }}
            format="DD MMM YYYY"
            allowClear={false}
            presets={[
              { label: "Este mes", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
              { label: "Mes anterior", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
              { label: "Ultimos 3 meses", value: [dayjs().subtract(2, "month").startOf("month"), dayjs().endOf("month")] },
              { label: "Este año", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
            ]}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {rangeLabel(bounds.from, bounds.to)}
          </Typography.Text>
        </Space>
      )}
    </Space>
  );
}
