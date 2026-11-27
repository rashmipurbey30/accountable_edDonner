import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5273",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8100",
      url: "http://127.0.0.1:8100/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ACCOUNTABLE_DB: "data/e2e.db",
        ACCOUNTABLE_TEST_MODE: "1",
        ACCOUNTABLE_TODAY: "2026-11-26",
      },
    },
    {
      command: "npm run dev -w frontend",
      url: "http://localhost:5273",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { WEB_PORT: "5273", API_PORT: "8100" },
    },
  ],
});
