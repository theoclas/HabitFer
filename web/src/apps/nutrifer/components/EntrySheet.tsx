import { DeleteOutlined } from "@ant-design/icons";
import { Button, Drawer, Popconfirm, Select, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteEntry, foodDetail, updateEntry, type EntryChanges } from "../api";
import { kcalText } from "../math";
import type { AmountChoice, Entry, FoodDetail, MealSlot, Remaining } from "../types";
import { AmountEditor } from "./AmountEditor";
import { QuickEntryForm } from "./QuickEntryForm";

type Props = {
  entry: Entry | null;
  meals: { slot: MealSlot; name: string }[];
  remaining: Remaining | null;
  onClose: () => void;
  onChanged: () => void;
};

/** Lo que ya tenía la anotación, en el formato del editor. */
function initialChoice(entry: Entry, food: FoodDetail): AmountChoice {
  const prep = { prep: entry.prep, oilGrams: entry.oilGrams };
  if (entry.parts && food.parts.length > 0) {
    return { quantity: entry.quantity, parts: entry.parts.map((p) => ({ partId: p.partId, included: p.included })) };
  }
  if (entry.portionLabel) {
    const wanted = entry.portionLabel.toLowerCase();
    const portion = food.portions.find((p) => p.label.toLowerCase() === wanted);
    if (portion) return { portionId: portion.id, quantity: entry.quantity, ...prep };
  }
  return { grams: entry.grams ?? 100, quantity: 1, ...prep };
}

/** Cambiar la cantidad (o las calorías de un registro rápido), moverla a otra comida o borrarla. */
export function EntrySheet({ entry, meals, remaining, onClose, onChanged }: Props) {
  const isMobile = useIsMobile();
  const [food, setFood] = useState<FoodDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [meal, setMeal] = useState<MealSlot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFood(null);
    setMissing(false);
    if (!entry) return;
    setMeal(entry.meal);
    if (entry.quick) return;
    if (!entry.foodId) {
      setMissing(true);
      return;
    }
    let alive = true;
    foodDetail(entry.foodId)
      .then((f) => alive && setFood(f))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [entry]);

  const save = async (changes: EntryChanges) => {
    if (!entry) return;
    setBusy(true);
    try {
      await updateEntry(entry.id, { ...changes, ...(meal && meal !== entry.meal ? { meal } : {}) });
      message.success("Guardado");
      onChanged();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  };

  const moveOnly = async () => {
    if (!entry || !meal || meal === entry.meal) return;
    setBusy(true);
    try {
      await updateEntry(entry.id, { meal });
      onChanged();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo mover"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      await deleteEntry(entry.id);
      message.success("Borrado");
      onChanged();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo borrar"));
    } finally {
      setBusy(false);
    }
  };

  const extras = entry && (
    <div className="nf-field">
      <label className="nf-label" htmlFor="nf-entry-meal">
        Comida
      </label>
      <Select
        id="nf-entry-meal"
        size="large"
        value={meal ?? entry.meal}
        onChange={(v) => setMeal(v)}
        options={meals.map((m) => ({ value: m.slot, label: m.name }))}
      />
      <Popconfirm title="¿Borrar esta anotación?" okText="Borrar" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => void remove()}>
        <Button danger type="text" icon={<DeleteOutlined />} style={{ justifySelf: "start", marginTop: 6 }} disabled={busy}>
          Borrar de {meals.find((m) => m.slot === entry.meal)?.name.toLowerCase() ?? "la comida"}
        </Button>
      </Popconfirm>
    </div>
  );

  let body = null;
  if (entry?.quick) {
    body = (
      <QuickEntryForm
        key={entry.id}
        initial={{ name: entry.name === "Registro rápido" ? "" : entry.name, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat }}
        busy={busy}
        submitLabel={(k) => (k > 0 ? `Guardar · ${kcalText(k)} kcal` : "Guardar")}
        onSubmit={(v) => void save({ name: v.name ?? "", kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat })}
      >
        {extras}
      </QuickEntryForm>
    );
  } else if (entry && missing) {
    body = (
      <div className="nf-detail">
        <p className="nf-hint" style={{ margin: 0 }}>
          {entry.amount ? `${entry.amount} · ` : ""}
          {kcalText(entry.kcal)} kcal. Este alimento ya no está en la base: puedes moverlo de comida o borrarlo.
        </p>
        {extras}
        <div className="nf-actions">
          <Button type="primary" size="large" loading={busy} disabled={!meal || meal === entry.meal} onClick={() => void moveOnly()}>
            Mover
          </Button>
        </div>
      </div>
    );
  } else if (entry && !food) {
    body = (
      <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  } else if (entry && food) {
    body = (
      <AmountEditor
        key={`${entry.id}-${food.id}`}
        food={food}
        initial={initialChoice(entry, food)}
        busy={busy}
        remaining={remaining}
        submitLabel={(k) => `Guardar · ${kcalText(k)} kcal`}
        onSubmit={(c) => void save(c)}
      >
        {extras}
      </AmountEditor>
    );
  }

  return (
    <Drawer
      title={entry?.name ?? ""}
      open={entry !== null}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "88dvh" : 520}
      rootClassName="nf-drawer"
      styles={{
        body: {
          paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24,
          paddingLeft: isMobile ? "max(16px, env(safe-area-inset-left))" : undefined,
          paddingRight: isMobile ? "max(16px, env(safe-area-inset-right))" : undefined,
          overflowX: "hidden",
        },
        wrapper: isMobile ? { maxWidth: "100vw" } : undefined,
      }}
    >
      {body}
    </Drawer>
  );
}
