/*
 * Figuras de FerFit: una persona de palitos que va de una pose a otra, dibujada en código (sin imágenes de nadie).
 * Cada pose se describe con ángulos (tronco, hombros, codos, caderas, rodillas) y aquí se calculan los puntos.
 * La web solo dibuja las líneas y las anima de la pose A a la B y de vuelta.
 *
 * Ángulos en grados, en la pantalla: 0 = hacia abajo, 90 = hacia adelante (derecha), 180 = hacia arriba,
 * -90 = hacia atrás (izquierda). La figura mira a la derecha. El lienzo es de 120 × 120 y el piso está en y = 108.
 */

export type Pt = [number, number];

/** Un brazo: ángulo del brazo (hombro) y cuánto se dobla el codo. */
export type Arm = { s: number; e?: number };
/** Una pierna: ángulo del muslo (cadera), cuánto se dobla la rodilla y, si hace falta, el ángulo del pie. */
export type Leg = { h: number; k?: number; f?: number };

export type Anchor = {
  joint: 'ankle' | 'toe' | 'knee' | 'hip' | 'hand' | 'elbow' | 'neck' | 'head';
  /** Cuál brazo o pierna (0 = el de adelante). */
  limb?: number;
  at: Pt;
};

export type PoseSpec = {
  /** De lado (por defecto) o de frente. */
  view?: 'side' | 'front';
  /** Inclinación del tronco: 0 = derecho, 90 = acostado boca abajo con la cabeza adelante, -90 = cabeza atrás. */
  t?: number;
  /** Cabeza respecto al tronco (positivo = mira hacia abajo). */
  neck?: number;
  /** De lado: [el de adelante, el de atrás]. De frente: [derecho (izquierda de la pantalla), izquierdo]. */
  arms: Arm[];
  legs: Leg[];
  /** Dónde va la figura. Sin esto: el pie de adelante en (60, 108); de frente, los pies en el piso y centrada. */
  anchor?: Anchor;
};

export type PropSpec =
  /** Silla de lado: el respaldo en x y el asiento hacia adelante. */
  | { type: 'chair'; x: number }
  | { type: 'wall'; x: number }
  /** Escalón o cajón: desde x, ancho w y alto h. */
  | { type: 'step'; x: number; w: number; h: number }
  /** Marco de una puerta (dos palos). */
  | { type: 'door'; x: number };

export type FigureSpec = {
  a: PoseSpec;
  /** Sin b, la figura se queda quieta (planchas y estiramientos que se sostienen). */
  b?: PoseSpec;
  props?: PropSpec[];
  /** Mancuernas en las manos. */
  weights?: boolean;
  /** Banda elástica de la mano de adelante a un punto fijo (o al pie de adelante). */
  band?: 'foot' | Pt;
  /** Segundos de ida y vuelta. */
  dur?: number;
};

export type Line = { d: string; far: boolean };
export type Shape = { head: Pt; lines: Line[]; hands: Pt[] };
export type Figure = {
  /** De lado (los brazos y piernas de atrás van más claros) o de frente. */
  view: 'side' | 'front';
  a: Shape;
  b: Shape | null;
  /** Lo que no se mueve: piso, silla, pared, escalón. */
  props: string[];
  weights: boolean;
  /** La banda en la pose A y en la B. */
  band: { a: string; b: string | null } | null;
  dur: number;
};

export const FLOOR_Y = 108;
export const HEAD_R = 7.5;
const L = { trunk: 30, head: 10, upper: 16, fore: 15, thigh: 22, shin: 21, foot: 8, shoulderDrop: 3, hipHalf: 5, shoulderHalf: 7 };

const rad = (d: number) => (d * Math.PI) / 180;
/** Hacia dónde apunta un ángulo (0 = abajo, 90 = adelante). */
const dir = (a: number): Pt => [Math.sin(rad(a)), Math.cos(rad(a))];
const add = (p: Pt, v: Pt, k = 1): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const r1 = (n: number) => Math.round(n * 10) / 10;

type Joints = {
  head: Pt;
  neck: Pt;
  hip: Pt;
  /** Segmentos del tronco (de lado: cadera-cuello; de frente: también hombros y cadera). */
  trunk: Pt[][];
  arms: Pt[][];
  legs: Pt[][];
};

/** El pie: plano y hacia adelante si la pierna está más o menos de pie; si no, perpendicular a la canilla. */
function footAngle(shin: number, f: number | undefined): number {
  if (f !== undefined) return f;
  return Math.abs(shin) <= 60 ? 90 : shin + 90;
}

