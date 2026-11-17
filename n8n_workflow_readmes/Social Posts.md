# Social Posts (platform-neutral copy, picked like thumbnails)

Four short social post options are written for an episode after the AI metadata is signed off. They are posted to Telegram, Jonny picks one by replying, or asks for four new ones with written feedback. The chosen copy is linked to the episode's X row in `Publications`.

This is the shared readme for the feature. The four workflows have their own short readmes:

- `BA - Episode Approved > Social Posts Drafted.md`
- `BA - Social Post Selected > X Publication Linked.md`
- `BA - Social Post Revising > Four Redrafted.md`
- `BA - Schedule Every 2h > X Post Readiness.md`

---

## The shape (rebuilt 2026-11-16 from the ten recent posts)

Every option is a three-part body plus a separate CTA:

```text
P1  A poignant question or statement. One or two short sentences. It stands alone.
P2  Relate P1 to this piece of content: the shared frustration, the stakes, the tension.
P3  A direct reference to the content and what to expect. Name the format and the guest.
CTA A separate short line. "Listen below." "Check out the clip." "Get the full breakdown."
```

The body (P1 + P2 + P3) is capped at **280 characters**. The CTA and the episode link sit outside that count.

The ten recent posts share this shape and these habits:

- a hook that works on its own, not a summary of the episode
- a second beat that connects the hook to the listener's own experience or frustration
- a third beat that names the content and tells you what you will get
- a short CTA
- specific details from the episode (a name, a number, a hack, a title, a guest), used to support the theme
- short paragraphs, first person, conversational, confident, sometimes blunt or funny

They are **broad**. None of them is about one small segment. The specific detail is evidence for the episode's argument, not the argument itself.

---

## No transcript

The writer and editor are not given the transcript. They work from:

- `Title`
- `Type`
- `Summary`
- `Thumbnail Caption`
- `Chapters`
- `Guest Name`

This is deliberate. The transcript was the source of the two failures on 2026-11-16:

1. A revision brief about the wine maker story made all four posts about Gary North's book, because the opening 12,000 characters contained the listener's one-line attribution and the model treated it as the story.
2. A "punchier" revision produced a steak-versus-chicken post, a private-equity post, a "gave up on the word capitalism" post and a "dollar backed by force" post. Each was one small part of the episode, and one invented a position the host never took.

The title, summary and chapters describe the episode's actual through-line. The transcript invites the model to grab the nearest vivid detail instead. The episode summary is the spine; the chapters are the arc; the thumbnail caption is the hook the episode was packaged around.

The `Social Post` prompt still bans naming a book, author, article, show, company or person unless those supplied fields name them. That is why "Gary North" cannot come back even if a future prompt change reintroduces a transcript.

---

## Character limits

```text
body (P1 + P2 + P3)  max 280 characters
CTA                  max 120 characters, separate
link                 appended after the CTA, not counted
```

`Characters` on the row is the **body** count. The message shows `Body N / 280 · CTA M`.

The stored `Copy` is the body only. `CTA` is its own field. The final post is `Copy + blank line + CTA + blank line + link`. The link is appended when the post is sent: today that is a human copying the row and pasting the episode link, and later the X automation will read the episode's published URL and append it.

A body over 280 is trimmed at the last sentence boundary at or below 280. If no sentence boundary is usable, the run fails rather than cutting mid-thought.

---

## The two prompt rows (edit these, not the workflow)

Both live in the Airtable `Prompts` table (`tblhG1nw2P1k3CBVU`), so the wording can be tuned without an n8n deploy.

| Name | Record | What it does |
|---|---|---|
| `Social Post` | `rectYoHGj9beSqYIY` | The writer. Four options from the title, type, summary, thumbnail caption, chapters and guest, with the three-part shape, the 280-body limit, the four delivery modes and the full anti-slop list. |
| `Social Post Editor` | `recDuioM1M0NOr0AP` | The final editor. Checks the shape, breadth and accuracy, removes banned moves and "matters", and returns the same four options. It may not add facts or names. |

Placeholders in `Social Post`: `{{TITLE}}`, `{{TYPE}}`, `{{EPISODE_ID}}`, `{{GUEST}}`, `{{SUMMARY}}`, `{{THUMBNAIL_CAPTION}}`, `{{CHAPTERS}}`, `{{BRIEF}}`, `{{PREVIOUS}}`.

The editor receives an `EPISODE SPINE` block built from title, type, summary, thumbnail caption and chapters, then the four posts to edit. It has no transcript either.

