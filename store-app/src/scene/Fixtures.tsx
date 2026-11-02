import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { animated, useSpring } from "@react-spring/three";
import { BufferGeometry, CanvasTexture, InstancedMesh, Material, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { CRATE, CRATE_ROWS, FIXTURES, slotPlan, type Fixture } from "../data/layout";
import { useStore } from "../state";

// Every aisle's furniture. A fixture's front faces local +z. Painted steel for
// the shelving, brushed metal trims, reflective glass on the coolers, real
// plastic crates for the produce, and a soft contact shadow under each, so
// nothing floats on the floor.

const PAINT = "#EEF0EC";
const BACK = "#E3E6E1";
const PLINTH = "#7C857E";
const STEEL = "#B9C0C4";

const mat = {
  paint: new MeshStandardMaterial({ color: PAINT, roughness: 0.55, metalness: 0.05 }),
  back: new MeshStandardMaterial({ color: BACK, roughness: 0.7 }),
  plinth: new MeshStandardMaterial({ color: PLINTH, roughness: 0.6, metalness: 0.2 }),
  steel: new MeshStandardMaterial({ color: STEEL, roughness: 0.32, metalness: 0.85 }),
  dark: new MeshStandardMaterial({ color: "#3A4148", roughness: 0.45, metalness: 0.5 }),
  rail: new MeshStandardMaterial({ color: "#DADDD7", roughness: 0.4, metalness: 0.1 }),
  glass: new MeshStandardMaterial({ color: "#E6F4FA", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, envMapIntensity: 2.2, depthWrite: false }),
  coolLight: new MeshStandardMaterial({ color: "#F2F8FC", emissive: "#E2F1FF", emissiveIntensity: 0.45, roughness: 0.6 }),
  strip: new MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 1.4 }),
  frost: new MeshStandardMaterial({ color: "#D2E9F3", roughness: 0.35 }),
  stand: new MeshStandardMaterial({ color: "#5B4A3B", roughness: 0.75 }),
  paper: new MeshStandardMaterial({ color: "#3F5B3B", roughness: 0.95 }),
};

export function Fixtures() {
  return (
    <group>
      {FIXTURES.map((f) => (
        <group key={f.aisle} position={[f.x, 0, f.z]} rotation-y={f.rot}>
          <ContactShadow f={f} />
          {f.kind === "shelf" && <Shelf f={f} />}
          {f.kind === "cooler" && <Cooler f={f} />}
          {f.kind === "crates" && <Crates f={f} />}
          {f.kind === "freezer" && <Freezer f={f} />}
          {f.kind === "counter" && <Counter f={f} />}
        </group>
      ))}
    </group>
  );
}

function Box({ size, at, m, rotX }: { size: [number, number, number]; at: [number, number, number]; m: Material; rotX?: number }) {
  return (
    <mesh position={at} rotation-x={rotX ?? 0} material={m} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** A soft dark pool under a fixture, darkest at its foot */
const shadowTexture = (() => {
  let t: CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.filter = "blur(14px)";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(28, 28, 72, 72);
    t = new CanvasTexture(c);
    return t;
  };
})();

function ContactShadow({ f }: { f: Fixture }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.003} renderOrder={-1}>
      <planeGeometry args={[f.length * 1.25 + 0.3, f.depth * 1.7 + 0.3]} />
      <meshBasicMaterial color="#000000" alphaMap={shadowTexture()} transparent opacity={0.32} depthWrite={false} />
    </mesh>
  );
}

/** A gondola: painted back panel and uprights, shelves with a price rail along each front edge */
function Shelf({ f }: { f: Fixture }) {
  const { ys } = slotPlan(f);
  const { length: l, depth: d, height: h } = f;
  return (
    <group>
      <Box size={[l, 0.12, d]} at={[0, 0.06, 0]} m={mat.plinth} />
      <Box size={[l, h, 0.04]} at={[0, h / 2, -d / 2 + 0.02]} m={mat.back} />
      <Box size={[l, 0.06, d]} at={[0, h - 0.03, 0]} m={mat.paint} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.04, h, d]} at={[(s * (l - 0.04)) / 2, h / 2, 0]} m={mat.paint} />
      ))}
      {ys.map((y) => (
        <group key={y}>
          <Box size={[l - 0.08, 0.025, d - 0.05]} at={[0, y - 0.0125, 0.02]} m={mat.paint} />
          <Box size={[l - 0.08, 0.045, 0.012]} at={[0, y - 0.025, d / 2 - 0.004]} m={mat.rail} />
          <Box size={[l - 0.08, 0.006, 0.014]} at={[0, y - 0.002, d / 2 - 0.004]} m={mat.steel} />
        </group>
      ))}
    </group>
  );
}

