# BA - Frame.io: Episode uploaded → AI metadata → Telegram

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `jroXHciDvy0sWlRM`.)

This is **stages #5 + #6 + #7** of the Guy's Take build collapsed into one workflow: Frame.io edited-detection (#5), transcription (#6), and AI metadata (#7). Jonny asked for a single workflow triggered by the final cut landing in Frame.io.

SDK source: `scripts/deploy/workflows/guys-take-episode-metadata.sdk.js`.

---

## TL;DR

When an editor uploads the final cut to Frame.io and it finishes processing, Frame.io fires a `file.ready` webhook into n8n. The workflow grabs a lightweight proxy of that file, transcribes it with **Gemini** (with timecodes), then asks **OpenRouter** to write **5 viral thumbnail captions + 5 high-impact titles + a timecoded YouTube description**, and posts them to **Telegram** as a Markdown document. It also flips the matched Episode to `AI Analysis Complete` in Airtable.

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
| **Outputs** | 5 titles + 5 thumbnail captions + 1 timecoded description + 1 podcast summary + Podcasting 2.0 chapters JSON, delivered as a Markdown document |
| **Delivery** | Telegram `sendDocument` to the Guy's Take group (chat ID `-5254203539`, hardcoded). Caption shows episode title + episode ID (`<code>BA-hPtPmN</code>` — copyable), title options (T1–T5), and thumbnail caption options (TC1–TC5) with distinct pick instructions. Full description in attached file. |
| **Episode match** | Filename prefix `BA-{id}_...` (e.g. `BA-hPtPmN_Title.mp4`) → string match → Airtable `Episodes.{ID}` (string field) |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take), `Episodes` `tbl3uYLIvtB9APZp6` |
| **Status transition** | matched Episode → `AI Analysis Complete` + writes `Summary`, `Chapters` (human-readable `(HH:MM:SS) - Title` per line), `Transcript` (full verbatim text), `Frami.io URL` (see URL fallback order below), and attaches `<episodeId>_Chapters.json` (Podcasting 2.0 JSON) to the `Chapters JSON` attachment field (non-blocking; runs **before** Telegram) |
| **Active?** | **Yes** — live as of 2026-06-16; Frame.io OAuth2 credential configured |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Adobe OAuth` | `oAuth2Api` (Generic Credential Type → OAuth2 API → Adobe OAuth) | `Show File`, `Create Review Link` | created 2026-06-16; auto-assigns on push |
| `Gemini API Key [n8n]` | `httpHeaderAuth` (`x-goog-api-key`) | `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` | exists (created for Thumbnail Artwork) |
| `OpenRouter [n8n]` | `openRouterApi` | `Metadata Model (OpenRouter)` | exists (auto-assigned) |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Send Metadata to Telegram` | exists (auto-assigned) |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Find Episode`, `Set Status AI Analysis Complete` | exists (auto-assigned) |
| `Airtable PAT (Bearer)` | `httpBearerAuth` | `Upload Chapters Attachment` | **create once** — same PAT value as `Airtable [n8n] (PAT)` but as an HTTP Bearer credential type |

The **HTTP Request nodes are skipped by credential auto-assignment** at build time. You must open them and attach:
- `Show File` and `Create Review Link` → `Adobe OAuth` (auto-assigns on push from 2026-06-17 onward — no manual re-selection needed).
- `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` → `Gemini API Key [n8n]` (Header Auth).
- `Download Proxy` and `Upload Bytes to Gemini` → **no credential** (both URLs are pre-signed). Leave auth as None.
- `Upload Chapters Attachment` → `Airtable PAT (Bearer)` (create once: Settings → Credentials → New → HTTP Bearer Auth, paste your Airtable PAT as the token).

### Creating the Frame.io credential (Adobe IMS OAuth2)

This account is managed through the Adobe Admin Console, which **blocks legacy developer tokens**. Use Adobe IMS OAuth2 instead:

1. Go to `developer.adobe.com/console`, create a project, add the **Frame.io** API.
2. Under "Add credential" choose **OAuth Web App** (Server-to-Server is greyed out for Frame.io — it requires user-level auth).
3. Set Default Redirect URI to `https://vmi3181229.contaboserver.net/rest/oauth2-credential/callback` and Redirect URI Pattern to `https://vmi3181229\\.contaboserver\\.net/.*`.
4. Note the Client ID, Client Secret, and listed scopes.
5. In n8n, open the `Show File` node → Authentication → `OAuth2` → Create new credential (the generic **OAuth2 API** type only appears when creating from inside the node, not from the global credentials page).
   - Grant Type: `Authorization Code`
   - Authorization URL: `https://ims-na1.adobelogin.com/ims/authorize/v2`
   - Access Token URL: `https://ims-na1.adobelogin.com/ims/token/v3`
   - Client ID + Client Secret from Adobe
   - Scope: copy from Adobe Dev Console
