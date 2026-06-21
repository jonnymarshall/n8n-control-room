# BA: Guy's Take Script Generation

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `q80QVMszf2iOfwIy`.)

---

## TL;DR

When Guy marks a Shortlist topic as `Picked`, this workflow:

1. Detects the change (Airtable poll on the Shortlist table, scoped to a `Picked` view)
2. Fetches the current **Active sponsor** from the Sponsors table (name + overview)
3. Generates a **clean talking-head script** via OpenRouter (**GPT 5.1**) — leading questions + concepts + visual cues per beat, with exactly **one inline sponsor beat**. No titles, captions, SEO, social copy, or editor-resource modules — just the script Guy reads from.
4. Builds a **PicoCSS slideshow HTML file** from the beats (one slide per beat, keyboard/button navigation) plus a plain-markdown version of the script
5. Creates an `Episodes` record (`Status = Script Ready`) with the markdown script + references + a link back to the source Shortlist row, and **attaches the HTML slideshow** to that record
6. Flips the Shortlist row to `Status = Scripted` (so it won't re-trigger)
7. Sends the HTML slideshow to Telegram **as a document** with a caption (working title + Airtable link)

This is the handoff downstream of `BA - Guy's Take Weekly Research & Shortlisting`. One Picked topic → one Episode (decision 2026-06-07).

**Reworked 2026-06-11:** stripped from a 6-module asset package down to a script-only talking-head deliverable, model switched to GPT 5.1, added the PicoCSS slideshow (delivered both as an Airtable attachment and a Telegram document), and fixed the research-field-wipe bug (see gotchas).

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `q80QVMszf2iOfwIy` |
| **Trigger** | Airtable poll on `Shortlist`, every minute, on `Last Modified Time`, scoped to view `viw5PKdnY3XPmALjV` (Picked) |
| **Gate** | `Is Picked` IF (backstop; the view already scopes to Picked) |
| **Sponsor source** | `Sponsors` table (`tbl6sfPWRXmcLutxX`), filtered `{Status}='Active'`, limit 1 |
| **Output 1** | New record in `Episodes` (`Status = Script Ready`): markdown script in `Script`, `References`, link to source Shortlist |
| **Output 2** | PicoCSS slideshow HTML **attached** to the Episode (`Attachments` field, via content.airtable.com upload) |
| **Output 3** | Shortlist row updated to `Status = Scripted` |
| **Output 4** | Telegram **document** (the HTML) to Jonny's DM (chat ID `1512868522`, hardcoded) |
| **LLM** | `openai/gpt-5.1` via OpenRouter, `json_object` mode, temp 0.6, 8000 max tokens |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Trigger + Fetch Sponsor Info + Create Episode + **Upload Script HTML** + Mark Shortlist Scripted |
| `OpenRouter [n8n]` | `openRouterApi` | Script model |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | Telegram send-document |

The Telegram chat ID is **hardcoded** to `1512868522` (Jonny's DM). This instance blocks `$env` access in expressions (`N8N_BLOCK_ENV_ACCESS_IN_NODE`), so do not use `$env` here. To switch to the group chat later, change the literal chat ID on the node.

> **Manual credential step after a code update.** `update_workflow` from code does **not** auto-assign the
> credential on the **Upload Script HTML** HTTP Request node (it uses Predefined Credential Type →
> Airtable API). Open that node and attach `Airtable [n8n] (PAT)` manually, and confirm the other
> Airtable nodes still have the PAT attached (especially **Fetch Sponsor Info** — must be the PAT, not
> Airtable OAuth2) before running.

---

## Required Airtable schema (verify before activating)

### `Shortlist` table (`tblED3N6WdT1tQTzY`)

1. **`Last Modified Time` field** (watching **all** fields) — the trigger sorts on a field named exactly `Last Modified Time`. If it watches only some fields, a Status flip won't bump it and the trigger never fires.
2. **`Scripted`** added to the `Status` single-select — terminal state that stops re-triggering.
3. **A grid view filtered to `Status = Picked`** (`viw5PKdnY3XPmALjV`) — the trigger is scoped to it.

### `Sponsors` table (`tbl6sfPWRXmcLutxX`)

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text | Sponsor name — injected into the script |
| `Status` | Single select | Must include `Active`; the workflow pulls the first `Active` row |
| `Overview` | Long text | The sponsor brief the model uses to build the inline plug |
| `Attachment Summary` | aiText | Optional extra context, passed as "Extra notes" |

Exactly **one** sponsor should be `Active` at a time (the search is `limit 1`).

### `Episodes` table (`tbl3uYLIvtB9APZp6`)

| Field | Type | Notes |
|---|---|---|
| `Summary` | Long text | Copied from the Shortlist topic |
| `Script` | Long text | The talking-head script as **clean markdown** (one section per beat) |
| `References` | Long text | The references block |
| `Source Shortlist` | Link → Shortlist | Back-link to the topic this episode came from |
| `Attachments` | Attachment | Where the PicoCSS slideshow HTML is uploaded |

`Title` and `Status` already exist from Phase 0. The HTML is uploaded to the field literally named **`Attachments`** — if you rename it, update the URL on the Upload Script HTML node.

---

## Step-by-step: what the workflow does

Wiring is linear: **Shortlist Row Changed → Is Picked → Fetch Sponsor Info → Generate Script → Build Script HTML → Create Episode → Upload Script HTML → Mark Shortlist Scripted → Surface HTML for Doc → Convert HTML to File → Notify Script Ready** (model + parser hang off Generate Script as subnodes).

1. **Shortlist Row Changed** — Airtable Trigger polls the Shortlist `Picked` view every minute, ordered by `Last Modified Time`, pulling `Topic, Summary, Status`.
2. **Is Picked** — IF backstop; continues only when `Status = Picked`. The `Scripted` flip drops out here, so no trigger loop.
3. **Fetch Sponsor Info** — Airtable search on `Sponsors`, `{Status}='Active'`, limit 1.
4. **Generate Script** — Basic LLM Chain. System prompt = the talking-head framework (retention pillars; the fixed Hook/graphic/setup/3 core points/sponsor/payoff/CTA/endframe beats with their exact required lines). User message injects Topic + Summary (from the trigger via `.first()`) and the sponsor Name/Overview. A Structured Output Parser forces JSON `{ title_suggestion, references, slides }`, where **`slides` is an array of beat objects** (`heading`, `share`, `leading_questions[]`, `concepts[{point, visual_cue}]`).
   - **Script Model (OpenRouter)** subnode: `openai/gpt-5.1`, `json_object` mode, temp 0.6, 8000 max tokens.
   - **Script Output Parser** subnode: JSON-schema-from-example.
5. **Build Script HTML** — Code node (run once for all items). From `output.slides` it builds two things: `scriptText` (clean markdown, one `##` section per beat with leading questions + cover bullets + visual cues), and `html` (a self-contained PicoCSS slideshow — title slide + one slide per beat + a references slide, with Prev/Next buttons and arrow-key/space nav). Also returns `htmlBase64` (base64 of the HTML) and a `fileName` slug. **HTML-escapes all model text.**
6. **Create Episode** — Airtable create in `Episodes`: `Title` = Topic, `Status` = Script Ready, `Summary`, `Script` = `scriptText`, `References`, `Source Shortlist` = link to the Shortlist record. `typecast: true`.
7. **Upload Script HTML** — HTTP POST to `content.airtable.com/v0/{base}/{recordId}/Attachments/uploadAttachment` (record id from the just-created Episode), JSON body `{ contentType: "text/html", filename, file: <base64> }`. Auth = Predefined Credential Type → Airtable API.
8. **Mark Shortlist Scripted** — Airtable update matching on `id`, sets `Status = Scripted` **and nothing else** (see gotcha).
9. **Surface HTML for Doc** — Set node re-surfaces `htmlBase64` + `fileName` onto the current item (the Airtable-update output dropped them) so the next node can read them.
10. **Convert HTML to File** — Convert to File (`toBinary`): reads `htmlBase64` (`dataIsBase64: true`), writes binary property `data`, `mimeType text/html`, filename from `$json.fileName`.
11. **Notify Script Ready** — Telegram **sendDocument** (resource `message`): sends binary `data` to chat `1512868522` with an HTML caption (working title + Airtable link).

---

## Gotchas / things to verify on first run

- **Upload Script HTML credential is NOT auto-assigned** from a code update — attach `Airtable [n8n] (PAT)` to that HTTP node by hand (see Required credentials).
- **`Mark Shortlist Scripted` must write ONLY `id` + `Status`.** The earlier version also wrote `Channel Count`, `Total Views`, `Viral Score` as `0`, which **wiped the research data** on the row when it was scripted (the "F6" bug). The node is now mapped to `id` + `Status` only. If you edit it in the UI and click "Load Schema", delete any auto-added fields before saving.
- **HTML build is escape-safe but model-shaped.** `Build Script HTML` HTML-escapes all text, so model output can't break the page. But it expects `output.slides` to be an array of `{heading, share, leading_questions, concepts:[{point,visual_cue}]}`. If the schema drifts, the slideshow degrades gracefully (missing pieces are skipped) but check a real run.
- **Flat vs nested trigger fields.** Trigger values are read defensively as `{{ $json.X ?? $json.fields?.X }}`. The record `id` is always top-level (`$json.id`).
- **Chain output path.** Script fields read from `$json.output.*` (the parsed object). If the parser ever returns top-level fields, adjust.
- **Output-parser reliability.** Runs in `json_object` mode. If long scripts trip the parser, enable **autoFix** on the Script Output Parser (adds a repair LLM call).
- **One Active sponsor.** `limit 1` on `{Status}='Active'`. Keep exactly one Active. If zero are Active, the sponsor fields come through empty and the model notes the beat is unfilled.
- **Airtable Trigger `Fields` list rules (caused repeated failures).** If you restrict Options → Fields: (1) include the trigger field itself (`Topic,Summary,Status,Last Modified Time`), and (2) use commas with **NO spaces**. A PostToolUse hook (`.claude/hooks/airtable-trigger-fields-check.py`) lints this on every build.
- **Don't click "Load Schema" / refresh fields** on the Airtable nodes — it wipes column mappings.
- **Code update side effects.** Rebuilding from code can flip the workflow **inactive** and may drop the `availableInMCP` toggle. Re-activate and re-enable MCP in the UI when you're done testing.
- **`google/gemini-2.5-flash` → `openai/gpt-5.1`.** Model slug must be valid on OpenRouter; pick from the node dropdown if a run errors on the model.

---

## Limitations / future work

- **Source context is Topic + Summary only.** The model isn't fed the linked source videos' URLs, so references lean on `(verify link)`. A v2 could fetch the Shortlist row's linked `Stories` and feed real URLs.
- **One execution scripts one topic.**
- **Picking** can be done in Airtable directly or (interim) by asking the Telegram Airtable Assistant to set `Status = Picked`; this workflow triggers off `Picked` regardless of how it got there.

---

## Related

- **Upstream:** `BA - Guy's Take Weekly Research & Shortlisting` (`Z9dDjafBA899Hgok`) — produces the Shortlist rows this workflow consumes.
- **Downstream:** `BA - Guy's Take Thumbnail Artwork` (`YyXiJ0lusoW7ynu9`).
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (this is workflow #3)
- **Phase 0 pipe:** `Airtable: Episode status changed → Telegram` (`GbFwXLACjj1O6spS`)
- **SDK source:** `scripts/deploy/workflows/guys-take-script-generation.sdk.js`
