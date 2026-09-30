# Bitcoin Audible Episodes API (client guide)

This is a small, **read-only** HTTP API that returns episode data from the Bitcoin Audible Airtable base. You send a JSON request with your API key and get JSON back. It can never change our data.

## Your credentials

- **Endpoint URL:** `https://vmi3181229.contaboserver.net/webhook/api`
- **API key:** sent to you separately (keep it secret).

Every request is an HTTP **POST** with a JSON body, and must include these headers:

```
Authorization: Bearer <your-api-key>
Content-Type: application/json
```

## Available actions

Only the **Episodes** table is exposed. There are two actions.

### 1. `list_episodes`

Returns a page of episodes (up to 100 at a time).

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `action` | string | yes | `"list_episodes"` |
| `limit` | number | no | 1 to 100. Default 100. |
| `offset` | string | no | Copy the `offset` from a previous response to get the next page. |
| `filterByFormula` | string | no | An Airtable formula to filter rows, e.g. `{Status}="Published"`. |
| `view` | string | no | An Airtable view name, if you know one. |
| `fields` | array | no | Return only these fields, e.g. `["ID","Title","Status"]`. Omit to get every field. |

Example (ask for 2 published episodes, only some fields):

```bash
curl -X POST https://vmi3181229.contaboserver.net/webhook/api \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"list_episodes","limit":2,"filterByFormula":"{Status}=\"Published\"","fields":["ID","Title","Status","Release Date"]}'
```

Response:

```json
{
  "rows": [
    {
      "id": "rec0plfrxGLZlDLeS",
      "createdTime": "2026-08-05T14:29:51.000Z",
      "fields": {
        "ID": "BA-ZlDLeS",
        "Title": "Why This One 'Hack' Hits So Much Harder",
        "Status": "Published",
        "Release Date": "2026-08-10"
      }
    }
  ],
  "count": 1,
  "offset": null
}
```

- `rows` is the list of matching episodes.
- `id` is the Airtable record id, and `ID` (inside `fields`) is the short episode id. Either can be given to `get_episode`.
- `fields` holds the episode's fields. If you passed `fields`, only those are present.
- `offset` is `null` when there are no more rows. If it is a string, there are more rows: send the same request again with `"offset": "<that value>"` added.

### 2. `get_episode`

Returns a single episode. Identify it by its short id (`BA-...`) or its Airtable record id (`rec...`).

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `action` | string | yes | `"get_episode"` |
| `recordId` | string | yes | The episode's `BA-...` id (e.g. `BA-ZlDLeS`), or the `rec...` id from `list_episodes`. You can also send it as `episodeId` or `id`. |
| `fields` | array | no | Return only these fields. |

```bash
curl -X POST https://vmi3181229.contaboserver.net/webhook/api \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"get_episode","recordId":"BA-ZlDLeS","fields":["ID","Title"]}'
```

Response shape is the same, with one row:

```json
{ "rows": [ { "id": "rec0plfrxGLZlDLeS", "createdTime": "...", "fields": { "ID": "BA-ZlDLeS", "Title": "..." } } ], "count": 1 }
```

If the id is well formed but no episode matches, you get `200` and an empty list: `{ "rows": [], "count": 0 }`.

## Errors

| HTTP | Body | Meaning |
|---|---|---|
| 200 | `{ "rows": [...] }` | Success |
| 401 | `{ "error": "unauthorized" }` | Your API key is missing, wrong, or has been revoked |
| 400 | `{ "error": "unknown action", "action": "..." }` | `action` was not `list_episodes` or `get_episode` |
| 400 | `{ "error": "bad_request", "detail": "..." }` | The query was invalid (for example a bad `filterByFormula` or `recordId`) |

## Episodes fields

You can request any of these with `fields`, or just read whatever comes back. Field names are case-sensitive.

| Field | Type | Notes |
|---|---|---|
| `ID` | text | The short id, e.g. `BA-ZlDLeS`. |
| `Title` | text | Episode title. |
| `Type` | select | `Take`, `Chat`, `Roundtable`, `Clip`, `2 Sats`, `Read`, `Audionauts`. |
| `Status` | select | Pipeline status, e.g. `Published`. |
| `Summary` | text | Episode description/summary. |
| `Chapters` | text | Human-readable chapter list. |
| `Transcript` | text | Full transcript (large). |
| `Script` | text | Script (internal, large). |
| `Release Date` | date | `YYYY-MM-DD`. |
| `Record Date` | date/time | Confirmed recording slot. |
| `Duration (s)` | number | Duration in seconds. |
| `Frame.io URL` | url | Link to the video cut. |
| `Guests` | linked records | Record ids of linked guests. |
| `Guest Name` | lookup | Guest name(s) as text. |
| `Thumbnail Caption` | text | Artwork headline. |
| `Notes` | text | Internal notes. |
| `Attachments` | attachments | Files attached to the episode. |
| `Last Modified Time` | date/time | When the row last changed. |

(The table also has some internal-only fields such as `Custom Image Prompt`, `Thumbnail Moods`, and `Calendly Event Type URI`; they are readable but not useful to you.)

## Good to know

- **Read-only.** There is no way to add, change, or delete anything through this API.
- **Only the Episodes table** is reachable. Other tables cannot be accessed.
- **To look one episode up**, use its `BA-...` id. It is the `ID` value in every row from `list_episodes`.
- `filterByFormula` uses Airtable's formula syntax with field names in curly braces, e.g. `{Type}="Chat"` or `{Status}="Published"`. On a formula error you get a `bad_request` response, not a crash.
- **At most 100 rows per request.** Use `offset` to page through everything.
- Be gentle with the number of requests (it is fine for normal use, just do not loop fast).
- **Keep your API key secret.** If it ever leaks, tell us and we will revoke it and issue a new one.
