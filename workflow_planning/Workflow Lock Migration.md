# Workflow Lock migration

**Status: Stages 0 to 4 are live. Stages 5 to 7 are planned and not started.**
Written 2026-11-24. Last updated 2026-11-24 after Stage 4 shipped. The rule that governs every stage is in `n8n_workflow_readmes/CONVENTIONS.md` ("Claim a row with `Workflow Lock`, not a stage status").

---

## Airtable cleanup tracker (start here)

**Last checked 2026-11-24 22:56 UTC.** A status is deleted only after its stage has had **one clean real run**. Do not delete it in the same change that stops writing it; a rollback may need it.

### Pending right now

| Item | Where | Delete when | State |
|---|---|---|---|
| `Generating Metadata` | `Episodes.Status` | after one clean metadata run (Stage 2) | **PENDING.** No clean run since Stage 2 shipped at 20:31 UTC; no episode has moved through it. |
| `Generating Artwork` | `Episodes.Status` | after one clean artwork run (Stage 3) | **PENDING.** No clean run since Stage 3 shipped at 22:37 UTC; no episode has moved through it. |
| `Publishing` | `Episodes.Status` | after one clean publish run (Stage 4) | **PENDING.** No clean publish since Stage 4 shipped at 22:56 UTC; the ready view was empty at ship time. |

**How to confirm the run was clean:**

- **Metadata:** an episode moved from `Ready for Metadata` to `AI Analysis Complete`, `Workflow Lock` is empty, and the execution succeeded.
- **Artwork:** an episode reached `Awaiting Thumbnail Pick` (four `Thumbnails` rows) or `Awaiting Manual Artwork`, `Workflow Lock` is empty, and the execution succeeded.
- **Publish:** an episode moved to `Scheduled to Publish`, its Fountain Publication is `Scheduled`, `Workflow Lock` is empty, and the execution succeeded. A large upload can take about 80 minutes; do not judge it early.

Then delete the status from `Episodes.Status`. Airtable removes it from any view filter that mentions it.

### Already deleted

- `Scheduled` from `Episodes.Status` (2026-11-24)
- `Transcript Ready` from `Episodes.Status` (2026-11-24)
- `Audionauts Post Tried` field from `Episodes` (2026-11-24)

### Not due yet

| Item | Where | Delete when |
|---|---|---|
| `Processing` | `Thumbnails.Status` | after Stage 5, one clean pick and one clean revision |
| `Syncing` | `Publications.Sync Status` | after Stage 6, one clean content sync |
| `Edited` | `Episodes.Status` | optional: delete if you never use it (only the upload guard mentions it) |
| `Research Ready` | `Episodes.Status` | optional: only the AgentMail guard mentions it |
| `Stories Picked` | `Episodes.Status` | optional: same |

---

## Why

`Episodes.Status` is doing two jobs: it tells a human (and the assistant) where an episode is, and it acts as the lock for whichever workflow currently owns the row. That is why the list keeps growing: `Generating Metadata`, `Generating Artwork`, `Publishing`, and so on. Each one exists only to take the row out of a view while a workflow runs.

The cost:

- Every stage invents a status, a view filter and a recovery rule.
- A stuck row is ambiguous unless you know which status means what.
- Removing a status later requires checking every view, the assistant prompt and the docs.
- A failed run has no single, uniform recovery action.

The fix is one generic claim field. `Status` keeps its human meaning; the lock answers "is a workflow on this right now".

---

## The model

`Episodes.Workflow Lock` (single line text, created 2026-11-23).

- A workflow writes `<stage> <ISO timestamp>`, for example `metadata 2026-11-24T09:12:00Z`, immediately after it picks the row and before any model call, upload or multi-step work.
- The trigger view requires `Workflow Lock is empty`, so the row leaves the view at the claim.
- On success the workflow clears the lock and sets the outcome status in one PATCH.
- On failure the lock stays. The reason goes to Telegram (and the failure alert). The row cannot retry itself every minute.
- Recovery is one action: clear the lock, and reset the status only if the failure happened after a status write.
- A non-empty lock always means a run owns the row or died. Do not clear it automatically, and do not clear it while the execution is still running.

