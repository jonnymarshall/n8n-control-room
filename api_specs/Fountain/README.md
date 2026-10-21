# Fountain Publishing API Reference

Local copies of the Fountain API documentation needed for the episode
publishing workflow. Downloaded from `https://fountain.fm/docs/*.md` on
2026-09-17.

## Authentication

- `getting-started.md`

## Feeds and items

- `list-feeds.md`
- `load-feed.md`
- `update-feed.md`
- `load-feed-stats.md`
- `list-items.md`
- `create-item.md`
- `load-item.md`
- `update-item.md`
- `delete-item.md`
- `publish-item.md`
- `schedule-item.md`
- `load-item-stats.md`

## Uploads

- `create-upload.md`
- `load-upload.md`
- `finalize-upload.md`

## Models

- `model-feed.md`
- `model-item.md`
- `model-item-status.md`
- `model-media.md`
- `model-media-kind.md`
- `model-media-status.md`
- `model-podcast-category.md`

## Fountain episode upload sequence

1. Find and store the show's permanent `feed_id` with `GET /feeds`.
2. Create a draft item with `POST /feeds/{feed_id}/items`.
3. Download the Frame.io video and inspect its MIME type and byte length.
4. Start an `ITEM_VIDEO` upload for the draft item.
5. Split the video using the returned `part_size` and PUT each part to the
   corresponding presigned URL.
6. Finalize the upload and poll it until it reaches `READY` or `ERROR`.
7. Repeat the upload process for the selected 1x1 thumbnail as `ITEM_IMAGE`.
8. Patch the item with its title, Markdown description, `video_default_id`,
   `image_id`, and other episode settings. Attaching the video also attaches
   Fountain's extracted audio to the default slot.
9. Schedule the item with a future ISO-8601 timestamp.

The documented upload API does not accept a remote media URL. The workflow must
transfer the Frame.io file bytes to Fountain's presigned multipart URLs.
