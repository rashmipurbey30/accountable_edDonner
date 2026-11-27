import { GitCommitHorizontal, Mail, Phone, StickyNote, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import type { TimelineItem } from "../api/types";
import { formatDate, formatTime, relativeDay } from "../lib/format";
import { EmptyState } from "./EmptyState";
import { RowMenu } from "./RowMenu";

export const TYPE_ICONS: Record<TimelineItem["type"], LucideIcon> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  stage: GitCommitHorizontal,
};

export const TYPE_NAMES: Record<TimelineItem["type"], string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  stage: "Stage change",
};

export function TypeIcon({ type, size = 32 }: { type: TimelineItem["type"]; size?: number }) {
  const Icon = TYPE_ICONS[type];
  return (
    <span className={`type-icon type-${type}`} style={{ width: size, height: size }} title={TYPE_NAMES[type]}>
      <Icon aria-hidden="true" />
      <span className="sr-only">{TYPE_NAMES[type]}</span>
    </span>
  );
}

interface TimelineProps {
  items: TimelineItem[];
  today: string;
  onToggleDone: (item: TimelineItem, done: boolean) => void;
  onEdit: (item: TimelineItem) => void;
  onDelete: (item: TimelineItem) => void;
}

/** A timeline, in the order given (the server sorts it, newest first: A3). */
export function Timeline({ items, today, onToggleDone, onEdit, onDelete }: TimelineProps) {
  if (items.length === 0) return <EmptyState compact message="Nothing logged yet." />;
  return (
    <ol className="timeline" aria-label="Timeline">
      {items.map((item) => {
        const isActivity = item.kind === "activity";
        const followUpClass = item.done ? "done" : item.overdue ? "overdue" : "";
        return (
          <li key={`${item.kind}-${item.id}`} data-testid="timeline-entry">
            <TypeIcon type={item.type} />
            <div style={{ minWidth: 0 }}>
              <div className="entry-text">{item.text}</div>
              <div className="entry-meta">
                <span>
                  {relativeDay(item.at, today)}, <span className="num">{formatTime(item.at)}</span>
                </span>
                {item.source ? (
                  <span>
                    On deal <Link to={`/deals/${item.source.id}`}>{item.source.name}</Link>
                  </span>
                ) : null}
              </div>
              {isActivity && item.follow_up_date ? (
                <label className={`follow-up ${followUpClass}`}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => onToggleDone(item, e.target.checked)}
                    aria-label={`Mark done: follow up ${formatDate(item.follow_up_date)}`}
                  />
                  <span>
                    Follow up <span className="num">{formatDate(item.follow_up_date)}</span>
                    {item.overdue ? " (overdue)" : ""}
                  </span>
                </label>
              ) : null}
            </div>
            {isActivity ? (
              <RowMenu
                label={`Actions for ${TYPE_NAMES[item.type].toLowerCase()}`}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ol>
  );
}
