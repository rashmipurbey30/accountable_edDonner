import { forwardRef, type InputHTMLAttributes } from "react";

export function FieldError({ id, error }: { id?: string; error?: string }) {
  if (!error) return null;
  return (
    <span className="field-error" id={id} role="alert">
      {error}
    </span>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

/** A labelled input with its error underneath, announced to screen readers. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, hint, className, ...rest },
  ref,
) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        className={`input ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {hint && !error ? <span className="hint">{hint}</span> : null}
      <FieldError id={errorId} error={error} />
    </div>
  );
});
