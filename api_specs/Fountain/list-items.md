# List Items

> `GET https://api.fountain.fm/v1/feeds/{feed_id}/items`

List a feed's items, newest first, up to 100 per page. Pass the returned `next_cursor` back as `?cursor=` for the next page; when it is absent, you have reached the last page.

## Path parameters

- `feed_id` (string, required) — The feed whose items to list.

## Query parameters

- `cursor` (string, optional) — A `next_cursor` from a previous page. Omit for the first page.

## Responses

### 200 — A page of items.

- `items` ([Item](/docs/models/item.md)[], required) — The items.
- `next_cursor` (string, optional) — Pass back as `?cursor=` for the next page. Absent on the last page.

```json
{
  "ok": true,
  "items": [
    {
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
      "status": "PUBLISHED",
      "image": "https://media.fountain.fm/episodes/e5f6g7h8/cover.jpg",
      "audio_default": "https://media.fountain.fm/episodes/e5f6g7h8/audio.mp3",
      "bonus": false,
      "adfree": false,
      "early_access": false,
      "published": "2026-02-18T22:03:53.467Z",
      "updated": "2026-02-18T22:03:53.467Z"
    }
  ],
  "next_cursor": "eyJpZCI6ImU1ZjZnN2g4In0"
}
```

## Example

```bash
curl -X GET "https://api.fountain.fm/v1/feeds/{feed_id}/items" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
