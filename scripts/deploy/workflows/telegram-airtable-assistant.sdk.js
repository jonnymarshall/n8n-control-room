import { workflow, node, trigger, ifElse, languageModel, memory, tool, newCredential, expr } from '@n8n/workflow-sdk';

// ── Trigger ──────────────────────────────────────────────────────────────
const telegramTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  config: {
    name: 'Telegram Message Received',
    parameters: { updates: ['message', 'callback_query'], additionalFields: {} },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [-160, 288]
  },
  output: [{ message: { text: '@pod21_n8n_agent_bot hello', chat: { id: 1512868522 }, from: { id: 1512868522 } } }]
});

// ── Button (callback_query) path ─────────────────────────────────────────
const isButtonPress = ifElse({
  version: 2.3,
  config: {
    name: 'Is Button Press?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{ id: 'is-cb-1', leftValue: expr('{{ $json.callback_query ? "yes" : "no" }}'), rightValue: 'yes', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      looseTypeValidation: true,
      options: {}
    },
    position: [64, 288]
  }
});

const handleButtonPress = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Handle Button Press',
    parameters: {
      jsCode: `const upd = $input.first().json;
  const cq = upd.callback_query;
  const chatId = cq.message?.chat?.id ?? 1512868522;
  const fromId = cq.from?.id;
  const queryId = cq.id;
  const data = String(cq.data || '');
  let out = { execute: false, queryId: queryId, chatId: chatId, reasonMessage: '', method: 'POST', path: '', body: {}, summary: '' };

  const approvers = [1512868522, 8923732358];
  if (!approvers.includes(fromId)) {
    out.chatId = 1512868522;
    out.reasonMessage = 'Ignored a button press from an unauthorized user.';
    return [{ json: out }];
  }

  const pick = data.match(/^pick:(rec[A-Za-z0-9]+)$/);
  if (pick) {
    out.execute = true;
    out.method = 'PATCH';
    out.path = 'app8Xw9Tq0XLjhmp9/Thumbnails';
    out.body = { records: [{ id: pick[1], fields: { Status: 'Selected' } }] };
    out.summary = 'Set thumbnail ' + pick[1] + ' to Selected. The thumbnail workflow will reject the other options and mark the episode Artwork Ready.';
    return [{ json: out }];
  }

  if (data === 'wc') {
    out.reasonMessage = '❌ Cancelled. Nothing was changed in Airtable.';
    return [{ json: out }];
  }

  if (data === 'wa') {
    const msgText = String(cq.message?.text || '');
    const m = msgText.match(/⟦([\\s\\S]*?)⟧/);
    if (!m) {
      out.reasonMessage = 'Could not find the pending change in this message. Nothing was changed.';
      return [{ json: out }];
    }
    let payload;
    try {
      payload = JSON.parse(m[1]);
    } catch (e) {
      out.reasonMessage = 'The pending change was unreadable. Nothing was changed.';
      return [{ json: out }];
    }
    let body = payload.body && typeof payload.body === 'object' ? payload.body : {};
    if (body.records && !Array.isArray(body.records)) {
      body.records = [body.records];
    }
    out.execute = true;
    out.method = payload.method || 'POST';
    let path = payload.path || '';
    if (out.method === 'DELETE') {
      path = path.replace(/([?&])records=/g, '$1records[]=');
    }
    out.path = path;
    out.body = body;
    out.summary = (msgText.split('⟦')[0] || '').replace(/^🛠 Approval needed\\s*/, '').trim();
    return [{ json: out }];
  }

  out.reasonMessage = 'Unrecognized button. Nothing was changed.';
  return [{ json: out }];`
    },
    position: [288, 128]
  },
  output: [{ execute: true, queryId: 'q1', chatId: 1512868522, method: 'PATCH', path: 'app/tbl', body: {}, summary: 'x' }]
});

const answerButtonTap = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Answer Button Tap',
    parameters: {
      resource: 'callback',
      queryId: expr('{{ $json.queryId }}'),
      additionalFields: { text: expr('{{ $json.execute ? "Approved ✅" : "OK" }}') }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [512, 128]
  },
  output: [{ ok: true }]
});

