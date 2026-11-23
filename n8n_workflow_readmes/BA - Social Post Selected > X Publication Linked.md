# BA - Social Post Selected > X Publication Linked

> **2026-11-23 - ignores Audionauts rows (LIVE, published).** `Pick Selected` now processes only rows whose `Platform` is `Default` or `X`. Audionauts copy lives in the same table with `Platform = Keet + Telegram` and has its own selection workflow, which writes the Keet and Telegram rows. Without the filter this workflow would have linked an Audionauts pick to an X publication.

Takes the chosen social post option, links it to the episode's X row in `Publications`, rejects the other three options, and confirms in Telegram.

- **Workflow ID:** `6m5s6x2sYMWJRz1s` (stable identifier: the name)
- **Trigger:** Airtable poll every minute on the `Social Posts` table, `Last Modified Time`
- **Status change:** no Episode status change
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Social Posts Changed
  -> Pick Selected            only Status = Selected; one job per episode
  -> Fetch Episode Posts      all rows for that episode
  -> Prepare Selection        chosen row + sibling ids + publication payload
  -> Find X Publication       Publications where Publication = "BA-xxxx - X"
  -> Publication Exists?
       yes -> Update Publication   Post Copy + Social Post link only
       no  -> Create Publication   Platform X, Status Pending, Post Copy, Social Post link
  -> Reject Siblings          the other three rows -> Rejected
  -> Build Selected Message
  -> Send Selected Message    team group
```

## Why it writes the Publication row

The X post has to live on the episode's `Publications` row so the posting step and the bot have one place to read it. The row is `BA-xxxx - X`, `Status = Pending`, with:

- `Post Copy` = the full post: body (P1, P2, P3) + a blank line + CTA
- `Social Post` = a link to the exact option row

The X row is now created by the drafting workflow, before a post is chosen. This workflow updates it. If it is missing (for example an episode drafted before 2026-11-17), the create branch still creates it.

On an existing row, only `Post Copy` and `Social Post` are written. `Status` is deliberately left alone, so re-picking after the post is live does not reset a `Published` row to `Pending`.

The body is capped at 280 characters. The CTA and the episode link are outside that count. The link is appended when the post is sent, not stored in `Post Copy`.

## What it does not do

- It does not post to X. The row is a handoff for the posting step.
- It does not add the episode URL to `Post Copy`. The URL is appended when the post is sent.
- It does not touch the Episode `Status`.

## Platform dependency

`Publications.Platform` now contains `X` (added 2026-11-16). The live selection test created `BA-rvik4X - X` with `Platform = X`, `Status = Pending`, `Post Copy` = body + CTA, and the `Social Post` link. No manual setup remains.

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Episode Posts`, `Find X Publication`, `Update Publication`, `Create Publication`, `Mark Siblings Rejected` | `Airtable PAT` (Bearer) |
| `Send Selected Message` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16.

## Verified

- Pinned run on `BA-HRwIMb`: created `BA-HRwIMb - X`, copied the Option 2 body into `Post Copy`, linked the chosen row, rejected Options 1, 3 and 4, and sent the confirmation. The test row was deleted afterwards.
- **Live run on a temporary episode (`BA-rvik4X`) on 2026-11-16:** execution `25386` created `BA-rvik4X - X` with `Platform = X`, `Status = Pending`, `Post Copy` = body + CTA, linked the selected row, and rejected the other three. The test publication, rows and episode were deleted.
- **Live bug found and fixed:** the Airtable trigger returns `Episode` as an array of record ID strings, not `{id, name}` objects. `Pick Selected` assumed objects and skipped every live row. It now accepts either shape. The pinned test had used the object shape.

## Gotchas

- Two rows set to `Selected` at once: the first one wins and `Prepare Selection` rejects the other as a sibling. The second row's own trigger run will then find no `Selected` row and do nothing.
- The formula `{Publication}="BA-xxxx - X"` matches the primary field, not the linked record id. That is intentional and works because `Publication` is unique per episode and platform.
- The Airtable trigger returns linked-record IDs as strings. Do not simplify `Pick Selected` back to `link.id`.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
