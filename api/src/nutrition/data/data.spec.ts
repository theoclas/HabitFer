import { slug, suspicious } from '../seed/seed.utils';
import { ALIASES } from './aliases';
import { BASICS } from './basics';
import { DISHES } from './dishes';
import { PACKAGED } from './packaged';
import { PORTIONS } from './portions';
import { PRIORITY } from './priority';

/** Código de la tabla del ICBF (TCAC 2018): una letra del grupo y tres números. */
const TCAC_CODE = /^[A-Z]\d{3}$/;

describe('datos propios de NutriFer', () => {
  it('básicos: códigos únicos, una medida por defecto y calorías que cuadran con los macros (salvo licores)', () => {
    const codes = BASICS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const b of BASICS) {
      expect(TCAC_CODE.test(b.code)).toBe(false);
      expect(b.portions.filter(([, grams, isDefault]) => isDefault && grams > 0)).toHaveLength(1);
      // En los licores las calorías salen del alcohol, que no es un macro.
      if (b.category !== 'Licores') expect({ code: b.code, suspicious: suspicious(b.per100) }).toEqual({ code: b.code, suspicious: false });
    }
  });

  it('platos: nombres únicos y cada parte apunta a la tabla del ICBF o a un básico', () => {
    const slugs = DISHES.map((d) => slug(d.name));
    expect(new Set(slugs).size).toBe(slugs.length);
    const basics = new Set(BASICS.map((b) => b.code));
    for (const d of DISHES) {
      expect(d.parts.length).toBeGreaterThan(0);
      for (const p of d.parts) {
        expect(p.grams).toBeGreaterThan(0);
        expect(Boolean(p.code || p.match)).toBe(true);
        if (p.code && !TCAC_CODE.test(p.code)) expect({ dish: d.name, code: p.code, known: basics.has(p.code) }).toEqual({ dish: d.name, code: p.code, known: true });
      }
    }
  });

  it('sinónimos, medidas y prioridades usan códigos de la tabla del ICBF', () => {
    for (const r of [...ALIASES, ...PORTIONS]) if (r.code) expect(r.code).toMatch(TCAC_CODE);
    for (const r of PRIORITY) expect(r.code).toMatch(TCAC_CODE);
    for (const r of PORTIONS) for (const [, grams] of r.portions) expect(grams).toBeGreaterThan(0);
  });

  it('empacados: códigos de barras válidos, sin repetir y con nombre', () => {
    const codes = PACKAGED.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of PACKAGED) {
      expect(p.code).toMatch(/^\d{8,14}$/);
      expect(p.name.trim()).not.toBe('');
    }
  });
});
