# Charlie: how this setup works

This file is for you (and for an AI you point at this repo). It explains how the podcast pipeline hangs together, where the truth lives, and how to answer "what is going on with episode X" without reading n8n.

**This is a snapshot of the repo, not the live system.** The live server is the source of truth. The files here are a copy of the workflows plus the notes that go with them.

---

## 1. The three things to know

1. **Airtable is the boss.** Every stage of the pipeline is driven by a field in Airtable, usually the `Status` of an episode. Nothing important is "in the workflow"; it is in the data.
2. **n8n does the work.** Each workflow wakes up on one specific thing, does one job, and writes the result back to Airtable.
3. **Telegram is the conversation.** Every automated message names the episode (`BA-xxxxx`) and ends with `⚙️ <workflow id> · exec <execution id>`. That footer is how you find the exact run in n8n.

## 2. The pipeline, in order

| Stage | What wakes it | What it produces |
|---|---|---|
| Scheduling | An email reply from a guest in the AgentMail inbox | Episode moves to `Recording Scheduled` with a `Record Date` |
| Upload detected | A file finishing in Frame.io | The Frame.io link is saved on the episode. If the episode is at `Recorded` or `Edited`, it is queued by setting `Ready for Metadata` |
| Transcription and metadata | An episode appearing in the **Ready for Metadata** view | Transcript, summary, chapters, 5 titles, 5 captions. Sends you the metadata document and a **packaging request** message. Ends at `AI Analysis Complete` |
| Packaging reply | You reply to the packaging message | Title, thumbnail caption, guests, mood, image prompt are written to Airtable |
| Artwork | An episode becoming eligible (summary, caption, artwork rules) | Four thumbnail options posted to Telegram |
| Pick artwork | You pick one option | The episode moves to `Artwork Ready` |
| Publish | You set `Ready to Publish` | The publisher uploads video, artwork and text to Fountain and schedules it. Episode moves to `Scheduled to Publish` |
| Reconciler | A clock, every 15 minutes | Asks Fountain "is it live yet?" and moves the episode to `Published` |
| Content sync | A clock, every 15 minutes | Compares live episodes to what Fountain holds. If something differs it **asks you first**, then applies it |

## 3. Where the truth is

**Airtable base "Guy's Take".** Four tables matter most:

- **Episodes** — one row per episode. `Status` is the state machine. Also holds title, summary, chapters, transcript, release date, Frame.io URL.
- **Publications** — one row per episode per platform (currently Fountain). This is the record of what was actually sent. Key fields: `Status`, `Scheduled For`, `Video Upload ID`, `Frame.io File ID`, `Sync Status`, `Sync Approved`.
- **Thumbnails** — one row per generated image option.
- **Publishing Settings / Publishing Links** — the Fountain feed, publish time and the link blocks at the bottom of every description.

If someone asks "is it live yet", the answer is on the **Publications** row and on Fountain, not on the Episode status alone.

## 4. Episode statuses you will see

`Recording Scheduled` → (cut uploaded) → `Ready for Metadata` → `Generating Metadata` → `AI Analysis Complete` → `Approved` → `Generating Artwork` → `Awaiting Thumbnail Pick` → `Artwork Ready` → `Ready to Publish` → `Publishing` → `Scheduled to Publish` → `Published`

Two of those are worth remembering:

- `Generating Metadata` is transient. Stuck there means a run failed.
- `Scheduled to Publish` means Fountain holds it and is waiting for the release moment.

## 5. The two kinds of message you get

- **Packaging request** ("Packaging for BA-xxxxx"). Reply to it with `T2, TC1`, guests, moods or an image prompt. This is the one to reply to.
- **"Fountain needs updating"** (content sync). Something changed in Airtable after the item was already on Fountain. **Nothing is sent until you approve.** Reply `approve sync` and the next 15-minute tick applies it. If the change was already made by hand on Fountain, say `ignore the sync for BA-xxxxx` instead, and the bot records the current state and stops asking.

**"Nothing has been sent" is not an error.** It means the bot spotted a difference and is waiting for your approval.

## 6. When something looks wrong

In this order:

1. Read the last Telegram message about that episode. The footer gives you the workflow and execution.
2. Ask the bot: *"what does the Publication row say for BA-xxxxx, and what does Fountain say?"* If those disagree, that is a bug worth reporting.
3. Open n8n → that workflow → Executions → search the execution id. The failed node name and error are on the failed step.
4. Stuck at `Generating Metadata` means the metadata run died. Set the episode back to `Ready for Metadata` to retry. Clear `Duration (s)` first if you want it to fully re-transcribe rather than skip as "same cut".

## 7. What you can safely change yourself

- Any text field on an episode: title, summary, caption. A live item will ask before pushing the change to Fountain.
- The release date. Same thing: it asks before rescheduling.
- Thumbnail picks.

Do not change by hand:

- `Sync Approved`, `Sync Status`, `Approved Fingerprint` — the sync's own bookkeeping.
- `Status` back to an earlier value unless you are deliberately re-running a stage.

## 8. If you are pointing an AI at this repo

Tell it to read, in this order:

1. `AGENTS.md` — house rules.
2. `workflow_planning/System Map.md` — the state machine and what each stage needs.
3. `n8n_workflow_readmes/BA - ...` — the readme for the specific workflow.
4. `scripts/deploy/workflows/*.sdk.js` — the workflow definitions themselves (node names, prompts, code).

Two cautions worth passing on: the README files describe intent and history, and a workflow's **live** version can be ahead of this snapshot. And never let an AI "fix" a workflow in the live n8n instance based only on this repo; pull the live definition first.
