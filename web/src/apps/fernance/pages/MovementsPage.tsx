import { CheckSquareOutlined, CloseOutlined, DeleteOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Badge, Button, DatePicker, Drawer, Input, Select, Skeleton, Switch } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { bulkTransactions, fetchMovements } from "../api";
import { EmptyState, longDate } from "../components/bits";
import { CategoryPickerModal } from "../components/CategoryPicker";
import { Money } from "../components/Money";
import { MoneyInput } from "../components/MoneyInput";
import { MovementRow } from "../components/MovementRow";
import { PeriodPicker } from "../components/PeriodPicker";
import { ScopeSelector } from "../components/ScopeSelector";
import { monthLabel, rangeLabel, useFinanceContext } from "../context/FinanceContext";
import { formatCop, formatCopSigned } from "../money";
import { categoryLabel, categoryTree, dayHeading, firstReconciled, groupByDay } from "../movements";
import { MOVEMENT_TYPE_LABELS, type CategoryKind, type MovementItem, type MovementType, type MovementsResponse } from "../types";

const BASE = "/app/fernance";
const TYPES: MovementType[] = ["EXPENSE", "INCOME", "TRANSFER", "INSTALLMENT", "ADJUSTMENT"];

function readType(value: string | null): MovementType | "" {
  return value && (TYPES as string[]).includes(value) ? (value as MovementType) : "";
}