Table scope:

- `Episodes` gets the first migration because every stage in the production pipeline owns an episode row.
- `Thumbnails` and `Publications` have their own queues. They keep their existing queue statuses until Stage 5 and Stage 6, then get their own `Workflow Lock` field.

---

## Current inventory

| Stage | Workflow | Trigger | Claim today | Outcome | Status to retire |
|---|---|---|---|---|---|
| Audionauts copy | `jDEHmj4d0R4PPsiN` | `Ready for Social Posts` view | `Workflow Lock` (done) | `Audionauts Post Ready` | none |
| X social draft | `ntXHSW3AbNntnaj0` | `Ready for Social Posts` view | `Workflow Lock` (done 2026-11-24) | four `Social Posts` rows | none |
| Metadata | `jroXHciDvy0sWlRM` (metadata branch) | `Ready for Metadata` view | `Workflow Lock` (done 2026-11-24) | `AI Analysis Complete` | `Generating Metadata` |
| Artwork Path 1 | `mLAn4ya2AmZoHDUk` | `Ready for 16X9 Thumbnail` view | `Workflow Lock` (done 2026-11-24) | `Awaiting Thumbnail Pick` / `Awaiting Manual Artwork` | `Generating Artwork` |
| Thumbnail pick | `mLAn4ya2AmZoHDUk` (Path 2) | `Thumbnails.Status = Selected` | `Thumbnails.Status = Processing` | `Final` / `Rejected` | `Processing` |
| Thumbnail revision | `mLAn4ya2AmZoHDUk` (Path 3) | `Thumbnails.Status = Revising` | `Thumbnails.Status = Processing` | `Proposed` (new round) | `Processing` |
| Fountain publisher | `LTmRVKn9TWJd6Gtk` | `Ready for Publishing` view | `Workflow Lock` (done 2026-11-24) | `Scheduled to Publish` / `Publishing Failed` | `Publishing` |
| Content sync | `WMZ0Zpin1Stn9uF1` | 15-minute schedule | `Publications.Sync Status = Syncing` | `Synced` / `Failed` | `Syncing` |
| Reconciler | `guys-take-fountain-reconciler` | schedule | none (read and update) | `Published` / `Partially Published` | none |
| Notifications | publish readiness, X readiness | views / schedule | none (dedupe fields) | messages | none |

The reconciler and the notification workflows do not own a row for a long-running job, so they are out of scope.

---

## Rules for every stage

1. **One stage per branch and PR.** Branch names below are suggestions. Do not combine two stages.
2. **Change the view and the workflow in the same change.** The view gains `Workflow Lock is empty`; the code gains the same guard as a backstop.
3. **Claim before the work.** The claim is the first write after the row is picked.
4. **Clear on every success path.** If a workflow has more than one success exit, every one clears the lock.
5. **Leave the lock on every failure path.** Add the reason to the Telegram failure message and say to clear the lock.
6. **Keep the outcome status.** The lock replaces the claim, not the vocabulary a human reads. `AI Analysis Complete`, `Awaiting Thumbnail Pick`, `Scheduled to Publish`, `Published` all stay.
7. **Retire the old claim status one release later.** Wait until the stage has run cleanly in production, then remove the status from the select and from every view, prompt and doc.
8. **Test on one real row, then force a failure.** A successful run proves the happy path; a killed or thrown run proves the lock stays and the retry works.
9. **Never clear a lock to "unstick" without checking the execution.** If the run is still alive, clearing it allows a duplicate.
10. **Update the readme, the System Map and the Build Status entry in the same PR.** Sync the System Map only after the merge.

---

## Stage 1: X social draft

- **Status:** **done, 2026-11-24.** Branch `feat/lock-x-social-draft`, PR #56.
- **Workflow:** `ntXHSW3AbNntnaj0`
- **View:** `Ready for Social Posts`, group 1 (X episodes). `Workflow Lock is empty` is now in the view.

Shipped: `Pick Episodes` skips locked rows, `Claim Post` writes `x-social <timestamp>` before the prompts and model calls, `Clear Lock` clears it after the four rows are written, and error outputs from the draft, editor, X-row create, post create and clear route to `Build X Failure` -> `Send X Failure`. Happy path and forced failure are still to be exercised by the first real X episode.

