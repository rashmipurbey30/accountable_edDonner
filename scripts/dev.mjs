// Starts the backend and the frontend together. Ctrl+C stops both.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import concurrently from "concurrently";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "data"), { recursive: true });

console.log("\nStarting Accountable. Open http://localhost:5173 in your browser.");
console.log("Press Ctrl+C to stop.\n");

const { result } = concurrently(
  [
    {
      name: "api",
      command: "uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8000",
      prefixColor: "cyan",
    },
    { name: "web", command: "npm run dev -w frontend", prefixColor: "green" },
  ],
  { cwd: root, killOthersOn: ["failure", "success"], prefix: "name" },
);

result.then(
  () => process.exit(0),
  () => process.exit(0),
);
