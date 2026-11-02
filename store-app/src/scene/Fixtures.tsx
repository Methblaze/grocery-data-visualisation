import { animated, useSpring } from "@react-spring/three";
import { FIXTURES, slotPlan, type Fixture } from "../data/layout";
import { useStore } from "../state";

const FRAME = "#C9CEC7";
const BOARD = "#F4F5F2";
const BACK = "#E1E4DF";
const PLINTH = "#8E978F";

/** Every aisle's furniture, built from boxes; a fixture's front faces local +z */
export function Fixtures() {
  return (
    <group>
      {FIXTURES.map((f) => (
        <group key={f.aisle} position={[f.x, 0, f.z]} rotation-y={f.rot}>
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

function Box({ size, at, color, ...rest }: { size: [number, number, number]; at: [number, number, number]; color: string; opacity?: number; emissive?: string; emissiveIntensity?: number; rotX?: number }) {
  return (
    <mesh position={at} rotation-x={rest.rotX ?? 0}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={rest.opacity != null}
        opacity={rest.opacity ?? 1}
        depthWrite={rest.opacity == null}
        emissive={rest.emissive ?? "#000000"}
        emissiveIntensity={rest.emissiveIntensity ?? 0}
        roughness={0.7}
      />
    </mesh>
  );
}

/** A gondola: back panel, uprights and shelves with a price rail along each front edge */
function Shelf({ f }: { f: Fixture }) {
  const { ys } = slotPlan(f);
  const { length: l, depth: d, height: h } = f;
  return (
    <group>
      <Box size={[l, 0.12, d]} at={[0, 0.06, 0]} color={PLINTH} />
      <Box size={[l, h, 0.05]} at={[0, h / 2, -d / 2 + 0.025]} color={BACK} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.05, h, d]} at={[(s * (l - 0.05)) / 2, h / 2, 0]} color={FRAME} />
      ))}
      {ys.map((y) => (
        <group key={y}>
          <Box size={[l - 0.1, 0.03, d - 0.06]} at={[0, y - 0.015, 0.02]} color={BOARD} />
          <Box size={[l - 0.1, 0.055, 0.012]} at={[0, y - 0.03, d / 2 - 0.005]} color="#D5D9D3" />
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
      <Box size={[l, 0.32, d]} at={[0, 0.16, 0]} color="#454C53" />
      <Box size={[l, 0.3, d]} at={[0, h - 0.15, 0]} color="#E9ECEF" />
      <Box size={[l - 0.04, 0.06, 0.02]} at={[0, h - 0.33, d / 2 - 0.12]} color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      <Box size={[l, h - 0.6, 0.05]} at={[0, h / 2, -d / 2 + 0.03]} color="#EEF6FB" emissive="#DCEFFF" emissiveIntensity={0.35} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.05, h, d]} at={[(s * (l - 0.05)) / 2, h / 2, 0]} color="#E9ECEF" />
      ))}
      {ys.map((y) => (
        <Box key={y} size={[l - 0.1, 0.02, d - 0.2]} at={[0, y - 0.012, -0.06]} color="#DDE6EC" />
      ))}
      {Array.from({ length: doors }, (_, i) => (
        <animated.group key={i} position={[-l / 2 + i * w, 0.32, d / 2 - 0.02]} rotation-y={angle}>
          <Box size={[w - 0.02, 0.04, 0.03]} at={[w / 2, 0.02, 0]} color="#3A4148" />
          <Box size={[w - 0.02, 0.04, 0.03]} at={[w / 2, h - 0.66, 0]} color="#3A4148" />
          <Box size={[0.04, h - 0.64, 0.03]} at={[0.02, (h - 0.64) / 2, 0]} color="#3A4148" />
          <Box size={[0.04, h - 0.64, 0.03]} at={[w - 0.04, (h - 0.64) / 2, 0]} color="#3A4148" />
          <Box size={[w - 0.08, h - 0.7, 0.01]} at={[w / 2, (h - 0.64) / 2, 0]} color="#D6EEF8" opacity={0.16} />
          <Box size={[0.025, 0.5, 0.04]} at={[w - 0.1, (h - 0.64) / 2, 0.04]} color="#B8BEC4" />
        </animated.group>
      ))}
    </group>
  );
}

