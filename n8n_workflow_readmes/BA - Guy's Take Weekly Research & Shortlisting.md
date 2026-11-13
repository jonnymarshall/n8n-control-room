# BA: Guy's Take Weekly Research & Shortlisting

> **⛔ 2026-11-13 - BROKEN AND SWITCHED OFF (unpublished by Jonny; he is not using it).** Both of its last two runs die at `Cluster Videos by Topic`. Root cause is known and the fix is one field, but nothing was changed because the workflow is off. Before switching it back on, read **Known broken** below.

> **2026-11-12 - Telegram messages restyled to `TELEGRAM-STYLE.md` (LIVE, published).** Status emoji first, blank-line blocks, BA- codes only, no `rec...` ids, machine payloads behind a spoiler. Wording and structure only: no trigger, logic, credential or output change. Audit with `scripts/query/telegram-style-audit.sh`.

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `Z9dDjafBA899Hgok`.)

---

## TL;DR

Every Friday morning, this workflow:

1. Scrapes the latest videos from 11 Bitcoin YouTube channels (via RSS, no API key needed)
2. Stores each video in the `Stories` Airtable table
3. Uses an LLM to cluster videos into specific news events ("Strategy sells 32 BTC" not "Saylor's strategy")
4. Scores each cluster by viral potential + multi-channel coverage + views
5. Writes the top 8 stories to the `Shortlist` Airtable table
6. Sends a Telegram digest summarising the picks

The goal: surface this week's most podcast-worthy Bitcoin stories so Guy can pick 2 to record on.

---

## Quick facts

