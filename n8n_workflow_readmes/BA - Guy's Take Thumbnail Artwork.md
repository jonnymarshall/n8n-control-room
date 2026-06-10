# BA: Guy's Take Thumbnail Artwork

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `YyXiJ0lusoW7ynu9`.)

This is **stage #8 "Artwork"** in the Guy's Take build, **Phase A** (generate + select the 16:9). The 1:1 and 9:16 reversioning is a planned **Phase B** follow-up that writes back onto the selected Thumbnail row.

---

## TL;DR

Uses a **normalized data model**: a `Thumbnails` table where each generated option is its own row (linked to the Episode), and a static `Thumbnail References` library of Guy headshots tagged by mood. Two Airtable-triggered paths in one workflow.

**Path 1 - Generate** (fires when an episode enters the Episodes `Approved` view):

1. Clears any old `Thumbnails` rows for that episode (so re-runs start fresh)
2. Reads the whole `Thumbnail References` library (mood + reference photo per row)
3. Asks **Gemini text** (`gemini-2.5-flash`) to choose the **1 to 4 moods** that fit the episode and assign one to each of the **4 thumbnail slots** (repeats allowed: 1 fitting mood → all 4 use it; 2 → split; etc.)
4. For each slot, calls **Nano Banana** (`gemini-2.5-flash-image`) to generate one 16:9, feeding that mood's reference photo inline (for face likeness) + the shared `Thumbnail Caption` + a per-slot **composition** variation (close-up / offset / wide / low-angle) so same-mood options still look distinct
5. Creates 4 `Thumbnails` rows (`Status = Proposed`, linked to the Episode, with the mood, option number, caption) and uploads each image into the row's `16x9` attachment
6. Posts the 4 as a **Telegram album** to Jonny's DM, captioned by mood, plus a short "set a row to Selected" instruction
7. Sets the Episode `Status = Awaiting Thumbnail Pick`

**Path 2 - Select** (fires when a `Thumbnails` row enters the `Selected` view):

8. Sets the episode's other thumbnail rows to `Status = Rejected`
9. Sets the Episode `Status = Artwork Ready`, sends a Telegram confirmation

Selection is by setting a **`Thumbnails` row's `Status` to `Selected`**, not Telegram buttons: the `Pod21: Telegram Airtable Assistant` already owns the bot's only webhook, and Telegram allows one webhook per bot, so a second Telegram **Trigger** can't be added without breaking the Assistant. Sending messages from the same bot is fine; only triggers conflict.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `YyXiJ0lusoW7ynu9` |
| **Trigger 1** | Airtable poll on `Episodes` (`tbl3uYLIvtB9APZp6`), every minute, view `Approved` |
| **Trigger 2** | Airtable poll on **`Thumbnails`** table, every minute, view `Selected` — **needs the Thumbnails table ID pasted into the node** (see gotchas) |
| **Mood picker** | `gemini-2.5-flash` (text), `responseMimeType: application/json`, returns a 4-slot mood assignment (repeats allowed) |
| **Image model** | `gemini-2.5-flash-image` (Nano Banana), `v1beta`, `responseModalities: ["TEXT","IMAGE"]`, one call per slot |
| **Options generated** | always 4 (moods assigned across the 4 slots by the LLM; each slot gets a different composition) |
| **Output** | 4 `Thumbnails` rows (`Proposed`) with `16x9` attached; on pick, one → `Selected`, rest → `Rejected`; Episode → `Artwork Ready` |
| **Telegram** | album + messages to Jonny's DM (chat ID `1512868522`, hardcoded) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |
| **Cost** | Nano Banana is **NOT free**: ~$0.039/image, ~$0.16 per 4-option run. The mood-pick text call is cheap/near-free. Needs a billing-enabled Google key. |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Both triggers + all 8 Airtable HTTP nodes (attach to HTTP nodes manually) | exists |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | The 3 Telegram send nodes (auto-assigned) | exists |
| `Gemini API Key [n8n]` | `httpHeaderAuth` | `Pick Moods (Gemini)` + `Generate Thumbnail (Nano Banana)` | **must be created** |

The Gemini credential is a generic **Header Auth** credential (when creating it in n8n, search "Header Auth" - NOT "Google Gemini (PaLM) Api"): header **Name** = `x-goog-api-key`, **Value** = your key from https://aistudio.google.com/apikey on a **billing-enabled** Google Cloud project (image gen is paid; the text call is free-tier). It powers both the mood-pick text call and the image calls.

