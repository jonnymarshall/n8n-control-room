# BA - Audionauts Post Revising > Redrafted

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `aRwDA0qtQnjXR0sr`. Created 2026-11-23.

Redrafts the single Audionauts rundown from a written brief, in place. The row keeps its identity and `Round` increments; no second row is created.

- **Trigger:** Airtable poll every minute on `Social Posts`, `Last Modified Time`
- **Status change:** none. The row goes `Revising` -> `Proposed`; the Episode is untouched.
- **Shared feature readme:** `Social Posts.md`

---

## Flow

```text
Social Posts Changed
  -> Pick Audionauts Revising    Status = Revising AND Platform = "Keet + Telegram", brief required
  -> Fetch Clip Episode          the clip's transcript and Associated Episode
  -> Resolve Parent Episode      parent title + guest names
  -> Fetch Audionauts Prompts    "Audionauts Post" + "Social Post Humanizer"
  -> Build Revision Request      same brief, plus the brief and the rejected copy
  -> Draft Audionauts Post       google/gemini-3.7-flash
  -> Parse Audionauts Revision   same limits as the first draft
  -> Update Audionauts Social Post   Copy, Angle, Characters, Round+1, Status Proposed, brief cleared
  -> Build Revised Message
  -> Send Revised Message        team group
```

The X revision workflow reads the same table and ignores any row whose `Platform` is not `Default` or `X`, so it cannot turn an Audionauts row into four X options.

---

## Round semantics

- `Round` increments (`1` -> `2` -> `3` ...)
- `Status` returns to `Proposed`
- `Revision Brief` is cleared
- `Name` becomes `<BA-xxxx> · R<round> · O1`
- `Copy` and `Angle` are replaced; the previous copy lives only in the model prompt and the message

---

## The brief

It is passed verbatim and controls tone, angle, length and opening. It does not control the subject: the transcript and the parent episode stay the grounding. The prompt restates the rule that a named story is an example inside the clip, never a replacement for it.

`Pick Audionauts Revising` throws if a `Revising` row has no brief, so a stray status change fails loudly instead of guessing.

---

## What it refuses

Nothing, other than a missing brief. An Audionauts row has one option, so there is no "already picked" case to protect: re-selecting after a redraft simply rewrites the publication rows through the selection workflow.

---

## Credentials

| Node | Credential |
|---|---|
| `Social Posts Changed` | `Airtable [n8n] (PAT)` |
| `Fetch Clip Episode`, `Resolve Parent Episode`, `Fetch Audionauts Prompts`, `Update Audionauts Social Post` | `Airtable PAT` (Bearer) |
| `Draft Audionauts Post` | `OpenRouter [n8n]` |
| `Send Revised Message` | `Telegram [pod21_n8n_agent_bot]` |

---

## Verified

On the temporary clip `BA-S3aB4q` on 2026-11-23, against a scratch copy routed to Jonny's DM:

- brief: `Make it shorter and lead with the BIP 110 question. Keep the multisig point.`
- the redraft opened with the BIP 110 question, kept the multisig point, came in at 450 characters, rewrote the row to `R2`, cleared the brief and returned it to `Proposed`
- execution `69579` completed through the update and the message

Test row, publications and episode were deleted.

---

## Gotchas

- **One row, one option.** Do not add four; the selection workflow expects the `Keet + Telegram` row.
- **The transcript is re-sent on every revision.** That is what keeps the redraft grounded in the clip.
- **A failed redraft leaves the row on `Revising`.** Unlike the draft workflow there is no retry stamp; the Airtable trigger fires on change, so toggle the status to try again.
- `versionId == activeVersionId`, active, `availableInMCP`, error workflow `9PMI1kuBjLW2YHwb` as of 2026-11-23.
