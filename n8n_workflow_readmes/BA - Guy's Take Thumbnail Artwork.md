# BA: Guy's Take Thumbnail Artwork

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (Current ID: `mLAn4ya2AmZoHDUk`. The previous hand-built copy `YyXiJ0lusoW7ynu9` is **archived**.)

> **SDK source of truth (2026-07-26).** This workflow is now **code-first**: the authoritative definition lives at `scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js`. It was rebuilt from the live JSON (params copied verbatim), a **third trigger for briefed artwork revisions (Path 3)** was added, and it was pushed as a new workflow + cut over (old archived). See `CONVENTIONS.md` → "SDK code in the repo is the source of truth". Behaviour tweaks can still be hand-edited on the canvas, then reconciled back into the `.sdk.js`; a full SDK push re-skips credentials on every HTTP node (rebind by hand).

This is **stage #8 "Artwork"** in the Guy's Take build. **Phase A** generates + selects the 16:9. **Phase B** (built 2026-06-21) runs on selection: it unlinks the rejected options from the episode and re-runs Nano Banana on the chosen 16:9 to write a **1:1** and a **9:16** adaptation back onto the same Thumbnail row.

> **⚠️ PARTLY TESTED.** Two changes landed 2026-07-06: (1) **Roundtable episodes now auto-generate** (host + all linked guests across the frame) instead of being sent to manual artwork; (2) **the image-generation prompts now live in Airtable** (a `Thumbnail Prompts` table) instead of being hardcoded in the `Build Image Requests` Code node. Both were applied by hand-editing the live workflow (two Code nodes + one new `Fetch Prompts` node), not a rebuild. **2026-07-25 (UNTESTED):** `Plan Generate` now strips the host from `guestIds` so Guy can't be rendered twice when he's mistakenly linked in an episode's `Guests` — see the host-rendered-twice gotcha. **2026-07-26 (UNTESTED):** `Resolve Selected` now skips orphan `Selected` rows (a row set to `Selected` with no `Episode` link) and processes the first row that *does* have an episode, instead of reading only `$input.first()` and bailing. This fixes the exec #1186 stall where an orphan sorting ahead of a real pick in the same poll silently dropped the pick. **UNTESTED (reconciled into `.sdk.js` 2026-07-26, not yet run end-to-end).**
>
> **2026-07-08 — the Airtable-prompt (solo/Take) path is now tested end-to-end** after fixing two bugs it shipped with: (a) `Plan Generate` had a **truncated line** (`caption: f['Thumbnail Caption'] || f['Tit` — the `f['Title']` reference was chopped mid-string), throwing `SyntaxError: Invalid or unexpected token`; (b) `Build Image Requests` read the template from a field called **`Template`**, but the Airtable `Thumbnail Prompts` field is actually named **`Prompt`** — so every template loaded as `''` and `tpl()` threw the misleading `Missing prompt row "Solo Thumbnail"`. Both fixed in the live workflow. **Roundtable is still unverified** — run a real Roundtable episode before relying on it.

---

## TL;DR

Uses a **normalized data model**: a `Thumbnails` table where each generated option is its own row (linked to the Episode), and a static `Thumbnail References` library of Guy headshots tagged by mood. Two Airtable-triggered paths in one workflow.

**Path 1 - Generate** (fires when an episode enters the Episodes `Approved` view) is **content-type aware** (Episodes `Type` field):

