# AGENTS.md

Instructions for any AI coding agent (opencode, Claude Code, Cursor, etc.) working in this repo. Read this first.

## What this repo is

The admin side of a self-hosted n8n automation server. It runs the **Guy's Take / Pod21 content machine** (Airtable is the state machine, n8n executes, Telegram is the team interface) plus a separate Calendly bookings + public API setup. This repo holds admin shell scripts, per-workflow SDK source files, per-workflow readmes, and the planning docs.

## Read before touching anything

1. **`workflow_planning/Guys Take Build Status.md` → Part 0.** Orientation for implementers: the design rules, the key IDs/credentials, and the 20 non-negotiable platform constraints (hard-won; violating them has caused real breakage). Read it before building or changing any workflow.
2. **`n8n_workflow_readmes/CONVENTIONS.md`** for cross-workflow rules.
3. **The specific workflow's readme** in `n8n_workflow_readmes/` before touching that workflow.

## The source-of-truth rule (most important)

**The live n8n server is the source of truth. The `.sdk.js` files in `scripts/deploy/workflows/` are a local copy.** Jonny edits workflows directly in the n8n UI and changes Airtable by hand, so the SDK copy can drift.

Before changing any `.sdk.js` file, pull the live workflow (`get_workflow_details` via the n8n MCP, or REST) and diff it against the SDK file. **If they differ, stop, surface the diff, and ask Jonny which is correct** (almost always live). Reconcile the SDK to live first, commit that, then build the new change on top. Never push a stale SDK file over a drifted live workflow; that silently destroys Jonny's manual edits.

## The post-push ritual (every workflow push)

1. **Publish** it (an MCP/SDK push only saves a draft; `versionId` must equal `activeVersionId`).
2. **Confirm Active** and `availableInMCP` are still set.
3. **Rebind every HTTP-node credential by hand** (auto-assignment skips HTTP Request nodes on every push; the readmes list which credential each node needs).
4. **Fresh-flip test any polling trigger** (Airtable pollers re-baseline their cursor to ~now on publish; a row already in the trigger view won't fire).

## Shell scripts

`scripts/query/*` are read-only inspections; `scripts/deploy/*` mutate the server. All read `N8N_API_KEY` (and friends) from the root `.env`; each script's header lists the env vars it needs. Find-by-name lives in `scripts/`.

## Guardrails under opencode

The `.claude/hooks/` Python hooks only run inside Claude Code. Under opencode:

- **Manual-edit guard** (the important one): **enforced by the plugin** at `.opencode/plugins/n8n-sync-guard.js`, which blocks an `update_workflow` push if the live workflow is newer than the last-synced baseline. It is a real guard, but the source-of-truth rule above still applies: it does not cover workflows with no baseline yet (a first push under the plugin), so still pull-and-diff before touching any `.sdk.js`.
- **Telegram record-ID lint**: every Telegram message about a record must include its ID (`BA-xxxx`) in a `<code>` block. (No plugin; do by hand.)
- **Airtable trigger-fields lint**: leave the Fields list empty (whole record); if restricting, include the trigger field and use commas with no spaces. (No plugin; do by hand.)
- **Readme reminder**: when a workflow is created/updated, write or update its readme in `n8n_workflow_readmes/` (filename = workflow display name, colon → hyphen). (No plugin; do by hand.)

## n8n expert guidance

The `n8n-skills` knowledge base (from `github.com/czlonkowski/n8n-skills`, MIT) is the reference for building n8n workflows correctly. In Claude Code it loads as a plugin. Under opencode it is vendored at **`vendor/n8n-skills/skills/`**; consult the relevant `SKILL.md` (agents, code nodes, error handling, expressions, etc.) before non-trivial n8n work.

## Don't

- Never commit secrets (`.env`, tokens, `client/.env`). `.gitignore` already covers these.
- Never give the n8n agent write endpoints; read-only tools only.
- Never trigger a workflow stage from the previous stage's workflow; trigger off Airtable state.
- Never put a second Telegram Trigger on `@pod21_n8n_agent_bot`.
