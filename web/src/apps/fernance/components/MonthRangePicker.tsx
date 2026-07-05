import { Button, Space, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { monthLabel, useFinanceContext } from "../context/FinanceContext";

export function MonthRangePicker() {
  const { year, month, shiftMonth } = useFinanceContext();

  return (
    <Space>
      <Button icon={<LeftOutlined />} onClick={() => shiftMonth(-1)} aria-label="Mes anterior" />
      <Typography.Text strong style={{ minWidth: 160, textAlign: "center", display: "inline-block", textTransform: "capitalize" }}>
        {monthLabel(year, month)}
      </Typography.Text>
      <Button icon={<RightOutlined />} onClick={() => shiftMonth(1)} aria-label="Mes siguiente" />
    </Space>
  );
}
