# BA - Episode Approved > Social Posts Drafted

Writes four platform-neutral social post options after an episode's AI metadata is signed off, writes them to the `Social Posts` table as `Proposed`, and posts them to the team group.

- **Workflow ID:** `ntXHSW3AbNntnaj0` (stable identifier: the name)
- **Trigger:** Airtable poll every minute on the `Episodes` view `Ready for Social Posts` (`viw7OScgqnRQdCLJz`), `Last Modified Time`
- **Status change:** none. This is a side stage; artwork and publishing own the Episode `Status`.
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Episodes Changed (whole-table Airtable poll)
  -> Pick Episodes            guard: status, no linked posts, title, summary
  -> Fetch Social Prompt      Airtable Prompts row "Social Post"
  -> Build Social Request     fill title, type, guest, summary, thumbnail caption, chapters
  -> Draft with OpenRouter    google/gemini-3.7-flash, 4 bodies + 4 CTAs
  -> Fetch Editor Prompt      Airtable Prompts row "Social Post Editor"
  -> Build Edit Request       hand the four drafts and the episode spine to the editor
  -> Edit with OpenRouter     de-slop + breadth + accuracy pass, same model
  -> Parse Options            validate 4, enforce 280 body / 120 CTA, ban "matters" and Not X. Not Y.
  -> Create Social Posts      one Airtable POST, four records (Copy + CTA)
  -> Build Social Message     numbered options, body and CTA counts, reply instructions
  -> Send Social Posts        team group, HTML
```

## Why the guard is wide

`Approved` is transient. The artwork workflow also fires on `Approved` and immediately writes `Generating Artwork`, `Awaiting Thumbnail Pick` or `Awaiting Manual Artwork`. The `Ready for Social Posts` view therefore accepts the pre-artwork and artwork statuses and uses the real gate: `Social Posts` must be empty.

The view (`viw7OScgqnRQdCLJz`, created 2026-11-16) carries the full condition set:

- `Status` is any of `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`
- `Social Posts` is empty
- `Title` is not empty
- `Summary` is not empty

`Pick Episodes` repeats the checks as a backstop. The first run creates the four rows, the reverse link fills, and every later edit leaves the view.

## What it skips

- Any status outside `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`
- An episode that already has linked `Social Posts`
- A missing title, or a placeholder `[Clip]` title
- An episode with no `Summary`

It does not skip a type. Take, Chat, Roundtable, 2 Sats, Read, Clip and Audionauts all get options; the prompt changes the angle per type.

## Grounding: no transcript

The writer and editor get **title, type, summary, thumbnail caption, chapters and guest name**. They do not get the transcript.

The first version passed the opening 12,000 characters of the transcript. That caused two failures on `BA-HRwIMb`:

1. A revision brief about the wine maker story made all four posts about Gary North's book, because the opening block contained the listener's one-line attribution.
2. A "punchier" revision produced four posts each about one small part of the episode, one of which invented a position the host never took.

The summary is the episode's through-line, the chapters are the arc, and the thumbnail caption is the hook the episode was packaged around. Those are enough for a 280-character post. The prompt forbids naming a book, author, article, show, company or person unless those fields name them, and forbids inventing the host's opinions or actions.

## Output

Four rows in `Social Posts`:

- `Platform = Default`
- `Status = Proposed`
- `Round = 1`
- `Option = 1..4`
- `Copy` = the body (P1, P2, P3), max 280, no URL
- `CTA` = the separate call to action, max 120
- `Angle` = the approach label
- `Characters` = the body count only

One Telegram message with the episode `BA-` code, title, the four numbered options, each option's `Body N / 280 · CTA M`, and `Reply option 2` / `revise: ...`.

## Validation

`Parse Options` enforces:

- exactly four options
- 280 characters maximum for the body
- 120 characters maximum for the CTA
- the word "matters" (and "mattering") in the body or CTA
- the `Not X. Not Y.` staccato pattern
- the combined banned-word list from the house prompt, `humanizer` and `no-ai-slop`
- no em or en dashes, hashtags, emoji, @mentions or URLs

A body over 280 is trimmed at the last sentence boundary at or below 280. If no boundary is usable, the run fails rather than cutting mid-thought. A failure writes nothing; the episode stays in an allowed status, so the next edit retries it.

## Credentials

| Node | Credential |
|---|---|
| `Episodes Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Social Prompt`, `Fetch Editor Prompt`, `Create Social Posts` | `Airtable PAT` (Bearer) |
| `Draft with OpenRouter`, `Edit with OpenRouter` | `OpenRouter [n8n]` |
| `Send Social Posts` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16. HTTP nodes are the ones to re-check after any push.

## Model comparison

Both calls default to `google/gemini-3.7-flash`. On the same `BA-HRwIMb` input:

- Gemini produced four distinct, broad posts with concrete details and different openings. Body counts 250 / 248 / 256 / 237.
- `openai/gpt-6-astra` was more polished but repetitive: three of four reused "separate free markets from fiat monopolies". Body counts 237 / 232 / 272 / 251. It is roughly 20x the cost.

The model string is in `Build Social Request` and `Build Edit Request`.

## Verified

- Pinned draft on `BA-HRwIMb`: four broad options with separate CTAs and no transcript.
- A revision with "Make these broader and about the whole episode, not one small part. No narrow examples. No 'matters'. No 'Not X. Not Y.'" produced four broad options at body counts 278 / 263 / 234 / 275.
- Live view-trigger test on a temporary `Approved` episode in `Ready for Social Posts` (`viw7OScgqnRQdCLJz`): execution `25365` created four rows and sent to Jonny's DM. The test transcript on the row was ignored.
- **Not yet exercised live:** a real approved episode through the group message and a real assistant pick.

## Gotchas

- Every edit to an episode in the view runs this workflow; the guard is cheap and exits on the first line.
- The AI runs twice (writer, then editor). Expect roughly 15 to 20 seconds and two OpenRouter calls per episode.
- The link and the CTA are not stored in `Copy`. `Copy` is the body only; `CTA` is its own field.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