/** An upright glass-door cooler, lit inside; its doors swing open while you stand at it */
function Cooler({ f }: { f: Fixture }) {
  const { ys } = slotPlan(f);
  const { length: l, depth: d, height: h } = f;
  const doors = Math.max(2, Math.round(l / 0.9));
  const w = l / doors;
  const open = useStore((s) => s.here === f.aisle);
  const reduced = useStore((s) => s.reducedMotion);
  const { angle } = useSpring({ angle: open ? -1.5 : 0, immediate: reduced, config: { tension: 120, friction: 18 } });
  return (
    <group>
      <Box size={[l, 0.32, d]} at={[0, 0.16, 0]} m={mat.dark} />
      <Box size={[l, 0.3, d]} at={[0, h - 0.15, 0]} m={mat.paint} />
      <Box size={[l - 0.04, 0.03, 0.02]} at={[0, h - 0.32, d / 2 - 0.1]} m={mat.strip} />
      <Box size={[l, h - 0.6, 0.04]} at={[0, h / 2, -d / 2 + 0.03]} m={mat.coolLight} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.05, h, d]} at={[(s * (l - 0.05)) / 2, h / 2, 0]} m={mat.paint} />
      ))}
      {ys.map((y) => (
        <group key={y}>
          <Box size={[l - 0.1, 0.012, d - 0.2]} at={[0, y - 0.006, -0.06]} m={mat.frost} />
          <Box size={[l - 0.1, 0.03, 0.01]} at={[0, y - 0.015, d / 2 - 0.16]} m={mat.rail} />
        </group>
      ))}
      {Array.from({ length: doors }, (_, i) => (
        <animated.group key={i} position={[-l / 2 + i * w, 0.32, d / 2 - 0.02]} rotation-y={angle}>
          <Box size={[w - 0.02, 0.04, 0.03]} at={[w / 2, 0.02, 0]} m={mat.steel} />
          <Box size={[w - 0.02, 0.04, 0.03]} at={[w / 2, h - 0.66, 0]} m={mat.steel} />
          <Box size={[0.035, h - 0.64, 0.03]} at={[0.02, (h - 0.64) / 2, 0]} m={mat.steel} />
          <Box size={[0.035, h - 0.64, 0.03]} at={[w - 0.04, (h - 0.64) / 2, 0]} m={mat.steel} />
          <mesh position={[w / 2, (h - 0.64) / 2, 0]} material={mat.glass} renderOrder={1}>
            <boxGeometry args={[w - 0.08, h - 0.7, 0.008]} />
          </mesh>
          <Box size={[0.022, 0.55, 0.035]} at={[w - 0.1, (h - 0.64) / 2, 0.04]} m={mat.steel} />
        </animated.group>
      ))}
    </group>
  );
}

const loadMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** A stepped stand of plastic produce crates, each filled to near the rim with paper */
function Crates({ f }: { f: Fixture }) {
  const { length: l, depth: d } = f;
  const front = d / 2;
  const n = Math.floor((l - 0.1) / CRATE.pitch);
  return (
    <group>
      {CRATE_ROWS.map((r, i) => (
        <group key={i}>
          <Box size={[l, r.bottom, CRATE.depth + 0.04]} at={[0, r.bottom / 2, front - r.back + CRATE.depth / 2]} m={mat.stand} />
          <Box size={[n * CRATE.pitch - 0.04, 0.01, CRATE.depth - 0.06]} at={[0, r.bottom + CRATE.height - 0.065, front - r.back + CRATE.depth / 2]} m={mat.paper} />
        </group>
      ))}
      <Box size={[l, 1.0, 0.05]} at={[0, 0.5, front - CRATE_ROWS[1].back - 0.03]} m={mat.stand} />
      <Suspense fallback={null}>
        <CrateModels f={f} n={n} />
      </Suspense>
    </group>
  );
}

