import { test as base, expect } from "@playwright/test";

export const API = "http://127.0.0.1:8100/api";

interface Fixtures {
  /** Console messages a test expects (e.g. a failed request it forced). */
  allowConsole: (pattern: RegExp) => void;
}

/**
 * Every test starts from freshly seeded data, and fails if the page logs a console
 * error or warning, or throws (G7).
 */
export const test = base.extend<Fixtures & { _problems: string[]; _allowed: RegExp[] }>({
  _allowed: async ({}, use) => {
    await use([]);
  },
  _problems: async ({}, use) => {
    await use([]);
  },
  allowConsole: async ({ _allowed }, use) => {
    await use((pattern) => _allowed.push(pattern));
  },
  page: async ({ page, request, _problems, _allowed }, use) => {
    const reset = await request.post(`${API}/test/reset`);
    expect(reset.ok(), "reset the test database").toBeTruthy();
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        _problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => _problems.push(`uncaught: ${error.message}`));
    await use(page);
    const unexpected = _problems.filter((p) => !_allowed.some((re) => re.test(p)));
    expect(unexpected, "console errors or warnings").toEqual([]);
  },
});

export { expect };
