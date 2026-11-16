# Social Posts (platform-neutral copy, picked like thumbnails)

Four short social post options are written for an episode after the AI metadata is signed off. They are posted to Telegram, Jonny picks one by replying, or asks for four new ones with written feedback. The chosen copy is linked to the episode's X row in `Publications`.

This is the shared readme for the feature. The three workflows have their own short readmes:

- `BA - Episode Approved > Social Posts Drafted.md`
- `BA - Social Post Selected > X Publication Linked.md`
- `BA - Social Post Revising > Four Redrafted.md`

---

## Why it is platform-neutral

The copy is written for X today, but the language avoids X words (`tweet`, `thread`, `retweet`, `follow`, `bookmark`, `timeline`) and X conventions. The table has a `Platform` field so a future version can add a YouTube, Instagram or Nostr variant without renaming anything. A `Default` row is the neutral version; `X` is reserved for a platform-specific rewrite.

The old hand-run prompt is the starting point. Its per-type guidance is preserved (Read, Chat, Take, Roundtable, 2 Sats, Clip, Audionauts), and the banned-word list is joined with the rules from `jooray/humanizer` and `petergyang/no-ai-slop`.

---

## The two prompt rows (edit these, not the workflow)

Both live in the Airtable `Prompts` table (`tblhG1nw2P1k3CBVU`), so the wording can be tuned without an n8n deploy.

| Name | Record | What it does |
|---|---|---|
| `Social Post` | `rectYoHGj9beSqYIY` | The writer. Four options from the episode, with the per-type guidance, the 256-character body limit and the full anti-slop rule set. |
| `Social Post Editor` | `recDuioM1M0NOr0AP` | The final editor. Takes the four drafts and removes binary contrasts, throat-clearing, signposting, `-ing` analysis, fake endings and banned words. It may not add facts. |

Placeholders in `Social Post`: `{{TITLE}}`, `{{TYPE}}`, `{{EPISODE_ID}}`, `{{GUEST}}`, `{{SPINE}}`, `{{CHAPTERS}}`, `{{TRANSCRIPT}}`, `{{BRIEF}}`, `{{PREVIOUS}}`.

The transcript is not sent as one opening block. It is three 4,000-character excerpts from the start, middle and end, joined with `[...]`. That gives the model the whole arc instead of only the first twelve minutes, which on a listener-comments episode is the housekeeping before the argument starts.

`{{SPINE}}` is the episode's `Summary` plus its `Chapters`. It is the subject of every post. The transcript is labelled `SOURCE MATERIAL (details only)`, and the prompt forbids building a post around a single passing mention, a book attribution, a listener's name, an opening aside, or the source of an example. It also forbids naming a book, author, article, show, company or person unless the spine or the guest field names them.

**Why the spine exists (2026-11-16).** A revision brief said "lead with the wine maker story". The model found the only `wine maker` line in the opening transcript excerpt, which was a listener saying the analogy came from Gary North's *Honest Money*, and made the book attribution the subject of all four posts. The episode is about listener comments on enshittification, fake interest rates and sound money. The wine maker story is an example inside that argument, not the episode. The spine block, the transcript spread and the no-names rule are the fix.

---

## Character limit and the missing link

At sign-off there is no episode URL yet; Fountain only assigns one after publishing. The workflow therefore writes the body only and reserves the link:

```text
copy (max 256) + space + URL (23) = 280
```

`Characters` on the row is the final count including the link. Every message shows `N of 280 with the link`.

The stored `Copy` does **not** contain the URL. The link is appended when the post is actually sent: today that is a human copying the row and pasting the episode link, and later the X automation will read the episode's published URL and append it. Do not add a URL to `Copy`; it would break the count.

If the model returns something over 256, the workflow trims at a sentence boundary, then at a word boundary. It never writes a row over 280.

---

## Airtable schema

### `Social Posts` table (`tbly8EpeOlYrXHYNE`)

One row per option. Four rows per round.

| Field | Type | Notes |
|---|---|---|
| `Name` | single line | `<BA-xxxx> · R<round> · O<option>` |
| `Episode` | link → Episodes | The episode the copy is for |
| `Episode ID` | lookup | `ID` from the linked episode; used by the trigger guard and messages |
| `Episode Title` | lookup | `Title` from the linked episode |
| `Platform` | single select | `Default`, `X`, `YouTube`, `Instagram`, `Nostr`. First draft is `Default`. |
| `Status` | single select | `Proposed`, `Selected`, `Rejected`, `Revising` |
| `Option` | number | 1 to 4 |
| `Round` | number | 1 for the first draft; increments on each revision |
| `Copy` | long text | The post body. No URL. |
| `Angle` | single line | A short label for the approach, shown in the message |
| `Characters` | number | Body + space + a 23-character URL |
| `Revision Brief` | long text | The producer's feedback, verbatim. Cleared after a successful redraft. |
| `Created` | created time | |
| `Last Modified Time` | last modified time | The trigger field |

### Episodes

`Social Posts` (`fldJ5giVD2wQAz5Ix`) is the reverse link. It is how the drafting workflow knows an episode already has options, and it stops the poller re-drafting on every later edit.

### Publications

