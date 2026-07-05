import { Input, Typography } from "antd";
import { useEffect, useState } from "react";

type Props = {
  value: string;
  onSave: (value: string) => Promise<void>;
  editable?: boolean;
  placeholder?: string;
  strong?: boolean;
  className?: string;
};

export function InlineEditableText({
  value,
  onSave,
  editable = true,
  placeholder = "Sin titulo",
  strong,
  className,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editable) {
    return strong ? (
      <Typography.Text strong className={className}>{value}</Typography.Text>
    ) : (
      <span className={className}>{value}</span>
    );
  }

  if (!editing) {
    return (
      <Typography.Text
        strong={strong}
        className={`inline-editable ${className ?? ""}`}
        onClick={() => setEditing(true)}
        title="Clic para editar"
      >
        {value || placeholder}
      </Typography.Text>
    );
  }

  return (
    <Input
      autoFocus
      size="small"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const trimmed = draft.trim();
        if (!trimmed || trimmed === value) {
          setDraft(value);
          return;
        }
        void onSave(trimmed);
      }}
      onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}
