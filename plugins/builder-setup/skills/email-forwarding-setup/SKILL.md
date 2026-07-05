---
name: email-forwarding-setup
description: >-
  Use when the user wants to receive mail at a custom-domain address — a vanity or
  feedback address like hello@yourdomain.com or feedback@yourdomain.com — without
  hosting a mailbox, by forwarding it to a real inbox via Cloudflare Email Routing
  (free, receive/forward only). The domain must already be on Cloudflare. Triggers:
  "cloudflare 이메일 포워딩", "커스텀 도메인으로 메일 받기", "feedback@도메인 만들기",
  "email routing 셋업", "vanity email forwarding".
---

# Cloudflare Email Routing — forwarding setup

Goal: publish `<EXPOSED_ADDRESS>` (e.g. `hello@example.com`) and forward all mail
sent to it into `<DESTINATION_INBOX>` (e.g. `me@gmail.com`), using Cloudflare Email
Routing. Free, and **receive/forward only**.

## Inputs (ask the user if any are missing)
- `DOMAIN` — the custom domain; MUST already be on Cloudflare (nameservers pointing
  to Cloudflare).
- `EXPOSED_ADDRESS` — the address to publish, e.g. `hello@example.com`.
- `DESTINATION_INBOX` — the real inbox to forward to, e.g. `me@gmail.com`.

## Ground rules (do not skip)
- **This changes the domain's live DNS** (adds MX + SPF/DKIM records). If the domain
  already receives mail somewhere, enabling can break it. Run `dig +short MX <DOMAIN>`
  FIRST; if it returns records for another provider, stop and confirm with the user
  before proceeding.
- Cloudflare Email Routing is **receive/forward only**. Sending *as*
  `<EXPOSED_ADDRESS>` needs separate SMTP (out of scope) — the user just replies from
  their normal inbox.
- Never enter the user's credentials. If not logged in, ask them to log into
  Cloudflare themselves.
- Clicking the destination **verification link** and enabling the service are the
  user's decisions — confirm irreversible steps; do them via the browser but surface
  what will happen.

## Steps (browser automation)
1. Load the Chrome tools in one call, then call `tabs_context_mcp` first and open a
   new tab:
   ```
   ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__find"
   ```
2. Navigate to `https://dash.cloudflare.com/?to=/:account/<DOMAIN>/email/routing`
   (redirects into the newer "Email Service" UI). If a login screen appears, hand off
   to the user.
3. **Destination Addresses** tab → if `<DESTINATION_INBOX>` is not already listed as
   **Verified**, type it into the add field and click **Add address**. Cloudflare
   emails a verification link to that inbox — the **user must click it** (you cannot).
   Wait until it shows **Verified**.
4. **Routing rules** tab → **Create routing rule**:
   - Email pattern: `<local part of EXPOSED_ADDRESS>` `@` `<DOMAIN>` (pick the domain
     in the dropdown)
   - Action: **Send to an email**
   - Destination: `<DESTINATION_INBOX>` (must be verified)
   - **Save** → the rule should read **Active**.
5. **Enable Email Routing** so the MX records actually publish (Overview → an "Enable
   Email Routing" / DNS-records prompt). Then verify per below.

## CRITICAL — verify against real DNS, NOT the dashboard
The new Email Service UI reports **contradictory status**: the header may say
`Disabled` / `DNS Not configured` while Settings lists the MX records as `Locked` and
only offers a red **Disable** button. **Do not trust the UI.** The source of truth is
public DNS:

```sh
dig +short MX <DOMAIN>                          # SUCCESS = route1/2/3.mx.cloudflare.net
dig +short TXT <DOMAIN>                          # SPF (optional; not needed to receive)
dig +short TXT cf2024-1._domainkey.<DOMAIN>      # DKIM — selector may rotate over time; if empty,
                                                 #   read the current selector from the dashboard DNS records
# sanity-check dig itself if MX is empty:
dig +short MX google.com
```

- **MX empty** → routing is NOT live yet, regardless of what the dashboard claims. The
  service still needs enabling. Trigger the enable flow, then re-run `dig` until the
  three `route*.mx.cloudflare.net` records appear (also check via `@1.1.1.1` and
  `@8.8.8.8`).
- **MX empty + only a red "Disable" button + analytics showing traffic** = a
  stale/half-migrated UI state. DNS truth wins.
- **Never click the red "Disable" button** — it removes all DNS records and tears the
  service down.
- The Cloudflare **API** (`POST /zones/{zone}/email/routing/enable`) is an
  alternative, but a scoped D1/Workers token will `10000 "Authentication error"`
  without the Email Routing permission — the browser path is the reliable default.

## Done when
`dig +short MX <DOMAIN>` returns the three `route*.mx.cloudflare.net` records. Mail to
`<EXPOSED_ADDRESS>` now lands in `<DESTINATION_INBOX>`. Tell the user to send one test
email to confirm end-to-end (Cloudflare handles SRS, so forwarding works even without
an SPF record on the domain).
