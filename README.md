# n8n Control Room

The admin side of our n8n automation server.

This repo bundles three things:

1. **Claude Code wiring** so you can build and edit n8n workflows by chatting with an AI ("create a workflow that emails me every morning..."), and Claude builds, validates, and saves it for you.
2. **Admin shell scripts** (`scripts/`) that you run from your own machine to mutate the n8n server: deploy workflows, mint client tokens, create credentials, query data tables.
3. **A `client/` folder** with everything you hand to a third party (or their AI agent) so they can call our Public API with their own bearer token.

## What you need

1. **Claude Code** installed on your machine. Download from https://claude.com/claude-code and sign in.
2. **An n8n MCP access token** (for the AI workflow builder). Log in to your n8n instance (the admin will share the URL with you privately), go to `/settings/mcp`, and copy the token shown there. Treat it like a password.
3. **An n8n REST API key** (for the admin shell scripts). Same n8n instance, go to `/settings/api`, generate a key. Also private.

## First-time setup

### 1. Clone this repo

```bash
git clone <repo-url> n8n-control-room
cd n8n-control-room
```

### 2. Open it in Claude Code

```bash
claude
```

The first time you open the folder, Claude Code will ask if you trust the project settings. Say **yes**. This auto-installs the n8n skills plugin (a bundle of expert guides on how to build n8n workflows correctly).

### 3. Wire up your n8n MCP token

Paste the contents of `n8n_mcp_configuration.json` to Claude and say:

> "Wire up my n8n MCP using the instructions in Setup.md."

Claude will prompt you (privately, hidden input) for your MCP token. Your token never appears in chat.

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

# Only needed for scripts that touch Calendly
CALENDLY_PAT='your-calendly-personal-access-token'
CALENDLY_CREDENTIAL_ID='...'                # after running deploy/credentials/create-calendly.sh
```

Each script's header comment lists exactly which env vars it reads.

### 5. Smoke-test it

Either side works as a check.

Via Claude (MCP): "Create me a simple workflow with no dependencies to check it's working." You should get back a link to a new workflow in n8n.

Via shell scripts:

```bash
./scripts/query/workflows.sh        # lists every workflow on the server
```

## Repo layout

| Path | What it does |
|---|---|
| `README.md` | This file. |
| `Setup.md` | Step-by-step recipe Claude follows to wire your MCP token into Claude Code. |
| `n8n_mcp_configuration.json` | MCP connection details (URL + placeholder token). |
| `.claude/settings.json` | Auto-loads the n8n skills plugin when you open the project. Shared. |
| `.gitignore` | Lists files that should never be committed (secrets, local state, OS junk). |
| `scripts/deploy/` | Scripts that mutate n8n: install workflows, create credentials, issue/revoke tokens. |
| `scripts/query/` | Read-only scripts that inspect n8n state: list workflows, dump nodes, query data tables. |
| `client/` | Drop-in folder for third-party clients. Contains `bookings.sh` plus a client-facing README. |

### `scripts/deploy/`

Admin actions that change server state. All read `N8N_API_KEY` from the root `.env`.

| Script | Does |
|---|---|
| `workflows/install-public-api.sh` | Deploys (or reinstalls) the `Public API` webhook workflow. Webhook ID is preserved across reinstalls so client URLs stay stable. |
| `workflows/delete.sh <id> [<id>...]` | Deletes one or more workflows. Prompts for confirmation. `-y` to skip. |
| `workflows/rename.sh <id> "<name>"` | Renames a workflow. |
| `workflows/reactivate.sh` | Deactivates then reactivates the Calendly workflow (forces webhook re-registration). |
| `workflows/migrate-gmail-to-agentmail.sh` | Replaces the Calendly workflow's Gmail nodes with HTTP nodes pointing at AgentMail. |
| `workflows/add-bookings-table-nodes.sh` | Inserts the Upsert/Update Data Table nodes into the Calendly workflow. |
| `bookings/clear.sh` | Deletes every row from the `bookings` data table. The public API can't delete data-table rows, so it spins up a one-shot webhook workflow (Webhook → Data Table deleteRows → Respond), calls it, then tears it down. Prompts for confirmation; pass `-y` to skip. |
| `bookings/backfill-from-calendly.sh` | Pulls all upcoming active bookings from Calendly (via `CALENDLY_PAT`) and inserts them into the `bookings` table with `status=booked`. Idempotent — re-reads existing `invitee_id`s and only inserts new ones. Pass `--dry-run` to preview. |
| `credentials/create-agentmail.sh` | Creates the AgentMail `httpHeaderAuth` credential in n8n. |
| `credentials/create-calendly.sh` | Creates the Calendly API-key credential. Prints the credential ID. |
| `credentials/bind-calendly.sh` | Binds the Calendly credential to the Calendly workflow node. |
| `tokens/issue.sh <client-name>` | Mints a bearer token for a client and stores it in the `api_tokens` table. Token is printed once, save it. |
| `tokens/revoke.sh <client-name>` | Sets `revoked=true` on every token row for that client. Old tokens stop working immediately. Rows are kept for audit. |

### `scripts/query/`

Read-only inspection scripts. Most read `N8N_API_KEY`; AgentMail/Calendly variants read those tokens instead.

| Script | Does |
|---|---|
| `workflows.sh` | Lists every workflow (id, name, active state, updated time). |
| `workflow-nodes.sh` | Dumps the parameters of every node in the Calendly workflow. Useful for reverse-engineering n8n's Resource Locator JSON shapes. |
| `data-tables.sh` | Lists all n8n Data Tables visible to your API key. |
| `bookings.sh` | Queries the `bookings` data table. Supports `--all`, `--json`, `--recent N`, and column filters (`status=booked`). |
| `api-tokens.sh` | Lists rows in `api_tokens` with token values masked. Filters: `active`, `client=name`. |
| `agentmail-inboxes.sh` | Lists AgentMail inboxes for your account. |
| `calendly-webhooks.sh` | Lists Calendly webhook subscriptions for your user. |
| `public-api-test.sh [<token>]` | Smoke-tests the public API by posting `{"action":"list_bookings"}` and printing raw status + body. |

### `client/`

What you hand to a third party (a person or their AI agent) so they can hit our Public API with their own token. Contains the wrapper script (`bookings.sh`) and a client-facing `README.md`. See `client/README.md` for the end-user setup steps and HTTP recipe.

## What's NOT in this repo (and why)

- **`.env`** at the repo root: your personal n8n / AgentMail / Calendly secrets. Gitignored.
- **`client/.env`**: a client's bearer token. Gitignored.
- **Bearer tokens / API keys**: never committed in any form.
- **`.public-api-workflow-id`**: a local pointer file written by `install-public-api.sh` so reruns can find the existing workflow. Local state, gitignored.
- **`.claude/settings.local.json`**: your personal Claude Code permission preferences. Gitignored so they don't override anyone else's.

## Troubleshooting

- **"Claude doesn't see the n8n tools"**: restart Claude Code after wiring the MCP token. The MCP connection loads at startup.
- **"It says the plugin can't be found"**: open the repo folder fresh in Claude Code and accept the project settings prompt. That triggers the plugin install.
- **"A deploy script says `.env` not found"**: the scripts expect `.env` at the repo root. Even subfolder scripts walk up to find it.
- **"My token leaked into chat"**: rotate it immediately. For an MCP token, regenerate at `/settings/mcp`. For a client/agent token, run `./scripts/deploy/tokens/revoke.sh <client-name>` and reissue.
