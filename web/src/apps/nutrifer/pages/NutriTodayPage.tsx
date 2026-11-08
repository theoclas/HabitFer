import { CloseOutlined, CopyOutlined, LeftOutlined, RetweetOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Modal, Skeleton, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { addWater, copyEntries, deletePhoto, fetchDay, removeEntries, repeatEntry } from "../api";
import { forgetPhoto } from "../hooks";
import { AddFoodSheet } from "../components/AddFoodSheet";
import { CopyModal, type CopySource } from "../components/CopyModal";
import { CalorieRing, MacroBars } from "../components/DaySummary";
import { EntrySheet } from "../components/EntrySheet";
import { MealCard } from "../components/MealCard";
import { MealNutrientsSheet } from "../components/MealNutrientsSheet";
import { NutrientBars } from "../components/Nutrients";
import { SaveMealModal, type SaveSource } from "../components/SaveMealModal";
import { notifyUndo } from "../components/undo";
import { WaterCard } from "../components/WaterCard";
import { WeekStrip } from "../components/WeekStrip";
import { inMeal, thingsText } from "../format";
import { kcalText, mlText, relativeDay } from "../math";
import type { DayView, Entry, MealSlot, MealView, PendingPhoto, Remaining, Suggestion } from "../types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dayTitle(key: string): { title: string; subtitle: string } {
  const d = dayjs(key);
  const today = dayjs(todayKey());
  const subtitle = cap(d.format("dddd D [de] MMMM"));
  if (d.isSame(today, "day")) return { title: "Hoy", subtitle };
  if (d.isSame(today.subtract(1, "day"), "day")) return { title: "Ayer", subtitle };
  return { title: cap(d.format("dddd D")), subtitle: cap(d.format("MMMM [de] YYYY")) };
}

/* «Lo de siempre» que se dejó para otro día: vive en este teléfono, solo por unos días. */
const HIDE_KEY = "nf_hide_";

function readHidden(date: string): Set<string> {
  try {
    const raw = localStorage.getItem(HIDE_KEY + date);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeHidden(date: string, keys: Set<string>) {
  try {
    localStorage.setItem(HIDE_KEY + date, JSON.stringify([...keys]));
    const old = dayjs(date).subtract(3, "day").format("YYYY-MM-DD");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(HIDE_KEY) && k.slice(HIDE_KEY.length) < old) localStorage.removeItem(k);
    }
  } catch {
    // Sin almacenamiento (ventana privada): solo dura mientras la pantalla está abierta.
  }
}

/* El aviso de «tu meta se ajustó» se cierra por semana (en este teléfono). */
const ADJUST_KEY = "nf_adjust_seen_";

function adjustSeen(weekStart: string): boolean {
  try {
    return localStorage.getItem(ADJUST_KEY + weekStart) === "1";
  } catch {
    return false;
  }
}

function markAdjustSeen(weekStart: string) {
  try {
    localStorage.setItem(ADJUST_KEY + weekStart, "1");
  } catch {
    // Sin almacenamiento: se vuelve a mostrar la próxima vez.
  }
}

