import {
  atwaterKcal,
  bmr,
  computeTargets,
  dishTotals,
  formatQuantity,
  per100FromParts,
  recipeValues,
  roundTotals,
  scale,
  sumTotals,
} from './nutrition-math';

describe('metas', () => {
  it('Mifflin-St Jeor: hombre y mujer', () => {
    // 10·80 + 6,25·175 − 5·35 + 5 = 1.723,75
    expect(bmr({ sex: 'MALE', weightKg: 80, heightCm: 175, age: 35 })).toBeCloseTo(1723.75, 2);
    // 10·60 + 6,25·160 − 5·30 − 161 = 1.289
    expect(bmr({ sex: 'FEMALE', weightKg: 60, heightCm: 160, age: 30 })).toBeCloseTo(1289, 2);
  });

  it('mantener: gasto = basal × actividad, redondeado a 10', () => {
    const t = computeTargets({ sex: 'MALE', birthYear: 1991, heightCm: 175, weightKg: 80, activity: 1.375, goal: 'MAINTAIN', ratePerWeek: 0.5 }, 2026);
    expect(t.age).toBe(35);
    expect(t.bmr).toBe(1724);
    expect(t.tdee).toBe(2370); // 1.723,75 × 1,375 = 2.370,2
    expect(t.kcal).toBe(2370);
    expect(t.floorApplied).toBe(false);
  });

  it('bajar medio kilo por semana resta 550 kcal y sube la proteína', () => {
    const t = computeTargets({ sex: 'MALE', birthYear: 1991, heightCm: 175, weightKg: 80, activity: 1.375, goal: 'LOSE', ratePerWeek: 0.5 }, 2026);
    expect(t.kcal).toBe(1820); // 2.370,2 − 550 = 1.820,2
    expect(t.protein).toBe(144); // 1,8 × 80
    expect(t.fat).toBe(Math.round((1820 * 0.28) / 9));
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeGreaterThan(1800);
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeLessThan(1840);
  });

  it('nunca baja del mínimo seguro aunque el ritmo pida más', () => {
    const t = computeTargets({ sex: 'FEMALE', birthYear: 1996, heightCm: 155, weightKg: 52, activity: 1.2, goal: 'LOSE', ratePerWeek: 1 }, 2026);
    expect(t.floorApplied).toBe(true);
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr - 5);
  });

  it('subir suma el ritmo; la proteína usa como máximo el peso con IMC 27', () => {
    const t = computeTargets({ sex: 'MALE', birthYear: 2001, heightCm: 170, weightKg: 120, activity: 1.55, goal: 'GAIN', ratePerWeek: 0.25 }, 2026);
    expect(t.kcal).toBe(Math.round((t.tdee + 275) / 10) * 10);
    expect(t.protein).toBe(Math.round(1.6 * 27 * 1.7 * 1.7)); // 125, no 192
  });
});

describe('porciones y sumas', () => {
  const arepa = { kcal: 219, protein: 4.6, fat: 1.6, carbs: 46, fiber: 2.4, sodium: 290 };

  it('scale: valores de unos gramos', () => {
    const t = scale(arepa, 56);
    expect(t.kcal).toBeCloseTo(122.64, 2);
    expect(t.sugar).toBe(0); // sin dato cuenta como 0
    expect(scale(arepa, -10).kcal).toBe(0);
  });

  it('roundTotals: kcal y sodio enteros, el resto con un decimal', () => {
    expect(roundTotals({ kcal: 122.6, protein: 2.576, fat: 0.896, carbs: 25.76, fiber: 1.34, sugar: 0, sodium: 162.4 })).toEqual({
      kcal: 123,
      protein: 2.6,
      fat: 0.9,
      carbs: 25.8,
      fiber: 1.3,
      sugar: 0,
      sodium: 162,
    });
  });

  it('sumTotals', () => {
    const s = sumTotals([scale(arepa, 100), scale(arepa, 50)]);
    expect(s.kcal).toBeCloseTo(328.5, 5);
  });

  it('plato por partes: quitar el chicharrón resta sus calorías', () => {
    const arroz = { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 };
    const chicharron = { kcal: 573, protein: 20, fat: 54, carbs: 0 };
    const parts = [
      { per100: arroz, grams: 150, included: true },
      { per100: chicharron, grams: 80, included: true },
    ];
    const full = dishTotals(parts, 1);
    expect(full.grams).toBe(230);
    expect(full.totals.kcal).toBeCloseTo(195 + 458.4, 5);
    const sin = dishTotals([parts[0], { ...parts[1], included: false }], 1);
    expect(sin.grams).toBe(150);
    expect(sin.totals.kcal).toBeCloseTo(195, 5);
    expect(dishTotals(parts, 0.5).totals.kcal).toBeCloseTo((195 + 458.4) / 2, 5);
  });

  it('per100FromParts: el plato completo por 100 g', () => {
    const p = per100FromParts([
      { per100: { kcal: 100, protein: 10, fat: 0, carbs: 0 }, grams: 100 },
      { per100: { kcal: 300, protein: 0, fat: 10, carbs: 50 }, grams: 100 },
    ]);
    expect(p.kcal).toBeCloseTo(200, 5);
    expect(p.protein).toBeCloseTo(5, 5);
    expect(per100FromParts([]).kcal).toBe(0);
  });

  it('atwaterKcal y formatQuantity', () => {
    expect(atwaterKcal({ protein: 10, fat: 10, carbs: 10 })).toBe(170);
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(0.25)).toBe('0,25');
  });
});

describe('recetas', () => {
  const t = (kcal: number, protein = 0) => ({ kcal, protein, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 });

  it('reparte la olla por porciones y por 100 g de la suma de ingredientes', () => {
    const r = recipeValues(
      [
        { grams: 500, totals: t(600, 40) },
        { grams: 1500, totals: t(0) },
      ],
      4,
    );
    expect(r.rawGrams).toBe(2000);
    expect(r.weight).toBe(2000);
    expect(r.servingGrams).toBe(500);
    expect(r.perServing.kcal).toBe(150);
    expect(r.perServing.protein).toBe(10);
    expect(r.per100.kcal).toBe(30);
  });

  it('si se pesó la olla, los 100 g son del peso final', () => {
    const r = recipeValues([{ grams: 1000, totals: t(800) }], 4, 1600);
    expect(r.weight).toBe(1600);
    expect(r.servingGrams).toBe(400);
    expect(r.per100.kcal).toBe(50);
    expect(r.perServing.kcal).toBe(200);
  });

  it('sin porciones válidas cuenta una', () => {
    expect(recipeValues([{ grams: 100, totals: t(100) }], 0).perServing.kcal).toBe(100);
  });
});
