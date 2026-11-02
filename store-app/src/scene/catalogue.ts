import {
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { AisleId, Receipt } from "../data/receipts";
import { kr } from "../data/receipts";
import { FONT } from "./canvasTexture";

// What each receipt line looks like on the shelf. The kind is read from the
// item's name and aisle (a carton for milk, a tin for tuna, a bag for crisps),
// so the shop shows the shape of what was bought without inventing brands.
// Packaged kinds carry a printed label with the item's own name and unit price
// from the receipt; produce is either a scanned CC0 model from Poly Haven, where
// one matches the item, or shaped in code.

export interface Kind {
  key: string;
  /** Builds the geometry, resting on y = 0 and facing +z */
  build?: () => BufferGeometry;
  /** A Poly Haven model in public/models, and the size of its longest side in metres */
  model?: { file: string; size: number };
  /** Packaging with a printed label: "box" faces, or "wrap" around a round body */
  label?: "box" | "wrap";
  /** The colour of unlabelled produce, or a tint over a model's own texture */
  colour?: string;
  /** Produce turns a little at random, as if put down by hand */
  loose?: boolean;
}

const sit = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.translate(0, -g.boundingBox!.min.y, 0);
};
const box = (w: number, h: number, d: number, r = 0.008) => () => sit(new RoundedBoxGeometry(w, h, d, 2, r));
const lathe = (profile: [number, number][], segments = 24) => () => sit(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments));

/** A soft bag: a rounded box pinched towards its top and bottom seams */
const bag = (w: number, h: number, d: number) => () => {
  const g = new RoundedBoxGeometry(w, h, d, 3, 0.02);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / (h / 2);
    p.setZ(i, p.getZ(i) * (1 - 0.65 * t * t));
  }
  g.computeVertexNormals();
  return sit(g);
};

/** A lumpy sphere for broccoli and lettuce heads */
const lumpy = (r: number, amount: number, seed: number) => () => {
  const g = new IcosahedronGeometry(r, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 61 + seed) * Math.sin(y * 53 + seed * 2) * Math.sin(z * 47 + seed * 3);
    const s = 1 + amount * n;
    p.setXYZ(i, x * s, y * s * 0.85, z * s);
  }
  g.computeVertexNormals();
  return sit(g);
};

const lying = (g: BufferGeometry) => sit(g.rotateZ(Math.PI / 2));