const runApprovedWrite = ifElse({
  version: 2.3,
  config: {
    name: 'Run Approved Write?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'run-write-1', leftValue: expr("{{ $(\"Handle Button Press\").item.json.execute ? \"yes\" : \"no\" }}"), rightValue: 'yes', operator: { type: 'string', operation: 'equals' } }]
      },
      looseTypeValidation: true,
      options: {}
    },
    position: [736, 128]
  }
});

const executeAirtableWrite = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Execute Airtable Write',
    parameters: {
      method: expr("{{ $('Handle Button Press').item.json.method }}"),
      url: expr("https://api.airtable.com/v0/{{ $('Handle Button Press').item.json.path }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ $('Handle Button Press').item.json.body }}"),
      options: { response: { response: { neverError: true } }, timeout: 30000 }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    position: [1216, 32]
  },
  output: [{ records: [{ id: 'rec1' }] }]
});

const recordExecutedWrite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Record Executed Write',
    parameters: { jsCode: `return [{ json: $input.first().json }];` },
    position: [1680, 32]
  },
  output: [{ records: [{ id: 'rec1' }] }]
});

const confirmWriteDone = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Confirm Write Done',
    parameters: {
      chatId: expr("{{ $('Handle Button Press').item.json.chatId }}"),
      text: expr("{{ ($json.error ? ('⚠️   Airtable rejected the change: ' + (typeof $json.error === 'string' ? $json.error : (($json.error.type || 'error') + ($json.error.message ? (' — ' + $json.error.message) : '')))) : ('✅ Done.\\n\\n' + $('Handle Button Press').item.json.summary)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [1904, 32]
  },
  output: [{ ok: true }]
});

const sendOutcomeNotice = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Outcome Notice',
    parameters: {
      chatId: expr("{{ $('Handle Button Press').item.json.chatId }}"),
      text: expr("{{ $('Handle Button Press').item.json.reasonMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [1216, 224]
  },
  output: [{ ok: true }]
});

// ── Message path: gates ──────────────────────────────────────────────────
const addressedToBot = ifElse({
  version: 2.3,
  config: {
    name: 'Addressed to bot?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          { id: '890dca68-3f64-43a1-8cab-e4fc8f786ed1', leftValue: expr("{{ ($json.message?.entities || []).some(entity => entity.type === 'mention' && $json.message.text.substring(entity.offset, entity.offset + entity.length) === '@pod21_n8n_agent_bot') }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
          { id: 'cb830762-aa6a-44f5-8ee1-b92fdf622053', leftValue: expr("{{ ($json.message?.entities || []).some(entity => entity.type === 'mention' && $json.message.text.substring(entity.offset, entity.offset + entity.length) === '@pod21_n8n_agent_bot') || $json.message?.reply_to_message?.from?.username === 'pod21_n8n_agent_bot' }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }
        ],
        combinator: 'or'
      },
      options: {}
    },
    position: [288, 528]
  }
});

const fromJonnyOrCharlie = ifElse({
  version: 2.3,
  config: {
    name: 'From Jonny or Charlie?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          { id: 'from-jonny-1', leftValue: expr('{{ ($json.message?.from?.id ?? 0) === 1512868522 ? "yes" : "no" }}'), rightValue: 'yes', operator: { type: 'string', operation: 'equals' } },
          { id: '68b7d680-3c0f-4537-a2c9-02aa3b10c287', leftValue: expr('{{ ($json.message?.from?.id ?? 0) === 8923732358 ? "yes" : "no" }}'), rightValue: 'yes', operator: { type: 'string', operation: 'equals', name: 'filter.operator.equals' } }
        ],
        combinator: 'or'
      },
      looseTypeValidation: true,
      options: {}
    },
    position: [512, 528]
  }
});

const prepAgentInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prep Agent Input',
    parameters: {
      jsCode: `const results = [];

  // Loop through all incoming items to prevent dropping batched messages
  for (const item of $input.all()) {
    const msg = item.json.message || {};

    // Strip the bot @mention from the user's own text
    let text = (msg.text || '').replace('@pod21_n8n_agent_bot', '').trim();

    // The quoted message may be a plain text message (.text) OR a document/photo
    // sent with a caption (.caption) — e.g. the "Episode metadata ready" document.
    // Reading only .text dropped the caption and starved the agent of context.
    const reply = msg.reply_to_message;
    const quoted = reply ? (reply.text || reply.caption || '') : '';

    if (quoted) {
      text = 'The user is replying to your earlier message: "' + quoted + '". They now say: "' + text + '". The words "this" or "it"\\n  refer to the record that earlier message describes. Read the live base to confirm the exact record before proposing any\\n  write.';
    }

    results.push({
      json: {
        ...item.json, // keep all original Telegram data
        recentActionsNote: '',
        promptText: text
      }
    });
  }

  return results;`
    },
    position: [736, 528]
  },
  output: [{ message: { chat: { id: 1512868522 } }, recentActionsNote: '', promptText: 'hello' }]
});

// ── AI agent + subnodes ──────────────────────────────────────────────────
const openRouterModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  version: 1,
  config: {
    name: 'OpenRouter Sonnet 4.6',
    parameters: { model: 'anthropic/claude-sonnet-4.6', options: { temperature: 0.2 } },
    credentials: { openRouterApi: newCredential('OpenRouter [n8n]') },
    position: [960, 752]
  }
});

const conversationMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.3,
  config: {
    name: 'Conversation Memory',
    parameters: { sessionIdType: 'customKey', sessionKey: expr("airtable-agent-v2-{{ $('Telegram Message Received').item.json.message.chat.id }}"), contextWindowLength: 20 },
    position: [1088, 752]
  }
});

const listAirtableBases = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'list_airtable_bases',
    parameters: {
      toolDescription: 'List all Airtable bases the account has access to. Returns base IDs (start with app) and names. Takes no input.',
      url: 'https://api.airtable.com/v0/meta/bases',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      options: { response: { response: { neverError: true } } }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    position: [1216, 752]
  }
});

const getBaseSchema = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'get_base_schema',
    parameters: {
      toolDescription: 'Get the full schema of one Airtable base: all tables with their IDs, fields, field types and views. Input: baseId.',
      url: expr("https://api.airtable.com/v0/meta/bases/{{ $fromAI('baseId', 'Airtable base ID, starts with app', 'string') }}/tables"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      options: { response: { response: { neverError: true } } }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    position: [1344, 752]
  }
});

const airtableRead = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'airtable_read',
    parameters: {
      toolDescription: 'Generic read-only GET request to the Airtable REST API. Input: the path after https://api.airtable.com/v0/ including any query string. Examples: appXXX/tblYYY?maxRecords=20 lists records, appXXX/tblYYY/recZZZ gets one record, appXXX/tblYYY?filterByFormula=URL-encoded-formula filters records. Returns at most 100 records per page, use pageSize and offset for more.',
      url: expr("https://api.airtable.com/v0/{{ $fromAI('path', 'Path after /v0/ with optional query string, e.g. appXXX/tblYYY?maxRecords=20 or appXXX/tblYYY/recZZZ', 'string') }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      options: { response: { response: { neverError: true } } }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    position: [1472, 752]
  }
});

const airtableAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Airtable Agent',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.promptText }}'),
      options: {
        systemMessage: expr(`You are Pod21's Airtable assistant on Telegram, working for Jonny and Charlie. You can READ anything in the company's
  Airtable account with your tools and answer directly. You can PROPOSE writes (create / update / delete), but a human
  must approve each one before it executes — you can never execute a write yourself.

  Today is {{ $now.toFormat("cccc yyyy-MM-dd") }}.

  == HOW YOU RECEIVE WORK ==
  You only act when someone @mentions you or replies to one of your messages. A turn is either:
  - A direct question or instruction, or
  - A reply to an earlier message. When it's a reply, the user's prompt includes the quoted earlier message ("The user is
  replying to your earlier message: ..."). That quoted message was sent by you or by another Pod21 workflow, and it is
  your primary source of context — read it carefully.

  == INTERPRETING A REPLY (general protocol) ==
  Treat the quoted message as the specification for what the user wants. Most Pod21 workflow notifications already contain
  everything you need; your job is to read it, not to rely on memorised, workflow-specific rules. Work through:
  1. TARGET — Find identifiers in the quoted message: record IDs (rec...), human codes (e.g. BA-a1b2c3), names, or
  base/table hints. Use your read tools to locate the exact record(s). Confirm; never assume.
  2. OPTIONS & CONVENTION — Notification messages usually present labelled or numbered options and state how to reply
  (e.g. "Reply T1-T5 to select a title", "Reply TC1-TC5 to select a caption", "Reply 1-4"). Derive the meaning of any
  shorthand FROM THE MESSAGE ITSELF: "T3" means whatever that message says option T3 is — do not assume a fixed meaning
  across different messages. If the user types their own text instead of a listed option, treat that as a custom choice
  and use it verbatim. One reply may pick several things at once (e.g. a title and a caption).
  3. ACTION —
     - If the quoted message states what to update (which field, status, or table), follow it exactly.
     - Otherwise infer the obvious target by matching the option's label to a field on the record (an option labelled
  "Title" -> the record's title field; "Caption" -> its caption field), confirming exact field names with get_base_schema.
     - Change a record's Status or stage ONLY if the quoted message or the user explicitly asks for it. Never invent a
  state transition.
     - If the right record or field is genuinely ambiguous, ask ONE short clarifying question rather than guess.
  4. PROPOSE — After confirming everything against the live base, propose ONE write covering the whole selection.

  This protocol is deliberately generic: it should handle episode metadata today and any future selection message — social
  posts, shortlist picks, anything — as long as the message says what it offers. You should not need new per-workflow
  instructions; if a message doesn't give you enough to act safely, ask.

  == TOOLS (all read-only) ==
  - list_airtable_bases — list all bases (IDs and names).
  - get_base_schema — tables, field names, field types and views for a base.
  - airtable_read — generic GET to the Airtable API: records, single records, filtered queries.

  == RESPONSE FORMAT (CRITICAL) ==
  Every reply must be ONLY one raw JSON object — no markdown, no code fences, no text outside the JSON. Exactly three
  shapes:
  1. Answer / read result / clarifying question / refusal:
     { "action": "respond", "message": "text sent to the user on Telegram" }
  2. Propose a write:
     { "action": "write", "summary": "plain-English description of exactly what changes and where", "method": "PATCH",
  "path": "appXXX/tblYYY", "body": { "records": [ { "id": "recZZZ", "fields": { "Status": "Recorded" } } ] } }
  3. Show real images as ONE album with a separate details message below — use this INSTEAD of pasting attachment links:
     { "action": "photos", "urls": ["https://...", "https://..."], "caption": "details text for the message below the album" }
     Read the attachment record(s) with your tools and put each full-size attachment URL in "urls", in option order (2-10
  images). They are sent as a SINGLE Telegram album (one message). "caption" is a SHORT text message sent right below the
  album: lead with the record code (BA-xxxx) as the reply anchor, then list each option and its current state read from the
  records, e.g. "BA-eObmD9 — Options: #1 (Rejected), #2 (Selected), #3, #4". End with how to choose if a pick is still open,
  e.g. "Reply 1-4 to pick". Image attachments only — for PDFs / video / audio fall back to "respond" with a link. DEFAULT:
  whenever asked to see, send or show thumbnails or artwork, return them as "photos", not links.

  == WRITE RULES ==
  - Reads never need approval: use tools, then "respond" with the answer.
  - Memory is NOT a source of truth. A write you proposed before may have been cancelled, left unapproved, or failed.
  Before stating that anything exists or changed, call airtable_read and answer only from what it returns right now.
  - Before any filterByFormula, sort, or fields[], call get_base_schema first to confirm exact field names. Don't assume a
  "Name" field; the primary field is usually "Title".
  - Before proposing a write, always resolve the real base ID, table ID, field names and record IDs with read tools and
  check current values. Use real IDs only — never invented ones.
  - Cover the user's ENTIRE request; never silently do only part of it. Batch into one call where the API allows: create
  and update accept up to 10 records in the body; delete accepts up to 10 record IDs as query params, e.g.
  "appXXX/tblYYY?records[]=recAAA&records[]=recBBB" with body { }.
  - Name every affected record in the summary so the approver sees the full scope.
  - If a request genuinely can't fit one call (>10 records, multiple tables, mixed operations), propose the first call and
  state in the summary what remains; the user must ask you to continue after approving — you are NOT re-invoked
  automatically.
  - method must be POST, PATCH, PUT or DELETE. path is everything after https://api.airtable.com/v0/. body must be valid
  JSON for the Airtable API, or { } for DELETE by URL.
  - Propose DELETE only when explicitly asked to delete something.
  - If unsure which base, table, record or field is meant, ask ONE short clarifying question. Never guess on writes.

  == ARTWORK REVISIONS ==
  When Jonny or Charlie asks to revise, re-do, re-create or change the artwork / thumbnail for an episode (e.g. "redo the
  9x16 for BA-eObmD9, make the background more red and lose the laptop"), treat it as a WRITE with this exact recipe:
  1. Resolve the episode: find its Episodes record in base app8Xw9Tq0XLjhmp9 (table tbl3uYLIvtB9APZp6) by the BA-xxxx code
  in the "ID" field. Then find its chosen thumbnail: table "Thumbnails", the row linked to that episode whose Status =
  "Final" (confirm field names with get_base_schema, and read to get the real rec... row id). There is normally exactly one
  Final row per episode.
  2. Propose ONE PATCH to that one Thumbnails row, setting only these three fields:
     - "Revision Brief" = the user's requested change, verbatim and complete (e.g. "make the background more red and remove
  the laptop"). Include every part of what they asked for.
     - "Revision Targets" = an array of the aspect ratios they named, each one of "16x9", "1x1", "9x16". Map their wording:
  16x9 / 16:9 / landscape / wide -> "16x9"; 1x1 / square -> "1x1"; 9x16 / 9:16 / vertical / portrait / story -> "9x16". If
  they name NO ratio (e.g. "redo the artwork for BA-xxxx"), use all three ["16x9","1x1","9x16"] and say so in the summary.
     - "Status" = "Revising".
  3. In the summary, name the episode, the exact brief text, and which ratios will be redone, so the approver sees the full
  scope before tapping Approve.
  After approval the thumbnail workflow regenerates only those ratios with the brief, overwrites them on the row, sends the
  new artwork back to this chat, and resets Status to Final. You do nothing further.
  Guardrails: this only works once artwork has been PICKED (a Final row exists). If there is no Final thumbnail row for the
  episode, do NOT write — "respond" telling them the artwork hasn't been selected yet. Never touch the images or any other
  fields yourself; only these three fields on the one Final row.

  == STYLE ==
  Keep messages short, plain text, no markdown tables, under 3500 characters. Use simple lists like "1. ..." on separate
  lines.

  == HOW THE PIPELINE WORKS (System Map) ==
  There is a living reference called the "System Map" that explains how all the Pod21 / Guy's Take automations fit
  together: what triggers each workflow, the exact Airtable field conditions an episode needs before the next stage runs,
  the Status ladder, and what each episode Type means. It lives in Airtable so it can be edited without touching n8n.
  Whenever a turn is about how the workflows work, why something has or hasn't happened, where an episode is in the
  pipeline, or what an episode still needs before a stage (e.g. artwork) will run: FIRST read the System Map, then answer
  from it. Read it with airtable_read from base app8Xw9Tq0XLjhmp9, table "Prompts", the record where Name = "System Map"
  (filterByFormula={Name}="System Map"); treat the long-text "Prompt" field as authoritative. Do not answer pipeline
  questions from memory. You may still read a specific episode's live field values and compare them against the Map's
  precondition checklist to say what is missing.

  == KNOWN CONTEXT (verify with tools, don't assume) ==
  Main base: Guy's Take (app8Xw9Tq0XLjhmp9) — Episodes (tbl3uYLIvtB9APZp6), plus Stories and Shortlist tables used by a
  weekly YouTube research run. Authorized users / approvers are Jonny and Charlie.

  {{ $json.recentActionsNote }}`),
        maxIterations: 15,
        enableStreaming: false
      }
    },
    subnodes: { model: openRouterModel, memory: conversationMemory, tools: [listAirtableBases, getBaseSchema, airtableRead] },
    position: [1152, 528]
  },
  output: [{ output: '{ "action": "respond", "message": "Here you go." }' }]
});