> **AgentMail gotcha:** because `Gemini API Key [n8n]` did not exist when the workflow was built, n8n auto-filled the Header Auth slot on the two Gemini nodes with the only existing Header Auth credential (**AgentMail**). That is wrong and must be replaced - open `Pick Moods (Gemini)` and `Generate Thumbnail (Nano Banana)` and set the credential to `Gemini API Key [n8n]`.

All HTTP Request nodes are **skipped by credential auto-assignment** at build time. Open each and confirm: the Airtable ones (`Delete Old Thumbnails`, `Fetch Mood References`, `Create Thumbnail Row`, `Upload 16x9`, `Mark Awaiting Pick`, `Get Episode Thumbnails`, `Reject Siblings`, `Mark Episode Artwork Ready`) use **`Airtable [n8n] (PAT)`**; the two Gemini ones use **Header Auth** with the credential above.

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
| `Status` | Single select | `Proposed`, `Selected`, `Rejected` |
| `16x9` | Attachment | filled in Phase A |
| `1x1` / `9x16` | Attachment | Phase B reversioning |
| `Last Modified Time` | Last Modified Time | **required** — the select trigger sorts on it. Must watch **all** fields. |

Views: **`Proposed`** (Status = Proposed) and **`Selected`** (Status = Selected). The select trigger is scoped to `Selected`.

### `Episodes` table (additions only, stays lean)

