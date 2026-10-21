# BA - Schedule Every 15m > Fountain Publication Reconciled

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `pvCPy320OjawDkSu`.

Local SDK source: `scripts/deploy/workflows/guys-take-fountain-reconciler.sdk.js`

Live state as of 2026-09-29: **inactive**, version `ed78dcdd-1bff-48c5-94ee-f71290356489` (version counter 5), no published version (`activeVersionId: null`). The local source mirrors live: the `FOUNTAIN_API_KEY` bearer binding on `Load Fountain Scheduled Item`, and failure messages that include the real reason plus an `Execution:` line built from `$execution.id`.

---

## Purpose

This workflow checks Fountain every 15 minutes for episodes whose Airtable Publication row says they should already have published. It reconciles Fountain's actual item state back into Airtable.

On a successful Fountain publication it:

1. Marks the Fountain Publication `Published`.
2. Saves Fountain's public content ID, public URL, and published time.
3. Recalculates the parent Episode status from all of that Episode's Publication rows.
4. Notifies the Telegram team group with the Episode ID and Fountain link.

When Fountain reports an item error, or the Fountain lookup itself fails, it:

1. Marks the Fountain Publication `Failed` and saves readable and raw errors.
2. Marks the parent Episode `Publishing Failed`.
3. Sends a Telegram recovery message with the Episode ID.

Items still processing or scheduled in Fountain are left unchanged and checked again on the next run.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `pvCPy320OjawDkSu` |
| Trigger | Schedule Trigger, every 15 minutes |
| Misfire policy | `skip` |
| Airtable base | Guy's Take, `app8Xw9Tq0XLjhmp9` |
| Publications table | `tbllWUvhNolvdk3uw` |
| Episodes table | `tbl3uYLIvtB9APZp6` |
| Publishing Settings table | `tblHj2gQ9qYhoQVuX` |
| Publication query | `Platform = Fountain`, `Status = Scheduled`, `Scheduled For < NOW()` |
| Notification destination | Telegram team group `-5254203539` |
| Workflow timezone | `America/New_York` |
| Execution timeout | 900 seconds (15 minutes) |
| Error workflow | `Pod21: Workflow Failed > Telegram Alert`, `9PMI1kuBjLW2YHwb` |
| Execution data | Save successful, failed, and manual executions; save execution progress |

The trigger's `misfirePolicy: skip` means missed schedule ticks are not replayed. This is safe because each later run queries every still-due Fountain Publication, rather than relying on one specific tick.

---

## Credentials

| Credential | Live reference | Used by | Push behavior |
|---|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi`, live credential ID `04Sw0cnSlBkB6Y3s` | Seven Airtable HTTP Request nodes | Rebind every Airtable HTTP Request node after a push. |
| `FOUNTAIN_API_KEY` | `httpBearerAuth`, live credential ID `5zWdDTc3e6SFgBVb` | `Load Fountain Scheduled Item` | Bound in the live draft. Rebind this HTTP Request node after an SDK push. |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi`, live credential ID `INjDc84OskDdqiNR` | Both Telegram notification nodes | Expected to resolve by name, but verify after a push. |

The Airtable credential must have record read/write access to base `app8Xw9Tq0XLjhmp9`. The Fountain credential needs permission to read the configured feed and item. The Telegram credential must still point to `@pod21_n8n_agent_bot`; this workflow sends only and does not create another Telegram Trigger.

---

## Airtable dependencies

### Publishing Settings, `tblHj2gQ9qYhoQVuX`

The workflow fetches the first row where `Platform = "Fountain"` and reads:

| Field | ID | Use |
|---|---|---|
| Platform | `fldqWsXFyTLI7enkX` | Selects the Fountain settings row |
| Enabled | `fldqAn6TnT0ukLGzH` | Must be checked or the run emits no items |
| Feed ID | `fldWHpIt9d07SfBA0` | Builds the Fountain item lookup URL |

If the row is missing, `Enabled` is not checked, or `Feed ID` is empty, `Expand Due Fountain Publications` returns no items. The run ends successfully without updating rows or sending a notification.

### Publications, `tbllWUvhNolvdk3uw`

The scheduled query reads up to 100 rows matching the due criteria. There is no pagination beyond the first 100 records.

| Field | ID | Use |
|---|---|---|
| Publication | `fldcjXb1d1TpvkWTx` | Derives the Episode ID by removing the exact suffix ` - Fountain` |
| Episode | `fldJ7QVLcIO5BhJ2x` | First linked record becomes the Episode record ID |
| Platform | `fld9X47mVyVdspI7N` | Must equal `Fountain` |
| Status | `fldgy0g5MM9V5aIAZ` | Selects `Scheduled`; writes `Published` or `Failed` |
| Platform Item ID | `fld86v8eHpXH8hacd` | Fountain item ID used in the API path |
| Platform Content ID | `fld8G1AUpubm8tadC` | Receives Fountain's `fountain_id` |
| URL | `fldRTBcSyZlYPpwk1` | Receives the public Fountain episode URL |
| Scheduled For | `fldKJG5EfiqCgNI0Y` | Due-time filter |
| Error | `fldr0SWXElMD4ACu7` | Cleared on success; readable reason on failure |
| Raw Error | `fldoGPYlKktedjgdC` | Cleared on success; serialized response on failure, capped at 9,000 characters |
| Published At | `fldwJ1mUyo9ZJcanr` | Fountain's published value, or the current UTC time as fallback |
| Retry Requested | `fldKdPeDpYzWcJcmZ` | Unused since 2026-09-29; safe to delete the column |

