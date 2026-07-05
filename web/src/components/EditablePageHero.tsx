import { Input } from "antd";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PageHero } from "./PageHero";

type Props = {
  title: string;
  subtitle?: string | null;
  titlePrefix?: ReactNode;
  editable?: boolean;
  onSaveTitle: (value: string) => Promise<void>;
  onSaveSubtitle?: (value: string) => Promise<void>;
  actions?: ReactNode;
  variant?: "proyec" | "habit";
  accentColor?: string;
};

export function EditablePageHero({
  title,
  subtitle,
  titlePrefix,
  editable = true,
  onSaveTitle,
  onSaveSubtitle,
  actions,
  variant = "proyec",
  accentColor,
}: Props) {
  const [titleVal, setTitleVal] = useState(title);
  const [subtitleVal, setSubtitleVal] = useState(subtitle ?? "");

  useEffect(() => {
    setTitleVal(title);
  }, [title]);

  useEffect(() => {
    setSubtitleVal(subtitle ?? "");
  }, [subtitle]);

  const saveTitle = async (raw: string) => {
    const value = raw.trim();
    if (!value || value === title) {
      setTitleVal(title);
      return;
    }
    await onSaveTitle(value);
  };

  const saveSubtitle = async (raw: string) => {
    if (!onSaveSubtitle) return;
    const value = raw.trim();
    if (value === (subtitle ?? "")) return;
    await onSaveSubtitle(value);
  };

  const titleNode = editable ? (
    <span className="page-hero__editable-wrap">
      {titlePrefix}
      <Input
        value={titleVal}
        onChange={(e) => setTitleVal(e.target.value)}
        onBlur={(e) => void saveTitle(e.target.value)}
        onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
        variant="borderless"
        className="page-hero__editable-title"
        aria-label="Nombre"
      />
    </span>
  ) : (
    <>
      {titlePrefix}
      {title}
    </>
  );

  const subtitleNode =
    editable && onSaveSubtitle ? (
      <Input.TextArea
        value={subtitleVal}
        onChange={(e) => setSubtitleVal(e.target.value)}
        onBlur={(e) => void saveSubtitle(e.target.value)}
        variant="borderless"
        className="page-hero__editable-subtitle"
        autoSize={{ minRows: 1, maxRows: 3 }}
        placeholder="Agregar descripcion..."
        aria-label="Descripcion"
      />
    ) : (
      subtitle
    );

  return (
    <PageHero
      variant={variant}
      accentColor={accentColor}
      title={titleNode}
      subtitle={subtitleNode}
      actions={actions}
    />
  );
}