- `Thumbnail Caption` — long text (manual for now; stage #7 auto-fills later)
- `Status` single-select: add `Awaiting Thumbnail Pick` and `Artwork Ready`
- The reverse-link field **`Thumbnails`** (auto-created by the `Episode` link on the Thumbnails table) must be named `Thumbnails` — both the clear-old and reject-siblings logic read `fields.Thumbnails` off the episode.
- View `Approved` (Status = Approved) for the generate trigger.

`Last Modified Time` (`fld3Z4xdI4s2wVnLa`, all fields) already exists from Phase 0.

> Both triggers leave the **Options → Fields** list **empty** on purpose (returns the whole record). Do not restrict it — that is the root cause of the recurring Airtable trigger failures, and a PostToolUse hook lints for it.

---

## Step-by-step

### Path 1 - Generate
**Approved Episode → Plan Generate → Delete Old Thumbnails → Fetch Mood References → Build Mood Prompt → Pick Moods (Gemini) → Build Image Requests → Generate Thumbnail (Nano Banana) → Extract Images → Create Thumbnail Row → Upload 16x9 → Collect Thumbnails → Send Thumbnail Options → Send Pick Instructions → Mark Awaiting Pick**

1. **Plan Generate** (Code) - reads the episode (`Title`, `Thumbnail Caption`, `Summary` if present, and the `Thumbnails` reverse-link ids), builds a `records[]=` delete query for the old rows.
2. **Delete Old Thumbnails** (HTTP DELETE, `neverError`) - removes prior rows. On first run / no old rows the query is empty and the 422 is swallowed.
3. **Fetch Mood References** (HTTP GET, `executeOnce`) - GETs the whole `Thumbnail References` table by name.
4. **Build Mood Prompt** (Code) - assembles the Gemini text prompt (episode + the available mood list) asking for a JSON `{slots:[4]}` mood assignment (repeats allowed).
5. **Pick Moods (Gemini)** (HTTP POST `gemini-2.5-flash`) - `responseMimeType: application/json`.
6. **Build Image Requests** (Code) - parses the 4 slot moods (filtered to those that actually exist in the library), fetches each reference photo to base64 via `$helpers.httpRequest` (cached, so a repeated mood is downloaded once), builds one image request per slot (caption + house style + mood expression + a per-slot composition variation + reference inline). Always emits exactly 4; if the model returns fewer valid moods it cycles the available ones to fill the slots.
7. **Generate Thumbnail (Nano Banana)** (HTTP POST `gemini-2.5-flash-image`) - runs 4x, 120s timeout.
8. **Extract Images** (Code) - pulls base64 from `candidates[0].content.parts[].inline_data.data`, carries mood/option/episode through.
9. **Create Thumbnail Row** (HTTP POST Thumbnails, 4x sequential) - `Name`, `Episode` link by id, `Mood` link by name (`typecast:true`), `Caption`, `Option`, `Status=Proposed`.
10. **Upload 16x9** (HTTP POST content endpoint, 4x sequential) - uploads each image to the new row's `16x9` field, base64 from the aligned `Extract Images` item.
11. **Collect Thumbnails** (Code) - gathers the 4 image URLs (from the upload responses) + moods into one item.
12. **Send Thumbnail Options** - Telegram album, captioned by option/mood.
13. **Send Pick Instructions** - Telegram message.
14. **Mark Awaiting Pick** - PATCH Episode `Status = Awaiting Thumbnail Pick`.

### Path 2 - Select
**Thumbnail Selected → Resolve Selected → Get Episode Thumbnails → Compute Rejects → Reject Siblings → Mark Episode Artwork Ready → Confirm Thumbnail Set**

1. **Thumbnail Selected** - Airtable Trigger on the Thumbnails `Selected` view.
2. **Resolve Selected** (Code) - reads the selected row id + its `Episode` link id.
3. **Get Episode Thumbnails** (HTTP GET) - fetches the episode to read its full `Thumbnails` id list + Title.
4. **Compute Rejects** (Code) - builds a batch PATCH body setting every other thumbnail row to `Rejected`.
5. **Reject Siblings** (HTTP PATCH Thumbnails, `neverError`) - applies it (empty body is swallowed when there are no siblings).
6. **Mark Episode Artwork Ready** - PATCH Episode `Status = Artwork Ready`.
7. **Confirm Thumbnail Set** - Telegram confirmation.

---

## Gotchas / things to verify on first run

- **Paste the Thumbnails table ID.** The `Thumbnail Selected` trigger's Table field is a **placeholder** - the Airtable Trigger needs a real `tbl...` ID (it can't use the table name like the HTTP nodes do). Open the node and set the Table to your `Thumbnails` table before activating. Also add a **`Last Modified Time`** field (watching all fields) to the Thumbnails table, or the trigger never fires.
- **Reverse-link field must be named `Thumbnails`.** The clear-old (Path 1) and reject-siblings (Path 2) steps read `fields.Thumbnails` off the Episode. If Airtable named the auto reverse field something else, rename it to `Thumbnails`.
- **Cost, not free.** Nano Banana is paid (~$0.039/image); the key must be on a billing-enabled project.
- **API version / response shape.** Both Gemini calls use `v1beta`. Image uses `responseModalities`, text uses `responseMimeType`. If a call 4xxs, that's the most likely thing to tweak. `Extract Images` reads both `inline_data` and `inlineData`.
- **Mood library works with 1+ rows.** With a single mood, all 4 options use it (different compositions). The workflow only throws if zero rows have a usable `Reference Photo`. More moods = a more selective, varied set.
- **Gemini credential is "Header Auth", and the two Gemini nodes default to AgentMail** until you point them at `Gemini API Key [n8n]` - see Required credentials above.
- **Album needs 2-10 photos.** It references `urls[0..3]`; if some image calls returned nothing you could have fewer than 4 and the album send would fail. With 4 good generations it's fine.
- **Flat vs nested trigger fields.** Code nodes read `rec.fields || rec` defensively; record `id` is always top-level.
- **Re-trigger safety.** Generate flips the Episode to `Awaiting Thumbnail Pick` at the end, so it leaves the `Approved` view. Select doesn't modify the selected row, so it doesn't re-fire; siblings move to `Rejected` and leave `Proposed`.
- **Airtable Trigger `Fields`** left empty on purpose; if you ever restrict it, include `Last Modified Time` and use commas with no spaces (a hook lints this).
- Workflow is **inactive**. Do the schema + credential setup, paste the table ID, then test each path before activating.

---

## Limitations / future work (Phase B)

- **No reversioning yet.** 1:1 and 9:16 are not generated. Phase B: on select, re-run Nano Banana on the chosen `16x9` to reframe to 1:1 and 9:16, write them onto the same Thumbnail row, then confirm.
- **Caption is manual** until stage #7 auto-writes `Thumbnail Caption`.
- **Guests not handled.** The mood reference library is Guy-only; guest episodes (`Co-host = Other`) are out of scope for now (decided 2026-06-09). Add a per-episode reference override or concept-only mode later.
- **Aspect ratio is prompt-level only.** 16:9 is requested in the prompt; Nano Banana does not hard-guarantee exact pixels. Crop downstream if needed.

---

## Related

- **Upstream:** stage #7 AI metadata (planned) sets `Status = Approved` and will fill `Thumbnail Caption`.
- **Downstream:** stage #9 Publishing fan-out (`Status = Artwork Ready`).
- **Selection-architecture sibling:** `Pod21: Telegram Airtable Assistant` (`peTIs4kiluFZHoLg`) - owns the bot webhook; the reason selection is via Airtable status, not Telegram buttons.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflow #8)
