import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Option } from "../api/types";
import { renderWithProviders } from "../test/render";
import { EntityPicker } from "./EntityPicker";

const ALL: Option[] = [
  { id: 1, name: "Atlas Logistics" },
  { id: 2, name: "Brightwell Hotels" },
  { id: 3, name: "Harbor Street Café" },
];

const load = async (q: string) => ALL.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));

test("typing filters the options", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderWithProviders(
    <EntityPicker label="Organization" value={null} onChange={onChange} load={load} loadKey={["orgs"]} />,
  );
  await user.click(screen.getByRole("button", { name: /organization/i }));
  expect(await screen.findByRole("button", { name: "Brightwell Hotels" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);

  await user.type(screen.getByRole("textbox", { name: "Search organization" }), "harb");
  await vi.waitFor(() => expect(screen.queryByRole("button", { name: "Brightwell Hotels" })).not.toBeInTheDocument());
  await user.click(await screen.findByRole("button", { name: "Harbor Street Café" }));
  expect(onChange).toHaveBeenCalledWith(ALL[2]);
});

test("'None' is offered only when the field is optional", async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <EntityPicker label="Organization" value={null} onChange={() => {}} load={load} loadKey={["orgs"]} />,
  );
  await user.click(screen.getByRole("button", { name: /organization/i }));
  await screen.findByRole("button", { name: "Atlas Logistics" });
  expect(screen.queryByRole("button", { name: "None" })).not.toBeInTheDocument();
  view.unmount();

  const onChange = vi.fn();
  renderWithProviders(
    <EntityPicker label="Main contact" value={ALL[0]} onChange={onChange} load={load} loadKey={["c"]} optional />,
  );
  await user.click(screen.getByRole("button", { name: /main contact/i }));
  await user.click(await screen.findByRole("button", { name: "None" }));
  expect(onChange).toHaveBeenCalledWith(null);
});
