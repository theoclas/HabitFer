import { useFinanceContext } from "../context/FinanceContext";
import { ACCOUNT_KIND_ICONS } from "../types";

type Props = {
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  /** Una cuenta que no se puede elegir (la de salida en una transferencia). */
  exclude?: string | null;
};

/** Tus cuentas activas en botones, con su ícono. */
export function AccountChips({ value, onChange, label, exclude }: Props) {
  const { accounts } = useFinanceContext();
  return (
    <div className="ff-chips" role="radiogroup" aria-label={label}>
      {accounts
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            className="ff-pick"
            onClick={() => onChange(a.id)}
            style={{ ["--ff-account" as string]: a.color ?? undefined }}
          >
            <span aria-hidden="true">{ACCOUNT_KIND_ICONS[a.kind]}</span>
            {a.name}
          </button>
        ))}
    </div>
  );
}
