import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const source = resolve("site");
const output = resolve("dist");
// Only the public site directory is ever included in the deployment artifact.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await writeFile(join(output, ".nojekyll"), "");

let html = await readFile(join(output, "index.html"), "utf8");
const newsletterSiteKey = process.env.NEWSLETTER_SITE_KEY || "";
if (newsletterSiteKey && !/^[A-Za-z0-9_-]{20,100}$/.test(newsletterSiteKey))
  throw new Error("NEWSLETTER_SITE_KEY must be a public Turnstile site key");
html = html.replace(
  'data-newsletter-sitekey=""',
  `data-newsletter-sitekey="${newsletterSiteKey}"`,
);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate HTML IDs");
const refs = [...html.matchAll(/\b(?:src|href|srcset)="([^"]+)"/g)].map(
  (match) => match[1],
);
for (const ref of refs) {
  if (!ref.trim() || ref === "#")
    throw new Error("Empty or placeholder link: use a real destination");
  if (/^[a-z][a-z\d+.-]*:/i.test(ref) && !/^(?:https:|mailto:|data:)/.test(ref))
    throw new Error(`Unsupported or insecure URL: ${ref}`);
  if (/^(?:https?:|mailto:|data:)/.test(ref)) continue;
  if (ref.startsWith("#")) {
    if (ref.length > 1 && !ids.includes(ref.slice(1)))
      throw new Error(`Missing section: ${ref}`);
    continue;
  }
  const path = resolve(output, ref);
  if (!path.startsWith(output + "/"))
    throw new Error(`Asset outside deployment: ${ref}`);
  await stat(path).catch(() => {
    throw new Error(`Missing public asset: ${ref}`);
  });
}
const css = await readFile(join(output, "styles.css"), "utf8");
for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))
  await stat(resolve(output, match[1]));
if (!html.includes("mailto:contact@ute.studio"))
  throw new Error("Missing enquiry email");
// Refresh changed code and branding even when browsers or Cloudflare cache assets.
for (const asset of [
  "styles.css",
  "app.js",
  "newsletter.js",
  "assets/ute-studio-logo.svg",
  "assets/favicon.svg",
]) {
  const version = createHash("sha256")
    .update(await readFile(join(output, asset)))
    .digest("hex")
    .slice(0, 12);
  html = html.replaceAll(`"${asset}"`, `"${asset}?v=${version}"`);
}
await writeFile(join(output, "index.html"), html);
let bytes = 0;
async function measure(path) {
  for (const file of await readdir(path, { withFileTypes: true })) {
    const full = join(path, file.name);
    if (file.isDirectory()) await measure(full);
    else bytes += (await stat(full)).size;
  }
}
await measure(output);
console.log(
  `Built and validated dist/ (${(bytes / 1024 / 1024).toFixed(2)} MB).`,
);
