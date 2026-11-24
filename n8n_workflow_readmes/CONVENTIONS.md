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

**The code is a formula, so it can only be read, never derived.** On the Episodes
table `ID` is `"BA-" & RIGHT(RECORD_ID(), 6)`, so the code is the last six
characters of the internal record id. Anything that needs to print or quote a code
must read that field (or the whole record); a read restricted to a field list that
leaves `ID` out returns no code, and building one from `rec...` produces a code
that does not exist. On 2026-11-04 the Assistant said `BA-dOmo4E` for `BA-8yPGl0`
for exactly this reason, which is why its system prompt now forbids guessing.

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

## RULE: Telegram messages follow the house style in `TELEGRAM-STYLE.md`

Every message a workflow sends must be scannable on a phone: one status emoji at
the start (✅ done, 🟡 act now, ⏳ waiting, 🔄 running, ⏭️ skipped, ♻️ unchanged,
⚠️ needs a look, ❌ failed), one idea per block with a blank line between blocks,
three to six lines, no markdown, no closing pleasantries, and no internal `rec...`
ids in the visible text. Machine data (`⟦…⟧` payloads and anything else a workflow parses) goes
below a 14-character `─` rule under the label `🤖 system data · tap to reveal`,
wrapped in a Telegram spoiler.

This is not only cosmetic. On 2026-11-12 a `BA-DCvtat` approval opened with
"✅ Done." and the instruction to send step 2 was skimmed past, so an hour was
lost waiting for a regeneration that had never been started. See
`TELEGRAM-STYLE.md` for the full rule, the approval/done body shape, and the
per-workflow migration status.

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

## RULE: Claim a row with `Workflow Lock`, not a stage status

A workflow that a view triggers owns one row at a time. Claim it with the generic lock, not a `<Stage> In Progress` status.

- **Field:** `Episodes.Workflow Lock` (`fldM4aHJ0qhD1CQBp`, single line text). Value: `<stage> <ISO timestamp>`, for example `audionauts-post 2026-11-23T22:10:00Z`.
- **Every trigger view requires `Workflow Lock is empty`.** The code guard repeats it as a backstop.
- **Claim after the pick and before any model call, upload or multi-step work.** The row then leaves the view immediately.
- **On success, clear the lock and set the outcome status in one PATCH.**
- **On failure, leave the lock and send the reason to Telegram.** A failed run must not retry itself every minute.
- **Recovery is one action:** clear the lock, and put the episode back at the status the stage expects if a later step changed it.
- **A non-empty lock always means a run owns the row or died.** That is the whole point; do not "fix" it by clearing the lock automatically.

**Why not one universal status?** `Status` answers "where is this episode" for Jonny and the assistant. Using it as the lock too is what produced all the stage-specific statuses, and a generic `In Progress` would lose which stage is stuck. The lock keeps the two jobs separate.

**Migration status (2026-11-24):** the Audionauts draft and the X social draft claim with the lock. Metadata, artwork, thumbnail pick/revision, the Fountain publisher and the content sync still claim with `Generating Metadata`, `Generating Artwork`, `Processing` and `Publishing`. Migrate one stage at a time; add `Workflow Lock is empty` to a view when you touch it even before that stage is migrated. The full staged plan is `workflow_planning/Workflow Lock Migration.md`.

**Rollout rule.** One stage per branch and PR. The view condition and the workflow claim ship together. Retire the old claim status only after the stage has run cleanly in production. Never clear a lock while an execution is live: check the execution first, then clear it.

**The lock is not a status.** Do not expose it as a stage, do not let the assistant treat it as one, and do not use it in place of the human statuses (`Ready to Publish`, `Awaiting Thumbnail Pick`, `Published`).

---

## RULE: Test rows must be invisible to every poller

A temporary episode is still a real row, and every view poller sees it. Create test data at a status that no view watches.

- **Safe default:** `Recorded`, with a `TEST` prefix in the title.
- **Never** create a test episode at `Approved`, `Ready for Metadata`, `AI Analysis Complete`, `Artwork Ready` or `Ready to Publish`. Each of those opens a different workflow.
- If the test must exercise a specific view, flip the status at the last moment, keep the `TEST` title, and delete the row and every child record in the same session: `Social Posts`, `Publications`, `Thumbnails`, and any attachment. Deleting the episode does not always delete the children.
- Telegram cannot be unsent. Route test messages to Jonny's DM, never the group.

