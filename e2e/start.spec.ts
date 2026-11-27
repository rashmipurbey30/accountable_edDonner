import { expect, test } from "./fixtures";

const SECTIONS = ["Dashboard", "Organizations", "Contacts", "Deals", "Pipeline"];

test("the app loads on the dashboard __G1", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page).toHaveTitle("Accountable");
});

test("every section opens from the top bar with its title __G7", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Sections" });
  for (const name of SECTIONS) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("an unknown address shows page not found", async ({ page }) => {
  await page.goto("/nowhere");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to the dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});
