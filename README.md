# n8n Control Room

The admin side of our n8n automation server.

This repo bundles two things:

1. **AI-agent wiring** so you can build and edit n8n workflows by chatting with an AI ("create a workflow that emails me every morning..."), and the agent builds, validates, and saves it for you. Works with opencode or Claude Code (see `AGENTS.md` / `CLAUDE.md`).
2. **Admin shell scripts** (`scripts/`) that you run from your own machine to mutate the n8n server: deploy workflows, create credentials, add Airtable status options, sync the System Map, query data tables.

> **The client-facing Public API is parked, not deleted.** The `Public API` workflow in n8n has been stripped back to a token-auth skeleton (it no longer touches the deleted `bookings` table); the `client/` folder is gone. Add actions to it when you build the API out.

## What you need

1. **An AI coding agent** installed on your machine: **opencode** (this repo has an `AGENTS.md` and a project `.opencode/` config) or **Claude Code** (`AGENTS.md` is imported by `CLAUDE.md`). Sign in to whichever you use.
2. **An n8n MCP access token** (for the AI workflow builder). Log in to your n8n instance (the admin will share the URL with you privately), go to `/settings/mcp`, and copy the token shown there. Treat it like a password.
3. **An n8n REST API key** (for the admin shell scripts). Same n8n instance, go to `/settings/api`, generate a key. Also private.

## First-time setup

### 1. Clone this repo

```bash
git clone <repo-url> n8n-control-room
cd n8n-control-room
```

### 2. Open it in your agent

```bash
opencode          # or: claude
```

The repo ships instructions both tools read automatically (`AGENTS.md`, and `CLAUDE.md` which imports it). On first open, accept any project-settings / trust prompt. In Claude Code that also auto-installs the n8n skills plugin; opencode reads the same guidance from the vendored copy in `vendor/n8n-skills/`.

### 3. Wire up your n8n MCP token

This repo works with any MCP-capable coding agent (opencode, Claude Code, Cursor, etc.), not just opencode. The connection details live in `setup/n8n_mcp_configuration.json` (server URL plus a token placeholder); it is a template, not tied to one tool.

- **opencode**: the project config lives in `.opencode/` (the secret-guard and n8n workflow-sync-guard plugins). The token is read from `N8N_MCP_ACCESS_TOKEN` (in `.env`, or your shell environment).
- **Claude Code**: paste `setup/n8n_mcp_configuration.json` to your agent and say "Wire up my n8n MCP using the instructions in Setup.md".

`Setup.md` is tool-agnostic: it asks your agent which host it is and translates the connection into that host's config format. Your token never appears in chat.

### 4. Create your `.env` for the admin scripts

Copy `.env.example` to `.env` in the repo root (gitignored) and fill in real values:

```bash
cp .env.example .env
```

Then edit `.env`. At minimum you need:

```bash
# Required for every script — base URL of your n8n instance (no trailing slash)
N8N_URL='https://your-n8n-host.example.com'

# Required for any deploy/* or query/* script that talks to n8n's REST API
N8N_API_KEY='your-n8n-api-key'

# Only needed for scripts that touch AgentMail
AGENTMAIL_API_KEY='am_...'
AGENTMAIL_INBOX_ID='example@agentmail.to'   # after running query/agentmail-inboxes.sh
AGENTMAIL_CREDENTIAL_ID='...'               # after running deploy/credentials/create-agentmail.sh

# Reserved / future use, no current script reads these. Calendly is no longer
# used (scheduling is email-driven via AgentMail), kept in case they're useful later.
N8N_V3=''
CALENDLY_CREDENTIAL_ID=''
```

Each script's header comment lists exactly which env vars it reads.

### 5. Smoke-test it

Either side works as a check.

Via the agent (MCP): "Create me a simple workflow with no dependencies to check it's working." You should get back a link to a new workflow in n8n.

Via shell scripts:

```bash
./scripts/query/workflows.sh        # lists every workflow on the server
```

## Repo layout

| Path | What it does |
|---|---|
| `README.md` | This file. |
| `AGENTS.md` | Agent instructions (opencode reads this; `CLAUDE.md` imports it for Claude Code). |
| `CLAUDE.md` | Imports `AGENTS.md` so Claude Code gets the same instructions. |
| `.opencode/` | Project opencode config: the secret-guard and n8n workflow-sync-guard plugins. |
| `vendor/n8n-skills/` | Vendored n8n expert guidance (from `czlonkowski/n8n-skills`, MIT) that opencode reads. |
| `Setup.md` | Step-by-step recipe for wiring your MCP token into your coding agent. |
| `setup/n8n_mcp_configuration.json` | MCP connection details for Claude Code (URL + placeholder token). |
| `setup/Public API - client guide.md` | Client-facing guide for the read-only Episodes API (send with their key). |
| `.claude/settings.json` | Auto-loads the n8n skills plugin + guard hooks in Claude Code. |
| `.gitignore` | Lists files that should never be committed (secrets, local state, OS junk). |
| `scripts/deploy/` | Scripts that mutate n8n: install workflows, create credentials, add Airtable status options, sync the System Map. |
| `scripts/query/` | Read-only scripts that inspect n8n state: list workflows, dump nodes, query data tables. |
| `data/bitcoin-podcast-rss/` | Working data (RSS enrichment batches) for the Bitcoin podcast import. |

