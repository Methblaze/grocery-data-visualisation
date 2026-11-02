import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AISLES, RECEIPTS, colourOf } from "../data/receipts";
import { UNITS, facing, fixtureOf, type Unit } from "../data/layout";
import { useStore } from "../state";
import { kindOf, labelCellOf, labelSheet, unitTurn, type Kind } from "./catalogue";

// The products: every unit on every receipt line, one instanced mesh per kind of
// package or produce. When a shopper is picked, their units take on their colour,
// slide forward and grow a little; everyone else's fade towards grey. Hover or
// tap a product to read its receipt line.

interface Group {
  kind: Kind;
  units: Unit[];
}

const GROUPS: Group[] = (() => {
  const byKind = new Map<string, Group>();
  for (const a of AISLES)
    for (const u of UNITS[a.id]) {
      const kind = kindOf(u.receipt);
      if (!byKind.has(kind.key)) byKind.set(kind.key, { kind, units: [] });
      byKind.get(kind.key)!.units.push(u);
    }
  return [...byKind.values()];
})();

const GREY = new Color("#8F9499");
const WHITE = new Color("#ffffff");
const UP = new Vector3(0, 1, 0);

export function Products() {
  const sheet = useMemo(() => labelSheet(RECEIPTS), []);
  const plain = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, metalness: 0 }), []);
  return (
    <group>
      {GROUPS.filter((g) => !g.kind.model).map((g) => (
        <BuiltKind key={g.kind.key} group={g} material={g.kind.label ? sheet.material : plain} />
      ))}
      <ShopperTags />
      {/* The scanned produce arrives a moment later; the shop does not wait for it */}
      <Suspense fallback={null}>
        {GROUPS.filter((g) => g.kind.model).map((g) => (
          <ModelKind key={g.kind.key} group={g} />
        ))}
      </Suspense>
    </group>
  );
}

function BuiltKind({ group, material }: { group: Group; material: Material }) {
  const geometry = useMemo(() => {
    const g = group.kind.build!();
    if (group.kind.label) {
      const cells = new Float32Array(group.units.length * 2);
      group.units.forEach((u, i) => cells.set(labelCellOf(u.receipt), i * 2));
      g.setAttribute("labelCell", new InstancedBufferAttribute(cells, 2));
    }
    return g;
  }, [group]);
  return <KindMesh group={group} geometry={geometry} material={material} />;
}

const loadMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** A Poly Haven model: its largest mesh, resting on the shelf at its real size */
function ModelKind({ group }: { group: Group }) {
  const { file, size } = group.kind.model!;
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/${file}`, loadMeshopt);
  const { geometry, material } = useMemo(() => {
    let best: Mesh | null = null;
    gltf.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && (!best || m.geometry.attributes.position.count > best.geometry.attributes.position.count)) best = m;
    });
    const mesh = best as unknown as Mesh;
    mesh.updateWorldMatrix(true, false);
    const g: BufferGeometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const longest = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    const s = size / longest;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(s, s, s);
    return { geometry: g, material: mesh.material as Material };
  }, [gltf, size]);
  return <KindMesh group={group} geometry={geometry} material={material} />;
}

function KindMesh({ group, geometry, material }: { group: Group; geometry: BufferGeometry; material: Material }) {
  const { units, kind } = group;
  const ref = useRef<InstancedMesh>(null);
  const base = useMemo(() => units.map(() => new Color(kind.colour ?? "#ffffff")), [units, kind.colour]);
  const turns = useMemo(
    () =>
      units.map((u, i) => {
        const f = fixtureOf(u.receipt.aisle);
        return new Quaternion().setFromAxisAngle(UP, f.rot + (kind.loose ? unitTurn(u.receipt, i) : 0));
      }),
    [units, kind.loose],
  );
  const facings = useMemo(() => units.map((u) => facing(fixtureOf(u.receipt.aisle))), [units]);
  const mix = useRef(new Float32Array(units.length));
  const target = useRef(new Float32Array(units.length));
  const settled = useRef(false);
  const shopper = useStore((s) => s.shopper);
  const reduced = useStore((s) => s.reducedMotion);
  const setHover = useStore((s) => s.setHover);
  const tmp = useMemo(() => ({ m: new Matrix4(), p: new Vector3(), s: new Vector3(), c: new Color(), lit: new Color() }), []);

  // Matrices and colours have to exist before the first frame, or the material compiles without them
  useLayoutEffect(() => {
    const mesh = ref.current!;
    units.forEach((u, i) => {
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(...u.position), turns[i], tmp.s.setScalar(1)));
      mesh.setColorAt(i, base[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [units, base, turns, tmp]);

  useLayoutEffect(() => {
    units.forEach((u, i) => {
      target.current[i] = shopper === "Everyone" ? 0 : u.receipt.person === shopper ? 1 : -1;
    });
    settled.current = false;
  }, [shopper, units]);

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
      const [fx, fz] = facings[i];
      tmp.p.set(x + fx * 0.08 * lit, y + 0.01 * lit, z + fz * 0.08 * lit);
      tmp.s.setScalar(1 + 0.12 * lit);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, turns[i], tmp.s));
      // Lit: a wash of the shopper's colour; dimmed: towards grey and a little darker
      tmp.c.copy(base[i]).lerp(tmp.lit, 0.35 * lit).lerp(GREY, 0.85 * dim).multiplyScalar(1 - 0.45 * dim);
      if (lit > 0 && base[i].equals(WHITE)) tmp.c.lerp(WHITE, 0.15 * lit);
      mesh.setColorAt(i, tmp.c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    settled.current = !moving;
  });

  const hover = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId == null) return;
    const u = units[e.instanceId];
    setHover({ aisle: u.receipt.aisle, index: u.index, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, units.length]}
      castShadow
      receiveShadow
      onPointerMove={hover}
      onClick={hover}
      onPointerOut={() => setHover(null)}
    />
  );
}

// A shelf tag in the shopper's colour springs up at the front edge under each of
// their items, as real shelf tags do, so their share of an aisle reads at a glance
// even among colourful packaging.
const ALL = GROUPS.flatMap((g) => g.units);
const TAG = new RoundedBoxGeometry(0.06, 0.032, 0.008, 2, 0.003);

function ShopperTags() {
  const ref = useRef<InstancedMesh>(null);
  const shopper = useStore((s) => s.shopper);
  const reduced = useStore((s) => s.reducedMotion);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.35, emissiveIntensity: 0.35 }), []);
  const show = useRef(new Float32Array(ALL.length));
  const target = useRef(new Float32Array(ALL.length));
  const settled = useRef(false);
  const places = useMemo(
    () =>
      ALL.map((u) => {
        const f = fixtureOf(u.receipt.aisle);
        const [fx, fz] = facing(f);
        // On shelves and in coolers the tag hangs on the shelf edge; elsewhere it stands just in front
        const ahead = f.kind === "shelf" ? 0.18 : f.kind === "cooler" ? 0.15 : 0.12;
        const drop = f.kind === "shelf" || f.kind === "cooler" ? -0.03 : 0.012;
        return {
          p: new Vector3(u.position[0] + fx * ahead, u.position[1] + drop, u.position[2] + fz * ahead),
          q: new Quaternion().setFromAxisAngle(UP, f.rot),
        };
      }),
    [],
  );
  const tmp = useMemo(() => ({ m: new Matrix4(), s: new Vector3() }), []);

  useLayoutEffect(() => {
    ALL.forEach((u, i) => (target.current[i] = shopper !== "Everyone" && u.receipt.person === shopper ? 1 : 0));
    material.color.set(colourOf(shopper));
    material.emissive.set(colourOf(shopper));
    settled.current = false;
  }, [shopper, material]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh || settled.current) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    let moving = false;
    for (let i = 0; i < ALL.length; i++) {
      const v = (show.current[i] += (target.current[i] - show.current[i]) * k);
      if (Math.abs(target.current[i] - v) > 0.002) moving = true;
      // Grows up out of the rail; fully gone when hidden, not a sliver
      const w = Math.min(1, v * 4);
      mesh.setMatrixAt(i, tmp.m.compose(places[i].p, places[i].q, tmp.s.set(Math.max(0.0001, w), Math.max(0.0001, v), Math.max(0.0001, w))));
    }
    mesh.instanceMatrix.needsUpdate = true;
    settled.current = !moving;
  });

  return <instancedMesh ref={ref} args={[TAG, material, ALL.length]} frustumCulled={false} />;
}
