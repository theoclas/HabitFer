/*
 * La voz y los pitidos del modo guiado. Usa la voz que trae el celular (sin servicios de pago) y tonos hechos con
 * el audio del navegador. Lo del navegador solo se toca dentro de los métodos, así el archivo se prueba con Node.
 */

export type VoiceLike = { lang: string; name: string };

/** Preferencia de acento: Colombia, Latinoamérica, México, Estados Unidos y España. */
const ACCENTS = ["es-co", "es-419", "es-mx", "es-us", "es-es"];
const tag = (lang: string) => lang.toLowerCase().replace("_", "-");

/** La voz en español que mejor suena para Colombia, o null si el celular no tiene ninguna. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const spanish = voices.filter((v) => tag(v.lang).startsWith("es"));
  for (const accent of ACCENTS) {
    const v = spanish.find((x) => tag(x.lang) === accent);
    if (v) return v;
  }
  return spanish[0] ?? null;
}

export type Tone = "tick" | "go" | "end";
const TONES: Record<Tone, { freq: number; secs: number }> = {
  tick: { freq: 880, secs: 0.12 },
  go: { freq: 1320, secs: 0.3 },
  end: { freq: 660, secs: 0.45 },
};

export class Coach {
  voice = true;
  sounds = true;
  private ctx: AudioContext | null = null;
  private chosen: SpeechSynthesisVoice | null = null;
  private listening = false;

  /** Hay que llamarlo dentro de un toque: el iPhone solo deja sonar audio y voz si el primero sale de un toque. */
  unlock() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx && AC) this.ctx = new AC();
      void this.ctx?.resume();
    } catch {
      this.ctx = null;
    }
    this.loadVoice();
  }

  get canSpeak(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  private loadVoice() {
    if (!this.canSpeak) return;
    const synth = window.speechSynthesis;
    this.chosen = pickVoice(synth.getVoices());
    if (!this.chosen && !this.listening) {
      // En Chrome las voces llegan un momento después.
      this.listening = true;
      synth.addEventListener?.("voiceschanged", () => {
        this.chosen = pickVoice(synth.getVoices());
      });
    }
  }

  say(text: string) {
    if (!this.voice || !text || !this.canSpeak) return;
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.chosen?.lang ?? "es-CO";
    if (this.chosen) u.voice = this.chosen;
    u.rate = 1.05;
    // Cortar la frase anterior y hablar enseguida a veces se traga la nueva en Safari: se espera un momento.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      window.setTimeout(() => synth.speak(u), 80);
    } else {
      synth.speak(u);
    }
  }

  beep(tone: Tone) {
    if (!this.sounds || !this.ctx) return;
    try {
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const { freq, secs } = TONES[tone];
      const t = ctx.currentTime + 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + secs);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + secs + 0.05);
    } catch {
      /* sin sonido */
    }
  }

  /** Calla la voz (por ejemplo, al pausar). */
  hush() {
    if (this.canSpeak) window.speechSynthesis.cancel();
  }

  close() {
    this.hush();
    const ctx = this.ctx;
    this.ctx = null;
    void ctx?.close().catch(() => undefined);
  }
}