export function MovementsPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const { scopeParams, accountId, bounds, periodMode, year, month, accounts, categories, openQuickAdd, dataVersion, bumpData } = useFinanceContext();

  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const type = readType(params.get("tipo"));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [allDates, setAllDates] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<MovementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayKey();

  // La búsqueda espera a que dejes de escribir.
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const setType = (t: MovementType | "") => {
    const next = new URLSearchParams(params);
    if (t) next.set("tipo", t);
    else next.delete("tipo");
    setParams(next, { replace: true });
  };

  const request = useMemo(
    () => ({
      ...scopeParams,
      ...(allDates ? {} : { from: bounds.from, to: bounds.to }),
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(q ? { q } : {}),
      ...(min !== null ? { min } : {}),
      ...(max !== null ? { max } : {}),
    }),
    [scopeParams, allDates, bounds.from, bounds.to, type, categoryId, q, min, max],
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchMovements(request));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudieron cargar los movimientos."));
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  useEffect(() => {
    setData(null);
    setSelected(new Set());
  }, [request]);

  const groups = useMemo(() => groupByDay(data?.items ?? []), [data]);
  const periodName = allDates ? "todas las fechas" : periodMode === "month" ? monthLabel(year, month) : rangeLabel(bounds.from, bounds.to);
  const activeFilters = [categoryId, min, max].filter((v) => v !== null).length + (allDates ? 1 : 0);
  const selectedItems = (data?.items ?? []).filter((m) => selected.has(m.id) && m.kind === "tx");
  const bulkKind: CategoryKind = selectedItems.length > 0 && selectedItems.every((m) => m.type === "INCOME") ? "INCOME" : "EXPENSE";

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = (m: MovementItem) => {
    if (m.kind === "installment") {
      if (m.creditId) navigate(`${BASE}/credits/${m.creditId}`);
    } else openQuickAdd({ edit: m });
  };

  const runBulk = async (payload: { delete?: boolean; categoryId?: string | null; accountId?: string; date?: string }, done: string) => {
    const ids = selectedItems.map((m) => m.id);
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await bulkTransactions({ ids, ...payload });
      message.success(r.skipped ? `${done} ${r.count}. ${r.skipped} no aplicaban (por ejemplo, transferencias sin categoría).` : `${done} ${r.count}.`);
      setSelected(new Set());
      setSelecting(false);
      bumpData();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cambiar"));
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = () =>
    modal.confirm({
      title: `¿Borrar ${selectedItems.length === 1 ? "1 movimiento" : `${selectedItems.length} movimientos`}?`,
      content: "No se puede deshacer.",
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: () => runBulk({ delete: true }, "Borrados:"),
    });

  const reconciled = data?.reconciled ?? null;
  // La marca «revisado hasta aquí» va justo antes del primer movimiento que ya estaba cuadrado.
  const markId = firstReconciled(data?.items ?? [], reconciled);
  const reconciledMark = reconciled && (
    <div className={`ff-reconciled${reconciled.stale ? " is-stale" : ""}`} role="note">
      {reconciled.stale
        ? `⚠ Cambió algo de lo que ya estaba cuadrado (hasta el ${longDate(reconciled.date, today)}): ya no cuadra con el banco. Vuelve a cuadrar la cuenta.`
        : `✓ Revisado hasta aquí: cuadraba con el banco (${formatCop(reconciled.balance)}) el ${longDate(reconciled.date, today)}.`}
    </div>
  );

  const filterControls = (
    <div className="ff-filters">
      <label className="ff-field">
        <span>Categoría</span>
        <Select
          allowClear
          showSearch
          placeholder="Todas"
          value={categoryId ?? undefined}
          onChange={(v: string | undefined) => setCategoryId(v ?? null)}
          optionFilterProp="label"
          options={(["EXPENSE", "INCOME"] as CategoryKind[]).map((k) => ({
            label: k === "EXPENSE" ? "Gastos" : "Ingresos",
            title: k,
            options: categoryTree(categories, k).flatMap(({ parent, children }) => [
              { value: parent.id, label: `${parent.icon ?? ""} ${parent.name}`.trim() },
              ...children.map((c) => ({ value: c.id, label: `    ${c.icon ?? ""} ${categoryLabel(categories, c.id)}` })),
            ]),
          }))}
        />
      </label>
      <div className="ff-field ff-field--row">
        <label className="ff-field">
          <span>Desde $</span>
          <MoneyInput min={0} value={min ?? undefined} onChange={(v) => setMin(v === null || v === undefined ? null : Math.round(Number(v)))} aria-label="Monto mínimo" />
        </label>
        <label className="ff-field">
          <span>Hasta $</span>
          <MoneyInput min={0} value={max ?? undefined} onChange={(v) => setMax(v === null || v === undefined ? null : Math.round(Number(v)))} aria-label="Monto máximo" />
        </label>
      </div>
      <label className="ff-field ff-field--switch">
        <Switch checked={allDates} onChange={setAllDates} />
        <span>Buscar en todas las fechas</span>
      </label>
      {activeFilters > 0 && (
        <Button
          onClick={() => {
            setCategoryId(null);
            setMin(null);
            setMax(null);
            setAllDates(false);
          }}
        >
          Quitar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="ff-page">
      <div className="ff-pagehead">
        <div>
          <h1 className="ff-title">Movimientos</h1>
          <p className="ff-subtitle">Gastos, ingresos, transferencias y cuotas de {periodName}.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openQuickAdd(accountId ? { accountId } : {})}>
          Anotar
        </Button>
      </div>

      <div className="ff-toolbar">
        <ScopeSelector />
        {!allDates && <PeriodPicker />}
      </div>

      <div className="ff-toolbar ff-toolbar--search">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Buscar: almuerzo, Rappi, 18.000…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar movimientos"
          className="ff-search"
        />
        <Select
          aria-label="Tipo de movimiento"
          value={type}
          onChange={(v: MovementType | "") => setType(v)}
          style={{ minWidth: isMobile ? 118 : 150 }}
          options={[{ value: "", label: "Todo" }, ...TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABELS[t] }))]}
        />
        {isMobile ? (
          <Badge count={activeFilters} size="small">
            <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>
              Filtros
            </Button>
          </Badge>
        ) : null}
        <Button
          icon={selecting ? <CloseOutlined /> : <CheckSquareOutlined />}
          onClick={() => {
            setSelecting((s) => !s);
            setSelected(new Set());
          }}
        >
          {selecting ? "Cancelar" : isMobile ? "Escoger" : "Escoger varios"}
        </Button>
      </div>
      {!isMobile && filterControls}

      {data && (
        <div className="ff-totals" aria-live="polite">
          <span>
            Entró <Money value={data.totals.income} tone="in" />
          </span>
          <span>
            Salió <Money value={data.totals.expense + data.totals.installments} tone="out" />
          </span>
          {data.totals.transfersIn + data.totals.transfersOut > 0 && (
            <span>
              Transferencias <b>{formatCopSigned(data.totals.transfersIn - data.totals.transfersOut)}</b>
            </span>
          )}
          {data.totals.adjustments !== 0 && (
            <span>
              Ajustes <b>{formatCopSigned(data.totals.adjustments)}</b>
            </span>
          )}
          <span className="ff-totals__net">
            Neto <Money value={data.totals.net} signed tone="auto" />
          </span>
          <span className="ff-hint">{data.totals.count === 1 ? "1 movimiento" : `${data.totals.count} movimientos`}</span>
        </div>
      )}

      {error && (
        <EmptyState title="No se pudieron cargar los movimientos" action={<Button onClick={() => void load()}>Reintentar</Button>}>
          {error}
        </EmptyState>
      )}
      {!data && !error && <Skeleton active paragraph={{ rows: 8 }} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={q || type || activeFilters ? "Nada con esos filtros" : "Nada anotado aquí"}
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openQuickAdd(accountId ? { accountId } : {})} disabled={!accounts.length}>
              Anotar
            </Button>
          }
        >
          {q || type || activeFilters
            ? "Prueba con otra palabra, otro tipo o busca en todas las fechas."
            : accounts.length
              ? "Anota tus gastos, ingresos y transferencias, y aquí los ves por día."
              : "Primero crea una cuenta en la pestaña Cuentas."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <section className="ff-card ff-card--list" aria-label={`Movimientos de ${periodName}`}>
          {groups.map((g) => (
            <Fragment key={g.date}>
              {g.items[0]?.id === markId && reconciledMark}
              <div className="ff-day">
                <span className="ff-day__name">{dayHeading(g.date, today)}</span>
                {g.net !== 0 && <Money value={g.net} signed tone="auto" className="ff-day__net" />}
              </div>
              <div className="ff-list">
                {g.items.map((m, k) => (
                  <Fragment key={`${m.kind}-${m.id}`}>
                    {k > 0 && m.id === markId && reconciledMark}
                    <MovementRow
                      m={m}
                      onOpen={() => open(m)}
                      selectable={selecting}
                      selected={selected.has(m.id)}
                      onToggle={() => toggle(m.id)}
                    />
                  </Fragment>
                ))}
              </div>
            </Fragment>
          ))}
          {reconciled && markId === null && reconciledMark}
          {data.truncated && <p className="ff-hint">Se muestran los primeros {data.items.length}. Los totales de arriba son de todos.</p>}
        </section>
      )}

      {selecting && (
        <div className="ff-bulkbar" role="toolbar" aria-label="Cambiar los escogidos">
          <span className="ff-bulkbar__count">{selectedItems.length === 1 ? "1 escogido" : `${selectedItems.length} escogidos`}</span>
          <Button disabled={!selectedItems.length || busy} onClick={() => setBulkCategoryOpen(true)}>
            Categoría
          </Button>
          <Select
            placeholder="Cuenta"
            disabled={!selectedItems.length || busy}
            value={null}
            onChange={(v: string) => void runBulk({ accountId: v }, "Cambiados de cuenta:")}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            style={{ minWidth: 120 }}
            aria-label="Pasar a otra cuenta"
          />
          <DatePicker
            placeholder="Fecha"
            disabled={!selectedItems.length || busy}
            value={null as Dayjs | null}
            onChange={(d: Dayjs | null) => d && void runBulk({ date: d.format("YYYY-MM-DD") }, "Cambiados de fecha:")}
            disabledDate={(d) => d.isAfter(dayjs(today), "day")}
            format="D MMM"
            inputReadOnly={isMobile}
            aria-label="Cambiar la fecha"
          />
          <Button danger icon={<DeleteOutlined />} disabled={!selectedItems.length || busy} onClick={bulkDelete} aria-label="Borrar los escogidos" />
        </div>
      )}

      <Drawer
        title="Filtros"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        placement="bottom"
        size="72dvh"
        rootClassName="ff-drawer"
        styles={{ body: { paddingBottom: "max(24px, env(safe-area-inset-bottom))" } }}
      >
        {filterControls}
        <Button type="primary" block style={{ marginTop: 16 }} onClick={() => setFiltersOpen(false)}>
          Ver resultados
        </Button>
      </Drawer>

      <CategoryPickerModal
        open={bulkCategoryOpen}
        kind={bulkKind}
        title={`Categoría para ${selectedItems.length === 1 ? "1 movimiento" : `${selectedItems.length} movimientos`}`}
        onClose={() => setBulkCategoryOpen(false)}
        onPick={(id) => {
          setBulkCategoryOpen(false);
          void runBulk({ categoryId: id }, "Con categoría nueva:");
        }}
      />
    </div>
  );
}
