import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AISLES, CHECKOUT, PEOPLE, RECEIPTS, SPENT, kr, receiptSum } from "./receipts";

const page = readFileSync(new URL("../../../Updated2026.html", import.meta.url), "utf8");
const cents = (n: number) => Math.round(n * 100);

// "1.182,15 DKK" or "30 DKK" from a tooltip in Updated2026.html
function amountIn(text: string): number {
  const m = text.match(/([0-9][0-9.]*(?:,[0-9]+)?)\s*DKK/)!;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}
// The tooltips of one person's array (var Anna= [ ... ];) by category
function tooltips(name: string): Record<string, number> {
  const start = page.indexOf(name === "Everyone" ? "var allCategoriesData = [" : `var ${name}= [`);
  const body = page.slice(start, page.indexOf("];", start));
  const out: Record<string, number> = {};
  for (const m of body.matchAll(/category: "([^"]+)"[^\n]*tooltipText:\s*"([^"]+)"/g)) out[m[1]] = amountIn(m[2]);
  return out;
}
const CATEGORY: Record<string, string> = {
  veg: "Vegetables", dairy: "Dairy", fridge: "Refrigerator", colonial: "Colonial Goods", meat: "Meat", bread: "Bread",
  frozen: "Frozen Goods", other: "Other", soda: "Soda", candy: "Candy",
};

describe("the corrected totals", () => {
  for (const name of ["Everyone", ...PEOPLE.map((p) => p.id)] as const) {
    it(`match Updated2026.html for ${name}`, () => {
      const t = tooltips(name);
      for (const a of AISLES) expect(SPENT[name][a.id], `${name} ${a.id}`).toBe(t[CATEGORY[a.id]]);
      expect(CHECKOUT[name].paid).toBe(t.Checkout1);
      expect(CHECKOUT[name].saved).toBe(t.Checkout2);
    });
  }

  it("add up: each person's aisles to their checkout, and the five people to everyone", () => {
    for (const p of PEOPLE) {
      const sum = AISLES.reduce((s, a) => s + cents(SPENT[p.id][a.id]), 0);
      expect(sum, p.id).toBe(cents(CHECKOUT[p.id].paid));
    }
    for (const a of AISLES) expect(PEOPLE.reduce((s, p) => s + cents(SPENT[p.id][a.id]), 0), a.id).toBe(cents(SPENT.Everyone[a.id]));
    expect(PEOPLE.reduce((s, p) => s + cents(CHECKOUT[p.id].paid), 0)).toBe(cents(CHECKOUT.Everyone.paid));
    expect(PEOPLE.reduce((s, p) => s + cents(CHECKOUT[p.id].saved), 0)).toBe(cents(CHECKOUT.Everyone.saved));
  });
});

describe("the receipt log", () => {
  it("has all 287 lines, each in one of the ten aisles", () => {
    expect(RECEIPTS).toHaveLength(287);
    expect(new Set(RECEIPTS.map((r) => r.aisle)).size).toBe(10);
  });

  it("reads Danish letters and quantities", () => {
    expect(RECEIPTS.some((r) => r.item.includes("ø"))).toBe(true);
    expect(RECEIPTS.every((r) => r.quantity >= 1 && Number.isFinite(r.total))).toBe(true);
    expect(cents(receiptSum("Everyone"))).toBe(553755);
  });

  it("formats kroner the Danish way", () => {
    expect(kr(1182.15).replace(/\s/g, " ")).toBe("1.182,15 kr.");
  });
});
