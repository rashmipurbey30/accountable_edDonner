import type { DeleteImpact } from "../api/types";
import { plural } from "../lib/format";
import { Dialog } from "./Dialog";

type Kind = "organization" | "contact" | "deal" | "activity";

/** The delete wording from docs/plan.md (T6). Sentences about a count of zero are left out. */
export function deleteMessage(kind: Kind, name: string, impact: DeleteImpact = {}): string {
  const contacts = impact.contacts ?? 0;
  const deals = impact.deals ?? 0;
  const activities = impact.activities ?? 0;
  const sentences: string[] = [];

  if (kind === "activity") {
    return `Delete this ${name}? This can't be undone.`;
  }
  if (kind === "organization") {
    if (deals > 0) {
      sentences.push(
        activities > 0
          ? `Its ${plural(deals, "deal")} and their ${plural(activities, "activity")} will be deleted.`
          : `Its ${plural(deals, "deal")} will be deleted.`,
      );
    }
    if (contacts > 0) sentences.push(`Its ${plural(contacts, "contact")} will be kept, with no organization.`);
  }
  if (kind === "contact") {
    if (activities > 0) sentences.push(`Their ${plural(activities, "activity")} will be deleted.`);
    if (deals > 0) sentences.push(`Their ${plural(deals, "deal")} will be kept, with no main contact.`);
  }
  if (kind === "deal") {
    sentences.push(
      activities > 0
        ? `Its ${plural(activities, "activity")} and its stage history will be deleted.`
        : "Its stage history will be deleted.",
    );
  }
  if (sentences.length === 0) sentences.push("Nothing else is affected.");
  return `Delete ${name}? ${sentences.join(" ")}`;
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  /** The record's name, or for an activity its type ("note", "call", "email"). */
  name: string;
  /** Counts of linked records. While loading, the dialog waits before offering Delete. */
  impact?: DeleteImpact;
  loading?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, kind, name, impact, loading, busy, onConfirm }: ConfirmDialogProps) {
  const title = kind === "activity" ? `Delete ${name}` : `Delete ${kind}`;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={loading ? "Checking what else this affects…" : deleteMessage(kind, name, impact)}
    >
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" disabled={loading || busy} onClick={onConfirm}>
          {title}
        </button>
      </div>
    </Dialog>
  );
}
