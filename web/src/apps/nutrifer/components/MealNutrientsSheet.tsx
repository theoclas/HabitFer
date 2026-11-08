import { Drawer } from "antd";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { kcalText } from "../math";
import type { DayTargets, MealView, Totals } from "../types";
import { amountText, NUTRIENTS } from "./Nutrients";

type Props = {
  meal: MealView | null;
  /** Lo del día entero, para decir cuánto pesa esta comida. */
  dayTotals: Totals | null;
  targets: DayTargets | null;
  onClose: () => void;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Los nutrientes de una comida: el total, qué parte del día y de la meta es, y lo de cada alimento. */
export function MealNutrientsSheet({ meal, dayTotals, targets, onClose }: Props) {
  const isMobile = useIsMobile();
  return (
    <Drawer
      title={meal ? `Nutrientes de ${meal.name.toLowerCase()}` : "Nutrientes"}
      open={meal !== null}
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
      {meal && (
        <div className="nf-detail">
          <header>
            <h3 className="nf-detail__name">
              {kcalText(meal.totals.kcal)} kcal
            </h3>
            <p className="nf-detail__source">
              {dayTotals && dayTotals.kcal > 0 ? `El ${pct(meal.totals.kcal, dayTotals.kcal)} % de lo comido en el día` : "Lo comido en esta comida"}
              {targets ? ` · el ${pct(meal.totals.kcal, targets.kcal)} % de tu meta` : ""}
            </p>
          </header>

          <table className="nf-ntable">
            <caption className="nf-sr">Nutrientes de la comida contra la meta del día</caption>
            <thead>
              <tr>
                <th scope="col">Nutriente</th>
                <th scope="col">En la comida</th>
                <th scope="col">De la meta</th>
              </tr>
            </thead>
            <tbody>
              {NUTRIENTS.map((n) => {
                // Fibra, azúcar y sodio: solo cuentan los alimentos que traen el dato.
                const k = n.key;
                const extra = k === "fiber" || k === "sugar" || k === "sodium";
                const withData = extra ? meal.entries.filter((e) => e.known?.[k]).length : meal.entries.length;
                const none = extra && withData === 0;
                const partial = extra && withData > 0 && withData < meal.entries.length;
                return (
                  <tr key={k}>
                    <th scope="row">
                      {n.label}
                      <small className="nf-kind">{n.kind}</small>
                    </th>
                    <td>
                      {none ? "sin dato" : `${amountText(meal.totals[k], n.unit)} ${n.unit}`}
                      {partial && <small className="nf-kind">parcial</small>}
                    </td>
                    <td>{targets && !none ? `${pct(meal.totals[k], targets[k])} %` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <div className="nf-section-label">Lo que lleva</div>
            {meal.entries.length === 0 ? (
              <div className="nf-empty">Aún no hay nada anotado.</div>
            ) : (
              <ul className="nf-nlist">
                {meal.entries.map((e) => (
                  <li key={e.id}>
                    <div className="nf-nlist__head">
                      <span>
                        {e.name}
                        {e.amount && <small>{e.amount}</small>}
                      </span>
                      <b>{kcalText(e.kcal)} kcal</b>
                    </div>
                    {e.quick ? (
                      <p className="nf-nlist__line">Registro rápido: solo calorías{e.protein + e.carbs + e.fat > 0 ? " y macros" : ""}.</p>
                    ) : (
                      <p className="nf-nlist__line">
                        Proteína {amountText(e.protein, "g")} g · Carbohidratos {amountText(e.carbs, "g")} g · Grasa {amountText(e.fat, "g")} g
                        {e.fiber ? ` · Fibra ${amountText(e.fiber, "g")} g` : ""}
                        {e.sugar ? ` · Azúcar ${amountText(e.sugar, "g")} g` : ""}
                        {e.sodium ? ` · Sodio ${amountText(e.sodium, "mg")} mg` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
