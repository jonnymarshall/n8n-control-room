# Media

_A tracked media upload._

A `Media` record tracks a single upload through its lifecycle. Poll it until `status` is `READY`, then attach its `id` to a feed or item (as `image_id`, `audio_default_id`, `audio_paid_id`, `video_default_id` or `video_paid_id`).

## Fields

- `id` (string, required) — Unique upload identifier; use it to attach the media.
- `kind` ([MediaKind](/docs/models/media-kind.md), required) — The kind of media.
- `status` ([MediaStatus](/docs/models/media-status.md), required) — The processing state.
- `preview_url` (string, optional) — URL to preview the processed media, when ready.
- `metadata` ([AudioMetadata](/docs/models/audio-metadata.md), optional) — ID3 tags read from `ITEM_AUDIO` uploads, once `READY`; absent for other types or untagged files.
- `error` (string, optional) — Failure reason, when `status` is `ERROR`.

## Example

```json
{
  "id": "6f1a2b3c-4d5e-6f70-8901-23456789abcd",
  "kind": "ITEM_AUDIO",
  "status": "READY",
  "preview_url": "https://media.fountain.fm/episodes/e5f6g7h8/audio.mp3"
}
```