export const KINDS = {
  carton: { key: "carton", build: box(0.075, 0.2, 0.075, 0.006), label: "box" },
  cheese: { key: "cheese", build: box(0.13, 0.05, 0.09, 0.01), label: "box" },
  butter: { key: "butter", build: box(0.11, 0.045, 0.065, 0.006), label: "box" },
  eggs: { key: "eggs", build: box(0.2, 0.07, 0.1, 0.012), label: "box" },
  tub: { key: "tub", build: lathe([[0, 0], [0.045, 0], [0.055, 0.075], [0.058, 0.08], [0.058, 0.085], [0, 0.085]]), label: "wrap" },
  box: { key: "box", build: box(0.11, 0.17, 0.06), label: "box" },
  bigpack: { key: "bigpack", build: box(0.2, 0.22, 0.14, 0.03), label: "box" },
  can: { key: "can", build: () => sit(new CylinderGeometry(0.034, 0.034, 0.11, 24)), label: "wrap" },
  jar: { key: "jar", build: lathe([[0, 0], [0.034, 0], [0.038, 0.01], [0.038, 0.11], [0.03, 0.125], [0.031, 0.145], [0, 0.145]]), label: "wrap" },
  bottle: {
    key: "bottle",
    build: lathe([[0, 0], [0.034, 0], [0.038, 0.012], [0.038, 0.17], [0.03, 0.205], [0.014, 0.24], [0.014, 0.27], [0, 0.27]], 20),
    label: "wrap",
  },
  wine: {
    key: "wine",
    build: lathe([[0, 0], [0.036, 0], [0.037, 0.2], [0.03, 0.235], [0.013, 0.26], [0.013, 0.31], [0, 0.31]], 20),
    label: "wrap",
  },
  detergent: { key: "detergent", build: lathe([[0, 0], [0.045, 0], [0.048, 0.02], [0.046, 0.19], [0.02, 0.23], [0.016, 0.26], [0, 0.26]], 20), label: "wrap" },
  bag: { key: "bag", build: bag(0.13, 0.19, 0.06), label: "box" },
  bar: { key: "bar", build: box(0.075, 0.15, 0.016, 0.004), label: "box" },
  frozen: { key: "frozen", build: box(0.2, 0.06, 0.14, 0.008), label: "box" },
  pizza: { key: "pizza", build: box(0.24, 0.04, 0.24, 0.006), label: "box" },
  icetub: { key: "icetub", build: lathe([[0, 0], [0.043, 0], [0.05, 0.1], [0.052, 0.105], [0, 0.105]]), label: "wrap" },
  tray: { key: "tray", build: box(0.18, 0.045, 0.13, 0.01), label: "box" },
  loaf: { key: "loaf", build: box(0.22, 0.1, 0.11, 0.025), label: "box" },
  flatbread: { key: "flatbread", build: bag(0.2, 0.03, 0.17), label: "box" },
  punnet: { key: "punnet", build: box(0.14, 0.07, 0.1, 0.01), label: "box" },
  vegbag: { key: "vegbag", build: bag(0.16, 0.2, 0.07), label: "box" },
  ciabatta: { key: "ciabatta", build: () => lying(new CapsuleGeometry(0.045, 0.16, 6, 14).scale(1, 1, 0.8)), colour: "#D4A266", loose: true },
  cucumber: { key: "cucumber", build: () => lying(new CapsuleGeometry(0.022, 0.2, 6, 12)), colour: "#2F6B2C", loose: true },
  tomato: { key: "tomato", build: () => sit(new SphereGeometry(0.036, 18, 12).scale(1, 0.85, 1)), colour: "#D2321F", loose: true },
  pepper: { key: "pepper", build: lumpy(0.045, 0.08, 1), colour: "#C8261A", loose: true },
  broccoli: { key: "broccoli", build: lumpy(0.06, 0.18, 2), colour: "#3E6B2A", loose: true },
  lettuce: { key: "lettuce", build: lumpy(0.07, 0.12, 3), colour: "#7DB04A", loose: true },
  leek: { key: "leek", build: () => lying(new CylinderGeometry(0.02, 0.022, 0.32, 14)), colour: "#B9D38C", loose: true },
  cabbage: { key: "cabbage", build: lathe([[0, 0], [0.04, 0.01], [0.06, 0.06], [0.055, 0.12], [0.03, 0.17], [0, 0.19]], 16), colour: "#A9CB7A", loose: true },
  bananas: { key: "bananas", model: { file: "bananas.glb", size: 0.22 }, loose: true },
  ginger: { key: "ginger", model: { file: "food_ginger_01.glb", size: 0.11 }, loose: true },
  lime: { key: "lime", model: { file: "food_lime_01.glb", size: 0.065 }, loose: true },
  avocado: { key: "avocado", model: { file: "food_avocado_01.glb", size: 0.11 }, loose: true },
  kiwi: { key: "kiwi", model: { file: "food_kiwi_01.glb", size: 0.075 }, loose: true },
  pear: { key: "pear", model: { file: "food_pears_asian_01.glb", size: 0.1 }, loose: true },
  onion: { key: "onion", model: { file: "yellow_onion.glb", size: 0.085 }, loose: true },
  redonion: { key: "redonion", model: { file: "yellow_onion.glb", size: 0.085 }, colour: "#B4566E", loose: true },
  potato: { key: "potato", model: { file: "sweet_potato.glb", size: 0.1 }, colour: "#F1DDB2", loose: true },
  orange: { key: "orange", model: { file: "lemon.glb", size: 0.085 }, colour: "#FF9A3D", loose: true },
  croissant: { key: "croissant", model: { file: "croissant.glb", size: 0.15 }, loose: true },
} satisfies Record<string, Kind>;

const has = (name: string, ...words: string[]) => words.some((w) => name.includes(w));

