import type { MealSlot } from '@prisma/client';
import { MEAL_ORDER } from '../meals';
import { weekdayOf } from './days';
import { mealShares, type ReportDay, type SummaryTargets, type TopFood } from './report';

export type Discovery = {
  id: string;
  /** Una frase corta y sin culpa. */
  text: string;
  /** Los números que la respaldan. */
  detail: string;
  /** good = buena noticia; watch = vale la pena mirarlo; neutral = un dato. */
  tone: 'good' | 'watch' | 'neutral';
};

/** Diferencia mínima para decir que algo cambia (10 %). */
const MIN_DIFF = 0.1;
/** Proteína del desayuno que cuenta como «con proteína». */
const BREAKFAST_PROTEIN_G = 20;

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const kcal = (n: number) => `${nf.format(Math.round(n))} kcal`;
const pct = (n: number) => `${Math.round(Math.abs(n) * 100)} %`;
const avg = (list: number[]) => list.reduce((s, n) => s + n, 0) / list.length;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** «Tu almuerzo es» / «Tus onces son». */
const yourMeal = (name: string) => (/s$/i.test(name.trim()) ? `Tus ${lower(name)} son` : `Tu ${lower(name)} es`);
/** «Arroz blanco, pulido, cocido…» → «Arroz blanco». */
const shortName = (name: string) => name.split(',')[0].trim();

/**
 * Descubrimientos de las últimas semanas: frases como «los fines de semana comes 25 % más» o «los días que
 * desayunas con proteína comes menos en la tarde». Solo salen con datos suficientes y una diferencia de al menos
 * el 10 %; los días con muy poco anotado (seguro faltó algo) no cuentan.
 */
