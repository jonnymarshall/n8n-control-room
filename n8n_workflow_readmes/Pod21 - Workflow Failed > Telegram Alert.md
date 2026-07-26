# Pod21: Workflow Failed > Telegram Alert

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `9PMI1kuBjLW2YHwb`.)
> Built 2026-07-06 as `Ops - Workflow Failed > Telegram Alert`; renamed by Jonny to the `Pod21:` prefix the same day (infra workflows use `Pod21:`, not a separate `Ops` prefix). Ops Log append added 2026-07-06. Phase 0.1 + first half of 0.2 of the Content Machine roadmap (`workflow_planning/Guys Take Build Status.md`).

---

## TL;DR

The instance-wide **global error handler**. Any workflow that sets this as its **Error Workflow** (Workflow Settings → Error Workflow) does two things whenever it fails:

1. Posts a Telegram alert to the team group: workflow name, failed node, error message, execution ID + link.
2. Appends an `Error` row to the **Ops Log** Airtable table, the machine's queryable history (readable by the Telegram Assistant).

Four nodes, linear: **Error Trigger → Build Alert Message (Code) → Send Alert to Group (Telegram) → Log Error to Ops Log (Airtable)**.

Before this existed, only the GitHub backup workflow notified on failure; every other workflow failed silently into the executions list.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Error Trigger (fires when a workflow that references this one as its Error Workflow fails) |
| **Telegram destination** | Team group `-5254203539`, `parse_mode: HTML`, attribution off, link previews off, Retry On Fail |
| **Ops Log destination** | Base `appwcz1Bux9YLcZYm` (separate ops base, NOT the Guy's Take content base), table `tblgBjxgIKpje5q0S`. Writes `Event`, `Workflow`, `Type: Error`, `Detail`, `Execution URL` (`Timestamp` is a Created-time field, auto) |
| **Order** | Telegram FIRST, log second, and the log node is `onError: continueRegularOutput` — a broken log can never block the alert |
| **Active?** | Yes (activated by Jonny). Error-trigger workflows run when referenced regardless, but active + published is the safe state |
| **Coverage** | Only workflows whose Settings → Error Workflow points here. See wiring below |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Send Alert to Group` | auto-assigned on build ✓ (spot-check after any future push) |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Log Error to Ops Log` | auto-assigned on update ✓ |

⚠️ **PAT scope:** the Airtable PAT must be granted access to base **`appwcz1Bux9YLcZYm`** (`data.records:read` + `data.records:write`), or the log write 403s on every error. (The alert still sends — the log node soft-fails — so a scope problem is invisible unless you check the Ops Log or the node run.) Granting the PAT access also makes the log readable to the Telegram Assistant with no other change.

The bot must be a member of group `-5254203539` with permission to post (it already is).

---

## Wiring (the part that is NOT automatic)

The Error Trigger only fires for workflows that explicitly reference this workflow. For **every active workflow**, open it in the n8n UI → ⋯ → **Settings → Error Workflow** → select `Pod21: Workflow Failed > Telegram Alert`.

⚠️ **Do this in the UI, not via the REST API.** `PUT /workflows/{id}` deactivates the workflow and strips its `availableInMCP` toggle, so wiring 8 workflows by API would take them all down.

Wiring checklist (active workflows as of 2026-07-06):

- [x] `BA: Guy's Take Weekly Research & Shortlisting` (`Z9dDjafBA899Hgok`)
- [x] `BA: Guy's Take Script Generation` (`q80QVMszf2iOfwIy`)
- [x] `BA - Frame.io Uploaded > AI Metadata` (`jroXHciDvy0sWlRM`)
- [ ] `BA: Guy's Take Thumbnail Artwork` (`mLAn4ya2AmZoHDUk`) — ⚠️ **re-wire needed:** was wired on the old `YyXiJ0lusoW7ynu9` (now archived); the SDK rebuild is a new workflow and does NOT inherit the Error Workflow setting. Set it in the new workflow's Settings.
- [ ] `Airtable - View to Published` (`7O9z3UwcUOkHjAC2`)
- [x] `BA: Telegram Airtable Assistant` (`Hx8Ul6M41fM8HuxU`)
- [x] `pod21: n8n Githup Backups` (`spXF48NOXJYaDfnz`) — keep its own inline failure DM too; belt and braces
- [ ] `Calendly Bookings` (`VPjMyEdiiEobpskU`) — optional, not content-machine
- [ ] **New workflows:** wiring this setting is part of the standard post-build checklist from now on

---

## How it works (node by node)

1. **Workflow Errored** (Error Trigger) — receives the failing execution's context. Payload shape: `{ execution: { id, url, lastNodeExecuted, mode, error: { message } }, workflow: { id, name } }`. Trigger-level failures (a trigger node itself crashing) arrive with a `trigger.error` shape instead; the Code node handles both.
2. **Build Alert Message** (Code, run once for all items) — emits both the HTML-escaped Telegram `message` (workflow, failed node, error, execution ID in a `<code>` block, URL) **and** raw structured fields (`event`, `workflowName`, `failedNode`, `errorMessage`, `executionUrl`) for the Airtable write. Missing fields degrade to `unknown` / `n/a`, never crash.
3. **Send Alert to Group** (Telegram `sendMessage`) — posts to `-5254203539` with `parse_mode: HTML`, attribution and link previews off, **Retry On Fail** (rides out the host's transient `EAI_AGAIN` DNS blips).
4. **Log Error to Ops Log** (Airtable create) — writes `Event` = "<workflow> failed", `Workflow`, `Type` = `Error`, `Detail` = "Failed node: X. <error message>", `Execution URL`, into `appwcz1Bux9YLcZYm` / `tblgBjxgIKpje5q0S`. Reads the structured fields via `$('Build Alert Message').item.json.*` (the Telegram node's output replaced the flowing item). `typecast: true`, `onError: continueRegularOutput`, Retry On Fail.

---

## Gotchas / notes

- **`onError: continueRegularOutput` nodes never reach this handler.** Deliberate soft-fails in other workflows (e.g. `Store Duration`, `Reject Siblings`) are swallowed by design; this workflow only sees *unhandled* failures. Don't "fix" that.
- **The record-ID convention doesn't apply here** (no episode record in an error context); the unique anchor is the **execution ID** in a `<code>` block. The PostToolUse hook false-positives on this workflow's Telegram node — expected.
- **Ops Log `Type` options are capitalized**: `Completed` / `Skipped` / `Error` / `Heartbeat`. This workflow writes `Error`. With `typecast: true` a mismatched casing would silently create a duplicate select option — keep the casing exact when adding future writers.
- **If this workflow itself fails** (e.g. Telegram unreachable beyond the retries), there is no meta-handler; the failure sits in its own execution list. Do NOT set this workflow's Error Workflow setting to itself (infinite loop).
- **A failing Ops Log write is invisible by design** (alert still sends). If rows stop appearing, check the PAT's access to `appwcz1Bux9YLcZYm` first.
- **Test procedure:** add a temporary Code node that throws (`throw new Error('test')`) to any wired workflow, run it, confirm the group message AND the Ops Log row, remove the node. If a manual test doesn't fire the error workflow, trigger the erroring workflow via a production execution once (some n8n versions only invoke error workflows for production runs).

---

## Related

- **Roadmap:** `workflow_planning/Guys Take Build Status.md` — Phase 0.1 (this), 0.2 (`Ops Log` rollout to all workflows), 0.3 (watchdog digest — its planned host `Pod21: Daily Reminders` was deleted 2026-07-21; needs a new home).
- **Sibling notifier:** `Pod21: n8n GitHub Backups` (`Pod21 - n8n GitHub Backups.md`) — has its own per-node failure DM wiring, predating this handler.