function sideJoints(p: PoseSpec): Joints {
  const t = p.t ?? 0;
  const hip: Pt = [0, 0];
  const up = dir(180 - t);
  const neck = add(hip, up, L.trunk);
  const head = add(neck, dir(180 - t - (p.neck ?? 0)), L.head);
  const shoulder = add(neck, up, -L.shoulderDrop);
  const arms = p.arms.map(({ s, e = 0 }) => {
    const elbow = add(shoulder, dir(s), L.upper);
    return [shoulder, elbow, add(elbow, dir(s + e), L.fore)];
  });
  const legs = p.legs.map(({ h, k = 0, f }) => {
    const knee = add(hip, dir(h), L.thigh);
    const shin = h - k;
    const ankle = add(knee, dir(shin), L.shin);
    return [hip, knee, ankle, add(ankle, dir(footAngle(shin, f)), L.foot)];
  });
  return { head, neck, hip, trunk: [[hip, neck]], arms, legs };
}

function frontJoints(p: PoseSpec): Joints {
  const t = p.t ?? 0;
  const hip: Pt = [0, 0];
  const up = dir(180 - t);
  const across = dir(90 - t);
  const neck = add(hip, up, L.trunk);
  const head = add(neck, dir(180 - t - (p.neck ?? 0)), L.head);
  const sBase = add(neck, up, -L.shoulderDrop);
  const shoulders: Pt[] = [add(sBase, across, -L.shoulderHalf), add(sBase, across, L.shoulderHalf)];
  const hips: Pt[] = [add(hip, across, -L.hipHalf), add(hip, across, L.hipHalf)];
  const arms = p.arms.map(({ s, e = 0 }, i) => {
    const sh = shoulders[i] ?? shoulders[0];
    const elbow = add(sh, dir(s), L.upper);
    // De frente el codo se dobla hacia afuera del lado de cada brazo.
    const bend = i === 0 ? -e : e;
    return [sh, elbow, add(elbow, dir(s + bend), L.fore)];
  });
  const legs = p.legs.map(({ h, k = 0 }, i) => {
    const hp = hips[i] ?? hips[0];
    const knee = add(hp, dir(h), L.thigh);
    // Al doblar la rodilla de frente, la canilla vuelve hacia la vertical.
    const shin = h < 0 ? h + k : h - k;
    const ankle = add(knee, dir(shin), L.shin);
    const out = i === 0 ? -1 : 1;
    return [hp, knee, ankle, [ankle[0] + out * 5, ankle[1]] as Pt];
  });
  return { head, neck, hip, trunk: [[hip, neck], shoulders, hips], arms, legs };
}

function jointsOf(p: PoseSpec): Joints {
  return p.view === 'front' ? frontJoints(p) : sideJoints(p);
}

function anchorPoint(j: Joints, a: Anchor): Pt {
  const limb = a.limb ?? 0;
  switch (a.joint) {
    case 'ankle':
      return j.legs[limb][2];
    case 'toe':
      return j.legs[limb][3];
    case 'knee':
      return j.legs[limb][1];
    case 'hip':
      return j.hip;
    case 'hand':
      return j.arms[limb][2];
    case 'elbow':
      return j.arms[limb][1];
    case 'neck':
      return j.neck;
    case 'head':
      return j.head;
  }
}

/** Mueve la figura a su sitio: al ancla, o (de frente) con lo más bajo tocando el piso y centrada. */
function place(p: PoseSpec, j: Joints): Joints {
  let shift: Pt;
  if (p.anchor) {
    const at = anchorPoint(j, p.anchor);
    shift = [p.anchor.at[0] - at[0], p.anchor.at[1] - at[1]];
  } else if (p.view === 'front') {
    const lows = [...j.legs.flat(), ...j.arms.flat(), [j.head[0], j.head[1] + HEAD_R] as Pt];
    const maxY = Math.max(...lows.map((q) => q[1]));
    shift = [60 - j.hip[0], FLOOR_Y - maxY];
  } else {
    const ankle = j.legs[0][2];
    shift = [60 - ankle[0], FLOOR_Y - ankle[1]];
  }
  const mv = (q: Pt): Pt => [q[0] + shift[0], q[1] + shift[1]];
  return {
    head: mv(j.head),
    neck: mv(j.neck),
    hip: mv(j.hip),
    trunk: j.trunk.map((s) => s.map(mv)),
    arms: j.arms.map((s) => s.map(mv)),
    legs: j.legs.map((s) => s.map(mv)),
  };
}

const pathOf = (pts: Pt[]) => pts.map((q, i) => `${i === 0 ? 'M' : 'L'}${r1(q[0])},${r1(q[1])}`).join(' ');

