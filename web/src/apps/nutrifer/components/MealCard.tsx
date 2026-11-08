import {
  CameraOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  LoadingOutlined,
  PieChartOutlined,
  PlusOutlined,
  RetweetOutlined,
  RightOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import { thingsText } from "../format";
import { usePhotoUrl } from "../hooks";
import { gramsText, kcalText, relativeDay } from "../math";
import type { Entry, MealView, PendingPhoto, Suggestion } from "../types";

type Props = {
  meal: MealView;
  /** El día que se está viendo y hoy (para «lo de ayer»). */
  date: string;
  /** Lo de siempre que se dejó para otro día. */
  hidden: Set<string>;
  busyKey: string | null;
  onAdd: () => void;
  onEdit: (e: Entry) => void;
  onConfirm: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
  onRepeat: () => void;
  onCopy: () => void;
  onSave: () => void;
  onClear: () => void;
  /** Ver los nutrientes de la comida y de cada alimento. */
  onNutrients: () => void;
  /** Completar o borrar una foto pendiente. */
  onPhoto: (p: PendingPhoto) => void;
  onPhotoDelete: (p: PendingPhoto) => void;
};

/** Una foto para anotar después: miniatura, hora y nota. */
function PhotoRow({ photo, onOpen, onDelete }: { photo: PendingPhoto; onOpen: () => void; onDelete: () => void }) {
  const url = usePhotoUrl(photo.id);
  const time = new Date(photo.createdAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="nf-photo-row">
      <button type="button" className="nf-photo-row__main" onClick={onOpen}>
        <span className="nf-photo-row__thumb">{url ? <img src={url} alt="" /> : <CameraOutlined />}</span>
        <span className="nf-photo-row__text">
          Foto de las {time}
          <small>{photo.note ?? "Pendiente: toca para anotar lo que había"}</small>
        </span>
      </button>
      <button type="button" className="nf-photo-row__del" aria-label={`Borrar la foto de las ${time}`} onClick={onDelete}>
        <CloseOutlined />
      </button>
    </div>
  );
}

/** Una comida del día: lo anotado, fotos pendientes, «lo de siempre» por confirmar, repetir lo de ayer y su menú. */
export function MealCard({
  meal: m,
  date,
  hidden,
  busyKey,
  onAdd,
  onEdit,
  onConfirm,
  onDismiss,
  onRepeat,
  onCopy,
  onSave,
  onClear,
  onNutrients,
  onPhoto,
  onPhotoDelete,
}: Props) {
  const empty = m.entries.length === 0;
  const suggestions = m.suggestions.filter((s) => !hidden.has(`${m.slot}:${s.foodId}`));
  const when = m.previous ? relativeDay(m.previous.date, date) : "";
  const repeatLabel = m.previous ? `Repetir lo ${when === "ayer" ? "de ayer" : `del ${when.replace(/^el /, "")}`}` : "";

  const items: MenuProps["items"] = [
    ...(m.previous ? [{ key: "repeat", icon: <RetweetOutlined />, label: `${repeatLabel} (${thingsText(m.previous.count)})` }] : []),
    ...(!empty
      ? [
          { key: "nutrients", icon: <PieChartOutlined />, label: "Ver nutrientes" },
          { key: "copy", icon: <CopyOutlined />, label: "Copiar a otro día…" },
          { key: "save", icon: <SaveOutlined />, label: "Guardar como comida…" },
          { type: "divider" as const },
          { key: "clear", icon: <DeleteOutlined />, label: "Vaciar", danger: true },
        ]
      : []),
  ];
  const onMenu: MenuProps["onClick"] = ({ key }) => {
    if (key === "repeat") onRepeat();
    else if (key === "copy") onCopy();
    else if (key === "save") onSave();
    else if (key === "clear") onClear();
    else if (key === "nutrients") onNutrients();
  };

  return (
    <section className="nf-meal" aria-labelledby={`nf-meal-${m.slot}`}>
      <div className="nf-meal__head">
        <h2 className="nf-meal__name" id={`nf-meal-${m.slot}`}>
          {m.name}
        </h2>
        {/* En escritorio: los macros de la comida, en columnas como una tabla. */}
        <span className="nf-col nf-col--p" title="Proteína (g)">
          {gramsText(m.totals.protein)}
        </span>
        <span className="nf-col nf-col--c" title="Carbohidratos (g)">
          {gramsText(m.totals.carbs)}
        </span>
        <span className="nf-col nf-col--g" title="Grasa (g)">
          {gramsText(m.totals.fat)}
        </span>
        <span className="nf-meal__kcal">
          {kcalText(m.totals.kcal)} <small>kcal</small>
        </span>
        {items.length > 0 && (
          <Dropdown menu={{ items, onClick: onMenu }} trigger={["click"]} placement="bottomRight">
            <button type="button" className="nf-meal__menu" aria-label={`Más opciones de ${m.name.toLowerCase()}`}>
              <EllipsisOutlined />
            </button>
          </Dropdown>
        )}
      </div>

      {m.entries.map((e) => (
        <button key={e.id} type="button" className="nf-entry" onClick={() => onEdit(e)}>
          <span className="nf-entry__name">{e.name}</span>
          <span className="nf-entry__amount">{e.quick ? "Registro rápido" : e.amount}</span>
          <span className="nf-col nf-col--p">{gramsText(e.protein)}</span>
          <span className="nf-col nf-col--c">{gramsText(e.carbs)}</span>
          <span className="nf-col nf-col--g">{gramsText(e.fat)}</span>
          <span className="nf-entry__kcal">{kcalText(e.kcal)}</span>
          <RightOutlined className="nf-entry__chev" aria-hidden="true" />
        </button>
      ))}

      {m.photos.map((p) => (
        <PhotoRow key={p.id} photo={p} onOpen={() => onPhoto(p)} onDelete={() => onPhotoDelete(p)} />
      ))}

      {suggestions.length > 0 && (
        <div className="nf-suggest" aria-label="Lo de siempre">
          <div className="nf-suggest__label">Lo de siempre</div>
          {suggestions.map((s) => {
            const busy = busyKey === `s:${s.entryId}`;
            return (
              <div className="nf-suggest__row" key={s.entryId}>
                <span className="nf-suggest__name">
                  {s.name}
                  <small>
                    {s.amount} · {kcalText(s.kcal)} kcal
                  </small>
                </span>
                <button type="button" className="nf-suggest__yes" disabled={busy} onClick={() => onConfirm(s)} aria-label={`Anotar ${s.name}`}>
                  {busy ? <LoadingOutlined /> : <CheckOutlined />}
                </button>
                <button type="button" className="nf-suggest__no" disabled={busy} onClick={() => onDismiss(s)} aria-label={`Hoy no: ${s.name}`}>
                  <CloseOutlined />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="nf-meal__foot">
        <button type="button" className="nf-meal__add" onClick={onAdd}>
          <PlusOutlined /> Agregar
        </button>
        {empty && m.previous && (
          <button type="button" className="nf-meal__repeat" onClick={onRepeat} disabled={busyKey === `r:${m.slot}`}>
            {busyKey === `r:${m.slot}` ? <LoadingOutlined /> : <RetweetOutlined />} {repeatLabel}
            <small>
              {thingsText(m.previous.count)} · {kcalText(m.previous.kcal)} kcal
            </small>
          </button>
        )}
      </div>
    </section>
  );
}
