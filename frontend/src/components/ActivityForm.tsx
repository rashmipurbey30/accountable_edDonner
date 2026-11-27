import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../api/client";
import { useSaveActivity } from "../api/hooks";
import type { ActivityType, TimelineItem } from "../api/types";
import { toDateTimeInput } from "../lib/format";
import { Dialog } from "./Dialog";

const schema = z.object({
  type: z.enum(["note", "call", "email"], { message: "Choose a type" }),
  description: z
    .string()
    .trim()
    .min(1, "Write what happened")
    .max(2000, "Keep it to 2,000 characters"),
  occurred_at: z.string().min(1, "Choose when it happened"),
  follow_up_date: z.string(),
});

type Values = z.infer<typeof schema>;

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where a new activity goes. */
  owner: { contact_id: number } | { deal_id: number };
  /** The activity being edited, or none to log a new one. */
  activity?: TimelineItem | null;
  /** The backend's "now", for the default time (A1). */
  now: string;
}

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
];

export function ActivityForm({ open, onOpenChange, owner, activity, now }: ActivityFormProps) {
  const save = useSaveActivity();
  const defaults = (): Values => ({
    type: (activity?.type as ActivityType) ?? "note",
    description: activity?.text ?? "",
    occurred_at: toDateTimeInput(activity?.at ?? now),
    follow_up_date: activity?.follow_up_date ?? "",
  });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { register, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (open) reset(defaults());
    // Reset each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      type: values.type,
      description: values.description,
      occurred_at: values.occurred_at.length === 16 ? `${values.occurred_at}:00` : values.occurred_at,
      follow_up_date: values.follow_up_date || null,
    };
    try {
      if (activity) await save.mutateAsync({ id: activity.id, input });
      else await save.mutateAsync({ input: { ...input, ...owner } });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          if (field in values) setError(field as keyof Values, { message });
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={activity ? "Edit activity" : "Log activity"}>
      <form onSubmit={onSubmit} noValidate>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
          <legend className="label" style={{ padding: 0, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
            Type
          </legend>
          <div className="choice">
            {TYPES.map((t) => (
              <label key={t.value}>
                <input type="radio" value={t.value} {...register("type")} />
                {t.label}
              </label>
            ))}
          </div>
          {errors.type ? <span className="field-error">{errors.type.message}</span> : null}
        </fieldset>
        <div className="field">
          <label htmlFor="activity-description">Description</label>
          <textarea
            id="activity-description"
            className="textarea"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "activity-description-error" : undefined}
            {...register("description")}
          />
          {errors.description ? (
            <span className="field-error" id="activity-description-error" role="alert">
              {errors.description.message}
            </span>
          ) : null}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="activity-when">When it happened</label>
            <input
              id="activity-when"
              type="datetime-local"
              className="input"
              aria-invalid={errors.occurred_at ? true : undefined}
              {...register("occurred_at")}
            />
            {errors.occurred_at ? (
              <span className="field-error" role="alert">
                {errors.occurred_at.message}
              </span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="activity-follow-up">Follow-up date</label>
            <input id="activity-follow-up" type="date" className="input" {...register("follow_up_date")} />
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
