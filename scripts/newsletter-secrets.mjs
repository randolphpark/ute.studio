import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const secrets = {};
for (const key of ["RESEND_API_KEY", "TURNSTILE_SECRET_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
  secrets[key] = process.env[key];
}
// Keep secret material on the child's stdin, never stdout or command arguments.
const childEnv = { ...process.env };
delete childEnv.RESEND_API_KEY;
delete childEnv.TURNSTILE_SECRET_KEY;
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
    ),
    "secret",
    "bulk",
    "--config",
    fileURLToPath(
      new URL("../worker/wrangler.generated.json", import.meta.url),
    ),
  ],
  { stdio: ["pipe", "inherit", "inherit"], env: childEnv },
);
child.stdin.on("error", () => {}); // Wrangler's exit status reports failures.
child.stdin.end(JSON.stringify(secrets));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