export function discoveries(days: ReportDay[], targets: SummaryTargets | null, top: TopFood[], names: Record<MealSlot, string>): Discovery[] {
  const minKcal = targets ? targets.kcal * 0.4 : 800;
  const logged = days.filter((d) => d.entries > 0 && d.kcal >= minKcal);
  if (logged.length < 5) return [];
  const out: Discovery[] = [];

  // Fines de semana frente a entre semana.
  const weekend = logged.filter((d) => weekdayOf(d.date) >= 6);
  const weekdays = logged.filter((d) => weekdayOf(d.date) <= 5);
  if (weekend.length >= 3 && weekdays.length >= 6) {
    const we = avg(weekend.map((d) => d.kcal));
    const wd = avg(weekdays.map((d) => d.kcal));
    const diff = (we - wd) / wd;
    if (Math.abs(diff) >= MIN_DIFF) {
      out.push({
        id: 'fin-de-semana',
        text: `Los fines de semana comes ${pct(diff)} ${diff > 0 ? 'más' : 'menos'} que entre semana.`,
        detail: `${kcal(we)} frente a ${kcal(wd)} al día en promedio (${weekend.length} días de fin de semana y ${weekdays.length} entre semana).`,
        tone: 'neutral',
      });
    }
  }

  // Desayuno con proteína y lo que se come después.
  const withBreakfast = logged.filter((d) => d.meals.DESAYUNO > 0);
  const high = withBreakfast.filter((d) => d.breakfastProtein >= BREAKFAST_PROTEIN_G);
  const low = withBreakfast.filter((d) => d.breakfastProtein < BREAKFAST_PROTEIN_G);
  if (high.length >= 4 && low.length >= 4) {
    const later = (d: ReportDay) => d.meals.ONCES + d.meals.COMIDA;
    const h = avg(high.map(later));
    const l = avg(low.map(later));
    const diff = l > 0 ? (h - l) / l : 0;
    if (l > 0 && Math.abs(diff) >= MIN_DIFF) {
      out.push({
        id: 'desayuno-proteina',
        text: `Los días que desayunas con proteína (${BREAKFAST_PROTEIN_G} g o más) comes ${pct(diff)} ${diff < 0 ? 'menos' : 'más'} en ${lower(names.ONCES)} y ${lower(names.COMIDA)}.`,
        detail: `${kcal(h)} frente a ${kcal(l)} en esas dos comidas (${high.length} días con proteína y ${low.length} sin).`,
        tone: diff < 0 ? 'good' : 'neutral',
      });
    }
  }

  if (targets && logged.length >= 7) {
    const inTarget = logged.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * 0.1).length;
    if (inTarget / logged.length >= 0.5) {
      out.push({
        id: 'en-meta',
        text: `Estuviste en tu meta de calorías ${inTarget} de ${logged.length} días.`,
        detail: `Contando los días a menos de un 10 % de ${kcal(targets.kcal)}.`,
        tone: 'good',
      });
    }
    const proteinDays = logged.filter((d) => d.protein >= targets.protein * 0.9).length;
    const proteinAvg = avg(logged.map((d) => d.protein));
    if (proteinDays / logged.length >= 0.7) {
      out.push({
        id: 'proteina',
        text: `Llegaste a la proteína ${proteinDays} de ${logged.length} días.`,
        detail: `Promedias ${nf.format(Math.round(proteinAvg))} g al día; la meta es ${nf.format(targets.protein)} g.`,
        tone: 'good',
      });
    } else if (proteinDays / logged.length <= 0.3) {
      out.push({
        id: 'proteina',
        text: `Llegaste a la proteína solo ${proteinDays} de ${logged.length} días.`,
        detail: `Promedias ${nf.format(Math.round(proteinAvg))} g al día; la meta es ${nf.format(targets.protein)} g.`,
        tone: 'watch',
      });
    }
  }

  // La comida que más pesa en el día.
  const shares = mealShares(logged);
  const biggest = [...shares].sort((a, b) => b.share - a.share)[0];
  if (biggest && biggest.share >= 0.4) {
    out.push({
      id: 'comida-grande',
      text: `${yourMeal(names[biggest.slot])} el ${pct(biggest.share)} de lo que comes en el día.`,
      detail: `${kcal(biggest.kcal / logged.length)} en promedio; ${MEAL_ORDER.filter((m) => m !== biggest.slot)
        .map((m) => `${lower(names[m])} ${pct(shares.find((s) => s.slot === m)?.share ?? 0)}`)
        .join(', ')}.`,
      tone: 'neutral',
    });
  }

  // Lo que más calorías aporta.
  const first = top[0];
  if (first && first.share >= 0.08 && first.times >= 3) {
    out.push({
      id: 'mas-calorias',
      text: `${shortName(first.name)} te aportó el ${pct(first.share)} de las calorías.`,
      detail: `${kcal(first.kcal)} en ${first.times} veces.`,
      tone: 'neutral',
    });
  }

  if (targets && logged.length >= 7) {
    const fiber = avg(logged.map((d) => d.fiber));
    if (fiber < targets.fiber * 0.7) {
      out.push({
        id: 'fibra',
        text: `Tu fibra va en ${nf.format(Math.round(fiber))} g al día; la meta es ${nf.format(targets.fiber)} g.`,
        detail: 'Los fríjoles, las lentejas, la fruta entera y las verduras son los que más la suben.',
        tone: 'watch',
      });
    }
    const salty = logged.filter((d) => d.sodium > targets.sodium).length;
    if (salty / logged.length >= 0.5) {
      out.push({
        id: 'sodio',
        text: `Pasaste el límite de sodio ${salty} de ${logged.length} días.`,
        detail: `El límite es ${nf.format(targets.sodium)} mg; los embutidos, los paquetes y los caldos en cubo suman mucho.`,
        tone: 'watch',
      });
    }
  }

  return out.sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id)).slice(0, 6);
}

/** Primero lo que más cambia el día a día; los datos sueltos al final. */
const PRIORITY = ['fin-de-semana', 'desayuno-proteina', 'proteina', 'en-meta', 'fibra', 'sodio', 'comida-grande', 'mas-calorias'];
