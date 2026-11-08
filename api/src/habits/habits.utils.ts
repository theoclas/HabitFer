/**
 * Utilidades de fechas que usan los habitos. Las reglas (que dia toca, rachas, retos)
 * viven en habit-rules.ts.
 */
export { addDays, isCompletableDate, isSameDay, parseDateKey, startOfToday, toDateKey, toIsoWeekday } from '../common/date.utils';
export { parseScheduleDays } from './habit-rules';