Original checklist:

1. Add `Workflow Lock is empty` to group 1 of the view.
2. In `Pick Episodes`, require `Workflow Lock` empty as a backstop.
3. Add `Claim Post` after `Pick Episodes`: PATCH the episode with `Workflow Lock = "x-social <now>"`, with retries.
4. On success (after `Create Social Posts`), clear the lock. No status change; the four `Social Posts` rows are the outcome.
5. On failure, leave the lock and send the reason. Add a small failure branch if the current one only relies on the global alert.
6. No status to retire.

Why first: no human-facing status changes, the smallest blast radius.

Watch for: the view is shared with the Audionauts branch. A claimed X row leaves group 1; the Audionauts branch ignores it by Type.

---

## Stage 2: Metadata

- **Status:** **done, 2026-11-24.** Branch `feat/lock-metadata`.
- **Workflow:** `jroXHciDvy0sWlRM`, metadata branch only.
- **View:** `Ready for Metadata`. `Workflow Lock is empty` still to add in the UI.

Shipped: `Queued Episode?` refuses a row whose `Workflow Lock` is set. `Set Generating Metadata` is replaced by `Claim Metadata`, which writes `metadata <timestamp>` and leaves `Status` at `Ready for Metadata`. All three success exits clear the lock in the same PATCH that sets `AI Analysis Complete`: `Set Status AI Analysis Complete`, `Save Audionauts Transcript`, and `Skip to Analysed`. A failure leaves the lock. Happy path and failure are still to be exercised by the next real upload; metadata cannot be tested without a real Frame.io file and a transcription run.

Original checklist:

1. Add `Workflow Lock is empty` to the view.
2. Claim immediately after the view search and the claim guard: `Workflow Lock = "metadata <now>"`.
3. Remove the `Generating Metadata` status write.
4. On success, keep `AI Analysis Complete` and clear the lock in the same PATCH.
5. On failure, leave the lock. The existing failure alert names the episode.
6. After one clean week, remove `Generating Metadata` from the status select and every view/prompt/doc that lists it.

Watch for: the metadata workflow has branches (Audionauts, same-length skip, full run). Every exit that currently writes `Generating Metadata` must claim, and every success exit must clear.

---

## Stage 3: Artwork Path 1

- **Status:** **done, 2026-11-24.** Branch `feat/lock-artwork`.
- **Workflow:** `mLAn4ya2AmZoHDUk`, Path 1 only.
- **View:** `Ready for 16X9 Thumbnail`. `Workflow Lock is empty` still to add in the UI.

Shipped: `Generation Queued?` refuses a locked row. `Mark Generating` is replaced by `Claim Artwork`, which writes `artwork <timestamp>` and leaves `Status` alone. `Mark Awaiting Pick` and `Mark Manual Artwork` clear the lock in the same PATCH that sets the outcome status. A failure leaves the lock. Paths 2 and 3 are unchanged. The next Approved episode that enters the view is the test.

Original checklist:

1. Add `Workflow Lock is empty` to the view.
2. Claim with `Workflow Lock = "artwork <now>"` before the image requests.
3. Remove the `Generating Artwork` write.
4. On success, set `Awaiting Thumbnail Pick` or `Awaiting Manual Artwork` and clear the lock.
5. On failure, leave the lock and send the reason.
6. Retire `Generating Artwork` after a clean week.

Watch for: Path 1 also handles the manual-artwork branch. The claim and clear must cover both outcomes. Paths 2 and 3 move in Stage 5.

---

## Stage 4: Fountain publisher

- **Status:** **done, 2026-11-24.** Branch `feat/lock-publisher`.
- **Workflow:** `LTmRVKn9TWJd6Gtk`
- **View:** `Ready for Publishing` (`viwDfPHHKrgggdw20`). `Workflow Lock is empty` still to add in the UI.