---

## Model

Both calls use **`google/gemini-3.7-flash`** through the `OpenRouter [n8n]` credential.

It was compared on the same `BA-HRwIMb` input against **`openai/gpt-6-astra`** on 2026-11-16:

- Gemini 3.7 Flash produced four distinct, broad posts with concrete details ("bait and switch", "natural deflation", "listener comments") and different openings. It is about 20x cheaper.
- GPT-6 Astra was slightly more polished but more repetitive and abstract: three of the four leaned on the same "separate free markets from fiat monopolies" sentence. It costs $10/M prompt and $50/M completion.

The model is set in `Build Social Request`, `Build Edit Request`, `Build Revision Request` and `Build Edit Request` (the revision copy). Change the `model` string in those Code nodes; no credential change.

---

## Humanizer inputs (2026-11-16)

Two more repos were reviewed: `lynote-ai/humanize-text` and `sgaofen/humanizer-local-model`.

**Not used:** `humanize-text`'s translation chain (English → Chinese → Japanese → Finnish → English). It is built for long generic prose, needs translation API keys, and would mangle facts and voice in a 280-character post.

**Used, in the writer and editor:**

- "Vary sentence length on purpose. A three-word sentence next to a longer one is good. Do not let every sentence settle into the same length or shape. It is fine to sound uneven." (burstiness, from both repos)
- "Cut hedging, throat-clearing, and any sentence that only announces what comes next." (local model instruction)
- "Prefer the concrete word over the abstract one." (local model instruction)
- "Every fact, number, unit, date, name and quotation in the supplied fields must survive unchanged. Do not smooth a specific detail into a generic one." (local model's fact-preservation rule)

The local model itself is not installed; its instruction was the useful part. The translation chain is not in the workflow.

---

## Airtable schema

### `Social Posts` table (`tbly8EpeOlYrXHYNE`)

One row per option. Four rows per round.

| Field | Type | Notes |
|---|---|---|
| `Name` | single line | `<BA-xxxx> · R<round> · O<option>` |
| `Episode` | link → Episodes | The episode the copy is for |
| `Episode ID` | lookup | `ID` from the linked episode; used by the guard and messages |
| `Episode Title` | lookup | `Title` from the linked episode |
| `Platform` | single select | `Default`, `X`, `YouTube`, `Instagram`, `Nostr`. First draft is `Default`. |
| `Status` | single select | `Proposed`, `Selected`, `Rejected`, `Revising` |
| `Option` | number | 1 to 4 |
| `Round` | number | 1 for the first draft; increments on each revision |
| `Copy` | long text | The body: P1, P2, P3. Max 280. No CTA and no URL. |
| `CTA` | long text (`fldSWI7GC81OBRKXw`) | The separate call to action. Max 120. Not part of the 280 count. |
| `Angle` | single line | A short label for the approach, shown in the message |
| `Characters` | number | The body count only |
| `Revision Brief` | long text | The producer's feedback, verbatim. Cleared after a successful redraft. |
| `Created` | created time | |
| `Last Modified Time` | last modified time | The trigger field |

### Episodes

`Social Posts` (`fldJ5giVD2wQAz5Ix`) is the reverse link. It is how the drafting workflow knows an episode already has options, and it stops the poller re-drafting on every later edit.

### Publications

| Field | Type | Notes |
|---|---|---|
| `Post Copy` | long text (`fldlcFUBDkERxF8Tf`) | The full chosen post: body + blank line + CTA. The link is added when the post is sent. |
| `Social Post` | link → Social Posts (`fldVjKmQ3RMFsS6cr`) | The exact option that was chosen |
| `Platform` | single select | `X`. The row is `BA-xxxx - X`, `Status = Pending`. |
| `Episode Status` | lookup (`fldOOAZZlinvogIOy`) | `Status` from the linked episode. Used by the X readiness nudge to wait for the right stage. |
| `Episode Title` | lookup (`fld8aWTMRfgsHba1D`) | `Title` from the linked episode. Used in the X readiness messages. |
| `Last Nudged At` | date/time (`fldd98VkXSENZDbuh`) | When the X readiness nudge last sent. Throttles the copy (12h) and link (24h) reminders. |

The `BA-xxxx - X` row is now created **when the four social posts are drafted**, with `Status = Pending`, `Platform = X` and no `Post Copy`. The selection workflow updates it. That is what lets the X readiness nudge see “not chosen yet” at all.

The `X` choice is in `Publications.Platform`. The full selection path was tested live on 2026-11-16: the workflow created `BA-rvik4X - X`, wrote body + CTA into `Post Copy`, linked the chosen option, set `Status = Pending`, and rejected the other three.

The selection workflow only writes `Post Copy` and `Social Post` on an existing X row. It does not reset `Status` on an existing row, so re-picking a different option after the post is live does not knock it back to `Pending`.

---

## The four workflows

### 1. Draft — `BA - Episode Approved > Social Posts Drafted` (`ntXHSW3AbNntnaj0`, ACTIVE)

- Fires on any change to an Episodes row whose `Status` is one of `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`, **and** whose `Social Posts` link is empty.
- Skips a placeholder title (`[Clip]`), a missing title, and an episode with no summary.
- Fetches the `Social Post` prompt, drafts four, runs the `Social Post Editor` pass, validates, writes four `Proposed` rows and posts one Telegram message.
- **Does not change the Episode `Status`.** Social copy is a side stage, like the publish-readiness checklist. Artwork and publishing are untouched.

### 2. Select — `BA - Social Post Selected > X Publication Linked` (`6m5s6x2sYMWJRz1s`, ACTIVE)

- Fires when a `Social Posts` row becomes `Selected`.
- Reads the episode's rows, finds the chosen row and its siblings.
- Creates `BA-xxxx - X` in `Publications` if it does not exist, or updates its `Post Copy` and `Social Post` link if it does.
- Writes `Post Copy` as body + blank line + CTA.
- Marks the other three `Rejected`.
- Posts a confirmation with the chosen body, CTA and counts.

### 3. Revise — `BA - Social Post Revising > Four Redrafted` (`G4GoqVPpUMJWoEmM`, ACTIVE)

- Fires when a `Social Posts` row becomes `Revising`.
- Refuses to redraft if a row is already `Selected`; it posts a short "already picked" notice instead. Clear the selection in Airtable if a redraft is genuinely wanted.
- Reads `Revision Brief` from the Revising row, passes the rejected round and the brief to the writer, runs the editor, and rewrites all four rows in place. `Round` increments, `Status` returns to `Proposed`, and the brief is cleared.
- The brief changes tone, angle, length and opening. It does not change the subject. A named story is an example inside the episode's theme, never a replacement for it.
- Posts the four new options with the same reply instructions.

### 4. X readiness nudges — `BA - Schedule Every 2h > X Post Readiness` (`ybngTJAUMqJaDwbB`, ACTIVE)

- Fires every 2 hours.
- Reads `Publications` where `Platform = X` and `Status = Pending`.
- **Copy nudge:** no `Post Copy`, `Episode Status` in `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish` or `Published`. Repeats every 12 hours until a post is chosen or the X row is set `Skipped`.
- **Link nudge:** `Post Copy` present, `URL` empty, `Episode Status = Published`. Repeats every 24 hours until the link is stored or the row is set `Skipped`.
- Stamps `Last Nudged At` after the Telegram send succeeds.
- It is a reminder, not a gate. It does not stop the podcast publish.

See `BA - Schedule Every 2h > X Post Readiness.md` for the exact conditions and message shapes.

---

## What triggers the draft workflow

The drafting workflow uses the house **schedule + view search** pattern:

- `Every Minute` schedule trigger
- `Ready for Social Posts View` Airtable search on `Episodes`, view `viw7OScgqnRQdCLJz`, `limit: 1`, sorted by `Last Modified Time` ascending

That takes **one episode per run**. The earlier Airtable-trigger version accepted every row a single poll returned, while the X-row creation read `.first()`, so three queued episodes produced 12 social post rows and only one X row. The schedule + limit 1 pattern removes that class of bug.

The view carries the guard:

- `Status` is any of `Approved`, `Generating Artwork`, `Awaiting Thumbnail Pick`, `Awaiting Manual Artwork`, `Artwork Ready`
- `Social Posts` is empty
- `Title` is not empty
- `Summary` is not empty

The Code node repeats the same checks as a backstop.

The selection and revision workflows poll the `Social Posts` table on `Last Modified Time`. That table only has the four option rows, so the volume is tiny.

---

## Talking to the bot

The Telegram Assistant's `Airtable Agent` system message has a `SOCIAL POSTS` section. The reply shapes are:

- `option 2` / `2` / `the second one` → set that row's `Status = Selected`.
- `revise: lead with the wine story, less formal` → set Option 1's `Revision Brief` and `Status = Revising`.

The assistant proposes the write; the normal approval tap still applies. It never writes `Copy`, `CTA`, `Angle` or `Characters`, and it does not touch the Publication row itself.

---

## Testing record (2026-11-16)

- First pinned draft on `BA-HRwIMb` used the opening transcript block and produced narrow options. The Gary North revision failure followed from that.
- After the spine and no-transcript rebuild, Gemini 3.7 Flash produced four broad options: a question about products getting worse, misplaced blame on free markets, listener feedback on "capitalism confusion", and declining quality from broken incentives. Body counts 250, 248, 256, 237; CTAs 30, 25, 13, 29.
- GPT-6 Astra on the same input was more polished but repetitive: three of four reused "separate free markets from fiat monopolies". Body counts 237, 232, 272, 251.
- A revision with "Make these broader and about the whole episode, not one small part. No narrow examples. No 'matters'. No 'Not X. Not Y.'" produced four broad options at body counts 278, 263, 234, 275, with separate CTAs. No "matters", no staccato, no invented position.
- **View trigger test (2026-11-16):** a temporary `Approved` episode in `Ready for Social Posts` (`viw7OScgqnRQdCLJz`) fired execution `25365`, created four `Proposed` rows and sent to Jonny's DM. The test transcript on the row was ignored, which proves the writer is not reading it.
- **X selection test (2026-11-16):** setting Option 1 to `Selected` fired execution `25386`, created `BA-rvik4X - X` with `Platform = X`, `Status = Pending`, `Post Copy` = body + CTA, linked the chosen row and rejected the other three.
- **Live bug found and fixed:** the Airtable trigger returns linked-record fields as arrays of record **ID strings**, not `{id, name}` objects. `Pick Selected` and `Pick Revising` assumed objects and silently skipped every live row. Both now accept either shape. The pinned tests had passed because the test payload used the object shape.
- All test rows, publications and the temporary episode were deleted.
- **2026-11-17, one-episode-per-run:** changing the draft trigger to the house schedule + view search pattern was forced by a live test where three queued episodes produced 12 social post rows in one run but only one X row. The three episodes were real (`BA-KXqegO`, `BA-nxzPcz` and a temporary `BA-4uUwFa`). The real posts were deleted and regenerated to the group (executions `26929` and `26935`) so the “Social posts ready” message exists where the X nudge points; X rows were created for both real episodes; the temporary episode and its posts were deleted. Their `Last Nudged At` was set to now so the first X nudge waits 12 hours.
- **2026-11-17, X readiness:** copy nudge execution `26855` sent two “X post not chosen” messages to Jonny's DM and stamped both rows; `26861` sent nothing because of the 12-hour cooldown. Link nudge `26866` sent one “X link needed” message for a temporary `Published` episode; `26871` planned nothing after `URL` and `Status = Published` were set. Test X row, temporary episode and its posts were deleted.
- **Not yet exercised:** the Telegram assistant's `option N` and `revise:` replies end to end, and the assistant's `resend social posts` / X link / skip X replies.

---

## Gotchas

- **A 280 body + CTA + link is longer than 280 characters.** That is the requested shape: P1-P3 stay inside 280, the CTA and link sit outside. If the account has the standard 280 limit, the final post will need trimming or the CTA posted as a reply. Decide this before the X automation is built.
- **The drafting trigger is a view poller.** `Ready for Social Posts` (`viw7OScgqnRQdCLJz`) carries the status, empty-link and title/summary conditions. The Code node repeats them as a backstop.
- **The Airtable trigger returns linked records as ID strings.** `Episode` arrives as `["rec..."]`, not `[{id, name}]`. `Pick Selected` and `Pick Revising` accept either shape; do not "simplify" them back to `link.id`.
- **Do not put a second Telegram trigger on the bot.** These workflows only send.
- **The `Social Post` and `Social Post Editor` rows are live prompts.** Edit them in Airtable; no deploy and no credential rebind.
- **The editor is a second model call.** It roughly doubles the generation time and cost per episode. If that becomes a problem, rewire `Draft with OpenRouter` straight to `Parse Options` (and `Redraft` straight to `Parse Revision`).
- **"Matters" is a hard ban.** `Parse Options` and `Parse Revision` check the body and the CTA for it and fail loudly. So is the `Not X. Not Y.` staccato pattern.
- **No transcript means no new specific details.** If a post needs a detail that is not in the summary or chapters, put it in the summary. Do not reintroduce the transcript to get it.
