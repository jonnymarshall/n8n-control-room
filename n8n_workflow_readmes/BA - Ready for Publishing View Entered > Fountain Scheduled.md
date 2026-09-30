# BA - Ready for Publishing View Entered > Fountain Scheduled

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `LTmRVKn9TWJd6Gtk`.

Local SDK source: `scripts/deploy/workflows/guys-take-fountain-publishing.sdk.js`

Live state as of 2026-09-29: **active**, version `84570af3-fd51-402c-acf2-a3675e65a5d1` (version counter 9, and the published/active version). The local source mirrors live: the `FOUNTAIN_API_KEY` bearer binding on all nine Fountain HTTP nodes, a `Resolve Frame.io Media` step that exchanges the Episode `Frame.io URL` for a fresh signed download URL via the Frame.io API, per-part uploads via inline Node scripts, and a guard that starts only when no Publication exists or its status is `Pending`.

---

## Purpose

This workflow publishes a ready Guy's Take episode to Fountain as a scheduled video podcast item. It:

1. Claims the Episode by changing its status to `Publishing`.
2. Creates or resumes one Fountain row in `Publications`.
3. Validates the episode metadata, media URLs, media sizes, and Fountain settings.
4. Creates or reuses a Fountain draft item.
5. Streams the video and square artwork to Fountain using multipart uploads.
6. Waits for Fountain to process both uploads.
7. Updates and schedules the Fountain item.
8. Marks the Publication and Episode `Scheduled` and notifies the team.
9. Records failures in Airtable and sends a recovery message to Telegram.

The workflow is guarded and resumable through the `Publications` row. It does not blindly create a new Fountain item on every run.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `LTmRVKn9TWJd6Gtk` |
| Trigger | Airtable Trigger, once per minute |
| Airtable base | Guy's Take, `app8Xw9Tq0XLjhmp9` |
| Trigger table | Episodes, `tbl3uYLIvtB9APZp6` |
| Trigger view | `viwDfPHHKrgggdw20` |
| Trigger field | `Last Modified Time` (`fld3Z4xdI4s2wVnLa`) |
| Trigger Fields list | Empty, so the whole record is returned |
| Success transition | Episode `Publishing` to `Scheduled`; Fountain Publication to `Scheduled` |
| Failure transition | Episode to `Publishing Failed`; Fountain Publication to `Failed` |
| Notification destination | Telegram team group `-5254203539` |
| Workflow timezone | `America/New_York` |
| Execution timeout | 43,200 seconds (12 hours) |
| Error workflow | `Pod21: Workflow Failed > Telegram Alert`, `9PMI1kuBjLW2YHwb` |
| Execution data | Save successful, failed, and manual executions; save execution progress |

### Trigger behavior

The Airtable poller checks the trigger view every minute using `Last Modified Time`. A record must newly enter the view or have a later modification time than the poller's stored cursor. Merely leaving an old row in the view does not make it a dependable test.

`Claim Episode as Publishing` runs first and changes `Status` to `Publishing`, which should remove the record from the ready view before any long upload starts. The exact filters on view `viwDfPHHKrgggdw20` are managed in Airtable and are not exposed by the Airtable API used for this snapshot. Verify in the Airtable UI that the view selects only complete episodes intended for publishing and excludes `Publishing`, `Scheduled`, and `Publishing Failed`.

---

## Credentials

| Credential | Live reference | Used by | Push behavior |
|---|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi`, live credential ID `04Sw0cnSlBkB6Y3s` | Airtable trigger and every Airtable HTTP request | The trigger reference is expected to resolve by name. Rebind every Airtable HTTP Request node after a push. |
| `FOUNTAIN_API_KEY` | `httpBearerAuth`, live credential ID `5zWdDTc3e6SFgBVb` | Every request to `api.fountain.fm` | Bound in the live draft. Rebind every Fountain HTTP Request node after an SDK push. |
| `Adobe OAuth` | `oAuth2Api`, live credential ID `1rXdRm0N6eNzG5cV` | `Resolve Frame.io Media` | Bound in the live draft via `genericAuthType: oAuth2Api`. Rebind this HTTP Request node after an SDK push. |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi`, live credential ID `INjDc84OskDdqiNR` | `Notify Fountain Scheduled`, `Notify Fountain Failure` | Expected to resolve by name, but verify after a push. |

