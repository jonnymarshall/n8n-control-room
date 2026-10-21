# AgentMail Received > Episode Scheduling

> **Find this workflow in n8n by name.** Workflow IDs change when a workflow is rebuilt, so the name is the stable identifier. (ID at time of writing: `DFkl8armVlXqBWWD`.)
> Built 2026-09-29. Active.

---

## TL;DR

Drives episode scheduling from **email**, because Calendly meeting polls are invisible to the Calendly API and webhooks. Calendly's emails (and the poll-link email Jonny sends) are the only reliable signal, so both land in `pod21@agentmail.to`, and AgentMail pushes each new message to this workflow.

| Email | Detected by | Effect on the episode |
|---|---|---|
| Poll-link email Jonny sends to guests (Cc/Bcc to the inbox) | `calendly.com/d/` link, no calendar attachment | `Status = Scheduling` |
| Google Calendar invitation (slot confirmed) | `Invitation:` subject + `.ics` attachment | `Status = Scheduled` + `Record Date` |
| Google Calendar cancellation | `Cancelled event:` subject + `.ics` attachment | `Status = Scheduling` |

Every email carries the episode ID (e.g. `BA-2qWYDB`) somewhere in the body, which is how the episode is found.

---

## Why email (important context)

Calendly meeting polls are **not exposed to the API at all**: no poll endpoint, no poll webhook, no `scheduled_event`, and they don't appear in `GET /event_types`. Confirmed 2026-09-29 with a real poll. So neither poll creation nor poll booking can be detected through Calendly's API. The Calendly-webhook workflow (`Calendly Scheduling`) therefore cannot drive the poll flow; this email workflow supersedes it for scheduling.

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Webhook node, `POST`, path `agentmail-scheduling`; fed by an AgentMail `message.received` webhook |
| **Inbox** | `pod21@agentmail.to` |
| **Airtable base / table** | `app8Xw9Tq0XLjhmp9` / `tbl3uYLIvtB9APZp6` (Episodes) |
| **Fields written** | `Status`, `Record Date` (cleared on the way back to `Scheduling`) |
| **Status values set** | `Scheduling` (poll sent / booking canceled), `Scheduled` (slot confirmed) |
| **Alerts** | `Not Matched Alert` (no episode with that `ID`), `Guard Blocked (Confirmed / Canceled / Created)` (episode found, status guard refused the move) |
| **Local copy** | `scripts/deploy/workflows/agentmail-episode-scheduling.sdk.js` (`snapshot-sdk.sh` generated) |
| **Webhook helper** | `scripts/deploy/agentmail/create-webhook.sh` |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `AgentMail (n8n control room)` | `httpHeaderAuth` | the two ICS HTTP Request nodes |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Find / Set nodes |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | 3 Telegram nodes |

---

## How it works (node by node)

1. **AgentMail Webhook** — receives the AgentMail `message.received` event; the full message (subject, from, text, html, attachments) is in `body.message`.
2. **Classify Email** (Code) — decides the `kind`:
   - has an `.ics`/calendar attachment **and** subject matches `/invitat/i` → `confirmed`
   - has a calendar attachment and subject matches `/cancel/i` → `canceled`
   - no attachment, a `BA-xxxx` in the body, and a sender at `pod21.xyz` / `jonnymarshall5@gmail.com` → `created`
   - otherwise `ignore`
   Also extracts the `BA-xxxx` from subject/text/html, and the inbox/message/attachment ids. The message id is pre-url-encoded.
3. **Route by Kind** (Switch) — three outputs.
4. **Confirmed branch** — `Get ICS Meta` (attachment metadata, includes a signed `download_url`) → `Download ICS` (fetches the `.ics` as text) → `Parse ICS` (Code) → `Find Episode (Confirmed)` → `Found? (Confirmed)` → `Eligible? (Confirmed)` → `Set Scheduled` → `Notify Scheduled`.
5. **Canceled branch** — `Find Episode (Canceled)` → `Found? (Canceled)` → `Eligible? (Canceled)` (only when `Status = Scheduled`) → `Set Scheduling (Cancel)` → `Notify Canceled`. The notice invites a reply (`suspend this episode`): because it is sent by the assistant's bot and carries the `BA-xxxx`, replying anchors the episode and the **Telegram Airtable Assistant** can propose flipping it to `Suspended` (via its normal approve step).
6. **Created branch** — `Find Episode (Created)` → `Found? (Created)` → `Eligible? (Created)` (only when the episode is still pre-scheduling, or `Suspended`) → `Set Scheduling (Poll)` → `Notify Poll Sent`.

