import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow pvCPy320OjawDkSu, fetched 2026-11-04.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh pvCPy320OjawDkSu guys-take-fountain-reconciler
const liveNodes = [
  {"id": "schedule-trigger", "name": "Every 15 Minutes", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.4, "position": [0, 300], "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": 15}]}, "misfirePolicy": "skip"}},
  {"id": "fetch-settings", "name": "Fetch Fountain Settings", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [220, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblHj2gQ9qYhoQVuX?maxRecords=1&filterByFormula={{ encodeURIComponent('{Platform}=\"Fountain\"') }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "fetch-scheduled", "name": "Fetch Due Fountain Publications", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [440, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw?pageSize=100&filterByFormula={{ encodeURIComponent('AND({Platform}=\"Fountain\",{Status}=\"Scheduled\")') }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "expand-publications", "name": "Expand Due Fountain Publications", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 300], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const settingsRec = (($('Fetch Fountain Settings').first().json.records || [])[0] || {});\nconst settings = settingsRec.fields || {};\nif (settings.Enabled !== true || !settings['Feed ID']) return [];\nconst rows = $input.first().json.records || [];\nreturn rows.map(row => {\n  const f = row.fields || {};\n  const episodeId = String(f.Publication || '').replace(/ - Fountain$/, '') || 'no-id';\n  return { json: {\n    publicationRecordId: row.id,\n    episodeRecordId: (f.Episode || [])[0] || '',\n    episodeId,\n    itemId: f['Platform Item ID'] || '',\n    feedId: settings['Feed ID']\n  } };\n}).filter(item => item.json.episodeRecordId && item.json.itemId);"}},
  {"id": "load-item", "name": "Load Fountain Scheduled Item", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [880, 300], "onError": "continueErrorOutput", "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.fountain.fm/v1/feeds/{{ $json.feedId }}/items/{{ $json.itemId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "item-error", "name": "Fountain Item Error", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1100, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "item-error-status", "leftValue": "={{ $json.item.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "ERROR"}], "combinator": "and"}, "options": {}}},
  {"id": "build-failed", "name": "Build Fountain Reconcile Failure", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1320, 120], "parameters": {"mode": "runOnceForEachItem", "language": "javaScript", "jsCode": "const context = $('Expand Due Fountain Publications').item.json;\nconst item = $json.item || {};\nconst err = $json.error;\nconst candidates = [\n  item.error,\n  typeof err === 'string' ? err : null,\n  err && err.message,\n  err && err.description,\n  $json.message\n].filter((v) => typeof v === 'string' && v.trim().length);\nconst error = String(candidates[0] || 'Fountain reported an item error.');\nconst esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\nconst executionId = String($execution.id || 'unknown');\nreturn [{ json: { ...context, error, executionId, rawError: JSON.stringify($json).slice(0,9000), telegramText: '<b>Fountain publication failed after scheduling - needs attention</b>\\n\\n<code>' + esc(context.episodeId || 'no-id') + '</code>\\n\\n<b>Reason:</b> ' + esc(error).slice(0,1800) + '\\n<b>Execution:</b> <code>' + esc(executionId) + '</code>\\n\\n<b>To retry:</b> fix the Fountain item, then move the episode back into Ready for Publishing.' } }];"}},
  {"id": "is-published", "name": "Fountain Item Published", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1320, 380], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "item-published-status", "leftValue": "={{ $json.item.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "PUBLISHED"}], "combinator": "and"}, "options": {}}},
  {"id": "mark-failed", "name": "Mark Reconciled Fountain Failed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1540, 120], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $json.publicationRecordId, fields: { Status: 'Failed', Error: $json.error, 'Raw Error': $json.rawError } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "build-published", "name": "Build Fountain Published Result", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 300], "onError": "continueErrorOutput", "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "// Context comes from the parallel array, NOT from pairedItem.\n// 2026-10-29 (exec 9817): the HTTP lookup between the two nodes broke the\n// pairing, every item produced {}, and the Airtable write went out with no\n// record id and failed with a 422. Index alignment is safe here because both\n// streams are one item per due publication, in the same order.\nconst contexts = $('Expand Due Fountain Publications').all();\nconst items = $input.all();\nreturn items.map(function (it, i) {\n  const context = (contexts[i] && contexts[i].json) || {};\n  const item = (it.json && it.json.item) || {};\n  const fountainId = item.fountain_id || '';\n  if (!fountainId) throw new Error('Fountain reports the item as PUBLISHED but did not return fountain_id.');\n  const slug = String(fountainId).replace(/^episode:id:/, '');\n  return { json: Object.assign({}, context, {\n    fountainId: fountainId,\n    url: 'https://fountain.fm/episode/' + slug,\n    publishedAt: item.published || $now.toUTC().toISO()\n  }), pairedItem: { item: i } };\n});"}},
  {"id": "mark-episode-failed", "name": "Mark Reconciled Episode Failed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1760, 120], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Build Fountain Reconcile Failure').item.json.episodeRecordId, fields: { Status: 'Publishing Failed' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "mark-published", "name": "Mark Fountain Published", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1760, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $json.publicationRecordId, fields: { Status: 'Published', 'Platform Content ID': $json.fountainId, URL: $json.url, 'Published At': $json.publishedAt, Notes: 'Fountain: PUBLISHED · checked ' + $now.setZone('America/New_York').toFormat('ccc HH:mm'), Error: '', 'Raw Error': '' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "notify-failed", "name": "Notify Fountain Reconcile Failure", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1980, 120], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "cdb6650d-af88-4e71-b132-231051e3cc96", "parameters": {"operation": "sendMessage", "chatId": "-5254203539", "text": "={{ $('Build Fountain Reconcile Failure').item.json.telegramText }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "fetch-related", "name": "Fetch Episode Publications", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1980, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw?pageSize=100&filterByFormula={{ encodeURIComponent('FIND(\"' + $('Build Fountain Published Result').item.json.episodeId.replace(/\"/g, '\\\\\"') + '\",{Publication})=1') }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "decide-episode", "name": "Decide Episode Publication Status", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2200, 300], "parameters": {"mode": "runOnceForEachItem", "language": "javaScript", "jsCode": "// Per-item mode: return ONE object, not an array. Returning an array here is\n// what produced \"A 'json' property isn't an object\" on exec 9828.\nconst context = $('Build Fountain Published Result').item.json;\nconst rows = $json.records || [];\nconst statuses = rows.map(function (r) { return (r.fields || {}).Status; }).filter(Boolean);\nif (!statuses.length) {\n  throw new Error('No Publication rows found for ' + (context.episodeId || context.episodeRecordId) + ' while reconciling; nothing was written.');\n}\nconst allDone = statuses.every(function (s) { return s === 'Published' || s === 'Skipped'; });\nconst anyDone = statuses.indexOf('Published') !== -1;\nconst episodeStatus = allDone ? 'Published' : (anyDone ? 'Partially Published' : 'Publishing Failed');\nreturn { json: Object.assign({}, context, { episodeStatus: episodeStatus }), pairedItem: { item: 0 } };"}},
  {"id": "mark-episode", "name": "Update Episode Publication Status", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [2420, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $json.episodeRecordId, fields: { Status: $json.episodeStatus } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "notify-published", "name": "Notify Fountain Published", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2640, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "a5f48f0a-4be6-4773-85fe-0b16c78b4492", "parameters": {"operation": "sendMessage", "chatId": "-5254203539", "text": "=🎙️ <b>Fountain episode published</b>\n\n<code>{{ $('Decide Episode Publication Status').item.json.episodeId || 'no-id' }}</code>\n<a href=\"{{ $('Decide Episode Publication Status').item.json.url }}\">Open on Fountain</a>\n\n<b>Execution:</b> <code>{{ $execution.id }}</code>", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Every 15 Minutes', 0, 'Fetch Fountain Settings'],
  ['Fetch Fountain Settings', 0, 'Fetch Due Fountain Publications'],
  ['Fetch Due Fountain Publications', 0, 'Expand Due Fountain Publications'],
  ['Expand Due Fountain Publications', 0, 'Load Fountain Scheduled Item'],
  ['Load Fountain Scheduled Item', 0, 'Fountain Item Error'],
  ['Load Fountain Scheduled Item', 1, 'Build Fountain Reconcile Failure'],
  ['Fountain Item Error', 0, 'Build Fountain Reconcile Failure'],
  ['Fountain Item Error', 1, 'Fountain Item Published'],
  ['Fountain Item Published', 0, 'Build Fountain Published Result'],
  ['Build Fountain Published Result', 0, 'Mark Fountain Published'],
  ['Build Fountain Published Result', 1, 'Build Fountain Reconcile Failure'],
  ['Mark Fountain Published', 0, 'Fetch Episode Publications'],
  ['Fetch Episode Publications', 0, 'Decide Episode Publication Status'],
  ['Decide Episode Publication Status', 0, 'Update Episode Publication Status'],
  ['Update Episode Publication Status', 0, 'Notify Fountain Published'],
  ['Build Fountain Reconcile Failure', 0, 'Mark Reconciled Fountain Failed'],
  ['Mark Reconciled Fountain Failed', 0, 'Mark Reconciled Episode Failed'],
  ['Mark Reconciled Episode Failed', 0, 'Notify Fountain Reconcile Failure']
];

const guysTakeFountainReconciler = workflow(
  "pvCPy320OjawDkSu",
  "BA - Schedule Every 15m > Fountain Publication Reconciled"
).settings({
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
  executionTimeout: 900,
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1"
});

for (const live of liveNodes) guysTakeFountainReconciler.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  guysTakeFountainReconciler.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default guysTakeFountainReconciler;
