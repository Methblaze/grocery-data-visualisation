import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { colourOf } from "../data/receipts";
import { UNITS } from "../data/layout";
import { useStore } from "../state";
import { unitColour } from "./catalogue";

// The basket you carry, at the bottom right of the view: a moulded plastic hand
// basket in the shopper's colour. Arriving at an aisle sends the shopper's items
// from its shelves into it in an arc, and the pile inside grows as they land;
// the grid of holes lets you see it. A new shopper or the entrance empties it.
// It is drawn after everything else, with the depth buffer cleared first, so it
// never sinks into a shelf you walk up to.

const PER_AISLE = 30;
const POOL = 90;
const PILE = 48;
const ITEM = new RoundedBoxGeometry(0.06, 0.05, 0.045, 2, 0.01);
const W = 0.42; // long side
const D = 0.28; // short side
const H = 0.2;
const TAPER = 0.85; // the bottom is smaller than the rim

/** The moulded grid: solid where the plastic is, see-through in the holes */
function gridTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalCompositeOperation = "destination-out";
  for (let x = 0; x < 9; x++)
    for (let y = 0; y < 3; y++) {
      ctx.beginPath();
      ctx.roundRect(14 + x * 26, 22 + y * 30, 18, 20, 5);
      ctx.fill();
    }
  const t = new CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function Basket() {
  const camera = useThree((s) => s.camera);
  const shopper = useStore((s) => s.shopper);
  const basket = useRef<Group>(null);
  const flyers = useRef<InstancedMesh>(null);
  const pile = useRef<InstancedMesh>(null);
  const flights = useRef<{ from: Vector3; start: number; colour: Color }[]>([]);
  const landed = useRef(0);
  const seen = useRef(0);
  const clock = useRef(0);
  const tmp = useMemo(() => ({ m: new Matrix4(), p: new Vector3(), q: new Quaternion(), s: new Vector3(), to: new Vector3(), c: new Vector3(), off: new Vector3() }), []);

  const parts = useMemo(() => {
    // Transparent only so they draw in the last pass, after the shop's glass and signs
    const plastic = new MeshStandardMaterial({ color: "#2E8B57", roughness: 0.42, metalness: 0, map: gridTexture(), alphaTest: 0.5, side: DoubleSide, transparent: true });
    const solid = new MeshStandardMaterial({ color: "#2E8B57", roughness: 0.4, metalness: 0, transparent: true });
    const grip = new MeshStandardMaterial({ color: "#2B2F33", roughness: 0.55, metalness: 0.1, transparent: true });
    const mid = (v: number) => (v * (1 + TAPER)) / 2;
    const tiltZ = Math.atan(((1 - TAPER) * D) / 2 / H);
    const tiltX = Math.atan(((1 - TAPER) * W) / 2 / H);
    const sides = [
      { g: new PlaneGeometry(mid(W), H), p: [0, H / 2, mid(D) / 2], r: [tiltZ, 0, 0] },
      { g: new PlaneGeometry(mid(W), H), p: [0, H / 2, -mid(D) / 2], r: [-tiltZ, 0, 0] },
      { g: new PlaneGeometry(mid(D), H), p: [mid(W) / 2, H / 2, 0], r: [0, Math.PI / 2, tiltX] },
      { g: new PlaneGeometry(mid(D), H), p: [-mid(W) / 2, H / 2, 0], r: [0, Math.PI / 2, -tiltX] },
    ];
    const rim = [
      { g: new RoundedBoxGeometry(W + 0.02, 0.018, 0.02, 2, 0.008), p: [0, H, D / 2] },
      { g: new RoundedBoxGeometry(W + 0.02, 0.018, 0.02, 2, 0.008), p: [0, H, -D / 2] },
      { g: new RoundedBoxGeometry(0.02, 0.018, D, 2, 0.008), p: [W / 2, H, 0] },
      { g: new RoundedBoxGeometry(0.02, 0.018, D, 2, 0.008), p: [-W / 2, H, 0] },
    ];
    // Two folding handles, hinged on the long sides and raised to meet above the middle
    const handle = (side: 1 | -1) =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(-0.11, H, (side * D) / 2),
          new Vector3(-0.1, H + 0.12, side * 0.06),
          new Vector3(0, H + 0.15, side * 0.03),
          new Vector3(0.1, H + 0.12, side * 0.06),
          new Vector3(0.11, H, (side * D) / 2),
        ]),
        32,
        0.007,
        8,
      );
    return { plastic, solid, grip, sides, rim, bottom: new RoundedBoxGeometry(W * TAPER, 0.012, D * TAPER, 2, 0.006), handles: [handle(1), handle(-1)] };
  }, []);

  // The basket takes the shopper's colour
  useEffect(() => {
    const c = new Color(colourOf(shopper));
    parts.plastic.color.copy(c);
    parts.solid.color.copy(c).multiplyScalar(0.9);
  }, [shopper, parts]);

  // Where each landed item sits in the pile, in the basket's own space
  const spots = useMemo(
    () =>
      Array.from({ length: PILE }, (_, i) => {
        const layer = Math.floor(i / 16);
        const j = i % 16;
        return new Vector3(-0.14 + (j % 4) * 0.09 + (layer % 2) * 0.03, 0.035 + layer * 0.05, -0.08 + Math.floor(j / 4) * 0.055);
      }),
    [],
  );

  const land = (c: Color) => {
    const mesh = pile.current;
    if (!mesh) return;
    const i = landed.current % PILE;
    tmp.q.setFromAxisAngle(new Vector3(0, 1, 0), ((i * 37) % 11) / 10 - 0.5);
    mesh.setMatrixAt(i, tmp.m.compose(spots[i], tmp.q, tmp.s.setScalar(1)));
    mesh.setColorAt(i, c);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    landed.current++;
    mesh.count = Math.min(PILE, landed.current);
  };

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.launches === prev.launches) return;
        if (s.launches.length === 0) {
          flights.current = [];
          landed.current = 0;
          if (pile.current) pile.current.count = 0;
          return;
        }
        for (const l of s.launches) {
          if (l.nonce <= seen.current) continue;
          seen.current = l.nonce;
          const mine = UNITS[l.aisle].filter((u) => s.shopper === "Everyone" || u.receipt.person === s.shopper);
          // At most PER_AISLE fly; a big aisle sends an even sample of its items
          const pick = mine.length <= PER_AISLE ? mine : Array.from({ length: PER_AISLE }, (_, i) => mine[Math.floor((i * mine.length) / PER_AISLE)]);
          if (s.reducedMotion) {
            pick.forEach((u) => land(new Color(unitColour(u.receipt))));
            continue;
          }
          pick.forEach((u, i) => {
            if (flights.current.length < POOL) flights.current.push({ from: new Vector3(...u.position), start: clock.current + 0.25 + i * 0.045, colour: new Color(unitColour(u.receipt)) });
          });
        }
      }),
    [],
  );

  // Colours must exist before the first frame
  useLayoutEffect(() => {
    const black = new Color("#000");
    for (let i = 0; i < POOL; i++) flyers.current!.setColorAt(i, black);
    for (let i = 0; i < PILE; i++) pile.current!.setColorAt(i, black);
    pile.current!.count = 0;
  }, []);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05);
    const b = basket.current;
    const fly = flyers.current;
    if (!b || !fly) return;
    // Ride along at the bottom right of the view, nearer the middle on narrow screens
    const halfW = 0.8 * Math.tan((Math.PI / 180) * 31) * (camera as unknown as { aspect: number }).aspect;
    tmp.off.set(Math.min(0.4, halfW - 0.1), -0.38, -0.8);
    b.position.copy(camera.localToWorld(tmp.off.clone()));
    b.quaternion.copy(camera.quaternion);
    tmp.to.set(0, 0.08, 0);
    b.localToWorld(tmp.to);

    let n = 0;
    const left: typeof flights.current = [];
    for (const f of flights.current) {
      const t = (clock.current - f.start) / 0.75;
      if (t >= 1) {
        land(f.colour);
        continue;
      }
      left.push(f);
      if (t < 0 || n >= POOL) continue;
      const e = t * t * (3 - 2 * t);
      // A quadratic arc from the shelf, over the top, into the basket
      tmp.c.copy(f.from).lerp(tmp.to, 0.5).setY(Math.max(f.from.y, tmp.to.y) + 0.7);
      tmp.p.copy(f.from).multiplyScalar((1 - e) ** 2).addScaledVector(tmp.c, 2 * (1 - e) * e).addScaledVector(tmp.to, e * e);
      fly.setMatrixAt(n, tmp.m.compose(tmp.p, b.quaternion, tmp.s.setScalar(1.3 - 0.75 * e)));
      fly.setColorAt(n, f.colour);
      n++;
    }
    flights.current = left;
    fly.count = n;
    fly.instanceMatrix.needsUpdate = true;
    if (fly.instanceColor) fly.instanceColor.needsUpdate = true;
  });

  const OVER = 999;
  return (
    <>
      <instancedMesh ref={flyers} args={[ITEM, undefined, POOL]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <group ref={basket}>
        <group scale={0.46} rotation-y={-0.4}>
          {/* Clears the depth buffer just before the basket draws, so it stays in front of the shop */}
          <mesh renderOrder={OVER - 1} frustumCulled={false} onBeforeRender={(r) => r.clearDepth()}>
            <planeGeometry args={[0.001, 0.001]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
          </mesh>
          <mesh geometry={parts.bottom} material={parts.solid} position-y={0.006} renderOrder={OVER} />
          {parts.sides.map((s, i) => (
            <mesh key={i} geometry={s.g} material={parts.plastic} position={s.p as [number, number, number]} rotation={s.r as [number, number, number]} renderOrder={OVER} />
          ))}
          {parts.rim.map((s, i) => (
            <mesh key={i} geometry={s.g} material={parts.solid} position={s.p as [number, number, number]} renderOrder={OVER} />
          ))}
          {parts.handles.map((g, i) => (
            <mesh key={i} geometry={g} material={parts.grip} renderOrder={OVER} />
          ))}
          <instancedMesh ref={pile} args={[ITEM, undefined, PILE]} frustumCulled={false} renderOrder={OVER}>
            <meshStandardMaterial roughness={0.5} transparent />
          </instancedMesh>
        </group>
      </group>
    </>
  );
}
