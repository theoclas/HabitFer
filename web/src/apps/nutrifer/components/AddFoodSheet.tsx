import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Drawer, Input, message, type InputRef } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import {
  addEntriesBatch,
  addEntry,
  addQuickEntry,
  deletePhoto,
  fetchShortcuts,
  foodDetail,
  logSavedMeal,
  removeEntries,
  repeatEntry,
  setFavorite,
  understandText,
  uploadPhoto,
  type QuickInput,
} from "../api";
import { defaultAmount, inMeal, lastAmount, thingsText } from "../format";
import { forgetPhoto, useFoodSearch, usePhotoUrl } from "../hooks";
import { kcalText, usualChoice } from "../math";
import { shrinkPhoto } from "../photo";
import type { AmountChoice, BatchItem, Entry, FavoriteFood, FoodDetail, FoodResult, MealSlot, PendingPhoto, Remaining, SavedMealView, Shortcuts, TextItem } from "../types";
import { AmountEditor } from "./AmountEditor";
import { CreateFoodForm } from "./CreateFoodForm";
import { FoodRow } from "./FoodRow";
import { QuickEntryForm } from "./QuickEntryForm";
import { TextReview } from "./TextReview";
import { GlassIcon } from "./WaterCard";
import { notifyUndo } from "./undo";

type Props = {
  open: boolean;
  meal: MealSlot | null;
  mealName: string;
  /** Las cinco comidas (para «escribe o dicta», que puede repartir en varias). */
  meals: { slot: MealSlot; name: string }[];
  date: string;
  /** Lo que falta para la meta del día («anotar por meta»). */
  remaining: Remaining | null;
  /** Foto pendiente que se va a completar (abre en «escribe o dicta» con la foto arriba). */
  photo?: PendingPhoto | null;
  onClose: () => void;
  onAdded: () => void;
  /** Un vaso de agua (va al contador del día, no a la comida). */
  onWater: () => void;
};

type View =
  | { kind: "home" }
  | { kind: "detail"; food: FoodDetail }
  | { kind: "create" }
  | { kind: "quick" }
  | { kind: "saved"; saved: SavedMealView }
  | { kind: "write" }
  | { kind: "review"; items: TextItem[] };

/** Ejemplos para el primer uso: un toque los copia en el cuadro. */
const EXAMPLES = ["Desayuné dos arepas con queso y un tinto", "Almorcé arroz, fríjoles, carne asada, maduro y aguacate", "Un pocillo de chocolate y un pandebono"];

