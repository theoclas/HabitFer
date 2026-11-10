import { InputNumber, type InputNumberProps } from "antd";
import { formatThousands, parseMoneyInput } from "../money";

const MAX = 999_999_999_999;

type Props = Omit<InputNumberProps<number>, "formatter" | "parser" | "precision">;

/**
 * Campo de plata en pesos: muestra 1.500.000 y guarda exactamente lo que se ve. Antes el formato con puntos no
 * tenía su lector y, al editar, se guardaba el valor viejo sin avisar.
 */
export function MoneyInput(props: Props) {
  return (
    <InputNumber<number>
      min={1}
      max={MAX}
      step={1000}
      prefix="$"
      inputMode="numeric"
      style={{ width: "100%" }}
      {...props}
      precision={0}
      formatter={(value) => formatThousands(value)}
      // Vacío = sin valor (no cero), para que el campo obligatorio avise.
      parser={(text) => {
        const n = parseMoneyInput(text);
        return (n === null ? "" : n) as unknown as number;
      }}
    />
  );
}
