# Content Machine — Build Status & Roadmap

> Living tracker for every workflow in the Pod21 / Guy's Take content machine. Tick items off one by one.
> Expanded 2026-07-06 from the original Guy's Take stage tracker to cover the whole system: **Part 0** orients an implementer (human or AI), **Part 1** is the original per-stage tracker, **Part 2** is the phased system roadmap, and the **change log** records history.
> Filename kept as `Guys Take Build Status.md` so existing cross-references in `n8n_workflow_readmes/` stay valid.
> Narrative pipeline plan: `Guys Take Workflow (Annotated).md` (same folder). Jonny's raw plan: `Guys Take Workflow.md` (never edit).

Status key: ✅ built · 🔨 building · 📋 planned · ⏸️ blocked (needs a decision/credential)

---

## Part 0 — Orientation for implementers (READ FIRST)

This section exists so the plan can be executed in a fresh session by any model with no prior context. Read it before touching anything.

### 0.1 What this system is

A content-production machine for the **Guy's Take** Bitcoin podcast (and the broader Pod21 brand), built on three pillars:

1. **Airtable is the single source of truth and the state machine.** Base `app8Xw9Tq0XLjhmp9`. Episodes advance through a `Status` single-select; each n8n workflow is triggered by state (a status/view change), does one job, and advances the status. Workflows never call each other directly.
2. **n8n executes the automation.** Self-hosted (Contabo VPS, n8n 2.15 with task runner). Workflows are built/updated from this repo via the n8n MCP (`create_workflow_from_code` / `update_workflow` with SDK-style JS). SDK sources live in `scripts/deploy/workflows/`.
3. **Telegram is the team interface.** One bot (`@pod21_n8n_agent_bot`) serves Jonny's DM and the team group. The **Telegram Airtable Assistant** workflow holds the bot's ONLY trigger; every other workflow may *send* but never *trigger* on that bot.

**The core design rule that makes the system flexible:** because every stage triggers off Airtable *state*, a human doing any step by hand (setting a status, filling a field) is indistinguishable from the automation doing it. Preserve this in everything you build. Never trigger stage N from stage N-1's workflow.

### 0.2 Source-of-truth map

