# Requirements Document — Version 2

## Project Purpose & Scope
- Goal: Deliver Version 2 focusing only on **Dashboard**, **SMTP Settings**, **Templates**, and new **Click Tracking** feature.
- Out of scope: **Workers**, **Contact Manager**, **Performance metrics** (removed unless explicitly requested later).

## Current vs Desired Features
- Current: Full app with Workers, Contact Manager, Performance metrics, Dashboard, SMTP, Templates.
- Desired V2:
  - Dashboard — redesigned UI & specific metrics (to be confirmed by client).
  - SMTP Settings — support for common SMTP providers and a reworked UI for configuration & testing.
  - Templates — enhanced management (variables, preview, versioning).
  - Click Tracking — capture link clicks, store per-email & aggregate stats, and present in UI.

## Click Tracking — Implementation Approach
- Replace links with tracked redirect URLs: `/api/tracking/click/{clickId}?url={encodedDest}`
- On redirect: log click (email id, recipient, timestamp, link identifier, UA, IP, geolocation optional), then 302 -> destination.
- Data model (ClickTracking): `{ clickId, emailId, recipientEmail, originalUrl, clickedAt, clickCount, lastClicked, userAgent, recipientIp }`
- Pixel tracking continues to use: `/api/tracking/pixel/{pixelId}` to log opens.
- UI: per-email detail view showing link list with counts, first/last click times; aggregated Dashboard widgets: total clicks, unique clickers, top links.
- Acceptance criteria: Links are tracked and logged reliably in staging; UI displays per-email and aggregate stats.

## UI/UX Redesign Requirements (high-level)
- Deliver wireframes (low-fidelity) and high-fidelity mockups for Desktop and Mobile for:
  - Dashboard (primary metrics prioritized by client)
  - SMTP Settings (provider presets + manual config + test connection)
  - Template management (editor, preview, import/export, history)

## Acceptance Criteria & Definition of Done
- UI mockups approved by client.
- Click tracking implemented and visible in email detail and dashboard widgets.
- SMTP supports provider presets and manual config; connection test available and records health checks.
- Workers, Contacts, Performance features removed or hidden and documented.
- End-to-end tests for SMTP flows and click-tracking redirects.

## Risks & Assumptions
- Deliverability/spam risk from redirects — deliverability tests required.
- Some providers prefer API-based sending — we assume SMTP coverage satisfies the client.
- Removal of features may require migration or export for existing users.

## Rough Timeline Estimate
- Discovery & confirm requirements: 2–4 days
- Wireframes & design: 4–7 days
- Implementation (SMTP + Templates + Click tracking + Dashboard): 2–3 weeks
- QA + deliverability testing + adjustments: 1 week
- Total: ~4–6 weeks (subject to client confirmation)

---
_Last updated: 2026-01-06_
