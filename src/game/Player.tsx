import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { KartModel, newRig } from "./KartModel";
import { BOOST_PADS, ITEM_BOXES, boxCooldown } from "./Track";
import { LAPS, N, ROAD_W, gridSlot, lapProgress, nearest, S, yawAt } from "./track";
import { game } from "./store";
import { beep, setEngine } from "./audio";

// Feel constants
const MAX = 26;
const OFF_MAX = 11;
const BOOST_ADD = 12;
const ACCEL = 20;
const BRAKE = 38;
const TURN = 2.1;
const DRIFT_SLIP = 0.32;
const CAM_DIST = 7.5;
const CAM_H = 3.2;

const tmp = new THREE.Vector3();
const look = new THREE.Vector3();

export function Player({ localRef }: { localRef: React.MutableRefObject<{ x: number; y: number; z: number; ry: number }> }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef(newRig());
  const { camera } = useThree();
  const st = useRef({
    x: 0, z: 0, ry: 0, speed: 0, idx: N - 6, half: true,
    driftDir: 0, driftCharge: 0, driftHeld: false, hopT: 0, boost: 0,
    itemHeld: false, token: -1, lastBeep: 4, camYaw: 0,
  });

  const reset = () => {
    const g = gridSlot(game.slot);
    const s = st.current;
    Object.assign(s, { x: g.x, z: g.z, ry: g.ry, speed: 0, idx: g.idx, half: true, driftDir: 0, driftCharge: 0, boost: 0, camYaw: g.ry });
    game.lap = 0;
    game.progress = lapProgress(0, g.idx);
    const fx = g.x - Math.sin(g.ry) * CAM_DIST;
    const fz = g.z - Math.cos(g.ry) * CAM_DIST;
    camera.position.set(fx, CAM_H + 1, fz);
  };

  useEffect(() => {
    reset();
    st.current.token = game.resetToken;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = st.current;
    if (s.token !== game.resetToken) {
      s.token = game.resetToken;
      s.lastBeep = 4;
      reset();
    }
    const now = performance.now();
    const k = game.keys;

    // Countdown → race
    if (game.phase === "countdown") {
      const left = Math.ceil((game.countdownEnd - now) / 1000);
      if (left !== s.lastBeep && left <= 3 && left >= 1) {
        s.lastBeep = left;
        beep(440, 0.18);
      }
      if (now >= game.countdownEnd) {
        game.phase = "racing";
        game.raceStart = now;
        beep(880, 0.4);
      }
    }
    const canDrive = game.phase === "racing" || game.phase === "grid";
    const finished = game.phase === "finished";

    const up = canDrive && (k.has("ArrowUp") || k.has("KeyW"));
    const down = canDrive && (k.has("ArrowDown") || k.has("KeyS"));
    const steer = (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0) - (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0);
    const driftKey = canDrive && (k.has("Space") || k.has("ShiftLeft"));
    const itemKey = canDrive && (k.has("KeyE") || k.has("KeyX") || k.has("Enter"));

    const near = nearest(s.x, s.z, s.idx);
    const off = near.d > ROAD_W + 1.3;
    game.offroad = off;
    const max = (off && s.boost <= 0 ? OFF_MAX : MAX) + (s.boost > 0 ? BOOST_ADD : 0);

    if (up) s.speed += ACCEL * dt * (s.speed < 8 ? 1.4 : 1);
    else if (down) s.speed -= (s.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
    else s.speed *= Math.exp(-(finished ? 1.5 : 0.9) * dt);
    if (s.boost > 0) {
      s.speed = Math.max(s.speed, max);
      s.boost -= dt;
    }
    if (s.speed > max) s.speed += (max - s.speed) * (1 - Math.exp(-3 * dt));
    s.speed = Math.max(s.speed, -9);

    // Drift: press while steering at speed → hop + slide; release to boost
    if (driftKey && !s.driftHeld) {
      s.hopT = 0.28;
      if (steer !== 0 && s.speed > 10) s.driftDir = steer;
    }
    if (driftKey && s.driftDir === 0 && s.hopT > 0 && steer !== 0 && s.speed > 10) s.driftDir = steer;
    if (!driftKey && s.driftHeld && s.driftDir !== 0) {
      const lvl = s.driftCharge > 2.4 ? 2 : s.driftCharge > 1.1 ? 1 : 0;
      if (lvl) {
        s.boost = Math.max(s.boost, lvl === 2 ? 1.3 : 0.7);
        beep(lvl === 2 ? 660 : 520, 0.2, "sawtooth", 0.08);
      }
      s.driftDir = 0;
      s.driftCharge = 0;
    }
    if (s.speed < 6) {
      s.driftDir = 0;
      s.driftCharge = 0;
    }
    s.driftHeld = driftKey;

    let turn: number;
    if (s.driftDir !== 0) {
      turn = s.driftDir * (0.75 + 0.55 * steer * s.driftDir) * TURN;
      s.driftCharge += dt * (0.8 + Math.max(0, steer * s.driftDir));
    } else {
      turn = steer * TURN * Math.min(1, Math.abs(s.speed) / 7) * Math.sign(s.speed || 1);
      turn *= 1 - Math.min(0.35, Math.abs(s.speed) / 90);
    }
    s.ry += turn * dt;

    const moveYaw = s.ry - s.driftDir * DRIFT_SLIP;
    s.x += Math.sin(moveYaw) * s.speed * dt;
    s.z += Math.cos(moveYaw) * s.speed * dt;

    // Invisible walls far off track
    const n2 = nearest(s.x, s.z, near.i);
    if (n2.d > ROAD_W + 7) {
      const p = S(n2.i);
      const f = (ROAD_W + 7) / n2.d;
      s.x = p.x + (s.x - p.x) * f;
      s.z = p.z + (s.z - p.z) * f;
      s.speed *= Math.exp(-4 * dt);
    }

    // Bump other karts
    for (const r of game.remotes.values()) {
      const dx = s.x - r.x, dz = s.z - r.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 2) {
        const push = (2 - d) * 0.5;
        s.x += (dx / d) * push;
        s.z += (dz / d) * push;
        s.speed *= 0.97;
      }
    }

    // Boost pads + item boxes
    for (const b of BOOST_PADS) {
      if ((b.pos.x - s.x) ** 2 + (b.pos.z - s.z) ** 2 < 6) {
        if (s.boost < 0.5) beep(700, 0.12, "triangle", 0.08);
        s.boost = Math.max(s.boost, 1.1);
      }
    }
    ITEM_BOXES.forEach((b, i) => {
      if (boxCooldown[i] > now) return;
      if ((b.x - s.x) ** 2 + (b.z - s.z) ** 2 < 3.6) {
        boxCooldown[i] = now + 3000;
        if (!game.item) {
          game.item = "boost";
          beep(990, 0.1, "square", 0.08);
        }
      }
    });
    if (itemKey && !s.itemHeld && game.item) {
      game.item = null;
      s.boost = Math.max(s.boost, 1.6);
      beep(330, 0.3, "sawtooth", 0.1);
    }
    s.itemHeld = itemKey;

    // Laps
    const prev = s.idx;
    s.idx = n2.i;
    if (s.idx > N * 0.45 && s.idx < N * 0.6) s.half = true;
    if (prev > N * 0.8 && s.idx < N * 0.2 && s.half && game.phase !== "finished") {
      s.half = false;
      game.lap += 1;
      if (game.lap > 1 && game.lap <= LAPS) beep(760, 0.15, "triangle");
      if (game.lap > LAPS && game.phase === "racing") {
        game.phase = "finished";
        game.finishTime = Math.round(now - game.raceStart);
        beep(1046, 0.6, "triangle", 0.12);
      }
    } else if (prev < N * 0.2 && s.idx > N * 0.8) {
      // crossed backwards
      game.lap = Math.max(0, game.lap - 1);
      s.half = true;
    }
    game.progress = lapProgress(game.lap, s.idx);
    game.speed = s.speed;
    game.boost = s.boost;
    game.driftLevel = s.driftDir ? (s.driftCharge > 2.4 ? 2 : s.driftCharge > 1.1 ? 1 : 0) : 0;

    // Hop
    s.hopT = Math.max(0, s.hopT - dt);
    const hop = s.hopT > 0 ? Math.sin((s.hopT / 0.28) * Math.PI) * 0.6 : 0;

    // Apply transform + rig
    const g = group.current;
    if (g) {
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.ry;
    }
    const r = rig.current;
    r.speed = s.speed;
    r.steer += (steer - r.steer) * (1 - Math.exp(-10 * dt));
    r.drift += (s.driftDir - r.drift) * (1 - Math.exp(-10 * dt));
    r.driftLevel = game.driftLevel;
    r.boost = s.boost;
    r.hop = hop;
    localRef.current.x = s.x;
    localRef.current.z = s.z;
    localRef.current.y = hop;
    localRef.current.ry = s.ry;

    // Chase camera — lags yaw for a swingy feel, FOV kick on boost
    let dy = s.ry - s.camYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.camYaw += dy * (1 - Math.exp(-4.5 * dt));
    const back = s.speed < -2 ? -1 : 1;
    tmp.set(s.x - Math.sin(s.camYaw) * CAM_DIST * back, CAM_H, s.z - Math.cos(s.camYaw) * CAM_DIST * back);
    camera.position.lerp(tmp, 1 - Math.exp(-8 * dt));
    look.set(s.x + Math.sin(s.ry) * 3, 1.2, s.z + Math.cos(s.ry) * 3);
    camera.lookAt(look);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = 62 + Math.min(1, Math.abs(s.speed) / MAX) * 8 + (s.boost > 0 ? 10 : 0);
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-5 * dt));
    cam.updateProjectionMatrix();

    setEngine(Math.min(1, Math.abs(s.speed) / (MAX + BOOST_ADD)), s.boost > 0);
  });

  return (
    <group ref={group}>
      <KartModel kind={game.kart} rig={rig} />
    </group>
  );
}
