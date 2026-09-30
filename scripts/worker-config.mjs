import { readFile, writeFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(new URL("../worker/wrangler.json", import.meta.url), "utf8"),
);
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
for (const key of ["NEWSLETTER_D1_ID", "RESEND_SEGMENT_ID"]) {
  if (
    !uuid.test(process.env[key] || "") ||
    process.env[key] === "00000000-0000-0000-0000-000000000000"
  )
    throw new Error(`Set ${key} to the real resource ID before deploying`);
}
config.d1_databases[0].database_id = process.env.NEWSLETTER_D1_ID;
config.vars.RESEND_SEGMENT_ID = process.env.RESEND_SEGMENT_ID;
config.vars.ENABLED = "true";
await writeFile(
  new URL("../worker/wrangler.generated.json", import.meta.url),
  JSON.stringify(config, null, 2) + "\n",
);
console.log("Prepared newsletter Worker configuration. No secrets written.");
