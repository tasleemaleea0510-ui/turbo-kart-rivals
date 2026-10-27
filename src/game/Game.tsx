import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import { Track } from "./Track";
import { Player } from "./Player";
import { Remotes } from "./Remotes";
import { Net } from "./Net";
import { Hud } from "./Hud";
import { game } from "./store";
import { initAudio } from "./audio";

export function Game({ room }: { room: string }) {
  const localRef = useRef({ x: 0, y: 0, z: 0, ry: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      initAudio();
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      game.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => game.keys.delete(e.code);
    const blur = () => game.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-sky">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 6, -10], fov: 62, near: 0.1, far: 700 }} onCreated={() => setReady(true)}>
        <fog attach="fog" args={["#bfe3f5", 80, 320]} />
        <Sky sunPosition={[80, 60, 40]} turbidity={4} rayleigh={0.8} />
        <hemisphereLight args={["#dff3ff", "#6cb04a", 0.6]} />
        <directionalLight
          position={[60, 80, 30]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
          shadow-camera-far={400}
          shadow-bias={-0.0005}
        />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#9cd3ff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Track />
          <Player localRef={localRef} />
          <Remotes />
        </Suspense>
        <Net room={room} localRef={localRef} />
      </Canvas>
      {ready && <Hud room={room} />}
    </div>
  );
}
