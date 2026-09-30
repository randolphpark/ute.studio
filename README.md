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

The build copies only `site/` into `dist/`, adds `.nojekyll`, and validates local assets and section links. Playwright checks desktop and mobile layouts, image loading, JavaScript errors, project dialogs, keyboard dismissal, navigation, service panels and the enquiry link.

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
- `site/assets/`: optimised WebP imagery, favicon and self-hosted fonts.
- `ASSETS.md`: image provenance and the exact generation prompts.

The work shown is self-initiated illustrative concept work. It is not presented as commissioned work for Stonegate Industries, MW Toolbox or other clients. The toolbox visual is an AI-generated study for possible 3D art direction, not a claim of a finished 3D production.

Barlow Condensed and Manrope are distributed under the SIL Open Font License; their licence files are included beside the fonts. The landing page uses no analytics, cookies or external font requests. Contact links open the visitor's email application; there is no form backend or promise that the mailbox has been provisioned.

## Custom domain

The repository's GitHub Pages custom domain is `www.ute.studio`. Cloudflare manages the following records with **DNS only** (proxy disabled) and automatic TTL:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | www | randolphpark.github.io |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

GitHub Pages manages the HTTPS certificate and redirects `ute.studio` to `www.ute.studio`. Enable **Enforce HTTPS** in the repository's Pages settings once the certificate is available. Cloudflare SSL and redirect settings do not apply to these DNS-only records. Preserve the existing email MX and TXT records.

Canonical and Open Graph URLs, `site/robots.txt`, and `site/sitemap.xml` use the production domain. This project publishes through GitHub Actions, so the custom domain is stored in Pages settings; a `CNAME` file is not required.
