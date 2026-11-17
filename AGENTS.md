# AGENTS.md

Instructions for any AI coding agent (opencode, Claude Code, Cursor, etc.) working in this repo. Read this first.

## What this repo is

The admin side of a self-hosted n8n automation server. It runs the **Guy's Take / Pod21 content machine** (Airtable is the state machine, n8n executes, Telegram is the team interface). This repo holds admin shell scripts, per-workflow SDK source files, per-workflow readmes, and the planning docs.

## Read before touching anything

1. **`workflow_planning/Guys Take Build Status.md` → Part 0.** Orientation for implementers: the design rules, the key IDs/credentials, and the 20 non-negotiable platform constraints (hard-won; violating them has caused real breakage). Read it before building or changing any workflow.
2. **`n8n_workflow_readmes/CONVENTIONS.md`** for cross-workflow rules.
3. **The specific workflow's readme** in `n8n_workflow_readmes/` before touching that workflow.

## Working in parallel: one folder per session

Jonny runs several agent sessions at once. A git checkout has **one** working folder and **one** checked-out branch, so two sessions in the same folder are not two copies of anything: they share the files and take each other's branch. On 2026-11-17 a second session ran `git checkout -b <branch>` in the shared folder while another agent was mid-edit, and that agent's commit landed on the wrong branch. It was recovered from the branch name by luck.

**RULE: one session per working folder.** The main checkout is for reading, pulling, merging and quick checks. Any second piece of work gets its own **worktree**, named after the task, and the session works there.

- **opencode:** `worktree_create({ name })` returns the new folder (under `~/.local/share/opencode/worktree/…`); `session_move({ directory })` moves the current session into it; `worktree_list()`; `worktree_remove({ directory })`.
- **Any other harness:** `git worktree add ../n8n-control-room-<name> -b <branch> <base>`, then start the session in that folder. `git worktree list`, `git worktree remove <path>`.

**Always announce a worktree the moment you create one**, in plain words in chat: what it is for, the branch name and the folder. Jonny has several sessions open and needs to know which one has moved.

**Always offer to delete it once the branch's work is finished**: the PR is merged, or the work is abandoned. One line, with the folder path. Never delete without being asked. A merged worktree left behind is invisible clutter outside the project, so do not let them accumulate.

**Credentials do not travel.** Git-ignored files (the local env file holding the API keys) are not copied into a worktree, so any script needing real credentials will refuse to run there. Run those from the main checkout, or copy the file in deliberately.

**RULE: never two sessions working on the same workflow at the same time.** The live n8n instance is single-writer: two branches can each hold a change, but the second push overwrites the first on the server, and git cannot see that. If two pieces of work touch the same workflow, sequence them: A merges, B rebases on the new `main`, then B proceeds.

**RULE: sync the System Map only from merged `main`.** The Airtable row is the bot's live copy and the sync replaces the whole field. Syncing from an unmerged or stale branch publishes a version missing whatever else merged meanwhile, and the repo and the bot then disagree with no error anywhere. Merge first, pull `main`, then `bash scripts/deploy/schema/sync-system-map.sh`. The same applies to anything with a single shared copy: the live n8n workflow, the Airtable row, the sync ledger.

**When a merge conflicts, never silently drop the other side.** Mechanical conflicts (both branches appended an entry to the change log) keep both, in a sensible order. A judgement call (two different opinions about the same sentence) gets surfaced to Jonny with both versions. Conflicts are expected and are resolved by merging `main` into the branch, not by rewriting the other person's work.

## The source-of-truth rule (most important)

**The live n8n server is the source of truth. The `.sdk.js` files in `scripts/deploy/workflows/` are a local copy.** Jonny edits workflows directly in the n8n UI and changes Airtable by hand, so the SDK copy can drift.

Before changing any `.sdk.js` file, pull the live workflow (`get_workflow_details` via the n8n MCP, or REST) and diff it against the SDK file. **If they differ, stop, surface the diff, and ask Jonny which is correct** (almost always live). Reconcile the SDK to live first, commit that, then build the new change on top. Never push a stale SDK file over a drifted live workflow; that silently destroys Jonny's manual edits.

## The post-push ritual (every workflow push)

