import { Card } from "antd";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  emoji?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  accentColor?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function FeatureCard({ emoji, title, meta, accentColor, children, className, style }: Props) {
  return (
    <Card
      hoverable
      className={`feature-card ${accentColor ? "feature-card--accent" : ""} ${className ?? ""}`}
      style={{
        ...style,
        ...(accentColor ? ({ "--card-accent": accentColor } as CSSProperties) : {}),
      }}
      styles={{ body: { padding: "18px 20px" } }}
    >
      {emoji && <div className="feature-card__emoji">{emoji}</div>}
      <div className="feature-card__title">{title}</div>
      {meta && <div className="feature-card__meta">{meta}</div>}
      {children}
    </Card>
  );
}
