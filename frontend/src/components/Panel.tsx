import { useId, type ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Children sit flush with the panel's edges (tables bring their own padding). */
  flush?: boolean;
}

export function Panel({ title, subtitle, actions, children, className, flush }: PanelProps) {
  const titleId = useId();
  const head =
    title || actions ? (
      <div className="panel-head" style={flush ? { padding: "18px 20px 0", marginBottom: 0 } : undefined}>
        <div>
          {title ? (
            <h2 className="panel-title" id={titleId}>
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    ) : null;
  return (
    <section className={`panel ${className ?? ""}`} aria-labelledby={title ? titleId : undefined}>
      {flush ? (
        <>
          {head}
          {children}
        </>
      ) : (
        <div className="panel-body">
          {head}
          {children}
        </div>
      )}
    </section>
  );
}
