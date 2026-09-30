# Update Item

> `PATCH https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}`

Edit an item. The body *is* the patch: a value sets the field, `null` clears it, an absent key leaves it unchanged. The `*_id` fields attach `READY` uploads of the matching type: a `*_paid_id` upload must have been created with `access: "PAID"`, a `*_default_id` with `access: "DEFAULT"`. Attaching a video also uses its extracted audio for the *same* slot unless that slot's audio is already set. Enabling any paid feature needs `audio_paid_id` and prices a one-time product at `price_usd_cents` (defaults to `100` on first enable). The monetization variant is locked once the item is `PUBLISHED`, and a published item's required media can't be cleared.

## Path parameters

- `feed_id` (string, required) — The feed the item belongs to.
- `item_id` (string, required) — The item to edit.

## Request body

- `title` (string, optional) — Item title. Cannot be cleared.
- `description` (string | null, optional) — Item description (Markdown, ≤10,000 chars when converted to HTML).
- `season_number` (number | null, optional) — Season number.
- `item_number` (number | null, optional) — Item number within the season.
- `links` (string[] | null, optional) — Associated links, each a URL. Max 3.
- `explicit` (boolean | null, optional) — Whether the item is marked explicit.
- `audio_default_id` (string | null, optional) — A READY `ITEM_AUDIO` upload id (free/default audio).
- `audio_paid_id` (string | null, optional) — A READY `ITEM_AUDIO` upload id (subscriber-only/paid audio).
- `video_default_id` (string | null, optional) — A READY `ITEM_VIDEO` upload id (free/default video).
- `video_paid_id` (string | null, optional) — A READY `ITEM_VIDEO` upload id (subscriber-only/paid video).
- `image_id` (string | null, optional) — A READY `ITEM_IMAGE` upload id (artwork).
- `bonus` (boolean, optional) — Make the item subscriber-only. The variant is locked once published.
- `adfree` (boolean, optional) — Gate an ad-free paid version (regular items only).
- `early_access` (boolean, optional) — Gate an early-access paid version (regular items only).
- `early_access_days` (number, optional) — Early-access window length in days (positive integer).
- `price_usd_cents` (number, optional) — Paid-version price in USD cents. Defaults to 100 on first enable.

```json
{
  "title": "The Genesis Block",
  "audio_default_id": "6f1a2b3c-4d5e-6f70-8901-23456789abcd"
}
```

## Responses

### 200 — The updated item.

- `item` ([Item](/docs/models/item.md), required) — The updated item.

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
    "status": "PUBLISHED",
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
curl -X PATCH "https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"The Genesis Block","audio_default_id":"6f1a2b3c-4d5e-6f70-8901-23456789abcd"}'
```
