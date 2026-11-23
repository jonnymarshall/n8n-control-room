import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow e8tczdCg5MB0RSVP, fetched 2026-11-23.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh e8tczdCg5MB0RSVP audionauts-post-selected-keet-telegram-linked
const liveNodes = [
  {"id": "b1100000-0000-4000-8000-000000000001", "name": "Social Posts Changed", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [0, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbly8EpeOlYrXHYNE", "cachedResultName": "Social Posts"}, "triggerField": "Last Modified Time", "additionalFields": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "b1100000-0000-4000-8000-000000000002", "name": "Pick Audionauts Selected", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 300], "parameters": {"jsCode": "// Why Code: only Audionauts copy belongs here; X options have their own selection workflow.\nconst seen = new Set();\nconst out = [];\nfor (const it of $input.all()) {\n  const row = it.json || {};\n  const f = row.fields || row;\n  if (String(f.Status || '').trim() !== 'Selected') continue;\n  if (String(f.Platform || '').trim() !== 'Keet + Telegram') continue;\n  const rawLink = Array.isArray(f.Episode) ? f.Episode[0] : f.Episode;\n  const episodeRecordId = typeof rawLink === 'string' ? rawLink : rawLink?.id;\n  if (!episodeRecordId) continue;\n  if (seen.has(episodeRecordId)) continue;\n  seen.add(episodeRecordId);\n  const first = (v) => Array.isArray(v) ? v[0] : v;\n  const copy = String(f.Copy || '').trim();\n  if (!copy) throw new Error('Selected Audionauts row ' + row.id + ' has no body');\n  out.push({ json: {\n    rowId: row.id,\n    episodeRecordId: episodeRecordId,\n    episodeId: String(first(f['Episode ID']) || 'no-id').trim(),\n    title: String(first(f['Episode Title']) || '(untitled)').trim(),\n    copy: copy,\n    characters: Number(f.Characters || copy.length),\n    round: Number(f.Round || 1)\n  }});\n}\nreturn out;"}},
  {"id": "b1100000-0000-4000-8000-000000000003", "name": "Find Keet Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [440, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "={{ \"{Publication}='\" + $('Pick Audionauts Selected').first().json.episodeId + \" - Keet'\" }}"}, {"name": "maxRecords", "value": "1"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000004", "name": "Keet Row Exists?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [660, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "keet-exists", "leftValue": "={{ ($json.records || []).length > 0 }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "b1100000-0000-4000-8000-000000000005", "name": "Update Keet Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 200], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw/{{ $('Find Keet Publication').first().json.records[0].id }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ fields: { 'Post Copy': $('Pick Audionauts Selected').first().json.copy, 'Social Post': [$('Pick Audionauts Selected').first().json.rowId] } }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000006", "name": "Create Keet Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 400], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "POST", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ records: [{ fields: { Publication: $('Pick Audionauts Selected').first().json.episodeId + ' - Keet', Episode: [$('Pick Audionauts Selected').first().json.episodeRecordId], Platform: 'Keet', Status: 'Pending', 'Post Copy': $('Pick Audionauts Selected').first().json.copy, 'Social Post': [$('Pick Audionauts Selected').first().json.rowId] } }], typecast: true }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000007", "name": "Find Telegram Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1100, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "={{ \"{Publication}='\" + $('Pick Audionauts Selected').first().json.episodeId + \" - Telegram'\" }}"}, {"name": "maxRecords", "value": "1"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000008", "name": "Telegram Row Exists?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1320, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "tg-exists", "leftValue": "={{ ($json.records || []).length > 0 }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "b1100000-0000-4000-8000-000000000009", "name": "Update Telegram Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1540, 200], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw/{{ $('Find Telegram Publication').first().json.records[0].id }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ fields: { 'Post Copy': $('Pick Audionauts Selected').first().json.copy, 'Social Post': [$('Pick Audionauts Selected').first().json.rowId] } }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000010", "name": "Create Telegram Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1540, 400], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "POST", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ records: [{ fields: { Publication: $('Pick Audionauts Selected').first().json.episodeId + ' - Telegram', Episode: [$('Pick Audionauts Selected').first().json.episodeRecordId], Platform: 'Telegram', Status: 'Pending', 'Post Copy': $('Pick Audionauts Selected').first().json.copy, 'Social Post': [$('Pick Audionauts Selected').first().json.rowId] } }], typecast: true }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "b1100000-0000-4000-8000-000000000011", "name": "Build Linked Message", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1760, 300], "parameters": {"jsCode": "const NL = String.fromCharCode(10);\nconst esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst j = $('Pick Audionauts Selected').first().json;\nconst text = [\n  '\\u2705 <b>Audionauts post linked</b>',\n  '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500',\n  '<code>' + esc(j.episodeId) + '</code> \\u00b7 ' + esc(j.title),\n  '',\n  'Keet and Telegram rows now hold the copy. Neither is posted automatically.',\n  '',\n  '<i>' + j.characters + ' / 1000 characters</i>',\n  '',\n  '\\u2699\\ufe0f <code>' + $workflow.id + '</code> \\u00b7 exec <code>' + $execution.id + '</code>'\n].join(NL);\nreturn [{ json: { text } }];"}},
  {"id": "b1100000-0000-4000-8000-000000000012", "name": "Send Linked Message", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1980, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "1457444a-0961-41cc-8e58-80f69951f4f6", "parameters": {"chatId": "-5254203539", "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Social Posts Changed', 0, 'Pick Audionauts Selected'],
  ['Pick Audionauts Selected', 0, 'Find Keet Publication'],
  ['Find Keet Publication', 0, 'Keet Row Exists?'],
  ['Keet Row Exists?', 0, 'Update Keet Publication'],
  ['Keet Row Exists?', 1, 'Create Keet Publication'],
  ['Update Keet Publication', 0, 'Find Telegram Publication'],
  ['Create Keet Publication', 0, 'Find Telegram Publication'],
  ['Find Telegram Publication', 0, 'Telegram Row Exists?'],
  ['Telegram Row Exists?', 0, 'Update Telegram Publication'],
  ['Telegram Row Exists?', 1, 'Create Telegram Publication'],
  ['Update Telegram Publication', 0, 'Build Linked Message'],
  ['Create Telegram Publication', 0, 'Build Linked Message'],
  ['Build Linked Message', 0, 'Send Linked Message']
];

const audionautsPostSelectedKeetTelegramLinked = workflow(
  "e8tczdCg5MB0RSVP",
  "BA - Audionauts Post Selected > Keet and Telegram Linked"
).settings({
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
  executionTimeout: 1800,
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) audionautsPostSelectedKeetTelegramLinked.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  audionautsPostSelectedKeetTelegramLinked.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default audionautsPostSelectedKeetTelegramLinked;
