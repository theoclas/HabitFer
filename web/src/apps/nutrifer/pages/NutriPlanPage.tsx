import { CheckOutlined, CopyOutlined, LeftOutlined, MinusOutlined, PlusOutlined, RightOutlined, SearchOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Checkbox, Drawer, Input, Segmented, Skeleton, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { addPlanItem, copyPlanWeek, deletePlanItem, fetchPlan, fetchRecipes, fetchSavedMeals, logPlanItem, updatePlanItem } from "../api";
import { portionText } from "../format";
import { useFoodSearch } from "../hooks";
import { kcalText } from "../math";
import { MEAL_ORDER, type MealSlot, type PlanItem, type PlanKind, type PlanWeek, type RecipeSummary, type SavedMealView } from "../types";

const mondayOf = (key: string) => {
  const d = dayjs(key);
  return d.subtract((d.day() + 6) % 7, "day").format("YYYY-MM-DD");
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const servingsText = (n: number) => (n === 1 ? "" : `× ${String(n).replace(".", ",")}`);

/* La lista de mercado marcada vive en este teléfono, por semana. */
const MARKET_KEY = "nf_market_";
function readChecked(week: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MARKET_KEY + week) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function writeChecked(week: string, s: Set<string>) {
  try {
    localStorage.setItem(MARKET_KEY + week, JSON.stringify([...s]));
  } catch {
    // Sin almacenamiento: se marca mientras la pantalla está abierta.
  }
}

type Target = { date: string; meal: MealSlot };

/** Elegir qué va en el plan: una comida guardada, una receta o un alimento. */
function PlanPicker({
  target,
  mealNames,
  onClose,
  onPick,
}: {
  target: Target | null;
  mealNames: Record<MealSlot, string>;
  onClose: () => void;
  onPick: (kind: PlanKind, refId: string, meal: MealSlot) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const [meal, setMeal] = useState<MealSlot>("ALMUERZO");
  const [tab, setTab] = useState<"saved" | "recipes" | "food">("saved");
  const [saved, setSaved] = useState<SavedMealView[] | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [q, setQ] = useState("");
  const results = useFoodSearch(tab === "food" ? q : "");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setMeal(target.meal);
    setQ("");
    fetchSavedMeals()
      .then((s) => {
        setSaved(s);
        if (s.length === 0) setTab("recipes");
      })
      .catch(() => setSaved([]));
    fetchRecipes()
      .then(setRecipes)
      .catch(() => setRecipes([]));
  }, [target]);

  const pick = async (kind: PlanKind, id: string) => {
    setBusy(id);
    try {
      await onPick(kind, id, meal);
    } finally {
      setBusy(null);
    }
  };

  const row = (key: string, kind: PlanKind, name: string, meta: string, kcal: number | null) => (
    <div className="nf-result" key={key}>
      <button type="button" className="nf-result__main" disabled={busy !== null} onClick={() => void pick(kind, key)}>
        <span className="nf-result__name">{name}</span>
        <span className="nf-result__meta">{meta}</span>
      </button>
      <span className="nf-result__side">
        {kcal != null && (
          <span className="nf-result__kcal">
            {kcalText(kcal)} <small>kcal</small>
          </span>
        )}
        <button type="button" className="nf-quick" disabled={busy !== null} onClick={() => void pick(kind, key)} aria-label={`Planear ${name}`}>
          <PlusOutlined />
        </button>
      </span>
    </div>
  );

  return (
    <Drawer
      title={target ? `Planear el ${dayjs(target.date).format("dddd D")}` : "Planear"}
      open={target !== null}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "88dvh" : 520}
      rootClassName="nf-drawer"
      styles={{ body: { paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24 } }}
    >
      <div className="nf-detail" style={{ gap: 14 }}>
        <div className="nf-field">
          <span className="nf-label">Comida</span>
          <div className="nf-chips nf-chips--sm" role="group" aria-label="Comida">
            {MEAL_ORDER.map((m) => (
              <button key={m} type="button" className="nf-chip" aria-pressed={meal === m} onClick={() => setMeal(m)}>
                {mealNames[m]}
              </button>
            ))}
          </div>
        </div>
        <Segmented
          block
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { label: "Guardadas", value: "saved" },
            { label: "Recetas", value: "recipes" },
            { label: "Alimento", value: "food" },
          ]}
        />
        {tab === "saved" &&
          (!saved ? (
            <div className="nf-empty">Cargando…</div>
          ) : saved.length === 0 ? (
            <div className="nf-empty">Aún no tienes comidas guardadas: en «Hoy», en el menú de una comida, «Guardar como comida».</div>
          ) : (
            <div className="nf-results">{saved.map((s) => row(s.id, "SAVED", s.name, `${s.items.length} cosas`, s.kcal))}</div>
          ))}
        {tab === "recipes" &&
          (!recipes ? (
            <div className="nf-empty">Cargando…</div>
          ) : recipes.length === 0 ? (
            <div className="nf-empty">Aún no tienes recetas: créalas en Cocina.</div>
          ) : (
            <div className="nf-results">{recipes.map((r) => row(r.id, "RECIPE", r.name, `1 porción de ${r.servings}`, r.kcalServing))}</div>
          ))}
        {tab === "food" && (
          <>
            <Input size="large" allowClear prefix={<SearchOutlined />} placeholder="Busca: arepa, huevo, pollo…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            {q.trim() &&
              (results === null ? (
                <div className="nf-empty">Buscando…</div>
              ) : (
                <div className="nf-results">
                  {results.map((f) =>
                    row(f.id, f.source === "RECIPE" ? "RECIPE" : "FOOD", f.name, f.portion ? portionText(f.portion.label, 1) : "100 g", f.kcalPortion ?? f.kcal100),
                  )}
                </div>
              ))}
          </>
        )}
      </div>
    </Drawer>
  );
}

