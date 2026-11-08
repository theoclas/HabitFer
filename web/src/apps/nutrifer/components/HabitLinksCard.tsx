import { LinkOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Select, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { createLinkedHabit, fetchHabitLinks, linkHabit } from "../api";
import type { AutoSource, HabitLinks } from "../types";

/**
 * Conexión con HabitFer: hábitos que se marcan solos con lo de NutriFer. Se conecta uno que ya existe o se crea
 * uno nuevo. Mientras esté conectado, en HabitFer no se marca a mano.
 */
export function HabitLinksCard() {
  const [links, setLinks] = useState<HabitLinks | null>(null);
  const [busy, setBusy] = useState<AutoSource | null>(null);

  useEffect(() => {
    fetchHabitLinks()
      .then(setLinks)
      .catch(() => setLinks(null));
  }, []);

  const run = async (source: AutoSource, fn: () => Promise<HabitLinks>, ok: string) => {
    setBusy(source);
    try {
      setLinks(await fn());
      message.success(ok);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo conectar"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="nf-card" aria-labelledby="nf-goal-habits">
      <h2 id="nf-goal-habits">Conexión con HabitFer</h2>
      <p className="nf-hint" style={{ margin: 0 }}>
        Hábitos que se marcan solos con lo que haces aquí. Mientras estén conectados, en HabitFer no se marcan a mano.
      </p>
      {!links ? (
        <div className="nf-empty">Cargando…</div>
      ) : (
        <ul className="nf-links">
          {links.sources.map((s) => {
            const options = [...(s.habit ? [s.habit] : []), ...links.habits].map((h) => ({
              value: h.id,
              label: `${h.icon ? `${h.icon} ` : ""}${h.title}${h.goal > 1 ? ` (${h.goal}${h.unit ? ` ${h.unit}` : ""})` : ""}`,
            }));
            return (
              <li key={s.source} className="nf-links__row">
                <span className="nf-links__icon" aria-hidden="true">
                  {s.icon}
                </span>
                <div className="nf-links__body">
                  <b>{s.title}</b>
                  <small>{s.description}</small>
                  <div className="nf-links__ctrl">
                    <Select
                      size="middle"
                      value={s.habit?.id}
                      placeholder="Elegir un hábito de HabitFer"
                      allowClear
                      disabled={busy !== null}
                      options={options}
                      onChange={(v?: string) =>
                        void run(s.source, () => linkHabit(s.source, v ?? null), v ? "Hábito conectado: se marca solo" : "Hábito desconectado")
                      }
                      style={{ minWidth: 0, flex: 1 }}
                      notFoundContent="No tienes hábitos para conectar"
                      aria-label={`Hábito para «${s.title}»`}
                    />
                    {!s.habit && (
                      <Button
                        icon={<PlusOutlined />}
                        loading={busy === s.source}
                        onClick={() => void run(s.source, () => createLinkedHabit(s.source), "Hábito creado en HabitFer")}
                      >
                        Crear
                      </Button>
                    )}
                  </div>
                  {s.habit && (
                    <span className="nf-links__on">
                      <LinkOutlined /> Conectado
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
