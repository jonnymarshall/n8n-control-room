# Send Chat Message as Email (AgentMail)

> **Find this workflow in n8n by name.** Workflow IDs change whenever a workflow is rebuilt from code, so the name is the stable identifier. (ID at time of writing: `8RP2xfWcIufDqyhD`.)
> Built 2026-06-09. Inactive until the AgentMail credential + recipient/inbox placeholders are filled in.

---

## TL;DR

You open the n8n chat box, type a message, and it gets emailed to your colleague via the AgentMail API. The subject is always `Message from Jonny`; whatever you type becomes the plain-text body.

Three nodes, linear: **chat trigger → set recipient/inbox → POST to AgentMail.**

---

## Quick facts

| Item | Value |
|---|---|
| **Trigger** | Chat Trigger (`public: false`) — click the **Chat** button in the n8n editor and type |
| **Recipient** | `colleagueEmail` field in the `Recipient & Inbox` node (placeholder, fill in the UI) |
| **From inbox** | `inboxId` field in the `Recipient & Inbox` node (your AgentMail inbox, e.g. `me@agentmail.to`) |
| **Subject** | Fixed: `Message from Jonny` (hardcoded in the HTTP body) |
| **Body** | The chat message (`{{ $json.chatInput }}`) |
| **API** | `POST https://api.agentmail.to/v0/inboxes/{inboxId}/messages/send` |

---

## Required credentials

| n8n credential name | Type | Used by |
|---|---|---|
| `AgentMail API` | `httpBearerAuth` | `Send Email (AgentMail)` — the bearer token is your AgentMail API key (sent as `Authorization: Bearer <key>`) |

⚠️ **Rebuild gotcha:** HTTP Request nodes lose their credential binding when the workflow is recreated from code (`autoAssignedCredentials` skips them). Re-bind the `AgentMail API` credential by hand after any rebuild.

---

## Setup checklist (before first use)

1. **Recipient & Inbox** node → set `colleagueEmail` to your colleague's address and `inboxId` to your AgentMail sending inbox.
2. **Send Email (AgentMail)** node → create/select the `AgentMail API` Bearer credential containing your AgentMail API key.
3. Click **Chat** in the editor, type a message, send. Check the execution and your colleague's inbox.

---

## How it works (node by node)

1. **On Chat Message** — Chat Trigger, `public: false`. Output field is `chatInput` (the typed message). Not exposed as a public URL; runs from the editor chat panel.
2. **Recipient & Inbox** — Set node (`includeOtherFields: true` so `chatInput` passes through). Adds two string fields: `colleagueEmail` and `inboxId`. These are plain placeholders edited in the UI, not credentials.
3. **Send Email (AgentMail)** — HTTP Request, `POST` to `https://api.agentmail.to/v0/inboxes/{{ $json.inboxId }}/messages/send`. Bearer auth via the `AgentMail API` credential. JSON body: `{ to: colleagueEmail, subject: "Message from Jonny", text: chatInput }`.

---

## Gotchas

- **API base path is `/v0/`.** AgentMail's `llms-full.txt` curl example omits the version prefix, but the API reference base URL is `https://api.agentmail.to/v0/`. If sends 404, this is the first thing to check.
- **`inboxId` is the from-address.** AgentMail keys the send endpoint on the inbox in the URL path, not a `from` body field.
- **No HTML body.** Only plain `text` is sent. Add an `html` field to the JSON body if you want formatted email.
- **To make it a public hosted URL:** flip the trigger to `public: true`, set a `mode` (`hostedChat`) and `authentication` (use `n8nUserAuth`, not `none` — a no-auth public URL would let anyone email your colleague).

---

## Related

- **Pod21: n8n GitHub Backups** (`Pod21 - n8n GitHub Backups.md`) — backs this workflow up daily once it's saved.
