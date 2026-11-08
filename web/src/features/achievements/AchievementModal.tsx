import { Button, Modal } from "antd";
import type { CSSProperties } from "react";
import { flameStage } from "../../apps/habitfer/components/Flame";
import type { UnlockedAchievement } from "../../types";
import { habitEmoji, streakStageDays } from "../habits/habitUtils";
import { getNextMilestone } from "./milestones";
import { pickPhraseByIndex } from "./phrases";

type Props = {
  achievement: UnlockedAchievement | null;
  /** Abierto desde la vitrina: mismo contenido, otro titulo. */
  replay?: boolean;
  onClose: () => void;
};

export function AchievementModal({ achievement, replay, onClose }: Props) {
  if (!achievement) return null;

  const kind = achievement.kind ?? "days";
  const n = achievement.milestoneDays;
  const phrase = pickPhraseByIndex(achievement.phraseIndex);
  const challenge = kind === "challenge";
  const next = challenge ? null : getNextMilestone(n);
  const stage = flameStage(streakStageDays(n, kind === "weeks" ? "weeks" : "days"));
  const headline = achievement.headline ?? `${n} días de racha`;
  const nextText = !next ? null : kind === "weeks" ? `${next} semanas` : kind === "clean" ? `${next} días limpio` : `${next} días`;
  const medalColor = challenge ? "var(--hf-blue)" : (stage?.outer ?? "var(--hf-ember)");

  return (
    <Modal
      open
      onCancel={onClose}
      footer={[
        <Button key="ok" type="primary" size="large" block onClick={onClose}>
          {replay ? "Cerrar" : "Seguir adelante"}
        </Button>,
      ]}
      centered
      width={420}
      className="hf-achievement"
      title={null}
      closable
    >
      <div className="hf-achievement__body">
        <span className="hf-medal hf-medal--lg" style={{ "--m": medalColor } as CSSProperties}>
          {challenge ? "🏁" : habitEmoji(achievement.habitIcon)}
          <b>{n}</b>
        </span>
        <span className="hf-achievement__tag">{replay ? "Logro ganado" : challenge ? "Reto cumplido" : "Logro desbloqueado"}</span>
        <h3 className="hf-achievement__title">{headline}</h3>
        <span className="hf-achievement__habit">
          {achievement.habitTitle} · {achievement.label}
        </span>
        <blockquote className="hf-quote">
          <p>&ldquo;{phrase.frase}&rdquo;</p>
          <cite>{phrase.autor}</cite>
        </blockquote>
        {nextText && !replay && <span className="hf-achievement__next">Próximo logro: {nextText}</span>}
      </div>
    </Modal>
  );
}
