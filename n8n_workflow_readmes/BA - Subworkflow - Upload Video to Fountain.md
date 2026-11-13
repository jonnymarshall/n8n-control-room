# BA - Subworkflow - Upload Video to Fountain

> **Find this workflow in n8n by name.** Workflow IDs change when a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `XY4WfJ2XaBA9bPKY`.) Created 2026-10-29, extracted from the publisher's upload chain.

Uploads one video to Fountain, end to end, and hands back the upload id. **It never schedules, never PATCHes the item, and never touches Airtable status** beyond recording the upload id. Callers decide what to do with the result.

## Why it exists

A 4.84 GB master takes about 80 minutes through the part uploader. Any workflow that calls it inline dies at its execution timeout (the content sync is capped at 15 minutes). Running it as a sub-workflow means the long work has its own execution clock, while the caller records the outcome.

SDK source: `scripts/deploy/workflows/guys-take-fountain-upload-video.sdk.js`.

## Input (one item from `Execute Workflow`)

| Field | Meaning |
|---|---|
| `publicationRecordId` | the `Publications` row to stamp with `Video Upload ID` |
| `itemId` | the Fountain item (feed item) the video belongs to |
| `feedId` | the Fountain feed |
| `videoUrl` | the episode's `Frame.io URL` (any form; the file id is taken from the last path segment) |

## Output

`{ uploadId, mediaId, status, videoBytes, videoType }`.

## Flow

```
Input → Resolve Frame.io Media → Probe Frame.io Video → Validate Video
      → Start Fountain Video Upload → Build Video Part Jobs → Upload Fountain Video Parts
      → Confirm Video Parts Uploaded → Save Video Upload ID → Finalize Fountain Video
      → Wait for Fountain Video → Get Fountain Video Status
          → Fountain Video Error (status ERROR) → Stop on Video Error (throws)
          → Fountain Video Ready (status READY) → Return Video Upload
                            └─ not ready → back to Wait for Fountain Video
```

1. **Resolve Frame.io Media** — `GET /v4/accounts/{acct}/files/{id}?include=media_links.efficient,media_links.original,media_links.high_quality` with `Adobe OAuth`. The id is parsed from `videoUrl`, so the caller never has to know Frame.io's object ids.
2. **Probe Renditions** — one 1 MB `Range` request per copy for the true total (`Content-Range`), MIME type, and width/height from the `moov`/`tkhd` atom. Do not use `HEAD` here: the `stream-download.frame.io` copies answer `HEAD` with 18 bytes of `text/plain` and only report the real size to a `Range` GET.
3. **Choose Source** — the smallest copy at 1920x1080, else the smallest at 1280x720, else it throws with everything it measured. Since 2026-11-04 the master is not uploaded when a 1080p copy exists, and nothing measured below 720p is ever uploaded. `Note Upload Started` then writes the choice (rendition, resolution, size) into `Publications.Notes`.
4. **Start Fountain Video Upload** — `POST /v1/uploads` (`kind: ITEM_VIDEO`, `access: DEFAULT`).
5. **Build Video Part Jobs** — one item per multipart URL. Each carries a shell command that fetches that byte range from Frame.io and `PUT`s it to Fountain, with 20 attempts and exponential backoff. This node is copied verbatim from the publisher, which is the tested implementation.
6. **Upload Fountain Video Parts** — `Execute Command`, one process per part. Runs on the n8n host, so it needs `node` on PATH and outbound access to both Frame.io and Fountain.
7. **Save Video Upload ID** — `Publications.Video Upload ID` + `Status = Processing`. `onError: continueRegularOutput`, so bookkeeping cannot kill an upload that is already running.
8. **Finalize → poll** — `POST /uploads/{id}/finalize`, then poll `GET /uploads/{id}` every 30 seconds until `media.status` is `READY` or `ERROR`. `ERROR` throws with Fountain's own message.

## Swapping the video on an existing item (the part callers need)

The publisher's `Update Fountain Item` PATCHes the item with:

```
{ title, description, explicit, video_default_id: <upload id>, image_id: <artwork upload id> }
```

So a content sync that re-uploads a newer cut uploads it here, then PATCHes **only** `video_default_id` on the existing item. No draft recreation, no republish. This was confirmed against the live publisher node, not guessed.

## Gotchas

- **Nothing here is idempotent.** Each call creates a new Fountain upload. Callers must record `Video Upload ID` before starting another, or a retry will leave orphaned media on Fountain.
- **The part uploader is a shell process per part.** A large file means dozens of processes; that is normal, and the Confirm node fails the run if any part did not complete.
- **`Save Video Upload ID` needs a real `publicationRecordId`.** With an empty one Airtable rejects the write, which is why the node is `continueRegularOutput`; the upload still completes and the caller still gets the id back.
- **Artwork is not here.** The publisher uploads square artwork separately (`Fountain Video` and `Artwork` chains are distinct); a video-only re-sync leaves the existing artwork alone.
