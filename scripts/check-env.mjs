// Checks that the tools Accountable needs are installed, and says how to get them if not.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const problems = [];
const warnings = [];

const major = Number(process.versions.node.split(".")[0]);
if (major < 24) {
  problems.push(
    `Node.js ${process.versions.node} is too old. Install the LTS version (24 or later) from https://nodejs.org, then open a new terminal.`,
  );
}

try {
  execSync("uv --version", { stdio: "ignore" });
} catch {
  problems.push(
    "uv isn't installed (it runs the Python backend). Install it with the command at https://docs.astral.sh/uv/getting-started/installation/, then open a new terminal.",
  );
}

const chromePaths = {
  win32: [
    `${process.env["PROGRAMFILES"]}\Google\Chrome\Application\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\Google\Chrome\Application\chrome.exe`,
    `${process.env["LOCALAPPDATA"]}\Google\Chrome\Application\chrome.exe`,
  ],
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"],
};
const candidates = chromePaths[process.platform] ?? [];
if (candidates.length && !candidates.some((p) => existsSync(p))) {
  warnings.push(
    "Google Chrome wasn't found. The app works in any browser, but the tests need Chrome: https://www.google.com/chrome/",
  );
}

for (const w of warnings) console.warn(`Note: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`Problem: ${p}`);
  process.exit(1);
}