| Item | Value |
|---|---|
| **Workflow ID** | `Z9dDjafBA899Hgok` |
| **Trigger** | Every Friday at 7am (workflow timezone) |
| **Output 1** | Records in `Stories` Airtable table |
| **Output 2** | Records in `Shortlist` Airtable table |
| **Output 3** | Telegram message to the configured user chat (see `TELEGRAM_USER_CHAT_ID` in `.env`) |
| **LLM** | Google Gemini 2.5 Flash via OpenRouter |
| **Airtable base** | `app8Xw9Tq0XLjhmp9` (Guy's Take) |
| **State** | ⛔ inactive + unpublished, broken at the clustering step since at least 2026-11-06 |

---

## Known broken (2026-11-13)

**Symptom.** The Friday run fails and no digest arrives.

```
Workflow failed
Workflow: BA: Guy's Take Weekly Research & Shortlisting
Failed node: Cluster Videos by Topic
Error: Bad request - please check your parameters
```

**Evidence.** Execution `21356` (2026-11-13) and execution `14172` (2026-11-06), both failed at the same node with the same message. Steps 1-7 complete normally, including the Airtable `Stories` upsert; nothing reaches `Shortlist` and no Telegram message is sent.

**Root cause.** The node's error message is generic. The real reason is in the execution's `error.messages`:

```
400 google/gemini-2.5-flash does not support a JSON response_format combined with tool calling.
Remove response_format or tools, or use a Gemini 3 model.
```

- `Cluster Videos by Topic` is an **AI Agent** (`@n8n/n8n-nodes-langchain.agent` v3.1) with **`Cluster JSON Parser`** attached. An agent with a structured output parser is enforced through **tool calling**, so it cannot run without tools while the parser is attached.
- `Gemini Flash (Clustering)` (`@n8n/n8n-nodes-langchain.lmChatOpenRouter`) is set to `model: google/gemini-2.5-flash` with **`responseFormat: json_object`**.
- OpenRouter will not accept both on this model. Hence the 400.

This is platform behaviour, not a config typo: it is **constraint 21** in `Guys Take Build Status.md`.

**The fix when you switch it back on** (either one, first is smaller):

1. On `Gemini Flash (Clustering)`, **delete `responseFormat: json_object`** from Options. The structured output parser already forces JSON, so nothing is lost. In the UI that is the *Response Format* option, set back to the default.
2. Or keep `responseFormat` and swap the model to one that allows JSON mode plus tools (a Gemini 3 model, or `openai/gpt-5.1`, which the metadata and script workflows already use).

**Deliberately not applied** on 2026-11-13: Jonny had already unpublished and deactivated the workflow and asked only for it to be recorded. So live, the `.sdk.js` snapshot and everything downstream were left alone. `Cluster JSON Parser`, the prompt and the scoring code are all fine, so do not rewrite them for this.

**When re-enabling, also check:**

- Republish it (the push saves a draft only) and confirm it is Active, `availableInMCP` on, and the three credentials are still bound (constraint 6 / the post-push ritual in `AGENTS.md`).
- Test it by hand first. The trigger is a plain Friday clock, so "Execute workflow" is the reliable check rather than waiting a week.
- One real run should produce 8-15 clusters and a Telegram digest. If the agent now returns prose instead of JSON, the parser is what is failing, not the model.
- Nothing else in the pipeline consumes this workflow's output directly; `Shortlist` rows are read by `BA: Guy's Take Script Generation`, so a frozen `Shortlist` table simply means no new episodes from this route.

---

## Required credentials

The workflow uses three n8n credentials. They must already exist in n8n with the exact names below:

| n8n credential name | Type | Used by |
|---|---|---|
| `Airtable [n8n] (PAT)` | `airtableTokenApi` | Both Airtable nodes |
| `Telegram [pod21_n8n_agent_bot]` | `telegramApi` | Telegram send |
| `OpenRouter [n8n]` | `openRouterApi` | Gemini Flash LLM |

The **Airtable Personal Access Token** must have:
- `data.records:read` and `data.records:write` scopes
- `schema.bases:read` scope (required for the trigger to validate field names)
- Access granted to base `app8Xw9Tq0XLjhmp9`

YouTube RSS endpoints are public, so no auth is needed for the HTTP Request node.

---

## Required Airtable schema

### `Stories` table (`tblVUgJeZd2ZCicGV`)

One row per YouTube video scraped.

| Field | Type | Notes |
|---|---|---|
| `Title` | Single line text | Primary field; video title from RSS |
| `Channel` | Single line text | e.g. `@ScottMelker` |
| `URL` | URL | Used as the upsert match key |
| `Views` | Number | View count at scrape time |
| `Description` | Long text | First paragraph from RSS, capped 500 chars |
| `Published` | Date | When the video was published on YouTube |
| `Date of Research` | Date | When this workflow last touched the row |
| `Shortlist` | Link → Shortlist | Auto-populated reciprocal of the link from Shortlist (read-only here) |

### `Shortlist` table (`tblED3N6WdT1tQTzY`)

One row per clustered news event for the week.

| Field | Type | Notes |
|---|---|---|
| `Topic` | Single line text | Primary field; specific headline of the event |
| `Summary` | Long text | 1-2 sentence summary from the LLM |
| `Stories` | Link → Stories | The cluster's source videos |
| `Channel Count` | Number | Distinct channels covering this story |
| `Total Views` | Number | Combined views across the cluster |
| `Viral Score` | Number | LLM's 1-10 rating of viral potential |
| `Score` | Formula | `{Viral Score} * 10 + {Channel Count} * 5 + LOG({Total Views} + 1)` |
| `Status` | Single select | `Shortlisted` (default), `Picked`, `Rejected` |
| `Date of Research` | Date | Composite upsert key with Topic |

---

## Channel list

11 Bitcoin YouTube channels are hardcoded in two Code nodes inside the workflow. To add or remove a channel, edit BOTH:

1. **`Emit Channel List`** node: the array of `{ handle, channel_id }` pairs that emit one item per channel
2. **`Flatten and Filter Last 7 Days`** node: the `channelLookup` object that maps UC channel IDs back to @handles for display

Current channels:

```
@GreenCandle           UCdvC14iR8V7MedS7ArKHNCA
@Bitcoin_University    UCF31eojFKhWQJviyMICWO2w
@SimonDixon21          UC_wNYJCyycXXPmWni2JNZhQ
@exitmanual            UCROW1J2NQhg1Cd8y_XZ8e1g
@ScottMelker           UCxIU1RFIdDpvA8VOITswQ1A
@RobinSeyr             UCYEu3XGuHQy65iJpnzMIRrQ
@1MarkMoss             UC9ZM3N0ybRtp44-WLqsW3iQ
@SimplyBitcoin         UCB6Q0S1gUHXMe5-Jjx0_laQ
@LukeMikic21           UCCiI5nrZ3uQ0PsmjbhsMLgw
@Swan_Bitcoin          UCl4takhOQtiyprismCPsa2Q
@JoeConsorti           UCw4_-IVRDtkGZkwUmsv1S2A
```

To resolve a new `@handle` to its `UC...` channel ID, curl the channel page and grep for `externalId`:

```bash
curl -s -A "Mozilla/5.0" "https://www.youtube.com/@HANDLE" \
  | grep -oE '"externalId":"UC[A-Za-z0-9_-]{22}"' \
  | head -1
```

---

## Step-by-step: what the workflow does

1. **Every Friday 7am** (workflow timezone) — Schedule trigger fires.
2. **Emit Channel List** — outputs 11 items, one per channel.
3. **Fetch YouTube RSS** — HTTP GET to `https://www.youtube.com/feeds/videos.xml?channel_id={UC_ID}` for each of the 11 channels in parallel.
4. **Parse RSS** — converts XML feed payloads to JSON.
5. **Flatten and Filter Last 7 Days** — extracts video entries, filters to ones published in the last 7 days, caps at 5 per channel (most recent first). Outputs one item per video (~30-55 items typical).
6. **Upsert Story** — writes each video to Stories, matching on URL so re-runs don't duplicate. Stamps `Date of Research` with today's date.
7. **Aggregate Videos for Clustering** — collects all upserted videos into a single item with a flattened prompt-ready string of video metadata, including title and truncated description.
8. **Cluster Videos by Topic** — n8n AI Agent node calls **Gemini 2.5 Flash** via OpenRouter. The system prompt tells it to identify specific news events (with quantifiers, dates, named entities) and avoid umbrella themes. Outputs a JSON array of clusters, each with `topic`, `summary`, `video_urls`, and `viral_score` (1-10).
9. **Score and Rank Top 8** — for each cluster, computes:
   ```
   score = viral_score * 10
         + channel_count * 5
         + log10(total_views + 1)
   ```
   Sorts descending, takes the top 8.
10. **Upsert Shortlist Story** — writes each of the top 8 to the Shortlist table, matching on `(Topic, Date of Research)`. Status set to `Shortlisted`. Linked `Stories` field references the source Story records.
11. **Build Final Summary** — assembles the Telegram message body.
12. **Notify Research Ready** — sends one Telegram message to the configured user chat (`TELEGRAM_USER_CHAT_ID` in `.env`, Jonny's bot DM). Message includes total scraped count, the top 8 ranked list with summary and viral score per item, and a link to the Airtable base.

---

## Scoring algorithm

The picking decision relies on three signals, weighted as follows:

```
score = (viral_score × 10) + (channel_count × 5) + log10(total_views + 1)
```

| Signal | Weight | Source | Rationale |
|---|---|---|---|
| `viral_score` | ×10 | LLM judgment (1-10) | Best signal of "podcast-worthy happening." LLM judges specificity, recency, surprise |
| `channel_count` | ×5 | Distinct channels in cluster | Multiple channels covering the same story = high interest |
| `log10(total_views + 1)` | scalar | Sum of views across cluster | Tiebreaker. Log-dampened so one viral channel doesn't dominate |

The Airtable `Score` formula matches this exactly, so the field is recomputed live in Airtable whenever you tweak any of the inputs by hand.

---

## How Guy picks stories

1. Telegram message arrives Friday morning with top 8 ranked.
2. Open the Shortlist Airtable table.
3. Change `Status` from `Shortlisted` to `Picked` on the chosen 2 stories.
4. (Future work: a downstream workflow will trigger script generation when `Status = Picked`.)

---

## LLM prompt design

The system message in the `Cluster Videos by Topic` node is the most important part of the workflow. It:

- Instructs the model to find **specific events**, not themes
- Includes 8 **GOOD examples** ("Strategy sells 32 BTC on June 3, BTC drops 5%")
- Includes 6 **BAD examples** ("Michael Saylor and Microstrategy's Bitcoin Strategy") with explanations
- Asks for a viral_score rating with a clear rubric (9-10 explosive, 7-8 solid news, 3-4 borderline)
- Tells the model to drop pure analysis/opinion videos
- Targets 8-15 clusters per run

If output quality drifts, this prompt is the first place to tune.

---

## Operational notes

### Re-running creates duplicates? No.

Both Airtable upserts use match-on-key behavior:
- Stories upsert matches on `URL` — same video, same record
- Shortlist upsert matches on `(Topic, Date of Research)` — same topic on same day, same record

### Why workflow timezone matters

The workflow uses `$now.toFormat('yyyy-MM-dd')` in two places (Stories `Date of Research` expression and Shortlist Code node). Both respect the n8n workflow timezone setting. If unset, dates default to UTC, which may not match the operator's local "today." Set timezone in **Workflow Settings → Timezone** (currently `America/New_York` for 7am ET alignment).

### Why Gemini Flash (not Flash Lite)?

Flash Lite was tested first but returned empty cluster arrays when the input exceeded ~50 videos. Flash handles 50-100 videos reliably. Flash Lite saves cost on small batches; Flash is the safer default here.

### YouTube RSS limitations

YouTube RSS only exposes the **last 15 videos per channel** and a **truncated description**. For long-tail historical scraping or full descriptions, a different mechanism (yt-dlp, YouTube Data API) would be needed. For this workflow's purpose (weekly digest of last 7 days), RSS is sufficient.

### What happens if a channel has no posts in the last 7 days?

The Flatten step yields zero items for that channel. The workflow continues with whatever it has. The Telegram digest will reflect fewer stories than usual.

### Airtable UI gotcha

**Do not click "Load Schema" / refresh fields** on the Airtable nodes in the n8n UI. Doing so wipes the column mappings to Airtable defaults, breaking the workflow. If you must refresh, copy the column mappings first, then re-paste after the refresh.

---

## Related

- **BA: Telegram Airtable Assistant** (`BA - Telegram Airtable Assistant.md` in this folder): general Telegram agent that can read/write the same Airtable data conversationally, with one-tap approval on writes.
- **Phase 0 workflow** (`GbFwXLACjj1O6spS`): Airtable Episode status change → Telegram notification. Foundational pipe between Airtable and Telegram for the Guy's Take build.
- **Planning doc**: `/Users/jonny/code/n8n-control-room/workflow_planning/Guys Take Workflow.md`
- **Original Python script**: retired; removed from the repo 2026-09-29. It was the hermes-era prototype this workflow replaces.
