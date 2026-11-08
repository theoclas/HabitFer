/** Textos de los niveles de aviso (correo y WhatsApp usan los mismos). */
import type { EmailLevel } from "../../../api/client";

export const LEVEL_OPTIONS: { label: string; value: EmailLevel }[] = [
  { label: "Apagado", value: "OFF" },
  { label: "Resumen", value: "SUMMARY" },
  { label: "Todo", value: "ALL" },
];

/** Qué trae cada nivel. En el correo el aviso trae un botón; en WhatsApp, un enlace. */
export function levelHint(level: EmailLevel, channel: "correo" | "whatsapp"): string {
  if (level === "OFF") return channel === "correo" ? "No te llegan correos." : "No te llegan mensajes.";
  const digest = "el mensaje de la mañana, el resumen de la noche y el coach de los domingos";
  if (level === "SUMMARY") return `Te llega ${digest}.`;
  const action = channel === "correo" ? "un botón" : "un enlace";
  return `Te llega cada recordatorio de tus hábitos y tareas (con ${action} para marcarlo hecho), además de ${digest}.`;
}

/** Si el mensaje de la mañana o el resumen de la noche están apagados, recuerda activarlos. */
export function digestNote(level: EmailLevel, morningTime: string | null, summaryTime: string | null): string {
  if (level === "OFF") return "";
  const off = [!morningTime && "el mensaje de la mañana", !summaryTime && "el resumen de la noche"].filter(
    (x): x is string => Boolean(x),
  );
  if (off.length === 0) return "";
  return ` Para recibir ${off.join(" y ")}, ${off.length === 1 ? "actívalo" : "actívalos"} arriba.`;
}
