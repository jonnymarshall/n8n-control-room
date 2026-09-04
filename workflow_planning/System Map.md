<!-- ═══════════════════════════════════════════════════════════════════════════════
     REPO-ONLY META — do NOT paste this block into Airtable.
     This blockquote just explains how the repo file and the live Airtable row relate.
     ═══════════════════════════════════════════════════════════════════════════════ -->

> **This document is the Telegram assistant's "brain."** The **live copy lives in
> Airtable**: base Guy's Take (`app8Xw9Tq0XLjhmp9`), table **`Prompts`**
> (`tblhG1nw2P1k3CBVU`), the row where `Name = "System Map"` (text in the `Prompt`
> field). The assistant reads it **on demand** via its Airtable read tool whenever
> a question is about how the pipeline works or what an episode needs next, so
> **editing the Airtable row updates the assistant instantly, no n8n change and no
> credential rebind.** This repo file is the authoring source and a backup; when
> you change the Map, edit the Airtable row (and paste the change back here to keep
> them in sync).
>
> **They had drifted by 2026-08-20** — the Airtable row had gained a whole "Known
> problems and recent fixes" section, a full `Type` option list and a corrected
> "three paths" count that this file never received, while this file carried two
> blockquotes and two conventions bullets Airtable did not have. Both copies were
> reconciled that day and are byte-identical below the paste line. **Always read the
> live Airtable row before pasting over it** — pasting this file blind would have
> destroyed the Known-problems section.

<!-- ═══════════════════════════════════════════════════════════════════════════════
     ▼▼▼  PASTE EVERYTHING BELOW THIS LINE into the Airtable "System Map" row (Prompt field)  ▼▼▼
     (Start at the "# System Map" heading; it is the agent-facing content.)
     ═══════════════════════════════════════════════════════════════════════════════ -->

# System Map — Guy's Take Production Pipeline