### `scripts/deploy/`

Admin actions that change server state. All read `N8N_API_KEY` from the root `.env`.

| Script | Does |
|---|---|
| `workflows/delete.sh <id> [<id>...]` | Deletes one or more workflows. Prompts for confirmation. `-y` to skip. |
| `workflows/rename.sh <id> "<name>"` | Renames a workflow. |
| `credentials/create-agentmail.sh` | Creates the AgentMail `httpHeaderAuth` credential in n8n. |
| `tokens/issue.sh <client-name>` | Mints a token for the Public API and stores it in the `api_tokens` data table. Printed once, save it. |
| `tokens/revoke.sh <client-name>` | Sets `revoked=true` on every token row for that client. Old tokens stop working immediately. Rows are kept for audit. |
| `agentmail/create-webhook.sh` | Registers the AgentMail `message.received` webhook that feeds the email-driven scheduling workflow. Idempotent. |
| `schema/add-scheduling-status.sh` | Adds the `Scheduling` choice to `Episodes.Status` (Airtable's metadata API can't add select choices, so it does it with a typecast record write). |
| `schema/sync-system-map.sh` | Writes the repo's `workflow_planning/System Map.md` into the live Airtable `Prompts` row the Telegram assistant reads. |

> **Removed 2026-09-29.** The Calendly-bookings scripts (`bookings/*`, `workflows/add-bookings-table-nodes.sh`, `workflows/migrate-gmail-to-agentmail.sh`, `workflows/reactivate.sh`, `credentials/create-calendly.sh`, `credentials/bind-calendly.sh`), the Public-API installer/tester (`workflows/install-public-api.sh`, `query/public-api-test.sh`), the `query/bookings.sh` / `query/calendly-webhooks.sh` / `query/workflow-nodes.sh` trio, and the whole `client/` folder were deleted. The `bookings` data table is gone; Calendly scheduling was replaced by the email-driven `AgentMail Received > Episode Scheduling`. The token scripts (`tokens/*`, `query/api-tokens.sh`, `query/data-tables.sh`) are kept: the `api_tokens` n8n Data Table is the token store for the kept Public API.

### `scripts/query/`

Read-only inspection scripts. Most read `N8N_API_KEY`; the AgentMail and Fountain variants read those keys instead.

| Script | Does |
|---|---|
| `workflows.sh` | Lists every workflow (id, name, active state, updated time). |
| `data-tables.sh` | Lists all n8n Data Tables visible to your API key. |
| `api-tokens.sh` | Lists rows in `api_tokens` with token values masked. Filters: `active`, `client=name`. |
| `agentmail-inboxes.sh` | Lists AgentMail inboxes for your account. |
| `fountain.sh` | Read-only Fountain API queries (feeds, items, stats). |
| `enrich-bitcoin-podcast-rss.js` | Node helper that discovers RSS feeds for Bitcoin podcast records; defaults to reading/writing `data/bitcoin-podcast-rss/`. |

## What's NOT in this repo (and why)

- **`.env`** at the repo root: your personal n8n / AgentMail secrets (plus the reserved `N8N_V3`). Gitignored.
- **Bearer tokens / API keys**: never committed in any form.
- **`.claude/settings.local.json`**: your personal Claude Code permission preferences. Gitignored so they don't override anyone else's.

## Troubleshooting

- **"The agent doesn't see the n8n tools"**: restart the agent after wiring the MCP token. The MCP connection loads at startup. In opencode, confirm `N8N_MCP_ACCESS_TOKEN` is set in `.env`.
- **"Claude Code says the plugin can't be found"**: open the repo folder fresh in Claude Code and accept the project settings prompt. That triggers the plugin install. (opencode doesn't need the plugin; it reads `vendor/n8n-skills/`.)
- **"A deploy script says `.env` not found"**: the scripts expect `.env` at the repo root. Even subfolder scripts walk up to find it.
- **"My token leaked into chat"**: rotate it immediately. For an MCP token, regenerate at `/settings/mcp`. For the n8n REST API key, regenerate at `/settings/api`.
