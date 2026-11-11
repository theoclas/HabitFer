import { CaretRightOutlined, CloseOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, InputNumber, Segmented, Switch } from "antd";
import { minutesText } from "../format";
import { INTERVAL_PRESETS, type PlanMode } from "../player/plan";
import type { WakeState } from "../player/useWakeLock";

type Props = {
  name: string;
  minutes: number;
  exercises: number;
  circuit: boolean;
  /** «Se anota ayer», si no es para hoy. */
  dateText: string | null;
  mode: PlanMode;
  onMode: (m: PlanMode) => void;
  work: number;
  rest: number;
  rounds: number;
  onIntervals: (p: { work?: number; rest?: number; rounds?: number }) => void;
  hasBlocks: boolean;
  warmup: boolean;
  cooldown: boolean;
  warmupMinutes: number;
  cooldownMinutes: number;
  onWarmup: (v: boolean) => void;
  onCooldown: (v: boolean) => void;
  voice: boolean;
  sounds: boolean;
  canSpeak: boolean;
  onVoice: (v: boolean) => void;
  onSounds: (v: boolean) => void;
  onTest: () => void;
  wake: WakeState;
  /** Un entrenamiento a medias de esta rutina: dónde iba y cuántos ejercicios llevaba. */
  resume: { where: string; done: number } | null;
  onResume: () => void;
  onDiscard: () => void;
  canStart: boolean;
  onStart: () => void;
  onClose: () => void;
};

const MODE_HINT: Record<Exclude<PlanMode, "normal">, string> = {
  intervals: "Todo va por tiempo: trabajas y descansas los segundos que digas, y la lista se repite.",
  emom: "Al empezar cada minuto haces las repeticiones y descansas lo que quede del minuto.",
};