The Fountain nodes that need the bearer credential are:

- `Create Fountain Draft`
- `Start Fountain Video Upload`
- `Finalize Fountain Video`
- `Get Fountain Video Status`
- `Start Fountain Artwork Upload`
- `Finalize Fountain Artwork`
- `Get Fountain Artwork Status`
- `Update Fountain Item`
- `Schedule Fountain Item`

`Probe Frame.io Video` HEAD-checks the signed Frame.io download URL that `Resolve Frame.io Media` returned, and `Probe Square Artwork` HEAD-checks the signed Airtable attachment URL. Neither carries a credential — the signing is already in the URL. `Resolve Frame.io Media` itself uses the `Adobe OAuth` credential to call the Frame.io API.

---

## Configuration prerequisites

### n8n host

- Execute Command must be enabled. n8n blocks it by default; this instance re-enables it with `NODES_EXCLUDE: "[]"` in `/opt/n8n/docker-compose.override.yml` on the n8n host.
- The uploads run as a `node -e` script via Execute Command. Node is already present in the n8n image. `bash` and `curl` are **not** required and are absent from this instance's hardened Alpine image.
- The host must be able to reach Airtable, the signed Frame.io and Airtable attachment URLs, Fountain, and Telegram.
- The 12-hour workflow timeout must remain long enough for upload retries and Fountain processing.
- The global error workflow `9PMI1kuBjLW2YHwb` must still exist and be available.

### Fountain

- The `FOUNTAIN_API_KEY` n8n `httpBearerAuth` credential must remain bound to all nine Fountain HTTP nodes listed above.
- `Publishing Settings` must contain exactly one usable row where `Platform = Fountain`.
- That row must have `Enabled` checked, plus `Feed ID`, `Default Publish Time`, and `Time Zone`.
- `Default Publish Time` must be 24-hour `HH:mm`, for example `09:00`.
- `Time Zone` must be an IANA timezone, for example `America/New_York`.
- The resulting combination of Episode `Release Date`, publish time, and timezone must be in the future.

### Frame.io

- The `Adobe OAuth` (`oAuth2Api`) credential must be bound to `Resolve Frame.io Media` and be able to read the project's files.
- `Frame.io URL` must be a Frame.io app view link whose last path segment is the Frame.io file id (as written by the metadata workflow).

### Episode

The trigger record must provide:

- `ID`
- `Title`
- `Summary`
- `Chapters`
- `Release Date`
- `Frame.io URL`
- At least one linked `Thumbnails` row

The first linked Thumbnail row must contain a `1x1` attachment. The workflow uses that attachment's signed URL as Fountain artwork.

`Frame.io URL` is the stable **view link** (for example `https://next.frame.io/project/…/view/<file id>`), not a direct media URL — fetching it redirects to a Frame.io login page and returns HTML. `Resolve Frame.io Media` takes the last path segment as the Frame.io file id, calls `GET /v4/accounts/{account}/files/{fileId}?include=media_links.efficient,media_links.original` with the `Adobe OAuth` credential, and uses the returned signed `original.download_url` as the video source. That resolved mp4 is what `Probe Frame.io Video` then checks: it must respond to `HEAD` with a positive `Content-Length` and one of:

- `video/mp4`
- `video/quicktime`
- `video/webm`

Prefer `original`: it is a range-able CloudFront mp4. `efficient` is an HLS manifest (`stream-download.frame.io/manifest/hls?…`) and is only a last-resort fallback, not a byte-rangeable file.

