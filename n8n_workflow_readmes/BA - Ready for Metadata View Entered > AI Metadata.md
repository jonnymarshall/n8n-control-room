# BA - Ready for Metadata View Entered > AI Metadata

> **2026-11-13 - the 2 GB guard upstream now measures the proxy, not the master, so big cuts reach this workflow.** No node, prompt or credential changed here. What changed is who can arrive: `BA - Frame.io Uploaded > Episode Marked` used to refuse any upload whose original file was over 2 GB, even when Frame.io had a small proxy. This workflow's own behaviour is unchanged, and it still downloads the `efficient` proxy.

> **2026-11-12 - Telegram messages restyled to `TELEGRAM-STYLE.md` (LIVE, published).** The packaging message now leads with 🟡 (it asks for a reply) instead of 🎬, and the metadata caption, same-cut, skipped and Audionauts notices use the house shape. Wording and structure only: no trigger, logic, credential or output change. Audit with `scripts/query/telegram-style-audit.sh`.

> **Find this workflow in n8n by name.** Workflow IDs change when a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `jroXHciDvy0sWlRM`.) Renamed 2026-10-29 from `BA - Frame.io Uploaded > AI Metadata`, when the Frame.io webhook half moved out to its own workflow.

This is **stages #6 + #7** of the Guy's Take build: transcription (#6) and AI metadata (#7). It is triggered by an episode entering the **`Ready for Metadata` view**, not by Frame.io.

The Frame.io webhook, the filename checks and the `Frame.io URL` write now live in **`BA - Frame.io Uploaded > Episode Marked`** (`5ZMcCY8WPQ3bFji6`), which stamps the row and stops. Read that readme for `_Skip`, `_Bypass`, the 2 GB guard and the status gate.

SDK source: `scripts/deploy/workflows/guys-take-metadata-from-view.sdk.js`.

---

## What changed 2026-10-29 (why this workflow looks different)

**Trigger.** Frame.io's `file.ready` webhook no longer starts this workflow. It marks the episode, and Airtable state starts the work. Frame.io had re-delivered an event for a file that had not changed in nineteen hours (execution 9678), which re-ran the whole pipeline. A webhook cannot be made idempotent by hope; Airtable `Status` can.

**Status ladder.** `Ready for Metadata` → this workflow flips the row to `Generating Metadata` before doing anything, so a crash cannot re-loop the trigger → `AI Analysis Complete`. The upstream workflow only sets `Ready for Metadata` when the episode is at `Recorded` or `Edited`.

**The fields bug.** `Find Episode` returns Airtable records as `{ id, createdTime, fields: {...} }`, and this workflow used to read fields from the top level (`json['Duration (s)']`, `json.Type`, `json.Title`). Every one of those reads returned `undefined`, which silently broke four things: the same-length check never matched, `Is Audionauts?` never fired, the Type-aware summary always saw `Unknown`, and the packaging message could never show what was already set. All reads now go through `.fields` (or `fields || json` in code nodes).

**Visual ideas removed.** The eight `iconography_ideas` are no longer generated, no longer in the Telegram message and no longer in the Markdown file. Nothing consumed them.

**Debug footer.** Every Telegram message ends with `⚙️ <workflow id> · exec <execution id>`.

⚠️ **Never hand-queue a published episode.** `Ready for Metadata` is also the manual retry lever, but setting it on an episode that has already been approved or published re-runs the whole pipeline and rewrites `Summary`, `Transcript` and `Chapters`, and knocks `Status` back to `AI Analysis Complete`. The Fountain publisher's approved-fingerprint check would then see the description as stale. Queue only pre-approval episodes; for a genuine re-cut on a published episode, handle it deliberately (the content-sync path) rather than by re-queuing metadata.

---

## TL;DR

An episode enters the **`Ready for Metadata` view** (set by `BA - Frame.io Uploaded > Episode Marked` once a cut lands in Frame.io). This workflow immediately flips it to `Generating Metadata`, grabs a lightweight proxy of the file named in `Frame.io URL`, transcribes it with **Gemini** (with timecodes), then asks **OpenRouter** to write **5 viral thumbnail captions + 5 high-impact titles + a timecoded YouTube description and summary**, and posts them to **Telegram** as a Markdown document followed by a **packaging request message**. It finishes by flipping the Episode to `AI Analysis Complete`.

**Audionauts exception (added 2026-09-09, live but awaiting its first real upload).** After transcript validation, `Is Audionauts?` checks the episode `Type`. Audionauts take an early exit: `Save Audionauts Transcript` writes only `Status = AI Analysis Complete`, `Transcript`, `Frame.io URL`, and `Duration (s)`, then `Notify Audionauts Complete` sends one short Telegram message with the episode ID. They do not call OpenRouter, create titles, captions, summaries or chapters, upload a metadata document, or send the artwork-packaging request. Isolated routing tests passed for `Audionauts`, lowercase `audionauts`, and `Chat`; the next real Audionauts Frame.io upload must confirm the full path.

**Read episodes (2026-10-22, expanded 2026-10-28).** Reads now run the normal metadata path; nothing branches on the type. Two Read-specific changes: the summary voice is defined (`Read` = first person as host, introducing the book and what it argues, naming the book or author only if the transcript states it), and the packaging message is a **short Read-only template**: it asks for **1 · Title**, **2 · Thumbnail caption**, **3 · Facial expression** (the live mood library, optional, default `Neutral`) and **4 · Book cover**, then says artwork waits for the cover. No guests, no visual ideas and no image prompt. That means Reads have no `Custom Image Prompt`. Artwork for a Read is gated on its **`Book Cover`**. Note the view does **not** require `Custom Image Prompt` for any type (corrected 2026-10-23). A Read with no expression uses the `Neutral` reference photo. The message is built as `packagingText` in `Build Outputs`; `Send Packaging Request` just sends that field.

**Packaging request (updated 2026-09-14; visual ideas removed 2026-10-29).** Delivery is **two Telegram messages**, not one. The description file goes out with a deliberately short caption, then **`Send Packaging Request`** posts the message Jonny actually replies to. For every type except `Read` it carries the title options, caption options, the packaging values already set on the episode, the mood library to pick from, and an optional art-direction ask. `Read` gets the shorter template (title, caption, facial expression, book cover). Free-text art direction still shapes thumbnail generation, but nothing waits for it. Every message ends with the workflow id and execution id.

⚠️ **Artwork does not wait for `Custom Image Prompt` (corrected 2026-10-23).** The thumbnail workflow's view does not require it; the field is optional art direction.

**`_Bypass`, `_Skip` and the 2 GB guard moved out (2026-10-29).** All three are now handled in **`BA - Frame.io Uploaded > Episode Marked`**, before a row is ever queued, so this workflow never sees them. That is deliberate: a bypass must not be able to write a link that then makes the row look queueable.

