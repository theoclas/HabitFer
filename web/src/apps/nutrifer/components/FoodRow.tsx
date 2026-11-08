import { LoadingOutlined, PlusOutlined, StarFilled } from "@ant-design/icons";
import type { AmountLine } from "../format";
import { kcalText } from "../math";
import type { FoodResult } from "../types";

function Badge({ food }: { food: FoodResult }) {
  if (food.source === "RECIPE") return <span className="nf-badge nf-badge--recipe">Receta</span>;
  if (food.source === "USER") return <span className="nf-badge nf-badge--own">Tuyo</span>;
  if (food.isDish || food.source === "DISH") return <span className="nf-badge nf-badge--dish">Plato</span>;
  if (food.source === "P18") return <span className="nf-badge">ICBF</span>;
  return null;
}

type Props = {
  food: FoodResult;
  amount: AmountLine;
  favorite?: boolean;
  opening: boolean;
  quickBusy?: boolean;
  onOpen: () => void;
  /** Agregar con un toque (la cantidad que dice la fila). */
  onQuick?: () => void;
  quickLabel?: string;
};

/** Fila de un alimento: abrirlo para elegir la cantidad o, con «+», agregarlo de un toque. */
export function FoodRow({ food, amount, favorite, opening, quickBusy, onOpen, onQuick, quickLabel }: Props) {
  return (
    <div className="nf-result">
      <button type="button" className="nf-result__main" onClick={onOpen}>
        <span className="nf-result__name">
          {favorite && <StarFilled className="nf-star-mini" aria-label="Favorito" />}
          {food.name}
        </span>
        <span className="nf-result__meta">
          <Badge food={food} />
          {amount.text}
        </span>
      </button>
      <span className="nf-result__side">
        <span className="nf-result__kcal">
          {opening ? <LoadingOutlined /> : kcalText(amount.kcal)} <small>kcal</small>
        </span>
        {onQuick && (
          <button type="button" className="nf-quick" onClick={onQuick} disabled={quickBusy} aria-label={quickLabel ?? `Agregar ${food.name}, ${amount.text}`}>
            {quickBusy ? <LoadingOutlined /> : <PlusOutlined />}
          </button>
        )}
      </span>
    </div>
  );
}