function CrateModels({ f, n }: { f: Fixture; n: number }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/plastic_crate_02.glb`, loadMeshopt);
  const ref = useRef<InstancedMesh>(null);
  const { geometry, material } = useMemo(() => {
    let mesh: Mesh | null = null;
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh && !mesh) mesh = o as Mesh;
    });
    const m = mesh as unknown as Mesh;
    m.updateWorldMatrix(true, false);
    const g: BufferGeometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const s = CRATE.width / (b.max.x - b.min.x);
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(s, s, s);
    return { geometry: g, material: m.material as Material };
  }, [gltf]);
  const front = f.depth / 2;
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const m = new Matrix4();
    let i = 0;
    for (const r of CRATE_ROWS)
      for (let c = 0; c < n; c++)
        mesh.setMatrixAt(i++, m.compose(new Vector3((c - (n - 1) / 2) * CRATE.pitch, r.bottom, front - r.back + CRATE.depth / 2), q, one));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [n, front]);
  return <instancedMesh ref={ref} args={[geometry, material, n * CRATE_ROWS.length]} castShadow receiveShadow />;
}

/** A chest freezer: a white tub with a raised, frosted floor under a glass lid */
function Freezer({ f }: { f: Fixture }) {
  const { length: l, depth: d, height: h } = f;
  const wall = 0.06;
  return (
    <group>
      <Box size={[l, 0.72, d]} at={[0, 0.36, 0]} m={mat.paint} />
      <Box size={[l - 2 * wall, 0.02, d - 2 * wall]} at={[0, 0.73, 0]} m={mat.frost} />
      <Box size={[l, h - 0.72, wall]} at={[0, 0.72 + (h - 0.72) / 2, d / 2 - wall / 2]} m={mat.paint} />
      <Box size={[l, h - 0.72, wall]} at={[0, 0.72 + (h - 0.72) / 2, -d / 2 + wall / 2]} m={mat.paint} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[wall, h - 0.72, d]} at={[(s * (l - wall)) / 2, 0.72 + (h - 0.72) / 2, 0]} m={mat.paint} />
      ))}
      <Box size={[l, 0.02, 0.025]} at={[0, h + 0.005, d / 2 - wall / 2]} m={mat.steel} />
      <mesh position={[0, h + 0.008, 0]} material={mat.glass} renderOrder={1}>
        <boxGeometry args={[l - 0.02, 0.008, d - 0.02]} />
      </mesh>
      <Box size={[l, 0.05, 0.015]} at={[0, 0.3, d / 2 + 0.008]} m={mat.dark} />
    </group>
  );
}

/** A low meat counter: white cabinet, a tilted chilled bed and a glass guard on steel posts */
function Counter({ f }: { f: Fixture }) {
  const { length: l, depth: d } = f;
  return (
    <group>
      <Box size={[l, 0.72, d]} at={[0, 0.36, 0]} m={mat.paint} />
      <Box size={[l - 0.08, 0.04, d - 0.1]} at={[0, 0.8, 0]} m={mat.frost} rotX={-0.1} />
      <Box size={[l, 0.55, 0.06]} at={[0, 1.0, -d / 2 + 0.03]} m={mat.paint} />
      <Box size={[l, 0.03, 0.02]} at={[0, 1.27, -d / 2 + 0.07]} m={mat.strip} />
      {[-1, 0, 1].map((s) => (
        <Box key={s} size={[0.02, 0.42, 0.02]} at={[(s * (l - 0.1)) / 2, 0.95, d / 2 - 0.02]} m={mat.steel} />
      ))}
      <mesh position={[0, 1.0, d / 2 - 0.02]} rotation-x={0.25} material={mat.glass} renderOrder={1}>
        <boxGeometry args={[l - 0.04, 0.4, 0.008]} />
      </mesh>
      <Box size={[l, 0.05, 0.015]} at={[0, 0.35, d / 2 + 0.008]} m={mat.dark} />
    </group>
  );
}