0. **`Auto-artable Type?`** routes by `Type`. `Take` / `Chat` / `Clip` / `Roundtable` → generate. Anything else (blank-but-unknown) → **Mark Manual Artwork** (`Status = Awaiting Manual Artwork`, leaving the Approved view so it can't re-loop) + a Telegram "art this one manually" note, then stop.
1. Clears any old `Thumbnails` rows for that episode (so re-runs start fresh)
2. Reads the whole `Thumbnail References` library (mood + reference photo per row), the **`Thumbnail Prompts` table** (the layout prompt templates), and the `Guests` table
3. Asks **Gemini text** (`gemini-2.5-flash`) to choose the **1 to 4 moods/vibes** that fit the episode and assign one to each of the **4 thumbnail slots** (repeats allowed)
4. **Plan Downloads** builds one download task per image: 4 host reference photos (the picked vibe per slot), plus — for `Chat`/`Clip`/`Roundtable` — every linked guest's `Headshot`. One download fan-out covers both.
5. For each slot, calls **Nano Banana** (`gemini-3-pro-image`) to generate one 16:9. **Build Image Requests** picks the prompt template by layout — **solo** (Take, host close-up), **duo** (Chat/Clip, host + guest), or **roundtable** (Roundtable, host + all guests lined up like a film poster) — **fetched from the `Thumbnail Prompts` Airtable table** (matched by row `Name`: `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail`), then fills the `{{HOOK}}` / `{{CONTEXT}}` / `{{VIBE}}` / `{{VARIATION}}` tokens. The per-option framing `variations[]` still live in the Code node (solo/duo only; the roundtable template has no `{{VARIATION}}` slot by design).
6. Creates 4 `Thumbnails` rows (`Status = Proposed`, linked to the Episode, with the mood, option number, caption) and uploads each image into the row's `16x9` attachment
7. Posts the 4 as a **Telegram album** to the group, captioned by mood, plus a short "set a row to Selected" instruction
8. Sets the Episode `Status = Awaiting Thumbnail Pick`

**Path 2 - Select** (fires when a `Thumbnails` row enters the `Selected` view):

8. Sets the episode's other thumbnail rows to `Status = Rejected`
9. **Unlinks the rejected rows from the Episode** — sets the Episode `Thumbnails` link to **only** the selected row (so the other options drop out of the episode's Thumbnails column), sets Episode `Status = Artwork Ready`, **moves the chosen row to `Status = Final`** (so it leaves the `Selected` view and keeps the poll trigger clean), and sends a Telegram confirmation
10. **Reversioning branch (Phase B), runs in parallel off the same trigger:** an IF gate (`Needs Reversion?`) checks which of the row's `1x1` / `9x16` attachments are **missing** and only proceeds if at least one is. It downloads the selected row's `16x9` and re-runs **Nano Banana** for **only the missing aspect ratios** (so a re-select that already has both does nothing; one missing regenerates just that one), using prompt templates pulled from the **`Thumbnail Prompts` Airtable table** (rows `Reversion 1x1` / `Reversion 9x16`). Results upload into the row's `1x1` / `9x16` fields, then **Telegram sends back only the newly-generated artwork** (one `sendPhoto` message per new image, no duplicates). Reworked 2026-07-08.

**Path 3 - Revision (added 2026-07-26)** (fires when a `Thumbnails` row enters the `Revision Requested` view, i.e. `Status = Revising`): a **briefed, in-place, targeted** redo of an already-chosen thumbnail. You write a free-text `Revision Brief` + tick which `Revision Targets` (`16x9`/`1x1`/`9x16`) on the row and set `Status = Revising`. The chain re-runs Nano Banana on **only the ticked ratios**, **self-editing each ratio's current image** (falling back to the `16x9` if that ratio has none) with the brief as steering text, **overwrites** them on the row, Telegrams the new artwork back, and resets the row to `Final` (clearing the brief/targets). **No forced cascade** — it redoes only what you name; if you revise the `16x9` alone it adds an informational note that the 1:1/9:16 now derive from the old 16:9. Driven either by editing the row directly or by asking the **Telegram Assistant** ("redo the 9x16 for BA-xxxx, more red"), which proposes the row write for one-tap approval.

Selection is by setting a **`Thumbnails` row's `Status` to `Selected`**, not Telegram buttons: the `Pod21: Telegram Airtable Assistant` already owns the bot's only webhook, and Telegram allows one webhook per bot, so a second Telegram **Trigger** can't be added without breaking the Assistant. Sending messages from the same bot is fine; only triggers conflict. (The same reason revisions are triggered via `Status = Revising` on the row, not a button.)

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `mLAn4ya2AmZoHDUk` (SDK-sourced; old `YyXiJ0lusoW7ynu9` archived) |
| **SDK source** | `scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js` (authoritative; 60 nodes) |
| **Trigger 1** | Airtable poll on `Episodes` (`tbl3uYLIvtB9APZp6`), every minute, view `Ready for 16X9 Thumbnail` (`viwqgtrry8n6yNgqW`) — Path 1 Generate |
| **Trigger 2** | Airtable poll on **`Thumbnails`** (`tblkcASzE4DXlxokO`), every minute, view `Selected` (`viw7AHjnX9ZkvIrKo`) — Path 2 Select + Phase B |
| **Trigger 3 (revisions)** | Airtable poll on **`Thumbnails`** (`tblkcASzE4DXlxokO`), every minute, view **`Revision Requested`** (`viwGVYiheuTD2pPlx`, filters `Status = Revising`) — Path 3 Revision |
| **Revision inputs** | on the `Thumbnails` row: `Revision Brief` (long text) + `Revision Targets` (multi-select `16x9`/`1x1`/`9x16`) + set `Status = Revising`. Prompt row `Artwork Revision` in `Prompts` (tokens `{{REVISION}}` = brief, `{{HOOK}}` = caption). |
| **Content types** | `Take` → solo host. `Chat` / `Clip` → host + all linked guests (duo). `Roundtable` → host + all linked guests, film-poster lineup (roundtable). Any other/unknown → skipped to manual artwork. Read from the Episodes `Type` single-select. |
| **Prompt source** | ALL image-gen prompt templates live in the **`Prompts` Airtable table** (`tblhG1nw2P1k3CBVU`, renamed 2026-07-15 from `Thumbnail Prompts`; ID unchanged), `Type = Artwork`, **`Name` + `Prompt` fields** (template text is in the field literally named `Prompt`). **Phase A** rows: `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail` (`Fetch Prompts` node → `Build Image Requests`, fills `{{HOOK}}`/`{{CONTEXT}}`/`{{VIBE}}`/`{{VARIATION}}`). **Phase B** rows (added 2026-07-08): `Reversion 1x1` / `Reversion 9x16` (`Fetch Reversion Prompts` node → `Build Reversion Requests`, fills `{{HOOK}}` = caption only). Edit any prompt in Airtable, not n8n. |
| **Mood picker** | `gemini-2.5-flash` (text), `responseMimeType: application/json`, returns a 4-slot mood assignment (repeats allowed) |
| **Image model** | `gemini-3-pro-image` (Nano Banana), `v1beta`, `responseModalities: ["TEXT","IMAGE"]`, `imageConfig.aspectRatio` + `imageSize` (**`1K` everywhere** for reliability — 2K caused `IMAGE_OTHER`), one call per slot (Phase A) + 2 calls on select (Phase B 1:1 + 9:16) |
| **Options generated** | always 4 (moods assigned across the 4 slots by the LLM; each slot gets a different colour variation) |
| **Output** | 4 `Thumbnails` rows (`Proposed`) with `16x9` attached; on pick, one → `Selected`, rest → `Rejected` **and unlinked from the episode**; selected row gets `1x1` + `9x16` attached; Episode → `Artwork Ready` |
| **Telegram** | album + messages to Jonny's DM (chat ID `1512868522`, hardcoded) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |
| **Cost** | Nano Banana is **NOT free**: ~$0.039/image, ~$0.16 per 4-option run. The mood-pick text call is cheap/near-free. Needs a billing-enabled Google key. |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Both triggers + every Airtable HTTP node (incl. `Fetch Prompts`, `Fetch Guests`, `Mark Manual Artwork`; attach to HTTP nodes manually) | exists |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | The 4 Telegram send nodes (incl. `Notify Manual`; auto-assigned) | exists |
| `Gemini API Key [n8n]` | `httpHeaderAuth` | `Pick Moods (Gemini)` + `Generate Thumbnail (Nano Banana)` + `Generate Reversions (Nano Banana)` | **must be created** |

The Gemini credential is a generic **Header Auth** credential (when creating it in n8n, search "Header Auth" - NOT "Google Gemini (PaLM) Api"): header **Name** = `x-goog-api-key`, **Value** = your key from https://aistudio.google.com/apikey on a **billing-enabled** Google Cloud project (image gen is paid; the text call is free-tier). It powers both the mood-pick text call and the image calls.

> **AgentMail gotcha:** because `Gemini API Key [n8n]` did not exist when the workflow was built, n8n auto-filled the Header Auth slot on the two Gemini nodes with the only existing Header Auth credential (**AgentMail**). That is wrong and must be replaced - open `Pick Moods (Gemini)` and `Generate Thumbnail (Nano Banana)` and set the credential to `Gemini API Key [n8n]`.

All HTTP Request nodes are **skipped by credential auto-assignment** at build time (the rebuild references credentials by name in the SDK, but verify after any push). Open each and confirm: the Airtable ones (`Mark Generating`, `Mark Manual Artwork`, `Delete Old Thumbnails`, `Fetch Mood References`, `Fetch Prompts`, `Fetch Guests`, `Create Thumbnail Row`, `Upload 16x9`, `Mark Awaiting Pick`, `Get Episode Thumbnails`, `Reject Siblings`, `Mark Episode Artwork Ready`, `Upload Reversion`) use **`Airtable [n8n] (PAT)`**; the image-download nodes (`Download Image`, `Download Selected 16x9`) use **no auth** (signed URLs); the three Gemini ones (`Pick Moods`, `Generate Thumbnail`, `Generate Reversions`) use **Header Auth** with the credential above.

> **Credential-type gotcha (hit 2026-07-06 wiring `Fetch Prompts`):** on a freshly added Airtable HTTP node, `Airtable [n8n] (PAT)` may not appear in the credential dropdown even under "Airtable Personal Access Token API." Two causes: (1) the credential is actually stored under n8n's plain **"Airtable API"** (`airtableApi`) type — that type accepts a PAT in its field, so select **Airtable API** to match; or (2) **project scope** — the credential lives in a different n8n project than this workflow, so share it to this project. Check the credential's real Type in the Credentials list and match it on the node; don't paste the key into a duplicate credential unless neither fix works.

Telegram chat ID is **hardcoded** to `1512868522`. `$env` is blocked on this instance, so do not switch to `{{ $env.X }}`.

---

## Required Airtable schema

### `Thumbnail References` table (static library, populate by hand)

| Field | Type | Notes |
|---|---|---|
| `Mood` | Single line text (primary) | confident, shocked, sarcastic, exhausted, deadpan, etc. |
| `Reference Photo` | Attachment | Guy in that expression |

Works with as few as **1 mood row** (all 4 options use it, differentiated by composition). Add more rows over time to make the picker more selective. At least one row with a `Reference Photo` must exist before first run.

### `Thumbnails` table (one row per generated option)

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line (primary) | workflow writes "Episode title / mood" |
| `Episode` | Link → Episodes | single link; gives Episodes a reverse `Thumbnails` field |
| `Mood` | Link → Thumbnail References | **single link** (turn off multiple); set by mood name via typecast |
| `Caption` | Long text | snapshot of the headline used |
| `Option` | Number | 1 to 4 |
| `Status` | Single select | `Proposed`, `Selected`, `Rejected`, **`Final`** (chosen row after Path 2), **`Revising`** (added 2026-07-26 — drives Path 3; the row is set back to `Final` when the revision run finishes) |
| `16x9` | Attachment | filled in Phase A |
| `1x1` / `9x16` | Attachment | **filled on select (Phase B)** — these two attachment fields must exist or the `Upload Reversion` calls 404 |
| `Revision Brief` | Long text | **Path 3** — the free-text steering instruction for a briefed redo; cleared to `""` when the run finishes |
| `Revision Targets` | Multiple select | **Path 3** — options `16x9`, `1x1`, `9x16` (exact strings, matching the attachment field names); the ticked ones get redone; cleared to `[]` when done |
| `Last Modified Time` | Last Modified Time | **required** — the select/revision triggers sort on it. Must watch **all** fields. |

Views: **`Proposed`** (Status = Proposed), **`Selected`** (Status = Selected — select trigger), and **`Revision Requested`** (`viwGVYiheuTD2pPlx`, Status = Revising — revision trigger). Scope the `Revision Requested` view to `Status = Revising` so a row drops out of it once Path 3 sets it back to `Final`.

### `Prompts` table (image-gen prompt templates, edit these to change prompts)

> **Renamed 2026-07-15 from `Thumbnail Prompts` to `Prompts`** (it now also holds the Telegram assistant's `System Map` row — see below). The table **ID is unchanged (`tblhG1nw2P1k3CBVU`)** and every node references it by ID, so the rename broke nothing; only code comments / error strings in the workflow still say "Thumbnail Prompts" (cosmetic). Historical mentions of `Thumbnail Prompts` elsewhere in this doc refer to the same table.
>
> Added 2026-07-06 to move prompt text out of the `Build Image Requests` Code node so prompts can be edited in Airtable instead of n8n. Table ID `tblhG1nw2P1k3CBVU`.
>
> **Also in this table (not thumbnail-related):** row `Name = "System Map"` holds the pipeline knowledge base the `Pod21: Telegram Airtable Assistant` reads on demand. The assistant filters by `Name = "System Map"`, so it never touches the `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail` / `Reversion 1x1` / `Reversion 9x16` rows. See that workflow's readme.

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text (primary) | **exact** row keys the code matches on. Phase A: `Solo Thumbnail`, `Duo Thumbnail`, `Roundtable Thumbnail`. Phase B (2026-07-08): `Reversion 1x1`, `Reversion 9x16`. **Path 3 (2026-07-26): `Artwork Revision`** (one generic self-edit prompt for all three ratios). A typo throws a clear `Missing prompt row "..."` error. |
| `Prompt` | Long text | the full prompt, with `{{HOOK}}` / `{{CONTEXT}}` / `{{VIBE}}` / `{{VARIATION}}` fill-in tokens (double curly braces get replaced; bare words stay literal). **Field is literally named `Prompt`** — the code reads `rf.Prompt`. An empty/misnamed field loads as `''` and throws the misleading `Missing prompt row "..."` (see the 2026-07-08 fix at the top). |
| `Type` | Single select / text | set to `Artwork` on all rows. Not filtered server-side (the code matches by `Name`), so it's just for tidiness. |

Token contract, **Phase A** (`Build Image Requests`): `{{HOOK}}` = caption/headline, `{{CONTEXT}}` = summary, `{{VIBE}}` = the picked mood, `{{VARIATION}}` = one of the 4 per-option framing lines (still hardcoded in the Code node; the `Roundtable Thumbnail` template deliberately omits `{{VARIATION}}`). Layout→row mapping: `solo → Solo Thumbnail`, `duo → Duo Thumbnail`, `roundtable → Roundtable Thumbnail`; a duo/roundtable episode with **zero** usable guest images falls back to `Solo Thumbnail`.

Token contract, **Phase B** (`Build Reversion Requests`): only `{{HOOK}}` = the selected row's `Caption`. Field→row mapping: `1x1 → Reversion 1x1`, `9x16 → Reversion 9x16`. These prompts carry an explicit **legibility contract** (reserve a clear band for the headline, keep the subject out of it, render text in the foreground with a contrast treatment) added 2026-07-08 after a run put the caption behind the subject. Every `{{TOKEN}}` occurrence is replaced globally.

Token contract, **Path 3** (`Build Revision Requests`): row `Artwork Revision`, `{{REVISION}}` = the `Revision Brief`, `{{HOOK}}` = the row `Caption`. The current image of each targeted ratio is passed inline and the prompt asks Nano Banana to apply *only* the briefed change while preserving everything else (a self-edit), carrying the same legibility contract. All three ratios use this one row (the aspect ratio is set per-request via `imageConfig`, not a separate prompt).

### `Guests` table (for Chat/Clip/Roundtable)

| Field | Type | Notes |
|---|---|---|
| (primary) | — | guest name |
| `Headshot` | Attachment | the guest's face; first attachment is used. **No Headshot → that guest is skipped** |

Linked from Episodes via a **`Guests`** link field. The workflow GETs the whole `Guests` table once and filters to the episode's linked ids (so the table can be any size).

### `Episodes` table (additions only, stays lean)

- `Thumbnail Caption` — long text (manual for now; stage #7 auto-fills later)
- `Type` — single-select `Take` / `Chat` / `Roundtable` / `Clip` (shared with the metadata workflow). Drives the layout: `Take` → solo, `Chat`/`Clip` → duo (host+guest), `Roundtable` → roundtable (host + all guests, film-poster lineup), anything else → manual. Missing `Type` defaults to `Take`.
- `Guests` — link → `Guests` table (multiple). Read for `Chat`/`Clip`/`Roundtable`; all linked guests with a `Headshot` go in the frame. **Do not include the host (Guy) here** — the host is composited separately from `Thumbnail References`, so listing him as a guest draws him twice. `Plan Generate` now strips his record defensively (see the host-rendered-twice gotcha), but keep the data clean too.
- `Status` single-select: add `Awaiting Thumbnail Pick`, `Artwork Ready`, `Generating Artwork`, and `Awaiting Manual Artwork` (the last is set for Roundtable/unknown types; `typecast` auto-creates it on first use).
- The reverse-link field **`Thumbnails`** (auto-created by the `Episode` link on the Thumbnails table) must be named `Thumbnails` — both the clear-old and reject-siblings logic read `fields.Thumbnails` off the episode.
- View `Approved` (Status = Approved) for the generate trigger.

`Last Modified Time` (`fld3Z4xdI4s2wVnLa`, all fields) already exists from Phase 0.

> Both triggers leave the **Options → Fields** list **empty** on purpose (returns the whole record). Do not restrict it — that is the root cause of the recurring Airtable trigger failures, and a PostToolUse hook lints for it.

---

## Airtable-side automation & view logic (NOT n8n)

> **These run inside Airtable, not n8n.** There is no SDK file or n8n node for them — if the thumbnail behaviour changes and nothing in n8n explains it, look here. Maintained in the Airtable base UI (`app8Xw9Tq0XLjhmp9`), not this repo. Added 2026-06-30 to gate *when* an episode is ready for artwork and kill the "forgot the guest" foot-gun.

### 1. Generate-trigger view gate (`Take` OR has a guest)

The trigger view (`Ready for 16X9 Thumbnail`) requires a guest for `Chat`/`Clip` but **not** for `Take`, via a nested OR group:

```
Transcript is not empty
Summary is not empty
Thumbnail Caption is not empty
Thumbnails is empty
Status is not "Generating Artwork"
AND (any of the following):
    Type is "Take"           ← escape hatch: Takes never need a guest
    Guests is not empty       ← Chat/Clip only qualify once a guest is linked
```

`Type is "Take"` is an unconditional pass; everything else must **earn** entry by having a guest. A guest-less `Chat`/`Clip`/`Roundtable` stays out of the view instead of generating a wrong solo thumbnail. This gate needs no change to support Roundtable — a Roundtable with guests linked already passes via `Guests is not empty`, and `Plan Generate` maps it to the `roundtable` layout (2026-07-06). **Trade-off:** a guest-less `Chat`/`Clip`/`Roundtable` then waits out of the view indefinitely with no automated nudge — there was a `Pod21: Daily Reminders` digest that chased these, but it was deleted 2026-07-21 (one niche job, not worth a standalone workflow). Catch these by hand for now.

### 2. `Associated Episode` is a linked-record field

`Associated Episode` on `Episodes` is a **link → Episodes** (self-link, single) — a Clip points at its longform parent. (Was single-line text originally; converted so the guest can be inherited in #3.)

### 3. Automation: Clip inherits its guest from the parent

**Airtable Automation** (base → Automations tab), name `Clip → inherit guest from parent`:

- **Trigger:** *When a record is updated* — table `Episodes`, watched field `Associated Episode`, condition `Type is Clip`.
- **Action:** *Run a script* — input variable `recordId` = trigger record's Record ID:

```js
let cfg = input.config();
let episodes = base.getTable('Episodes');
let clip = await episodes.selectRecordAsync(cfg.recordId, { fields: ['Associated Episode', 'Guests'] });
let current = clip.getCellValue('Guests') || [];
let parentLink = clip.getCellValue('Associated Episode');
if (parentLink && parentLink.length && current.length === 0) {
  let parent = await episodes.selectRecordAsync(parentLink[0].id, { fields: ['Guests'] });
  let guests = parent.getCellValue('Guests') || [];
  if (guests.length) {
    await episodes.updateRecordAsync(clip, { 'Guests': guests.map(g => ({ id: g.id })) });
  }
}
```

So the manual step for a Clip collapses to *set `Associated Episode`* → guest auto-fills → clip enters the gate view → duo thumbnail. The `current.length === 0` guard never overwrites a hand-set guest (drop it to always re-sync from the parent). Field names are exact/case-sensitive.

### Needs Guest — no automated nudge (was `Pod21: Daily Reminders`, deleted 2026-07-21)

A `Chat`/`Clip`/`Roundtable` that's ready except for a guest silently sits out of the gate view until someone links a guest. A `Pod21: Daily Reminders` workflow used to chase these with a twice-daily Telegram digest, but it was **deleted 2026-07-21** (it served this one niche purpose and wasn't judged worth a standalone workflow). There is currently **no automated reminder** — a guest-less episode won't generate artwork and nothing flags it, so check for stalled episodes by hand. If a nudge is wanted again later, fold it into an existing scheduled/watchdog workflow rather than a dedicated one.

---

## Step-by-step

### Path 1 - Generate
**Approved Episode → Plan Generate → Auto-artable Type? →** *(true)* **Mark Generating → Delete Old Thumbnails → Fetch Mood References → Fetch Prompts → Fetch Guests → Build Mood Prompt → Pick Moods (Gemini) → Resolve Vibes → Plan Downloads → Download Image → Image To Base64 → Build Image Requests → Generate Thumbnail (Nano Banana) → Extract Images → Create Thumbnail Row → Upload 16x9 → Collect Thumbnails → Send Thumbnail Options → Send Pick Instructions → Mark Awaiting Pick** ; *(false)* **Mark Manual Artwork → Notify Manual**

1. **Plan Generate** (Code) - reads the episode (`Title`, `Thumbnail Caption`, `Summary`, `Type`, `Guests` ids, and the `Thumbnails` reverse-link ids), derives `layout` (`solo` for Take, `duo` for Chat/Clip, `roundtable` for Roundtable) and `autoArt` (true for Take/Chat/Clip/Roundtable), builds the `records[]=` delete query. **Filters the host out of `guestIds`** (2026-07-25, see the host-in-Guests gotcha below): the host is always composited from `Thumbnail References`, so his own `Guests` record (`recs8srWCoJwDuzLn`, "Guy", hardcoded as `HOST_GUEST_REC_ID`) is stripped here — otherwise he's rendered twice in the frame. The filter tolerates both id-string and `{id}`-object shapes. `guestFilter`, `Plan Downloads`, and `Build Image Requests` all derive from this filtered `guestIds`, so the exclusion propagates through the whole duo/roundtable path.
2. **Auto-artable Type?** (IF, boolean on `autoArt`) - true → generate; false → the manual branch below.
3. **Mark Generating** (HTTP PATCH) - sets Episode `Status = Generating Artwork` immediately, so the episode leaves the `Approved` view and a mid-run failure can't re-loop the trigger.
4. **Delete Old Thumbnails** (HTTP DELETE, `neverError`) - removes prior rows (empty query / 422 swallowed on first run).
5. **Fetch Mood References** (HTTP GET) - the whole `Thumbnail References` (host) library.
5b. **Fetch Prompts** (HTTP GET) - the whole `Thumbnail Prompts` table (URL uses the table ID `tblhG1nw2P1k3CBVU`, robust to renames). Read by `Build Image Requests` via `$('Fetch Prompts')`; wired between `Fetch Mood References` and `Fetch Guests` (position only needs to be upstream of `Build Image Requests`). Added 2026-07-06.
6. **Fetch Guests** (HTTP GET, `executeOnce`, `neverError`) - the `Guests` table **filtered server-side** to this episode's linked guests via `filterByFormula=OR(RECORD_ID()='…')` (built as `guestFilter` in `Plan Generate`; `FALSE()` when there are none). So its output is exactly the episode's guest(s), and there's no 100-row pagination risk.
7. **Build Mood Prompt** (Code) → **Pick Moods (Gemini)** (HTTP POST `gemini-2.5-flash`, JSON) → **Resolve Vibes** (Code) - picks 1-4 vibes and assigns one host reference photo per slot (cycles to fill 4).
8. **Plan Downloads** (Code, `executeOnce`) - emits one task per image: 4 `host` tasks (slot + photo url) then, for `duo`/`roundtable`, one `guest` task per `Fetch Guests` record that has a `Headshot` (already filtered to this episode). Host tasks always come first so indices stay aligned downstream.
9. **Download Image** (HTTP GET file, runs N times) → **Image To Base64** (Extract From File → `dataB64`) - downloads + base64s every task in order (in-Code HTTP is unavailable on this runner).
10. **Build Image Requests** (Code) - **fetches the prompt templates from the `Thumbnail Prompts` Airtable table** (via `$('Fetch Prompts')`), maps `layout` → row `Name` (`solo → Solo Thumbnail`, `duo → Duo Thumbnail`, `roundtable → Roundtable Thumbnail`), and renders the chosen template by substituting `{{HOOK}}`/`{{CONTEXT}}`/`{{VIBE}}`/`{{VARIATION}}`. Zips `Plan Downloads` tasks with the base64 items by index, groups host-by-slot + collects guest parts, then for each of the 4 slots builds a request (host image first, then all guest images for duo/roundtable). Falls back to the `Solo Thumbnail` row if a duo/roundtable episode has no guest images. The `variations[]` framing lines (per-option, solo/duo only) remain hardcoded in this node; a missing prompt row throws `Missing prompt row "..."`.
11. **Generate Thumbnail (Nano Banana)** (HTTP POST `gemini-3-pro-image`) - runs 4x, 120s timeout.
12. **Extract Images** (Code) - pulls base64 from `candidates[0].content.parts[].inline_data.data`, carries mood/option/episode through.
13. **Create Thumbnail Row** (HTTP POST Thumbnails, 4x) → **Upload 16x9** (HTTP POST content endpoint, 4x) - row then `16x9` upload, aligned by index.
14. **Collect Thumbnails** (Code) - gathers the uploaded image URLs. Throws a clear error if fewer than 2 succeeded (the Thumbnails rows still exist for a manual pick), then **pads `urls`/`moods` to 4** by repeating the last image so the static album never has an empty slot. → **Send Thumbnail Options** (Telegram `sendMediaGroup`, **4 static media slots** referencing `$json.urls[0..3]`) → **Send Pick Instructions** (Telegram) → **Mark Awaiting Pick** (PATCH Episode `Status = Awaiting Thumbnail Pick`).

**Manual branch (non Take/Chat/Clip):** **Mark Manual Artwork** (PATCH `Status = Awaiting Manual Artwork`, leaves the Approved view) → **Notify Manual** (Telegram: "type X, art this one manually").

### Path 2 - Select

`Resolve Selected` fans out into **two parallel branches** off the one trigger. A **third, independent branch** hangs directly off the `Thumbnail Selected` trigger: the **multi-select guardrail** (`Check Extra Picks → Warn Multiple Picks`, added 2026-07-21) — see the guardrail note under Gotchas. It does not touch the two processing branches.

**Reject + status branch:**
**Thumbnail Selected → Resolve Selected → Get Episode Thumbnails → Compute Rejects → Reject Siblings → Mark Episode Artwork Ready → Confirm Thumbnail Set**

1. **Thumbnail Selected** - Airtable Trigger on the Thumbnails `Selected` view.
2. **Resolve Selected** (Code) - reads the selected row id, its `Episode` link id, the row's `Caption`, and the `16x9` attachment URL/type. **(2026-07-26, UNTESTED)** now loops `$input.all()` and processes the **first row that actually has an `Episode` link**, skipping orphan `Selected` rows (Selected but unlinked); previously it read only `$input.first()` and returned `[]` when that first row had no episode, which stalled the run and stranded a real pick sitting behind an orphan in the same poll (exec #1186). Also (2026-07-08) detects which reversions already exist: emits `need1x1` / `need9x16` (true = that attachment is missing) plus `url1x1` / `url9x16` (the pre-existing attachment URLs, if any). These feed the reversioning branch.
3. **Get Episode Thumbnails** (HTTP GET) - fetches the episode to read its full `Thumbnails` id list + Title.
4. **Compute Rejects** (Code) - builds a batch PATCH body setting every other thumbnail row to `Rejected`; also carries `selectedRowId` through.
5. **Reject Siblings** (HTTP PATCH Thumbnails, `neverError`) - applies it (empty body is swallowed when there are no siblings).
6. **Mark Episode Artwork Ready** - PATCH Episode `Status = Artwork Ready` **and** `Thumbnails = [selectedRowId]`, which unlinks the rejected options from the episode (only the chosen row stays linked). Because Airtable links are bidirectional, the rejected rows' own `Episode` link also clears.
7. **Mark Selected Final** - PATCH the chosen `Thumbnails` row `Status = Final` (typecast). This moves it **out of the `Selected` view** so the poll trigger's view is empty between picks (see gotcha below). The reversioning branch still uploads to it by row id, so status doesn't matter there.
8. **Confirm Thumbnail Set** - Telegram confirmation.

**Reversioning branch (Phase B), reworked 2026-07-08 to be idempotent + notify:**
**Resolve Selected → Needs Reversion? → Download Selected 16x9 → Selected To Base64 → Fetch Reversion Prompts → Build Reversion Requests → Generate Reversions (Nano Banana) → Extract Reversions → Upload Reversion → Collect Reversions → Send Reversions**

8. **Needs Reversion?** (IF) - true when `need1x1 || need9x16`. False (both already present) dead-ends, so nothing downloads or regenerates. Only the true output continues.
9. **Download Selected 16x9** (HTTP GET, file) - fetches the chosen 16:9 from its Airtable attachment URL (no auth; signed URL).
10. **Selected To Base64** (Extract From File, `binaryToPropery → dataB64`) - in-Code HTTP is unavailable on this task runner, so the image is base64'd via a node.
11. **Fetch Reversion Prompts** (HTTP GET) - reads the `Thumbnail Prompts` table (same table ID as `Fetch Prompts`). Wired inline here so `Build Reversion Requests` can read it via `$('Fetch Reversion Prompts')`; because this node sits between `Selected To Base64` and `Build Reversion Requests`, the Code node reads the base64 via `$('Selected To Base64')` (not `$json`).
12. **Build Reversion Requests** (Code) - emits **only the missing** aspect ratios (filters targets by `need1x1` / `need9x16`; returns `[]` if none, which short-circuits the rest of the branch). Each request feeds the 16:9 inline + the `Reversion 1x1` / `Reversion 9x16` prompt (from Airtable, `{{HOOK}}` = `Caption`) + `imageConfig.aspectRatio`. `1K`.
13. **Generate Reversions (Nano Banana)** (HTTP POST `gemini-3-pro-image`, runs 1-2x depending on how many were missing).
14. **Extract Reversions** (Code) - pulls base64 per item, carries the target field name (`1x1` / `9x16`) + `filename` + selected row id.
15. **Upload Reversion** (HTTP POST content endpoint, 1-2x) - uploads each into the selected row's `1x1` / `9x16` field (field name is in the URL path).
16. **Collect Reversions** (Code) - emits **one item per newly-generated image**. Resolves each new image's URL from the `Upload Reversion` response by **matching the uploaded `filename`** (NOT by field name — the `uploadAttachment` response keys `fields` by field ID, and can also contain pre-existing attachments; see gotcha). No pre-existing versions, no padding.
17. **Send Reversions** (Telegram `sendPhoto`, runs once per item) - posts each new reversion to the group as its own message (`{{ $json.photoUrl }}` + caption, HTML). So a re-select that regenerated only the 1:1 sends exactly one message with the new 1:1; a first-time pick that made both sends two messages.

**Confirm Thumbnail Set** (on the reject branch) uses a conditional expression on `Resolve Selected`'s `need1x1`/`need9x16` so its closing line reads "Generating 1:1 and 9:16 versions now" / "Generating the 1:1 version now" / "...the 9:16 version now" / "Both 1:1 and 9:16 versions are already in place" as appropriate.

### Path 3 - Revision (added 2026-07-26)

**Revision Requested → Plan Revision → Download Revision Sources → Revision To Base64 → Aggregate Revision Sources → Fetch Episode For Tag → Clear Target Fields → Fetch Revision Prompt → Build Revision Requests → Generate Revisions (Nano Banana) → Extract Revisions → Upload Revision → Collect Revisions → Send Revisions → Mark Row Revised Final**

Briefed, in-place, targeted redo of an already-picked thumbnail. Trigger fires when a `Thumbnails` row enters the `Revision Requested` view (`Status = Revising`).

1. **Plan Revision** (Code) - reads the row's `Episode` link, `Caption`, `Revision Brief` (trimmed), and `Revision Targets` (filtered to the 3 valid values). **Throws** if the episode link, a non-empty brief, or at least one valid target is missing (a malformed row surfaces the error rather than silently completing). Emits **one item per target**, each carrying the source attachment URL (the target ratio's **own** current image if present, else the row's `16x9` as the base), the aspect ratio, filename, and an `only16x9` flag (true when the sole target is `16x9`).
2. **Download Revision Sources** (HTTP GET file, retry) → **Revision To Base64** (Extract From File → `dataB64`) - each source image is base64'd via nodes (in-Code HTTP is unavailable on this runner). **Sources are captured up front, before any clear**, so a self-edit still has the old image.
3. **Aggregate Revision Sources** (Code) - collapses the N per-target items into **one** bundle: zips each target with its base64 by index into `tasks[]`, and precomputes a `clearBody` (`{fields: {<each target field>: []}}`).
4. **Fetch Episode For Tag** (HTTP GET) - reads the episode to get its display `ID` (`BA-xxxx`) for the Telegram reply anchor.
5. **Clear Target Fields** (HTTP PATCH, retry) - blanks the targeted attachment field(s) on the row **before** re-upload. **This is the key difference from Phase B:** on a `Final` row those fields are already populated and Airtable's `uploadAttachment` only **appends** — without clearing first you'd end up with two images in the field. (Phase B never hit this because it only ran when a field was empty.)
6. **Fetch Revision Prompt** (HTTP GET) - reads the `Prompts` table.
7. **Build Revision Requests** (Code) - renders the `Artwork Revision` prompt (`{{REVISION}}` = brief, `{{HOOK}}` = caption) with the source image inline, one Nano Banana request per target at the target's aspect ratio, `1K`.
8. **Generate Revisions (Nano Banana)** (HTTP POST `gemini-3-pro-image`, `neverError`, retry, runs 1-3x) → **Extract Revisions** (Code) - pulls base64, surfaces `finishReason` on failure.
9. **Upload Revision** (HTTP POST content endpoint, retry, 1-3x) - uploads each new image into the row's `16x9` / `1x1` / `9x16` field (field name in the URL path); the field is now empty (step 5) so this is a clean replace.
10. **Collect Revisions** (Code) - resolves each new image URL from the upload response by **matching the uploaded `filename`** (same field-ID gotcha as Phase B). Caption includes the episode `ID` in a `<code>` block, plus — when `only16x9` — a stale note that the 1:1/9:16 still derive from the previous 16:9.
11. **Send Revisions** (Telegram `sendPhoto`, once per new image) → **Mark Row Revised Final** (HTTP PATCH, retry) - sets `Status = Final` and clears `Revision Brief` + `Revision Targets`, so the row leaves the revision view and won't re-fire.

**Driving it from Telegram:** the `Pod21: Telegram Airtable Assistant` (`Hx8Ul6M41fM8HuxU`) has an "Artwork Revisions" skill in its system message — asking the bot "redo the 9x16 for BA-xxxx, more red" makes it find the episode's `Final` thumbnail row and propose the `Revision Brief` + `Revision Targets` + `Status = Revising` write for one-tap approval. Editing the row directly in Airtable is the permanent manual equivalent. If no ratio is named, the assistant defaults to all three (stated in the approval summary).

---

## Gotchas / things to verify on first run

- **Paste the Thumbnails table ID.** The `Thumbnail Selected` trigger's Table field is a **placeholder** - the Airtable Trigger needs a real `tbl...` ID (it can't use the table name like the HTTP nodes do). Open the node and set the Table to your `Thumbnails` table before activating. Also add a **`Last Modified Time`** field (watching all fields) to the Thumbnails table, or the trigger never fires.
- **Reverse-link field must be named `Thumbnails`.** The clear-old (Path 1) and reject-siblings (Path 2) steps read `fields.Thumbnails` off the Episode. If Airtable named the auto reverse field something else, rename it to `Thumbnails`.
- **Cost, not free.** Nano Banana is paid (~$0.039/image); the key must be on a billing-enabled project.
- **API version / response shape.** Both Gemini calls use `v1beta`. Image uses `responseModalities`, text uses `responseMimeType`. If a call 4xxs, that's the most likely thing to tweak. `Extract Images` reads both `inline_data` and `inlineData`.
- **`IMAGE_OTHER` = prompt, not a hard block.** Nano Banana returns HTTP 200 with `finishReason: IMAGE_OTHER` ("could not generate the image, try rephrasing") when the prompt is too dense/contradictory — distinct from `IMAGE_SAFETY` (a real policy block). The image nodes are set to `neverError` and `Extract Images` / `Extract Reversions` surface the actual `finishReason` + message in their thrown error, so a failed run tells you why. The prompts use a lean `HOOK / CONTEXT / VIBE / INSTRUCTIONS` structure (mirroring Jonny's proven manual prompt) with framing/lighting per-option variation rather than clashing colour palettes — that was the original cause of all-4 `IMAGE_OTHER` failures (2026-06-22).
- **Mood library works with 1+ rows.** With a single mood, all 4 options use it (different compositions). The workflow only throws if zero rows have a usable `Reference Photo`. More moods = a more selective, varied set.
- **Gemini credential is "Header Auth", and the two Gemini nodes default to AgentMail** until you point them at `Gemini API Key [n8n]` - see Required credentials above.
- **Album = static 4 slots, padded.** The Telegram node builds `sendMediaGroup` from its **static per-slot config** (`urls[0..3]`), not from an array expression — binding the whole `media` collection to `{{ ...mediaGroup }}` does NOT work (Telegram throws "can't parse InputMedia: media not found"). So `Collect Thumbnails` pads short sets to 4 by repeating the last image; on the rare `<4` run the album shows a duplicate (cosmetic — the real Thumbnails rows in Airtable still have the correct count, and picking is by row Status). Throws if `<2`.
- **`IMAGE_OTHER` reliability lever = `imageSize`.** Both Path 1 generation (`IMAGE_SIZE` in `Build Image Requests`) and Phase B reversioning (`Build Reversion Requests`) run at **`1K`**; 2K caused frequent `IMAGE_OTHER` "could not generate" failures (including on the reversioning step). Bump back to `2K`/`4K` only if reliability holds.
- **Telegram messages: force `parse_mode: HTML` + escape `&<>`.** The Telegram node otherwise parses message text as **Markdown**, where an underscore (e.g. the `_` in `Chat_171`) opens an italic span that never closes → `can't parse entities: can't find end of the entity at byte offset N`. Fix is two parts: (1) every message/caption sets `additionalFields.parse_mode = 'HTML'` (in HTML mode `_ * [` are not special, so `Chat_171` is safe); (2) `Plan Generate`, `Compute Rejects` and `Collect Thumbnails` emit a pre-escaped `titleHtml` / `captions` (escaping the only HTML-special chars `& < >`) which the message nodes use instead of the raw title. Escaping alone was NOT enough — the underscore is a Markdown problem, not an HTML one.
- **Flat vs nested trigger fields.** Code nodes read `rec.fields || rec` defensively; record `id` is always top-level.
- **Re-trigger safety — it's the `Thumbnails` link, NOT the `Status`, that gates generation.** The generate trigger view (`Ready for 16X9 Thumbnail`) gates on **`Thumbnails is empty`** (see "Generate-trigger view gate" above); it does **not** filter on `Status = Approved`. So what actually keeps a generated episode out of the view is that it now has **linked `Thumbnails` rows** — the `Thumbnails is empty` gate flips false the moment `Create Thumbnail Row` runs. The end-of-run `Status = Awaiting Thumbnail Pick` is incidental to view membership; `Mark Generating` (`Status = Generating Artwork`) only covers the *mid-run* window via the view's `Status is not "Generating Artwork"` clause, before the rows exist. **Corollary: anything that empties an episode's `Thumbnails` link re-arms generation** (see the `Mark Episode Artwork Ready` hazard below). Select doesn't modify the selected row's timestamp, so it doesn't re-fire; siblings move to `Rejected` and leave `Proposed`.
- **`Mark Episode Artwork Ready` must never write an empty `Thumbnails` (latent loop).** It PATCHes `Thumbnails = [selectedRowId]` to unlink the rejects. Because the generate view gates on `Thumbnails is empty`, if `selectedRowId` ever resolved empty the PATCH would blank the link and **silently re-arm the generate trigger** (regenerate → pick → repeat), with no error — writing `Thumbnails: []` is a valid PATCH. Currently safe: `selectedRowId` is the trigger row's top-level `id` and `Resolve Selected` only ever emits a row with a non-empty `Episode` link (2026-07-26: it now skips orphan `Selected` rows and picks the first *linked* row, rather than returning `[]` on the first row when that one is unlinked). But a future edit that lets the id resolve empty would loop. Optional hardening: build the fields object so the `Thumbnails` key is omitted when the id is falsy (or throw).
- **One pick per poll — multi-select guardrail (added 2026-07-21).** The whole select path is single-row: `Resolve Selected`, `Compute Rejects` and `Build Reversion Requests` all read `.first()`. So if **2+ `Thumbnails` rows are flipped to `Selected` inside one 60s poll window**, only the first is processed and the rest are **silently dropped** — and because the poll fires on `Last Modified Time` *advancing* (not presence), a dropped row never re-fires on its own; it just sits `Selected`. This stranded a real pick on 2026-07-06 (exec 1339/1340: two episodes' thumbnails Selected ~4s apart, Phase B ran for the wrong episode). **Guardrail:** a parallel **`Check Extra Picks`** Code node off the `Thumbnail Selected` trigger detects >1 valid Selected row and fires **`Warn Multiple Picks`** (Telegram, chat `1512868522`, HTML) listing the un-processed rows + their record IDs, so you re-flip them one at a time. It does **not** auto-process them. Normal one-pick-at-a-time flow is unaffected — the branch returns `[]` and stays silent. Full concurrent-pick support would need the select path rebuilt to fan out per-item (the reversion branch zips build↔response by index and matches uploads by filename — both collide across rows), deferred as higher-risk. **Update (2026-07-26, UNTESTED):** `Resolve Selected` now skips orphan `Selected` rows (no `Episode` link) and processes the first *linked* row, so an orphan sorting ahead of a real pick (exec #1186) no longer stalls the run or makes `Check Extra Picks` misname the row being processed. The 2+ *valid*-picks-per-poll limitation above is unchanged (downstream is still single-row). **UNTESTED (reconciled into `.sdk.js` 2026-07-26, not yet run end-to-end).**
- **Polling trigger fires on the timestamp *advancing*, not on presence.** The `Thumbnail Selected` Airtable trigger only emits a row whose `Last Modified Time` is newer than the cursor it stored last poll; a row simply sitting in the `Selected` view (with an old, unchanging timestamp) never re-fires. So **the chosen row must leave the `Selected` view after processing**, or stale picks pile up and confuse which row is "newest." `Mark Selected Final` does this (`Status = Final`). Two consequences: (1) the `Selected` view should be **empty between picks** — if it isn't, an old pick can shadow a new one in "Fetch Test Event"; (2) **every `update_workflow` + publish restarts the poller and re-baselines its cursor to ~now**, so after any push, test with a *fresh* flip and give it ~60-90s. To force a clean reset, toggle the workflow Active off/on.
- **Phase B fields + credential.** The selected row must have `1x1` and `9x16` attachment fields, or `Upload Reversion` 404s. `Generate Reversions (Nano Banana)` uses the same `Gemini API Key [n8n]` Header Auth credential as the Phase A image node; `Fetch Reversion Prompts` uses `Airtable [n8n] (PAT)` — verify neither points at AgentMail after a rebuild.
- **`uploadAttachment` response keys `fields` by field ID, not name, and includes *other* existing attachments (2026-07-08).** The Content API `POST .../uploadAttachment` returns the record with `fields` keyed by `fld…` IDs, and the object contains every populated attachment field (so after uploading a new `1x1`, the response still lists the pre-existing `9x16`). Do **not** index it by field name (`fields['1x1']` is always `undefined`). To read back the image you just uploaded, either scan `Object.values(fields)` and **match the array element by the `filename` you uploaded with** (what `Collect Reversions` does), or re-GET the row (GET responses key by name). Indexing by name caused a bug where the Telegram send-back showed the wrong aspect ratio (the pre-existing one) duplicated twice.
- **Phase B is idempotent (2026-07-08).** On (re-)select, `Resolve Selected` detects which of `1x1`/`9x16` are missing; the `Needs Reversion?` IF skips the whole branch if both exist, and `Build Reversion Requests` regenerates only the missing ones. So re-selecting a fully-arted row costs nothing, and deleting one attachment + re-selecting regenerates just that one. `Send Reversions` posts only what was regenerated.
- **Unlink is permanent for rejects.** On select, the rejected rows are dropped from the Episode `Thumbnails` link, so a later Path 1 re-run won't find/clear them via `fields.Thumbnails` — they linger as orphaned `Rejected` rows in the Thumbnails table. Delete by hand if you care about hygiene.
- **Airtable Trigger `Fields`** left empty on purpose; if you ever restrict it, include `Last Modified Time` and use commas with no spaces (a hook lints this).
- **Content type + guests.** `Type` must be `Take`/`Chat`/`Clip`/`Roundtable` to auto-generate; anything else/blank-unknown is sent to manual with `Status = Awaiting Manual Artwork`. For `Chat`/`Clip`/`Roundtable`, link the people via the Episodes `Guests` field and give each `Guests` row a `Headshot` — a guest with no headshot is silently skipped, and a duo/roundtable episode with **zero** usable guest images falls back to the `Solo Thumbnail` prompt.
- **Prompts live in Airtable now (2026-07-06).** To change any image-gen prompt, edit the `Thumbnail Prompts` table, NOT the workflow. Row `Name` must match exactly (`Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail`) or the run throws `Missing prompt row "..."`. The `Fetch Prompts` node must stay wired upstream of `Build Image Requests`. **This whole Airtable-prompt + Roundtable path is UNTESTED as of 2026-07-06 — run a real Roundtable episode (Type=Roundtable, guests linked with headshots, caption/summary/transcript filled) and confirm before relying on it.**
- **Host must not appear in `Guests` (host-rendered-twice bug, fixed 2026-07-25, UNTESTED).** The host's face is always composited from `Thumbnail References` (image 1). If Guy is **also** linked in the episode's `Guests` field, the duo/roundtable path adds his headshot a **second** time and Nano Banana draws him twice. This bit exec #1318 (episode `rec3YKGUCKqRBtgqP`, a `Clip`): its `Guests` held both Bitcoin Mechanic **and** Guy (`recs8srWCoJwDuzLn`, guy@bitcoinaudible.com), so the thumbnails came back as Guy + Guy + Bitcoin Mechanic. Root cause is data: `Guests` is meant for non-host participants only, and `Clip → inherit guest from parent` copies the parent's `Guests` wholesale — so a host sitting in the parent's `Guests` propagates to every clip. **Two-layer fix:** (1) **data** — keep the host out of every episode's `Guests` (remove Guy from the parent episode and any clips); (2) **code guard** — `Plan Generate` now strips `HOST_GUEST_REC_ID` (`recs8srWCoJwDuzLn`, "Guy") from `guestIds` so he can never be double-rendered regardless of the data. The id is hardcoded, matching this instance's convention (the Telegram chat id is hardcoded too, since `$env` is blocked). If the host's `Guests` record id ever changes, update `HOST_GUEST_REC_ID`. Not yet run end-to-end.
- **Index alignment.** `Build Image Requests` zips `Plan Downloads` tasks with the downloaded base64 items **by position**, relying on the HTTP node preserving item order (host slots 0-3 first, guests after). If you reorder `Plan Downloads`, keep hosts first.
- **Path 3 revisions clear-then-upload; revise one row at a time.** On a `Final` row the attachment fields are populated, so Path 3 blanks the targeted field(s) (`Clear Target Fields`) before uploading — sources are downloaded first so the self-edit isn't lost. Like the select path, the chain is built around a **single row's** targets; flipping several rows to `Revising` in one 60s poll is untested. Also: scope the `Revision Requested` view to `Status = Revising` so a row leaves it once the run sets `Status = Final` (else it can re-fire on the next edit). A malformed row (no brief / no valid target) **throws** and stays `Revising` until corrected.
- Workflow is **active** (`mLAn4ya2AmZoHDUk`, SDK-sourced). Schema/credential setup must be in place before the next `Approved`/`Selected`/`Revising` fires. After any SDK push, **all HTTP-node credentials are skipped and must be rebound by hand** (triggers + Telegram bind fine); reconcile canvas hand-edits back into the `.sdk.js`.

---

## Limitations / future work

- **Reversioning is best-effort + parallel, now idempotent.** The 1:1/9:16 branch runs alongside the status branch, so the episode flips to `Artwork Ready` even if a reversion call fails. If `Upload Reversion` 404s, the most likely cause is the `1x1`/`9x16` attachment fields not existing on the Thumbnails table yet. Recovery is cheap now (2026-07-08): re-select the row and only the still-missing version regenerates (no wasted Nano Banana spend on the one that already succeeded).
- **Reversion text legibility is prompt-only.** The `Reversion 1x1` / `Reversion 9x16` prompts carry an explicit legibility contract (reserve a clear band, keep the subject out of it, foreground text + contrast treatment) after a 2026-07-08 run put the caption behind the subject. It's very reliable but not guaranteed. For a hard guarantee, generate the art without a headline and composite the caption as a real text layer downstream (not built).
- **Aspect ratio is prompt + `imageConfig` only.** 1:1 / 9:16 are requested, not pixel-guaranteed. Crop downstream if a platform is strict.
- **Caption is manual** until stage #7 auto-writes `Thumbnail Caption`.
- **Roundtable now automated (2026-07-06, UNTESTED).** Group episodes generate host + all linked guests in a film-poster lineup, via the `Roundtable Thumbnail` prompt row. Enabled by adding `Roundtable` to `autoArt` + the `roundtable` layout in `Plan Generate`, and the Airtable-driven prompt lookup in `Build Image Requests`. Guy IS in the frame alongside the guests (host reference stays image 1). Not yet run end-to-end — verify. Likeness with 5 faces (host + 4 guests) at 1K is the main risk; review the 4 options carefully.
- **Guest composition is prompt-only.** For Chat/Clip/Roundtable every guest headshot is passed inline and the prompt asks Nano Banana to balance the faces across the frame, but layout/likeness with several guests isn't guaranteed — review the 4 options before picking.
- **Host expression for duo** still comes from the vibe-tagged (Guy-only) reference library; the guest's expression is generated from the prompt, not a reference.

---

## Related

- **Upstream:** stage #7 AI metadata (planned) sets `Status = Approved` and will fill `Thumbnail Caption`.
- **Downstream:** stage #9 Publishing fan-out (`Status = Artwork Ready`).
- **Selection-architecture sibling:** `Pod21: Telegram Airtable Assistant` (live ID `Hx8Ul6M41fM8HuxU`) - owns the bot webhook (the reason selection/revision is via Airtable status, not Telegram buttons). Its system message carries the **"Artwork Revisions"** skill that turns "redo the 9x16 for BA-xxxx, more red" into a one-tap-approved write of `Revision Brief` + `Revision Targets` + `Status = Revising` on the episode's `Final` row. SDK source: `scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflow #8)
