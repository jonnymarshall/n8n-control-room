# BA: Guy's Take Thumbnail Artwork

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `YyXiJ0lusoW7ynu9`.)

This is **stage #8 "Artwork"** in the Guy's Take build. **Phase A** generates + selects the 16:9. **Phase B** (built 2026-06-21) runs on selection: it unlinks the rejected options from the episode and re-runs Nano Banana on the chosen 16:9 to write a **1:1** and a **9:16** adaptation back onto the same Thumbnail row.

---

## TL;DR

Uses a **normalized data model**: a `Thumbnails` table where each generated option is its own row (linked to the Episode), and a static `Thumbnail References` library of Guy headshots tagged by mood. Two Airtable-triggered paths in one workflow.

**Path 1 - Generate** (fires when an episode enters the Episodes `Approved` view) is **content-type aware** (Episodes `Type` field):

0. **`Auto-artable Type?`** routes by `Type`. `Take` / `Chat` / `Clip` → generate. Anything else (`Roundtable`, blank-but-unknown) → **Mark Manual Artwork** (`Status = Awaiting Manual Artwork`, leaving the Approved view so it can't re-loop) + a Telegram "art this one manually" note, then stop.
1. Clears any old `Thumbnails` rows for that episode (so re-runs start fresh)
2. Reads the whole `Thumbnail References` library (mood + reference photo per row) and the `Guests` table
3. Asks **Gemini text** (`gemini-2.5-flash`) to choose the **1 to 4 moods/vibes** that fit the episode and assign one to each of the **4 thumbnail slots** (repeats allowed)
4. **Plan Downloads** builds one download task per image: 4 host reference photos (the picked vibe per slot), plus — for `Chat`/`Clip` — every linked guest's `Headshot`. One download fan-out covers both.
5. For each slot, calls **Nano Banana** (`gemini-3-pro-image`) to generate one 16:9. **Build Image Requests** picks the prompt by layout: **solo** (Take — host close-up) or **duo** (Chat/Clip — host + all guests across the frame). Both share the same house style (orange/black/white, per-option colour variation, bold display font), the shared `Thumbnail Caption`, and the slot's vibe.
6. Creates 4 `Thumbnails` rows (`Status = Proposed`, linked to the Episode, with the mood, option number, caption) and uploads each image into the row's `16x9` attachment
7. Posts the 4 as a **Telegram album** to the group, captioned by mood, plus a short "set a row to Selected" instruction
8. Sets the Episode `Status = Awaiting Thumbnail Pick`

**Path 2 - Select** (fires when a `Thumbnails` row enters the `Selected` view):

8. Sets the episode's other thumbnail rows to `Status = Rejected`
9. **Unlinks the rejected rows from the Episode** — sets the Episode `Thumbnails` link to **only** the selected row (so the other options drop out of the episode's Thumbnails column), sets Episode `Status = Artwork Ready`, **moves the chosen row to `Status = Final`** (so it leaves the `Selected` view and keeps the poll trigger clean), and sends a Telegram confirmation
10. **Reversioning branch (Phase B), runs in parallel off the same trigger:** downloads the selected row's `16x9`, re-runs **Nano Banana** twice (1:1 and 9:16) with a "minimal changes, re-confirm the exact caption, cover the whole canvas, no letterbox" prompt, and uploads the results into the selected row's **`1x1`** and **`9x16`** attachment fields.

Selection is by setting a **`Thumbnails` row's `Status` to `Selected`**, not Telegram buttons: the `Pod21: Telegram Airtable Assistant` already owns the bot's only webhook, and Telegram allows one webhook per bot, so a second Telegram **Trigger** can't be added without breaking the Assistant. Sending messages from the same bot is fine; only triggers conflict.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `YyXiJ0lusoW7ynu9` |
| **Trigger 1** | Airtable poll on `Episodes` (`tbl3uYLIvtB9APZp6`), every minute, view `Approved` |
| **Trigger 2** | Airtable poll on **`Thumbnails`** table, every minute, view `Selected` — **needs the Thumbnails table ID pasted into the node** (see gotchas) |
| **Content types** | `Take` → solo host. `Chat` / `Clip` → host + all linked guests. `Roundtable` (and any other/unknown) → skipped to manual artwork. Read from the Episodes `Type` single-select. |
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
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Both triggers + every Airtable HTTP node (incl. `Fetch Guests`, `Mark Manual Artwork`; attach to HTTP nodes manually) | exists |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | The 4 Telegram send nodes (incl. `Notify Manual`; auto-assigned) | exists |
| `Gemini API Key [n8n]` | `httpHeaderAuth` | `Pick Moods (Gemini)` + `Generate Thumbnail (Nano Banana)` + `Generate Reversions (Nano Banana)` | **must be created** |

The Gemini credential is a generic **Header Auth** credential (when creating it in n8n, search "Header Auth" - NOT "Google Gemini (PaLM) Api"): header **Name** = `x-goog-api-key`, **Value** = your key from https://aistudio.google.com/apikey on a **billing-enabled** Google Cloud project (image gen is paid; the text call is free-tier). It powers both the mood-pick text call and the image calls.

> **AgentMail gotcha:** because `Gemini API Key [n8n]` did not exist when the workflow was built, n8n auto-filled the Header Auth slot on the two Gemini nodes with the only existing Header Auth credential (**AgentMail**). That is wrong and must be replaced - open `Pick Moods (Gemini)` and `Generate Thumbnail (Nano Banana)` and set the credential to `Gemini API Key [n8n]`.

All HTTP Request nodes are **skipped by credential auto-assignment** at build time (the rebuild references credentials by name in the SDK, but verify after any push). Open each and confirm: the Airtable ones (`Mark Generating`, `Mark Manual Artwork`, `Delete Old Thumbnails`, `Fetch Mood References`, `Fetch Guests`, `Create Thumbnail Row`, `Upload 16x9`, `Mark Awaiting Pick`, `Get Episode Thumbnails`, `Reject Siblings`, `Mark Episode Artwork Ready`, `Upload Reversion`) use **`Airtable [n8n] (PAT)`**; the image-download nodes (`Download Image`, `Download Selected 16x9`) use **no auth** (signed URLs); the three Gemini ones (`Pick Moods`, `Generate Thumbnail`, `Generate Reversions`) use **Header Auth** with the credential above.

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
| `Status` | Single select | `Proposed`, `Selected`, `Rejected`, **`Final`** (the chosen row is moved to `Final` after Path 2 runs) |
| `16x9` | Attachment | filled in Phase A |
| `1x1` / `9x16` | Attachment | **filled on select (Phase B)** — these two attachment fields must exist or the `Upload Reversion` calls 404 |
| `Last Modified Time` | Last Modified Time | **required** — the select trigger sorts on it. Must watch **all** fields. |

Views: **`Proposed`** (Status = Proposed) and **`Selected`** (Status = Selected). The select trigger is scoped to `Selected`.

### `Guests` table (for Chat/Clip)

| Field | Type | Notes |
|---|---|---|
| (primary) | — | guest name |
| `Headshot` | Attachment | the guest's face; first attachment is used. **No Headshot → that guest is skipped** |

Linked from Episodes via a **`Guests`** link field. The workflow GETs the whole `Guests` table once and filters to the episode's linked ids (so the table can be any size).

### `Episodes` table (additions only, stays lean)

- `Thumbnail Caption` — long text (manual for now; stage #7 auto-fills later)
- `Type` — single-select `Take` / `Chat` / `Roundtable` / `Clip` (shared with the metadata workflow). Drives the layout: `Take` → solo, `Chat`/`Clip` → host+guests, anything else → manual. Missing `Type` defaults to `Take`.
- `Guests` — link → `Guests` table (multiple). Read for `Chat`/`Clip`; all linked guests with a `Headshot` go in the frame.
- `Status` single-select: add `Awaiting Thumbnail Pick`, `Artwork Ready`, `Generating Artwork`, and `Awaiting Manual Artwork` (the last is set for Roundtable/unknown types; `typecast` auto-creates it on first use).
- The reverse-link field **`Thumbnails`** (auto-created by the `Episode` link on the Thumbnails table) must be named `Thumbnails` — both the clear-old and reject-siblings logic read `fields.Thumbnails` off the episode.
- View `Approved` (Status = Approved) for the generate trigger.

`Last Modified Time` (`fld3Z4xdI4s2wVnLa`, all fields) already exists from Phase 0.

> Both triggers leave the **Options → Fields** list **empty** on purpose (returns the whole record). Do not restrict it — that is the root cause of the recurring Airtable trigger failures, and a PostToolUse hook lints for it.

---

## Step-by-step

### Path 1 - Generate
**Approved Episode → Plan Generate → Auto-artable Type? →** *(true)* **Mark Generating → Delete Old Thumbnails → Fetch Mood References → Fetch Guests → Build Mood Prompt → Pick Moods (Gemini) → Resolve Vibes → Plan Downloads → Download Image → Image To Base64 → Build Image Requests → Generate Thumbnail (Nano Banana) → Extract Images → Create Thumbnail Row → Upload 16x9 → Collect Thumbnails → Send Thumbnail Options → Send Pick Instructions → Mark Awaiting Pick** ; *(false)* **Mark Manual Artwork → Notify Manual**

1. **Plan Generate** (Code) - reads the episode (`Title`, `Thumbnail Caption`, `Summary`, `Type`, `Guests` ids, and the `Thumbnails` reverse-link ids), derives `layout` (`solo` for Take, `duo` for Chat/Clip) and `autoArt` (true for Take/Chat/Clip), builds the `records[]=` delete query.
2. **Auto-artable Type?** (IF, boolean on `autoArt`) - true → generate; false → the manual branch below.
3. **Mark Generating** (HTTP PATCH) - sets Episode `Status = Generating Artwork` immediately, so the episode leaves the `Approved` view and a mid-run failure can't re-loop the trigger.
4. **Delete Old Thumbnails** (HTTP DELETE, `neverError`) - removes prior rows (empty query / 422 swallowed on first run).
5. **Fetch Mood References** (HTTP GET) - the whole `Thumbnail References` (host) library.
6. **Fetch Guests** (HTTP GET, `executeOnce`, `neverError`) - the `Guests` table **filtered server-side** to this episode's linked guests via `filterByFormula=OR(RECORD_ID()='…')` (built as `guestFilter` in `Plan Generate`; `FALSE()` when there are none). So its output is exactly the episode's guest(s), and there's no 100-row pagination risk.
7. **Build Mood Prompt** (Code) → **Pick Moods (Gemini)** (HTTP POST `gemini-2.5-flash`, JSON) → **Resolve Vibes** (Code) - picks 1-4 vibes and assigns one host reference photo per slot (cycles to fill 4).
8. **Plan Downloads** (Code, `executeOnce`) - emits one task per image: 4 `host` tasks (slot + photo url) then, for `duo`, one `guest` task per `Fetch Guests` record that has a `Headshot` (already filtered to this episode). Host tasks always come first so indices stay aligned downstream.
9. **Download Image** (HTTP GET file, runs N times) → **Image To Base64** (Extract From File → `dataB64`) - downloads + base64s every task in order (in-Code HTTP is unavailable on this runner).
10. **Build Image Requests** (Code) - the single place that holds both prompt templates. Zips `Plan Downloads` tasks with the base64 items by index, groups host-by-slot + collects guest parts, then for each of the 4 slots builds a request with the **`soloPrompt`** (host only) or **`duoPrompt`** (host + all guests) depending on `layout` (falls back to solo if a duo episode has no guest images). Same house style + per-option colour variation for both.
11. **Generate Thumbnail (Nano Banana)** (HTTP POST `gemini-3-pro-image`) - runs 4x, 120s timeout.
12. **Extract Images** (Code) - pulls base64 from `candidates[0].content.parts[].inline_data.data`, carries mood/option/episode through.
13. **Create Thumbnail Row** (HTTP POST Thumbnails, 4x) → **Upload 16x9** (HTTP POST content endpoint, 4x) - row then `16x9` upload, aligned by index.
14. **Collect Thumbnails** (Code) - gathers the uploaded image URLs. Throws a clear error if fewer than 2 succeeded (the Thumbnails rows still exist for a manual pick), then **pads `urls`/`moods` to 4** by repeating the last image so the static album never has an empty slot. → **Send Thumbnail Options** (Telegram `sendMediaGroup`, **4 static media slots** referencing `$json.urls[0..3]`) → **Send Pick Instructions** (Telegram) → **Mark Awaiting Pick** (PATCH Episode `Status = Awaiting Thumbnail Pick`).

**Manual branch (non Take/Chat/Clip):** **Mark Manual Artwork** (PATCH `Status = Awaiting Manual Artwork`, leaves the Approved view) → **Notify Manual** (Telegram: "type X, art this one manually").

### Path 2 - Select

`Resolve Selected` fans out into **two parallel branches** off the one trigger.

**Reject + status branch:**
**Thumbnail Selected → Resolve Selected → Get Episode Thumbnails → Compute Rejects → Reject Siblings → Mark Episode Artwork Ready → Confirm Thumbnail Set**

1. **Thumbnail Selected** - Airtable Trigger on the Thumbnails `Selected` view.
2. **Resolve Selected** (Code) - reads the selected row id, its `Episode` link id, the row's `Caption`, and the `16x9` attachment URL/type (the last two feed the reversioning branch).
3. **Get Episode Thumbnails** (HTTP GET) - fetches the episode to read its full `Thumbnails` id list + Title.
4. **Compute Rejects** (Code) - builds a batch PATCH body setting every other thumbnail row to `Rejected`; also carries `selectedRowId` through.
5. **Reject Siblings** (HTTP PATCH Thumbnails, `neverError`) - applies it (empty body is swallowed when there are no siblings).
6. **Mark Episode Artwork Ready** - PATCH Episode `Status = Artwork Ready` **and** `Thumbnails = [selectedRowId]`, which unlinks the rejected options from the episode (only the chosen row stays linked). Because Airtable links are bidirectional, the rejected rows' own `Episode` link also clears.
7. **Mark Selected Final** - PATCH the chosen `Thumbnails` row `Status = Final` (typecast). This moves it **out of the `Selected` view** so the poll trigger's view is empty between picks (see gotcha below). The reversioning branch still uploads to it by row id, so status doesn't matter there.
8. **Confirm Thumbnail Set** - Telegram confirmation.

**Reversioning branch (Phase B):**
**Resolve Selected → Download Selected 16x9 → Selected To Base64 → Build Reversion Requests → Generate Reversions (Nano Banana) → Extract Reversions → Upload Reversion**

8. **Download Selected 16x9** (HTTP GET, file) - fetches the chosen 16:9 from its Airtable attachment URL (no auth; signed URL).
9. **Selected To Base64** (Extract From File, `binaryToPropery → dataB64`) - in-Code HTTP is unavailable on this task runner, so the image is base64'd via a node.
10. **Build Reversion Requests** (Code) - emits **2 items** (1:1 and 9:16). Each prompt feeds the 16:9 inline + the exact `Caption` (re-confirmed verbatim, because Nano Banana otherwise garbles the text on reframes) + "minimal changes, cover the whole canvas, no letterbox, keep face + headline" + `imageConfig.aspectRatio`.
11. **Generate Reversions (Nano Banana)** (HTTP POST `gemini-3-pro-image`, runs 2x).
12. **Extract Reversions** (Code) - pulls base64 per item, carries the target field name (`1x1` / `9x16`) + selected row id.
13. **Upload Reversion** (HTTP POST content endpoint, 2x) - uploads each into the selected row's `1x1` / `9x16` field (field name is in the URL path).

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
- **Re-trigger safety.** Generate flips the Episode to `Awaiting Thumbnail Pick` at the end, so it leaves the `Approved` view. Select doesn't modify the selected row, so it doesn't re-fire; siblings move to `Rejected` and leave `Proposed`.
- **Polling trigger fires on the timestamp *advancing*, not on presence.** The `Thumbnail Selected` Airtable trigger only emits a row whose `Last Modified Time` is newer than the cursor it stored last poll; a row simply sitting in the `Selected` view (with an old, unchanging timestamp) never re-fires. So **the chosen row must leave the `Selected` view after processing**, or stale picks pile up and confuse which row is "newest." `Mark Selected Final` does this (`Status = Final`). Two consequences: (1) the `Selected` view should be **empty between picks** — if it isn't, an old pick can shadow a new one in "Fetch Test Event"; (2) **every `update_workflow` + publish restarts the poller and re-baselines its cursor to ~now**, so after any push, test with a *fresh* flip and give it ~60-90s. To force a clean reset, toggle the workflow Active off/on.
- **Phase B fields + credential.** The selected row must have `1x1` and `9x16` attachment fields, or `Upload Reversion` 404s. `Generate Reversions (Nano Banana)` uses the same `Gemini API Key [n8n]` Header Auth credential as the Phase A image node — verify it isn't pointing at AgentMail after a rebuild.
- **Unlink is permanent for rejects.** On select, the rejected rows are dropped from the Episode `Thumbnails` link, so a later Path 1 re-run won't find/clear them via `fields.Thumbnails` — they linger as orphaned `Rejected` rows in the Thumbnails table. Delete by hand if you care about hygiene.
- **Airtable Trigger `Fields`** left empty on purpose; if you ever restrict it, include `Last Modified Time` and use commas with no spaces (a hook lints this).
- **Content type + guests.** `Type` must be `Take`/`Chat`/`Clip` to auto-generate; `Roundtable` (and anything else/blank-unknown) is sent to manual with `Status = Awaiting Manual Artwork`. For `Chat`/`Clip`, link the people via the Episodes `Guests` field and give each `Guests` row a `Headshot` — a guest with no headshot is silently skipped, and a duo episode with **zero** usable guest images falls back to the solo prompt.
- **Index alignment.** `Build Image Requests` zips `Plan Downloads` tasks with the downloaded base64 items **by position**, relying on the HTTP node preserving item order (host slots 0-3 first, guests after). If you reorder `Plan Downloads`, keep hosts first.
- Workflow is **active**. Schema/credential setup must be in place before the next `Approved`/`Selected` fires.

---

## Limitations / future work

- **Reversioning is best-effort + parallel.** The 1:1/9:16 branch runs alongside the status branch, so the episode flips to `Artwork Ready` even if a reversion call fails. If `Upload Reversion` 404s, the most likely cause is the `1x1`/`9x16` attachment fields not existing on the Thumbnails table yet. Re-select the row (or re-trigger) after adding them; Nano Banana is paid, so each re-run costs ~2x image fees.
- **Aspect ratio is prompt + `imageConfig` only.** 1:1 / 9:16 are requested, not pixel-guaranteed. Crop downstream if a platform is strict.
- **Caption is manual** until stage #7 auto-writes `Thumbnail Caption`.
- **Roundtable not automated.** Group episodes are sent to manual artwork by design (2026-06-21). If a multi-person Roundtable layout is wanted later, add a third prompt template to `Build Image Requests` and let the `Roundtable` type through `Auto-artable Type?`.
- **Guest composition is prompt-only.** For Chat/Clip every guest headshot is passed inline and the prompt asks Nano Banana to balance the faces across the frame, but layout/likeness with several guests isn't guaranteed — review the 4 options before picking.
- **Host expression for duo** still comes from the vibe-tagged (Guy-only) reference library; the guest's expression is generated from the prompt, not a reference.

---

## Related

- **Upstream:** stage #7 AI metadata (planned) sets `Status = Approved` and will fill `Thumbnail Caption`.
- **Downstream:** stage #9 Publishing fan-out (`Status = Artwork Ready`).
- **Selection-architecture sibling:** `Pod21: Telegram Airtable Assistant` (`peTIs4kiluFZHoLg`) - owns the bot webhook; the reason selection is via Airtable status, not Telegram buttons.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflow #8)