// ── Parse + route ────────────────────────────────────────────────────────
const parseAgentDecision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Agent Decision',
    parameters: {
      jsCode: `const raw = String($input.first().json.output ?? '').trim();
  const fence = String.fromCharCode(96).repeat(3);
  let cleaned = raw.replace(new RegExp('^' + fence + '(?:json)?', 'i'), '').replace(new RegExp(fence + '$'), '').trim();
  let parsed = null;
  try { parsed = JSON.parse(cleaned); } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch (e2) { parsed = null; }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    parsed = { action: 'respond', message: raw || 'I produced no usable answer, please try again.' };
  }
  const allowed = ['POST', 'PATCH', 'PUT', 'DELETE'];
  let out;
  if (parsed.action === 'write') {
    const method = String(parsed.method || '').toUpperCase();
    const path = String(parsed.path || '').replace(/^\\/+/, '');
    let body = parsed.body && typeof parsed.body === 'object' ? parsed.body : {};
    if (body.records && !Array.isArray(body.records)) {
      body.records = [body.records];
    }
    if (!allowed.includes(method) || !path) {
      out = { action: 'respond', message: 'The agent proposed an invalid write request, nothing was changed. Please rephrase your request.', summary: '', method: 'POST', path: '', body: {} };
    } else {
      out = { action: 'write', message: '', summary: String(parsed.summary || 'No summary provided'), method: method, path: path, body: body };
    }
  } else if (parsed.action === 'photos') {
    const urls = Array.isArray(parsed.urls) ? parsed.urls.filter(u => typeof u === 'string' && /^https?:\\/\\//i.test(u)).slice(0, 10) : [];
    if (urls.length === 0) {
      out = { action: 'respond', message: String(parsed.message || parsed.caption || 'I had no images to send.'), summary: '', method: 'POST', path: '', body: {} };
    } else {
      out = { action: 'photos', caption: String(parsed.caption || ''), urls: urls, message: '', summary: '', method: 'POST', path: '', body: {} };
    }
  } else {
    out = { action: 'respond', message: String(parsed.message ?? raw), summary: '', method: 'POST', path: '', body: {} };
  }
  return [{ json: out }];`
    },
    position: [1680, 528]
  },
  output: [{ action: 'photos', urls: ['https://x/1', 'https://x/2'], captions: ['Option 1', 'Option 2'], caption: '', message: '', summary: '', method: 'POST', path: '', body: {} }]
});

