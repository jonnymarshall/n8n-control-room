# Update Feed

> `PATCH https://api.fountain.fm/v1/feeds/{feed_id}`

Edit a feed. The body *is* the patch: a value sets the field, `null` clears it, an absent key leaves it unchanged. `image_id` is a `READY` `FEED_IMAGE` upload (see [Start Upload](/docs/endpoints/uploads/create-upload.md)). On a published feed, a required field (`title`, `author`, `description`, `image_id`, `categories`) can't be cleared.

## Path parameters

- `feed_id` (string, required) — The feed to edit.

## Request body

- `title` (string | null, optional) — Feed title.
- `author` (string | null, optional) — Feed author.
- `description` (string | null, optional) — Feed description.
- `explicit` (boolean | null, optional) — Whether the feed is marked explicit.
- `display_email` (boolean | null, optional) — Whether the owner email is shown in the feed.
- `categories` ([PodcastCategory](/docs/models/podcast-category.md)[] | null, optional) — The categories the feed is listed under. Max 3.
- `links` (string[] | null, optional) — Associated links, each a URL.
- `vocabulary` (string[] | null, optional) — AI transcriber terms. ≤224-token capacity.
- `image_id` (string | null, optional) — A READY `FEED_IMAGE` upload id.

```json
{
  "title": "Citadel Dispatch",
  "categories": [
    "Technology",
    "News"
  ],
  "explicit": false
}
```

## Responses

### 200 — The updated feed.

- `feed` ([Feed](/docs/models/feed.md), required) — The updated feed.

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
curl -X PATCH "https://api.fountain.fm/v1/feeds/{feed_id}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Citadel Dispatch","categories":["Technology","News"],"explicit":false}'
```