Rows without both a linked Episode record ID and a `Platform Item ID` are silently filtered out by `Expand Due Fountain Publications` and remain `Scheduled`.

### Episodes, `tbl3uYLIvtB9APZp6`

| Field | ID | Use |
|---|---|---|
| ID | `fldYVimbhGfgFZF1X` | Human-facing `BA-xxxx` identifier, indirectly derived from Publication |
| Status | `fldUkNtr7lXG5s9DB` | Receives the aggregate publishing status |
| Publications | `fldthkujasRg2fbvm` | Airtable backlink; the workflow instead queries Publications by name prefix |

At snapshot time, `Published` exists in the Episode Status choices. `Partially Published` and `Publishing Failed` do not. The update uses `typecast: true`, so Airtable may create those options if the PAT is allowed to do so. Add them by hand first if select-option creation should be controlled.

---

## Status logic

### Fountain item state

`Load Fountain Scheduled Item` calls:

```text
GET https://api.fountain.fm/v1/feeds/{Feed ID}/items/{Platform Item ID}
```

The response is handled as follows:

| Fountain `item.status` | Result |
|---|---|
| `ERROR` | Local failure path |
| `PUBLISHED` with `item.fountain_id` | Local success path |
| `PUBLISHED` without `item.fountain_id` | Local failure path |
| Any other value | End this item with no Airtable change; check it again next scheduled run |

An HTTP or credential failure from the same node also goes to the local failure path through its separate error output. After a `PUBLISHED` response, `Build Fountain Published Result` requires `fountain_id`; that Code node also has a separate error output wired to the same failure path.

### Publication success write

`Mark Fountain Published` writes:

- `Status = Published`
- `Platform Content ID = item.fountain_id`
- `URL =` derived Fountain public URL
- `Published At = item.published`, falling back to the current UTC time
- `Error = ""`
- `Raw Error = ""`

### Episode aggregate status

After a Fountain success, `Fetch Episode Publications` reads Publication rows whose `Publication` field begins with the Episode ID. `Decide Episode Publication Status` then applies:

| Related Publication states | Episode Status |
|---|---|
| At least one row, and every row is `Published` or `Skipped` | `Published` |
| Otherwise, at least one row is `Published` | `Partially Published` |
| No row is `Published` | `Publishing Failed` |

This aggregation is prefix-based, not linked-record-based. Naming unrelated Publication rows with the same Episode ID prefix would include them in the decision.

---

## URL derivation

Fountain returns a value such as:

```text
episode:id:abc123
```

`Build Fountain Published Result` removes only the leading `episode:id:` prefix and creates:

```text
https://fountain.fm/episode/abc123
```

If `item.fountain_id` is empty, `Build Fountain Published Result` throws `Fountain reports the item as PUBLISHED but did not return fountain_id.` Its error output routes into `Build Fountain Reconcile Failure`, so no empty URL is stored and no success notification is sent.

---

## Failure behavior

There are three local failure entry points:

1. Fountain returned `item.status = ERROR`.
2. `Load Fountain Scheduled Item` exhausted its retries and emitted an error item.
3. Fountain returned `item.status = PUBLISHED` without `item.fountain_id`, causing `Build Fountain Published Result` to emit an error item.

`Build Fountain Reconcile Failure` chooses the first available message across string and object error shapes (`item.error`, a string `error`, `error.message`, `error.description`, `message`) and otherwise falls back to `Fountain reported an item error.`. It HTML-escapes the Episode ID and readable reason for Telegram, adds an `<b>Execution:</b>` line built from `$execution.id`, and stores `JSON.stringify($json).slice(0, 9000)` as `Raw Error`.

The failure path then writes:

- Publication `Status = Failed`
- Publication `Error =` readable reason
- Publication `Raw Error =` serialized Fountain or n8n error
- Episode `Status = Publishing Failed`

Finally it sends the team a message that includes the Episode ID and an `Execution:` line in a `<code>` block and asks the operator to:

1. Review and correct the Fountain item.
2. Set the Publication `Status` back to `Pending`.
3. Move the Episode back into `Ready for Publishing`.

This workflow does not reschedule a failed row. Recovery is handed back to the upstream Fountain scheduling workflow, whose guard starts only when the Publication is missing or `Pending`.

Failures from nodes other than `Load Fountain Scheduled Item` and `Build Fountain Published Result` use the workflow-level error handler because those nodes do not have local error outputs. A failure while writing failure state can therefore leave Airtable only partly updated. For example, the Publication may be `Failed` while the Episode write or Telegram send failed afterward.

---

## Retry behavior

Repeat-safe Airtable requests and the Fountain item GET use `Retry On Fail` with 5 tries and 5 seconds between tries:

- `Fetch Fountain Settings`
- `Fetch Due Fountain Publications`
- `Load Fountain Scheduled Item`
- `Mark Fountain Published`
- `Fetch Episode Publications`
- `Update Episode Publication Status`
- `Mark Reconciled Fountain Failed`
- `Mark Reconciled Episode Failed`

Both Telegram sends use 4 tries with 5 seconds between tries.

The workflow has no create or upload requests. Its writes set explicit values on existing Airtable records, so repeating them is safe.

---

## Node flow

```text
Every 15 Minutes
  -> Fetch Fountain Settings
  -> Fetch Due Fountain Publications
  -> Expand Due Fountain Publications
  -> Load Fountain Scheduled Item
       HTTP error -> Build Fountain Reconcile Failure
       success    -> Fountain Item Error
                       true  -> Build Fountain Reconcile Failure
                       false -> Fountain Item Published
                                  false -> end; check again next run
                                  true  -> Build Fountain Published Result
                                        error -> Build Fountain Reconcile Failure
                                        success -> Mark Fountain Published
                                        -> Fetch Episode Publications
                                        -> Decide Episode Publication Status
                                        -> Update Episode Publication Status
                                        -> Notify Fountain Published

Build Fountain Reconcile Failure
  -> Mark Reconciled Fountain Failed
  -> Mark Reconciled Episode Failed
  -> Notify Fountain Reconcile Failure
```

---

## Setup checklist

1. Confirm a single `Publishing Settings` row has `Platform = Fountain`, `Enabled` checked, and the correct `Feed ID`.
2. Confirm `FOUNTAIN_API_KEY` remains bound to `Load Fountain Scheduled Item`.
3. Confirm all seven Airtable HTTP Request nodes use `Airtable [n8n] (PAT)`.
4. Confirm both Telegram nodes use `Telegram [pod21_n8n_agent_bot]`.
5. Add Episode Status options `Partially Published` and `Publishing Failed`, or deliberately accept Airtable creating them through `typecast: true`.
6. Confirm the global error workflow `9PMI1kuBjLW2YHwb` still exists.
7. Keep the timeout at 900 seconds or ensure one run cannot overlap the next 15-minute tick.
8. Test with a controlled Fountain item and Publication row, not a real release first.

---

## Post-push ritual

Every push of this SDK source must be followed by all of these steps:

1. Pull the live workflow first and structurally diff it against this file. Live remains the source of truth.
2. Push only after resolving any drift.
3. Publish the draft in n8n. A saved draft is not the running version.
4. Confirm the workflow is Active. The snapshot documented here was inactive.
5. Confirm `availableInMCP` is still enabled if this workflow is intended to be exposed there.
6. Rebind all seven Airtable HTTP Request nodes to `Airtable [n8n] (PAT)`.
7. Rebind `Load Fountain Scheduled Item` to `FOUNTAIN_API_KEY`; SDK pushes skip HTTP Request credential assignment on this instance.
8. Verify both Telegram nodes still use `Telegram [pod21_n8n_agent_bot]`.
9. Confirm the schedule is every 15 minutes with misfires skipped.
10. Confirm workflow settings still include timezone `America/New_York`, timeout `900`, saved execution progress, and error workflow `9PMI1kuBjLW2YHwb`.
11. Pull the workflow again and compare all 17 node parameters, retry/error settings, credential presence, settings, and connections against the source.
12. Test one due `PUBLISHED` item, one due non-final item, and one controlled error item. Confirm every Telegram message includes the `BA-xxxx` ID.

Unlike an Airtable polling trigger, the Schedule Trigger does not need a fresh record flip after publishing. The test Publication must simply be `Scheduled`, have a past `Scheduled For`, and contain valid Episode and Fountain item IDs.

---

## Known concerns

- The live workflow is inactive and unpublished, so no deployed run history proves the full path.
- `FOUNTAIN_API_KEY` is bound in the live draft, but must be rebound after each SDK push.
- Episode statuses `Partially Published` and `Publishing Failed` are not current select choices.
- The due query returns at most 100 Publications and does not follow Airtable pagination.
- Missing Episode or Platform Item IDs are silently skipped, leaving the Publication `Scheduled` indefinitely.
- Missing or disabled Fountain settings end the whole run successfully without marking due Publications or notifying anyone.
- Publication-to-Episode aggregation matches the `Publication` text prefix rather than the linked Episode field.
- Non-`ERROR`, non-`PUBLISHED` Fountain states remain `Scheduled` forever unless Fountain eventually changes state or a human intervenes.
- The Fountain lookup and published-result builder have local error branches. Later Airtable or Telegram failures go to the global error workflow and can leave partially written state.

---

## Related

- Upstream Fountain scheduler: `n8n_workflow_readmes/BA - Ready for Publishing View Entered > Fountain Scheduled.md`
- Shared workflow rules: `n8n_workflow_readmes/CONVENTIONS.md`
- Canonical pipeline map: `workflow_planning/System Map.md`
- Build status and publishing roadmap: `workflow_planning/Guys Take Build Status.md`