Shipped: a new `Lock Free?` IF sits between `Should Run Fountain` true and the work; `Claim Publishing` writes `publishing <timestamp>` and leaves `Status` at `Ready to Publish`; the old `Claim Episode as Publishing` is removed. `Mark Episode Scheduled to Publish` sets `Scheduled to Publish` and clears the lock; `Mark Episode Publishing Failed` sets `Publishing Failed` and leaves the lock. The ready view was empty when this shipped, so the trigger re-baseline did not strand a row. The next real publish is the test; it takes up to about 80 minutes.

Original checklist:

1. Add `Workflow Lock is empty` to the view.
2. Claim with `Workflow Lock = "publishing <now>"` right after the guard, before any upload.
3. Remove the `Publishing` write.
4. On success, set `Scheduled to Publish` and clear the lock.
5. On failure, set `Publishing Failed` **and** leave the lock. Both are useful here: the failure status is the terminal state a human acts on, the lock records that the run died.
6. Retire `Publishing` after one clean publish.

Watch for: the largest, longest job in the system. Do this one on its own, not on a release day, and watch the first full upload.

---

## Stage 5: Thumbnail pick and revision

- **Branch:** `feat/lock-thumbnail-queues`
- **Workflow:** `mLAn4ya2AmZoHDUk`, Paths 2 and 3.
- **Table:** `Thumbnails`.

Changes:

1. Add `Thumbnails.Workflow Lock` (single line text).
2. Add `Workflow Lock is empty` to the pick and revision views.
3. Replace the `Status = Processing` claim with the lock. The selectable status stays `Selected` / `Revising` until the workflow finishes.
4. On success, set `Final` / `Proposed` as today and clear the lock.
5. On failure, leave the lock; the row stays `Selected` / `Revising`, so clearing the lock re-admits it.
6. Retire the `Processing` option.

Watch for: the 2026-11-17 `Processing` claim fixed a real double-pick bug. Prove the lock does the same job with a two-row test before retiring it.

---

## Stage 6: Content sync

- **Branch:** `feat/lock-content-sync`
- **Workflow:** `WMZ0Zpin1Stn9uF1`
- **Table:** `Publications`.

Changes:

1. Add `Publications.Workflow Lock` (single line text).
2. Replace `Sync Status = Syncing` as the claim with `workflow-lock = "content-sync <now>"`.
3. Keep `Sync Status` for the human outcomes: `Awaiting Approval`, `Synced`, `Failed`, `Adopt Requested`.
4. On success, clear the lock and set the existing outcome.
5. On failure, leave the lock and set `Failed` as today.
6. Retire `Syncing`.

Watch for: the content sync's `runningFresh` guard uses the `Syncing` status plus `Last Attempt` to stop a second upload during the 80-minute video swap. The lock must replace that guard, not just the status write, or a second run can start during a long upload.

---

## Stage 7: cleanup

- Remove the retired claim statuses after each stage has run cleanly:
  - `Generating Metadata`
  - `Generating Artwork`
  - `Publishing`
  - `Thumbnails.Processing`
  - `Publications.Syncing`
- Update the assistant prompt and the System Map: replace "the workflow sets Generating X" with "the workflow claims the row with Workflow Lock".
- Update the readiness checklist if it mentions a claim status.
- Add the status list to the status audit table below as "retired".

---

## Testing and rollback for every stage

**Happy path:** one real row through the view. Check the lock appears and clears, the outcome status is right, and the row is out of the view while it runs.

**Failure path:** let the workflow throw (or temporarily point a test copy at a bad input). Check the lock stays, the row is out of the view, and the Telegram message names the episode and says to clear the lock. Clear the lock and confirm it is picked up again.

**Rollback:** stop the workflow, clear the lock on affected rows, restore the claim status write, republish the previous version from n8n version history. Do not leave a lock on a row after a rollback.

**Before you start:** check the view for rows already in flight. Do not migrate while a long publisher run is active.

---

## Status audit (2026-11-24)

Counts are across all 88 Episodes. "Writer" is the workflow that sets the status. A dash means manual or no writer in the snapshots.