The artwork URL must respond to `HEAD` with a positive `Content-Length` and one of:

- `image/jpeg`
- `image/png`
- `image/webp`

Limits enforced before upload:

- Video: 20 GB maximum
- Artwork: 10 MB maximum
- Formatted description: 9,000 characters maximum

### Airtable select values

The workflow writes Episode statuses `Publishing`, `Scheduled`, and `Publishing Failed`. At snapshot time, `Scheduled` exists but `Publishing` and `Publishing Failed` are not listed choices on `Episodes.Status`. Writes use `typecast: true`, which may create missing choices when the token has permission. Add those choices by hand if select-option creation is not intended or the PAT cannot create them.

`Publications.Platform` must include `Fountain`. `Publications.Status` must include:

- `Pending`
- `Uploading`
- `Processing`
- `Draft`
- `Scheduled`
- `Failed`
- `Needs Attention`

The table also currently includes `Published` and `Skipped`, although this workflow does not write them.

### Publishing links

`Build Fountain Plan` includes only rows where:

- `Active` is checked.
- `Destinations` is empty or contains `Episodes`.
- `Section` is `Affiliate` or `Host`.

Rows are sorted by `Sort Order` inside each section. The visible line uses `Description`, falling back to `Name`, followed by `(Link: <URL>)`.

---

## Airtable schema IDs

All Airtable IDs below were read from base `app8Xw9Tq0XLjhmp9` on 2026-09-24.

### Episodes, `tbl3uYLIvtB9APZp6`

| Field | ID | Type | Workflow use |
|---|---|---|---|
| ID | `fldYVimbhGfgFZF1X` | Formula | Publication key and Telegram record ID |
| Title | `fldVUH8a3zxuNqlo1` | Single line text | Fountain title and notifications |
| Type | `fldkNY2dTfo8Zogvx` | Single select | Present in table, unused here |
| Status | `fldUkNtr7lXG5s9DB` | Single select | Trigger view and state transitions |
| Thumbnail Caption | `fldWtYyNxKKgclKxx` | Long text | Present in table, unused here |
| Script | `fldzkcv5XYUdyRYHX` | Long text | Unused here |
| Record Date | `fldlApTtcwQFSH9Di` | Date/time | Unused here |
| Release Date | `fldRaEgYBr3rP5sYW` | Date | Schedule date |
| Frame.io URL | `fldRzA9UOwEsX3TS0` | URL | Video source |
| Duration (s) | `flda2xpBkQC305H2j` | Number | Unused here |
| Notes | `fld9CXC1cwX5gTNz6` | Long text | Unused here |
| Attachments | `fldnl7sNZ0KEHWxlQ` | Attachments | Unused here |
| Transcript | `flddv42SmcJ6Yzz8S` | Long text | Unused here |
| Associated Episode | `fldiLRt4JPdHXnp9P` | Linked records | Unused here |
| Guests | `fldgUhDfAUFDgkAE0` | Linked records | Unused here |
| Summary | `fldAyACQFJYUUUwQd` | Long text | Description opening |
| Chapters | `fldbkiZBf9qoIxZnJ` | Long text | Description chapters section |
| Chapters JSON | `fldCrDP5ob2QaKSaY` | Attachments | Unused here |
| Source Shortlist | `fldH2gP3skGco8ITg` | Linked records | Unused here |
| Thumbnails | `fldo2Hn8Ba1rSgtMa` | Linked records | Finds square artwork row |
| References | `fld5p3qxJaXCbgiVl` | Long text | Unused here |
| Guest Name | `fldwIGK5K4iJruTyB` | Lookup | Unused here |
| From field: Associated Episode | `fldKOG3QfqJoYoN9v` | Linked records | Unused here |
| Last Modified Time | `fld3Z4xdI4s2wVnLa` | Last modified time | Polling cursor |
| Custom Image Prompt | `fldLfivYx5VkPGISw` | Long text | Expected to be handled by the trigger view, not read directly |
| Thumbnail Moods | `fldujYetql7QhEWkR` | Long text | Unused here |
| Field 27 | `fldWJ1BkfLmafaKa9` | Single line text | Unused here |
| Publications | `fldthkujasRg2fbvm` | Linked records | Backlink created through `Publications.Episode` |

