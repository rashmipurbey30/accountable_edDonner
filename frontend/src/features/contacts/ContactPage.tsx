import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { isId, useContact } from "../../api/hooks";
import { LateBadge, StageBadge, StatusBadge } from "../../components/badges";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Money } from "../../components/Money";
import { Panel } from "../../components/Panel";
import { MissingRecord, RecordHeader, orDash } from "../../components/RecordHeader";
import { TimelinePanel } from "../../components/TimelinePanel";
import { formatDate } from "../../lib/format";
import { ContactForm } from "./ContactForm";

export function ContactPage() {
  const id = Number(useParams().id);
  const contact = useContact(id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isId(id) || contact.isError) {
    if (!isId(id) || (contact.error as { status?: number }).status === 404) {
      return <MissingRecord kind="contact" listPath="/contacts" listName="contacts" />;
    }
    return <ErrorState onRetry={() => contact.refetch()} />;
  }
  if (!contact.data) return <p className="muted">Loading…</p>;
  const c = contact.data;

  return (
    <>
      <RecordHeader
        kind="contact"
        title={c.name}
        badge={<StatusBadge value={c.status} />}
        facts={[
          {
            label: "Organization",
            value: c.organization_id ? (
              <Link to={`/organizations/${c.organization_id}`}>{c.organization_name}</Link>
            ) : (
              orDash(null)
            ),
          },
          { label: "Job title", value: orDash(c.job_title) },
          { label: "Email", value: c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : orDash(null) },
          { label: "Phone", value: c.phone ? <span className="num">{c.phone}</span> : orDash(null) },
        ]}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      />
      <div className="record-grid">
        <Panel title="Deals" subtitle="Where they're the main contact">
          {c.deals.length === 0 ? (
            <EmptyState compact message="No deals yet." />
          ) : (
            <ul className="linked">
              {c.deals.map((d) => (
                <li key={d.id}>
                  <div>
                    <Link to={`/deals/${d.id}`}>{d.name}</Link>
                    <div className="meta">
                      Closes{" "}
                      <span className={`num${d.is_late ? " alert-text" : ""}`}>
                        {d.close_date ? formatDate(d.close_date) : "–"}
                      </span>
                    </div>
                  </div>
                  <div className="right">
                    {d.is_late ? <LateBadge /> : null}
                    <StageBadge value={d.stage} />
                    <Money value={d.value} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <TimelinePanel kind="contact" id={c.id} />
      </div>
      <ContactForm open={editing} onOpenChange={setEditing} contact={c} />
      <DeleteRecordDialog
        kind="contact"
        record={deleting ? { id: c.id, name: c.name } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/contacts")}
      />
    </>
  );
}
