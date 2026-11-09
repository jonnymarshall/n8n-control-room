# BA - Frame.io Uploaded > Episode Marked

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `5ZMcCY8WPQ3bFji6`.) Created 2026-10-29 when the AI metadata stage was split in two.

This is the **cheap front half** of stage 5+6+7. It owns the Frame.io webhook, does every check that can be made without the media file, records the Frame.io link on the episode, and decides whether the episode should be queued for AI metadata.

The expensive half lives in **`BA - Ready for Metadata View Entered > AI Metadata`** (`jroXHciDvy0sWlRM`), which is triggered by Airtable state, not by Frame.io.

SDK source: `scripts/deploy/workflows/guys-take-episode-marked.sdk.js`.

---

## Why it is split

Frame.io re-sends `file.ready` events. On 2026-10-29 it delivered a fresh event for a file that had not changed in nineteen hours, which re-ran the whole metadata pipeline: a 48-minute re-transcription, a rewritten summary, a status regression and a duplicate packaging message (`BA-8YfSPH`, executions 9404 then 9678).

A webhook is not a state machine, so the durable answer is not "hope Frame.io only sends once". The webhook now only *marks* the row. Airtable decides whether work happens, exactly like every other stage in this pipeline. A stale event can therefore never start a run twice: the row has already moved past `Ready for Metadata`.

An unsigned replay of that same payload arrived again on 2026-11-06 and produced a "link refreshed" message for a `Published` episode. That is why there are now two gates before any work: the request must carry a valid Frame.io signature, and an already-linked file on a row past metadata does nothing at all.

---

## TL;DR

`POST /webhook/frameio-episode-uploaded` (Frame.io `file.ready`) → verify Frame.io's signature → look the file up on Frame.io → run the name and size checks → find the episode by its `BA-xxxx` filename prefix → stop if that same file is already on the row and the row is past metadata → write the Frame.io link → if the episode is at `Recorded` or `Edited`, set `Status = Ready for Metadata`, which is what starts the metadata workflow.

Nothing is downloaded. No transcription, no AI, no document.

A request that is not signed by Frame.io (or whose timestamp is more than 10 minutes old) is rejected before anything else runs, and reports itself to Telegram. A replay of a file that is already linked to an episode that is past metadata is a silent no-op: no write, no message.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `5ZMcCY8WPQ3bFji6` |
| **Trigger** | n8n Webhook (`POST`, path `frameio-episode-uploaded`) — Frame.io sends `file.ready` |
| **Auth** | HMAC-SHA256 over `v0:<timestamp>:<body>` with the webhook secret; unsigned or stale (> 10 min) requests are rejected |
| **Runs in** | a few seconds (one Frame.io lookup + one or two Airtable writes) |
| **Writes** | `Frame.io URL` when the file is new to the row (except `_Skip`); `Status = Ready for Metadata` only when queueing |
| **Queues when** | `Status` is `Recorded` or `Edited`, file is video/audio, under 2 GB, name has no `_Skip` / `_Bypass` |
| **Never queues** | unsigned request, already-linked file on a row past metadata, non-media, unmatched filename, over 2 GB, `_Skip`, `_Bypass`, any other status |
| **Telegram** | one short line per upload, always naming the episode ID and this workflow's ID + execution ID; silent on a no-op replay |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take), `Episodes` `tbl3uYLIvtB9APZp6` |
| **Active?** | Yes |
| **Error workflow** | `Pod21: Workflow Failed > Telegram Alert` (`9PMI1kuBjLW2YHwb`) |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `Adobe OAuth` | `oAuth2Api` | `Show File` |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Find Episode`, `Record Video Quality`, the three Airtable update nodes |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | all six Telegram nodes |
| `Frame.io Webhook Signing Secret` | `crypto` | `Sign Webhook Body` |

The `crypto` credential holds the Frame.io webhook secret in n8n's encrypted store. It is deliberately **not** in the workflow JSON or the SDK snapshot, so it never reaches git. The same value sits in `.env` as `FRAME_IO_SECREY_KEY` (gitignored) for the test scripts.

`Show File` is an **HTTP Request** node, so credential auto-assignment skips it on every push. Re-check it after any update.

---

## Flow

```
Frame.io Webhook → Check Webhook Auth → Auth OK? ──false──▶ Notify Rejected Webhook
                                    └─true─▶ Sign Webhook Body → Signature Valid? ──false──▶ Notify Rejected Webhook
                                                                  └─true─▶ Parse Frame.io Event → Show File → Extract Episode Info
  → Name Ends _Skip? ──true──▶ (stop, nothing at all)
  └─false─▶ Is Video or Audio? ──false──▶ Notify Skipped (Non-Media)
                └─true─▶ Find Episode → Has Episode? ──false──▶ Notify No Match
                          └─true─▶ Already Processed? ──true──▶ (stop, silent: same file, row past metadata)
                                    └─false─▶ Name Ends _Bypass? ──true──▶ Bypass: Refresh Link Only → Notify Bypassed
                                    └─false─▶ File Over 2 GB? ──true──▶ Notify Too Large
                                                └─false─▶ Status Allows Metadata?
                                                            ├─true──▶ Queue: Link + Ready for Metadata → Notify Queued
                                                            └─false─▶ Not Queued: Refresh Link Only → Notify Not Queued
