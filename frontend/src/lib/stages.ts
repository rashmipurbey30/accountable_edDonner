// The six stages. Must match backend/app/stages.py (checked by test_stages_match.py).

export type StageKey = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface StageInfo {
  key: StageKey;
  name: string;
  probability: number;
  /** The fill color, for bars, dots and tints. */
  color: string;
  /** A version of the color that's readable as text on white. */
  text: string;
  /** The header tint on the board. */
  tint: string;
}

export const STAGES: StageInfo[] = [
  { key: "new", name: "New", probability: 10, color: "#CDD8DB", text: "#073B4C", tint: "rgb(205 216 219 / 0.45)" },
  { key: "qualified", name: "Qualified", probability: 25, color: "#0E7A9F", text: "#0B6A8A", tint: "rgb(14 122 159 / 0.16)" },
  { key: "proposal", name: "Proposal", probability: 50, color: "#FFC145", text: "#8A5A00", tint: "rgb(255 193 69 / 0.16)" },
  { key: "negotiation", name: "Negotiation", probability: 75, color: "#F78C6B", text: "#B0472A", tint: "rgb(247 140 107 / 0.16)" },
  { key: "won", name: "Won", probability: 100, color: "#06D6A0", text: "#037A5C", tint: "rgb(6 214 160 / 0.22)" },
  { key: "lost", name: "Lost", probability: 0, color: "#D33259", text: "#C0264E", tint: "rgb(211 50 89 / 0.12)" },
];

export const STAGE_KEYS = STAGES.map((s) => s.key);
export const OPEN_STAGES: StageKey[] = ["new", "qualified", "proposal", "negotiation"];
export const CLOSED_STAGES: StageKey[] = ["won", "lost"];

const BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, StageInfo>;

export function stage(key: StageKey): StageInfo {
  return BY_KEY[key];
}

export function stageName(key: StageKey): string {
  return BY_KEY[key].name;
}

export function usualProbability(key: StageKey): number {
  return BY_KEY[key].probability;
}

export function isOpen(key: StageKey): boolean {
  return OPEN_STAGES.includes(key);
}

export function isClosed(key: StageKey): boolean {
  return CLOSED_STAGES.includes(key);
}
