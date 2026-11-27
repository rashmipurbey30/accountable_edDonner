import * as Popover from "@radix-ui/react-popover";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import type { Option } from "../api/types";
import { useDebounced } from "../lib/useDebounced";

interface EntityPickerProps {
  id?: string;
  /** Names the field for screen readers, e.g. "Organization". */
  label: string;
  value: Option | null;
  onChange: (value: Option | null) => void;
  /** Fetches up to 20 options matching the search. */
  load: (q: string) => Promise<Option[]>;
  /** A key that changes when `load` would return something different (e.g. the chosen organization). */
  loadKey: unknown[];
  optional?: boolean;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

/** A searchable picker over an /options endpoint, in a Radix popover. */
export function EntityPicker({
  id,
  label,
  value,
  onChange,
  load,
  loadKey,
  optional,
  placeholder = "Choose…",
  invalid,
  describedBy,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useDebounced(q, 150);
  const listId = useId();
  const options = useQuery({
    queryKey: ["options", ...loadKey, search],
    queryFn: () => load(search),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const choose = (option: Option | null) => {
    onChange(option);
    setOpen(false);
    setQ("");
  };

  const moveFocus = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = document.getElementById(listId);
    const buttons = Array.from(list?.querySelectorAll<HTMLButtonElement>("button.option") ?? []);
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? Math.min(index + 1, buttons.length - 1) : index - 1;
    if (next < 0) (e.currentTarget.closest(".popover")?.querySelector("input") as HTMLInputElement)?.focus();
    else buttons[next].focus();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        className="input picker-trigger"
        aria-label={`${label}: ${value ? value.name : "none chosen"}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        {value ? <span>{value.name}</span> : <span className="placeholder">{placeholder}</span>}
        <ChevronDown aria-hidden="true" width={16} height={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover" align="start" sideOffset={4} onKeyDown={moveFocus}>
          <input
            className="input"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Type to search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <ul className="option-list" id={listId} aria-label={`${label} options`}>
            {optional ? (
              <li>
                <button type="button" className="option" onClick={() => choose(null)}>
                  <span className="muted">None</span>
                </button>
              </li>
            ) : null}
            {options.data?.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="option"
                  aria-current={value?.id === option.id || undefined}
                  onClick={() => choose(option)}
                >
                  <span>{option.name}</span>
                  {option.organization_name ? <span className="muted">{option.organization_name}</span> : null}
                </button>
              </li>
            ))}
            {options.data && options.data.length === 0 ? (
              <li className="muted small" style={{ padding: "8px 10px" }}>
                Nothing matches “{search}”.
              </li>
            ) : null}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
