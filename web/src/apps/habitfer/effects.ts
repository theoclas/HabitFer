/** Pequenos efectos fisicos de HabitFer: chispas al marcar, vibracion corta y sonido opcional. */

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Vibracion corta (Android). iOS la ignora sin error. */
export function buzz(ms: number | number[] = 12) {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* sin vibracion */
  }
}

/** Ocho chispas que salen del elemento (normalmente el boton del check). */
export function burstSparks(from: Element, color: string) {
  if (prefersReducedMotion()) return;
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span");
    const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
    const dist = 22 + Math.random() * 20;
    s.className = "hf-spark";
    s.style.left = `${cx}px`;
    s.style.top = `${cy}px`;
    s.style.background = i % 3 === 0 ? "#FFD08A" : color;
    s.style.setProperty("--dx", `${(Math.cos(ang) * dist).toFixed(1)}px`);
    s.style.setProperty("--dy", `${(Math.sin(ang) * dist - 10).toFixed(1)}px`);
    document.body.appendChild(s);
    window.setTimeout(() => s.remove(), 750);
  }
}

/* ---------- Sonido (apagado por defecto) ---------- */

const SOUND_KEY = "hf_sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* sin almacenamiento */
  }
}

let audio: AudioContext | null = null;

/** Un "tic" corto al marcar; un acorde que sube para el dia perfecto. */
export function playTick(kind: "done" | "perfect" = "done") {
  if (!soundEnabled()) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio = audio ?? new Ctor();
    if (audio.state === "suspended") void audio.resume();
    const ctx = audio;
    const now = ctx.currentTime;
    const notes = kind === "perfect" ? [523.25, 659.25, 783.99, 1046.5] : [880, 1318.5];
    const step = kind === "perfect" ? 0.09 : 0.05;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = now + i * step;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(kind === "perfect" ? 0.16 : 0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "perfect" ? 0.5 : 0.2));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    /* sin audio */
  }
}

/** Avisa a las pantallas de HabitFer que los habitos cambiaron (p. ej. se creo uno desde el boton +). */
export const HABITS_CHANGED_EVENT = "habitfer:habits-changed";

export function notifyHabitsChanged() {
  window.dispatchEvent(new CustomEvent(HABITS_CHANGED_EVENT));
}
