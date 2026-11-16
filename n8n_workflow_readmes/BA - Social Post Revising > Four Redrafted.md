# BA - Social Post Revising > Four Redrafted

Redrafts all four social post options from a written brief, in place, without re-picking or re-drafting the episode from scratch.

- **Workflow ID:** `G4GoqVPpUMJWoEmM` (stable identifier: the name)
- **Trigger:** Airtable poll every minute on the `Social Posts` table, `Last Modified Time`
- **Status change:** none. The rows go `Revising` -> `Proposed`; the Episode is untouched.
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Social Posts Changed
  -> Pick Revising            only Status = Revising; one job per episode
  -> Fetch Episode Posts      all rows for that episode
  -> Prepare Revision         current round, previous copies, next round, row ids
  -> Already Selected?        yes -> notice and stop
       no  -> Fetch Episode        full metadata for the prompt
            -> Fetch Social Prompt  Airtable Prompts row "Social Post"
            -> Build Revision Request
            -> Redraft with OpenRouter
            -> Fetch Editor Prompt  Airtable Prompts row "Social Post Editor"
            -> Build Edit Request
            -> Edit with OpenRouter
            -> Parse Revision       validate, renumber the round, clear the brief
            -> Update Social Posts  all four rows, in place
            -> Build Revised Message
            -> Send Revised Message
```

## Round semantics

The four rows are reused. A redraft does not create a second set of four.

- `Round` increments (`1` -> `2` -> `3` ...)
- `Status` returns to `Proposed`
- `Revision Brief` is cleared on all four rows
- `Name` is rewritten as `<BA-xxxx> · R<round> · O<option>`

The previous round is preserved only in the message and the model prompt, not as rows. This mirrors the thumbnail revision path: one chosen artifact, revised in place, not an ever-growing table.

## What it refuses

- A row that is `Revising` while any row for the episode is `Selected`. It sends `⏭️ Social post already picked` and stops. Clear the selected row first if a redraft is genuinely wanted.
- A missing `Revision Brief`. The run throws rather than guessing.
- A round with anything other than four options. The run throws.

## Brief handling

The brief is passed verbatim. The writer is told that a numeric length in the brief wins over the 180-240 target but never over the 256 hard limit. The code enforces only the 280 hard limit; a brief that says "under 220" is a target, not a guarantee. The message shows the actual counts.

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Episode Posts`, `Fetch Episode`, `Fetch Social Prompt`, `Fetch Editor Prompt`, `Update Social Posts` | `Airtable PAT` (Bearer) |
| `Redraft with OpenRouter`, `Edit with OpenRouter` | `OpenRouter [n8n]` |
| `Send Already Picked`, `Send Revised Message` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16.

## Verified

- Pinned revision on `BA-HRwIMb` with "Make it punchier. Under 200 characters." produced 173 / 167 / 194 / 160 with the link and rewrote the four rows to Round 2.
- Pinned revision with "Make it more personal and lead with the wine maker story. Keep it under 220 characters." produced usable options close to the target; the final counts are shown in the message.
- The `already picked` branch was exercised only in development, not on a real selected episode.

## Gotchas

- The editor pass roughly doubles the redraft time and cost. To remove it, rewire `Redraft with OpenRouter` straight to `Parse Revision`.
- `Fetch Episode` pulls the whole record, including the transcript. That is intentional: the redraft needs the same grounding as the first draft.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
