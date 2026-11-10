import { Select } from "antd";
import { useFinanceContext } from "../context/FinanceContext";
import { decodeScope, encodeScope } from "../movements";
import { ACCOUNT_KIND_ICONS, ACCOUNT_TYPE_LABELS, type FinanceAccountType } from "../types";

const BOOK_ORDER: FinanceAccountType[] = ["PERSONAL", "BUSINESS", "OTHER"];

/** Qué mirar en todas las pantallas: todo, un libro (Personal o Negocio) o una cuenta. */
export function ScopeSelector() {
  const { accountId, book, setScope, accounts } = useFinanceContext();
  const books = BOOK_ORDER.filter((b) => accounts.some((a) => a.type === b));

  const options = [
    { value: "", label: "Todas mis cuentas" },
    ...(books.length > 1 ? books.map((b) => ({ value: `book:${b}`, label: `Todo el libro ${ACCOUNT_TYPE_LABELS[b]}` })) : []),
    ...books.map((b) => ({
      label: books.length > 1 ? ACCOUNT_TYPE_LABELS[b] : "Cuentas",
      title: ACCOUNT_TYPE_LABELS[b],
      options: accounts
        .filter((a) => a.type === b)
        .map((a) => ({
          value: `acc:${a.id}`,
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true">{ACCOUNT_KIND_ICONS[a.kind]}</span>
              {a.name}
            </span>
          ),
        })),
    })),
  ];

  return (
    <Select
      aria-label="Qué mirar"
      style={{ minWidth: 210 }}
      value={encodeScope({ accountId, book })}
      onChange={(v: string) => setScope(decodeScope(v))}
      options={options}
      popupMatchSelectWidth={false}
    />
  );
}
