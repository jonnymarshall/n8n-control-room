# Guy's Take — Annotated Build Plan

> This is an annotated copy of `Guys Take Workflow.md`. The original is left untouched as Jonny's
> raw plan. This version adds: the Airtable status state machine, a trigger annotation per stage,
> the data model, the confirmation mechanism, and the Frame.io integration.
>
> Build status for each workflow lives in `Guys Take Build Status.md` (same folder). Tick workflows
> off there, not here.

---

## Legend

| Symbol | Meaning |
|---|---|
| 🤖 | Automated by an n8n workflow |
| ☝️ | Human decision / approval required |
| [J] | Manual step done by Jonny |
| [C] | Manual step done by C (VA / producer) |
| 🎙️ ▶️ 📝 📁 | Physical / human production step (record, edit, write refs, upload) |
| **Trigger:** | How the workflow that owns this stage starts |

---

## Constants

Publishing Channels = { Pod feed, X, YouTube, Rumble, Keet, Instagram, Nostr }

Social Interaction Channels = { X, YouTube, Rumble, Instagram, Nostr }

Artwork formats = { 16×9, 1×1 (reversioning), 9×16 (reversioning) }

---

## Architecture: Airtable as the state machine

Airtable is the single source of truth. Each workflow is triggered by one thing, does one job, and
advances a **status field**. There are two status fields, at two levels:

### `Episodes.Status` (per episode = per Take)

The episode lifecycle, already created in Phase 0. One picked topic becomes one Episode (see Data
Model below). Values, in order:

```
Scheduled → Research Ready → Stories Picked → Script Ready → Recorded
  → Transcript Ready → Edited → AI Analysis Complete → Approved → Artwork Ready → Published
```

> Note on ordering: the live Phase 0 enum lists `Edited` before `Transcript Ready` is produced. With
> Frame.io (below), `Edited` is detected first (editor uploads the cut), then transcription runs and
> sets `Transcript Ready`. So the practical order is `Recorded → Edited → Transcript Ready →
> AI Analysis Complete`. Confirm the enum order matches this when wiring the Frame.io workflow.

### `Shortlist.Status` (per candidate topic, weekly)

```
Shortlisted → Picked | Rejected
```

`Picked` is the handoff from research to scripting.

---

## Data model

- **Stories** table: one row per scraped YouTube video. (Built.)
- **Shortlist** table: one row per clustered news event for the week. `Picked` rows are what get
  scripted. (Built.)
- **Episodes** table: one row per Take episode. **One Picked Shortlist topic → one Episode**
  (decision 2026-06-07). Each recording session produces 2 episodes (the 2 picked topics).
  - The Script-generation workflow creates the Episode from the Picked topic and back-links it to
    the Shortlist row.
  - The recording **session** is one calendar slot shared by both episodes; `Record Date` is copied
    onto both Episode rows by the Scheduling workflow (or by hand for now).

**Required new fields on `Episodes`** (add when building Script-generation):
`Script` (long text), `References` (long text), `Summary` (long text), `Source Shortlist`
(link → Shortlist), `Frame.io Asset ID` (single line, added when building the Frame.io workflow).

---

## Confirmation mechanism

Picking is done via **Telegram inline buttons** (decision 2026-06-07), reusing the one-tap approval
pattern from the Telegram Airtable agent (`peTIs4kiluFZHoLg`). The Friday digest renders a "Pick"
button per shortlisted topic; tapping it sets that Shortlist row's `Status = Picked`. Setting Status
in Airtable by hand remains a valid fallback. Either way, `Status = Picked` is the trigger
downstream workflows watch.

---

## Workflow

### Scheduling (Thursday)
**Trigger:** weekly Schedule (Thu) + Telegram button callback for slot confirmation.
- 🤖 Create episode in Airtable
  -- `Episodes.Status: Scheduled` (placeholder, pre-research) *(or created later by Script-gen — see Data Model; ordering to confirm)*
- 🤖 Suggest recording options on Telegram to group (Monday or Tuesday, 9 / 10 / 11 AM ET)
- ☝️ Confirm record slot (Telegram inline button — Guy)
- 🤖 Create calendar event for recording, invite Jonny and Guy
  -- `Episodes.Record Date: <RecordDateTime>`

### Research & Scripting (Friday)
**Trigger:** weekly Schedule (Fri 7am ET). **✅ BUILT** — `BA - Guy's Take Weekly Research & Shortlisting`.
- 🤖 Research trending stories → create shortlist
  - YouTube (Phase 1) ✅
  - X (Phase 2)
  - Reddit (Phase 3)
- 🤖 Suggest 8× shortlisted topics on Telegram, each with a Pick button
  -- `Shortlist` rows written, `Status: Shortlisted`
- ☝️ Confirm 2× topics to script (Telegram button — Guy → `Shortlist.Status: Picked`)

### Scripting
**Trigger:** Airtable — `Shortlist.Status = Picked`. **← BUILDING NOW.**
- 🤖 For each Picked topic: create an Episode, generate script + create script page
  -- `Episodes.Script: <Script>`, `Episodes.Status: Script Ready`