### Thumbnails, `tblkcASzE4DXlxokO`

| Field | ID | Type | Workflow use |
|---|---|---|---|
| Calculation | `fldtCLCwH8m9grgTK` | Formula | Primary display field |
| Name | `fldwPl9acEIOQwZFo` | Single line text | Unused here |
| Episode | `fldWmDqcQziRST31w` | Linked records | Existing relation |
| Mood | `fld5asM4sHKq9PUpo` | Linked records | Unused here |
| Mood (from Mood) | `fldgZWgV9mRE9e8gg` | Lookup | Unused here |
| Reference Photo (from Mood) | `fldTvRvETx3LO8HCh` | Lookup | Unused here |
| Caption | `fldHCnFnh7gRtDzrM` | Long text | Unused here |
| Option | `fldDqWXXnFiN1YdE3` | Number | Unused here |
| Status | `fldnDETY3KUqpAD3K` | Single select | Expected to be handled upstream |
| 16x9 | `fldpzaK3FTsRotKum` | Attachments | Unused here |
| 1x1 | `fld8yaAXNfQgH8YWj` | Attachments | Fountain artwork source |
| 9x16 | `fldVxMKGR8UH1lgxg` | Attachments | Unused here |
| Thumbnail References | `fldFLy10aBSM7aTsG` | Single line text | Unused here |
| Last Modified Time | `fldTeINYFW08400ea` | Last modified time | Unused here |
| Revision Brief | `fldxuTc0qe3gYL0Fz` | Long text | Unused here |
| Revision Targets | `fldCFNLu3bGmOiTqF` | Multiple select | Unused here |
| Episode Type | `fldjbnJYqcGTSvzz6` | Lookup | Unused here |

### Publishing Settings, `tblHj2gQ9qYhoQVuX`

| Field | ID | Type | Workflow use |
|---|---|---|---|
| Platform | `fldqWsXFyTLI7enkX` | Single line text | Finds the `Fountain` row |
| Enabled | `fldqAn6TnT0ukLGzH` | Checkbox | Required preflight flag |
| Feed ID | `fldWHpIt9d07SfBA0` | Single line text | Fountain feed ID |
| Default Publish Time | `fldlaWO6wMdhUdoBG` | Single line text | `HH:mm` schedule time |
| Time Zone | `fldqInIXz9VNGmqdI` | Single line text | IANA schedule timezone |
| Explicit | `fld9GB82PLzU5iOhd` | Checkbox | Fountain explicit flag |
| Upload Poll Seconds | `fld3nR0MbT7xfAnVH` | Number | Wait between video and artwork status polls |
| Upload Poll Limit | `fldwsudFsfsJT5xHB` | Number | **Not read by the live workflow** |
| Notes | `fld8bExGwu3BJbgW3` | Long text | Unused here |

Both media Wait nodes read `Upload Poll Seconds` from the Fountain settings row. An empty or zero value falls back to 30 seconds. Polling continues until Fountain returns `READY` or `ERROR`, or until the workflow reaches its 12-hour execution timeout. `Upload Poll Limit` is still not read and has no effect.

### Publishing Links, `tbl1xX0XpGeTfHMYc`

| Field | ID | Type | Workflow use |
|---|---|---|---|
| Name | `fld1M3NOzoHPFldpM` | Single line text | Description fallback label |
| Section | `fldKMjY0ZEjxm0hua` | Single select | `Affiliate` or `Host` section |
| Description | `fldAiQVq2FBz1cRY9` | Long text | Visible link wording |
| URL | `fldaFTKieXnysiH3f` | URL | Destination URL |
| Sort Order | `fldlN43zEpgxTpldI` | Number | Order inside a section |
| Active | `fldASJ59YTyMZJS58` | Checkbox | Inclusion flag |
| Destinations | `fldOYxs7j7AcBOjkQ` | Multiple select | Empty or contains `Episodes` |

