import { expect, test } from "./fixtures";
import { api } from "./helpers";

const fact = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".fact").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");

test("add a deal and see it in the table __D2_D1", async ({ page, request }) => {
  const org = (await api(request).organizations({ sort: "name" })).items[0];
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await dialog.getByLabel("Name", { exact: true }).fill("Zinc counter polish");
  await dialog.getByRole("button", { name: "Organization: none chosen" }).click();
  await page.getByRole("textbox", { name: "Search organization" }).fill(org.name);
  await page.getByRole("button", { name: org.name }).click();
  await dialog.getByLabel("Value (US$)").fill("4200");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Deal saved")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search deals" }).fill("zinc counter");
  const row = page.getByRole("row", { name: /Zinc counter polish/ });
  await expect(row).toContainText(org.name);
  await expect(row).toContainText("New");
  await expect(row).toContainText("US$4,200");
  await expect(row).toContainText("10%");
});

test("a late deal shows the Late badge in the table and on its page __D6", async ({ page, request }) => {
  const late = (await api(request).deals()).items.find((d) => d.is_late)!;
  // Sample deal names can repeat across organizations, so pick the row by both.
  await page.goto(`/deals?q=${encodeURIComponent(late.name)}`);
  const row = page.locator("tbody tr").filter({ hasText: late.name }).filter({ hasText: late.organization_name });
  await expect(row.getByText("Late", { exact: true })).toBeVisible();
  await row.getByRole("cell", { name: late.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/deals/${late.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: late.name })).toBeVisible();
  await expect(fact(page, "Close date").getByText("Late", { exact: true })).toBeVisible();
});

test("edit the stage to Negotiation, then Lost, then reopen it __D3_D4_D4a_D7_D8", async ({ page, request }) => {
  const deal = (await api(request).deals()).items.find((d) => d.stage === "qualified")!;
  await page.goto(`/deals/${deal.id}`);
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  const timeline = page.getByRole("list", { name: "Timeline" });

  // To Negotiation: probability 75 and a stage change entry (D3, D7).
  await page.getByRole("button", { name: "Edit deal" }).click();
  let dialog = page.getByRole("dialog", { name: "Edit deal" });
  await dialog.getByLabel("Stage").selectOption("negotiation");
  await expect(dialog.getByLabel("Probability (%)")).toHaveValue("75");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(fact(page, "Probability")).toHaveText("75%");
  await expect(timeline.getByTestId("timeline-entry").first()).toContainText("Moved from Qualified to Negotiation");

  // To Lost with a reason: the close date is today, and the reason shows (D4, D8).
  await page.getByRole("button", { name: "Edit deal" }).click();
  dialog = page.getByRole("dialog", { name: "Edit deal" });
  await dialog.getByLabel("Stage").selectOption("lost");
  await expect(dialog.getByText("The close date will be set to today.")).toBeVisible();
  await dialog.getByLabel("Lost reason").fill("Price too high");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(fact(page, "Close date")).toHaveText("26 Nov 2026");
  await expect(fact(page, "Lost reason")).toHaveText("Price too high");
  await expect(timeline.getByTestId("timeline-entry").first()).toContainText(
    "Moved from Negotiation to Lost: Price too high",
  );

  // Reopen to Qualified: the reason leaves the page but stays in the timeline (D4a).
  await page.getByRole("button", { name: "Edit deal" }).click();
  dialog = page.getByRole("dialog", { name: "Edit deal" });
  await dialog.getByLabel("Stage").selectOption("qualified");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(fact(page, "Probability")).toHaveText("25%");
  await expect(fact(page, "Lost reason")).toHaveCount(0);
  await expect(page.getByText("Price too high")).toHaveCount(1);
  await expect(timeline).toContainText("Moved from Negotiation to Lost: Price too high");
  await expect(timeline.getByTestId("timeline-entry").first()).toContainText("Moved from Lost to Qualified");
});

test("delete a deal __D9", async ({ page, request }) => {
  const deal = (await api(request).deals({ sort: "name" })).items[0];
  const impact = await api(request).get<{ activities: number }>(`/deals/${deal.id}/delete-impact`);
  await page.goto("/deals");
  await page.getByRole("button", { name: `Actions for deal ${deal.name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete deal" });
  await expect(dialog).toContainText(`Delete ${deal.name}?`);
  if (impact.activities > 0) await expect(dialog).toContainText("and its stage history will be deleted.");
  await dialog.getByRole("button", { name: "Delete deal" }).click();
  await expect(page.getByText("Deal deleted")).toBeVisible();
  await expect(page.getByRole("cell", { name: deal.name, exact: true })).toHaveCount(0);
  const response = await request.get(`http://127.0.0.1:8100/api/deals/${deal.id}`);
  expect(response.status()).toBe(404);
});
