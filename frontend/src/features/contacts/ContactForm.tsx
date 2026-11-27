import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { loadOrganizationOptions, useSaveContact } from "../../api/hooks";
import type { Contact, ContactStatus } from "../../api/types";
import { STATUSES, statusName } from "../../components/badges";
import { Dialog } from "../../components/Dialog";
import { EntityPicker } from "../../components/EntityPicker";
import { FieldError, TextField } from "../../components/fields";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200, "Keep it to 200 characters"),
  email: z.union([z.literal(""), z.email("Enter a valid email address, like name@example.com").max(254)]),
  phone: z.string().trim().max(50, "Keep it to 50 characters"),
  job_title: z.string().trim().max(100, "Keep it to 100 characters"),
  organization: z.object({ id: z.number(), name: z.string() }).nullable(),
  status: z.enum(["lead", "qualified", "customer"]),
});

type Values = z.infer<typeof schema>;

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSaved?: (contact: Contact) => void;
}

export function ContactForm({ open, onOpenChange, contact, onSaved }: ContactFormProps) {
  const save = useSaveContact();
  const defaults = (): Values => ({
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    job_title: contact?.job_title ?? "",
    organization:
      contact?.organization_id && contact.organization_name
        ? { id: contact.organization_id, name: contact.organization_name }
        : null,
    status: contact?.status ?? "lead",
  });
  const { register, handleSubmit, reset, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  const errors = formState.errors;

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      name: values.name,
      email: values.email.trim() || null,
      phone: values.phone || null,
      job_title: values.job_title || null,
      organization_id: values.organization?.id ?? null,
      status: values.status,
    };
    try {
      const saved = await save.mutateAsync({ id: contact?.id, input });
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
    <Dialog open={open} onOpenChange={onOpenChange} title={contact ? "Edit contact" : "Add contact"}>
      <form onSubmit={onSubmit} noValidate>
        <TextField id="contact-name" label="Name" error={errors.name?.message} {...register("name")} />
        <TextField
          id="contact-email"
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="field-row">
          <TextField id="contact-phone" label="Phone" error={errors.phone?.message} {...register("phone")} />
          <TextField
            id="contact-job-title"
            label="Job title"
            error={errors.job_title?.message}
            {...register("job_title")}
          />
        </div>
        <div className="field">
          <label htmlFor="contact-organization">Organization</label>
          <Controller
            control={control}
            name="organization"
            render={({ field }) => (
              <EntityPicker
                id="contact-organization"
                label="Organization"
                value={field.value}
                onChange={field.onChange}
                load={loadOrganizationOptions}
                loadKey={["organizations"]}
                optional
                placeholder="No organization"
              />
            )}
          />
        </div>
        <div className="field">
          <label htmlFor="contact-status">Status</label>
          <select id="contact-status" className="select" {...register("status")}>
            {STATUSES.map((s: ContactStatus) => (
              <option key={s} value={s}>
                {statusName(s)}
              </option>
            ))}
          </select>
          <FieldError error={errors.status?.message} />
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
