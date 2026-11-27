import { useDeleteContact, useDeleteDeal, useDeleteImpact, useDeleteOrganization } from "../api/hooks";
import { ConfirmDialog } from "./ConfirmDialog";

type Kind = "organization" | "contact" | "deal";

interface DeleteRecordDialogProps {
  kind: Kind;
  /** The record to delete, or null when the dialog is closed. */
  record: { id: number; name: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Asks first, naming what happens to linked records with their counts (T6). */
export function DeleteRecordDialog({ kind, record, onClose, onDeleted }: DeleteRecordDialogProps) {
  const impact = useDeleteImpact(kind, record?.id ?? null);
  const removeOrganization = useDeleteOrganization();
  const removeContact = useDeleteContact();
  const removeDeal = useDeleteDeal();
  const remove = { organization: removeOrganization, contact: removeContact, deal: removeDeal }[kind];

  const confirm = () => {
    if (!record) return;
    // Leave a record page before its data is dropped, so it doesn't flash "doesn't exist".
    remove.mutate(record.id, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
    });
  };

  return (
    <ConfirmDialog
      open={record !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      kind={kind}
      name={record?.name ?? ""}
      impact={impact.data}
      loading={impact.isPending}
      busy={remove.isPending}
      onConfirm={confirm}
    />
  );
}
