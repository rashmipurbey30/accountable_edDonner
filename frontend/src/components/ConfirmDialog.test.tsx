import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ConfirmDialog, deleteMessage } from "./ConfirmDialog";

describe("delete wording (T6)", () => {
  test.each([
    [
      { contacts: 4, deals: 3, activities: 12 },
      "Delete Northwind Supply? Its 3 deals and their 12 activities will be deleted. Its 4 contacts will be kept, with no organization.",
    ],
    [
      { contacts: 1, deals: 1, activities: 1 },
      "Delete Northwind Supply? Its 1 deal and their 1 activity will be deleted. Its 1 contact will be kept, with no organization.",
    ],
    [
      { contacts: 0, deals: 2, activities: 0 },
      "Delete Northwind Supply? Its 2 deals will be deleted.",
    ],
    [
      { contacts: 2, deals: 0, activities: 0 },
      "Delete Northwind Supply? Its 2 contacts will be kept, with no organization.",
    ],
    [{ contacts: 0, deals: 0, activities: 0 }, "Delete Northwind Supply? Nothing else is affected."],
  ])("organization %o", (impact, expected) => {
    expect(deleteMessage("organization", "Northwind Supply", impact)).toBe(expected);
  });

  test.each([
    [{ deals: 2, activities: 5 }, "Delete Pat Lee? Their 5 activities will be deleted. Their 2 deals will be kept, with no main contact."],
    [{ deals: 0, activities: 1 }, "Delete Pat Lee? Their 1 activity will be deleted."],
    [{ deals: 1, activities: 0 }, "Delete Pat Lee? Their 1 deal will be kept, with no main contact."],
    [{ deals: 0, activities: 0 }, "Delete Pat Lee? Nothing else is affected."],
  ])("contact %o", (impact, expected) => {
    expect(deleteMessage("contact", "Pat Lee", impact)).toBe(expected);
  });

  test.each([
    [{ activities: 3 }, "Delete Linen? Its 3 activities and its stage history will be deleted."],
    [{ activities: 0 }, "Delete Linen? Its stage history will be deleted."],
  ])("deal %o", (impact, expected) => {
    expect(deleteMessage("deal", "Linen", impact)).toBe(expected);
  });

  test("activity", () => {
    expect(deleteMessage("activity", "call")).toBe("Delete this call? This can't be undone.");
  });
});

describe("ConfirmDialog", () => {
  test("shows the wording and a Raspberry delete button", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        kind="deal"
        name="Linen"
        impact={{ activities: 2 }}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete deal" });
    expect(dialog).toHaveTextContent("Delete Linen? Its 2 activities and its stage history will be deleted.");
    const button = screen.getByRole("button", { name: "Delete deal" });
    expect(button).toHaveClass("btn-danger");
    await user.click(button);
    expect(onConfirm).toHaveBeenCalled();
  });

  test("waits for the counts before offering Delete", () => {
    render(<ConfirmDialog open onOpenChange={() => {}} kind="contact" name="Pat" loading onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Delete contact" })).toBeDisabled();
  });
});
