import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { AISLES, CHECKOUT, PEOPLE, RECEIPTS, SPENT, aisleName, colourOf, kr, receiptSum, type AisleId, type ShopperId } from "./data/receipts";
import { STOPS, UNITS, type StopId } from "./data/layout";
import { pad, useStore } from "./state";

const Scene = lazy(() => import("./scene/Scene"));

const hasWebGL = () => {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};
const isAisle = (s: StopId | null): s is AisleId => s != null && s !== "entrance" && s !== "checkout";
const stopName = (s: StopId) => (s === "entrance" ? "Entrance" : s === "checkout" ? "Checkout" : aisleName(s));

export default function App() {
  const [webgl] = useState(hasWebGL);
  const stop = useStore((s) => s.stop);

  // Without 3D, stepping through the stops still shows each aisle's numbers
  useEffect(() => {
    if (!webgl) useStore.getState().arrive(STOPS[stop].id);
  }, [webgl, stop]);

  return (
    <div className="app">
      <div className="stage" aria-hidden="true">
        {webgl ? (
          <Suspense fallback={<p className="loading">Opening the shop</p>}>
            <Scene />
          </Suspense>
        ) : (
          <p className="loading">
            This browser cannot show the 3D store, so here are the numbers on their own. The <a href="../Updated2026.html">2026 floor plan</a> shows the same data as a map.
          </p>
        )}
      </div>
      <Header />
      {/* One column on the right, so the details always start below the shopper buttons, however many rows they wrap to */}
      <div className="side">
        <Shoppers />
        <Details />
      </div>
      <Walk />
      <BasketTotal />
      <Tooltip />
      <Announcer />
    </div>
  );
}

function Header() {
  return (
    <header className="card header">
      <h1>The grocery store</h1>
      <p>Three weeks of receipts from five shoppers, 20 March to 10 April 2024.</p>
      <p className="links">
        <a href="../Updated2026.html">2026 floor plan</a>
        <a href="../Final.html">2024 original</a>
      </p>
    </header>
  );
}

function Shoppers() {
  const shopper = useStore((s) => s.shopper);
  const setShopper = useStore((s) => s.setShopper);
  const all: ShopperId[] = ["Everyone", ...PEOPLE.map((p) => p.id)];
  return (
    <div className="card shoppers" role="group" aria-label="Shopper">
      {all.map((s) => (
        <button key={s} type="button" aria-pressed={shopper === s} onClick={() => setShopper(s)} style={{ "--who": colourOf(s) } as React.CSSProperties}>
          <span className="swatch" aria-hidden="true" />
          {s}
        </button>
      ))}
    </div>
  );
}

/** What you are standing in front of, for the shopper you picked */
function Details() {
  const here = useStore((s) => s.here);
  const shopper = useStore((s) => s.shopper);
  const last = useRef<StopId>("entrance");
  if (here) last.current = here;
  const at = last.current;
  // On a phone the details start folded to one line, so the store stays in view
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  const summary =
    at === "entrance" ? "Pick a shopper, then start the walk" : at === "checkout" ? `${kr(CHECKOUT[shopper].paid)} paid` : `${kr(SPENT[shopper][at])} spent here`;

  return (
    <section className={`card details${open ? "" : " closed"}`} aria-labelledby="details-title">
      <div className="details-head">
        <div>
          <h2 id="details-title">{stopName(at)}</h2>
          {!open && <p className="muted summary">{summary}</p>}
        </div>
        <button type="button" className="ghost toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Details"}
        </button>
      </div>
      {open && (at === "entrance" ? <Welcome /> : at === "checkout" ? <Checkout shopper={shopper} /> : <AisleDetails aisle={at} shopper={shopper} />)}
    </section>
  );
}

function Welcome() {
  return (
    <div className="body">
      <p>Five people typed in every grocery receipt for three weeks. Pick a shopper, then walk the aisles.</p>
      <p>Their products light up on the shelves, the bar above each aisle fills as far as they spent there, and their items land in your basket.</p>
      <p className="muted">Start the walk below, or use the arrow keys. Drag to look around, or switch to free walk.</p>
    </div>
  );
}

