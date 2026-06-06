# Pod21: Telegram Airtable Assistant

> **Find this workflow in n8n by name.** Workflow IDs change whenever the workflow is rebuilt from code (credential bindings don't survive API updates, so structural changes are done as create-new + archive-old). The name is the stable identifier.

---

## TL;DR

A general-purpose AI agent living in Jonny's Telegram DM with `@pod21_n8n_agent_bot`. It can:

1. **Read anything** in any Airtable base the PAT can see, and answer questions directly ("what episodes are in the pipeline?")
2. **Propose writes** (create / update / delete) but never execute them itself; every write becomes an approval message with native one-tap ✅ Approve / ❌ Cancel buttons
3. **Ask clarifying questions** when a request is ambiguous instead of guessing

Reads need no approval. Writes always do. The agent has no write tools at all, so even a confused model cannot mutate Airtable without a button tap.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Telegram update (`message` + `callback_query`) on `@pod21_n8n_agent_bot` |
| **Authorized user** | Jonny only (user/chat ID `1512868522`), enforced by IF gates in the workflow |
| **LLM** | Claude Sonnet 4.6 via OpenRouter (`anthropic/claude-sonnet-4.6`, temp 0.2) |
| **Scope** | Every Airtable base the PAT has access to (dynamic discovery, nothing hardcoded) |
| **Memory** | Rolling 20-turn conversation buffer, keyed per chat |
| **Approval expiry** | Pending writes expire after 24h; each button works exactly once |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | Trigger + all 5 Telegram send/answer nodes |
| `OpenRouter [n8n]` | `openRouterApi` | Chat model |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | 3 read tools + `Execute Airtable Write` (all HTTP Request nodes) |

The **Airtable PAT** should have `schema.bases:read`, `data.records:read`, and `data.records:write` on **every base** you want the assistant to touch; a base the PAT can't see simply doesn't exist to the agent.

⚠️ **Rebuild gotcha:** if this workflow is ever recreated via the n8n API, credential auto-assignment covers the Telegram and OpenRouter nodes but always skips the 4 HTTP Request nodes; those must be re-bound by hand in the UI.

---

## How it works

### Message path (you text the bot)

1. **Telegram trigger** fires on your message; an IF gate drops anything not from chat `1512868522`.
2. **AI Agent** (Sonnet 4.6) runs with three read-only tools:
   - `list_airtable_bases` — GET `/v0/meta/bases`
   - `get_base_schema` — GET `/v0/meta/bases/{baseId}/tables`
   - `airtable_read` — generic GET with any path/query (records, filters, single record)
3. The agent must reply with a strict JSON envelope, one of:
   - `{ "action": "respond", "message": "..." }` — answers, read results, clarifying questions
   - `{ "action": "write", "summary": "...", "method": "...", "path": "...", "body": {...} }` — a write proposal
4. **Parse Agent Decision** (Code node) enforces the contract: malformed output, bad methods, or empty paths all degrade to a plain text reply, **never** to a write.
5. `respond` → message sent to you, done. `write` → the proposal is stashed in workflow static data under a one-time short ID, and you get the approval message with inline buttons carrying `wa:<id>` / `wc:<id>` callback data.

### Button path (you tap Approve or Cancel)

1. The tap arrives as a `callback_query` update into the same trigger.
2. **Handle Button Press** (Code node) checks the presser is Jonny, looks up the pending write by ID, and deletes the stash entry (this is what makes buttons single-use).
3. The tap is acknowledged (toast in Telegram), then:
   - **Approve** → `Execute Airtable Write` fires the exact `method + path + body` from the proposal against `https://api.airtable.com/v0/...`, and you get a "✅ Executed" message with the API response
   - **Cancel / expired / already used** → you get a notice and nothing changes

### Write batching

The system prompt instructs the agent to cover the *entire* request in one call where the Airtable API allows it: up to 10 records per create/update body, up to 10 record IDs as `?records[]=` query params for delete. Requests that genuinely can't fit one call (11+ records, multiple tables, mixed operations) are proposed in chunks, with the summary stating what remains; say "continue" after approving to get the next chunk. The agent is **not** re-invoked automatically after an approval.

---

## Safety model

- The agent's only tools are GET requests; the single node that can mutate Airtable sits behind the button gate
- The JSON contract parser fails closed (to a text reply, never a write)
- Write proposals show the plain-English summary **and** the raw API call, so what you approve is exactly what runs
- Only Jonny's user ID can trigger the agent or approve writes; button presses from anyone else are ignored and reported
- Proposals are single-use and expire after 24h

---

## Known limitations

- **No post-write memory:** after an approved write executes, the result isn't fed back into the agent's conversation memory. It remembers proposing the write, not the outcome, so "did that work?" may get a shrug. Ask it to re-read the records instead.
- **Pending approvals don't survive a rebuild:** the stash lives in workflow static data, which is per-workflow. Any unapproved proposal dies if the workflow is recreated.
- **One Telegram trigger per bot, instance-wide:** activating any other workflow with a Telegram trigger on `@pod21_n8n_agent_bot` (e.g. the shelved Pod21 social workflows) steals the webhook and this assistant silently stops triggering. If that bites, deactivate the other workflow and re-publish this one.
- **Non-text messages** (photos, voice notes) reach the agent as an empty prompt; expect a confused reply.
- **filterByFormula** queries are URL-encoded by the model; complex formulas occasionally need a second attempt.

---

## Tuning

The agent's behaviour lives almost entirely in the **system message** on the `Airtable Agent` node: tone, the JSON contract, batching rules, when to ask vs. guess, and known-context hints about the Guy's Take base. Edit that field, save, publish; no structural changes needed for behaviour tweaks.

The model is set on the `OpenRouter Sonnet 4.6` node; anything tool-capable on OpenRouter can be swapped in, but weaker models fumble the JSON contract and multi-step lookups more often.

---

## Related

- **BA: Guy's Take Weekly Research & Shortlisting** (`BA - Guy's Take Weekly Research & Shortlisting.md` in this folder): the Friday YouTube research digest writing to the same Guy's Take base
- **Airtable: Episode status changed → Telegram** (`GbFwXLACjj1O6spS`): Phase 0 pipe notifying on Episode record changes
- **Planning doc:** `/Users/jonny/code/n8n-control-room/workflow_planning/Guys Take Workflow.md`
