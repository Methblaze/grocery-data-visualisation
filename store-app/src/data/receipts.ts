import csv from "../../../data.csv?raw";

// The data behind the store, from two sources that the 2026 version already uses:
// - the receipt log (data.csv): every line the group typed in from its receipts,
//   which become the products on the shelves;
// - the corrected totals from the group's spreadsheet, as published in
//   Updated2026.html: what each person spent per aisle, at the checkout and in
//   discounts. The signs, the basket and the checkout use these.
// The two do not add up to exactly the same amounts (the log has a few lines the
// spreadsheet left out), so the store says so where they differ.

export type PersonId = "Anna" | "Camille" | "Isabella" | "Jonathan" | "Nikoline";
export type ShopperId = PersonId | "Everyone";

export const PEOPLE: { id: PersonId; colour: string }[] = [
  { id: "Anna", colour: "#2E8B57" },
  { id: "Camille", colour: "#2563C7" },
  { id: "Isabella", colour: "#C2185B" },
  { id: "Jonathan", colour: "#D97706" },
  { id: "Nikoline", colour: "#7C3AED" },
];
export const EVERYONE_COLOUR = "#1C6B4C";
export const colourOf = (s: ShopperId) => PEOPLE.find((p) => p.id === s)?.colour ?? EVERYONE_COLOUR;

export type AisleId = "veg" | "dairy" | "fridge" | "colonial" | "meat" | "bread" | "frozen" | "other" | "soda" | "candy";

/** The ten aisles, named as on the 2026 floor plan, and the receipt category each one holds */
export const AISLES: { id: AisleId; name: string; category: string }[] = [
  { id: "veg", name: "Fruit and vegetables", category: "Frugt/grønt" },
  { id: "dairy", name: "Dairy", category: "Mejeri" },
  { id: "fridge", name: "Refrigerator", category: "Køl" },
  { id: "colonial", name: "Colonial goods", category: "Kolonial" },
  { id: "soda", name: "Alcohol and soda", category: "Alkohol/soda" },
  { id: "candy", name: "Candy and snacks", category: "Snacks/slik" },
  { id: "other", name: "Other", category: "Andet" },
  { id: "frozen", name: "Frozen goods", category: "Frost" },
  { id: "meat", name: "Meat", category: "Kød" },
  { id: "bread", name: "Bread", category: "Brød" },
];
export const aisleName = (id: AisleId) => AISLES.find((a) => a.id === id)!.name;

type Amounts = Record<AisleId, number>;
const row = (veg: number, dairy: number, fridge: number, colonial: number, meat: number, bread: number, frozen: number, other: number, soda: number, candy: number): Amounts => ({
  veg, dairy, fridge, colonial, meat, bread, frozen, other, soda, candy,
});

/** Spent per aisle, in kroner, from Updated2026.html (corrected in 2026 against the spreadsheet) */
export const SPENT: Record<ShopperId, Amounts> = {
  Anna: row(229.55, 438.0, 130.65, 187.35, 399.7, 36.15, 89.85, 69.95, 142.95, 166.75),
  Camille: row(206.75, 191, 108, 194, 110, 0, 121, 48, 119, 117),
  Isabella: row(149.35, 192.8, 30, 151.1, 64, 47.65, 53, 100.95, 64.6, 45.25),
  Jonathan: row(24, 245.9, 74, 125.7, 0, 19, 94, 0, 42.2, 149.35),
  Nikoline: row(34.5, 114.45, 31.5, 97.7, 37.9, 31.45, 148.8, 74.15, 42.25, 31.9),
  Everyone: row(644.15, 1182.15, 374.15, 755.85, 611.6, 134.25, 506.65, 293.05, 411, 510.25),
};

/** What each person paid at the checkout and saved in discounts, from Updated2026.html */
export const CHECKOUT: Record<ShopperId, { paid: number; saved: number }> = {
  Anna: { paid: 1890.9, saved: 186 },
  Camille: { paid: 1214.75, saved: 150 },
  Isabella: { paid: 898.7, saved: 120.9 },
  Jonathan: { paid: 774.15, saved: 198.49 },
  Nikoline: { paid: 644.6, saved: 21.25 },
  Everyone: { paid: 5423.1, saved: 676.64 },
};

/** The largest single-person amount in any aisle, so bars compare across people */
export const MAX_PERSON_AISLE = Math.max(...PEOPLE.flatMap((p) => Object.values(SPENT[p.id])));
export const MAX_AISLE = Math.max(...Object.values(SPENT.Everyone));

const DAYS: Record<string, string> = {
  mandag: "Monday", tirsdag: "Tuesday", onsdag: "Wednesday", torsdag: "Thursday", fredag: "Friday", lørdag: "Saturday", søndag: "Sunday",
};

export interface Receipt {
  /** Line number in data.csv, from 1 */
  line: number;
  day: string;
  item: string;
  aisle: AisleId;
  quantity: number;
  unitPrice: number;
  store: string;
  person: PersonId;
  total: number;
}

/** Splits one CSV line, allowing quoted fields */
function split(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// The log spells one category three ways ("Frugt/grønt", "Frugt/grønt ", "Frugt/ grønt")
const normal = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const byCategory = new Map(AISLES.map((a) => [normal(a.category), a.id]));

export function parseReceipts(text: string): Receipt[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  return lines.slice(1).map((l, i) => {
    const [day, item, category, quantity, unitPrice, store, person, total] = split(l);
    const aisle = byCategory.get(normal(category));
    if (!aisle) throw new Error(`Unknown category "${category}" on line ${i + 2}`);
    return {
      line: i + 1,
      day: DAYS[day.trim().toLowerCase()] ?? day.trim(),
      item: item.trim(),
      aisle,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      store: store.trim(),
      person: person.trim() as PersonId,
      total: Number(total),
    };
  });
}

export const RECEIPTS = parseReceipts(csv);

/** What the receipt lines add up to, per shopper and aisle */
export function receiptSum(shopper: ShopperId, aisle?: AisleId): number {
  return RECEIPTS.filter((r) => (shopper === "Everyone" || r.person === shopper) && (!aisle || r.aisle === aisle)).reduce((s, r) => s + r.total, 0);
}

const fmt = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Danish format, as on the receipts and in the 2026 version: 1.182,15 kr. */
export const kr = (n: number) => `${fmt.format(n)} kr.`;
