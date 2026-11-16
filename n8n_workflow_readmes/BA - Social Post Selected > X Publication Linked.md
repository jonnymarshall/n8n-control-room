# BA - Social Post Selected > X Publication Linked

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

- `Post Copy` = the selected body
- `Social Post` = a link to the exact option row

On an existing row, only those two fields are written. `Status` is deliberately left alone, so re-picking after the post is live does not reset a `Published` row to `Pending`.

## What it does not do

- It does not post to X. The row is a handoff for the posting step.
- It does not add the episode URL to `Post Copy`. The URL is appended when the post is sent; the 24-character reservation in `Characters` guarantees it fits.
- It does not touch the Episode `Status`.

## Manual setup dependency

The `Publications.Platform` single select must contain `X`. Airtable would not accept the new choice through the API, so it was left as a manual step on 2026-11-16. Until it exists, `Create Publication` fails with an invalid-option error and the run stops after the sibling rejection.

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Episode Posts`, `Find X Publication`, `Update Publication`, `Create Publication`, `Mark Siblings Rejected` | `Airtable PAT` (Bearer) |
| `Send Selected Message` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16.

## Verified

- Pinned run on `BA-HRwIMb`: created `BA-HRwIMb - X`, copied the Option 2 body into `Post Copy`, linked the chosen row, rejected Options 1, 3 and 4, and sent the confirmation. The test row was deleted afterwards.
- **Not yet run after `X` is added to the Platform field.** The test used a blank Platform value because the choice did not exist.

## Gotchas

- Two rows set to `Selected` at once: the first one wins and `Prepare Selection` rejects the other as a sibling. The second row's own trigger run will then find no `Selected` row and do nothing.
- The formula `{Publication}="BA-xxxx - X"` matches the primary field, not the linked record id. That is intentional and works because `Publication` is unique per episode and platform.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
