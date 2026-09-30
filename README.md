# UTE Studio

A responsive creative studio landing page for ute, trade and touring brands. Plain HTML, CSS and JavaScript with self-hosted fonts, original generated campaign imagery, accessible native project dialogs and email enquiries at **contact@ute.studio**.

## Local development

Requires Node.js 22 or newer (CI uses Node 24).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/ute.studio/`. Relative asset URLs support both this local project path and the production domain root. Edit files in `site/` and refresh the page.

## Build and verify

```sh
npm run build
npx playwright install chromium
npm test
npm run preview
```

The build copies only `site/` into `dist/`, adds `.nojekyll`, and validates local assets and section links. It rejects empty links, bare `#` placeholders, insecure HTTP URLs and unsupported URL schemes. Playwright checks every navigation link, all three project previews and their images and enquiry addresses, all four service panels, keyboard dismissal, desktop and mobile layouts, asset loading and JavaScript errors. New link destinations must be covered by these checks before deployment.

The generated HTML includes content-based version queries for CSS, JavaScript, the wordmark and favicon, so changed assets get fresh URLs after deployment.

## Change workflow

Create a feature branch and open a pull request for every new change. Do not push changes directly to `main`. Run the build and browser checks before requesting review, and wait for approval before merging. Merging into `main` triggers the existing Pages deployment; pull request checks do not publish the site.

## GitHub Pages deployment

`.github/workflows/pages.yml` validates every pull request targeting `main`. Pushes to `main` and manual workflow runs build, test, upload the static artifact and deploy it to the `github-pages` environment. Deployment runs only after browser checks pass. No personal access token or external hosting account is needed by the workflow.

The production URL is **https://www.ute.studio/**. GitHub Pages redirects the original project URL, `https://randolphpark.github.io/ute.studio/`, to the custom domain.

In repository **Settings → Pages**, select **GitHub Actions** as the publishing source. GitHub Pages must be enabled before the deployment job can succeed. A private repository requires a GitHub plan that supports Pages; alternatively, the repository owner can choose to make the repository public. Repository visibility is not changed by the workflow.

Workflow permissions are `contents: read` for checkout and `pages: write` plus `id-token: write` for deployment. Pull request builds have no deployment permissions. Only the `dist/` directory is uploaded.

After Pages has been enabled, publish with:

```sh
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml
```

## Content and assets

- `site/index.html`: content, email address and SEO metadata.
- `site/styles.css`: layout, fonts, colours, responsive rules and reduced-motion support.
- `site/app.js`: mobile navigation and project preview content.
- `site/assets/`: optimised WebP imagery, SVG wordmark and favicon, and self-hosted fonts.
- `brand/ute-studio-avatar.svg`: scalable square avatar for social profiles, kept outside the website build.
- `ASSETS.md`: image and logo provenance and the exact image generation prompts.

The work shown is self-initiated illustrative concept work. It is not presented as commissioned work for Stonegate Industries, MW Toolbox or other clients. The toolbox visual is an AI-generated study for possible 3D art direction, not a claim of a finished 3D production.

Barlow Condensed and Manrope are distributed under the SIL Open Font License; their licence files are included beside the fonts. The application sets no cookies and loads fonts locally. Production uses Cloudflare Web Analytics as described below. Contact links open the visitor's email application; there is no form backend. `contact@ute.studio` has an enabled Cloudflare Email Routing rule; email delivery has not been tested by sending a message.

## Custom domain

The repository's GitHub Pages custom domain is `www.ute.studio`. Cloudflare manages the following records with **Proxied** enabled (orange cloud) and automatic TTL:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | www | randolphpark.github.io |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

Cloudflare serves its Universal SSL certificate for `ute.studio` and `*.ute.studio`, uses **Full (strict)** encryption to GitHub Pages, and enforces **Always Use HTTPS**. The `UTE Studio canonical domain` Single Redirect rule sends `ute.studio` to `https://www.ute.studio`, preserving paths and query strings. It excludes `/.well-known/acme-challenge/` so certificate validation requests can reach the origin. Existing email MX and TXT records remain DNS-only.

HTTPS enforcement is handled by Cloudflare. Keep the web records proxied: direct HTTPS access to GitHub Pages with the custom hostname also requires a GitHub-issued certificate, which is a separate certificate from Cloudflare's edge certificate. If switching to DNS-only, first verify that GitHub Pages has issued its certificate and enabled **Enforce HTTPS**.

Canonical and Open Graph URLs, `site/robots.txt`, and `site/sitemap.xml` use the production domain. This project publishes through GitHub Actions, so the custom domain is stored in Pages settings; a `CNAME` file is not required.

## Web analytics

Cloudflare Web Analytics is enabled for the `ute.studio` zone with automatic installation. Cloudflare injects the beacon into production HTML served through its proxy; local previews and GitHub's origin HTML do not contain an analytics script. Do not add another beacon to `site/index.html`, as that would duplicate collection.

View traffic and performance in the Cloudflare account's **Web Analytics → ute.studio** dashboard. Analytics uses Cloudflare's cookie-free Web Analytics service, with the beacon loaded from `static.cloudflareinsights.com` and measurements sent to the site's `/cdn-cgi/rum` endpoint. Dashboard data may take a few minutes to appear. Automatic installation requires the website DNS records to remain proxied.
