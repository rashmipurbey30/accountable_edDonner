import { Plus } from "lucide-react";
import { useState } from "react";
import { useDeleteActivity, useMeta, useSetDone, useTimeline } from "../api/hooks";
import type { TimelineItem } from "../api/types";
import { ActivityForm } from "./ActivityForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorState } from "./ErrorState";
import { Panel } from "./Panel";
import { Timeline } from "./Timeline";

/** A record's timeline with "Log activity", edit, delete and done (A1, A3 to A6). */
export function TimelinePanel({ kind, id }: { kind: "contact" | "deal"; id: number }) {
  const timeline = useTimeline(kind, id);
  const meta = useMeta();
  const setDone = useSetDone();
  const remove = useDeleteActivity();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimelineItem | null>(null);
  const [deleting, setDeleting] = useState<TimelineItem | null>(null);

  const owner = kind === "contact" ? { contact_id: id } : { deal_id: id };

  return (
    <Panel
      title="Timeline"
      actions={
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
            void meta.refetch();
          }}
          disabled={!meta.data}
        >
          <Plus aria-hidden="true" /> Log activity
        </button>
      }
    >
      {timeline.isError ? (
        <ErrorState onRetry={() => timeline.refetch()} />
      ) : timeline.data && meta.data ? (
        <Timeline
          items={timeline.data}
          today={meta.data.today}
          onToggleDone={(item, done) => setDone.mutate({ id: item.id, done })}
          onEdit={(item) => {
            setEditing(item);
            setFormOpen(true);
          }}
          onDelete={setDeleting}
        />
      ) : (
        <p className="muted">Loading…</p>
      )}
      {meta.data ? (
        <ActivityForm
          open={formOpen}
          onOpenChange={setFormOpen}
          owner={owner}
          activity={editing}
          now={meta.data.now}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        kind="activity"
        name={deleting?.type ?? "note"}
        busy={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </Panel>
  );
}
