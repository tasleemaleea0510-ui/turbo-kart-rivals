export type Phase = "grid" | "countdown" | "racing" | "finished";

export const KARTS = [
  { id: "oobi", label: "Blitz" },
  { id: "oodi", label: "Dash" },
  { id: "ooli", label: "Lulu" },
  { id: "oopi", label: "Pip" },
  { id: "oozi", label: "Zoom" },
] as const;

export type RemoteState = {
  id: string;
  name: string;
  kart: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  p: number; // progress
  f: number; // finish time ms, 0 if racing
  at: number;
};

export const playerId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const game = {
  phase: "grid" as Phase,
  countdownEnd: 0,
  raceStart: 0,
  lap: 0,
  progress: 0,
  speed: 0,
  item: null as null | "boost",
  finishTime: 0,
  driftLevel: 0,
  boost: 0,
  offroad: false,
  slot: 0,
  resetToken: 0,
  name: "",
  kart: "oobi",
  roster: [] as { id: string; name: string; kart: string }[],
  remotes: new Map<string, RemoteState>(),
  send: (_event: string, _payload: Record<string, unknown>) => {},
  keys: new Set<string>(),
};

export function isHost() {
  const ids = game.roster.map((r) => r.id).concat(playerId).sort();
  return ids[0] === playerId;
}

/** Called on every client when a race starts (host broadcast or own click). */
export function beginCountdown() {
  const ids = Array.from(new Set(game.roster.map((r) => r.id).concat(playerId))).sort();
  game.slot = Math.max(0, ids.indexOf(playerId));
  game.phase = "countdown";
  game.countdownEnd = performance.now() + 3500;
  game.lap = 0;
  game.finishTime = 0;
  game.item = null;
  game.boost = 0;
  game.resetToken++;
}

export function standings() {
  const all = [
    { id: playerId, name: game.name, p: game.progress, f: game.finishTime },
    ...[...game.remotes.values()].map((r) => ({ id: r.id, name: r.name, p: r.p, f: r.f })),
  ];
  all.sort((a, b) => {
    if (a.f && b.f) return a.f - b.f;
    if (a.f) return -1;
    if (b.f) return 1;
    return b.p - a.p;
  });
  return all;
}

export function formatTime(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}