| Field | Type | Notes |
|---|---|---|
| `Post Copy` | long text (`fldlcFUBDkERxF8Tf`) | The chosen body, copied from the selected `Social Posts` row |
| `Social Post` | link → Social Posts (`fldVjKmQ3RMFsS6cr`) | The exact option that was chosen |
| `Platform` | single select | Needs an `X` option. The row is `BA-xxxx - X`, `Status = Pending`. |

⚠️ **Manual setup step:** Airtable would not accept an `X` choice through the API. Add `X` to the `Platform` field on `Publications` in the Airtable UI. Until it exists, the selection workflow's create call will fail. The empty choice created during the 2026-11-16 test can be renamed to `X` instead of adding a new one.

The selection workflow only writes `Post Copy` and `Social Post` on an existing X row. It does not reset `Status` on an existing row, so re-picking a different option after the post is live does not knock it back to `Pending`.

---

## The three workflows

### 1. Draft — `BA - Episode Approved > Social Posts Drafted` (`ntXHSW3AbNntnaj0`, ACTIVE)

- Fires on any change to an Episodes row whose `Status` is one of `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`, **and** whose `Social Posts` link is empty. This set of statuses matters: `Approved` is transient because the artwork workflow moves the row on, so a narrow `Status = Approved` trigger would race it and miss the episode.
- Skips a placeholder title (`[Clip]`), a missing title, and an episode with neither summary nor transcript.
- Fetches the `Social Post` prompt, drafts four, runs the `Social Post Editor` pass, validates, writes four `Proposed` rows and posts one Telegram message.
- **Does not change the Episode `Status`.** Social copy is a side stage, like the publish-readiness checklist. Artwork and publishing are untouched.

### 2. Select — `BA - Social Post Selected > X Publication Linked` (`6m5s6x2sYMWJRz1s`, ACTIVE)

- Fires when a `Social Posts` row becomes `Selected`.
- Reads the episode's rows, finds the chosen row and its siblings.
- Creates `BA-xxxx - X` in `Publications` if it does not exist, or updates its `Post Copy` and `Social Post` link if it does.
- Marks the other three `Rejected`.
- Posts a confirmation with the chosen copy and its final character count.

### 3. Revise — `BA - Social Post Revising > Four Redrafted` (`G4GoqVPpUMJWoEmM`, ACTIVE)

- Fires when a `Social Posts` row becomes `Revising`.
- Refuses to redraft if a row is already `Selected`; it posts a short "already picked" notice instead. Clear the selection in Airtable if a redraft is genuinely wanted.
- Reads `Revision Brief` from the Revising row, passes the rejected round and the brief to the writer, runs the editor, and rewrites all four rows in place. `Round` increments, `Status` returns to `Proposed`, and the brief is cleared.
- Posts the four new options with the same reply instructions.

---

## Talking to the bot

The Telegram Assistant's `Airtable Agent` system message has a `SOCIAL POSTS` section. The reply shapes are:

- `option 2` / `2` / `the second one` → set that row's `Status = Selected`.
- `revise: lead with the wine story, less formal` → set Option 1's `Revision Brief` and `Status = Revising`.

The assistant proposes the write; the normal approval tap still applies. It never writes `Copy`, `Angle` or `Characters`, and it does not touch the Publication row itself.

---

## Testing record (2026-11-16)

- Manual pinned run on `BA-HRwIMb` (a real Take) produced four options and a clean Telegram message. Character counts: 267, 273, 278, 251 with the link.
- Manual pinned revision with the brief "Make it punchier. Under 200 characters." produced 173, 167, 194, 160 with the link.
- Manual pinned revision with "Make it more personal and lead with the wine maker story." initially produced four posts about Gary North's book. After the spine, transcript-spread and no-names fix, the same brief produced four posts about the episode's argument (wine maker flaw, incentives, deflation, the word capitalism), with no book or author named.
- A live trigger test used a temporary Episodes row (`BA-6prm8M`): the poller fired, created four `Proposed` rows, and sent to Jonny's DM. The temporary episode and its rows were deleted.
- Manual pinned selection created `BA-HRwIMb - X`, filled `Post Copy`, linked the chosen row, and rejected the other three. The test row was deleted.
- **Not yet exercised:** the Telegram assistant's `option N` and `revise:` paths end to end, and a selection after `X` is added to the `Publications` Platform field.

---

## Gotchas

- **The 24-character reservation assumes a 23-character URL.** X counts every link as 23 characters. If the posting platform counts differently, change `LIMIT_BODY` and the `+ 24` in both `Parse Options` and `Parse Revision`, and the message copy.
- **The drafting trigger is a whole-table poller.** Every edit to an episode in the allowed statuses starts an execution; the guard exits in milliseconds. This is deliberate: a view trigger would need a hand-made view and a status flip, and the status is owned by artwork.
- **Do not put a second Telegram trigger on the bot.** These workflows only send.
- **The `Social Post` and `Social Post Editor` rows are live prompts.** Edit them in Airtable; no deploy and no credential rebind.
- **The editor is a second model call.** It roughly doubles the generation time and cost per episode. If that becomes a problem, the editor pass can be removed by rewiring `Draft with OpenRouter` straight to `Parse Options` (and `Redraft` straight to `Parse Revision`).
- **A revision never fails on a numeric brief length.** The writer is told to honour a number in the brief, but only the 280 hard limit is enforced. If a brief says "under 220" and the result is 229, ask again or edit the row.
