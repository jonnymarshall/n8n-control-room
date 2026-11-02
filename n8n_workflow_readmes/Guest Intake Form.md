# Guest Intake Form (Airtable-native)

> **This is not an n8n workflow.** It lives entirely inside Airtable: a form, a formula
> field, and one base automation. There is no `.sdk.js`, no n8n push, and no credential
> rebind. It is documented here because it is a piece of the content machine, and the
> folder is where the machine's pieces are written down.

**Base:** Guy's Take (`app8Xw9Tq0XLjhmp9`).

---

## TL;DR

A guest of a `Chat` episode fills in an Airtable form. Their answers create or link a
`Guests` record and attach that guest to the episode, with no manual data entry. Each
`Chat` episode gets its own pre-filled form link automatically, computed from the
episode's own record ID, so there is no automation running to keep links current.

The point of the flow, for the pipeline, is that a `Chat` episode needs a guest on its
`Guests` link before the artwork workflow will run. This is how that link gets made.

---

## Where everything lives

| Thing | ID / name |
|---|---|
| Base | `app8Xw9Tq0XLjhmp9` (Guy's Take) |
| Form source table | `Guest Intake` (`tblUiAh4swE3Xf94Z`) |
| Form | standalone form `New Guest Intake` (`pag6KbMDWAgI60KeR`) |
| Guests table | (`tblObg6LIPFzzzmvP`) |
| Episodes table | (`tbl3uYLIvtB9APZp6`) |
| Automation | `Guest Intake > create or link Guest` (`wfl5z8YnmmI8sW9OV`) |
| Per-episode link field | `Episodes.Guest Form URL` (`fldj3aeYmwBoAvMXd`, formula) |
| Reverse links (auto) | `Episodes.Guest Intake` (`fldyO1qAZo1Hzg6Ef`), `Guests.Guest Intake` (`fld97zuJZEhCvq5Ct`) |

Form URL base: `https://airtable.com/app8Xw9Tq0XLjhmp9/pag6KbMDWAgI60KeR/form`

---

## The `Guest Intake` table

One row per form submission. It holds everything the guest typed, plus the two links and
a status.

**Identity and contact**

| Field | Type |
|---|---|
| `Name` (primary) | single line text |
| `Nickname` | single line text |
| `Email` | email |
| `Preferred Contact Method` | single select: Email, Phone, Signal, Telegram, WhatsApp, X, LinkedIn, Nostr |
| `Secondary Contact Method` | single select (same options) |
| `Telephone` | phone |
| `Signal Username` | single line text |
| `Telegram Username` | single line text |
| `X Username` | single line text |
| `LinkedIn Username` | single line text |
| `Nostr npub` | single line text |
| `Anonymous` | checkbox |
| `Location` | single line text |
| `Time Zone` | single line text |
| `Short Bio` | long text |
| `Headshot` | attachment |
| `Links and Resources` | long text |
| `Social Handles` | long text |

**Interview prep**

| Field | Type |
|---|---|
| `Talking Points` | long text |
| `Unpopular Opinion` | long text |
| `What We're Not Talking About` | long text |
| `Most Bullish On` | long text |
| `Least Bullish On` | long text |
| `Questions to Avoid` | long text |
| `Asset Release Agreed` | checkbox |

**System**

| Field | Type | Notes |
|---|---|---|
| `Episode` | link -> Episodes | Pre-filled by the form URL, hidden from the guest |
| `Matched Guest` | link -> Guests | Written by the automation |
| `Status` | single select: Submitted, New guest created, Linked to existing guest, Needs review | Written by the automation |
| `Submitted At` | created time | Automatic |

---

## The form

Built in Airtable's form designer on the `Guest Intake` table.

- **Every listed field is on the form except the system fields.** Do not add `Matched
  Guest`, `Status`, or `Submitted At`; the automation owns those.
- **`Episode` must be on the form even though it is hidden.** A field that is not on the
  form cannot be pre-filled by the URL, and then the submission would not be tied to an
  episode. The `hide_Episode=true` parameter keeps it out of the guest's view.
- **Conditional visibility** (field settings, "show only when conditions are met", with
  "any of" where two conditions are needed):
  - `Telephone`: Preferred is any of Phone, WhatsApp, Signal, or Secondary is any of
    Phone, WhatsApp, Signal.
  - `Signal Username`: Preferred is Signal, or Secondary is Signal.
  - `Telegram Username`: Preferred is Telegram, or Secondary is Telegram.
  - `X Username`: Preferred is X, or Secondary is X.
  - `LinkedIn Username`: Preferred is LinkedIn, or Secondary is LinkedIn.
  - `Nostr npub`: Preferred is Nostr, or Secondary is Nostr.
- **Field descriptions** carry the guest guidance: headshot ("high-res, you only, nobody
  else in the shot"), short bio ("under 100 words"), and the asset-release wording.

---

## The per-episode link (`Guest Form URL`)

`Episodes.Guest Form URL` is a **formula**:

```
IF({Type}="Chat",
   "https://airtable.com/app8Xw9Tq0XLjhmp9/pag6KbMDWAgI60KeR/form?prefill_Episode="
   & RECORD_ID() & "&hide_Episode=true",
   BLANK())
```

- Only `Type = Chat` episodes get a link; everything else is blank.
- `RECORD_ID()` returns the episode's own Airtable record ID, so each Chat episode's
  link is unique and correct the instant the row exists. There is no automation involved,
  which is why it never drifts and works for episodes created by n8n, by another form, or
  by hand.
- `prefill_Episode=<id>` writes the episode onto the `Episode` link when the form is
  submitted. `hide_Episode=true` hides the field from the guest.
- To send a guest their form, copy this field's value. The link is not a secret: the
  episode record ID is visible in the URL, and a determined guest could strip the hide
  parameter. There is nothing sensitive on the episode they could not see anyway.

**Swapping the form.** If the form is ever recreated, the only change is the
`pag...` segment in the formula. Edit the formula in the `Guest Form URL` field.

---

## The automation: `Guest Intake > create or link Guest`

Trigger: **when a record is created** in `Guest Intake`.

Airtable's no-code automation steps cannot express "find the guest, and if that finds
nothing, create one", so this is a single **Run a script** action. It is still an
Airtable-native automation, not n8n. The script is stored on the action and can be read
or edited in the Airtable UI.

**What the script does, in order:**

1. Reads the new `Guest Intake` row.
2. Normalises the fields it cares about (name, nickname, email, both contact methods,
   phone, the four usernames, Nostr, location, time zone, bio, links, socials, anonymity,
   headshot, and the linked episode).
3. Builds the set of guest fields, skipping any blank value so an empty submission never
   wipes an existing value on a returning guest.
4. Finds the existing guest: **email first (case-insensitive), then an exact name match.**
   If neither matches, it creates a new guest.
5. Copies the fields onto the guest.
6. Copies the headshot if it can. This is wrapped in a try/catch: if the attachment URL
   will not transfer, it logs `Headshot copy skipped` and continues, so a headshot problem
   never blocks the guest record.
7. Links the guest to the episode on **both** sides (`Guests.Episodes` and
   `Episodes.Guests`), **merging** with whatever is already linked and de-duplicating. This
   is also wrapped in a try/catch. Merging is what keeps a returning guest's past episodes
   and a multi-guest Chat's other guests intact.
8. Writes `Matched Guest` and `Status` (`New guest created` or `Linked to existing guest`)
   back on the intake row.

**Enabling it.** Airtable automations are always saved as a draft; a human must turn them
on. After any edit to an already-running automation, open it and click **Update** to
publish the change, or the live version keeps running the old logic.

---

## Edge cases and decisions

- **Repeat submission, same person.** No duplicate guest and no duplicate episode link.
  The guest is reused and its details refreshed with the newer answers. But each
  submission is a new `Guest Intake` row, so a repeat stacks a second row for the same
  episode and person. The older row keeps its original answers.
- **Different person, same episode.** Both guests are linked; the episode ends up with
  both. This is the intended multi-guest Chat behaviour.
- **Changed email and changed name.** Email is checked first, then exact name. A guest who
  changes both is not recognised and a duplicate guest is created.
- **Same name, different people.** Treated as one person. Accepted trade-off for the name
  fallback.
- **Anonymous with no name and no email.** Can never match, so every submission creates a
  new guest.
- **Why one script instead of the tidy no-code steps.** The no-code "conditional logic"
  cannot branch on whether a Find records step returned anything, and writing a linked
  field replaces its existing links rather than adding to them. The script solves both in
  one place, and is the only way to get correct merge behaviour.

---

## How to test

1. Make sure the automation is on.
2. Open a `Chat` episode, click `Guest Form URL`, and submit with a throwaway name and
   email. Confirm a `Guests` row is created with the details, linked to that episode, and
   that the intake row shows a matched guest and a status.
3. Submit again with the same email against a different `Chat` episode. Confirm the same
   guest is reused and now shows both episodes.
4. Delete the test guest and intake rows.

Note: the automation fires only on **new** submissions, so anything submitted before it was
turned on is not processed.

---

## History / housekeeping

- Built 2026-10-01.
- The pre-existing empty text fields `Guest_Intake_Chat_Episodes` on `Episodes` and
  `Guests` (residue from an earlier attempt) were deleted.

## Related

- **System Map** (`workflow_planning/System Map.md`, live row in the `Prompts` table):
  stage 9 documents this flow for the Telegram assistant. Edit the Map, then run
  `scripts/deploy/schema/sync-system-map.sh` to push it live. If the live row has drifted
  ahead, run `scripts/deploy/schema/pull-system-map.sh` first.
- **Thumbnail Artwork** (`n8n_workflow_readmes/BA - Guy's Take Thumbnail Artwork.md`): the
  consumer of the `Guests` link; a `Chat` will not generate artwork until a guest is linked.