const isWriteRequest = ifElse({
  version: 2.3,
  config: {
    name: 'Is Write Request?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'is-write-1', leftValue: expr('{{ $json.action }}'), rightValue: 'write', operator: { type: 'string', operation: 'equals' } }]
      },
      looseTypeValidation: true,
      options: {}
    },
    position: [1904, 528]
  }
});

const stashPendingWrite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Stash Pending Write',
    parameters: {
      jsCode: `const item = $input.first().json;
  const payload = JSON.stringify({ method: item.method, path: item.path, body: item.body });
  return [{ json: { summary: item.summary, payload: payload, method: item.method, path: item.path, body: item.body } }];`
    },
    position: [2128, 624]
  },
  output: [{ summary: 'x', payload: '{}', method: 'POST', path: 'app/tbl', body: {} }]
});

const sendApprovalButtons = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Approval Buttons',
    parameters: {
      chatId: expr("{{ $('Telegram Message Received').item.json.message.chat.id }}"),
      text: expr("=🛠 Approval needed\n  \n  {{ $json.summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}\n  \n  ⟦{{ $json.payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}⟧"),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [{ row: { buttons: [{ text: '✅ Approve', additionalFields: { callback_data: 'wa' } }, { text: '❌ Cancel', additionalFields: { callback_data: 'wc' } }] } }] },
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [2352, 624]
  },
  output: [{ ok: true }]
});

