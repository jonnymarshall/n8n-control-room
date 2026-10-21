# n8n workflow conventions (shared rules)

Cross-workflow rules that every n8n automation in this repo must follow. These
are durable expectations, not per-workflow details. Each rule below is also
enforced or reinforced somewhere (a PostToolUse hook in Claude Code, and the
`AGENTS.md` instructions any agent reads) so it survives context resets. Under
opencode the hooks don't fire, so the same checks are done by hand per
`AGENTS.md` → "Guardrails under opencode".

---

## RULE: Every Telegram message must include the episode / record ID

**Any Telegram message a workflow sends about an episode or record MUST surface
that record's unique ID** in the message body, wrapped in a `<code>…</code>`
block so it is tap-to-copy.

- For Guy's Take that ID is the **`episodeId`** (`BA-xxxx`, parsed from the
  Frame.io filename), or the Airtable **`ID`** field on the Episodes table.
- Include a fallback so a missing value never prints `null`, e.g.
  `{{ ($('Extract Episode Info').first().json.episodeId) || 'no-id' }}`.
- This applies to **every** message type: the main "ready" notification, skip /
  error / "ignored" notices, "script ready", thumbnail prompts — all of them.

**Why.** Jonny replies to these Telegram messages, and the **Telegram Airtable
Assistant** reads those replies. Without the ID printed in the original message,
there is no unique anchor telling the Assistant (or Jonny) *which* episode a
reply like "change the title" or "delete this" refers to. The ID in the message
is the shared context that makes a reply unambiguous.

**Good (compliant):**

```
📺 Episode metadata ready
The Final Cut · <code>{{ $('Build Outputs').first().json.episodeId }}</code>
…
```

**Bad (no record ID — a reply to this can't be tied to an episode):**

```
⏭️ Ignored non-video upload
<code>{{ $('Extract Episode Info').first().json.fileName }}</code> (image/png)
```

**Enforcement.**

- PostToolUse hook `.claude/hooks/telegram-include-id-check.py` scans every
  `create_workflow_from_code` / `update_workflow` call, finds Telegram **send**
  nodes, and warns when a `text` / `caption` has no record-ID reference. Soft
  reminder, never blocks (Claude Code only; under opencode it's a manual check
  per `AGENTS.md`).
- The same rule is in `AGENTS.md` so any agent carries it into every session.
- When pasting an `=`-prefixed expression into a UI field, note the
  double-`=` gotcha.

---

## RULE: Test and dry-run messages go to Jonny's DM, never the team group

**The pod21 group (`-5254203539`) is for real events only.** When you need to prove a
notification path works (a new alert, a status guard, a replayed payload), point the
throwaway copy's Telegram `chatId` at Jonny's DM (`1512868522`). A synthetic alert in the
group reads exactly like a real one and sends the team hunting for an episode that has no
problem.

- **Test on a scratch copy, never on live.** Build a temporary workflow, change its `chatId`
  values and its webhook path, run the payloads, then delete it. Never test by editing the
  live workflow's chat id and reverting it afterwards.
- **Label anything that could be mistaken for real.** Put `[TEST]` in the payload's subject
  or message text. The scheduling alerts do not print the email subject, so a body reading
  `BA-ZZZZZZ` looks like a genuine miss.
- **Borrowed IDs are still real episodes.** When a test needs an episode in a particular
  status (e.g. `Published`, to exercise a guard), the alert names that real episode. Fine in
  a DM, alarming in the group.
- **Live notifications keep their group id.** The DM is for tests plus the notices whose
  readmes already document DM-only delivery (artwork polls, script-ready, weekly research,
  backup failures). Everything else about an episode goes to the group.

**Why.** On 2026-10-21 the scheduling guard tests went to Jonny's DM as intended, but the
alerts carried no marker, so three synthetic messages (a nonexistent `BA-ZZZZZZ`, a borrowed
`Published` episode, and a cancellation for an episode that was not `Scheduled`) were
indistinguishable from real failures. The rule makes the destination predictable and the
label makes the message self-identifying.

---

## RULE: Live n8n state is the source of truth; SDK files are a local copy

The **live workflow on the n8n server is always the source of truth.** Jonny edits
workflows directly in the n8n UI and changes Airtable by hand, so the repo's
`scripts/deploy/workflows/*.sdk.js` files are a **local, reviewable copy** of what
was last pushed, not the authority. When the two disagree, **live wins.**

**Mandatory diff-before-touch protocol.** Before changing any `.sdk.js` file:

1. Pull the live workflow (`get_workflow_details` via the n8n MCP, or the REST
   API).
2. Diff its nodes/parameters against the `.sdk.js` (a structural diff, see below).
3. If they differ, **stop.** Surface the exact differences to Jonny and ask which
   is correct. It will almost always be the live server. Reconcile the `.sdk.js`
   to match live first, commit that, and only then build the new change on top.

Never push an `.sdk.js` that is known-stale over a live workflow that has drifted;
that silently destroys Jonny's manual edits. (This is exactly what the
`n8n-sync-guard` hook protects against in Claude Code, and what you must do by
hand under any other tool.)