6. Click **Connect** — a browser popup opens for one-time Adobe sign-in. After that, token refresh is automatic.

---

## Required Airtable schema

The match field already exists on `Episodes` (`tbl3uYLIvtB9APZp6`): it's the **`ID`** field (**string**, not a number). `Find Episode` runs `filterByFormula = {ID}="<episodeId>"`. `Status` already includes `AI Analysis Complete` from Phase 0.

**Five new fields required on the Episodes table:**
- `Summary` — **Long text** field. Receives a 2–3 sentence podcast-listing summary written by the AI.
- `Chapters` — **Long text** field. Receives human-readable chapter markers, one per line: `(00:00:00) - Chapter title` (seconds converted to `HH:MM:SS`).
- `Transcript` — **Long text** field. Receives the full verbatim transcript text (with `[MM:SS]` timecode markers) from Gemini.
- `Frami.io URL` — **URL** field. Receives the Frame.io shareable review link (no login required).
- `Chapters JSON` — **Attachment** field. Receives `<episodeId>_Chapters.json` (Podcasting 2.0 JSON format: `{"version":"1.2.0","chapters":[{"startTime":0,"title":"Intro"},...]}`), uploaded via the Airtable Content API as a base64 JSON body. Must be created as **Attachment** type, not Long text.

Add all five fields before the first real run, or `Set Status AI Analysis Complete` and `Upload Chapters Attachment` will skip the missing ones (both use `continueRegularOutput`).

**Filename convention:** name the Frame.io upload with a `BA-{id}` prefix followed by `_`, e.g. `BA-hPtPmN_TestSection.mp4`. The regex `/^(BA-[^_\s.]+)/i` extracts `BA-hPtPmN` (everything from the start of the name to the first `_`, space, or `.`) and matches it against the Airtable `ID` field. The episode IDs are opaque strings (not sequential numbers) to avoid ordering dependencies. If the filename has no `BA-` prefix (or no Episode row matches), the workflow still delivers the options to Telegram — it just skips the Airtable status flip (both Airtable nodes are `continueRegularOutput`).

---

## How it works (node by node)

**Frame.io Webhook → Parse Frame.io Event → Show File → Extract Episode Info → Create Review Link → Download Proxy → Start Gemini Upload → Capture Upload URL → Merge URL + Bytes → Upload Bytes to Gemini → Wait for Processing → Get File State → Is File Active → (Transcribe → Extract Transcript → Generate Metadata → Build Outputs → Find Episode → Set Status AI Analysis Complete → Upload Chapters Attachment → Prepare Telegram File → Convert Markdown to File → Send Metadata to Telegram)**

