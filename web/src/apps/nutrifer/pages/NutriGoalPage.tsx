import { Button, Input, InputNumber, Segmented, Skeleton, Switch, message } from "antd";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { fetchProfile, previewProfile, saveProfile } from "../api";
import { BackupCard } from "../components/BackupCard";
import { HabitLinksCard } from "../components/HabitLinksCard";
import { gramsText, intText, kcalText, mlText, nutrientGoals } from "../math";
import { MEAL_ORDER, type ActivityLevel, type MealSlot, type ProfileInput, type Sex, type Targets, type WeightGoal } from "../types";

type Form = {
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: number;
  goal: WeightGoal;
  ratePerWeek: number;
  manual: boolean;
  /** Meta que se ajusta sola cada semana. */
  adaptive: boolean;
  kcalTarget: number | null;
  proteinTarget: number | null;
  fatTarget: number | null;
  carbsTarget: number | null;
  mealNames: Record<MealSlot, string>;
  waterGoalMl: number;
  glassMl: number;
};

const RATES = [0.25, 0.5, 0.75, 1];
const GLASSES = [200, 250, 300, 350];
const WATER_GOALS = [1500, 2000, 2500, 3000];
const GOAL_VERB: Record<WeightGoal, string> = { LOSE: "bajar", MAINTAIN: "mantener", GAIN: "subir" };
const year = new Date().getFullYear();

function toInput(f: Form): ProfileInput | null {
  if (!f.sex || !f.birthYear || !f.heightCm || !f.weightKg) return null;
  if (f.birthYear < 1920 || f.birthYear > year - 12 || f.heightCm < 120 || f.heightCm > 230 || f.weightKg < 30 || f.weightKg > 300) return null;
  return {
    sex: f.sex,
    birthYear: f.birthYear,
    heightCm: f.heightCm,
    weightKg: f.weightKg,
    activity: f.activity,
    goal: f.goal,
    ratePerWeek: f.goal === "MAINTAIN" ? 0 : f.ratePerWeek,
  };
}

const rateText = (r: number) => `${String(r).replace(".", ",")} kg`;