/** Plan de la semana (con comidas guardadas, recetas y alimentos) y la lista de mercado que sale de ahí. */
export function NutriPlanPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const thisWeek = mondayOf(todayKey());
  const [week, setWeek] = useState(thisWeek);
  const [plan, setPlan] = useState<PlanWeek | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [view, setView] = useState<"plan" | "market">("plan");
  const [checked, setChecked] = useState<Set<string>>(() => readChecked(thisWeek));
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await fetchPlan(week));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cargar el plan"));
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => {
    void load();
    setChecked(readChecked(week));
  }, [load, week]);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) message.success(ok);
      await load();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo"));
    } finally {
      setBusy(null);
    }
  };

  const byDay = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    for (const it of plan?.items ?? []) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return m;
  }, [plan]);

  const toggle = (foodId: string) => {
    const next = new Set(checked);
    if (next.has(foodId)) next.delete(foodId);
    else next.add(foodId);
    setChecked(next);
    writeChecked(week, next);
  };

  const copyList = async () => {
    if (!plan) return;
    const lines = [`Mercado · semana del ${dayjs(plan.from).format("D")} al ${dayjs(plan.to).format("D [de] MMMM")}`];
    for (const g of plan.shopping) {
      lines.push("", g.category);
      for (const i of g.items) lines.push(`${checked.has(i.foodId) ? "✓" : "•"} ${i.name.split(",")[0]} — ${i.amount}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      message.success("Lista copiada: pégala en WhatsApp o en notas");
    } catch {
      message.info("No se pudo copiar en este navegador.");
    }
  };

  const total = plan?.shopping.reduce((s, g) => s + g.items.length, 0) ?? 0;
  const label = plan ? `${dayjs(plan.from).format("D")} al ${dayjs(plan.to).format("D [de] MMMM")}` : "…";

  const planView = (
    <section className="nf-card nf-plan" aria-labelledby="nf-plan-title">
      <div className="nf-card__head">
        <h2 id="nf-plan-title">Plan</h2>
        <Button
          icon={<CopyOutlined />}
          loading={busy === "copy"}
          onClick={() =>
            void act(
              "copy",
              () => copyPlanWeek(dayjs(week).subtract(7, "day").format("YYYY-MM-DD"), week),
              "Se copió la semana pasada (se suma a lo que ya había)",
            )
          }
        >
          Repetir la semana pasada
        </Button>
      </div>
      {!plan ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <ol className={`nf-plandays${loading ? " is-loading" : ""}`}>
          {plan.days.map((d) => {
            const items = byDay.get(d.date) ?? [];
            const over = plan.kcalTarget != null && d.kcal > plan.kcalTarget * 1.1;
            return (
              <li key={d.date} className={`nf-planday${d.date === todayKey() ? " is-today" : ""}`}>
                <div className="nf-planday__head">
                  <b>{cap(dayjs(d.date).format("dddd D"))}</b>
                  <span className={over ? "is-over" : ""}>
                    {d.kcal ? `${kcalText(d.kcal)} kcal` : "nada planeado"}
                    {plan.kcalTarget != null && d.kcal > 0 && <small> de {kcalText(plan.kcalTarget)}</small>}
                  </span>
                </div>
                {MEAL_ORDER.filter((m) => items.some((i) => i.meal === m)).map((m) => (
                  <div key={m} className="nf-planmeal">
                    <span className="nf-planmeal__name">{plan.mealNames[m]}</span>
                    {items
                      .filter((i) => i.meal === m)
                      .map((i) => (
                        <div key={i.id} className={`nf-planitem${i.missing ? " is-missing" : ""}`}>
                          <span className="nf-planitem__name">
                            {i.name}
                            <small>
                              {i.kind === "SAVED" ? "comida guardada" : i.kind === "RECIPE" ? "receta" : i.unit ? portionText(i.unit, 1) : ""} {servingsText(i.servings)}
                            </small>
                          </span>
                          <span className="nf-planitem__kcal">{kcalText(i.kcal)}</span>
                          <span className="nf-planitem__tools">
                            <button
                              type="button"
                              className="nf-icon-btn nf-icon-btn--sm"
                              aria-label={`Menos de ${i.name}`}
                              disabled={busy !== null || i.servings <= 0.5}
                              onClick={() => void act(i.id, () => updatePlanItem(i.id, { servings: Math.max(0.5, i.servings - 0.5) }))}
                            >
                              <MinusOutlined />
                            </button>
                            <button
                              type="button"
                              className="nf-icon-btn nf-icon-btn--sm"
                              aria-label={`Más de ${i.name}`}
                              disabled={busy !== null || i.servings >= 20}
                              onClick={() => void act(i.id, () => updatePlanItem(i.id, { servings: i.servings + 0.5 }))}
                            >
                              <PlusOutlined />
                            </button>
                            <button
                              type="button"
                              className="nf-icon-btn nf-icon-btn--sm"
                              aria-label={`Anotar ${i.name} en el diario`}
                              title="Anotar en el diario"
                              disabled={busy !== null || i.missing}
                              onClick={() =>
                                void act(i.id, async () => {
                                  const r = await logPlanItem(i.id);
                                  message.success(`Anotado en ${plan.mealNames[r.meal].toLowerCase()} del ${dayjs(r.date).format("dddd")}: ${kcalText(r.kcal)} kcal`);
                                })
                              }
                            >
                              <CheckOutlined />
                            </button>
                            <button
                              type="button"
                              className="nf-icon-btn nf-icon-btn--sm"
                              aria-label={`Quitar ${i.name} del plan`}
                              disabled={busy !== null}
                              onClick={() => void act(i.id, () => deletePlanItem(i.id))}
                            >
                              <CloseOutlined />
                            </button>
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
                <button type="button" className="nf-planadd" onClick={() => setTarget({ date: d.date, meal: "ALMUERZO" })}>
                  <PlusOutlined /> Agregar
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );

  const marketView = (
    <section className="nf-card nf-market" aria-labelledby="nf-market-title">
      <div className="nf-card__head">
        <h2 id="nf-market-title">Mercado</h2>
        {total > 0 && (
          <Button icon={<CopyOutlined />} onClick={() => void copyList()}>
            Copiar lista
          </Button>
        )}
      </div>
      {!plan ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : total === 0 ? (
        <div className="nf-empty">Planea algunas comidas y aquí sale lo que hay que comprar, sumado.</div>
      ) : (
        <>
          <p className="nf-hint" style={{ margin: 0 }}>
            {checked.size} de {total} en el carrito. Lo cocido (arroz, fríjoles, pasta) va también en crudo.
          </p>
          {plan.shopping.map((g) => (
            <div key={g.category} className="nf-market__group">
              <h3 className="nf-subtitle">{g.category}</h3>
              <ul className="nf-market__list">
                {g.items.map((i) => (
                  <li key={i.foodId} className={checked.has(i.foodId) ? "is-checked" : ""}>
                    <Checkbox checked={checked.has(i.foodId)} onChange={() => toggle(i.foodId)}>
                      <span className="nf-market__name">{i.name.split(",")[0]}</span>
                      <small>{i.amount}</small>
                    </Checkbox>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );

  return (
    <div className="nf-planpage">
      <div className="nf-planpage__intro">
        <button type="button" className="nf-back" onClick={() => navigate("/app/nutrifer/cocina")}>
          ‹ Cocina
        </button>
        <h1 className="nf-page-title">Plan de la semana</h1>
        <div className="nf-weeknav">
          <Button shape="circle" icon={<LeftOutlined />} aria-label="Semana anterior" onClick={() => setWeek(dayjs(week).subtract(7, "day").format("YYYY-MM-DD"))} />
          <span className="nf-weeknav__label">{label}</span>
          <Button shape="circle" icon={<RightOutlined />} aria-label="Semana siguiente" onClick={() => setWeek(dayjs(week).add(7, "day").format("YYYY-MM-DD"))} />
          {week !== thisWeek && (
            <button type="button" className="nf-link" onClick={() => setWeek(thisWeek)}>
              Esta semana
            </button>
          )}
        </div>
      </div>
      {isMobile ? (
        <>
          <Segmented
            block
            value={view}
            onChange={(v) => setView(v as typeof view)}
            options={[
              { label: "Plan", value: "plan" },
              { label: total ? `Mercado (${total})` : "Mercado", value: "market" },
            ]}
          />
          {view === "plan" ? planView : marketView}
        </>
      ) : (
        <div className="nf-planpage__cols">
          {planView}
          {marketView}
        </div>
      )}
      <PlanPicker
        target={target}
        mealNames={plan?.mealNames ?? { DESAYUNO: "Desayuno", MEDIAS_NUEVES: "Medias nueves", ALMUERZO: "Almuerzo", ONCES: "Onces", COMIDA: "Comida" }}
        onClose={() => setTarget(null)}
        onPick={async (kind, refId, meal) => {
          if (!target) return;
          try {
            await addPlanItem({ date: target.date, meal, kind, refId });
            message.success("Quedó en el plan");
            setTarget(null);
            await load();
          } catch (err) {
            message.error(apiErrorMessage(err, "No se pudo agregar al plan"));
          }
        }}
      />
    </div>
  );
}
