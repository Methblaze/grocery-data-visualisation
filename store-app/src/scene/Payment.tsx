import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CHECKOUT, colourOf, kr, type ShopperId } from "../data/receipts";
import { STOPS, TERMINAL } from "../data/layout";
import { useStore } from "../state";
import { FONT } from "./canvasTexture";

// Paying at the checkout, to finish the walk. A card terminal stands at the
// customer's end of the first counter. Arriving there, a card in the shopper's
// colour comes up from the basket and taps the terminal; the screen goes from
// the total to Processing to Approved, the card goes back, and a receipt prints
// out of the top with what they paid and saved (the corrected totals). It plays
// again on each arrival or a change of shopper; with reduced motion it shows the
// approved terminal and the receipt at once.

const SPOT = STOPS.find((s) => s.id === "checkout")!;
const YAW = Math.atan2(SPOT.x - TERMINAL.x, SPOT.z - TERMINAL.z);
const TILT = -0.35; // the terminal leans back towards you
const BODY = { w: 0.085, h: 0.17, d: 0.03 };
const POLE = 0.24;
const DONE = 10;

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return { ctx: c.getContext("2d")!, t, w, h };
};
const who = (s: ShopperId) => (s === "Everyone" ? "All five shoppers" : s);
const money = (n: number) => kr(n).replace(/\s/g, " ");

type Screen = "total" | "processing" | "approved";

function drawScreen(c: ReturnType<typeof canvas>, state: Screen, shopper: ShopperId) {
  const { ctx, w, h } = c;
  ctx.fillStyle = "#0E1A17";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const paid = money(CHECKOUT[shopper].paid);
  if (state === "approved") {
    ctx.fillStyle = "#2BB673";
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.36, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h * 0.36);
    ctx.lineTo(w / 2 - 4, h * 0.36 + 16);
    ctx.lineTo(w / 2 + 22, h * 0.36 - 14);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText("Approved", w / 2, h * 0.66);
    ctx.fillStyle = "#A8C7BA";
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(paid, w / 2, h * 0.82);
    return;
  }
  ctx.fillStyle = "#A8C7BA";
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(state === "processing" ? "Processing" : "Total", w / 2, h * 0.26);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${paid.length > 13 ? 30 : 36}px ${FONT}`;
  ctx.fillText(paid, w / 2, h * 0.47);
  // The contactless mark: tap here
  ctx.strokeStyle = state === "processing" ? "#2BB673" : "#A8C7BA";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(w / 2 - 22, h * 0.76, 14 + i * 12, -0.7, 0.7);
    ctx.stroke();
  }
}

function drawCard(c: ReturnType<typeof canvas>, shopper: ShopperId) {
  const { ctx, w, h } = c;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, colourOf(shopper));
  g.addColorStop(1, "#14201B");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // The chip
  ctx.fillStyle = "#E7C46B";
  ctx.beginPath();
  ctx.roundRect(48, 118, 76, 58, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,90,20,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(62, 130, 48, 34);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(150, 147, 12 + i * 11, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = `600 34px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(who(shopper), 48, h - 52);
  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "right";
  ctx.fillText("Debit", w - 40, 64);
}

