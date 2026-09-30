# UTE Studio Field Notes

The website stays on GitHub Pages. A Cloudflare Worker handles signup at `https://www.ute.studio/api/newsletter/*`, with D1 holding confirmation requests and consent receipts. Resend is the source of truth for subscribed/unsubscribed contacts and sends newsletters from **UTE Studio <news@ute.studio>**, with replies sent to **contact@ute.studio**.

This PR implements subscription and confirmation, not an automatic campaign sender. Write, preview, schedule and send actual newsletters from Resend Broadcasts. A website deployment never sends a campaign.

## Before enabling signup

Do these setup steps after the PR is reviewed and merged. Keep repository variable `NEWSLETTER_ENABLED` unset or `false` until the Worker and account settings are ready for a controlled launch. Without the public key, the website hides the entire signup section and makes no requests to Turnstile or the subscription API.

1. **Resend domain:** Add `ute.studio` under Domains and verify its sending DNS records in Cloudflare. Copy the exact records supplied by Resend. Preserve the existing Cloudflare Email Routing MX records at the root. Resend's sending verification may include MX/SPF at a return-path subdomain; this is distinct from receiving mail at `ute.studio`. Do not enable Resend inbound email or replace the root MX records for this feature. Review existing SPF/DMARC before changing those policies; never publish two SPF records at the same name. See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
2. **Sender and replies:** Verify the domain reaches Resend's verified state. The From address is `news@ute.studio`, and Reply-To is `contact@ute.studio`. Optionally add a Cloudflare Email Routing alias for `news@ute.studio` using the same destination as `contact@ute.studio`, so messages addressed directly to `news@` also reach you. Merely verifying the sending domain does not create an inbox.
3. **Mailing list:** Create a dedicated Resend Segment named `UTE Studio Field Notes`. Copy its UUID. Only confirmed subscribers from this flow belong in that segment. Use that segment for all Field Notes Broadcasts. This first version uses global unsubscribe preferences; don't assign a separate Topic without extending signup to handle topic opt-in.
4. **API key:** Create a Resend API key with permission to send email and read/create contacts and segment membership. A sending-only key cannot complete this flow. Keep the key out of source files, PR comments and chat messages.
5. **Turnstile:** Create a managed widget allowing `www.ute.studio`. Copy its public site key and secret key. The Worker verifies the token's hostname and `newsletter` action, not just success. See [server-side verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
6. **D1:** Create database `ute-studio-newsletter` in Cloudflare and copy its UUID. Migrations are in `worker/migrations/` and are applied by the deployment workflow. No subscriber database is committed to GitHub.
7. **GitHub settings:** Add the settings below. The `newsletter-production` environment can have required reviewers if desired; the deploy workflow is restricted to `main`.

