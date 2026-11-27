import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { TimelineItem } from "../api/types";
import { renderWithProviders } from "../test/render";
import { Timeline } from "./Timeline";

const base = { follow_up_date: null, done: false, overdue: false, source: null };

const items: TimelineItem[] = [
  { ...base, kind: "activity", id: 3, type: "call", text: "Called about cups", at: "2026-11-26T10:00:00",
    follow_up_date: "2026-11-20", overdue: true },
  { ...base, kind: "stage_change", id: 9, type: "stage", text: "Moved from Proposal to Negotiation", at: "2026-11-25T09:00:00" },
  { ...base, kind: "activity", id: 1, type: "note", text: "Wants samples", at: "2026-11-01T09:00:00",
    source: { kind: "deal", id: 7, name: "Linen" } },
];

function setup() {
  const handlers = { onToggleDone: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  renderWithProviders(<Timeline items={items} today="2026-11-26" {...handlers} />);
  return handlers;
}

test("entries are in the order given (A3)", () => {
  setup();
  const entries = screen.getAllByTestId("timeline-entry");
  expect(entries.map((e) => e.querySelector(".entry-text")?.textContent)).toEqual([
    "Called about cups",
    "Moved from Proposal to Negotiation",
    "Wants samples",
  ]);
  expect(entries[0]).toHaveTextContent("Today");
  expect(entries[1]).toHaveTextContent("Yesterday");
  expect(within(entries[2]).getByRole("link", { name: "Linen" })).toHaveAttribute("href", "/deals/7");
});

test("stage changes have no menu (A5)", () => {
  setup();
  const entries = screen.getAllByTestId("timeline-entry");
  expect(within(entries[0]).getByRole("button", { name: /actions for call/i })).toBeInTheDocument();
  expect(within(entries[1]).queryByRole("button")).not.toBeInTheDocument();
});

test("an overdue follow-up shows in the alert text color", () => {
  setup();
  const label = screen.getByText(/Follow up/).closest("label")!;
  expect(label).toHaveClass("overdue");
  expect(label).toHaveTextContent("Follow up 20 Nov 2026 (overdue)");
});

test("the done checkbox calls the update (A6)", async () => {
  const user = userEvent.setup();
  const handlers = setup();
  await user.click(screen.getByRole("checkbox", { name: /mark done/i }));
  expect(handlers.onToggleDone).toHaveBeenCalledWith(items[0], true);
});
