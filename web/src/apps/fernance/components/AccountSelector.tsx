import { Select } from "antd";
import { useFinanceContext } from "../context/FinanceContext";

/** Filtro por cuenta de todas las pantallas (vacío = todas). */
export function AccountSelector() {
  const { accountId, setAccountId, accounts } = useFinanceContext();

  return (
    <Select
      allowClear
      placeholder="Todas las cuentas"
      aria-label="Filtrar por cuenta"
      style={{ minWidth: 190 }}
      value={accountId ?? undefined}
      onChange={(v) => setAccountId(v ?? null)}
      options={accounts.map((a) => ({
        value: a.id,
        label: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ff-dot" style={{ background: a.color ?? undefined }} />
            {a.name}
          </span>
        ),
      }))}
    />
  );
}
