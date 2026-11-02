# BA - Subworkflow - Build Fountain Content

> **Find this workflow in n8n by name.** Workflow IDs can change when a workflow is rebuilt. ID at time of writing: `uSkbv5YFty7GLb2l`.

Local SDK source: `scripts/deploy/workflows/guys-take-fountain-build-content.sdk.js` (generated from live 2026-09-30).

---

## Purpose

The one and only place the Fountain episode **description** is built. It turns an episode's `summary`, `chapters` and publishing links into the Fountain Markdown description (summary paragraph, a `**Chapters**` block, and the Affiliate / Host link blocks), applying a trailing-backslash hard line break to each chapter and link line so they stay on their own lines in Fountain's Markdown renderer.

It exists so that the **publisher** and the **content-sync** workflows build byte-identical text. The sync decides "has the content changed?" by hashing the description it builds and comparing it to the fingerprint stored when the item was last pushed; if the two builders ever drifted, the hashes would never match and the sync would re-PATCH Fountain on every run. Centralising the builder removes that risk.

---

## Quick facts

| Item | Value |
|---|---|
| Workflow ID | `uSkbv5YFty7GLb2l` |
| Trigger | Execute Sub-workflow Trigger (called by other workflows) |
| Input mode | `passthrough` (accepts all data) |
| Called by | `BA - Ready for Publishing View Entered > Fountain Scheduled`, `BA - Schedule Every 15m > Publication Content Synced` |
| Active? | **Yes** (must be published: n8n refuses to publish a caller that references an unpublished sub-workflow) |

---

## Interface

**Input (one item per episode):** any object, but it reads:

- `summary` (string) — the episode summary
- `chapters` (string) — the Airtable `Chapters` long text (one timestamp per line)
- `links` (array) — publishing-link field objects (`Active`, `Destinations`, `Section`, `Description`, `Name`, `URL`, `Sort Order`)

**Output:** the same item, with `description` added (the full Markdown body).

```text
Execute Workflow Trigger (passthrough)
  -> Build Description (Code)
```

The `Build Description` code:

- keeps links where `Active` is true and `Destinations` is empty or contains `Episodes`;
- groups them by `Section` (`Affiliate` / `Host`) sorted by `Sort Order`;
- renders each as `- <Description or Name> (Link: <URL>)`;
- joins chapters and link lines with a trailing-backslash hard line break (`hardLines`), because a plain single newline collapses in Markdown.

---

## Notes

- **No credentials.** It only shapes data; it makes no external calls.
- The callers pass the publishing links in (they already fetch them), so this workflow stays pure and side-effect free.
- If you ever change the description format, change it **here only** — both the publisher and the sync pick it up automatically.
- Callers invoke it with Execute Sub-workflow node, mode `Run once for each item`, with an error output wired to their own failure branch.

---

## Related

- Publisher: `n8n_workflow_readmes/BA - Ready for Publishing View Entered > Fountain Scheduled.md`
- Content sync: `n8n_workflow_readmes/BA - Schedule Every 15m > Publication Content Synced.md`
- Description layout reference: `references/EpisodeDescriptionReference.md`
- Shared rules: `n8n_workflow_readmes/CONVENTIONS.md`