**Same-length short-circuit (added 2026-06-21, fixed 2026-10-29).** `Same Length?` compares the upload's duration against `Duration (s)` on the row. If they are **exactly equal**, the upload is assumed to be a bug-fix re-export, so no AI runs: `Skip to Analysed` puts the row straight back to `AI Analysis Complete` and `Notify Same Cut` says so. Any difference, or no stored baseline, falls through to the full pipeline. The check had never actually matched, because it read `Duration (s)` from outside the Airtable `fields` wrapper. See [Same-length detection](#same-length-detection).

**Transcript validation false failures (fixed 2026-09-24, published `76844865`).** Two episodes (BA-5GM2XJ, BA-C8Uwej) failed at `Validate Transcript Quality` even though Gemini had transcribed them fully. Two bugs in the checker: (1) its timecode pattern required `[00:00]` with no spaces, but Gemini sometimes emits `[ 00:00 ]` (spaces inside the brackets) — the 86-minute BA-C8Uwej transcript had 196 such timecodes and the checker counted zero, reporting "0% coverage"; (2) the 80%-coverage rule failed a complete 6-minute transcript whose last marker sat at 4:46 of 6:02 (79%). The checker now tolerates spaces inside the brackets and passes when the final timecode is within 120s of the runtime **or** covers ≥80%. The transcriber was never at fault.

**Long-episode Gemini degeneration, fixed with chunking (2026-10-06).** On a 2h20m roundtable (BA-7gPQTH) Gemini transcribed only the first ~30 minutes, then collapsed into a repetition loop (one 8-word phrase repeated 462 times across ~220k characters) and was cut off at the model's output-token ceiling. That is a genuine transcriber failure, not a checker false positive, and it is exactly what `Validate Transcript Quality` exists to catch (Airtable was left untouched). The single whole-file call is now split: `Build Chunks` emits one 20-minute window per item, `Transcribe with Gemini` runs once per window (with `videoMetadata.startOffset`/`endOffset`, `temperature: 0` and `maxOutputTokens: 16384`), and `Stitch Transcript` shifts each window's relative `[MM:SS]` markers into absolute episode time and joins them. Short videos and audio keep the single-call path (one whole-file window). See steps 11b to 13 and the long-episode gotcha below. Verified end-to-end on BA-7gPQTH the same day (execution 4511): 8 windows, all `STOP`, the stitched transcript covers 100% of the 2h20m runtime (135,835 chars, 246 timecodes) and ends on the real outro.

