import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { AISLES, colourOf, type AisleId } from "../data/receipts";
import { UNITS, facing, fixtureOf, type Unit } from "../data/layout";
import { useStore } from "../state";

// The products: every unit on every receipt line, one instanced mesh per aisle.
// When a shopper is picked, their units turn their colour, slide forward and grow
// a little; everyone else's fade towards grey. Hover or tap a product to read its
// receipt line.

const sitOnShelf = (g: BufferGeometry, h: number) => g.translate(0, h / 2, 0);
const SHAPES: Record<AisleId, () => BufferGeometry> = {
  veg: () => sitOnShelf(new IcosahedronGeometry(0.07, 1), 0.14),
  dairy: () => sitOnShelf(new BoxGeometry(0.08, 0.2, 0.08), 0.2),
  fridge: () => sitOnShelf(new CylinderGeometry(0.06, 0.06, 0.09, 16), 0.09),
  colonial: () => sitOnShelf(new BoxGeometry(0.1, 0.16, 0.07), 0.16),
  soda: () => sitOnShelf(new CylinderGeometry(0.04, 0.042, 0.27, 12), 0.27),
  candy: () => sitOnShelf(new BoxGeometry(0.12, 0.17, 0.05), 0.17),
  other: () => sitOnShelf(new BoxGeometry(0.12, 0.13, 0.1), 0.13),
  frozen: () => sitOnShelf(new BoxGeometry(0.2, 0.06, 0.14), 0.06),
  meat: () => sitOnShelf(new BoxGeometry(0.17, 0.045, 0.13), 0.045),
  bread: () => sitOnShelf(new BoxGeometry(0.2, 0.1, 0.11), 0.1),
};

/** Packaging colours per aisle; each item picks one by its name, so the same item always looks the same */
const PACKAGING: Record<AisleId, string[]> = {
  veg: ["#7DB343", "#C0392B", "#E67E22", "#F1C40F", "#5D8C3A", "#9C6B3E"],
  dairy: ["#F4F6F8", "#DDE8F3", "#9CC3E6", "#F6E7B4", "#E3ECF1"],
  fridge: ["#F2D6A0", "#E8B4A0", "#CFE3C9", "#F5F0E1"],
  colonial: ["#C0392B", "#E9C46A", "#2A9D8F", "#3B5568", "#F4A261", "#8D6E63"],
  soda: ["#B71C1C", "#2E7D32", "#E0E0E0", "#F9A825", "#1565C0"],
  candy: ["#E91E63", "#FFC107", "#9C27B0", "#FF5722", "#03A9F4"],
  other: ["#90A4AE", "#CFD8DC", "#80CBC4", "#BCAAA4"],
  frozen: ["#B3E5FC", "#81D4FA", "#E1F5FE", "#4FC3F7"],
  meat: ["#D96459", "#E57373", "#C62828", "#F2B8A2"],
  bread: ["#C68B59", "#A0522D", "#DEB887", "#8B5A2B"],
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const packagingOf = (u: Unit) => {
  const list = PACKAGING[u.receipt.aisle];
  return list[hash(u.receipt.item) % list.length];
};

const GREY = new Color("#8F9499");

export function Products() {
  return (
    <group>
      {AISLES.map((a) => (
        <AisleProducts key={a.id} aisle={a.id} />
      ))}
    </group>
  );
}

function AisleProducts({ aisle }: { aisle: AisleId }) {
  const units = UNITS[aisle];
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => SHAPES[aisle](), [aisle]);
  const f = fixtureOf(aisle);
  const [fx, fz] = facing(f);
  const base = useMemo(() => units.map((u) => new Color(packagingOf(u))), [units]);
  // Per unit: where it is between dim (-1), normal (0) and lit (1), and where it is heading
  const mix = useRef(new Float32Array(units.length));
  const target = useRef(new Float32Array(units.length));
  const settled = useRef(false);
  const shopper = useStore((s) => s.shopper);
  const reduced = useStore((s) => s.reducedMotion);
  const setHover = useStore((s) => s.setHover);

  useLayoutEffect(() => {
    units.forEach((u, i) => {
      target.current[i] = shopper === "Everyone" ? 0 : u.receipt.person === shopper ? 1 : -1;
    });
    settled.current = false;
  }, [shopper, units]);

  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), f.rot), p: new Vector3(), s: new Vector3(), c: new Color(), lit: new Color() }), [f.rot]);

  // Colours have to exist before the first frame, or the material compiles without them
  useLayoutEffect(() => {
    const mesh = ref.current!;
    units.forEach((u, i) => {
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(...u.position), tmp.q, tmp.s.setScalar(1)));
      mesh.setColorAt(i, base[i]);
    });
    mesh.computeBoundingSphere();
  }, [units, base, tmp]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh || settled.current) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
    tmp.lit.set(colourOf(shopper));
    let moving = false;
    for (let i = 0; i < units.length; i++) {
      const m = (mix.current[i] += (target.current[i] - mix.current[i]) * k);
      if (Math.abs(target.current[i] - m) > 0.002) moving = true;
      const lit = Math.max(0, m);
      const dim = Math.max(0, -m);
      const [x, y, z] = units[i].position;
      tmp.p.set(x + fx * 0.08 * lit, y + 0.01 * lit, z + fz * 0.08 * lit);
      tmp.s.setScalar(1 + 0.14 * lit);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      tmp.c.copy(base[i]).lerp(tmp.lit, 0.7 * lit).lerp(GREY, 0.72 * dim).multiplyScalar(1 - 0.25 * dim + 0.1 * lit);
      mesh.setColorAt(i, tmp.c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    settled.current = !moving;
  });

  const hover = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId == null) return;
    setHover({ aisle, index: e.instanceId, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, units.length]}
      onPointerMove={hover}
      onClick={hover}
      onPointerOut={() => setHover(null)}
    >
      <meshStandardMaterial roughness={0.55} metalness={0.02} />
    </instancedMesh>
  );
}
