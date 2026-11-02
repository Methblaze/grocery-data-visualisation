import { CatmullRomCurve3, Vector3 } from "three";
import { AISLES, PEOPLE, RECEIPTS, type AisleId, type Receipt } from "./receipts";

// The shop floor, in metres: x to the right, z towards the entrance, y up. The
// plan follows the 2026 floor plan (Updated2026.html): coolers and shelves along
// the back wall, four islands in the middle, drinks and sweets on the right wall,
// the checkout at the front.

export const ROOM = { minX: -13, maxX: 13, minZ: -9, maxZ: 9, height: 3.4 };
export const EYE = 1.6;

export type FixtureKind = "crates" | "cooler" | "shelf" | "freezer" | "counter";

export interface Fixture {
  aisle: AisleId;
  kind: FixtureKind;
  x: number;
  z: number;
  /** Along the shelf */
  length: number;
  /** Front to back */
  depth: number;
  height: number;
  /** Rotation about y: 0 faces +z (towards the entrance), PI/2 faces +x */
  rot: number;
}

const FACE_Z = 0;
const FACE_X = Math.PI / 2;
const FACE_NEG_X = -Math.PI / 2;

export const FIXTURES: Fixture[] = [
  { aisle: "veg", kind: "crates", x: -11.6, z: -0.5, length: 7, depth: 1.4, height: 0.95, rot: FACE_X },
  { aisle: "dairy", kind: "cooler", x: -4.2, z: -7.6, length: 4.5, depth: 0.9, height: 2.1, rot: FACE_Z },
  { aisle: "fridge", kind: "cooler", x: 1.2, z: -7.6, length: 4.5, depth: 0.9, height: 2.1, rot: FACE_Z },
  { aisle: "colonial", kind: "shelf", x: 7.8, z: -7.7, length: 6.6, depth: 0.7, height: 2.0, rot: FACE_Z },
  { aisle: "soda", kind: "cooler", x: 11.65, z: -0.6, length: 3.4, depth: 0.9, height: 2.1, rot: FACE_NEG_X },
  { aisle: "candy", kind: "shelf", x: 11.8, z: 2.9, length: 3.4, depth: 0.7, height: 1.6, rot: FACE_NEG_X },
  { aisle: "other", kind: "shelf", x: 4.9, z: 0.4, length: 5.4, depth: 0.8, height: 1.8, rot: FACE_NEG_X },
  { aisle: "frozen", kind: "freezer", x: 1.3, z: 0.4, length: 5.4, depth: 1.1, height: 0.84, rot: FACE_X },
  { aisle: "meat", kind: "counter", x: -5.9, z: 0.4, length: 5.4, depth: 1.2, height: 1.2, rot: FACE_X },
  { aisle: "bread", kind: "shelf", x: -2.3, z: 0.4, length: 5.4, depth: 0.8, height: 1.8, rot: FACE_NEG_X },
];
export const fixtureOf = (aisle: AisleId) => FIXTURES.find((f) => f.aisle === aisle)!;

/** Local fixture coordinates to the shop floor */
export function toWorld(f: Fixture, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return [f.x + lx * c + lz * s, ly, f.z - lx * s + lz * c];
}
/** The way the fixture's front faces, on the floor */
export const facing = (f: Fixture): [number, number] => [Math.sin(f.rot), Math.cos(f.rot)];

/** The two checkout counters, and the screen above them on the front wall */
export const CHECKOUTS = [
  { x: -4, z: 6.7, length: 2.6, depth: 0.9 },
  { x: 3.2, z: 6.7, length: 2.6, depth: 0.9 },
];
export const CHECKOUT_SCREEN = { x: -3.1, y: 2.35, z: 8.92 };
/** The card terminal on its stand, at the customer's end of the first counter */
export const TERMINAL = { x: -3.7, y: 0.84, z: 5.5 };
export const ENTRANCE = { minX: -12, maxX: -8 };

// The guided walk: a path through every aisle, with a stop in front of each one
export type StopId = AisleId | "entrance" | "checkout";
export interface Stop {
  id: StopId;
  x: number;
  z: number;
  look: [number, number, number];
}

const stop = (id: StopId, x: number, z: number, look: [number, number, number]): Stop => ({ id, x, z, look });
const corner = (x: number, z: number) => ({ x, z });

const ROUTE: (Stop | { x: number; z: number })[] = [
  stop("entrance", -10, 7.6, [-8.8, 1.4, 0]),
  corner(-8.8, 4.2),
  stop("veg", -8.8, 1.4, [-11.6, 0.85, -1.4]),
  corner(-8.8, -4.6),
  stop("dairy", -4.2, -4.6, [-4.2, 1.1, -7.6]),
  stop("fridge", 1.2, -4.6, [1.2, 1.1, -7.6]),
  stop("colonial", 7.8, -4.6, [7.8, 1.1, -7.7]),
  corner(8.4, -3.4),
  stop("soda", 8.4, -0.6, [11.65, 1.1, -0.6]),
  stop("candy", 8.4, 2.9, [11.8, 0.9, 2.9]),
  corner(8.4, 4.6),
  corner(3.1, 4.6),
  stop("other", 2.45, 2.4, [4.9, 1.0, 0]),
  stop("frozen", 3.3, 0.6, [1.3, 0.5, -1.6]),
  corner(3.1, -4.3),
  corner(-4.1, -4.3),
  stop("meat", -3.4, -1.6, [-5.9, 0.75, 0.6]),
  stop("bread", -4.75, 0.9, [-2.3, 1.0, 1.3]),
  corner(-4.1, 4.4),
  corner(-3.0, 4.5),
  // At the counter, facing the card terminal
  stop("checkout", -3.1, 5.0, [-3.7, 1.12, 5.55]),
];

