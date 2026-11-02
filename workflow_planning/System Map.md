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

*Last updated 2026-10-29 (the episode status `Scheduled` is now **`Recording Scheduled`**, so it can
no longer be confused with `Scheduled to Publish`; a successful publisher run marks the
episode `Scheduled to Publish`, and the reconciler that flips it to `Published` is active.
Also stage 3 is live as two workflows: `Ready for Metadata` and
`Generating Metadata` are real `Status` options, the upload workflow stamps the row, and the
metadata workflow is triggered by the `Ready for Metadata` view. Also fixed the Airtable
`fields` read that had silently disabled the same-length check, the Audionauts exit and the
type-aware summary; visual ideas removed from the packaging message). Previously 2026-10-29 (publishing, part 2: the publisher now schedules a **same-day**
release one hour from the run instead of failing on a 06:00 publish time that has already
passed, and records the date it actually scheduled to in the new
`Publications.Scheduled Release Date` field; future dates still use `Default Publish Time`.
Also flagged that stage 3, the Frame.io → metadata trigger, is being split and re-triggered
live, see the note there). Previously: 2026-10-29 (publishing is now documented as what it actually is: a human
status flip to `Ready to Publish`, not something anyone does on Fountain — stage 5 gained an
"If someone asks you to publish" recipe saying the bot never uploads and must never answer
"I can't access Fountain", that there is no draft-only mode, that the item is scheduled at
`Publishing Settings` time rather than immediately, and that nothing sets `Published`
because the reconciler is still inactive; the ladder's `Artwork Ready` → `Ready to Publish`
arrow was wrongly shown as automatic and is now `[human]`). Previously: 2026-10-28 (Read artwork now defaults to a neutral expression but accepts a
chosen one: the packaging message asks for a facial expression, and `Thumbnail Moods` drives
`{{VIBE}}` in the Read prompt). Previously: 2026-10-22 (the Frame.io metadata workflow now stops any upload over 2 GB before
downloading it, with one Telegram alert naming the episode, after a 3.61 GB master pulled in full
and then failed Gemini's per-file cap; Reads also became a fully auto-generated artwork type, with
a book-cover ask in the packaging message and a 1:1 on pick).
Previously: 2026-10-21 (the scheduling workflow now looks the episode up by `ID` alone and
checks the status separately, so its alerts distinguish "no episode with that ID" from
"found but the status guard blocked it"; a poll email revives a `Suspended` episode to
`Scheduling`, a booking confirmation revives it straight to `Recording Scheduled`, and every route back
to `Scheduling` clears `Record Date` so a cancelled slot's time can't linger on the episode).
Previously: 2026-10-07 (the ready-for-publishing view now excludes `Clip`/`Audionauts` episodes and any episode with no 1x1 thumbnail, after a Clip wrongly reached the Fountain publisher; artwork per-option variation is now a required, front-loaded instruction, so one-mood runs stop returning identical options). The Frame.io metadata workflow now transcribes long video in
20-minute Gemini windows (chunked, then stitched), after a 2h20m roundtable degenerated
into a repetition loop in a single whole-file call. Previously: 2026-10-01 (guest intake
became an Airtable-only flow: a Chat episode's `Guest Form URL` sends the guest a
pre-filled form, and their submission creates or links a `Guests` record automatically,
stage 9; publishing to Fountain went LIVE, with the ready view `viwDfPHHKrgggdw20`
(`Status = Ready to Publish`, plus `Title`, `Frame.io URL`, `Summary`, `Chapters` and
`Thumbnails` not empty, plus `Release Date` on or after `today`, America/New_York)
driving the publisher / reconciler / content-sync trio, see stage 5); 2026-09-29
(scheduling moved from Calendly to EMAIL, `Airtable - View to Published` archived, Public
API added); 2026-09-14 (`_skip` makes a Frame.io upload fully invisible, artwork gained
per-slot composition directions).*