/** Las líneas en un orden fijo (para que la A y la B se puedan animar): lo de atrás primero y más claro. */
function shapeOf(p: PoseSpec): Shape {
  const j = place(p, jointsOf(p));
  const front = p.view === 'front';
  const lines: Line[] = [];
  // De lado, el brazo y la pierna de atrás (índice 1) se dibujan primero y más claros.
  if (!front) {
    if (j.legs[1]) lines.push({ d: pathOf(j.legs[1]), far: true });
    if (j.arms[1]) lines.push({ d: pathOf(j.arms[1]), far: true });
  }
  for (const seg of j.trunk) lines.push({ d: pathOf(seg), far: false });
  j.legs.forEach((leg, i) => {
    if (front || i === 0) lines.push({ d: pathOf(leg), far: false });
  });
  j.arms.forEach((arm, i) => {
    if (front || i === 0) lines.push({ d: pathOf(arm), far: false });
  });
  return { head: [r1(j.head[0]), r1(j.head[1])], lines, hands: j.arms.map((a) => [r1(a[2][0]), r1(a[2][1])] as Pt) };
}

function propPath(p: PropSpec): string {
  switch (p.type) {
    case 'chair':
      return `M${p.x},${FLOOR_Y} L${p.x},62 M${p.x},88 L${p.x + 24},88 L${p.x + 24},${FLOOR_Y}`;
    case 'wall':
      return `M${p.x},10 L${p.x},${FLOOR_Y}`;
    case 'step':
      return `M${p.x},${FLOOR_Y} L${p.x},${FLOOR_Y - p.h} L${p.x + p.w},${FLOOR_Y - p.h} L${p.x + p.w},${FLOOR_Y}`;
    case 'door':
      return `M${p.x},10 L${p.x},${FLOOR_Y} M${p.x + 6},10 L${p.x + 6},${FLOOR_Y}`;
  }
}

function bandPath(shape: Shape, legEnd: Pt | null, band: 'foot' | Pt): string {
  const hand = shape.hands[0];
  const to = band === 'foot' ? (legEnd ?? [60, FLOOR_Y]) : band;
  return `M${hand[0]},${hand[1]} L${r1(to[0])},${r1(to[1])}`;
}

function sameStructure(a: PoseSpec, b: PoseSpec): boolean {
  return (a.view ?? 'side') === (b.view ?? 'side') && a.arms.length === b.arms.length && a.legs.length === b.legs.length;
}

/** La figura lista para dibujar. Si la A y la B no tienen las mismas partes, se queda quieta en la A. */
export function buildFigure(spec: FigureSpec): Figure {
  const a = shapeOf(spec.a);
  const b = spec.b && sameStructure(spec.a, spec.b) ? shapeOf(spec.b) : null;
  const ankleOf = (p: PoseSpec | undefined) => (p ? place(p, jointsOf(p)).legs[0]?.[2] ?? null : null);
  return {
    view: spec.a.view ?? 'side',
    a,
    b,
    props: [`M4,${FLOOR_Y} L116,${FLOOR_Y}`, ...(spec.props ?? []).map(propPath)],
    weights: !!spec.weights,
    band: spec.band
      ? { a: bandPath(a, ankleOf(spec.a), spec.band), b: b ? bandPath(b, ankleOf(spec.b), spec.band) : null }
      : null,
    dur: spec.dur ?? 2.6,
  };
}

/** Todos los puntos de una figura (para revisar que nada se salga del lienzo). */
export function figurePoints(f: Figure): Pt[] {
  const fromPath = (d: string): Pt[] =>
    [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as Pt);
  const shapes = [f.a, ...(f.b ? [f.b] : [])];
  return shapes.flatMap((s) => [s.head, ...s.hands, ...s.lines.flatMap((l) => fromPath(l.d))]);
}

/* ---------- Atajos para escribir poses ---------- */

export const arm = (s: number, e = 0): Arm => ({ s, e });
export const leg = (h: number, k = 0, f?: number): Leg => (f === undefined ? { h, k } : { h, k, f });
export const side = (t: number, arms: Arm[], legs: Leg[], anchor?: Anchor, neck = 0): PoseSpec => ({ view: 'side', t, arms, legs, anchor, neck });
export const front = (arms: Arm[], legs: Leg[], t = 0, anchor?: Anchor): PoseSpec => ({ view: 'front', t, arms, legs, anchor });
export const at = (joint: Anchor['joint'], x: number, y: number, limb = 0): Anchor => ({ joint, limb, at: [x, y] });
