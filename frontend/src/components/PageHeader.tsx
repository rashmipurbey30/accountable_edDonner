import type { ReactNode } from "react";

export function PageHeader({ title, actions, aside }: { title: string; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {aside ? <div className="aside">{aside}</div> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
