# Pod21: Workflow Failed > Telegram Alert

> **2026-11-27, upstream 5xx bursts are throttled and the log carries the detail (LIVE, published).** An Airtable incident made every poller fail for seven minutes and the handler sent 84 messages, one per failed poll. Any 5xx is now classified `check5xx`. A new `Find Recent Upstream Alert` search looks for an `(upstream 5xx)` row in the Ops Log from the last 15 minutes, and `Already Alerted?` suppresses the Telegram message when one exists. The first 5xx still alerts, then at most one repeat per 15 minutes. Every failure is still logged, and the Ops Log gained a `Detail` field (failed node, HTTP code, error, trigger-level, execution). The Telegram message now carries the HTTP code too, which it used to drop for node-level errors. If the Ops Log search itself fails (a total Airtable outage), that branch goes straight to the log and stays quiet rather than flooding. The Ops Log write is in a separate base, so it survived the 2026-11-27 content-base incident.

> **2026-11-23, harmless pre-flight regex timeouts now say so (LIVE, published).** n8n's regex guard (n8n-workflow 2.35+) gives every regex a hardcoded 250ms wall-clock budget, so a brief CPU stall can trip it while n8n validates the workflow's settings, **before any node runs**. The alert still fires, but `Build Alert Message` now spots that shape (`Regular expression execution timed out` with `Failed node: unknown`), titles it **Workflow failed (harmless, nothing to fix)**, says no step ran and a scheduled workflow will simply try again on its next run, and appends `(harmless, no action)` to the Ops Log `Event`. A regex timeout *inside* a node (for example `Validate Transcript Quality`) still alerts normally, because that one can drop work. Nothing to fix: the n8n timeout is not configurable, and the instance-level lever is CPU headroom.

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

Five nodes became eight on 2026-11-27: **Error Trigger → Build Alert Message (Code) → Upstream 5xx? (If)**. A non-5xx error goes to the original **Is Alertable? (If)**: its **true** branch runs **Send Alert to Group (Telegram) → Log Error to Ops Log (Airtable)**, and its **false** branch skips Telegram and runs **Log Error to Ops Log** alone. A 5xx goes to **Find Recent Upstream Alert (Airtable search)** → **Already Alerted? (If)**: a recent row suppresses the message and goes straight to the log; no recent row sends the alert. So a real failure alerts + logs, a benign transient DNS or rate-limit failure logs silently, and an upstream 5xx burst alerts once then logs without paging.

