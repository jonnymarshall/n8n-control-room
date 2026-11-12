# Telegram message style (house rules)

Every message the Pod21 bots send to Jonny or Charlie follows this. It exists
because on 2026-11-12 a multi-step approval about `BA-DCvtat` was read as
finished: the message opened with **"✅ Done."** and the rest, including
"reply 'run step 2'", was skimmed past. The bot then sat idle for an hour while
Charlie waited for thumbnails that were never coming. The message was correct
and still failed, because it was one block of text with a green tick on top.

The rule is: **state first, one idea per block, and machine data out of the way.**

---

## The shape

```
🟡 Approval needed
──────────────
Step 1 of 2 · BA-DCvtat · Roundtable_026 - The Internet's Black October

✅ This write: delete the 4 old thumbnail options.

⏳ Then: step 2 moves Status out of "Awaiting Thumbnail Pick".

🟡 Approve below, then reply "run step 2".

──────────────
🤖 system data · tap to reveal
<span class="tg-spoiler">⟦{ ... }⟧</span>
```

Reads top to bottom: what this is, what it does, what is left, what you do now.
The JSON is behind a tap, so it cannot be mistaken for the message.

---

## Emoji legend

Exactly one status emoji at the start of the first line. Do not decorate every
line with a different one.

| Emoji | Means |
|---|---|
| ✅ | Done, happened, succeeded |
| 🟡 | A human must act now (approve, reply, pick) |
| ⏳ | Waiting, or still to come |
| 🔄 | Running now |
| ⏭️ | Skipped, nothing to do |
| ♻️ | Unchanged, reused, adopted |
| ⚠️ | Needs a look but is not broken |
| ❌ | Failed |
| 📥 | Queued |
| 🎙️ | Published / live |
| 🤖 | Machine-readable data follows |

Domain emoji are fine inside the body (📅 for a date, 🖼️ for artwork), but the
first character of the message is always a status emoji.

---

## The rules

1. **Lead with state.** The first line carries the status emoji and at most five
   words. No preamble, no "Sure", no "I checked".
2. **One idea per block.** A blank line between blocks. Never a wall of text.
3. **Three to six lines.** Cut every word that does not change the meaning.
   Failure messages may run longer, but only to say what to do next.
4. **Name a record once**: `BA-xxxx` plus its title. Never the internal
   `rec...` row id in visible text. Row ids belong in the payload only.
   (The BA- code itself is required by `CONVENTIONS.md`.)
5. **No markdown.** No `**`, `#`, or tables. Plain text, emoji and blank lines.
   Bold and `<code>` are allowed where the node builds the message in HTML.
6. **No closer.** Never end with "let me know if you need anything else".
7. **Numbers are lists**, one per line: `1. …`, not a sentence.
8. **No step is implied.** If a second write is needed, say that it is needed and
   quote the exact words to send. Never let a "✅ Done" headline stand over an
   unfinished job.

---

## Approval and done messages (Telegram Airtable Assistant)

The workflow owns the headline; the agent owns the body.

- Approval: `🟡 Approval needed` + rule + body.
- After approval: `✅ Done` + rule + **the same body, verbatim**.
- On rejection by Airtable: `❌ Airtable rejected the change` + rule + the error.

Because the body is reused by the Done message, it must make sense both before
and after the write lands. That is why the body carries its own step marker
(`Step 1 of 2`) and never says "Done" itself.

Required body shape for a write that needs more than one Airtable call:

```
Step 1 of 2 · BA-xxxx · <title>

✅ This write: <one line, what changes>

⏳ Then: step 2 <one line, what is left>

🟡 <the exact words to reply, in quotes>
```

A single-call write uses the same shape without the `Step x of y` line.

The framing lives in `Send Approval Buttons` and `Confirm Write Done`. The body
rules live in the `== MESSAGE STYLE (Telegram) ==` block of the `Airtable Agent`
system message. Change one without the other and the two halves drift.

---

## Machine data block

Both the approval frame and anything else carrying data the bot parses must use:

- a separator of **14 `─` characters** on its own line,
- the label `🤖 system data · tap to reveal`,
- the payload wrapped in `<span class="tg-spoiler">…</span>` so Telegram blurs it
  until tapped.

**Load-bearing details, do not change:**

- The `⟦` and `⟧` markers are what `Handle Button Press` splits on. It takes the
  human body from between the two separators and parses the payload between the
  markers. Removing either marker, or using a `─` line inside the human body,
  breaks button approvals.
- The separator string is defined once in `Handle Button Press` as
  `APPROVAL_RULE`. If you change its length, change it there and in
  `Send Approval Buttons` together.
- The payload is HTML-escaped before sending. Keep that, or a `&` in a field
  value will make Telegram reject the message.

---

## Checking it

`scripts/query/telegram-style-audit.sh` is the scoreboard. It reads the SDK
snapshots (which are regenerated from live and drift-checked), finds every
Telegram send node, and checks the hard rules: an emoji first, no `rec...` id in
the visible text, no markdown. Warnings cover em dashes, long messages and
message values that are pure expressions (those are audited by hand).

```
./scripts/query/telegram-style-audit.sh            # scoreboard, exits 1 on any fail
./scripts/query/telegram-style-audit.sh --verbose  # show warnings too
```

Run it before closing any workflow push. Inactive and archived workflows are
listed as out of scope.

---

## Migration status

All active, human-facing workflows were converted on **2026-11-12**. Nothing is
pending.

| Workflow | Telegram nodes | State |
|---|---|---|
| `Hx8Ul6M41fM8HuxU` Telegram Airtable Assistant | 14 | ✅ 2026-11-12 |
| `mLAn4ya2AmZoHDUk` Guy's Take Thumbnail Artwork | 9 | ✅ 2026-11-12 |
| `5ZMcCY8WPQ3bFji6` Frame.io Uploaded > Episode Marked | 8 | ✅ 2026-11-12 |
| `DFkl8armVlXqBWWD` AgentMail > Episode Scheduling | 8 | ✅ 2026-11-12 |
| `jroXHciDvy0sWlRM` Ready for Metadata View > AI Metadata | 6 | ✅ 2026-11-12 |
| `WMZ0Zpin1Stn9uF1` Publication Content Synced | 4 | ✅ 2026-11-12 |
| `LTmRVKn9TWJd6Gtk` Fountain Scheduled | 3 | ✅ 2026-11-12 |
| `pvCPy320OjawDkSu` Fountain Publication Reconciled | 3 | ✅ 2026-11-12 |
| `G1N3gUA2CUa8Q5sF` Apply Fountain Sync | 3 | ✅ 2026-11-12 |
| `myJgNWs6zE20pjaS` Second Brain Capture | 8 | ✅ 2026-11-12 |
| `9PMI1kuBjLW2YHwb` Workflow Failed Alert | 2 | ✅ 2026-11-12 |
| `spXF48NOXJYaDfnz` n8n GitHub Backups | 2 | ✅ already compliant |
| `Z9dDjafBA899Hgok` Weekly Research | 2 | ✅ 2026-11-12 |
| `RATBwwfOlRDPDHeN` Publish Readiness Checklist | 2 | ✅ 2026-11-12 |

The four `telegramText` builders inside the Fountain workflows (`Build Failure`,
`Build Fountain Failure`, `Build Fountain Reconcile Failure`) build their message
inside a Code node, so they were converted there rather than in a Telegram node.

Archived and inactive workflows (`Pod21 — Approval Handler`, `Pod21 — Article
Drafts`, `Draft Approvals`, `weekday-drip`, `BA: Airtable Update Telegram
Notifier`) are out of scope and are skipped by the audit. If one is revived,
convert it before switching it on.

Three converted workflows still have no readme of their own (pre-existing debt,
not introduced by this pass): `Second Brain Capture`, `BA - Publish Readiness
View Entered > Telegram Checklist`, and `BA - Subworkflow - Apply Fountain Sync`.
