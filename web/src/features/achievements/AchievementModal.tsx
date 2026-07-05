import { TrophyOutlined } from "@ant-design/icons";
import { Button, Modal, Typography } from "antd";
import type { UnlockedAchievement } from "../../types";
import { getNextMilestone } from "./milestones";
import { pickPhraseByIndex } from "./phrases";
import { habitEmoji } from "../habits/habitUtils";

type Props = {
  achievement: UnlockedAchievement | null;
  onClose: () => void;
};

export function AchievementModal({ achievement, onClose }: Props) {
  if (!achievement) return null;

  const phrase = pickPhraseByIndex(achievement.phraseIndex);
  const next = getNextMilestone(achievement.milestoneDays);

  return (
    <Modal
      open
      onCancel={onClose}
      footer={[
        <Button key="ok" type="primary" onClick={onClose} style={{ background: "#2dd4bf", borderColor: "#2dd4bf", color: "#0a0a0f" }}>
          Seguir adelante
        </Button>,
      ]}
      centered
      width={420}
      className="achievement-modal"
      title={null}
      closable
    >
      <div className="achievement-modal__body">
        <div className="achievement-modal__badge" style={{ background: `linear-gradient(135deg, ${achievement.habitColor}, ${achievement.habitColor}88)` }}>
          <span className="achievement-modal__emoji">{habitEmoji(achievement.habitIcon)}</span>
          <TrophyOutlined className="achievement-modal__trophy" />
        </div>

        <Typography.Text className="achievement-modal__tag">Logro desbloqueado</Typography.Text>
        <Typography.Title level={3} className="achievement-modal__title">
          {achievement.milestoneDays} dias de racha
        </Typography.Title>
        <Typography.Text type="secondary" className="achievement-modal__habit">
          {achievement.habitTitle} · {achievement.label}
        </Typography.Text>

        <blockquote className="achievement-modal__quote">
          <Typography.Paragraph className="achievement-modal__phrase">&ldquo;{phrase.frase}&rdquo;</Typography.Paragraph>
          <Typography.Text type="secondary" className="achievement-modal__author">&mdash; {phrase.autor}</Typography.Text>
        </blockquote>

        {next && (
          <Typography.Text type="secondary" className="achievement-modal__next">
            Proximo logro: {next} dias
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
}