/** El diario del día: anillo de calorías, macros, agua, las cinco comidas y lo de un toque. */
export function NutriTodayPage() {
  const navigate = useNavigate();
  const today = todayKey();
  const [date, setDate] = useState(todayKey);
  const [day, setDay] = useState<DayView | null>(null);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  /** Foto pendiente que se está completando (abre «escribe o dicta» con la foto). */
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [copySource, setCopySource] = useState<CopySource | null>(null);
  const [saveSource, setSaveSource] = useState<SaveSource | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(todayKey()));
  /** La comida cuyos nutrientes se están viendo. */
  const [nutrientsOf, setNutrientsOf] = useState<MealSlot | null>(null);
  const [adjustClosed, setAdjustClosed] = useState<string | null>(null);
  const waterSeq = useRef(0);
  // Diálogos con el tema de NutriFer (Modal.confirm a secas no lo hereda).
  const [modal, modalHolder] = Modal.useModal();

  const load = useCallback(async () => {
    try {
      setDay(await fetchDay(date));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cargar el día"));
    }
  }, [date]);

  useEffect(() => {
    setDay((d) => (d && d.date === date ? d : null));
    setHidden(readHidden(date));
    void load();
  }, [load, date]);

  const isToday = date === today;
  const { title, subtitle } = dayTitle(date);
  const shift = (days: number) => setDate(dayjs(date).add(days, "day").format("YYYY-MM-DD"));
  const mealName = (slot: MealSlot | null) => day?.meals.find((m) => m.slot === slot)?.name ?? "la comida";
  const mealList = day?.meals.map((m) => ({ slot: m.slot, name: m.name })) ?? [];
  const entryCount = day?.meals.reduce((n, m) => n + m.entries.length, 0) ?? 0;

  const remaining: Remaining | null = day?.targets
    ? {
        kcal: day.targets.kcal - day.totals.kcal,
        protein: day.targets.protein - day.totals.protein,
        carbs: day.targets.carbs - day.totals.carbs,
        fat: day.targets.fat - day.totals.fat,
      }
    : null;
  // Al editar algo, lo que falta cuenta como si eso no estuviera anotado.
  const remainingWithout = (e: Entry | null): Remaining | null =>
    remaining && e ? { kcal: remaining.kcal + e.kcal, protein: remaining.protein + e.protein, carbs: remaining.carbs + e.carbs, fat: remaining.fat + e.fat } : remaining;

  /** Recarga y avisa con «Deshacer» (borra lo recién creado). */
  const undoable = (text: string, created: Entry[]) => {
    notifyUndo(text, async () => {
      try {
        await removeEntries(created.map((e) => e.id));
        await load();
      } catch (err) {
        message.error(apiErrorMessage(err, "No se pudo deshacer"));
      }
    });
  };

  const confirm = async (slot: MealSlot, s: Suggestion) => {
    setBusyKey(`s:${s.entryId}`);
    try {
      const e = await repeatEntry(s.entryId, { date, meal: slot });
      await load();
      undoable(`${s.name} quedó en ${inMeal(mealName(slot))}`, [e]);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo anotar"));
    } finally {
      setBusyKey(null);
    }
  };

  const dismiss = (slot: MealSlot, s: Suggestion) => {
    const next = new Set(hidden);
    next.add(`${slot}:${s.foodId}`);
    setHidden(next);
    writeHidden(date, next);
  };

  const repeatMeal = async (m: MealView) => {
    if (!m.previous) return;
    setBusyKey(`r:${m.slot}`);
    try {
      const r = await copyEntries({ fromDate: m.previous.date, fromMeal: m.slot, toDate: date });
      await load();
      undoable(`Repetido en ${inMeal(m.name)}: ${thingsText(r.entries.length)} · ${kcalText(r.kcal)} kcal`, r.entries);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo repetir"));
    } finally {
      setBusyKey(null);
    }
  };

  const repeatDay = async () => {
    const prev = day?.previousDay;
    if (!prev) return;
    setBusyKey("day");
    try {
      const r = await copyEntries({ fromDate: prev.date, toDate: date });
      await load();
      undoable(`Repetido ${relativeDay(prev.date, date) === "ayer" ? "lo de ayer" : `lo del ${relativeDay(prev.date, date).replace(/^el /, "")}`}: ${thingsText(r.entries.length)} · ${kcalText(r.kcal)} kcal`, r.entries);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo repetir"));
    } finally {
      setBusyKey(null);
    }
  };

  const clearMeal = (m: MealView) => {
    modal.confirm({
      title: `¿Vaciar ${m.name.toLowerCase()}?`,
      content: `Se ${m.entries.length === 1 ? "borra" : "borran"} ${thingsText(m.entries.length)} (${kcalText(m.totals.kcal)} kcal).`,
      okText: "Vaciar",
      okButtonProps: { danger: true },
      cancelText: "No",
      rootClassName: "nf-drawer",
      centered: true,
      onOk: async () => {
        try {
          await removeEntries(m.entries.map((e) => e.id));
          await load();
          message.success(`${m.name} quedó vacío`);
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo vaciar"));
        }
      },
    });
  };

  const removePhoto = (p: PendingPhoto) => {
    modal.confirm({
      title: "¿Borrar la foto?",
      content: "Se borra sin anotar nada. Si ya anotaste lo que había, está bien borrarla.",
      okText: "Borrar",
      okButtonProps: { danger: true },
      cancelText: "No",
      rootClassName: "nf-drawer",
      centered: true,
      onOk: async () => {
        try {
          await deletePhoto(p.id);
          forgetPhoto(p.id);
          await load();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo borrar la foto"));
        }
      },
    });
  };

  /** Agua: se ve al instante; la respuesta del servidor manda (la última que llegue). */
  const changeWater = async (deltaMl: number) => {
    if (!day || deltaMl === 0) return;
    const seq = ++waterSeq.current;
    const key = date;
    setDay((d) => (d && d.date === key ? { ...d, water: { ...d.water, ml: Math.max(0, d.water.ml + deltaMl) } } : d));
    try {
      const r = await addWater(key, deltaMl);
      if (seq === waterSeq.current) setDay((d) => (d && d.date === key ? { ...d, water: { ...d.water, ml: r.ml } } : d));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el agua"));
      void load();
    }
  };

  const waterFromSheet = () => {
    if (!day) return;
    const after = day.water.ml + day.water.glassMl;
    void changeWater(day.water.glassMl);
    message.success(`Un vaso de agua más · ${mlText(after)} de ${mlText(day.water.goalMl)}`);
  };

  const prevDay = day?.previousDay;
  const prevDayText = prevDay ? relativeDay(prevDay.date, date) : "";

  const copyDay = () => setCopySource({ date, meal: null, label: `el día de ${relativeDay(date, today)}` });

  return (
    <>
      {modalHolder}
      {/* En el teléfono va todo en una columna; en el computador, un panel fijo a la izquierda y las comidas a la derecha. */}
      <div className="nf-today">
        <aside className="nf-today__side" aria-label="Resumen del día">
          <div className="nf-daynav">
            <Button shape="circle" size="large" icon={<LeftOutlined />} aria-label="Día anterior" onClick={() => shift(-1)} />
            <h1 className="nf-daynav__title">
              {title}
              <small>
                {subtitle}
                {!isToday && (
                  <>
                    {" · "}
                    <button type="button" onClick={() => setDate(todayKey())}>
                      Ir a hoy
                    </button>
                  </>
                )}
              </small>
            </h1>
            <Button shape="circle" size="large" icon={<RightOutlined />} aria-label="Día siguiente" disabled={isToday} onClick={() => shift(1)} />
          </div>

          {!day ? (
            <div className="nf-summary">
              <Skeleton active paragraph={{ rows: 3 }} style={{ gridColumn: "1 / -1" }} />
            </div>
          ) : (
            <>
              <section className="nf-summary">
                <CalorieRing eaten={day.totals.kcal} target={day.targets?.kcal ?? null} />
                <MacroBars totals={day.totals} targets={day.targets} />
                <div className="nf-summary__foot">
                  <span>
                    Comido <b>{kcalText(day.totals.kcal)}</b> kcal
                  </span>
                  {day.targets ? (
                    <span>
                      Meta <b>{kcalText(day.targets.kcal)}</b> kcal
                    </span>
                  ) : (
                    <span>Sin meta todavía</span>
                  )}
                </div>
              </section>

              {!day.targets && (
                <div className="nf-callout">
                  <p>
                    <b>Calcula tu meta en un minuto.</b> Con tu peso, estatura y objetivo te digo cuántas calorías y cuánta proteína te tocan al día.
                  </p>
                  <Button type="primary" onClick={() => navigate("/app/nutrifer/meta")}>
                    Calcular mi meta
                  </Button>
                </div>
              )}

              {day.adjust && isToday && adjustClosed !== day.adjust.weekStart && !adjustSeen(day.adjust.weekStart) && (
                <div className="nf-callout nf-callout--adjust" role="status">
                  <p>
                    <b>
                      Tu meta se ajustó esta semana: {kcalText(day.adjust.before)} → {kcalText(day.adjust.after)} kcal.
                    </b>{" "}
                    {day.adjust.observed != null
                      ? day.adjust.after > day.adjust.before
                        ? "Con tu peso y lo que comes, gastas más de lo que decía la fórmula."
                        : "Con tu peso y lo que comes, gastas menos de lo que decía la fórmula."
                      : "Se revisó con tu peso de tendencia."}
                  </p>
                  <div className="nf-callout__actions">
                    <Button onClick={() => navigate("/app/nutrifer/progreso")}>Ver por qué</Button>
                    <button
                      type="button"
                      className="nf-icon-btn nf-icon-btn--sm"
                      aria-label="Cerrar el aviso"
                      onClick={() => {
                        markAdjustSeen(day.adjust!.weekStart);
                        setAdjustClosed(day.adjust!.weekStart);
                      }}
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                </div>
              )}

              {day.targets && <NutrientBars totals={day.totals} targets={day.targets} known={day.known} />}

              <WaterCard water={day.water} busy={false} onChange={(d) => void changeWater(d)} />
            </>
          )}
        </aside>

        <div className="nf-today__meals">
          {day && <WeekStrip week={day.week} selected={date} today={today} target={day.targets?.kcal ?? null} onPick={setDate} />}

          {day && (
            <div className="nf-legend" aria-hidden="true">
              <span>Comidas</span>
              <span className="nf-col nf-col--p">
                <i className="nf-dot" /> Proteína
              </span>
              <span className="nf-col nf-col--c">
                <i className="nf-dot" /> Carbohidratos
              </span>
              <span className="nf-col nf-col--g">
                <i className="nf-dot" /> Grasa
              </span>
              <span className="nf-legend__kcal">kcal</span>
            </div>
          )}

          {day && entryCount === 0 && prevDay && (
            <div className="nf-callout nf-callout--soft">
              <p>
                <b>¿Comiste parecido {prevDayText === "ayer" ? "a ayer" : `al ${prevDayText.replace(/^el /, "")}`}?</b> Repite todo de un toque y luego quitas lo que no.
              </p>
              <Button icon={<RetweetOutlined />} loading={busyKey === "day"} onClick={() => void repeatDay()}>
                Repetir todo · {kcalText(prevDay.kcal)} kcal
              </Button>
            </div>
          )}

          {!day && (
            <div className="nf-meal" style={{ padding: 16 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          )}

          {day?.meals.map((m) => (
            <MealCard
              key={m.slot}
              meal={m}
              date={date}
              hidden={hidden}
              busyKey={busyKey}
              onAdd={() => setAdding(m.slot)}
              onEdit={setEditing}
              onConfirm={(s) => void confirm(m.slot, s)}
              onDismiss={(s) => dismiss(m.slot, s)}
              onRepeat={() => void repeatMeal(m)}
              onCopy={() => setCopySource({ date, meal: m.slot, label: `${m.name.toLowerCase()} de ${relativeDay(date, today)}` })}
              onSave={() => setSaveSource({ date, meal: m.slot, mealName: m.name, count: m.entries.length })}
              onClear={() => clearMeal(m)}
              onNutrients={() => setNutrientsOf(m.slot)}
              onPhoto={(p) => {
                setPhoto(p);
                setAdding(m.slot);
              }}
              onPhotoDelete={(p) => removePhoto(p)}
            />
          ))}

          {day && entryCount > 0 && (
            <div className="nf-daytools">
              <Button type="text" icon={<CopyOutlined />} onClick={copyDay}>
                Copiar todo el día a otro día
              </Button>
            </div>
          )}
        </div>
      </div>

      <AddFoodSheet
        open={adding !== null}
        meal={adding}
        mealName={mealName(adding)}
        meals={mealList}
        date={date}
        remaining={remaining}
        photo={photo}
        onClose={() => {
          setAdding(null);
          setPhoto(null);
        }}
        onAdded={() => void load()}
        onWater={waterFromSheet}
      />
      <EntrySheet entry={editing} meals={mealList} remaining={remainingWithout(editing)} onClose={() => setEditing(null)} onChanged={() => void load()} />
      <CopyModal
        source={copySource}
        meals={mealList}
        today={today}
        onClose={() => setCopySource(null)}
        onCopied={(r, where) => {
          if (r.entries.some((e) => e.date === date)) void load();
          undoable(`Copiado: ${thingsText(r.entries.length)} · ${kcalText(r.kcal)} kcal (${where})`, r.entries);
        }}
      />
      <SaveMealModal
        source={saveSource}
        onClose={() => setSaveSource(null)}
        onSaved={(name) => message.success(`«${name}» quedó guardada: la encuentras al tocar «Agregar»`)}
      />
      <MealNutrientsSheet
        meal={day?.meals.find((m) => m.slot === nutrientsOf) ?? null}
        dayTotals={day?.totals ?? null}
        targets={day?.targets ?? null}
        onClose={() => setNutrientsOf(null)}
      />
    </>
  );
}