/** The kind of package or produce a receipt line becomes */
export function kindOf(r: Receipt): Kind {
  const n = r.item.toLowerCase();
  switch (r.aisle) {
    case "veg":
      if (has(n, "banan")) return KINDS.bananas;
      if (has(n, "ingefær")) return KINDS.ginger;
      if (has(n, "lime")) return KINDS.lime;
      if (has(n, "avocado")) return KINDS.avocado;
      if (has(n, "kiwi")) return KINDS.kiwi;
      if (has(n, "pære")) return KINDS.pear;
      if (has(n, "rødløg")) return KINDS.redonion;
      if (has(n, "purløg", "salat", "spinat", "karse", "dild", "kålblanding")) return has(n, "hjertesalat") ? KINDS.lettuce : KINDS.vegbag;
      if (has(n, "løg")) return KINDS.onion;
      if (has(n, "kartof")) return KINDS.potato;
      if (has(n, "appelsin")) return KINDS.orange;
      if (has(n, "agurk")) return KINDS.cucumber;
      if (has(n, "cherry", "tapas", "champignon", "svampe", "dadler", "hindbær")) return KINDS.punnet;
      if (has(n, "tomat")) return KINDS.tomato;
      if (has(n, "peber")) return KINDS.pepper;
      if (has(n, "broccoli")) return KINDS.broccoli;
      if (has(n, "porre")) return KINDS.leek;
      if (has(n, "kål")) return KINDS.cabbage;
      if (has(n, "guler")) return KINDS.vegbag;
      return KINDS.punnet;
    case "bread":
      if (has(n, "crodot", "croissant")) return KINDS.croissant;
      if (has(n, "ciabatta")) return KINDS.ciabatta;
      if (has(n, "pita", "flad")) return KINDS.flatbread;
      return KINDS.loaf;
    case "dairy":
      if (has(n, "smør", "kærgården")) return KINDS.butter;
      if (has(n, "ost", "cheddar", "gouda", "mozzarella", "mozarella", "halloumi", "feta", "parmesan", "brie", "salame")) return KINDS.cheese;
      if (has(n, "æg")) return KINDS.eggs;
      if (has(n, "creme fraiche", "skyr", "yoghurt", "hytteost", "smøreost")) return KINDS.tub;
      return KINDS.carton;
    case "fridge":
      if (has(n, "juice", "smoothie", "mælk")) return KINDS.carton;
      if (has(n, "pølse", "bacon", "skinke", "salami", "kylling", "pålæg")) return KINDS.tray;
      if (has(n, "ost")) return KINDS.cheese;
      return KINDS.tub;
    case "colonial":
      if (has(n, "tun", "majs", "bønner", "kikært", "hakkede", "flåede", "kokosmælk", "dåse", "linser")) return KINDS.can;
      if (has(n, "olie", "eddike", "soya", "sauce", "ketchup", "sennep", "honning", "syltetøj", "pesto", "passata")) return KINDS.jar;
      if (has(n, "smør")) return KINDS.butter;
      return KINDS.box;
    case "soda":
      if (has(n, "vin")) return KINDS.wine;
      return KINDS.bottle;
    case "candy":
      if (has(n, "chokolade", "lindt", "marabou", "toms", "bar")) return KINDS.bar;
      if (has(n, "oreo", "kiks", "småkage", "eggs")) return KINDS.box;
      return KINDS.bag;
    case "frozen":
      if (has(n, "ben & jerry", "ben&jerry", "is ", "isvaffel", "magnum", "karamel")) return KINDS.icetub;
      if (has(n, "pizza")) return KINDS.pizza;
      return KINDS.frozen;
    case "meat":
      return KINDS.tray;
    case "other":
      if (has(n, "opvask", "sæbe", "shampoo", "vaske", "rengøring", "skyl")) return KINDS.detergent;
      if (has(n, "toiletpapir", "køkkenrulle", "bleer")) return KINDS.bigpack;
      return KINDS.box;
  }
}

