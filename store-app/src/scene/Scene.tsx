import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { NeutralToneMapping, PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EYE, STOPS } from "../data/layout";
import { Room } from "./Room";
import { Fixtures } from "./Fixtures";
import { Products } from "./Products";
import { Signs } from "./Signs";
import { Rig } from "./Rig";
import { Basket } from "./Basket";
import { Payment } from "./Payment";

/** The 3D store, loaded on its own so the page and its numbers appear first */
/** Reflections from three.js's built-in studio room, so glass, metal and packaging catch the light (nothing to download) */
function Reflections() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// Real-time shadows only where there is a mouse, a rough sign of a desktop GPU; phones get the contact shadows alone
const SHADOWS = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

export default function Scene() {
  const start = STOPS[0];
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 62, near: 0.05, far: 60, position: [start.x, EYE, start.z] }}
      shadows={SHADOWS ? "soft" : false}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: NeutralToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => {}}
    >
      <color attach="background" args={["#F6F7F5"]} />
      <fog attach="fog" args={["#F6F7F5", 16, 34]} />
      <Reflections />
      <Room />
      <Fixtures />
      <Products />
      <Signs />
      <Payment />
      <Basket />
      <Rig />
    </Canvas>
  );
}
