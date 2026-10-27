import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { KartModel, newRig } from "./KartModel";
import { game } from "./store";

function RemoteKart({ id, name, kart }: { id: string; name: string; kart: string }) {
  const g = useRef<THREE.Group>(null);
  const rig = useRef(newRig());
  const lastPos = useRef(new THREE.Vector3());
  const lastRy = useRef(0);
  const target = useRef(new THREE.Vector3());

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = game.remotes.get(id);
    const grp = g.current;
    if (!grp) return;
    if (!s) {
      grp.visible = false;
      return;
    }
    grp.visible = true;
    target.current.set(s.x, 0, s.z);
    const t = 1 - Math.exp(-11 * dt);
    if (grp.position.distanceTo(target.current) > 8) grp.position.copy(target.current);
    else grp.position.lerp(target.current, t);
    const dy = s.ry - grp.rotation.y;
    grp.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * t;

    // Derive animation from motion
    const moved = grp.position.distanceTo(lastPos.current);
    lastPos.current.copy(grp.position);
    const r = rig.current;
    const sp = moved / Math.max(dt, 1e-3);
    r.speed += (sp - r.speed) * (1 - Math.exp(-6 * dt));
    let yawRate = grp.rotation.y - lastRy.current;
    yawRate = Math.atan2(Math.sin(yawRate), Math.cos(yawRate)) / Math.max(dt, 1e-3);
    lastRy.current = grp.rotation.y;
    r.steer += (THREE.MathUtils.clamp(yawRate / 2, -1, 1) - r.steer) * (1 - Math.exp(-6 * dt));
    r.hop = s.y;
  });

  return (
    <group ref={g} visible={false}>
      <Suspense fallback={null}>
        <KartModel kind={kart} rig={rig} />
      </Suspense>
      <Html position={[0, 2.6, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <div className="kart-tag">{name}</div>
      </Html>
    </group>
  );
}

export function Remotes() {
  const [list, setList] = useState(game.roster);
  useEffect(() => {
    const iv = setInterval(() => {
      const key = game.roster.map((r) => r.id + r.kart + r.name).join();
      setList((l) => (l.map((r) => r.id + r.kart + r.name).join() === key ? l : [...game.roster]));
    }, 300);
    return () => clearInterval(iv);
  }, []);
  return (
    <>
      {list.map((r) => (
        <RemoteKart key={r.id} id={r.id} name={r.name} kart={r.kart} />
      ))}
    </>
  );
}
