# List Feeds

> `GET https://api.fountain.fm/v1/feeds`

List every feed you can access.

## Responses

### 200 — Your feeds.

- `feeds` ([Feed](/docs/models/feed.md)[], required) — The feeds you host.

```json
{
  "ok": true,
  "feeds": [
    {
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
  ]
}
```

## Example

```bash
curl -X GET "https://api.fountain.fm/v1/feeds" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
