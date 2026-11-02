import { Canvas } from "@react-three/fiber";
import { EYE, STOPS } from "../data/layout";
import { Room } from "./Room";
import { Fixtures } from "./Fixtures";
import { Products } from "./Products";
import { Signs } from "./Signs";
import { Rig } from "./Rig";
import { Basket } from "./Basket";

/** The 3D store, loaded on its own so the page and its numbers appear first */
export default function Scene() {
  const start = STOPS[0];
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 62, near: 0.05, far: 60, position: [start.x, EYE, start.z] }}
      flat
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => {}}
    >
      <color attach="background" args={["#F6F7F5"]} />
      <fog attach="fog" args={["#F6F7F5", 16, 34]} />
      <Room />
      <Fixtures />
      <Products />
      <Signs />
      <Basket />
      <Rig />
    </Canvas>
  );
}
