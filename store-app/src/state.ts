import { create } from "zustand";
import type { AisleId, ShopperId } from "./data/receipts";
import { STOPS, type StopId } from "./data/layout";

export type Mode = "guided" | "free";

export interface Launch {
  aisle: AisleId;
  nonce: number;
}

interface State {
  shopper: ShopperId;
  mode: Mode;
  /** The stop the guided walk is heading for */
  stop: number;
  /** Where the visitor is standing now, if in front of an aisle, the entrance or the checkout */
  here: StopId | null;
  /** Aisles whose items are already in the basket on this trip */
  visited: AisleId[];
  /** Items to fly into the basket, newest last */
  launches: Launch[];
  hover: { aisle: AisleId; index: number; x: number; y: number } | null;
  reducedMotion: boolean;
  setShopper: (s: ShopperId) => void;
  setMode: (m: Mode) => void;
  goTo: (stop: number) => void;
  step: (by: number) => void;
  arrive: (here: StopId | null) => void;
  emptyBasket: () => void;
  setHover: (h: State["hover"]) => void;
}

let nonce = 0;

export const useStore = create<State>((set, get) => ({
  shopper: "Everyone",
  mode: "guided",
  stop: 0,
  here: "entrance",
  visited: [],
  launches: [],
  hover: null,
  reducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  // A new shopper starts a new trip: the basket empties, and the aisle you are in fills it again
  setShopper: (shopper) => {
    set({ shopper, visited: [], launches: [] });
    const here = get().here;
    if (here && here !== "entrance" && here !== "checkout") get().arrive(here);
  },
  setMode: (mode) => set({ mode }),
  goTo: (stop) => set({ stop: Math.max(0, Math.min(STOPS.length - 1, stop)) }),
  step: (by) => get().goTo(get().stop + by),
  arrive: (here) => {
    const { visited } = get();
    if (here === "entrance") {
      set({ here, visited: [], launches: [] });
      return;
    }
    if (here && here !== "checkout" && !visited.includes(here)) {
      set({ here, visited: [...visited, here], launches: [...get().launches.slice(-9), { aisle: here, nonce: ++nonce }] });
      return;
    }
    set({ here });
  },
  emptyBasket: () => set({ visited: [], launches: [] }),
  setHover: (hover) => set({ hover }),
}));

/** The on-screen pad for free walking on touch screens: -1 to 1 per axis, read every frame by the camera rig */
export const pad = { forward: 0, turn: 0 };