/** La foto pendiente, grande, con su nota. */
function PhotoPreview({ photo }: { photo: PendingPhoto }) {
  const url = usePhotoUrl(photo.id);
  const time = new Date(photo.createdAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return (
    <figure className="nf-photo-big">
      {url ? <img src={url} alt={`Foto de las ${time}`} /> : <div className="nf-photo-big__wait">Cargando la foto…</div>}
      <figcaption>
        Foto de las {time}
        {photo.note ? ` · ${photo.note}` : ""}
      </figcaption>
    </figure>
  );
}

/** Atajos de bebidas: buscan la familia y cada resultado se agrega con su medida (pocillo, vaso, botella). */
const DRINKS: { label: string; q: string }[] = [
  { label: "Tinto", q: "tinto" },
  { label: "Café con leche", q: "cafe con leche" },
  { label: "Aguapanela", q: "aguapanela" },
  { label: "Chocolate", q: "chocolate en leche" },
  { label: "Jugo en agua", q: "jugo en agua" },
  { label: "Jugo en leche", q: "jugo en leche" },
  { label: "Gaseosa", q: "gaseosa" },
  { label: "Leche", q: "leche entera" },
  { label: "Cerveza", q: "cerveza" },
];

/**
 * Buscar y agregar a una comida. Arriba, lo de un toque: solo calorías, agua, bebidas, comidas
 * guardadas, favoritos y lo que más anotas aquí. Queda abierta para seguir agregando.
 */
export function AddFoodSheet({ open, meal, mealName, meals, date, remaining, photo, onClose, onAdded, onWater }: Props) {
  const isMobile = useIsMobile();
  const inputRef = useRef<InputRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const results = useFoodSearch(q);
  const [shortcuts, setShortcuts] = useState<Shortcuts | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [opening, setOpening] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");

  const loadShortcuts = useCallback(() => {
    if (!meal) return;
    fetchShortcuts(meal)
      .then(setShortcuts)
      .catch(() => setShortcuts({ favorites: [], recents: [], savedMeals: [] }));
  }, [meal]);

  useEffect(() => {
    if (!open || !meal) return;
    setQ("");
    setText("");
    setView(photo ? { kind: "write" } : { kind: "home" });
    setShortcuts(null);
    loadShortcuts();
    if (photo) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [open, meal, photo, loadShortcuts]);

  const home = () => {
    setView({ kind: "home" });
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const openFood = async (id: string) => {
    setOpening(id);
    try {
      setView({ kind: "detail", food: await foodDetail(id) });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo abrir ese alimento"));
    } finally {
      setOpening(null);
    }
  };

  /** Avisa con «Deshacer», recarga el día y los atajos. */
  const done = (text: string, created: Entry[]) => {
    onAdded();
    loadShortcuts();
    notifyUndo(text, async () => {
      try {
        await removeEntries(created.map((e) => e.id));
        onAdded();
        loadShortcuts();
      } catch (err) {
        message.error(apiErrorMessage(err, "No se pudo deshacer"));
      }
    });
  };

  const where = inMeal(mealName);

  const save = async (food: FoodDetail, choice: AmountChoice) => {
    if (!meal) return;
    setBusy(true);
    try {
      const e = await addEntry({ date, meal, foodId: food.id, ...choice });
      done(`${food.name} quedó en ${where}`, [e]);
      setQ("");
      home();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setBusy(false);
    }
  };

  /** «+» en una fila: repite lo de la última vez o, si nunca se anotó, la medida por defecto. */
  const quickAdd = async (food: FoodResult, lastEntryId?: string | null) => {
    if (!meal) return;
    setQuickBusy(food.id);
    try {
      const e = lastEntryId ? await repeatEntry(lastEntryId, { date, meal }) : await addEntry({ date, meal, foodId: food.id, quantity: 1 });
      done(`${food.name} quedó en ${where}`, [e]);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setQuickBusy(null);
    }
  };

  const logSaved = async (saved: SavedMealView, itemIds?: string[]) => {
    if (!meal) return;
    setQuickBusy(saved.id);
    setBusy(true);
    try {
      const r = await logSavedMeal(saved.id, { date, meal, ...(itemIds ? { itemIds } : {}) });
      done(`${saved.name} quedó en ${where} · ${kcalText(r.kcal)} kcal`, r.entries);
      if (view.kind === "saved") home();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setQuickBusy(null);
      setBusy(false);
    }
  };

  const saveQuick = async (v: QuickInput) => {
    if (!meal) return;
    setBusy(true);
    try {
      const e = await addQuickEntry({ ...v, date, meal });
      done(`${kcalText(e.kcal)} kcal quedaron en ${where}`, [e]);
      home();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo agregar"));
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async (food: FoodDetail) => {
    const on = !food.favorite;
    setView({ kind: "detail", food: { ...food, favorite: on } });
    try {
      await setFavorite(food.id, on);
      message.success(on ? "Quedó en favoritos" : "Ya no está en favoritos");
      loadShortcuts();
    } catch (err) {
      setView({ kind: "detail", food });
      message.error(apiErrorMessage(err, "No se pudo cambiar"));
    }
  };

  /* ---------- Escribe o dicta ---------- */

  const understand = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      const items = await understandText(t);
      if (items.length === 0) {
        message.info("No encontré comida en ese texto. Prueba con algo como «dos arepas y un tinto».");
        return;
      }
      setView({ kind: "review", items });
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo entender"));
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async (items: BatchItem[], aliases: { phrase: string; foodId: string }[]) => {
    setBusy(true);
    try {
      const r = await addEntriesBatch({ date, items, aliases, ...(photo ? { photoId: photo.id } : {}) });
      if (photo) forgetPhoto(photo.id);
      done(`Anotado: ${thingsText(r.entries.length)} · ${kcalText(r.kcal)} kcal`, r.entries);
      setText("");
      if (photo) onClose();
      else home();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Foto para después ---------- */

  const savePhotoForLater = async (file: File) => {
    if (!meal) return;
    setBusy(true);
    try {
      const { base64, mime } = await shrinkPhoto(file);
      await uploadPhoto({ date, meal, image: base64, mime });
      message.success(`La foto quedó en ${where}: complétala cuando puedas`);
      onAdded();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar la foto"));
    } finally {
      setBusy(false);
    }
  };

  const discardPhoto = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      await deletePhoto(photo.id);
      forgetPhoto(photo.id);
      message.success("Foto borrada");
      onAdded();
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo borrar la foto"));
    } finally {
      setBusy(false);
    }
  };

  const term = q.trim();
  const favRow = (f: FavoriteFood) => {
    const amount = f.last ? lastAmount(f.last) : defaultAmount(f);
    return (
      <FoodRow
        key={f.id}
        food={f}
        favorite
        amount={amount}
        opening={opening === f.id}
        quickBusy={quickBusy === f.id}
        onOpen={() => void openFood(f.id)}
        onQuick={() => void quickAdd(f, f.last?.entryId)}
        quickLabel={`Agregar ${f.name}, ${amount.text}`}
      />
    );
  };

  let body;
  if (view.kind === "write") {
    body = (
      <div className="nf-detail">
        {!photo && (
          <button type="button" className="nf-back" onClick={home}>
            ‹ Volver a la búsqueda
          </button>
        )}
        {photo && <PhotoPreview photo={photo} />}
        <header>
          <h3 className="nf-detail__name">{photo ? "¿Qué había en la foto?" : "Escribe o dicta"}</h3>
          <p className="nf-detail__source">Como lo dirías: «desayuné dos arepas con queso y un tinto». Para dictar, toca el micrófono del teclado.</p>
        </header>
        <Input.TextArea
          className="nf-write"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoSize={{ minRows: 3, maxRows: 8 }}
          maxLength={600}
          autoFocus
          enterKeyHint="done"
          placeholder="Un pocillo de chocolate, una arepa con queso y medio banano…"
          aria-label="Lo que comiste"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void understand();
            }
          }}
        />
        {!text.trim() && (
          <div className="nf-chips nf-chips--sm" role="group" aria-label="Ejemplos">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="nf-chip nf-chip--ghost" onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
        <p className="nf-hint" style={{ margin: 0 }}>
          Lo entiendo aquí mismo, sin inteligencia artificial y sin costo. Antes de guardar te muestro lo que entendí.
        </p>
        {photo && (
          <button type="button" className="nf-link-danger" onClick={() => void discardPhoto()} disabled={busy}>
            <DeleteOutlined /> Ya lo anoté: borrar la foto
          </button>
        )}
        <div className="nf-actions">
          {photo && (
            <Button size="large" onClick={onClose}>
              Después
            </Button>
          )}
          <Button type="primary" size="large" loading={busy} disabled={!text.trim()} onClick={() => void understand()}>
            Entender
          </Button>
        </div>
      </div>
    );
  } else if (view.kind === "review" && meal) {
    body = (
      <>
        {photo && <PhotoPreview photo={photo} />}
        <TextReview
          key={view.items.map((i) => i.key + i.phrase).join("|")}
          items={view.items}
          defaultMeal={meal}
          meals={meals}
          busy={busy}
          onBack={() => setView({ kind: "write" })}
          onSubmit={(items, aliases) => void saveReview(items, aliases)}
        />
      </>
    );
  } else if (view.kind === "create") {
    body = (
      <CreateFoodForm
        initialName={term}
        onCancel={home}
        onCreated={(food) => {
          void openFood(food.id);
        }}
      />
    );
  } else if (view.kind === "quick") {
    body = <QuickEntryForm busy={busy} onCancel={home} submitLabel={(k) => (k > 0 ? `Agregar · ${kcalText(k)} kcal` : "Agregar")} onSubmit={(v) => void saveQuick(v)} />;
  } else if (view.kind === "saved") {
    const s = view.saved;
    const chosen = s.items.filter((i) => picked[i.id] !== false);
    const kcal = chosen.reduce((t, i) => t + i.kcal, 0);
    body = (
      <div className="nf-detail">
        <button type="button" className="nf-back" onClick={home}>
          ‹ Volver a la búsqueda
        </button>
        <header>
          <h3 className="nf-detail__name">{s.name}</h3>
          <p className="nf-detail__source">Comida guardada · quita lo que hoy no comiste</p>
        </header>
        <div className="nf-parts" role="group" aria-label="Lo que lleva">
          {s.items.map((i) => {
            const on = picked[i.id] !== false;
            return (
              <label key={i.id} className={`nf-part${on ? "" : " nf-part--off"}`}>
                <Checkbox checked={on} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.checked }))} />
                <span className="nf-part__name">
                  {i.name}
                  <small>{i.amount || "Registro rápido"}</small>
                </span>
                <span className="nf-part__kcal">{kcalText(i.kcal)}</span>
              </label>
            );
          })}
        </div>
        <div className="nf-actions">
          <Button type="primary" size="large" loading={busy} disabled={chosen.length === 0} onClick={() => void logSaved(s, chosen.length === s.items.length ? undefined : chosen.map((i) => i.id))}>
            Agregar · {kcalText(kcal)} kcal
          </Button>
        </div>
      </div>
    );
  } else if (view.kind === "detail") {
    const food = view.food;
    body = (
      <>
        <button type="button" className="nf-back" onClick={home}>
          ‹ Volver a la búsqueda
        </button>
        <header className="nf-detail__head">
          <div style={{ minWidth: 0 }}>
            <h3 className="nf-detail__name">{food.name}</h3>
            <p className="nf-detail__source">{food.sourceLabel}</p>
          </div>
          <button
            type="button"
            className={`nf-star${food.favorite ? " is-on" : ""}`}
            aria-pressed={!!food.favorite}
            aria-label={food.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            title={food.favorite ? "Quitar de favoritos" : "Favorito"}
            onClick={() => void toggleFavorite(food)}
          >
            {food.favorite ? <StarFilled /> : <StarOutlined />}
          </button>
        </header>
        {food.usual && <p className="nf-usual-note">Empieza con lo que anotaste la última vez.</p>}
        <AmountEditor
          key={food.id}
          food={food}
          initial={usualChoice(food)}
          busy={busy}
          remaining={remaining}
          submitLabel={(k) => `Agregar · ${kcalText(k)} kcal`}
          onSubmit={(c) => void save(food, c)}
        />
      </>
    );
  } else {
    body = (
      <>
        <div className="nf-search">
          <Input
            ref={inputRef}
            size="large"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Busca: arepa, tinto, bandeja paisa…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            aria-label="Buscar alimento"
          />
        </div>
        {term ? (
          results === null ? (
            <div className="nf-empty">Buscando…</div>
          ) : results.length === 0 ? (
            <div className="nf-empty">No encontré «{term}». Prueba con otra palabra o créalo abajo.</div>
          ) : (
            <div className="nf-results">
              {results.map((r) => {
                const amount = defaultAmount(r);
                return (
                  <FoodRow
                    key={r.id}
                    food={r}
                    amount={amount}
                    opening={opening === r.id}
                    quickBusy={quickBusy === r.id}
                    onOpen={() => void openFood(r.id)}
                    onQuick={() => void quickAdd(r)}
                    quickLabel={`Agregar ${r.name}, ${amount.text}`}
                  />
                );
              })}
            </div>
          )
        ) : (
          <>
            <div className="nf-quickbar">
              <button type="button" className="nf-quickbar__btn nf-quickbar__btn--main" onClick={() => setView({ kind: "write" })}>
                <EditOutlined /> Escribe o dicta
              </button>
              <button type="button" className="nf-quickbar__btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <LoadingOutlined /> : <CameraOutlined />} Foto para después
              </button>
              <button type="button" className="nf-quickbar__btn" onClick={() => setView({ kind: "quick" })}>
                <ThunderboltOutlined /> Solo calorías
              </button>
              <button
                type="button"
                className="nf-quickbar__btn"
                onClick={() => {
                  onWater();
                }}
              >
                <GlassIcon level={0.7} /> Un vaso de agua
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void savePhotoForLater(file);
                }}
              />
            </div>
            <div className="nf-section-label">Bebidas</div>
            <div className="nf-chips nf-chips--sm nf-chips--scroll" role="group" aria-label="Bebidas">
              {DRINKS.map((d) => (
                <button key={d.q} type="button" className="nf-chip" onClick={() => setQ(d.q)}>
                  {d.label}
                </button>
              ))}
            </div>
            {shortcuts === null ? (
              <div className="nf-empty">Cargando…</div>
            ) : (
              <>
                {shortcuts.savedMeals.length > 0 && (
                  <>
                    <div className="nf-section-label">Tus comidas guardadas</div>
                    <div className="nf-results">
                      {shortcuts.savedMeals.slice(0, 6).map((s) => (
                        <div className="nf-result" key={s.id}>
                          <button
                            type="button"
                            className="nf-result__main"
                            onClick={() => {
                              setPicked({});
                              setView({ kind: "saved", saved: s });
                            }}
                          >
                            <span className="nf-result__name">{s.name}</span>
                            <span className="nf-result__meta">
                              <span className="nf-badge nf-badge--saved">Guardada</span>
                              {thingsText(s.items.length)}: {s.items.map((i) => i.name.split(",")[0]).join(" · ")}
                            </span>
                          </button>
                          <span className="nf-result__side">
                            <span className="nf-result__kcal">
                              {kcalText(s.kcal)} <small>kcal</small>
                            </span>
                            <button type="button" className="nf-quick" onClick={() => void logSaved(s)} disabled={quickBusy === s.id} aria-label={`Agregar ${s.name} completa`}>
                              {quickBusy === s.id ? <LoadingOutlined /> : <PlusOutlined />}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {shortcuts.favorites.length > 0 && (
                  <>
                    <div className="nf-section-label">Favoritos</div>
                    <div className="nf-results">{shortcuts.favorites.slice(0, 10).map(favRow)}</div>
                  </>
                )}
                {shortcuts.recents.length > 0 && (
                  <>
                    <div className="nf-section-label">Lo que más anotas aquí</div>
                    <div className="nf-results">
                      {shortcuts.recents.map((r) => {
                        const amount = lastAmount(r.last);
                        return (
                          <FoodRow
                            key={r.id}
                            food={r}
                            amount={amount}
                            opening={opening === r.id}
                            quickBusy={quickBusy === r.id}
                            onOpen={() => void openFood(r.id)}
                            onQuick={() => void quickAdd(r, r.last.entryId)}
                            quickLabel={`Repetir ${r.name}, ${amount.text}`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
                {shortcuts.savedMeals.length + shortcuts.favorites.length + shortcuts.recents.length === 0 && (
                  <div className="nf-empty">Escribe lo que comiste. La búsqueda entiende «tinto», «perico» o «aguapanela», con o sin tildes.</div>
                )}
              </>
            )}
          </>
        )}
        <button type="button" className="nf-create-link" onClick={() => setView({ kind: "create" })}>
          ¿No está? Crea tu propio alimento
        </button>
      </>
    );
  }

  return (
    <Drawer
      title={photo ? `Foto de ${where}` : `Agregar a ${where}`}
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 520}
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
      {body}
    </Drawer>
  );
}
