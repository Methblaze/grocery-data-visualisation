import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { colourOf } from "../data/receipts";
import { UNITS } from "../data/layout";
import { useStore } from "../state";
import { packagingOf } from "./Products";

// The basket you carry, at the bottom right of the view. Arriving at an aisle
// sends the shopper's items from that aisle's shelves into it in an arc; the pile
// grows as they land. A new shopper or the entrance empties it.

const PER_AISLE = 30;
const POOL = 90;
const PILE = 40;
const ITEM = new BoxGeometry(0.05, 0.05, 0.05);

interface Flight {
  from: Vector3;
  start: number;
  colour: Color;
}

export function Basket() {
  const camera = useThree((s) => s.camera);
  const shopper = useStore((s) => s.shopper);
  const basket = useRef<Group>(null);
  const flyers = useRef<InstancedMesh>(null);
  const pile = useRef<InstancedMesh>(null);
  const flights = useRef<Flight[]>([]);
  const landed = useRef(0);
  const seen = useRef(0);
  const clock = useRef(0);
  const colour = colourOf(shopper);
  const tmp = useMemo(() => ({ m: new Matrix4(), p: new Vector3(), q: new Quaternion(), s: new Vector3(), to: new Vector3(), c: new Vector3(), off: new Vector3() }), []);

  // Where each landed item sits in the pile, in the basket's own space
  const spots = useMemo(
    () =>
      Array.from({ length: PILE }, (_, i) => {
        const layer = Math.floor(i / 12);
        const j = i % 12;
        return new Vector3(-0.09 + (j % 4) * 0.06, -0.035 + layer * 0.045, -0.05 + Math.floor(j / 4) * 0.05);
      }),
    [],
  );

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
            pick.forEach((u) => land(new Color(packagingOf(u))));
            continue;
          }
          pick.forEach((u, i) => {
            if (flights.current.length < POOL) flights.current.push({ from: new Vector3(...u.position), start: clock.current + 0.25 + i * 0.045, colour: new Color(packagingOf(u)) });
          });
        }
      }),
    [],
  );

  const land = (c: Color) => {
    const mesh = pile.current;
    if (!mesh) return;
    const i = landed.current % PILE;
    mesh.setMatrixAt(i, tmp.m.compose(spots[i], tmp.q.identity(), tmp.s.setScalar(1)));
    mesh.setColorAt(i, c);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    landed.current++;
    mesh.count = Math.min(PILE, landed.current);
  };

  useLayoutEffect(() => {
    // Colours must exist before the first frame
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
    tmp.off.set(Math.min(0.36, halfW - 0.1), -0.36, -0.8);
    b.position.copy(camera.localToWorld(tmp.off.clone()));
    b.quaternion.copy(camera.quaternion);
    tmp.to.copy(b.position);

    let n = 0;
    const left: Flight[] = [];
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
      fly.setMatrixAt(n, tmp.m.compose(tmp.p, b.quaternion, tmp.s.setScalar(1.4 - 0.8 * e)));
      fly.setColorAt(n, f.colour);
      n++;
    }
    flights.current = left;
    fly.count = n;
    fly.instanceMatrix.needsUpdate = true;
    if (fly.instanceColor) fly.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={flyers} args={[ITEM, undefined, POOL]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <group ref={basket}>
        <group scale={0.55}>
        {/* A plastic shopping basket in the shopper's colour, drawn over everything else */}
        <group renderOrder={10}>
          {[
            { size: [0.26, 0.012, 0.18], at: [0, -0.06, 0] },
            { size: [0.26, 0.12, 0.012], at: [0, 0, 0.09] },
            { size: [0.26, 0.12, 0.012], at: [0, 0, -0.09] },
            { size: [0.012, 0.12, 0.18], at: [0.13, 0, 0] },
            { size: [0.012, 0.12, 0.18], at: [-0.13, 0, 0] },
            { size: [0.012, 0.012, 0.19], at: [-0.06, 0.1, 0] },
            { size: [0.012, 0.012, 0.19], at: [0.06, 0.1, 0] },
          ].map((p, i) => (
            <mesh key={i} position={p.at as [number, number, number]} renderOrder={10}>
              <boxGeometry args={p.size as [number, number, number]} />
              <meshStandardMaterial color={colour} roughness={0.45} depthTest={false} transparent />
            </mesh>
          ))}
        </group>
        <instancedMesh ref={pile} args={[ITEM, undefined, PILE]} frustumCulled={false} renderOrder={11}>
          <meshStandardMaterial roughness={0.5} depthTest={false} transparent />
        </instancedMesh>
        </group>
      </group>
    </>
  );
}
