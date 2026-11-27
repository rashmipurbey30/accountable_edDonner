import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { api } from "./helpers";

const entries = (page: Page) => page.getByRole("list", { name: "Timeline" }).getByTestId("timeline-entry");

async function logActivity(page: Page, type: "Note" | "Call" | "Email", text: string, followUp?: string) {
  await page.getByRole("button", { name: "Log activity" }).click();
  const dialog = page.getByRole("dialog", { name: "Log activity" });
  await dialog.getByRole("radio", { name: type }).check();
  await dialog.getByLabel("Description").fill(text);
  if (followUp) await dialog.getByLabel("Follow-up date").fill(followUp);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Activity saved").first()).toBeVisible();
}

test("a note with a follow-up logged on a contact goes to the top __A1_A3", async ({ page, request }) => {
  const contact = (await api(request).contacts({ sort: "name" })).items[0];
  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByRole("heading", { level: 1, name: contact.name })).toBeVisible();
  await logActivity(page, "Note", "Asked for the spring price list", "2026-11-28");
  const top = entries(page).first();
  await expect(top).toContainText("Asked for the spring price list");
  await expect(top).toContainText("Today");
  await expect(top).toContainText("Follow up 28 Nov 2026");
});

test("a call on a deal shows on the deal and on its main contact __A2_A4", async ({ page, request }) => {
  const deal = (await api(request).deals()).items.find((d) => d.main_contact_id !== null)!;
  await page.goto(`/deals/${deal.id}`);
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  await logActivity(page, "Call", "Walked through the delivery schedule");
  await expect(entries(page).first()).toContainText("Walked through the delivery schedule");

  await page.getByRole("link", { name: deal.main_contact_name! }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: deal.main_contact_name! })).toBeVisible();
  const top = entries(page).first();
  await expect(top).toContainText("Walked through the delivery schedule");
  await expect(top.getByRole("link", { name: deal.name })).toBeVisible();
});

test("edit an activity, then delete one after confirming __A5", async ({ page, request }) => {
  const contact = (await api(request).contacts({ sort: "name" })).items[0];
  await page.goto(`/contacts/${contact.id}`);
  await logActivity(page, "Email", "Sent the catalogue");
  await logActivity(page, "Note", "Prefers mornings");

  // Edit the newest.
  await entries(page).first().getByRole("button", { name: "Actions for note" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit activity" });
  await expect(dialog.getByLabel("Description")).toHaveValue("Prefers mornings");
  await dialog.getByLabel("Description").fill("Prefers calls before 10am");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(entries(page).first()).toContainText("Prefers calls before 10am");

  // Delete the email, after confirming.
  const email = entries(page).filter({ hasText: "Sent the catalogue" });
  await email.getByRole("button", { name: "Actions for email" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete email" });
  await expect(confirm).toContainText("Delete this email? This can't be undone.");
  await confirm.getByRole("button", { name: "Delete email" }).click();
  await expect(page.getByText("Activity deleted")).toBeVisible();
  await expect(email).toHaveCount(0);
  await expect(entries(page).first()).toContainText("Prefers calls before 10am");
});

test("mark a follow-up done __A6", async ({ page, request }) => {
  const contact = (await api(request).contacts({ sort: "name" })).items[0];
  await page.goto(`/contacts/${contact.id}`);
  await logActivity(page, "Call", "Check on the order", "2026-11-30");
  const box = entries(page).first().getByRole("checkbox", { name: "Mark done: follow up 30 Nov 2026" });
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(entries(page).first().getByRole("checkbox", { name: /Mark done/ })).toBeChecked();
});
