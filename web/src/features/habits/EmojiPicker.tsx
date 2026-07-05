import { AppstoreOutlined } from "@ant-design/icons";
import { Button, Drawer, Segmented } from "antd";
import { useMemo, useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { EMOJI_CATEGORIES, QUICK_EMOJIS } from "./emojiData";
import "./EmojiPicker.css";

type Props = {
  value?: string | null;
  onChange: (emoji: string) => void;
};

function EmojiStrip({
  emojis,
  value,
  onPick,
}: {
  emojis: string[];
  value?: string | null;
  onPick: (emoji: string) => void;
}) {
  const unique = useMemo(() => [...new Set(emojis)], [emojis]);

  return (
    <div className="emoji-strip" role="listbox" aria-label="Stickers">
      {unique.map((emoji) => {
        const selected = value === emoji;
        return (
          <button
            key={emoji}
            type="button"
            role="option"
            aria-selected={selected}
            className={`emoji-strip__btn${selected ? " emoji-strip__btn--selected" : ""}`}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

function EmojiGrid({
  emojis,
  value,
  onPick,
}: {
  emojis: string[];
  value?: string | null;
  onPick: (emoji: string) => void;
}) {
  const unique = useMemo(() => [...new Set(emojis)], [emojis]);

  return (
    <div className="emoji-grid">
      {unique.map((emoji) => {
        const selected = value === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className={`emoji-grid__btn${selected ? " emoji-grid__btn--selected" : ""}`}
            onClick={() => onPick(emoji)}
            aria-label={`Elegir ${emoji}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

/** Stickers de acceso rápido + fila extra desplazable sin mover el formulario */
const STRIP_EMOJIS = [
  ...QUICK_EMOJIS,
  "🌙", "❤️", "🎸", "💻", "🧺", "🛏️", "🚶", "🥗",
  "🧠", "✍️", "💊", "🧹", "📵", "🎮", "🏆", "🌿",
];

export function EmojiPicker({ value, onChange }: Props) {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0].id);

  const current = value?.trim() || "✨";
  const activeCategory = EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0];

  const pickAndClose = (emoji: string) => {
    onChange(emoji);
    setPickerOpen(false);
  };

  return (
    <div className="emoji-picker">
      <div className="emoji-picker__header">
        <div className="emoji-picker__preview" aria-hidden>
          {current}
        </div>
        <div className="emoji-picker__header-text">
          <span className="emoji-picker__label">Sticker seleccionado</span>
          <Button
            type="primary"
            icon={<AppstoreOutlined />}
            onClick={() => setPickerOpen(true)}
            block
            className="emoji-picker__more-btn"
          >
            Ver más stickers
          </Button>
        </div>
      </div>

      <p className="emoji-picker__sublabel">Desliza para ver más →</p>
      <EmojiStrip emojis={STRIP_EMOJIS} value={value} onPick={onChange} />

      <Drawer
        title="Elegir sticker"
        placement={isMobile ? "bottom" : "right"}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        width={isMobile ? undefined : 400}
        height={isMobile ? "min(88dvh, 640px)" : undefined}
        destroyOnClose={false}
        styles={{
          body: {
            padding: isMobile ? "12px 16px 24px" : "16px 20px 24px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
          header: { padding: isMobile ? "12px 16px" : undefined },
        }}
        className="emoji-picker-drawer"
        rootClassName="emoji-picker-drawer-root"
      >
        <div className="emoji-picker__selected-row">
          <span className="emoji-picker__selected-emoji">{current}</span>
          <span className="emoji-picker__selected-hint">Toca un sticker para seleccionarlo</span>
        </div>

        <div className="emoji-picker__categories">
          <Segmented
            value={categoryId}
            onChange={(v) => setCategoryId(String(v))}
            options={EMOJI_CATEGORIES.map((c) => ({ label: c.label, value: c.id }))}
            className="emoji-picker__segmented"
          />
        </div>

        <div className="emoji-picker__scroll emoji-picker__scroll--vertical">
          <EmojiGrid emojis={activeCategory.emojis} value={value} onPick={pickAndClose} />
        </div>
      </Drawer>
    </div>
  );
}