/** Wooden produce crates on a stand, tilted towards you */
function Crates({ f }: { f: Fixture }) {
  const { length: l, depth: d } = f;
  const crates = Math.round(l / 1.15);
  const cw = l / crates;
  return (
    <group>
      <Box size={[l, 0.72, d]} at={[0, 0.36, 0]} color="#6F5A46" />
      {Array.from({ length: crates }, (_, i) => (
        <group key={i} position={[-l / 2 + cw * (i + 0.5), 0.9, 0]} rotation-x={-0.12}>
          <Box size={[cw - 0.06, 0.04, d - 0.04]} at={[0, -0.08, 0]} color="#B98B5E" />
          <Box size={[cw - 0.06, 0.12, 0.03]} at={[0, -0.03, d / 2 - 0.03]} color="#C79A6B" />
          <Box size={[0.03, 0.14, d - 0.04]} at={[-(cw - 0.09) / 2, -0.03, 0]} color="#C79A6B" />
          <Box size={[0.03, 0.14, d - 0.04]} at={[(cw - 0.09) / 2, -0.03, 0]} color="#C79A6B" />
        </group>
      ))}
      <Box size={[l, 0.5, 0.06]} at={[0, 1.15, -d / 2 + 0.03]} color="#8C7258" />
    </group>
  );
}

/** A chest freezer: an open white tub, frosted inside, under a glass lid */
function Freezer({ f }: { f: Fixture }) {
  const { length: l, depth: d, height: h } = f;
  const wall = 0.06;
  return (
    <group>
      {/* The floor of the tub sits high, so the items show just under the rim */}
      <Box size={[l, 0.72, d]} at={[0, 0.36, 0]} color="#F1F3F5" />
      <Box size={[l - 2 * wall, 0.02, d - 2 * wall]} at={[0, 0.73, 0]} color="#CFE6F2" />
      <Box size={[l, h - 0.72, wall]} at={[0, 0.72 + (h - 0.72) / 2, d / 2 - wall / 2]} color="#F1F3F5" />
      <Box size={[l, h - 0.72, wall]} at={[0, 0.72 + (h - 0.72) / 2, -d / 2 + wall / 2]} color="#F1F3F5" />
      {[-1, 1].map((s) => (
        <Box key={s} size={[wall, h - 0.72, d]} at={[(s * (l - wall)) / 2, 0.72 + (h - 0.72) / 2, 0]} color="#F1F3F5" />
      ))}
      <Box size={[l - 0.02, 0.012, d - 0.02]} at={[0, h + 0.006, 0]} color="#DFF3FA" opacity={0.18} />
      <Box size={[l, 0.06, 0.02]} at={[0, 0.3, d / 2 + 0.01]} color="#3F7FA6" />
    </group>
  );
}

/** A low meat counter: white cabinet, a tilted display bed and a glass guard */
function Counter({ f }: { f: Fixture }) {
  const { length: l, depth: d } = f;
  return (
    <group>
      <Box size={[l, 0.72, d]} at={[0, 0.36, 0]} color="#F1F3F5" />
      <Box size={[l - 0.08, 0.04, d - 0.1]} at={[0, 0.8, 0]} color="#E6EEF2" rotX={-0.1} />
      <Box size={[l, 0.55, 0.06]} at={[0, 1.0, -d / 2 + 0.03]} color="#E9ECEF" />
      <Box size={[l - 0.04, 0.4, 0.012]} at={[0, 1.0, d / 2 - 0.02]} color="#DFF3FA" opacity={0.16} rotX={0.25} />
      <Box size={[l, 0.06, 0.02]} at={[0, 0.35, d / 2 + 0.01]} color="#B03A2E" />
    </group>
  );
}
