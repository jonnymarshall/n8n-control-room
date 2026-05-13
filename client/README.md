# Bookings API — Client setup

This folder is what you give your client / AI agent. Two files matter:

- `bookings.sh` — the wrapper script
- `.env` — the agent's credentials (do NOT commit)

## Setup

1. Drop `bookings.sh` into the client's project.
2. Create `.env` next to it with:

```
AGENT_TOKEN='paste-the-token-you-were-issued'
N8N_API_URL='paste-the-webhook-url-you-were-given'
```

Your admin will provide both values privately.

3. Make it executable: `chmod +x bookings.sh`.
4. Test: `./bookings.sh` — should print a table of recent bookings.

## Usage

```bash
./bookings.sh                         # compact table, most recent first
./bookings.sh --json                  # raw JSON (parse with jq or in code)
./bookings.sh --all                   # vertical layout, every column
./bookings.sh --recent 5              # 5 most recent
./bookings.sh status=booked           # filter
./bookings.sh status=cancelled --all  # combine flags + filters
```

## Direct HTTP usage (skip the wrapper)

If your AI agent prefers to call the endpoint directly:

```
POST <N8N_API_URL>
Headers:
  Authorization: Bearer <your-token>
  Content-Type: application/json
Body:
  {"action": "list_bookings"}
```

Response:

```json
{
  "rows": [
    {
      "invitee_name": "Jane",
      "invitee_email": "jane@example.com",
      "event_type_name": "30-min intro",
      "start_time": "2026-05-13T20:30:00.000Z",
      "status": "booked",
      ...
    }
  ]
}
```

On auth failure: HTTP 401 with `{"error": "unauthorized"}`.
On unknown action: HTTP 400 with `{"error": "unknown action", "action": "..."}`.

## AI agent integration notes

For frameworks that treat shell commands as tools (Claude Code, OpenAI agent SDK, etc.):

- The agent can run `./bookings.sh --json` directly and parse the result.
- Tell the agent the available filter columns: `status`, `invitee_name`, `invitee_email`, `event_type_name`, `host_name`, `cancellation_reason`.
- For frameworks that prefer HTTP tools, give them the curl recipe above with a JSON schema describing the request/response.

## What happens if my token is compromised?

Contact the admin. They run `./scripts/deploy/tokens/revoke.sh <your-agent-name>` and issue you a new one. The old token immediately stops working.
