import { Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { ACTIVE_APP_IDS, APPS } from "../platform/apps";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  wide?: boolean;
};

export function AuthLayout({ title, subtitle, children, wide }: Props) {
  return (
    <div className="auth-page auth-page--split">
      <div className="auth-hero-mobile" aria-hidden>
        <img src="/fersua-auth-hero.png" alt="" />
        <div className="auth-hero-mobile__shade" />
        <span className="auth-brand auth-brand--mobile">Fersua</span>
      </div>

      <aside className="auth-hero" aria-hidden>
        <img src="/fersua-auth-hero.png" alt="" className="auth-hero__image" />
        <div className="auth-hero__overlay" />
        <div className="auth-hero__content">
          <Typography.Title level={1} className="auth-brand auth-brand--hero">
            Fersua
          </Typography.Title>
          <Typography.Paragraph className="auth-hero__tagline">
            Tu ecosistema personal: hábitos, finanzas y nutrición en un solo lugar.
          </Typography.Paragraph>
          <ul className="auth-hero__apps">
            {ACTIVE_APP_IDS.map((id) => (
              <li key={id}>
                <span className="auth-hero__dot" style={{ "--dot": APPS[id].color } as CSSProperties} />
                {APPS[id].name}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <div className={`auth-card auth-card--panel ${wide ? "auth-card--wide" : ""}`}>
          <header className="auth-panel__header">
            <Typography.Title level={2} className="auth-panel__title">
              {title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="auth-panel__subtitle">
              {subtitle}
            </Typography.Paragraph>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
