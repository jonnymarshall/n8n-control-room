# Feed

_A podcast feed you host._

A podcast feed you host on Fountain — the editable record behind a public [Show](/docs/models/content-hit.md). Editing a feed is how you edit the show listeners see. To publish, a feed needs `title`, `author`, `description`, `image` and at least one category.

## Fields

- `id` (string, required) — Hosting ID — used everywhere in this API.
- `fountain_id` (string, optional) — Public Fountain Show ID; absent until the feed is published. Read-only.
- `title` (string, optional) — Feed title.
- `author` (string, optional) — Feed author.
- `description` (string, optional) — Feed description.
- `categories` ([PodcastCategory](/docs/models/podcast-category.md)[], required) — The categories the feed is listed under, e.g. `Technology`. Max 3.
- `explicit` (boolean, required) — Whether the feed is marked explicit.
- `display_email` (boolean, required) — Whether the owner email is shown publicly in the feed.
- `links` (string[], required) — Associated links, each a URL.
- `image` (string, optional) — Cover artwork URL.
- `vocabulary` (string[], required) — Custom terms that bias the AI transcriber, e.g. proper nouns. ≤224-token capacity.
- `rss_url` (string, required) — The public RSS feed URL.
- `updated` (string, required) — ISO-8601 timestamp of the last update.

## Example

```json
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
```
