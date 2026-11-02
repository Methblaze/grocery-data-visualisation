import { useEffect, useMemo } from "react";
import { animated, useSpring } from "@react-spring/three";
import { BoxGeometry } from "three";
import { CHECKOUT, MAX_AISLE, MAX_PERSON_AISLE, SPENT, colourOf, kr, aisleName, type ShopperId } from "../data/receipts";
import { CHECKOUT_SCREEN, FIXTURES, type Fixture } from "../data/layout";
import { useStore } from "../state";
import { FONT, canvasTexture } from "./canvasTexture";

const INK = "#15181B";
const MUTED = "#5F6673";

/** One sign per aisle, and the screen above the checkout */
export function Signs() {
  return (
    <group>
      {FIXTURES.map((f) => (
        <AisleSign key={f.aisle} f={f} />
      ))}
      <CheckoutScreen />
    </group>
  );
}

/** How much of the bar a shopper's spend fills: one scale for all five people, another for everyone together */
// A unit box grown from its left end, so scaling x fills the bar from the left
const BAR = new BoxGeometry(1, 0.1, 0.13).translate(0.5, 0, 0);

const share = (shopper: ShopperId, value: number) => value / (shopper === "Everyone" ? MAX_AISLE : MAX_PERSON_AISLE);

function AisleSign({ f }: { f: Fixture }) {
  const shopper = useStore((s) => s.shopper);
  const reduced = useStore((s) => s.reducedMotion);
  const value = SPENT[shopper][f.aisle];
  const colour = colourOf(shopper);
  const tall = f.height > 1.5;
  // Over a low fixture the sign hangs higher and at the back, clear of your view of the products
  const boardY = tall ? f.height + 0.62 : 2.4;
  const boardZ = tall ? f.depth / 2 - 0.1 : -f.depth / 2 + 0.05;
  const barY = tall ? f.height + 0.14 : f.height + 0.12;
  const sign = useMemo(() => canvasTexture(1024, 256, () => {}), []);

  useEffect(() => {
    sign.redraw((ctx, w, h) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 28);
      ctx.fill();
      ctx.fillStyle = colour;
      ctx.fillRect(4, h - 26, w - 8, 22);
      ctx.fillStyle = INK;
      ctx.font = `600 78px ${FONT}`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(aisleName(f.aisle), 44, 112);
      ctx.font = `500 58px ${FONT}`;
      ctx.fillStyle = MUTED;
      const who = shopper === "Everyone" ? "Everyone" : shopper;
      ctx.fillText(`${who}: ${kr(value)}`, 44, 196);
    });
  }, [sign, shopper, value, colour, f.aisle]);

  const length = f.length * 0.92;
  const { fill } = useSpring({ fill: Math.max(0.002, share(shopper, value)), immediate: reduced, config: { tension: 110, friction: 20 } });

  return (
    <group position={[f.x, 0, f.z]} rotation-y={f.rot}>
      <mesh position={[0, boardY, boardZ]}>
        <planeGeometry args={[1.9, 0.475]} />
        <meshBasicMaterial map={sign.texture} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, (boardY + f.height) / 2 + 0.1, boardZ - 0.02]}>
        <boxGeometry args={[0.02, boardY - f.height - 0.2, 0.02]} />
        <meshStandardMaterial color="#B8BEB6" />
      </mesh>
      {/* The stock bar: filled as far as this shopper's spend in the aisle reaches */}
      <mesh position={[0, barY, 0]}>
        <boxGeometry args={[length, 0.09, 0.12]} />
        <meshStandardMaterial color="#DFE3DD" />
      </mesh>
      <animated.mesh geometry={BAR} position={[-length / 2, barY + 0.005, 0]} scale-x={fill.to((v) => v * length)}>
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.25} />
      </animated.mesh>
    </group>
  );
}

function CheckoutScreen() {
  const shopper = useStore((s) => s.shopper);
  const screen = useMemo(() => canvasTexture(1400, 500, () => {}), []);
  useEffect(() => {
    const { paid, saved } = CHECKOUT[shopper];
    screen.redraw((ctx, w, h) => {
      ctx.fillStyle = "#14261E";
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 36);
      ctx.fill();
      ctx.fillStyle = colourOf(shopper);
      ctx.fillRect(0, h - 30, w, 30);
      ctx.fillStyle = "#E8F1EC";
      ctx.font = `500 64px ${FONT}`;
      ctx.fillText(shopper === "Everyone" ? "Checkout, all five shoppers" : `Checkout, ${shopper}`, 70, 120);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 150px ${FONT}`;
      ctx.fillText(kr(paid), 70, 290);
      ctx.fillStyle = "#BFD7CA";
      ctx.font = `500 64px ${FONT}`;
      ctx.fillText(`Saved ${kr(saved)} in discounts`, 70, 400);
    });
  }, [screen, shopper]);
  return (
    <mesh position={[CHECKOUT_SCREEN.x, CHECKOUT_SCREEN.y, CHECKOUT_SCREEN.z]} rotation-y={Math.PI}>
      <planeGeometry args={[3.08, 1.1]} />
      <meshBasicMaterial map={screen.texture} transparent toneMapped={false} />
    </mesh>
  );
}
