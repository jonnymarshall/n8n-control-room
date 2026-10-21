# MediaStatus

_The processing state of a media upload._

## Values

- `PENDING` — Initialised, awaiting upload and finalize.
- `PROCESSING` — Finalized; the server is processing the media.
- `READY` — Processed media is ready to attach.
- `ERROR` — Processing failed (see `error`).

## Example

```json
READY
```
