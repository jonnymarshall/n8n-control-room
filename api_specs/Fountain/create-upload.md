# Start Upload

> `POST https://api.fountain.fm/v1/uploads`

Start a media upload. Returns presigned URLs (one per part) plus `part_size`: split the file into `part_size`-byte chunks and PUT chunk *i* to `upload.urls[i]` (the last may be smaller; small files come back as a single URL). Then [finalize](/docs/endpoints/uploads/finalize-upload.md) and poll until `READY`.

## Request body

A discriminated union on `kind`, shared by the Publishing and Social APIs. The example shows an item audio upload. `SOCIAL_POST_VIDEO` uploads take only `kind`, `content_type` and `num_bytes` — attach the result to a post as `upload_id` via [Update Social Post](/docs/endpoints/social/update-social-post.md).

- `kind` ([MediaKind](/docs/models/media-kind.md), required) — The kind of media to upload.
- `feed_id` (string, optional) — The target feed. Required for `FEED_*` and `ITEM_*` kinds; omit for `SOCIAL_POST_VIDEO`.
- `item_id` (string, optional) — The target item (required for all `ITEM_*` kinds).
- `content_type` (string, required) — The file MIME type. Image: `image/jpeg`, `image/png`, `image/webp`. Audio: `audio/mpeg`, `audio/m4a`, `audio/x-m4a`. Video (`ITEM_VIDEO`, `SOCIAL_POST_VIDEO`): `video/mp4`, `video/quicktime`, `video/webm`.
- `access` ('DEFAULT' | 'PAID', optional) — For `ITEM_AUDIO`/`ITEM_VIDEO`: which slot the upload can later attach to — `DEFAULT` (free) or `PAID` (subscriber-only). Defaults to `DEFAULT`.
- `num_bytes` (number, required) — File size in bytes. Max: image 10 MB, audio 400 MB, item video 20 GB, social video 16 GB.

```json
{
  "kind": "ITEM_AUDIO",
  "feed_id": "a1b2c3d4",
  "item_id": "e5f6g7h8",
  "content_type": "audio/mpeg",
  "num_bytes": 48218112
}
```

## Responses

### 200 — The upload was started.

- `media` ([Media](/docs/models/media.md), required) — The tracked upload (status `PENDING`).
- `upload` (object, required) — The presigned multipart upload.
  - `urls` (string[], required) — Ordered presigned part URLs; PUT each chunk to its URL.
  - `part_size` (number, required) — The chunk size in bytes (except a possibly smaller last part).

```json
{
  "ok": true,
  "media": {
    "id": "6f1a2b3c-4d5e-6f70-8901-23456789abcd",
    "kind": "ITEM_AUDIO",
    "status": "PENDING"
  },
  "upload": {
    "urls": [
      "https://r2.fountain.fm/uploads/6f1a2b3c/part-1?...",
      "https://r2.fountain.fm/uploads/6f1a2b3c/part-2?..."
    ],
    "part_size": 100000000
  }
}
```

## Example

```bash
curl -X POST "https://api.fountain.fm/v1/uploads" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"kind":"ITEM_AUDIO","feed_id":"a1b2c3d4","item_id":"e5f6g7h8","content_type":"audio/mpeg","num_bytes":48218112}'
```
