import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { mockFetch, renderWithProviders } from "../../test/render";
import { ContactForm } from "./ContactForm";

test("name is required (C3)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [201, {}]);
  renderWithProviders(<ContactForm open onOpenChange={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Enter a name")).toBeInTheDocument();
  expect(calls).toHaveLength(0);
});

test("'abc' is refused as an email, and an empty email is accepted (C3)", async () => {
  const user = userEvent.setup();
  const calls = mockFetch(() => [201, { id: 9, name: "Ana Ruiz" }]);
  const onOpenChange = vi.fn();
  renderWithProviders(<ContactForm open onOpenChange={onOpenChange} />);
  await user.type(screen.getByLabelText("Name"), "Ana Ruiz");
  await user.type(screen.getByLabelText("Email"), "abc");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Enter a valid email address, like name@example.com")).toBeInTheDocument();
  expect(calls).toHaveLength(0);

  await user.clear(screen.getByLabelText("Email"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toMatchObject({
    method: "POST",
    url: "/api/contacts",
    body: { name: "Ana Ruiz", email: null, organization_id: null, status: "lead" },
  });
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
