# BA - Audionauts Transcript Ready > Keet and Telegram Post Drafted

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `jDEHmj4d0R4PPsiN`. Created 2026-11-23.

Writes the short rundown that goes with an Audionauts clip once its transcript is saved, and posts it to the team group. One draft per clip, then the normal `option 1` / `revise:` replies. Selecting it fills the episode's Keet and Telegram publication rows with the same copy.

- **Trigger:** Every minute, then an Airtable search on `Episodes`
- **Status change:** none. This is a side stage, like the other social copy.
- **Shared feature readme:** `Social Posts.md`
- **Prompts:** `Audionauts Post` and `Social Post Humanizer` in the `Prompts` table (`tblhG1nw2P1k3CBVU`)

---

## What it picks, and why

The search is a filter formula rather than a view, because Airtable's API cannot create views:

```text
Type = 'Audionauts'
Status = 'AI Analysis Complete'
Transcript is not empty
Social Posts is empty
Audionauts Post Tried is empty
Title is not empty
```

`maxRecords=1`, oldest `Last Modified Time` first. One clip per run.

`AI Analysis Complete` is the status the transcription workflow writes when it finishes an Audionauts clip, and it is the first moment the transcript exists. Nothing else touches an Audionauts episode, so this is the whole lifecycle up to Jonny sending the clip.

`Audionauts Post Tried` is the loop guard. The workflow stamps it on success **and** on failure. A failure therefore cannot re-alert every minute, and clearing the field on the episode is the retry.

---

## Flow

```text
Every Minute
  -> Find Audionauts Clip      Episodes search, filter above, limit 1
  -> Pick Clip                 one job, or no items and the run ends quietly
  -> Resolve Parent Episode    Episodes search on ID = Associated Episode
  -> Fetch Audionauts Prompts  "Audionauts Post" + "Social Post Humanizer"
  -> Build Audionauts Request  fill title, guests, transcript, house rules
  -> Draft Audionauts Post     google/gemini-3.7-flash, JSON object
  -> Parse Audionauts Draft    validate limits and banned moves
  -> Create Audionauts Social Post   one row, Platform "Keet + Telegram"
  -> Mark Audionauts Post Tried      Episodes.Audionauts Post Tried = now
  -> Build Audionauts Message
  -> Send Audionauts Post      team group
```

Every fallible step routes to `Build Audionauts Failure` -> `Mark Audionauts Post Failed` -> `Notify Audionauts Failure`.

---

## The parent episode

An Audionauts clip row has its own `Title` (for example `Chat_177 - Audionauts Clip`) and an `Associated Episode` field holding the parent's `BA-` code. The workflow reads that parent and uses:

- the parent `Title` (for example `Chat_177 - Security Is Just a Hard Problem with Lloyd Fournier`), which is what the prompt's "episode number and title" means
- the parent `Guest Name` lookup, which is where the guest names actually live (the clip row usually has none)

If the parent is missing or has no guests, it falls back to the clip title and `none listed`. The request carries the clip's `Transcript` verbatim.

---

## The draft

- Model: `google/gemini-3.7-flash`, same as the X writer, `temperature 0.85`, `response_format: json_object`.
- The prompt bans em and en dashes, marketing hype, invented facts and a long AI-word list, and requires the greeting / exclusivity / insights / sign-off shape in the first person.
- The shared `Social Post Humanizer` row supplies the house voice, rhythm, accuracy and banned-move rules. That row is fetched separately so it can be tuned once for every social automation; the X writer and editor use the same row through `{{HUMANIZER}}`.

`Parse Audionauts Draft` enforces:

- a body (not options), under **1000 characters**
- no em or en dash (replaced with a comma), no emoji, no URL
- the `matters` ban, the AI-word list and the banned-move list
- trims at the last sentence boundary if the body is slightly over 1000; fails if there is no boundary

A failure writes nothing except the `Audionauts Post Tried` stamp and the Telegram reason, so the run cannot loop.

---

## Output row

One row in `Social Posts`:

| Field | Value |
|---|---|
| `Name` | `<BA-xxxx> · R1 · O1` |
| `Episode` | link to the clip |
| `Platform` | `Keet + Telegram` |
| `Status` | `Proposed` |
| `Option` | 1 |
| `Round` | 1 |
| `Copy` | the rundown body, under 1000 characters |
| `Angle` | two to five words from the model |
| `Characters` | body count |

No `CTA`: the sign-off is part of the body, unlike the X options.

The Telegram message is `🟡 Audionauts post ready`, the BA code and title, the angle and body, the character count with `Keet and Telegram, same copy`, and the reply instructions (`option 1`, `custom: ...`, `revise: ...`).

---

## Credentials

| Node | Credential |
|---|---|
| `Find Audionauts Clip`, `Resolve Parent Episode`, `Fetch Audionauts Prompts`, `Create Audionauts Social Post`, `Mark Audionauts Post Tried`, `Mark Audionauts Post Failed` | `Airtable PAT` (Bearer) |
| `Draft Audionauts Post` | `OpenRouter [n8n]` |
| `Send Audionauts Post`, `Notify Audionauts Failure` | `Telegram [pod21_n8n_agent_bot]` |

---

## Verified

End-to-end on a temporary Audionauts episode (`BA-S3aB4q`, parent `BA-QxQCXc`, real 4,701-character clip transcript) on 2026-11-23, on a scratch copy routed to Jonny's DM:

- produced a 558-character rundown with the greeting, the multisig and BIP 110 points, and the `Enjoy the preview.` sign-off
- wrote the `Keet + Telegram` row with `Round 1`, `Proposed`
- stamping and the failure branch both exercised (the first two runs failed on a Code-node syntax error, which is what the stamp is for)

Test rows, publications and episode were deleted.

---

## Gotchas

- **The search needs `Last Modified Time` to sort.** It exists on `Episodes` (`fld3Z4xdI4s2wVnRa`).
- **One row per clip.** Revisions rewrite the same row; they do not create four.
- **A failure is one message, not a loop.** Clear `Audionauts Post Tried` to retry after fixing the cause.
- **The transcript goes to the model in full.** That is what the format needs; a long clip costs more tokens than an X post.
- **Do not add a view.** Airtable's API cannot create one, and this filter is the source of truth.
- `versionId == activeVersionId`, active, `availableInMCP`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-23.