/** La meta: datos del cuerpo, actividad y objetivo; la cuenta se ve mientras se llena. */
export function NutriGoalPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [levels, setLevels] = useState<ActivityLevel[]>([]);
  const [hadProfile, setHadProfile] = useState(false);
  const [preview, setPreview] = useState<Targets | null>(null);
  const [saving, setSaving] = useState(false);
  /** El peso de tendencia de hoy (si hay pesadas recientes en Progreso). */
  const [trendKg, setTrendKg] = useState<number | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((r) => {
        setLevels(r.activityLevels);
        setHadProfile(r.profile !== null);
        const p = r.profile;
        setTrendKg(p?.trendKg ?? null);
        setForm({
          sex: p?.sex ?? null,
          birthYear: p?.birthYear ?? null,
          heightCm: p?.heightCm ?? null,
          weightKg: p?.weightKg ?? null,
          activity: p?.activity ?? 1.375,
          goal: p?.goal ?? "MAINTAIN",
          ratePerWeek: p && p.ratePerWeek > 0 ? p.ratePerWeek : 0.5,
          manual: p?.manual ?? false,
          adaptive: p?.adaptive ?? true,
          kcalTarget: p?.targets.kcal ?? null,
          proteinTarget: p?.targets.protein ?? null,
          fatTarget: p?.targets.fat ?? null,
          carbsTarget: p?.targets.carbs ?? null,
          mealNames: r.mealNames,
          waterGoalMl: p?.waterGoalMl ?? 2000,
          glassMl: p?.glassMl ?? 250,
        });
      })
      .catch((err) => message.error(apiErrorMessage(err, "No se pudo cargar tu meta")));
  }, []);

  const input = useMemo(() => (form ? toInput(form) : null), [form]);
  const adaptive = form?.adaptive ?? true;
  const manual = form?.manual ?? false;

  // La meta calculada, al instante mientras se llena (la calcula el servidor, igual que al guardar).
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      previewProfile({ ...input, adaptive, manual }, ctrl.signal)
        .then(setPreview)
        .catch((err) => {
          if (!axios.isCancel(err)) setPreview(null);
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [input, adaptive, manual]);

  if (!form) {
    return (
      <div className="nf-card">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!input) return;
    setSaving(true);
    try {
      await saveProfile({
        ...input,
        manual: form.manual,
        adaptive: form.adaptive,
        ...(form.manual
          ? {
              kcalTarget: form.kcalTarget ?? preview?.kcal,
              proteinTarget: form.proteinTarget ?? preview?.protein,
              fatTarget: form.fatTarget ?? preview?.fat,
              carbsTarget: form.carbsTarget ?? preview?.carbs,
            }
          : {}),
        mealNames: form.mealNames,
        waterGoalMl: form.waterGoalMl,
        glassMl: form.glassMl,
      });
      message.success("Meta guardada");
      if (!hadProfile) navigate("/app/nutrifer");
      setHadProfile(true);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar la meta"));
    } finally {
      setSaving(false);
    }
  };

  const shown = form.manual && form.kcalTarget
    ? { kcal: form.kcalTarget, protein: form.proteinTarget ?? 0, fat: form.fatTarget ?? 0, carbs: form.carbsTarget ?? 0 }
    : preview;

  return (
    <div className="nf-goal">
      <div className="nf-goal__intro">
        <h1 className="nf-page-title">Tu meta</h1>
        <p className="nf-page-lead">Con tus datos calculo cuánto gastas al día y cuánto te conviene comer. Puedes cambiarla cuando quieras.</p>
      </div>

      <div className="nf-goal__a">
      <section className="nf-card" aria-labelledby="nf-goal-body">
        <h2 id="nf-goal-body">Tus datos</h2>
        <div className="nf-field">
          <span className="nf-label" id="nf-sex-label">
            Sexo (la fórmula cambia un poco)
          </span>
          {/* Botones y no Segmented: Segmented siempre muestra uno marcado aunque no se haya elegido. */}
          <div className="nf-chips" role="group" aria-labelledby="nf-sex-label">
            {(
              [
                ["MALE", "Hombre"],
                ["FEMALE", "Mujer"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" className="nf-chip" aria-pressed={form.sex === value} onClick={() => set("sex", value as Sex)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="nf-grid-3">
          <div className="nf-field">
            <label className="nf-label" htmlFor="nf-birth">
              Año de nacimiento
            </label>
            <InputNumber id="nf-birth" min={1920} max={year - 12} placeholder="1990" value={form.birthYear} inputMode="numeric" onChange={(v) => set("birthYear", typeof v === "number" ? v : null)} style={{ width: "100%" }} />
          </div>
          <div className="nf-field">
            <label className="nf-label" htmlFor="nf-height">
              Estatura (cm)
            </label>
            <InputNumber id="nf-height" min={120} max={230} placeholder="172" value={form.heightCm} inputMode="decimal" onChange={(v) => set("heightCm", typeof v === "number" ? v : null)} style={{ width: "100%" }} />
          </div>
          <div className="nf-field">
            <label className="nf-label" htmlFor="nf-weight">
              Peso (kg)
            </label>
            <InputNumber id="nf-weight" min={30} max={300} step={0.1} placeholder="78" value={form.weightKg} inputMode="decimal" onChange={(v) => set("weightKg", typeof v === "number" ? v : null)} style={{ width: "100%" }} />
          </div>
        </div>
        {trendKg != null && trendKg !== form.weightKg && (
          <p className="nf-hint" style={{ margin: 0 }}>
            Tu peso de tendencia hoy es <b>{String(trendKg).replace(".", ",")} kg</b>.{" "}
            <button type="button" className="nf-link" onClick={() => set("weightKg", trendKg)}>
              Usarlo
            </button>
          </p>
        )}
      </section>

      <section className="nf-card" aria-labelledby="nf-goal-activity">
        <h2 id="nf-goal-activity">Qué tan activo eres</h2>
        <div className="nf-activity" role="group" aria-label="Actividad">
          {levels.map((l) => (
            <button key={l.factor} type="button" aria-pressed={form.activity === l.factor} onClick={() => set("activity", l.factor)}>
              <b>{l.label}</b>
              <span>{l.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="nf-card" aria-labelledby="nf-goal-goal">
        <h2 id="nf-goal-goal">Qué quieres</h2>
        <Segmented
          block
          value={form.goal}
          onChange={(v) => set("goal", v as WeightGoal)}
          options={[
            { label: "Bajar", value: "LOSE" },
            { label: "Mantener", value: "MAINTAIN" },
            { label: "Subir", value: "GAIN" },
          ]}
        />
        {form.goal !== "MAINTAIN" && (
          <div className="nf-field">
            <span className="nf-label">Ritmo por semana</span>
            <Segmented block value={form.ratePerWeek} onChange={(v) => set("ratePerWeek", Number(v))} options={RATES.map((r) => ({ label: rateText(r), value: r }))} />
            <span className="nf-hint">{form.goal === "LOSE" ? "Medio kilo por semana es un ritmo que se sostiene." : "Para subir, un cuarto de kilo por semana suele bastar."}</span>
          </div>
        )}
      </section>

      </div>

      <aside className="nf-goal__result">
      <section className="nf-card nf-card--hero" aria-labelledby="nf-goal-result" aria-live="polite">
        <h2 id="nf-goal-result">Tu meta diaria</h2>
        {shown ? (
          <>
            <div className="nf-target__kcal">
              {kcalText(shown.kcal)}
              <small>kcal al día</small>
            </div>
            <div className="nf-target__macros">
              <div className="nf-target__macro">
                <b>{gramsText(shown.protein)} g</b>
                <span>
                  <i className="nf-dot" style={{ background: "var(--nf-mora)" }} /> Proteína
                </span>
              </div>
              <div className="nf-target__macro">
                <b>{gramsText(shown.carbs)} g</b>
                <span>
                  <i className="nf-dot" style={{ background: "var(--nf-maiz)" }} /> Carbohidratos
                </span>
              </div>
              <div className="nf-target__macro">
                <b>{gramsText(shown.fat)} g</b>
                <span>
                  <i className="nf-dot" style={{ background: "var(--nf-aguacate)" }} /> Grasa
                </span>
              </div>
            </div>
            <p className="nf-target__nutri">
              Fibra al menos <b>{nutrientGoals(shown.kcal).fiber} g</b> · Azúcar hasta <b>{nutrientGoals(shown.kcal).sugar} g</b> · Sodio hasta{" "}
              <b>{intText(nutrientGoals(shown.kcal).sodium)} mg</b>
            </p>
            {preview && !form.manual && (
              <p className="nf-explain">
                {preview.measured ? (
                  <>
                    Con tu peso y lo que comes, gastas unas <b>{kcalText(preview.tdee)} kcal</b> al día (la fórmula decía {kcalText(preview.formulaTdee ?? preview.tdee)}).
                  </>
                ) : (
                  <>
                    En reposo gastas unas <b>{kcalText(preview.bmr)} kcal</b>; con tu actividad, unas <b>{kcalText(preview.tdee)} kcal</b> al día.
                  </>
                )}
                {form.goal !== "MAINTAIN" &&
                  ` Para ${GOAL_VERB[form.goal]} ${rateText(form.ratePerWeek)} por semana se ${form.goal === "LOSE" ? "restan" : "suman"} ${kcalText(form.ratePerWeek * 1100)} kcal.`}
                {preview.floorApplied && " La meta quedó en el mínimo seguro: no conviene comer menos sin la guía de un profesional."}
                {!preview.measured &&
                  (form.adaptive
                    ? " Las fórmulas pueden fallar un 10 %: con tu peso y lo que comes, la meta se ajusta sola cada semana."
                    : " Las fórmulas pueden fallar un 10 %.")}
              </p>
            )}
          </>
        ) : (
          <p className="nf-explain">Llena tus datos y aquí aparece tu meta.</p>
        )}
        {!form.manual && (
          <div className="nf-switchrow">
            <Switch checked={form.adaptive} onChange={(v) => set("adaptive", v)} aria-labelledby="nf-adaptive-label" />
            <span>
              <span id="nf-adaptive-label">Ajustar la meta cada semana</span>
              <small>
                Cada lunes se revisa con tu peso de tendencia y, con unas 2 semanas de peso y comida, con lo que gastas de verdad. Lo ves en{" "}
                <button type="button" className="nf-link" onClick={() => navigate("/app/nutrifer/progreso")}>
                  Progreso
                </button>
                .
              </small>
            </span>
          </div>
        )}
        <label className="nf-switchrow">
          <Switch checked={form.manual} onChange={(v) => set("manual", v)} />
          <span>Prefiero poner mis metas a mano</span>
        </label>
        {form.manual && (
          <div className="nf-grid-2">
            {(
              [
                ["kcalTarget", "Calorías", "kcal", 800, 6000],
                ["proteinTarget", "Proteína", "g", 0, 400],
                ["carbsTarget", "Carbohidratos", "g", 0, 900],
                ["fatTarget", "Grasa", "g", 0, 300],
              ] as const
            ).map(([key, label, unit, min, max]) => (
              <div className="nf-field" key={key}>
                <label className="nf-label" htmlFor={`nf-${key}`}>
                  {label} ({unit})
                </label>
                <InputNumber
                  id={`nf-${key}`}
                  min={min}
                  max={max}
                  value={form[key] ?? (preview ? preview[key.replace("Target", "") as "kcal" | "protein" | "fat" | "carbs"] : null)}
                  inputMode="numeric"
                  onChange={(v) => set(key, typeof v === "number" ? Math.round(v) : null)}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      {/* En el computador, la meta queda fija a la derecha con su botón de guardar. */}
      <Button className="nf-only-desktop" type="primary" size="large" block loading={saving} disabled={!input} onClick={() => void save()}>
        Guardar mi meta
      </Button>
      </aside>

      <div className="nf-goal__b">
      <section className="nf-card" aria-labelledby="nf-goal-water">
        <h2 id="nf-goal-water">Agua</h2>
        <div className="nf-field">
          <span className="nf-label" id="nf-water-goal-label">
            Meta al día
          </span>
          <div className="nf-chips" role="group" aria-labelledby="nf-water-goal-label">
            {WATER_GOALS.map((ml) => (
              <button key={ml} type="button" className="nf-chip" aria-pressed={form.waterGoalMl === ml} onClick={() => set("waterGoalMl", ml)}>
                {mlText(ml)}
              </button>
            ))}
          </div>
        </div>
        <div className="nf-field">
          <span className="nf-label" id="nf-glass-label">
            Tu vaso
          </span>
          <div className="nf-chips" role="group" aria-labelledby="nf-glass-label">
            {GLASSES.map((ml) => (
              <button key={ml} type="button" className="nf-chip" aria-pressed={form.glassMl === ml} onClick={() => set("glassMl", ml)}>
                {ml} ml
              </button>
            ))}
          </div>
          <span className="nf-hint">
            Son {Math.round(form.waterGoalMl / form.glassMl)} vasos al día. Cada toque en «Un vaso» suma {form.glassMl} ml.
          </span>
        </div>
      </section>

      <section className="nf-card" aria-labelledby="nf-goal-meals">
        <h2 id="nf-goal-meals">Nombres de tus comidas</h2>
        <div className="nf-grid-2">
          {MEAL_ORDER.map((slot) => (
            <div className="nf-field" key={slot}>
              <label className="nf-label" htmlFor={`nf-meal-name-${slot}`}>
                {slot === "DESAYUNO" ? "1.ª comida" : slot === "MEDIAS_NUEVES" ? "Media mañana" : slot === "ALMUERZO" ? "Mediodía" : slot === "ONCES" ? "Media tarde" : "Noche"}
              </label>
              <Input id={`nf-meal-name-${slot}`} maxLength={30} value={form.mealNames[slot]} onChange={(e) => set("mealNames", { ...form.mealNames, [slot]: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      {/* Se guardan solos (no con «Guardar mi meta»). */}
      <HabitLinksCard />
      <BackupCard />
      </div>

      <div className="nf-actions nf-goal__actions nf-only-mobile" style={{ bottom: 0, marginBottom: 0, padding: "4px 0 0", background: "transparent" }}>
        <Button type="primary" size="large" loading={saving} disabled={!input} onClick={() => void save()}>
          Guardar mi meta
        </Button>
      </div>
    </div>
  );
}