```

### The branches

- **`Check Webhook Auth` + `Sign Webhook Body` + `Signature Valid?`** (false = block and report). Frame.io signs every delivery: `x-frameio-signature: v0=<hex HMAC-SHA256(secret, "v0:<x-frameio-request-timestamp>:<body>")>`. A request with no signature header, no timestamp, a timestamp more than 10 minutes off the server clock, or a hash that does not match is stopped here. Nothing is read from or written to Airtable, and a one-line Telegram alert names the reason, source IP and user-agent. This is what stops a stray `curl` replaying an old payload.
- **`Already Processed?`** (true = silent stop). True when the last path segment of the row's `Frame.io URL` is the same file as the incoming `webUrl`, and `Status` is not `Recorded` or `Edited`. That is a replay of a file the row already knows about, so there is nothing to write and nothing to say. It runs before `Record Video Quality`, so a replay cannot even bump `Last Modified Time`.
- **`Name Ends _Skip?`** (true = silent stop). Case-insensitive test on the filename with the extension stripped, so `BA-xxxx_EditorReference_SKIP.mp4` matches. Nothing is written, nothing is sent. Use it for uploads that must be invisible to the pipeline.
- **`Is Video or Audio?`** (false = notice). `mimeType` must match `^(video|audio)/` **and** a `downloadUrl` must exist. Images and PDFs have no proxy, so they fail both and get a heads-up instead of crashing a later download.
- **`Find Episode`** matches the `BA-{id}` prefix from the filename against the Episodes `ID` field. **`Has Episode?`** turns a missing match into a clear "no matching episode" message. Before this workflow existed the same case crashed the run on a downstream `.first()`.
- **`Name Ends _Bypass?`** (true = link-only refresh). The manual override: re-upload a cut with `_Bypass` on the end and only `Frame.io URL` is updated. It never queues, so it cannot accidentally start analysis.
- **`File Over 2 GB?`** (true = notice). Gemini's File API rejects anything larger, so this stops before a multi-gigabyte download. `_Bypass` is checked first, so a huge master can still be linked.
- **`Status Allows Metadata?`** (true = queue). Only `Recorded` and `Edited` queue. That is the guard that makes repeat webhook deliveries harmless: once an episode is at `AI Analysis Complete` or beyond, a re-delivery refreshes the link and says so.

### Changing which statuses queue

The list is inline in `Status Allows Metadata?`:
```
{{ ['Recorded','Edited'].includes(String(($('Find Episode').first().json.fields || {}).Status || '')) }}
```
Add or remove names there. Note this is separate from the **view** that triggers the metadata workflow, which filters on `Status = Ready for Metadata`.

---

## Messages

Every message states what happened and ends with `⚙️ <workflow id> · exec <execution id>`, so a report like "that message was wrong" can be traced to a run without opening n8n.

| Message | When |
|---|---|
| `📥 Cut received` | queued for metadata; shows the episode title |
| `⏭️ Ignored non-media upload` | image/PDF/other |
| `⚠️ Upload has no matching episode` | filename has no usable `BA-` prefix |
| `🔗 Frame.io link refreshed` | `_Bypass`, nothing queued |
| `🚨 File too large for Gemini` | over 2,147,483,648 bytes |
| `⏭️ Link refreshed, nothing queued` | status is not one that queues; names the status it saw |
| `🚫 Blocked a webhook that was not signed by Frame.io` | missing/stale/mismatched signature; names the reason, IP and user-agent |

Nothing is sent for `_Skip`, for an already-linked replay, or for the auth pass itself.

---

## Gotchas

- **Signature verification compares against the body as re-serialised.** The Webhook node hands over a parsed object, so `Check Webhook Auth` signs `JSON.stringify(body)`. That reproduces Frame.io's exact bytes, checked against live deliveries (execs 13704, 13826, 13635, 13303) and the pinned sample. If Frame.io ever changes whitespace or key order, real events fail closed and the Telegram alert says "signature mismatch", so the breakage is loud rather than silent. Do not "fix" a mismatch by loosening the check; compare the raw body instead.
- **The Crypto node replaces the item it is given.** `Parse Frame.io Event` therefore reads `$('Frame.io Webhook').all()` rather than `$input.all()`. If you insert anything else between the webhook and Parse, keep that in mind.
- **The no-op guard compares the file id, not the whole URL.** It takes the last path segment after stripping query and trailing slashes from both the stored `Frame.io URL` and the incoming `webUrl`. A `download_url` stored on the row (signed S3 URL) will not match, so the event proceeds as before rather than being swallowed.
- **2026-11-06: an unsigned replay fired the bypass message.** Execution 13910 was a `curl` POST of the exact 315-byte payload from execution 9792, with no `x-frameio-signature` header, from the network's own public IP. Nothing had changed on `BA-8YfSPH`, which was already `Published`. That is what prompted the auth gate and the `Already Processed?` guard. Real Frame.io deliveries always carry `user-agent: Frame.io V4 API` and the two `x-frameio-*` headers.
- **Airtable fields live under `fields`.** `Find Episode` (an Airtable node) returns `{ id, createdTime, fields: {...} }`. Every read of a field must go through `.fields`; reading `.json.Status` silently yields `undefined`. Other workflows are careful about this; this pair does it explicitly.
- **Any API save on an active workflow deactivates it.** On 2026-10-29 an edit was pushed after the workflow had been published, which quietly switched it off and left the webhook address unclaimed, so the next upload reached nothing and 404'd. After **any** push: confirm the workflow is still active, then send one test event.
- **Only one workflow can own a webhook path.** While the old single workflow still had its webhook node, this one could not take the address. Removing the webhook from the old workflow had to land first.
- **Frame.io V4 wraps the file in `data`.** `Extract Episode Info` unwraps it.
- **No `BA-` prefix means no match**, by design.
