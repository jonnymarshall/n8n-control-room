# Pod21: Weekly Bitcoin Podcast Episode Import

> Workflow ID: `sqkxLdtSzTQqLC1m`. The workflow is currently inactive.

## TL;DR

Every Monday at 8am America/New_York, this workflow is designed to:

1. Read active competitors with a YouTube or podcast RSS URL from `Bitcoin Podcasts`.
2. Fetch each RSS feed without a paid API.
3. Store up to 15 recent items per feed in `Bitcoin Podcast Episodes`.
4. Upsert episodes by URL so reruns do not create duplicates.
5. Update the source competitor row with the latest episode date, feed item count, highest-view episode, average YouTube views, and last checked time.

## Airtable schema

| Table | ID | Purpose |
|---|---|---|
| `Bitcoin Podcasts` | `tbl9ljNAHwSEQ1FbV` | Competitor directory and RSS configuration in the Pod21 Airtable base `appwcz1Bux9YLcZYm` |
| `Bitcoin Podcast Episodes` | `tblnSita8c8hGwTgV` | One row per imported episode or YouTube video in the Pod21 Airtable base `appwcz1Bux9YLcZYm` |

Episode table fields:

- `Title`
- `Podcast` link to `Bitcoin Podcasts`
- `Platform` (`YouTube` or `Podcast`)
- `URL` (upsert key)
- `Published`
- `Views`
- `Description`
- `Source RSS URL`
- `YouTube Video ID`
- `Last Checked At`

## Workflow nodes

1. `Every Monday 8am`
2. `Find Podcasts With RSS`
3. `Emit Feed Requests`
4. `Fetch RSS`
5. `Parse RSS XML`
6. `Flatten Feed Items`
7. `Upsert Podcast Episode`
8. `Summarize Podcast Updates`
9. `Update Podcast Summary`

The `Fetch RSS` node now continues on request errors, and `RSS Response Available`
routes only responses with a non-empty RSS body to the XML parser. A transient or
broken feed is therefore skipped instead of aborting the entire import.

The workflow reads both RSS fields when present. YouTube feeds use `media:statistics.views`; podcast feeds have no view count and write `0`.

## Current status

- Created as a new inactive workflow.
- Migrated from the Bitcoin Audible base `app8Xw9Tq0XLjhmp9` to the Pod21 base `appwcz1Bux9YLcZYm` on 2026-09-28.
- Workflow validation passes with 10 nodes, 9 valid connections, and no validation warnings.
- The first manual UI run reached `Fetch RSS` but stopped on item 7 because YouTube returned HTTP 500 for the Robin Seyr feed (`UCYEu3XGuHQy65iJpnzMIRrQ`) after three retries.
- The workflow was patched to skip failed RSS responses and validation still passes with 10 nodes and 9 valid connections.
- A successful import run was previously verified against the old base. A fresh manual test against the Pod21 base is still needed before activation.

## Activation checklist

1. Review the Airtable mappings in `Find Podcasts With RSS`, `Upsert Podcast Episode`, and `Update Podcast Summary`.
2. Manually run the workflow from the n8n UI with the workflow still inactive, if the UI permits a manual test.
3. Confirm records appear in `Bitcoin Podcast Episodes` and links point to the correct competitor rows.
4. Confirm `URL` upserts on a second run.
5. Activate the workflow only after the manual run succeeds.

## Important constraints

- The existing `BA: Guy's Take Weekly Research & Shortlisting` workflow was not modified.
- No YouTube API key is required.
- Airtable is the state store; the workflow does not call another workflow.
- The HTTP Request node has retry enabled for transient RSS failures.