**Why.** On 2026-11-23 a temporary `Approved` episode created only to test the X social writer entered the `Ready for 16X9 Thumbnail` view. The artwork workflow generated four thumbnail options and posted a real "Pick a thumbnail" message during the session. The episode was deleted, but the thumbnail rows and the message were real, and the rows had to be cleaned up by hand.

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

## RULE: No real line breaks inside a quoted string in an expression

Inside a `{{ … }}` chunk, a quoted string may contain the **two-character escape**
`\n`, but never an actual line break. n8n sees a quote that runs across a line as
`ExpressionExtensionError: invalid syntax` and the node fails before it can send
or write anything.

- The stored parameter must hold backslash-`n`. In JavaScript or JSON that means
  `\\n` when the chunk itself is being written as a string (an `.sdk.js` snapshot
  puts the whole parameter inside a double-quoted JS string, so it needs `\\n`;
  the live value then holds `\n`).
- The failure is **late and quiet**: on 2026-11-14 `BA - Subworkflow - Apply
  Fountain Sync` failed at `Notify Synced` *after* `Finish Sync` had written
  Airtable. The item was synced correctly; only the confirmation message died, so
  the sole symptom was the red "Workflow failed" alert and a missing message.
- The n8n UI does not warn about this on a pushed workflow, and the Telegram style
  audit only reads wording. `./scripts/query/expression-syntax-audit.sh` scans
  every snapshot for quote-across-line-break and exits non-zero. Run it after
  touching any expression that contains a quoted string, and before blaming a
  node's logic for `invalid syntax`.

---

## RULE: Copy Airtable table ids, never build them

Airtable accepts a table in an API path by its id (`tbl…`) or by its exact name.
Ids are case-sensitive, and an id that does not exist returns
`INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`, whose wording blames the token. A typo
therefore looks like an auth failure and sends everyone to the wrong place.

- **2026-11-17:** the Telegram assistant proposed deleting four Thumbnails rows at
  `app8Xw9Tq0XLjhmp9/tblThumbnails`. The live id is `tblkcASzE4DXlxokO`, and
  `tblThumbnails` is the table name with `tbl` glued on. Two taps failed with the
  permissions wording and nothing was written.
- In a prompt or a node, take the id from `get_base_schema` (or the base's API
  metadata) and paste it. Never assemble one from a table name.
- `./scripts/query/table-id-audit.sh` checks every 17-character Airtable id in
  every snapshot against the live bases and exits non-zero on an unknown one. It
  caught the assistant's Social Posts id (`tblY8EpeOlYrXHYNE`, live
  `tbly8EpeOlYrXHYNE`) on its first run.

---

## RULE: A view-triggered workflow must handle every row a poll returns

**An Airtable Trigger fires once per poll, not once per row.** It hands over *every*
row that matched, then moves its timestamp cursor to now. A workflow that reads
`.first()` anywhere downstream therefore processes row 1 and silently drops rows
2..N, and those rows then sit in the view forever, because the cursor has already
moved past them. Nothing errors, and the view keeps showing them as waiting.

Two acceptable patterns:

- **One row per run (preferred for pipelines built around a single row).**
  Schedule Trigger → Airtable **search** of the same view, `returnAll: false`,
  `limit: 1`, sorted oldest `Last Modified Time` first → an IF guard on `$json.id`.
  Claim the row early (a status write that removes it from the view), so a failure
  cannot re-fire and re-alert every minute. Cost: a stored execution on every poll,
  even an empty one, because a schedule always runs the workflow while a trigger
  poll can decline to.
- **Loop over the rows.** Keep the Airtable Trigger and wrap the pipeline in
  Loop Over Items (batch size 1), retargeting every `.first()` at the current
  iteration. No extra executions, but a much larger edit.

**Never cap it with `limit` on the Airtable Trigger alone.** The cursor still moves
past every row the poll matched, so rows it dropped cannot come back.

**Why.** On 2026-11-13 two clips entered the `Ready for Metadata` view in one poll
(execution 21466). Only the first was processed, the claim wrote to it twice, and
the second (`BA-KXqegO`) was stranded for three days. `BA - Guy's Take Thumbnail
Artwork` reads its triggers with `.first()` too, so it carries the same risk.

---

## RULE: Agents create PRs; Jonny merges them

**An agent never merges its own pull request, and never pushes straight to `main`.** The
workflow is: branch, commit, push the branch, open the PR, **report the URL and stop**.

**These authorise a merge:** "merge it", "merge the PR", "merge the branch",
"go ahead and merge", "approve the merge", "you can merge".