Repository variables (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID |
| `NEWSLETTER_D1_ID` | D1 database UUID |
| `RESEND_SEGMENT_ID` | Dedicated Field Notes segment UUID |
| `NEWSLETTER_SITE_KEY` | Public Turnstile site key |
| `NEWSLETTER_ENABLED` | Leave `false` until launch verification is complete |

Secrets in the `newsletter-production` GitHub environment:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Scoped to the account's Workers Scripts and D1 edit access, and the `ute.studio` zone's Workers Routes edit access plus Zone read |
| `RESEND_API_KEY` | Email and contact/segment API access |
| `TURNSTILE_SECRET_KEY` | Server-side challenge verification |

The deployment job pipes the Resend and Turnstile secrets directly into Wrangler and stores them as Worker secrets. They are never included in the Pages build. Generated Worker configuration contains only resource IDs and non-secret settings and is gitignored.

## Deploy and launch

1. Merge the reviewed PR. The normal Pages pipeline still deploys the website with signup hidden.
2. Run **Actions → Deploy newsletter Worker → Run workflow**, choosing `main`. It tests the Worker, validates settings, applies D1 migrations, deploys the Worker route, and installs secrets. It does not send email. This is a separate, manual deployment so future Worker changes also require an intentional rollout after their PR is merged.
3. Confirm both web DNS records remain Cloudflare-proxied. The Worker route intercepts only `/api/newsletter/*`; all other paths continue to GitHub Pages. Keep API responses uncached, and don't add a Cache Everything rule over this path.
4. Confirm the sending domain is verified, both Worker secrets are installed, the D1 migration succeeded and the Turnstile widget allows `www.ute.studio`. A GET to `/api/newsletter/confirm?token=invalid` should return the branded invalid-link page with HTTP 410; a setup error returns 503.
5. For a controlled launch, set repository variable `NEWSLETTER_ENABLED=true`, then run **Validate and deploy UTE Studio** on `main` to display the form. Send one test confirmation only to an address whose owner has agreed to the test. Confirm that the contact appears in the correct segment only after pressing the confirmation button, and that the From/Reply-To addresses are correct. If verification fails, hide the form again using the rollback steps below. There is no need to expose a secret in HTML.
6. In Resend, prepare a Broadcast for the Field Notes segment. Include the platform's unsubscribe block (for custom HTML, use `{{{RESEND_UNSUBSCRIBE_URL}}}`), your sender identity and business contact details. Preview, approve and schedule each campaign in Resend. Verify the unsubscribe flow with your controlled test contact before a real campaign. See [Broadcasts](https://resend.com/docs/dashboard/broadcasts/introduction).

To hide signup, set `NEWSLETTER_ENABLED=false` and rerun the Pages workflow. Existing confirmation links keep working until they expire. To also disable the API, set the Worker's `ENABLED` variable to `false`; the next generated deployment will turn it back on. Do not delete the database or mailing list to roll back the form.

## Behaviour and data

- Signup requires an email, an explicit unchecked-by-default consent box, same-origin POST and a valid Turnstile token. The body is capped at 4 KiB; a honeypot handles obvious automated submissions.
- Only a confirmation email is sent at signup. A cryptographically random 32-byte token expires after 24 hours; only its SHA-256 hash is stored in D1. A duplicate signup within 10 minutes returns the same generic response without sending another email.
- Email links open a confirmation page. A separate POST button is required to enroll, preventing a scanner's GET request from subscribing someone. Confirmation responses are not cached, contain no external tracking assets, and suppress referrers.
- Resend contacts are created or added to the Field Notes segment only after confirmation. Existing global unsubscribes are never explicitly reset. Previously unsubscribed readers are directed to contact the studio for help; self-service re-subscription is intentionally deferred. Replaying a used token cannot resubscribe a contact.
- Provider failures show a retry message. A short database lock prevents simultaneous confirmations using the same token; failed requests release it, and abandoned locks expire after two minutes. Expired or consumed tokens cannot enroll contacts.
- Initial limits are 10 verified requests per IP/hour, 3 per email/hour and 100 total/day. Limits are shared across Worker instances via D1. IP/email limiter keys are salted hashes; raw IPs are not stored. Adjust limits through a reviewed code change as the audience grows.
- A daily scheduled handler deletes expired confirmation requests and rate counters and removes consent receipts older than 730 days. Resend retains the actual contact list and unsubscribe state independently.
- Worker logging is disabled and application code never logs addresses, tokens or provider responses. Keep URL/query logging disabled if adding observability, since confirmation URLs are bearer credentials.
- For a deletion request, delete the contact in Resend and use parameterized D1 operations to remove that address from `pending_subscriptions` and `subscription_consents`. A normal unsubscribe should retain Resend's suppression state rather than delete the contact. Resend handles campaign delivery, bounce and unsubscribe reporting; no webhook or duplicate subscription database is needed in this version.

## Development and checks

```sh
npm ci
npm run build
npm run test:worker
npm run worker:check
npm test
```

`test:worker` executes the actual Worker and D1 SQL in Miniflare with all outbound traffic intercepted. It cannot send real emails. Browser tests mock the Turnstile widget and signup API while exercising the real form. `worker:check` bundles with Wrangler without deploying.

For a visual preview of the form only:

```sh
NEWSLETTER_SITE_KEY=1x00000000000000000000AA npm run build
npm run preview
```

This is Cloudflare's public test site key, never a production key. It shows the form locally; the static preview server has no API backend. Use the browser tests for a fully mocked signup flow. Rebuild without the variable to restore the default hidden state.

For local Worker exploration, run `npm run worker:dev`. The checked-in config is disabled and uses a placeholder D1 ID. Set real local-only bindings through an ignored `.dev.vars` file if doing an explicitly authorized integration test. The production origin check intentionally rejects localhost POSTs; do not weaken it for a live deployment.

CI runs build, Worker tests, Worker dry-run and 18 desktop/mobile browser checks on each PR. Neither PR checks nor a main-branch Pages deployment sends a newsletter. The launch domain, key, database and segment still require real account setup and live verification; mocked tests do not prove email deliverability.
