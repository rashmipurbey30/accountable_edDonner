import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { loadContactOptions, loadOrganizationOptions, useSaveDeal } from "../../api/hooks";
import type { DealDetail } from "../../api/types";
import { Dialog } from "../../components/Dialog";
import { FieldError, TextField } from "../../components/fields";
import { EntityPicker } from "../../components/EntityPicker";
import { STAGES, isClosed, usualProbability, type StageKey } from "../../lib/stages";

const option = z.object({ id: z.number(), name: z.string() });

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200, "Keep it to 200 characters"),
  organization: option.nullable().refine((v): boolean => v !== null, "Choose an organization"),
  main_contact: option.nullable(),
  stage: z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost"]),
  value: z
    .string()
    .trim()
    .min(1, "Enter a value")
    .regex(/^\d+$/, "Enter whole US dollars, 0 or more"),
  probability: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a number from 0 to 100")
    .refine((v) => Number(v) <= 100, "Enter a number from 0 to 100"),
  close_date: z.string(),
  lost_reason: z.string().trim().max(200, "Keep it to 200 characters"),
});

type Values = z.infer<typeof schema>;

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: DealDetail | null;
  /** The stage a new deal starts in (the pipeline's "Add deal" passes its column). */
  initialStage?: StageKey;
  onSaved?: (deal: DealDetail) => void;
}

export function DealForm({ open, onOpenChange, deal, initialStage = "new", onSaved }: DealFormProps) {
  const save = useSaveDeal();
  const defaults = (): Values => ({
    name: deal?.name ?? "",
    organization: deal ? { id: deal.organization_id, name: deal.organization_name } : null,
    main_contact:
      deal?.main_contact_id && deal.main_contact_name ? { id: deal.main_contact_id, name: deal.main_contact_name } : null,
    stage: deal?.stage ?? initialStage,
    value: deal ? String(deal.value) : "",
    probability: String(deal?.probability ?? usualProbability(initialStage)),
    close_date: deal?.close_date ?? "",
    lost_reason: deal?.lost_reason ?? "",
  });
  const { register, handleSubmit, reset, setError, setValue, control, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  const errors = formState.errors;
  const stage = watch("stage");
  const organization = watch("organization");

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal?.id, initialStage]);

  // Choosing a stage fills in its usual probability (D3); leaving Lost clears the reason (D2, D4a).
  const stageField = register("stage", {
    onChange: (e) => {
      const next = e.target.value as StageKey;
      setValue("probability", String(usualProbability(next)), { shouldValidate: true });
      if (next !== "lost") setValue("lost_reason", "");
    },
  });

  const closingNow = isClosed(stage) && stage !== deal?.stage;

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      name: values.name,
      organization_id: values.organization!.id,
      main_contact_id: values.main_contact?.id ?? null,
      stage: values.stage,
      value: Number(values.value),
      probability: Number(values.probability),
      close_date: values.close_date || null,
      lost_reason: values.stage === "lost" ? values.lost_reason || null : null,
    };
    try {
      const saved = await save.mutateAsync({ id: deal?.id, input });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          const name = field === "organization_id" ? "organization" : field === "main_contact_id" ? "main_contact" : field;
          if (name in values) setError(name as keyof Values, { message });
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={deal ? "Edit deal" : "Add deal"} wide>
      <form onSubmit={onSubmit} noValidate>
        <TextField id="deal-name" label="Name" error={errors.name?.message} {...register("name")} />
        <div className="field-row">
          <div className="field">
            <label htmlFor="deal-organization">Organization</label>
            <Controller
              control={control}
              name="organization"
              render={({ field }) => (
                <EntityPicker
                  id="deal-organization"
                  label="Organization"
                  value={field.value}
                  onChange={field.onChange}
                  load={loadOrganizationOptions}
                  loadKey={["organizations"]}
                  invalid={!!errors.organization}
                  describedBy={errors.organization ? "deal-organization-error" : undefined}
                />
              )}
            />
            <FieldError id="deal-organization-error" error={errors.organization?.message} />
          </div>
          <div className="field">
            <label htmlFor="deal-contact">Main contact</label>
            <Controller
              control={control}
              name="main_contact"
              render={({ field }) => (
                <EntityPicker
                  id="deal-contact"
                  label="Main contact"
                  value={field.value}
                  onChange={field.onChange}
                  load={(q) => loadContactOptions(q, organization?.id)}
                  loadKey={["contacts", organization?.id ?? null]}
                  optional
                  placeholder="No main contact"
                />
              )}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="deal-stage">Stage</label>
            <select id="deal-stage" className="select" {...stageField}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <TextField
            id="deal-close-date"
            label="Close date"
            type="date"
            error={errors.close_date?.message}
            {...register("close_date")}
          />
        </div>
        {closingNow ? <p className="note">The close date will be set to today.</p> : null}
        <div className="field-row">
          <TextField
            id="deal-value"
            label="Value (US$)"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            error={errors.value?.message}
            {...register("value")}
          />
          <TextField
            id="deal-probability"
            label="Probability (%)"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            error={errors.probability?.message}
            {...register("probability")}
          />
        </div>
        {stage === "lost" ? (
          <div className="field">
            <label htmlFor="deal-lost-reason">Lost reason</label>
            <input
              id="deal-lost-reason"
              className="input"
              maxLength={200}
              placeholder="Optional"
              aria-invalid={errors.lost_reason ? true : undefined}
              {...register("lost_reason")}
            />
            <FieldError error={errors.lost_reason?.message} />
          </div>
        ) : null}
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
