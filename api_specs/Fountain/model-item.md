# Item

_An item in a feed you host._

An entry in a feed you host — the editable record behind a public [Episode](/docs/models/content-hit.md). Editing an item is how you edit the episode listeners see. The media fields are enclosure URLs. To publish, an item needs a `title` and default audio.

## Fields

- `id` (string, required) — Hosting ID — used everywhere in this API.
- `fountain_id` (string, optional) — Public Fountain Episode ID; absent until the item is published. Read-only.
- `title` (string, optional) — Item title.
- `description` (string, optional) — Item description, as Markdown.
- `season_number` (number, optional) — Season number.
- `item_number` (number, optional) — Item number within the season.
- `links` (string[], required) — Associated links, each a URL. Max 3.
- `explicit` (boolean, required) — Whether the item is marked explicit.
- `status` ([ItemStatus](/docs/models/item-status.md), required) — The publishing state of the item.
- `image` (string, optional) — Cover artwork URL.
- `audio_default` (string, optional) — Default (free) audio enclosure URL.
- `audio_paid` (string, optional) — Subscriber-only (paid) audio enclosure URL.
- `video_default` (string, optional) — Default (free) video enclosure URL (HLS playlist).
- `video_paid` (string, optional) — Subscriber-only (paid) video enclosure URL (HLS playlist).
- `bonus` (boolean, required) — Whether the item is subscriber-only (a monetization variant flag).
- `adfree` (boolean, required) — Whether a paid ad-free version is offered (regular items).
- `early_access` (boolean, required) — Whether a paid early-access version is offered (regular items).
- `early_access_days` (number, optional) — Early-access window length in days.
- `scheduled` (string, optional) — ISO-8601 scheduled release time. Read-only.
- `published` (string, optional) — ISO-8601 publish time. Read-only.
- `general_release` (string, optional) — ISO-8601 general release (`published` + `early_access_days`). Read-only.
- `updated` (string, required) — ISO-8601 timestamp of the last update.

## Example

```json
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
```
