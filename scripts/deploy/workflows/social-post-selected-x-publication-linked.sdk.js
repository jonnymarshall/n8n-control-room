import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow 6m5s6x2sYMWJRz1s, fetched 2026-11-16.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh 6m5s6x2sYMWJRz1s social-post-selected-x-publication-linked
const liveNodes = [
  {"id": "e2000000-0000-4000-8000-000000000001", "name": "Social Posts Changed", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [0, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbly8EpeOlYrXHYNE", "cachedResultName": "Social Posts"}, "triggerField": "Last Modified Time", "additionalFields": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "e2000000-0000-4000-8000-000000000002", "name": "Pick Selected", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 300], "parameters": {"jsCode": "// Why Code: turns one changed option row into one selection job per episode and skips every other status.\nconst seen = new Set();\nconst out = [];\nfor (const it of $input.all()) {\n  const row = it.json || {};\n  const f = row.fields || row;\n  if (String(f.Status || '').trim() !== 'Selected') continue;\n  const rawLink = Array.isArray(f.Episode) ? f.Episode[0] : f.Episode;\n  const episodeRecordId = typeof rawLink === 'string' ? rawLink : rawLink?.id;\n  if (!episodeRecordId) continue;\n  if (seen.has(episodeRecordId)) continue;\n  seen.add(episodeRecordId);\n  const first = (v) => Array.isArray(v) ? v[0] : v;\n  out.push({ json: {\n    rowId: row.id,\n    episodeRecordId: episodeRecordId,\n    episodeId: String(first(f['Episode ID']) || 'no-id').trim(),\n    title: String(first(f['Episode Title']) || '(untitled)').trim(),\n    copy: String(f.Copy || '').trim(),\n    cta: String(f.CTA || '').trim(),\n    option: Number(f.Option || 0),\n    round: Number(f.Round || 1),\n    characters: Number(f.Characters || 0)\n  }});\n}\nreturn out;"}},
  {"id": "e2000000-0000-4000-8000-000000000003", "name": "Fetch Episode Posts", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [480, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbly8EpeOlYrXHYNE", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "=FIND(\"{{ $json.episodeId }}\", ARRAYJOIN({Episode}))"}, {"name": "maxRecords", "value": "20"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e2000000-0000-4000-8000-000000000004", "name": "Prepare Selection", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [720, 300], "parameters": {"jsCode": "// Why Code: finds the siblings that must be rejected and builds the publication payload once.\nconst job = $('Pick Selected').first().json;\nconst rows = $input.first().json.records || [];\nconst chosen = rows.find(r => r.id === job.rowId);\nif (!chosen) throw new Error('Selected social post row ' + job.rowId + ' was not returned by Airtable');\nconst siblings = rows\n  .filter(r => r.id !== job.rowId && String(r.fields?.Status || '').trim() !== 'Rejected')\n  .map(r => r.id);\nif (!job.copy) throw new Error('Selected social post row ' + job.rowId + ' has no body');\nif (!job.cta) throw new Error('Selected social post row ' + job.rowId + ' has no CTA');\nconst fullCopy = job.copy + String.fromCharCode(10) + String.fromCharCode(10) + job.cta;\nreturn [{ json: {\n  ...job,\n  publicationName: job.episodeId + ' - X',\n  siblings: siblings,\n  fullCopy: fullCopy,\n  publicationFields: {\n    'Post Copy': fullCopy,\n    'Social Post': [job.rowId]\n  },\n  createFields: {\n    Publication: job.episodeId + ' - X',\n    Episode: [job.episodeRecordId],\n    Platform: 'X',\n    Status: 'Pending',\n    'Post Copy': fullCopy,\n    'Social Post': [job.rowId]\n  }\n}}];"}},
  {"id": "e2000000-0000-4000-8000-000000000005", "name": "Find X Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [960, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "={Publication}=\"{{ $json.publicationName }}\""}, {"name": "maxRecords", "value": "1"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e2000000-0000-4000-8000-000000000006", "name": "Publication Exists?", "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [1200, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "loose", "version": 2}, "conditions": [{"id": "cond-exists", "leftValue": "={{ ($json.records || []).length }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}], "combinator": "and"}, "options": {}}},
  {"id": "e2000000-0000-4000-8000-000000000007", "name": "Update Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1440, 180], "parameters": {"method": "PATCH", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw/{{ $json.records[0].id }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ fields: $('Prepare Selection').first().json.publicationFields, typecast: true }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e2000000-0000-4000-8000-000000000008", "name": "Create Publication", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1440, 420], "parameters": {"method": "POST", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ records: [{ fields: $('Prepare Selection').first().json.createFields }], typecast: true }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e2000000-0000-4000-8000-000000000009", "name": "Reject Siblings", "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [1680, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "loose", "version": 2}, "conditions": [{"id": "cond-siblings", "leftValue": "={{ $('Prepare Selection').first().json.siblings.length }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}], "combinator": "and"}, "options": {}}},
  {"id": "e2000000-0000-4000-8000-000000000010", "name": "Mark Siblings Rejected", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1920, 180], "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbly8EpeOlYrXHYNE", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ records: $('Prepare Selection').first().json.siblings.map(id => ({ id: id, fields: { Status: 'Rejected' } })) }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e2000000-0000-4000-8000-000000000011", "name": "Build Selected Message", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2160, 300], "parameters": {"jsCode": "const NL = String.fromCharCode(10);\nconst esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst job = $('Prepare Selection').first().json;\nconst text = [\n  '\\u2705 <b>Social post picked</b>',\n  '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500',\n  '<code>' + esc(job.episodeId) + '</code> \\u00b7 ' + esc(job.title),\n  '',\n  'Option ' + job.option + ' is now on the X publication row.',\n  '',\n  esc(job.copy),\n  '',\n  esc(job.cta),\n  '',\n  '<i>Body ' + job.characters + ' / 280 \\u00b7 CTA ' + job.cta.length + '. The episode link is added when the post is sent.</i>',\n  '',\n  '\\u2699\\ufe0f <code>' + $workflow.id + '</code> \\u00b7 exec <code>' + $execution.id + '</code>'\n].join(NL);\nreturn [{ json: { text: text } }];"}},
  {"id": "e2000000-0000-4000-8000-000000000012", "name": "Send Selected Message", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2400, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "809462d7-6d65-417c-bb50-253252b00f6e", "parameters": {"chatId": "-5254203539", "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Social Posts Changed', 0, 'Pick Selected'],
  ['Pick Selected', 0, 'Fetch Episode Posts'],
  ['Fetch Episode Posts', 0, 'Prepare Selection'],
  ['Prepare Selection', 0, 'Find X Publication'],
  ['Find X Publication', 0, 'Publication Exists?'],
  ['Publication Exists?', 0, 'Update Publication'],
  ['Publication Exists?', 1, 'Create Publication'],
  ['Update Publication', 0, 'Reject Siblings'],
  ['Create Publication', 0, 'Reject Siblings'],
  ['Reject Siblings', 0, 'Mark Siblings Rejected'],
  ['Reject Siblings', 1, 'Build Selected Message'],
  ['Mark Siblings Rejected', 0, 'Build Selected Message'],
  ['Build Selected Message', 0, 'Send Selected Message']
];

const socialPostSelectedXPublicationLinked = workflow(
  "6m5s6x2sYMWJRz1s",
  "BA - Social Post Selected > X Publication Linked"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) socialPostSelectedXPublicationLinked.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  socialPostSelectedXPublicationLinked.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default socialPostSelectedXPublicationLinked;
