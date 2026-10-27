import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { supabase } from "@/integrations/supabase/client";
import { beginCountdown, game, playerId, type RemoteState } from "./store";

const NET_TICK = 1 / 8;

/** Owns the single realtime channel for the room. Mount once inside the Canvas. */
export function Net({
  room,
  localRef,
}: {
  room: string;
  localRef: React.MutableRefObject<{ x: number; y: number; z: number; ry: number }>;
}) {
  const acc = useRef(0);
  const last = useRef({ x: 0, z: 0, ry: 0, p: 0, f: 0, at: -10 });

  useEffect(() => {
    const channel = supabase.channel(`kart:${room}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        const s = payload as RemoteState;
        if (s.id === playerId) return;
        if (!game.roster.some((r) => r.id === s.id)) return;
        game.remotes.set(s.id, { ...s, at: performance.now() });
      })
      .on("broadcast", { event: "start" }, () => beginCountdown())
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState<{ name: string; kart: string }>();
        game.roster = Object.entries(st)
          .filter(([id]) => id !== playerId)
          .map(([id, metas]) => ({
            id,
            name: metas[0]?.name ?? "Racer",
            kart: metas[0]?.kart ?? "oobi",
          }));
        for (const id of [...game.remotes.keys()])
          if (!game.roster.some((r) => r.id === id)) game.remotes.delete(id);
      })
      .subscribe((status) => {
        console.log("[net] channel:", status);
        if (status === "SUBSCRIBED") channel.track({ name: game.name, kart: game.kart });
      });

    game.send = (event, payload) => {
      channel.send({ type: "broadcast", event, payload });
    };
    return () => {
      game.send = () => {};
      game.roster = [];
      game.remotes.clear();
      supabase.removeChannel(channel);
    };
  }, [room]);

  useFrame(({ clock }, raw) => {
    acc.current += Math.min(raw, 0.05);
    if (acc.current < NET_TICK) return;
    acc.current = 0;
    if (document.hidden) return;
    const s = localRef.current;
    const q = (n: number) => Math.round(n * 100) / 100;
    const x = q(s.x), z = q(s.z), ry = q(s.ry), p = q(game.progress), f = game.finishTime;
    const l = last.current;
    const moved = Math.abs(x - l.x) + Math.abs(z - l.z) + Math.abs(ry - l.ry) > 0.01 || p !== l.p || f !== l.f;
    if (!moved && clock.elapsedTime - l.at < 1) return;
    last.current = { x, z, ry, p, f, at: clock.elapsedTime };
    game.send("state", {
      id: playerId, name: game.name, kart: game.kart, x, y: q(s.y), z, ry, p, f,
    });
  });

  return null;
}
