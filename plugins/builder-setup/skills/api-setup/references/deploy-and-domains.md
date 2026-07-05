# Deploy & Domains

Reference for shipping and putting a domain in front of the Worker. Adapt to the
project — these are the reliable defaults, not a mandated ritual.

## Auth

Two ways, pick per context:
- **`wrangler login`** — interactive, fine for a dev machine.
- **`CLOUDFLARE_API_TOKEN`** env var — for CI or a non-interactive box. Create the
  token in the dashboard (see below).

## A deploy that reproduces cleanly

`wrangler deploy` alone works, but a release that won't surprise you tends to do,
in order:

1. clean checkout
2. inject the instance `wrangler.jsonc` (it's gitignored — CI pulls it from a
   secret or generates it from the `.example`)
3. `pnpm install --frozen-lockfile`
4. build any web/client bundle it serves (if applicable)
5. `wrangler d1 migrations apply <db> --remote` — migrate prod DB *before* the code
   that expects the new schema goes live
6. `wrangler deploy`

The first `wrangler deploy` gives you a `https://<name>.<subdomain>.workers.dev`
URL — hit it to confirm before touching domains.

Migrations are idempotent (wrangler tracks applied ones), so re-running the
sequence is safe.

## Custom domain — CLI vs dashboard

**Doable from CLI (`wrangler.jsonc` + deploy):**
```jsonc
"routes": [{ "pattern": "api.example.com", "custom_domain": true }]
```
`wrangler deploy` then creates the custom-domain binding. The zone must already
exist on the account (that part is dashboard-only).

**Dashboard-only (do these in Chrome):**
- **Add the zone:** dash.cloudflare.com → *Add a site* → enter the domain → copy
  the **two nameservers** Cloudflare gives you and set them at your registrar
  (가비아 / Route53 / etc.). Wait for the zone to go *Active*.
- **API token:** *My Profile → API Tokens → Create Token* with scopes
  **Workers Scripts: Edit**, **D1: Edit**, and the right **Account** scope. Store
  it as `CLOUDFLARE_API_TOKEN` (CI secret / local env). Tokens are shown once.
- **(Alternative to CLI routes)** *Workers & Pages → your Worker → Settings →
  Domains & Routes* to attach a custom domain via GUI. Use this *or* the
  `wrangler.jsonc` `routes` — not both for the same hostname.
- **Verify:** the DNS record is *proxied* (orange cloud) and SSL is active before
  calling it done.

## Observability — and a real footgun

- `wrangler tail` streams live logs while you reproduce something.
- ⚠️ **On the Free plan, Workers Logs sampling is aggressive — events are
  frequently dropped.** Do not rely on `tail` for anything you must not miss. For
  diagnostics that matter, put the signal in the **response payload** or in
  **structured logs with explicit categories** you control, rather than trusting
  sampled platform logs.
- Optional later: Workers Analytics; Logpush on paid plans.
