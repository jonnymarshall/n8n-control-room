# Schedule Item

> `POST https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}/schedule`

Schedule an item, from `DRAFT` or `SCHEDULED`: its status becomes `SCHEDULED` and it is released automatically at `scheduled`. Requires a title and default audio.

## Path parameters

- `feed_id` (string, required) — The feed the item belongs to.
- `item_id` (string, required) — The item to schedule.

## Request body

- `scheduled` (string, required) — A future ISO-8601 instant, e.g. `2026-07-01T09:00:00Z`.

```json
{
  "scheduled": "2026-07-01T09:00:00Z"
}
```

## Responses

### 200 — The scheduled item.

- `item` ([Item](/docs/models/item.md), required) — The scheduled item.

```json
{
  "ok": true,
  "item": {
    "id": "e5f6g7h8",
    "fountain_id": "episode:id:abc123",
    "title": "The Genesis Block",
    "description": "We dig into the **first block** ever mined.",
    "season_number": 2,
    "item_number": 14,
    "links": [
      "https://citadeldispatch.com/cd141"
    ],
    "explicit": false,
    "status": "SCHEDULED",
    "image": "https://media.fountain.fm/episodes/e5f6g7h8/cover.jpg",
    "audio_default": "https://media.fountain.fm/episodes/e5f6g7h8/audio.mp3",
    "bonus": false,
    "adfree": false,
    "early_access": false,
    "published": "2026-02-18T22:03:53.467Z",
    "updated": "2026-02-18T22:03:53.467Z"
  }
}
```

## Example

```bash
curl -X POST "https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}/schedule" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scheduled":"2026-07-01T09:00:00Z"}'
```
