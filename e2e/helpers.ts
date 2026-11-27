import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { API, expect } from "./fixtures";

/** Read the seeded data through the API, so tests look things up instead of hard-coding them. */
export function api(request: APIRequestContext) {
  const get = async <T>(path: string, params?: Record<string, string | number>): Promise<T> => {
    const response = await request.get(`${API}${path}`, { params });
    expect(response.ok(), `GET ${path}`).toBeTruthy();
    return (await response.json()) as T;
  };
  const send = async <T>(method: "post" | "patch", path: string, data: unknown): Promise<T> => {
    const response = await request[method](`${API}${path}`, { data });
    expect(response.ok(), `${method.toUpperCase()} ${path}`).toBeTruthy();
    return (await response.json()) as T;
  };
  return {
    get,
    post: <T>(path: string, data: unknown) => send<T>("post", path, data),
    patch: <T>(path: string, data: unknown) => send<T>("patch", path, data),
    organizations: (params: Record<string, string | number> = {}) =>
      get<{ items: { id: number; name: string; deals_count: number; contacts_count: number }[]; total: number }>(
        "/organizations",
        { page_size: 100, ...params },
      ),
    contacts: (params: Record<string, string | number> = {}) =>
      get<{
        items: { id: number; name: string; status: string; organization_id: number | null }[];
        total: number;
        status_counts: Record<string, number>;
      }>("/contacts", { page_size: 100, ...params }),
    deals: (params: Record<string, string | number> = {}) =>
      get<{
        items: {
          id: number;
          name: string;
          stage: string;
          is_late: boolean;
          main_contact_id: number | null;
          main_contact_name: string | null;
          organization_name: string;
        }[];
        total: number;
      }>("/deals", { page_size: 100, ...params }),
    pipeline: () =>
      get<{
        totals: { open_value: number; open_expected: number; open_count: number };
        columns: { stage: string; count: number; value: number; expected: number; deals: { id: number; name: string; value: number; probability: number }[] }[];
      }>("/pipeline"),
    dashboard: () => get<Record<string, unknown> & { revenue_won: number; deals_won: number }>("/dashboard"),
    meta: () => get<{ today: string; now: string }>("/meta"),
  };
}

/**
 * Drag with the mouse in steps. dnd-kit ignores a single jump, and needs a first move
 * past its 6px activation distance before it starts dragging.
 */
export async function dragCard(page: Page, card: Locator, target: Locator, { yOffset = 0 } = {}) {
  const from = (await card.boundingBox())!;
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 4, { steps: 4 });
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + yOffset, { steps: 25 });
  await page.waitForTimeout(150);
  const again = (await target.boundingBox())!;
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2 + yOffset, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}
