import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow DFkl8armVlXqBWWD, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh DFkl8armVlXqBWWD agentmail-episode-scheduling
const liveNodes = [
  {"id": "wh-agentmail", "name": "AgentMail Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [240, 400], "webhookId": "agentmail-scheduling", "parameters": {"httpMethod": "POST", "options": {}, "path": "agentmail-scheduling", "responseMode": "onReceived"}},
  {"id": "code-classify", "name": "Classify Email", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [460, 400], "parameters": {"jsCode": "const body = $json.body || {};\nconst msg = body.message || {};\nconst subject = msg.subject || '';\nconst from = msg.from || '';\nconst text = msg.text || '';\nconst html = msg.html || '';\nconst hay = subject + '\\n' + text + '\\n' + html;\nconst idm = hay.match(/BA-[A-Za-z0-9]{6}/);\nconst episodeId = idm ? idm[0] : '';\nconst atts = msg.attachments || [];\nlet ics = atts.find((a) => ((a.filename || '').toLowerCase().endsWith('.ics')));\nif (!ics) ics = atts.find((a) => ((a.content_type || '').toLowerCase().includes('calendar')));\nlet kind = 'ignore';\nif (ics && /invitat/i.test(subject)) kind = 'confirmed';\nelse if (ics && /cancel/i.test(subject)) kind = 'canceled';\nelse if (!ics && episodeId && /pod21\\.xyz|jonnymarshall5@gmail\\.com/i.test(from)) kind = 'created';\nreturn { json: { kind: kind, episodeId: episodeId, inboxId: msg.inbox_id || 'pod21@agentmail.to', messageIdEnc: encodeURIComponent(msg.message_id || ''), attachmentId: ics ? (ics.attachment_id || '') : '', subject: subject, from: from } };", "mode": "runOnceForEachItem"}},
  {"id": "sw-kind", "name": "Route by Kind", "type": "n8n-nodes-base.switch", "typeVersion": 3.4, "position": [680, 400], "parameters": {"options": {}, "rules": {"values": [{"conditions": {"combinator": "and", "conditions": [{"id": "k1", "leftValue": "={{ $json.kind }}", "operator": {"operation": "equals", "type": "string"}, "rightValue": "confirmed"}], "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}}, "outputKey": "Confirmed", "renameOutput": true}, {"conditions": {"combinator": "and", "conditions": [{"id": "k2", "leftValue": "={{ $json.kind }}", "operator": {"operation": "equals", "type": "string"}, "rightValue": "canceled"}], "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}}, "outputKey": "Canceled", "renameOutput": true}, {"conditions": {"combinator": "and", "conditions": [{"id": "k3", "leftValue": "={{ $json.kind }}", "operator": {"operation": "equals", "type": "string"}, "rightValue": "created"}], "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}}, "outputKey": "Created", "renameOutput": true}]}}},
  {"id": "hr-icsmeta", "name": "Get ICS Meta", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [920, 200], "parameters": {"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "method": "GET", "options": {}, "url": "=https://api.agentmail.to/v0/inboxes/{{ $json.inboxId }}/messages/{{ $json.messageIdEnc }}/attachments/{{ $json.attachmentId }}"}, "credentials": {"httpHeaderAuth": {"id": "jqAh9IavoFvyohV5", "name": "AgentMail (n8n control room)"}}},
  {"id": "at-find-cancel", "name": "Find Episode (Canceled)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [920, 440], "alwaysOutputData": true, "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "filterByFormula": "={{ 'AND({ID}=\"' + $json.episodeId + '\",{ID}!=\"\")' }}", "limit": 1, "operation": "search", "options": {}, "returnAll": false, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "at-find-created", "name": "Find Episode (Created)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [920, 680], "alwaysOutputData": true, "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "filterByFormula": "={{ 'AND({ID}=\"' + $json.episodeId + '\",{ID}!=\"\")' }}", "limit": 1, "operation": "search", "options": {}, "returnAll": false, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "hr-icsfile", "name": "Download ICS", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1140, 200], "parameters": {"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "method": "GET", "options": {"response": {"responseFormat": "text"}}, "url": "={{ $json.download_url }}"}, "credentials": {"httpHeaderAuth": {"id": "jqAh9IavoFvyohV5", "name": "AgentMail (n8n control room)"}}},
  {"id": "at-set-cancel", "name": "Set Scheduling (Cancel)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1140, 440], "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {"id": "={{ $json.id }}", "Status": "Scheduling", "Record Date": "={{ null }}"}}, "operation": "update", "options": {"typecast": true}, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "if-found-cancel", "name": "Found? (Canceled)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1140, 540], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "fx1", "leftValue": "={{ $json.id }}", "operator": {"operation": "notEmpty", "singleValue": true, "type": "string"}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "at-set-created", "name": "Set Scheduling (Poll)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1140, 680], "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {"id": "={{ $json.id }}", "Status": "Scheduling", "Record Date": "={{ null }}"}}, "operation": "update", "options": {"typecast": true}, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "if-found-created", "name": "Found? (Created)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1140, 800], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "fr1", "leftValue": "={{ $json.id }}", "operator": {"operation": "notEmpty", "singleValue": true, "type": "string"}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "if-elig-cancel", "name": "Eligible? (Canceled)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1340, 540], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "c1", "leftValue": "={{ ($json.fields.Status || '') === 'Scheduled' }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "if-elig-created", "name": "Eligible? (Created)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1340, 800], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "c1", "leftValue": "={{ !$json.fields.Status || ['Script Ready','Stories Picked','Research Ready','Suspended'].includes($json.fields.Status) }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "code-ics", "name": "Parse ICS", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1360, 200], "parameters": {"jsCode": "const raw = $json;\nlet s = '';\nif (typeof raw === 'string') s = raw;\nelse if (raw && typeof raw.data === 'string') s = raw.data;\nelse if (raw && raw.body && typeof raw.body === 'string') s = raw.body;\nelse s = JSON.stringify(raw);\nconst vi = s.indexOf('BEGIN:VEVENT');\nconst ve = s.indexOf('END:VEVENT');\nconst block = (vi >= 0 && ve > vi) ? s.slice(vi, ve) : s;\nconst m = block.match(/DTSTART[^:\\r\\n]*:(\\d{8}T\\d{6})(Z?)/);\nlet startIso = '';\nif (m) {\n  const d = m[1];\n  const base = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + 'T' + d.slice(9, 11) + ':' + d.slice(11, 13) + ':' + d.slice(13, 15);\n  let offset = 'Z';\n  if (!m[2]) {\n    const subj = $('Classify Email').first().json.subject || '';\n    const g = subj.match(/\\(GMT([+-]\\d{1,2})(?::(\\d{2}))?\\)/);\n    if (g) { const neg = g[1].charAt(0) === '-'; const hh = String(Math.abs(parseInt(g[1], 10))).padStart(2, '0'); offset = (neg ? '-' : '+') + hh + ':' + (g[2] || '00'); }\n  }\n  const dt = new Date(base + offset);\n  if (!isNaN(dt.getTime())) startIso = dt.toISOString();\n}\nreturn { json: { startIso: startIso } };", "mode": "runOnceForEachItem"}},
  {"id": "tg-cancel", "name": "Notify Canceled", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1360, 440], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "d5f50244-ccee-4cab-a670-a1041615bfd2", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=↩️ <b>Booking canceled</b>\n\n{{ $('Find Episode (Canceled)').first().json.fields.Title ? $('Find Episode (Canceled)').first().json.fields.Title + ' · ' : '' }}<code>{{ $('Find Episode (Canceled)').first().json.fields.ID }}</code>\nBack to Scheduling.\n\nIf the whole episode is cancelled, reply to this message with <i>suspend this episode</i> to set it to Suspended."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "tg-created", "name": "Notify Poll Sent", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1360, 680], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "147fe550-df3c-4ac6-938f-eaa0f5af0112", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=🗓️ <b>Scheduling</b>\n\n{{ $('Find Episode (Created)').first().json.fields.Title ? $('Find Episode (Created)').first().json.fields.Title + ' · ' : '' }}<code>{{ $('Find Episode (Created)').first().json.fields.ID }}</code>\nPoll sent to guests - waiting on votes."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "tg-unmatched", "name": "Not Matched Alert", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1500, 980], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "b59c3863-4245-4ce5-adf9-79d2279eb369", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=⚠️ <b>Scheduling email: no episode with that ID</b>\n\nKind: {{ $('Classify Email').first().json.kind }}\nEpisode ID: <code>{{ $('Classify Email').first().json.episodeId || 'none' }}</code>\nSubject: {{ $('Classify Email').first().json.subject }}\n\nNothing was changed."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "tg-guard-cancel", "name": "Guard Blocked (Canceled)", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1560, 620], "webhookId": "10ca1173-0ba7-41c8-bc19-7e4cc12fd274", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=⚠️ <b>Scheduling email blocked by status guard</b>\n\nKind: {{ $('Classify Email').first().json.kind }}\nEpisode: <code>{{ $('Find Episode (Canceled)').first().json.fields.ID }}</code>\nCurrent status: <b>{{ $('Find Episode (Canceled)').first().json.fields.Status || 'blank' }}</b>\nThis email type only acts on: Scheduled\n\nNothing was changed - update the episode by hand if it needs moving."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "tg-guard-created", "name": "Guard Blocked (Created)", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1560, 880], "webhookId": "114f58a8-ba3f-4fd6-9861-6ccc0a2f7b20", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=⚠️ <b>Scheduling email blocked by status guard</b>\n\nKind: {{ $('Classify Email').first().json.kind }}\nEpisode: <code>{{ $('Find Episode (Created)').first().json.fields.ID }}</code>\nCurrent status: <b>{{ $('Find Episode (Created)').first().json.fields.Status || 'blank' }}</b>\nThis email type only acts on: blank, Script Ready, Stories Picked, Research Ready, Suspended\n\nNothing was changed - update the episode by hand if it needs moving."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "at-find-conf", "name": "Find Episode (Confirmed)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1580, 200], "alwaysOutputData": true, "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "filterByFormula": "={{ 'AND({ID}=\"' + $('Classify Email').first().json.episodeId + '\",{ID}!=\"\")' }}", "limit": 1, "operation": "search", "options": {}, "returnAll": false, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "if-found-conf", "name": "Found? (Confirmed)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1720, 120], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "fc1", "leftValue": "={{ $json.id }}", "operator": {"operation": "notEmpty", "singleValue": true, "type": "string"}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "at-set-sched", "name": "Set Scheduled", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1800, 200], "parameters": {"authentication": "airtableTokenApi", "base": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "columns": {"mappingMode": "defineBelow", "matchingColumns": ["id"], "value": {"id": "={{ $json.id }}", "Record Date": "={{ $('Parse ICS').first().json.startIso || null }}", "Status": "Scheduled"}}, "operation": "update", "options": {"typecast": true}, "table": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "if-elig-conf", "name": "Eligible? (Confirmed)", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1900, 80], "parameters": {"conditions": {"combinator": "and", "conditions": [{"id": "c1", "leftValue": "={{ !$json.fields.Status || ['Script Ready','Stories Picked','Research Ready','Scheduling','Scheduled','Suspended'].includes($json.fields.Status) }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}}, "options": {}}},
  {"id": "tg-sched", "name": "Notify Scheduled", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2020, 200], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "59771df6-3142-4da0-8e93-90e598467aab", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=✅ <b>Scheduled</b>\n\n{{ $('Find Episode (Confirmed)').first().json.fields.Title ? $('Find Episode (Confirmed)').first().json.fields.Title + ' · ' : '' }}<code>{{ $('Find Episode (Confirmed)').first().json.fields.ID }}</code>\n📅 {{ $('Parse ICS').first().json.startIso ? DateTime.fromISO($('Parse ICS').first().json.startIso).toFormat(\"ccc, LLL d, yyyy 'at' h:mm a ZZZZ\") : 'time TBC' }}"}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "tg-guard-conf", "name": "Guard Blocked (Confirmed)", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2120, 20], "webhookId": "2fc8d8ea-774e-4af2-8841-e8cbbdc8ce33", "parameters": {"additionalFields": {"parse_mode": "HTML"}, "chatId": "-5254203539", "operation": "sendMessage", "text": "=⚠️ <b>Scheduling email blocked by status guard</b>\n\nKind: {{ $('Classify Email').first().json.kind }}\nEpisode: <code>{{ $('Find Episode (Confirmed)').first().json.fields.ID }}</code>\nCurrent status: <b>{{ $('Find Episode (Confirmed)').first().json.fields.Status || 'blank' }}</b>\nThis email type only acts on: blank, Script Ready, Stories Picked, Research Ready, Scheduling, Scheduled, Suspended\n\nNothing was changed - update the episode by hand if it needs moving."}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
];

// Node types that start an execution. Everything else is a regular step.
const TRIGGER_TYPES = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.formTrigger',
  'n8n-nodes-base.airtableTrigger',
  'n8n-nodes-base.telegramTrigger',
  'n8n-nodes-base.gmailTrigger',
  'n8n-nodes-base.executeWorkflowTrigger'
]);

const nodesByName = {};
for (const live of liveNodes) {
  const { type, typeVersion, credentials, ...config } = live;
  if (credentials) {
    config.credentials = Object.fromEntries(
      Object.entries(credentials).map(([credentialType, reference]) => [credentialType, { id: reference.id, name: reference.name }])
    );
  }
  nodesByName[live.name] = (TRIGGER_TYPES.has(type) ? trigger : node)({
    type,
    version: typeVersion,
    config,
    output: [{}]
  });
}

// [source, sourceOutputIndex, target, targetInputIndex?]
const connections = [
  ['AgentMail Webhook', 0, 'Classify Email'],
  ['Classify Email', 0, 'Route by Kind'],
  ['Route by Kind', 0, 'Get ICS Meta'],
  ['Route by Kind', 1, 'Find Episode (Canceled)'],
  ['Route by Kind', 2, 'Find Episode (Created)'],
  ['Get ICS Meta', 0, 'Download ICS'],
  ['Download ICS', 0, 'Parse ICS'],
  ['Parse ICS', 0, 'Find Episode (Confirmed)'],
  ['Find Episode (Confirmed)', 0, 'Found? (Confirmed)'],
  ['Found? (Confirmed)', 0, 'Eligible? (Confirmed)'],
  ['Found? (Confirmed)', 1, 'Not Matched Alert'],
  ['Eligible? (Confirmed)', 0, 'Set Scheduled'],
  ['Eligible? (Confirmed)', 1, 'Guard Blocked (Confirmed)'],
  ['Set Scheduled', 0, 'Notify Scheduled'],
  ['Find Episode (Canceled)', 0, 'Found? (Canceled)'],
  ['Found? (Canceled)', 0, 'Eligible? (Canceled)'],
  ['Found? (Canceled)', 1, 'Not Matched Alert'],
  ['Eligible? (Canceled)', 0, 'Set Scheduling (Cancel)'],
  ['Eligible? (Canceled)', 1, 'Guard Blocked (Canceled)'],
  ['Set Scheduling (Cancel)', 0, 'Notify Canceled'],
  ['Find Episode (Created)', 0, 'Found? (Created)'],
  ['Found? (Created)', 0, 'Eligible? (Created)'],
  ['Found? (Created)', 1, 'Not Matched Alert'],
  ['Eligible? (Created)', 0, 'Set Scheduling (Poll)'],
  ['Eligible? (Created)', 1, 'Guard Blocked (Created)'],
  ['Set Scheduling (Poll)', 0, 'Notify Poll Sent']
];

const agentmailEpisodeScheduling = workflow(
  "DFkl8armVlXqBWWD",
  "AgentMail Received > Episode Scheduling"
).settings({
  executionOrder: "v1",
  errorWorkflow: "9PMI1kuBjLW2YHwb"
});

for (const live of liveNodes) agentmailEpisodeScheduling.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  agentmailEpisodeScheduling.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default agentmailEpisodeScheduling;
