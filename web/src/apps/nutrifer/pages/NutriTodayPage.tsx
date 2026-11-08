import { LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Skeleton, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayKey } from "../../../utils/dates";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchDay } from "../api";
import { AddFoodSheet } from "../components/AddFoodSheet";
import { CalorieRing, MacroBars } from "../components/DaySummary";
import { EntrySheet } from "../components/EntrySheet";
import { kcalText } from "../math";
import type { DayView, Entry, MealSlot } from "../types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dayTitle(key: string): { title: string; subtitle: string } {
  const d = dayjs(key);
  const today = dayjs(todayKey());
  const subtitle = cap(d.format("dddd D [de] MMMM"));
  if (d.isSame(today, "day")) return { title: "Hoy", subtitle };
  if (d.isSame(today.subtract(1, "day"), "day")) return { title: "Ayer", subtitle };
  return { title: cap(d.format("dddd D")), subtitle: cap(d.format("MMMM [de] YYYY")) };
}

/** El diario del día: anillo de calorías, macros y las cinco comidas. */
export function NutriTodayPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey);
  const [day, setDay] = useState<DayView | null>(null);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    try {
      setDay(await fetchDay(date));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cargar el día"));
    }
  }, [date]);

  useEffect(() => {
    setDay((d) => (d && d.date === date ? d : null));
    void load();
  }, [load, date]);

  const isToday = date === todayKey();
  const { title, subtitle } = dayTitle(date);
  const shift = (days: number) => setDate(dayjs(date).add(days, "day").format("YYYY-MM-DD"));
  const mealName = (slot: MealSlot | null) => day?.meals.find((m) => m.slot === slot)?.name ?? "la comida";

  return (
    <>
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
          <section className="nf-summary" aria-label="Resumen del día">
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

          {day.meals.map((m) => (
            <section className="nf-meal" key={m.slot} aria-labelledby={`nf-meal-${m.slot}`}>
              <div className="nf-meal__head">
                <h2 className="nf-meal__name" id={`nf-meal-${m.slot}`}>
                  {m.name}
                </h2>
                <span className="nf-meal__kcal">
                  {kcalText(m.totals.kcal)} <small>kcal</small>
                </span>
              </div>
              {m.entries.map((e) => (
                <button key={e.id} type="button" className="nf-entry" onClick={() => setEditing(e)}>
                  <span className="nf-entry__name">{e.name}</span>
                  <span className="nf-entry__amount">{e.amount}</span>
                  <span className="nf-entry__kcal">{kcalText(e.kcal)}</span>
                </button>
              ))}
              <button type="button" className="nf-meal__add" onClick={() => setAdding(m.slot)}>
                <PlusOutlined /> Agregar
              </button>
            </section>
          ))}
        </>
      )}

      <AddFoodSheet open={adding !== null} meal={adding} mealName={mealName(adding)} date={date} onClose={() => setAdding(null)} onAdded={() => void load()} />
      <EntrySheet entry={editing} meals={day?.meals.map((m) => ({ slot: m.slot, name: m.name })) ?? []} onClose={() => setEditing(null)} onChanged={() => void load()} />
    </>
  );
}