**Lookup and guards are separate steps (changed 2026-10-21).** Each `Find Episode (…)` node
searches by `{ID}` only; the status rule lives in the `Eligible? (…)` IF node after it. That
split is what makes the alerts honest:

- `Found?` false → **Not Matched Alert**: no episode carries that `ID`. (The `Episode ID` in
  the message comes from `Classify Email`'s scrape of the email, not from Airtable, so it can
  be present even when nothing matched.)
- `Found?` true but `Eligible?` false → **Guard Blocked Alert** naming the episode and its
  current status, with the list of statuses that email type acts on.
- Neither alert writes anything.

Status guards stop a late or duplicate email from dragging an episode backwards, and stop repeated "poll sent" emails (one per guest) re-notifying. A **blank Status counts as eligible** (a brand-new episode is pre-scheduling). Allowed statuses per branch:

| Branch | Eligible statuses |
|---|---|
| Created (poll) | blank, `Script Ready`, `Stories Picked`, `Research Ready`, `Suspended` |
| Confirmed (booking) | blank, `Script Ready`, `Stories Picked`, `Research Ready`, `Scheduling`, `Scheduled`, `Suspended` |
| Canceled | `Scheduled` only |

`Suspended` is on both the poll list and the confirmation list deliberately: a cancelled
episode comes back either by resending a poll or by a slot being booked off an existing link,
and both are real signals. That is what happened to `BA-wjHtVX` on 2026-10-21 after the guard
had refused its reschedule poll.

---

## Time extraction (the fiddly part)

The event time comes from the `.ics` attachment, not the prose. Two traps, both handled in `Parse ICS`:
- Google's ICS includes a `VTIMEZONE` block with its own `DTSTART:19700101T000000`. The parser slices to the `VEVENT` block first so it can't grab that.
- The event's `DTSTART` is **local wall time** with a `TZID` and no `Z` (e.g. `DTSTART;TZID=America/Cancun:20261009T120000`). The parser reads the UTC offset from the subject's `(GMT±N)` token and builds an offset-aware ISO string, then normalises to UTC. If no `Z` and no GMT token, it falls back to treating it as UTC.

A missing/unparseable time writes `null` (clears `Record Date`) rather than an epoch date. The
same clearing happens on the way back to `Scheduling`: both `Set Scheduling (…)` nodes write
`Record Date: null` alongside `Status = Scheduling`.

---

## Setup

- **AgentMail webhook:** `scripts/deploy/agentmail/create-webhook.sh` (idempotent) registers `message.received` for the inbox against `/webhook/agentmail-scheduling`.
- **Convention:** the `BA-xxxx` must appear in the body of every relevant email (poll-link email, and the calendar emails carry it automatically via Calendly's "For internal use only" line). Confirm the poll/event name and internal note carry it.

---

## Gotchas

- **The poll-link email must be sent with the inbox as a recipient.** If it isn't, that episode won't auto-reach `Scheduling`; setting it by hand stays valid.
- **Confirmation/cancellation come from Google Calendar, not Calendly** (the host's connected calendar sends them). Detection is by subject + attachment, not by sender.
- **Cancellation leaves nothing behind on the episode.** Both routes back to `Scheduling` (a fresh
  poll, or a cancellation) clear `Record Date`, so a stale date never sits on an episode that
  has no confirmed slot. `Record Date` is therefore only ever populated while `Status = Scheduled`,
  and it is stamped again when the next confirmation arrives.
- **`Suspended` is a normal way back in, not a dead end.** Either a reschedule poll or a real
  booking confirmation revives a suspended episode: the poll sets `Scheduling`, the confirmation
  sets `Scheduled` and stamps `Record Date`. A confirmation is treated as proof the booking
  exists, so it wins over the status flag (decision taken 2026-10-21).
- **The alerts used to be a single "could not be matched" message** for every failure, which
  is what made the `BA-wjHtVX` miss (2026-10-21) look like an ID problem when it was the
  status guard. Do not merge the two alert types back together.
- **Email parsing is inherently softer than an API.** The ID match depends on the naming convention; the time depends on the ICS + GMT pattern. If Calendly/Google change their templates, revisit `Classify Email` / `Parse ICS`.
- **No AgentMail signature verification** on the webhook is implemented (the endpoint is unguessable). Add Svix verification if that matters.

---

## Related

- **`scripts/deploy/agentmail/create-webhook.sh`** — registers the AgentMail webhook.
