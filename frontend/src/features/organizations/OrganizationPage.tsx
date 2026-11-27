import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { isId, useOrganization } from "../../api/hooks";
import { LateBadge, StageBadge, StatusBadge } from "../../components/badges";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Money } from "../../components/Money";
import { Panel } from "../../components/Panel";
import { MissingRecord, RecordHeader, orDash } from "../../components/RecordHeader";
import { formatDate } from "../../lib/format";
import { OrganizationForm } from "./OrganizationForm";

export function websiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function OrganizationPage() {
  const id = Number(useParams().id);
  const org = useOrganization(id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isId(id) || org.isError) {
    if (!isId(id) || (org.error as { status?: number }).status === 404) {
      return <MissingRecord kind="organization" listPath="/organizations" listName="organizations" />;
    }
    return <ErrorState onRetry={() => org.refetch()} />;
  }
  if (!org.data) return <p className="muted">Loading…</p>;
  const o = org.data;

  return (
    <>
      <RecordHeader
        kind="organization"
        title={o.name}
        facts={[
          { label: "Industry", value: orDash(o.industry) },
          {
            label: "Website",
            value: o.website ? (
              <a href={websiteHref(o.website)} target="_blank" rel="noreferrer">
                {o.website}
              </a>
            ) : (
              orDash(null)
            ),
          },
        ]}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      >
        {o.notes ? (
          <p style={{ margin: "14px 0 0", whiteSpace: "pre-wrap", maxWidth: 720 }}>{o.notes}</p>
        ) : null}
      </RecordHeader>

      <div className="record-grid even">
        <Panel title="Contacts" subtitle={`${o.contacts.length} at this organization`}>
          {o.contacts.length === 0 ? (
            <EmptyState compact message="No contacts here yet." />
          ) : (
            <ul className="linked">
              {o.contacts.map((c) => (
                <li key={c.id}>
                  <div>
                    <Link to={`/contacts/${c.id}`}>{c.name}</Link>
                    <div className="meta">{c.job_title ?? "–"}</div>
                  </div>
                  <StatusBadge value={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Deals" subtitle={`${o.deals.length} with this organization`}>
          {o.deals.length === 0 ? (
            <EmptyState compact message="No deals here yet." />
          ) : (
            <ul className="linked">
              {o.deals.map((d) => (
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
      </div>

      <OrganizationForm open={editing} onOpenChange={setEditing} organization={o} />
      <DeleteRecordDialog
        kind="organization"
        record={deleting ? { id: o.id, name: o.name } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/organizations")}
      />
    </>
  );
}
