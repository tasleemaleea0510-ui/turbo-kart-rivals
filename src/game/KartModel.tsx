import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type Rig = {
  speed: number; // m/s signed
  steer: number; // -1..1 (left positive)
  drift: number; // -1,0,1
  driftLevel: number; // 0 none, 1 blue, 2 orange
  boost: number; // seconds remaining
  hop: number; // 0..1 hop height
};

export const newRig = (): Rig => ({ speed: 0, steer: 0, drift: 0, driftLevel: 0, boost: 0, hop: 0 });

const SPARK_COLORS = ["#ffffff", "#5ad1ff", "#ff9a2e"];

export function KartModel({ kind, rig }: { kind: string; rig: React.MutableRefObject<Rig> }) {
  const { scene } = useGLTF(`/models/kart-${kind}.glb`);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    return c;
  }, [scene]);
  const parts = useMemo(() => {
    const get = (n: string) => obj.getObjectByName(n) ?? null;
    const w = [get("wheel-front-left"), get("wheel-front-right"), get("wheel-back-left"), get("wheel-back-right")];
    w.forEach((o) => o && (o.rotation.order = "YXZ"));
    return { wheels: w, character: get("character") };
  }, [obj]);

  const body = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  const sparkL = useRef<THREE.Mesh>(null);
  const sparkR = useRef<THREE.Mesh>(null);
  const spin = useRef(0);
  const steerVis = useRef(0);
  const lean = useRef(0);
  const pitch = useRef(0);
  const lastSpeed = useRef(0);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const r = rig.current;
    const t = clock.elapsedTime;
    const sp01 = Math.min(1, Math.abs(r.speed) / 28);

    spin.current += (r.speed * dt) / 0.21;
    const k = 1 - Math.exp(-12 * dt);
    steerVis.current += (r.steer * 0.45 - steerVis.current) * k;
    parts.wheels.forEach((w, i) => {
      if (!w) return;
      w.rotation.x = spin.current;
      w.rotation.y = i < 2 ? steerVis.current : 0;
    });

    // Body lean into turns, extra on drift; pitch on accel/brake
    const accel = (r.speed - lastSpeed.current) / Math.max(dt, 1e-3);
    lastSpeed.current = r.speed;
    const leanTarget = -r.steer * 0.07 * sp01 - r.drift * 0.1;
    lean.current += (leanTarget - lean.current) * (1 - Math.exp(-8 * dt));
    const pitchTarget = THREE.MathUtils.clamp(-accel * 0.004, -0.08, 0.08);
    pitch.current += (pitchTarget - pitch.current) * (1 - Math.exp(-6 * dt));
    if (body.current) {
      body.current.rotation.z = lean.current;
      body.current.rotation.x = pitch.current;
      body.current.rotation.y = r.drift * 0.32;
      const rumble = Math.sin(t * 38) * 0.012 * sp01 + Math.sin(t * 9) * 0.006;
      body.current.position.y = r.hop * 0.6 + rumble;
      const squash = 1 - r.hop * 0.08;
      body.current.scale.set(1.6 / squash, 1.6 * squash, 1.6);
    }
    if (parts.character) {
      parts.character.rotation.z = -r.steer * 0.18 * sp01;
      parts.character.rotation.x = Math.sin(t * 6) * 0.03 * sp01;
    }

    // Drift sparks
    const showSpark = r.drift !== 0 && r.speed > 5;
    [sparkL.current, sparkR.current].forEach((s, i) => {
      if (!s) return;
      s.visible = showSpark;
      if (!showSpark) return;
      const m = s.material as THREE.MeshBasicMaterial;
      m.color.set(SPARK_COLORS[r.driftLevel]);
      const f = 0.6 + Math.abs(Math.sin(t * 40 + i * 2)) * 0.7 + r.driftLevel * 0.3;
      s.scale.setScalar(f);
      s.rotation.z = t * 25 * (i ? 1 : -1);
    });

    // Boost flame
    if (flame.current) {
      const on = r.boost > 0;
      flame.current.visible = on;
      if (on) {
        const f = 0.8 + Math.sin(t * 60) * 0.25;
        flame.current.scale.set(f, f, 1 + Math.sin(t * 45) * 0.4 + Math.min(r.boost, 1));
      }
    }
  });

  return (
    <group>
      <group ref={body} scale={1.6}>
        <primitive object={obj} />
        <group ref={flame} position={[0, 0.35, -0.68]} visible={false}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0, -0.25]}>
            <coneGeometry args={[0.16, 0.6, 10]} />
            <meshBasicMaterial color="#ffb02e" transparent opacity={0.9} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0, -0.18]}>
            <coneGeometry args={[0.09, 0.4, 10]} />
            <meshBasicMaterial color="#fff6c2" />
          </mesh>
        </group>
      </group>
      <mesh ref={sparkL} position={[0.5, 0.2, -0.6]} visible={false}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={sparkR} position={[-0.5, 0.2, -0.6]} visible={false}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

["oobi", "oodi", "ooli", "oopi", "oozi"].forEach((k) => useGLTF.preload(`/models/kart-${k}.glb`));