### Publications, `tbllWUvhNolvdk3uw`

| Field | ID | Type | Workflow use |
|---|---|---|---|
| Publication | `fldcjXb1d1TpvkWTx` | Single line text | Upsert key, `<episode ID> - Fountain` |
| Episode | `fldJ7QVLcIO5BhJ2x` | Linked records | Links the source Episode |
| Platform | `fld9X47mVyVdspI7N` | Single select | Set to `Fountain` |
| Status | `fldgy0g5MM9V5aIAZ` | Single select | Retry guard and progress state |
| Platform Item ID | `fld86v8eHpXH8hacd` | Single line text | Fountain draft item ID |
| Platform Content ID | `fld8G1AUpubm8tadC` | Single line text | Available for later publication tracking; unused here |
| Video Upload ID | `fldh367Wnk8eYq0yk` | Single line text | Fountain video media/upload ID |
| Artwork Upload ID | `fldt6fNhIuRe7rVpg` | Single line text | Fountain artwork media/upload ID |
| URL | `fldRTBcSyZlYPpwk1` | URL | Available for later public URL; unused here |
| Scheduled For | `fldKJG5EfiqCgNI0Y` | Date/time | Final UTC schedule time |
| Last Attempt | `fldbKXs7CKkTwFA1t` | Date/time | Start time of latest allowed attempt |
| Attempt Count | `fldwpnu5yD4uxtz0s` | Number | Incremented only when the guard allows a run |
| Error | `fldr0SWXElMD4ACu7` | Long text | Human-readable failure reason |
| Raw Error | `fldoGPYlKktedjgdC` | Long text | Serialized failing node output, capped at 9,000 characters |
| Retry Requested | `fldKdPeDpYzWcJcmZ` | Checkbox | Unused since 2026-09-29; safe to delete the column |
| Published At | `fldwJ1mUyo9ZJcanr` | Date/time | Unused until publication is confirmed later |
| Formatted Description | `fldtX0gp3BMbjdQc6` | Long text | Exact description prepared for Fountain |
| Source Fingerprint | `fldHTjSgkNAlHAjeY` | Single line text | Eight-character FNV-1a hash of source inputs |
| Notes | `fldIdviXvCb3NJYlQ` | Long text | Manual notes, unused here |

---

## Guard and retry design

### Publication guard

`Find Fountain Publication` looks up `<Episode.ID> - Fountain` with `Platform = Fountain`. `Guard Fountain Publication` allows work only when:

- No Publication row exists.
- Existing status is `Pending`.

All other states are blocked at `Should Run Fountain`. This prevents duplicate work for `Uploading`, `Draft`, `Processing`, `Scheduled`, or `Published` rows, and it means a `Failed`/`Needs Attention` Publication never auto-retries: a failure is a terminal, human-attention state. There is no `Retry Requested` gate anymore; to retry, set the Publication `Status` back to `Pending` and move the episode back into the ready view.

Because the Episode was already claimed as `Publishing`, the false branch runs `Restore Guarded Episode Status`, which mirrors the Publication status: `Published` → `Published`, `Failed`/`Needs Attention` → `Publishing Failed`, anything else → `Scheduled`. This keeps a guarded no-op from leaving the Episode stuck in `Publishing` and avoids mislabelling a failed Publication as `Scheduled`.

When a run is allowed, `Upsert Fountain Publication`:

- Upserts on the unique `Publication` field.
- Sets status to `Uploading`.
- Increments `Attempt Count`.
- Writes `Last Attempt` in UTC.
- Clears `Error` and `Raw Error`.

If an existing `Platform Item ID` is present, `Has Fountain Item ID` reuses the Fountain draft instead of creating another one.

