import { useMemo } from "react";
import { CHECKOUTS, ENTRANCE, ROOM } from "../data/layout";
import { floorTexture } from "./canvasTexture";

const WALL = "#ECEEE9";
const STRIPE = "#1C6B4C";

/** The shop itself: floor, walls with the shop's green band, ceiling lights, the entrance and the checkout counters */
export function Room() {
  const floor = useMemo(() => {
    const t = floorTexture();
    t.repeat.set((ROOM.maxX - ROOM.minX) / 2.4, (ROOM.maxZ - ROOM.minZ) / 2.4);
    return t;
  }, []);
  const w = ROOM.maxX - ROOM.minX;
  const d = ROOM.maxZ - ROOM.minZ;
  const h = ROOM.height;
  const lights = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = ROOM.minX + 2.5; x < ROOM.maxX - 1; x += 3.5) for (let z = ROOM.minZ + 2; z < ROOM.maxZ - 1; z += 3) out.push([x, z]);
    return out;
  }, []);

  // The front wall, with a gap for the entrance
  const front = [
    { from: ROOM.minX, to: ENTRANCE.minX },
    { from: ENTRANCE.maxX, to: ROOM.maxX },
  ];

  return (
    <group>
      {/* Soft fill, and one key light from the ceiling that casts the shadows (on desktop) */}
      <hemisphereLight args={["#ffffff", "#d9d5cb", 0.55]} />
      <directionalLight
        position={[3, 12, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.3} />

      {/* A low-gloss vinyl floor that catches the ceiling lights */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floor} roughness={0.32} metalness={0} envMapIntensity={0.8} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={h}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#EEF0EC" />
      </mesh>
      {lights.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, h - 0.03, z]}>
          <boxGeometry args={[1.4, 0.04, 0.32]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* back, left and right walls */}
      <Wall x={0} z={ROOM.minZ} length={w} rot={0} />
      <Wall x={ROOM.minX} z={0} length={d} rot={Math.PI / 2} />
      <Wall x={ROOM.maxX} z={0} length={d} rot={-Math.PI / 2} />
      {front.map((s) => (
        <Wall key={s.from} x={(s.from + s.to) / 2} z={ROOM.maxZ} length={s.to - s.from} rot={Math.PI} />
      ))}
      {/* the entrance: open glass doors */}
      <mesh position={[(ENTRANCE.minX + ENTRANCE.maxX) / 2, h - 0.4, ROOM.maxZ]}>
        <boxGeometry args={[ENTRANCE.maxX - ENTRANCE.minX, 0.8, 0.12]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(ENTRANCE.minX + ENTRANCE.maxX) / 2 + side * 1.55, (h - 0.8) / 2, ROOM.maxZ - 0.02]}>
          <boxGeometry args={[0.9, h - 0.8, 0.03]} />
          <meshStandardMaterial color="#cfe6ee" transparent opacity={0.28} />
        </mesh>
      ))}

      {CHECKOUTS.map((c) => (
        <group key={c.x} position={[c.x, 0, c.z]}>
          <mesh position-y={0.42}>
            <boxGeometry args={[c.depth, 0.84, c.length]} />
            <meshStandardMaterial color="#5D656D" roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.85, -0.2]}>
            <boxGeometry args={[c.depth - 0.2, 0.03, c.length - 0.7]} />
            <meshStandardMaterial color="#1E2226" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.02, c.length / 2 - 0.3]}>
            <boxGeometry args={[0.36, 0.3, 0.3]} />
            <meshStandardMaterial color="#E9ECEF" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Wall({ x, z, length, rot }: { x: number; z: number; length: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <mesh position-y={ROOM.height / 2}>
        <planeGeometry args={[length, ROOM.height]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[0, 2.75, 0.01]}>
        <planeGeometry args={[length, 0.22]} />
        <meshStandardMaterial color={STRIPE} />
      </mesh>
      <mesh position={[0, 0.06, 0.01]}>
        <planeGeometry args={[length, 0.12]} />
        <meshStandardMaterial color="#C9CDC6" />
      </mesh>
    </group>
  );
}
