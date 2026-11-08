import { ReminderLevel } from '@prisma/client';

/** reminder: cada aviso de hábitos y tareas. digest: el resumen de la noche y el coach. */
export type ReminderKind = 'reminder' | 'digest';

/** Si un canal (correo o WhatsApp) con ese nivel recibe ese tipo de aviso. */
export function levelAllows(level: ReminderLevel, kind: ReminderKind): boolean {
  if (kind === 'digest') return level !== ReminderLevel.OFF;
  return level === ReminderLevel.ALL;
}
