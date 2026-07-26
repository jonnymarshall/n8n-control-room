# Airtable - View to Published

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `7O9z3UwcUOkHjAC2`.)
> Built 2026-06-25. Active.

---

## TL;DR

This workflow automatically sets the `Status` field to **Ready to Publish** whenever an episode enters the specified Airtable view. It polls the Episodes table every minute, detects records appearing in view `viwDfPHHKrgggdw20`, and updates their status in one step.

Two nodes, linear: **Airtable Trigger (view changes) → Update Status to Ready to Publish.**

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Airtable Trigger on `Episodes` table, every minute, on `Last Modified Time`, scoped to view `viwDfPHHKrgggdw20` |
| **Polling interval** | Every minute |
| **Fields included** | `ID`, `Status`, `Last Modified Time` |
| **Action** | Update `Status` field to `Ready to Publish` for each triggered record |
| **Match field** | Record `id` (automatic) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |
| **Table** | `tbl3uYLIvtB9APZp6` (Episodes) |
| **View** | `viwDfPHHKrgggdw20` (the target filter) |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Trigger + Update node |

Both nodes auto-assign the PAT credential on creation.

---

## How it works (node by node)

1. **Episode Status Changes** — Airtable Trigger. Polls the Episodes table every minute, monitoring the `Last Modified Time` field. Scope is restricted to view `viwDfPHHKrgggdw20` (via `additionalFields.viewId`), so only records in that view trigger the workflow. Output includes all fields specified in `additionalFields.fields`: `ID`, `Status`, `Last Modified Time`.

2. **Set Status to Ready to Publish** — Airtable Update node. Receives the triggered record(s) and updates their `Status` field to `Ready to Publish`. Matches on the record's `id` field (automatic primary key matching). Typecast is enabled to handle status value type conversion.

---

## Setup notes

- **View requirement:** The workflow is hardcoded to watch view `viwDfPHHKrgggdw20`. Changing the view scope requires editing the trigger node's `additionalFields.viewId` parameter.
- **Status field:** The workflow assumes a `Status` single-select field exists in the Episodes table. The value `Ready to Publish` must be a valid option in that select list.
- **Trigger field:** The trigger monitors `Last Modified Time`. This field is auto-generated in Airtable and tracks any modification to the record. The view filter + Last Modified Time cursor combination prevents re-triggering of already-processed records.
- **Polling cadence:** Set to every minute. If you need frequent updates, 1 minute is the minimum safe interval. Longer intervals (hourly, daily) are more efficient for low-volume workflows.

---

## Gotchas

- **View-based scoping does NOT prevent re-triggering.** If a record is updated while still in the view, `Last Modified Time` advances and the trigger fires again. Solution: move processed records out of the view manually, or add a separate workflow step to move them to a "completed" view. [[airtable-trigger-polling-cursor]]
- **Status field case-sensitivity:** The value `Ready to Publish` is case-sensitive. If your Status select options use different casing, the update will fail. Verify the exact case matches the Airtable field options.
- **Empty view is safe.** If the view has no matching records, the trigger simply outputs nothing and the workflow has no effect. No error is raised.
- **Concurrent updates:** If multiple episodes enter the view in the same polling cycle, the update runs once per record (not batched). For large bulk operations, increase the polling interval to avoid flooding the API.

---

## Related

- **BA - Guy's Take Script Generation** — upstream workflow that creates Episodes records.
- **BA - Guy's Take Thumbnail Artwork** — coordinates on the Episodes table; shares the same `Status` field state machine.
- **BA - Frame.io Uploaded > AI Metadata** — metadata enrichment workflow for new episodes.
