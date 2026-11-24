# BA - Audionauts Transcript Ready > Keet and Telegram Post Drafted

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `jDEHmj4d0R4PPsiN`. Created 2026-11-23.

Writes the short rundown that goes with an Audionauts clip once its transcript is saved, and posts it to the team group. One draft per clip, then the normal `option 1` / `revise:` replies. Selecting it fills the episode's Keet and Telegram publication rows with the same copy.

- **Trigger:** Every minute, then an Airtable search on `Episodes`
- **Status change:** none. This is a side stage, like the other social copy.
- **Shared feature readme:** `Social Posts.md`
- **Prompts:** `Audionauts Post` and `Social Post Humanizer` in the `Prompts` table (`tblhG1nw2P1k3CBVU`)

---

## What it picks, and why

It searches the same view as the X draft: `Ready for Social Posts` (`viw7OScgqnRQdCLJz`) on `Episodes`, up to 20 rows, oldest `Last Modified Time` first. `Pick Clip` then takes the oldest row that passes all of these:

```text
Type = 'Audionauts'
Status = 'AI Analysis Complete'
Transcript is not empty
Social Posts is empty
Workflow Lock is empty
Title is not empty
```

**The view must include `AI Analysis Complete` in its Status filter.** It was added by hand on 2026-11-23. Without it, an Audionauts clip at that status never appears, regardless of Type. The view must also require `Workflow Lock is empty`, so a claimed clip leaves the view.

`AI Analysis Complete` is the status the transcription workflow writes when it finishes an Audionauts clip, and it is the first moment the transcript exists. Nothing else touches an Audionauts episode, so this is the whole lifecycle up to Jonny sending the clip.

**The view is shared with the X draft, so it can hold rows this flow does not own.** The search fetches a batch and `Pick Clip` scans it for the oldest matching Audionauts row, rather than taking the first row in the view. The X draft does the mirror image: it skips `Type = Audionauts` and processes only its oldest eligible episode. Neither queue can be blocked by a row that belongs to the other.

**`Workflow Lock` is the claim.** `Claim Clip` writes `audionauts-post <ISO timestamp>` before any work, so the row leaves the view immediately and a failure cannot re-alert every minute. On success `Complete Clip` sets `Status = Audionauts Post Ready` and clears the lock in one PATCH. On failure the lock stays and the Telegram message carries the reason; clearing `Workflow Lock` on the episode is the retry.

This is the first workflow to use the generic lock instead of a claim status. The rest of the fleet still uses `<Stage> In Progress` statuses; the migration plan is in `workflow_planning/Guys Take Build Status.md` and the rule is in `n8n_workflow_readmes/CONVENTIONS.md`.

---

## Flow

```text
Every Minute
  -> Find Audionauts Clip      Ready for Social Posts view, 20 rows, oldest first
  -> Pick Clip                 oldest matching Audionauts row, or no items and the run ends quietly
  -> Claim Clip                Workflow Lock = "audionauts-post <now>"
  -> Resolve Parent Episode    Episodes search on ID = Associated Episode
  -> Fetch Audionauts Prompts  "Audionauts Post" + "Social Post Humanizer"
  -> Build Audionauts Request  fill title, guests, transcript, house rules
  -> Draft Audionauts Post     google/gemini-3.7-flash, JSON object
  -> Parse Audionauts Draft    validate limits and banned moves
  -> Create Audionauts Social Post   one row, Platform "Keet + Telegram"
  -> Complete Clip             Status = "Audionauts Post Ready", Workflow Lock = ""
  -> Build Audionauts Message
  -> Send Audionauts Post      team group
```

Every fallible step after the claim routes to `Build Audionauts Failure` -> `Notify Audionauts Failure`. Nothing writes the failure to Airtable: the lock left on the row is the signal, and the reason is in Telegram and the failure alert.

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

A failure writes nothing to the Social Posts table; the claim stays on the episode and the failure message carries the reason, so the run cannot loop.

Because the claim happens before the model call, a crash at any point after `Claim Clip` leaves `Workflow Lock` on the episode. That is the intended signal: the row is out of the view, so it cannot retry itself, and clearing the lock is the deliberate retry.

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
| `Find Audionauts Clip`, `Claim Clip`, `Resolve Parent Episode`, `Fetch Audionauts Prompts`, `Create Audionauts Social Post`, `Complete Clip` | `Airtable PAT` (Bearer) |
| `Draft Audionauts Post` | `OpenRouter [n8n]` |
| `Send Audionauts Post`, `Notify Audionauts Failure` | `Telegram [pod21_n8n_agent_bot]` |

---

## Verified

End-to-end on a temporary Audionauts episode (`BA-S3aB4q`, parent `BA-QxQCXc`, real 4,701-character clip transcript) on 2026-11-23, on a scratch copy routed to Jonny's DM:

- produced a 558-character rundown with the greeting, the multisig and BIP 110 points, and the `Enjoy the preview.` sign-off
- wrote the `Keet + Telegram` row with `Round 1`, `Proposed`
- the failure branch was exercised when the first two runs died on a Code-node syntax error

That test used the old `Audionauts Post Tried` stamp. **The claim / lock / `Audionauts Post Ready` path was added after it and has not been run end to end yet:** it needs the corrected view filter (below), which is a manual UI change. Test rows, publications and episode were deleted.

`versionId == activeVersionId`, active, `availableInMCP`, credentials bound, validation clean, snapshot refreshed as of 2026-11-23.

---

## Gotchas

- **The shared view is the gate.** `Ready for Social Posts` must include `AI Analysis Complete` in its Status filter and `Workflow Lock is empty`, or nothing reaches this workflow / a claimed clip does not leave it. Airtable's API cannot read or edit view filters, so that is a manual UI change and has to be checked after any view edit.
- **The search needs `Last Modified Time` to sort.** It exists on `Episodes` (`fld3Z4xdI4s2wVnRa`).
- **One row per clip.** Revisions rewrite the same row; they do not create four.
- **A failure is one message, not a loop.** Clear `Workflow Lock` on the episode to retry after fixing the cause. The status stays at `AI Analysis Complete` unless the failure happened at `Complete Clip`.
- **A stuck `Workflow Lock` always means a run died.** That is deliberate: it is the only way a failed run cannot retry itself every minute.
- **The transcript goes to the model in full.** That is what the format needs; a long clip costs more tokens than an X post.
- `versionId == activeVersionId`, active, `availableInMCP`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-23.
