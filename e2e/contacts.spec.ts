import { expect, test } from "./fixtures";
import { api } from "./helpers";

test("filter by Lead: the count matches the rows __C2", async ({ page, request }) => {
  const leads = (await api(request).contacts({ status: "lead" })).total;
  await page.goto("/contacts");
  const lead = page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: /^Lead/ });
  await expect(lead).toContainText(String(leads));
  await lead.click();
  await expect(lead).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/status=lead/);
  await expect(page.getByText(`Showing 1–${Math.min(leads, 25)} of ${leads}`)).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(Math.min(leads, 25));
  await expect(page.locator("tbody .badge", { hasText: "Lead" })).toHaveCount(Math.min(leads, 25));
  await expect(page.locator("tbody .badge", { hasText: /Qualified|Customer/ })).toHaveCount(0);
});

test("search within the filter survives a refresh __C1_C2_T7", async ({ page, request }) => {
  const client = api(request);
  const lead = (await client.contacts({ status: "lead", sort: "name" })).items[0];
  const word = lead.name.split(" ")[1].toLowerCase();
  const expected = await client.contacts({ status: "lead", q: word });

  await page.goto("/contacts");
  await page.getByRole("button", { name: /^Lead/ }).click();
  await page.getByRole("searchbox", { name: "Search contacts" }).fill(word);
  await expect(page).toHaveURL(new RegExp(`q=${word}`));
  await expect(page.locator("tbody tr")).toHaveCount(expected.total);

  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search contacts" })).toHaveValue(word);
  await expect(page.getByRole("button", { name: /^Lead/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("tbody tr")).toHaveCount(expected.total);
  await expect(page.getByRole("cell", { name: lead.name, exact: true })).toBeVisible();
});

test("an invalid email is refused, then fixed and saved __C3", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await dialog.getByLabel("Name").fill("Imogen Testwell");
  await dialog.getByLabel("Email").fill("abc");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Enter a valid email address, like name@example.com")).toBeVisible();
  await dialog.getByLabel("Email").fill("imogen@testwell.example.com");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Contact saved")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("testwell");
  await expect(page.getByRole("row", { name: /Imogen Testwell/ })).toContainText("imogen@testwell.example.com");
});

test("a search with no matches shows the empty state, and its button clears it __T8", async ({ page }) => {
  await page.goto("/contacts");
  const search = page.getByRole("searchbox", { name: "Search contacts" });
  await search.fill("zz");
  await expect(page.getByText("No contacts match 'zz'")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(25);
});

test("deleting a deal's main contact keeps the deal, with no main contact __C4_C5", async ({ page, request }) => {
  const client = api(request);
  const deal = (await client.deals()).items.find((d) => d.main_contact_id !== null)!;
  const contactId = deal.main_contact_id!;
  const impact = await client.get<{ deals: number; activities: number }>(`/contacts/${contactId}/delete-impact`);

  await page.goto(`/contacts/${contactId}`);
  await expect(page.getByRole("heading", { level: 1, name: deal.main_contact_name! })).toBeVisible();
  await expect(page.locator("ul.linked").getByRole("link", { name: deal.name })).toBeVisible();

  await page.getByRole("button", { name: "Delete contact" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete contact" });
  await expect(dialog).toContainText(`Delete ${deal.main_contact_name}?`);
  await expect(dialog).toContainText(`Their ${impact.deals} deal${impact.deals === 1 ? "" : "s"} will be kept, with no main contact.`);
  await dialog.getByRole("button", { name: "Delete contact" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByText("Contact deleted")).toBeVisible();

  await page.goto(`/deals/${deal.id}`);
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  await expect(page.getByRole("link", { name: deal.main_contact_name! })).toHaveCount(0);
});
