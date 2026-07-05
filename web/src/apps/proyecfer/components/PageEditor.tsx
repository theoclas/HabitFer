import { useCallback, useEffect, useRef } from "react";
import { Input, Select, Typography } from "antd";
import type { BlockItem } from "../../../types/proyecfer";

const BLOCK_TYPES = [
  { value: "paragraph", label: "Texto" },
  { value: "heading_1", label: "Titulo 1" },
  { value: "heading_2", label: "Titulo 2" },
  { value: "heading_3", label: "Titulo 3" },
  { value: "bulleted_list", label: "Lista" },
  { value: "numbered_list", label: "Lista numerada" },
  { value: "todo", label: "Checklist" },
  { value: "callout", label: "Destacado" },
  { value: "code", label: "Codigo" },
  { value: "divider", label: "Divisor" },
];

type Props = {
  blocks: BlockItem[];
  onChange: (blocks: BlockItem[]) => void;
  onSave: (blocks: BlockItem[]) => void;
};

function newBlock(type: string, sortOrder: number): BlockItem {
  return {
    id: "temp-" + Date.now() + "-" + sortOrder,
    type,
    content: { text: "" },
    sortOrder,
    parentBlockId: null,
  };
}

export function PageEditor({ blocks, onChange, onSave }: Props) {
  const saveTimer = useRef<number | null>(null);

  const scheduleSave = useCallback(
    (next: BlockItem[]) => {
      onChange(next);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => onSave(next), 800);
    },
    [onChange, onSave],
  );

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const updateBlock = (index: number, patch: Partial<BlockItem>) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
    scheduleSave(next);
  };

  const updateText = (index: number, text: string) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, content: { ...b.content, text } } : b));
    scheduleSave(next);
  };

  const addBlock = (type: string) => {
    scheduleSave([...blocks, newBlock(type, blocks.length)]);
  };

  const removeBlock = (index: number) => {
    scheduleSave(blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, sortOrder: i })));
  };

  return (
    <div className="page-editor">
      {blocks.map((block, index) => (
        <div key={block.id + index} className="page-editor__block" style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
          <Select
            size="small"
            value={block.type}
            style={{ width: 130, flexShrink: 0 }}
            options={BLOCK_TYPES}
            onChange={(type) => updateBlock(index, { type })}
          />
          {block.type === "divider" ? (
            <hr style={{ flex: 1, borderColor: "#334155" }} />
          ) : (
            <Input.TextArea
              autoSize
              value={String(block.content?.text ?? "")}
              onChange={(e) => updateText(index, e.target.value)}
              placeholder={block.type.startsWith("heading") ? "Titulo..." : "Escribe aqui... (/ para tipos)"}
              style={{
                flex: 1,
                fontWeight: block.type.startsWith("heading") ? 700 : 400,
                fontSize: block.type === "heading_1" ? 24 : block.type === "heading_2" ? 20 : block.type === "heading_3" ? 17 : 14,
              }}
            />
          )}
          <Typography.Link type="secondary" onClick={() => removeBlock(index)} style={{ flexShrink: 0 }}>x</Typography.Link>
        </div>
      ))}
      <Select
        placeholder="+ Agregar bloque"
        style={{ width: 200, marginTop: 8 }}
        value={null}
        options={BLOCK_TYPES}
        onChange={(type) => type && addBlock(type)}
      />
    </div>
  );
}
