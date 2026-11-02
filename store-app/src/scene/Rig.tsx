import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { EYE, OBSTACLES, PATH, PATH_LENGTH, ROOM, STOPS, STOP_U, type StopId } from "../data/layout";
import { pad, useStore } from "../state";

// Moves the camera. Guided: along the path through every aisle, turning to face
// each aisle as you reach it; arrow keys, the wheel, the buttons or the aisle list
// pick the stop, and dragging looks around. Free walk: WASD or the arrow keys
// (or the on-screen pad), dragging to look, and the shelves stop you.

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clampU = (u: number) => Math.min(STOP_U[STOP_U.length - 1], Math.max(STOP_U[0], u));
const nearestStop = (u: number) => STOP_U.reduce((best, s, i) => (Math.abs(s - u) < Math.abs(STOP_U[best] - u) ? i : best), 0);
const OWN_KEYS = "input, textarea, select, [data-own-keys]";

/** The point on the path closest to a spot on the floor, as a distance along it (0 to 1) */
function nearestU(x: number, z: number) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 600; i++) {
    const p = PATH.getPointAt(i / 600);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i / 600;
    }
  }
  return best;
}

export function Rig() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const u = useRef(STOP_U[0]);
  const uTarget = useRef(STOP_U[0]);
  const offset = useRef({ yaw: 0, pitch: 0 });
  const walker = useRef({ x: 0, z: 0, yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());
  const here = useRef<StopId | null>("entrance");
  const tmp = useRef({ dir: new Vector3(), toStop: new Vector3(), tangent: new Vector3() });

  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);
  // A portrait phone sees wider, so an aisle is not cropped to a sliver
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = aspect < 1 ? 76 : 62;
    cam.updateProjectionMatrix();
  }, [camera, aspect]);

  // A new stop: head for it and look ahead again
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.stop !== prev.stop) {
          uTarget.current = STOP_U[s.stop];
          offset.current = { yaw: 0, pitch: 0 };
        }
        if (s.mode !== prev.mode) {
          if (s.mode === "free") {
            walker.current = { x: camera.position.x, z: camera.position.z, yaw: camera.rotation.y, pitch: camera.rotation.x };
          } else {
            // Back on the path: from the nearest point on it to the nearest stop
            u.current = nearestU(camera.position.x, camera.position.z);
            const i = nearestStop(u.current);
            uTarget.current = STOP_U[i];
            offset.current = { yaw: 0, pitch: 0 };
            useStore.setState({ stop: i });
          }
        }
      }),
    [camera],
  );

  useEffect(() => {
    let idle = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { mode, goTo } = useStore.getState();
      if (mode === "free") {
        const w = walker.current;
        // Scrolling down walks forward, as it moves along the path when guided
        move(w, -Math.sin(w.yaw) * e.deltaY * 0.004, -Math.cos(w.yaw) * e.deltaY * 0.004);
        return;
      }
      uTarget.current = clampU(uTarget.current + (e.deltaY * 0.006) / PATH_LENGTH);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        const i = nearestStop(uTarget.current);
        uTarget.current = STOP_U[i];
        goTo(i);
      }, 450);
    };
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => (drag = { x: e.clientX, y: e.clientY });
    const up = () => (drag = null);
    const moveLook = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      const look = useStore.getState().mode === "free" ? walker.current : offset.current;
      look.yaw += dx * 0.005;
      look.pitch = Math.max(-0.7, Math.min(0.6, look.pitch + dy * 0.004));
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.(OWN_KEYS) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { mode, step, goTo } = useStore.getState();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (mode === "free") {
        if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
          e.preventDefault();
          keys.current.add(k);
        }
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", "d", "s"].includes(k)) step(1);
      else if (["ArrowLeft", "ArrowUp", "PageUp", "a", "w"].includes(k)) step(-1);
      else if (k === "Home") goTo(0);
      else if (k === "End") goTo(STOPS.length - 1);
      else return;
      e.preventDefault();
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const blur = () => keys.current.clear();
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", moveLook);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.clearTimeout(idle);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", moveLook);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [dom]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { mode, reducedMotion, arrive } = useStore.getState();
    let now: StopId | null = null;
    const { dir, toStop, tangent } = tmp.current;

    if (mode === "guided") {
      const before = u.current;
      u.current += (uTarget.current - u.current) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 2.2));
      const moving = Math.abs(u.current - before) > 1e-5;
      if (moving) {
        offset.current.yaw *= Math.exp(-dt * 3);
        offset.current.pitch *= Math.exp(-dt * 3);
      }
      const pos = PATH.getPointAt(u.current);
      tangent.copy(PATH.getTangentAt(u.current)).setY(-0.08).normalize();
      const i = nearestStop(u.current);
      const metres = Math.abs(STOP_U[i] - u.current) * PATH_LENGTH;
      const s = STOPS[i];
      toStop.set(s.look[0] - pos.x, s.look[1] - pos.y, s.look[2] - pos.z).normalize();
      dir.copy(tangent).lerp(toStop, 1 - smooth(0.5, 2.4, metres)).normalize();
      camera.position.copy(pos);
      camera.rotation.set(Math.asin(dir.y) + offset.current.pitch, Math.atan2(-dir.x, -dir.z) + offset.current.yaw, 0);
      if (metres < 0.5) now = s.id;
    } else {
      const w = walker.current;
      const k = keys.current;
      const forward = (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0) + pad.forward;
      const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const turn = (k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0) + pad.turn;
      w.yaw -= turn * dt * 1.7;
      const speed = 2.4 * dt;
      move(w, (-Math.sin(w.yaw) * forward + Math.cos(w.yaw) * strafe) * speed, (-Math.cos(w.yaw) * forward - Math.sin(w.yaw) * strafe) * speed);
      camera.position.set(w.x, EYE, w.z);
      camera.rotation.set(w.pitch, w.yaw, 0);
      // In front of an aisle when close to where the guided walk stops for it
      let best = 1.7;
      for (const s of STOPS) {
        const d = Math.hypot(s.x - w.x, s.z - w.z);
        if (d < best) {
          best = d;
          now = s.id;
        }
      }
    }

    if (now !== here.current) {
      here.current = now;
      arrive(now);
    }
  });

  return null;
}

/** Walks by (dx, dz), sliding along shelves and walls instead of through them */
function move(w: { x: number; z: number }, dx: number, dz: number) {
  const r = 0.35;
  w.x = Math.min(ROOM.maxX - r, Math.max(ROOM.minX + r, w.x + dx));
  w.z = Math.min(ROOM.maxZ - r, Math.max(ROOM.minZ + r, w.z + dz));
  for (const o of OBSTACLES) {
    const minX = o.minX - r;
    const maxX = o.maxX + r;
    const minZ = o.minZ - r;
    const maxZ = o.maxZ + r;
    if (w.x > minX && w.x < maxX && w.z > minZ && w.z < maxZ) {
      const push = [w.x - minX, maxX - w.x, w.z - minZ, maxZ - w.z];
      const least = Math.min(...push);
      if (least === push[0]) w.x = minX;
      else if (least === push[1]) w.x = maxX;
      else if (least === push[2]) w.z = minZ;
      else w.z = maxZ;
    }
  }
}
