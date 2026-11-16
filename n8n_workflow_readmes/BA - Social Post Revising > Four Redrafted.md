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
       no  -> Fetch Episode        title, type, summary, thumbnail caption, chapters
            -> Fetch Social Prompt  Airtable Prompts row "Social Post"
            -> Build Revision Request
            -> Redraft with OpenRouter   google/gemini-3.7-flash
            -> Fetch Editor Prompt  Airtable Prompts row "Social Post Editor"
            -> Build Edit Request
            -> Edit with OpenRouter     de-slop + breadth + accuracy pass
            -> Parse Revision       validate 280 body / 120 CTA, renumber the round, clear the brief
            -> Update Social Posts  all four rows, in place (Copy + CTA)
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

The brief is passed verbatim. It controls tone, angle, length and opening. It does not control the subject: the episode's title, summary, thumbnail caption and chapters stay the spine. The body is capped at 280 characters and the CTA is separate; a numeric length in the brief is a target, not a hard cut. The message shows the actual counts.

**No transcript.** `Fetch Episode` pulls the metadata fields only. The transcript is not passed to the writer or the editor. It caused both 2026-11-16 failures: the Gary North fixation and the four narrow single-topic posts. The summary and chapters are the grounding.

**The brief cannot replace the episode (fixed 2026-11-16).** A brief that said "lead with the wine maker story" originally made all four posts about Gary North's book. Now a named story is an example inside the episode's theme. The editor checks breadth and accuracy, and the parser fails on "matters" and the `Not X. Not Y.` pattern.

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Episode Posts`, `Fetch Episode`, `Fetch Social Prompt`, `Fetch Editor Prompt`, `Update Social Posts` | `Airtable PAT` (Bearer) |
| `Redraft with OpenRouter`, `Edit with OpenRouter` | `OpenRouter [n8n]` |
| `Send Already Picked`, `Send Revised Message` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16.

## Verified

- Pinned revision on `BA-HRwIMb` with "Make these broader and about the whole episode, not one small part. No narrow examples. No 'matters'. No 'Not X. Not Y.'" produced four broad options at body counts 278 / 263 / 234 / 275, with separate CTAs. No "matters", no staccato, no invented position.
- The earlier "Make it more personal and lead with the wine maker story" brief was retested after the no-transcript rebuild; the new output was about the episode's argument, not the book attribution.
- The `already picked` branch was exercised only in development, not on a real selected episode.

## Gotchas

- The editor pass roughly doubles the redraft time and cost. To remove it, rewire `Redraft with OpenRouter` straight to `Parse Revision`.
- `Fetch Episode` still pulls the whole record, but only the title, type, summary, thumbnail caption and chapters are used. The transcript is ignored.
- The Airtable trigger returns `Episode` as an array of record ID strings, not `{id, name}` objects. `Pick Revising` accepts either shape; do not simplify it back to `link.id`.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
