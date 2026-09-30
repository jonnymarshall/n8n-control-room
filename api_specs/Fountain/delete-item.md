# Delete Item

> `DELETE https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}`

Soft-delete an item: its status becomes `DELETED` and it is removed from the feed.

## Path parameters

- `feed_id` (string, required) — The feed the item belongs to.
- `item_id` (string, required) — The item to delete.

## Responses

### 200 — The deleted item.

- `item` ([Item](/docs/models/item.md), required) — The deleted item.

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
    "status": "DELETED",
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
curl -X DELETE "https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
