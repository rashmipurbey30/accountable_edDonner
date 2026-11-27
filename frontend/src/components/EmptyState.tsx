import type { ReactNode } from "react";

export function EmptyState({ message, action, compact }: { message: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <p className="empty-line" style={{ margin: 0 }}>
        {message}
      </p>
      {action}
    </div>
  );
}
