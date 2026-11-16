# BA - Episode Approved > Social Posts Drafted

Writes four platform-neutral social post options after an episode's AI metadata is signed off, writes them to the `Social Posts` table as `Proposed`, and posts them to the team group.

- **Workflow ID:** `ntXHSW3AbNntnaj0` (stable identifier: the name)
- **Trigger:** Airtable poll every minute on the `Episodes` table, `Last Modified Time`
- **Status change:** none. This is a side stage; artwork and publishing own the Episode `Status`.
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Episodes Changed (whole-table Airtable poll)
  -> Pick Episodes            guard: status, no linked posts, title/summary/transcript
  -> Fetch Social Prompt      Airtable Prompts row "Social Post"
  -> Build Social Request     fill placeholders with the episode
  -> Draft with OpenRouter    anthropic/claude-sonnet-4.6, 4 options
  -> Fetch Editor Prompt      Airtable Prompts row "Social Post Editor"
  -> Build Edit Request       hand the four drafts to the editor
  -> Edit with OpenRouter     de-slop pass, same model
  -> Parse Options            validate 4, strip banned wording, enforce 256 body / 280 with link
  -> Create Social Posts      one Airtable POST, four records
  -> Build Social Message     numbered options + character counts + reply instructions
  -> Send Social Posts        team group, HTML
```

## Why the trigger is wide and guarded

`Approved` is transient. The artwork workflow also fires on `Approved` and immediately writes `Generating Artwork`, `Awaiting Thumbnail Pick` or `Awaiting Manual Artwork`. A trigger filtered on `Status = Approved` would often read the row after artwork had moved it and skip the episode forever.

`Pick Episodes` therefore accepts the pre-artwork and artwork statuses and uses the real gate: `Social Posts` must be empty. The first run creates the four rows, the reverse link fills, and every later edit fails the guard.

## What it skips

- Any status outside `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`
- An episode that already has linked `Social Posts`
- A missing title, or a placeholder `[Clip]` title
- An episode with neither `Summary` nor `Transcript`

It does not skip a type. Take, Chat, Roundtable, 2 Sats, Read, Clip and Audionauts all get options; the prompt changes the angle per type.

## Grounding (fixed 2026-11-16)

The first version passed the opening 12,000 characters of the transcript. On a listener-comments episode that is the housekeeping, and a narrow revision brief could pull the whole post into a passing aside. It now:

- builds `{{SPINE}}` from the `Summary` and `Chapters`, and makes the spine the subject of every post
- sends three 4,000-character transcript excerpts (start, middle, end) as `SOURCE MATERIAL (details only)`
- forbids a post built around a single passing mention, a book attribution, a listener's name, an opening aside, or an example's source
- forbids naming a book, author, article, show, company or person unless the spine or the guest field names them

The same rule is repeated in `Social Post Editor`, and the editor is told to rewrite anything that is really about the source of an example.

## Output

Four rows in `Social Posts`:

- `Platform = Default`
- `Status = Proposed`
- `Round = 1`
- `Option = 1..4`
- `Copy` = the post body, no URL
- `Angle` = the approach label
- `Characters` = body + space + 23-character URL

One Telegram message with the episode `BA-` code, title, the four numbered options, each option's final count, and `Reply option 2` / `revise: ...`.

## Validation

`Parse Options` enforces:

- exactly four options
- 256 characters maximum for the body
- 280 characters maximum including the reserved link
- the combined banned-word list from the house prompt, `humanizer` and `no-ai-slop`
- no em or en dashes, hashtags, emoji, @mentions or URLs

A failure stops the run loudly and writes nothing. The episode stays in an allowed status, so the next edit retries it.

## Credentials

| Node | Credential |
|---|---|
| `Episodes Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Social Prompt`, `Fetch Editor Prompt`, `Create Social Posts` | `Airtable PAT` (Bearer) |
| `Draft with OpenRouter`, `Edit with OpenRouter` | `OpenRouter [n8n]` |
| `Send Social Posts` | `Telegram [pod21_n8n_agent_bot]` |

All verified bound on 2026-11-16. HTTP nodes are the ones to re-check after any push.

## Verified

- Pinned run on `BA-HRwIMb` (Take): four options, 267 / 273 / 278 / 251 with the link, one DM message.
- Live trigger test on a temporary episode (`BA-6prm8M`, `Approved`): poller fired, four rows created, DM message sent, test data deleted.
- Empty and invalid model output paths are untested in production; the code throws before writing.

## Gotchas

- Every edit to an in-scope episode runs this workflow; the guard is cheap and exits on the first line.
- The AI runs twice (writer, then editor). Expect roughly 15 to 20 seconds and two OpenRouter calls per episode.
- The link is **not** stored in `Copy`. See `Social Posts.md` for the 280-character maths.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-16.
