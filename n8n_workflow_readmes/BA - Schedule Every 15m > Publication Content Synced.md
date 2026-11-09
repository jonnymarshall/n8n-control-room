# BA - Schedule Every 15m > Publication Content Synced

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `WMZ0Zpin1Stn9uF1`.

Local SDK source: `scripts/deploy/workflows/guys-take-fountain-content-sync.sdk.js` (generated from the live workflow 2026-09-30).

---

## Purpose

Keeps already-live platform items in sync with **Airtable, which is the source of truth**. When an episode's `Title`, `Summary`/`Chapters` (the description) or its `1x1` thumbnail change **after** the item has been scheduled or published, this workflow pushes just that content onto the platform's existing item and leaves the item's state alone: a draft stays a draft, a scheduled item stays scheduled, a published item stays published.

It exists because the publisher (`BA - Ready for Publishing View Entered > Fountain Scheduled`) is a one-shot create-and-schedule machine: it only runs while an episode is in the `Ready for Publishing` view, and its guard blocks `Scheduled`/`Published`. So without this workflow, edits made after publishing never reach the platform.

It is deliberately **platform-neutral**: the core finds stale Publications and routes each to a per-platform adapter. Fountain is the first adapter; YouTube (and others) plug in as additional Switch outputs plus an adapter, without rewriting the core.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `WMZ0Zpin1Stn9uF1` |
| Trigger | Schedule Trigger, every 15 minutes; `misfirePolicy: skip` |
| Airtable base | Guy's Take, `app8Xw9Tq0XLjhmp9` |
| Publications table | `tbllWUvhNolvdk3uw` |
| Episodes table | `tbl3uYLIvtB9APZp6` |
| Thumbnails table | `tblkcASzE4DXlxokO` |
| Publishing Links table | `tbl1xX0XpGeTfHMYc` |
| Publishing Settings table | `tblHj2gQ9qYhoQVuX` |
| Publication query | `Platform Item ID != ""` AND `Status` in `Draft`/`Scheduled`/`Published` |
| Drift signal | `Publications.Content Fingerprint` (`textHash.artHash`) |
| Notification | Telegram team group `-5254203539` |
| Workflow timezone | `America/New_York` |
| Execution timeout | 900 seconds |
| Error workflow | `Pod21: Workflow Failed > Telegram Alert`, `9PMI1kuBjLW2YHwb` |
| Active? | **Yes** — activated 2026-09-30. First real sync verified: a title change pushed onto the scheduled Fountain item; the artwork also re-uploaded once as a catch-up (that Publication had no stored fingerprint yet), after which runs are no-ops. |

---

## How it works

```text
Every 15 Minutes
  -> Fetch Publishing Links
  -> Fetch Fountain Settings
  -> Fetch Live Publications
  -> Expand Live Publications          (one item per live Publication)
  -> Load Episode
  -> Load Thumbnail Row
  -> Prepare Update Job                (episode + 1x1 artwork joined per publication)
  -> Route by Platform (Switch)
       Fountain -> Build Fountain Content
                 -> Fountain Content Fingerprint
                 -> Content Changed?
                      false -> stop (no-op)
                      true  -> Update Fountain Item       (PATCH title + description)
                            -> Artwork Changed?
                                 false -> Update Publication Content
                                 true  -> Start Fountain Artwork Upload
                                       -> Download Artwork
                                       -> Upload Artwork Part
                                       -> Finalize Fountain Artwork
                                       -> Wait for Fountain Artwork (loop until READY/ERROR)
                                       -> Update Fountain Item Image  (PATCH image_id)
                                       -> Update Publication Content
                            -> Notify Content Synced
```

1. **Fetch** the publishing links (used by the description), the Fountain settings row (feed id + upload poll seconds), and every live Publication (has a `Platform Item ID` and is `Draft`/`Scheduled`/`Published`).
2. **Expand** each Publication into a job, then **Load Episode** and **Load Thumbnail Row** per job.
3. **Prepare Update Job** joins them and lifts the `1x1` artwork `{ url, type, size, filename }`.
4. **Route by Platform** sends each job to its adapter (Switch; a non-matching platform is dropped).
5. **Fountain adapter:** calls the shared `Build Fountain Content` sub-workflow (`BA - Subworkflow - Build Fountain Content`) to build the Markdown description, then computes a content fingerprint. If it differs from the stored one it PATCHes `title` + `description`; if the artwork changed it uploads a new `ITEM_IMAGE` and PATCHes `image_id`; then it stores the new fingerprint and `Formatted Description` on the Publication.
6. **Telegram** on success or failure. A no-op run sends nothing.

