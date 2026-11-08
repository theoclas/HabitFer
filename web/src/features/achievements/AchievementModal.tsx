import { Button, Modal } from "antd";
import type { CSSProperties } from "react";
import { flameStage } from "../../apps/habitfer/components/Flame";
import type { UnlockedAchievement } from "../../types";
import { habitEmoji } from "../habits/habitUtils";
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

  const phrase = pickPhraseByIndex(achievement.phraseIndex);
  const next = getNextMilestone(achievement.milestoneDays);
  const stage = flameStage(achievement.milestoneDays);

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
        <span className="hf-medal hf-medal--lg" style={{ "--m": stage?.outer ?? "var(--hf-ember)" } as CSSProperties}>
          {habitEmoji(achievement.habitIcon)}
          <b>{achievement.milestoneDays}</b>
        </span>
        <span className="hf-achievement__tag">{replay ? "Logro ganado" : "Logro desbloqueado"}</span>
        <h3 className="hf-achievement__title">{achievement.milestoneDays} días de racha</h3>
        <span className="hf-achievement__habit">
          {achievement.habitTitle} · {achievement.label}
        </span>
        <blockquote className="hf-quote">
          <p>&ldquo;{phrase.frase}&rdquo;</p>
          <cite>{phrase.autor}</cite>
        </blockquote>
        {next && !replay && <span className="hf-achievement__next">Próximo logro: {next} días</span>}
      </div>
    </Modal>
  );
}