function drawReceipt(c: ReturnType<typeof canvas>, shopper: ShopperId) {
  const { ctx, w, h } = c;
  ctx.fillStyle = "#FBFAF6";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#23272B";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const mono = '"Cascadia Mono", Consolas, "Courier New", monospace';
  ctx.font = `700 30px ${mono}`;
  ctx.fillText("Receipt", w / 2, 54);
  ctx.font = `500 21px ${mono}`;
  ctx.fillText(who(shopper), w / 2, 92);
  ctx.fillText("20.03-10.04.2024", w / 2, 122);
  const rule = (y: number) => {
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = "#8A9096";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w - 18, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  rule(148);
  const row = (label: string, value: string, y: number, bold = false) => {
    ctx.font = `${bold ? 700 : 500} ${bold ? 25 : 22}px ${mono}`;
    ctx.textAlign = "left";
    ctx.fillText(label, 22, y);
    ctx.textAlign = "right";
    ctx.fillText(value, w - 22, y);
  };
  row("Total", money(CHECKOUT[shopper].paid), 196, true);
  row("Saved", money(CHECKOUT[shopper].saved), 236);
  rule(266);
  ctx.textAlign = "center";
  ctx.font = `500 21px ${mono}`;
  ctx.fillText("Paid by card", w / 2, 312);
  ctx.fillText("Approved", w / 2, 342);
  ctx.font = `700 24px ${mono}`;
  ctx.fillText("Thank you", w / 2, 410);
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function Payment() {
  const camera = useThree((s) => s.camera);
  const here = useStore((s) => s.here);
  const shopper = useStore((s) => s.shopper);
  const reduced = useStore((s) => s.reducedMotion);
  const card = useRef<Group>(null);
  const screenRef = useRef<Mesh>(null);
  const receipt = useRef<Mesh>(null);
  const clock = useRef(0);
  const start = useRef<number | null>(null);
  const shown = useRef<Screen | null>(null);
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), q: new Quaternion(), qa: new Quaternion(), qb: new Quaternion(), off: new Vector3() }), []);

  const art = useMemo(() => {
    const screen = canvas(256, 256);
    const face = canvas(512, 320);
    const paper = canvas(256, 460);
    paper.t.repeat.set(1, 0);
    return {
      screen,
      face,
      paper,
      body: new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 3, 0.008),
      cardGeo: new RoundedBoxGeometry(0.0856, 0.054, 0.0012, 2, 0.0006),
      // Grows up from the printer slot
      paperGeo: new PlaneGeometry(0.064, 0.115).translate(0, 0.0575, 0),
      dark: new MeshStandardMaterial({ color: "#23282D", roughness: 0.35, metalness: 0.3 }),
      steel: new MeshStandardMaterial({ color: "#B9C0C4", roughness: 0.3, metalness: 0.85 }),
    };
  }, []);

  // A new arrival, or a new shopper while standing here, starts the payment again
  useEffect(() => {
    drawCard(art.face, shopper);
    art.face.t.needsUpdate = true;
    drawReceipt(art.paper, shopper);
    art.paper.t.needsUpdate = true;
    shown.current = null;
    start.current = here === "checkout" ? clock.current : null;
  }, [here, shopper, art]);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05);
    const t = start.current == null ? -1 : reduced ? DONE : clock.current - start.current;
    const state: Screen = t >= 2.2 ? "approved" : t >= 1.35 ? "processing" : "total";
    if (state !== shown.current) {
      drawScreen(art.screen, state, shopper);
      art.screen.t.needsUpdate = true;
      shown.current = state;
    }

    // The receipt prints out of the top, first lines first
    const print = ease((t - 2.6) / 1.2);
    if (receipt.current) {
      receipt.current.scale.y = Math.max(0.0001, print);
      receipt.current.visible = print > 0;
      art.paper.t.repeat.y = print;
      art.paper.t.offset.y = 1 - print;
    }

    // The card: up from the basket, a tap on the screen, and back
    const c = card.current;
    const s = screenRef.current;
    if (!c || !s) return;
    const going = ease((t - 0.45) / 0.9);
    const back = ease((t - 2.45) / 0.6);
    c.visible = t > 0.45 && back < 1;
    if (!c.visible) return;
    tmp.off.set(0.24, -0.3, -0.6);
    tmp.a.copy(tmp.off);
    camera.localToWorld(tmp.a);
    tmp.qa.copy(camera.quaternion);
    s.getWorldPosition(tmp.b);
    s.getWorldQuaternion(tmp.qb);
    tmp.off.set(0, 0, 0.045).applyQuaternion(tmp.qb);
    tmp.b.add(tmp.off);
    const k = going - back;
    // A small press towards the reader while it is held there
    const press = t > 1.35 && t < 2.2 ? Math.sin(((t - 1.35) / 0.85) * Math.PI) * 0.018 : 0;
    c.position.copy(tmp.a).lerp(tmp.b, k);
    tmp.off.set(0, 0, -press).applyQuaternion(tmp.qb);
    c.position.add(tmp.off);
    c.quaternion.copy(tmp.qa).slerp(tmp.qb, k);
  });

  return (
    <group>
      <group position={[TERMINAL.x, TERMINAL.y, TERMINAL.z]} rotation-y={YAW}>
        {/* The swivel stand */}
        <mesh material={art.steel} position-y={0.01} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.02, 24]} />
        </mesh>
        <mesh material={art.steel} position-y={POLE / 2} castShadow>
          <cylinderGeometry args={[0.012, 0.012, POLE, 12]} />
        </mesh>
        <group position-y={POLE + BODY.h / 2 - 0.02} rotation-x={TILT}>
          <mesh geometry={art.body} material={art.dark} castShadow />
          <mesh ref={screenRef} position={[0, 0.035, BODY.d / 2 + 0.0008]}>
            <planeGeometry args={[0.07, 0.07]} />
            <meshBasicMaterial map={art.screen.t} toneMapped={false} />
          </mesh>
          {/* Keypad */}
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[(-1 + (i % 3)) * 0.022, -0.02 - Math.floor(i / 3) * 0.014, BODY.d / 2 + 0.002]}>
              <boxGeometry args={[0.017, 0.009, 0.004]} />
              <meshStandardMaterial color={i === 9 ? "#C0392B" : i === 11 ? "#2BB673" : "#3A4047"} roughness={0.5} />
            </mesh>
          ))}
          {/* The printer slot, and the receipt coming out of it */}
          <mesh position={[0, BODY.h / 2 - 0.004, -0.004]}>
            <boxGeometry args={[0.07, 0.006, 0.006]} />
            <meshStandardMaterial color="#0E1114" />
          </mesh>
          <mesh ref={receipt} geometry={art.paperGeo} position={[0, BODY.h / 2, -0.004]} visible={false}>
            <meshStandardMaterial map={art.paper.t} roughness={0.9} side={DoubleSide} />
          </mesh>
        </group>
      </group>
      <group ref={card} visible={false}>
        <mesh geometry={art.cardGeo} castShadow>
          <meshStandardMaterial map={art.face.t} roughness={0.35} metalness={0.15} />
        </mesh>
      </group>
    </group>
  );
}
