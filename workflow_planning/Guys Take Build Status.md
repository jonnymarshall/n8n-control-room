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
| 8 | Artwork | Airtable `Status = Approved` | → `Artwork Ready` | 16×9 thumbnails, then 1×1 + 9×16 reversions | 📋 |
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
- 2026-06-08 — Added a PostToolUse hook (`.claude/hooks/airtable-trigger-fields-check.py`) that lints Airtable Trigger `Fields` config on every workflow build, the recurring Airtable-node failure mode.
