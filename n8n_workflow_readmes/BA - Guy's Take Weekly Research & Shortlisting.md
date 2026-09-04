# BA: Guy's Take Weekly Research & Shortlisting

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
- **Original Python script** (retired): `/Users/jonny/code/n8n-control-room/scripts/youtube_research/youtube_research.py` — the hermes-era prototype this workflow replaces.
