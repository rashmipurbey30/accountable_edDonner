import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { mockFetch, renderWithProviders } from "../test/render";
import { ActivityForm } from "./ActivityForm";

test("the date defaults to now, and description is required (A1)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [201, { id: 1 }]);
  const onOpenChange = vi.fn();
  renderWithProviders(
    <ActivityForm open onOpenChange={onOpenChange} owner={{ contact_id: 4 }} now="2026-11-26T14:05:00" />,
  );
  expect(screen.getByLabelText("When it happened")).toHaveValue("2026-11-26T14:05");
  expect(screen.getByRole("radio", { name: "Note" })).toBeChecked();

  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Write what happened")).toBeInTheDocument();
  expect(calls).toHaveLength(0);

  await user.click(screen.getByRole("radio", { name: "Call" }));
  await user.type(screen.getByLabelText("Description"), "Talked prices");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toMatchObject({
    method: "POST",
    url: "/api/activities",
    body: { type: "call", description: "Talked prices", occurred_at: "2026-11-26T14:05:00", follow_up_date: null, contact_id: 4 },
  });
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("type and date are required (A1)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [201, {}]);
  renderWithProviders(<ActivityForm open onOpenChange={() => {}} owner={{ deal_id: 2 }} now="2026-11-26T14:05:00" />);
  await user.clear(screen.getByLabelText("When it happened"));
  await user.type(screen.getByLabelText("Description"), "x");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Choose when it happened")).toBeInTheDocument();
  expect(calls).toHaveLength(0);
});

test("a description over 2,000 characters is refused (A1)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [201, {}]);
  renderWithProviders(<ActivityForm open onOpenChange={() => {}} owner={{ deal_id: 2 }} now="2026-11-26T14:05:00" />);
  const box = screen.getByLabelText("Description");
  await user.click(box);
  await user.paste("x".repeat(2001));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Keep it to 2,000 characters")).toBeInTheDocument();
  expect(calls).toHaveLength(0);
});