**Why the architecture looks like this:** Frame.io has **no transcript API** (confirmed by Frame.io staff on their developer forum; still on the roadmap, no ETA as of 2026-02). There is no transcript-retrieval endpoint and no "transcript ready" webhook. So Frame.io is used only as the **trigger** and the **media source**, and an external engine (Gemini) does the actual transcription. OpenRouter's own speech-to-text (`/audio/transcriptions`) was re-checked on 2026-09-24: it now offers segment and word timestamps via `response_format: verbose_json`, but still caps each request at a ~60s upstream provider timeout (and 25 MB for multipart), so it cannot take an episode-length file in one call without an audio-splitting step this repo does not have. Gemini therefore remains the transcriber.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `jroXHciDvy0sWlRM` |
| **Trigger** | Airtable poll (every minute) on the Episodes view `Ready for Metadata` (`viwNSD7pdOs2sKTgR`), filtered to `Status = Ready for Metadata`. The Frame.io webhook lives in `BA - Frame.io Uploaded > Episode Marked` |
| **Media source** | Frame.io V4 Show File (`GET /v4/accounts/{account_id}/files/{file_id}?include=media_links.efficient,media_links.original,media_links.high_quality`) → the `efficient` proxy's `download_url`, else `high_quality`, else `original` (a 640x360 proxy for the 2026-11-13 `BA-HRwIMb` cut; audio has no video proxy and falls back to `original`) |
| **Transcriber** | Gemini `gemini-2.5-flash` via the **Files API** (resumable upload → poll ACTIVE → `generateContent` with `fileData`). Long video is transcribed in 20-minute windows (`Build Chunks` → per-window `Transcribe with Gemini` → `Stitch Transcript`) |
| **Metadata model** | `openai/gpt-5.1` via OpenRouter, `json_object`, `temperature 0.8`, structured output parser |
| **Outputs** | Standard types: 5 titles + 5 thumbnail captions + 1 timecoded description + 1 first-person podcast summary (geared to the episode **Type** — Take/Chat/Roundtable/Clip/Read) + Podcasting 2.0 chapters JSON, delivered as a Markdown document. (Visual-idea generation was removed 2026-10-29.) Audionauts: transcript, Frame.io URL and duration only. |
| **Delivery** | Standard types: **two** Telegram messages to the Guy's Take group (chat ID `-5254203539`, hardcoded), the Markdown file then **`Send Packaging Request`**. Audionauts: one short transcription-complete message; no metadata file or packaging request. |
| **Episode match** | Not its job any more: the row *is* the trigger. The Frame.io file id is parsed from the last path segment of the row's `Frame.io URL` (`Resolve Frame.io File`); the account id is hardcoded. |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take), `Episodes` `tbl3uYLIvtB9APZp6` |
| **Status transition** | On entry: `Ready for Metadata` → `Generating Metadata` (written first, so a crash cannot re-loop the trigger). Full run → `AI Analysis Complete` + `Summary`, `Chapters`, `Transcript`, `Frame.io URL`, `Duration (s)`, `<episodeId>_Chapters.json`. Audionauts → `AI Analysis Complete` + only `Transcript`, `Frame.io URL`, `Duration (s)`. Same-length re-upload → `AI Analysis Complete`, nothing regenerated. |
| **Active?** | **Yes** — live; Frame.io OAuth2 credential configured |
| **Size guard** | Moved upstream 2026-10-29: `File Over 2 GB?` lives in `BA - Frame.io Uploaded > Episode Marked`, so an oversized cut is never queued. Since 2026-11-13 it compares the size of the rendition this workflow would download, not the master. A row queued by hand with a genuinely oversized file still wastes a download. |
| **Transient-failure cover** | `Show File`, `Download Proxy`, `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` retry 5× / 5s (~20s of cover) against Gemini 503s + DNS blips. `Fetch Mood Library` retries 3× / 5s. Telegram nodes retry. See [gotchas](#gotchas--things-to-verify-on-first-run). |

---

## Required credentials

| n8n credential name | Type | Used by | Status |
|---|---|---|---|
| `Adobe OAuth` | `oAuth2Api` (Generic Credential Type → OAuth2 API → Adobe OAuth) | `Show File` | created 2026-06-16; auto-assigns on push |
| `google-ai-studio_[pod21-n8n-temp]` | `httpHeaderAuth` (`x-goog-api-key`) | `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` | live credential |
| `OpenRouter [n8n]` | `openRouterApi` | `Metadata Model (OpenRouter)` | exists (auto-assigned) |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | `Send Metadata to Telegram`, **`Send Packaging Request`**, `Notify Skipped (Non-Media)`, `Notify Audionauts Complete` | exists (auto-assigned) |
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | `Ready for Metadata View` (trigger), `Set Generating Metadata`, `Skip to Analysed`, `Set Status AI Analysis Complete`, `Store Duration`, `Save Audionauts Transcript` (Airtable **nodes**, auto-assign) + **`Fetch Mood Library`** (HTTP node — **rebind by hand after every push**) | exists |
| `Airtable PAT` | `httpBearerAuth` | `Upload Chapters Attachment` | live credential; same PAT as `Airtable [n8n] (PAT)` but as an HTTP Bearer credential type |

The **HTTP Request nodes are skipped by credential auto-assignment** on every push. After each push, open them and verify/attach:
- `Show File` → `Adobe OAuth` (usually re-attaches from the by-name reference, but verify it didn't drop to bearer).
- `Start Gemini Upload`, `Get File State`, `Transcribe with Gemini` → `google-ai-studio_[pod21-n8n-temp]` (Header Auth).
- `Download Proxy` and `Upload Bytes to Gemini` → **no credential** (both URLs are pre-signed). Leave auth as None.
- `Upload Chapters Attachment` → `Airtable PAT`.
- **`Fetch Mood Library` → `Airtable [n8n] (PAT)`** (predefined credential type `airtableTokenApi`). New 2026-08-04. It's `neverError`, so a missing credential does **not** fail the run — the mood list just comes back empty and the packaging message says the library is empty. Check this first if the moods vanish from the message.

The Airtable **node** types (`airtableTokenApi`) — the trigger plus the five update nodes — auto-assign cleanly on push.

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

The trigger is the Episodes view **`Ready for Metadata`** (`viwNSD7pdOs2sKTgR`), whose only condition is `Status = Ready for Metadata`. Two Status options were added 2026-10-29: **`Ready for Metadata`** (queued) and **`Generating Metadata`** (in flight, out of the view). `AI Analysis Complete` already existed.

**Fields required on the Episodes table:**
- `Summary` — **Long text**. 2–3 sentence podcast-listing summary, written by the AI **in first person** as if by the host.
- `Chapters` — **Long text**. Human-readable chapter markers, one per line: `(00:00:00) - Chapter title` (seconds → `HH:MM:SS`).
- `Transcript` — **Long text**. Full verbatim transcript (with `[MM:SS]` markers) from Gemini.
- `Frame.io URL` — **URL**. The Frame.io shareable link. ⚠️ **Renamed 2026-06-21 from `Frami.io URL`** (the old name was a typo). The workflow now writes to `Frame.io URL`; if you still have a field called `Frami.io URL`, rename it (or the write 422s and the whole status update is dropped).
- `Chapters JSON` — **Attachment**. Receives `<episodeId>_Chapters.json` (Podcasting 2.0 JSON), uploaded via the Airtable Content API.
- `Duration (s)` — **Number** (integer seconds). ⚠️ **New, must be created.** Written on every full run (from the **Gemini** video duration, not Frame.io — see [Same-length detection](#same-length-detection)); read by `Same Length?` on the next upload to decide whether to skip the AI pipeline. Until this field exists, `Store Duration` fails silently (it's `continueRegularOutput`), so the same-length short-circuit simply never fires and every upload runs the full pipeline — no breakage, just no optimisation.
- `Type` — single-select (or text), values `Take` / `Chat` / `Roundtable` / `Clip`. **Read-only here** — the workflow never writes it; it's passed into the metadata prompt to gear the summary (see [Type-aware summary](#type-aware-summary)). Renamed from `Category` at some point; the prompt falls back to `Category` if `Type` is empty. If neither is set the summary is just a sensible general first-person one.
- `Guests` — **linked record** (multiple) to the `Guests` table. The workflow never writes it; the Telegram assistant does, when Jonny names a guest in reply to the packaging message. n8n returns linked records as opaque record IDs (`rec…`), **not** names, so nothing reads `Guests` directly for display — that's what `Guest Name` is for. ⚠️ *Corrected 2026-08-04: this doc previously called the field `Guest` (singular). There is only one guest link field on Episodes and it is `Guests`, the same field the thumbnail workflow reads.*
- `Custom Image Prompt` — **Long text**. ⚠️ **New (2026-08-04), must be created.** Jonny's free-text art direction for the episode's thumbnail, given in reply to the packaging message. The workflow never writes it — the Telegram assistant does. **Not a view gate** (corrected 2026-10-23). An empty field just means no extra art direction. Replying `default` (or `none`) is also read as "no extra direction".
- `Thumbnail Moods` — **Long text**, exists (`fldujYetql7QhEWkR`). ⚠️ **Jonny first created this as `Moods`; renamed to `Thumbnail Moods` on 2026-08-11** so the field, this message, the assistant's instructions, the System Map and the docs all use one name at last. While they disagreed, the artwork workflow looked up a field that did not exist and silently discarded every mood pick — see the thumbnail workflow's readme. Comma-separated mood names Jonny picked from the list the packaging message showed him, e.g. `confident, shocked`. Read by the thumbnail workflow's `Resolve Vibes`, matched against `Thumbnail References` by name (case-insensitive) and cycled across the 4 options in the order given. **Empty or all-mistyped now uses `Neutral` for all four (2026-10-22)**; the whole library is only used if the `Neutral` row has no photo, so it never breaks a run. **On a `Read` this field is the facial expression (2026-10-28)**; empty still means `Neutral`.
- `Guest Name` — a **Lookup field** on Episodes that pulls each guest's name from the linked `Guests` records (in Airtable: Lookup → linked field `Guests` → the Guests table's name/primary field). Lookups return an array, which the prompt joins. This is the field both the metadata prompt and the packaging message read for guest names. Until it exists, `GUEST` resolves to `Unknown` and Clip summaries fall back to "the guest" (no name) — still correctly third-person, just unnamed. A rollup with `ARRAYJOIN(values)` works too.

Add the fields before the first real run, or the nodes that write them skip the missing ones (all Airtable writes use `continueRegularOutput`). `Set Status AI Analysis Complete` writes everything **except** `Duration (s)` in one atomic update, so a missing `Duration (s)` can't break the metadata write — duration is deliberately stored in its own separate `Store Duration` node.

**Filename convention:** name the Frame.io upload with a `BA-{id}` prefix followed by `_`, e.g. `BA-hPtPmN_TestSection.mp4`. The regex `/^(BA-[^_\s.]+)/i` extracts `BA-hPtPmN` and matches it against the Airtable `ID` field. Files with no `BA-` prefix return `null` and the Airtable steps are skipped.

---

## Bypass and skip detection

Both moved to **`BA - Frame.io Uploaded > Episode Marked`** on 2026-10-29 and never reach this workflow:

- `_Skip` in the filename: nothing happens at all. No link, no status, no message.
- `_Bypass` in the filename: the link is refreshed and the row is **not** queued, so it cannot start analysis.

See that workflow's readme for the expressions.

---

## Same-length detection

Goal: a bug-fix re-export of an already-analysed episode shouldn't re-suggest titles/captions/chapters — it should just point Airtable at the new Frame.io file. Detection is by **video duration**.

**Where duration comes from (and why not Frame.io):** Frame.io V4's file object exposes **no duration field at all** (confirmed on execution #778 — the `Show File` response had `id, name, status, file_size, media_type, media_links, view_url, …` but nothing for duration). So duration is read from **Gemini** instead: once the uploaded file is `ACTIVE`, the Files API returns `videoMetadata.videoDuration` (e.g. `"202s"`). This is reliable, but it's only available **after** the Gemini upload/processing — so the `Same Length?` check sits **after** `Is File Active`, not before the download.

Consequence: a same-length re-upload still does the Frame.io download + Gemini upload (cheap, no AI), but **skips the expensive parts** — transcription, OpenRouter metadata, chapters, Telegram. That fully honours "don't re-run the AI"; eliminating the download too would need a pre-upload duration source, which Frame.io doesn't provide.

Flow:
1. After `Is File Active` (true), **`Parse Duration`** (Set) reads `videoMetadata.videoDuration` from the ACTIVE `Get File State` output (`$json`, so it's the final poll's value), strips non-numeric chars, and rounds to whole seconds → `durationSeconds`. Missing/unparseable → `0`.
2. The trigger row carries the stored `Duration (s)`, read as `$('Ready for Metadata View').first().json.fields['Duration (s)']`.
3. `Same Length?` (IF, `typeValidation: loose`) is true only when **both**: `durationSeconds > 0` **AND** `durationSeconds == Duration (s)`. The `> 0` guard means a failed read (0) or a missing baseline can never accidentally skip the AI run.
   - **True** → `Skip to Analysed` sets `Status = AI Analysis Complete` (the metadata already on the record is still valid; the link was refreshed upstream) and `Notify Same Cut` says so. No transcription, no OpenRouter, no document.
   - **False** → the full pipeline, which finishes by writing all fields plus `Duration (s)` (via the separate `Store Duration` node), establishing/refreshing the baseline.

Rounding to whole seconds is intentional: frame-accurate re-exports of the same cut can differ by sub-second amounts, and rounding absorbs that so they still match. The trade-off is that a genuine re-edit landing on the exact same rounded second would be treated as "same length" and skip regeneration — acceptable given re-edits almost always change length by more than half a second.

> **History:** the first version read duration from Frame.io's `Show File` (it has none), so `durationSeconds` was always `0`, `Store Duration` wrote `0`, and the short-circuit never fired. Re-sourcing from Gemini (2026-06-22) fixed both. Any episode whose `Duration (s)` is `0` from that period self-heals on its next full run (0 ≠ the real Gemini duration → full pipeline → overwrites with the correct value).

---

## Type-aware summary

The episode's **`Type`** (Take / Chat / Roundtable / Clip / Read) and the **`Guest Name`** lookup are fed into the metadata prompt so the AI frames the summary for the format. The trigger row supplies both, from inside the Airtable `fields` wrapper:

```
EPISODE TYPE: {{ $('Ready for Metadata View').first().json.fields?.Type || $('Ready for Metadata View').first().json.fields?.Category || 'Unknown' }}
GUEST: {{ $('Ready for Metadata View').first().json.fields?.['Guest Name'] ? (Array.isArray($('Ready for Metadata View').first().json.fields['Guest Name']) ? $('Ready for Metadata View').first().json.fields['Guest Name'].join(', ') : $('Ready for Metadata View').first().json.fields['Guest Name']) : 'Unknown' }}
```

No empty-row guard is needed any more: the trigger row always exists. `Guest Name` is an array (it's a lookup), so the expression joins it. **Before 2026-10-29 these expressions read `json.Type` / `json['Guest Name']` from outside the wrapper, so the prompt always said `Unknown` and every type got the generic first-person voice.** The system prompt carries the definitions and the **voice** per type:

- **Take** — solo episode, host's own breakdown of a topic → **first person (host)**, his personal take/argument.
- **Chat** — longform conversation where the host sits down with the guest(s) → **first person (host)**, naming the guest ("I sit down with {GUEST}…").
- **Roundtable** — monthly rundown with the regular group → **first person (host)**, recap of the month's developments.
- **Clip** — short snippet from a longer episode (usually a Chat). **The speaker is the GUEST, not the host**, so the summary is written in the **third person, centred on the guest** ("In this clip, {GUEST} explains…"). This is the key fix: a Clip framed in the host's first person reads as if Guy is speaking when it's actually the guest. If `Guest Name` is missing, it falls back to "the guest" (still third-person, just unnamed).
- **Unknown / missing type** — sensible general first-person summary.
- **Read** — first person as the host, introducing the book he is reading and what it argues. Name the book or author only if the transcript states it.

The type shapes the summary primarily, but type + guest are given to the model as general context so they can also subtly inform titles/captions.

> ⚠️ `Guests` is a **linked record** field → n8n returns record IDs, not names. The prompt reads the **`Guest Name` lookup field** (see schema). Without that lookup, Clips stay unnamed ("the guest").

---

## Packaging request message

> Added 2026-08-04. This replaced the single long document caption, because a `sendDocument` caption is capped at **1024 characters** and the option set no longer fit. A `sendMessage` allows **4096**.

`Send Packaging Request` is the message Jonny replies to. That matters architecturally: the **Telegram Airtable Assistant** treats the *replied-to* message as its specification, so everything needed to act on a reply has to be in this one message. Splitting the options across the file caption and a follow-up would break that — a reply to the follow-up wouldn't tell the assistant what "T3" meant.

It shows six things. The editable choices are labelled with the Airtable field they land in (`1 · Title → Title`, `6 · Image prompt → Custom Image Prompt`, and so on) so the assistant reads its target from the message rather than inferring it. Visual ideas are optional text-only inspiration and do not write to Airtable:

**Overwrite warning (added 2026-09-09).** If any of the five packaging fields already contain data, the message starts with a red warning and lists the current values. Long values are shortened to 120 characters in Telegram so the warning cannot consume the message limit; Airtable data is not changed. The approval still overwrites only fields explicitly included in the reply. This protects `Title`, `Thumbnail Caption`, `Guests`, `Thumbnail Moods`, and `Custom Image Prompt`. It cannot protect `Transcript`, `Summary`, or `Chapters`, because the Frame.io workflow writes those before this message exists.

| # | Ask | Airtable field | Notes |
|---|---|---|---|
| 1 | Title | `Title` | Options labelled `T1`–`T5`. The message first shows the title **already set** (or "not set yet"), so Jonny can see whether he's replacing something. Saying nothing leaves it alone. |
| 2 | Thumbnail caption | `Thumbnail Caption` | Options labelled `TC1`–`TC5`. |
| 3 | Guests | `Guests` | Shows the guests **already linked** (via the `Guest Name` lookup), or "none linked yet". The assistant links existing `Guests` rows only and reports names it can't find rather than creating half-empty records. |
| 4 | Thumbnail moods | `Thumbnail Moods` | The mood list is read **live** from `Thumbnail References` by the `Fetch Mood Library` node and numbered. Jonny replies with names, e.g. "moods: confident, shocked". **For `Read` episodes the message becomes a four-ask template** (2026-10-28): title, caption, **facial expression** (this same mood list, optional, default Neutral) and the book cover. Guests, visual ideas and image prompt are omitted. |
| 5 | Visual ideas | None | Eight short object, scene, or metaphor suggestions based on the transcript. Use one or combine several in the image prompt. They never change Airtable on their own. |
| 6 | Image prompt | `Custom Image Prompt` | **Optional.** Artwork runs without it. `default` means "no extra direction". |

Option labels are the reply codes themselves (`T1.`, `TC1.`) rather than bare numbers, so a reply maps back to an option unambiguously even if the assistant sees both lists at once.

**HTML escaping.** The message is sent `parse_mode: HTML`, so `Build Outputs` emits pre-escaped `titlesTextHtml` / `capsTextHtml` / `episodeTitleHtml` / `guestsText` / `currentTitleText` / `moodsText` (only `& < >` need it). The raw `titlesText` / `capsText` are still emitted and still used for the Markdown **file**, which must stay unescaped. An LLM-written title containing `&` previously went out raw.

**`Fetch Mood Library`** (HTTP GET `Thumbnail References`) sits between `Extract Transcript` and `Generate Metadata` — on the full-run path only, so a `_Bypass` or same-length re-upload never pays for it. It is `neverError` + `continueRegularOutput` + retry 3×/5s: a missing or renamed table degrades the mood list to `(none — the Thumbnail References table is empty)` rather than sinking an otherwise good metadata run. Its output item is irrelevant to `Generate Metadata`, which builds its prompt entirely from expressions.

---

## How it works (node by node)

**Ready for Metadata View → Resolve Frame.io File → Set Generating Metadata → Show File → Extract Episode Info → Is Video or Audio?**
- **Is Video or Audio? → False →** Notify Skipped (Non-Media) → *(end)*
- **Is Video or Audio? → True →** Download Proxy → Start Gemini Upload → Capture Upload URL → Merge URL + Bytes → Upload Bytes to Gemini → Wait for Processing → Get File State → Is File Active → Parse Duration → Same Length?
    - **Same Length? → True →** Skip to Analysed (`Status = AI Analysis Complete`) → Notify Same Cut → *(end)*
    - **Same Length? → False →** Build Chunks → Transcribe → Stitch Transcript → Extract Transcript → **Validate Transcript Quality** → **Is Audionauts?**
      - **Is Audionauts? → True →** Save Audionauts Transcript → Notify Audionauts Complete → *(end)*
      - **Is Audionauts? → False →** Fetch Mood Library → Generate Metadata → Build Outputs → Set Status AI Analysis Complete → Store Duration → Upload Chapters Attachment → Prepare Telegram File → Convert Markdown to File → Send Metadata to Telegram → **Send Packaging Request**

1. **Ready for Metadata View** (Airtable Trigger, every minute) — rows in the `Ready for Metadata` view. The trigger row is the source of truth for `Status`, `Title`, `Type`, `Guests`, `Duration (s)` and `Frame.io URL`, all under `.fields`.
2. **Resolve Frame.io File** (Code) — parses the file id out of the stored `Frame.io URL` (last path segment) and supplies the hardcoded account id. Throws a named error if the URL has no usable id, before the status is flipped.
3. **Set Generating Metadata** (Airtable update) — the flip. Deliberately has no error handling: if it fails, the run must stop rather than proceed and re-fire on the next poll.
4. **Show File** (HTTP, `Adobe OAuth`) — `GET …/files/{fileId}?include=media_links.efficient,media_links.original`; returns `name`, `media_type`, `media_links`, `view_url`. (No duration — that comes from Gemini later.) *(Updated 2026-06-28: added `media_links.original` so audio files can fall back to the original-file URL when the efficient proxy `download_url` is `null`.)*
5. **Extract Episode Info** (Code) — parses the filename into `episodeId`, picks the first rendition with a non-null `download_url` across `[efficient, high_quality, original]` (using `.find()` — **not** `||` which was fooled by `{download_url: null}` for audio files), the byte size as `fileSize` (from `data.file_size`, `0` if absent), the mime type, and a stable `webUrl` (`web_url` / `player_url` / **`view_url`** / links).
5. **Is Video or Audio?** (IF) — gate on `mimeType` matching regex `^(video|audio)/` **AND** `downloadUrl` starting `http`. Images, PDFs, and other non-media uploads have no `efficient` proxy (`download_url` null), so they fail the URL check and route to **Notify Skipped (Non-Media)** (Telegram `sendMessage` heads-up, which prints the episode ID in a `<code>` block per the [include-record-ID rule](CONVENTIONS.md), `no-id` when the filename has no `BA-` prefix) and stop. Both video (`video/mp4`) and audio (`audio/mp3`, `audio/m4a`, etc.) pass. Prevents the *"Invalid URL"* crash on Download Proxy (exec #787). *(Updated 2026-06-25 from `startsWith 'video/'` to regex `^(video|audio)/` so audio uploads are also transcribed.)*
9b. **File Over 2 GB?** (IF) — the Gemini size guard added 2026-10-22, now upstream in `BA - Frame.io Uploaded > Episode Marked`. True (the copy that would be sent is over 2,147,483,648 bytes) → **Notify Too Large** (Telegram, episode ID in a `<code>` block) and stop, before the download. False → Download Proxy. Sits after `_Bypass`, so the URL-only refresh still works on a huge file. Since 2026-11-13 it measures the rendition that would be downloaded rather than the master's `file_size`; see [the 2 GB gotcha](#gotchas--things-to-verify-on-first-run).
6. **Is Video or Audio?** (IF) — kept as a safety net for a hand-queued row. Non-media gets the same Telegram heads-up and stops.
7. **Download Proxy → … → Is File Active** — downloads the proxy, runs the Gemini Files API resumable upload, polls until `state == ACTIVE` (`onFalse` loops back through the 8s Wait).
10. **Parse Duration** (Set) — reads the Gemini `videoMetadata.videoDuration` ("202s") from the ACTIVE state → integer `durationSeconds`. This is the only reliable duration source (Frame.io has none).
11. **Same Length?** (IF) — the short-circuit gate (see [Same-length detection](#same-length-detection)).
    - **True → Skip to Analysed** (Airtable update) — sets `Status = AI Analysis Complete`, then `Notify Same Cut`, and ends. The Frame.io link was already refreshed upstream.
    - **False →** the full pipeline below.
11b. **Build Chunks** (Code, added 2026-10-06): for video longer than 20 minutes, emits one item per 20-minute window (`{ index, startSeconds, endSeconds, whole, total }`); for shorter video, audio, or any media with no duration, emits a single whole-file window (`whole: true`). A 2h20m episode becomes 8 windows.
12. **Transcribe with Gemini** (HTTP, Gemini header): runs **once per window** (n8n processes one request per input item). `generateContent` on `gemini-2.5-flash` with `fileData` (`fps 0.2` + `MEDIA_RESOLUTION_LOW`), plus `videoMetadata.startOffset`/`endOffset` for windows (omitted for the whole-file window), `temperature: 0` and `maxOutputTokens: 16384`. The verbatim prompt asks for `[MM:SS]` markers and speaker labels, measured from the start of the segment. 10-minute timeout per window, **Retry On Fail 5x / 5s** (Gemini 503s, added 2026-07-29).
12b. **Stitch Transcript** (Code, added 2026-10-06): collects the per-window responses, shifts each window's relative `[MM:SS]` markers by the window's `startSeconds` into absolute episode time (re-formatting to `[H:MM:SS]` past an hour), and joins the windows in order into one `transcript`.
13. **Extract Transcript** (Set): passes the stitched `transcript` through (the node every downstream reference still points at).
14. **Validate Transcript Quality** (Code) — stops before Airtable is changed if the transcript is under 200 characters, implausibly short for the media duration, never reaches the end of the media according to its final timecode, or repeats one word 20 or more times in a row. Timecodes are matched with or without padding spaces (`[00:00]` and `[ 00:00 ]` both count — Gemini emits both). "Reaches the end" means the final timecode is within 120s of the runtime **or** covers at least 80% of it, so a transcript whose last marker lands a minute before the end is not failed. Audio skips the timecode check because Gemini provides no audio duration here. The thrown error includes the `BA-xxxx` ID and the exact failed checks, so the global error workflow can alert the team. *(Fixed 2026-09-24 — see the note at the top.)*
15. **Is Audionauts?** (IF, case-insensitive) — reads `Type` from the trigger row's `fields`. True exits through the transcript-only path below; false continues into the existing metadata and packaging path.
16. **Save Audionauts Transcript → Notify Audionauts Complete** — Audionauts only. One Airtable update writes `Status = AI Analysis Complete`, `Transcript`, `Frame.io URL`, and `Duration (s)`, preserving any existing summary or chapter fields. Telegram then confirms completion with the episode ID in a `<code>` block. No OpenRouter, chapters, metadata document, or packaging message runs.
17. **Generate Metadata** (chain LLM + OpenRouter + structured parser) — non-Audionauts only. Returns `{ titles[5], thumbnail_captions[5], description, summary, chapters[] }`, strictly grounded in the transcript. (Visual-idea generation was removed 2026-10-29.) The summary voice is **geared to the episode `Type`** (Take/Chat/Roundtable/Clip/Read) and `Guest Name`, both read from the trigger row (see [Type-aware summary](#type-aware-summary)): first person as the host for Take/Chat/Roundtable/Read; **third person about the guest for Clip**.
18. **Build Outputs** (Code) — renders the Markdown deliverable, base64-encodes it, builds the Telegram caption strings plus the optional visual-ideas list, converts `chapters` to `(HH:MM:SS) - Title` text + Podcasting 2.0 JSON, and resolves `frameioUrl`.
19. **Set Status AI Analysis Complete** (Airtable update) — writes `Status = AI Analysis Complete`, `Summary`, `Chapters`, `Transcript`, `Frame.io URL`, and `Chapters JSON: []` (clears prior attachment). One atomic update; deliberately does **not** include `Duration (s)`.
20. **Store Duration** (Airtable update) — separate node, `continueRegularOutput`. Writes `Duration (s) = durationSeconds` (from `Parse Duration` / Gemini), establishing the baseline for next time. Isolated so a missing `Duration (s)` field can't fail the step 19 metadata write.
21. **Upload Chapters Attachment** (HTTP, `Airtable PAT`) — `POST …/v0/{baseId}/{recordId}/Chapters%20JSON/uploadAttachment` with a JSON body containing the base64 chapters JSON.
22. **Prepare Telegram File** (Set) — re-injects `mdBase64` + `fileName` (HTTP nodes replaced the flowing item).
23. **Convert Markdown to File → Send Metadata to Telegram** — `sendDocument`, full description attached, **short** caption (title + episode ID only).
24. **Send Packaging Request** (Telegram `sendMessage`, HTML) — the reply target. It sends `{{ $('Build Outputs').first().json.packagingText }}` verbatim; the whole message is composed in that Code node because `Read` needs a different, shorter template. Non-Read: T1–T5, TC1–TC5, guests already linked, the mood library and an optional art-direction line. Read: T1–T5, TC1–TC5, the facial-expression list (optional, default Neutral) and the book-cover ask. Every message ends with the workflow id and execution id. See [Packaging request message](#packaging-request-message).

---

## Gotchas / things to verify on first run

- **`Custom Image Prompt` and `Thumbnail Moods` should exist on Episodes (both Long text). The prompt is optional and is not a view gate.** Until `Custom Image Prompt` exists, the assistant's write of it 422s (Airtable rejects the **whole** record write on an unknown field name), which would silently drop the title and caption in the same PATCH. Until the **view** gates on it, artwork fires as soon as the caption lands and your art direction is ignored — see the thumbnail workflow's readme for the exact view condition.
- **Two Telegram messages now, and the second one is the reply target.** Replying to the *document* no longer works properly: its caption only carries the title and episode ID, so the assistant can't resolve "T3" from it. Reply to the **`Send Packaging Request`** message underneath. If the document send succeeds but the packaging send fails (transient DNS/Telegram blip — it retries 4×/5s), all the Airtable writes have already happened; re-running the execution re-sends both messages but also re-transcribes unless the `_Bypass` / same-length short-circuit applies.
- **Audionauts deliberately do not receive either standard Telegram message.** They branch immediately after transcript validation, before `Fetch Mood Library` and `Generate Metadata`, and receive only `Notify Audionauts Complete`. The route logic and node configurations are verified, but the first real Audionauts upload after 2026-09-09 still needs checking in executions and Telegram.
- **`Duration (s)` field must exist (Number).** Create it on the Episodes table. Until it does, `Store Duration` fails silently and the same-length short-circuit never fires — every upload runs the full pipeline. No breakage, just no optimisation.
- **`Frame.io URL` field rename.** Jonny renamed the Airtable column `Frami.io URL` → `Frame.io URL` on 2026-06-21; the workflow was updated to match. If any field is still named `Frami.io URL`, the status update 422s (Airtable rejects the **whole** record write on an unknown field name) and lands no metadata — rename the column to match.
- **Duration comes from Gemini, not Frame.io.** Frame.io's file object has no duration field (confirmed exec #778), so `Parse Duration` reads `videoMetadata.videoDuration` from the ACTIVE Gemini file. The original Frame.io-sourced version always produced `0` and silently broke the short-circuit. If `durationSeconds` is `0` now, check that the Gemini `Get File State` response actually carries `videoMetadata.videoDuration` (it appears only once the file is `ACTIVE`).
- **HTTP-node credentials are dropped on every push.** Re-verify them after each `update_workflow` (see [Required credentials](#required-credentials)). The Airtable-node creds (including the two new ones) auto-assign fine.
- **Re-activate + re-enable the MCP toggle if the push flipped them.** Confirm the workflow is still Active and `availableInMCP` is still on after pushing.
- **Frame.io V4 wraps the file in a `data` key.** `Show File` returns `{ data: {...} }`; `Extract Episode Info` unwraps it.
- **The webhook fires on EVERY upload to the project, not just episode cuts.** Audio files (mp3, m4a, etc.), images, PDFs, etc. all trigger `file.ready`. Images/PDFs/other non-media have no proxy (`download_url: null`), which previously crashed `Download Proxy` with *"Invalid URL"* (exec #787). The **`Is Video or Audio?`** guard (mimeType matches `^(video|audio)/` AND downloadUrl starts `http`) routes non-media to **`Notify Skipped (Non-Media)`** — a Telegram heads-up — and stops. **Audio uploads now run the full transcription pipeline** (updated 2026-06-25 from `startsWith 'video/'`). Note: for audio files, `durationSeconds` will be `0` (Gemini returns no `videoMetadata.videoDuration` for audio), so the same-length short-circuit never triggers on audio — every audio upload always runs the full pipeline.
- **Audio download URL comes from `media_links.original`, not `efficient` (fixed 2026-06-28).** Frame.io returns `media_links.efficient.download_url: null` for audio files — they have no video proxy. Two fixes were needed: (1) `Show File` now requests `?include=media_links.efficient,media_links.original` so `original` is available; (2) `Extract Episode Info` now uses `.find()` over `[efficient, high_quality, original]` to pick the first rendition with a non-null `download_url`, replacing the old `||` chain which stopped at `efficient` even when its URL was `null` — making `downloadUrl` always empty for audio, which caused `Is Video or Audio?` to route the file to Skipped (exec failed in first audio test). If `media_links.original.download_url` is also null for a given audio file, the file will still route to Skipped — in that case Frame.io may need a different API call to get the source URL.
- **Register the webhook.** Activate, copy the `Frame.io Webhook` Production URL, create a Frame.io webhook pointing at it with events `['file.ready']`.
- **Gemini's File API rejects any file over 2 GB, and Frame.io sometimes has no small proxy (exec 7994, 2026-10-22).** `Show File` returned `media_links.efficient.download_url: null` for a 3.61 GB H.264 master, so `Extract Episode Info` fell through to `media_links.original` and pulled all 3.61 GB (154s), then Google answered the upload with HTTP 400 *"Media is too large. Limit: 2147483648"*. Nothing was written: the episode stayed at `Recorded` with no transcript or metadata. `File Over 2 GB?` now catches that before the download and sends one Telegram alert instead. **What to do when it fires:** re-upload a smaller copy (1080p, or audio only) with the same `BA-{id}` name, which runs the full pipeline because no `Duration (s)` baseline exists yet. **What not to do:** enabling billing on the Google project may raise the File API cap (docs say 2 GB free / 20 GB paid), but it was left alone on purpose; uploading multi-gigabyte masters per episode is slow and wasteful regardless. The real fix is to stop sending video to Gemini at all (extract audio, or use a URL-based speech-to-text service) and it is parked as a follow-up.
  - **Corrected 2026-11-13 (exec 21060).** The guard was comparing the master's `file_size`, so it fired even when Frame.io *did* have a small proxy: a 4.63 GB cut with an 891 MB 1080p and a 232 MB 360p proxy was refused, and the alert wrongly said there was no proxy. It now compares the size of the rendition this workflow would actually download (`efficient`, else `high_quality`, else `original`), measured by `Probe Renditions`, and falls back to the master only when nothing could be measured. So an alert now means the copy that would be sent really is over 2 GB.
- **`Create Review Link` was deleted 2026-10-29.** It had 404'd on every run since V4 (the route no longer exists). Deleting it was the right fix rather than repointing it at the shares endpoint: a share link ends in a share id, and everything downstream parses the last path segment of `Frame.io URL` as a **file** id.
- **Resumable upload `content-length`.** `Start Gemini Upload` reads `$json.headers['content-length']` from the proxy download; if missing, fetch the size another way.
- **Poll loop.** `Is File Active` loops back through `Wait for Processing` until `state == ACTIVE`; a too-early transcribe errors with "file not in ACTIVE state."
- **HTTP node timeouts.** `Transcribe` is 600s, transfer nodes 300s. Raise for very long episodes.
- **Gemini 1M-token context ceiling on long episodes (fixed 2026-06-21).** Gemini tokenises **video** at ~290 tok/sec (1 fps of frames + audio at 32 tok/sec), so an episode past ~58 min overflows the 1,048,576-token input limit and `Transcribe with Gemini` fails with *"input token count exceeds the maximum… 1048576"*. A longform Chat hit this. Fix: the transcribe request now sends `videoMetadata: { fps: 0.2 }` (sample 1 frame / 5s) and `generationConfig.mediaResolution: 'MEDIA_RESOLUTION_LOW'`, which collapse the frame-token cost. Transcription only needs the **audio** (unaffected by fps/resolution), so quality is unchanged while the practical ceiling rises to ~6 hours. If an even longer episode ever overflows, lower `fps` further (e.g. 0.1) — audio stays the floor at 32 tok/sec (~9h ceiling). **OpenRouter is not a fix:** its video-capable chat models are mostly Gemini (same limit), and while its `/audio/transcriptions` endpoint now returns segment/word timestamps (`verbose_json`), it times out on episode-length files (~60s per-request provider limit). The proper escape hatch for arbitrarily long media is a **dedicated STT API (Deepgram / AssemblyAI)** — URL-based, audio extracted server-side, word-level timestamps — which would replace steps 6–13 (Download → Transcribe) but needs a new credential and timestamp-to-`[MM:SS]` formatting. Note (2026-10-06): the whole-file call also caps its *output* at ~65k tokens, and Gemini can degenerate into a repetition loop part-way through a long episode (BA-7gPQTH, a 2h20m roundtable, looped after ~30 min and was cut off at that ceiling). The fix is the 20-minute windowing in steps 11b to 13; the dedicated STT option above remains the escape hatch if a window ever proves too long.
- **Frame.io URL — `view_url` is the real field.** Exec #778 showed the stable link lives in the file object's **`view_url`** (`https://next.frame.io/project/.../view/...`). Since 2026-10-29 this workflow does not write the link at all (the upload workflow does); it reads the row's stored `Frame.io URL` and takes the file id from the last path segment. If that parse fails, `Resolve Frame.io File` throws with the episode ID and the offending URL.
- **Airtable Content API contract** for `Upload Chapters Attachment`: `POST …/{recordId}/{fieldName}/uploadAttachment` (field **before** `/uploadAttachment`), JSON body `{ contentType, filename, file: <base64> }`, field ref URL-encoded (`Chapters%20JSON`), 5 MB cap.
- **`_Bypass` is matched on the file name, not the Airtable Title** — and it is now checked in `BA - Frame.io Uploaded > Episode Marked`, not here. The marker must be at the very end of the Frame.io file name and the name still needs a `BA-{id}` prefix so the episode can be found.
- **Re-run support (same episode ID).** `Set Status` writes `Chapters JSON: []` to clear the prior attachment before re-upload. A same-length re-upload (or a `_Bypass` name) now skips all of this and only swaps the URL.
- **Telegram sends retry on transient failures (added 2026-06-23).** Both Telegram nodes (`Send Metadata to Telegram`, `Notify Skipped (Non-Media)`) have **Retry On Fail** on. This was added after exec #908 failed on `getaddrinfo EAI_AGAIN api.telegram.org` — a transient DNS blip on the n8n host (not a config error). All the Airtable writes run **before** the Telegram send, so even when the send fails the episode is fully analysed in Airtable; only the pick-options notification is lost. The retry now rides out brief DNS/network hiccups. If `api.telegram.org` is unresolvable for >~20s the run still ultimately errors — re-run the execution (the metadata's already saved, so only the message re-sends; note a full re-run re-transcribes unless the `_Bypass`/same-length short-circuit applies). **Known drift:** the SDK source sets `maxTries: 4` / `waitBetweenTries: 5000` on these two, but the live workflow (checked 2026-07-29) has the toggle on with n8n's **defaults** (3 tries / 1000 ms) — the SDK values never landed. Harmless (~3s of cover instead of ~20s, and a lost send costs only the notification since all Airtable writes happen first), but don't trust the source values here without checking the node. **Parked as an open item** with full context — why it matters, why it was deferred, the fix, and the bigger "did other SDK config also fail to land?" question — in `workflow_planning/Guys Take Build Status.md` §0.7 Housekeeping.
- **Gemini/Frame.io calls retry on transient failures (added 2026-07-29).** Exec #1514 died on `Transcribe with Gemini` with *"Service unavailable — try again later or consider setting this node to retry automatically"*, i.e. a Gemini **503**: their side was briefly overloaded, nothing wrong with the request. Five nodes now have **Retry On Fail** on with `maxTries: 5`, `waitBetweenTries: 5000ms`, giving ~20s of cover:

  | Node | Call | Safe to repeat because |
  |---|---|---|
  | `Transcribe with Gemini` | Gemini `generateContent` | only reads generated text back; creates nothing |
  | `Get File State` | Gemini Files API | plain `GET` |
  | `Start Gemini Upload` | Gemini resumable-upload start | a retry just opens a fresh upload session |
  | `Show File` | Frame.io V4 | plain `GET` |
  | `Download Proxy` | signed proxy URL | plain `GET` |

  **Deliberately excluded:** `Upload Bytes to Gemini` (a retry re-sends at `X-Goog-Upload-Offset: 0` against a half-consumed session) and `Upload Chapters Attachment` (Airtable `uploadAttachment` **appends**, so a retry would double the attachment). Those two keep their existing behaviour.

  **This does not cover a real outage.** n8n caps the wait at 5s and 5 attempts, so anything longer than ~20s still fails the run and fires the error alert. Recovery is the same as any other failure: re-run the execution, or re-upload to Frame.io.
- **`$env` is blocked** on this instance; the Telegram chat ID is hardcoded (`-5254203539`).
- **"Model output doesn't fit required format" from Metadata Output Parser (fixed 2026-06-28).** This error means the LLM returned JSON that didn't match the schema. Two root causes: (1) The condensed `metadataSystemPrompt` lacked an explicit instruction that `startTime` must be an **integer in seconds** (e.g. `[02:14] → 134`), so the model returned strings like `"02:14"` which failed schema validation. Fixed by restoring the detailed prompt with `"the integer 134, NOT the string '02:14'"` language. (2) `maxTokens: 4000` was too low for a long-form interview — description + chapters + titles + captions can approach that limit, producing truncated JSON. Fixed by increasing to `8192`. If this error recurs, check the `Generate Metadata` node's raw output in the execution to see exactly what the model returned.
- **Model tuning.** `openai/gpt-5.1` chosen for title/caption quality; downgrade in `Metadata Model (OpenRouter)` if cost matters more.

---

## Related

- **Upstream:** the editor uploads the final cut to Frame.io (manual editing stays manual). Replaces planned stages #5 Edited-detection and #6 Transcription.
- **Downstream:** stage #8 Artwork (`BA - Guy's Take Thumbnail Artwork`, `mLAn4ya2AmZoHDUk`). It reads three fields this workflow's packaging message collects: `Thumbnail Caption`, **`Thumbnail Moods`** (which moods to use) and **`Custom Image Prompt`** (optional art direction). A human still moves the Episode to `Approved`.
- **Sibling AI stage:** `BA - Guy's Take Script Generation` (`q80QVMszf2iOfwIy`) — same OpenRouter + structured-output + Telegram-document delivery pattern.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflows #5/#6/#7)
