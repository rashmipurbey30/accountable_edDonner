import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export interface Fact {
  label: string;
  value: ReactNode;
}

interface RecordHeaderProps {
  /** "organization", "contact" or "deal", for the button labels. */
  kind: string;
  title: string;
  badge?: ReactNode;
  facts: Fact[];
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
}

/** The header panel of a record page: name, key facts, Edit and Delete. */
export function RecordHeader({ kind, title, badge, facts, onEdit, onDelete, children }: RecordHeaderProps) {
  return (
    <section className="panel record-head" aria-label={`${kind} details`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1>{title}</h1>
          {badge}
        </div>
        <dl className="facts" style={{ margin: "12px 0 0" }}>
          {facts.map((fact) => (
            <div className="fact" key={fact.label}>
              <dt className="label">{fact.label}</dt>
              <dd className="value" style={{ margin: 0 }}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
      <div style={{ display: "flex", gap: 10, flex: "none" }}>
        <button type="button" className="btn" onClick={onEdit}>
          <Pencil aria-hidden="true" /> Edit {kind}
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          <Trash2 aria-hidden="true" /> Delete {kind}
        </button>
      </div>
    </section>
  );
}

/** Shown for an unknown id (404). */
export function MissingRecord({ kind, listPath, listName }: { kind: string; listPath: string; listName: string }) {
  return (
    <div className="panel not-found">
      <p className="empty-line" style={{ marginTop: 0 }}>
        This {kind} doesn't exist. It may have been deleted.
      </p>
      <Link to={listPath}>Back to {listName}</Link>
    </div>
  );
}

/** A dash for an empty value. */
export function orDash(value: ReactNode) {
  return value === null || value === undefined || value === "" ? <span className="muted">–</span> : value;
}
