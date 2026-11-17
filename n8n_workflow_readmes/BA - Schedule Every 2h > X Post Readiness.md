# BA - Schedule Every 2h > X Post Readiness

Nudges the team when an episode is close to publishing but has no X post chosen, and when an episode is live but the X post link has not been stored on the publication row.

- **Workflow ID:** `ybngTJAUMqJaDwbB` (stable identifier: the name)
- **Trigger:** Schedule, every 2 hours
- **Status change:** none. It only sends Telegram messages and stamps `Last Nudged At` on the X publication row.
- **Shared feature readme:** `Social Posts.md`

---

## Why it exists

Choosing a social post is a side stage. Nothing in the podcast publisher blocks on it, so it is easy to forget. This workflow is the reminder that survives after the drafting message has been scrolled past.

It also gives Charlie a place to store the X post link: the `URL` field on the episode's `BA-xxxx - X` row in `Publications`.

## What it reads

Every run:

1. `Publications` where `Platform = X` and `Status = Pending` (up to 100).
2. The `Episode Status` and `Episode Title` lookups on each row.
3. `Post Copy`, `URL` and `Last Nudged At`.

It does not use a view. The separation of concerns is in the `Publications` table: every check is about the X row, not the episode.

## The two nudges

### Copy nudge

Fires when:

- `Post Copy` is empty, and
- `Episode Status` is `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish` or `Published`, and
- `Last Nudged At` is empty or more than **12 hours** ago.

```text
🟡 X post not chosen
──────────────
BA-xxxx · Title

The artwork is done and there is no X post picked yet.

🟡 Reply to the "Social posts ready" message with option 2,
or reply resend social posts and I will post the four again.

If you are not doing X for this one, set the X row Status = Skipped in Airtable.
```

The first line changes with the stage: “The artwork is done”, “The episode is ready to publish”, “The episode is scheduled to publish”, or “The episode is live”.

### Link nudge

Fires when:

- `Post Copy` is present, and
- `URL` is empty, and
- `Episode Status` is `Published`, and
- `Last Nudged At` is empty or more than **24 hours** ago.

```text
🟡 X link needed
──────────────
BA-xxxx · Title

The episode is live. The X post is still marked Pending.

🟡 Reply with the X link and I will store it on the X row,
or set Status = Published in Airtable.
```

## What happens after the send

Every nudged row gets `Last Nudged At` stamped in one Airtable PATCH **after** the Telegram send succeeds. If the send fails, nothing is stamped, so the next run retries.

The cooldowns are deliberately asymmetric: the copy nudge repeats every 12 hours because it is the one that gets forgotten; the link nudge waits 24 hours so Charlie is not pinged every two hours about a post he has not made yet.

**Quiet hours:** no nudge is sent between 21:00 and 08:00 America/New_York. The schedule still runs, but `Plan Nudges` returns nothing outside that window, so a 3am run is silent and the first morning run sends.

## Assistant tie-in

The Telegram Assistant has an `X POST READINESS` section:

- Replying to the copy nudge with `resend social posts` makes it read the episode's `Social Posts` rows and list the four options again. No write.
- Replying with `option 2` uses the normal pick rule (`Status = Selected` on that `Proposed` row).
- Replying to the link nudge with an X URL proposes one update on the X row: `URL`, `Published At = today`, `Status = Published`.
- Replying `skip X` proposes `Status = Skipped` on the X row.

The assistant never marks the X row `Published` without a URL.

## Optional views for the Airtable UI

The workflow does not need views, but the same two checks are useful as views in the base:

**`X Copy Needed`** on `Publications`:

- `Platform` is `X`
- `Status` is `Pending`
- `Post Copy` is empty
- `Episode Status` is any of `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish`, `Published`

**`X Link Needed`** on `Publications`:

- `Platform` is `X`
- `Status` is `Pending`
- `Post Copy` is not empty
- `URL` is empty
- `Episode Status` is `Published`

Airtable's API cannot create views, so these are manual. The workflow works without them.

## Credentials

| Node | Credential |
|---|---|
| `Fetch X Publications`, `Stamp Nudged` | `Airtable PAT` (Bearer) |
| `Send X Nudges` | `Telegram [pod21_n8n_agent_bot]` |

Both verified bound on 2026-11-17.

## Verified (2026-11-17)

- Copy nudge: execution `26855` sent two “X post not chosen” messages (for `BA-KXqegO` and `BA-nxzPcz`, both `Artwork Ready`) to Jonny's DM and stamped both rows. A rerun at `26861` sent nothing because of the 12-hour cooldown.
- Link nudge: execution `26866` sent one “X link needed” message for a temporary `Published` episode with a `Post Copy` and no URL.
- Stopped correctly: after setting `URL` and `Status = Published` on the test X row, execution `26871` planned nothing.
- All test data was deleted. The two real X rows (`BA-KXqegO - X`, `BA-nxzPcz - X`) were kept, their social posts were regenerated to the group, and their `Last Nudged At` was set to now so the first group nudge waits 12 hours.

## Gotchas

- **The Airtable HTTP GET returns one item with a `records` array.** `Plan Nudges` flattens it before reading rows. Do not treat `$input.first().json` as a row.
- **`Episode Status` and `Episode Title` are lookups.** They arrive as arrays of strings in the REST response. The code handles arrays, objects and the interface-shaped `valuesByLinkedRecordId`.
- **One PATCH for all stamps.** `Build Nudge Stamps` aggregates into a single `records` array; otherwise the HTTP node would send the same PATCH once per nudge.
- **The nudge is not a gate.** It does not stop the podcast publish. That is deliberate; X is a separate channel.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-17.
