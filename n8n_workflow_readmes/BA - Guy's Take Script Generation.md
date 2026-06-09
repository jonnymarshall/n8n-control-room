# BA: Guy's Take Script Generation

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `q80QVMszf2iOfwIy`.)

---

## TL;DR

When Guy marks a Shortlist topic as `Picked`, this workflow:

1. Detects the change (Airtable poll on the Shortlist table, scoped to a `Picked` view)
2. Fetches the current **Active sponsor** from the Sponsors table (name + overview)
3. Generates a full retention-optimised **asset package** via OpenRouter, closely mirroring the `guys-take-script` skill: 5 viral titles, 5 thumbnail captions, SEO description + section outline, a video timeline + beat-by-beat storyboard (leading questions, concepts, visual cues, fixed Hook/graphic/payoff/CTA/endframe beats), a **dynamically-matched inline sponsor beat**, references, and editor's resources
4. Creates an `Episodes` record for that topic with `Status = Script Ready`, storing the full asset package + references + a link back to the source Shortlist row
5. Flips the Shortlist row to `Status = Scripted` (so it won't re-trigger)
6. Sends a Telegram message with the working title and a preview

This is the handoff downstream of `BA - Guy's Take Weekly Research & Shortlisting`. One Picked topic → one Episode (decision 2026-06-07). The script framework is ported from `tmp/SKILL.md` (`guys-take-script` v2.0); the sponsor is pulled live from Airtable rather than hardcoded.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `q80QVMszf2iOfwIy` |
| **Trigger** | Airtable poll on `Shortlist`, every minute, on `Last Modified Time`, scoped to view `viw5PKdnY3XPmALjV` (Picked) |
| **Gate** | `Is Picked` IF (backstop; the view already scopes to Picked) |
| **Sponsor source** | `Sponsors` table (`tbl6sfPWRXmcLutxX`), filtered `{Status}='Active'`, limit 1 |
| **Output 1** | New record in `Episodes` (`Status = Script Ready`), full asset package in `Script` |
| **Output 2** | Shortlist row updated to `Status = Scripted` |
| **Output 3** | Telegram message to Jonny's DM (chat ID `1512868522`, hardcoded) |
| **LLM** | `google/gemini-2.5-flash` via OpenRouter, `json_object` mode, temp 0.6, 8000 max tokens (tunable) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |

---

## Required credentials

Auto-assigned at build time (same as the rest of the Guy's Take build):

| n8n credential name | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Trigger + Fetch Sponsor Info + Create Episode + Mark Shortlist Scripted |
| `OpenRouter [n8n]` | `openRouterApi` | Script model |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | Telegram send |

The Telegram chat ID is **hardcoded** to `1512868522` (Jonny's DM), matching the research workflow. This instance blocks `$env` access in expressions (`N8N_BLOCK_ENV_ACCESS_IN_NODE`), so `{{ $env.TELEGRAM_USER_CHAT_ID }}` throws "access to env vars denied" — do not use `$env` here. To switch to the group chat later, change the literal chat ID on the node.

> After an `update_workflow` from code, the MCP may report **no** auto-assigned credentials. Open each
> node and confirm the credential is still attached (especially **Fetch Sponsor Info**, which must be on
> the PAT, not Airtable OAuth2) before running.

---

## Required Airtable schema (set up during the build, verify before activating)

### `Shortlist` table (`tblED3N6WdT1tQTzY`)

1. **`Last Modified Time` field** (type: Last Modified Time, watching **all** fields) — the trigger sorts on a field named exactly `Last Modified Time`. If it watches only some fields, a Status flip won't bump it and the trigger never fires.
2. **`Scripted`** added to the `Status` single-select (alongside `Shortlisted` / `Picked` / `Rejected`) — terminal state that stops re-triggering.
3. **A grid view filtered to `Status = Picked`** (`viw5PKdnY3XPmALjV`) — the trigger is scoped to it so it only ever sees Picked rows.

### `Sponsors` table (`tbl6sfPWRXmcLutxX`)

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text | Sponsor name (e.g. Bitbox) — injected into the script |
| `Status` | Single select | Must include `Active`; the workflow pulls the first `Active` row |
| `Overview` | Long text | The sponsor brief the model uses to build the inline plug |
| `Attachment Summary` | aiText | Optional extra context, passed as "Extra notes" |

Exactly **one** sponsor should be `Active` at a time (the search is `limit 1`).

### `Episodes` table (`tbl3uYLIvtB9APZp6`)

| Field | Type | Notes |
|---|---|---|
| `Summary` | Long text | Copied from the Shortlist topic |
| `Script` | Long text | The **full asset package** markdown (all 6 modules), not just spoken lines |
| `References` | Long text | Module 5 references block |
| `Source Shortlist` | Link → Shortlist | Back-link to the topic this episode came from |

`Title` and `Status` already exist from Phase 0. (`Co-host` was removed from the table; the host is always Guy with no co-host, so the workflow no longer writes it.)

---

## Step-by-step: what the workflow does

Wiring is linear: **Shortlist Row Changed → Is Picked → Fetch Sponsor Info → Generate Script → Create Episode → Mark Shortlist Scripted → Notify Script Ready** (model + parser hang off Generate Script as subnodes).

1. **Shortlist Row Changed** — Airtable Trigger polls the Shortlist `Picked` view every minute, ordered by `Last Modified Time`, pulling `Topic, Summary, Status`.
2. **Is Picked** — IF node backstop; continues only when `Status = Picked`. The `Scripted` flip this workflow makes drops out here, so there's no trigger loop.
3. **Fetch Sponsor Info** — Airtable search on `Sponsors`, `filterByFormula = {Status}='Active'`, limit 1. Yields the one sponsor record (Name + Overview).
4. **Generate Script** — Basic LLM Chain. The system prompt is the ported `guys-take-script` framework (core retention pillars, the 6 modules, the fixed Hook/graphic/sponsor/payoff/CTA/endframe beats, the exact required lines). The user message injects Topic + Summary (from the trigger via `.first()`) and the sponsor Name/Overview (from Fetch Sponsor Info). A Structured Output Parser forces JSON `{ title_suggestion, references, script }`, where `script` is the **whole asset package** markdown.
   - **Script Model (OpenRouter)** subnode: `google/gemini-2.5-flash`, `json_object` mode, temp 0.6, 8000 max tokens.
   - **Script Output Parser** subnode: JSON-schema-from-example.
5. **Create Episode** — Airtable create in `Episodes`: `Title` = Topic, `Status` = Script Ready, `Summary`, `Script` = `output.script` (full package), `References` = `output.references`, `Source Shortlist` = link to the Shortlist record. `typecast: true`. All cross-node refs use `.first()` (not `.item`) so pairing survives the path through the search node.
6. **Mark Shortlist Scripted** — Airtable update matching on `id`, sets the Shortlist row `Status = Scripted`.
7. **Notify Script Ready** — Telegram message (HTML) with the working title and the first ~600 chars of the package.

---

## Gotchas / things to verify on first run

- **Flat vs nested fields.** The Airtable Trigger's field values are referenced defensively as
  `{{ $json.X ?? $json.fields?.X }}` because the trigger's output shape (fields at top level vs under
  `.fields`) can vary by version. If a run shows empty Topic/Summary, check which shape the trigger
  emits and simplify the expressions. The record `id` is always top-level (`$json.id`).
- **Chain output path.** Script fields read from `$json.output.*` (the parsed object). If the parser
  returns fields at the top level instead, adjust to `$json.script` etc.
- **Large JSON output reliability.** The whole asset package is returned inside one JSON `script` string,
  so the model must escape a big markdown block. It runs in `json_object` mode to make that reliable. If
  you see output-parser failures on long packages, enable **autoFix** on the Script Output Parser (adds a
  second LLM repair call) or lower the package length. (The research workflow uses autoFix for the same reason.)
- **Full asset package lives in `Script`.** The `Script` field holds all 6 modules (titles, captions,
  SEO, storyboard, sponsor, references, editor resources), not just spoken lines. If you'd rather split
  these into their own Episode fields, that's a follow-up.
- **One Active sponsor.** Fetch Sponsor Info is `limit 1` on `{Status}='Active'`. Keep exactly one sponsor
  Active, or it'll pick an arbitrary one. If zero are Active, the sponsor fields come through empty and the
  model will note the sponsor beat is unfilled.
- **Model slug.** `google/gemini-2.5-flash` must be a valid OpenRouter slug; if the run errors on the
  model, pick the current one from the node dropdown. Flash is cheap and handles the large structured
  output; swap to a stronger model if script quality needs it.
- **Airtable Trigger `Fields` list rules (caused repeated failures).** If you restrict the trigger's
  Options → Fields: (1) the value MUST include the trigger field itself, so
  `Topic,Summary,Status,Last Modified Time`, not just `Topic,Summary,Status` (a restricted list makes
  Airtable return only those fields, and the trigger then can't find its sort field →
  `The Field "Last Modified Time" does not exist`); and (2) use commas with **NO spaces** — the node
  doesn't trim, so `Topic, Summary` sends `" Summary"` → `Unknown field name`. A PostToolUse hook
  (`.claude/hooks/airtable-trigger-fields-check.py`) now lints this on every build.
- **`Last Modified Time` field name** must match exactly, or the trigger silently fails to fire.
- **Don't click "Load Schema" / refresh fields** on the Airtable nodes in the UI — it wipes the column
  mappings. (Same gotcha as the research workflow.)
- **`Mark Shortlist Scripted` must write ONLY `id` + `Status`.** Loading the field schema in the UI can
  auto-populate the other Shortlist columns (`Channel Count`, `Total Views`, `Viral Score`) with `0`,
  which would **overwrite/wipe the research data** on the row when it's marked Scripted. If you edit this
  node in the UI, delete any field other than `id` and `Status` before saving.
- Created **inactive**. Make the schema changes above, do one manual test (set a Shortlist row to
  Picked), then activate.

---

## Limitations / future work

- **Source context is Topic + Summary only.** The model isn't yet fed the linked source videos' URLs, so
  Module 5 references lean on `(verify link)`. A v2 could fetch the Shortlist row's linked `Stories`
  records and feed real source URLs + fuller context. Logged as a v2 improvement.
- **Skill parity is partial by design.** The `guys-take-script` skill also writes files, renders an HTML
  slideshow, and supports multi-topic runs — those are Claude-Code-runtime concerns and are intentionally
  omitted here. The content structure (modules, beats, `· NN%` tokens, fixed lines) is preserved; one
  execution scripts one topic.
- **Picking is currently manual-in-Airtable.** The chosen confirmation mechanism is Telegram inline
  buttons (workflow #2b in the build status doc), which sets `Status = Picked` from the Friday digest.
  This workflow triggers off `Picked` regardless of how it got there, so it works either way.

---

## Related

- **Upstream:** `BA - Guy's Take Weekly Research & Shortlisting` (`Z9dDjafBA899Hgok`) — produces the Shortlist rows this workflow consumes.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (this is workflow #3)
- **Phase 0 pipe:** `Airtable: Episode status changed → Telegram` (`GbFwXLACjj1O6spS`)
