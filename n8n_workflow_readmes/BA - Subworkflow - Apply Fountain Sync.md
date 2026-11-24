# BA - Subworkflow - Apply Fountain Sync

> **2026-11-24 - the sync now clears `Publications.Workflow Lock` on success (LIVE, published, Stage 6).** `Finish Sync` writes `Sync Status = Synced` and clears the lock in one PATCH. A failure leaves the lock and sets `Sync Status = Failed`; the failure message says to clear it before retrying. The parent content sync claims the lock before calling this sub-workflow. `versionId == activeVersionId`, active, 15 nodes, validation clean.

> **2026-11-23 - the video swap's PATCH URL was never a real expression and is now fixed (LIVE, published).** `Attach New Video` held `=https://api.fountain.fm/v1/feeds/$('Input').first().json.feedId/items/$('Input')…` with no `{{ }}` around the two expressions, so n8n sent the literal text as the feed and item ids. A video swap therefore failed at that node and took the failure branch every time, so the row was marked `Sync Status = Failed` and no re-cut could reach Fountain through this path. The URL is now `=https://api.fountain.fm/v1/feeds/{{ $('Input').first().json.feedId }}/items/{{ $('Input').first().json.itemId }}`. The re-uploaded video now keeps the Frame.io filename (see `BA - Subworkflow - Upload Video to Fountain`). `versionId == activeVersionId`, active, 2 Fountain / 4 Airtable / 2 Telegram bindings intact. **Not yet exercised by a real video swap.**

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `G1N3gUA2CUa8Q5sF`.

Local SDK source: `scripts/deploy/workflows/guys-take-fountain-apply-sync.sdk.js` (generated from live 2026-11-14).

---

## Purpose

Applies one already-decided Fountain sync to the actual Fountain item, then records the result in Airtable. It is the **write** half of the Fountain sync: the caller (`BA - Schedule Every 15m > Publication Content Synced`) works out *what* changed and sets `needsVideo` / `needsDate`, and this workflow does the calls that change the live item, in the right order, with a failure branch.

It exists as a sub-workflow so the video swap, the re-schedule and the "sync finished" write are one unit of work: either the item ends up consistent and marked Synced, or the row is marked Failed with a reason.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `G1N3gUA2CUa8Q5sF` |
| Trigger | Execute Sub-workflow Trigger (`Input`, passthrough) |
| Called by | `BA - Schedule Every 15m > Publication Content Synced` (node `Apply Fountain Sync`, mode *Run once for each item*) |
| Active? | **Yes** |
| Credentials | Fountain (`httpBearerAuth`), Airtable PAT (`airtableTokenApi`), Telegram `@pod21_n8n_agent_bot` |
| Telegram messages | 2 (`Notify Synced`, `Notify Failure`) — see `TELEGRAM-STYLE.md` |

---

## Interface

**Input (one item per Publication row):** the caller's working object. This workflow reads:

| Field | Used for |
|---|---|
| `publicationRecordId` | the Airtable row to write back to |
| `episodeId` | printed in both messages (`BA-…`) |
| `feedId`, `itemId` | the Fountain item |
| `episodeUrl` | the Frame.io source handed to `Upload Video to Fountain` |
| `needsVideo` | take the video-swap branch |
| `needsDate`, `releaseDay`, `fountainSettings` | build the new publish time |
| `appliedChanges`, `textWasEdited`, `newFingerprint`, `newFormattedDescription` | what the confirmation message says and what `Finish Sync` writes |

**Output:** the Airtable PATCH response from `Finish Sync` (one item).

```text
Input
  -> Video Changed? ──true──> Build Video Upload Request -> Upload New Video
                              -> Attach New Video -> Record Video File Id ─┐
                                                                          v
  -> Date Changed? ──true──> Build New Schedule -> Schedule New Date    Date Changed?
                              -> Record New Schedule -> Finish Sync        │false
                                                                          v
                                                                     Finish Sync
                                                                          v
                                                                     Notify Synced
```

Every mutating step has `onError: continueErrorOutput`, wired to `Build Failure` so one bad call lands on the failure branch instead of killing the run silently.

- **Video swap** calls the `BA - Subworkflow - Upload Video to Fountain` sub-workflow (`XY4WfJ2XaBA9bPKY`), then attaches it with `{ audio_default_id: null, video_default_id: <new> }` in **one** PATCH. The `null` is what makes Fountain re-extract the audio from the new video; without it the old track stays, because a new video only brings its own audio when the slot is empty. It must be one request: a published item cannot be left without audio, so two sequential requests are rejected.
- **Re-schedule** turns `releaseDay` + the show's `Default Publish Time` (`fountainSettings`) into a UTC instant, or *now + 1 hour* when the release day is today or already past.
- **Finish Sync** writes `Content Fingerprint`, `Formatted Description`, `Sync Approved: false`, `Sync Status: Synced` and clears `Workflow Lock`.

## Failure branch

`Build Failure` → `Mark Sync Failed` → `Notify Failure`. The row is set to `Sync Status: Failed` with the reason, `Sync Approved` is cleared, the `Workflow Lock` is left in place, and the team group gets one message with the episode ID. Clear the lock and set `Sync Status = Awaiting Approval` (or re-tick `Sync Approved`) to retry. `Build Failure` is a Code node (`telegramText`) because the reason has to be dug out of an error object.

---

## Notes

- **No write happens unless the caller says so.** This workflow never decides *whether* an item needs syncing; that is the caller's `needs*` contract.
- **The two messages defer to the caller's fields.** `Notify Synced` prints `appliedChanges` (falling back to `changes`, then "nothing to change") and only mentions scheduling when `needsDate` is true, because `Build New Schedule` did not run otherwise.
- **Never put a real line break inside a quoted string in a `{{ }}`.** On 2026-11-14 the `textWasEdited` warning in `Notify Synced` held two raw line breaks where the escape `\n` was meant. n8n reads a quote that runs across a line as `ExpressionExtensionError: invalid syntax`, so the run failed **after** `Finish Sync` had already written Airtable: the item was synced but the confirmation never sent, and the only visible symptom was the red "Workflow failed" alert. Fix is `\n` (two characters), and the snapshot needs `\\n` because it stores the value inside a JS string. `scripts/query/expression-syntax-audit.sh` checks the whole fleet for this.
- **Re-running is safe.** `Finish Sync` and the video/schedule calls are idempotent for the same input, so a retry of the caller does not duplicate anything.