### n8n Retry On Fail

The following repeat-safe Airtable and read/status operations retry 5 times with 5 seconds between attempts:

- Claim Episode, find Publication, upsert Publication
- Fetch settings, publishing links, and square artwork
- Save plan, persist item ID, save upload IDs
- Mark Publication scheduled, mark Episode scheduled
- Mark Publication failed, mark Episode failed, restore a guarded Episode status
- Both media `HEAD` probes
- Both Fountain upload-status `GET` calls

The Telegram sends retry 4 times with 5 seconds between attempts.

Fountain POST/PATCH calls that can create, finalize, update, or schedule a remote resource do **not** use n8n Retry On Fail. This avoids accidentally creating duplicate drafts or repeating a non-idempotent action after an uncertain timeout.

The multipart upload has its own per-part retry loop, described below.

---

## Multipart upload design

The workflow avoids loading multi-gigabyte video into n8n memory or storing it on disk. Each part is moved by a short Node script that the Execute Command node runs inside the n8n container.

1. `Resolve Frame.io Media` exchanges the Episode `Frame.io URL` for a fresh signed Frame.io download URL (the stored URL is a login-walled view link).
2. `Probe Frame.io Video` and `Probe Square Artwork` issue `HEAD` requests and capture full response headers.
3. `Validate Fountain Media` checks each MIME type and byte count, and adopts the resolved URL as `videoUrl` for the uploads.
4. `Start Fountain Video Upload` or `Start Fountain Artwork Upload` asks Fountain for a media ID, `part_size`, and one signed upload URL per part.
5. `Build Video Part Jobs` or `Build Artwork Part Jobs` calculates an inclusive byte range for each URL and emits one job per part.
6. Each job builds a shell command that starts a Node script with the source URL, target URL, and range passed as environment variables:

```sh
SRC='SOURCE_URL' DEST='TARGET_URL' START=START END=END node -e '…'
```

The Node script:

- Fetches the source with a `Range: bytes=START-END` header and requires a `206` (or `2xx`) response.
- Verifies the downloaded length equals the requested range before uploading, so a truncated or ignored range fails instead of uploading the wrong bytes.
- PUTs the bytes to the signed target URL with an explicit `Content-Length`.
- Uses single-quote shell escaping for source URLs, target URLs, and the inline script.

This design runs on the stock n8n image: it needs only the bundled Node runtime, not `bash` or `curl`.

Each part is attempted up to 20 times. Delay doubles for the first five failures and is then capped at 60 seconds. `Upload Fountain Video Parts` and `Upload Fountain Artwork Parts` run once per incoming item. That requires `executeOnce: false` set as a **node parameter** (`parameters.executeOnce`); the node-level `executeOnce` property is ignored by the Execute Command node, and if it is left unset the node defaults to running only the first item. The confirmation Code nodes compare completed item count against the number of generated jobs before finalization.

After all parts complete, the workflow stores the media ID in Airtable, calls Fountain's `/finalize` endpoint, and polls `/uploads/{id}`:

- Video: wait for the Fountain settings row's `Upload Poll Seconds`, falling back to 30 seconds.
- Artwork: use the same `Upload Poll Seconds` value and fallback.
- `ERROR`: throw the Fountain error into the failure path.
- `READY`: continue.
- Any other state: loop back to the Wait node.

---

## Node flow

### Claim, guard, and preflight

```text
Ready for Publishing View
  -> Claim Episode as Publishing
  -> Find Fountain Publication
  -> Guard Fountain Publication
  -> Should Run Fountain
       false -> Restore Guarded Episode Status -> end
       true  -> Upsert Fountain Publication
             -> Fetch Fountain Settings
             -> Fetch Publishing Links
             -> Fetch 1x1 Thumbnail
             -> Build Fountain Plan
             -> Save Fountain Plan
             -> Resolve Frame.io Media
             -> Probe Frame.io Video
             -> Probe Square Artwork
             -> Validate Fountain Media
```

