# Beacon — state of the build

Last updated: 2026-07-31

## Live

- **App:** deployed on Railway — the URL is deliberately not recorded here, because
  this repo is public and the app has no authentication. Get it from the Railway
  dashboard (project `beacon`) or `serviceDomainCreate` output.
- **Repo:** https://github.com/4elloworld/beacon (public — Railway's free tier cannot pull private repos)
- **Host:** Railway project `beacon`, single service, no database (the app is stateless)

Deploys are triggered from the Railway API against a specific commit. Pushing to
`master` alone does not deploy.

## What works end to end

Upload a General Ledger CSV → parsed client-side by PapaParse → posted to
`/api/analyze` → all six screens render that portfolio:

1. **Upload** — detects report type, shows row count and date range
2. **Analyze** — scan steps built from the real analysis; no auto-advance; does not re-animate on back-nav
3. **Dashboard** — real KPIs, per-property health, anomaly flags, live cost recalculation
4. **Key Takeaways** — narrative generated from the analysis
5. **Your Move** — top 3 actions naming real properties
6. **Remedies** — the same rocks plus a derived follow-up checklist

With no upload, every screen falls back to the scripted sample portfolio and the
Dashboard shows a "Sample portfolio" banner.

`/api/query` (Anthropic proxy) is live and returns on-brand answers, but nothing
in the UI calls it yet.

## Verified against the real export

`general_ledger-20260729.csv` — 7,986 rows, 43 properties, Jan–Dec 2025:
rent $664,776 · expenses $219,125 · 33% expense ratio · 168 flags (92 critical).

## The double-entry fix

The original analyzer summed the Debit column as income and Credit as expense.
An AppFolio general ledger is double-entry: every transaction appears twice, so
debit and credit totals are identical by construction and those sums meant
nothing. `dataClean.js` now classifies each row by the leading digit of its GL
account code — 4xxx income, 5xxx–7xxx expense, 1xxx–3xxx balance sheet — and
counts only the income/expense leg. Exports without account codes fall back to
the raw debit/credit sides.

## Known gaps

- **No AI chat in the UI.** `/api/query` works; nothing calls it.
- **Cost estimates are annual, rent is whatever the file covers.** Uploading a
  six-month export and applying an annual tax estimate overstates the true
  expense ratio. Should prorate by the date range.
- **Flag volume.** 168 flags on 43 properties. The list is capped at 12 with a
  "show all" toggle, but the rules could be tightened further.
- **Anomaly rules are heuristics.** Duplicate detection matches on description +
  amount + month, so legitimate repeat charges (identical monthly fees) can flag.
- **No auth.** Anyone with the URL can use it. Fine for a demo, not for real data.
- **Dead files:** `screens/Enhance.jsx`, `screens/Reveal.jsx`, `screens/KeepGoing.jsx`
  are no longer imported.
- **`docker-compose.yml` is stale** — it still describes the old two-service +
  Postgres layout. Production uses the root `Dockerfile` (multi-stage: build the
  React app, serve it from Express).

## Rotate this

The Railway API token used to deploy was shared in chat and should be replaced at
https://railway.app/account/tokens. The `ANTHROPIC_API_KEY` lives in Railway's
service variables, not in the repo.
