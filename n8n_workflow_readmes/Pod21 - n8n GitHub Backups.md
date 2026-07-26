# Pod21: n8n GitHub Backups

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `spXF48NOXJYaDfnz`.)
> Live since 2026-06-06. The first full run committed all 17 workflows; daily 3am runs commit only changes since.

---

## TL;DR

Every day at 3am, this workflow:

1. Pulls **every workflow** from the n8n API (active, inactive, and drafts)
2. Writes each as pretty-printed JSON to `workflows/<Name>__<id>.json` in the private GitHub repo `jonnymarshall/n8n-backups`
3. Commits **only files that actually changed** (one commit per changed workflow, message names the workflow)
4. DMs Jonny via the Telegram bot if any step fails; silence means success

The repo's commit history doubles as a change log: every edit to any workflow is a diffable commit on `main`.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Schedule, daily 03:00 (instance timezone) |
| **Destination** | `github.com/jonnymarshall/n8n-backups`, `workflows/` folder, commits to `main` |
| **Commit granularity** | One commit per changed workflow; unchanged workflows produce no commits |
| **Failure handling** | Every node's error output → Telegram DM to Jonny (`⚠️ n8n GitHub backup failed`) |
| **Filename scheme** | `<sanitized name>__<workflow id>.json` |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `n8n account` | `n8nApi` | `Fetch All Workflows` (key from n8n Settings → n8n API; base URL MUST be `http://localhost:5678/api/v1` — n8n cannot hairpin to its own public URL, the connection gets refused) |
| `GitHub [n8n-backups]` | `githubApi` | `Get Existing File` + `Commit Changed Files` (fine-grained PAT, Contents read/write, scoped to the n8n-backups repo only) |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Notify Backup Failed` |

⚠️ **Rebuild gotcha:** if this workflow is recreated via the n8n API, the two HTTP Request nodes always lose their GitHub credential binding and must be re-bound by hand.

### n8n API key — rotation & the `.env` leak lesson

The `n8n account` (`n8nApi`) credential holds an **n8n public API key** (Settings → n8n API). It is the *only* thing `Fetch All Workflows` needs; if that key is revoked or expired, the node **401s and the whole backup fails** (you get the `⚠️ n8n GitHub backup failed` Telegram DM).

- **Rebind after a rotation:** open `Fetch All Workflows` → its **n8n API credential (`n8n account`)** → set **API Key** to the new value, leave the base URL (`http://localhost:5678/api/v1`) unchanged → Save → run the workflow once to confirm a green `Fetch All Workflows`.
- **Rotation log:** key **`N8N_API_SELF_V05`** (created 2026-07-21; named with underscores so it's a valid shell identifier) replaced **`N8N-API-[SELF]-V04`**, which was **revoked 2026-07-21 after its value leaked to a terminal**. `n8n account` was **rebound to V05 on 2026-07-21** (confirmed by Jonny). The leak came from a *copy of the key that had been stored in the repo's `.env`* under a key name containing brackets/hyphens: the deploy scripts `eval`-export every `.env` line, and bash echoes the whole `KEY=VALUE` when the name isn't a valid shell identifier (letters/digits/underscore only). **Lesson: keep this n8n API key in the n8n credential (and a password manager); it isn't needed in `.env` at all.** The shell scripts authenticate with a *different* key via the `N8N_API_KEY` variable.

---

## Security: what is and isn't in the backups

- **Credential secrets are NEVER included.** Workflow JSON references credentials as `{ id, name, type }` only; tokens live encrypted in n8n's database and cannot be exported through the API. No `.gitignore` is needed (and none would apply — files are pushed via the GitHub API, not from a working tree).
- Pinned test data is excluded (`excludePinnedData: true`), so captured API responses can't leak into the repo.
- Backups DO contain: node logic, AI system prompts, Telegram chat IDs, Airtable base/table IDs, credential names. Not secrets, but keep the repo private.

---

## How to recover

### Level 1: "I just broke a workflow" (no git needed)
n8n editor → ⋯ menu → **Version history** → restore the previous version. Fastest path, use this first.

### Level 2: restore an older version from the repo
1. On GitHub, open the workflow's file under `workflows/` → **History** → pick the last good commit → view the file at that commit
2. Either paste the JSON's nodes back into the n8n canvas, or hand the JSON to Claude in the n8n-control-room project and ask it to push the restore via the API
3. Standard ask: "restore yesterday's version of <workflow name>" — Claude pulls the file from the right commit and re-applies it

### Level 3: VPS is gone
1. Stand up a fresh n8n
2. Re-create the credentials by hand (~6 of them; names are documented in each workflow readme and in the backup JSONs' credential references)
3. Import each JSON from the repo (n8n UI: Workflow → Import from File, or via API)
4. Re-bind credentials on imported workflows, publish, re-point the Telegram webhook by publishing the assistant

### Known gap
The n8n **database** (credentials, execution history, static data such as the assistant's pending approvals) is not covered. Zero-thought recovery would additionally need a host-level cron dumping the DB volume + `N8N_ENCRYPTION_KEY` off-server. Deliberately deferred; revisit if credential count grows.

---

## How it works (node by node)

1. **Daily at 3am** — Schedule trigger.
2. **Fetch All Workflows** — n8n node, `workflow:getAll`, `returnAll`, filter `excludePinnedData: true` and NO published/unpublished filter. (Gotcha discovered in testing: the node's "Return Only Published Workflows" option is a binary filter, so setting it to `false` means "only unpublished" — to get everything the filter must be absent entirely.)
3. **Prepare Backup Files** — Code node: sanitizes each workflow name into a filename, pretty-prints the JSON, base64-encodes it.
4. **Get Existing File** — HTTP GET to the GitHub contents API per file, `neverError` on so a 404 (file doesn't exist yet) flows through as data.
5. **Keep Only Changed** — Code node: compares the new base64 against what's in the repo; passes through only new/changed files, attaching the existing file's `sha` (required by GitHub for updates) and the commit message.
6. **Commit Changed Files** — HTTP PUT to the contents API, one file at a time (batch size 1, 500ms interval, to avoid branch-head races). Zero changed files = node simply doesn't run.
7. **Notify Backup Failed** — Telegram DM, wired to the error output of every node above.

---

## Design decisions

- **Commits to `main`, no branches:** every commit is a permanent restorable snapshot; branch-per-backup would scatter state across dangling refs without adding any rollback ability.
- **Diff-before-commit:** keeps history meaningful (a commit = a real change) and avoids burning GitHub API quota on no-ops.
- **ID in filename:** workflow names can collide (archived rebuilds share names); the ID suffix keeps files unique. Side effect: renamed/rebuilt workflows leave their old file behind — stale files are harmless in a disaster-recovery repo and serve as extra history.
- **Failure-only notifications:** per Jonny's preference; check the repo's commit history or the executions list for positive confirmation.

---

## Related

- **Pod21: Telegram Airtable Assistant** (`Pod21 - Telegram Airtable Assistant.md` in this folder): most frequently edited workflow, i.e. the main beneficiary of these backups
- **BA: Guy's Take Weekly Research & Shortlisting** (`BA - Guy's Take Weekly Research & Shortlisting.md` in this folder)
