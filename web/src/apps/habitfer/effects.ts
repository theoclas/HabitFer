/** Pequenos efectos fisicos de HabitFer: chispas al marcar y vibracion corta. */

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Vibracion corta (Android). iOS la ignora sin error. */
export function buzz(ms = 12) {
  try {
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

/** Avisa a las pantallas de HabitFer que los habitos cambiaron (p. ej. se creo uno desde el boton +). */
export const HABITS_CHANGED_EVENT = "habitfer:habits-changed";

export function notifyHabitsChanged() {
  window.dispatchEvent(new CustomEvent(HABITS_CHANGED_EVENT));
}
