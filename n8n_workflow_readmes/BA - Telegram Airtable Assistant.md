# BA: Telegram Airtable Assistant

> **Renamed 2026-08-04** from `BA - Telegram Airtable Assistant.md` to match the workflow's actual display name in n8n (`BA: Telegram Airtable Assistant`). The file previously carried the old `Pod21:` name it was built under.

> **Find this workflow in n8n by name.** Workflow IDs change whenever the workflow is rebuilt from code (credential bindings don't survive API updates, so structural changes are done as create-new + archive-old). The name is the stable identifier.

> ✅ **"photos" reply path — LIVE & VERIFIED (2026-06-23).** The `photos` action (sends the actual thumbnail images as one album + a details message, instead of links) was built via the n8n SDK as a duplicate workflow, **`Hx8Ul6M41fM8HuxU`**, to keep the original `peTIs4kiluFZHoLg` untouched during the build. It's now confirmed working and, because it's been activated to receive live Telegram messages, **it holds the bot's webhook — so `Hx8Ul6M41fM8HuxU` is the de-facto live workflow now** (one Telegram trigger per bot). Its display name reverted to `BA: Telegram Airtable Assistant` on the last API update, so it currently shares a name with the dormant original — tell them apart by ID.
>
> **Remaining cleanup (optional, not yet done):** archive the old `peTIs4kiluFZHoLg` so the duplicate name is gone and it can't reclaim the webhook if someone reactivates it. SDK source of truth: `scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`. Note on this instance: SDK `update_workflow` skips credentials on the 4 Airtable HTTP nodes (rebind by hand) and only saves a draft — you must call `publish_workflow` (or toggle Active) for changes to actually run.

---

## TL;DR

A general-purpose AI agent reachable on Telegram via `@pod21_n8n_agent_bot`, in **Jonny's DM and in the `pod21` group** (Jonny + Charlie). It can:

1. **Read anything** in any Airtable base the PAT can see, and answer questions directly ("what episodes are in the pipeline?")
2. **Propose writes** (create / update / delete) but never execute them itself; every write becomes an approval message with native one-tap ✅ Approve / ❌ Cancel buttons
3. **Ask clarifying questions** when a request is ambiguous instead of guessing
4. **Send real images** (`photos` action — thumbnails, artwork, any image attachment) straight into the chat as Telegram photos instead of pasting attachment links *(live and verified 2026-06-23; this workflow holds the bot's webhook, so the cutover is done)*
5. **Explain the pipeline** — it has a "brain" (the **System Map**, see below) so it understands how the workflows fit together and can answer "what does this episode need before its artwork is made?" or "why hasn't X happened yet?" by reading the episode and comparing it to each stage's preconditions.
6. **Log automation issues** — say something's broken (or reply to a workflow's message with "log this as an issue") and it researches the problem, then proposes a row in the **Automation Upgrades** table for a later fix. See below.

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
   - `{ "action": "photos", "urls": [...], "caption": "details text" }` — send the real images (thumbnails, artwork, any image attachment) as **one Telegram album** followed by a **separate text message**, instead of pasting links. The agent defaults to this whenever asked to see/send/show image attachments. `caption` is the follow-up message: it leads with the episode code `BA-xxxx` (the reply anchor) and lists each option and its current status, e.g. "BA-eObmD9 — Options: #1 (Rejected), #2 (Selected), #3, #4". 2–10 images.
7. **Parse Agent Decision** (Code node) enforces the contract: malformed output, bad methods, or empty paths all degrade to a plain text reply, **never** to a write. A `photos` envelope with no valid `http(s)` URL also degrades to a text reply.
   - **Link fields (added 2026-08-13):** the agent sometimes proposes a link field as `"Guests": [{"id": "recAAA"}]`. Airtable only accepts an array of plain record ID strings and rejects the object form with `INVALID_RECORD_ID — Value "[object Object]" is not a valid record ID`, which fails the **whole** batched PATCH, so a five-field packaging update lands nothing. Both this node and **Handle Button Press** now unwrap a bare `{id}` / `{id, name}` ref into its ID string. Unwrapping happens here so the approval message shows the payload that will actually be sent, and again in the button handler so approval messages composed before the fix still execute on a re-tap. It only rewrites values **inside `fields`**, and only when `id` matches the `rec…` pattern, so attachment objects (`{url, filename}`) and the `{id, fields}` record wrapper are untouched. A matching rule stating the correct shape was added to the system prompt in the SDK source, but is **not yet live** (pushing it means sending the whole system message; it can go up with the next prompt change or be pasted into the node in the UI). Until then the code guard is what's actually doing the work.
   - **Extracting the JSON (rewritten 2026-08-13):** the agent regularly ignores "no text outside the JSON" — roughly 20 of 26 recent runs wrapped the envelope in prose ("Good. I have everything I need. Let me map the selections: …"), and from 2026-08-13 it also started appending a **stray extra `}`** after the closing brace. The original parser sliced from the first `{` to the *last* `}`, which swallowed that stray brace, failed `JSON.parse`, and silently degraded a perfectly good write proposal into a plain reply — so **no Approve/Cancel buttons appeared** and the write was dropped (executions 1771, 1773, 1781). It now walks the text tracking brace depth and string/escape state, collects every *balanced* `{…}` block, and takes the last one carrying a recognised `action`. That tolerates preamble prose, trailing commentary, stray braces, code fences anywhere, and braces inside string values. If a text clearly containing `"action": "write"` still can't be parsed, the fallback message says the proposal was malformed and nothing changed, rather than pasting raw JSON into the chat.
8. Routing after the parser: `respond` → message sent back to the chat, done. `write` → `Is Write Request?` true → the proposal's raw API call is serialized into the approval message with inline ✅ Approve (`wa`) / ❌ Cancel (`wc`) buttons. `photos` → `Is Write Request?` false → `Is Photo Reply?` true → **Build Photo Album** (Code node → one item with the chat ID, the HTML-escaped caption, and a `urls` array padded to exactly 4) → **Send Album** (native Telegram `sendMediaGroup` with **4 static media slots**, each slot's `media` = `{{ $('Build Photo Album').item.json.urls[i] }}`, so all images arrive as one album) → **Send Album Details** (`sendMessage`, `executeOnce` so it fires once even though the album returns N message items; text = the caption). Telegram fetches each Airtable signed URL itself, so no in-workflow download is needed.
   - **Why static slots (not an array expression, not HTTP):** the native `sendMediaGroup` node ignores an array-expression on `media.media` (Telegram returns `can't parse InputMedia: media not found`), so the slots must be static. The HTTP alternative (`/bot<token>/sendMediaGroup` with the token via `{{ $credentials.accessToken }}`) does **not** work either — `$credentials` isn't exposed on a Predefined-Credential-Type HTTP node, so the token resolves empty and Telegram returns 404. The native node with static slots is the reliable path, and it auto-binds the `telegramApi` credential. **Constraint:** 4 static slots = it sends exactly 4 images (the thumbnail case); `Build Photo Album` pads short sets to 4 by repeating the last URL so it never crashes (Telegram albums are 2–10 items). To support a different fixed count, change the slot count + the pad target together.

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

