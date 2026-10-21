# Public API

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `4bhBARvaFnFj1sxG`.
> Live state: **active**, webhook path `/webhook/api`.

---

## TL;DR

A small token-authenticated, **read-only** webhook that lets an external client (or their AI agent) read episode data from the **Bitcoin Audible** base. The client POSTs `{ "action": "...", ... }` with their bearer token, the workflow checks the token against the `api_tokens` n8n Data Table, reads Airtable, and returns JSON. It never writes anything and cannot reach any table other than Episodes.

Client-facing guide (send this to the client with their key): `setup/Public API - client guide.md`.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `4bhBARvaFnFj1sxG` |
| Trigger | Webhook, `POST /webhook/api`, `responseMode: responseNode` |
| Auth | `Authorization: Bearer <token>`, checked against the `api_tokens` data table (`kOlDKTJT6gZAiogw`), `revoked = false` |
| Airtable base | Bitcoin Audible, `app8Xw9Tq0XLjhmp9` |
| Airtable table | Episodes, `tbl3uYLIvtB9APZp6` |
| Access | **Read-only**. No create/update/delete anywhere. |
| Actions | `list_episodes`, `get_episode` |
| Workflow timezone | `America/New_York` (not schedule-driven) |
| Error workflow | not wired (the workflow handles its own errors and returns 4xx) |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Fetch Episodes`, `Fetch Episode` |

⚠️ These are HTTP Request nodes, so the credential is **not** auto-assigned on a workflow push. Rebind `Fetch Episodes` and `Fetch Episode` to `Airtable [n8n] (PAT)` by hand after every push.

The `api_tokens` data table is read by the two `dataTable` nodes and needs no external credential.

---

## How it works (node by node)

1. **Webhook** — receives `POST /webhook/api`.
2. **Extract Token** — reads the bearer token from the `Authorization` header, and sets `revoked = false`.
3. **Token Valid** — `rowExists` on `api_tokens` where `token = <token>` and `revoked = false`.
4. **Token Invalid** — `rowNotExists`, same match, routes to **Respond 401**.
5. **Respond 401** — `{ "error": "unauthorized" }`.
6. **Route Action** — Switch on `body.action`:
   - `list_episodes` → **Build Episode Query**
   - `get_episode` → **Prepare Get**
   - anything else → **Respond 400** (`{ "error": "unknown action", "action": "..." }`)
7. **Build Episode Query** (Code) — builds the Airtable list URL from `limit` (default 100, capped at 100), `offset`, `filterByFormula`, and `view`. Only present parameters are added, all URL-encoded.
8. **Fetch Episodes** — GET the Airtable list URL, `Airtable [n8n] (PAT)`. `onError: continueErrorOutput`.
9. **Shape Episodes** (Code) — returns `{ rows, count, offset }`, and trims each record to `fields` if the request asked for a subset.
10. **Respond JSON** — responds `200` with `JSON.stringify($json)`.
11. **Prepare Get** (Code) — accepts a `rec...` record id (`RECORD_ID()="..."`) or a `BA-...` episode id (`{ID}="..."`), and builds a one-row list URL with that filter. Anything else becomes a deliberately invalid path so Airtable 404s (this blocks path traversal to other tables).
12. **Fetch Episode** — GET that URL, same credential, `onError: continueErrorOutput`.
13. **Shape Episode** (Code) — takes the first record (or none) and returns `{ rows, count }`; a well-formed id that matches nothing yields `{ rows: [], count: 0 }`.
14. **Respond Bad Request** — `400` with `{ "error": "bad_request", "detail": "..." }`, reached from either Airtable node's error output (bad formula, bad id, 404).

---

## Request / response contract

Request (POST, JSON):

```json
{ "action": "list_episodes", "limit": 50, "filterByFormula": "{Status}=\"Published\"", "fields": ["ID","Title"] }
```

- `list_episodes`: `limit` (1-100, default 100), `offset`, `filterByFormula`, `view`, `fields` (array of field names).
- `get_episode`: `recordId` (required; the `BA-...` id or the `rec...` id, also accepted as `episodeId` or `id`), `fields` (optional).

Success:

```json
{ "rows": [ { "id": "rec...", "createdTime": "...", "fields": { "ID": "BA-xxxx", "Title": "..." } } ], "count": 1, "offset": null }
```

Errors: `401 { "error": "unauthorized" }`; `400 { "error": "unknown action", ... }`; `400 { "error": "bad_request", "detail": "..." }`.

---

## Guardrails

- **Read-only by construction.** There is no Airtable write node in the workflow.
- **Single table.** Base and table are hardcoded in `Build Episode Query` / `Prepare Get`; the client can never point at another table.
- **No path injection.** `get_episode` only accepts a well-formed `rec...` or `BA-...` id.
- **Token is server-side only.** The client never sees the Airtable PAT, so they cannot spend it.

---

## Post-push ritual

1. Pull the live workflow first and diff against this readme.
2. Push, then **publish** (a saved draft is not live).
3. Confirm active.
4. **Rebind** `Fetch Episodes` and `Fetch Episode` to `Airtable [n8n] (PAT)`.
5. Smoke-test with a token (see below).

Smoke test:

```bash
curl -X POST https://vmi3181229.contaboserver.net/webhook/api \
  -H "Authorization: Bearer <a-token-from-api_tokens>" \
  -H "Content-Type: application/json" \
  -d '{"action":"list_episodes","limit":2,"fields":["ID","Title","Status"]}'
```

Expected: `200` with `{ "rows": [...] }`. A wrong token returns `401`.

---

## Tokens

Minted and revoked with the admin scripts:

- `scripts/deploy/tokens/issue.sh <client-name>` — creates a token in `api_tokens` and prints it once.
- `scripts/deploy/tokens/revoke.sh <client-name>` — sets `revoked = true` for that client's tokens.

---

## Related

- Client guide: `setup/Public API - client guide.md`
- Repo rules: `n8n_workflow_readmes/CONVENTIONS.md`
