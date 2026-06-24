# BA - Frame.io Uploaded > AI Metadata

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `jroXHciDvy0sWlRM`.) Renamed 2026-06-21 from "BA - Frame.io: Episode uploaded → AI metadata → Telegram".

This is **stages #5 + #6 + #7** of the Guy's Take build collapsed into one workflow: Frame.io edited-detection (#5), transcription (#6), and AI metadata (#7). Jonny asked for a single workflow triggered by the final cut landing in Frame.io.

SDK source: `scripts/deploy/workflows/guys-take-episode-metadata.sdk.js`.

---

## TL;DR

When an editor uploads the final cut to Frame.io and it finishes processing, Frame.io fires a `file.ready` webhook into n8n. The workflow grabs a lightweight proxy of that file, transcribes it with **Gemini** (with timecodes), then asks **OpenRouter** to write **5 viral thumbnail captions + 5 high-impact titles + a timecoded YouTube description**, and posts them to **Telegram** as a Markdown document. It also flips the matched Episode to `AI Analysis Complete` in Airtable.

**`_Bypass` short-circuit (added 2026-06-23).** If the Frame.io file **name ends with `_Bypass`** (case-insensitive, extension ignored), the workflow skips the entire AI pipeline up front — no download, no transcription, no metadata, no Telegram — and only refreshes the episode's `Frame.io URL`, then stops. This is the manual override: drop `_Bypass` on the end of a re-upload's name (e.g. `BA-hPtPmN_Title_Bypass.mp4`) to just point Airtable at the new file. The check (`Name Ends _Bypass?`) sits right after `Find Episode`, before the proxy download, so a bypass costs nothing. See [Bypass detection](#bypass-detection) below.

**Same-length short-circuit (added 2026-06-21).** Right after the episode is matched in Airtable, a `Same Length?` IF compares the new upload's duration against the duration stored on the last full run. If they're **exactly equal**, the upload is assumed to be a bug-fix re-export (same cut, new file) — so the workflow **skips all the AI work** and only refreshes the `Frame.io URL` field, then stops. Any difference (or no stored baseline yet) falls through to the full transcript + metadata pipeline. See [Same-length detection](#same-length-detection) below.

**Why the architecture looks like this:** Frame.io has **no transcript API** (confirmed by Frame.io staff on their developer forum; still on the roadmap, no ETA as of 2026-02). There is no transcript-retrieval endpoint and no "transcript ready" webhook. So Frame.io is used only as the **trigger** and the **media source**, and an external engine (Gemini) does the actual transcription. OpenRouter's own speech-to-text was ruled out too: its `/audio/transcriptions` endpoint returns plain text with **no timecodes** and has a ~60s upstream timeout, so it can't handle an episode-length file or produce chapter markers.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `jroXHciDvy0sWlRM` |
| **Trigger** | n8n Webhook (`POST`, path `frameio-episode-uploaded`) — register the **Production URL** as a Frame.io webhook with events `['file.ready']` |
| **Media source** | Frame.io V4 Show File (`GET /v4/accounts/{account_id}/files/{file_id}?include=media_links.efficient`) → 720p proxy `download_url` |
| **Transcriber** | Gemini `gemini-2.5-flash` via the **Files API** (resumable upload → poll ACTIVE → `generateContent` with `fileData`) |
| **Metadata model** | `openai/gpt-5.1` via OpenRouter, `json_object`, `temperature 0.8`, structured output parser |
| **Outputs** | 5 titles + 5 thumbnail captions + 1 timecoded description + 1 first-person podcast summary (geared to the episode **Type** — Take/Chat/Roundtable/Clip) + Podcasting 2.0 chapters JSON, delivered as a Markdown document |
| **Delivery** | Telegram `sendDocument` to the Guy's Take group (chat ID `-5254203539`, hardcoded). Caption shows episode title + episode ID (`<code>BA-hPtPmN</code>` — copyable), title options (T1–T5), and thumbnail caption options (TC1–TC5) with distinct pick instructions. Full description in attached file. |
| **Episode match** | Filename prefix `BA-{id}_...` (e.g. `BA-hPtPmN_Title.mp4`) → string match → Airtable `Episodes.{ID}` (string field) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take), `Episodes` `tbl3uYLIvtB9APZp6` |
| **Status transition** | full run → matched Episode `AI Analysis Complete` + writes `Summary`, `Chapters`, `Transcript`, `Frame.io URL`, `Duration (s)`, and attaches `<episodeId>_Chapters.json`. Same-length re-upload **or** a name ending `_Bypass` → only `Frame.io URL` is refreshed; **no** status/AI change. |
| **Active?** | **Yes** — live; Frame.io OAuth2 credential configured |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Adobe OAuth` | `oAuth2Api` (Generic Credential Type → OAuth2 API → Adobe OAuth) | `Show File`, `Create Review Link` | created 2026-06-16; auto-assigns on push |
| `Gemini API Key [n8n]` | `httpHeaderAuth` (`x-goog-api-key`) | `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` | exists (created for Thumbnail Artwork) |
| `OpenRouter [n8n]` | `openRouterApi` | `Metadata Model (OpenRouter)` | exists (auto-assigned) |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Send Metadata to Telegram` | exists (auto-assigned) |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Find Episode`, `Set Status AI Analysis Complete`, `Swap Frame.io URL`, `Store Duration` | exists (auto-assigned) |
| `Airtable PAT (Bearer)` | `httpBearerAuth` | `Upload Chapters Attachment` | **create once** — same PAT value as `Airtable [n8n] (PAT)` but as an HTTP Bearer credential type |

The **HTTP Request nodes are skipped by credential auto-assignment** on every push (confirmed again on the 2026-06-21 push — the tool reported skipping Show File, Create Review Link, Download Proxy, Start Gemini Upload, Upload Bytes to Gemini, Get File State, Transcribe with Gemini, Upload Chapters Attachment). After each push, open them and verify/attach:
- `Show File` and `Create Review Link` → `Adobe OAuth` (usually re-attaches from the by-name reference, but verify it didn't drop to bearer).
- `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` → `Gemini API Key [n8n]` (Header Auth).
- `Download Proxy` and `Upload Bytes to Gemini` → **no credential** (both URLs are pre-signed). Leave auth as None.
- `Upload Chapters Attachment` → `Airtable PAT (Bearer)`.

The four Airtable **node** types (`airtableTokenApi`) — including the new `Swap Frame.io URL` and `Store Duration` — auto-assign cleanly on push.

### Creating the Frame.io credential (Adobe IMS OAuth2)

This account is managed through the Adobe Admin Console, which **blocks legacy developer tokens**. Use Adobe IMS OAuth2 instead:

1. Go to `developer.adobe.com/console`, create a project, add the **Frame.io** API.
2. Under "Add credential" choose **OAuth Web App** (Server-to-Server is greyed out for Frame.io — it requires user-level auth).
3. Set Default Redirect URI to `https://vmi3181229.contaboserver.net/rest/oauth2-credential/callback` and Redirect URI Pattern to `https://vmi3181229\\.contaboserver\\.net/.*`.
4. Note the Client ID, Client Secret, and listed scopes.
5. In n8n, open the `Show File` node → Authentication → `OAuth2` → Create new credential.
   - Grant Type: `Authorization Code`
   - Authorization URL: `https://ims-na1.adobelogin.com/ims/authorize/v2`
   - Access Token URL: `https://ims-na1.adobelogin.com/ims/token/v3`
   - Client ID + Client Secret from Adobe
   - Scope: copy from Adobe Dev Console
6. Click **Connect** — a browser popup opens for one-time Adobe sign-in. After that, token refresh is automatic.

---

## Required Airtable schema

The match field already exists on `Episodes` (`tbl3uYLIvtB9APZp6`): it's the **`ID`** field (**string**, not a number). `Find Episode` runs `filterByFormula = {ID}="<episodeId>"`. `Status` already includes `AI Analysis Complete` from Phase 0.

**Fields required on the Episodes table:**
- `Summary` — **Long text**. 2–3 sentence podcast-listing summary, written by the AI **in first person** as if by the host.
- `Chapters` — **Long text**. Human-readable chapter markers, one per line: `(00:00:00) - Chapter title` (seconds → `HH:MM:SS`).
- `Transcript` — **Long text**. Full verbatim transcript (with `[MM:SS]` markers) from Gemini.
- `Frame.io URL` — **URL**. The Frame.io shareable link. ⚠️ **Renamed 2026-06-21 from `Frami.io URL`** (the old name was a typo). The workflow now writes to `Frame.io URL`; if you still have a field called `Frami.io URL`, rename it (or the write 422s and the whole status update is dropped).
- `Chapters JSON` — **Attachment**. Receives `<episodeId>_Chapters.json` (Podcasting 2.0 JSON), uploaded via the Airtable Content API.
- `Duration (s)` — **Number** (integer seconds). ⚠️ **New, must be created.** Written on every full run (from the **Gemini** video duration, not Frame.io — see [Same-length detection](#same-length-detection)); read by `Same Length?` on the next upload to decide whether to skip the AI pipeline. Until this field exists, `Store Duration` fails silently (it's `continueRegularOutput`), so the same-length short-circuit simply never fires and every upload runs the full pipeline — no breakage, just no optimisation.
- `Type` — single-select (or text), values `Take` / `Chat` / `Roundtable` / `Clip`. **Read-only here** — the workflow never writes it; it's passed into the metadata prompt to gear the summary (see [Type-aware summary](#type-aware-summary)). Renamed from `Category` at some point; the prompt falls back to `Category` if `Type` is empty. If neither is set the summary is just a sensible general first-person one.
- `Guest` — **linked record** to the guests/people table. The workflow never writes it. n8n returns linked records as opaque record IDs (`rec…`), **not** names, so the prompt does NOT read `Guest` directly.
- `Guest Name` — ⚠️ **must be created: a Lookup field** on Episodes that pulls the guest's name from the linked `Guest` record (in Airtable: Lookup → linked field `Guest` → the guests table's name/primary field). Lookups return an array, which the prompt joins. This is the field the prompt actually reads for the guest's name. Until it exists, `GUEST` resolves to `Unknown` and Clip summaries fall back to "the guest" (no name) — still correctly third-person, just unnamed. A rollup with `ARRAYJOIN(values)` works too.

Add the fields before the first real run, or the nodes that write them skip the missing ones (all Airtable writes use `continueRegularOutput`). `Set Status AI Analysis Complete` writes everything **except** `Duration (s)` in one atomic update, so a missing `Duration (s)` can't break the metadata write — duration is deliberately stored in its own separate `Store Duration` node.

**Filename convention:** name the Frame.io upload with a `BA-{id}` prefix followed by `_`, e.g. `BA-hPtPmN_TestSection.mp4`. The regex `/^(BA-[^_\s.]+)/i` extracts `BA-hPtPmN` and matches it against the Airtable `ID` field. Files with no `BA-` prefix return `null` and the Airtable steps are skipped.

---

## Bypass detection

Goal: a manual override so Jonny can re-upload a cut and have the workflow **only** swap the Frame.io link, skipping all AI work — without relying on duration heuristics. The trigger is purely the **file name**.

- **`Name Ends _Bypass?`** (IF) sits immediately after `Find Episode`, on the `True` branch of `Is Video?`. It evaluates a single boolean condition:
  ```
  {{ /_bypass$/i.test(String($('Extract Episode Info').first().json.fileName || '').replace(/\.[a-zA-Z0-9]+$/, '').trim()) }}
  ```
  i.e. strip the file extension, trim, and test whether the name ends with `_bypass` (case-insensitive). So `BA-hPtPmN_Title_Bypass.mp4`, `..._bypass`, and `..._Bypass` (no extension) all match.
- **True → `Swap Frame.io URL`** (the same node the same-length path reuses): updates only `Frame.io URL` (value = `webUrl`, else review-link `short_url`, else proxy `downloadUrl`) and ends. No proxy download, no Gemini upload, no transcription, no OpenRouter, no Telegram, no status change.
- **False →** the normal pipeline (`Download Proxy → …`).

Because the check is before the download, a bypass is essentially free — unlike the same-length short-circuit, which can only decide after the Gemini upload (duration isn't known until then). `Swap Frame.io URL` has **two** incoming connections now (from `Name Ends _Bypass?` true and from `Same Length?` true); both feed the same node.

---

## Same-length detection

Goal: a bug-fix re-export of an already-analysed episode shouldn't re-suggest titles/captions/chapters — it should just point Airtable at the new Frame.io file. Detection is by **video duration**.

**Where duration comes from (and why not Frame.io):** Frame.io V4's file object exposes **no duration field at all** (confirmed on execution #778 — the `Show File` response had `id, name, status, file_size, media_type, media_links, view_url, …` but nothing for duration). So duration is read from **Gemini** instead: once the uploaded file is `ACTIVE`, the Files API returns `videoMetadata.videoDuration` (e.g. `"202s"`). This is reliable, but it's only available **after** the Gemini upload/processing — so the `Same Length?` check sits **after** `Is File Active`, not before the download.

Consequence: a same-length re-upload still does the Frame.io download + Gemini upload (cheap, no AI), but **skips the expensive parts** — transcription, OpenRouter metadata, chapters, Telegram. That fully honours "don't re-run the AI"; eliminating the download too would need a pre-upload duration source, which Frame.io doesn't provide.

Flow:
1. After `Is File Active` (true), **`Parse Duration`** (Set) reads `videoMetadata.videoDuration` from the ACTIVE `Get File State` output (`$json`, so it's the final poll's value), strips non-numeric chars, and rounds to whole seconds → `durationSeconds`. Missing/unparseable → `0`.
2. `Find Episode` ran earlier and exposes the stored `Duration (s)`.
3. `Same Length?` (IF, `typeValidation: loose`) is true only when **both**: `durationSeconds > 0` **AND** `durationSeconds == Duration (s)`. The `> 0` guard means a failed read (0) or a missing baseline can never accidentally skip the AI run.
   - **True** → `Swap Frame.io URL`: updates only `Frame.io URL` (value = `webUrl`, else review-link `short_url`, else proxy `downloadUrl`) and ends. No transcription, no OpenRouter, no Telegram, no status change.
   - **False** → the full pipeline, which finishes by writing all fields plus `Duration (s)` (via the separate `Store Duration` node), establishing/refreshing the baseline.

Rounding to whole seconds is intentional: frame-accurate re-exports of the same cut can differ by sub-second amounts, and rounding absorbs that so they still match. The trade-off is that a genuine re-edit landing on the exact same rounded second would be treated as "same length" and skip regeneration — acceptable given re-edits almost always change length by more than half a second.

> **History:** the first version read duration from Frame.io's `Show File` (it has none), so `durationSeconds` was always `0`, `Store Duration` wrote `0`, and the short-circuit never fired. Re-sourcing from Gemini (2026-06-22) fixed both. Any episode whose `Duration (s)` is `0` from that period self-heals on its next full run (0 ≠ the real Gemini duration → full pipeline → overwrites with the correct value).

---

## Type-aware summary

The episode's **`Type`** (Take / Chat / Roundtable / Clip) and the **`Guest Name`** lookup are fed into the metadata prompt so the AI frames the summary for the format. Because `Find Episode` already runs early, `Generate Metadata`'s prompt reads both directly:

```
EPISODE TYPE: {{ $('Find Episode').all().length ? ($('Find Episode').first().json.Type || $('Find Episode').first().json.Category || 'Unknown') : 'Unknown' }}
GUEST: {{ $('Find Episode').all().length && $('Find Episode').first().json['Guest Name'] ? (Array.isArray($('Find Episode').first().json['Guest Name']) ? $('Find Episode').first().json['Guest Name'].join(', ') : $('Find Episode').first().json['Guest Name']) : 'Unknown' }}
```

The `.all().length ? … : 'Unknown'` guards mean an unmatched upload (no Episode row) yields `Unknown` instead of throwing, so the AI path never breaks. `Guest Name` is an array (it's a lookup), so the expression joins it. The system prompt carries the definitions and the **voice** per type:

- **Take** — solo episode, host's own breakdown of a topic → **first person (host)**, his personal take/argument.
- **Chat** — longform conversation where the host sits down with the guest(s) → **first person (host)**, naming the guest ("I sit down with {GUEST}…").
- **Roundtable** — monthly rundown with the regular group → **first person (host)**, recap of the month's developments.
- **Clip** — short snippet from a longer episode (usually a Chat). **The speaker is the GUEST, not the host**, so the summary is written in the **third person, centred on the guest** ("In this clip, {GUEST} explains…"). This is the key fix: a Clip framed in the host's first person reads as if Guy is speaking when it's actually the guest. If `Guest Name` is missing, it falls back to "the guest" (still third-person, just unnamed).
- **Unknown / missing type** — sensible general first-person summary.

The type shapes the summary primarily, but type + guest are given to the model as general context so they can also subtly inform titles/captions.

> ⚠️ `Guest` is a **linked record** → n8n returns record IDs, not names. The prompt reads the **`Guest Name` lookup field** (see schema). Create that lookup, or Clips stay unnamed ("the guest").

---

## How it works (node by node)

**Frame.io Webhook → Parse Frame.io Event → Show File → Extract Episode Info → Is Video?**
- **Is Video? → False →** Notify Skipped (Non-Video) → *(end)*
- **Is Video? → True →** Create Review Link → Find Episode → Name Ends _Bypass?
  - **Name Ends _Bypass? → True →** Swap Frame.io URL → *(end)*
  - **Name Ends _Bypass? → False →** Download Proxy → Start Gemini Upload → Capture Upload URL → Merge URL + Bytes → Upload Bytes to Gemini → Wait for Processing → Get File State → Is File Active → Parse Duration → Same Length?
    - **Same Length? → True →** Swap Frame.io URL → *(end)*
    - **Same Length? → False →** Transcribe → Extract Transcript → Generate Metadata → Build Outputs → Set Status AI Analysis Complete → Store Duration → Upload Chapters Attachment → Prepare Telegram File → Convert Markdown to File → Send Metadata to Telegram

1. **Frame.io Webhook** — `POST` listener; responds `200` immediately (`responseMode: onReceived`), then runs async. Fires on **every** `file.ready` in the project (incl. audio/image shares).
2. **Parse Frame.io Event** (Code) — reads `body.resource.id` (file id) and `body.account.id`; drops anything without a file id.
3. **Show File** (HTTP, `Adobe OAuth`) — `GET …/files/{fileId}?include=media_links.efficient`; returns `name`, `media_type`, `media_links`, `view_url`. (No duration — that comes from Gemini later.)
4. **Extract Episode Info** (Code) — parses the filename into `episodeId`, picks the `efficient` (else `high_quality`/`original`) proxy `download_url`, the mime type, and a stable `webUrl` (`web_url` / `player_url` / **`view_url`** / links).
5. **Is Video?** (IF) — gate on `mimeType` starting `video/` **AND** `downloadUrl` starting `http`. Audio/image/other uploads have no `efficient` proxy (`download_url` null), so they fail both — those route to **Notify Skipped (Non-Video)** (Telegram `sendMessage` heads-up, which now prints the episode ID in a `<code>` block per the [include-record-ID rule](CONVENTIONS.md), `no-id` when the filename has no `BA-` prefix) and stop. Prevents the *"Invalid URL"* crash on Download Proxy (exec #787).
6. **Create Review Link** (HTTP, Frame.io OAuth2) — `POST /v4/accounts/{accountId}/review_links` → shareable `short_url`. `onError: continueRegularOutput`.
7. **Find Episode** (Airtable search) — moved **early** (was previously just before the status update). Looks up the Episode by `{ID}="<BA-xxxx>"` and exposes the stored `Duration (s)`, `Type`, and `Guest Name` for downstream use.
8. **Name Ends _Bypass?** (IF) — the manual-override gate (see [Bypass detection](#bypass-detection)). **True → Swap Frame.io URL** and ends; **False →** the pipeline below. Sits here, before the download, so a bypass costs nothing.
9. **Download Proxy → … → Is File Active** — downloads the proxy, runs the Gemini Files API resumable upload, polls until `state == ACTIVE` (`onFalse` loops back through the 8s Wait).
10. **Parse Duration** (Set) — reads the Gemini `videoMetadata.videoDuration` ("202s") from the ACTIVE state → integer `durationSeconds`. This is the only reliable duration source (Frame.io has none).
11. **Same Length?** (IF) — the short-circuit gate (see [Same-length detection](#same-length-detection)).
    - **True → Swap Frame.io URL** (Airtable update) — writes only `Frame.io URL` and ends.
    - **False →** the full pipeline below.
12. **Transcribe with Gemini** (HTTP, Gemini header) — `generateContent` on `gemini-2.5-flash` with `fileData` (`fps 0.2` + `MEDIA_RESOLUTION_LOW`) + a verbatim-transcription prompt asking for `[MM:SS]` markers and speaker labels. 10-minute timeout.
13. **Extract Transcript** (Set) — joins `candidates[0].content.parts[].text` into `transcript`.
14. **Generate Metadata** (chain LLM + OpenRouter + structured parser) — returns `{ titles[5], thumbnail_captions[5], description, summary, chapters[] }`, strictly grounded in the transcript. The summary voice is **geared to the episode `Type`** (Take/Chat/Roundtable/Clip) and `Guest Name`, both read from `Find Episode` (see [Type-aware summary](#type-aware-summary)): first person as the host for Take/Chat/Roundtable; **third person about the guest for Clip**.
15. **Build Outputs** (Code) — renders the Markdown deliverable, base64-encodes it, builds the Telegram caption strings, converts `chapters` to `(HH:MM:SS) - Title` text + Podcasting 2.0 JSON, and resolves `frameioUrl`.
16. **Set Status AI Analysis Complete** (Airtable update) — writes `Status = AI Analysis Complete`, `Summary`, `Chapters`, `Transcript`, `Frame.io URL`, and `Chapters JSON: []` (clears prior attachment). One atomic update; deliberately does **not** include `Duration (s)`.
17. **Store Duration** (Airtable update) — separate node, `continueRegularOutput`. Writes `Duration (s) = durationSeconds` (from `Parse Duration` / Gemini), establishing the baseline for next time. Isolated so a missing `Duration (s)` field can't fail the step 16 metadata write.
18. **Upload Chapters Attachment** (HTTP, `Airtable PAT (Bearer)`) — `POST …/v0/{baseId}/{recordId}/Chapters%20JSON/uploadAttachment` with a JSON body containing the base64 chapters JSON.
19. **Prepare Telegram File** (Set) — re-injects `mdBase64` + `fileName` (HTTP nodes replaced the flowing item).
20. **Convert Markdown to File → Send Metadata to Telegram** — `sendDocument` with T1–T5 / TC1–TC5 options in the caption and the full description attached.

---

## Gotchas / things to verify on first run

- **`Duration (s)` field must exist (Number).** Create it on the Episodes table. Until it does, `Store Duration` fails silently and the same-length short-circuit never fires — every upload runs the full pipeline. No breakage, just no optimisation.
- **`Frame.io URL` field rename.** Jonny renamed the Airtable column `Frami.io URL` → `Frame.io URL` on 2026-06-21; the workflow was updated to match. If any field is still named `Frami.io URL`, the status update 422s (Airtable rejects the **whole** record write on an unknown field name) and lands no metadata — rename the column to match.
- **Duration comes from Gemini, not Frame.io.** Frame.io's file object has no duration field (confirmed exec #778), so `Parse Duration` reads `videoMetadata.videoDuration` from the ACTIVE Gemini file. The original Frame.io-sourced version always produced `0` and silently broke the short-circuit. If `durationSeconds` is `0` now, check that the Gemini `Get File State` response actually carries `videoMetadata.videoDuration` (it appears only once the file is `ACTIVE`).
- **HTTP-node credentials are dropped on every push.** Re-verify them after each `update_workflow` (see [Required credentials](#required-credentials)). The Airtable-node creds (including the two new ones) auto-assign fine.
- **Re-activate + re-enable the MCP toggle if the push flipped them.** Confirm the workflow is still Active and `availableInMCP` is still on after pushing.
- **Frame.io V4 wraps the file in a `data` key.** `Show File` returns `{ data: {...} }`; `Extract Episode Info` unwraps it.
- **The webhook fires on EVERY upload to the project, not just episode cuts.** Audio shares (mp3), images, etc. all trigger `file.ready`. Non-video files have no `efficient` video proxy (`download_url: null`), which previously crashed `Download Proxy` with *"Invalid URL"* (exec #787). The **`Is Video?`** guard (mimeType starts `video/` AND downloadUrl starts `http`) now routes those to **`Notify Skipped (Non-Video)`** — a Telegram heads-up — and stops. If you'd rather transcribe audio too, that's a bigger change (Frame.io's audio download URL isn't the `efficient` rendition; needs investigating).
- **Register the webhook.** Activate, copy the `Frame.io Webhook` Production URL, create a Frame.io webhook pointing at it with events `['file.ready']`.
- **Resumable upload `content-length`.** `Start Gemini Upload` reads `$json.headers['content-length']` from the proxy download; if missing, fetch the size another way.
- **Poll loop.** `Is File Active` loops back through `Wait for Processing` until `state == ACTIVE`; a too-early transcribe errors with "file not in ACTIVE state."
- **HTTP node timeouts.** `Transcribe` is 600s, transfer nodes 300s. Raise for very long episodes.
- **Gemini 1M-token context ceiling on long episodes (fixed 2026-06-21).** Gemini tokenises **video** at ~290 tok/sec (1 fps of frames + audio at 32 tok/sec), so an episode past ~58 min overflows the 1,048,576-token input limit and `Transcribe with Gemini` fails with *"input token count exceeds the maximum… 1048576"*. A longform Chat hit this. Fix: the transcribe request now sends `videoMetadata: { fps: 0.2 }` (sample 1 frame / 5s) and `generationConfig.mediaResolution: 'MEDIA_RESOLUTION_LOW'`, which collapse the frame-token cost. Transcription only needs the **audio** (unaffected by fps/resolution), so quality is unchanged while the practical ceiling rises to ~6 hours. If an even longer episode ever overflows, lower `fps` further (e.g. 0.1) — audio stays the floor at 32 tok/sec (~9h ceiling). **OpenRouter is not a fix:** its video-capable chat models are mostly Gemini (same limit), and its Whisper `/audio/transcriptions` endpoint gives no usable timecodes and times out on episode-length files. The proper escape hatch for arbitrarily long media is a **dedicated STT API (Deepgram / AssemblyAI)** — URL-based, audio extracted server-side, word-level timestamps — which would replace steps 6–13 (Download → Transcribe) but needs a new credential and timestamp-to-`[MM:SS]` formatting.
- **Frame.io URL — `view_url` is the real field.** Exec #778 showed the stable link lives in the file object's **`view_url`** (`https://next.frame.io/project/.../view/...`); `web_url`/`player_url` were absent and `webUrl` came back blank before this was added. `frameioUrl` (and the same-length `Swap Frame.io URL` value) now picks, in order: `web_url` / `player_url` / **`view_url`** / `links.*`; then the `Create Review Link` `short_url`; then the signed `download_url` (time-limited). If `Frame.io URL` lands blank, check `Extract Episode Info`'s `webUrl` against the raw `Show File` response.
- **Airtable Content API contract** for `Upload Chapters Attachment`: `POST …/{recordId}/{fieldName}/uploadAttachment` (field **before** `/uploadAttachment`), JSON body `{ contentType, filename, file: <base64> }`, field ref URL-encoded (`Chapters%20JSON`), 5 MB cap.
- **`_Bypass` is matched on the file name, not the Airtable Title.** The check reads the **Frame.io upload's file name** (`Extract Episode Info.fileName`) with the extension stripped, so the marker must be in what you name the file in Frame.io (e.g. `BA-hPtPmN_Title_Bypass.mp4`), not the episode's Airtable Title. It still needs a valid `BA-{id}` prefix so `Find Episode` can resolve the record to point the URL at — a `_Bypass` file with no recognised ID just no-ops the URL swap. The match is case-insensitive (`_Bypass`/`_bypass` both work) and the marker must be at the very **end** of the name; `_Bypass` mid-name won't trigger it.
- **Re-run support (same episode ID).** `Set Status` writes `Chapters JSON: []` to clear the prior attachment before re-upload. A same-length re-upload (or a `_Bypass` name) now skips all of this and only swaps the URL.
- **Telegram sends retry on transient failures (added 2026-06-23).** Both Telegram nodes (`Send Metadata to Telegram`, `Notify Skipped (Non-Video)`) have **Retry On Fail** on (`maxTries: 4`, `waitBetweenTries: 5000ms`). This was added after exec #908 failed on `getaddrinfo EAI_AGAIN api.telegram.org` — a transient DNS blip on the n8n host (not a config error). All the Airtable writes run **before** the Telegram send, so even when the send fails the episode is fully analysed in Airtable; only the pick-options notification is lost. The retry now rides out brief DNS/network hiccups. If `api.telegram.org` is unresolvable for >~20s the run still ultimately errors — re-run the execution (the metadata's already saved, so only the message re-sends; note a full re-run re-transcribes unless the `_Bypass`/same-length short-circuit applies).
- **`$env` is blocked** on this instance; the Telegram chat ID is hardcoded (`-5254203539`).
- **Model tuning.** `openai/gpt-5.1` chosen for title/caption quality; downgrade in `Metadata Model (OpenRouter)` if cost matters more.

---

## Related

- **Upstream:** the editor uploads the final cut to Frame.io (manual editing stays manual). Replaces planned stages #5 Edited-detection and #6 Transcription.
- **Downstream:** stage #8 Artwork (`BA - Guy's Take Thumbnail Artwork`, `YyXiJ0lusoW7ynu9`) fires on `Status = Approved`. A human still moves the Episode from `AI Analysis Complete` → `Approved` after picking the title/caption.
- **Sibling AI stage:** `BA - Guy's Take Script Generation` (`q80QVMszf2iOfwIy`) — same OpenRouter + structured-output + Telegram-document delivery pattern.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflows #5/#6/#7)
