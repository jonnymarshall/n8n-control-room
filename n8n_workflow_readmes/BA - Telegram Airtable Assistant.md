# BA: Telegram Airtable Assistant

> **Renamed 2026-08-04** from `BA - Telegram Airtable Assistant.md` to match the workflow's actual display name in n8n (`BA: Telegram Airtable Assistant`). The file previously carried the old `Pod21:` name it was built under.

> **Find this workflow in n8n by name.** Workflow IDs change whenever the workflow is rebuilt from code (credential bindings don't survive API updates, so structural changes are done as create-new + archive-old). The name is the stable identifier.

> **2026-10-29 - publishing requests are now a first-class section (LIVE, published `69008f74`).** Charlie replied "Yes, upload the episode to Fountain as a draft please" and the assistant answered: *"Uploading to Fountain isn't something I can do ... You'd need to download the file from Frame.io once you're back in, then upload it to Fountain manually."* It was not hallucinating a limitation: nothing in the system message described publishing at all, and the `== HOW THE PIPELINE WORKS (System Map) ==` trigger only covered "how the workflows work / why something hasn't happened / what an episode still needs", so an instruction to *do* something on Fountain never sent it to the Map. **Fix, two parts:** (1) a new `== PUBLISHING (FOUNTAIN) ==` block in the `Airtable Agent` system message saying publishing is one Airtable write (`Status = Ready to Publish`, plus `Release Date` if missing/past), that there is no draft-only mode (the item is uploaded **and scheduled** at the `Publishing Settings` time, currently `06:00` `America/New_York`), that a `Scheduled` episode's date does not re-sync, and that nothing sets `Published` because the reconciler is inactive; (2) "a request to publish / upload / schedule / take an episode live" added to the System Map read trigger. The Map's stage 5 gained the matching recipe. Live edit was a surgical `patchNodeField` on `parameters.options.systemMessage` (no structure change); `versionId` = `activeVersionId`, still active with `availableInMCP: true`, all 11 Airtable and 13 Telegram credential bindings intact. SDK snapshot refreshed. **Not yet exercised by a real Telegram message** - the next publish request is the test.

> **2026-11-04 - every plain reply crashed with `unwrapMessage is not defined` (LIVE, published `110383fb`).** The JSON-unwrap change from 2026-11-02 was pasted one brace too deep: `const unwrapMessage = ...` landed *inside* the `photos` branch of `Parse Agent Decision` instead of above the action branches. `write` and `photos` proposals kept working, but the `respond` branch (any ordinary answer) called a function that no longer existed in scope, so the Code node threw a `ReferenceError` and the run died before `Send Answer`; the chat got a workflow-failed alert instead of the answer. Executions `11812` (2026-11-02 16:03 UTC, 18 minutes after the broken publish) and `12969` (2026-11-04, "change the release date for ... The Enshitification of Everything") both died this way. **Fix:** the function is hoisted above `if (parsed.action === 'write')`, nothing else changes, so the double-encoded replies the 2026-11-02 change was written for are still peeled. Replaying execution `12969`'s stored `Airtable Agent` output through the new code yields the intended `respond`; `respond`, `write`, `photos`, no-urls and malformed outputs were all replayed locally before pushing. Live edit was a surgical `patchNodeField` on `Parse Agent Decision.parameters.jsCode`; `versionId` = `activeVersionId`, workflow active with `availableInMCP: true`, all 25 credential bindings intact, SDK snapshot refreshed.
> **2026-09-09 - duplicate requested photos fixed (`rec5LOfhPFrqv4KSr`, `recgEIgGYQBQzQLc3`).** The old `Build Photo Album` always padded a request to four URLs by repeating the final URL because `Send Album` has four static slots. Execution `2399` proves the bug: the agent returned one 16x9 URL for `BA-lFHoRQ`, the builder expanded it to four identical URLs, and Telegram sent four copies. The path now sends one to three requested images individually and keeps the existing four-image album for a full option set. Every individual photo includes the `BA-xxxx` ID in an HTML caption. Isolated count-routing tests passed for one, two and four URLs; a fresh real Telegram request is still needed for end-to-end confirmation.
> **2026-09-13 - artwork status guidance corrected.** The `Airtable Agent` system message now explicitly treats the System Map's Path 1 checklist as authoritative for initial artwork. `Approved` is the usual human handoff in the lifecycle, not an artwork-trigger requirement. When asked why artwork has not started, the agent must report the actual Status rule (`Status` is not `Awaiting Thumbnail Pick` or `Generating Artwork`) and the other missing Path 1 fields.
> **2026-10-07 - packaging summary no longer implies `Approved` is required (LIVE, published `87c4b9d4`).** The agent had been ending packaging-write summaries with "Artwork will start once this is approved", which reads as the episode `Status` needing to reach `Approved`. It does not: the generate trigger view only excludes `Awaiting Thumbnail Pick` and `Generating Artwork`, so artwork starts as soon as the write lands. The `Airtable Agent` system message (both the `EPISODE PACKAGING REPLY` block and the `ARTWORK STATUS RULE` block) now says that when a write includes a non-empty `Custom Image Prompt`, the summary must state the artwork run starts automatically as soon as the write lands (usually within a minute) and that the episode does **not** need to be set to `Approved`, and must never phrase it as "artwork will start once this is approved". Live edit was a surgical `patchNodeField` on the `Airtable Agent` `parameters.options.systemMessage` (no credential impact); `versionId` = `activeVersionId`, workflow still active with `availableInMCP: true`. SDK copy updated to match.
> **2026-10-07 - multi-write requests now state their next step explicitly (LIVE).** On a request that needs more than one Airtable call (for example "delete the 4 Thumbnails rows for BA-5XpVHJ and reset the episode Status", where Thumbnails and Episodes are different tables and one call can only touch one), the agent proposed and executed only the first write, and mentioned the second only in passing. Replying "run the second write" worked, but nothing told the user that. The `WRITE RULES` block of the `Airtable Agent` system message now requires the agent to: say plainly in the summary that the proposal is step 1 of N and what remains, and ALWAYS end the summary with an explicit call to action quoting the exact words to send, e.g. "Approve this delete, then reply 'run the second write' and I will propose resetting the episode Status to AI Analysis Complete." It may never leave the next step unstated or imply it happens automatically. The summary is reused by `Confirm Write Done`, so the post-approval "✅ Done" message carries the same instruction. Live edit was a surgical `patchNodeField` on the same field.
> **2026-10-27 - unescaped quotes in the agent's own JSON no longer drop a write (LIVE, published `bea71d82`).** An episode-packaging reply for `BA-w6yJGI` (execution `8835`) produced a completely valid Airtable payload, but the model quoted Jonny's image prompt inside the `summary` and left the inner double quotes unescaped. That made the whole envelope invalid JSON, so `Parse Agent Decision` failed closed: no approval buttons, no write, and the "came out malformed" reply. The payload itself was escaped correctly. **Fix:** `Parse Agent Decision` now retries once when strict parsing fails. The repair pass starts at the envelope's opening `{"action"` (prose before it can contain balanced quotation marks) and escapes any double quote inside a string that is not followed, ignoring whitespace, by `:`, `,`, `}` or `]`. Strict parsing always runs first, so output that already parsed is untouched, and a genuinely truncated payload still fails closed. Replaying the failed run's `Airtable Agent` output through the new code yields the intended PATCH on `BA-w6yJGI`, and the other 29 stored runs produce identical results. Live edit was a surgical `updateNode` on `Parse Agent Decision.parameters.jsCode`; `versionId` = `activeVersionId`, workflow active with `availableInMCP: true`, all Airtable/Telegram credentials still bound.
> **2026-09-25 - approval buttons are now single-use (LIVE, published `f9ca46d3`).** Overnight the assistant executed the same Airtable write about 75 times between 04:01 and 04:24 local. Telegram keeps an inline keyboard live forever, and every tap re-ran the approved write; the repeated write kept re-setting `BA-5GM2XJ`'s chosen thumbnail row to `Selected`, which re-armed the artwork pick trigger, so the two workflows fed each other (the assistant every ~18-20s, the artwork every 60s) until the tapping stopped. The taps were real, distinct Telegram updates from user `c` (`buffedcalamari`, id `8923732358`), the approver listed alongside Jonny. **Fix:** `Handle Button Press` now records an executed approval's `message_id` (workflow static data, written by `Record Executed Write`, and only on a successful Airtable write so a failed write can still be retried) and refuses any later tap on that same message. A new `Is Duplicate?` gate keeps that refusal silent so a stray or stuck tapper cannot spam the group; the stored ids are pruned to ~7 days / 500 entries. To genuinely change a decision, re-propose the write (a new message) rather than re-tapping the old one. See also the artwork readme's re-trigger notes - the artwork side was left unchanged because the repeated writes were the driver.
> The live workflow's short n8n description still describes every response as a four-image album. This is cosmetic only. Do not use a public API `PUT` just to change it because that deactivates the workflow and removes `availableInMCP`; update it during the next safe UI edit instead.

> ✅ **"photos" reply path — LIVE & VERIFIED (2026-06-23).** The `photos` action (sends the actual thumbnail images as one album + a details message, instead of links) was built via the n8n SDK as a duplicate workflow, **`Hx8Ul6M41fM8HuxU`**, to keep the original `peTIs4kiluFZHoLg` untouched during the build. It's now confirmed working and, because it's been activated to receive live Telegram messages, **it holds the bot's webhook — so `Hx8Ul6M41fM8HuxU` is the de-facto live workflow now** (one Telegram trigger per bot). Its display name reverted to `BA: Telegram Airtable Assistant` on the last API update, so it currently shares a name with the dormant original — tell them apart by ID.
>
> **Remaining cleanup (optional, not yet done):** archive the old `peTIs4kiluFZHoLg` so the duplicate name is gone and it can't reclaim the webhook if someone reactivates it. SDK source of truth: `scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`. Note on this instance: SDK `update_workflow` skips credentials on the 4 Airtable HTTP nodes (rebind by hand) and only saves a draft — you must call `publish_workflow` (or toggle Active) for changes to actually run.

---

## TL;DR

A general-purpose AI agent reachable on Telegram via `@pod21_n8n_agent_bot`, in **Jonny's DM and in the `pod21` group** (Jonny + Charlie). It can:

1. **Read anything** in any Airtable base the PAT can see, and answer questions directly ("what episodes are in the pipeline?")
2. **Propose writes** (create / update / delete) but never execute them itself; every write becomes an approval message with native one-tap ✅ Approve / ❌ Cancel buttons
3. **Ask clarifying questions** when a request is ambiguous instead of guessing
4. **Send real images** (`photos` action - thumbnails, artwork, any image attachment) straight into the chat instead of pasting attachment links. One to three requested images are sent individually; four are grouped as an album.
5. **Explain the pipeline** — it has a "brain" (the **System Map**, see below) so it understands how the workflows fit together and can answer "what does this episode need before its artwork is made?" or "why hasn't X happened yet?" by reading the episode and comparing it to each stage's preconditions.
6. **Log automation issues** — say something's broken (or reply to a workflow's message with "log this as an issue") and it researches the problem, then proposes a row in the **Automation Upgrades** table for a later fix. See below.
7. **Attach a thumbnail image** — send a photo and it attaches it to the episode's artwork, choosing the `16x9`, `1x1` or `9x16` slot from the image's dimensions. See [Attaching a thumbnail image](#attaching-a-thumbnail-image).

Reads need no approval. Writes always do. The agent has no write tools at all, so even a confused model cannot mutate Airtable without a button tap.

> **The System Map (the agent's pipeline knowledge), added 2026-07-15.** The assistant's read tools give it live Airtable data but no understanding of how the automations chain together. The **System Map** supplies that: a compact, agent-facing state-machine of the whole Guy's Take pipeline (each workflow's trigger, the exact Airtable field conditions an episode needs before the next stage runs, the `Status` ladder, what each `Type` means). It lives as an Airtable row — base Guy's Take (`app8Xw9Tq0XLjhmp9`), table **`Prompts`** (`tblhG1nw2P1k3CBVU`), row `Name = "System Map"`, text in the `Prompt` field — so it can be edited without touching n8n. The agent's system prompt (section `== HOW THE PIPELINE WORKS (System Map) ==`) instructs it to **read that row on demand** (via its existing `airtable_read` tool, `filterByFormula={Name}="System Map"`) whenever a turn is about how the pipeline works or what an episode is missing, then answer from it plus the live record. **No new nodes, no rebuild, no credential rebind** — it reuses the read tool the agent already has. The authoring source / backup of the Map is `workflow_planning/System Map.md`; edit the Airtable row to change what the agent knows, and paste the change back into that file to keep them in sync. SDK source of the prompt instruction: `scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`.

**Addressing it in a group:** the bot only acts on a group message that **@mentions it** (`@pod21_n8n_agent_bot ...`) or is a **reply to one of its own messages**. Everything else in the group is ignored. Replying to its messages is the natural way to follow up ("delete this episode" as a reply to its "✅ Done. Created ..." message).

**In a 1:1 DM (changed 2026-08-11):** no mention is needed. Any message sent in a private chat with the bot is treated as addressed to it, because there is nobody else there to address. The sender allowlist (Jonny + Charlie) still applies. This was added so reporting a broken automation is as cheap as typing it.

> **Convention — episode/record ID in every message.** Other workflows that notify this chat (metadata ready, script ready, thumbnail picks, skip/error notices) are required to print the episode's unique ID (`BA-xxxx`, in a `<code>` block) in the message. When Jonny replies to one of those messages, that ID is the anchor that tells you which episode the reply ("change the title", "delete this") is about — read it out of the replied-to message rather than guessing. See `CONVENTIONS.md` in this folder.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Telegram update (`message` + `callback_query`) on `@pod21_n8n_agent_bot` |
| **Chats** | Jonny's DM + the `pod21` group (`-5254203539`); one trigger serves both |
| **Authorized users** | Jonny (`1512868522`) and Charlie (`8923732358`), enforced by the `From Jonny or Charlie?` IF gate; both are also write approvers |
| **Addressing** | Groups: only an `@mention` of the bot or a reply to the bot. Private chats: any message (`Addressed to bot?` gate, third condition `chat.type === 'private'`) |
| **Issue log** | Automation Upgrades — base `appwcz1Bux9YLcZYm` (n8n-pod21), table `tblja27Lsn7qXJfZM` |
| **LLM** | Claude Sonnet 4.6 via OpenRouter (`anthropic/claude-sonnet-4.6`, temp 0.2) |
| **Scope** | Every Airtable base the PAT has access to (dynamic discovery, nothing hardcoded) |
| **Memory** | Rolling 20-turn conversation buffer, keyed per chat (DM and group have separate threads) |

---

## Telegram setup (groups)

For the bot to receive group messages it needs **Group Privacy turned OFF** in BotFather (`/mybots` → the bot → Bot Settings → Group Privacy → Turn off), then **remove and re-add the bot to the group** so the change takes effect. With privacy on, Telegram's delivery of plain `@mentions` is unreliable; with it off the bot receives all group messages and the `Addressed to bot?` gate decides what to act on. Replies to the bot and `/commands` are delivered regardless of the privacy setting.

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | Trigger + all Telegram send/answer nodes |
| `OpenRouter [n8n]` | `openRouterApi` | Chat model |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | 3 read tools + `Execute Airtable Write` (all HTTP Request nodes) |

The **Airtable PAT** should have `schema.bases:read`, `data.records:read`, and `data.records:write` on **every base** you want the assistant to touch; a base the PAT can't see simply doesn't exist to the agent.

⚠️ **Rebuild gotcha:** if this workflow is ever recreated via the n8n API, credential auto-assignment covers the Telegram and OpenRouter nodes but always skips the HTTP Request nodes; those must be re-bound by hand in the UI.

---

## How it works

### Message path (you text or @mention the bot, or reply to it)

1. **Telegram trigger** fires. `Is Button Press?` splits `callback_query` updates (buttons) from `message` updates (text).
2. **`Addressed to bot?`** gate: a message passes if it `@mentions` `@pod21_n8n_agent_bot` (checked against the message `entities`), **or** is a reply to one of the bot's own messages, **or** was sent in a private chat (`chat.type === 'private'`). Anything else is dropped.
3. **`From Jonny or Charlie?`** gate: passes only messages whose `from.id` is Jonny (`1512868522`) or Charlie (`8923732358`). Other senders are ignored.
4. **`Prep Agent Input`** (Code node) builds the prompt sent to the agent:
   - prefixes it with `[Message from Jonny]` / `[Message from Charlie]`, resolved from `from.id`. The agent node is only ever handed `promptText`, so without this tag it has **no idea who is talking to it** — this is what lets it fill `Reported By` on an issue report,
   - strips the `@pod21_n8n_agent_bot` mention from the text, and
   - **if the message is a reply**, wraps the bot's earlier message plus the new instruction into one prompt so words like "this" / "it" resolve to the record the earlier message described. This is what lets "delete this episode" work as a reply, even though the button-approved create never entered the agent's memory.
5. **AI Agent** (Sonnet 4.6) runs with three read-only tools:
   - `list_airtable_bases` — GET `/v0/meta/bases`
   - `get_base_schema` — GET `/v0/meta/bases/{baseId}/tables`
   - `airtable_read` — generic GET with any path/query (records, filters, single record)
6. The agent must reply with a strict JSON envelope, one of:
   - `{ "action": "respond", "message": "..." }` — answers, read results, clarifying questions
   - `{ "action": "write", "summary": "...", "method": "...", "path": "...", "body": {...} }` — a write proposal
    - `{ "action": "photos", "urls": [...], "caption": "details text" }` - send the real requested images followed by a separate text message, instead of pasting links. The agent defaults to this whenever asked to see/send/show image attachments. `caption` is the follow-up message: it leads with the episode code `BA-xxxx` (the reply anchor) and lists each option and its current status. One to four images are supported.
7. **Parse Agent Decision** (Code node) enforces the contract: malformed output, bad methods, or empty paths all degrade to a plain text reply, **never** to a write. A `photos` envelope with no valid `http(s)` URL also degrades to a text reply.
   - **Link fields (added 2026-08-13):** the agent sometimes proposes a link field as `"Guests": [{"id": "recAAA"}]`. Airtable only accepts an array of plain record ID strings and rejects the object form with `INVALID_RECORD_ID — Value "[object Object]" is not a valid record ID`, which fails the **whole** batched PATCH, so a five-field packaging update lands nothing. Both this node and **Handle Button Press** now unwrap a bare `{id}` / `{id, name}` ref into its ID string. Unwrapping happens here so the approval message shows the payload that will actually be sent, and again in the button handler so approval messages composed before the fix still execute on a re-tap. It only rewrites values **inside `fields`**, and only when `id` matches the `rec…` pattern, so attachment objects (`{url, filename}`) and the `{id, fields}` record wrapper are untouched. The matching plain-record-ID instruction was added to the live system prompt on 2026-09-09; the code guards remain as defensive protection.
   - **Extracting the JSON (rewritten 2026-08-13):** the agent regularly ignores "no text outside the JSON" — roughly 20 of 26 recent runs wrapped the envelope in prose ("Good. I have everything I need. Let me map the selections: …"), and from 2026-08-13 it also started appending a **stray extra `}`** after the closing brace. The original parser sliced from the first `{` to the *last* `}`, which swallowed that stray brace, failed `JSON.parse`, and silently degraded a perfectly good write proposal into a plain reply — so **no Approve/Cancel buttons appeared** and the write was dropped (executions 1771, 1773, 1781). It now walks the text tracking brace depth and string/escape state, collects every *balanced* `{…}` block, and takes the last one carrying a recognised `action`. That tolerates preamble prose, trailing commentary, stray braces, code fences anywhere, and braces inside string values. If a text clearly containing `"action": "write"` still can't be parsed, the fallback message says the proposal was malformed and nothing changed, rather than pasting raw JSON into the chat.
   - **Unescaped inner quotes (added 2026-10-27):** if no block parses, the node retries once after escaping stray double quotes inside string values. See the 2026-10-27 note at the top: a valid payload was dropped because the model quoted a sentence inside `summary` without escaping it. A truncated payload still fails closed.
8. Routing after the parser: `respond` goes to `Send Answer`; `write` goes to the approval buttons; `photos` goes through **Build Photo Album**, which emits exactly one item per requested URL and never pads. **Four Photos?** sends a full four-image option set through the existing static **Send Album** node once. Requests containing one to three URLs go through **Send Requested Photo**, once per URL. Both routes finish at **Send Album Details**, which runs once and posts the HTML-escaped details text. Telegram fetches each Airtable signed URL itself, so no download node is needed.
    - **Why four images still use static slots:** the native `sendMediaGroup` node ignores an array expression on `media.media`, while the bot token is unavailable to a generic HTTP node. Four static slots remain reliable for the normal four-option set. Smaller requests cannot use those slots without duplication, so they use `sendPhoto` instead.

### Button path (you tap Approve or Cancel)

1. The tap arrives as a `callback_query` update into the same trigger.
2. **Handle Button Press** (Code node) checks the presser is an approver (Jonny or Charlie). Then it routes by callback data:
   - `wa` → re-reads the pending write's `method + path + body` from the JSON embedded in the approval message (between `⟦ ⟧` markers) and executes it.
   - `wc` → posts a "Cancelled, nothing changed" notice.
   - `pick:rec…` → a cross-workflow hook used by the **Guy's Take Thumbnail Artwork** workflow: sets that `Thumbnails` row's `Status` to `Selected`. (This is why thumbnail selection can use buttons without adding a second Telegram trigger.)
3. The tap is acknowledged (toast in Telegram), then **Approve** → `Execute Airtable Write` fires the exact call against `https://api.airtable.com/v0/...` and you get a "✅ Done" message with the result (or the Airtable error).

### Write batching

The system prompt instructs the agent to cover the *entire* request in one call where the Airtable API allows it: up to 10 records per create/update body, up to 10 record IDs as `?records[]=` query params for delete. Requests that genuinely can't fit one call (11+ records, multiple tables, mixed operations) are proposed in chunks, with the summary stating what remains; say "continue" after approving to get the next chunk. The agent is **not** re-invoked automatically after an approval.

### Episode packaging replies (added 2026-08-04, LIVE)

The metadata workflow (`BA - Frame.io Uploaded > AI Metadata`) posts a **"Packaging for …"** message per episode offering up to five things at once (four for a `Read`), and this agent turns the reply into one batched PATCH on the Episodes record. It's mostly handled by the generic reply protocol above, but the system message carries an explicit `== EPISODE PACKAGING REPLY ==` section because several items need rules the generic protocol can't infer.

Each numbered item in the notification names its target field after an arrow (`5 · Image prompt → Custom Image Prompt`), so the agent reads its target from the message rather than guessing from the label.

| Item | Field | Rule that isn't obvious |
|---|---|---|
| Title | `Title` | No mention of the title at all means leave it alone, never blank it. Jonny's own wording beats a listed `T1`–`T5`. |
| Thumbnail caption | `Thumbnail Caption` | Same, with `TC1`–`TC5`. |
| Guests | `Guests` (link) | **Link existing rows only.** Read the `Guests` table first, add matches to the episode's *existing* links (so nobody already attached gets dropped), and for a name with no match, **don't create a record and don't invent an ID** — propose the write for whoever matched and say which names couldn't be found. Ambiguous match → ask. |
| Thumbnail moods | `Thumbnail Moods` | Plain **text**, comma-separated, e.g. `confident, shocked`. Only names listed in the message are valid (they're read live from `Thumbnail References`). **Order matters** — the moods cycle across the 4 artwork options in the order written. On a `Read` this field is the **facial expression** (2026-10-28): accept "expression: …" as this item, and an empty field means `Neutral`. If an older Read message predates the expression step and shows no mood list, still accept the name and verify it against `Thumbnail References` rather than dropping it. |
| Image prompt | `Custom Image Prompt` | Written **verbatim and in full**. This is art direction; paraphrasing or tidying it changes the picture. `default` / `none` are written literally and read downstream as "no extra direction". Anything in the reply that isn't clearly a title, caption, guest, mood/expression or Read book cover is almost certainly this. |
| Book cover (Read only) | `Book Cover` (attachment) | Sent to the episode as a photo captioned `book cover BA-xxxx`; never put the cover in `Custom Image Prompt`. A Read's artwork waits for this field. |

**Album instruction merged during the 2026-08-04 push.** The live system message and the repo `.sdk.js` had drifted: live said the album "for thumbnails this is the 4 options", the repo said "(2-10 images)". Each carried a fact the other lacked, so both were folded into one sentence (`in option order (2-10 images; for thumbnails this is the 4 options)`) rather than letting one silently overwrite the other. The repo file was then rewritten from the live text so the two are now byte-identical. Everything else that differed was line-wrapping only, plus one em dash normalised to a hyphen.

**The gate worth knowing about:** for every non-Read episode artwork starts as soon as the packaging write lands; `Custom Image Prompt` is optional and is **not** a view gate (corrected 2026-10-23). A `Read` is different: its only gate is **`Book Cover`**, so if a reply answers everything except the cover, the agent proposes the write as normal and **reminds Jonny the Read's artwork hasn't started**. It never fills in `Custom Image Prompt` or `Book Cover` on his behalf.

### Attaching a thumbnail image (added 2026-10-06, LIVE)

Send the bot a photo and it attaches it to the episode's artwork, with no approval tap and without invoking the agent (so no OpenRouter call). This is the "I made my own thumbnail" path, an alternative to letting the artwork workflow generate options. **A photo captioned `book cover` (or just `cover`) is routed differently: see [Attaching a book cover](#attaching-a-book-cover-2026-10-22).**

**How to address it.** The bot needs the episode and the slot.
- **Episode:** reply to any message about the episode with the photo, or put the `BA-xxxx` ID in the photo's caption. In a group you must reply to one of the bot's messages (or put the ID in a caption that also `@mentions` the bot); in a DM any photo is accepted and the caption supplies the ID.
- **Slot:** chosen from the image's pixel dimensions — `16x9` (landscape), `1x1` (square) or `9x16` (portrait). Put `16x9`, `1x1` or `9x16` in the caption to override the guess.

**Where it lands.** The episode's **chosen thumbnail row**: the `Thumbnails` row with `Status = Final`, or `Selected` if there is no Final; if the episode has no thumbnail row at all, a new `Final` row is created. One image sets one slot; all three (an album or three messages) set all three on the same row; re-sending a slot **replaces** that slot's image (the slot is cleared before upload). The Episode `Status` is deliberately not changed.

**Flow.** `Is Photo?` (added right after the sender gate) → `Extract Photo Info` (resolves episode + slot from caption/reply, and the largest photo's `file_id`) → if the episode or slot is missing, `Ask For Details` and stop → `Find Episode Record` (Airtable lookup by `{ID}`) → `Episode Found?` → `Get Telegram File` (downloads the bytes through the Telegram credential) → `Build Attachment Body` (reads the real bytes with `getBinaryDataBuffer` + a 5 MB guard) → `Find Target Row` (the episode's own thumbnail rows, via its `Thumbnails` link) → `Pick Target Row` (Final, else Selected) → `Has Target Row?` (`Clear Slot` if it exists, else `Create Custom Row`) → `Upload Attachment` (Content API `uploadAttachment`) → `Verify Attachment` (fails loudly if the upload did not land) → `Notify Photo Attached`.

> **Implementation notes (all learned the hard way on the first live test, 2026-10-06):**
> 1. **Target the chosen row.** The first version created a separate `"<BA-xxxx> Custom"` row, so the generated artwork's `16x9`/`1x1` looked unchanged. It now attaches to the episode's existing `Final`/`Selected` row.
> 2. **`performUpsert` is rejected** on the `Thumbnails` table ("parameter validation failed"), and **`ARRAYJOIN` on a linked field returns the linked row's *name*, not its ID**, so the target row is read from the episode's own `Thumbnails` link (record IDs) and fetched with `OR(RECORD_ID()="…", …)`.
> 3. **n8n stores binary in separate mode here** (the workflow's `binaryMode` stays `separate`; setting it to `default` is ignored). Reading `binary.data.data` in a Code node yields the literal string `"filesystem-v2"`, which uploaded as a **9-byte junk file that still returned success**. `Build Attachment Body` now reads the real bytes with `this.helpers.getBinaryDataBuffer(itemIndex, prop)`.
> 4. **`Verify Attachment` is the guard** that turns a bad/empty upload into a hard failure, so a false "🖼️ Attached" can no longer be sent.

### Attaching a book cover (2026-10-22, LIVE, UNTESTED)

For **Read** episodes, the artwork prompt needs the book's front cover as Image 2. Send it to the bot and it lands on the episode's **`Book Cover`** attachment field, ready for the next artwork run.

**How to address it.** The episode comes from the reply or a `BA-xxxx` in the caption, exactly as above. The hint comes from the **photo's caption**: `book cover` / `book-cover` / `bookcover`, or a caption starting with `cover`. So the reliable form is a photo captioned `book cover BA-xxxx`, or a reply to an episode message with `book cover` as the photo's caption.

**Where it lands.** `Episodes.Book Cover` (`fldoE43HUNe8nLwX4`), not a `Thumbnails` row. The field is **cleared before every upload**, so re-sending replaces the cover instead of stacking attachments. It does not change the Episode `Status`.

**Flow.** `Build Attachment Body` → **`Is Book Cover?`** (`slot === 'BOOK_COVER'`) → true: **`Clear Book Cover`** (PATCH the episode field to `[]`) → **`Upload Book Cover`** (Content API `uploadAttachment` on `Book%20Cover`) → **`Verify Book Cover`** (same 1 KB/ filename guard) → **`Notify Book Cover Attached`** (`📕 Attached to <code>BA-xxxx</code> as the book cover`). False: the existing thumbnail path (`Find Target Row` → …) unchanged.

**Gotchas.**
- The hint is read from the **caption only**, deliberately: a replied-to packaging message is long and may mention a cover in passing.
- `slot` becomes the literal `'BOOK_COVER'`, which also satisfies `Ready to Attach?`; nothing downstream treats it as an aspect ratio because the book branch runs first.
- If no `BA-xxxx` can be found, `Ask For Details` says `Slot: Book cover` and asks for the episode ID, rather than complaining about aspect ratio.
- The content API **appends**, which is why the clear step exists. A retry of the upload would double the attachment, so don't add Retry On Fail to `Upload Book Cover`.

**Sending more than one (one image per slot).** Multiple images are supported. Telegram delivers an album as **one update per image** and puts a caption on **only the first** image, so:
- **Recommended:** reply to a message about the episode and send the images (album or separate). Every image inherits the episode from the reply.
- Or send them one at a time, each as its own reply or with `BA-xxxx` in its own caption.
- **"Send as Documents" is not needed and is worse:** documents are full-size and usually exceed the 5 MB cap. Use normal (compressed) photos.
- You get one "🖼️ Attached" confirmation per image.
- If the episode has **no thumbnail row yet**, send the first image on its own so it creates the row before the others. An album fired at an episode with no row can create more than one row (each image sees no target and creates its own).

**Notes / limits.**
- Airtable's attachment endpoint caps a file at ~5 MB (base64 inflation included). Send a normal (compressed) photo; a multi-MB original as a file will be refused with a clear message.
- The image is stored exactly as sent; the bot does not resize or crop, so supply the right aspect ratio. Dimensions come from Telegram's photo sizes (`message.photo[-1].width/height`).
- No new credentials: it reuses the Telegram bot credential (file download) and the Airtable PAT as a Bearer token (upload).
- Telegram delivers each album image as its own update, so an album is processed image by image; they converge on the same chosen row.

### Logging automation issues (added 2026-08-11)

Jonny and Charlie report broken or improvable automations by messaging the bot, and each report becomes a row in **Automation Upgrades** — base `appwcz1Bux9YLcZYm` (the n8n-pod21 base, *not* Bitcoin Audible), table `tblja27Lsn7qXJfZM`. Two ways in, both handled by the same `== LOGGING AUTOMATION ISSUES ==` section of the system message:

- **Direct:** "the thumbnail workflow never sent artwork for BA-eObmD9"
- **As a reply** to any workflow notification: "log this as an issue"

**No new nodes were added for this.** It reuses the existing propose-write path, so the report arrives as a normal ✅ Approve / ❌ Cancel message and you see the exact row before it's created. That tap is deliberate: it's the moment to catch a report the agent has misread, and it costs nothing structurally.

**Gather-before-propose.** The agent is instructed to research first, even for a bare "this is broken": keep the quoted message in full, read any named record and note its live field values, and read the System Map so it can state which stage should have run and which required fields are empty. It's told to stick to what it actually checked and never invent an error message or a cause. The point is that a row written today is still actionable in three weeks.

| Field | Type | Filled by |
|---|---|---|
| `Title` | Single line text (primary) | agent |
| `Type` | Single select — `Bug`, `Improvement`, `Idea` | agent |
| `Status` | Single select — `New`, `In Progress`, `Fixed`, `Won't Do` | agent writes `New`; you move it |
| `Priority` | Single select — `Low`, `Medium`, `High` | agent (`High` only if told it's blocking) |
| `Reported By` | Single select — `Jonny`, `Charlie` | agent, from the `[Message from …]` tag |
| `Reported At` | Created time | Airtable, automatically |
| `Workflow` | Single line text | agent, named from the System Map |
| `Related Record` | Single line text | agent — the `BA-xxxx` code or `rec…` ID |
| `Description` | Long text | agent — verbatim, never paraphrased |
| `Context` | Long text | agent — quoted message, live record state, missing preconditions, expected vs actual |
| `Fix Notes` | Long text | you, when fixing |

**Why `Workflow` is text and not a single select.** Airtable rejects a write containing an unknown single-select option (the write path sends no `typecast`), so one invented workflow name would fail the whole call and the report would be silently lost. The four select fields above are safe because their values are short, stable lists spelled out verbatim in the system message; workflow names change as automations are added. Losing an issue report is worse than an untidy text column.

**Not implemented (deliberately):** no duplicate detection. Report the same problem twice and you get two rows. Adding "find an open row about the same thing and append to it" would mean the agent editing existing rows, which is a bigger blast radius than a duplicate.

---

## Safety model

- The agent's only tools are GET requests; the single node that can mutate Airtable sits behind the button gate
- The JSON contract parser fails closed (to a text reply, never a write)
- Write proposals show the plain-English summary **and** the raw API call (in the `⟦ ⟧` block), so what you approve is exactly what runs
- Only Jonny's and Charlie's user IDs can trigger the agent or approve writes; button presses from anyone else are ignored and reported to Jonny's DM

---

## Known limitations

- **No post-write memory:** after an approved write executes, the result isn't fed back into the agent's conversation memory. It remembers proposing the write, not the outcome, so "did that work?" may get a shrug. Ask it to re-read the records instead. (Replying to the bot's confirmation message is the reliable way to give it that context back.)
- **Approve has no expiry and isn't single-use:** the API call lives in the approval message, so the buttons keep working as long as the message exists, and re-tapping Approve would re-run the write. Cancel only posts a notice; it does not disable the buttons.
- ~~**The guard also gates DMs**~~ — **fixed 2026-08-11.** `Addressed to bot?` now passes any message in a private chat, so a plain DM no longer needs a mention or a reply. Group chats are unchanged. Side effect worth knowing: the agent now runs on *every* DM from Jonny or Charlie, so idle chatter in that chat costs an OpenRouter call.
- **One Telegram trigger per bot, instance-wide:** activating any other workflow with a Telegram trigger on `@pod21_n8n_agent_bot` steals the webhook and this assistant silently stops triggering. If that bites, deactivate the other workflow and re-publish this one. (Other workflows can still *send* via the bot; only triggers conflict.)
- ~~**Non-text messages** reach the agent as an empty prompt~~ — **photos fixed 2026-10-06** via the dedicated branch below. Voice notes, video and stickers still reach the agent as an empty prompt; to fetch one of those as an image, ask it to `photos`.
- **filterByFormula** queries are URL-encoded by the model; complex formulas occasionally need a second attempt.

---

## Tuning

The agent's behaviour lives almost entirely in the **system message** on the `Airtable Agent` node: tone, the JSON contract, batching rules, when to ask vs. guess, and known-context hints about the Guy's Take base. Edit that field, save, publish; no structural changes needed for behaviour tweaks.

The user-message prompt (mention-stripping + reply-context injection) is built in the **`Prep Agent Input`** Code node. When editing Code nodes on this instance, use template literals for multi-line strings and loop `$input.all()` rather than `$input.first()`.

The model is set on the `OpenRouter Sonnet 4.6` node; anything tool-capable on OpenRouter can be swapped in, but weaker models fumble the JSON contract and multi-step lookups more often.

---

## Related

- **BA: Guy's Take Weekly Research & Shortlisting** (`BA - Guy's Take Weekly Research & Shortlisting.md` in this folder): the Friday YouTube research digest writing to the same Guy's Take base
- **BA: Guy's Take Thumbnail Artwork** (`BA - Guy's Take Thumbnail Artwork.md`): uses this workflow's `pick:rec…` callback hook for thumbnail selection
- **Airtable: Episode status changed → Telegram** (`GbFwXLACjj1O6spS`): Phase 0 pipe notifying on Episode record changes
- **Planning doc:** `/Users/jonny/code/n8n-control-room/workflow_planning/Guys Take Workflow.md`
