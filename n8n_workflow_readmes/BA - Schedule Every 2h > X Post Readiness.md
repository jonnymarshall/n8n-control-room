# BA - Schedule Every 2h > X Post Readiness

Nudges the team when an episode is close to publishing but has no X post chosen, and when an episode is live but the X post link has not been stored on the publication row.

- **Workflow ID:** `ybngTJAUMqJaDwbB` (stable identifier: the name)
- **Triggers:** Airtable Trigger on `X Copy Needed` (`viwCZGBwut56NnNgY`) and `X Link Needed` (`viwWvqDJ0iG5BaSK7`) on `Publications`, plus a 2-hour schedule that reads both views for repeats and stage changes
- **Status change:** none. It only sends Telegram messages and stamps `Last Nudged At` on the X publication row.
- **Shared feature readme:** `Social Posts.md`

---

## Why it exists

Choosing a social post is a side stage. Nothing in the podcast publisher blocks on it, so it is easy to forget. This workflow is the reminder that survives after the drafting message has been scrolled past.

It also gives Charlie a place to store the X post link: the `URL` field on the episode's `BA-xxxx - X` row in `Publications`.

## Why there are views and a schedule

The two views are the source of truth:

- **`X Copy Needed`** (`viwCZGBwut56NnNgY`) — `Platform = X`, `Status = Pending`, `Post Copy` empty, `Episode Status` in `Approved`, `Awaiting Thumbnail Pick`, `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish`, `Published`.
- **`X Link Needed`** (`viwWvqDJ0iG5BaSK7`) — `Platform = X`, `Status = Pending`, `Post Copy` not empty, `URL` empty, `Episode Status = Published`.

Both are Airtable Trigger sources. Entering or changing a row in a view starts the workflow, per the house convention.

The 2-hour schedule remains for two reasons:

1. **A view entry fires once.** The concern was forgetting, so the workflow repeats the copy nudge every 12h (48h in the two early stages) and the link nudge every 24h.
2. **`Episode Status` is a lookup.** A change to the linked episode may not move the publication row's `Last Modified Time`, so a view trigger cannot be relied on to notice the move from `Approved` to `Artwork Ready`. The schedule reads the same views and catches the stage change.

The schedule does not replace the views. It reads them.

## What it reads

Every run:

1. `X Copy Needed` and `X Link Needed` on `Publications`, up to 100 each.
2. The `Episode Status`, `Episode Title` and `Episode Social Posts` lookups on each row.
3. `Post Copy`, `URL`, `Last Nudged At` and the row's `createdTime`.

`Episode Social Posts` is the guard that lets `Approved` and `Awaiting Thumbnail Pick` stay in the view: the nudge does not fire until the four options exist, so it cannot beat the “Social posts ready” message.

## The two nudges

### Copy nudge

Fires when:

- `Post Copy` is empty, and
- `Episode Social Posts` is not empty, and
- `Episode Status` is one of `Approved`, `Awaiting Thumbnail Pick`, `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish`, `Published`, and
- for `Approved` / `Awaiting Thumbnail Pick`, the X row is at least **2 hours** old, and
- `Last Nudged At` is empty or older than the cooldown: **48 hours** in `Approved` / `Awaiting Thumbnail Pick`, **12 hours** in the later stages.

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

## The views (they are the triggers)

**`X Copy Needed`** (`viwCZGBwut56NnNgY`) on `Publications`:

- `Platform` is `X`
- `Status` is `Pending`
- `Post Copy` is empty
- `Episode Status` is any of `Approved`, `Awaiting Thumbnail Pick`, `Artwork Ready`, `Ready to Publish`, `Scheduled to Publish`, `Published`

**`X Link Needed`** (`viwWvqDJ0iG5BaSK7`) on `Publications`:

- `Platform` is `X`
- `Status` is `Pending`
- `Post Copy` is not empty
- `URL` is empty
- `Episode Status` is `Published`

The views were created by Jonny on 2026-11-17. Airtable's API cannot create views, but it can read them and trigger from them.

`Approved` and `Awaiting Thumbnail Pick` are deliberately in `X Copy Needed`: the copy can be chosen at those stages. The workflow's `Episode Social Posts` lookup and 2-hour age guard stop it nudging before the four options exist.

## Credentials

| Node | Credential |
|---|---|
| `Fetch X Publications`, `Stamp Nudged` | `Airtable PAT` (Bearer) |
| `Send X Nudges` | `Telegram [pod21_n8n_agent_bot]` |

Both verified bound on 2026-11-17.

## Verified (2026-11-17)

- **View trigger:** clearing `Last Nudged At` on `BA-KXqegO - X` fired `X Copy Needed View` (execution `27343`), `Plan Nudges` saw the `Episode Social Posts` lookup non-empty and sent one copy nudge to Jonny's DM.
- **Schedule path:** execution `27349` read both views through `Fetch X Copy Needed` and `Fetch X Link Needed`, merged them, planned one nudge for `BA-nxzPcz` and sent it.
- Copy nudge: execution `26855` sent two messages and stamped both rows; `26861` sent nothing on the 12h cooldown.
- Link nudge: execution `26866` sent one message for a temporary `Published` episode; `26871` planned nothing after `URL` and `Status = Published` were set.
- All test data was deleted. The two real X rows (`BA-KXqegO - X`, `BA-nxzPcz - X`) were kept, their social posts were regenerated to the group, and their `Last Nudged At` was set so the first group nudge waits for the next 12h window (and quiet hours).
- **Why `Last Modified Time` was added:** the Airtable Trigger would not activate on `Publications` because the table had no `Created Time` or `Last Modified Time` field. `Last Modified Time` (`fld3kN88GMQoOTaHD`) now exists and is the trigger field.

## Gotchas

- **The Airtable HTTP GET returns one item with a `records` array.** `Plan Nudges` flattens it before reading rows. Do not treat `$input.first().json` as a row.
- **`Episode Status`, `Episode Title` and `Episode Social Posts` are lookups.** They arrive as arrays of strings in the REST response. The code handles arrays, objects and the interface-shaped `valuesByLinkedRecordId`.
- **A view trigger needs a `Created Time` or `Last Modified Time` field.** `Publications` did not have one, so the trigger would not activate. `Last Modified Time` (`fld3kN88GMQoOTaHD`) was added for this.
- **A lookup change may not move the publication row's `Last Modified Time`.** The view trigger is for row changes; the 2-hour schedule is what notices the episode moving from `Approved` to `Artwork Ready`. Keep both.
- **`Approved` and `Awaiting Thumbnail Pick` are guarded.** The copy nudge waits for `Episode Social Posts` to be non-empty and the X row to be at least 2 hours old, so it cannot beat the “Social posts ready” message.
- **One PATCH for all stamps.** `Build Nudge Stamps` aggregates into a single `records` array; otherwise the HTTP node would send the same PATCH once per nudge.
- **The nudge is not a gate.** It does not stop the podcast publish. That is deliberate; X is a separate channel.
- `versionId == activeVersionId`, active, `availableInMCP: true`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-17.