/** Printing colours per aisle; each item picks one by its name, so the same item always looks the same */
const PRINT: Record<AisleId, string[]> = {
  veg: ["#5E8C31", "#8DB255", "#C8E0A8", "#E07B2E"],
  dairy: ["#F4F6F8", "#D7E6F4", "#2E6DB4", "#F2D16B", "#9CC3E6", "#1F4E8C"],
  fridge: ["#F2D6A0", "#C9463D", "#CFE3C9", "#F5F0E1", "#6B8E4E"],
  colonial: ["#C0392B", "#E9C46A", "#2A9D8F", "#3B5568", "#F4A261", "#8D6E63"],
  soda: ["#B71C1C", "#2E7D32", "#1565C0", "#F9A825", "#212121"],
  candy: ["#E91E63", "#FFC107", "#6A1B9A", "#FF5722", "#03A9F4", "#4E342E"],
  other: ["#90A4AE", "#26A69A", "#5C6BC0", "#BCAAA4"],
  frozen: ["#B3E5FC", "#1E88E5", "#E1F5FE", "#0D47A1"],
  meat: ["#C62828", "#F2B8A2", "#8E2420", "#E57373"],
  bread: ["#C68B59", "#E8D3B0", "#8B5A2B", "#F3E6CF"],
};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const printColour = (r: Receipt) => {
  const list = PRINT[r.aisle];
  return list[hash(r.item) % list.length];
};
/** The colour a unit flies into the basket in */
export const unitColour = (r: Receipt) => kindOf(r).colour ?? printColour(r);
export const unitTurn = (r: Receipt, n: number) => ((hash(r.item + n) % 628) / 100) - 3.14;

// One label sheet for every packaged item in the shop: a grid of cells, each
// printed with the item's name and unit price. Instances pick their cell, so
// every package in a kind shares one geometry, one material and one texture.

const CELL = 128;
let sheet: { texture: CanvasTexture; cells: number; index: Map<string, number>; material: MeshStandardMaterial } | null = null;
const cellKey = (r: Receipt) => `${r.aisle}|${r.item.toLowerCase()}`;

function readable(bg: string) {
  const c = new Color(bg);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45 ? "#15181B" : "#FFFFFF";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function printLabel(ctx: CanvasRenderingContext2D, x: number, y: number, r: Receipt, style: "box" | "wrap") {
  const bg = printColour(r);
  const ink = readable(bg);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, CELL, CELL);
  // A paler panel carries the name, as on most packaging
  ctx.fillStyle = ink === "#FFFFFF" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)";
  const panelY = y + CELL * 0.26;
  const panelH = CELL * 0.48;
  ctx.fillRect(x + 6, panelY, CELL - 12, panelH);
  ctx.fillStyle = "#15181B";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const halves = style === "wrap" ? 2 : 1;
  const w = CELL / halves;
  for (let h = 0; h < halves; h++) {
    let size = style === "wrap" ? 15 : 21;
    ctx.font = `700 ${size}px ${FONT}`;
    let lines = wrapText(ctx, r.item, w - 14);
    while (lines.some((l) => ctx.measureText(l).width > w - 12) && size > 10) {
      size -= 1;
      ctx.font = `700 ${size}px ${FONT}`;
      lines = wrapText(ctx, r.item, w - 14);
    }
    const cx = x + w * h + w / 2;
    const lh = size * 1.1;
    lines.forEach((l, i) => ctx.fillText(l, cx, panelY + panelH / 2 + (i - (lines.length - 1) / 2) * lh));
  }
  ctx.fillStyle = ink;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(kr(r.unitPrice).replace(/\s/g, " "), x + CELL / 2, y + CELL * 0.87);
}

/** The shared label sheet and its material; built on first use, from the receipts given */
export function labelSheet(receipts: Receipt[]) {
  if (sheet) return sheet;
  const index = new Map<string, number>();
  const firsts: Receipt[] = [];
  for (const r of receipts) {
    const k = kindOf(r);
    if (!k.label || index.has(cellKey(r))) continue;
    index.set(cellKey(r), firsts.length);
    firsts.push(r);
  }
  const cells = Math.ceil(Math.sqrt(firsts.length));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = cells * CELL;
  const ctx = canvas.getContext("2d")!;
  firsts.forEach((r, i) => printLabel(ctx, (i % cells) * CELL, Math.floor(i / cells) * CELL, r, kindOf(r).label!));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0 });
  // Each instance reads its own cell of the sheet
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCells = { value: cells };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 labelCell;\nuniform float uCells;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (clamp(vMapUv, 0.03, 0.97) + labelCell) / uCells;");
  };
  material.customProgramCacheKey = () => "label-sheet";
  sheet = { texture, cells, index, material };
  return sheet;
}

/** Which cell of the label sheet a receipt line uses, as (column, row from the bottom) */
export function labelCellOf(r: Receipt): [number, number] {
  const s = sheet!;
  const i = s.index.get(cellKey(r)) ?? 0;
  return [i % s.cells, s.cells - 1 - Math.floor(i / s.cells)];
}
