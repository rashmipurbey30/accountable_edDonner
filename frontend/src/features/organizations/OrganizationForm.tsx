import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { useSaveOrganization } from "../../api/hooks";
import type { Organization } from "../../api/types";
import { Dialog } from "../../components/Dialog";
import { FieldError, TextField } from "../../components/fields";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200, "Keep it to 200 characters"),
  website: z.string().trim().max(300, "Keep it to 300 characters"),
  industry: z.string().trim().max(100, "Keep it to 100 characters"),
  notes: z.string(),
});

type Values = z.infer<typeof schema>;

interface OrganizationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The organization being edited, or none to add one. */
  organization?: Organization | null;
  onSaved?: (organization: Organization) => void;
}

export function OrganizationForm({ open, onOpenChange, organization, onSaved }: OrganizationFormProps) {
  const save = useSaveOrganization();
  const defaults = (): Values => ({
    name: organization?.name ?? "",
    website: organization?.website ?? "",
    industry: organization?.industry ?? "",
    notes: organization?.notes ?? "",
  });
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  const errors = formState.errors;

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organization?.id]);

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      name: values.name,
      website: values.website || null,
      industry: values.industry || null,
      notes: values.notes.trim() || null,
    };
    try {
      const saved = await save.mutateAsync({ id: organization?.id, input });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          if (field in values) setError(field as keyof Values, { message });
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={organization ? "Edit organization" : "Add organization"}>
      <form onSubmit={onSubmit} noValidate>
        <TextField id="org-name" label="Name" error={errors.name?.message} {...register("name")} />
        <TextField id="org-website" label="Website" error={errors.website?.message} {...register("website")} />
        <TextField id="org-industry" label="Industry" error={errors.industry?.message} {...register("industry")} />
        <div className="field">
          <label htmlFor="org-notes">Notes</label>
          <textarea id="org-notes" className="textarea" {...register("notes")} />
          <FieldError error={errors.notes?.message} />
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