The metadata workflow (`BA - Frame.io Uploaded > AI Metadata`) posts a **"Packaging for …"** message per episode offering five things at once, and this agent turns the reply into one batched PATCH on the Episodes record. It's mostly handled by the generic reply protocol above, but the system message carries an explicit `== EPISODE PACKAGING REPLY ==` section because three of the five need rules the generic protocol can't infer.

Each numbered item in the notification names its target field after an arrow (`5 · Image prompt → Custom Image Prompt`), so the agent reads its target from the message rather than guessing from the label.

| Item | Field | Rule that isn't obvious |
|---|---|---|
| Title | `Title` | No mention of the title at all means leave it alone, never blank it. Jonny's own wording beats a listed `T1`–`T5`. |
| Thumbnail caption | `Thumbnail Caption` | Same, with `TC1`–`TC5`. |
| Guests | `Guests` (link) | **Link existing rows only.** Read the `Guests` table first, add matches to the episode's *existing* links (so nobody already attached gets dropped), and for a name with no match, **don't create a record and don't invent an ID** — propose the write for whoever matched and say which names couldn't be found. Ambiguous match → ask. |
| Thumbnail moods | `Thumbnail Moods` | Plain **text**, comma-separated, e.g. `confident, shocked`. Only names listed in the message are valid (they're read live from `Thumbnail References`). **Order matters** — the moods cycle across the 4 artwork options in the order written. |
| Image prompt | `Custom Image Prompt` | Written **verbatim and in full**. This is art direction; paraphrasing or tidying it changes the picture. `default` / `none` are written literally and read downstream as "no extra direction". Anything in the reply that isn't clearly a title, caption, guest or mood is almost certainly this. |

**Album instruction merged during the 2026-08-04 push.** The live system message and the repo `.sdk.js` had drifted: live said the album "for thumbnails this is the 4 options", the repo said "(2-10 images)". Each carried a fact the other lacked, so both were folded into one sentence (`in option order (2-10 images; for thumbnails this is the 4 options)`) rather than letting one silently overwrite the other. The repo file was then rewritten from the live text so the two are now byte-identical. Everything else that differed was line-wrapping only, plus one em dash normalised to a hyphen.

**The gate worth knowing about:** the thumbnail workflow will not generate artwork until `Custom Image Prompt` is non-empty. So if a reply answers everything except that, the agent proposes the write as normal and **reminds Jonny in the summary that artwork hasn't started**. It never fills the field in on his behalf — a guessed prompt would produce artwork nobody asked for.

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
- **Non-text messages** (photos, voice notes) reach the agent as an empty prompt; expect a confused reply.
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
