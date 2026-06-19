# Guy's Take — Build Status

> Living tracker for every workflow in the Guy's Take automation. Tick these off one by one.
> Plan: `Guys Take Workflow (Annotated).md`. Last updated: 2026-06-09.

Status key: ✅ built · 🔨 building · 📋 planned · ⏸️ blocked (needs a decision/credential)

| # | Workflow | Trigger | Status transition | Concern | Build |
|---|---|---|---|---|---|
| 0 | Episode status → Telegram notify | Airtable record change | (any) → Telegram | Foundational Airtable↔Telegram pipe | ✅ `GbFwXLACjj1O6spS` |
| 1 | Scheduling | Schedule (Thu) + Telegram callback | → `Scheduled` | Create episode/session, propose slots, confirm, calendar event | 📋 |
| 2 | Weekly Research & Shortlisting | Schedule (Fri 7am ET) | Episode `Research Ready`; Shortlist `Shortlisted` | Scrape YouTube, cluster, score, digest top 8 | ✅ `Z9dDjafBA899Hgok` |
| 2b | Telegram pick buttons + callback | Telegram button callback | Shortlist → `Picked` | Inline "Pick" buttons on the Friday digest; callback sets Picked | 📋 (interim: pick conversationally via the Telegram Airtable Assistant `peTIs4kiluFZHoLg`) |
| 3 | Script generation | Airtable `Shortlist.Status = Picked` (Picked view) | Episode created → `Script Ready` | Picked topic → fetch Active sponsor → full asset package (titles/captions/SEO/storyboard/dynamic sponsor beat/refs) → Episode + Telegram | ✅ `q80QVMszf2iOfwIy` — built + tested end-to-end; activate when ready |
| 4 | Recording confirmation | Time offset (`Record Date` + 2h) | → `Recorded` | Prompt confirm recording done | 📋 |
| 5 | Edited detection (Frame.io) | Frame.io webhook (asset/version uploaded) | → `Edited` | Match uploaded cut to Episode, store asset ID | ⏸️ needs Frame.io creds + event names |
| 6 | Transcription (Frame.io) | Frame.io transcript-ready (webhook or poll) | → `Transcript Ready` | Pull transcript, store on Episode | ⏸️ needs transcript-API confirmation |
| 7 | AI metadata | Airtable `Status = Transcript Ready` | → `AI Analysis Complete` → `Approved` | Titles, thumbnail captions, description, chapter markers; approval | 📋 |
| 8 | Artwork | Airtable `Status = Approved` (+ pick path on `Awaiting Thumbnail Pick`) | → `Artwork Ready` | Phase A (16×9 generate + select) built; 1×1 + 9×16 reversions = Phase B | 🔨 `YyXiJ0lusoW7ynu9` — Phase A built, INACTIVE pending Airtable schema + Gemini key |
| 9 | Publishing fan-out | Airtable `Status = Artwork Ready` | → `Published` | Distribute to the 7 publishing channels | 📋 |
| 10 | Social sweep 24h | Schedule (publish + 24h) | (no status change) | Engagement sweep across interaction channels | 📋 |
| 11 | Social sweep 48h | Schedule (publish + 48h) | (no status change) | Engagement sweep across interaction channels | 📋 |

**Total: ~12 workflows** (10 numbered stages + the foundational pipe #0 + the pick-buttons helper #2b).
Editing itself stays fully manual (no workflow). #10 and #11 may merge into one parameterised sweep.

## Related, already built (not Guy's Take stages, but in the same n8n)
- Telegram Airtable Assistant `peTIs4kiluFZHoLg` — conversational read/write agent; source of the inline-button approval pattern reused by #2b.
- n8n GitHub backup `pvgMbQRltazRuZjt` — daily workflow-JSON backup.

## Change log
- 2026-06-07 — Doc created. Decisions: 1 Picked topic = 1 Episode; picking via Telegram buttons; Frame.io for edited-detection + transcription. Started building #3.
- 2026-06-07 — #3 Script generation built (`q80QVMszf2iOfwIy`), inactive. Blocked on Shortlist `Last Modified Time` field + `Scripted` status option, and Episodes `Summary`/`Script`/`References`/`Source Shortlist` fields. See its readme.
- 2026-06-09 — #3 schema set up + tested end-to-end. Upgraded to mirror the `guys-take-script` skill (full asset package) and pull the sponsor dynamically from a `Sponsors` table (Active row). Trigger scoped to a locked Picked view. Hardened against several Airtable/n8n gotchas (Fields list formatting, `$env` blocked → hardcoded chat ID, view-filter scoping, Mark-Scripted no longer zeroes research fields). Picking is currently done by telling the Telegram Airtable Assistant to mark a story Picked; that agent's approval/confirmation messages were also simplified.
- 2026-06-19 — Added Shlink shortener step for Episode `References` URLs in workflow #3 (Module 5 only; falls back to long URLs if Shlink fails).
- 2026-06-08 — Added a PostToolUse hook (`.claude/hooks/airtable-trigger-fields-check.py`) that lints Airtable Trigger `Fields` config on every workflow build, the recurring Airtable-node failure mode.
- 2026-06-09 (rev) — #8 rebuilt on a NORMALIZED schema (Jonny's redesign): new `Thumbnails` table (one row per option) + static `Thumbnail References` library (mood + Guy headshot). Generate path now: `gemini-2.5-flash` picks 4 moods from the library → one Nano Banana 16:9 per mood (ref photo inline + shared caption) → 4 Thumbnails rows (Proposed) + Telegram album. Select path: set a row `Status=Selected` → rejects siblings → Episode `Artwork Ready`. Selection is row-status, not a number field. Pending: create the 2 tables + Episodes additions, populate References, Gemini Header Auth cred, attach creds to HTTP nodes, and paste the Thumbnails table ID into the `Thumbnail Selected` trigger (+ add Last Modified Time to Thumbnails). Guests deferred. See its readme.
- 2026-06-09 — #8 Artwork Phase A built (`YyXiJ0lusoW7ynu9`), INACTIVE. Two Airtable-triggered paths (generate on `Approved`, select on `Awaiting Thumbnail Pick`). Uses Nano Banana (`gemini-2.5-flash-image`) for 4 16×9 options, stores as Airtable attachments, Telegram album. Decisions: selection via an Airtable `Chosen Thumbnail` number field (NOT Telegram buttons — the Assistant `peTIs4kiluFZHoLg` owns the bot's only webhook); host-photo reference per episode (`Reference Photos`); caption via new `Thumbnail Caption` field (manual until #7). Pending before activation: Episodes fields (`Thumbnail Caption`/`Reference Photos`/`Thumbnail Options`/`Chosen Thumbnail`/`Thumbnail 16x9`), Status options `Awaiting Thumbnail Pick`+`Artwork Ready`, two views, and a billing-enabled Gemini key as Header Auth cred `Gemini API Key [n8n]`. Nano Banana is NOT free (~$0.16/run). 1×1+9×16 reversioning = Phase B. See its readme.
