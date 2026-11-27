import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { isId, useDeal } from "../../api/hooks";
import { LateBadge, StageBadge } from "../../components/badges";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { ErrorState } from "../../components/ErrorState";
import { Money } from "../../components/Money";
import { MissingRecord, RecordHeader, orDash } from "../../components/RecordHeader";
import { TimelinePanel } from "../../components/TimelinePanel";
import { formatDate, percent } from "../../lib/format";
import { DealForm } from "./DealForm";

export function DealPage() {
  const id = Number(useParams().id);
  const deal = useDeal(id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isId(id) || deal.isError) {
    if (!isId(id) || (deal.error as { status?: number }).status === 404) {
      return <MissingRecord kind="deal" listPath="/deals" listName="deals" />;
    }
    return <ErrorState onRetry={() => deal.refetch()} />;
  }
  if (!deal.data) return <p className="muted">Loading…</p>;
  const d = deal.data;

  const facts = [
    { label: "Value", value: <Money value={d.value} /> },
    { label: "Probability", value: <span className="num">{percent(d.probability)}</span> },
    {
      label: "Close date",
      value: d.close_date ? (
        <>
          <span className={`num${d.is_late ? " alert-text" : ""}`}>{formatDate(d.close_date)}</span>
          {d.is_late ? <LateBadge /> : null}
        </>
      ) : (
        orDash(null)
      ),
    },
    { label: "Organization", value: <Link to={`/organizations/${d.organization_id}`}>{d.organization_name}</Link> },
    {
      label: "Main contact",
      value: d.main_contact_id ? <Link to={`/contacts/${d.main_contact_id}`}>{d.main_contact_name}</Link> : orDash(null),
    },
  ];
  if (d.stage === "lost") {
    facts.push({ label: "Lost reason", value: <span className="lost-reason">{orDash(d.lost_reason)}</span> });
  }

  return (
    <>
      <RecordHeader
        kind="deal"
        title={d.name}
        badge={<StageBadge value={d.stage} />}
        facts={facts}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      />
      <TimelinePanel kind="deal" id={d.id} />
      <DealForm open={editing} onOpenChange={setEditing} deal={d} />
      <DeleteRecordDialog
        kind="deal"
        record={deleting ? { id: d.id, name: d.name } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/deals")}
      />
    </>
  );
}
