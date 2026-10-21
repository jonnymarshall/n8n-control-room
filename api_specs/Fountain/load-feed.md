# Load Feed

> `GET https://api.fountain.fm/v1/feeds/{feed_id}`

Load a single feed by ID.

## Path parameters

- `feed_id` (string, required) — The feed to read.

## Responses

### 200 — The feed.

- `feed` ([Feed](/docs/models/feed.md), required) — The feed.

```json
{
  "ok": true,
  "feed": {
    "id": "a1b2c3d4",
    "fountain_id": "show:id:def456",
    "title": "Citadel Dispatch",
    "author": "ODELL",
    "description": "Freedom tech and Bitcoin, live and unedited.",
    "categories": [
      "Technology",
      "News"
    ],
    "explicit": false,
    "display_email": false,
    "links": [
      "https://citadeldispatch.com"
    ],
    "image": "https://media.fountain.fm/shows/a1b2c3d4/cover.jpg",
    "vocabulary": [
      "Nostr",
      "sats"
    ],
    "rss_url": "https://feeds.fountain.fm/a1b2c3d4",
    "updated": "2026-02-18T22:03:53.467Z"
  }
}
```

## Example

```bash
curl -X GET "https://api.fountain.fm/v1/feeds/{feed_id}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
