import { Select } from "antd";
import { useEffect, useState } from "react";
import { fetchFinanceAccounts } from "../../../api/client";
import type { FinanceAccount } from "../../../types/fernance";
import { useFinanceContext } from "../context/FinanceContext";

export function AccountSelector() {
  const { accountId, setAccountId } = useFinanceContext();
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);

  useEffect(() => {
    void fetchFinanceAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  return (
    <Select
      allowClear
      placeholder="Todas las cuentas"
      style={{ minWidth: 200 }}
      value={accountId ?? undefined}
      onChange={(v) => setAccountId(v ?? null)}
      options={[
        ...accounts.map((a) => ({
          value: a.id,
          label: (
            <span>
              <span className="fern-account-dot" style={{ background: a.color ?? "#D4AF37" }} />
              {a.name}
            </span>
          ),
        })),
      ]}
    />
  );
}
