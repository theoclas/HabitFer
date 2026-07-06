import { Card, Col, Row, Statistic } from "antd";
import type { ComplianceReport } from "../../../../types/proyecfer";

type Props = { report: ComplianceReport };

export function ComplianceKpiRow({ report }: Props) {
  const { totals, dailyTaskCount } = report;
  return (
    <Row gutter={[12, 12]} className="compliance-kpi-row">
      <Col xs={12} md={6}>
        <Card className="compliance-kpi-card">
          <Statistic title="Cumplimiento 7d" value={totals.rate7d} suffix="%" valueStyle={{ color: "#a5b4fc" }} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="compliance-kpi-card">
          <Statistic title="Cumplimiento 30d" value={totals.rate30d} suffix="%" valueStyle={{ color: "#818cf8" }} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="compliance-kpi-card">
          <Statistic title="Rutinas activas" value={dailyTaskCount} valueStyle={{ color: "#c4b5fd" }} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="compliance-kpi-card">
          <Statistic title="Dias perfectos" value={totals.perfectDays} valueStyle={{ color: "#34d399" }} />
        </Card>
      </Col>
    </Row>
  );
}
