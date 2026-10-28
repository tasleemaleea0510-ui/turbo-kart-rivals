import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { N, WALL, leftAt, S, T, trackLength } from "./track";

function wallGeo(offset: number, h: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const p = S(i);
    const l = leftAt(i % N);
    const x = p.x + l.x * offset, z = p.z + l.z * offset;
    const v = (i / N) * (trackLength / 4);
    pos.push(x, 0, z, x, h, z);
    uv.push(v, 0, v, 1);
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Barriers() {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 32;
    const c = cv.getContext("2d")!;
    const cols = ["#ff3b3b", "#ffffff", "#2f7bff", "#ffffff"];
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(i * 32, 0, 32, 32);
    });
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.fillRect(0, 26, 128, 6);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }, []);
  const geos = useMemo(() => [wallGeo(WALL, 1.3), wallGeo(-WALL, 1.3)], []);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

const FLAG_COLORS = ["#ff3b3b", "#ffd23b", "#2f7bff", "#3bd16f", "#ff7ad9", "#ff9a2e"];

function Flags() {
  const flags = useMemo(
    () =>
      Array.from({ length: 28 }, (_, n) => {
        const i = Math.floor((n / 28) * N);
        const side = n % 2 ? 1 : -1;
        const p = S(i);
        const l = leftAt(i);
        const o = (WALL + 1.2) * side;
        return { x: p.x + l.x * o, z: p.z + l.z * o, ry: Math.atan2(T(i).x, T(i).z), c: FLAG_COLORS[n % FLAG_COLORS.length]! };
      }),
    [],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (m) m.rotation.y = Math.sin(clock.elapsedTime * 3 + i) * 0.35;
    });
  });
  return (
    <>
      {flags.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]} rotation-y={f.ry}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 5, 6]} />
            <meshStandardMaterial color="#f2f2f2" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh ref={(m) => { refs.current[i] = m; }} position={[0, 4.4, 0]}>
            <group />
            <boxGeometry args={[0.05, 0.9, 1.5]} />
            <meshStandardMaterial color={f.c} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Balloons() {
  const g = useRef<THREE.Group>(null);
  const items = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        x: Math.cos(i * 0.63) * (90 + (i % 3) * 30) + 10,
        z: Math.sin(i * 0.63) * (90 + (i % 3) * 30) + 70,
        y: 25 + (i % 4) * 8,
        c: FLAG_COLORS[i % FLAG_COLORS.length]!,
      })),
    [],
  );
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      c.position.y = items[i]!.y + Math.sin(clock.elapsedTime * 0.6 + i) * 2;
    });
  });
  return (
    <group ref={g}>
      {items.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]}>
          <mesh scale={[1, 1.2, 1]}>
            <sphereGeometry args={[3, 16, 12]} />
            <meshStandardMaterial color={b.c} roughness={0.35} />
          </mesh>
          <mesh position={[0, -4.6, 0]}>
            <boxGeometry args={[1.4, 1, 1.4]} />
            <meshStandardMaterial color="#9a6a3a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Mountains() {
  const items = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const r = 260 + (i % 3) * 25;
        return { x: Math.cos(a) * r + 10, z: Math.sin(a) * r + 70, h: 50 + ((i * 37) % 45), w: 40 + ((i * 13) % 25) };
      }),
    [],
  );
  return (
    <>
      {items.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position={[0, m.h / 2, 0]}>
            <coneGeometry args={[m.w, m.h, 7]} />
            <meshStandardMaterial color={i % 2 ? "#4fae6a" : "#3f9a73"} flatShading />
          </mesh>
          <mesh position={[0, m.h * 0.86, 0]}>
            <coneGeometry args={[m.w * 0.28, m.h * 0.28, 7]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Clouds() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (g.current) g.current.rotation.y += d * 0.004;
  });
  const items = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, r: 150 + (i % 4) * 40, y: 60 + (i % 3) * 12 })),
    [],
  );
  return (
    <group ref={g} position={[10, 0, 70]}>
      {items.map((c, i) => (
        <group key={i} position={[Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[k * 6 - 6, k === 1 ? 2 : 0, 0]}>
              <icosahedronGeometry args={[k === 1 ? 7 : 5, 1]} />
              <meshStandardMaterial color="#ffffff" flatShading emissive="#ffffff" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Scenery() {
  return (
    <>
      <Flags />
      <Balloons />
      <Mountains />
      <Clouds />
    </>
  );
}