/** Antes de empezar: cómo hacer la rutina, calentar y estirar, voz y sonidos. */
export function PlayerSetup(p: Props) {
  const modeHint =
    p.mode === "normal"
      ? p.circuit
        ? "Como está: en circuito, un ejercicio tras otro y se repite la vuelta."
        : "Como está: todas las series de un ejercicio y luego el siguiente."
      : MODE_HINT[p.mode];
  const num = (v: number | string | null, lo: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.round(v)) : null);

  return (
    <div className="fit-player fit-player--setup">
      <div className="fit-player__top">
        <button type="button" className="fit-icon-btn" aria-label="Volver a la rutina" onClick={p.onClose}>
          <CloseOutlined />
        </button>
        <span className="fit-player__where">Antes de empezar</span>
      </div>

      <div className="fit-setup">
        <header className="fit-setup__head">
          <div className="fit-eyebrow">Entreno guiado</div>
          <h1 className="fit-title">{p.name}</h1>
          <p className="fit-sub">
            Unos {minutesText(p.minutes)} · {p.exercises} {p.exercises === 1 ? "ejercicio" : "ejercicios"}
            {p.dateText ? ` · ${p.dateText}` : ""}
          </p>
        </header>

        {p.resume && (
          <section className="fit-card fit-resume" aria-labelledby="fit-resume-title">
            <h2 className="fit-h3" id="fit-resume-title">
              Tienes este entrenamiento a medias
            </h2>
            <p className="fit-hint" style={{ margin: 0 }}>
              Ibas en {p.resume.where.toLowerCase()}
              {p.resume.done ? ` y llevas ${p.resume.done} ${p.resume.done === 1 ? "ejercicio" : "ejercicios"}` : ""}.
            </p>
            <div className="fit-actions">
              <Button type="primary" icon={<CaretRightOutlined />} onClick={p.onResume}>
                Seguir donde ibas
              </Button>
              <Button onClick={p.onDiscard}>Empezar de nuevo</Button>
            </div>
          </section>
        )}

        <section className="fit-card" aria-labelledby="fit-mode-title">
          <h2 className="fit-h3" id="fit-mode-title">
            Cómo la haces
          </h2>
          <Segmented
            block
            value={p.mode}
            onChange={(v) => p.onMode(v as PlanMode)}
            options={[
              { value: "normal", label: p.circuit ? "Circuito" : "Por series" },
              { value: "intervals", label: "Intervalos" },
              { value: "emom", label: "Cada minuto" },
            ]}
          />
          <span className="fit-hint">{modeHint}</span>
          {p.mode === "intervals" && (
            <>
              <div className="fit-chips" role="group" aria-label="Intervalos de siempre">
                {INTERVAL_PRESETS.map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    className="fit-chip"
                    aria-pressed={p.work === x.work && p.rest === x.rest}
                    onClick={() => p.onIntervals({ work: x.work, rest: x.rest })}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              <div className="fit-setup__nums">
                <label className="fit-field">
                  <span className="fit-label">Trabajo</span>
                  <InputNumber min={5} max={600} step={5} value={p.work} suffix="s" onChange={(v) => num(v, 5) !== null && p.onIntervals({ work: num(v, 5)! })} />
                </label>
                <label className="fit-field">
                  <span className="fit-label">Descanso</span>
                  <InputNumber min={0} max={600} step={5} value={p.rest} suffix="s" onChange={(v) => num(v, 0) !== null && p.onIntervals({ rest: num(v, 0)! })} />
                </label>
                <label className="fit-field">
                  <span className="fit-label">Vueltas</span>
                  <InputNumber min={1} max={10} value={p.rounds} onChange={(v) => num(v, 1) !== null && p.onIntervals({ rounds: num(v, 1)! })} />
                </label>
              </div>
            </>
          )}
          {p.mode === "emom" && (
            <div className="fit-setup__nums">
              <label className="fit-field">
                <span className="fit-label">Vueltas</span>
                <InputNumber min={1} max={10} value={p.rounds} onChange={(v) => num(v, 1) !== null && p.onIntervals({ rounds: num(v, 1)! })} />
              </label>
            </div>
          )}
        </section>

        {p.hasBlocks && (
          <section className="fit-card" aria-label="Calentar y estirar">
            <div className="fit-switch">
              <label htmlFor="fit-sw-warmup">
                <b>Calentar</b>
                <small>{p.warmupMinutes} min de movimientos suaves al empezar</small>
              </label>
              <Switch id="fit-sw-warmup" checked={p.warmup} onChange={p.onWarmup} />
            </div>
            <div className="fit-switch">
              <label htmlFor="fit-sw-cooldown">
                <b>Estirar al final</b>
                <small>{p.cooldownMinutes} min para soltar el cuerpo</small>
              </label>
              <Switch id="fit-sw-cooldown" checked={p.cooldown} onChange={p.onCooldown} />
            </div>
          </section>
        )}

        <section className="fit-card" aria-label="Voz y sonidos">
          <div className="fit-switch">
            <label htmlFor="fit-sw-voice">
              <b>Voz</b>
              <small>{p.canSpeak ? "Te dice qué sigue y cuándo descansar" : "Este navegador no tiene voz: sonarán los pitidos"}</small>
            </label>
            <Switch id="fit-sw-voice" checked={p.voice && p.canSpeak} disabled={!p.canSpeak} onChange={p.onVoice} />
          </div>
          <div className="fit-switch">
            <label htmlFor="fit-sw-sounds">
              <b>Pitidos</b>
              <small>3, 2, 1 antes de cada cambio</small>
            </label>
            <Switch id="fit-sw-sounds" checked={p.sounds} onChange={p.onSounds} />
          </div>
          <div className="fit-actions">
            <Button icon={<SoundOutlined />} onClick={p.onTest}>
              Probar el sonido
            </Button>
          </div>
          <span className="fit-hint">
            {p.wake === "unsupported"
              ? "Este navegador no deja mantener la pantalla encendida: sube el tiempo de bloqueo del celular mientras entrenas."
              : "La pantalla se queda encendida mientras entrenas."}{" "}
            Si no oyes nada, sube el volumen o quita el modo silencio.
          </span>
        </section>

        <div className="fit-setup__go">
          <Button type="primary" size="large" block icon={<CaretRightOutlined />} disabled={!p.canStart} onClick={p.onStart}>
            Empezar
          </Button>
        </div>
      </div>
    </div>
  );
}