export const STOPS: Stop[] = ROUTE.filter((p): p is Stop => "id" in p);
export const PATH = new CatmullRomCurve3(
  ROUTE.map((p) => new Vector3(p.x, EYE, p.z)),
  false,
  "centripetal",
);
export const PATH_LENGTH = PATH.getLength();

/** Where along the path (0 to 1, by distance) each stop sits */
export const STOP_U: number[] = (() => {
  const samples = 4000;
  const pts = Array.from({ length: samples + 1 }, (_, i) => PATH.getPointAt(i / samples));
  return STOPS.map((s) => {
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i / samples;
      }
    });
    return best;
  });
})();

// Products: every unit on every receipt line gets a slot on its aisle's fixture.
// Each shopper's units sit together, filled column by column, so one person's
// share of an aisle reads as a band along the shelf.

export interface Unit {
  receipt: Receipt;
  /** Index within its aisle's instanced mesh */
  index: number;
  position: [number, number, number];
}

export interface SlotPlan {
  /** Heights of the rows, or of the shelves */
  ys: number[];
  /** How far forward each row sits, from the fixture's centre line */
  zs: number[];
  step: number;
  margin: number;
}

/** The produce crates (Poly Haven's Plastic Crate 02, at its real size) and the two stepped rows they stand in */
export const CRATE = { width: 0.505, depth: 0.405, height: 0.254, pitch: 0.52 };
/** back: how far behind the stand's front edge each row's back wall is */
export const CRATE_ROWS = [
  { bottom: 0.56, back: 0.44 },
  { bottom: 0.74, back: 0.88 },
];

export function slotPlan(f: Fixture): SlotPlan {
  const front = f.depth / 2;
  switch (f.kind) {
    case "shelf": {
      const ys = [0.28, 0.7, 1.12, 1.54].filter((y) => y < f.height - 0.2);
      return { ys, zs: ys.map(() => front - 0.16), step: 0.17, margin: 0.18 };
    }
    case "cooler":
      return { ys: [0.42, 0.86, 1.3, 1.74], zs: [0.05, 0.05, 0.05, 0.05].map((d) => front - 0.3 + d), step: 0.16, margin: 0.2 };
    case "crates":
      // Two stepped rows of crates (CRATE_ROWS), two rows of produce in each, near the rim
      return {
        ys: CRATE_ROWS.flatMap((r) => [r.bottom + CRATE.height - 0.05, r.bottom + CRATE.height - 0.05]),
        zs: CRATE_ROWS.flatMap((r) => [front - r.back + CRATE.depth - 0.12, front - r.back + 0.13]),
        step: 0.13,
        margin: 0.2,
      };
    case "freezer":
      return { ys: [0.74, 0.74, 0.74], zs: [front - 0.25, 0, -front + 0.25], step: 0.24, margin: 0.25 };
    case "counter":
      return { ys: [0.82, 0.9, 0.98], zs: [front - 0.3, front - 0.6, front - 0.9], step: 0.22, margin: 0.25 };
  }
}

const personOrder = new Map(PEOPLE.map((p, i) => [p.id, i]));

export const UNITS: Record<AisleId, Unit[]> = Object.fromEntries(
  AISLES.map((a) => {
    const f = fixtureOf(a.id);
    const p = slotPlan(f);
    const receipts = RECEIPTS.filter((r) => r.aisle === a.id).sort(
      (x, y) => personOrder.get(x.person)! - personOrder.get(y.person)! || x.line - y.line,
    );
    const expanded = receipts.flatMap((r) => Array.from({ length: Math.min(r.quantity, 4) }, () => r));
    // Use as few rows as the items need, the ones nearest eye height (or the front) first,
    // and centre the block on the fixture, so a small aisle reads as little bought, not as missing stock
    const usable = f.length - 2 * p.margin;
    const perRow = Math.floor(usable / p.step) + 1;
    const preferred = p.ys
      .map((_, i) => i)
      .sort((a, b) => (f.kind === "shelf" || f.kind === "cooler" ? Math.abs(p.ys[a] - 1.1) - Math.abs(p.ys[b] - 1.1) : a - b));
    const rows = preferred.slice(0, Math.min(p.ys.length, Math.ceil(expanded.length / perRow))).sort((a, b) => p.ys[b] - p.ys[a]);
    const columns = Math.ceil(expanded.length / rows.length);
    const step = Math.min(p.step, usable / Math.max(1, columns - 1));
    const start = -((columns - 1) * step) / 2;
    const units = expanded.map((receipt, i) => {
      const col = Math.floor(i / rows.length);
      const row = rows[i % rows.length];
      return { receipt, index: i, position: toWorld(f, start + col * step, p.ys[row], p.zs[row]) };
    });
    return [a.id, units];
  }),
) as Record<AisleId, Unit[]>;

/** Boxes that free walking cannot pass through, with room for the visitor's body */
export const OBSTACLES: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [
  ...FIXTURES.map((f) => {
    const along = Math.abs(Math.sin(f.rot)) > 0.5;
    const hx = (along ? f.depth : f.length) / 2;
    const hz = (along ? f.length : f.depth) / 2;
    return { minX: f.x - hx, maxX: f.x + hx, minZ: f.z - hz, maxZ: f.z + hz };
  }),
  ...CHECKOUTS.map((c) => ({ minX: c.x - c.depth / 2, maxX: c.x + c.depth / 2, minZ: c.z - c.length / 2, maxZ: c.z + c.length / 2 })),
];