`Build Fountain Plan` creates the formatted description, converts Episode release date plus the configured local time into UTC, copies the explicit flag, and calculates an eight-character FNV-1a source fingerprint from title, description, media URLs, and scheduled time.

### Draft resolution

```text
Has Fountain Item ID
  true  -> Reuse Fountain Draft -----------\
  false -> Create Fountain Draft            -> Resolve Fountain Item
           -> Capture Fountain Item         /
           -> Persist Fountain Item ID ----/
```

`Capture Fountain Item` requires `item.id` in the create response. If creation times out, recovery must check Fountain for a newly created draft before authorizing another attempt.

### Video upload and processing

```text
Resolve Fountain Item
  -> Start Fountain Video Upload
  -> Build Video Part Jobs
  -> Upload Fountain Video Parts
  -> Confirm Video Parts Uploaded
  -> Save Fountain Video Upload ID
  -> Finalize Fountain Video
  -> Wait for Fountain Video
  -> Get Fountain Video Status
  -> Fountain Video Error
       true  -> Stop on Fountain Video Error -> failure path
       false -> Fountain Video Ready
                  false -> Wait for Fountain Video
                  true  -> artwork path
```

### Artwork, item update, and scheduling

```text
Start Fountain Artwork Upload
  -> Build Artwork Part Jobs
  -> Upload Fountain Artwork Parts
  -> Confirm Artwork Parts Uploaded
  -> Save Fountain Artwork Upload ID
  -> Finalize Fountain Artwork
  -> Wait for Fountain Artwork
  -> Get Fountain Artwork Status
  -> Fountain Artwork Error
       true  -> Stop on Fountain Artwork Error -> failure path
       false -> Fountain Artwork Ready
                  false -> Wait for Fountain Artwork
                  true  -> Update Fountain Item
                        -> Schedule Fountain Item
                        -> Mark Fountain Scheduled
                        -> Mark Episode Scheduled
                        -> Notify Fountain Scheduled
```

`Update Fountain Item` sends the title, formatted description, explicit flag, video upload ID, and artwork upload ID. `Schedule Fountain Item` then sends the UTC `scheduled` time.

### Error-output branch

Nodes configured with `onError: continueErrorOutput` send their second output to:

```text
Build Fountain Failure
  -> Mark Fountain Failed
  -> Mark Episode Publishing Failed
  -> Notify Fountain Failure
```

`Build Fountain Failure` preserves a readable message plus up to 9,000 characters of serialized failing-node output. Its Telegram message includes the `BA-xxxx` episode ID in a `<code>` block.

The first claim, Publication lookup, and Publication upsert do not use `continueErrorOutput`. A failure before the Publication upsert therefore goes to the workflow-level error handler rather than the local failure branch. The failure writer also assumes a Publication record ID exists; if the upsert never completed, there is no row for `Mark Fountain Failed` to update.

---

## Failure recovery

1. Read the `Error` and `Raw Error` fields on the Fountain Publication row.
2. Correct the reported Episode field, settings row, media URL, artwork, credential, or Fountain-side problem.
3. If `Create Fountain Draft` timed out or returned no `item.id`, inspect Fountain's newest drafts first. If a draft was created, place that ID in `Platform Item ID` so the next run reuses it.
4. Set the Fountain Publication `Status` back to `Pending` (the guard only starts from no row or `Pending`).
5. Move or edit the Episode so it freshly re-enters the ready view. Do not rely on a row that was already sitting in the view.
6. Confirm the next attempt increments `Attempt Count` and resumes the saved draft when `Platform Item ID` exists.

Useful saved checkpoints:

- `Platform Item ID`: reuse the Fountain draft.
- `Video Upload ID`: diagnostic record of the completed video upload.
- `Artwork Upload ID`: diagnostic record of the completed artwork upload.
- `Formatted Description`, `Scheduled For`, `Source Fingerprint`: exact saved plan for comparing the failed attempt with current inputs.

