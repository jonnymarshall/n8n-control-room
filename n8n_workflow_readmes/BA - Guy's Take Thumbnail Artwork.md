# BA: Guy's Take Thumbnail Artwork

> **2026-11-12 - Telegram messages restyled to `TELEGRAM-STYLE.md` (LIVE, published `f8a3f601`).** Status emoji first, blank-line blocks, BA- codes only. Also fixed two real defects found while restyling: `Send a text message` carried a double `==` so its "extra picks" warning printed a stray `=` first, and `Check Extra Picks`, `Notify Manual` and `Warn No 16x9 Source` were printing internal `rec...` row ids instead of the human code. Album captions now read `1 · Neutral · BA-DCvtat`; `Resolve Selected` emits `rowName` so the reversion warning can name the option. Wording and structure only: no trigger, logic, credential or output change. Audit with `scripts/query/telegram-style-audit.sh`.

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (Current ID: `mLAn4ya2AmZoHDUk`. The previous hand-built copy `YyXiJ0lusoW7ynu9` is **archived**.)

> **2026-10-30 - the caption area is now a measured, fixed TOP band (LIVE, prompts + one code node; NOT yet re-run end-to-end).** The first 4 x 16:9 delivery of a Duo episode came back with all four options filling the frame edge to edge: no clean area anywhere for the caption, on an image Jonny otherwise loved. Two causes, both fixed:
>
> 1. **The prompt asked for a preference, not a measurement.** `MANUAL HEADLINE AREA` said "top **or** bottom", "wide enough for one short headline line" and "do not push people off the edge to make room" — nothing a model can act on precisely, and the escape hatch let it pick "neither". All the 16:9 layout rows (`Solo` / `Duo` / `Roundtable`) now carry a `HEADLINE SAFE ZONE - NON-NEGOTIABLE` block: the **top 25% of the frame height, full width**, must be background only, with a stated check ("divide the frame into four equal strips, the whole top strip must be background") and a final self-check before returning the image. `Reversion 1x1` and `Artwork Revision` / `Read Artwork Revision` got the same 25% rule, `Reversion 9x16` a top third, and `Read Thumbnail`'s minimum went from one sixth to one quarter.
> 2. **The per-option shot line was overriding the prompt.** `Build Image Requests` prepends `Variant 1 of 4 - REQUIRED, DISTINCT SHOT: a tight close-up; camera close in, the subjects fill most of the frame` — and "fill most of the frame" won head-on against a template that appears later in the prompt. Variant 1 now reads "faces read large, while the top quarter stays clear background headroom", variants 2-4 say the same thing in their own terms, and a new `SAFE_ZONE` constant is sent **between** the variant line and the template so the reserve is restated after the instruction that was beating it. Reads get `READ_SAFE_ZONE`, which honours the Read layout's own bottom-preferred area at the same one-quarter minimum.
>
> Chosen trade-off: a fixed top band means the caption lands in the same place on every thumbnail, and pushing subjects down costs some scale. The band is a one-line edit in the `Prompts` table if it ever needs to move to the bottom. Pushed with `versionId == activeVersionId`, 0 validation errors, credentials unchanged, SDK snapshot regenerated. **Not yet verified on a real generation.**
>
> **2026-10-28 - Read facial expressions are now selectable; Neutral stays the default (LIVE, published `2198d6d8`, UNTESTED end-to-end).** A Read no longer hard-codes a neutral face. `Resolve Vibes` treats `Thumbnail Moods` exactly like every other type: a pick is the **facial expression** for all four options (cycled if more than one), and an empty field still means `Neutral`. The Read packaging message now asks for a **3 · Facial expression** (the live mood library) alongside title and caption, with the **book cover** moving to step 4. The `Read Thumbnail` prompt row's `EXPRESSION` block is driven by `{{VIBE}}` — defaulting to Neutral — instead of a fixed "slight closed-mouth smile". Pick captions append a non-Neutral expression ("Study, camera - Dramatic/Intense"); `moodSource` no longer emits `forced-neutral-read` (`picked` / `default-neutral` / `fallback-all-moods` only). The assistant's packaging instructions were updated so "expression: ..." maps to `Thumbnail Moods`, never `Custom Image Prompt`. **First real test is `BA-8YfSPH` with `Dramatic/Intense`.** `Dramatic/Intense` is already a row in `Thumbnail References` with a reference photo.
>
> **2026-10-22 - Read episodes are now auto-generated, with the book cover on the book (LIVE, published `5c1f0dbe`, UNTESTED end-to-end).** `Read` is no longer routed to manual artwork. Its four options are **four fixed looks**: study or reading nook, each with one camera shot and one book shot (two looking at the lens, two looking at the book). The book's **front cover** is an image supplied on the episode's new `Book Cover` attachment field; the workflow downloads it and passes it to Nano Banana as **Image 2**, and the prompt reproduces it on the front board only. With no cover attached, the run uses four reading poses with a plain book and the pick message warns that no cover was used. In normal operation the trigger view blocks a Read that has no cover, so that branch is a manual/fallback path only. *(Superseded 2026-10-28: Reads now accept a `Thumbnail Moods` expression pick; an empty field still means `Neutral`.)*
>
> New Airtable `Prompts` rows: `Read Thumbnail` (body, tokens `{{BOOK}}`, `{{SCENE}}`, `{{CUSTOM}}`), `Read Book Cover`, `Read Book No Cover`, `Read Scene Study`, `Read Scene Nook`, plus `Read Reversion 1x1` and `Read Artwork Revision` (both preserve the cover). The four-look pairing lives in `Build Image Requests`; the wording lives in Airtable. `Artwork Settings` has `Read` = 16x9 + 1x1, no 9x16. **Reads need a `Book Cover`; other types do not.** Note (2026-10-23): the view does **not** require `Custom Image Prompt`; that claim was wrong. The view's actual filters are only partly known and need a fresh transcription. The Telegram assistant can now take a photo captioned `book cover BA-xxxx` and upload it to that field. **First real Read ran 2026-10-23 (execution `8048`): four options, cover placed. Two had a band/seam, so the headline-area wording was tightened the same day.**

> **2026-10-22 - moodless means NEUTRAL, and all six artwork prompts banned black bars (LIVE, published `b00807ec`).** Two changes from Jonny's Read-episode work, both affecting every type:
>
> 1. **`Resolve Vibes` no longer cycles the whole library when no mood is picked.** An empty `Thumbnail Moods` (or one where no name matches) now uses the **`Neutral` reference photo for all four slots**. That was always Jonny's intent; the old fallback surprised him. Only if the `Neutral` row is missing or has no `Reference Photo` does it fall back to the whole library, so a broken table still cannot fail a run. *(2026-10-28: the old `Read`-forces-`Neutral` rule is retired; a Read pick is now its facial expression.)* `moodSource` reports `picked`, `default-neutral`, or `fallback-all-moods`.
> 2. **The black bar bug is a prompt bug, fixed in Airtable.** The `MANUAL HEADLINE AREA` text said the reserved area "can be ... a smooth fade to black", and the model drew that fade as a black band across the top. All six `Prompts` rows (`Solo`, `Duo`, `Roundtable`, `Reversion 1x1`, `Reversion 9x16`, `Artwork Revision`) now require a naturally dark part of the scene, state that the image fills the frame edge to edge, and explicitly ban full-width bars, bands, strips, borders and overlays. No workflow change was needed because the prompts are read live. **Not yet re-tested on a real generation.**

> **2026-10-07 - duplicate initial options: the per-option variation is now REQUIRED and front-loaded (LIVE, published `d282e684`).** The old anti-duplicate measure appended a sentence after the whole prompt that began "Secondary to explicit producer instructions...". With a detailed `Custom Image Prompt` (the norm) plus a one- or two-mood cycle, the model was being told that the only differing line yields to the art direction, so options came back identical (Automation Upgrades `rec2oCaiE4gE1plRb`, `BA-C8Uwej`). `Build Image Requests` now PREPENDS a required, first-class per-option shot line (`Variant N of 4 - REQUIRED, DISTINCT SHOT: tight close-up / medium eye-level / wider environmental / asymmetric off-centre`) ahead of the Airtable template and states it is required, not optional. The four options now differ at the TOP of the prompt, before the model reads the art direction. Live edit was a surgical `patchNodeField` on `Build Image Requests` `parameters.jsCode` (no credential impact); `versionId` = `activeVersionId`, workflow still active with `availableInMCP: true`. SDK copy updated. A real one-mood run is still needed to confirm image-model compliance.

> **2026-10-06 - per-type variation control moved to the `Artwork Settings` table (LIVE, validated, UNTESTED end-to-end).** Previously the type rules were hardcoded: `Plan Generate`'s `autoArt = ['Take','Chat','Clip','Roundtable']` and `Resolve Selected`'s `NO_REVERSION = ['Read','Clip','Audionauts']`. Jonny needed finer control (for example Chat/Roundtable no longer want a 9:16) and had added an Episode Type filter to the select view, which is the 2026-08-20 anti-pattern (that view drives all three Path-2 branches, so filtering it makes a pick of the excluded type do nothing at all). **New design:** a table **`Artwork Settings`** (`tblv9BEEC6BrmBSe8`), one row per Episode Type, with checkboxes `Generate 16x9`, `Generate 1x1`, `Generate 9x16`. `Plan Generate` (via the new `Fetch Artwork Settings` node) sets `autoArt` from it, and `Resolve Selected` (via the new `Fetch Selected Settings` node) sets `want1x1` / `want9x16`; the reversion branch then builds only the wanted-and-missing ratios. Rules are edited in Airtable with no deploy. **`2 Sats` is now auto-generated (all three ratios), previously manual.** The select view `viw7AHjnX9ZkvIrKo` was briefly given a type filter on 2026-10-06 and was **reverted to `Status = Selected` only by Jonny the same day**. **This whole change has NOT been run end-to-end on a real pick yet** — validate by picking a Chat (expect 16x9 + 1x1 only) and a Clip (expect the pick to complete with no 1x1/9x16).

> **Live workflow is authoritative.** The reviewable local copy lives at `scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js`. Pull and compare the live workflow before editing or pushing the SDK because canvas edits can make the local copy stale. A full SDK push can also skip credentials on HTTP nodes, so verify every binding by hand afterward.

> **2026-10-05 - `trigger poll` `IsolateError` was an instance-level n8n bug, fixed on the host (no workflow change).** Four Telegram alerts reading `No bridge acquired for this context. Call acquire() first.` fired from this workflow's `trigger poll`, and the same error had been landing in the Ops Log since 2026-09-24. This is **not** a fault in this workflow. Root cause: the n8n instance ran the experimental **`vm` expression engine** (the default from n8n 2.36 onward), whose sandbox requires a "bridge" to be held before any expression is evaluated. n8n's poll code path (`runPollFunction` in `packages/core`) does not hold that bridge, so a one-minute Airtable poll that resolves a node parameter intermittently died with `IsolateError`. Confirmation that it was instance-wide, not workflow-specific: the `BA: Guy's Take Script Generation` poller failed with the identical error at the same wall-clock minutes. Fix applied: set `N8N_EXPRESSION_ENGINE=legacy` in `/opt/n8n/docker-compose.override.yml` on the host and run `docker compose up -d` in `/opt/n8n` (backup kept at `docker-compose.override.yml.bak`). `legacy` evaluates expressions without the sandbox bridge, so the failure mode disappears. Do **not** try to fix this by editing the triggers, and remove the override line only if a future n8n release fixes the poll path. The separate `getaddrinfo EAI_AGAIN api.airtable.com` triggers are real transient host DNS blips, are already suppressed by the failure-alert workflow, and are unrelated to this.

> **2026-09-24 - album send made retry-resilient (LIVE, published `6f96b107`).** `Send Thumbnail Options` failed on `BA-5GM2XJ` (exec 2880) with Telegram `Bad Request ... WEBPAGE_CURL_FAILED` - Telegram's own servers could not download one of the four Airtable image URLs (`failed to send message #2`). The URLs were verified healthy: all four returned `200 image/jpeg` (~0.6-0.75 MB), with Telegram's user-agent, no redirects, distinct and non-expired. So this is a transient fetch failure on Telegram's side, not bad data. `sendMediaGroup` is atomic (a failed group posts nothing), so a retry cannot duplicate the album. `Send Thumbnail Options` and `Send Pick Instructions` now have **Retry On Fail 5x / 5s**. Symptom to recognise: a generation run that produced 4 `Proposed` rows in Airtable but sent no Telegram album, leaving the episode on `Status = Generating Artwork`.

> **2026-09-17 - caption-safe area placement tightened (LIVE).** The 16:9 layout prompts now require exactly one text-safe area at the top or bottom, not left or right. It must be wide enough for one short headline line and can be natural dark low-detail background or a smooth fade to black. The 1:1, 9:16, and Artwork Revision prompts now use the same top-or-bottom rule. The 9:16 prompt specifically requires the text-safe area to take about one third of the vertical canvas so Instagram cropping still leaves usable caption room. All prompts forbid letterbox bars, hard-edged black bands, solid colour strips, banners, boxes, panels, empty rectangles, and split caption areas. No n8n change was required because these prompts are read live from Airtable.

> **2026-09-17 - natural cinematic colour grading strengthened again (LIVE).** The three 16:9 layout prompts no longer use warm amber / burnt orange as the default house palette. They now ask for a polished cinematic editorial image with natural, believable colour. Red, amber, and orange are allowed only as small warning lights, UI alerts, or local accents, never as an overall red, orange, yellow, or sepia cast. No n8n change was required because these prompts are read live from Airtable.