*Last updated 2026-08-20. Artwork Path 2 now skips the 1:1 / 9:16 versions for `Clip`,
`Read` and `Audionauts` episodes; the reject/status half of Path 2 still runs for every
type. Previously: 2026-08-11, when the thumbnail view's filter was transcribed from the
real Airtable UI rather than from memory and the Jonny-picked-moods path was confirmed
working (exec #1752).*

> **How the agent should use it:** the pipeline is a state machine keyed on the
> Episode `Status` field. To answer "what does this episode need before X runs?",
> find the workflow for stage X below, read its **Preconditions checklist**, then
> read the actual episode row from Airtable and report which checklist items are
> not yet satisfied. You can read any episode field; you cannot see Airtable view
> filters, so the checklists here ARE the view filters, spelled out.
>
> **Because view filters are invisible to the API, these checklists cannot be
> verified programmatically — they are hand-transcribed and have been WRONG before.**
> On 2026-08-11 the artwork checklist below was missing half of its `Status`
> condition, and a re-run silently never fired as a result. If a workflow refuses
> to trigger while every item here appears satisfied, suspect this document before
> you suspect the workflow, and ask Jonny to screenshot the view's filter panel.

---

## The episode lifecycle (state machine)

An episode moves through these `Status` values. Each arrow is either **[auto]**
(an automation advances it) or **[human]** (someone sets it by hand, in Airtable
or by asking you).

```
Shortlist: Shortlisted --[human: Picked]--> Picked --[auto]--> Scripted
                                                |
                                                v  (Script Generation creates the Episode)
Episode:  Script Ready
             --[human: record, edit, upload final cut to Frame.io]-->
          AI Analysis Complete            (Frame.io metadata workflow: transcript + summary + chapters, then a "Packaging for ..." message)
             --[human: ONE reply setting title, caption, guests, moods and image prompt]-->
          Approved
             --[auto, if artwork preconditions met]-->
          Generating Artwork  (transient)
             --[auto]-->
          Awaiting Thumbnail Pick          (4 options posted to Telegram)
             --[human: set one Thumbnails row to Selected]-->
          Artwork Ready                    (+ 1:1 and 9:16 versions generated, except for Clip / Read / Audionauts)
             --[later / not yet fully built]-->
          Ready to Publish --> Published
```

**Branch / holding states** (not on the straight line):
- `Awaiting Manual Artwork` — the artwork workflow could not auto-generate (Type is
  blank or unrecognised). Someone must make the artwork by hand.
- `Revising` — this is a **Thumbnails row** status (not an Episode status). The
  chosen thumbnail is being re-generated from a written brief (see Artwork Path 3).
  The row returns to `Final` when done; the Episode stays `Artwork Ready`
  throughout.
- The state named in the ladder before `Approved` in the raw enum can list
  `Edited` / `Transcript Ready` / `Recorded`, but the **built pipeline skips
  them**: the Frame.io upload jumps an episode straight to `AI Analysis Complete`.
  Treat `AI Analysis Complete` as the real state after upload.

**Human handoffs (the only steps a person must do):**
1. Pick a Shortlist topic (`Shortlisted` -> `Picked`).
2. Record + edit + upload the final cut to Frame.io, named `BA-{id}_...`.
3. **Reply to the "Packaging for ..." Telegram message.** One reply can set the title,
   the thumbnail caption, any guests to add, the thumbnail moods, and the **custom image
   prompt**. The image prompt is the one that gates artwork — nothing generates without
   it. Then set the episode to `Approved`.
4. Pick one of the 4 thumbnail options (set a Thumbnails row to `Selected`).

Everything between those is automatic.

**Optional actions (not required to progress an episode):**
- **Revise the chosen artwork** — after artwork is picked (`Artwork Ready`), you can
  brief a targeted redo of the final thumbnail in place. See Artwork **Path 3**.

---

## Episode `Type` (single-select)

Type shapes both the metadata summary voice and the thumbnail layout, and it
determines whether a guest is required.

The full option set is `Chat`, `Take`, `2 Sats`, `Read`, `Clip`, `Audionauts`,
`Roundtable`. Only the four below are handled by the artwork code; see the
artwork section for what happens to the others.

| Type | Meaning | Guest required? | Summary voice | Thumbnail |
|---|---|---|---|---|
| `Take` | Solo episode, host breaks down a topic alone | **No** | First person (host) | Solo (host close-up) |
| `Chat` | Longform conversation, host + guest(s) | **Yes** | First person, names the guest | Duo (host + guests) |
| `Roundtable` | Monthly rundown with the regular group | **Yes** | First person, recap of the month | Roundtable (film-poster lineup) |
| `Clip` | Short snippet cut from a longer episode | **Yes** (inherited from parent) | Third person, centred on the guest | Duo 16:9 only — **no 1:1 / 9:16 versions** |
| blank / unknown | Unrecognised | n/a | General first person | Routed to manual artwork |

A `Clip` inherits its guest from its parent via the `Associated Episode` link.

**Which types get the square and vertical artwork.** After a thumbnail is picked, the
1:1 and 9:16 versions are generated for `Take`, `Chat`, `Roundtable` and `2 Sats` only.
They are **skipped for `Clip`, `Read` and `Audionauts`** (2026-08-20): a Clip is cut from
an episode that already has its own artwork, and Read / Audionauts never get
auto-generated artwork in the first place. Everything else about picking a thumbnail —
rejecting the other options, setting the episode to `Artwork Ready`, marking the pick
`Final`, the Telegram confirmation — still happens for **every** type. If someone asks
why a Clip has no 9:16, this is why, and it is deliberate, not a failure.

---

## Key Episode fields the agent reasons about

| Field | Type | Meaning / who fills it |
|---|---|---|
| `ID` | text | `BA-xxxx`. The anchor key in every Telegram message. Not a number. |
| `Title` | text | Episode title. Human picks it from the AI options. |
| `Status` | single-select | The state-machine driver (ladder above). |
| `Type` | single-select | `Take` / `Chat` / `Roundtable` / `Clip`. |
| `Summary` | long text | AI podcast-listing summary. Written by the metadata workflow. |
| `Script` | long text | Talking-head script. Written by Script Generation. |
| `Transcript` | long text | Verbatim transcript with `[MM:SS]` markers. Written by the metadata workflow. |
| `Chapters` | long text | Human-readable chapter list. Written by the metadata workflow. |
| `Chapters JSON` | attachment | Podcasting 2.0 chapters file. Written by the metadata workflow. |
| `Frame.io URL` | URL | Link to the cut. Written/refreshed by the metadata workflow. |
| `Duration (s)` | number | Integer seconds. Written by the metadata workflow. |
| `Thumbnail Caption` | long text | The artwork headline. Set by Jonny's reply to the packaging message (`TC1`–`TC5` or his own wording). A precondition for artwork. |
| `Custom Image Prompt` | long text | **His free-text art direction for this episode's artwork.** Set by the same reply. **This is the field artwork is gated on** — an episode with it empty never generates, with no error and no reminder. `default` (or `none`) is a valid answer meaning "no extra direction". Fills a `{{CUSTOM}}` placeholder in the layout prompt template. |
| `Thumbnail Moods` | long text | Comma-separated mood names he picked, e.g. `confident, shocked`. Matched by name (case-insensitively) against the `Thumbnail References` library and cycled across the 4 artwork options **in the order given** — one mood means all four use it, two means they alternate. Empty or all-unmatched quietly falls back to the whole library, so a typo costs variety rather than breaking the run. Not a gate. |
| `Guests` | link -> Guests | The linked guest(s). Required for `Chat` / `Roundtable` / `Clip`. |
| `Guest Name` | lookup | Guest name(s) pulled from the link (the raw link returns record IDs). |
| `Associated Episode` | link -> Episodes | A Clip points at its longform parent (guest inheritance). |
| `Thumbnails` | link -> Thumbnails | The generated artwork rows. Empty = no artwork made yet. |

---

## The workflows

Base for all content workflows: **Guy's Take** (`app8Xw9Tq0XLjhmp9`),
Episodes table `tbl3uYLIvtB9APZp6`.

### 1. Weekly Research & Shortlisting
- **Fires:** every **Friday 7am**. Clock only, no episode preconditions.
- **Does:** scrapes Bitcoin YouTube feeds, writes the top 8 clustered topics into
  the `Shortlist` table (`Status = Shortlisted`), and DMs Jonny a ranked digest.
- **Next:** a human sets a Shortlist row `Status = Picked`.

### 2. Script Generation
- **Fires:** a `Shortlist` row's `Status` becomes `Picked`.
- **Preconditions checklist (Shortlist row):**
  - [ ] `Status` = `Picked`
  - (An active `Sponsors` row is used if present, but is not required.)
- **Does:** creates a new **Episode** (`Status = Script Ready`) with `Title`,
  `Summary`, `Script`, `References`, and a link back to the Shortlist row; attaches
  a slideshow HTML; sets the Shortlist row to `Scripted`; DMs Jonny the script.
- **Next:** human records + edits + uploads the final cut to Frame.io.

### 3. Frame.io Uploaded > AI Metadata
- **Fires:** a file becomes ready in the Frame.io project (any upload).
- **Preconditions checklist (for the full AI run):**
  - [ ] The uploaded file is **video or audio** (images / PDFs are skipped with a heads-up).
  - [ ] The filename starts with the episode ID, `BA-{id}_...` (this is how the
        upload is matched to the episode). No prefix = no episode match.
  - [ ] The filename does **not** end in `_bypass` (that forces a URL-only refresh).
  - [ ] The upload is **not** a same-length re-export of an existing cut (that also
        forces a URL-only refresh; audio always runs the full pipeline).
- **Does (full run):** transcribes the media, generates 5 title options, 5
  thumbnail-caption options, a timecoded description, a Type-aware `Summary`, and
  chapters. Writes `Status = AI Analysis Complete`, `Summary`, `Transcript`,
  `Chapters`, `Chapters JSON`, `Frame.io URL`, `Duration (s)`.
- **Then posts TWO Telegram messages:**
  1. the description file, with a short caption (episode title + `ID` only);
  2. a **"Packaging for ..."** message — **this is the one to reply to.** It shows the
     title and guests already on the episode, the 5 title options (`T1`–`T5`), the 5
     caption options (`TC1`–`TC5`), the **list of available moods read live from the
     `Thumbnail References` table**, and an ask for the **custom image prompt**.
     Each item names the Airtable field it lands in.
  Replying to the *file* instead of the packaging message will not work properly — the
  file's caption no longer carries the options, so `T3` can't be resolved from it.
- **Next:** Jonny replies (see human handoff 3) and sets the episode to `Approved`.

### 4. Thumbnail Artwork
Three paths in one workflow.

**Path 1 — Generate.**
- **Fires:** an Episode enters the "ready for artwork" view, i.e. all the preconditions
  below become true. Two things commonly misunderstood about this view: it does **not**
  filter on `Status = Approved`, but it **does** exclude two specific statuses, so
  clearing an episode's `Thumbnails` is *not by itself* enough to bring it back in.
- **Preconditions checklist (Episode) — this is the answer to "what does this
  episode need before artwork is created?":**
  - [ ] `Transcript` is not empty
  - [ ] `Summary` is not empty
  - [ ] `Thumbnail Caption` is not empty  *(set by the packaging reply)*
  - [ ] `Custom Image Prompt` is not empty  ***(the most common missing one. Only
        Jonny's reply fills it, and nothing chases him if he skips it. Replying
        `default` counts.)***
  - [ ] `Thumbnails` is empty (no artwork generated yet)
  - [ ] `Status` is **none of** `Awaiting Thumbnail Pick` / `Generating Artwork`
        ***(both, not just the second one — this is the half that was missing from this
        document until 2026-08-11 and it cost a debugging session)***
  - [ ] **Either** `Type` is one of `Take` / `2 Sats` / `Read` / `Clip`, **or**
        `Guests` is not empty
        *(this is how `Chat` and `Roundtable` qualify — they must have a guest linked.
        A guest-less `Chat` / `Roundtable` / `Clip` will NOT trigger and will silently
        wait out of the view until a guest is linked; there is no automated nudge, so
        check by hand)*
  - [ ] `Guests` does **NOT** include the host (Guy). Guy is always drawn from the
        reference library, so if he is also linked as a guest he gets rendered
        **twice** in the thumbnail. `Guests` is for non-host participants only.
        (A code guard also strips him, but keep him out of `Guests` anyway.)
- **⚠️ How to RE-generate artwork for an episode that already has options.** Deleting
  the four `Thumbnails` rows satisfies `Thumbnails is empty`, but the episode is still
  `Awaiting Thumbnail Pick`, which the view excludes — so it stays out, nothing runs,
  and **there is no error anywhere to tell you why**. You must ALSO set `Status` back to
  `Approved` (or any status outside the two excluded ones). If someone asks you to
  regenerate artwork, propose both writes together, and say plainly that the status
  change is what actually re-arms the trigger. Also warn them it costs 4 fresh images.
- **Does:** sets `Generating Artwork`, generates 4 sixteen-by-nine options (layout
  by Type), creates 4 `Thumbnails` rows (`Proposed`), posts them as a Telegram
  album, then sets the episode to `Awaiting Thumbnail Pick`. If Type is blank /
  unrecognised it instead sets `Awaiting Manual Artwork` and asks for manual art.
- **Note the view and the code disagree about `Type`.** The view lets `2 Sats` and
  `Read` through, but the workflow only auto-arts `Take` / `Chat` / `Clip` /
  `Roundtable`, so those episodes enter, start the run, and are immediately routed to
  `Awaiting Manual Artwork`. `Audionauts` is in neither list. Entering the view is not
  the same as being auto-artable.
- **What makes the 4 options differ:** the moods in `Thumbnail Moods`, cycled across the
  slots, plus whatever `Custom Image Prompt` says. **Jonny picks the moods** — an AI step
  used to choose them and was removed on 2026-08-11, along with four hardcoded framing
  variations. Consequence worth stating if he asks why the options look alike: picking a
  **single** mood now gives four closely-related images.
- **Diagnosing "it ignored my moods":** the `Resolve Vibes` node emits a `moodSource`
  field on every run. `picked` means his chosen moods were used; `fallback-all-moods`
  means none of them matched the `Thumbnail References` library by name and the whole
  library was used instead. A mood typo, or a renamed library row, produces the second
  case — quietly, with a successful-looking run. Confirmed working 2026-08-11 (exec
  #1752, a `Chat`): two picked moods cycled ABAB across the four options.
- **Next:** a human sets one `Thumbnails` row `Status = Selected`.

**Path 2 — Select.**
- **Fires:** a `Thumbnails` row's `Status` becomes `Selected`. (The trigger view was
  renamed `Selected` → `Ready for 1X1 & 9X16 Thumbnails *J*` on 2026-08-20. Same view,
  same single condition `Status = Selected`, **no type filter** — the name describes only
  one of the three things it fires.)
- **Preconditions checklist:**
  - [ ] One `Thumbnails` row for the episode has `Status = Selected`.
- **Does, for every episode type:** marks the other options `Rejected` and unlinks them,
  sets the episode to `Artwork Ready`, sets the chosen row to `Final`, confirms on
  Telegram.
- **Does, only for eligible types:** generates the 1:1 and 9:16 versions of the chosen
  image and posts them back. **Skipped for `Clip`, `Read` and `Audionauts`** (2026-08-20).
  The Telegram confirmation says so explicitly in that case, so read it rather than
  assuming a failure.
- **If asked "why does this Clip have no 9:16?"** — by design, not a bug. Say that
  Clips deliberately reuse the parent episode's square and vertical artwork. Do **not**
  propose re-picking the thumbnail or editing the trigger view to fix it. If Jonny really
  wants those versions for one Clip, the route is a **Path 3 revision** on the `Final`
  row with `Revision Targets` set to `1x1` / `9x16` — that path is manual and has no type
  gate, so it will run.
- **Next:** publishing (see below), or an optional revision (Path 3).

**Path 3 — Revision (briefed, in-place, targeted).**
- **Fires:** the chosen (`Final`) `Thumbnails` row's `Status` becomes `Revising`.
- **What it's for:** re-doing the picked artwork with a written instruction, for one
  or more aspect ratios, without regenerating the 4 options or re-picking. Example:
  "make the background more red and lose the laptop, just the 9x16."
- **How to request it** (this is the recipe when someone asks you to revise / re-do
  / re-create / change an episode's artwork):
  1. Find the episode's chosen thumbnail: the `Thumbnails` row linked to that
     episode whose `Status = Final`. (There is normally exactly one.)
  2. Propose ONE write to that row, setting only:
     - `Revision Brief` = the user's requested change, verbatim and complete.
     - `Revision Targets` = the aspect ratios they named, each one of `16x9`,
       `1x1`, `9x16`. If they name none, use all three.
     - `Status` = `Revising`.
- **Preconditions checklist:**
  - [ ] The episode is already `Artwork Ready` (artwork has been picked; a `Final`
        thumbnail row exists). If not, the artwork hasn't been selected yet — say so
        instead of writing.
  - [ ] `Revision Brief` is non-empty and at least one valid `Revision Target` is set.
- **Does:** re-generates **only** the named aspect ratios from the brief, editing
  each ratio's current image in place, overwrites them on the same row, sends the
  new artwork back to the group, then resets the row to `Final` (clearing the brief
  and targets). No forced cascade: it changes only what was named; revising the
  `16x9` alone leaves the 1:1/9:16 as they were (with a heads-up note).
- **Next:** publishing, or another revision.

### 5. View to Published
- **Fires:** an Episode enters a specific "ready to publish" view.
- **Does:** sets `Status = Ready to Publish`. (The full publishing fan-out is not
  yet built.)

### 6. n8n GitHub Backups
- **Fires:** daily at **3am**. Infra only. Backs up every workflow's JSON to a
  private GitHub repo. No episode involvement.

### 7. Workflow Failed > Telegram Alert
- **Fires:** whenever any workflow that names it as its error handler fails.
- **Does:** posts the failure (workflow, node, error, execution link) to the group
  and logs it to an Ops Log table. No episode involvement.

---

## Known problems and recent fixes (as of 2026-08-20)

When someone reports something broken, check here first — it may already be known.
The bug log is the **Automation Upgrades** table (base `appwcz1Bux9YLcZYm`, table
`tblja27Lsn7qXJfZM`); read it to answer "what's currently broken?" and add to it when
something new is reported.

- **Clip / Read / Audionauts skipping the 1:1 and 9:16 — NEW 2026-08-20, not yet run.**
  This is intended behaviour, not a bug, but it has not been confirmed on a real pick
  yet. If a **non**-Clip episode stops getting its square and vertical versions, that IS
  a regression and the `reversionOk` check is the place to look.
- **Roundtable artwork has never been run end-to-end.** STILL OPEN. It was wired up in
  July but only started actually fetching guest photos on 2026-08-11 (before that every
  Roundtable silently fell back to a solo host shot). Treat a Roundtable result as
  unverified until one has been confirmed.
- **Greyscale subjects in artwork — fixed 2026-08-11, NOT YET CONFIRMED on a real run.**
  Jonny reported artwork "coming through greyscale". The real symptom was narrower: a
  vividly coloured background with the *people* rendered grey. Cause was not the
  reference photos (those are full colour) but the layout prompts, which had been
  stripped of their palette direction and left with **no colour instruction at all**, so
  the image model desaturated the subjects by default. All three layout prompts now
  carry a `COLOUR — NON-NEGOTIABLE` block, and the two reversion prompts plus the
  revision prompt carry a one-line version. **Jonny's rule: monochrome BACKGROUNDS are
  fine, greyscale PEOPLE never are.** If he reports it again, the fix did not hold — say
  so plainly rather than re-diagnosing from scratch.
- **Jonny-picked moods — fixed and verified 2026-08-11.** Shipped broken twice over (the
  workflow change was never published, and the code read a field name that did not
  exist), which is why artwork that day ignored his mood choices. Both fixed, confirmed
  working in exec #1752. Listed here only so a repeat report is recognised as a
  *regression* rather than the original bug.

---

## Conventions you rely on
- Every episode-related Telegram message includes the episode `ID` (`BA-xxxx`) so
  replies have a unique anchor. When someone replies "change the title" / "delete
  this", read the `BA-xxxx` out of the message they replied to.
- The pipeline is driven by Episode `Status`. When someone asks "where is this
  episode?" or "why hasn't X happened?", locate the episode's `Status` on the
  ladder and compare the next stage's precondition checklist against the row.
- **Status is not the whole story.** Several stages are gated by field conditions rather
  than by `Status`. Never say an episode "should run soon" on the strength of its status
  alone — walk the checklist and name the specific fields that fail.
- **Status can also be what BLOCKS a stage.** The artwork view excludes two statuses
  outright, so an episode can satisfy every field condition and still never fire. When a
  stage refuses to run, check the excluded statuses as well as the required fields.
- **Episode `Type` can also decide whether a step runs at all**, separately from status
  and from any view. The clearest case is the 1:1 / 9:16 artwork, which is skipped for
  `Clip`, `Read` and `Audionauts`. Before calling a missing output a failure, check
  whether that type was ever meant to produce it.
- **A successful run is not proof the right thing happened.** Several steps degrade
  quietly rather than failing: unmatched moods fall back to the whole library, a
  guest-less Chat waits out of view forever, an unrecognised Type routes to manual
  artwork. Prefer a specific diagnostic field (like `moodSource`) over "the run went
  green".
- Artwork prompts are edited in the `Prompts` Airtable table, never in n8n. The template
  text is in the field literally named `Prompt`. The rows are `Solo Thumbnail`,
  `Duo Thumbnail`, `Roundtable Thumbnail`, `Reversion 1x1`, `Reversion 9x16`,
  `Artwork Revision`, and `System Map` (this document). Because they are read at runtime,
  a prompt edit takes effect on the very next run with no n8n deploy.
- **Never leave a layout prompt with no instruction on something that matters** (colour,
  framing, text placement). An absent constraint is not a neutral one — the image model
  picks its own default, and it will not be Jonny's. This is exactly how the greyscale
  bug happened.
- Airtable polling triggers fire when a row's `Last Modified Time` **advances**, not
  because a row is sitting in a view. A row that stops changing never re-fires by itself.
- Generating artwork costs real money per image, so don't suggest re-running it casually.
