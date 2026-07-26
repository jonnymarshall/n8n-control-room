# n8n workflow conventions (shared rules)

Cross-workflow rules that every n8n automation in this repo must follow. These
are durable expectations, not per-workflow details. Each rule below is also
enforced or reinforced somewhere (a PostToolUse hook and/or a Claude memory) so
it survives context resets.

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
  reminder, never blocks.
- Claude memory `telegram-include-record-id` carries the same rule into every
  session.
- When pasting an `=`-prefixed expression into a UI field, note the
  double-`=` gotcha (`feedback_n8n_expression_equals_prefix`).

---

## RULE: SDK code in the repo is the source of truth for workflows

We are moving n8n workflows to **SDK code committed in this repo**
(`scripts/deploy/workflows/*.sdk.js`) as the authoritative definition, instead
of editing only the live workflow on the server. Code is diffable, reviewable,
and reproducible; opaque server state is not.

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
  pre-existing nodes/edges = a faithful rebuild.
- **Budget for the credential rebind tax.** `newCredential('Name')` binds on
  **triggers and Telegram** nodes but is **skipped on every HTTP Request node**
  on this instance, and the SDK has no bind-by-ID option. So every SDK push
  requires manually re-binding all HTTP-node credentials in the UI afterwards.
  This is the one real cost of the SDK workflow; expect it per push. See
  memory `feedback_sdk_source_of_truth`.

First workflow on this model: **Guy's Take Thumbnail Artwork**
(`scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js`).

---

## Related conventions enforced elsewhere

- **Airtable Trigger Fields** — when restricting the Fields list, include the
  trigger field itself and use commas with **no spaces**. Hook:
  `.claude/hooks/airtable-trigger-fields-check.py`. Memory:
  `airtable-trigger-fields`.
- **Workflow naming** — name a workflow after its trigger, not its actions
  (memory `workflow-naming`).
- **One Telegram trigger per bot** — only one active workflow can hold the
  Telegram Trigger for a given bot; other workflows may *send* but not *trigger*
  (memory `telegram-one-webhook-per-bot`).