1. **Publish** it (an MCP/SDK push only saves a draft; `versionId` must equal `activeVersionId`).
2. **Confirm Active** and `availableInMCP` are still set.
3. **Check every HTTP-node credential is still bound** rather than rebinding by default. MCP pushes now bind credentials passed inline and a partial update leaves existing bindings alone, so the old blanket rebind is no longer needed. Verify via REST `GET /api/v1/workflows/<id>` (it returns `credentials`; the MCP read strips them).
4. **Fresh-flip test any polling trigger** (Airtable pollers re-baseline their cursor to ~now on publish; a row already in the trigger view won't fire).
5. **Confirm the `.sdk.js` snapshot matches live.** This is automatic now: `.opencode/plugins/n8n-sdk-snapshot.js` and `.claude/hooks/sdk-snapshot.py` re-run `snapshot-sdk.sh` after every successful push. Verify with `./scripts/query/sdk-drift.sh`, which exits non-zero if any snapshot has drifted. A push made outside the harness (hand edit in the n8n UI, another machine) still needs the script run by hand.

## Shell scripts

`scripts/query/*` are read-only inspections; `scripts/deploy/*` mutate the server. All read `N8N_API_KEY` (and friends) from the root `.env`; each script's header lists the env vars it needs. Find-by-name lives in `scripts/`.

## Talking to Jonny

- **Address Airtable records by their `BA-` ID, never the internal `rec…` ID.** The `BA-` ID is the Episodes `ID` field (e.g. `BA-0CH3H6`); for a Publication, use its `Publication` name (`<BA-…> - <Platform>`). Internal record IDs mean nothing to him and must never be used in chat.

## Talking to Charlie (after every PR)

Jonny forwards a plain-English update to Charlie after every PR. **Write that update every time a PR is opened or updated, without being asked.**

- **Audience.** Charlie works in Airtable and talks to the Telegram agent every day. He does not read code, n8n, git, or GitHub, and should not have to.
- **Depth limit.** The deepest technical thing to mention is an Airtable view, field, or status name. Never mention workflow IDs, node names, commits, branches, files, credentials, APIs, or SDKs.
- **Structure.** Three short sections, in this order: **What changed**, **What this fixes**, **Things to know**. Plain sentences, no jargon, no emoji, no tables.
- **Only what he can see or feel.** Bot messages, Airtable views and fields, timing, and anything he must do differently. Skip everything else.
- **Say it plainly when nothing changes for him**, e.g. "Nothing you need to do."
- **Length.** Under about 250 words.
- **Format.** Give it in chat as a copy-ready block, not as a file. Jonny pastes it straight into his message to Charlie.

## Guardrails under opencode

The `.claude/hooks/` Python hooks only run inside Claude Code. Under opencode:

- **Manual-edit guard** (the important one): **enforced by the plugin** at `.opencode/plugins/n8n-sync-guard.js`, which blocks an `update_workflow` push if the live workflow is newer than the last-synced baseline. It is a real guard, but the source-of-truth rule above still applies: it does not cover workflows with no baseline yet (a first push under the plugin), so still pull-and-diff before touching any `.sdk.js`.
- **Telegram record-ID lint**: every Telegram message about a record must include its ID (`BA-xxxx`) in a `<code>` block. (No plugin; do by hand.)
- **Telegram message style**: every bot message follows `n8n_workflow_readmes/TELEGRAM-STYLE.md` - one status emoji first, one idea per block with blank lines, 3 to 6 lines, no markdown, no `rec...` ids in visible text, and any machine-parsed payload below a 14-character `─` rule under `🤖 system data · tap to reveal`, wrapped in a Telegram spoiler. A new or changed Telegram node is not finished until it matches. (No plugin; do by hand.)
- **Airtable trigger-fields lint**: leave the Fields list empty (whole record); if restricting, include the trigger field and use commas with no spaces. (No plugin; do by hand.)
- **Expression syntax lint**: a quoted string inside a `{{ … }}` chunk must use the escape `\n`, never a real line break, or n8n throws `invalid syntax` at runtime (this silently failed a Fountain notification on 2026-11-14 after the Airtable write had succeeded). `./scripts/query/expression-syntax-audit.sh` scans every snapshot for it and exits non-zero. Run it after editing any expression that contains a quoted string.
- **Readme reminder**: when a workflow is created/updated, write or update its readme in `n8n_workflow_readmes/` (filename = workflow display name, colon → hyphen). (No plugin; do by hand.)
- **`.sdk.js` snapshot**: **every non-archived workflow has a snapshot in `scripts/deploy/workflows/`.** The refresh is now automatic rather than a reminder: both harnesses run `./scripts/deploy/workflows/snapshot-sdk.sh <workflow_id>` after a successful `update_workflow` / `create_workflow` (`.opencode/plugins/n8n-sdk-snapshot.js` and `.claude/hooks/sdk-snapshot.py`), reusing the workflow's existing filename. If a push happened outside the harness, run the script by hand. Two checks: `./scripts/query/sdk-coverage.sh` lists workflows with no snapshot, `./scripts/query/sdk-drift.sh` lists snapshots whose live workflow has moved on. Both exit non-zero. Never edit a drifted snapshot as if it were live; regenerate it first.
- **System Map reminder**: **every time a workflow is completed and published**, update `workflow_planning/System Map.md` and push it to the live Airtable row with `bash scripts/deploy/schema/sync-system-map.sh`. The Telegram assistant reads the **Airtable row**, not the repo file, so the repo edit alone changes nothing for the agent. Read the live row first (it has drifted before). Do this every time, without being asked.

## n8n expert guidance

The `n8n-skills` knowledge base (from `github.com/czlonkowski/n8n-skills`, MIT) is the reference for building n8n workflows correctly. In Claude Code it loads as a plugin. Under opencode it is vendored at **`vendor/n8n-skills/skills/`**; consult the relevant `SKILL.md` (agents, code nodes, error handling, expressions, etc.) before non-trivial n8n work.

## Don't

- **Never merge a pull request.** Create the branch and the PR, report the URL, and stop. Jonny merges. "I'm ready to merge this", "push and merge" and "create a PR" are readiness, not authorisation; "merge it", "merge the PR", "go ahead and merge" and "you can merge" are. Enforced by `.opencode/plugins/merge-guard.js` and `.claude/hooks/merge-guard.py`.
- Never commit secrets (`.env`, tokens). `.gitignore` already covers these.
- Never give the n8n agent write endpoints; read-only tools only.
- Never trigger a workflow stage from the previous stage's workflow; trigger off Airtable state.
- Never put a second Telegram Trigger on `@pod21_n8n_agent_bot`.
