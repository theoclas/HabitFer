import type { CreateHabitPayload } from "../../types";

export type TemplatePack = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  habits: CreateHabitPayload[];
};

/** Packs para crear varios habitos de un toque, con emoji, color, momento y meta listos. */
export const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: "manana",
    name: "Mañana productiva",
    emoji: "🌅",
    description: "Arranca el día con ventaja.",
    habits: [
      { title: "Levantarme temprano", icon: "⏰", color: "#F59E0B", timeOfDay: "MORNING" },
      { title: "Tender la cama", icon: "🛏️", color: "#A78BFA", timeOfDay: "MORNING" },
      { title: "Vaso de agua al despertar", icon: "💧", color: "#38BDF8", timeOfDay: "MORNING" },
      { title: "Leer", icon: "📚", color: "#F97316", timeOfDay: "MORNING", goal: 10, unit: "páginas", step: 5 },
      { title: "Planear el día", icon: "📝", color: "#34D399", timeOfDay: "MORNING" },
    ],
  },
  {
    id: "salud",
    name: "Salud",
    emoji: "💪",
    description: "Cuerpo con energía todo el día.",
    habits: [
      { title: "Tomar agua", icon: "💧", color: "#38BDF8", goal: 8, unit: "vasos", step: 1 },
      { title: "Caminar", icon: "🚶", color: "#34D399", goal: 30, unit: "minutos", step: 10 },
      { title: "Gimnasio", icon: "🏋️", color: "#EF4444", scheduleType: "WEEKLY_COUNT", weeklyTarget: 3 },
      { title: "Comer fruta", icon: "🍎", color: "#F472B6", timeOfDay: "AFTERNOON" },
      { title: "Dormir antes de las 11", icon: "😴", color: "#818CF8", timeOfDay: "EVENING" },
    ],
  },
  {
    id: "mente",
    name: "Mente",
    emoji: "🧠",
    description: "Calma, foco y buenas ideas.",
    habits: [
      { title: "Meditar", icon: "🧘", color: "#A78BFA", timeOfDay: "MORNING", goal: 10, unit: "minutos", step: 5 },
      { title: "Escribir en el diario", icon: "✍️", color: "#F59E0B", timeOfDay: "EVENING" },
      { title: "Leer", icon: "📖", color: "#F97316", goal: 20, unit: "páginas", step: 5 },
      { title: "Tres cosas que agradezco", icon: "🙏", color: "#34D399", timeOfDay: "EVENING" },
      { title: "Sin pantalla antes de dormir", icon: "📵", color: "#64748B", timeOfDay: "EVENING" },
    ],
  },
  {
    id: "dj",
    name: "DJ y música",
    emoji: "🎧",
    description: "Técnica, oído y carrera.",
    habits: [
      { title: "Practicar mezclas", icon: "🎧", color: "#F97316", goal: 30, unit: "minutos", step: 10 },
      { title: "Escuchar música nueva", icon: "🎵", color: "#A78BFA" },
      { title: "Organizar la biblioteca", icon: "💿", color: "#38BDF8", scheduleType: "WEEKLY_COUNT", weeklyTarget: 2 },
      { title: "Publicar contenido", icon: "📱", color: "#F472B6", scheduleType: "WEEKLY_COUNT", weeklyTarget: 3 },
      { title: "Grabar un set", icon: "🎚️", color: "#EF4444", scheduleType: "WEEKLY_COUNT", weeklyTarget: 1 },
    ],
  },
  {
    id: "dejar",
    name: "Dejar algo",
    emoji: "🚭",
    description: "Cuenta tus días limpio.",
    habits: [
      { title: "No fumar", icon: "🚭", color: "#94A3B8", kind: "QUIT" },
      { title: "Sin azúcar", icon: "🍬", color: "#F472B6", kind: "QUIT", challengeDays: 30 },
      { title: "Sin alcohol", icon: "🍺", color: "#F59E0B", kind: "QUIT" },
      { title: "Sin comida chatarra", icon: "🍔", color: "#EF4444", kind: "QUIT" },
    ],
  },
  {
    id: "reto30",
    name: "Reto de 30 días",
    emoji: "🏁",
    description: "Un mes sin fallar, con medalla al final.",
    habits: [
      { title: "30 días de ejercicio", icon: "🏃", color: "#EF4444", challengeDays: 30 },
      { title: "30 días leyendo", icon: "📚", color: "#F97316", goal: 10, unit: "páginas", step: 5, challengeDays: 30 },
      { title: "30 días sin redes al despertar", icon: "📵", color: "#64748B", timeOfDay: "MORNING", challengeDays: 30 },
    ],
  },
];

/** Una linea que explica el habito de la plantilla. */
export function templateDetail(h: CreateHabitPayload): string {
  const parts: string[] = [];
  if (h.kind === "QUIT") parts.push("para dejar · cuenta días limpio");
  else if (h.scheduleType === "WEEKLY_COUNT") parts.push(`${h.weeklyTarget ?? 3} ${h.weeklyTarget === 1 ? "vez" : "veces"} por semana`);
  else parts.push("todos los días");
  if (h.goal && h.goal > 1) parts.push(`${h.goal} ${h.unit ?? ""}`.trim());
  if (h.challengeDays) parts.push(`reto de ${h.challengeDays} días`);
  return parts.join(" · ");
}