Before this existed, only the GitHub backup workflow notified on failure; every other workflow failed silently into the executions list.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Error Trigger (fires when a workflow that references this one as its Error Workflow fails) |
| **Telegram destination** | Team group `-5254203539`, `parse_mode: HTML`, attribution off, link previews off, Retry On Fail |
| **Ops Log destination** | Base `appwcz1Bux9YLcZYm` (separate ops base, NOT the Guy's Take content base), table `tblgBjxgIKpje5q0S`. Writes `Event`, `Workflow`, `Type: Error`, `Execution URL`, and `Detail` (`fld5vxDsND2oQXu6n`, added 2026-11-27; failed node, HTTP code, error, trigger-level, execution) (`Timestamp` is a Created-time field, auto). Suppressed rows append ` (benign DNS, suppressed)` or ` (Telegram rate limit, suppressed)` to `Event`; a harmless pre-flight regex timeout appends ` (harmless, no action)`; an upstream 5xx appends ` (upstream 5xx)` |
| **Order** | On the alert path Telegram runs first, then the log; the log node is `onError: continueRegularOutput`, so a broken log can never block an alert. The suppressed path reaches the log directly. The 5xx branch checks the log before deciding to send |
| **Active?** | Yes (activated by Jonny). Error-trigger workflows run when referenced regardless, but active + published is the safe state |
| **Coverage** | Only workflows whose Settings → Error Workflow points here. See wiring below |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Send Alert to Group` | auto-assigned on build ✓ (spot-check after any future push) |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Find Recent Upstream Alert`, `Log Error to Ops Log` | auto-assigned on update ✓ |

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
2. **Build Alert Message** (Code, run once for all items): emits the HTML-escaped Telegram `message` plus raw structured fields (`event`, `workflowName`, `failedNode`, `errorMessage`, `httpCode`, `executionUrl`, `alertMode`, `upstream5xx`, `detail`) for downstream nodes. `alertMode` is `alert` for a real failure, `silent` for a benign transient DNS blip or a Telegram rate limit, and `check5xx` for an upstream 5xx. A harmless pre-flight regex timeout stays on the alert path but is labelled and explained in the message. For a trigger-level failure (no execution) it sets `failedNode = trigger poll` and says why there is no execution ID. Missing fields degrade to `unknown` / `n/a`, never crash.
3. **Upstream 5xx?** (If): `check5xx` → the cooldown path; everything else → `Is Alertable?`.
4. **Find Recent Upstream Alert** (Airtable search): looks for one Ops Log row whose `Event` contains `(upstream 5xx)` and whose `Timestamp` is within the last 15 minutes. `onError: continueErrorOutput`: if the search itself fails (a total Airtable outage), the error output goes to the log and no Telegram message is sent.
5. **Already Alerted?** (If): a recent row → straight to the Ops Log, no Telegram; none → `Send Alert to Group`. This is the 15-minute throttle. The first 5xx of a burst alerts, later ones do not.
6. **Is Alertable?** (If): routes on `alertMode`: `alert` → Telegram; `silent` → straight to the Ops Log, no Telegram.
7. **Send Alert to Group** (Telegram `sendMessage`): posts to `-5254203539` with `parse_mode: HTML`, attribution and link previews off, **Retry On Fail** (rides out the host's transient `EAI_AGAIN` DNS blips). The text reads `$('Build Alert Message').first().json.message`, because on the 5xx path the flowing item is the Airtable search result.
8. **Log Error to Ops Log** (Airtable create): writes `Event` = "<workflow> failed", `Workflow`, `Type` = `Error`, `Execution URL`, and `Detail` (failed node, HTTP code, error, trigger-level, execution), into `appwcz1Bux9YLcZYm` / `tblgBjxgIKpje5q0S`. Suppressed DNS rows append ` (benign DNS, suppressed)` to `Event`; 5xx rows append ` (upstream 5xx)`. Reads the structured fields via `$('Build Alert Message').first().json.*`. `typecast: true`, `onError: continueRegularOutput`, Retry On Fail.

---

## Gotchas / notes

- **Transient DNS blips are suppressed (added 2026-09-30).** The polling-trigger workflows (Script Generation, Thumbnail Artwork) check Airtable every minute, and the host intermittently fails to resolve `api.airtable.com` (`getaddrinfo EAI_AGAIN`). That fails *inside the trigger, before n8n creates an execution*, so the alert arrived with no execution ID and `Failed node: unknown` (verified on execution 3188). The handler now detects a trigger-level DNS error (`EAI_AGAIN`, `getaddrinfo`, `ENOTFOUND`, "DNS server returned an error"), sets `alertMode = silent`, and logs the row without a Telegram ping. Real failures still alert. To widen or narrow what counts as benign, edit the regex in `Build Alert Message`.
- **Telegram rate limits are suppressed (added 2026-11-10).** A node that fails with `Too Many Requests` / `retry after N` / HTTP 429 is a symptom of message volume, so alerting about it adds volume to a group that is already throttled. `Build Alert Message` sets `alertMode = silent` for those, and the Ops Log row's `Event` records `(Telegram rate limit, suppressed)`. `Send Alert to Group` is also `onError: continueRegularOutput`: before that, a failed send aborted the run and the Ops Log write never happened, so a throttled alert left no trace anywhere.
- **Upstream 5xx bursts are throttled (added 2026-11-27).** On 2026-11-27 Airtable returned HTTP 500 for every request to the Guy's Take base for seven minutes. Fourteen workflows failed, 84 Ops Log rows appeared, and 84 Telegram messages went to the group, one per failed poll. `Build Alert Message` now treats `httpCode >= 500`, `SERVER_ERROR`, or "Server encountered an error while processing your request" as `check5xx`. `Find Recent Upstream Alert` reads the Ops Log for an `(upstream 5xx)` row in the last 15 minutes; if one exists, `Already Alerted?` logs the new failure but sends no Telegram. So a burst produces the first alert, at most one repeat every 15 minutes, and a complete log. The alert also names the HTTP code now; before, a node-level 500 printed only "The service was not able to process your request".
- **A total Airtable outage is deliberately quiet.** The cooldown check lives in the Ops Log base (`appwcz1Bux9YLcZYm`), which is separate from the content base and survived the 2026-11-27 incident. If that base is also unreachable, `Find Recent Upstream Alert` uses its error output, which goes straight to `Log Error to Ops Log` and sends nothing. That trades a possible silent outage for never repeating the 2026-11-27 storm. The Ops Log will show the failed search once it recovers.
- **The Ops Log `Detail` field is load-bearing for diagnosis (added 2026-11-27).** It carries the failed node, HTTP code, error text, whether the failure was trigger-level, and the execution id/URL. Before it existed, Charlie's assistant could see 84 "X failed" rows and nothing else, which is why it could only say "I can't say for sure". Keep the field mapped; a broken mapping still alerts but leaves diagnosis blind.
- **Pre-flight regex timeouts are labelled harmless (added 2026-11-23).** n8n's regex guard runs every pattern in a `node:vm` with a hardcoded 250ms **wall-clock** budget (n8n-workflow 2.35 and later). A brief CPU stall (another execution, a GC pause, a container CPU quota) can make a trivial pattern overrun it during `checkReadyForExecution`, before any node executes. The payload then has `Failed node: unknown` and no execution data. The handler recognises exactly that shape: the title gains `(harmless, nothing to fix)`, the failed-node line reads `none (stopped before the first step)`, one sentence says no step ran and a scheduled workflow will retry on its next run, and the Ops Log `Event` gains `(harmless, no action)`. A regex timeout with a real failed node is **not** classified harmless, because a regex inside an IF, Filter or validation Code node can drop items. Do not widen the condition to the error message alone. n8n exposes no setting to raise the 250ms; the instance-level lever is CPU headroom, for example capping concurrent executions with `N8N_CONCURRENCY_PRODUCTION_LIMIT`.
- **`onError: continueRegularOutput` nodes never reach this handler.** Deliberate soft-fails in other workflows (e.g. `Store Duration`, `Reject Siblings`) are swallowed by design; this workflow only sees *unhandled* failures. Don't "fix" that.
- **The record-ID convention doesn't apply here** (no episode record in an error context); the unique anchor is the **execution ID** in a `<code>` block. The PostToolUse hook false-positives on this workflow's Telegram node — expected.
- **Ops Log `Type` options are capitalized**: `Completed` / `Skipped` / `Error` / `Heartbeat`. This workflow writes `Error`. With `typecast: true` a mismatched casing would silently create a duplicate select option — keep the casing exact when adding future writers.
- **If this workflow itself fails** (e.g. Telegram unreachable beyond the retries), there is no meta-handler; the failure sits in its own execution list. Do NOT set this workflow's Error Workflow setting to itself (infinite loop).
- **A failing Ops Log write is invisible by design** (alert still sends). If rows stop appearing, check the PAT's access to `appwcz1Bux9YLcZYm` first.
- **Test procedure:** add a temporary Code node that throws (`throw new Error('test')`) to any wired workflow, run it, confirm the group message AND the Ops Log row, remove the node. If a manual test doesn't fire the error workflow, trigger the erroring workflow via a production execution once (some n8n versions only invoke error workflows for production runs).
- **After a burst, check for stranded locks:** `./scripts/query/workflow-locks.sh` lists every non-empty `Workflow Lock` across Episodes, Thumbnails and Publications with its age. A 5xx can fail a run after its claim, and that lock is the only signal it died. On 2026-11-27 the answer was clean because every run failed before the claim, but the check is one command.

---

## Related

- **Roadmap:** `workflow_planning/Guys Take Build Status.md` — Phase 0.1 (this), 0.2 (`Ops Log` rollout to all workflows), 0.3 (watchdog digest — its planned host `Pod21: Daily Reminders` was deleted 2026-07-21; needs a new home).
- **Sibling notifier:** `Pod21: n8n GitHub Backups` (`Pod21 - n8n GitHub Backups.md`) — has its own per-node failure DM wiring, predating this handler.
