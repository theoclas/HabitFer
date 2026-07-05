import { CloseOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { pickRandomBannerPhrase } from "../../../features/achievements/phrases";

export function MotivationalBanner() {
  const phrase = useMemo(() => pickRandomBannerPhrase(), []);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="habit-motivation-banner" role="status">
      <div className="habit-motivation-banner__icon">
        <ThunderboltOutlined />
      </div>
      <div className="habit-motivation-banner__text">
        <p className="habit-motivation-banner__phrase">{phrase.frase}</p>
        <span className="habit-motivation-banner__author">{phrase.autor}</span>
      </div>
      <button
        type="button"
        className="habit-motivation-banner__close"
        onClick={() => setVisible(false)}
        aria-label="Cerrar mensaje"
      >
        <CloseOutlined />
      </button>
    </div>
  );
}
