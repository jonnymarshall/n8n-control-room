# BA - Publish Readiness View Entered > Telegram Checklist

> **2026-11-12 - status guard added (LIVE, published `f7d3e58d`).** The checklist now skips any episode that is already at or past the publishing handover, so the scheduler's and publisher's own status writes stop re-firing it. Before this, `BA-DCvtat` produced **six** "Ready to publish?" messages in one morning, including one 36 seconds after the "Fountain episode published" message. The guard is one `if` in `Build Checklist`; no trigger, connection, credential or message-wording change. `versionId` = `activeVersionId`; still active; `availableInMCP` still set; Airtable and Telegram bindings intact. SDK snapshot refreshed, and the accidentally duplicated auto-named snapshot (`publish-readiness-view-entered-telegram-checklist.sdk.js`) was deleted so only one file represents this workflow.
>
> **Same day, view tightened.** The `Publish Readiness Nudge` view (`viwcMtlZm687luVei`) now also carries `Status is none of` the same seven handover statuses. Before that it admitted the episode at every stage, which is what produced the six runs. The view is hand-maintained and Airtable's API cannot read filters, so treat the code guard as the durable fix and the filter as the first line of defence.
>
> This readme is written after the fact: the workflow went live on 2026-11-10 and had no readme until this change.

**Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `RATBwwfOlRDPDHeN`.

Local SDK source: `scripts/deploy/workflows/guys-take-publish-readiness.sdk.js`

Live state as of 2026-11-12: **active**, version `f7d3e58d-7bc6-4ad9-a2a8-8ecbe6039d9c` (also the active published version). Three nodes: Airtable trigger, one Code node, one Telegram send.

---

## Purpose

Tell Jonny when an episode has everything the Fountain publisher needs, instead of making him remember to check. The message is a checklist, not an action:

- it lists every satisfied requirement with a green tick,
- it names anything still missing with a warning sign,
- and it repeats that the `Status = Ready to Publish` flip stays manual.

Nothing in this workflow writes to Airtable. The flip is the human's job, and setting it is what starts the publisher.

This is stage 4b in `workflow_planning/System Map.md`.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `RATBwwfOlRDPDHeN` |
| Trigger | Airtable Trigger, once per minute |
| Airtable base | Guy's Take, `app8Xw9Tq0XLjhmp9` |
| Trigger table | Episodes, `tbl3uYLIvtB9APZp6` |
| Trigger view | `Publish Readiness Nudge`, `viwcMtlZm687luVei` |
| Trigger field | `Last Modified Time` (`fld3Z4xdI4s2wVnLa`) |
| Trigger Fields list | Empty, so the whole record is returned |
| Status transition | None. This workflow only reads. |
| Notification destination | Telegram team group `-5254203539` |
| Error workflow | `Pod21: Workflow Failed > Telegram Alert`, `9PMI1kuBjLW2YHwb` |
| Retries | Trigger 5 tries, 5s apart. Telegram 4 tries, 5s apart. |

---

## Nodes

1. **Publish Readiness Nudge** (`n8n-nodes-base.airtableTrigger`, v1). Polls the Episodes table every minute, scoped to the `Publish Readiness Nudge` view, using `Last Modified Time` as the cursor field.
2. **Build Checklist** (`n8n-nodes-base.code`, v2). Turns each returned record into one Telegram message. Skips rows that are already handed over (see below).
3. **Send Checklist** (`n8n-nodes-base.telegram`, v1.2). Sends `{{ $json.text }}` as HTML to the team group.

---

## Trigger behaviour and its known trap

The Airtable Trigger node cannot detect "a record entered this view". It polls for records **modified** since its last check, filtered to the view. So the workflow's practical rule is:

> any update to an episode that is currently in the `Publish Readiness Nudge` view produces a checklist.

That is why the view's filter matters so much. On 2026-11-12 the trigger returned the same episode at `Artwork Ready`, `Ready to Publish`, `Publishing`, `Scheduled to Publish` and `Published`, one message per write. The view now ends with:

- `Status` **is none of** `Ready to Publish`, `Publishing`, `Scheduled to Publish`, `Publishing Failed`, `Partially Published`, `Published`, `Suspended`.

It must sit in an **AND** group (`Where all of the following are true`). In an OR group the exclusion is meaningless, because the other conditions still admit the row. Airtable's API cannot read view filters, so the only way to inspect this is the Airtable UI. The code-side guard below repeats the same list as a backstop, because the filter is maintained by hand and can drift again.

A second, unavoidable consequence of a polling trigger: after a publish the cursor re-baselines to roughly "now". A row that is already sitting in the view will not fire anything until it is written to again, so an empty execution list is not proof the workflow is broken.

---

## The status guard

`Build Checklist` skips a row when its `Status` is one of:

- `Ready to Publish`
- `Publishing`
- `Scheduled to Publish`
- `Publishing Failed`
- `Partially Published`
- `Published`
- `Suspended`

The list is deliberately a deny list, so an earlier or unknown status still nudges rather than going silent. Comparison is exact after trimming, and the values match the `Episodes.Status` option names.

The view filter carries the same seven exclusions, so in normal operation the trigger never returns a handed-over row at all. The guard still matters for three cases: the view filter being edited or removed by hand, a new post-handover status being added to `Episodes.Status` and not to the list, and any future move back to a view-less trigger. **If a new "done" status is added to the pipeline, add it in both places**: the view condition and the `HANDED_OVER` array.

When every input row is skipped the node returns an empty array, which ends the execution without sending a Telegram message.

---

## What the message checks

Read from the trigger record: `Title`, `Summary`, `Chapters`, `Thumbnail Caption`, `1x1 Thumbnail Count` (rollup), `Video Quality OK` plus `Video Resolution`, and `Release Date`. All values are HTML-escaped before they reach Telegram.

The message follows `TELEGRAM-STYLE.md`: one status emoji, blank-line blocks, the `BA-` id inside `<code>`, no `rec...` ids, and the workflow/execution reference on the last line. There is no machine-parsed payload, so no spoiler block is needed.

Run `scripts/query/telegram-style-audit.sh` after changing the wording.

---

## Credentials

| Credential | Live reference | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi`, live credential ID `04Sw0cnSlBkB6Y3s` | `Publish Readiness Nudge` |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi`, live credential ID `INjDc84OskDdqiNR` | `Send Checklist` |

Verify both are still bound after any push. There are no HTTP Request nodes in this workflow, so nothing else needs rebinding.

---

## Verification notes

- The guard was exercised off-server against a sample record for every status above: only the pre-handover statuses (and a blank status) produced a message.
- The message body was checked for the same output shape as the live 2026-11-12 messages.
- The view filter was added by hand on 2026-11-12 and cannot be read back through the API. Confirm it in the Airtable UI, and confirm BA-DCvtat (currently `Published`) has left the view.
- A polling trigger cannot be fresh-flip tested against a row that is already in the view. To exercise the end-to-end behaviour, edit an episode that is already `Published`: the view should now hide it, and even if it does not, the execution must end with no Telegram message.
- `./scripts/query/sdk-drift.sh` must say `OK` for `guys-take-publish-readiness.sdk.js` after publishing.

---

## Related

- `BA - Ready for Publishing View Entered > Fountain Scheduled.md` - the publisher that runs after the human flip.
- `workflow_planning/Guys Take Build Status.md` item 8a - the original design note.