| What | Where |
|---|---|
| Per-workflow documentation (node-by-node, gotchas, credentials, schema) | `n8n_workflow_readmes/<workflow name>.md` — **read the readme before touching a workflow** |
| Cross-workflow rules (record-ID-in-every-message, trigger fields, naming) | `n8n_workflow_readmes/CONVENTIONS.md` |
| Workflow SDK sources (partial coverage; see Phase 0.6) | `scripts/deploy/workflows/*.sdk.js` |
| Live workflow JSON backups (daily 3am, one commit per change) | `github.com/jonnymarshall/n8n-backups` |
| Enforcement hooks (lint Airtable trigger fields, Telegram record-ID, manual-edit guard, secret blocking). **Claude Code only; under opencode do these by hand per `AGENTS.md`** | `.claude/hooks/` |
| Canonical state machine + per-stage precondition checklists (the assistant's "brain") | `workflow_planning/System Map.md` — live copy in Airtable `Prompts` table (`tblhG1nw2P1k3CBVU`, row `System Map`); **edit the Airtable row, then sync the repo file** |
| This roadmap + status | this file |

Workflow IDs change when a workflow is rebuilt from code (create-new + archive-old), so **the workflow NAME is the stable identifier**; IDs below are "at time of writing".

### 0.3 Key IDs, credentials, constants

| Item | Value |
|---|---|
| Airtable base (Guy's Take) | `app8Xw9Tq0XLjhmp9` |
| `Episodes` table | `tbl3uYLIvtB9APZp6` |
| `Shortlist` table | `tblED3N6WdT1tQTzY` |
| `Stories` table | `tblVUgJeZd2ZCicGV` |
| `Sponsors` table | `tbl6sfPWRXmcLutxX` |
| `Thumbnails` / `Thumbnail References` / `Guests` tables | created in Airtable UI; get IDs from the base (the Thumbnails table ID is pasted into the artwork workflow's trigger) |
| Telegram team group | `-5254203539` |
| Jonny DM | `1512868522` · Charlie `8923732358` |
| Bot | `@pod21_n8n_agent_bot` |
| n8n credentials (exact names) | `Airtable [n8n] (PAT)` · `Telegram [pod21_n8n_agent_bot]` · `OpenRouter [n8n]` · `Gemini API Key [n8n]` (Header Auth `x-goog-api-key`) · `Adobe OAuth` (oAuth2Api) · `Airtable PAT (Bearer)` · `GitHub [n8n-backups]` · `n8n account` (n8nApi, base URL MUST be `http://localhost:5678/api/v1`) |

### 0.4 Non-negotiable platform constraints (hard-won; violating any of these has already caused real breakage)

1. **One Telegram trigger per bot, instance-wide.** Activating a second workflow with a Telegram Trigger on this bot silently steals the Assistant's webhook. All human input flows through Airtable state changes or the Assistant's callback routing. Sending is unrestricted.
2. **`$env` is blocked** in expressions (`N8N_BLOCK_ENV_ACCESS_IN_NODE`). Constants (chat IDs etc.) are hardcoded in nodes; centralize via SDK `constants.js` (Phase 0.6), not `$env`.
3. **Code nodes cannot make HTTP calls** on this task runner (`$helpers` and `fetch` are undefined). Download/upload via HTTP Request node + `Extract From File` (binary → base64 property).
4. **`$getWorkflowStaticData()` hangs the task runner forever** (no output, no error). Never use it. Persist cross-run state in Airtable.
5. **n8n REST `PUT /workflows/{id}` deactivates the workflow and strips `availableInMCP`.** After any API push: re-activate + re-toggle MCP in the UI. MCP `update_workflow` saves a draft; you must publish.
6. **Credential auto-assignment skips HTTP Request nodes on every push.** After each push, open every HTTP node and rebind (readmes list which credential each node needs). OAuth2 creds can be referenced by name in SDK using the `oAuth2Api` key. Beware: n8n may auto-fill a wrong same-type credential (the AgentMail-on-Gemini-nodes incident).
7. **Airtable Trigger `Fields` option:** leave EMPTY (whole record). If you must restrict: include the trigger field itself and use commas with NO spaces. A PostToolUse hook lints this.
8. **Airtable polling triggers fire on `Last Modified Time` advancing past a stored cursor, not on presence in a view.** Processed rows MUST leave the trigger view (status flip) or they re-fire / shadow new rows. Every publish re-baselines the poller cursor to ~now; test with a fresh flip after any push.
9. **Telegram messages: force `parse_mode: HTML` and escape `& < >`.** Default Markdown parsing breaks on underscores in titles. Every message about a record must include its ID (`BA-xxxx`) in a `<code>` block (see `CONVENTIONS.md`; a hook checks this).
10. **`sendMediaGroup` needs static media slots** (2–10); an array expression on `media.media` fails. Pad short sets.
11. **AI tool sub-nodes have no On Error toggle:** set Options → Response → **Never Error** so API failures return to the agent for self-correction.
12. **Add config-level `Retry On Fail`** (sibling of `onError`) to critical external calls — the host hits transient `EAI_AGAIN` DNS failures, and Gemini returns transient 503s under load (exec #1514, 2026-07-29). n8n caps this at `maxTries: 5` / `waitBetweenTries: 5000`, so ~20s of cover; a longer outage still fails the run. **Only retry idempotent calls.** Reads and LLM generation are safe; anything that creates or appends is not — resumable-upload byte pushes (retry re-sends at offset 0 into a half-consumed session), POSTs that mint resources (duplicate review links), and Airtable `uploadAttachment` (appends, so a retry doubles the attachment).
13. **Structured Output Parser (v1.3) validates types strictly.** If a field is an integer, the system prompt must say so with a worked example (`[02:14] → the integer 134, NOT "02:14"`); set model `maxTokens ≥ 8192` for long JSON.
14. **Don't paste `=`-prefixed expressions into UI fields** (the editor adds its own `=`, producing a literal `=...` string).
15. **Manual-edit guard:** a PreToolUse hook blocks `update_workflow` if Jonny edited the workflow in the n8n UI since the repo last synced; pull `get_workflow_details` and reconcile first. **Do this by hand too, regardless of the hook:** before any push, extract each live `jsCode` / system message and diff it against the `.sdk.js`. On 2026-08-11 that caught real drift in the assistant's system message and stopped an unrelated sentence being overwritten as a side effect.
16. **Frame.io V4:** no transcript API (trigger + media source only); responses wrap payloads in `data`; audio files have `media_links.efficient.download_url: null` (pick renditions with `.find(r => r && r.download_url)`); duration comes from Gemini, not Frame.io.
17. **Airtable attachment upload (Content API):** `POST content.airtable.com/v0/{base}/{recordId}/{fieldName}/uploadAttachment`, field name BEFORE `/uploadAttachment`, JSON body `{contentType, filename, file: <base64>}`, 5 MB cap.
18. **Gemini image gen (`gemini-3-pro-image`):** default `imageSize: 1K` (2K causes frequent `IMAGE_OTHER` no-image responses); bare model id.
19. **Workflow naming convention:** name = trigger, not actions (e.g. `BA - Frame.io Uploaded > AI Metadata`). Prefixes: `BA - ` for Guy's Take pipeline, `Pod21:` for brand-wide AND infrastructure (Jonny's call 2026-07-06: the error handler was renamed from `Ops - …` to `Pod21: …`; there is no separate `Ops` prefix).
20. **Don't click "Load Schema" / refresh fields** on mapped Airtable nodes in the UI: it wipes column mappings.

### 0.5 Design rules for every new workflow ("bulletproof AND forgiving")

1. **Trigger off state, never off another workflow.** Manual completion of any step must trigger the next stage identically.
2. **Flip the record out of the trigger view FIRST** (the `Generating Artwork` pattern) so a mid-run failure can't re-loop the trigger.
3. **Idempotent and re-runnable:** clear-then-create for generated artifacts, upsert keys for imports, explicit override conventions (`_Bypass` filename marker, force-regenerate checkboxes).
4. **Fail loud, degrade soft:** wire `settings.errorWorkflow` to the Ops error handler (Phase 0.1); use `onError: continueRegularOutput` only where a miss is genuinely tolerable; put Airtable writes BEFORE Telegram sends so data lands even if notification fails.
5. **Log completion:** append one `Ops Log` row at the end of every run (Phase 0.2).
6. **Manual is a valid state, not a failure** (`Awaiting Manual Artwork` pattern; publishing channels can be `Manual` forever).
7. **Notify the team group** (`-5254203539`), not DMs, for anything pipeline-related, with the record ID in `<code>`.

---

## Part 1 — Guy's Take stage tracker

| # | Workflow | Trigger | Status transition | Concern | Build |
|---|---|---|---|---|---|
| 0 | Episode status → Telegram notify | Airtable record change | (any) → Telegram | Foundational Airtable↔Telegram pipe | ✅ `GbFwXLACjj1O6spS` — **inactive, superseded** by purposeful per-stage messages; archive (Phase 0.7) |
| 1 | Scheduling | Schedule (Thu) + callback via Assistant | → `Record Date` set | Propose slots, confirm, calendar event | 📋 → **Phase 2.3** |
| 2 | Weekly Research & Shortlisting | Schedule (Fri 7am ET) | Shortlist `Shortlisted` | Scrape 11 BTC YouTube channels, cluster, score, digest top 8 | ✅ `Z9dDjafBA899Hgok` — ACTIVE |
| 2b | Pick buttons on Friday digest | Telegram button callback (via Assistant) | Shortlist → `Picked` | One-tap picking | 📋 → **Phase 2.1** (interim: pick conversationally via the Assistant) |
| 3 | Script generation | Airtable `Shortlist.Status = Picked` | Episode created → `Script Ready` | GPT 5.1 talking-head script, PicoCSS slideshow, sponsor beat | ✅ `q80QVMszf2iOfwIy` — ACTIVE |
| 4 | Recording confirmation | Schedule (hourly scan) | → `Recorded` | Nudge + one-tap confirm after `Record Date + 2h` | 📋 → **Phase 2.2** |
| 5+6+7 | Frame.io upload → transcript → AI metadata | Frame.io `file.ready` webhook | → `AI Analysis Complete` | Gemini transcription, GPT 5.1 titles/captions/description/chapters, Telegram doc **+ a `Send Packaging Request` message** asking for title, caption, guests, thumbnail moods and a **required custom image prompt**. `_Bypass` + same-length short-circuits | ✅ `jroXHciDvy0sWlRM` — LIVE since 2026-06-16; audio uploads also transcribed (2026-06-29); packaging message added 2026-08-11 (⚠️ **UNTESTED**) |
| 8 | Artwork | Thumbnails: `Ready for 16X9 Thumbnail` view (generate) + **`Ready for 1X1 & 9X16 Thumbnails *J*`** view (pick; renamed 2026-08-20 from `Selected`, still no type filter) + **`Revision Requested` view (revise)** | → `Artwork Ready` | Type-aware (Take/Chat/Clip/**Roundtable** all auto). 4× Nano Banana 16:9; prompts in Airtable `Prompts` table; **moods + art direction now chosen by Jonny** (`Thumbnail Moods` / `Custom Image Prompt`, the latter gating the trigger view) rather than by a Gemini step; on pick: reject+unlink siblings (all types), 1:1 + 9:16 reversions (Phase B) **except `Clip`/`Read`/`Audionauts` (2026-08-20)**; **Path 3: briefed in-place targeted revisions** (2026-07-26) | ✅ **`mLAn4ya2AmZoHDUk`** — **ACTIVE**, SDK-sourced (`guys-take-thumbnail-artwork.sdk.js`), old `YyXiJ0lusoW7ynu9` archived. Phase B + Path-3 revisions tested. ✅ Jonny-picked moods **TESTED 2026-08-11** (exec #1752, a `Chat`: `moodSource: picked`, his 2 moods cycled ABAB) after fixing an unpublished-draft push and a wrong field name. ⚠️ Roundtable auto-gen **UNTESTED** — and was silently broken until 2026-08-11 (fetched no guest photos). 🚫 Clip/Read/Audionauts reversion skip **added 2026-08-20, UNTESTED** (pushed? see change log). 🎨 Greyscale-subjects bug **fixed 2026-08-11 in the Airtable prompts, UNVERIFIED** (`recQmzSDextFHnXAa`): the layout templates had been left with no colour instruction at all, so the model desaturated the people; all three now carry a `COLOUR — NON-NEGOTIABLE` block |
| 8b | Publish gate | Airtable view entered | → `Ready to Publish` | View-based gate onto publishing | ✅ `7O9z3UwcUOkHjAC2` (`Airtable - View to Published`) — ACTIVE; **document the view's filters + rename** (Phase 0.7) |
| 9 | Publishing fan-out | Airtable `Status = Ready to Publish` | → `Published` (per-channel rows) | Normalized `Publications` table; automate channels in ROI order | 📋 → **Phase 3** |
| 10+11 | Social sweeps (24h/48h merged) | Schedule (hourly window scan) | (no status change) | Engagement sweep per publication + analytics loopback | 📋 → **Phase 4** |

Supporting workflows (same instance, not pipeline stages):

| Workflow | ID | Status |
|---|---|---|
| Telegram Airtable Assistant (holds the bot's only trigger) | `Hx8Ul6M41fM8HuxU` (live; old `peTIs4kiluFZHoLg` superseded/archived) | ✅ ACTIVE → level-up in **Phase 1** |
| ~~Pod21: Daily Reminders (9am+4pm digest; Needs-Guest nudge)~~ | ~~`4mjFkKPDBcqByyu5`~~ | ❌ **DELETED 2026-07-21** — one niche job, not worth a standalone workflow. Phase 0.3 watchdog needs a new home (see 0.3). |
| Pod21: n8n GitHub Backups (daily 3am) | `spXF48NOXJYaDfnz` | ✅ ACTIVE; name typo "Githup" (Phase 0.7); DB/credentials NOT covered (Phase 0.7) |
| Pod21: Workflow Failed > Telegram Alert (global error handler + Ops Log error rows) | `9PMI1kuBjLW2YHwb` | ✅ built + active 2026-07-06; wiring ✅ on the 6 main workflows; remaining: PAT scope on ops base `appwcz1Bux9YLcZYm` (unverified) + end-to-end test + wire View-to-Published/Calendly (see readme checklist) |
| Pod21 social-drafts trio (Article Drafts / Draft Approvals / Weekday Drip / Approval Handler) | `38m0YieboliXyxCQ` etc. | ⏸️ shelved 2026-06-05, all inactive, resumable |
| Calendly Bookings + Public API + table setups + AgentMail demo | various | unrelated to the content machine; leave |

---

## Part 2 — System roadmap

Recommended order: **0.1 → 0.2 → 0.7 → 0.3 → 0.4 → 0.5 → 0.6 → Phase 1 → Phase 2 → Phase 3 → Phase 4.** Phases 2–4 depend on Phase 1's callback registry; everything depends on Phase 0's observability.

> **▶ RESUME POINT (session closed 2026-07-15).** State: 0.1 ✅ (built, active, wired on the 6 main workflows; PAT scope on the ops base + end-to-end test unverified) · 0.2 🔨 (table + `Error` writer live; `Heartbeat`/`Completed` writers not started) · 0.5 ✅ via the System Map · 1.2 half done. **Next actions, in order:** (1) verify PAT can write to `appwcz1Bux9YLcZYm` + run the throw-test in the error-handler readme; (2) add `Heartbeat` rows to Backups + Research (an Airtable create node at each tail; ⚠️ pushing Backups drops its two GitHub HTTP-node credentials, rebind by hand after); (3) 0.7 housekeeping; (4) 0.3 watchdog — note its planned host `Pod21: Daily Reminders` was deleted 2026-07-21, so it needs a new home (fold into an existing scheduled workflow, don't spawn a new one). Read Part 0 before building anything.

Effort key: S = one short session · M = one focused session · L = multiple sessions.

---

### Phase 0 — Foundations: give the machine a nervous system

The gap this phase closes: each workflow is individually hardened, but nothing watches the whole. Failures are silent (only backups notify), history is only in n8n's execution list, and stalls surface for no condition at all (the Needs-Guest nudge that used to cover one case was deleted 2026-07-21 — see 0.3).

#### 0.1 `Pod21: Workflow Failed > Telegram Alert` — ✅ built + active 2026-07-06 (`9PMI1kuBjLW2YHwb`), incl. the Ops Log `Error`-row append. Error Workflow wiring ✅ done on the 6 main active workflows (per readme checklist); still unwired: `Airtable - View to Published`, `Calendly Bookings` (optional). ⚠️ Unverified: PAT access to ops base `appwcz1Bux9YLcZYm` + an end-to-end test (throw → alert + Ops Log row). Readme: `n8n_workflow_readmes/Pod21 - Workflow Failed > Telegram Alert.md`

- **Goal:** any workflow error anywhere → immediate Telegram alert to the team group.
- **Design:** one workflow: **Error Trigger** node → Code node formats `{workflow.name, execution.id, execution.url, execution.lastNodeExecuted, execution.error.message}` into an HTML message (escape `& < >`; execution ID in `<code>`) → Telegram `sendMessage` to `-5254203539`, `parse_mode: HTML`, **Retry On Fail** (4 tries / 5s) per constraint 12.
- Workflows with an Error Trigger do not need to be Active; they run when referenced.
- **Wiring (manual, in UI):** open every ACTIVE workflow → Settings → **Error Workflow** → select this one. Do this in the UI, NOT via API PUT (constraint 5 would deactivate each workflow touched). List of active workflows to wire: Research, Script Gen, Frame.io Metadata, Thumbnail Artwork, View to Published, Assistant, Backups, Calendly (optional).
- Note: nodes set to `onError: continueRegularOutput` (deliberate soft-fails) will NOT hit the error workflow. That's correct behaviour; don't "fix" it.
- **Later (after 0.2):** add an `Ops Log` append of the error row.
- **Acceptance test:** temporarily add a throwing Code node to a sandbox workflow wired to the handler, run it, confirm the group message; remove the node.

#### 0.2 `Ops Log` table + completion logging — 🔨 table ✅ created 2026-07-06; `Error`-row writer ✅ live in 0.1; remaining: `Completed`/`Skipped`/`Heartbeat` writers rolled out per workflow (opportunistically) + PAT scope grant

- **Goal:** a queryable, assistant-readable history of everything the machine does. Turns "what happened to BA-xxxx?" and "did the research run Friday?" into simple reads.
- **Location:** base `appwcz1Bux9YLcZYm` (a SEPARATE ops base, NOT the Guy's Take content base), table `tblgBjxgIKpje5q0S`, view `viw5osl0njC4zePkc` (created by Jonny 2026-07-06). Workflows WRITE by base+table ID (view irrelevant for writes); the watchdog/Assistant can READ scoped to the view.
- ⚠️ **PAT scope:** the `Airtable [n8n] (PAT)` credential must be granted access to base `appwcz1Bux9YLcZYm` (data.records:read + write) or every log write 403s. The Assistant discovers bases dynamically via the same PAT, so granting access also makes the log readable to it with no other change.
- **Schema (field names are case-sensitive; workflows write them by exact name):**
  - `Event` — Single line text (primary field) — e.g. `metadata completed`
  - `Workflow` — Single line text — workflow display name
  - `Record ID` — Single line text — the `BA-xxxx` (or `rec…`) the run concerned; empty for heartbeats/system events
  - `Type` — Single select, options exactly (capitalized): `Completed`, `Skipped`, `Error`, `Heartbeat`
  - `Detail` — Long text — human-readable note (error message, skip reason, counts)
  - `Execution URL` — URL
  - `Timestamp` — Created time (auto)
- **Rollout:** add one Airtable create node at the tail of each pipeline workflow (after the Telegram send; `onError: continueRegularOutput` so logging can never break a run) + an error-row append in 0.1 + a `heartbeat` row in Backups and Research. Add nodes opportunistically as each workflow is next touched; don't do a big-bang rebuild of everything (each push costs credential rebinds, constraint 6).
- **Retention:** none needed initially; revisit if the table gets slow (>50k rows).
- **Acceptance test:** run any wired workflow; row appears; Assistant can read it.

#### 0.3 Pipeline watchdog — 📋 M

> ⚠️ **Needs a new host.** This was going to be built by expanding `Pod21: Daily Reminders`, but that workflow was **deleted 2026-07-21** (it only did the Needs-Guest nudge and wasn't worth a standalone workflow). Decide the home before building: a schedule trigger added to an existing scheduled workflow, or — if it does grow into a real digest — one new watchdog workflow. Don't spawn a workflow per reminder. The Needs-Guest nudge (item 5) is currently unbuilt; fold it in here or drop it.

- **Goal:** nothing stalls silently, in any status, and scheduled workflows that silently DIDN'T run get flagged (error workflows catch failures; heartbeats catch non-runs: expired webhooks, deactivated-by-push, re-baselined pollers — all failure modes already hit once).
- **Design (one consolidated digest message on a schedule; do NOT create a new workflow per reminder):**
  1. Add Airtable field `Episodes.Status Changed` = **Last Modified Time scoped to only the `Status` field** → accurate per-status dwell time.
  2. New table **`Status SLAs`**: `Status` (single line) · `Max Hours` (number) · `Nudge` (single line). Seed: `AI Analysis Complete`/48h/"pick a title (reply T#/TC#)" · `Awaiting Thumbnail Pick`/24h · `Awaiting Manual Artwork`/72h · `Script Ready`/168h · `Ready to Publish`/24h.
  3. Watchdog branch: fetch SLAs → fetch Episodes where `DATETIME_DIFF(NOW(), {Status Changed}, 'hours') > MaxHours` per status (one `filterByFormula` per SLA row, or fetch-all-and-filter in Code) → add a "⏰ Stalled" section to the digest.
  4. Heartbeat branch (needs 0.2): query `Ops Log` for expected `heartbeat` rows (backup within 26h; research within 8d) → add a "💓 Missing heartbeats" section.
  5. (Optional) Re-add the Needs-Guest section (guest-less `Chat`/`Clip`/`Roundtable` ready for artwork) that the deleted workflow used to cover, plus an always-send all-clear.
- **Gotchas:** `alwaysOutputData` must stay on all fetch nodes; field names in formulas are case-sensitive; message stays one consolidated digest.
- **Acceptance test:** hand-set an episode's `Status Changed` back (edit any status), or temporarily set an SLA to 0h, run manually, confirm the stalled section renders.

#### 0.4 `Approvals` table — single-use, expiring, audited write-approvals — 📋 M

- **Problem:** the Assistant's write-approval state lives inside the Telegram message text (`⟦ ⟧` markers): buttons are re-tappable forever, no expiry, no audit, no post-write memory. Static data is unusable (constraint 4), so Airtable is the state store.
- **Schema (`Approvals` table):** `Summary` (primary) · `Method` · `Path` · `Body` (long text, JSON) · `Status` (single select: `Proposed / Executed / Cancelled / Expired`) · `Requested By` · `Chat ID` · `Result` (long text) · `Created` (created time).
- **Assistant changes (`scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`):**
  1. On a `write` envelope: create the Approvals row first, then send the approval message with callback data `wa:<recId>` / `wc:<recId>` (short, well under Telegram's 64-byte callback limit; the current design embeds the whole API call in the message instead).
  2. On `wa:` tap: fetch the row; execute ONLY if `Status = Proposed` and `Created` < 24h old; then PATCH `Status = Executed` + `Result`, and call `editMessageReplyMarkup` to strip the buttons from the approval message. On `wc:`: mark `Cancelled`, strip buttons.
  3. Keep the plain-English summary + raw API call visible in the message (what you approve is what runs).
- **Preserve:** the fail-closed parser, the approver whitelist, the `pick:rec…` cross-workflow hook (untouched here; generalized in Phase 1.3).
- **Acceptance test:** propose a write, tap Approve twice fast (second tap must no-op), confirm row `Executed` with result; propose + cancel; propose + wait past expiry.

#### 0.5 Canonical status documentation — ✅ done (differently than planned) as `workflow_planning/System Map.md`

> **Superseded 2026-07 by the System Map**: instead of a dev-facing `STATE-MACHINE.md`, the canonical state machine lives in `workflow_planning/System Map.md`, written for the **Telegram assistant** (its live copy is an Airtable row: base `app8Xw9Tq0XLjhmp9`, table `Prompts` `tblhG1nw2P1k3CBVU`, row `Name = "System Map"`, text in `Prompt`; the assistant reads it on demand, so editing the Airtable row updates it instantly, no n8n push). The repo file is the authoring source + backup; **keep the two in sync when editing**. Any roadmap reference to "STATE-MACHINE.md" means the System Map. Remaining nice-to-have from the original spec: expected dwell times per status (add when 0.3's `Status SLAs` table exists).

- **Problem:** the documented enum has drifted from reality. Live statuses now include `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`, `Ready to Publish` (set by workflow `7O9z3UwcUOkHjAC2`, which appears in no plan), and the practical order is `Recorded → Edited → Transcript Ready`.
- **Do:** write `workflow_planning/STATE-MACHINE.md`: every `Episodes.Status` value in order, what sets it (workflow ID / human / Airtable automation), what listens to it (workflow + view name), expected dwell (mirrors `Status SLAs`), and the manual-override story per stage. Same for `Shortlist.Status` and `Thumbnails.Status`. Document the publish-gate view's filter logic (open the view `viwDfPHHKrgggdw20` in Airtable and transcribe its filters). Readmes then link here instead of restating fragments.
- Feed the same content into the Assistant's system prompt (Phase 1.2).

#### 0.6 SDK coverage, `constants.js`, post-push audit — 📋 M (rolling)

- **Problem:** only 3 workflows have SDK sources; the rest exist only as live JSON (backed up, but not regenerable). Constants (chat IDs, table IDs, credential names, model slugs) are duplicated per workflow.
- **Do:**
  1. `scripts/deploy/workflows/constants.js` exporting all values from §0.3. New/updated SDK files import it.
  2. Create SDK files for the missing workflows **opportunistically** (when a workflow is next changed, snapshot its live JSON via `get_workflow_details`, port to SDK, then apply the change). Priority: Assistant (already has one), Research, Thumbnails, Metadata (has one), Script Gen (has one), View to Published, Backups.
  3. `scripts/query/credential-audit.sh`: fetch each active workflow's JSON via REST, list HTTP Request nodes with missing credentials; run after every push (catches constraint-6 misses mechanically). Optionally later: an `Ops` scheduled workflow doing the same nightly via `http://localhost:5678/api/v1` and feeding the watchdog digest. **Widen this beyond credentials:** on 2026-07-29 two nodes were found running n8n's default retry values while the SDK source declared different ones. **Partly answered 2026-08-11:** config pushed via the new operations-based `update_workflow` (`setNodeSettings`) *does* land, so that drift is legacy, not ongoing. The audit is still worth building — a "diff live node config against the SDK source" check is exactly what caught genuine drift in the assistant's system message on 2026-08-11 and stopped an unrelated sentence being silently overwritten. Note `get_workflow_details` strips credentials, so the credential half of the audit must use the REST API. Worked example + context in the §0.7 Telegram-retry-drift item.
  4. Post-push checklist (script or documented ritual): publish → verify Active → verify `availableInMCP` → run credential audit → fresh-flip test any polling trigger (constraint 8).

#### 0.7 Housekeeping — 📋 S

- [ ] Rename `pod21: n8n Githup Backups` → `Pod21 - Schedule 3am > GitHub Backup` (typo + convention).
- [ ] Archive `GbFwXLACjj1O6spS` (Phase 0 notifier; superseded, inactive).
- [ ] Confirm old Assistant `peTIs4kiluFZHoLg` is archived (it no longer appears in the live list); update its readme header + any stale references to it as the live ID.
- [ ] Rename `Airtable - View to Published` → `BA - Publish-gate View Entered > Ready to Publish` and document the view's filters in its readme (it sets `Ready to Publish`, not `Published`).
- [ ] Route ALL pipeline notifications to the team group: Script Gen (`Notify Script Ready`) and Thumbnail Artwork (4 sends) currently go to Jonny's DM (`1512868522`); metadata/reminders already use the group. One constant, redeploy (mind constraint 6 rebinds).
- [ ] **Host-level DB backup cron** (the one true disaster hole): nightly dump of n8n's DB volume + `N8N_ENCRYPTION_KEY` copied off-server. Workflow JSON is covered; credentials/executions/DB are not. Needs Jonny on the VPS.
- [ ] Backups workflow: add success `heartbeat` (after 0.2) so "silence means success" becomes verifiable.
- [ ] **Telegram retry drift on `BA - Frame.io Uploaded > AI Metadata` (`jroXHciDvy0sWlRM`) — spotted 2026-07-29, deliberately deferred.**
  - **UPDATE 2026-08-11: root cause identified and the fix is now trivial.** This was an artefact of the *old* push method, not a platform bug. `update_workflow` is now operations-based and `setNodeSettings` demonstrably lands its values (two new nodes on this same workflow read back at 3/5000 and 4/5000 exactly as declared). Fixing this is now **one `setNodeSettings` operation per node**. Re-verified 2026-08-11: both nodes still read back with `maxTries`/`waitBetweenTries` absent, i.e. still on defaults.
  - **What's wrong:** the two Telegram nodes (`Send Metadata to Telegram`, `Notify Skipped (Non-Media)`) have **Retry On Fail** switched on, but their Max Tries / Wait Between Tries are sitting at n8n's **defaults (3 tries / 1000 ms)**. The SDK source (`scripts/deploy/workflows/guys-take-episode-metadata.sdk.js`) declares `maxTries: 4, waitBetweenTries: 5000` for both. So the file says 4/5000, the live workflow does 3/1000.
  - **How it was found:** while verifying the *other* retry work (the Gemini 503 fix on 5 nodes), a `get_workflow_details` dump showed every node's retry settings side by side. The 5 new ones read back 5/5000 as expected; these two read back with the fields absent, i.e. defaults.
  - **Why it matters, honestly: barely.** These retries exist to ride out `EAI_AGAIN` DNS blips on the Contabo host (constraint 12). 3 tries × 1s = ~3s of cover instead of ~20s, so a slightly longer blip loses the Telegram notification. Every Airtable write happens *before* the send, so the episode is still fully analysed and saved — only the message is lost, and it's recoverable by re-running. This is a papercut, not a data risk. **Do not let it block anything.**
  - **Why it was deferred:** the fix is trivial (two fields in the UI, or a correct SDK push) but the push path is broken — see the MCP-tool bug below — and Jonny was closing the session.
  - **The fix, when you pick it up:** open each of the two nodes → Settings → set **Max Tries `4`** and **Wait Between Tries `5000`**. That matches the SDK file, so nothing else needs changing. Verify with `get_workflow_details` and check `maxTries`/`waitBetweenTries` actually appear on both nodes.
  - **The interesting part — why did the SDK values never land?** Unknown, and this is the bit actually worth an hour. The values are in the source file and were presumably in whatever push created these nodes, yet live has defaults. Either a past push silently dropped them, or the nodes were hand-edited in the UI at some point and the toggle got re-set without the numbers. **If the former, other SDK-declared config may also be quietly missing across other workflows** — which makes this a small instance of the §0.6 post-push-audit gap, not a one-off. Worth extending the planned `credential-audit.sh` (§0.6 item 3) to diff *all* live node config against the SDK source, not just credentials.
  - **Blocker to be aware of:** you cannot currently re-push this workflow via `update_workflow`. The MCP tool corrupts the SDK code in transit (inserts backslashes, turns `\n` escapes into real newlines) and the corruption moves depending on payload size, so it fails to parse every time. Confirmed 2026-07-29 across three attempts, including after an n8n restart, and confirmed *not* to be an n8n outage — the parse happens MCP-side before n8n is touched. Nothing is written on a failed parse, so the attempts are harmless, just wasteful. Until that's fixed, route small changes through the n8n UI or the public REST API.

---

### Phase 1 — Telegram Assistant → third teammate

Mostly prompt + tool work on `Hx8Ul6M41fM8HuxU` (SDK: `telegram-airtable-assistant.sdk.js`). Do before Phases 2–4: the callback registry (1.3) is the mechanism every later human confirmation uses.

#### 1.1 n8n read tools (eyes on the machine itself) — 📋 M

- Add read-only HTTP Request **tool sub-nodes** to the agent, auth `n8n account` header key against `http://localhost:5678/api/v1` (constraint: use header `X-N8N-API-KEY`; create an `httpHeaderAuth` credential with the same API key if the tool sub-node can't use the `n8nApi` credential type):
  - `list_workflows` → `GET /workflows?limit=100` (name, active) — "is the research workflow on?"
  - `list_recent_executions` → `GET /executions?limit=20&status=error` (+ optional workflowId) — "anything fail today?"
  - `get_execution` → `GET /executions/{id}` — "why did it fail?" (summarize `lastNodeExecuted` + error)
- All three: Options → Response → **Never Error** (constraint 11). Read-only paths only; NEVER give the agent n8n write endpoints.
- System prompt: when to use them, and that execution detail payloads are large (ask for the error summary, not the full data).
- **Acceptance test:** "did any workflow fail in the last 24h?" answered correctly against a seeded failure.

#### 1.2 Pipeline knowledge + status-report skill — 🔨 half done

- ✅ Pipeline knowledge is live via the **System Map** (see 0.5): the assistant reads the state machine + per-stage precondition checklists on demand from the Airtable `Prompts` table. No system-prompt paste needed.
- 📋 Remaining: teach it what the `Ops Log` is (one short system-prompt addition once the PAT can see base `appwcz1Bux9YLcZYm`), and the canned status report below.
- Teach a canned **"status report"**: read Episodes grouped by Status (+ dwell via `Status Changed`), narrate where everything is and what's blocked on whom. This is the on-demand standup.
- **Acceptance test:** "where is everything?" produces a correct, per-episode narrative including stalls.

#### 1.3 Generic callback registry — 📋 M

- Generalize the existing `pick:rec…` hook into `act:<verb>:<recordId>` handled in the Assistant's button path. Each verb maps to a **whitelisted** Airtable write (table + fields), executed exactly like today's pick handler. Initial verbs: `pick-shortlist` (Shortlist → `Picked`), `confirm-recorded` (Episode → `Recorded`), `confirm-slot:<recId>:<slot>` (write `Record Date`), plus the legacy `pick` (Thumbnails → `Selected`) kept as-is.
- Registry lives in one Code node (a verb→write map); adding a button anywhere in the system becomes: send a message with `act:` callback data (any workflow can send; only the Assistant triggers). Keep callback data ≤64 bytes.
- Unauthorized pressers: ignore + report to Jonny's DM (existing behaviour).
- **Acceptance test:** a test message with an `act:pick-shortlist` button flips the row; an unknown verb is safely ignored with a log line.

#### 1.4 Metadata picks by reply ("T2 TC4") — 📋 S

- The metadata message already carries T1–T5 / TC1–TC5 + the episode ID anchor. Add a system-prompt skill: a reply like "T2 TC4" (or "title 2, caption 4 but change 'crash' to 'dip'") → agent reads the options from the replied-to message → proposes ONE write setting `Title`, `Thumbnail Caption`, `Status = Approved` → normal one-tap approval.
- Update the metadata workflow's caption to say: *"Reply 'T# TC#' to this message to approve."*
- **Acceptance test:** reply "T2 TC4" to a real metadata message → one approval → episode Approved with both fields set.

#### 1.5 Voice notes + DM passthrough — 📋 S/M

- **DM passthrough (S):** add `chat.type === 'private'` OR-condition to the `Addressed to bot?` gate so plain DMs work without a mention.
- **Voice notes (M):** on `message.voice`: `getFile` → download → Gemini transcription (same Files API pattern as the metadata workflow; audio is small so a direct `generateContent` with inline audio may suffice) → feed the transcript into `Prep Agent Input` as the instruction. Constraint 3 applies: HTTP Request nodes, not Code-node fetch.
- **Acceptance test:** a DM'd voice note asking "what's in the pipeline?" gets a correct answer.

#### 1.6 Post-write feedback + force-regenerate levers — 🔨 partial (thumbnail revisions shipped 2026-07-26)

> **Shipped a richer variant for thumbnails (2026-07-26):** instead of a blunt "regenerate from scratch" checkbox, #8 got **briefed, in-place, targeted revisions** (Path 3) — the Assistant/Airtable sets `Revision Brief` + `Revision Targets` + `Status = Revising` on the `Final` thumbnail row and only the named ratios are redone with the brief. See the change log + the #8 readme. The generic force-regenerate checkbox below (and `Regenerate Metadata`) is still unbuilt; consider whether the briefed-revision pattern supersedes the need for a blunt regenerate on thumbnails.

- After an approved write executes (0.4), the `Result` lands on the Approvals row; prompt the agent to consult Approvals/Ops Log when asked "did that work?".
- Add **force-regenerate checkboxes** on Episodes (e.g. `Regenerate Thumbnails`): an Airtable view (checkbox ticked) feeds the existing generate trigger; the workflow un-ticks it at run start (same node as `Mark Generating`). Registry/Assistant can then offer "regenerate thumbnails for BA-xxxx" as an approved one-tap, and humans get the same lever in the Airtable UI. Same pattern later for `Regenerate Metadata`.
- **Acceptance test:** tick the box (or ask the assistant) → fresh thumbnail run → box cleared.

---

### Phase 2 — Close the pre-production loop

#### 2.1 (#2b) Pick buttons on the Friday digest — 📋 S — depends on 1.3

- Modify Research & Shortlisting's Telegram delivery: after the digest, send one message per top-8 topic (title + score + `<code>rec…</code>`) with an inline **Pick** button, callback `act:pick-shortlist:<recId>`.
- Registry sets `Status = Picked` → Script Gen triggers exactly as today. Conversational picking and hand-editing Airtable remain valid fallbacks (state-triggered, rule 0.5.1).
- **Acceptance test:** tap Pick on a test row → script generation fires once.

#### 2.2 (#4) Recording confirmation — 📋 S — depends on 1.3

- New workflow `BA - Schedule Hourly > Recording Confirm Nudge`: hourly schedule → fetch Episodes where `Record Date` is set, `NOW() > Record Date + 2h`, Status is pre-`Recorded` (e.g. `Script Ready`), and `Recording Nudged` (new checkbox) is empty → send group message with ✅ Recorded (`act:confirm-recorded:<recId>`) / 🕐 Not yet buttons → tick `Recording Nudged`.
- "Not yet" just acknowledges; re-nudging is the watchdog's job (SLA on dwell), not bespoke logic here.
- **Acceptance test:** back-date a test episode's `Record Date` → nudge arrives once → tap → `Recorded`.

#### 2.3 (#1) Scheduling, light version — 📋 M — depends on 1.3

- **Deliberate simplification (decide before building, see Decisions):** do NOT create placeholder episodes at `Scheduled`. Script Gen already creates episodes at the right moment; placeholder rows are rigid pre-commitment. Scheduling's only jobs: agree a slot, put it on the calendar, stamp `Record Date`.
- `BA - Schedule Thursday > Propose Recording Slots`: Thursday schedule → group message with slot buttons (Mon/Tue × 9/10/11 ET → 6 buttons, callback `act:confirm-slot:<sessionRef>:<slotIdx>`) → registry writes the chosen datetime.
- **Where `Record Date` lives:** simplest = stamp it onto the week's picked episodes once they exist (an Airtable automation or the registry writes to all episodes with empty `Record Date` and Status `Script Ready`); alternately a tiny `Sessions` table. Resolve in STATE-MACHINE.md when building.
- Calendar event: Google Calendar node (new credential, one-time OAuth) inviting Jonny + Guy.
- **Acceptance test:** Thursday message → tap a slot → `Record Date` on the right rows + calendar event exists.

---

### Phase 3 — Publishing (#9): normalize like Thumbnails, automate in ROI order

Channels: { Pod feed, X, YouTube, Rumble, Keet, Instagram, Nostr }.

#### 3.1 `Publications` + `Channels` tables + fan-out checklist — 📋 M — **build first; immediately useful with zero publishing APIs**

- **`Channels` table (config):** `Name` (primary) · `Mode` (single select `Auto / Manual`) · `Enabled` (checkbox) · `Notes`. Seed all 7 as `Manual`.
- **`Publications` table:** `Name` (primary, "BA-xxxx · YouTube") · `Episode` (link) · `Channel` (link) · `Status` (single select `Pending / Ready / Published / Failed / Skipped`) · `URL` · `Published At` (date) · `Swept 24h` / `Swept 48h` (checkboxes, for Phase 4) · `Notes`.
- **Workflow `BA - Ready to Publish > Publication Fan-out`:** Airtable trigger on a `Ready to Publish` view → flip Episode to a new `Publishing` status FIRST (rule 0.5.2) → read enabled Channels → create one Publications row per channel (`Pending`; `Ready` when its asset prerequisites exist, e.g. 9:16 for Instagram) → post a **publish checklist** to the group (episode ID + per-channel list) → Ops Log row.
- Humans mark rows `Published` + paste the URL as they post; the **watchdog** (0.3) nags Publications sitting `Pending/Ready` past SLA. An Airtable automation (or a small n8n poll) flips the Episode to `Published` when all non-`Skipped` rows are `Published`.
- **Result:** full publishing oversight and assistant-reportable state BEFORE any publishing API is integrated; per-episode or permanent manual override is just row state.
- **Acceptance test:** flip a test episode → 7 rows + checklist message; mark all Published → episode `Published`.

#### 3.2 YouTube automation — 📋 L — biggest ROI

- Trigger: Airtable view (`Publications: Status=Ready, Channel=YouTube`).
- Flow: fetch Episode (title = approved `Title`, description + chapters text, selected Thumbnail 16:9 URL, `Frame.io URL`) → **Frame.io original** download (Show File `media_links.original`, constraint 16) → YouTube **resumable upload** (Google OAuth cred; the native YouTube node or raw HTTP) → set thumbnail via API → write `URL` + `Published At` + `Status=Published` on the row.
- **⚠️ Prerequisite:** set `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` on the instance BEFORE piping multi-GB video through n8n, or the process OOMs. If files outgrow even that, fall back to a small helper script on the VPS (download→upload server-side) that n8n calls over localhost.
- YouTube API quota: uploads cost 1600 units of the 10k/day default; fine at this volume.
- **Acceptance test:** publish an unlisted test video end-to-end; verify thumbnail + chapters render.

#### 3.3 X automation — 📋 M

- Same view pattern (`Channel=X`). Post: approved title/hook + 16:9 or 1:1 image + YouTube/episode link. Media upload requires the paid API tier (see Decisions). Native video posting is a later upgrade.

#### 3.4 Pod feed — 📋 M — blocked on a Decision (podcast host)

- Choose a host **with an API** (Transistor / Buzzsprout / Podbean; or self-hosted). The machine already produces everything needed: audio lands in Frame.io (the metadata workflow transcribes audio uploads today), `Summary`, human-readable `Chapters`, and **Podcasting 2.0 `Chapters JSON`** (already generated per episode). Flow: fetch audio original from Frame.io → host's episode-create API → row `Published` + feed URL.

#### 3.5 Instagram — 📋 L — decide if it earns automation

- Graph API requires an IG Business/Creator account linked to a Facebook Page. Reels = the 9:16 reversion (already generated by Thumbnail Phase B) or a video clip. Moderately painful setup; keep `Manual` until the account prerequisites exist.

#### 3.6 Rumble, Keet, Nostr — stay `Manual` by design

- Rumble's upload API is partner-gated; Keet has no API; Nostr needs event signing + websocket relays (Code nodes can do the crypto but not the transport, constraint 3; an HTTP relay bridge is a fun later experiment, not path-critical). They remain checklist rows the watchdog nags about. This is the flexibility model working as intended.

---

### Phase 4 — Post-publish loop

#### 4.1 Engagement sweep (merges planned #10 + #11) — 📋 M/L

- ONE parameterized workflow `BA - Schedule Hourly > Engagement Sweep`, not two: hourly → fetch Publications where `Published At` crossed the 24h (or 48h) boundary and the matching `Swept 24h`/`Swept 48h` checkbox is empty → per channel, pull engagement (YouTube: comments + stats via API; X: mentions/replies; others: skip or manual) → post ONE digest to the group (top comments with links, counts, episode ID) → tick the checkbox. Adding a 72h sweep later = one more checkbox + window, not a new workflow.
- Assistant tie-in: notable comments can become approval-gated reply drafts (Phase 1 registry + Approvals).

#### 4.2 Analytics loopback (the flywheel) — 📋 M

- The sweep also writes `Views / Likes / Comments` numbers onto the Publication row per pass. Weekly digest section (in the 0.3 watchdog digest, once it has a home) compares episodes. Later: feed performance patterns back into the Research clustering prompt ("stories like X overperform") — this is what makes it a *machine* rather than a conveyor belt.

---

### Decisions needed from Jonny (blockers flagged early)

| # | Decision | Blocks | Notes |
|---|---|---|---|
| D1 | Podcast host (needs API: Transistor / Buzzsprout / Podbean / self-host?) | 3.4 | Chapters JSON + Summary already produced per episode |
| D2 | X API tier (media upload needs paid Basic, ~$200/mo) | 3.3 | If no: X stays a Manual checklist row |
| D3 | IG Business account + linked FB Page exist? | 3.5 | If no: Instagram stays Manual |
| D4 | Google OAuth for YouTube upload (which Google account owns the channel) | 3.2 | One-time credential setup in n8n |
| D5 | `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` on the VPS | 3.2 | Env change + restart; do during a quiet window |
| D6 | VPS DB backup cron (needs shell access) | 0.7 | The only true disaster-recovery hole |
| D7 | Scheduling: confirm "light" version (no placeholder episodes; `Record Date` stamped post-pick) | 2.3 | Recommended; reconcile in STATE-MACHINE.md |
| D8 | Notification routing: OK to move Script Gen + Thumbnail messages from Jonny's DM to the group? | 0.7 | Recommended for Charlie's visibility + assistant reply anchors |

---

## Per-workflow tune-ups (non-roadmap, do when touching each workflow)

- **Research & Shortlisting:** channel list is duplicated across two Code nodes (documented foot-gun). Consolidate to one node emitting both the list and the lookup map, or move channels to an Airtable `Channels (Research)` table so adding one is a row, not a deploy. X/Reddit sources later slot in as parallel fetch branches into the same clustering step.
- **Script Generation:** feed the linked Stories' real URLs into the prompt (readme's own v2 note) so references stop saying "(verify link)".
- **Frame.io Metadata:** solid. The Deepgram/AssemblyAI swap is already scoped in its readme; only do it if Gemini transcription actually hurts (very long episodes / speed).
- **Thumbnail Artwork:** orphaned `Rejected` rows accumulate by design (unlink on select). If hygiene bothers you, add a cleanup (delete Rejected > 30 days) to whatever scheduled workflow ends up hosting the 0.3 watchdog.
- **Backups:** add the 0.2 heartbeat row on success.
- **Telegram Assistant:** one prompt line is written in `telegram-airtable-assistant.sdk.js` but **not live** — the `== WRITE RULES ==` rule stating that a link field takes plain record ID strings, never `[{"id": "rec..."}]` objects. It isn't urgent (a code guard in `Parse Agent Decision` + `Handle Button Press` normalises the shape either way), but pushing it means resending the entire ~12k-char system message, so fold it into the next system-message change rather than doing a push just for it. Anything else that edits the prompt should carry it up.

---

## Change log

- 2026-08-20 — **#8 Artwork: the 1:1 / 9:16 reversions now skip `Clip`, `Read` and `Audionauts`.** Jonny's ask: Clips are cut from an episode that already has its own square and vertical artwork, so regenerating them per Clip is wasted Nano Banana spend. The obstacle was that Path 2 triggers on a **`Thumbnails`** row, and a thumbnail row had no idea what type its episode was. **Solution: a new `Episode Type` lookup field on the Thumbnails table** (`fldjbnJYqcGTSvzz6`, `Episode` → `Type`), which puts the type in the trigger payload for free. `Resolve Selected` unwraps it (lookups arrive as arrays) and emits `episodeType` + a `reversionOk` boolean from a `NO_REVERSION = ['Read', 'Clip', 'Audionauts']` constant; `Needs Reversion?` gained a second AND-ed condition on it; `Confirm Thumbnail Set` checks it **first** so the Telegram message no longer promises versions that aren't coming. **The near-miss worth remembering:** the obvious implementation — filtering those types out of the trigger view — was tried and reverted the same day, because that one view fires **three** branches and only one is the reversioning. With the filter on, picking a Clip's thumbnail did *nothing at all*: siblings stayed `Proposed`, the episode never reached `Artwork Ready`, the pick never went `Final`, no Telegram, **no error anywhere**. The view was renamed `Selected` → **`Ready for 1X1 & 9X16 Thumbnails *J*`** and kept as a single `Status = Selected` condition. **Standing lesson: before filtering a trigger view, count how many branches hang off that trigger** — a view filter is an all-or-nothing gate on every one of them, whereas an IF node gates exactly one. Type-shaped exclusions belong in code (or, if they start churning, a dedicated Episodes field), not in a view whose name only describes one consumer. **UNTESTED end-to-end** — needs a real Clip pick and a real non-Clip pick to confirm both sides.
- 2026-08-13 → 14 — **The assistant's write-approval path was broken in two independent places; both fixed, pushed and published (`Hx8Ul6M41fM8HuxU`), and BA-OSm4rv completed the packaging → artwork → `Ready to Publish` run.** Reported symptom was only the first of the two. **(a) No Approve/Cancel buttons.** `Parse Agent Decision` sliced the agent's reply from the first `{` to the **last** `}`. Sonnet 4.6 had in fact been ignoring "reply with ONLY raw JSON" all along — **20 of the last 26 real agent outputs open with prose** ("Good. I have everything I need. Let me map the selections…") and the slice had been quietly rescuing every one of them. On 2026-08-13 it also began appending a **stray extra `}`**; `lastIndexOf('}')` grabbed it, `JSON.parse` threw, and the catch-all degraded a valid write proposal into `action: respond` — so the whole proposal was pasted into the chat as text with no buttons and the write was **silently dropped** (execs 1771, 1773, 1781). Replaced with a brace-depth scanner that tracks string/escape state, collects every *balanced* `{…}` block and takes the last one carrying a recognised action; fences are now stripped anywhere, not just at the ends. Verified by replaying all 26 recent outputs offline: the 3 broken ones parse as `write`, the other 23 byte-identical. **(b) `INVALID_RECORD_ID` on approval.** With buttons back, tapping Approve returned `Value "[object Object]" is not a valid record ID` — the agent proposed `"Guests": [{"id":"recAAA"},{"id":"recBBB"}]` where Airtable link fields take plain ID strings, **and one bad value fails the entire batched PATCH**, so all five packaging fields landed nothing. An `unwrapFields` guard now normalises `{id}` / `{id,name}` refs into ID strings in **both** `Parse Agent Decision` (so the approval message displays what will really be sent) **and** `Handle Button Press` — the second copy is what let Jonny re-tap the message already in his chat instead of re-asking the bot. Scoped to values **inside `fields`** only, and only for `rec`-prefixed IDs, so attachment objects (`{url, filename}`) and the `{id, fields}` record wrapper survive; widening that scope would silently corrupt the record wrapper into a string. **Standing lesson, and the through-line of both bugs: an LLM's output contract is advisory, not a guarantee — every hop that consumes agent output needs its own defensive normalizer, and a parser that "degrades gracefully" to a plain reply will hide a broken write rather than surface it.** Worth considering later: the degrade path should probably alert rather than fall through silently. Diagnosis method worth reusing — replay real `Airtable Agent` outputs pulled from the executions API against the node's code offline, which both proved the cause and regression-tested the fix before anything touched live. Prompt-side rule about link-field shape written into the SDK but **not pushed** (see Per-workflow tune-ups).
- 2026-08-11 (end of session) — **Greyscale-artwork bug diagnosed and fixed in the prompts (`recQmzSDextFHnXAa`, UNVERIFIED).** Symptom was narrower than "the image is greyscale": inspecting exec #1752's option 1 showed a **vividly coloured background with the three people rendered grey**. Ruled out the reference photos by downloading the `Curious/Intriguing` reference — a full-colour shot with an obviously ginger beard that the render turned grey — so the desaturation happens at generation. **Root cause: the 2026-08-04 strip-back removed the hardcoded lighting/palette and replaced it with nothing, leaving all three layout templates saying nothing whatsoever about colour.** Nano Banana filled the vacuum with the usual design convention of desaturating foreground subjects against a busy graphic background. Fixed by adding a **`COLOUR — NON-NEGOTIABLE`** block to `Solo` / `Duo` / `Roundtable Thumbnail`, plus a one-line version in `Reversion 1x1`, `Reversion 9x16` and `Artwork Revision` so a reframe or briefed redo can't re-grey a good image. The rule **permits monochrome backgrounds** and forbids it only on people, which is the line Jonny drew. No n8n push needed (prompts are read from Airtable at runtime), so it is live immediately; paste-ready copies in the readme updated to match. **Standing lesson: never leave a layout template with no colour instruction** — an absent constraint is not a neutral one, the model picks a default and it will not be yours.
- 2026-08-11 (end of session) — **✅ Jonny-picked moods confirmed working end-to-end (exec #1752).** Once Jonny set `Status = Approved` (the step the view filter actually needed), the artwork run produced `moodSource: picked` and cycled his two moods ABAB across the four options — `Curious/Intriguing`, `Inspiring/Visionary`, `Curious/Intriguing`, `Inspiring/Visionary` — completing through to `Mark Awaiting Pick`. First confirmed run of the handover, on a `Chat` (duo layout). **`moodSource` is the diagnostic to check on any future run:** `picked` = his choices were used, `fallback-all-moods` = they were silently dropped. Roundtable remains unrun. *(The greyscale-artwork bug was fixed later the same session — see the entry above.)*
- 2026-08-11 (later still) — **The artwork trigger view's real filter, transcribed from the Airtable UI.** Every previous description of this view in the repo, the readme and the `System Map` was reconstructed from memory and **understated the `Status` condition**: it is `Status is none of "Awaiting Thumbnail Pick", "Generating Artwork"`, not merely "not `Generating Artwork`". The practical consequence, now documented in all three places: **deleting an episode's `Thumbnails` rows does not re-arm artwork generation** — the episode is still `Awaiting Thumbnail Pick`, stays out of the view, and nothing runs, with no error raised anywhere. `Status` must move to `Approved` as well. This ate the tail of the 2026-08-11 debugging session. Full filter: `Transcript` not empty, `Summary` not empty, `Thumbnail Caption` not empty, `Thumbnails` empty, `Status is none of [Awaiting Thumbnail Pick, Generating Artwork]`, `(Type is any of [Take, 2 Sats, Read, Clip] OR Guests is not empty)`, `Custom Image Prompt` not empty. **Standing constraint worth remembering: the Airtable API exposes view names and IDs but NOT filter conditions** (`list_views_for_table` returns `{id, name, type}` only), so no view gate can ever be verified programmatically — when a view-driven trigger won't fire, get a screenshot rather than inferring. Also surfaced: the view admits `2 Sats` and `Read`, but `Plan Generate`'s `autoArt` list is `Take`/`Chat`/`Clip`/`Roundtable`, so those two enter the view and are immediately routed to `Awaiting Manual Artwork`; `Audionauts` is in neither list. Not changed, just recorded.
- 2026-08-11 (later) — **The mood handover above was not actually live, and had a second bug behind it.** First real run (`BA-PgJMzX`, exec **#1746**) returned four thumbnails all on the `Suspicious/Sobering` reference despite Jonny asking for `Curious/Intriguing, Inspiring/Visionary`; logged as Automation Upgrades `recFNrKdDjPNrWnXZ`, now `Fixed`. **(a) The push was never published.** n8n 2.x keeps a **draft** version and an **active** version, and `update_workflow` writes the draft only. `BA: Guy's Take Thumbnail Artwork` sat at `versionId` `c979dcc8` / `activeVersionId` `8db37fe5` (2026-07-26) — so executions kept running July's Gemini mood-picker while the editor, and any live-vs-repo diff, showed the new code. The other two workflows from that batch *were* published; only this one was missed. Diagnostic that settles it in one step: the run's `Plan Generate` output has no `moods`/`customPrompt` keys and `Resolve Vibes` has no `moodSource` key, all of which the new code always emits. **(b) `Plan Generate` read a field name that did not exist** — `f['Thumbnail Moods']` against a field Jonny had created as `Moods`. Because `Resolve Vibes` deliberately falls back to the whole library rather than throwing, this would have produced four plausible-but-unrequested moods after publishing, i.e. a *different-looking* bug. Fixed on both sides: the code now reads ``f['Moods'] || f['Thumbnail Moods']``, and the Airtable field was **renamed `Moods` → `Thumbnail Moods`** (field ID `fldujYetql7QhEWkR` unchanged, data intact) so it matches the packaging message, the assistant prompt, the System Map and every doc — all of which already used that name. Workflow republished (`activeVersionId` `112229d4`). **Lesson now in the artwork readme's gotchas: a push is not a deploy — always confirm `versionId == activeVersionId` before calling a fix live.** Still **UNTESTED end-to-end**; `BA-PgJMzX` keeps its four wrong options until re-generated.
- 2026-08-11 — **Artwork direction handed from the AI to Jonny (3 workflows pushed).** Initial 16:9 generation is now driven by *his* choices instead of an AI's. `BA - Frame.io Uploaded > AI Metadata` (`jroXHciDvy0sWlRM`, 33→35 nodes) gained **`Fetch Mood Library`** (reads `Thumbnail References` so the message can list the moods) and **`Send Packaging Request`** — a second Telegram message that is now the reply target, carrying T1–T5, TC1–TC5, the guests + title already set, the mood list, and a **required custom image prompt**. The document caption was cut right back: a `sendDocument` caption is capped at **1024 chars** and the option set no longer fit, while `sendMessage` allows 4096 (the new message uses ~1200). Because the assistant treats the *replied-to* message as its spec, that message has to stay self-contained — which is why the split puts everything in one message rather than spreading it across the file caption. `BA: Guy's Take Thumbnail Artwork` (`mLAn4ya2AmZoHDUk`, 60→58 nodes) **deleted `Build Mood Prompt` + `Pick Moods (Gemini)`** (one less Gemini call per run); `Resolve Vibes` now cycles Jonny's picked moods across the 4 slots, matched by name case-insensitively, falling back to the whole library if empty or all-mistyped. The 4 hardcoded `{{VARIATION}}` framing lines are retired in favour of a **`{{CUSTOM}}`** token filled from the new `Custom Image Prompt` field. **Accepted trade-off:** with the framing lines gone, picking a *single* mood returns 4 closely-related images; if that grates, put the variation back in the Airtable template rather than in code. Two new Episodes fields (`Custom Image Prompt`, `Thumbnail Moods`, both long text) and a new view condition **`Custom Image Prompt is not empty`** — that gate is load-bearing, since without it artwork fires the moment the caption reply lands and ignores the art direction. Assistant (`Hx8Ul6M41fM8HuxU`) gained an `== EPISODE PACKAGING REPLY ==` section: one batched PATCH, **link existing `Guests` rows only** (never create, never drop existing links, report unmatched names), moods as ordered text, prompt written **verbatim**, and a reminder when the prompt is missing. **Bug fixed in passing:** `Plan Downloads` read `if (plan.layout === 'duo')` only, so **every Roundtable fetched zero guest photos** and silently fell through to the `Solo Thumbnail` prompt — Roundtable was never actually working despite being wired up on 2026-07-06. Now `duo || roundtable`, still unrun. Broad `{{CUSTOM}}`-aware replacements for the three layout prompts are in the artwork readme (the old ones hardcode lighting/palette, which fights the custom prompt and invites `IMAGE_OTHER`). **All three UNTESTED end-to-end.** Doc corrections made at the same time: the artwork trigger view does **not** gate on `Status = Approved` (confirmed with Jonny) — several places said it did; the metadata readme called the guest link `Guest` when there is only `Guests` + its `Guest Name` lookup; and the assistant readme was renamed `Pod21 - …` → `BA - Telegram Airtable Assistant.md` to match the workflow's real name.
- 2026-08-11 — **`update_workflow` is usable again, and it invalidates the 2026-07-29 workaround.** The MCP tool no longer takes the whole SDK file as one inline `code` string; it now takes **atomic operation objects** (`setNodeParameter`, `addNode`, `removeNode`, `addConnection`, `setNodeSettings`, `setNodePosition`, …). All three pushes above went through it and **every Code node was read back and compared to the repo `.sdk.js`: byte-identical**, including backslash regexes (`/\{\{(\w+)\}\}/g`, `/\.[a-zA-Z0-9]+$/`), `\n` escapes and emoji; a 12,310-char agent system message round-tripped exactly. Only mangling seen: a run of 9 repeated `─` box-drawing chars trimmed from one comment banner. **This is now the preferred push route** over a REST PUT — no deactivation, no `availableInMCP` strip, and no need to hand-build workflow JSON (there is no local `@n8n/workflow-sdk` install, so `.sdk.js` can't be compiled here). **Answers the §0.6 "does SDK-declared config silently fail to land?" question:** `setNodeSettings` **does** land — `Fetch Mood Library` and `Send Packaging Request` read back at 3/5000 and 4/5000 exactly as declared. The §0.7 Telegram drift is therefore a *legacy* artefact of the old push method, not an ongoing platform bug, and is now a one-operation fix. Two further gotchas worth keeping: `addNode` **does** bind credentials passed inline (the response's "skipped credential auto-assignment" note is misleading — verify, don't believe it), and `get_workflow_details` **strips credentials from every node**, so bindings must be checked via the REST API instead.
- 2026-07-29 — **Metadata workflow retry-hardened against Gemini 503s.** Exec #1514 of `BA - Frame.io Uploaded > AI Metadata` (`jroXHciDvy0sWlRM`) died on `Transcribe with Gemini` with "Service unavailable" — a transient Gemini overload, not a config error. **Retry On Fail 5×/5000ms** (n8n's maximums, ~20s of cover) added to the 5 idempotent external calls: `Transcribe with Gemini`, `Get File State`, `Start Gemini Upload`, `Show File`, `Download Proxy`. Left un-retried on purpose because a repeat would duplicate rather than recover: `Upload Bytes to Gemini` (resumable session, retry re-sends at offset 0), `Create Review Link` (POST mints a new link), `Upload Chapters Attachment` (Airtable `uploadAttachment` appends). Constraint 12 broadened to match. **Applied by hand in the n8n UI**, because `update_workflow` is currently unusable: the MCP tool corrupts SDK code in transit (inserted backslashes, `\n` escapes becoming real newlines) with the breakage moving by payload size — three failed attempts, including after an n8n restart, and confirmed *not* an outage since the parse happens MCP-side. Nothing is written on a failed parse. **Deferred:** a Telegram retry drift found during verification (SDK says 4/5000, live runs n8n defaults 3/1000) — fully written up in §0.7, and it hints the §0.6 post-push audit should diff all node config, not just credentials.
- 2026-07-26 — **#8 Artwork: SDK rebuild + briefed-revision 3rd trigger, cut over.** First workflow migrated to the SDK-source-of-truth model (`scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js`, see `CONVENTIONS.md`). Rebuilt the whole hand-built workflow from its live JSON (params copied verbatim, proven byte-faithful by structural diff: 45 existing nodes identical, all 43 edges preserved), added a **3rd Airtable trigger (Path 3)** for **briefed, in-place, targeted artwork revisions**, pushed as new workflow **`mLAn4ya2AmZoHDUk`**, tested, then **archived old `YyXiJ0lusoW7ynu9` + activated the new one**. New `Thumbnails` fields `Revision Brief` + `Revision Targets` + `Status = Revising`; new view `Revision Requested` (`viwGVYiheuTD2pPlx`); new `Prompts` row `Artwork Revision` (`{{REVISION}}`/`{{HOOK}}`). Self-edits each targeted ratio's current image (falls back to 16:9), no forced cascade; clears the attachment field before re-upload (Airtable `uploadAttachment` only appends). Assistant (`Hx8Ul6M41fM8HuxU`) got an **"Artwork Revisions"** system-message skill: "redo the 9x16 for BA-xxxx, more red" → one-tap-approved write of the brief/targets/status onto the episode's `Final` row (defaults to all 3 ratios if none named). **Credential tax confirmed:** SDK `newCredential('Name')` binds triggers + Telegram but is skipped on every HTTP node (rebind by hand per push); no SDK bind-by-id option. This partially delivers **1.6** (a briefed redo, richer than the planned blunt force-regenerate checkbox).
- 2026-07-15 — Roadmap reconciled before pausing Phase 0 (see **RESUME POINT** at the top of Part 2). 0.1 error-handler wiring confirmed done on the 6 main active workflows (View to Published / Daily Reminders / Calendly still unwired; PAT scope on ops base `appwcz1Bux9YLcZYm` + throw-test still unverified). 0.5 marked ✅ as **superseded by `System Map.md`** (state machine + per-stage precondition checklists, live copy in the Airtable `Prompts` table read on demand by the assistant) and 1.2 marked half-done accordingly; System Map added to the Part 0 source-of-truth map. Heartbeat rows for Backups + Research (0.2) explicitly deferred — next build item.
- 2026-07-08 — `YyXiJ0lusoW7ynu9` (#8 Artwork) **Phase B reversioning reworked** (guided hand-edit, +4 nodes): now **idempotent** (regenerates only the missing 1:1/9:16, `Needs Reversion?` IF skips if both present), reversion prompts **moved to Airtable** (`Reversion 1x1`/`Reversion 9x16` rows + `Fetch Reversion Prompts` node) with a text-**legibility** contract, and a **Telegram send-back** of the new artwork (`Collect Reversions` → `Send Reversions` `sendPhoto`, one message per new image). Gotcha logged: Airtable `uploadAttachment` response keys `fields` by field ID (not name) and lists other existing attachments, so match the uploaded image by `filename`, not field name.
- 2026-07-08 — `YyXiJ0lusoW7ynu9` (#8 Artwork) Airtable-prompt path fixed + tested (solo/Take). Two bugs from the 2026-07-06 hand-edit: (1) `Plan Generate` had a truncated line `caption: f['Thumbnail Caption'] || f['Tit` (the `f['Title']` reference chopped mid-string) → `SyntaxError: Invalid or unexpected token`; (2) `Build Image Requests` read the template from field `Template`, but the `Thumbnail Prompts` field is named **`Prompt`** → every template loaded `''` and threw the misleading `Missing prompt row "Solo Thumbnail"`. Both fixed in the live workflow; a Take episode ran clean end-to-end (exec 1381). Roundtable still untested.
- 2026-07-06 — Doc expanded from "Guy's Take — Build Status" into the full **Content Machine — Build Status & Roadmap** (Part 0 implementer orientation + constraints; Part 1 tracker refreshed: #8 Artwork marked ACTIVE incl. Phase B, added 8b publish gate `7O9z3UwcUOkHjAC2`, supporting-workflows table; Part 2 phased roadmap 0–4 + decisions D1–D8). Built Phase 0.1: `Pod21: Workflow Failed > Telegram Alert` (`9PMI1kuBjLW2YHwb`, Error Trigger → Code → Telegram group → Ops Log `Error` row, retry-hardened; renamed from `Ops - …` by Jonny, activated; needs per-workflow Error Workflow setting wired in the UI — checklist in its readme). Ops Log table created by Jonny: base `appwcz1Bux9YLcZYm`, table `tblgBjxgIKpje5q0S`, view `viw5osl0njC4zePkc`, capitalized Type options.
- 2026-06-17 — `jroXHciDvy0sWlRM` Airtable Content API fixed (the cause of every prior chapters-upload 404): field reference goes BEFORE the `/uploadAttachment` URL segment, body is JSON with inline base64 (not multipart), field referenced by URL-encoded name `Chapters%20JSON` (drops the schema-read scope dependency). `Upload Chapters Attachment` uses a new `Adobe OAuth` cred auto-assigns on push from this date. Re-run support added (`Set Status` clears `Chapters JSON: []` before re-upload).
- 2026-06-16 — `jroXHciDvy0sWlRM` WENT LIVE. Frame.io auth resolved as **Adobe IMS OAuth2** (`Adobe OAuth` cred via developer.adobe.com console; the account's Admin Console blocks legacy dev tokens, so the earlier Bearer-token plan was dropped). Episode match finalised on the existing **`ID`** string field via filename prefix `BA-{id}` (regex `/^(BA-[^_\s.]+)/i`), not `Episode Number`. Confirmed live: Frame.io V4 wraps `Show File` in a `data` key. Added Airtable writes for `Summary`, `Chapters` (human-readable + Podcasting 2.0 JSON attachment), `Transcript`, `Frami.io URL` (3-level fallback since Review Links/Presentations are Legacy and 404). Delivers titles/captions/description to the Guy's Take group as a Telegram document. See its readme for the full node-by-node + gotchas.
- 2026-06-13 — `jroXHciDvy0sWlRM` adjustments: Frame.io auth switched from OAuth2 to **Bearer Auth** cred `Frame.io [API token]` + node header `x-frameio-legacy-token-auth: true` (Jonny only has an API key). Episode match field corrected from `Episode Number` to the existing **`ID`** number field (`filterByFormula={ID}=<n>`). **Both edits are in the SDK file + validate locally but were NOT pushed to live n8n** — the n8n-mcp token expired and the server disconnected mid-session. Next session: reconnect n8n-mcp → validate → `update_workflow` `jroXHciDvy0sWlRM` from `scripts/deploy/workflows/guys-take-episode-metadata.sdk.js`. Jonny created the Bearer cred and may have hand-toggled the Show File node in the UI (Option B) — confirm before re-pushing.
- 2026-06-12 — Stages #5+#6+#7 built as ONE workflow `BA - Frame.io: Episode uploaded → AI metadata → Telegram` (`jroXHciDvy0sWlRM`), INACTIVE. Key finding: **Frame.io has no transcript API** (staff-confirmed, on roadmap, no ETA) and no transcript-ready webhook — so Frame.io is trigger + media source only. OpenRouter STT also rejected (no timecodes, ~60s timeout). Chosen: `file.ready` webhook → Frame.io Show File proxy → **Gemini 2.5 Flash** Files API transcription with `[MM:SS]` timecodes → **OpenRouter gpt-5.1** generates 5 titles + 5 thumbnail captions + timecoded description → Telegram document (Telegram-only delivery) → Episode `AI Analysis Complete`. Match via filename `EP042 -` → new `Episodes.Episode Number` field. SDK: `scripts/deploy/workflows/guys-take-episode-metadata.sdk.js`. Untested legs flagged in readme (webhook payload shape, resumable-upload content-length, merge→upload binary handoff, poll loop). Needs: Frame.io [Adobe IMS] OAuth2 cred, attach Gemini cred to 3 HTTP nodes, add `Episode Number` field, register the Frame.io webhook, live test.
- 2026-06-11 — #3 reworked from code (`scripts/deploy/workflows/guys-take-script-generation.sdk.js`): dropped the 6-module asset package for a clean talking-head **script only** (GPT 5.1, one inline sponsor beat), added a Build Script HTML code node that renders a PicoCSS slideshow, delivered as both an Episode `Attachments` upload and a Telegram **document**; fixed F6 (Mark Shortlist Scripted now writes id+Status only). Manual step: attach the Airtable PAT to the `Upload Script HTML` HTTP node. Decided architecture: thumbnail selection (and all human input) becomes an Airtable write — only the Telegram Airtable Assistant holds a Telegram Trigger; #8's inline pick buttons get replaced by a reply-"1-4" skill on the Assistant (system-prompt paste, pending).
- 2026-06-09 (rev) — #8 rebuilt on a NORMALIZED schema (Jonny's redesign): new `Thumbnails` table (one row per option) + static `Thumbnail References` library (mood + Guy headshot). Generate path now: `gemini-2.5-flash` picks 4 moods from the library → one Nano Banana 16:9 per mood (ref photo inline + shared caption) → 4 Thumbnails rows (Proposed) + Telegram album. Select path: set a row `Status=Selected` → rejects siblings → Episode `Artwork Ready`. Selection is row-status, not a number field. Pending: create the 2 tables + Episodes additions, populate References, Gemini Header Auth cred, attach creds to HTTP nodes, and paste the Thumbnails table ID into the `Thumbnail Selected` trigger (+ add Last Modified Time to Thumbnails). Guests deferred. See its readme.
- 2026-06-09 — #3 schema set up + tested end-to-end. Upgraded to mirror the `guys-take-script` skill (full asset package) and pull the sponsor dynamically from a `Sponsors` table (Active row). Trigger scoped to a locked Picked view. Hardened against several Airtable/n8n gotchas (Fields list formatting, `$env` blocked → hardcoded chat ID, view-filter scoping, Mark-Scripted no longer zeroes research fields). Picking is currently done by telling the Telegram Airtable Assistant to mark a story Picked; that agent's approval/confirmation messages were also simplified.
- 2026-06-09 — #8 Artwork Phase A built (`YyXiJ0lusoW7ynu9`), INACTIVE. Two Airtable-triggered paths (generate on `Approved`, select on `Awaiting Thumbnail Pick`). Uses Nano Banana (`gemini-2.5-flash-image`) for 4 16×9 options, stores as Airtable attachments, Telegram album. Decisions: selection via an Airtable `Chosen Thumbnail` number field (NOT Telegram buttons — the Assistant `peTIs4kiluFZHoLg` owns the bot's only webhook); host-photo reference per episode (`Reference Photos`); caption via new `Thumbnail Caption` field (manual until #7). Pending before activation: Episodes fields (`Thumbnail Caption`/`Reference Photos`/`Thumbnail Options`/`Chosen Thumbnail`/`Thumbnail 16x9`), Status options `Awaiting Thumbnail Pick`+`Artwork Ready`, two views, and a billing-enabled Gemini key as Header Auth cred `Gemini API Key [n8n]`. Nano Banana is NOT free (~$0.16/run). 1×1+9×16 reversioning = Phase B. See its readme.
- 2026-06-08 — Added a PostToolUse hook (`.claude/hooks/airtable-trigger-fields-check.py`) that lints Airtable Trigger `Fields` config on every workflow build, the recurring Airtable-node failure mode.
- 2026-06-07 — Doc created. Decisions: 1 Picked topic = 1 Episode; picking via Telegram buttons; Frame.io for edited-detection + transcription. Started building #3.
- 2026-06-07 — #3 Script generation built (`q80QVMszf2iOfwIy`), inactive. Blocked on Shortlist `Last Modified Time` field + `Scripted` status option, and Episodes `Summary`/`Script`/`References`/`Source Shortlist` fields. See its readme.
