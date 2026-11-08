import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FoodsService, type FoodResult } from '../foods.service';
import { normalize } from '../search.utils';
import { canPrep, matchPortion, proposeAmount, suggestedOil, type Usual } from './text.amount';
import { parseFoodText, splitCon, stripPrepWords, type ParsedItem } from './text.parse';

const CANDIDATE_INCLUDE = {
  portions: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
  _count: { select: { parts: true } },
} satisfies Prisma.FoodInclude;

type CandidateRow = Prisma.FoodGetPayload<{ include: typeof CANDIDATE_INCLUDE }>;

/** Cuántos alimentos se ofrecen por cada cosa entendida (el primero es el elegido). */
const CANDIDATES = 6;

function candidateView(f: CandidateRow) {
  const isDish = f._count.parts > 0;
  return {
    id: f.id,
    name: f.name,
    source: f.source,
    isDish,
    canPrep: canPrep({ name: f.name, category: f.category, source: f.source, isDish }),
    per100: { kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs },
    portions: f.portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams, isDefault: p.isDefault })),
  };
}

/**
 * «Escribe o dicta», sin IA: entiende el texto, busca cada cosa en la base (primero lo que el
 * usuario ya corrigió antes), y propone cuánto con lo que anotó la última vez de cada alimento.
 * No guarda nada: el teléfono muestra la propuesta y la persona confirma.
 */
@Injectable()
export class FoodTextService {
  constructor(
    private prisma: PrismaService,
    private foods: FoodsService,
  ) {}

  /** Lo que el usuario ya corrigió antes: frase → alimento. */
  private async learnedFor(userId: string, list: ParsedItem[]): Promise<Map<string, string>> {
    const keys = [...new Set(list.map((p) => p.search))];
    const rows = await this.prisma.foodAlias.findMany({ where: { userId, phrase: { in: keys } }, select: { phrase: true, foodId: true } });
    return new Map(rows.map((a) => [a.phrase, a.foodId]));
  }

  /**
   * Busca cada cosa. Si no aparece, prueba sin cómo se preparó («pechuga a la plancha» → «pechuga»:
   * la preparación ya va aparte) y luego con lo que se escribió tal cual.
   */
  private async findAll(userId: string, list: ParsedItem[]): Promise<FoodResult[][]> {
    const first = await this.foods.searchMany(userId, list.map((p) => p.search), CANDIDATES);
    const retry = list.map((p, i) => {
      if (first[i].length > 0) return null;
      const bare = stripPrepWords(p.search);
      if (bare && bare !== p.search) return bare;
      return p.name !== p.search ? p.name : null;
    });
    if (!retry.some(Boolean)) return first;
    const second = await this.foods.searchMany(userId, retry.map((q) => q ?? ''), CANDIDATES);
    return list.map((_, i) => (first[i].length > 0 ? first[i] : retry[i] ? second[i] : []));
  }

  async understand(userId: string, text: string) {
    let parsed = parseFoodText(text);
    if (parsed.length === 0) return { items: [] };

    let [learned, found] = await Promise.all([this.learnedFor(userId, parsed), this.findAll(userId, parsed)]);
    // «Dos huevos fritos con arepa»: si lo mejor que aparece no es un alimento «con» algo (como «café
    // con leche» o «arroz con pollo»), son dos cosas.
    const lost = (p: ParsedItem, i: number) =>
      /\scon\s/.test(p.name) && !learned.has(p.search) && !(found[i][0] && /\bcon\b/.test(normalize(found[i][0].name)));
    if (parsed.some(lost)) {
      parsed = parsed.flatMap((p, i) => (lost(p, i) ? splitCon(p) : [p])).slice(0, 30);
      [learned, found] = await Promise.all([this.learnedFor(userId, parsed), this.findAll(userId, parsed)]);
    }
    const idsPer = parsed.map((p, i) => {
      const ids = found[i].map((f) => f.id);
      const mine = learned.get(p.search);
      return mine ? [mine, ...ids.filter((id) => id !== mine)].slice(0, CANDIDATES) : ids;
    });

    const allIds = [...new Set(idsPer.flat())];
    const [rows, lasts] = allIds.length
      ? await Promise.all([
          this.prisma.food.findMany({
            where: { id: { in: allIds }, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] },
            include: CANDIDATE_INCLUDE,
          }),
          this.prisma.mealEntry.findMany({
            where: { userId, foodId: { in: allIds }, quick: false },
            orderBy: { createdAt: 'desc' },
            distinct: ['foodId'],
            select: { foodId: true, portionLabel: true, quantity: true, grams: true },
          }),
        ])
      : [[], []];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const usualBy = new Map(lasts.map((l) => [l.foodId as string, { portionLabel: l.portionLabel, quantity: l.quantity, grams: l.grams }]));

    const items = parsed.map((p, i) => {
      const found = idsPer[i].map((id) => byId.get(id)).filter((r): r is CandidateRow => r !== undefined);
      // «Un pocillo de chocolate»: primero lo que se sirve en pocillo (el aprendido se queda arriba).
      const fits = (f: CandidateRow) => (p.unit && p.grams === null && matchPortion(f.portions, p.unit, null) ? 0 : 1);
      const pinned = learned.get(p.search);
      const candidates = [...found].sort((a, b) => (a.id === pinned ? -1 : b.id === pinned ? 1 : fits(a) - fits(b)));
      return {
        key: String(i),
        phrase: p.phrase,
        name: p.name,
        /** Con esto se guarda el nombre aprendido si la persona elige otro alimento. */
        aliasKey: p.search,
        meal: p.meal,
        learned: candidates.length > 0 && learned.get(p.search) === candidates[0].id,
        candidates: candidates.map(candidateView),
        /** Cuánto de cada candidato (para cambiar de alimento sin volver a preguntar). */
        proposals: Object.fromEntries(candidates.map((f) => [f.id, this.proposal(f, p, usualBy.get(f.id) ?? null)])),
      };
    });
    return { items };
  }

  private proposal(f: CandidateRow, p: ParsedItem, usual: Usual | null) {
    const a = proposeAmount({ portions: f.portions }, p, usual);
    const isDish = f._count.parts > 0;
    const portion = a.portionId ? f.portions.find((x) => x.id === a.portionId) : undefined;
    const grams = portion ? portion.grams * a.quantity : (a.grams ?? 100);
    const prep = p.prep && canPrep({ name: f.name, category: f.category, source: f.source, isDish }) ? p.prep : null;
    return {
      portionId: a.portionId ?? null,
      quantity: a.quantity,
      grams: a.grams ?? null,
      prep,
      oilGrams: prep ? suggestedOil(prep, grams) || null : null,
      how: a.how,
    };
  }
}