- **Migrate opportunistically, not big-bang.** Convert a workflow to SDK the
  next time it is *substantively* changed (adding a trigger, a branch, etc.).
  Do **not** reconstruct a working, hand-built workflow into SDK purely to have
  it in code, that is regression risk for no functional gain. Trivial one-field
  tweaks can still be done on the canvas (then reconciled into the `.sdk.js`).
- **Rebuild as a NEW workflow, verify, then cut over.** Never overwrite the live
  workflow in place during a rebuild. Push the SDK build as a new workflow,
  verify it, then deactivate + archive the old one and activate the new.
- **Reconstruct parameters verbatim.** When rebuilding an existing workflow from
  its live JSON, emit each node's `parameters` byte-for-byte
  (`parameters: <JSON.stringify(liveParams)>`). The SDK accepts `=`-prefixed
  expression strings verbatim, so **no `expr()` conversion is needed**.
- **Prove fidelity by structural diff before cutover.** Pull the new workflow
  (`get_workflow_details`), `jq` its nodes + connections, and diff `parameters`
  (especially Code `jsCode`) and edges against the live JSON. Zero diffs on the
  pre-existing nodes/edges = a faithful rebuild. Use the same structural-diff
  technique for the diff-before-touch check above.
- **Budget for the credential rebind tax, but verify rather than assume.** Historical SDK
  pushes skipped credential auto-assignment on HTTP Request nodes, which forced a manual
  rebind in the UI after every push. That has not been the case for some time (MCP pushes
  bind credentials passed inline, and a partial update leaves existing bindings alone), so
  the rebind is no longer routine. Always confirm afterwards that each HTTP node still holds
  its credential (REST `GET /workflows/<id>` shows `credentials`; the MCP read strips them).

First workflow on this model: **Guy's Take Thumbnail Artwork**
(`scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js`).

---

## RULE: Every workflow has an `.sdk.js` snapshot

**Every non-archived workflow on the server must have a snapshot file in
`scripts/deploy/workflows/`.** This is not optional and it is not only for workflows
built from SDK code: a workflow that exists only in n8n has no reviewable record in
git, so nobody can diff what changed or spot drift.

- **When a workflow is created**, the snapshot is part of finishing it, alongside the
  readme and the System Map.
- **When a workflow changes materially**, refresh the snapshot so git shows the change.
- **Generate it, don't hand-write it:**
  `./scripts/deploy/workflows/snapshot-sdk.sh <workflow_id> [slug]` writes the file from
  the live workflow with parameters and settings verbatim.
- **Check the whole instance:** `./scripts/query/sdk-coverage.sh` lists any workflow with
  no snapshot and exits non-zero if any are missing. Run it after creating workflows.
- Snapshots are identified by the `workflow('<id>', '<name>')` call inside the file, not
  by filename. Two older files (thumbnail artwork, Telegram assistant) carry a slug there
  instead of the id; the coverage script accepts either the id or the exact workflow name.

---

## Related conventions enforced elsewhere

- **Airtable Trigger Fields** — when restricting the Fields list, include the
  trigger field itself and use commas with **no spaces**. Hook:
  `.claude/hooks/airtable-trigger-fields-check.py` (Claude Code); manual check
  under opencode per `AGENTS.md`.
- **Workflow naming** — name a workflow after its trigger, not its actions.
- **One Telegram trigger per bot** — only one active workflow can hold the
  Telegram Trigger for a given bot; other workflows may *send* but not *trigger*.
