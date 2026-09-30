# Finalize Upload

> `POST https://api.fountain.fm/v1/uploads/{id}/finalize`

Call once every chunk has been PUT; processing then begins. Returns `MEDIA_NOT_READY` (409) if not every part has landed yet. Images and audio finish in seconds; video is transcoded to HLS and can take minutes — poll [Get Upload](/docs/endpoints/uploads/load-upload.md) until `READY`. A `SOCIAL_POST_VIDEO` upload needs no processing and is `READY` as soon as it is finalized.

## Path parameters

- `id` (string, required) — The upload to finalize.

## Responses

### 200 — Processing has begun.

- `media` ([Media](/docs/models/media.md), required) — The upload (status `PROCESSING`, or `READY` for a `SOCIAL_POST_VIDEO`).

```json
{
  "ok": true,
  "media": {
    "id": "6f1a2b3c-4d5e-6f70-8901-23456789abcd",
    "kind": "ITEM_AUDIO",
    "status": "PROCESSING"
  }
}
```

## Example

```bash
curl -X POST "https://api.fountain.fm/v1/uploads/{id}/finalize" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
