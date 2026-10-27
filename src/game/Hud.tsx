import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LAPS } from "./track";
import { beginCountdown, formatTime, game, isHost, playerId, standings } from "./store";
import { initAudio } from "./audio";

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

function useTick(ms = 100) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function TouchBtn({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <button
      className={`touch-btn ${className ?? ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        initAudio();
        game.keys.add(code);
      }}
      onPointerUp={() => game.keys.delete(code)}
      onPointerLeave={() => game.keys.delete(code)}
      onPointerCancel={() => game.keys.delete(code)}
    >
      {label}
    </button>
  );
}

export function Hud({ room }: { room: string }) {
  useTick(100);
  const [copied, setCopied] = useState(false);
  const now = performance.now();
  const rank = standings();
  const place = rank.findIndex((r) => r.id === playerId);
  const host = isHost();
  const players = [{ id: playerId, name: game.name }, ...game.roster];
  const lap = Math.min(LAPS, Math.max(1, game.lap));
  const kmh = Math.round(Math.abs(game.speed) * 4.2);
  const cd = Math.ceil((game.countdownEnd - now) / 1000);
  const time = game.phase === "racing" ? now - game.raceStart : game.phase === "finished" ? game.finishTime : 0;

  const start = () => {
    initAudio();
    game.send("start", { by: playerId });
    beginCountdown();
  };
  const share = async () => {
    const url = `${window.location.origin}/?room=${room}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-body">
      {/* Top bar */}
      <div className="flex items-start justify-between p-4">
        <div className="hud-chip">
          <div className="hud-label">Lap</div>
          <div className="hud-big">
            {lap}<span className="hud-small">/{LAPS}</span>
          </div>
          <div className="hud-label tabular-nums">{formatTime(time)}</div>
        </div>
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <button onClick={share} className="hud-chip hud-room">
            Room <b>{room}</b> · {copied ? "Link copied!" : "Copy invite link"}
          </button>
        </div>
        <div className="hud-chip text-right">
          <div className="hud-place">{ORD[place] ?? "-"}</div>
          <div className="hud-label">of {rank.length}</div>
        </div>
      </div>

      {/* Standings */}
      <div className="absolute left-4 top-36 flex flex-col gap-1">
        {rank.map((r, i) => (
          <div key={r.id} className={`hud-row ${r.id === playerId ? "hud-row-me" : ""}`}>
            <span className="w-6">{i + 1}</span>
            <span className="truncate">{r.name}</span>
            {r.f ? <span className="ml-auto tabular-nums">{formatTime(r.f)}</span> : null}
          </div>
        ))}
      </div>

      {/* Item slot */}
      <div className="absolute right-4 top-32 flex flex-col items-center gap-1">
        <div className={`item-slot ${game.item ? "item-slot-full" : ""}`}>{game.item ? "🍄" : ""}</div>
        <div className="hud-label">{game.item ? "Press E" : "Item"}</div>
      </div>

      {/* Speed + drift */}
      <div className="absolute bottom-6 right-6 hidden text-right md:block">
        <div className="hud-speed tabular-nums">{kmh}</div>
        <div className="hud-label">km/h {game.boost > 0 ? "· BOOST!" : game.offroad ? "· off-road" : ""}</div>
        {game.driftLevel > 0 && <div className={`drift-pill drift-${game.driftLevel}`}>{game.driftLevel === 2 ? "SUPER DRIFT" : "DRIFT"}</div>}
      </div>

      {/* Countdown */}
      {game.phase === "countdown" && cd > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={cd} className="countdown">{cd}</div>
        </div>
      )}
      {game.phase === "racing" && now - game.raceStart < 900 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="countdown countdown-go">GO!</div>
        </div>
      )}

      {/* Waiting on grid */}
      {game.phase === "grid" && (
        <div className="absolute inset-x-0 bottom-24 flex justify-center px-4 md:bottom-10">
          <div className="panel pointer-events-auto w-full max-w-md text-center">
            <div className="panel-title">Ready to race</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the invite link so friends join this room. Drive around while you wait!
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {players.map((p) => (
                <span key={p.id} className="player-pill">{p.name}{p.id === playerId ? " (you)" : ""}</span>
              ))}
            </div>
            <div className="mt-4">
              {host ? (
                <Button variant="race" size="lg" onClick={start}>Start race</Button>
              ) : (
                <div className="text-sm font-semibold">Waiting for the host to start…</div>
              )}
            </div>
            <p className="mt-3 hidden text-xs text-muted-foreground md:block">
              W/↑ gas · S/↓ brake · A D/← → steer · Space drift (release for boost) · E use item
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {game.phase === "finished" && (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="panel pointer-events-auto w-full max-w-sm text-center">
            <div className="hud-place">{ORD[place]}</div>
            <div className="panel-title">Finished in {formatTime(game.finishTime)}</div>
            <div className="mt-3 flex flex-col gap-1 text-left">
              {rank.map((r, i) => (
                <div key={r.id} className={`hud-row ${r.id === playerId ? "hud-row-me" : ""}`}>
                  <span className="w-6">{i + 1}</span>
                  <span className="truncate">{r.name}</span>
                  <span className="ml-auto tabular-nums">{r.f ? formatTime(r.f) : "racing…"}</span>
                </div>
              ))}
            </div>
            {host && (
              <Button variant="race" size="lg" className="mt-4" onClick={start}>Race again</Button>
            )}
          </div>
        </div>
      )}

      {/* Touch controls */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-between px-3 md:hidden">
        <div className="flex gap-2">
          <TouchBtn code="ArrowLeft" label="◀" />
          <TouchBtn code="ArrowRight" label="▶" />
        </div>
        <div className="flex gap-2">
          <TouchBtn code="KeyE" label="🍄" className="touch-small" />
          <TouchBtn code="Space" label="DRIFT" className="touch-small" />
          <TouchBtn code="ArrowDown" label="▼" />
          <TouchBtn code="ArrowUp" label="GAS" className="touch-gas" />
        </div>
      </div>
    </div>
  );
}