> **2026-09-11 - Airtable polling DNS noise reduced (LIVE).** All three one-minute Airtable poll triggers (`Ready for 16X9 Thumbnail`, `Thumbnail Selected`, and `Revision Requested`) now retry up to five times with five seconds between attempts. This addresses repeated background `getaddrinfo EAI_AGAIN api.airtable.com` failures that produced Telegram alerts even while no artwork job was running. The trigger runs have no work item or execution ID because the failure happens while checking Airtable. Persistent outages still alert after the retry window. Published version `a263b33e-8848-4cb6-bf92-d469d45777f9` is active and validation passed with zero errors.

> **2026-09-09 - native 9:16 composition confirmed (`recfxCsVULUoWjmEI`, Fixed).** This was already corrected in the live `Reversion 9x16` Airtable prompt later on 2026-08-12, but its Automation Upgrades row was never closed. The prompt requires an edge-to-edge vertical canvas and forbids letterboxing, borders, bars and padding; `Build Reversion Requests` also requests `imageConfig.aspectRatio: '9:16'`. The current 9x16 on thumbnail row `rec2hABKRPvNpmzw2`, generated after that prompt change, was inspected on 2026-09-09: its headline and four subjects are rearranged across the full height, with no landscape panel or filler bands. No n8n change was needed because the workflow reads this prompt live from Airtable.

> **2026-09-09 - duplicate person in a revision guarded (`recLknzqirW7VdeuR`, Fixed, model compliance unverified).** A 1:1 revision for `BA-PgJMzX` asked to place the existing three people side-by-side, but Nano Banana introduced a fourth person by duplicating a guest. The live `Artwork Revision` Airtable prompt now tells the model to count the people in the source first, preserve exactly that count, include each original person exactly once, and never clone, duplicate, mirror, repeat, merge or replace a face or body. Rearrangements must move the existing people only. The final instruction now asks for the requested output aspect ratio instead of the input image's ratio, removing a contradiction with `imageConfig.aspectRatio`. The updated Airtable row was read back successfully; the next real multi-person revision still needs to confirm model compliance. No n8n change was needed.

> **2026-09-09 - duplicate initial options guarded (`rechGwMZ5vHyQFMdx`, Fixed, real generation pending).** `BA-epafwr` used one mood after the four old framing variations had been removed, so its four Gemini calls could receive identical image inputs and effectively identical prompts; options 3 and 4 were identical. `Build Image Requests` now appends one restrained, option-specific composition direction to every rendered prompt: tight crop, medium eye-level crop, wider environmental framing, or asymmetric crop. These directions explicitly remain secondary to the producer's `Custom Image Prompt`, preserve the subject count, and do not set colours or text position. They are appended after template rendering, so they work even though `{{VARIATION}}` remains retired in Airtable. Published version `f9e55f13-cf71-4c67-928f-848e27355a8b` is active; validation passed with zero errors or warnings and all HTTP credentials were verified. A real one-mood generation is still needed to confirm image-model compliance. **(Superseded 2026-10-07: the per-option directions are now REQUIRED and PREPENDED, not appended/secondary. See the 2026-10-07 note at the top.)**

> **2026-09-13 - manual headline workflow (LIVE).** Gemini no longer renders headline text. All six artwork prompt rows now forbid text, logos, watermarks, letters, numbers and symbols, and reserve a clear, low-detail, high-contrast band for Jonny to add the headline manually in Photoshop. This applies to initial 16:9 options, 1:1 and 9:16 adaptations, and revision requests. The current `Thumbnail Caption` remains stored on the Airtable thumbnail row and is still supplied to the workflow for compatibility, but it is not sent as text to render.

> **🛡️ 2026-09-04 — re-selecting a row whose 16:9 was deleted no longer crashes (LIVE, verified published: `versionId` = `activeVersionId` `5464da21`).** Root cause of the 2026-07-31 `Thumbnail-uGMKKG` failure: Jonny deleted all three images off a `Final` row and re-selected it, and `Download Selected 16x9` died on the empty URL (the episode still got marked `Artwork Ready` on the other branch, so it claimed artwork it didn't have). Two changes landed together, pushed as a **surgical PUT of the live JSON** (credentials carried through verbatim — **no rebinding was needed**; confirmed by a before/after diff of every node's credentials), then reconciled into the `.sdk.js`:
>
> 1. **The 2026-08-20 type-exclusion finally went live.** Until today it existed only in the `.sdk.js` — the live `Resolve Selected` had no `reversionOk` and the live `Needs Reversion?` still had the single old condition, so Clips were silently getting reversions the SDK said they shouldn't. Live and SDK are now in sync.
> 2. **New `16x9 Exists?` gate** between `Needs Reversion?` and `Download Selected 16x9`: if the row's 16:9 attachment is gone, the branch skips the download and sends a Telegram message (`Warn No 16x9 Source`, record ID in a `<code>` block) explaining the fix (delete the Thumbnails row, set the episode back to `Approved`) instead of crashing. `Confirm Thumbnail Set` also now says the rebuild was skipped rather than promising versions that can't generate. **NOT yet live-fired** — a real test needs a Selected row with no 16:9, and faking one would trash a real episode's artwork state. Wiring and expressions verified by pull-back diff.

This is **stage #8 "Artwork"** in the Guy's Take build. **Phase A** generates + selects the 16:9. **Phase B** (built 2026-06-21) runs on selection: it unlinks the rejected options from the episode and re-runs Nano Banana on the chosen 16:9 to write a **1:1** and a **9:16** adaptation back onto the same Thumbnail row.

> **⚠️ PARTLY TESTED.** Two changes landed 2026-07-06: (1) **Roundtable episodes now auto-generate** (host + all linked guests across the frame) instead of being sent to manual artwork; (2) **the image-generation prompts now live in Airtable** (a `Thumbnail Prompts` table) instead of being hardcoded in the `Build Image Requests` Code node. Both were applied by hand-editing the live workflow (two Code nodes + one new `Fetch Prompts` node), not a rebuild. **2026-07-25 (UNTESTED):** `Plan Generate` now strips the host from `guestIds` so Guy can't be rendered twice when he's mistakenly linked in an episode's `Guests` — see the host-rendered-twice gotcha. **2026-07-26 (UNTESTED):** `Resolve Selected` now skips orphan `Selected` rows (a row set to `Selected` with no `Episode` link) and processes the first row that *does* have an episode, instead of reading only `$input.first()` and bailing. This fixes the exec #1186 stall where an orphan sorting ahead of a real pick in the same poll silently dropped the pick. **UNTESTED (reconciled into `.sdk.js` 2026-07-26, not yet run end-to-end).**
>
> **2026-07-08 — the Airtable-prompt (solo/Take) path is now tested end-to-end** after fixing two bugs it shipped with: (a) `Plan Generate` had a **truncated line** (`caption: f['Thumbnail Caption'] || f['Tit` — the `f['Title']` reference was chopped mid-string), throwing `SyntaxError: Invalid or unexpected token`; (b) `Build Image Requests` read the template from a field called **`Template`**, but the Airtable `Thumbnail Prompts` field is actually named **`Prompt`** — so every template loaded as `''` and `tpl()` threw the misleading `Missing prompt row "Solo Thumbnail"`. Both fixed in the live workflow. **Roundtable is still unverified** — run a real Roundtable episode before relying on it.

---

## TL;DR

Uses a **normalized data model**: a `Thumbnails` table where each generated option is its own row (linked to the Episode), and a static `Thumbnail References` library of Guy headshots tagged by mood. Two Airtable-triggered paths in one workflow.