const sendAnswer = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Answer',
    parameters: {
      chatId: expr("{{ $('Telegram Message Received').item.json.message.chat.id }}"),
      text: expr("{{ $json.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [2352, 432]
  },
  output: [{ ok: true }]
});

// ── NEW: photo reply path ────────────────────────────────────────────────
const isPhotoReply = ifElse({
  version: 2.3,
  config: {
    name: 'Is Photo Reply?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ id: 'is-photo-1', leftValue: expr('{{ $json.action }}'), rightValue: 'photos', operator: { type: 'string', operation: 'equals' } }]
      },
      looseTypeValidation: true,
      options: {}
    },
    position: [2128, 760]
  }
});

const buildPhotoAlbum = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Photo Album',
    parameters: {
      jsCode: `const item = $input.first().json;
  const chatId = $('Telegram Message Received').first().json.message.chat.id;
  let urls = (Array.isArray(item.urls) ? item.urls : []).filter(u => typeof u === 'string' && u).slice(0, 4);
  // The native sendMediaGroup uses 4 STATIC slots (array-expressions don't work). Every slot must
  // resolve, and a Telegram album is 2-10 items with no empties. Thumbnails are always 4; pad short
  // sets by repeating the last URL as a crash-safety net for the rare <4 case.
  while (urls.length > 0 && urls.length < 4) { urls.push(urls[urls.length - 1]); }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const caption = esc(String(item.caption || 'Reply with the option number to pick.'));
  return [{ json: { chatId: chatId, caption: caption, urls: urls } }];`
    },
    position: [2352, 840]
  },
  output: [{ chatId: 1512868522, caption: 'BA-xxxx — Options: #1, #2', urls: ['https://x/1', 'https://x/2', 'https://x/3', 'https://x/4'] }]
});

const sendAlbum = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Album',
    parameters: {
      resource: 'message',
      operation: 'sendMediaGroup',
      chatId: expr("{{ $('Build Photo Album').item.json.chatId }}"),
      media: { media: [
        { type: 'photo', media: expr("{{ $('Build Photo Album').item.json.urls[0] }}"), additionalFields: {} },
        { type: 'photo', media: expr("{{ $('Build Photo Album').item.json.urls[1] }}"), additionalFields: {} },
        { type: 'photo', media: expr("{{ $('Build Photo Album').item.json.urls[2] }}"), additionalFields: {} },
        { type: 'photo', media: expr("{{ $('Build Photo Album').item.json.urls[3] }}"), additionalFields: {} }
      ] }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [2576, 840]
  },
  output: [{ ok: true, result: [{ message_id: 1 }] }]
});

const sendAlbumDetails = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Album Details',
    parameters: {
      chatId: expr("{{ $('Build Photo Album').item.json.chatId }}"),
      text: expr("{{ $('Build Photo Album').item.json.caption }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    executeOnce: true,
    position: [2800, 840]
  },
  output: [{ ok: true }]
});

// ── Compose ──────────────────────────────────────────────────────────────
// NOTE: kept on a single line on purpose — the SDK parser mis-handles deeply
// nested multi-line .onTrue()/.onFalse() chains when both branches are complex.
export default workflow('telegram-airtable-assistant', 'BA: Telegram Airtable Assistant').add(telegramTrigger).to(isButtonPress.onTrue(handleButtonPress.to(answerButtonTap).to(runApprovedWrite.onTrue(executeAirtableWrite.to(recordExecutedWrite).to(confirmWriteDone)).onFalse(sendOutcomeNotice))).onFalse(addressedToBot.onTrue(fromJonnyOrCharlie.onTrue(prepAgentInput.to(airtableAgent).to(parseAgentDecision).to(isWriteRequest.onTrue(stashPendingWrite.to(sendApprovalButtons)).onFalse(isPhotoReply.onTrue(buildPhotoAlbum.to(sendAlbum).to(sendAlbumDetails)).onFalse(sendAnswer)))))));