---

## The content fingerprint

`Content Fingerprint` on the Publication is `textHash.artHash`:

- `textHash` = FNV-1a of `title + "\u0000" + description`
- `artHash` = FNV-1a of the platform's artwork **attachment id** (stable). Do **not** hash the artwork URL: Airtable serves a signed URL that it rotates every couple of hours, so a URL hash would look "changed" on every rotation and re-upload the image for nothing.

The publisher writes it when it first schedules an item, and this workflow rewrites it after each sync. Comparing the two is how the workflow knows whether anything actually changed. A run where nothing changed is a no-op (no API writes, no Telegram).

---

## State preservation

The adapter only ever PATCHes `title`, `description` (and `image_id` when artwork changed). It never touches `status`, the schedule time, or the video. That is what lets a published item stay published and a scheduled item stay scheduled. Per the Fountain API, editing `title`/`description` on a published item is allowed; only the monetization variant and required media are locked once published.

---

## Multi-platform

The core (`Fetch Live Publications` → `Expand` → `Load Episode` → `Route by Platform`) is platform-neutral. Airtable's Publications table already models **one row per platform** (`Publication` = `<BA-…> - <Platform>`), so each platform's item carries its own status, ids, schedule and fingerprint.

To add YouTube later: add a Switch output (`Platform = "YouTube"`) plus a YouTube adapter that maps the episode's fields onto the YouTube Data API (title, description, thumbnail), reusing the same fingerprint + `Content Changed?` gate and the same state-preservation rule. No core changes needed.

---

## Credentials

| Credential | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | every Airtable HTTP node |
| `FOUNTAIN_API_KEY` | `httpBearerAuth` | `Update Fountain Item`, `Start Fountain Artwork Upload`, `Finalize Fountain Artwork`, `Get Fountain Artwork Status`, `Update Fountain Item Image` |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | both Telegram nodes |

HTTP Request nodes are skipped by credential auto-assignment on every push, so **rebind all of them by hand after any push**. `Download Artwork` and `Upload Artwork Part` take no credential (the attachment URL is already signed and the upload URL is presigned).

---

## Limitations / known concerns

- **Video changes are out of scope.** A new `Frame.io URL` (a re-cut) is not swapped; that needs a re-publish. Only title/description/artwork sync.
- The description is built by the shared sub-workflow `BA - Subworkflow - Build Fountain Content` (`scripts/deploy/workflows/guys-take-fountain-build-content.sdk.js`), which the publisher also calls, so the two can't drift.
- **Every live Publication is checked each run** (up to 100). Unchanged ones are no-ops, but it is a full read each time.
- **Artwork is re-uploaded only when the `1x1` attachment changes** (its stable attachment id changes). A text-only change reuses the existing `image_id`. A Publication with no stored fingerprint (e.g. scheduled before the field existed) does a one-time catch-up PATCH + artwork upload.
- **Assumes the Fountain settings row exists** (`Platform = Fountain`, `Enabled`, `Feed ID`). The sync does not run its own preflight.
- The `1x1` attachment `type` and `size` are taken from the Airtable attachment metadata, so no HEAD probe is needed for artwork.

---

## Setup checklist

1. Confirm the `Content Fingerprint` field exists on Publications (`flduU7XOPRsXVMi6d`).
2. Confirm Airtable, `FOUNTAIN_API_KEY` and Telegram credentials are bound to every node above.
3. Confirm the two binary HTTP nodes: `Download Artwork` (Response Format = File, output field `data`) and `Upload Artwork Part` (binary body, input field `data`).
4. Run the publisher once on a test episode so a `Scheduled` Publication with a `Content Fingerprint` exists.
5. Change the episode's `Title`, run this workflow manually, and confirm: the Fountain item's title updates, the Publication `Content Fingerprint` and `Formatted Description` change, the item stays `Scheduled`, and a Telegram "updated" message arrives.
6. Change the `1x1` thumbnail and repeat; confirm the item's image updates.
7. Only then activate.

---

## Related

- Publisher (creates + schedules the item): `n8n_workflow_readmes/BA - Ready for Publishing View Entered > Fountain Scheduled.md`
- Reconciler (reads Fountain status back): `n8n_workflow_readmes/BA - Schedule Every 15m > Fountain Publication Reconciled.md`
- Shared description builder: `n8n_workflow_readmes/BA - Subworkflow - Build Fountain Content.md`
- Shared rules: `n8n_workflow_readmes/CONVENTIONS.md`
- Canonical pipeline map: `workflow_planning/System Map.md`
