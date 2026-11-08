import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Checkbox, Modal, message } from "antd";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createHabitsBulk, fetchHabits } from "../../api/client";
import { notifyHabitsChanged } from "../../apps/habitfer/effects";
import { apiErrorMessage } from "../../apps/habitfer/format";
import { habitEmoji } from "./habitUtils";
import { TEMPLATE_PACKS, templateDetail, type TemplatePack } from "./templates";

type Props = {
  open: boolean;
  /** Pack para abrir directo (si no, se muestra la lista de packs). */
  packId?: string | null;
  onClose: () => void;
  onCreated: (count: number) => void;
};

const norm = (s: string) => s.trim().toLocaleLowerCase("es");

/** Elegir un pack y los habitos que se quieren de el; se crean todos de una vez. */
export function TemplatePicker({ open, packId, onClose, onCreated }: Props) {
  const [pack, setPack] = useState<TemplatePack | null>(null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPack(TEMPLATE_PACKS.find((p) => p.id === packId) ?? null);
    fetchHabits()
      .then((list) => setExisting(new Set(list.map((h) => norm(h.title)))))
      .catch(() => setExisting(new Set()));
  }, [open, packId]);

  useEffect(() => {
    if (!pack) return;
    setChecked(new Set(pack.habits.map((_, i) => i).filter((i) => !existing.has(norm(pack.habits[i].title)))));
  }, [pack, existing]);

  const selected = useMemo(() => (pack ? pack.habits.filter((_, i) => checked.has(i)) : []), [pack, checked]);

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const create = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      const created = await createHabitsBulk(selected);
      message.success(created.length === 1 ? "Hábito creado" : `${created.length} hábitos creados`);
      notifyHabitsChanged();
      onCreated(created.length);
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudieron crear"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={520}
      className="hf-templates"
      title={
        pack ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!packId && (
              <Button type="text" size="small" icon={<ArrowLeftOutlined />} aria-label="Ver todos los packs" onClick={() => setPack(null)} />
            )}
            <span aria-hidden="true">{pack.emoji}</span> {pack.name}
          </span>
        ) : (
          "Plantillas"
        )
      }
      footer={
        pack
          ? [
              <Button key="cancel" onClick={onClose}>
                Cancelar
              </Button>,
              <Button key="ok" type="primary" disabled={selected.length === 0} loading={creating} onClick={() => void create()}>
                {selected.length === 1 ? "Crear 1 hábito" : `Crear ${selected.length} hábitos`}
              </Button>,
            ]
          : null
      }
    >
      {!pack ? (
        <div className="hf-templates__packs">
          {TEMPLATE_PACKS.map((p) => (
            <button key={p.id} type="button" className="hf-templates__pack" onClick={() => setPack(p)}>
              <span className="hf-templates__emoji" aria-hidden="true">
                {p.emoji}
              </span>
              <b>{p.name}</b>
              <span>{p.description}</span>
              <small>{p.habits.length} hábitos</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="hf-hint" style={{ marginTop: 0 }}>
            {pack.description} Elige los que quieres; después puedes editar cada uno.
          </p>
          <ul className="hf-templates__list">
            {pack.habits.map((h, i) => {
              const have = existing.has(norm(h.title));
              return (
                <li key={h.title} style={{ "--c": h.color ?? "#FF7A1A" } as CSSProperties}>
                  <label className={`hf-templates__item${checked.has(i) ? " is-on" : ""}`}>
                    <Checkbox checked={checked.has(i)} onChange={() => toggle(i)} />
                    <span className="hf-card__emoji" aria-hidden="true">
                      {habitEmoji(h.icon)}
                    </span>
                    <span className="hf-sort-row__text">
                      <b>{h.title}</b>
                      <small>
                        {templateDetail(h)}
                        {have ? " · ya lo tienes" : ""}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