The current guard only resumes the remote **item**, not a partially uploaded media session. A retry starts new video and artwork uploads even if old upload IDs were saved. Check Fountain before retrying when an API timeout left the remote result uncertain.

---

## Post-push ritual

Every push of this SDK source must be followed by all of these steps:

1. Pull the live workflow first and structurally diff it against this file. Live remains the source of truth.
2. Push only after resolving any drift.
3. Publish the draft in n8n. A saved draft is not the running version.
4. Confirm the workflow is Active. The snapshot documented here was inactive.
5. Confirm `availableInMCP` is still enabled if this workflow is intended to be exposed there.
6. Rebind every Airtable HTTP Request node to `Airtable [n8n] (PAT)`.
7. Rebind every Fountain HTTP Request node to `FOUNTAIN_API_KEY`; SDK pushes skip HTTP Request credential assignment on this instance.
8. Verify both Telegram nodes still use `Telegram [pod21_n8n_agent_bot]`.
9. Confirm workflow settings still include timezone `America/New_York`, 12-hour timeout, saved execution progress, and error workflow `9PMI1kuBjLW2YHwb`.
10. Pull the workflow again and compare node parameters, node settings, credential presence, and connections against the source.
11. Fresh-flip a safe test Episode into the trigger view after publishing. Publishing re-baselines the Airtable poller's cursor, so a row already present is not a valid trigger test.
12. Watch the first execution through the guard and preflight. Use a controlled Fountain feed/item and confirm the Telegram message contains the Episode ID.

Do not test by moving a real episode into the view until the Fountain bearer bindings and the two Episode status choices have been checked.

---

## Known fidelity and operational concerns

- The SDK snapshot preserves all 53 live nodes, the live graph, the `FOUNTAIN_API_KEY` references on all nine Fountain HTTP nodes, and the `Adobe OAuth` reference on `Resolve Frame.io Media`.
- The workflow is **active**. One real run has executed (exec `3057`) and failed at `Validate Fountain Media` because the Episode `Frame.io URL` was a login-walled view link. `Resolve Frame.io Media` was added after that run and is not yet proven end to end.
- `Resolve Frame.io Media` assumes the last path segment of `Frame.io URL` is the Frame.io file id, which held for the tested file, and that the `Adobe OAuth` credential can read that project.
- The resolved video source prefers `original.download_url` (a range-able CloudFront mp4). `efficient` is an HLS manifest and is only a last-resort fallback.
- Failure Telegram messages include the real reason and an `<b>Execution:</b> <code>{id}</code>` line built from `$execution.id`.
- `n8n_validate_workflow` reports a **false positive** on the two Execute Command upload nodes: it insists `executeOnce` belongs at the node level, but the node reads it from `parameters` and ignores the node-level value. Runtime testing (3 items in → 3 items out) confirms `parameters.executeOnce: false` is correct; ignore the validator error.
- Airtable view filters cannot be fetched by the tools used here. Verify `viwDfPHHKrgggdw20` manually.
- `Publishing Settings.Upload Poll Seconds` controls both Wait nodes, with a 30-second fallback. `Upload Poll Limit` is not used, so polling has no explicit count limit below the 12-hour workflow timeout.
- `Episodes.Status` did not list `Publishing` or `Publishing Failed` when checked. The workflow relies on `typecast: true` or manual creation of those choices.
- A failure before the Publication row exists cannot be fully recorded by the local failure branch.
- Multipart upload retries each byte range, but the workflow does not resume a previous Fountain upload session across executions.

---

## Related

- Shared rules: `n8n_workflow_readmes/CONVENTIONS.md`
- Upstream state and system map: `workflow_planning/System Map.md`
- Build status and publishing roadmap: `workflow_planning/Guys Take Build Status.md`
- Thumbnail source workflow: `n8n_workflow_readmes/BA - Guy's Take Thumbnail Artwork.md`
