import { CloseOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Popconfirm, Skeleton, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteRecipe, fetchRecipe, saveRecipe } from "../api";
import { IngredientPicker } from "../components/IngredientPicker";
import { gramsText, kcalText, quantityText, recipePreview, scale } from "../math";
import type { RecipeIngredient } from "../types";

type Item = RecipeIngredient & { key: string };

const KITCHEN = "/app/nutrifer/cocina";
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

/** Receta propia: ingredientes de la olla entera y cuántas porciones salen; calcula cada porción en vivo. */
export function NutriRecipePage() {
  const { id } = useParams();
  const isNew = !id || id === "nueva";
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState("");
  const [servings, setServings] = useState(4);
  const [cooked, setCooked] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [picker, setPicker] = useState<{ open: boolean; editing: Item | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    let alive = true;
    fetchRecipe(id)
      .then((r) => {
        if (!alive) return;
        setName(r.name);
        setServings(r.servings);
        setCooked(r.cookedGrams);
        setItems(r.ingredients.map((i) => ({ ...i, key: i.id ?? newKey() })));
        setLoaded(true);
      })
      .catch((err) => {
        message.error(apiErrorMessage(err, "No se pudo abrir la receta"));
        navigate(KITCHEN);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, navigate]);

  if (!loaded) {
    return (
      <div className="nf-card">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const preview = recipePreview(items, servings, cooked);
  const valid = name.trim().length >= 2 && items.length > 0 && servings >= 0.5;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await saveRecipe(
        {
          name: name.trim(),
          servings,
          cookedGrams: cooked && cooked > 0 ? cooked : null,
          ingredients: items.map((i) => ({
            foodId: i.foodId,
            grams: i.grams,
            ...(i.portionLabel ? { portionLabel: i.portionLabel, quantity: i.quantity } : {}),
          })),
        },
        isNew ? undefined : id,
      );
      message.success(isNew ? "Receta creada: ya la encuentras al buscar" : "Receta guardada");
      navigate(KITCHEN);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar la receta"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew || !id) return;
    try {
      await deleteRecipe(id);
      message.success("Receta borrada (lo que ya anotaste con ella se queda)");
      navigate(KITCHEN);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo borrar"));
    }
  };

  return (
    <div className="nf-split">
      <div className="nf-split__main">
      <div>
        <button type="button" className="nf-back" onClick={() => navigate(KITCHEN)}>
          ‹ Cocina
        </button>
        <h1 className="nf-page-title">{isNew ? "Nueva receta" : name || "Receta"}</h1>
        <p className="nf-page-lead">Escribe lo que lleva la olla entera y cuántas porciones salen. Te calculo cada porción.</p>
      </div>

      <section className="nf-card" aria-label="Receta">
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-recipe-name">
            Nombre
          </label>
          <Input id="nf-recipe-name" size="large" maxLength={120} value={name} placeholder="Fríjoles de la casa" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="nf-field">
          <span className="nf-label">Porciones que salen</span>
          <div className="nf-stepper">
            <button type="button" aria-label="Menos porciones" disabled={servings <= 1} onClick={() => setServings((s) => Math.max(1, Math.round(s) - 1))}>
              −
            </button>
            <output aria-live="polite">{quantityText(servings)}</output>
            <button type="button" aria-label="Más porciones" disabled={servings >= 40} onClick={() => setServings((s) => Math.min(40, Math.round(s) + 1))}>
              +
            </button>
          </div>
          <span className="nf-hint">Los platos que sirves de esa olla.</span>
        </div>
      </section>

      <section className="nf-card" aria-labelledby="nf-recipe-ings">
        <div className="nf-card__head">
          <h2 id="nf-recipe-ings">Ingredientes</h2>
          <Button icon={<PlusOutlined />} onClick={() => setPicker({ open: true, editing: null })}>
            Agregar
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="nf-explain">Agrega lo que lleva la olla entera: fríjoles, plátano, zanahoria, hogao, aceite… con las cantidades de toda la olla, no de un plato.</p>
        ) : (
          <div className="nf-list">
            {items.map((i) => (
              <div key={i.key} className="nf-list__row nf-list__row--static">
                <button type="button" className="nf-list__main nf-list__main--btn" onClick={() => setPicker({ open: true, editing: i })} aria-label={`Cambiar cantidad de ${i.name}`}>
                  <b>{i.name}</b>
                  <small>{i.amount}</small>
                </button>
                <span className="nf-list__side">
                  <b>{kcalText(scale(i.per100, i.grams).kcal)}</b>
                  <small>kcal</small>
                </span>
                <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label={`Quitar ${i.name}`} onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}>
                  <CloseOutlined />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="nf-card" aria-labelledby="nf-recipe-weight">
        <h2 id="nf-recipe-weight">Peso de la olla (opcional)</h2>
        <p className="nf-explain" style={{ marginTop: -6 }}>
          Si pesas lo que quedó al final (sin la olla), puedes anotar esta receta en gramos exactos. Si no, cuenta la suma de los ingredientes:{" "}
          <b>{kcalText(preview.rawGrams)} g</b>.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <InputNumber
            aria-label="Peso de lo cocinado, en gramos"
            size="large"
            min={1}
            max={50000}
            value={cooked}
            placeholder={String(Math.round(preview.rawGrams) || 1500)}
            inputMode="numeric"
            onChange={(v) => setCooked(typeof v === "number" ? v : null)}
            style={{ width: 160 }}
          />
          <span className="nf-hint">g</span>
        </div>
      </section>

      </div>

      <aside className="nf-split__side">
      <section className="nf-card nf-card--hero" aria-labelledby="nf-recipe-result" aria-live="polite">
        <h2 id="nf-recipe-result">Cada porción</h2>
        <div className="nf-target__kcal">
          {kcalText(preview.perServing.kcal)}
          <small>kcal</small>
        </div>
        <div className="nf-target__macros">
          <div className="nf-target__macro">
            <b>{gramsText(preview.perServing.protein)} g</b>
            <span>
              <i className="nf-dot" style={{ background: "var(--nf-mora)" }} /> Proteína
            </span>
          </div>
          <div className="nf-target__macro">
            <b>{gramsText(preview.perServing.carbs)} g</b>
            <span>
              <i className="nf-dot" style={{ background: "var(--nf-maiz)" }} /> Carbohidratos
            </span>
          </div>
          <div className="nf-target__macro">
            <b>{gramsText(preview.perServing.fat)} g</b>
            <span>
              <i className="nf-dot" style={{ background: "var(--nf-aguacate)" }} /> Grasa
            </span>
          </div>
        </div>
        <p className="nf-explain">
          Una porción pesa unos <b>{kcalText(preview.servingGrams)} g</b>. Toda la olla: {kcalText(preview.totals.kcal)} kcal en {kcalText(preview.weight)} g.
        </p>
      </section>

      <div className="nf-actions" style={{ bottom: 0, marginBottom: 0, padding: "4px 0 0", background: "transparent" }}>
        {!isNew && (
          <Popconfirm title="¿Borrar esta receta?" description="Lo que ya anotaste con ella se queda." okText="Borrar" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => void remove()}>
            <Button size="large" danger icon={<DeleteOutlined />}>
              Borrar
            </Button>
          </Popconfirm>
        )}
        <Button type="primary" size="large" loading={saving} disabled={!valid} onClick={() => void save()}>
          Guardar receta
        </Button>
      </div>
      </aside>

      <IngredientPicker
        open={picker.open}
        editing={picker.editing}
        recipeId={isNew ? undefined : id}
        onClose={() => setPicker({ open: false, editing: null })}
        onPick={(ing) => {
          const editing = picker.editing;
          setItems((list) => (editing ? list.map((x) => (x.key === editing.key ? { ...ing, key: editing.key } : x)) : [...list, { ...ing, key: newKey() }]));
        }}
      />
    </div>
  );
}