> **How the agent should use it:** the pipeline is a state machine keyed on the
> Episode `Status` field. To answer "what does this episode need before X runs?",
> find the workflow for stage X below, read its **Preconditions checklist**, then
> read the actual episode row from Airtable and report which checklist items are
> not yet satisfied. You can read any episode field; you cannot see Airtable view
> filters, so the checklists here ARE the view filters, spelled out.
>
> **When the request is an action rather than a question** ("publish this", "redo the
> 9x16", "send him the form"), do not stop at the checklist: find that stage's recipe —
> publishing has one at the end of stage 5, artwork revisions in stage 4 Path 3 — and
> propose the write it describes. Every stage is driven from Airtable; none of them is
> driven by you having access to the outside platform.
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
             --[human: email the scheduling poll to guests, with pod21@agentmail.to as a recipient]-->
          Scheduling
             --[auto: a guest confirms a slot; the Google Calendar invite lands in the AgentMail inbox]-->
          Recording Scheduled             (Record Date stamped from the confirmed start time)
             --[human: record, edit, upload final cut to Frame.io]-->
          Ready for Metadata              (set automatically by BA - Frame.io Uploaded > Episode Marked,
                                           which records the Frame.io link; only set when the status is
                                           Recorded or Edited and the file passed the name/size checks)
             --[auto: the Ready for Metadata view fires]-->
          Generating Metadata  (transient)
             --[auto]-->
          AI Analysis Complete            (metadata workflow: transcript + summary + chapters, then a "Packaging for ..." message)
             --[human: ONE reply setting title, caption, guests, moods and image prompt]-->
          Approved
             --[auto, if artwork preconditions met]-->
          Generating Artwork  (transient)
             --[auto]-->
          Awaiting Thumbnail Pick          (4 options posted to Telegram)
             --[human: set one Thumbnails row to Selected]-->
          Artwork Ready                    (+ enabled 1:1 / 9:16 versions per the Artwork Settings table)
             --[human: set Status = Ready to Publish, with Release Date today or later]-->
          Ready to Publish
             --[auto: the Fountain publisher claims it, uploads the video + 1x1 artwork and
                 schedules the Fountain item]-->
          Publishing  (transient)
             --[auto: the publisher uploads the video + artwork, schedules the Fountain item,
                 and marks the episode]-->
          Scheduled to Publish            (Fountain holds it; the Publication row is `Scheduled`)
             --[auto: the reconciler sees the Fountain item is PUBLISHED, every 15m]-->
          Published
```

**Branch / holding states** (not on the straight line):
- **The two "scheduled" states are now separate words.** A booked **recording** is
  `Recording Scheduled` (stage 2b, has a `Record Date`, no `Publications` row). An episode
  already handed to **Fountain** is `Scheduled to Publish` (has a `Publications` row with
  `Scheduled For`, no `Record Date` meaning). Before 2026-10-29 both were the single word
  `Scheduled`, which is exactly how a publishing question got answered off the wrong state.
- `Publishing` — transient. The Fountain publisher claims the episode with this status so it
  leaves the ready view before the (long) upload starts. It should never sit here for hours;
  if it does, the publisher run is still working or died before its failure writer could fire.
- `Publishing Failed` — the Fountain publisher failed. The reason and execution id are in the
  Telegram message and on the `Publications` row. Fix the cause, then set the episode back to
  `Ready to Publish` to retry. See stage 5.
- `Scheduled to Publish` — the Fountain item exists and is scheduled, and the episode is
  **not live yet**. The reconciler checks Fountain every 15 minutes and moves it to
  `Published` when the item goes live, so this should clear itself. If an episode sits here
  long after its `Scheduled For` time, read the `Publications` row before answering.
- `Partially Published` — the per-channel fan-out left some channels done and others not.
- `Suspended` — the episode is fully cancelled. Set when Jonny replies `suspend this
  episode` to a booking-cancellation notice (the Telegram assistant proposes the
  `Status = Suspended` write). The cancellation workflow itself only reverts to
  `Scheduling`; `Suspended` is a deliberate human follow-up. It is not a dead end: a
  reschedule poll revives it to `Scheduling`, and a slot booked off an existing link revives
  it to `Recording Scheduled` (a real booking outranks the status flag).
- `Awaiting Manual Artwork` — the artwork workflow could not auto-generate (Type is
  blank or unrecognised). Someone must make the artwork by hand.
- `Revising` — this is a **Thumbnails row** status (not an Episode status). The
  chosen thumbnail is being re-generated from a written brief (see Artwork Path 3).
  The row returns to `Final` when done; the Episode stays `Artwork Ready`
  throughout.
- `Edited` / `Transcript Ready` / `Recorded` are the pre-upload states. Since
  2026-10-29 the upload workflow stamps `Ready for Metadata` and the metadata
  workflow moves it to `Generating Metadata` and then `AI Analysis Complete`, so
  an episode is only left at `Recorded`/`Edited` if the upload did not qualify
  (or nobody has uploaded a cut yet).
- `Generating Metadata` is transient. If an episode is sitting there, a run failed
  or is in flight; check the Error Log before assuming it is working.

**Human handoffs (the only steps a person must do):**
1. Pick a Shortlist topic (`Shortlisted` -> `Picked`).
2. **Email the scheduling poll to guests**, with `pod21@agentmail.to` as a recipient
   (that email is what moves the episode to `Scheduling`), and add that inbox as a guest
   when the slot is booked so its confirmation reaches the workflow.
3. Record + edit + upload the final cut to Frame.io, named `BA-{id}_...`.
4. **Reply to the "Packaging for ..." Telegram message.** One reply can set the title,
   the thumbnail caption, any guests to add, the thumbnail moods, and the **custom image
   prompt**. A `Read` gets a **shorter message with four asks**: title, thumbnail caption,
   **facial expression** (optional, defaults to `Neutral`), and the **book cover** (put it on
   the episode's `Book Cover` field, or send it to the bot as a photo captioned
   `book cover BA-xxxx`). No guests, visual ideas or image prompt. The image prompt is
   optional and is **not** a view gate; a `Read` is gated on its **book cover** instead.
   Then set the episode to `Approved`.
5. Pick one of the 4 thumbnail options (set a Thumbnails row to `Selected`).
6. **Set the episode to `Ready to Publish`** once the artwork is picked and the `Release
   Date` is right. Nothing promotes `Artwork Ready` to `Ready to Publish` on its own — that
   one status flip is the "publish it" instruction, and it starts the Fountain upload. See
   stage 5 for the recipe.

If a booking is cancelled, optionally reply `suspend this episode` to the cancellation
notice to set the episode to `Suspended`.

Everything between those is automatic. Publishing is the exception worth remembering: the
upload itself is automatic, but it only starts when a person sets `Ready to Publish`, and
it does not mark the episode `Published` when Fountain goes live (see stage 5).

**Optional actions (not required to progress an episode):**
- **Revise the chosen artwork** — after artwork is picked (`Artwork Ready`), you can
  brief a targeted redo of the final thumbnail in place. See Artwork **Path 3**.
- **Collect a guest's details (Chat episodes)**: send them the episode's `Guest Form URL`.
  Their submission creates or links a `Guests` record automatically (stage 9). Optional,
  but it is how a guest lands on `Guests` without a manual link.
- **Attach a book cover (Read episodes)**: send the bot the book's front cover as a photo
  captioned `book cover BA-xxxx`, or reply to a message about the episode with the photo and
  `book cover` in its caption. It lands on the episode's `Book Cover` field and is used as
  Image 2 for all four Read thumbnail options. Re-sending replaces it.
- **Attach your own thumbnail artwork**: send the Telegram assistant a photo (reply to a
  message about the episode, or caption it with the `BA-xxxx`) and it stores it on the
  episode's chosen (`Final`, else `Selected`) `Thumbnails` row, choosing the `16x9` / `1x1`
  / `9x16` slot from the image's dimensions. One image or all three land on the same row.
  For several images, reply to the episode's message with them (Telegram puts a caption on
  only the first image of an album, so the reply is what identifies all of them) and send
  normal photos, not "documents". A brand-new episode with no thumbnail row should get the
  first image on its own so the row is created before the rest. It does not change the
  Episode `Status`. See the Telegram Airtable Assistant readme.

---

## Episode `Type` (single-select)

Type shapes both the metadata summary voice and the thumbnail layout, and it
determines whether a guest is required.

The full option set is `Chat`, `Take`, `2 Sats`, `Read`, `Clip`, `Audionauts`,
`Roundtable`.

| Type | Meaning | Guest required? | Summary voice | Thumbnail |
|---|---|---|---|---|
| `Take` | Solo episode, host breaks down a topic alone | **No** | First person (host) | Solo (host close-up) |
| `Chat` | Longform conversation, host + guest(s) | **Yes** | First person, names the guest | Duo (host + guests) |
| `Roundtable` | Monthly rundown with the regular group | **Yes** | First person, recap of the month | Roundtable (film-poster lineup) |
| `2 Sats` | Short two-person format | **Yes** | First person, names the guest | Duo (host + guests) |
| `Clip` | Short snippet cut from a longer episode | **Yes** (inherited from parent) | Third person, centred on the guest | Duo 16:9 only, no 1:1 / 9:16 |
| `Read` | Host reads from a book; now a video upload | n/a | First person, about the book and its argument | Four looks: study or nook, each with a camera and a book shot, using the episode's `Book Cover` image and an optional facial expression (default Neutral) |
| `Audionauts` | Audio-only | n/a | General first person | Manual artwork |
| blank / unknown | Unrecognised | n/a | General first person | Routed to manual artwork |

A `Clip` inherits its guest from its parent via the `Associated Episode` link.

**Which types get which artwork is data, set in the `Artwork Settings` table** (one row
per Type, `tblv9BEEC6BrmBSe8`, added 2026-10-06). Checkboxes `Generate 16x9` (build the
four 16:9 options at all), `Generate 1x1` and `Generate 9x16` (build that ratio after a
pick). Current matrix: `Take` all three; `Chat` 16x9 + 1x1; `Roundtable` 16x9 + 1x1;
`Clip` 16x9 only; `2 Sats` all three; `Read` 16x9 + 1x1; `Audionauts` none (manual). To change any of
it, edit the table, not the workflow and **not** the view. Everything else about picking a
thumbnail (rejecting the other options, setting the episode to `Artwork Ready`, marking the
pick `Final`, the Telegram confirmation) still happens for **every** type that has options,
whatever the settings say. If someone asks why an episode has no square/vertical version,
check its row in `Artwork Settings` first.

**`Read` is auto-generated since 2026-10-22.** Its four options are fixed looks: **study or
reading nook, each with one camera shot and one book shot** (two looking at the lens, two at
the book). The book's front cover comes from the episode's **`Book Cover`** attachment and is
passed to the image model as Image 2. If no cover is attached, the run uses four reading poses
with a plain book and the pick message warns about it. Reads use the `Thumbnail Moods` list as
their **facial expression** — `Dramatic/Intense`, for example — and an empty field means
`Neutral` (2026-10-28); they get a **1:1** on pick and never a 9:16. A Read with a
cover can also have the cover replaced later; the `Read Reversion 1x1` and
`Read Artwork Revision` prompts preserve it.

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
| `Record Date` | date/time | The confirmed recording slot. Written by the scheduling workflow (2b) when a booking is confirmed, read from the calendar invite; also settable by hand. |
| `Release Date` | date | The date the episode should go live. **This is the publish date**: the Fountain publisher schedules the item for this date at `Publishing Settings.Default Publish Time` (currently `06:00`, `America/New_York`), and the ready view requires it to be **today or later**. Set by hand; written by nothing automatically. |
| `Publications` | link -> Publications | One row per channel. `<BA-xxxx> - Fountain` carries the Fountain item id, upload ids, schedule time and any error. |
| `Thumbnail Caption` | long text | The artwork headline. Set by Jonny's reply to the packaging message (`TC1`–`TC5` or his own wording). A precondition for artwork. It is typeset manually over the artwork afterwards, into the reserved top-quarter band. |
| `Custom Image Prompt` | long text | **His free-text art direction for this episode's artwork.** Set by the same reply. **Optional. The view does not gate on it (corrected 2026-10-23).** `default` (or `none`) means "no extra direction". Fills a `{{CUSTOM}}` placeholder in the layout prompt template. `Read` is never asked for it and uses `Book Cover`. |
| `Thumbnail Moods` | long text | Comma-separated mood names he picked, e.g. `confident, shocked`. Matched by name (case-insensitively) against the `Thumbnail References` library and cycled across the 4 artwork options **in the order given** — one mood means all four use it, two means they alternate. **Empty or all-unmatched uses `Neutral` for all four** (since 2026-10-22), so a typo never breaks the run; the whole library is only used if the `Neutral` row has no photo. Not a gate. **On a `Read` this field is the facial expression** (2026-10-28); empty means `Neutral`. |
| `Guests` | link -> Guests | The linked guest(s). Required for `Chat` / `Roundtable` / `Clip`. |
| `Guest Name` | lookup | Guest name(s) pulled from the link (the raw link returns record IDs). |
| `Associated Episode` | link -> Episodes | A Clip points at its longform parent (guest inheritance). |
| `Thumbnails` | link -> Thumbnails | The generated artwork rows. Empty = no artwork made yet. |
| `Guest Form URL` | formula | Per-`Chat`-episode pre-filled guest form link, computed from the episode's own record ID (blank for other types). Send it to the guest; nothing runs to keep it current. |
| `Guest Intake` | link -> Guest Intake | The guest's form submission(s) for this episode, filled automatically when the guest completes the form. |

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

### 2b. AgentMail Received > Episode Scheduling
- **Fires:** an email arrives in the `pod21@agentmail.to` inbox (AgentMail `message.received`
  webhook). This replaces the Calendly webhook entirely.
- **Why email:** Calendly meeting polls are invisible to the Calendly API and send no
  webhook (confirmed 2026-09-29), so the poll-link email and the calendar emails are the
  only reliable signals.
- **Preconditions checklist (Episode):** the episode `ID` (`BA-xxxx`) appears somewhere in
  the email body. (`Title` is only cosmetic in the notice, never used for matching.)
- **Does, by email type:**
  - **Poll email** (from `pod21.xyz` / `jonnymarshall5@gmail.com`, no calendar attachment,
    mentions the `ID`) -> `Status = Scheduling`.
  - **Confirmation** (a Google Calendar `Invitation:` email with an `.ics` attachment) ->
    `Status = Recording Scheduled` and `Record Date` = the confirmed start time, taken from the
    `.ics` `DTSTART`.
  - **Cancellation** (a Google Calendar `Cancelled event:` email) -> `Status = Scheduling`.
  - Both routes back to `Scheduling` also clear `Record Date`, so the field only holds a time
    while the episode is actually `Recording Scheduled`.
  - It finds the episode by `ID` **only**, then checks the status separately, so the alert
    always names the real reason: no episode with that `ID` -> a **Not Found Alert** (kind,
    ID, subject); episode found but excluded by the status guard -> a **Guard Blocked Alert**
    naming the episode and its current status. Neither alert changes anything.
- **Status guards:** a poll email acts on a blank status, `Script Ready`, `Stories Picked`,
  `Research Ready` and `Suspended` (so a reschedule poll revives a cancelled episode, which
  is the normal way an episode comes back); a confirmation acts on those plus `Scheduling`
  and `Recording Scheduled` (and also `Suspended`, because a booked slot is proof the recording
  exists); a cancellation only acts on `Recording Scheduled`. An episode at `Scheduled to
  Publish` is deliberately not in either guard, so a stray calendar email cannot drag a
  published episode backwards. Anything else is left untouched
  and reported, so it can't drag a `Recorded`/`Published` episode backwards.
- **Next:** the human records + edits + uploads; on a cancellation, reply
  `suspend this episode` to the notice to set `Suspended`.

### 3. Frame.io Uploaded > Episode Marked, then Ready for Metadata View Entered > AI Metadata

Two workflows since 2026-10-29. The split exists because Frame.io re-delivers `file.ready` events
(on 2026-10-29 it replayed one for a file unchanged for nineteen hours and re-ran the whole
pipeline); a webhook cannot be made idempotent, but a `Status` can.

**3a. `BA - Frame.io Uploaded > Episode Marked` (`5ZMcCY8WPQ3bFji6`)** — webhook, seconds, no AI.
- **Fires:** a file becomes ready in the Frame.io project.
- **Does:** looks the file up, checks it, writes `Frame.io URL`, and sets `Status = Ready for Metadata`
  only when the episode is at `Recorded` or `Edited`.
- **Never queues:** images/PDFs, a filename with no usable `BA-` prefix, anything over 2 GB,
  a name ending `_Skip` (silent) or `_Bypass` (link refresh only), or any other status.
  In every one of those cases it says so in one Telegram line.
- Re-delivery of an old event is therefore harmless: the row has already left `Ready for Metadata`.

**3b. `BA - Ready for Metadata View Entered > AI Metadata` (`jroXHciDvy0sWlRM`)** — the AI work.
- **Fires:** an Episode enters the `Ready for Metadata` view (`viwNSD7pdOs2sKTgR`, one condition:
  `Status = Ready for Metadata`).
- **First action:** flip to `Generating Metadata`, so a crash cannot re-loop the trigger.
- **Preconditions:** all handled by 3a. A row can be queued by hand by setting `Status = Ready for Metadata`.
- **Does (full run):** transcribes the media (long video in 20-minute Gemini windows, stitched),
  generates 5 title options, 5 thumbnail-caption options, a timecoded description, a Type-aware
  `Summary`, and chapters. Writes `Status = AI Analysis Complete`, `Summary`, `Transcript`,
  `Chapters`, `Chapters JSON`, `Frame.io URL`, `Duration (s)`.
- **Same-length re-upload:** if the duration matches `Duration (s)`, nothing is regenerated; the row
  goes straight back to `AI Analysis Complete` and one message says so.
- **Audionauts:** transcript only, then `AI Analysis Complete`.
- **Then posts TWO Telegram messages:**
  1. the description file, with a short caption (episode title + `ID` only);
  2. a **"Packaging for ..."** message — **this is the one to reply to.** It shows the
     title and guests already on the episode, the 5 title options (`T1`–`T5`), the 5
     caption options (`TC1`–`TC5`), the **list of available moods read live from the
     `Thumbnail References` table**, and an optional **custom image prompt**.
     Each item names the Airtable field it lands in. A `Read` gets a shorter message
     with title, caption, an optional **facial expression** (the same live mood list,
     default `Neutral`) and the **book cover** ask.
  Every message ends with the workflow id and execution id, so a wrong message can be traced to a run.
  Replying to the *file* instead of the packaging message will not work properly.
- **If a run fails:** the row sits at `Generating Metadata` and the error workflow names it.
  Set `Status = Ready for Metadata` to retry.
- **Never queue a published episode.** Setting `Ready for Metadata` on an episode that is
  already `Approved` or beyond re-runs everything, rewrites `Summary`/`Transcript`/`Chapters`
  and knocks `Status` back to `AI Analysis Complete`, which invalidates the Fountain
  publisher's approved fingerprint. The lever is for pre-approval episodes only.
- **Next:** Jonny replies (see human handoff 3) and sets the episode to `Approved`.

### 4. Thumbnail Artwork
Three paths in one workflow.

**Path 1 — Generate.**
- **Fires:** an Episode enters the "ready for artwork" view, i.e. all the preconditions
  below become true. The view does **not** filter on `Status = Approved`, but it **does**
  exclude five statuses, so clearing an episode's `Thumbnails` is *not by itself* enough
  to bring it back in.
- **Preconditions checklist (Episode) — this is the answer to "what does this
  episode need before artwork is created?":**
  - [ ] `Summary` is not empty
  - [ ] `Thumbnail Caption` is not empty  *(set by the packaging reply)*
  - [ ] `Thumbnails` is empty (no artwork generated yet)
  - [ ] `Status` is **none of** `Awaiting Thumbnail Pick` / `Generating Artwork` /
        `Published` / `Suspended` / `Artwork Ready`
  - [ ] **Either** `Type` is one of `Take` / `2 Sats` / `Read` / `Clip`, **or**
        `Guests` is not empty
        *(this is how `Chat` and `Roundtable` qualify — they must have a guest linked.
        A guest-less `Chat` / `Roundtable` / `Clip` will NOT trigger and will silently
        wait out of the view until a guest is linked; there is no automated nudge, so
        check by hand)*
  - [ ] `Type` is not `Audionauts` (hard-excluded)
  - [ ] **If `Type` is `Read`, `Book Cover` is not empty.** The filter's last group is
        `Any of: Type is not Read / Book Cover is not empty`; other types pass on the
        first clause. **Do not write it as `All of: Type is Read AND Book Cover is not
        empty`**, which is ANDed with everything else and blocks every non-Read episode.
        **Confirmed live 2026-10-23: the view now uses the Any-of form.**
  - [ ] `Guests` does **NOT** include the host (Guy). Guy is always drawn from the
        reference library, so if he is also linked as a guest he gets rendered
        **twice** in the thumbnail. `Guests` is for non-host participants only.
        (A code guard also strips him, but keep him out of `Guests` anyway.)
  - [ ] `Transcript is not empty` is **not** a view condition, and neither is
        `Custom Image Prompt`; older versions of this checklist said both were.
- **A row already in the view may still not fire.** The trigger polls on
  `Last Modified Time` advancing past its stored cursor. A record that entered via a view
  filter change, or whose timestamp is older than the cursor, sits there with no error.
  Touch the record to advance the timestamp.
- **⚠️ How to RE-generate artwork for an episode that already has options.** Deleting
  the four `Thumbnails` rows satisfies `Thumbnails is empty`, but the episode is still
  `Awaiting Thumbnail Pick`, which the view excludes — so it stays out, nothing runs,
  and **there is no error anywhere to tell you why**. You must ALSO set `Status` back to
  `Approved` (or any status outside the two excluded ones). If someone asks you to
  regenerate artwork, propose both writes together, and say plainly that the status
  change is what actually re-arms the trigger. Also warn them it costs 4 fresh images.
- **Does:** sets `Generating Artwork`, generates 4 sixteen-by-nine options (layout
  by Type), creates 4 `Thumbnails` rows (`Proposed`), posts them as a Telegram
  album, then sets the episode to `Awaiting Thumbnail Pick`. If the type's
  `Generate 16x9` box in `Artwork Settings` is off (or the type has no row), it instead
  sets `Awaiting Manual Artwork` and asks for manual art.
- **Note the view and the table can disagree about `Type`.** The view admits `Take` /
  `2 Sats` / `Read` / `Clip` (plus any type with a guest linked), but `Plan Generate` only
  builds options when the type's `Generate 16x9` box is checked. So `Read` enters the view
  and is immediately routed to `Awaiting Manual Artwork`; `2 Sats` is checked (2026-10-06)
  and does auto-generate. Entering the view is not the same as being auto-artable.
- **What makes the 4 options differ:** the moods in `Thumbnail Moods`, cycled across the
  slots, whatever `Custom Image Prompt` says, and a **required** per-slot distinct shot
  direction (tight close-up, medium eye-level, wider environmental, or asymmetric
  off-centre). **Jonny picks the moods**; the old AI mood-picker and prescriptive framing
  variations are gone. Since 2026-10-07 these directions are stated as required and are
  **prepended** ahead of the template, not appended and labelled "secondary". Before that
  a detailed `Custom Image Prompt` overrode them, which flattened all four options into the
  same picture (`BA-C8Uwej`). They preserve subject count and do not control colour; they
  were first added 2026-09-09 after a one-mood run returned duplicate options. Since
  2026-10-30 they also restate the caption safe zone, so a shot direction can no longer
  fill the frame and eat the space the caption needs.
- **Every 16:9 option keeps a clean caption band at the top.** The prompts reserve the
  **top 25% of the height, full width** (top third on 9:16) as background only, with
  nothing of the people or props in it, and tell the model to check it before returning
  the image. It is achieved with the camera (headroom), never a bar, band or overlay, and
  it applies to reruns: the 1:1, 9:16 and revision prompts carry the same rule. If a
  thumbnail ever comes back with no clean area for the caption, the `Prompts` rows are
  the place to look, not the workflow.
- **Diagnosing "it ignored my moods":** the `Resolve Vibes` node emits a `moodSource`
  field on every run. `picked` means his chosen moods were used; `default-neutral`
  means the field was empty or nothing matched and `Neutral` was used for all four
  (since 2026-10-22); `fallback-all-moods` means the `Neutral` row itself had no
  reference photo. (`forced-neutral-read` was removed 2026-10-28, when Reads
  gained a selectable expression.) A mood typo, or a renamed
  library row, produces `default-neutral` — quietly, with a successful-looking run.
  Confirmed working 2026-08-11 (exec #1752, a `Chat`): two picked moods cycled ABAB
  across the four options.
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
- **Does, only for enabled ratios:** generates and posts back the chosen image's missing
  1:1 and/or 9:16, but only the ratios whose `Generate 1x1` / `Generate 9x16` boxes are
  checked in `Artwork Settings` for that type (2026-10-06; e.g. `Chat`/`Roundtable` now 1:1
  only, `Clip` neither, `Take` both). The Telegram confirmation states what is happening
  (or that none are generated for the type), so read it rather than assuming a failure.
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

### 5. Publishing (Fountain)
- **Was:** `Airtable - View to Published` (`7O9z3UwcUOkHjAC2`) polled the ready view
  `viwDfPHHKrgggdw20` and set `Status = Ready to Publish`. **Archived 2026-09-29.**
- **Now:** three workflows own this gate (all created/updated 2026-09-30, live 2026-10-01):
  - **Publisher** — `BA - Ready for Publishing View Entered > Fountain Scheduled`
    (`LTmRVKn9TWJd6Gtk`), **ACTIVE**. Watches the ready view, claims the episode, uploads
    the video and the square (1x1) artwork to Fountain, PATCHes the item, then schedules it.
  - **Reconciler** — `BA - Schedule Every 15m > Fountain Publication Reconciled`
    (`pvCPy320OjawDkSu`), **INACTIVE as of 2026-10-01**. Marks the Episode `Published` once
    Fountain actually publishes.
  - **Content sync** — `BA - Schedule Every 15m > Publication Content Synced`
    (`WMZ0Zpin1Stn9uF1`), **ACTIVE**. Pushes later Airtable edits (Title, description, 1x1
    artwork) onto the already scheduled/published item, leaving its state untouched.
  See the three readmes for the flow.
- **Preconditions checklist (Episode) — this IS the ready view filter, spelled out:**
  - [ ] `Title` is not empty
  - [ ] `Frame.io URL` is not empty
  - [ ] `Summary` is not empty
  - [ ] `Chapters` is not empty
  - [ ] `Thumbnails` is not empty
  - [ ] `Type` is **not** `Clip` and **not** `Audionauts` (added 2026-10-07)
  - [ ] `1x1 Thumbnail Count` is **greater than 0** (added 2026-10-07)
  - [ ] `Status` is `Ready to Publish`
  - [ ] `Release Date` is **on or after `today`** (relative filter, America/New_York)
- **The `Release Date` filter is relative**, so an episode whose date passes while it sits
  in the view drops out and is not picked up. That is deliberate: it keeps a past-dated
  episode from triggering the publisher, which would otherwise fail the preflight with
  "Fountain schedule time must be in the future".
- **The 1x1 guard is a helper rollup:** `1x1 Thumbnail Count` (`fldL2ttmgchk8y40J`) counts non-empty `1x1` attachments across the linked `Thumbnails` rows (`COUNTA(values)`); it is `0` when no linked row has a 1x1. The workflow reads only the **first** linked row, so on a rare multi-row episode the filter and the workflow can disagree. A second rollup named `zz BROKEN 1x1 rollup - delete in Airtable UI` (`fldFUV4KHwzOrb9WB`) is an early `COUNTALL` mistake that counted blank rows; ignore and delete it in the Airtable UI (Airtable's public API cannot delete fields).
- **Retry after a failure:** a failure sets the Episode to `Publishing Failed` and the
  Fountain `Publications` row to `Failed`, with a Telegram message carrying the reason and
  the execution id. To retry, fix the problem and set the episode back to `Ready to Publish`
  (the guard accepts a `Failed`/`Needs Attention` Publication, so nothing else needs
  resetting).
- **`Published` is set by the reconciler**, which is ACTIVE as of 2026-10-29. After a
  successful publisher run the Episode sits at `Scheduled to Publish`; every 15 minutes the
  reconciler asks Fountain whether the item is live and, if so, flips the episode to
  `Published` and fills `Published At` and `URL` on the `Publications` row. It also carries
  the per-channel fan-out result: `Published` when every channel is done, `Partially
  Published` when some are. If an episode is stuck at `Scheduled to Publish` past its slot,
  read the `Publications` row before answering.

#### If someone asks you to publish / upload / schedule an episode
Requests to publish are often mistaken for something the assistant cannot do, so follow
this exactly.

- **This bot never touches Fountain.** It has no Fountain access and must never claim or
  imply otherwise. Publishing is **one Airtable write on the Episode**, and the automation
  does the upload. **Never answer "I can't publish to Fountain" / "upload it yourself" —
  that is the wrong answer.** The right answer is the status flip plus what will happen
  next.
- **The recipe:**
  1. Read the episode. Confirm `Status` and `Release Date`.
  2. Walk the preconditions checklist above and **name anything missing** instead of
     proposing a write that will silently never fire.
  3. Propose ONE PATCH on the Episodes record setting `Status = Ready to Publish`, plus
     `Release Date` in the same write if it is empty or already past. Use a real future
     date and say which one you used.
  4. In the summary, say what happens next: the publisher picks it up **within about a
     minute**, sets `Publishing`, uploads the video from `Frame.io URL` and the **1x1**
     artwork, and **schedules** the Fountain item. The episode does not need to pass through
     `Approved` or any other status first; this flip is the whole trigger. A release dated
     **today** is scheduled **one hour from the moment the run happens**; a **future** date
     uses that date at the `Publishing Settings` `Default Publish Time` (**06:00**,
     `America/New_York`).
- **There is no draft-only mode, and nothing goes live immediately.** The publisher creates
  a Fountain draft, uploads into it, and schedules it in the same run; the "draft" state is
  internal and lasts seconds. So if someone says "upload it to Fountain as a draft", correct
  the premise plainly: it will be uploaded **and scheduled** for the release date, not left
  as a draft. If they want it held back, the lever is the `Release Date`, not a draft.
- **The publish time is not per episode.** A future `Release Date` uses the
  `Publishing Settings` row's `Default Publish Time` (**06:00**, `America/New_York`); a
  `Release Date` of **today** is scheduled **one hour from the run**. To change the time of
  day for future releases, edit the settings row, not the episode. (Changed 2026-10-29: a
  same-day release used to fail with "Fountain schedule time must be in the future", because
  06:00 had already passed.)
- **Ignoring a proposal ("adopt what's on Fountain", 2026-10-30).** If Jonny says the change was already made on Fountain, or that he does not want it, set the Fountain Publication row's `Sync Status` to `Adopt Requested` and clear `Sync Approved`. The next 15-minute tick records what Airtable would currently send as the new baseline (`Content Fingerprint`, `Frame.io File ID`), marks the row `Synced`, and replies once. Nothing is sent to Fountain. Future changes will still be offered normally. Never set `Adopt Requested` when he actually wants the change applied; that is `Sync Approved`.
- **Live items are never re-scheduled.** If the Publication is already `Published`, the sync ignores release-date differences, because re-scheduling something that is live makes no sense.
- **The approval gate (2026-10-30).** The content sync no longer changes Fountain on its own. Every 15 minutes it compares four things and, if any differ, it posts ONE Telegram message headed "Fountain needs updating" listing the changed items with ticks, writes `Sync Status = Awaiting Approval` and stores a hash of that exact proposal in `Approved Fingerprint`. Nothing is sent until the Publication row's `Sync Approved` is ticked. **If Jonny replies "approve sync"** for an episode, tick `Sync Approved` on that episode's Fountain Publication row; if several are pending, ask which one. The next tick recomputes the hash and only acts if it still matches what was proposed, so an approval cannot be applied to a cut that changed afterwards. After a successful run it clears `Sync Approved`, sets `Sync Status = Synced` and updates the baselines (`Content Fingerprint`, `Frame.io File ID`, `Scheduled For`). If the proposal is superseded, a new message arrives with a new hash.
- **What each change means.** `title and description` and `1x1 artwork` are content edits. `video file` means the episode's `Frame.io URL` now points at a different file than the one Fountain holds (`Publications.Frame.io File ID`), and applying it re-uploads the video (a 4.84 GB master takes about 80 minutes) and swaps `video_default_id`. `release date` means the Episode's `Release Date` day no longer matches the day the Fountain item is scheduled for; applying it re-schedules the item (today = now + 1 hour, otherwise the date at `Default Publish Time`).
- **Fountain and audio.** Attaching a new video only rebuilds the audio when the item's audio slot is empty. On an episode that already has audio, a video swap leaves the old audio track. Check the item's `audio_default` URL after a video sync: it should contain the new upload id.
- **Changing the date or the episode's details after it has been scheduled:**
  - Title, description and 1x1 artwork edits **do** reach the already-scheduled item
    automatically (the content sync, every 15m). Those are safe to promise.
  - **The schedule time now does**, since 2026-10-30. Editing `Release Date` on an
    already-scheduled episode produces a "Fountain needs updating" message; once `Sync Approved`
    is ticked the sync re-schedules the item. Before that tick nothing moves.
- **Nothing is uploaded until the flip.** An episode at `Artwork Ready` with a full
  `Release Date` will sit there indefinitely; no timer, no nudge.
- **Success:** Episode `Scheduled to Publish`, Publication `Scheduled`, Telegram confirmation.
- **Failure:** Episode `Publishing Failed`, Publication `Failed`, Telegram with the reason
  and execution id. Read the `Publications` row's `Error`, fix it, then set the episode back
  to `Ready to Publish`.
- **Still being built out:** the per-channel fan-out beyond Fountain (Phase 3 in the Build
  Status). The content sync is already platform-neutral — it routes each `Publications` row
  by `Platform` — so new channels plug in as adapters.

### 6. n8n GitHub Backups
- **Fires:** daily at **3am**. Infra only. Backs up every workflow's JSON to a
  private GitHub repo. No episode involvement.

### 7. Workflow Failed > Telegram Alert
- **Fires:** whenever any workflow that names it as its error handler fails.
- **Does:** posts the failure (workflow, node, error, execution link) to the group
  and logs it to an Ops Log table. No episode involvement.

### 8. Public API (client access, not a pipeline stage)
- **What it is:** a token-authenticated, **read-only** webhook (`POST /webhook/api`) that lets an external client read the Episodes table only. It never writes and cannot reach another table. It is not part of the production pipeline; it exists so a third party can read episode data without ever seeing our credentials.
- **Fires:** an HTTP POST from the client with their bearer token in the `Authorization` header.
- **Does:** checks the token against the `api_tokens` n8n Data Table (`revoked = false`), then serves either `list_episodes` (a page of up to 100, with optional `filterByFormula` / `fields`) or `get_episode` (by `BA-xxxx` or `rec...` id), returning JSON.
- **Errors:** 401 for a missing/wrong/revoked token; 400 for an unknown action or an invalid query (a plain `{ error, detail }`, never a crash).
- **Guardrail:** if someone asks how a client gets episode data, this is the answer. The client never sees the Airtable PAT. Tokens are minted/revoked with `scripts/deploy/tokens/issue.sh` / `revoke.sh`. Client-facing doc: `setup/Public API - client guide.md`.

### 9. Guest Intake (Airtable form, not n8n)
- **What it is:** the way a guest lands on an episode without a manual link. A `Chat`
  guest fills an Airtable form, and the submission creates or links their `Guests`
  record. Entirely Airtable-native: a form, a formula field, and one base automation.
  No n8n workflow is involved.
- **The form:** one form on the `Guest Intake` table (`New Guest Intake`). It collects the
  guest's contact details, bio, headshot, links, socials, and interview prep (talking
  points, unpopular opinion, most / least bullish, questions to avoid, asset release).
- **Per-episode link:** `Episodes.Guest Form URL` is a **formula** field. For
  `Type = Chat` it returns
  `https://airtable.com/app8Xw9Tq0XLjhmp9/pag6KbMDWAgI60KeR/form?prefill_Episode=<recordId>&hide_Episode=true`
  and is blank for every other type. Because it is computed from the episode's own record
  ID, every Chat episode has its own link the moment it exists, with nothing to run and
  nothing to keep in sync. **This is what to send a guest.** The episode is attached
  invisibly, so their answers land on the right episode.
- **On submission:** the base automation `Guest Intake > create or link Guest` fires on
  the new `Guest Intake` row. It matches an existing `Guests` row by email, falling back
  to an exact name match, and otherwise creates a new guest. It copies the submitted
  details onto the guest, links the guest to the episode on both sides (merging, so a
  returning guest keeps their past episodes and a multi-guest Chat keeps every guest), and
  writes `Matched Guest` + `Status` back on the intake row.
- **Why it matters to the pipeline:** a `Chat` episode needs a guest on `Guests` before
  artwork will run (see the artwork precondition in stage 4). This flow is how that link
  gets made automatically. Without it, a guest-less `Chat` waits out of the artwork view
  forever, with no error. It does **not** advance `Status`; it is a side input, so it can
  be used at any point before artwork.
- **Caveats:**
  - Every submission is a new `Guest Intake` row (there is no de-duplication there), so a
    repeat submission stacks a second row for the same episode and person. The guest
    record itself is reused, not duplicated, and its details are refreshed with the newer
    answers.
  - Matching is email first, then exact name. A guest who changes both their email and
    their name creates a duplicate guest. Two different people who share the same full
    name are treated as one.
  - An anonymous submission with no name and no email can never match, so it always
    creates a new guest.
- **Readme:** `n8n_workflow_readmes/Guest Intake Form.md`.

---

## Known problems and recent fixes (as of 2026-08-20)

When someone reports something broken, check here first — it may already be known.
The bug log is the **Automation Upgrades** table (base `appwcz1Bux9YLcZYm`, table
`tblja27Lsn7qXJfZM`); read it to answer "what's currently broken?" and add to it when
something new is reported.

- **Calendly meeting polls are invisible to the API (confirmed 2026-09-29).** Poll creation
  and booking produce no Calendly webhook, no `scheduled_event`, and the poll isn't in
  `GET /event_types`. Scheduling is email-driven instead (workflow 2b above). If someone
  asks why Calendly shows nothing for a poll, this is why — not a bug.
- **Rescheduling after the Fountain item is scheduled is manual (open, 2026-10-29).** The
  publisher's guard blocks a Publication in `Scheduled`, and the content sync pushes title,
  description and artwork but never the schedule time. Editing `Release Date` on an
  already-scheduled episode therefore changes nothing on Fountain. Fixing it means
  rescheduling in Fountain or resetting the `Publications` row by hand. Do not promise a
  date change will "flow through".
- **Per-type variation control is the `Artwork Settings` table (2026-10-06, UNTESTED end-to-end).**
  Which ratios an episode gets is the `Generate 1x1` / `Generate 9x16` boxes for its `Type`;
  if an episode is missing a square or vertical version you expected, check its row there
  first (and that the row's `Episode Type` is populated). A type with no row gets none. The
  select view was briefly given a type filter the same day and was reverted to `Status =
  Selected` only. **Not yet run end-to-end on a real pick after the change.**
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
- **Status can also be what BLOCKS a stage.** The artwork view excludes five statuses
  outright (`Awaiting Thumbnail Pick`, `Generating Artwork`, `Published`, `Suspended`,
  `Artwork Ready`), so an episode can satisfy every field condition and still never fire.
  When a stage refuses to run, check the excluded statuses as well as the required fields.
- **Episode `Type` can also decide whether a step runs at all**, separately from status
  and from any view. The clearest case is the 1:1 / 9:16 artwork, which is skipped for
  `Clip`, `Read` and `Audionauts`. Before calling a missing output a failure, check
  whether that type was ever meant to produce it.
- **Publishing is a status flip, not an action anyone performs.** If a person asks to
  publish, upload, schedule or "get it on Fountain", the answer is always `Status = Ready
  to Publish` (with `Release Date` today or later), never "I don't have Fountain access"
  and never a manual upload. See stage 5's recipe.
- **A successful run is not proof the right thing happened.** Several steps degrade
  quietly rather than failing: unmatched moods use Neutral rather than the library, a
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
- Scheduling is email-driven. A poll-link email the workflow recognizes moves an episode to
  `Scheduling`, including one that is currently `Suspended`; a Google Calendar confirmation
  moves it to `Recording Scheduled` and sets `Record Date`; a cancellation reverts it to `Scheduling`.
  Reply `suspend this episode` to a cancellation notice to set `Suspended`. When an email
  can't be acted on, the group gets an alert that says whether the `ID` matched nothing or
  the status guard blocked it (and which status it found).
