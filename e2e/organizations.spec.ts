import { expect, test } from "./fixtures";
import { api } from "./helpers";

test("add an organization and find it by search __T4_T1_O2", async ({ page }) => {
  await page.goto("/organizations");
  await page.getByRole("button", { name: "Add organization" }).click();
  const dialog = page.getByRole("dialog", { name: "Add organization" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Enter a name")).toBeVisible();
  await dialog.getByLabel("Name").fill("Zephyr Juice Bar");
  await dialog.getByLabel("Industry").fill("Restaurants and cafés");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Organization saved")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search organizations" }).fill("zephyr");
  await expect(page.getByRole("row")).toHaveCount(2); // header + one
  await expect(page.getByRole("cell", { name: "Zephyr Juice Bar", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=zephyr/);
});

test("sort by name both ways __T2", async ({ page, request }) => {
  const names = (await api(request).organizations({ sort: "name" })).items.map((o) => o.name);
  await page.goto("/organizations");
  const firstName = page.locator("tbody tr").first().locator("td").first();
  // The list starts sorted by name, A to Z, so the first click reverses it.
  await expect(firstName).toHaveText(names[0]);
  await expect(page.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page).toHaveURL(/dir=desc/);
  await expect(firstName).toHaveText(names[names.length - 1]);
  await expect(page.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "descending");
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page).toHaveURL(/dir=asc/);
  await expect(firstName).toHaveText(names[0]);
});

test("page 2 survives a refresh __T3_T7", async ({ page, request }) => {
  const client = api(request);
  for (let i = 0; i < 10; i++) await client.post("/organizations", { name: `Extra Org ${i}` });
  await page.goto("/organizations");
  await expect(page.getByText("Showing 1–25 of 30")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 26–30 of 30")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Showing 26–30 of 30")).toBeVisible();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous" })).toBeEnabled();
});

test("edit an organization's industry __O2", async ({ page, request }) => {
  const org = (await api(request).organizations()).items[0];
  await page.goto("/organizations");
  await page.getByRole("button", { name: `Actions for organization ${org.name}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit organization" });
  await expect(dialog.getByLabel("Name")).toHaveValue(org.name);
  await dialog.getByLabel("Industry").fill("Wholesale");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(org.name) })).toContainText("Wholesale");
});

test("open an organization with deals and delete it __O3_O4_T6", async ({ page, request }) => {
  const client = api(request);
  const org = (await client.organizations()).items.find((o) => o.deals_count > 0 && o.contacts_count > 0)!;
  const impact = await client.get<{ contacts: number; deals: number; activities: number }>(
    `/organizations/${org.id}/delete-impact`,
  );
  const detail = await client.get<{ contacts: { id: number; name: string }[]; deals: { id: number; name: string }[] }>(
    `/organizations/${org.id}`,
  );

  await page.goto("/organizations");
  await page.getByRole("cell", { name: org.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/organizations/${org.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: org.name })).toBeVisible();
  for (const d of detail.deals) await expect(page.getByRole("link", { name: d.name })).toBeVisible();

  await page.getByRole("button", { name: "Delete organization" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete organization" });
  const plural = (n: number, word: string) =>
    n === 1 ? `1 ${word}` : `${n} ${word.endsWith("y") ? word.slice(0, -1) + "ies" : word + "s"}`;
  await expect(dialog).toContainText(
    `Delete ${org.name}? Its ${plural(impact.deals, "deal")} and their ${plural(impact.activities, "activity")} will be deleted. Its ${plural(impact.contacts, "contact")} will be kept, with no organization.`,
  );
  await dialog.getByRole("button", { name: "Delete organization" }).click();
  await expect(page).toHaveURL(/\/organizations$/);
  await expect(page.getByText("Organization deleted")).toBeVisible();

  // Its contacts stay, with no organization.
  await page.goto(`/contacts/${detail.contacts[0].id}`);
  await expect(page.getByRole("heading", { level: 1, name: detail.contacts[0].name })).toBeVisible();
  await expect(page.getByText(org.name)).toHaveCount(0);

  // Its deals are gone from the Deals table and the board.
  await page.goto(`/deals?q=${encodeURIComponent(org.name)}`);
  await expect(page.getByText(`No deals match '${org.name}'`)).toBeVisible();
  const board = await client.pipeline();
  const ids = board.columns.flatMap((c) => c.deals.map((d) => d.id));
  for (const d of detail.deals) expect(ids).not.toContain(d.id);
});
