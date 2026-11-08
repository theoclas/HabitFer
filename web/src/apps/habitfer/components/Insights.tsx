import { CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { fetchInsights } from "../../../api/client";
import type { Insight } from "../../../types";

const HIDDEN_KEY = "hf_insight_hidden";

function hiddenToday(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "{}") as { date?: string; ids?: string[] };
    return raw.date === dayjs().format("YYYY-MM-DD") ? (raw.ids ?? []) : [];
  } catch {
    return [];
  }
}

function hide(id: string) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify({ date: dayjs().format("YYYY-MM-DD"), ids: [...hiddenToday(), id] }));
  } catch {
    /* sin almacenamiento */
  }
}

/** Panel de insights (Estadisticas): todo lo que dicen tus datos. */
export function InsightsPanel() {
  const [items, setItems] = useState<Insight[] | null>(null);
  useEffect(() => {
    fetchInsights()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <section className="hf-panel">
      <div className="hf-panel__head">
        <h2>Lo que dicen tus datos</h2>
        <span>últimas 8 semanas</span>
      </div>
      {items === null ? (
        <div className="hf-skel" style={{ height: 120 }} />
      ) : items.length === 0 ? (
        <p className="hf-note" style={{ marginTop: 0 }}>
          Con un par de semanas de marcas aparecen aquí patrones: tu mejor día, a qué hora cumples, qué hábito se te escapa.
        </p>
      ) : (
        <div className="hf-insights">
          {items.map((i) => (
            <article key={i.id} className={`hf-insight hf-insight--${i.tone}`}>
              <span className="hf-insight__emoji" aria-hidden="true">
                {i.emoji}
              </span>
              <div>
                <b>{i.title}</b>
                <p>{i.text}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Un insight en Hoy (el mas relevante que no se haya ocultado hoy). */
export function TodayInsight() {
  const [item, setItem] = useState<Insight | null>(null);
  useEffect(() => {
    let alive = true;
    fetchInsights()
      .then((list) => {
        if (!alive) return;
        const hidden = new Set(hiddenToday());
        setItem(list.find((i) => !hidden.has(i.id)) ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!item) return null;
  return (
    <article className={`hf-insight hf-insight--${item.tone} hf-insight--today`} aria-label="Dato de tus hábitos">
      <span className="hf-insight__emoji" aria-hidden="true">
        {item.emoji}
      </span>
      <div>
        <b>{item.title}</b>
        <p>{item.text}</p>
      </div>
      <button
        type="button"
        className="hf-insight__close"
        aria-label="Ocultar hasta mañana"
        onClick={() => {
          hide(item.id);
          setItem(null);
        }}
      >
        <CloseOutlined />
      </button>
    </article>
  );
}
