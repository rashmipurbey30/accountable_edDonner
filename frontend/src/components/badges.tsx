import type { ContactStatus } from "../api/types";
import { stage, type StageKey } from "../lib/stages";

const STATUS: Record<ContactStatus, { name: string; bg: string; fg: string }> = {
  lead: { name: "Lead", bg: "rgb(14 122 159 / 0.15)", fg: "var(--cerulean-text)" },
  qualified: { name: "Qualified", bg: "rgb(255 193 69 / 0.15)", fg: "var(--marigold-text)" },
  customer: { name: "Customer", bg: "rgb(6 214 160 / 0.15)", fg: "var(--sea-green-text)" },
};

export const STATUSES: ContactStatus[] = ["lead", "qualified", "customer"];

export function statusName(value: ContactStatus) {
  return STATUS[value].name;
}

export function StageBadge({ value }: { value: StageKey }) {
  const info = stage(value);
  return (
    <span className="badge" style={{ background: info.tint, color: info.text }}>
      <span className="dot" style={{ background: info.color }} aria-hidden="true" />
      {info.name}
    </span>
  );
}

export function StatusBadge({ value }: { value: ContactStatus }) {
  const info = STATUS[value];
  return (
    <span className="badge" style={{ background: info.bg, color: info.fg }}>
      {info.name}
    </span>
  );
}

export function LateBadge() {
  return <span className="badge badge-late">Late</span>;
}
