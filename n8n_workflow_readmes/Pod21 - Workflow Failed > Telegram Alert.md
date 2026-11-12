# Pod21: Workflow Failed > Telegram Alert

> **2026-11-12 - Telegram messages restyled to `TELEGRAM-STYLE.md` (LIVE, published).** Status emoji first, blank-line blocks, BA- codes only, no `rec...` ids, machine payloads behind a spoiler. Wording and structure only: no trigger, logic, credential or output change. Audit with `scripts/query/telegram-style-audit.sh`.

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `9PMI1kuBjLW2YHwb`.)
> Built 2026-07-06 as `Ops - Workflow Failed > Telegram Alert`; renamed by Jonny to the `Pod21:` prefix the same day (infra workflows use `Pod21:`, not a separate `Ops` prefix). Ops Log append added 2026-07-06. Phase 0.1 + first half of 0.2 of the Content Machine roadmap (`workflow_planning/Guys Take Build Status.md`).
> **2026-09-30, transient-DNS filter.** Added the `Is Alertable?` If node. Trigger-level transient DNS failures (the `EAI_AGAIN` blips from the Airtable pollers) are now logged to the Ops Log but **not** sent to Telegram. Real failures still alert.
> **2026-10-05, the `No bridge acquired` trigger alerts were an instance-level n8n bug, now fixed at the source.** Between 2026-09-24 and 2026-10-05 this handler paged on `trigger poll` / `No bridge acquired for this context. Call acquire() first.` from the Airtable pollers (Thumbnail Artwork and Script Generation, at the same wall-clock minutes). That error was **not** one of the benign DNS blips, so `Is Alertable?` correctly let it through. Root cause: the n8n instance ran the experimental `vm` expression engine, whose sandbox bridge is not held during a poll. Fixed on the host by setting `N8N_EXPRESSION_ENGINE=legacy` on the n8n container (`/opt/n8n/docker-compose.override.yml`, then `docker compose up -d`). The benign `EAI_AGAIN` / `getaddrinfo` suppression is unchanged and still needed. Do **not** add `No bridge acquired` to that filter: it was a genuine failure, and suppressing it would have hidden a real problem.
> **2026-11-10, Telegram rate limits are suppressed.** A single Frame.io upload burst throttled the group, so ~126 notification nodes failed with `Too Many Requests: retry after 30` and each failure alerted here — into the same throttled group. 109 of those alerts then failed too. `Build Alert Message` now sets `alertMode = silent` for any `Too Many Requests` / `retry after` / `429` error, so it goes to the Ops Log only, and `Send Alert to Group` is `onError: continueRegularOutput` so a failed send still reaches the log.

---

## TL;DR

The instance-wide **global error handler**. Any workflow that sets this as its **Error Workflow** (Workflow Settings → Error Workflow) does two things whenever it fails:

1. Posts a Telegram alert to the team group: workflow name, failed node, error message, execution ID + link.
2. Appends an `Error` row to the **Ops Log** Airtable table, the machine's queryable history (readable by the Telegram Assistant).

Five nodes: **Error Trigger → Build Alert Message (Code) → Is Alertable? (If)**. The If node's **true** branch runs **Send Alert to Group (Telegram) → Log Error to Ops Log (Airtable)**; its **false** branch skips Telegram and runs **Log Error to Ops Log (Airtable)** alone. So a real failure alerts + logs, and a benign transient DNS failure logs silently.

