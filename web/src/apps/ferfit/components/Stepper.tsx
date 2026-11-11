import { MinusOutlined, PlusOutlined } from "@ant-design/icons";

type Props = {
  /** Lo que se cuenta, para los lectores de pantalla: «Repeticiones hechas». */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
};

/** Un número con botones grandes de menos y más (para ajustar con el dedo mientras se entrena). */
export function Stepper({ label, value, min, max, step = 1, unit, onChange }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <div className="fit-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Menos: ${label.toLowerCase()}`}>
        <MinusOutlined />
      </button>
      <output aria-live="polite">
        {value}
        {unit ? <small> {unit}</small> : null}
      </output>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`Más: ${label.toLowerCase()}`}>
        <PlusOutlined />
      </button>
    </div>
  );
}
