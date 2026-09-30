# UTE Studio

A responsive creative studio landing page for ute, trade and touring brands. Plain HTML, CSS and JavaScript with self-hosted fonts, original generated campaign imagery, accessible native project dialogs and email enquiries at **contact@ute.studio**.

## Local development

Requires Node.js 22 or newer (CI uses Node 24).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/ute.studio/`. The same project path is used locally and on GitHub Pages. Edit files in `site/` and refresh the page.

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

The expected URL is **https://randolphpark.github.io/ute.studio/**.

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

The initial deployment uses the GitHub project URL. To use `ute.studio`, configure that domain in GitHub Pages and its DNS provider, then update the canonical and Open Graph URLs in `site/index.html`, `site/robots.txt` and `site/sitemap.xml`. Add `site/CNAME` only after domain ownership and DNS are configured.
