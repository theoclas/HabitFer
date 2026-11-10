import { SearchOutlined } from "@ant-design/icons";
import { Input, Modal } from "antd";
import { useMemo, useState } from "react";
import { useFinanceContext } from "../context/FinanceContext";
import { categoryTree, pickerCategories } from "../movements";
import type { CategoryKind, FinanceCategory } from "../types";

const norm = (s: string) =>
  s
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

type ChipsProps = {
  kind: CategoryKind;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Cuántas mostrar antes de «Más». */
  limit?: number;
};

/** Las categorías más usadas en botones, y «Más» para ver todas. */
export function CategoryChips({ kind, value, onChange, limit = 8 }: ChipsProps) {
  const { categories } = useFinanceContext();
  const [open, setOpen] = useState(false);
  const sorted = pickerCategories(categories, kind);
  const top = sorted.slice(0, limit);
  const selected = value ? categories.find((c) => c.id === value) : undefined;
  const shown = selected && !top.some((c) => c.id === selected.id) ? [selected, ...top.slice(0, limit - 1)] : top;

  return (
    <div className="ff-chips" role="group" aria-label="Categoría">
      {shown.map((c) => (
        <button
          key={c.id}
          type="button"
          className="ff-pick"
          aria-pressed={value === c.id}
          onClick={() => onChange(value === c.id ? null : c.id)}
        >
          <span aria-hidden="true">{c.icon}</span>
          {c.name}
        </button>
      ))}
      <button type="button" className="ff-pick ff-pick--more" onClick={() => setOpen(true)}>
        Más categorías…
      </button>
      <CategoryPickerModal
        open={open}
        kind={kind}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          onChange(id);
          setOpen(false);
        }}
      />
    </div>
  );
}

type ModalProps = {
  open: boolean;
  kind: CategoryKind;
  value?: string | null;
  title?: string;
  /** Texto de ayuda arriba (por ejemplo, para enseñar una palabra). */
  intro?: string;
  onClose: () => void;
  onPick: (id: string) => void;
};

/** Todas las categorías de un tipo, con sus subcategorías y un buscador. */
export function CategoryPickerModal({ open, kind, value, title, intro, onClose, onPick }: ModalProps) {
  const { categories } = useFinanceContext();
  const [query, setQuery] = useState("");
  const tree = useMemo(() => categoryTree(categories, kind), [categories, kind]);
  const q = norm(query.trim());
  const matches = (c: FinanceCategory) => !q || norm(c.name).includes(q);

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={title ?? (kind === "INCOME" ? "Categoría del ingreso" : "Categoría del gasto")} destroyOnHidden>
      {intro && <p className="ff-hint" style={{ marginTop: 0 }}>{intro}</p>}
      <Input
        allowClear
        autoFocus
        prefix={<SearchOutlined />}
        placeholder="Buscar categoría"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div className="ff-cattree">
        {tree.map(({ parent, children }) => {
          const kids = children.filter(matches);
          if (!matches(parent) && !kids.length) return null;
          return (
            <div key={parent.id} className="ff-cattree__group">
              <button type="button" className="ff-pick ff-pick--parent" aria-pressed={value === parent.id} onClick={() => onPick(parent.id)}>
                <span aria-hidden="true">{parent.icon}</span>
                {parent.name}
              </button>
              {kids.length > 0 && (
                <div className="ff-chips">
                  {kids.map((c) => (
                    <button key={c.id} type="button" className="ff-pick" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>
                      <span aria-hidden="true">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