**These do not:** "push the code", "push this", "create a PR", "open a PR", "push and
merge", "I'm ready to merge this". They authorise the PR at most.

- Enforced in code, not by good intentions: `.opencode/plugins/merge-guard.js` (opencode)
  and `.claude/hooks/merge-guard.py` (Claude Code, wired as a `PreToolUse` hook on `Bash`)
  block `gh pr merge`, the API merge endpoint, and any `git push` that targets `main`.
- The `no-auto-merge` skill (`~/.claude/skills/no-auto-merge/SKILL.md`) carries the same
  rule, but a skill only applies if the agent loads it, which is why the code guard exists.
- `.claude/settings.local.json` previously allow-listed `Bash(gh pr *)`, which pre-approved
  `gh pr merge`. It is now split into the read and create subcommands only.

**Why.** On 2026-10-21 an agent read "I'm ready to merge this" as authorisation and merged
PR #15 unattended. The content was wanted; the merge was not the agent's to make.

---

**Never let `updateNode` replace `parameters` with a partial object.** `n8n_update_partial_workflow`'s `updateNode` takes `updates.parameters` as a **whole-object replacement**, not a merge. Sending `{ parameters: { url: "..." } }` leaves the node with *only* a `url` and silently drops `method`, `authentication`, `nodeCredentialType`, `sendBody`, `jsonBody` and everything else, which shows up as a naked `401 AUTHENTICATION_REQUIRED` from Airtable. Either send the node's complete `parameters` object with the one field changed, or use `patchNodeField` for a find/replace inside a single string field. Two live nodes were broken this way on 2026-11-17 (the assistant's agent node lost `promptType`/`text`, the artwork `Mark Generating` lost its PATCH method and credential type), both caught by diffing the refreshed snapshot against the previous one. **After any MCP node update, refresh the snapshot and diff it against the last version before trusting the run.**

## RULE: Watch the execution-volume budget

Every polling stage buys its reliability with a stored execution per poll. After the 2026-11-17 changes the instance writes roughly **5,300 executions a day**, about **3,900 of them from three `Every Minute` timers** in the metadata and artwork workflows (a metadata timer, an artwork-generation timer, and one shared artwork pick/revision timer). n8n keeps a bounded history (default 10,000 executions), so that is roughly two days of scrollback.

- **Hard threshold: ~10,000 a day.** At that point either lengthen the poll interval (every 2 minutes halves a timer's cost and adds at most a minute of latency), or raise the server's prune limit if disk allows. Do not add a fourth minute-timer without doing one of those first.
- **Cheaper options, in order:** one shared timer per workflow rather than one per queue (the artwork pick and revision queues already share one); a longer interval for queues nobody waits on; and only then raising the prune limit.
- **Measure, do not estimate:** `n8n_executions` with a `limit: 100` on the list gives the newest 100 runs; the timestamps on the first and last give the real rate.

---

## Related conventions enforced elsewhere

- **Airtable Trigger Fields** — when restricting the Fields list, include the
  trigger field itself and use commas with **no spaces**. Hook:
  `.claude/hooks/airtable-trigger-fields-check.py` (Claude Code); manual check
  under opencode per `AGENTS.md`.
- **Workflow naming** — name a workflow after its trigger, not its actions.
- **One Telegram trigger per bot** — only one active workflow can hold the
  Telegram Trigger for a given bot; other workflows may *send* but not *trigger*.

---

## RULE: Update the System Map when a workflow ships

**Every time a workflow is created, completed, or materially changed and published, update
the System Map** (`workflow_planning/System Map.md`) and push it to the live Airtable row:

```
bash scripts/deploy/schema/sync-system-map.sh
```

The Telegram assistant reads the **Airtable row**, not the repo file, so editing the repo
file alone changes nothing for the agent. The map's preconditions checklists are the Airtable
view filters spelled out; keep them in step with the actual views (read the live row first —
it has drifted before). This is a standing rule: do it every time, without being asked.

**Sync only from merged `main`.** The sync replaces the whole `Prompt` field, so running it
from an unmerged or stale branch publishes a version that is missing whatever else merged
meanwhile, and the repo and the bot then disagree with no error anywhere. Merge first, pull
`main`, then sync. If a workflow change is still on a branch, either wait for the merge or
expect to sync again afterwards. Same principle for every single shared copy in this system:
the live n8n workflow and the sync ledger are also last-writer-wins.