- 🤖 Send script link to Telegram

### Recording
**Trigger:** time offset — `Record Date + 2h`.
- 🎙️ Record 2× Take episodes
- 🤖 Telegram message 2h after `Record Date` asking to confirm recording complete
  -- `Episodes.Status: Recorded`

### Post-record  →  Edited detection (Frame.io)
**Trigger:** Frame.io webhook (asset / version uploaded into the episode's project).
- The editor uploads the finished cut to Frame.io.
- 🤖 Match the uploaded asset to the Episode (by project / naming), store `Frame.io Asset ID`
  -- `Episodes.Status: Edited`
- Retire-when-ready: the Riverside transcript / 60% audio-enhance export / download steps ([J]/[C])
  are interim manual steps; Frame.io transcription (below) replaces the transcript piece.

> See "Frame.io integration" section below for auth, events, and the transcription path.

### Transcription (Frame.io)
**Trigger:** Frame.io transcription-ready (webhook if available; else poll after `Edited`).
- 🤖 Pull the transcript (VTT/SRT/TXT) for the edited asset, store it on the Episode
  -- `Episodes.Status: Transcript Ready`

### Editing (human)
**No workflow** — fully manual.
- ▶️ Create edited episode [J] (upload triggers the Frame.io "Edited" workflow above)
- 📝 Create `references.md` [J]
- 📁 Put both on Frame.io [J]

### AI Titles, Thumbnail Captions, Description & Chapter Markers
**Trigger:** Airtable — `Episodes.Status = Transcript Ready`. Uses the Frame.io transcript.
- 🤖 Generate title options
- 🤖 Generate thumbnail caption options
- 🤖 Generate description
- 🤖 Generate SEO-friendly chapter markers (timestamps from the transcript)
- 🤖 Suggest all on Telegram
  -- `Episodes.Status: AI Analysis Complete`
- ☝️ Approve specific title [J] / thumbnail caption [J] (Telegram buttons)
  -- `Episodes.Status: Approved`

### Artwork
**Trigger:** Airtable — `Episodes.Status = Approved`.
- 🤖 Generate 5× 16×9 YouTube thumbnail options, send on Telegram
- ☝️ Confirm YouTube thumbnail
- 🤖 Generate 1×1 and 9×16 versions of confirmed thumbnail
- ☝️ Confirm 1×1 and 9×16 versions
  -- `Episodes.Status: Artwork Ready`

### Publishing & Social (full episode)
**Trigger:** Airtable — `Episodes.Status = Artwork Ready`.
- 🤖 Fan-out to { Publishing Channels }
  -- `Episodes.Status: Published`

### Social Interaction (~24h sweep)
**Trigger:** Schedule — publish + 24h.
- { Social Interaction Channels } − Nostr [C]
- Nostr [J]

### Social Interaction (~48h sweep)
**Trigger:** Schedule — publish + 48h.
- { Social Interaction Channels } − Nostr [C]
- Nostr [J]

---

## Frame.io integration

Used for two things: (1) **detecting an episode is edited** (editor uploads the cut), and
(2) **transcribing the final episode** to feed the AI titles / captions / description / chapters
stage.

**Docs:** https://developer.adobe.com/frameio/guides/ and the transcription overview
https://help.frame.io/en/articles/10966531-frame-io-transcription-overview

**What's confirmed:**
- Frame.io is now V4 (Adobe-owned). API auth is **Adobe IMS server-to-server OAuth**
  (client-credentials grant → bearer token), set up via an Adobe Developer Console project.
- Transcription supports 27 languages, exports as **SRT / VTT / TXT**.

**What needs verifying before building (do not guess in the workflow):**
1. **Webhook events** — confirm the exact V4 event names for "asset/file uploaded/ready" and, if it
   exists, "transcription completed". If no transcription webhook, poll the asset after `Edited`.
2. **Programmatic transcript retrieval** — the help article documents UI export only. Confirm whether
   the V4 API exposes the transcript (endpoint + format). If not, the transcript is a manual export
   [J] in the interim and we feed the file in.
3. **Asset → Episode matching** — decide the convention (dedicated Frame.io project per episode, or a
   naming scheme) so the webhook can resolve which Episode to advance.

**n8n shape (once verified):**
- Need a Frame.io credential in n8n (custom OAuth2 / header-auth bearer from Adobe IMS).
- Edited-detection: Frame.io webhook → match asset → set `Episodes.Status = Edited`, store
  `Frame.io Asset ID`.
- Transcription: webhook or poll → fetch transcript → store on Episode → set `Transcript Ready`.

---

## Open questions to resolve as we build

- Scheduling vs Episode creation ordering: does the Thursday Scheduling workflow create the Episode
  (then research links to it), or does Script-gen create Episodes from Picked topics (current build)?
  Reconcile when building Scheduling.
- Frame.io webhook + transcript-API specifics (above).
- Research source expansion: X (Phase 2), Reddit (Phase 3).
- References format supplied during editing (URL / screenshot / text / timestamp).
