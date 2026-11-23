# BA - Audionauts Post Selected > Keet and Telegram Linked

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `e8tczdCg5MB0RSVP`. Created 2026-11-23.

Takes the chosen Audionauts rundown and writes it to the episode's **Keet** and **Telegram** publication rows, the same copy in both. It does not post anywhere; the rows are the handoff.

- **Trigger:** Airtable poll every minute on `Social Posts`, `Last Modified Time`
- **Status change:** none
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Social Posts Changed
  -> Pick Audionauts Selected    Status = Selected AND Platform = "Keet + Telegram"
  -> Find Keet Publication       Publications where Publication = "<BA-xxxx> - Keet"
  -> Keet Row Exists?            yes -> Update   (Post Copy + Social Post link only)
                                 no  -> Create   (Platform Keet, Status Pending, copy, link)
  -> Find Telegram Publication   Publications where Publication = "<BA-xxxx> - Telegram"
  -> Telegram Row Exists?        yes -> Update   (Post Copy + Social Post link only)
                                 no  -> Create   (Platform Telegram, Status Pending, copy, link)
  -> Build Linked Message
  -> Send Linked Message         team group
```

The X selection workflow reads the same table. It ignores any row whose `Platform` is not `Default` or `X`, so the two workflows never both claim an Audionauts row.

---

## What it writes

For each platform, an existing row only gets:

- `Post Copy` = the body exactly as stored in `Copy`
- `Social Post` = a link to the chosen row

`Status` is deliberately untouched on an existing row, so re-picking after a post is live cannot knock a `Published` row back to `Pending`. New rows are created with `Status = Pending`, `Platform = Keet` or `Telegram`, and the episode link.

There is no CTA for an Audionauts post, so `Post Copy` is just the body. Keet and Telegram receive identical text.

---

## What it does not do

- It does not post to Keet. Keet has no API; that is manual by design.
- It does not post to Telegram. The row is the handoff; sending is manual.
- It does not reject siblings. An Audionauts draft has one option; revisions rewrite it in place.
- It does not touch the Episode `Status`.

---

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Find Keet Publication`, `Update Keet Publication`, `Create Keet Publication`, `Find Telegram Publication`, `Update Telegram Publication`, `Create Telegram Publication` | `Airtable PAT` (Bearer) |
| `Send Linked Message` | `Telegram [pod21_n8n_agent_bot]` |

---

## Verified

On the temporary Audionauts clip `BA-S3aB4q` on 2026-11-23, against a scratch copy routed to Jonny's DM:

- setting the row to `Selected` created `BA-S3aB4q - Keet` and `BA-S3aB4q - Telegram`, both `Status = Pending` with the same `Post Copy` and the same `Social Post` link
- execution `69568` completed through both creates and the confirmation message

Test rows and publications were deleted.

---

## Gotchas

- **The `Platform` filter is the whole routing rule.** If the value on the row is ever changed away from `Keet + Telegram`, this workflow ignores it and the X workflow may take it instead.
- **Airtable's API cannot add select options.** `Keet` and `Telegram` were added to `Publications.Platform` in the UI on 2026-11-23; a future rebuild cannot create them through the API.
- **The confirmation message does not repeat the body.** It names the episode, says both rows hold the copy, and shows the character count.
- `versionId == activeVersionId`, active, `availableInMCP`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-23.