1. **Frame.io Webhook** — `POST` listener; responds `200` immediately (`responseMode: onReceived`) so Frame.io is happy, then the rest runs async.
2. **Parse Frame.io Event** (Code) — reads `body.resource.id` (file id) and `body.account.id`; drops anything without a file id (returns `[]` to stop the run).
3. **Show File** (HTTP, `Adobe OAuth`) — `GET …/accounts/{accountId}/files/{fileId}?include=media_links.efficient`; returns `name`, `media_type`, and `media_links.efficient.download_url`.
4. **Extract Episode Info** (Code) — pulls the filename, parses the episode `ID` into `episodeId`, picks the `efficient` (else `high_quality`/`original`) proxy `download_url`, the mime type, and any stable web URL from `web_url` / `player_url` / `links.web` / `links.player` / `links.download` (stored as `webUrl`, empty string if absent).
5. **Create Review Link** (HTTP, Frame.io OAuth2) — `POST /v4/accounts/{accountId}/review_links` with `{ name, asset_ids: [fileId] }`. Returns a shareable `short_url` (no login required) stored later in the Airtable `Frami.io URL` field. `onError: continueRegularOutput` so a failure doesn't block the rest.
6. **Download Proxy** (HTTP, no auth) — downloads the proxy as binary, `fullResponse` so the `content-length` header is available.
7. **Start Gemini Upload** (HTTP, Gemini header) — begins a Files API **resumable** session: headers `X-Goog-Upload-Protocol: resumable`, `…-Command: start`, `…-Header-Content-Length` from the download, `…-Header-Content-Type` from the mime. `fullResponse` exposes the `x-goog-upload-url` header.
8. **Capture Upload URL** (Set) — lifts `x-goog-upload-url` into a clean `uploadUrl` field (drops the rest to avoid a header collision at the merge).
9. **Merge URL + Bytes** (Merge, combine-by-position) — input 0 = the upload URL (json), input 1 = the Download Proxy item (binary). Both originate from the single Download Proxy item so they align 1:1.
10. **Upload Bytes to Gemini** (HTTP, no auth) — `POST` the binary to `uploadUrl` with `X-Goog-Upload-Command: upload, finalize`; returns the file resource (`uri`, `name`, `state`).
11. **Wait for Processing → Get File State → Is File Active** — polls the file until `state == ACTIVE`. `onFalse` loops back to the Wait (8s); `onTrue` proceeds. (Video files are `PROCESSING` for a few seconds after upload.)
12. **Transcribe with Gemini** (HTTP, Gemini header) — `generateContent` on `gemini-2.5-flash` with `fileData: { fileUri, mimeType }` + a verbatim-transcription prompt that asks for `[MM:SS]` markers and speaker labels. 10-minute timeout.
13. **Extract Transcript** (Set) — joins `candidates[0].content.parts[].text` into `transcript`.
14. **Generate Metadata** (chain LLM + OpenRouter + structured parser) — returns `{ titles[5], thumbnail_captions[5], description, summary, chapters[] }`, strictly grounded in the transcript; description chapter timecodes and the structured `chapters` array both derive from the transcript's `[MM:SS]` markers.
15. **Build Outputs** (Code) — renders a Markdown file (titles, captions, timecoded description, summary), base64-encodes it, builds the Telegram caption strings, converts `chapters` to human-readable `(HH:MM:SS) - Title` text (`chaptersText`), serialises Podcasting 2.0 JSON (`chaptersJson`) and base64-encodes it for the file attachment, reads the `short_url` from `Create Review Link` into `frameioUrl`, and reads the full `transcript` from `Extract Transcript`.
16. **Find Episode → Set Status AI Analysis Complete** — looks up the Episode by the `ID` field (`{ID}="<BA-xxxx string>"`) and writes `Status = AI Analysis Complete`, `Summary`, `Chapters` (human-readable format), `Transcript` (full verbatim text), `Frami.io URL`, and **`Chapters JSON: []`** (clears any existing attachment so re-runs don't accumulate duplicates). Runs **before** Telegram; all Airtable nodes are `continueRegularOutput`, so a missing/unmatched episode never blocks delivery.
17. **Upload Chapters Attachment** (HTTP Request, `Airtable PAT (Bearer)`) — `POST https://content.airtable.com/v0/{baseId}/{recordId}/Chapters%20JSON/uploadAttachment` with a **JSON** body `{ contentType: 'application/json', filename: <episodeId>_Chapters.json, file: <base64> }`. The base64 chapters JSON comes straight from `$('Build Outputs').first().json.chaptersJsonBase64` (built in step 15) — no binary conversion needed. Attaches the Podcasting 2.0 JSON to the `Chapters JSON` attachment field on the matched Episode row. `onError: continueRegularOutput` so a failure is silent. See the gotcha below for why the URL/body shape matters.
18. **Prepare Telegram File** (Set) — re-injects `mdBase64` and `fileName` from `$('Build Outputs').first()` into the flowing item. Necessary because HTTP Request nodes replace the flowing item entirely with their API response — so the markdown binary and base64 string from step 15 are gone by the time the chain reaches here. This Set node restores them so `Convert Markdown to File` has what it needs.
19. **Convert Markdown to File** → **Send Metadata to Telegram** — `sendDocument` with title options (T1–T5) and thumbnail caption options (TC1–TC5) in the caption, plus the episode ID in a `<code>` block so it's copyable when replying. Full timecoded description attached as `Metadata - <title>.md`.

---

## Gotchas / things to verify on first run

This workflow has several legs that **could not be tested at build time** (no live Frame.io event, no creds in hand, no sample media). Walk these on the first real upload:

- **Frame.io V4 wraps the file in a `data` key.** `Show File` returns `{ data: { id, name, media_links, ... } }` — not a flat object. `Extract Episode Info` unwraps this (`it.json.data`). This was confirmed live on 2026-06-16; earlier code read `it.json` directly and got an empty `downloadUrl`.
- **Register the webhook.** Activate the workflow, copy the `Frame.io Webhook` **Production URL**, and create a Frame.io webhook (Developer Console / API) pointing at it with events `['file.ready']`. Until then nothing fires.
- **Webhook payload shape.** `Parse Frame.io Event` assumes `body.resource.id` and `body.account.id`. Inspect the first real event in the n8n execution log and adjust the field paths if Frame.io nests them differently. The Code node fails closed (no file id → no run), so a wrong path means "nothing happens," not a crash.
- **Resumable upload `content-length`.** `Start Gemini Upload` reads `$json.headers['content-length']` from the proxy download. If n8n doesn't surface that header on a file response, the upload 4xxs — grab the size another way (e.g. a `HEAD` first) if so.
- **Merge → Upload binary handoff.** The binary must survive the Merge into `Upload Bytes to Gemini` (`inputDataFieldName: data`). If the upload sends an empty body, the binary isn't reaching the upload node — check that the Merge carries binary from input 1.
- **Poll loop.** `Is File Active` loops back through `Wait for Processing`. Confirm Gemini returns `state: ACTIVE` (not `PROCESSING`) before `Transcribe` runs; a too-early transcribe call errors with "file not in ACTIVE state."
- **HTTP node timeouts.** `Transcribe` is set to 600s and the two transfer nodes to 300s. An hour-long episode transcription can take a few minutes — raise further if you see timeouts on long episodes.
- **Proxy size / video vs audio cost (reviewed 2026-06-13, kept Gemini-on-video).** Gemini bills video at 263 tokens/sec vs audio at 32 (~8x), but episodes are short (~5-15 min), so it's pennies either run (~5-6¢ video vs ~2¢ audio). Audio-only was considered and rejected: Frame.io's API exposes no audio rendition and n8n can't transcode, so a manual audio export would break the auto-on-upload trigger. The real (small) cost is the 720p proxy flowing Frame.io → n8n → Gemini as bytes. If that ever strains the box, the clean swap is **Deepgram/AssemblyAI** (URL-based, audio extracted server-side, zero bytes through n8n) at steps 5-12. Video would only hit Gemini's 1M-token context ceiling past ~60 min, which these episodes never reach.
- **Airtable status flip requires `BA-{id}` prefix in filename.** The `episodeId` regex is `/^(BA-[^_\s.]+)/i` — it extracts the leading `BA-xxxx` segment (up to the first `_`, space, or `.`). Example: `BA-hPtPmN_TestSection.mp4` → `episodeId = "BA-hPtPmN"`, matched against the Airtable `ID` field (string). Files with no `BA-` prefix return `null` and the status update is silently skipped.
- **Create Review Link endpoint unverified.** `POST /v4/accounts/{accountId}/review_links` with `{ name, asset_ids: [fileId] }` is the expected V4 pattern, but the exact field name for the returned URL (`short_url` vs `url` vs `link`) has not been confirmed against a live response. `Build Outputs` tries all four fallbacks in order. If `Frami.io URL` lands blank in Airtable, open the `Create Review Link` execution in n8n to see the actual response shape, and update `buildOutputsCode` accordingly. The node uses `onError: continueRegularOutput` so a wrong endpoint silently skips the URL rather than failing the whole run.
- **Airtable runs before Telegram.** `Find Episode` → `Set Status` → `Upload Chapters Attachment` all run before `Send Metadata to Telegram`. This means the episode ID is confirmed in Airtable before the Telegram message arrives, so the caption's `<code>BA-hPtPmN</code>` is trustworthy. After `Upload Chapters Attachment`, `Prepare Telegram File` re-injects the markdown base64 from `Build Outputs` (HTTP Request nodes replace the flowing item, so it was lost) before `Convert Markdown to File` runs. Titles and thumbnail captions are delivered only via Telegram — they're pick-from-list options, not saved fields.
- **Frame.io URL — three-level fallback.** Both "Review Links" and "Presentations" are marked Legacy in Frame.io V4 and `POST /v4/accounts/{accountId}/review_links` returns 404. `Build Outputs` now picks `frameioUrl` in priority order: (1) `web_url` / `player_url` / `links.web` / `links.player` from the `Show File` response — a stable permanent link if Frame.io V4 includes it; (2) the `Create Review Link` short_url if that node ever succeeds; (3) `media_links.efficient.download_url` — a signed CDN URL, time-limited (hours to days) but functional for the immediate review window. Check `Extract Episode Info`'s output in a real execution to see which fields Frame.io V4 actually returns, then update the priority list accordingly. The V4 "Shares" API may provide a stable endpoint once confirmed.
- **`Airtable PAT (Bearer)` credential must be created manually.** `Upload Chapters Attachment` uses `httpBearerAuth` (not `airtableTokenApi`) because the Airtable Content API upload endpoint can't use the standard Airtable credential type in an HTTP Request node. Create a new **HTTP Bearer Auth** credential named `Airtable PAT (Bearer)` and paste the same PAT value used by `Airtable [n8n] (PAT)`.
- **Airtable Content API contract — the cause of every prior 404 (fixed 2026-06-17).** The documented endpoint ([docs](https://airtable.com/developers/web/api/upload-attachment)) is:
  - `POST https://content.airtable.com/v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment` — the **field reference comes BEFORE the `/uploadAttachment` segment**, not after. Every earlier attempt put it after (`…/uploadAttachment/{field}`), which is a route that doesn't exist → `404 NOT_FOUND`.
  - The body is **JSON**, not `multipart/form-data`: `{ "contentType": "application/json", "filename": "<name>.json", "file": "<base64 string>" }`. The file content is base64-encoded inline. This is why every multipart variation also failed.
  - The field reference is the URL-encoded display name `Chapters%20JSON`. (Field ID `fldXXXX` also works, but the name avoids a `schema.bases:read` scope dependency, so the meta-API lookup nodes were removed.)
  - Direct upload is capped at **5 MB**; chapters JSON is well under that.
  - Net: no binary conversion, no field-ID lookup, no multipart — just a JSON POST with the base64 built in `Build Outputs`.
- **Re-run support (same episode ID).** `Set Status AI Analysis Complete` now writes `Chapters JSON: []` to clear any previous attachment before the upload step runs. All other fields (Summary, Chapters, Transcript, Frami.io URL) are plain string overwrites that work cleanly on re-run without extra clearing. Re-uploading the same `BA-{id}` file to Frame.io will trigger a full re-analysis and overwrite the prior results.
- **`Chapters JSON` field must be Attachment type.** The upload endpoint writes to whatever field ref is in the URL. If the field doesn't exist or is the wrong type (Long text, URL, etc.), Airtable returns a 4xx and the node fails silently (continueRegularOutput).
- **`$env` is blocked** on this instance; the Telegram chat ID is hardcoded (`-5254203539`, the Guy's Take group). Don't use `{{ $env.X }}`.
- **Model tuning.** `openai/gpt-5.1` was chosen for title/caption quality; downgrade to a cheaper OpenRouter model in `Metadata Model (OpenRouter)` if cost matters more than flair.

---

## Related

- **Upstream:** the editor uploads the final cut to Frame.io (manual editing stays manual — no workflow). Replaces planned stages #5 Edited-detection and #6 Transcription.
- **Downstream:** stage #8 Artwork (`BA - Guy's Take Thumbnail Artwork`, `YyXiJ0lusoW7ynu9`) fires on `Status = Approved`. A human still moves the Episode from `AI Analysis Complete` → `Approved` after picking the title/caption.
- **Sibling AI stage:** `BA - Guy's Take Script Generation` (`q80QVMszf2iOfwIy`) — same OpenRouter + structured-output + Telegram-document delivery pattern.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflows #5/#6/#7)