| Status | Writer | Rows | Verdict |
|---|---|---|---|
| `Recording Scheduled` | AgentMail scheduling | 2 | **Keep.** Real stage. |
| `Scheduling` | AgentMail scheduling | 2 | **Keep.** Waiting to be scheduled. |
| `Research Ready` | manual | 0 | **Keep or remove.** Only referenced in the AgentMail guard. Remove if the weekly flow no longer uses it. |
| `Stories Picked` | manual | 0 | **Keep or remove.** Same as above. |
| `Script Ready` | Script Generation | 0 | **Keep.** The script output stage. |
| `Recorded` | manual / assistant | 1 | **Keep.** Queues the metadata workflow. |
| `Transcript Ready` | none | 0 | **Remove.** No writer, no reader, only appears in select lists. |
| `Edited` | manual | 0 | **Remove or keep.** Only used by the upload guard (`Recorded`/`Edited`). Remove if you never use it. |
| `Ready for Metadata` | Episode Marked | 0 | **Keep.** The metadata queue. |
| `Generating Metadata` | metadata | 0 | **Retired in Stage 2 (2026-11-24).** Delete it from `Episodes.Status` after the first clean metadata run. |
| `AI Analysis Complete` | metadata | 0 | **Keep.** Metadata outcome and Audionauts entry. |
| `Approved` | manual | 0 | **Keep.** Artwork and social triggers. |
| `Awaiting Thumbnail Pick` | artwork | 0 | **Keep.** |
| `Generating Artwork` | artwork | 0 | **Retired in Stage 3 (2026-11-24).** Delete it from `Episodes.Status` after one clean generation run. |
| `Artwork Ready` | artwork | 0 | **Keep.** |
| `Ready to Publish` | readiness / assistant | 0 | **Keep.** The publisher queue. |
| `Scheduled to Publish` | publisher | 0 | **Keep.** |
| `Publishing` | publisher | 0 | **Retired in Stage 4 (2026-11-24).** Delete it from `Episodes.Status` after one clean publish. |
| `Publishing Failed` | publisher / reconciler | 0 | **Keep.** Terminal failure a human acts on. |
| `Partially Published` | reconciler | 0 | **Keep.** Multi-platform outcome. |
| `Published` | reconciler / assistant | 79 | **Keep.** |
| `Suspended` | manual / assistant | 0 | **Keep.** Manual hold for a cancelled episode. |
| `Awaiting Manual Artwork` | artwork | 0 | **Keep.** |
| `Scheduled` | none | 0 | **Remove.** Legacy name, replaced by `Recording Scheduled` on 2026-10-29. Also appears in one AgentMail guard message. |
| `Audionauts Post Ready` | Audionauts draft | 1 | **Keep.** |

Removal notes:

- **Safe to remove now:** `Scheduled`, `Transcript Ready`.
- **Remove if unused:** `Edited`, `Research Ready`, `Stories Picked`. Removing any of them means updating the AgentMail guard lists and the metadata/script Airtable node option lists.
- **Retire through the migration:** `Generating Metadata`, `Generating Artwork`, `Publishing`, plus `Thumbnails.Processing` and `Publications.Syncing`.
- **Keep:** everything else. These are the human-facing lifecycle.
- **Three episodes have no status.** Worth a look; they are not part of the status list.

The five claim statuses above account for most of the clutter. After the migration the list is shorter by five, and the recovery rule is the same everywhere.

---

## Open decisions

1. **Failure status for the publisher.** Keep `Publishing Failed` alongside the lock (recommended: yes, it is a terminal state a human sees), or rely on the lock alone.
2. **Thumbnails and Publications locks.** Add the field to both (recommended, as in Stages 5 and 6), or leave their queue statuses alone.
3. **Early-pipeline statuses.** Do you still use `Research Ready`, `Stories Picked` and `Edited`? If not, they go with `Scheduled` and `Transcript Ready` in the cleanup PR.
4. **Assistant wording.** The assistant should say "a workflow has claimed this episode, the lock says which one, clear it to retry" once the migration is under way.

## Done when

- Every view-triggered workflow claims with a `Workflow Lock`.
- No `<Stage> In Progress` status is written.
- Every trigger view requires `Workflow Lock is empty`.
- A non-empty lock is the single, uniform signal that a run died, and clearing it is the single recovery action.
- The claim statuses listed above are gone from the select, the views, the prompts and the docs.
