import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KARTS, game } from "@/game/store";
import kartArt from "@/assets/kart-hero.jpg";

const Game = lazy(() => import("@/game/Game").then((m) => ({ default: m.Game })));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Turbo Kart — Online Kart Racing" },
      { name: "description", content: "Race your friends online in a colorful 3D kart racer with drifts, boosts and item boxes." },
      { property: "og:title", content: "Turbo Kart — Online Kart Racing" },
      { property: "og:description", content: "Share a room link and race friends in 3D. Drift, boost, win." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const KART_COLORS: Record<string, string> = {
  oobi: "kart-swatch-1", oodi: "kart-swatch-2", ooli: "kart-swatch-3", oopi: "kart-swatch-4", oozi: "kart-swatch-5",
};

function Index() {
  const [room, setRoom] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kart, setKart] = useState("oobi");
  const [code, setCode] = useState("");

  useEffect(() => {
    const r = new URL(window.location.href).searchParams.get("room");
    if (r) setCode(r.toUpperCase());
    setName(localStorage.getItem("kart-name") ?? "");
    setKart(localStorage.getItem("kart-kart") ?? "oobi");
  }, []);

  const go = (c: string) => {
    const nm = name.trim().slice(0, 14) || `Racer${Math.floor(Math.random() * 90 + 10)}`;
    localStorage.setItem("kart-name", nm);
    localStorage.setItem("kart-kart", kart);
    game.name = nm;
    game.kart = kart;
    game.phase = "grid";
    const url = new URL(window.location.href);
    url.searchParams.set("room", c);
    window.history.replaceState(null, "", url);
    setRoom(c);
  };

  if (room)
    return (
      <Suspense fallback={<div className="loading-screen">Warming up engines…</div>}>
        <Game room={room} />
      </Suspense>
    );

  return (
    <main className="lobby">
      <img src={kartArt} alt="" className="lobby-bg" />
      <div className="lobby-card">
        <h1 className="lobby-title">Turbo Kart</h1>
        <p className="text-muted-foreground">Race your friends online. Drift, boost, grab items — first to finish 3 laps wins.</p>

        <label className="mt-5 block text-sm font-bold">Your name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={14} placeholder="Speedy" className="mt-1" />

        <label className="mt-4 block text-sm font-bold">Pick your kart</label>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {KARTS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKart(k.id)}
              className={`kart-pick ${kart === k.id ? "kart-pick-on" : ""}`}
            >
              <span className={`kart-swatch ${KART_COLORS[k.id]}`} />
              <span className="text-xs font-bold">{k.label}</span>
            </button>
          ))}
        </div>

        <Button variant="race" size="lg" className="mt-6 w-full" onClick={() => go(Math.random().toString(36).slice(2, 6).toUpperCase())}>
          Create a race
        </Button>
        <div className="mt-3 flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Room code" maxLength={6} />
          <Button variant="outline" size="lg" disabled={code.length < 3} onClick={() => go(code)}>Join</Button>
        </div>
      </div>
    </main>
  );
}
