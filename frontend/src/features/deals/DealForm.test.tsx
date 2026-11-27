import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { mockFetch, renderWithProviders } from "../../test/render";
import { DealForm } from "./DealForm";

const probability = () => screen.getByLabelText("Probability (%)");
const stage = () => screen.getByLabelText("Stage");

test("changing the stage fills in its usual probability, and a typed one survives until the stage changes (D3)", async () => {
  const user = userEvent.setup();
  mockFetch(() => [200, []]);
  renderWithProviders(<DealForm open onOpenChange={() => {}} />);
  expect(probability()).toHaveValue(10);

  await user.selectOptions(stage(), "proposal");
  expect(probability()).toHaveValue(50);

  await user.clear(probability());
  await user.type(probability(), "60");
  await user.type(screen.getByLabelText("Name"), "Linen contract");
  expect(probability()).toHaveValue(60);

  await user.selectOptions(stage(), "negotiation");
  expect(probability()).toHaveValue(75);
});

test("the lost reason appears only for Lost (D2)", async () => {
  const user = userEvent.setup();
  mockFetch(() => [200, []]);
  renderWithProviders(<DealForm open onOpenChange={() => {}} />);
  expect(screen.queryByLabelText("Lost reason")).not.toBeInTheDocument();
  await user.selectOptions(stage(), "lost");
  expect(screen.getByLabelText("Lost reason")).toBeInTheDocument();
  await user.selectOptions(stage(), "won");
  expect(screen.queryByLabelText("Lost reason")).not.toBeInTheDocument();
});

test("organization is required and a value of -1 is refused (D2)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [200, []]);
  renderWithProviders(<DealForm open onOpenChange={() => {}} />);
  await user.type(screen.getByLabelText("Name"), "Linen contract");
  await user.type(screen.getByLabelText("Value (US$)"), "-1");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Choose an organization")).toBeInTheDocument();
  expect(screen.getByText("Enter whole US dollars, 0 or more")).toBeInTheDocument();
  expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
});

test("choosing Won shows that the close date will be set to today (D4)", async () => {
  const user = userEvent.setup();
  mockFetch(() => [200, []]);
  renderWithProviders(<DealForm open onOpenChange={() => {}} />);
  expect(screen.queryByText("The close date will be set to today.")).not.toBeInTheDocument();
  await user.selectOptions(stage(), "won");
  expect(screen.getByText("The close date will be set to today.")).toBeInTheDocument();
  await user.selectOptions(stage(), "lost");
  expect(screen.getByText("The close date will be set to today.")).toBeInTheDocument();
});
