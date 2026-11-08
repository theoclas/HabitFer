import { SearchOutlined } from "@ant-design/icons";
import { Drawer, Input, message, type InputRef } from "antd";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchShortcuts, foodDetail } from "../api";
import { defaultAmount, portionText } from "../format";
import { useFoodSearch } from "../hooks";
import { kcalText, previewAmount } from "../math";
import type { AmountChoice, FoodDetail, FoodResult, RecipeIngredient } from "../types";
import { AmountEditor } from "./AmountEditor";
import { CreateFoodForm } from "./CreateFoodForm";
import { FoodRow } from "./FoodRow";

type Props = {
  open: boolean;
  /** Para cambiar la cantidad de un ingrediente que ya está en la receta. */
  editing: RecipeIngredient | null;
  /** La receta que se edita (no puede llevarse a sí misma). */
  recipeId?: string;
  onClose: () => void;
  onPick: (ingredient: RecipeIngredient) => void;
};

/** Lo elegido en el editor, como ingrediente de la receta (con su medida casera si se usó). */
function toIngredient(food: FoodDetail, choice: AmountChoice): RecipeIngredient {
  const portion = choice.portionId ? food.portions.find((p) => p.id === choice.portionId) : undefined;
  const grams = Math.round(previewAmount(food, choice).grams * 10) / 10;
  const amount = portion ? `${portionText(portion.label, choice.quantity)} · ${Math.round(grams)} g` : `${Math.round(grams)} g`;
  return {
    foodId: food.id,
    name: food.name,
    portionLabel: portion?.label ?? null,
    quantity: portion ? choice.quantity : 1,
    grams,
    amount,
    per100: food.per100,
  };
}

/** Lo que ya tenía el ingrediente, en el formato del editor. */
function initialOf(ing: RecipeIngredient, food: FoodDetail): AmountChoice {
  if (ing.portionLabel) {
    const portion = food.portions.find((p) => p.label.toLowerCase() === ing.portionLabel?.toLowerCase());
    if (portion) return { portionId: portion.id, quantity: ing.quantity };
  }
  return { grams: ing.grams, quantity: 1 };
}

/** Buscar un ingrediente y elegir cuánto lleva la olla entera. */
export function IngredientPicker({ open, editing, recipeId, onClose, onPick }: Props) {
  const isMobile = useIsMobile();
  const inputRef = useRef<InputRef>(null);
  const [q, setQ] = useState("");
  const found = useFoodSearch(q);
  const [frequent, setFrequent] = useState<FoodResult[] | null>(null);
  const [detail, setDetail] = useState<FoodDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // Los platos por partes no sirven de ingrediente (se agregan sus partes) y la receta no se lleva a sí misma.
  const usable = (f: FoodResult) => !f.isDish && f.id !== recipeId;
  const results = found?.filter(usable) ?? null;

  const openFood = async (id: string) => {
    setOpening(id);
    try {
      setDetail(await foodDetail(id));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo abrir ese alimento"));
    } finally {
      setOpening(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCreating(false);
    setDetail(null);
    if (editing) void openFood(editing.foodId);
    fetchShortcuts(undefined)
      .then((s) => setFrequent([...s.favorites, ...s.recents].filter(usable).slice(0, 12)))
      .catch(() => setFrequent([]));
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const back = () => {
    if (editing) {
      onClose();
      return;
    }
    setDetail(null);
    setCreating(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const term = q.trim();
  const list = term ? results : frequent;

  return (
    <Drawer
      title={editing ? "Cambiar cantidad" : "Agregar ingrediente"}
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 520}
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
      {creating ? (
        <CreateFoodForm initialName={term} onCancel={back} onCreated={(food) => void openFood(food.id).then(() => setCreating(false))} />
      ) : detail ? (
        <>
          <button type="button" className="nf-back" onClick={back}>
            ‹ {editing ? "Volver a la receta" : "Volver a la búsqueda"}
          </button>
          <header style={{ margin: "8px 0 16px" }}>
            <h3 className="nf-detail__name">{detail.name}</h3>
            <p className="nf-detail__source">Cuánto lleva la olla entera</p>
          </header>
          <AmountEditor
            key={detail.id}
            food={detail}
            initial={editing && editing.foodId === detail.id ? initialOf(editing, detail) : undefined}
            allowPrep={false}
            allowGoal={false}
            busy={false}
            submitLabel={(k) => `${editing ? "Guardar" : "Agregar a la receta"} · ${kcalText(k)} kcal`}
            onSubmit={(c) => {
              onPick(toIngredient(detail, c));
              onClose();
            }}
          />
        </>
      ) : editing ? null : (
        <>
          <div className="nf-search">
            <Input
              ref={inputRef}
              size="large"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Busca: fríjol, papa, cebolla, aceite…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              enterKeyHint="search"
              aria-label="Buscar ingrediente"
            />
          </div>
          {!term && <div className="nf-section-label">Lo que más usas</div>}
          {list === null ? (
            <div className="nf-empty">{term ? "Buscando…" : "Cargando…"}</div>
          ) : list.length === 0 ? (
            <div className="nf-empty">{term ? `No encontré «${term}». Prueba con otra palabra o créalo abajo.` : "Escribe el primer ingrediente."}</div>
          ) : (
            <div className="nf-results">
              {list.map((f) => (
                <FoodRow key={f.id} food={f} amount={defaultAmount(f)} opening={opening === f.id} onOpen={() => void openFood(f.id)} />
              ))}
            </div>
          )}
          <button type="button" className="nf-create-link" onClick={() => setCreating(true)}>
            ¿No está? Crea tu propio alimento
          </button>
        </>
      )}
    </Drawer>
  );
}
