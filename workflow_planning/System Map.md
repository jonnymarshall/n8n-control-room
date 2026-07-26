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

<!-- ═══════════════════════════════════════════════════════════════════════════════
     ▼▼▼  PASTE EVERYTHING BELOW THIS LINE into the Airtable "System Map" row (Prompt field)  ▼▼▼
     (Start at the "# System Map" heading; it is the agent-facing content.)
     ═══════════════════════════════════════════════════════════════════════════════ -->

# System Map — Guy's Take Production Pipeline

> **How the agent should use it:** the pipeline is a state machine keyed on the
> Episode `Status` field. To answer "what does this episode need before X runs?",
> find the workflow for stage X below, read its **Preconditions checklist**, then
> read the actual episode row from Airtable and report which checklist items are
> not yet satisfied. You can read any episode field; you cannot see Airtable view
> filters, so the checklists here ARE the view filters, spelled out.

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
          AI Analysis Complete            (Frame.io metadata workflow: transcript + summary + chapters + title/caption options)
             --[human: pick a title + caption, set Approved]-->
          Approved
             --[auto, if artwork preconditions met]-->
          Generating Artwork  (transient)
             --[auto]-->
          Awaiting Thumbnail Pick          (4 options posted to Telegram)
             --[human: set one Thumbnails row to Selected]-->
          Artwork Ready                    (+ 1:1 and 9:16 versions generated)
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
3. Pick a title and thumbnail caption, then set the episode to `Approved`.
4. Pick one of the 4 thumbnail options (set a Thumbnails row to `Selected`).

Everything between those is automatic.

**Optional actions (not required to progress an episode):**
- **Revise the chosen artwork** — after artwork is picked (`Artwork Ready`), you can
  brief a targeted redo of the final thumbnail in place. See Artwork **Path 3**.

---

## Episode `Type` (single-select)

Type shapes both the metadata summary voice and the thumbnail layout, and it
determines whether a guest is required.

| Type | Meaning | Guest required? | Summary voice | Thumbnail |
|---|---|---|---|---|
| `Take` | Solo episode, host breaks down a topic alone | **No** | First person (host) | Solo (host close-up) |
| `Chat` | Longform conversation, host + guest(s) | **Yes** | First person, names the guest | Duo (host + guests) |
| `Roundtable` | Monthly rundown with the regular group | **Yes** | First person, recap of the month | Roundtable (film-poster lineup) |
| `Clip` | Short snippet cut from a longer episode | **Yes** (inherited from parent) | Third person, centred on the guest | Duo |
| blank / unknown | Unrecognised | n/a | General first person | Routed to manual artwork |

A `Clip` inherits its guest from its parent via the `Associated Episode` link.

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
| `Thumbnail Caption` | long text | The artwork headline. **Currently set by hand** (a precondition for artwork). |
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
  `Chapters`, `Chapters JSON`, `Frame.io URL`, `Duration (s)`. Posts the title and
  caption options to the group.
- **Next:** a human picks a title + caption and sets the episode to `Approved`.

### 4. Thumbnail Artwork
Two paths in one workflow.

**Path 1 — Generate.**
- **Fires:** an Episode enters the "ready for artwork" view (i.e. all the
  preconditions below become true while `Status = Approved`).
- **Preconditions checklist (Episode) — this is the answer to "what does this
  episode need before artwork is created?":**
  - [ ] `Status` = `Approved`
  - [ ] `Transcript` is not empty
  - [ ] `Summary` is not empty
  - [ ] `Thumbnail Caption` is not empty  *(often the missing one, it is set by hand)*
  - [ ] `Thumbnails` is empty (no artwork generated yet)
  - [ ] `Status` is not already `Generating Artwork`
  - [ ] **Either** `Type` = `Take` **or** `Guests` is not empty
        *(a guest-less `Chat` / `Roundtable` / `Clip` will NOT trigger and will
        silently wait out of the view until a guest is linked — there is no
        automated nudge for this; check by hand)*
  - [ ] `Guests` does **NOT** include the host (Guy). Guy is always drawn from the
        reference library, so if he is also linked as a guest he gets rendered
        **twice** in the thumbnail. `Guests` is for non-host participants only.
        (A code guard also strips him, but keep him out of `Guests` anyway.)
- **Does:** sets `Generating Artwork`, generates 4 sixteen-by-nine options (layout
  by Type), creates 4 `Thumbnails` rows (`Proposed`), posts them as a Telegram
  album, then sets the episode to `Awaiting Thumbnail Pick`. If Type is blank /
  unrecognised it instead sets `Awaiting Manual Artwork` and asks for manual art.
- **Next:** a human sets one `Thumbnails` row `Status = Selected`.

**Path 2 — Select.**
- **Fires:** a `Thumbnails` row's `Status` becomes `Selected`.
- **Preconditions checklist:**
  - [ ] One `Thumbnails` row for the episode has `Status = Selected`.
- **Does:** marks the other options `Rejected` and unlinks them, sets the episode
  to `Artwork Ready`, generates the 1:1 and 9:16 versions of the chosen image (the
  chosen row is set to `Final`), and confirms on Telegram.
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

## Conventions you rely on
- Every episode-related Telegram message includes the episode `ID` (`BA-xxxx`) so
  replies have a unique anchor. When someone replies "change the title" / "delete
  this", read the `BA-xxxx` out of the message they replied to.
- The pipeline is driven by Episode `Status`. When someone asks "where is this
  episode?" or "why hasn't X happened?", locate the episode's `Status` on the
  ladder and compare the next stage's precondition checklist against the row.