Before this existed, only the GitHub backup workflow notified on failure; every other workflow failed silently into the executions list.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Error Trigger (fires when a workflow that references this one as its Error Workflow fails) |
| **Telegram destination** | Team group `-5254203539`, `parse_mode: HTML`, attribution off, link previews off, Retry On Fail |
| **Ops Log destination** | Base `appwcz1Bux9YLcZYm` (separate ops base, NOT the Guy's Take content base), table `tblgBjxgIKpje5q0S`. Writes `Event`, `Workflow`, `Type: Error`, `Execution URL` (`Timestamp` is a Created-time field, auto). Suppressed rows append ` (benign DNS, suppressed)` or ` (Telegram rate limit, suppressed)` to `Event`. This table has **no `Detail` field** |
| **Order** | On the alert path Telegram runs first, then the log; the log node is `onError: continueRegularOutput`, so a broken log can never block an alert. The suppressed path reaches the log directly |
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
- [x] `BA: Guy's Take Thumbnail Artwork` (`mLAn4ya2AmZoHDUk`): wired (confirmed 2026-09-30: its DNS-blip alerts fire through this handler).
- [ ] `Airtable - View to Published` (`7O9z3UwcUOkHjAC2`)
- [x] `BA: Telegram Airtable Assistant` (`Hx8Ul6M41fM8HuxU`)
- [x] `pod21: n8n Githup Backups` (`spXF48NOXJYaDfnz`) — keep its own inline failure DM too; belt and braces
- [x] `Calendly Bookings` (`VPjMyEdiiEobpskU`) — archived 2026-09-29 (superseded by `AgentMail Received > Episode Scheduling`, `DFkl8armVlXqBWWD`, which has the error workflow wired)
- [ ] **New workflows:** wiring this setting is part of the standard post-build checklist from now on

---

## How it works (node by node)

1. **Workflow Errored** (Error Trigger) — receives the failing execution's context. Payload shape: `{ execution: { id, url, lastNodeExecuted, mode, error: { message } }, workflow: { id, name } }`. Trigger-level failures (a trigger node itself crashing) arrive with a `trigger.error` shape instead; the Code node handles both.
2. **Build Alert Message** (Code, run once for all items): emits the HTML-escaped Telegram `message` plus raw structured fields (`event`, `workflowName`, `failedNode`, `errorMessage`, `executionUrl`, `alertMode`) for downstream nodes. `alertMode` is `alert` for a real failure and `silent` for a benign transient DNS blip or a Telegram rate limit. For a trigger-level failure (no execution) it sets `failedNode = trigger poll` and says why there is no execution ID. Missing fields degrade to `unknown` / `n/a`, never crash.
3. **Is Alertable?** (If): routes on `alertMode`: `alert` → Telegram; `silent` → straight to the Ops Log, no Telegram.
4. **Send Alert to Group** (Telegram `sendMessage`): posts to `-5254203539` with `parse_mode: HTML`, attribution and link previews off, **Retry On Fail** (rides out the host's transient `EAI_AGAIN` DNS blips).
5. **Log Error to Ops Log** (Airtable create): writes `Event` = "<workflow> failed", `Workflow`, `Type` = `Error`, `Execution URL`, into `appwcz1Bux9YLcZYm` / `tblgBjxgIKpje5q0S`. Suppressed DNS rows append ` (benign DNS, suppressed)` to `Event`. Reads the structured fields via `$('Build Alert Message').item.json.*` (the Telegram node's output replaced the flowing item). `typecast: true`, `onError: continueRegularOutput`, Retry On Fail.

---

## Gotchas / notes

- **Transient DNS blips are suppressed (added 2026-09-30).** The polling-trigger workflows (Script Generation, Thumbnail Artwork) check Airtable every minute, and the host intermittently fails to resolve `api.airtable.com` (`getaddrinfo EAI_AGAIN`). That fails *inside the trigger, before n8n creates an execution*, so the alert arrived with no execution ID and `Failed node: unknown` (verified on execution 3188). The handler now detects a trigger-level DNS error (`EAI_AGAIN`, `getaddrinfo`, `ENOTFOUND`, "DNS server returned an error"), sets `alertMode = silent`, and logs the row without a Telegram ping. Real failures still alert. To widen or narrow what counts as benign, edit the regex in `Build Alert Message`.
- **Telegram rate limits are suppressed (added 2026-11-10).** A node that fails with `Too Many Requests` / `retry after N` / HTTP 429 is a symptom of message volume, so alerting about it adds volume to a group that is already throttled. `Build Alert Message` sets `alertMode = silent` for those, and the Ops Log row's `Event` records `(Telegram rate limit, suppressed)`. `Send Alert to Group` is also `onError: continueRegularOutput`: before that, a failed send aborted the run and the Ops Log write never happened, so a throttled alert left no trace anywhere.
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
