import { LoadingOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Drawer, Input, message, type InputRef } from "antd";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { addEntry, foodDetail, recentFoods, searchFoods } from "../api";
import { kcalText, quantityText } from "../math";
import type { AmountChoice, FoodDetail, FoodResult, MealSlot, RecentFood } from "../types";
import { AmountEditor } from "./AmountEditor";
import { CreateFoodForm } from "./CreateFoodForm";

type Props = {
  open: boolean;
  meal: MealSlot | null;
  mealName: string;
  date: string;
  onClose: () => void;
  onAdded: () => void;
};

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function badge(food: FoodResult) {
  if (food.source === "USER") return <span className="nf-badge nf-badge--own">Tuyo</span>;
  if (food.isDish || food.source === "DISH") return <span className="nf-badge nf-badge--dish">Plato</span>;
  if (food.source === "P18") return <span className="nf-badge">ICBF</span>;
  return null;
}

/** «1 arepa pequeña · 56 g» o «2 × pocillo»: lo que se anotó la última vez. */
function lastAmount(r: RecentFood): { text: string; kcal: number } {
  const { portionLabel, quantity, grams, kcal } = r.last;
  if (!portionLabel) return { text: grams != null ? `${Math.round(grams)} g` : "100 g", kcal };
  const amount = quantity === 1 ? `1 ${lower(portionLabel)}` : `${quantityText(quantity)} × ${lower(portionLabel)}`;
  return { text: grams != null ? `${amount} · ${Math.round(grams)} g` : amount, kcal };
}

function defaultAmount(food: FoodResult): { text: string; kcal: number } {
  if (food.portion) return { text: `1 ${lower(food.portion.label)} · ${Math.round(food.portion.grams)} g`, kcal: food.kcalPortion ?? food.kcal100 };
  return { text: "100 g", kcal: food.kcal100 };
}

/** Buscar y agregar a una comida. Queda abierta para seguir agregando: así se arma un plato rápido. */
export function AddFoodSheet({ open, meal, mealName, date, onClose, onAdded }: Props) {
  const isMobile = useIsMobile();
  const inputRef = useRef<InputRef>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodResult[] | null>(null);
  const [recents, setRecents] = useState<RecentFood[] | null>(null);
  const [detail, setDetail] = useState<FoodDetail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);

  const loadRecents = useCallback(() => {
    if (!meal) return;
    recentFoods(meal)
      .then(setRecents)
      .catch(() => setRecents([]));
  }, [meal]);

  useEffect(() => {
    if (!open || !meal) return;
    setQ("");
    setResults(null);
    setDetail(null);
    setCreating(false);
    setRecents(null);
    loadRecents();
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [open, meal, loadRecents]);

  // Búsqueda mientras se escribe: espera un instante y cancela la anterior.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      searchFoods(term, ctrl.signal)
        .then(setResults)
        .catch((err) => {
          if (!axios.isCancel(err)) message.error(apiErrorMessage(err, "No se pudo buscar"));
        });
    }, 160);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const backToSearch = () => {
    setDetail(null);
    setCreating(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

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

  const added = (name: string) => {
    message.success(`${name} quedó en ${lower(mealName)}`);
    onAdded();
    loadRecents();
  };

  const save = async (choice: AmountChoice) => {
    if (!detail || !meal) return;
    setBusy(true);
    try {
      await addEntry({ date, meal, foodId: detail.id, ...choice });
      added(detail.name);
      setQ("");
      setResults(null);
      backToSearch();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setBusy(false);
    }
  };

  /** Repetir con un toque la misma cantidad de la última vez. */
  const repeat = async (r: RecentFood) => {
    if (!meal) return;
    setQuickBusy(r.id);
    try {
      await addEntry({
        date,
        meal,
        foodId: r.id,
        quantity: r.last.quantity,
        ...(r.last.portionLabel ? { portionLabel: r.last.portionLabel } : {}),
        ...(r.last.grams != null ? { grams: r.last.grams } : {}),
      });
      added(r.name);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setQuickBusy(null);
    }
  };

  const row = (food: FoodResult, amount: { text: string; kcal: number }, quick?: () => void) => (
    <div className="nf-result" key={food.id}>
      <button type="button" className="nf-result__main" onClick={() => void openFood(food.id)}>
        <span className="nf-result__name">{food.name}</span>
        <span className="nf-result__meta">
          {badge(food)}
          {amount.text}
        </span>
      </button>
      <span className="nf-result__side">
        <span className="nf-result__kcal">
          {opening === food.id ? <LoadingOutlined /> : kcalText(amount.kcal)} <small>kcal</small>
        </span>
        {quick && (
          <button type="button" className="nf-quick" onClick={quick} disabled={quickBusy === food.id} aria-label={`Repetir ${food.name}, ${amount.text}`}>
            {quickBusy === food.id ? <LoadingOutlined /> : <PlusOutlined />}
          </button>
        )}
      </span>
    </div>
  );

  const term = q.trim();

  return (
    <Drawer
      title={`Agregar a ${lower(mealName)}`}
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 480}
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
        <CreateFoodForm
          initialName={term}
          onCancel={backToSearch}
          onCreated={(food) => {
            setCreating(false);
            void openFood(food.id);
          }}
        />
      ) : detail ? (
        <>
          <button type="button" className="nf-back" onClick={backToSearch}>
            ‹ Volver a la búsqueda
          </button>
          <header style={{ margin: "8px 0 16px" }}>
            <h3 className="nf-detail__name">{detail.name}</h3>
            <p className="nf-detail__source">{detail.sourceLabel}</p>
          </header>
          <AmountEditor key={detail.id} food={detail} busy={busy} submitLabel={(k) => `Agregar · ${kcalText(k)} kcal`} onSubmit={(c) => void save(c)} />
        </>
      ) : (
        <>
          <div className="nf-search">
            <Input
              ref={inputRef}
              size="large"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Busca: arepa, tinto, bandeja paisa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              enterKeyHint="search"
              aria-label="Buscar alimento"
            />
          </div>
          {term ? (
            results === null ? (
              <div className="nf-empty">Buscando…</div>
            ) : results.length === 0 ? (
              <div className="nf-empty">No encontré «{term}». Prueba con otra palabra o créalo abajo.</div>
            ) : (
              <div className="nf-results">{results.map((r) => row(r, defaultAmount(r)))}</div>
            )
          ) : recents === null ? (
            <div className="nf-empty">Cargando…</div>
          ) : recents.length > 0 ? (
            <>
              <div className="nf-section-label">Lo que más anotas aquí</div>
              <div className="nf-results">
                {recents.map((r) => {
                  const amount = lastAmount(r);
                  return row(r, amount, r.isDish ? undefined : () => void repeat(r));
                })}
              </div>
            </>
          ) : (
            <div className="nf-empty">Escribe lo que comiste. La búsqueda entiende «tinto», «perico» o «aguapanela», con o sin tildes.</div>
          )}
          <button type="button" className="nf-create-link" onClick={() => setCreating(true)}>
            ¿No está? Crea tu propio alimento
          </button>
        </>
      )}
    </Drawer>
  );
}
