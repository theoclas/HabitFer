import { Typography } from "antd";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  variant?: "proyec" | "habit";
  accentColor?: string;
};

export function PageHero({ title, subtitle, actions, variant = "proyec", accentColor }: Props) {
  const style = accentColor
    ? ({ "--hero-bg": `${accentColor}22`, "--card-accent": accentColor } as React.CSSProperties)
    : undefined;

  return (
    <div className={`page-hero page-hero--${variant}`} style={style}>
      <Typography.Title level={2} className="page-hero__title">
        {title}
      </Typography.Title>
      {subtitle && (
        <Typography.Paragraph className="page-hero__subtitle">{subtitle}</Typography.Paragraph>
      )}
      {actions && <div className="page-hero__actions">{actions}</div>}
    </div>
  );
}