> **🐛 2026-08-11 — the mood handover shipped broken twice over, both now fixed.** Reported by Jonny (Automation Upgrades `recFNrKdDjPNrWnXZ`): he asked for `Curious/Intriguing, Inspiring/Visionary` and all four options came back on the `Suspicious/Sobering` reference photo. Two independent faults, either of which alone would have broken it:
>
> 1. **The rewrite was never published.** The 2026-08-04 change was saved to n8n at 19:19 on 2026-08-11 but left as an **unpublished draft**, so n8n kept serving the previous published version (`8db37fe5`, 2026-07-26) — the one that still asked Gemini to pick. Exec **#1746** therefore ran the *old* code, and Gemini chose one mood for all four slots. The tell in the execution data: that run's `Plan Generate` output has no `moods` / `customPrompt` keys and its `Resolve Vibes` output has no `moodSource` key, so it cannot have been the new code. The trigger handed it the right data all along. **Now published** (`activeVersionId` `112229d4`). ⚠️ **`versionId` and `activeVersionId` are not the same thing** — an MCP/SDK push updates the draft, and until you publish, nothing you changed is running. Check both before concluding a fix is live.
> 2. **The new code read a field that did not exist.** `Plan Generate` read `f['Thumbnail Moods']`; the field Jonny had actually created on Episodes was called **`Moods`**. So even once published, every run would have resolved an empty list and fallen back to the whole 7-mood library — which would have *looked* like a different bug (four unrelated moods rather than four identical ones). Fixed both ways round: the code now reads ``f['Moods'] || f['Thumbnail Moods']``, and the Airtable field was **renamed `Moods` → `Thumbnail Moods`** (field ID `fldujYetql7QhEWkR` unchanged, no data lost) so it finally matches the Telegram packaging message, the assistant's instructions, the System Map and every doc below — all of which already called it that.
>
> **✅ VERIFIED end-to-end 2026-08-11, exec #1752.** After re-generating `BA-PgJMzX`, `Resolve Vibes` emitted `moodSource: picked` and cycled his two moods ABAB across the slots — option 1 `Curious/Intriguing`, 2 `Inspiring/Visionary`, 3 `Curious/Intriguing`, 4 `Inspiring/Visionary` — and the run completed through to `Mark Awaiting Pick`. This is the first confirmed run of the Jonny-picked-moods path, on a `Chat` (duo layout). **`moodSource` is the field to check on any future run**: `picked` means his choices were used, `default-neutral` means the field was empty and Neutral was used (since 2026-10-22), and `fallback-all-moods` means the Neutral row itself was unusable. (`forced-neutral-read`, the old Read override, was removed 2026-10-28.)
>
> **Getting that re-run to happen exposed a third gotcha**, documented under [Generate-trigger view gate](#1-generate-trigger-view-gate-take-or-has-a-guest): deleting the four `Thumbnails` rows was **not** enough to re-arm the trigger, because the view also excludes `Status = Awaiting Thumbnail Pick`. The episode sat out of the view doing nothing, with no error raised. Jonny set `Status = Approved` and it fired within the minute.

> **✅ 2026-08-04 — moods and art direction are now Jonny's, not the AI's (TESTED 2026-08-11 on a `Chat`, exec #1752).** The `Pick Moods (Gemini)` step and its `Build Mood Prompt` companion are **deleted**. The metadata workflow now lists the mood library in its Telegram packaging message and Jonny picks; his answer lands on the episode as **`Thumbnail Moods`** (comma-separated names) and `Resolve Vibes` cycles them across the 4 slots. He also supplies a **`Custom Image Prompt`**, which fills a new **`{{CUSTOM}}`** token in the Airtable prompt templates. The old prescriptive `{{VARIATION}}` token remains retired; four neutral composition directions were restored in code on 2026-09-09 to prevent one-mood runs from sending identical requests. Generation was documented as gated on `Custom Image Prompt`, but the view does **not** actually require it (verified 2026-10-23). Also fixed in the same pass: **Roundtable episodes were fetching no guest photos at all** (`Plan Downloads` only handled `duo`), so every Roundtable silently fell back to the solo prompt. See [Mood + prompt handover](#mood--prompt-handover-2026-08-04).

**Path 1 - Generate** (fires when an episode enters the Episodes **`Ready for 16X9 Thumbnail`** view, `viwqgtrry8n6yNgqW` — **not** an `Approved` view; `Status = Approved` is *not* one of the view's conditions, confirmed with Jonny 2026-08-11) is **content-type aware** (Episodes `Type` field):

0. **`Auto-artable Type?`** routes by `Type`. `Take` / `Chat` / `Clip` / `Roundtable` → generate. Anything else (blank-but-unknown) → **Mark Manual Artwork** (`Status = Awaiting Manual Artwork`, leaving the Approved view so it can't re-loop) + a Telegram "art this one manually" note, then stop.
1. Clears any old `Thumbnails` rows for that episode (so re-runs start fresh)
2. Reads the whole `Thumbnail References` library (mood + reference photo per row), the **`Thumbnail Prompts` table** (the layout prompt templates), and the `Guests` table
3. **`Resolve Vibes`** reads the moods **Jonny picked** (episode field `Thumbnail Moods`) and cycles them across the **4 thumbnail slots** — 1 mood means all four use it, 2 means ABAB. **No moods (or none matching) uses `Neutral` for all four**, for every type including Reads. The whole library is only used if the `Neutral` row has no usable photo. *(Until 2026-08-04 this was two nodes asking Gemini to choose; both are gone.)*
4. **Plan Downloads** builds one download task per image: 4 host reference photos (the picked vibe per slot), plus — for `Chat`/`Clip`/`Roundtable` — every linked guest's `Headshot`. One download fan-out covers both.
5. For each slot, calls **Nano Banana** (`gemini-3-pro-image`) to generate one 16:9. **Build Image Requests** picks the prompt template by layout — **solo** (Take, host close-up), **duo** (Chat/Clip, host + guest), or **roundtable** (Roundtable, host + all guests lined up like a film poster) — **fetched from the `Prompts` Airtable table** (matched by row `Name`: `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail`), then fills the `{{HOOK}}` / `{{CONTEXT}}` / `{{VIBE}}` / **`{{CUSTOM}}`** tokens. `{{CUSTOM}}` is Jonny's per-episode art direction from `Custom Image Prompt`. The retired `{{VARIATION}}` token renders empty. The code then PREPENDS a required, first-class per-option shot direction (tight close-up / medium eye-level / wider environmental / asymmetric off-centre), so even a one-mood run sends four visibly different requests. It is stated as required, not secondary (2026-10-07). Since 2026-10-30 each variant line also carries the caption headroom in its own wording, and a `SAFE_ZONE` constant is sent between the variant line and the template, because variant 1's original "the subjects fill most of the frame" was overriding the template's reserved area.
6. Creates 4 `Thumbnails` rows (`Status = Proposed`, linked to the Episode, with the mood, option number, caption) and uploads each image into the row's `16x9` attachment
7. Posts the 4 as a **Telegram album** to the group, captioned by mood, plus a short "set a row to Selected" instruction
8. Sets the Episode `Status = Awaiting Thumbnail Pick`

**Path 2 - Select** (fires when a `Thumbnails` row enters the `Ready for 1X1 & 9X16 Thumbnails *J*` view — `Status = Selected`, **all episode types**):

8. Sets the episode's other thumbnail rows to `Status = Rejected`
9. **Unlinks the rejected rows from the Episode** — sets the Episode `Thumbnails` link to **only** the selected row (so the other options drop out of the episode's Thumbnails column), sets Episode `Status = Artwork Ready`, **moves the chosen row to `Status = Final`** (so it leaves the select view and keeps the poll trigger clean), and sends a Telegram confirmation
10. **Reversioning branch (Phase B), runs in parallel off the same trigger:** an IF gate (`Needs Reversion?`) checks `reversionNeeded`: at least one of the row's **enabled-for-this-type** `1x1` / `9x16` attachments is missing. Which ratios a type is entitled to comes from the **`Artwork Settings` table** (2026-10-06), not a code constant. False dead-ends the branch. A second gate (`16x9 Exists?`, added 2026-09-04) then checks the row's `16x9` attachment is present before the download runs; if it's gone (hand-deleted), the branch sends a Telegram explanation (`Warn No 16x9 Source`) and ends cleanly instead of crashing at `Download Selected 16x9`. It downloads the selected row's `16x9` and re-runs **Nano Banana** for **only the missing aspect ratios** (so a re-select that already has both does nothing; one missing regenerates just that one), using prompt templates pulled from the **`Thumbnail Prompts` Airtable table** (rows `Reversion 1x1` / `Reversion 9x16`; **Read uses `Read Reversion 1x1`**, which preserves the book cover). Results upload into the row's `1x1` / `9x16` fields, then **Telegram sends back only the newly-generated artwork** (one `sendPhoto` message per new image, no duplicates). Reworked 2026-07-08.

**Path 3 - Revision (added 2026-07-26)** (fires when a `Thumbnails` row enters the `Revision Requested` view, i.e. `Status = Revising`): a **briefed, in-place, targeted** redo of an already-chosen thumbnail. You write a free-text `Revision Brief` + tick which `Revision Targets` (`16x9`/`1x1`/`9x16`) on the row and set `Status = Revising`. The chain re-runs Nano Banana on **only the ticked ratios**, **self-editing each ratio's current image** (falling back to the `16x9` if that ratio has none) with the brief as steering text, **overwrites** them on the row, Telegrams the new artwork back, and resets the row to `Final` (clearing the brief/targets). **No forced cascade** — it redoes only what you name; if you revise the `16x9` alone it adds an informational note that the 1:1/9:16 now derive from the old 16:9. Driven either by editing the row directly or by asking the **Telegram Assistant** ("redo the 9x16 for BA-xxxx, more red"), which proposes the row write for one-tap approval.

Selection is by setting a **`Thumbnails` row's `Status` to `Selected`**, not Telegram buttons: the `BA: Telegram Airtable Assistant` already owns the bot's only webhook, and Telegram allows one webhook per bot, so a second Telegram **Trigger** can't be added without breaking the Assistant. Sending messages from the same bot is fine; only triggers conflict. (The same reason revisions are triggered via `Status = Revising` on the row, not a button.)

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `mLAn4ya2AmZoHDUk` (SDK-sourced; old `YyXiJ0lusoW7ynu9` archived) |
| **SDK copy** | `scripts/deploy/workflows/guys-take-thumbnail-artwork.sdk.js` (reviewable local copy; live must be pulled and compared before editing; 62 nodes) |
| **Trigger 1** | Airtable poll on `Episodes` (`tbl3uYLIvtB9APZp6`), every minute, view `Ready for 16X9 Thumbnail` (`viwqgtrry8n6yNgqW`) — Path 1 Generate |
| **Trigger 2** | Airtable poll on **`Thumbnails`** (`tblkcASzE4DXlxokO`), every minute, view **`Ready for 1X1 & 9X16 Thumbnails *J*`** (`viw7AHjnX9ZkvIrKo` — same view, **renamed 2026-08-20** from `Selected`) — Path 2 Select + Phase B. Filters `Status = Selected` **only**; it must carry **no episode-type filter**, because it drives the reject/status branch too (which must run for every type). Per-type variation rules live in the `Artwork Settings` table instead. *(A type filter was briefly added here on 2026-10-06 and reverted the same day; see the 2026-08-20 gotcha.)* |
| **Trigger 3 (revisions)** | Airtable poll on **`Thumbnails`** (`tblkcASzE4DXlxokO`), every minute, view **`Revision Requested`** (`viwGVYiheuTD2pPlx`, filters `Status = Revising`) — Path 3 Revision |
| **Revision inputs** | on the `Thumbnails` row: `Revision Brief` (long text) + `Revision Targets` (multi-select `16x9`/`1x1`/`9x16`) + set `Status = Revising`. Prompt row `Artwork Revision` in `Prompts` (tokens `{{REVISION}}` = brief, `{{HOOK}}` = caption). |
| **Content types** | `Take` → solo host. `Chat` / `Clip` / `2 Sats` → host + all linked guests (duo). `Roundtable` → host + all linked guests, film-poster lineup (roundtable). **`Read` → four fixed looks (study/nook × camera/book) with the supplied book cover as Image 2.** Any other/unknown → skipped to manual artwork. Read from the Episodes `Type` single-select. Whether a type auto-generates at all, and which ratios it gets, is read from the **`Artwork Settings` table** (2026-10-06). |
| **Prompt source** | ALL image-gen prompt templates live in the **`Prompts` Airtable table** (`tblhG1nw2P1k3CBVU`, renamed 2026-07-15 from `Thumbnail Prompts`; ID unchanged), `Type = Artwork`, **`Name` + `Prompt` fields** (template text is in the field literally named `Prompt`). **Phase A** rows: `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail` (`Fetch Prompts` node → `Build Image Requests`, fills `{{HOOK}}`/`{{CONTEXT}}`/`{{VIBE}}`/**`{{CUSTOM}}`**; `{{VARIATION}}` remains retired and renders empty; code prepends a required, per-option distinct shot direction). **Read rows (2026-10-22, `{{VIBE}}` added 2026-10-28):** `Read Thumbnail` (body, tokens `{{BOOK}}` / `{{SCENE}}` / `{{VIBE}}` / `{{CUSTOM}}`), `Read Book Cover`, `Read Book No Cover`, `Read Scene Study`, `Read Scene Nook`; the four looks and their order live in `Build Image Requests`. **Phase B** rows (added 2026-07-08): `Reversion 1x1` / `Reversion 9x16` (`Fetch Reversion Prompts` node → `Build Reversion Requests`, fills `{{HOOK}}` = caption only), plus **`Read Reversion 1x1`** (2026-10-22, cover-preserving). **Path 3:** `Artwork Revision`, plus **`Read Artwork Revision`** (2026-10-22). Edit layout and style prompt text in Airtable; the duplicate-prevention composition directions live in `Build Image Requests`. |
| **Artwork Settings** | `Artwork Settings` table (`tblv9BEEC6BrmBSe8`, base `app8Xw9Tq0XLjhmp9`): one row per Episode Type with checkboxes `Generate 16x9` / `Generate 1x1` / `Generate 9x16`. Drives Path 1 (`autoArt`) and Path 2 (`want1x1` / `want9x16`). Added 2026-10-06; edit it in Airtable, no deploy. Current matrix: Take = 16x9+1x1+9x16; Chat = 16x9+1x1; Roundtable = 16x9+1x1; Clip = 16x9; 2 Sats = all three; **Read = 16x9+1x1 (2026-10-22)**; Audionauts = none (manual). |
| **Mood picker** | **Jonny**, via the metadata workflow's Telegram packaging message. Stored on the episode as `Thumbnail Moods` (comma-separated names), matched case-insensitively against `Thumbnail References` and cycled across the 4 slots by `Resolve Vibes`. On a `Read` this is the **facial expression** (since 2026-10-28); empty means `Neutral`. *(Was `gemini-2.5-flash` until 2026-08-04.)* |
| **Art direction** | **Jonny**, same message. Stored as `Custom Image Prompt` on the episode, fills the `{{CUSTOM}}` token in the layout template. `default` / `none` normalises to empty. Optional. The trigger view does **not** require it (verified 2026-10-23). |
| **Image model** | `gemini-3-pro-image` (Nano Banana), `v1beta`, `responseModalities: ["TEXT","IMAGE"]`, `imageConfig.aspectRatio` + `imageSize` (**`1K` everywhere** for reliability — 2K caused `IMAGE_OTHER`), one call per slot (Phase A) + 2 calls on select (Phase B 1:1 + 9:16) |
| **Options generated** | always 4 (Jonny's moods cycle across the slots; each slot also gets a distinct, required composition direction: tight close-up / medium eye-level / wider environmental / asymmetric off-centre). **Reads: 4 fixed looks instead (study/nook × camera/book); the expression cycles across them like any other type (2026-10-28).** |
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
| `Gemini API Key [n8n]` | `httpHeaderAuth` | `Generate Thumbnail (Nano Banana)` + `Generate Reversions (Nano Banana)` + `Generate Revisions (Nano Banana)` | **must be created** |

The Gemini credential is a generic **Header Auth** credential (when creating it in n8n, search "Header Auth" - NOT "Google Gemini (PaLM) Api"): header **Name** = `x-goog-api-key`, **Value** = your key from https://aistudio.google.com/apikey on a **billing-enabled** Google Cloud project (image gen is paid; the text call is free-tier). It powers both the mood-pick text call and the image calls.

> **AgentMail gotcha:** because `Gemini API Key [n8n]` did not exist when the workflow was built, n8n auto-filled the Header Auth slot on the Gemini nodes with the only existing Header Auth credential (**AgentMail**). That is wrong and must be replaced - open every `Generate ... (Nano Banana)` node and set the credential to `Gemini API Key [n8n]`.

> **Live credential drift (noted 2026-09-04):** the three `Generate ... (Nano Banana)` nodes currently use a Header Auth credential named **`google-ai-studio_[pod21-n8n-temp]`**, not `Gemini API Key [n8n]`. It works (image gen has been running on it), so don't "fix" it blindly — but if you ever rebuild from the SDK, either rebind to whichever Gemini credential exists at that point or rename to match.

All HTTP Request nodes are **skipped by credential auto-assignment** at build time (the rebuild references credentials by name in the SDK, but verify after any push). Open each and confirm: the Airtable ones (`Mark Generating`, `Mark Manual Artwork`, `Delete Old Thumbnails`, `Fetch Mood References`, `Fetch Prompts`, `Fetch Guests`, `Create Thumbnail Row`, `Upload 16x9`, `Mark Awaiting Pick`, `Get Episode Thumbnails`, `Reject Siblings`, `Mark Episode Artwork Ready`, `Upload Reversion`) use **`Airtable [n8n] (PAT)`**; the image-download nodes (`Download Image`, `Download Selected 16x9`) use **no auth** (signed URLs); the Gemini ones (`Generate Thumbnail`, `Generate Reversions`, `Generate Revisions`) use **Header Auth** with the credential above.

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
| `Episode Type` | Lookup (`Episode` → `Type`) | **added 2026-08-20** (`fldjbnJYqcGTSvzz6`). Carries the parent episode's `Type` onto the thumbnail row so Path 2 can gate on it without a second API call. Arrives as an **array** (e.g. `["Clip"]`) — `Resolve Selected` unwraps it. |
| `Mood` | Link → Thumbnail References | **single link** (turn off multiple); set by mood name via typecast |
| `Caption` | Long text | snapshot of the headline used |
| `Option` | Number | 1 to 4 |
| `Status` | Single select | `Proposed`, `Selected`, `Rejected`, **`Final`** (chosen row after Path 2), **`Revising`** (added 2026-07-26 — drives Path 3; the row is set back to `Final` when the revision run finishes) |
| `16x9` | Attachment | filled in Phase A |
| `1x1` / `9x16` | Attachment | **filled on select (Phase B)** — these two attachment fields must exist or the `Upload Reversion` calls 404 |
| `Revision Brief` | Long text | **Path 3** — the free-text steering instruction for a briefed redo; cleared to `""` when the run finishes |
| `Revision Targets` | Multiple select | **Path 3** — options `16x9`, `1x1`, `9x16` (exact strings, matching the attachment field names); the ticked ones get redone; cleared to `[]` when done |
| `Last Modified Time` | Last Modified Time | **required** — the select/revision triggers sort on it. Must watch **all** fields. |

Views: **`Proposed`** (Status = Proposed), **`Ready for 1X1 & 9X16 Thumbnails *J*`** (`viw7AHjnX9ZkvIrKo`, Status = Selected — select trigger; **renamed 2026-08-20** from `Selected`), and **`Revision Requested`** (`viwGVYiheuTD2pPlx`, Status = Revising — revision trigger). Scope the `Revision Requested` view to `Status = Revising` so a row drops out of it once Path 3 sets it back to `Final`.

> **⚠️ Do NOT put an episode-type filter on the select view**, despite its name. It fires **three** branches, and only one of them is the reversioning. Filtering `Clip` out of the view was tried on 2026-08-20 and silently broke Clips completely: the losing options stayed `Proposed`, the episode never reached `Artwork Ready`, the pick never went `Final`, and no Telegram message was sent — with no error anywhere. The filter was removed the same day and the exclusion moved into `Needs Reversion?` in code.

### `Prompts` table (image-gen prompt templates, edit these to change prompts)

> **Renamed 2026-07-15 from `Thumbnail Prompts` to `Prompts`** (it now also holds the Telegram assistant's `System Map` row — see below). The table **ID is unchanged (`tblhG1nw2P1k3CBVU`)** and every node references it by ID, so the rename broke nothing; only code comments / error strings in the workflow still say "Thumbnail Prompts" (cosmetic). Historical mentions of `Thumbnail Prompts` elsewhere in this doc refer to the same table.
>
> Added 2026-07-06 to move prompt text out of the `Build Image Requests` Code node so prompts can be edited in Airtable instead of n8n. Table ID `tblhG1nw2P1k3CBVU`.
>
> **Also in this table (not thumbnail-related):** row `Name = "System Map"` holds the pipeline knowledge base the `BA: Telegram Airtable Assistant` reads on demand. The assistant filters by `Name = "System Map"`, so it never touches the `Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail` / `Reversion 1x1` / `Reversion 9x16` rows. See that workflow's readme.

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text (primary) | **exact** row keys the code matches on. Phase A: `Solo Thumbnail`, `Duo Thumbnail`, `Roundtable Thumbnail`. Phase B (2026-07-08): `Reversion 1x1`, `Reversion 9x16`. **Path 3 (2026-07-26): `Artwork Revision`** (one generic self-edit prompt for all three ratios). A typo throws a clear `Missing prompt row "..."` error. |
| `Prompt` | Long text | the full prompt, with `{{HOOK}}` / `{{CONTEXT}}` / `{{VIBE}}` / **`{{CUSTOM}}`** fill-in tokens (`{{VARIATION}}` is retired and now always renders empty) (double curly braces get replaced; bare words stay literal). **Field is literally named `Prompt`** — the code reads `rf.Prompt`. An empty/misnamed field loads as `''` and throws the misleading `Missing prompt row "..."` (see the 2026-07-08 fix at the top). |
| `Type` | Single select / text | set to `Artwork` on all rows. Not filtered server-side (the code matches by `Name`), so it's just for tidiness. |

Token contract, **Phase A** (`Build Image Requests`), as of 2026-08-04:

| Token | Value | Source |
|---|---|---|
| `{{HOOK}}` | currently retained for compatibility but not rendered by the artwork prompts | episode `Thumbnail Caption` (falls back to `Title`) |
| `{{CONTEXT}}` | tone context, not rendered as text | episode `Summary` |
| `{{VIBE}}` | the facial expression for this slot (also used by the `Read Thumbnail` body since 2026-10-28) | one of the moods **Jonny picked**, cycled across the 4 slots; `Neutral` when empty |
| `{{CUSTOM}}` | **his free-text art direction for this episode** | episode `Custom Image Prompt`; `default`/`none` → empty |
| `{{VARIATION}}` | **retired** — always renders empty | kept only so an old template containing the token does not leak it into the prompt |

Put `{{CUSTOM}}` wherever you want his direction to land in the template — that's the point of it being a token rather than something appended. `Build Image Requests` then PREPENDS a required, distinct shot direction per option: tight close-up, medium eye-level, wider environmental, or asymmetric off-centre. As of 2026-10-07 this is stated as required and placed first (not appended and labelled secondary), because a detailed `{{CUSTOM}}` otherwise flattens all four options into the same picture. It preserves subject count, says nothing about colour, and (since 2026-10-30) restates the top-quarter caption band rather than fighting it. Layout→row mapping: `solo → Solo Thumbnail`, `duo → Duo Thumbnail`, `roundtable → Roundtable Thumbnail`; a duo/roundtable episode with **zero** usable guest images falls back to `Solo Thumbnail`.

Token contract, **Phase B** (`Build Reversion Requests`): `{{HOOK}}` is still supplied from the selected row's `Caption`, but the live prompts do not render it. Field→row mapping: `1x1 → Reversion 1x1`, `9x16 → Reversion 9x16`. The prompts remove any text inherited from the source and reserve one clear top-or-bottom text-safe area for manual Photoshop typography. The 9:16 prompt requires that area to be about one third of the vertical canvas to allow for Instagram cropping. Every `{{TOKEN}}` occurrence is replaced globally. Since 2026-10-07 each reversion prompt also carries a `NO RENDERED WORDS` block that forbids words, letters, numbers, captions and watermarks outright, so a source image with baked-in text cannot leak it into the new ratio.

Token contract, **Path 3** (`Build Revision Requests`): row `Artwork Revision`, `{{REVISION}}` = the `Revision Brief`; `{{HOOK}}` remains supplied but is not rendered. The current image of each targeted ratio is passed inline and the prompt asks Nano Banana to apply *only* the briefed change while preserving everything else, removing any existing text and keeping one clean top-or-bottom text-safe area for manual Photoshop typography. If the requested output ratio is 9:16, the prompt asks for the text-safe area to be about one third of the vertical image height. Since 2026-09-09 it also locks the source's person count and requires every original person exactly once, specifically preventing rearrangement briefs from creating a duplicate face or body. All three ratios use this one row (the aspect ratio is set per-request via `imageConfig`, not a separate prompt). Since 2026-10-07 it also carries a `NO RENDERED WORDS` block: a revision request cannot make it render text.

### `Guests` table (for Chat/Clip/Roundtable)

| Field | Type | Notes |
|---|---|---|
| (primary) | — | guest name |
| `Headshot` | Attachment | the guest's face; first attachment is used. **No Headshot → that guest is skipped** |

Linked from Episodes via a **`Guests`** link field. The workflow GETs the whole `Guests` table once and filters to the episode's linked ids (so the table can be any size).

### `Episodes` table (additions only, stays lean)

- `Thumbnail Caption` — long text. Filled by Jonny's `TC1`–`TC5` reply to the metadata workflow's packaging message.
- `Custom Image Prompt` — **long text**. **New 2026-08-04, must be created.** His art direction for this episode's artwork, fills `{{CUSTOM}}`. **Not a view gate** (corrected 2026-10-23). `default` / `none` normalises to an empty token in `Plan Generate`.
- `Thumbnail Moods` — **long text**. ⚠️ **New 2026-08-04, must be created.** Comma-separated mood names he picked, e.g. `confident, shocked`. Matched against `Thumbnail References` **by name, case-insensitively**; unknown names are dropped. Order matters — the moods cycle across the 4 options in the order given. **Empty or all-unmatched uses `Neutral` for all four (2026-10-22); it only uses the whole library if the `Neutral` row has no photo.** On a Read this is the **facial expression** (since 2026-10-28); it is not ignored.
- `Book Cover` — **attachment** (single). **New 2026-10-22, field `fldoE43HUNe8nLwX4`.** Read episodes only. The book's front cover artwork, downloaded and passed to Nano Banana as **Image 2**, then wrapped onto the book's front board in all four options. Fill it by dragging the image into Airtable or by sending it to the Telegram assistant as a photo captioned `book cover BA-xxxx`. Empty on a Read = the workflow uses the no-cover reading poses and warns on the pick message.
- `Type` — single-select `Take` / `Chat` / `Roundtable` / `Clip` (shared with the metadata workflow). Drives the layout: `Take` → solo, `Chat`/`Clip` → duo (host+guest), `Roundtable` → roundtable (host + all guests, film-poster lineup), anything else → manual. Missing `Type` defaults to `Take`.
- `Guests` — link → `Guests` table (multiple). Read for `Chat`/`Clip`/`Roundtable`; all linked guests with a `Headshot` go in the frame. **Do not include the host (Guy) here** — the host is composited separately from `Thumbnail References`, so listing him as a guest draws him twice. `Plan Generate` now strips his record defensively (see the host-rendered-twice gotcha), but keep the data clean too.
- `Status` single-select: add `Awaiting Thumbnail Pick`, `Artwork Ready`, `Generating Artwork`, and `Awaiting Manual Artwork` (the last is set for Roundtable/unknown types; `typecast` auto-creates it on first use).
- The reverse-link field **`Thumbnails`** (auto-created by the `Episode` link on the Thumbnails table) must be named `Thumbnails` — both the clear-old and reject-siblings logic read `fields.Thumbnails` off the episode.
- View **`Ready for 16X9 Thumbnail *J*`** (`viwqgtrry8n6yNgqW`) drives the generate trigger. Its exact conditions are listed under "Generate-trigger view gate" below, transcribed from the UI on 2026-10-23. Note `Status = Approved` is **not** among them, while `Status is none of Awaiting Thumbnail Pick / Generating Artwork / Published / Suspended / Artwork Ready` **is**; `Transcript is not empty` and `Custom Image Prompt is not empty` are **not** conditions. The Airtable API cannot read view filters, so that block is the only source of truth.

`Last Modified Time` (`fld3Z4xdI4s2wVnLa`, all fields) already exists from Phase 0.

> Both triggers leave the **Options → Fields** list **empty** on purpose (returns the whole record). Do not restrict it — that is the root cause of the recurring Airtable trigger failures, and a PostToolUse hook lints for it.

---

## Mood + prompt handover (2026-08-04)

Two decisions that used to be made by code are now made by Jonny, in his reply to the metadata workflow's Telegram packaging message. Nothing here polls or waits: the answers land on the Episode as ordinary fields, and this workflow just reads them.

| Was | Is now | Lands in |
|---|---|---|
| `Build Mood Prompt` → `Pick Moods (Gemini)` chose 1–4 moods | Jonny picks from the list Telegram showed him | `Thumbnail Moods` (long text, comma-separated) |
| 4 prescriptive `{{VARIATION}}` framing lines in the Code node | Jonny writes free-text art direction; code adds only a neutral per-option composition difference | `Custom Image Prompt` (long text) → `{{CUSTOM}}`, followed by the lower-priority composition directive |

**Why the moods moved out of Gemini.** The old node asked Gemini to read the episode and assign a vibe per slot. It worked, but it was a second opinion Jonny then had to live with, and it cost a call per run. Since he's now being asked about the artwork anyway, asking for the moods in the same message is free.

**Why neutral composition differences returned.** The 2026-08-04 handover removed the old framing lines so they could not fight Jonny's art direction. `BA-epafwr` later proved that moods alone are not enough: with one mood, all four requests could be identical and options 3 and 4 came back identical. The replacement is intentionally narrower. It changes only crop/camera composition, preserves subject count, and gives no palette or text-position instruction. (Updated 2026-10-07: it is no longer "secondary" nor appended, because that let a detailed `Custom Image Prompt` flatten all four options into the same picture; it is now a required, front-loaded line.)

**Failure behaviour is deliberately soft.** A mistyped mood is dropped; if *every* mood is unmatched (or the field is blank) `Resolve Vibes` uses `Neutral` for all four slots (since 2026-10-22). The only hard failure left is a `Thumbnail References` table with no usable `Reference Photo` on any row; a missing or photo-less `Neutral` row degrades to the whole library instead.

### Stripped-back prompt templates (paste into the `Prompts` table)

> **2026-10-07 - one-scene, framing and no-words rules added (LIVE).** Real runs showed the people being pasted into the frame as flat, cropped head cut-outs with mismatched lighting, and one episode (BA-5XpVHJ) rendered the headline because its own `Custom Image Prompt` explicitly asked for text, which the old `ART DIRECTION wins` wording honoured. All three layout prompts now carry three NON-NEGOTIABLE blocks: `ONE REAL PHOTOGRAPH` (everyone in one believable photograph, shared camera / perspective / lighting, natural shadow and scale, no pasting or cut-out edges, no rigid evenly spaced row), `PEOPLE AND FRAMING` (head to upper chest minimum, never crop a head or chop a chin, similar scale, no passport stares), and `NO RENDERED WORDS` (no words / letters / numbers / captions / watermarks, even if `ART DIRECTION` asks; brand logos still allowed only when `ART DIRECTION` asks). All three now also carry `HEADLINE SAFE ZONE` (added 2026-10-30, which replaced the old `MANUAL HEADLINE AREA` block). The final line of each layout prompt states these four blocks override any contradicting `ART DIRECTION`. The three layout templates below are the live text copied verbatim from Airtable, so they can be pasted straight back; edit the `Prompts` rows to change them.

> **Current live prompt contract, updated 2026-10-30.** The full prompt text lives in Airtable (`Prompts` table, `Prompt` field) and is read at runtime. The key rules now are: natural cinematic colour first, with red / amber / orange only as small accents, and **one measured caption band, fixed at the top** (`HEADLINE SAFE ZONE - NON-NEGOTIABLE`, 25% of the height on 16:9 and 1:1, the top third on 9:16) rather than a vague "top or bottom" text-safe area. The band must be background only and must be achieved with the camera, never with a bar, band, panel or overlay. Do not reintroduce `warm amber and burnt orange` as the default whole-image palette, and do not ask for a `horizontal band` for headline text.

> **Logo exception.** The layout prompts no longer ban every logo. They ban random text, captions, watermarks, letters, numbers, and symbols, but allow brand logos when `ART DIRECTION` explicitly asks for them. This matters for episodes that deliberately reference projects such as Coldcard, Blockstream, Ledger, or Trezor.

The old templates carried prescriptive art direction that conflicts with `{{CUSTOM}}` — if the template already says "warm orange key light" and Jonny asks for a cold blue night scene, Nano Banana gets contradictory instructions and is more likely to return `IMAGE_OTHER`. These replacements keep only the parts worth keeping: likeness, the **colour floor**, a clean manual-text area, and the output constraints.

> ⚠️ **Strip *prescriptive* direction, not *protective* direction — they are not the same thing.** The first pass of this rewrite (2026-08-04) removed the palette and put **nothing** in its place, which is what caused the greyscale bug: with no colour instruction at all, the model desaturated the subjects to make them read against a busy background. The `COLOUR — NON-NEGOTIABLE` block below is deliberately **not** a palette. It dictates no hue and fights nothing Jonny might write in `{{CUSTOM}}`; it only sets a floor ("people are never grey") while leaving backgrounds free to be monochrome. **Keep that block in any future rewrite.** Before deleting a line from a prompt, ask what it was silently guaranteeing.

> 🎨 **Warm default palette removed again (2026-09-17).** The 2026-08-18 warm house-style default helped avoid cold-blue AI slop, but later real runs showed the model was over-reading it as an orange / sepia wash across the full frame. The live prompts now use a neutral cinematic editorial style instead: dark, realistic backgrounds, natural skin tones, neutral whites and greys, and red / amber / orange only as small warning details or local accents.

**`Solo Thumbnail`**

```
Create a 16:9 YouTube thumbnail for a punchy Bitcoin and sovereign-tech commentary show.

SUBJECT
Image 1 is the host. Reproduce his likeness faithfully. His facial expression should read as: {{VIBE}}.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph, as if the host is physically present in the scene. The lighting direction, colour temperature, perspective and focus on him must match the surroundings, and he must cast natural shadow and sit at a believable scale within the scene. Do not paste, cut out or superimpose him. No cut-out edges, hard outlines or halos around the head, hair or clothing.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of the head and never cut the face off at the chin or neck. Avoid a stiff passport-style stare; let him look naturally, toward the camera or at the scene, with an expression that fits {{VIBE}}.

HOUSE STYLE
Create a polished cinematic editorial image with natural, professionally graded colour. Use a dark, realistic background, but keep the overall palette neutral and believable. Red, amber, and orange may appear only as small warning lights, UI alerts, or local accents. Do not let them tint the whole image. Avoid sepia, orange wash, heavy warmth, or posterized colour.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones, and the true colour of his hair, beard, eyes and clothing exactly as they appear in the reference photo. NEVER render a person greyscale, monochrome, sepia, duotone, desaturated, or as a flat colour-tinted cutout, and never drain the colour out of a face to help it blend into the background. Background and graphic elements MAY be stylised, muted or monochrome where the design calls for it - the person must not be. If the composition needs contrast or drama, take it from the background, lighting or the headline, never by desaturating the subject.

HEADLINE SAFE ZONE - NON-NEGOTIABLE
Do not render any headline text. A caption is typeset over this image afterwards, so the composition must guarantee clean space for it in the TOP QUARTER of the frame.

Reserve the top 25% of the image height, across the full width, as clean background. Read it as a band: divide the frame into four equal horizontal strips and the whole top strip must be background. No head, hair, hat, glasses, shoulder, hand, prop, device, logo, lamp, screen, window or bright highlight may enter that band. The highest point of the tallest person must sit clearly below that line, with open air above it.

The band must be usable negative space: dark or mid-dark, smooth, low detail and low contrast, with no busy texture and no bright edges, so bold caption text dropped on it stays readable. Deep shadow, a plain wall, or a soft falloff of the same room are ideal. It must read as natural headroom in the same room under the same light, never as a graphic element.

Get the space with the camera, not with an overlay: pull the camera back or raise it slightly, and place the people lower in the frame. Do not shrink the people to thumbnail-card size to find room; the reserve is headroom above them, and faces must stay large and readable.

Do not create the space with a graphic: no letterbox bars, black bands, strips, banners, boxes, panels, empty rectangles, blurred, mirrored or duplicated strips, or split caption areas. No horizontal seam anywhere. The photograph reaches every edge of the frame. Any darkness must read as natural lighting and shadow in a real room. THE IMAGE IS ONE CONTINUOUS PHOTOGRAPH. If the space cannot be given without adding a band or a seam, pull the camera back further rather than adding one.

Final check before returning the image: the top quarter must contain background only. If any person, prop, logo or highlight reaches into it, recompose and try again.

NO RENDERED WORDS (NON-NEGOTIABLE)
Do not render any words, letters, numbers, captions, subtitles or watermarks anywhere in the image. If the ART DIRECTION below asks for text, ignore that part. Brand logos are allowed only if the ART DIRECTION explicitly asks for one.

EPISODE CONTEXT (for tone only - do not render any of this as text)
{{CONTEXT}}

ART DIRECTION
{{CUSTOM}}

Output a single 16:9 image. The ONE REAL PHOTOGRAPH, PEOPLE AND FRAMING, HEADLINE SAFE ZONE, and NO RENDERED WORDS rules above always apply and override anything in the ART DIRECTION that contradicts them. Follow the natural cinematic colour grade unless the ART DIRECTION explicitly asks for a different colour treatment.
```

**`Duo Thumbnail`**

```
Create a 16:9 YouTube thumbnail for a punchy Bitcoin and sovereign-tech commentary show.

SUBJECTS
Image 1 is the host. Every image after the first is a guest. Reproduce each person's likeness faithfully. Each person's facial expression should read as: {{VIBE}}.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph, as if all of these people were in the room at the same time. Everyone must share the same camera, perspective, lighting direction and colour temperature, cast natural shadows, and sit at a believable scale relative to each other and the background. Do not paste, cut out, collage or superimpose anyone. No cut-out outlines, hard edges, halos, mismatched lighting on a face, or floating heads. Do not line people up in a rigid, evenly spaced row. Use natural spacing, slight overlap and depth, and let people relate to the scene and to each other.

PEOPLE AND FRAMING
Show every person at least from the top of the head to the upper chest. Never crop the top of a head, and never cut a face off at the chin or neck. Keep all faces fully visible and at a similar scale, none hidden behind another person. Avoid stiff, identical passport stares: let people look naturally, some toward the camera and some at the scene, with expressions that fit {{VIBE}}.

HOUSE STYLE
Create a polished cinematic editorial image with natural, professionally graded colour. Use a dark, realistic background, but keep the overall palette neutral and believable. Red, amber, and orange may appear only as small warning lights, UI alerts, or local accents. Do not let them tint the whole image. Avoid sepia, orange wash, heavy warmth, or posterized colour.

COLOUR - NON-NEGOTIABLE
Render EVERY person in full, natural colour: lifelike skin tones, and the true colour of their hair, beards, eyes and clothing exactly as they appear in the reference photos. NEVER render a person greyscale, monochrome, sepia, duotone, desaturated, or as a flat colour-tinted cutout, and never drain the colour out of faces to help them blend into the background. This applies to the host and every guest equally. Background and graphic elements MAY be stylised, muted or monochrome where the design calls for it - the people must not be. If the composition needs contrast or drama, take it from the background or lighting, never by desaturating the subjects.

HEADLINE SAFE ZONE - NON-NEGOTIABLE
Do not render any headline text. A caption is typeset over this image afterwards, so the composition must guarantee clean space for it in the TOP QUARTER of the frame.

Reserve the top 25% of the image height, across the full width, as clean background. Read it as a band: divide the frame into four equal horizontal strips and the whole top strip must be background. No head, hair, hat, glasses, shoulder, hand, prop, device, logo, lamp, screen, window or bright highlight may enter that band. The highest point of the tallest person must sit clearly below that line, with open air above it.

The band must be usable negative space: dark or mid-dark, smooth, low detail and low contrast, with no busy texture and no bright edges, so bold caption text dropped on it stays readable. Deep shadow, a plain wall, or a soft falloff of the same room are ideal. It must read as natural headroom in the same room under the same light, never as a graphic element.

Get the space with the camera, not with an overlay: pull the camera back or raise it slightly, and place the people lower in the frame. Do not shrink the people to thumbnail-card size to find room; the reserve is headroom above them, and faces must stay large and readable.

Do not create the space with a graphic: no letterbox bars, black bands, strips, banners, boxes, panels, empty rectangles, blurred, mirrored or duplicated strips, or split caption areas. No horizontal seam anywhere. The photograph reaches every edge of the frame. Any darkness must read as natural lighting and shadow in a real room. THE IMAGE IS ONE CONTINUOUS PHOTOGRAPH. If the space cannot be given without adding a band or a seam, pull the camera back further rather than adding one.

Final check before returning the image: the top quarter must contain background only. If any person, prop, logo or highlight reaches into it, recompose and try again.

NO RENDERED WORDS (NON-NEGOTIABLE)
Do not render any words, letters, numbers, captions, subtitles or watermarks anywhere in the image. If the ART DIRECTION below asks for text, ignore that part. Brand logos are allowed only if the ART DIRECTION explicitly asks for one.

EPISODE CONTEXT (for tone only - do not render any of this as text)
{{CONTEXT}}

ART DIRECTION
{{CUSTOM}}

Output a single 16:9 image. The ONE REAL PHOTOGRAPH, PEOPLE AND FRAMING, HEADLINE SAFE ZONE, and NO RENDERED WORDS rules above always apply and override anything in the ART DIRECTION that contradicts them. Follow the natural cinematic colour grade unless the ART DIRECTION explicitly asks for a different colour treatment.
```

**`Roundtable Thumbnail`**

```
Create a 16:9 YouTube thumbnail for a punchy Bitcoin and sovereign-tech commentary show.

SUBJECTS
Image 1 is the host. Every image after the first is a guest. Reproduce each person's likeness faithfully. Arrange the host and all guests across the frame as an ensemble lineup, like a film poster: every face clearly visible, similar scale, none cropped or hidden behind another. Each person's facial expression should read as: {{VIBE}}.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph, as if the whole group was photographed together in one shot. Everyone must share the same camera, perspective, lighting direction and colour temperature, cast natural shadows, and sit at a believable scale relative to each other and the background. Do not paste, cut out, collage or superimpose anyone. No cut-out outlines, hard edges, halos, mismatched lighting on a face, or floating heads. Do not line people up in a rigid, evenly spaced row: keep the lineup readable but give it natural spacing, slight overlap and a little depth.

PEOPLE AND FRAMING
Show every person at least from the top of the head to the upper chest. Never crop the top of a head, and never cut a face off at the chin or neck. Keep all faces fully visible and at a similar scale, none hidden behind another person. Avoid stiff, identical passport stares: let people look naturally, some toward the camera and some at the scene, with expressions that fit {{VIBE}}.

HOUSE STYLE
Create a polished cinematic editorial image with natural, professionally graded colour. Use a dark, realistic background, but keep the overall palette neutral and believable. Red, amber, and orange may appear only as small warning lights, UI alerts, or local accents. Do not let them tint the whole image. Avoid sepia, orange wash, heavy warmth, or posterized colour.

COLOUR - NON-NEGOTIABLE
Render EVERY person in full, natural colour: lifelike skin tones, and the true colour of their hair, beards, eyes and clothing exactly as they appear in the reference photos. NEVER render a person greyscale, monochrome, sepia, duotone, desaturated, or as a flat colour-tinted cutout, and never drain the colour out of faces to help them blend into the background. This applies to the host and every guest equally - an ensemble lineup must not become a row of grey cutouts. Background and graphic elements MAY be stylised, muted or monochrome where the design calls for it - the people must not be. If the composition needs contrast or drama, take it from the background or lighting, never by desaturating the subjects.

HEADLINE SAFE ZONE - NON-NEGOTIABLE
Do not render any headline text. A caption is typeset over this image afterwards, so the composition must guarantee clean space for it in the TOP QUARTER of the frame.

Reserve the top 25% of the image height, across the full width, as clean background. Read it as a band: divide the frame into four equal horizontal strips and the whole top strip must be background. No head, hair, hat, glasses, shoulder, hand, prop, device, logo, lamp, screen, window or bright highlight may enter that band. The highest point of the tallest person must sit clearly below that line, with open air above it.

The band must be usable negative space: dark or mid-dark, smooth, low detail and low contrast, with no busy texture and no bright edges, so bold caption text dropped on it stays readable. Deep shadow, a plain wall, or a soft falloff of the same room are ideal. It must read as natural headroom in the same room under the same light, never as a graphic element.

Get the space with the camera, not with an overlay: pull the camera back or raise it slightly, and place the people lower in the frame. Do not shrink the people to thumbnail-card size to find room; the reserve is headroom above them, and faces must stay large and readable.

Do not create the space with a graphic: no letterbox bars, black bands, strips, banners, boxes, panels, empty rectangles, blurred, mirrored or duplicated strips, or split caption areas. No horizontal seam anywhere. The photograph reaches every edge of the frame. Any darkness must read as natural lighting and shadow in a real room. THE IMAGE IS ONE CONTINUOUS PHOTOGRAPH. If the space cannot be given without adding a band or a seam, pull the camera back further rather than adding one.

Final check before returning the image: the top quarter must contain background only. If any person, prop, logo or highlight reaches into it, recompose and try again.

NO RENDERED WORDS (NON-NEGOTIABLE)
Do not render any words, letters, numbers, captions, subtitles or watermarks anywhere in the image. If the ART DIRECTION below asks for text, ignore that part. Brand logos are allowed only if the ART DIRECTION explicitly asks for one.

EPISODE CONTEXT (for tone only - do not render any of this as text)
{{CONTEXT}}

ART DIRECTION
{{CUSTOM}}

Output a single 16:9 image. The ONE REAL PHOTOGRAPH, PEOPLE AND FRAMING, HEADLINE SAFE ZONE, and NO RENDERED WORDS rules above always apply and override anything in the ART DIRECTION that contradicts them. Follow the natural cinematic colour grade unless the ART DIRECTION explicitly asks for a different colour treatment.
```

Move `{{CUSTOM}}` wherever you like — it's a token precisely so its position is yours to change without touching n8n. Leaving it near the end works well because later instructions tend to win when they conflict with earlier ones. When Jonny replies `default`, `{{CUSTOM}}` renders empty and the `ART DIRECTION` heading is left dangling with nothing under it; harmless, and Nano Banana ignores it.

---

## Airtable-side automation & view logic (NOT n8n)

> **These run inside Airtable, not n8n.** There is no SDK file or n8n node for them — if the thumbnail behaviour changes and nothing in n8n explains it, look here. Maintained in the Airtable base UI (`app8Xw9Tq0XLjhmp9`), not this repo. Added 2026-06-30 to gate *when* an episode is ready for artwork and kill the "forgot the guest" foot-gun.

### 1. Generate-trigger view gate (certain types, OR anything with a guest)

> **Transcribed from the live Airtable UI by Jonny on 2026-10-23. Treat this as the source of truth.** The Airtable API exposes view **names and IDs but not filter conditions**, so this cannot be verified programmatically. Every earlier version of this list was reconstructed and several lines were wrong. Re-screenshot if it changes; never infer it from behaviour.

The trigger view (`Ready for 16X9 Thumbnail *J*`, `viwqgtrry8n6yNgqW`) reads:

```
Summary is not empty
Thumbnail Caption is not empty
Thumbnails is empty
Status is none of  "Awaiting Thumbnail Pick", "Generating Artwork", "Published", "Suspended", "Artwork Ready"
(any of the following):
    Type is any of  "Take", "2 Sats", "Read", "Clip"
    Guests is not empty
Type is none of  "Audionauts"
(any of the following):              ← the Read cover gate, added 2026-10-23
    Type is not "Read"
    Book Cover is not empty
```

**The last group must be "Any of", not "All of".** Written as `All of: Type is Read AND Book Cover is not empty`, it is a single condition ANDed with everything else, so it is false for every non-Read episode and **nothing but Reads can enter the view**. Written as `Any of: Type is not Read OR Book Cover is not empty`:

| Record | Group result |
|---|---|
| Take / Chat / Clip / 2 Sats / Roundtable | `Type is not Read` is true, so it passes. |
| Read with a cover | second condition true, so it passes. |
| Read without a cover | both false, so it is blocked, which is the point. |
| Audionauts | group passes, but the separate `Type is none of "Audionauts"` still blocks it. |

The OR group does **not** let Audionauts in; that is a separate top-level condition.

> **Confirmed live 2026-10-23: the view now uses the Any-of form above.** Jonny corrected it the same day.

**Things older docs got wrong (all confirmed against the live filter on 2026-10-23):**

- **`Transcript is not empty` is not in the view.** It never was, in this transcription.
- **`Custom Image Prompt is not empty` is not in the view.** The art direction is optional and artwork does not wait for it. Several docs, the packaging message and the assistant's System Map claimed otherwise; all corrected.
- **`Status` excludes five values, not two.** `Published`, `Suspended` and `Artwork Ready` also keep a record out.
- **`Read` is allowed**, gated on `Book Cover`. `Audionauts` is the only type hard-excluded.

⚠️ **Re-generating artwork still needs a `Status` change as well as clearing `Thumbnails`.** Deleting the four `Thumbnails` rows satisfies `Thumbnails is empty`, but the episode is still `Awaiting Thumbnail Pick`, so it stays out of the view and nothing happens, silently. Set `Status` to something outside the five excluded values (for example `Approved`).

⚠️ **Entering the view is not the same as being auto-artable.** Auto-art comes from the `Artwork Settings` table, not from this view's Type list. A type can enter and still be routed to `Awaiting Manual Artwork` if its `Generate 16x9` box is off. The view decides *who gets a chance*; `Artwork Settings` decides *what is generated*.

⚠️ **A row already sitting in the view will not fire on its own.** The trigger polls on `Last Modified Time` advancing past its stored cursor. A record that entered through a view-filter change, or whose timestamp is older than the cursor, sits there indefinitely with no error. Touch the record (any field) to advance the timestamp. This is exactly what stalled the first Read on 2026-10-23; the run fired 10 seconds after `Status` was set.

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
**Approved Episode → Plan Generate → Auto-artable Type? →** *(true)* **Mark Generating → Delete Old Thumbnails → Fetch Mood References → Fetch Prompts → Fetch Guests → Resolve Vibes → Plan Downloads → Download Image → Image To Base64 → Build Image Requests → Generate Thumbnail (Nano Banana) → Extract Images → Create Thumbnail Row → Upload 16x9 → Collect Thumbnails → Send Thumbnail Options → Send Pick Instructions → Mark Awaiting Pick** ; *(false)* **Mark Manual Artwork → Notify Manual**

1. **Plan Generate** (Code) - reads the episode (`Title`, `Thumbnail Caption`, `Summary`, `Type`, `Guests` ids, and the `Thumbnails` reverse-link ids), derives `layout` (`solo` for Take, `duo` for Chat/Clip, `roundtable` for Roundtable) and `autoArt` (true for Take/Chat/Clip/Roundtable), builds the `records[]=` delete query. **Filters the host out of `guestIds`** (2026-07-25, see the host-in-Guests gotcha below): the host is always composited from `Thumbnail References`, so his own `Guests` record (`recs8srWCoJwDuzLn`, "Guy", hardcoded as `HOST_GUEST_REC_ID`) is stripped here — otherwise he's rendered twice in the frame. The filter tolerates both id-string and `{id}`-object shapes. `guestFilter`, `Plan Downloads`, and `Build Image Requests` all derive from this filtered `guestIds`, so the exclusion propagates through the whole duo/roundtable path.
2. **Auto-artable Type?** (IF, boolean on `autoArt`) - true → generate; false → the manual branch below.
3. **Mark Generating** (HTTP PATCH) - sets Episode `Status = Generating Artwork` immediately, so the episode leaves the **`Ready for 16X9 Thumbnail`** view (via that view's `Status is not "Generating Artwork"` clause) and a mid-run failure can't re-loop the trigger. This only covers the *mid-run* window, before the `Thumbnails` rows exist; once they do, `Thumbnails is empty` is what keeps the episode out.
4. **Delete Old Thumbnails** (HTTP DELETE, `neverError`) - removes prior rows (empty query / 422 swallowed on first run).
5. **Fetch Mood References** (HTTP GET) - the whole `Thumbnail References` (host) library.
5b. **Fetch Prompts** (HTTP GET) - the whole `Thumbnail Prompts` table (URL uses the table ID `tblhG1nw2P1k3CBVU`, robust to renames). Read by `Build Image Requests` via `$('Fetch Prompts')`; wired between `Fetch Mood References` and `Fetch Guests` (position only needs to be upstream of `Build Image Requests`). Added 2026-07-06.
6. **Fetch Guests** (HTTP GET, `executeOnce`, `neverError`) - the `Guests` table **filtered server-side** to this episode's linked guests via `filterByFormula=OR(RECORD_ID()='…')` (built as `guestFilter` in `Plan Generate`; `FALSE()` when there are none). So its output is exactly the episode's guest(s), and there's no 100-row pagination risk.
7. **Resolve Vibes** (Code) - maps the moods **Jonny picked** (`Plan Generate.moods`, from the episode's `Thumbnail Moods`) onto the `Thumbnail References` library by name, case-insensitively, and cycles them across the 4 slots, attaching one host reference photo per slot. Unknown names are dropped; **if nothing matches (or the field is empty) it uses `Neutral` for all four slots** (2026-10-22), falling back to the whole library only if the Neutral row has no photo. Reads use picks like any other type (2026-10-28); the pick is the facial expression. It emits `moodSource` (`picked` / `default-neutral` / `fallback-all-moods`) so an execution shows which happened. **Throws only if no library row has a usable `Reference Photo` at all.** *(2026-08-04: replaced `Build Mood Prompt` → `Pick Moods (Gemini)` → `Resolve Vibes`; the first two nodes are deleted, saving one Gemini call per run.)*
8. **Plan Downloads** (Code, `executeOnce`) - emits one task per image: 4 `host` tasks (slot + photo url) then, for `duo`/`roundtable`, one `guest` task per `Fetch Guests` record that has a `Headshot` (already filtered to this episode). Host tasks always come first so indices stay aligned downstream. ⚠️ **Fixed 2026-08-04:** this branch previously read `if (plan.layout === 'duo')` only, so **Roundtable episodes fetched zero guest photos** and `Build Image Requests` fell through its no-guest-images guard to the `Solo Thumbnail` prompt — a Roundtable rendered as a solo host shot with no error anywhere. Now `duo || roundtable`.
9. **Download Image** (HTTP GET file, runs N times) → **Image To Base64** (Extract From File → `dataB64`) - downloads + base64s every task in order (in-Code HTTP is unavailable on this runner).
10. **Build Image Requests** (Code) - **fetches the prompt templates from the `Prompts` Airtable table** (via `$('Fetch Prompts')`), maps `layout` → row `Name` (`solo → Solo Thumbnail`, `duo → Duo Thumbnail`, `roundtable → Roundtable Thumbnail`), and renders the chosen template by substituting `{{HOOK}}`/`{{CONTEXT}}`/`{{VIBE}}`/**`{{CUSTOM}}`** (`{{VARIATION}}` always renders empty). It then PREPENDS a required, first-class per-option shot direction: tight close-up, medium eye-level, wider environmental, or asymmetric off-centre. Since 2026-10-07 this is stated as required and placed ahead of the template, not appended and labelled secondary; it preserves subject count and says nothing about colour. Since 2026-10-30 it also restates the `SAFE_ZONE` (top quarter of the frame reserved for the caption) directly after the variant line, so the shot direction cannot out-shout the template's reserved area. The node zips `Plan Downloads` tasks with the base64 items by index, groups host-by-slot + collects guest parts, then for each of the 4 slots builds a request (host image first, then all guest images for duo/roundtable). It falls back to the `Solo Thumbnail` row if a duo/roundtable episode has no guest images; a missing prompt row throws `Missing prompt row "..."`.
11. **Generate Thumbnail (Nano Banana)** (HTTP POST `gemini-3-pro-image`) - runs 4x, 120s timeout.
12. **Extract Images** (Code) - pulls base64 from `candidates[0].content.parts[].inline_data.data`, carries mood/option/episode through.
13. **Create Thumbnail Row** (HTTP POST Thumbnails, 4x) → **Upload 16x9** (HTTP POST content endpoint, 4x) - row then `16x9` upload, aligned by index.
14. **Collect Thumbnails** (Code) - gathers the uploaded image URLs. Throws a clear error if fewer than 2 succeeded (the Thumbnails rows still exist for a manual pick), then **pads `urls`/`moods` to 4** by repeating the last image so the static album never has an empty slot. → **Send Thumbnail Options** (Telegram `sendMediaGroup`, **4 static media slots** referencing `$json.urls[0..3]`; retry 5x/5s) → **Send Pick Instructions** (Telegram; retry 5x/5s) → **Mark Awaiting Pick** (PATCH Episode `Status = Awaiting Thumbnail Pick`).

**Manual branch (non Take/Chat/Clip/Roundtable):** **Mark Manual Artwork** (PATCH `Status = Awaiting Manual Artwork`, which drops the episode out of the trigger view so it can't re-loop) → **Notify Manual** (Telegram: "type X, art this one manually").

### Path 2 - Select

`Resolve Selected` fans out into **two parallel branches** off the one trigger. A **third, independent branch** hangs directly off the `Thumbnail Selected` trigger: the **multi-select guardrail** (`Check Extra Picks → Warn Multiple Picks`, added 2026-07-21) — see the guardrail note under Gotchas. It does not touch the two processing branches.

**Reject + status branch:**
**Thumbnail Selected → Resolve Selected → Get Episode Thumbnails → Compute Rejects → Reject Siblings → Mark Episode Artwork Ready → Confirm Thumbnail Set**

1. **Thumbnail Selected** - Airtable Trigger on the Thumbnails **`Ready for 1X1 & 9X16 Thumbnails *J*`** view (`viw7AHjnX9ZkvIrKo`, `Status = Selected`, no type filter — renamed 2026-08-20 from `Selected`).
2. **Resolve Selected** (Code) - reads the selected row id, its `Episode` link id, the row's `Caption`, and the `16x9` attachment URL/type. **(2026-07-26, UNTESTED)** now loops `$input.all()` and processes the **first row that actually has an `Episode` link**, skipping orphan `Selected` rows (Selected but unlinked); previously it read only `$input.first()` and returned `[]` when that first row had no episode, which stalled the run and stranded a real pick sitting behind an orphan in the same poll (exec #1186). Also (2026-07-08) detects which reversions already exist: emits `need1x1` / `need9x16` (true = that attachment is missing) plus `url1x1` / `url9x16` (the pre-existing attachment URLs, if any). These feed the reversioning branch. **(2026-08-20)** it additionally reads the new **`Episode Type`** lookup off the row, unwraps it from its array, and emits `episodeType` plus a boolean **`reversionOk`** (`false` for `Read` / `Clip` / `Audionauts`, from the `NO_REVERSION` list at the top of the node). Only the reversioning branch and the Telegram confirmation read it — the reject/status branch ignores it entirely and runs for every type.
3. **Get Episode Thumbnails** (HTTP GET) - fetches the episode to read its full `Thumbnails` id list + Title.
4. **Compute Rejects** (Code) - builds a batch PATCH body setting every other thumbnail row to `Rejected`; also carries `selectedRowId` through.
5. **Reject Siblings** (HTTP PATCH Thumbnails, `neverError`) - applies it (empty body is swallowed when there are no siblings).
6. **Mark Episode Artwork Ready** - PATCH Episode `Status = Artwork Ready` **and** `Thumbnails = [selectedRowId]`, which unlinks the rejected options from the episode (only the chosen row stays linked). Because Airtable links are bidirectional, the rejected rows' own `Episode` link also clears.
7. **Mark Selected Final** - PATCH the chosen `Thumbnails` row `Status = Final` (typecast). This moves it **out of the select view** so the poll trigger's view is empty between picks (see gotcha below). The reversioning branch still uploads to it by row id, so status doesn't matter there.
8. **Confirm Thumbnail Set** - Telegram confirmation.

**Reversioning branch (Phase B), reworked 2026-07-08 to be idempotent + notify:**
**Resolve Selected → Needs Reversion? → 16x9 Exists? → Download Selected 16x9 → Selected To Base64 → Fetch Reversion Prompts → Build Reversion Requests → Generate Reversions (Nano Banana) → Extract Reversions → Upload Reversion → Collect Reversions → Send Reversions** (plus **Warn No 16x9 Source** on the `16x9 Exists?` false branch)

8. **Needs Reversion?** (IF) - single condition **`reversionNeeded`** (`need1x1 || need9x16`, where `needX = wantX && missing`). `want1x1` / `want9x16` come from the `Artwork Settings` table for the episode's `Type` (2026-10-06; replaced the hardcoded `NO_REVERSION` / `reversionOk`). False dead-ends, so nothing downloads or regenerates.
8b. **16x9 Exists?** (IF, added 2026-09-04) - single condition: `sixteenUrl` from `Resolve Selected` is non-empty. True continues to the download. False runs **Warn No 16x9 Source** (Telegram, HTML): tells Jonny the selected row has no 16:9 to build from (usually hand-deleted images) and how to regenerate from scratch (delete the Thumbnails row, set the episode back to `Approved`). Pre-2026-09-04 this situation crashed `Download Selected 16x9` with an empty-URL error (the 2026-07-31 `Thumbnail-uGMKKG` failure).
9. **Download Selected 16x9** (HTTP GET, file) - fetches the chosen 16:9 from its Airtable attachment URL (no auth; signed URL).
10. **Selected To Base64** (Extract From File, `binaryToPropery → dataB64`) - in-Code HTTP is unavailable on this task runner, so the image is base64'd via a node.
11. **Fetch Reversion Prompts** (HTTP GET) - reads the `Thumbnail Prompts` table (same table ID as `Fetch Prompts`). Wired inline here so `Build Reversion Requests` can read it via `$('Fetch Reversion Prompts')`; because this node sits between `Selected To Base64` and `Build Reversion Requests`, the Code node reads the base64 via `$('Selected To Base64')` (not `$json`).
12. **Build Reversion Requests** (Code) - emits **only the missing** aspect ratios (filters targets by `need1x1` / `need9x16`; returns `[]` if none, which short-circuits the rest of the branch). Each request feeds the 16:9 inline + the `Reversion 1x1` / `Reversion 9x16` prompt (from Airtable, `{{HOOK}}` = `Caption`) + `imageConfig.aspectRatio`. `1K`.
13. **Generate Reversions (Nano Banana)** (HTTP POST `gemini-3-pro-image`, runs 1-2x depending on how many were missing).
14. **Extract Reversions** (Code) - pulls base64 per item, carries the target field name (`1x1` / `9x16`) + `filename` + selected row id.
15. **Upload Reversion** (HTTP POST content endpoint, 1-2x) - uploads each into the selected row's `1x1` / `9x16` field (field name is in the URL path).
16. **Collect Reversions** (Code) - emits **one item per newly-generated image**. Resolves each new image's URL from the `Upload Reversion` response by **matching the uploaded `filename`** (NOT by field name — the `uploadAttachment` response keys `fields` by field ID, and can also contain pre-existing attachments; see gotcha). No pre-existing versions, no padding.
17. **Send Reversions** (Telegram `sendPhoto`, runs once per item) - posts each new reversion to the group as its own message (`{{ $json.photoUrl }}` + caption, HTML). So a re-select that regenerated only the 1:1 sends exactly one message with the new 1:1; a first-time pick that made both sends two messages.

**Confirm Thumbnail Set** (on the reject branch) prints the precomputed `confirmReversionText` that `Resolve Selected` now emits (2026-10-06), so the closing line always matches what the reversion branch does: no enabled ratios for the type, the 16:9-source-missing case, or which wanted version(s) are being generated / already in place.

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

**Driving it from Telegram:** the `BA: Telegram Airtable Assistant` (`Hx8Ul6M41fM8HuxU`) has an "Artwork Revisions" skill in its system message — asking the bot "redo the 9x16 for BA-xxxx, more red" makes it find the episode's `Final` thumbnail row and propose the `Revision Brief` + `Revision Targets` + `Status = Revising` write for one-tap approval. Editing the row directly in Airtable is the permanent manual equivalent. If no ratio is named, the assistant defaults to all three (stated in the approval summary).

---

## Gotchas / things to verify on first run

- **Never ship a layout template with no colour instruction.** Removing the hardcoded palette on 2026-08-04 left `Solo` / `Duo` / `Roundtable Thumbnail` with **nothing at all about colour**, and Nano Banana filled the vacuum by desaturating the *people* to make them sit against a busy graphic background — a vivid blue-and-orange circuitry backdrop with three grey-toned faces in front of it. Jonny reported it as "the thumbnail artwork often comes through as greyscale" (Automation Upgrades `recQmzSDextFHnXAa`). **It was not the reference photos:** `Curious/Intriguing` is a full-colour green-screen shot with an obviously ginger beard, which the render turned grey. Fixed 2026-08-11 by adding a **`COLOUR — NON-NEGOTIABLE`** block to all three layout templates, plus a one-line version in `Reversion 1x1`, `Reversion 9x16` and `Artwork Revision` so a reframe or a briefed redo can't re-grey a corrected image. The rule deliberately **permits** monochrome backgrounds and forbids it only on people, which is exactly the line Jonny drew. If you ever rewrite these templates, carry that block across.
- **A push is not a deploy — publish it.** n8n keeps a **draft** version and an **active** version, and an SDK/MCP push only updates the draft. `get_workflow_details` returns both: if `versionId` ≠ `activeVersionId`, the code you are reading in the editor **is not the code that runs**. This is exactly how the 2026-08-04 mood handover sat dormant for a day while executions quietly ran July's Gemini mood-picker and looked, from the outside, like a logic bug (see the 2026-08-11 note at the top). Publish, then re-check that the two IDs match.
- **A field name that only exists in the docs is invisible until it silently degrades.** `Plan Generate` read `f['Thumbnail Moods']` against a field genuinely named `Moods`, and because `Resolve Vibes` is deliberately forgiving — an unmatched mood silently becomes Neutral rather than throwing — the mistake produced plausible artwork instead of an error. Forgiving fallbacks hide typos: when one exists, check `moodSource` in the execution (`picked` / `default-neutral`) rather than trusting that the run succeeded.
- **Paste the Thumbnails table ID.** The `Thumbnail Selected` trigger's Table field is a **placeholder** - the Airtable Trigger needs a real `tbl...` ID (it can't use the table name like the HTTP nodes do). Open the node and set the Table to your `Thumbnails` table before activating. Also add a **`Last Modified Time`** field (watching all fields) to the Thumbnails table, or the trigger never fires.
- **Reverse-link field must be named `Thumbnails`.** The clear-old (Path 1) and reject-siblings (Path 2) steps read `fields.Thumbnails` off the Episode. If Airtable named the auto reverse field something else, rename it to `Thumbnails`.
- **Cost, not free.** Nano Banana is paid (~$0.039/image); the key must be on a billing-enabled project.
- **API version / response shape.** Both Gemini calls use `v1beta`. Image uses `responseModalities`, text uses `responseMimeType`. If a call 4xxs, that's the most likely thing to tweak. `Extract Images` reads both `inline_data` and `inlineData`.
- **`IMAGE_OTHER` = prompt, not a hard block.** Nano Banana returns HTTP 200 with `finishReason: IMAGE_OTHER` ("could not generate the image, try rephrasing") when the prompt is too dense/contradictory — distinct from `IMAGE_SAFETY` (a real policy block). The image nodes are set to `neverError` and `Extract Images` / `Extract Reversions` surface the actual `finishReason` + message in their thrown error, so a failed run tells you why. The prompts use a lean `HOOK / CONTEXT / VIBE / INSTRUCTIONS` structure (mirroring Jonny's proven manual prompt) with framing/lighting per-option variation rather than clashing colour palettes — that was the original cause of all-4 `IMAGE_OTHER` failures (2026-06-22).
- **Mood library works with 1+ rows.** With a single mood, all 4 options use it (different compositions). The workflow only throws if zero rows have a usable `Reference Photo`. More moods = a more selective, varied set.
- **Gemini credential is "Header Auth", and the Gemini nodes default to AgentMail** until you point them at `Gemini API Key [n8n]` - see Required credentials above.
- **Artwork does NOT wait for `Custom Image Prompt` (corrected 2026-10-23).** The view does not require it. If Jonny says "the thumbnails never came", do not blame this field: check the poller cursor and the record's `Last Modified Time` first (see the trigger-cursor gotcha).
- **Mood names are matched against `Thumbnail References`, so renaming a mood row orphans past picks.** Matching is by name (case-insensitive), not by record ID, because `Thumbnail Moods` is plain text. Rename a mood in the library and any episode whose `Thumbnail Moods` still says the old name silently uses `Neutral`. The execution shows which happened: `Resolve Vibes` emits `moodSource` = `picked` or `default-neutral`.
- **One mood still needs four distinct requests.** `BA-epafwr` proved that mood and `{{CUSTOM}}` alone can leave every request effectively identical. Since 2026-09-09, `Build Image Requests` gives each slot a different composition direction even when all four share one mood. Updated 2026-10-07: these are now REQUIRED and PREPENDED, not appended and "secondary", because labelling them secondary let a detailed `{{CUSTOM}}` flatten all four options into the same picture (`BA-C8Uwej`). Keep them free of palette, text-position, and subject-count changes, but do not demote them below `{{CUSTOM}}`.
- **Strip prescriptive art direction out of the templates or it fights `{{CUSTOM}}` — but make the house style an explicit *default*, not an absence.** A template that flatly hardcodes lighting or palette will contradict Jonny's prompt, and contradictory prompts are the known cause of `IMAGE_OTHER` (see above). Deleting the palette outright is the opposite mistake: it cost the show its brand look (see the next bullet). The 2026-08-18 shape solves both at once — state the palette, then end the block with "if the ART DIRECTION section below asks for a different look or different colours, follow the ART DIRECTION and ignore this block". The model gets one instruction with a stated precedence order instead of two competing ones. Paste-ready templates are in [Mood + prompt handover](#mood--prompt-handover-2026-08-04).
- **A prompt that says nothing about colour is not neutral — the model picks its own default, and its default is blue.** Between 2026-08-04 and 2026-08-18 the layout templates named no palette at all. Nano Banana filled the gap with cool blue/cyan circuitry backdrops on AI and tech topics, and the back catalogue's warm orange-on-near-black identity quietly disappeared. Jonny spotted it by eye, comparing new thumbnails against old ones, not from any error. **Nothing failed and nothing logged** — an unstated preference degrades silently, which makes prompt deletions far riskier than they look. Related trap: `Custom Image Prompt` renders into the strongest position in the whole prompt (`ART DIRECTION`, last before the output constraints), but in practice Jonny writes composition notes there ("Thumbnail caption in white"), not colour direction. Do not assume a free-text field is carrying the art direction just because it *could*.
- **Album = static 4 slots, padded.** The Telegram node builds `sendMediaGroup` from its **static per-slot config** (`urls[0..3]`), not from an array expression — binding the whole `media` collection to `{{ ...mediaGroup }}` does NOT work (Telegram throws "can't parse InputMedia: media not found"). So `Collect Thumbnails` pads short sets to 4 by repeating the last image; on the rare `<4` run the album shows a duplicate (cosmetic — the real Thumbnails rows in Airtable still have the correct count, and picking is by row Status). Throws if `<2`.
- **`IMAGE_OTHER` reliability lever = `imageSize`.** Both Path 1 generation (`IMAGE_SIZE` in `Build Image Requests`) and Phase B reversioning (`Build Reversion Requests`) run at **`1K`**; 2K caused frequent `IMAGE_OTHER` "could not generate" failures (including on the reversioning step). Bump back to `2K`/`4K` only if reliability holds.
- **Telegram messages: force `parse_mode: HTML` + escape `&<>`.** The Telegram node otherwise parses message text as **Markdown**, where an underscore (e.g. the `_` in `Chat_171`) opens an italic span that never closes → `can't parse entities: can't find end of the entity at byte offset N`. Fix is two parts: (1) every message/caption sets `additionalFields.parse_mode = 'HTML'` (in HTML mode `_ * [` are not special, so `Chat_171` is safe); (2) `Plan Generate`, `Compute Rejects` and `Collect Thumbnails` emit a pre-escaped `titleHtml` / `captions` (escaping the only HTML-special chars `& < >`) which the message nodes use instead of the raw title. Escaping alone was NOT enough — the underscore is a Markdown problem, not an HTML one.
- **Flat vs nested trigger fields.** Code nodes read `rec.fields || rec` defensively; record `id` is always top-level.
- **Re-trigger safety — it's the `Thumbnails` link, NOT the `Status`, that gates generation.** The generate trigger view (`Ready for 16X9 Thumbnail`) gates on **`Thumbnails is empty`** (see "Generate-trigger view gate" above); it does **not** filter on `Status = Approved`. So what actually keeps a generated episode out of the view is that it now has **linked `Thumbnails` rows** — the `Thumbnails is empty` gate flips false the moment `Create Thumbnail Row` runs. The end-of-run `Status = Awaiting Thumbnail Pick` is incidental to view membership; `Mark Generating` (`Status = Generating Artwork`) only covers the *mid-run* window via the view's `Status is not "Generating Artwork"` clause, before the rows exist. **Corollary: anything that empties an episode's `Thumbnails` link re-arms generation** (see the `Mark Episode Artwork Ready` hazard below). Select doesn't modify the selected row's timestamp, so it doesn't re-fire; siblings move to `Rejected` and leave `Proposed`.
- **`Mark Episode Artwork Ready` must never write an empty `Thumbnails` (latent loop).** It PATCHes `Thumbnails = [selectedRowId]` to unlink the rejects. Because the generate view gates on `Thumbnails is empty`, if `selectedRowId` ever resolved empty the PATCH would blank the link and **silently re-arm the generate trigger** (regenerate → pick → repeat), with no error — writing `Thumbnails: []` is a valid PATCH. Currently safe: `selectedRowId` is the trigger row's top-level `id` and `Resolve Selected` only ever emits a row with a non-empty `Episode` link (2026-07-26: it now skips orphan `Selected` rows and picks the first *linked* row, rather than returning `[]` on the first row when that one is unlinked). But a future edit that lets the id resolve empty would loop. Optional hardening: build the fields object so the `Thumbnails` key is omitted when the id is falsy (or throw).
- **One pick per poll — multi-select guardrail (added 2026-07-21).** The whole select path is single-row: `Resolve Selected`, `Compute Rejects` and `Build Reversion Requests` all read `.first()`. So if **2+ `Thumbnails` rows are flipped to `Selected` inside one 60s poll window**, only the first is processed and the rest are **silently dropped** — and because the poll fires on `Last Modified Time` *advancing* (not presence), a dropped row never re-fires on its own; it just sits `Selected`. This stranded a real pick on 2026-07-06 (exec 1339/1340: two episodes' thumbnails Selected ~4s apart, Phase B ran for the wrong episode). **Guardrail:** a parallel **`Check Extra Picks`** Code node off the `Thumbnail Selected` trigger detects >1 valid Selected row and fires **`Warn Multiple Picks`** (Telegram, chat `1512868522`, HTML) listing the un-processed rows + their record IDs, so you re-flip them one at a time. It does **not** auto-process them. Normal one-pick-at-a-time flow is unaffected — the branch returns `[]` and stays silent. Full concurrent-pick support would need the select path rebuilt to fan out per-item (the reversion branch zips build↔response by index and matches uploads by filename — both collide across rows), deferred as higher-risk. **Update (2026-07-26, UNTESTED):** `Resolve Selected` now skips orphan `Selected` rows (no `Episode` link) and processes the first *linked* row, so an orphan sorting ahead of a real pick (exec #1186) no longer stalls the run or makes `Check Extra Picks` misname the row being processed. The 2+ *valid*-picks-per-poll limitation above is unchanged (downstream is still single-row). **UNTESTED (reconciled into `.sdk.js` 2026-07-26, not yet run end-to-end).**
- **Per-type variation rules are DATA (`Artwork Settings`), never a view filter (updated 2026-10-06; the 2026-08-20 lesson still stands).** The select view (`viw7AHjnX9ZkvIrKo`) must carry **no type filter**; it is the trigger for all three Path-2 branches, so a filter makes a pick of the excluded type do *nothing whatsoever* (rejects left `Proposed`, episode never `Artwork Ready`, pick never `Final`, no Telegram, no error). That was tried on 2026-08-20 and reverted the same day, and a type filter was briefly and wrongly added again on 2026-10-06 (also reverted the same day). The correct place is the **`Artwork Settings` table** (`tblv9BEEC6BrmBSe8`): `Plan Generate` reads `Generate 16x9`, `Resolve Selected` reads `Generate 1x1` / `Generate 9x16`, both via an HTTP fetch, and the `Episode Type` lookup on the Thumbnails table is what makes the type visible. **To change which types or ratios are generated, edit that table.** **UNTESTED end-to-end** (added 2026-10-06; needs a real pick).
- **Polling trigger fires on the timestamp *advancing*, not on presence.** The `Thumbnail Selected` Airtable trigger only emits a row whose `Last Modified Time` is newer than the cursor it stored last poll; a row simply sitting in the select view (with an old, unchanging timestamp) never re-fires. So **the chosen row must leave the select view after processing**, or stale picks pile up and confuse which row is "newest." `Mark Selected Final` does this (`Status = Final`). Two consequences: (1) the select view should be **empty between picks** — if it isn't, an old pick can shadow a new one in "Fetch Test Event"; (2) **every `update_workflow` + publish restarts the poller and re-baselines its cursor to ~now**, so after any push, test with a *fresh* flip and give it ~60-90s. To force a clean reset, toggle the workflow Active off/on.
- **Phase B fields + credential.** The selected row must have `1x1` and `9x16` attachment fields, or `Upload Reversion` 404s. `Generate Reversions (Nano Banana)` uses the same `Gemini API Key [n8n]` Header Auth credential as the Phase A image node; `Fetch Reversion Prompts` uses `Airtable [n8n] (PAT)` — verify neither points at AgentMail after a rebuild.
- **`uploadAttachment` response keys `fields` by field ID, not name, and includes *other* existing attachments (2026-07-08).** The Content API `POST .../uploadAttachment` returns the record with `fields` keyed by `fld…` IDs, and the object contains every populated attachment field (so after uploading a new `1x1`, the response still lists the pre-existing `9x16`). Do **not** index it by field name (`fields['1x1']` is always `undefined`). To read back the image you just uploaded, either scan `Object.values(fields)` and **match the array element by the `filename` you uploaded with** (what `Collect Reversions` does), or re-GET the row (GET responses key by name). Indexing by name caused a bug where the Telegram send-back showed the wrong aspect ratio (the pre-existing one) duplicated twice.
- **Phase B is idempotent (2026-07-08).** On (re-)select, `Resolve Selected` detects which of `1x1`/`9x16` are missing; the `Needs Reversion?` IF skips the whole branch if both exist, and `Build Reversion Requests` regenerates only the missing ones. So re-selecting a fully-arted row costs nothing, and deleting one attachment + re-selecting regenerates just that one. `Send Reversions` posts only what was regenerated.
- **Unlink is permanent for rejects.** On select, the rejected rows are dropped from the Episode `Thumbnails` link, so a later Path 1 re-run won't find/clear them via `fields.Thumbnails` — they linger as orphaned `Rejected` rows in the Thumbnails table. Delete by hand if you care about hygiene.
- **Airtable Trigger `Fields`** left empty on purpose; if you ever restrict it, include `Last Modified Time` and use commas with no spaces (a hook lints this).
- **Content type + guests.** Whether a type auto-generates is the `Generate 16x9` checkbox in the `Artwork Settings` table (2026-10-06), not a code list. A type with it off, or with no settings row, is sent to manual with `Status = Awaiting Manual Artwork`. For `Chat`/`Clip`/`2 Sats`/`Roundtable`, link the people via the Episodes `Guests` field and give each `Guests` row a `Headshot` — a guest with no headshot is silently skipped, and a duo/roundtable episode with **zero** usable guest images falls back to the `Solo Thumbnail` prompt.
- **Prompts live in Airtable now (2026-07-06).** To change any image-gen prompt, edit the `Thumbnail Prompts` table, NOT the workflow. Row `Name` must match exactly (`Solo Thumbnail` / `Duo Thumbnail` / `Roundtable Thumbnail`) or the run throws `Missing prompt row "..."`. The `Fetch Prompts` node must stay wired upstream of `Build Image Requests`. **This whole Airtable-prompt + Roundtable path is UNTESTED as of 2026-07-06 — run a real Roundtable episode (Type=Roundtable, guests linked with headshots, caption/summary/transcript filled) and confirm before relying on it.**
- **Host must not appear in `Guests` (host-rendered-twice bug, fixed 2026-07-25, UNTESTED).** The host's face is always composited from `Thumbnail References` (image 1). If Guy is **also** linked in the episode's `Guests` field, the duo/roundtable path adds his headshot a **second** time and Nano Banana draws him twice. This bit exec #1318 (episode `rec3YKGUCKqRBtgqP`, a `Clip`): its `Guests` held both Bitcoin Mechanic **and** Guy (`recs8srWCoJwDuzLn`, guy@bitcoinaudible.com), so the thumbnails came back as Guy + Guy + Bitcoin Mechanic. Root cause is data: `Guests` is meant for non-host participants only, and `Clip → inherit guest from parent` copies the parent's `Guests` wholesale — so a host sitting in the parent's `Guests` propagates to every clip. **Two-layer fix:** (1) **data** — keep the host out of every episode's `Guests` (remove Guy from the parent episode and any clips); (2) **code guard** — `Plan Generate` now strips `HOST_GUEST_REC_ID` (`recs8srWCoJwDuzLn`, "Guy") from `guestIds` so he can never be double-rendered regardless of the data. The id is hardcoded, matching this instance's convention (the Telegram chat id is hardcoded too, since `$env` is blocked). If the host's `Guests` record id ever changes, update `HOST_GUEST_REC_ID`. Not yet run end-to-end.
- **Index alignment.** `Build Image Requests` zips `Plan Downloads` tasks with the downloaded base64 items **by position**, relying on the HTTP node preserving item order (host slots 0-3 first, guests after). If you reorder `Plan Downloads`, keep hosts first.
- **Path 3 revisions clear-then-upload; revise one row at a time.** On a `Final` row the attachment fields are populated, so Path 3 blanks the targeted field(s) (`Clear Target Fields`) before uploading — sources are downloaded first so the self-edit isn't lost. Like the select path, the chain is built around a **single row's** targets; flipping several rows to `Revising` in one 60s poll is untested. Also: scope the `Revision Requested` view to `Status = Revising` so a row leaves it once the run sets `Status = Final` (else it can re-fire on the next edit). A malformed row (no brief / no valid target) **throws** and stays `Revising` until corrected.
- **Path 3 subject count is prompt-enforced, not programmatically verified.** The `Artwork Revision` prompt requires the output to contain exactly the source image's number of people, each exactly once, after a side-by-side request for `BA-PgJMzX` duplicated one guest. Nano Banana can still disobey an image instruction, so inspect the next real multi-person revision. A hard guarantee would require a separate image-analysis check and retry loop, which is not built.
- Workflow is **active** (`mLAn4ya2AmZoHDUk`, SDK-sourced). Schema/credential setup must be in place before the next `Approved`/`Selected`/`Revising` fires. After any SDK push, **all HTTP-node credentials are skipped and must be rebound by hand** (triggers + Telegram bind fine); reconcile canvas hand-edits back into the `.sdk.js`.

---

## Limitations / future work

- **Reversioning is best-effort + parallel, now idempotent.** The 1:1/9:16 branch runs alongside the status branch, so the episode flips to `Artwork Ready` even if a reversion call fails. If `Upload Reversion` 404s, the most likely cause is the `1x1`/`9x16` attachment fields not existing on the Thumbnails table yet. Recovery is cheap now (2026-07-08): re-select the row and only the still-missing version regenerates (no wasted Nano Banana spend on the one that already succeeded).
- **Reversion text legibility is prompt-only.** The `Reversion 1x1` / `Reversion 9x16` prompts carry an explicit legibility contract (reserve a clear band, keep the subject out of it, foreground text + contrast treatment) after a 2026-07-08 run put the caption behind the subject. It's very reliable but not guaranteed. For a hard guarantee, generate the art without a headline and composite the caption as a real text layer downstream (not built).
- **Which types get which variations is data, not code.** The **`Artwork Settings` table** (2026-10-06) holds one row per Episode Type with `Generate 16x9` / `Generate 1x1` / `Generate 9x16` checkboxes; `Plan Generate` and `Resolve Selected` read it live. Edit the table in Airtable, no deploy. Do **not** move this into the select view — a view filter gates all three Path-2 branches (see the 2026-08-20 gotcha).
- **Aspect ratio is prompt + `imageConfig` only.** 1:1 / 9:16 are requested, not pixel-guaranteed. Crop downstream if a platform is strict.
- **Caption, moods and art direction all come from one Telegram reply** to the metadata workflow's packaging message (stage #7). Nothing here is manual in Airtable any more, though editing the fields by hand still works and is the fallback if the assistant misreads a reply.
- **Roundtable was never actually working until 2026-08-04 (still UNTESTED).** It was wired up on 2026-07-06 (`Roundtable` added to `autoArt`, the `roundtable` layout in `Plan Generate`, the `Roundtable Thumbnail` prompt row) but `Plan Downloads` only fetched guest photos for `duo`, so a Roundtable got **zero** guest images and `Build Image Requests` fell through to the `Solo Thumbnail` prompt — a solo host shot, no error raised. Fixed in code 2026-08-04, but **only actually live from 2026-08-11**, since that push sat as an unpublished draft until then (see the publish gotcha above) — so any Roundtable run before 2026-08-11 was still producing a solo shot. Guy IS in the frame alongside the guests (host reference stays image 1). **Still not run end-to-end — verify.** Likeness with 5 faces (host + 4 guests) at 1K is the main risk; review the 4 options carefully.
- **Guest composition is prompt-only.** For Chat/Clip/Roundtable every guest headshot is passed inline and the prompt asks Nano Banana to balance the faces across the frame, but layout/likeness with several guests isn't guaranteed — review the 4 options before picking.
- **Host expression for duo** still comes from the vibe-tagged (Guy-only) reference library; the guest's expression is generated from the prompt, not a reference.

---

## Related

- **Upstream:** stage #7 AI metadata (`BA - Frame.io Uploaded > AI Metadata`, `jroXHciDvy0sWlRM`). Its **`Send Packaging Request`** Telegram message is where `Thumbnail Caption`, **`Thumbnail Moods`** and `Custom Image Prompt` all come from. `Custom Image Prompt` is optional (not a view gate).
- **Downstream:** stage #9 Publishing fan-out (`Status = Artwork Ready`).
- **Selection-architecture sibling:** `BA: Telegram Airtable Assistant` (live ID `Hx8Ul6M41fM8HuxU`) - owns the bot webhook (the reason selection/revision is via Airtable status, not Telegram buttons). Its system message carries the **"Artwork Revisions"** skill that turns "redo the 9x16 for BA-xxxx, more red" into a one-tap-approved write of `Revision Brief` + `Revision Targets` + `Status = Revising` on the episode's `Final` row. SDK source: `scripts/deploy/workflows/telegram-airtable-assistant.sdk.js`.
- **Build plan:** `workflow_planning/Guys Take Workflow (Annotated).md`
- **Build status tracker:** `workflow_planning/Guys Take Build Status.md` (workflow #8)
