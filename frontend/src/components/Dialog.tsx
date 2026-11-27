import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  description?: ReactNode;
}

/** A centred dialog. Radix traps focus, closes on Escape and returns focus on close. */
export function Dialog({ open, onOpenChange, title, children, wide, description }: DialogProps) {
  // Without a description, say so explicitly, or Radix warns in the console (G7).
  const describedBy = description ? {} : { "aria-describedby": undefined };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="overlay" />
        <RadixDialog.Content className={`dialog${wide ? " wide" : ""}`} {...describedBy}>
          <RadixDialog.Title className="dialog-title">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="dialog-text">{description}</RadixDialog.Description>
          ) : null}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