function AisleDetails({ aisle, shopper }: { aisle: AisleId; shopper: ShopperId }) {
  const spent = SPENT[shopper][aisle];
  if (shopper === "Everyone") {
    const max = Math.max(...PEOPLE.map((p) => SPENT[p.id][aisle]), 1);
    return (
      <div className="body">
        <p className="amount">{kr(spent)}</p>
        <p className="muted">
          spent here by all five, over {UNITS[aisle].length} items on {RECEIPTS.filter((r) => r.aisle === aisle).length} receipt lines
        </p>
        <ul className="split">
          {PEOPLE.map((p) => (
            <li key={p.id}>
              <span>{p.id}</span>
              <span className="track">
                <span style={{ width: `${(SPENT[p.id][aisle] / max) * 100}%`, background: p.colour }} />
              </span>
              <span className="num">{kr(SPENT[p.id][aisle])}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const lines = RECEIPTS.filter((r) => r.aisle === aisle && r.person === shopper);
  const sum = receiptSum(shopper, aisle);
  return (
    <div className="body">
      <p className="amount" style={{ color: colourOf(shopper) }}>
        {kr(spent)}
      </p>
      <p className="muted">spent here by {shopper}</p>
      {lines.length === 0 ? (
        <p>No receipt lines from {shopper} in this aisle.</p>
      ) : (
        <ul className="lines">
          {lines.map((r) => (
            <li key={r.line}>
              <span className="item">
                {r.item}
                {r.quantity > 1 ? ` ×${r.quantity}` : ""}
              </span>
              <span className="muted">
                {r.day}, {r.store}
              </span>
              <span className="num">{kr(r.total)}</span>
            </li>
          ))}
        </ul>
      )}
      {Math.abs(sum - spent) > 0.5 && (
        <p className="note">
          These receipt lines add up to {kr(sum)}; the corrected total from the group’s spreadsheet is {kr(spent)}.
        </p>
      )}
    </div>
  );
}

function Checkout({ shopper }: { shopper: ShopperId }) {
  const { paid, saved } = CHECKOUT[shopper];
  const sum = receiptSum(shopper);
  const who = shopper === "Everyone" ? "All five" : shopper;
  return (
    <div className="body">
      <p className="amount" style={{ color: colourOf(shopper) }}>
        {kr(paid)}
      </p>
      <p className="muted">
        {who} paid over three weeks, and saved {kr(saved)} in discounts
      </p>
      {Math.abs(sum - paid) > 0.5 && (
        <p className="note">
          The receipt lines add up to {kr(sum)}, {kr(Math.abs(sum - paid))} {sum > paid ? "more" : "less"} than the corrected total. The 2026 audit could not
          reconcile the difference, so the store shows both.
        </p>
      )}
    </div>
  );
}

function Walk() {
  const stop = useStore((s) => s.stop);
  const mode = useStore((s) => s.mode);
  const { step, goTo, setMode } = useStore.getState();
  return (
    <nav className="card walk" aria-label="Walk through the store">
      <div className="modes" role="group" aria-label="How you move">
        <button type="button" aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>
          Guided
        </button>
        <button type="button" aria-pressed={mode === "free"} onClick={() => setMode("free")}>
          Free walk
        </button>
      </div>
      {mode === "guided" ? (
        <div className="steps">
          <button type="button" onClick={() => step(-1)} disabled={stop === 0}>
            Previous
          </button>
          <label className="sr-only" htmlFor="stop">
            Go to
          </label>
          <select id="stop" value={stop} onChange={(e) => goTo(Number(e.target.value))}>
            {STOPS.map((s, i) => (
              <option key={s.id} value={i}>
                {stopName(s.id)}, {i + 1} of {STOPS.length}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={() => step(1)} disabled={stop === STOPS.length - 1}>
            {stop === 0 ? "Start the walk" : "Next aisle"}
          </button>
        </div>
      ) : (
        <FreePad />
      )}
    </nav>
  );
}

/** Hold-to-move buttons for free walking without a keyboard */
function FreePad() {
  const hold = (key: "forward" | "turn", value: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pad[key] = value;
    },
    onPointerUp: () => (pad[key] = 0),
    onPointerCancel: () => (pad[key] = 0),
    onLostPointerCapture: () => (pad[key] = 0),
  });
  return (
    <div className="pad">
      <p className="muted hint">WASD or the arrow keys to walk, drag to look.</p>
      <div className="pad-buttons" aria-hidden="true">
        <button type="button" tabIndex={-1} {...hold("turn", -1)}>
          Turn left
        </button>
        <button type="button" tabIndex={-1} {...hold("forward", 1)}>
          Forward
        </button>
        <button type="button" tabIndex={-1} {...hold("forward", -1)}>
          Back
        </button>
        <button type="button" tabIndex={-1} {...hold("turn", 1)}>
          Turn right
        </button>
      </div>
    </div>
  );
}

function BasketTotal() {
  const shopper = useStore((s) => s.shopper);
  const visited = useStore((s) => s.visited);
  const reduced = useStore((s) => s.reducedMotion);
  const empty = useStore((s) => s.emptyBasket);
  const total = useMemo(() => visited.reduce((s, a) => s + SPENT[shopper][a], 0), [visited, shopper]);
  const { value } = useSpring({ value: total, immediate: reduced, delay: reduced ? 0 : 500, config: { tension: 120, friction: 26 } });
  return (
    <div className="card basket" aria-live="off">
      <p className="muted">In the basket, {visited.length} of {AISLES.length} aisles</p>
      <animated.p className="amount">{value.to((v) => kr(v))}</animated.p>
      {visited.length > 0 && (
        <button type="button" className="ghost" onClick={empty}>
          Empty it
        </button>
      )}
    </div>
  );
}

function Tooltip() {
  const hover = useStore((s) => s.hover);
  if (!hover) return null;
  const u = UNITS[hover.aisle][hover.index];
  if (!u) return null;
  const r = u.receipt;
  return (
    <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14, borderColor: colourOf(r.person) }} role="tooltip">
      <strong>
        {r.item}
        {r.quantity > 1 ? ` ×${r.quantity}` : ""}
      </strong>
      <span>
        {r.person}, {r.day}, {r.store}
      </span>
      <span>{kr(r.total)}</span>
    </div>
  );
}

/** Says where you are for screen readers, once per arrival */
function Announcer() {
  const here = useStore((s) => s.here);
  const shopper = useStore((s) => s.shopper);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!here) return;
    if (isAisle(here)) setText(`${aisleName(here)}. ${shopper === "Everyone" ? "Everyone" : shopper} spent ${kr(SPENT[shopper][here])} here.`);
    else if (here === "checkout") setText(`Checkout. ${kr(CHECKOUT[shopper].paid)} paid, ${kr(CHECKOUT[shopper].saved)} saved.`);
    else setText("Entrance.");
  }, [here, shopper]);
  return (
    <p className="sr-only" role="status">
      {text}
    </p>
  );
}
