# Pod21: Telegram Airtable Assistant

> **Find this workflow in n8n by name.** Workflow IDs change whenever the workflow is rebuilt from code (credential bindings don't survive API updates, so structural changes are done as create-new + archive-old). The name is the stable identifier.

---

## TL;DR

A general-purpose AI agent reachable on Telegram via `@pod21_n8n_agent_bot`, in **Jonny's DM and in the `pod21` group** (Jonny + Charlie). It can:

1. **Read anything** in any Airtable base the PAT can see, and answer questions directly ("what episodes are in the pipeline?")
2. **Propose writes** (create / update / delete) but never execute them itself; every write becomes an approval message with native one-tap ✅ Approve / ❌ Cancel buttons
3. **Ask clarifying questions** when a request is ambiguous instead of guessing

Reads need no approval. Writes always do. The agent has no write tools at all, so even a confused model cannot mutate Airtable without a button tap.

**Addressing it in a group:** the bot only acts on a group message that **@mentions it** (`@pod21_n8n_agent_bot ...`) or is a **reply to one of its own messages**. Everything else in the group is ignored. Replying to its messages is the natural way to follow up ("delete this episode" as a reply to its "✅ Done. Created ..." message).

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Telegram update (`message` + `callback_query`) on `@pod21_n8n_agent_bot` |
| **Chats** | Jonny's DM + the `pod21` group (`-5254203539`); one trigger serves both |
| **Authorized users** | Jonny (`1512868522`) and Charlie (`8923732358`), enforced by the `From Jonny or Charlie?` IF gate; both are also write approvers |
| **Group addressing** | Only `@mention` of the bot or a reply to the bot is processed (`Addressed to bot?` gate) |
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
2. **`Addressed to bot?`** gate: a message passes only if it `@mentions` `@pod21_n8n_agent_bot` (checked against the message `entities`) or is a reply to one of the bot's own messages. Anything else is dropped.
3. **`From Jonny or Charlie?`** gate: passes only messages whose `from.id` is Jonny (`1512868522`) or Charlie (`8923732358`). Other senders are ignored.
4. **`Prep Agent Input`** (Code node) builds the prompt sent to the agent:
   - strips the `@pod21_n8n_agent_bot` mention from the text, and
   - **if the message is a reply**, wraps the bot's earlier message plus the new instruction into one prompt so words like "this" / "it" resolve to the record the earlier message described. This is what lets "delete this episode" work as a reply, even though the button-approved create never entered the agent's memory.
5. **AI Agent** (Sonnet 4.6) runs with three read-only tools:
   - `list_airtable_bases` — GET `/v0/meta/bases`
   - `get_base_schema` — GET `/v0/meta/bases/{baseId}/tables`
   - `airtable_read` — generic GET with any path/query (records, filters, single record)
6. The agent must reply with a strict JSON envelope, one of:
   - `{ "action": "respond", "message": "..." }` — answers, read results, clarifying questions
   - `{ "action": "write", "summary": "...", "method": "...", "path": "...", "body": {...} }` — a write proposal
7. **Parse Agent Decision** (Code node) enforces the contract: malformed output, bad methods, or empty paths all degrade to a plain text reply, **never** to a write.
8. `respond` → message sent back to the chat, done. `write` → the proposal's raw API call is serialized into the approval message and you get inline ✅ Approve (`wa`) / ❌ Cancel (`wc`) buttons.

### Button path (you tap Approve or Cancel)

1. The tap arrives as a `callback_query` update into the same trigger.
2. **Handle Button Press** (Code node) checks the presser is an approver (Jonny or Charlie). Then it routes by callback data:
   - `wa` → re-reads the pending write's `method + path + body` from the JSON embedded in the approval message (between `⟦ ⟧` markers) and executes it.
   - `wc` → posts a "Cancelled, nothing changed" notice.
   - `pick:rec…` → a cross-workflow hook used by the **Guy's Take Thumbnail Artwork** workflow: sets that `Thumbnails` row's `Status` to `Selected`. (This is why thumbnail selection can use buttons without adding a second Telegram trigger.)
3. The tap is acknowledged (toast in Telegram), then **Approve** → `Execute Airtable Write` fires the exact call against `https://api.airtable.com/v0/...` and you get a "✅ Done" message with the result (or the Airtable error).

### Write batching

The system prompt instructs the agent to cover the *entire* request in one call where the Airtable API allows it: up to 10 records per create/update body, up to 10 record IDs as `?records[]=` query params for delete. Requests that genuinely can't fit one call (11+ records, multiple tables, mixed operations) are proposed in chunks, with the summary stating what remains; say "continue" after approving to get the next chunk. The agent is **not** re-invoked automatically after an approval.

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
- **The guard also gates DMs:** `Addressed to bot?` currently requires a mention or a reply-to-bot in *every* chat, including Jonny's DM. A plain DM with no mention and no reply is dropped. If unconditional DM use is wanted, add a `chat.type === 'private'` passthrough to that gate.
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
