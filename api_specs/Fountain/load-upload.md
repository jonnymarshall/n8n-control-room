# Get Upload

> `GET https://api.fountain.fm/v1/uploads/{id}`

Poll an upload until its `status` is `READY` — then attach its id as `image_id`, `audio_default_id`, `audio_paid_id`, `video_default_id` or `video_paid_id` — or `ERROR`. Transcription runs separately after `READY` and does not block attaching the media.

## Path parameters

- `id` (string, required) — The upload to poll.

## Responses

### 200 — The upload.

- `media` ([Media](/docs/models/media.md), required) — The upload.

```json
{
  "ok": true,
  "media": {
    "id": "6f1a2b3c-4d5e-6f70-8901-23456789abcd",
    "kind": "ITEM_AUDIO",
    "status": "READY",
    "preview_url": "https://media.fountain.fm/episodes/e5f6g7h8/audio.mp3"
  }
}
```

## Example

```bash
curl -X GET "https://api.fountain.fm/v1/uploads/{id}" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
