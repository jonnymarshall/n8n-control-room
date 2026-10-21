import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow 4bhBARvaFnFj1sxG, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh 4bhBARvaFnFj1sxG public-api
const liveNodes = [
  {"id": "5972bb1d-f74f-4b7e-95a9-21819c8d0a6f", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [240, 512], "webhookId": "9910013c-d672-45b7-babe-ba3fc50b8436", "parameters": {"httpMethod": "POST", "path": "api", "responseMode": "responseNode", "options": {}}},
  {"id": "e34d599d-d599-4439-a741-d64c0848c20e", "name": "Extract Token", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [464, 512], "parameters": {"assignments": {"assignments": [{"id": "5a24e8e6-7dbe-4e3b-af51-9d222b002d3d", "name": "token", "value": "={{ ($json.headers.authorization || '').replace(/^Bearer\\s+/i, '') }}", "type": "string"}, {"id": "85bba5e0-6493-42b1-a20d-0fcab7eaa6fc", "name": "revoked", "value": false, "type": "boolean"}]}, "includeOtherFields": true, "options": {}}},
  {"id": "fd98f296-e38f-4fbd-bfc8-0765c039356d", "name": "Token Valid", "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1, "position": [688, 400], "parameters": {"operation": "rowExists", "dataTableId": {"__rl": true, "value": "kOlDKTJT6gZAiogw", "mode": "list", "cachedResultName": "api_tokens", "cachedResultUrl": "/projects/zVl8C4Y0Ep5dha8r/datatables/kOlDKTJT6gZAiogw"}, "matchType": "allConditions", "filters": {"conditions": [{"keyName": "token", "keyValue": "={{ $json.token }}"}, {"keyName": "revoked", "keyValue": "={{ $json.revoked }}"}]}}},
  {"id": "fe7f59dc-cc22-450c-8905-c4bdad68d121", "name": "Token Invalid", "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1, "position": [688, 608], "parameters": {"operation": "rowNotExists", "dataTableId": {"__rl": true, "value": "kOlDKTJT6gZAiogw", "mode": "list", "cachedResultName": "api_tokens", "cachedResultUrl": "/projects/zVl8C4Y0Ep5dha8r/datatables/kOlDKTJT6gZAiogw"}, "matchType": "allConditions", "filters": {"conditions": [{"keyName": "token", "keyValue": "={{ $json.token }}"}, {"keyName": "revoked", "keyValue": "={{ $json.revoked }}"}]}}},
  {"id": "68db3716-d9b1-4c34-8086-aa045c2e2b68", "name": "Route Action", "type": "n8n-nodes-base.switch", "typeVersion": 3.4, "position": [912, 384], "parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "combinator": "and", "conditions": [{"id": "ra-list", "leftValue": "={{ $('Webhook').item.json.body.action }}", "rightValue": "list_episodes", "operator": {"type": "string", "operation": "equals"}}]}, "renameOutput": true, "outputKey": "list_episodes"}, {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "combinator": "and", "conditions": [{"id": "ra-get", "leftValue": "={{ $('Webhook').item.json.body.action }}", "rightValue": "get_episode", "operator": {"type": "string", "operation": "equals"}}]}, "renameOutput": true, "outputKey": "get_episode"}]}, "options": {"fallbackOutput": "extra", "renameFallbackOutput": "unknown"}}},
  {"id": "9abeebf3-ef11-4412-8f33-22e378193a08", "name": "Respond 401", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": [912, 608], "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ error: 'unauthorized' }) }}", "options": {"responseCode": 401}}},
  {"id": "d31245ff-b126-4f42-905d-697999d85a03", "name": "Build Episode Query", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1136, 208], "parameters": {"jsCode": "const body = $('Webhook').item.json.body || {};\nconst BASE = 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6';\nconst params = [];\nlet limit = Number(body.limit);\nif (!Number.isFinite(limit) || limit <= 0) limit = 100;\nparams.push('maxRecords=' + Math.min(limit, 100));\nif (body.offset) params.push('offset=' + encodeURIComponent(String(body.offset)));\nif (body.filterByFormula) params.push('filterByFormula=' + encodeURIComponent(String(body.filterByFormula)));\nif (body.view) params.push('view=' + encodeURIComponent(String(body.view)));\nreturn [{ json: { url: BASE + '?' + params.join('&') } }];"}},
  {"id": "b73cfb01-ca3f-45ed-bd19-5f129043f2e1", "name": "Respond 400", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": [1136, 400], "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ error: 'unknown action', action: $('Webhook').item.json.body?.action || null }) }}", "options": {"responseCode": 400}}},
  {"id": "b1d1df6f-0338-4277-b43f-309949a0cb73", "name": "Prepare Get", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1136, 592], "parameters": {"jsCode": "const BASE = 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6';\nconst b = $('Webhook').item.json.body || {};\nconst raw = String(b.recordId != null ? b.recordId : (b.episodeId != null ? b.episodeId : (b.id != null ? b.id : ''))).trim();\nlet formula = null;\nif (/^rec[A-Za-z0-9]{14}$/.test(raw)) formula = 'RECORD_ID()=\"' + raw + '\"';\nelse if (/^BA-[A-Za-z0-9]+$/.test(raw)) formula = '{ID}=\"' + raw + '\"';\nif (!formula) return [{ json: { url: BASE + '/INVALID_RECORD_ID' } }];\nreturn [{ json: { url: BASE + '?maxRecords=1&filterByFormula=' + encodeURIComponent(formula) } }];"}},
  {"id": "7d7824c8-fa1b-48ee-8ccd-cff4d6cd9891", "name": "Fetch Episodes", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1360, 208], "onError": "continueErrorOutput", "parameters": {"url": "={{ $json.url }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "8c99ded3-a127-4281-94fa-a817b9a65db6", "name": "Fetch Episode", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1360, 592], "onError": "continueErrorOutput", "parameters": {"url": "={{ $json.url }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "0d5b7d90-7193-4def-b5b5-9a2a8a4dc518", "name": "Shape Episodes", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1584, 160], "parameters": {"jsCode": "const body = $('Webhook').item.json.body || {};\nconst wanted = Array.isArray(body.fields) ? body.fields : null;\nconst data = $json;\nconst records = Array.isArray(data.records) ? data.records : [];\nconst pick = (rec) => {\n  if (!wanted || !wanted.length) return rec;\n  const fields = {};\n  for (const name of wanted) {\n    if (rec.fields && Object.prototype.hasOwnProperty.call(rec.fields, name)) fields[name] = rec.fields[name];\n  }\n  return { id: rec.id, createdTime: rec.createdTime, fields };\n};\nreturn [{ json: { rows: records.map(pick), count: records.length, offset: data.offset || null } }];"}},
  {"id": "bae7dbe0-7ce8-41c6-aea3-44d773b13cf2", "name": "Respond Bad Request", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": [1584, 448], "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ error: 'bad_request', detail: (($json.error && ($json.error.message || $json.error.description)) || $json.message || 'The Airtable query failed.') }) }}", "options": {"responseCode": 400}}},
  {"id": "242e0bae-3328-451f-a94a-98e25d983eea", "name": "Shape Episode", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1584, 640], "parameters": {"jsCode": "const body = $('Webhook').item.json.body || {};\nconst wanted = Array.isArray(body.fields) ? body.fields : null;\nconst data = $json;\nlet rec = null;\nif (data && Array.isArray(data.records)) rec = data.records[0] || null;\nelse if (data && data.id && data.fields) rec = data;\nconst pick = (r) => {\n  if (!wanted || !wanted.length) return r;\n  const fields = {};\n  for (const name of wanted) {\n    if (r.fields && Object.prototype.hasOwnProperty.call(r.fields, name)) fields[name] = r.fields[name];\n  }\n  return { id: r.id, createdTime: r.createdTime, fields };\n};\nreturn [{ json: { rows: rec ? [pick(rec)] : [], count: rec ? 1 : 0 } }];"}},
  {"id": "a8b1f5f7-2be5-45a4-b936-9a1dc3fed2f2", "name": "Respond JSON", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": [1808, 304], "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {"responseCode": 200}}}
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
  ['Webhook', 0, 'Extract Token'],
  ['Extract Token', 0, 'Token Valid'],
  ['Extract Token', 0, 'Token Invalid'],
  ['Token Invalid', 0, 'Respond 401'],
  ['Token Valid', 0, 'Route Action'],
  ['Route Action', 0, 'Build Episode Query'],
  ['Route Action', 1, 'Prepare Get'],
  ['Route Action', 2, 'Respond 400'],
  ['Build Episode Query', 0, 'Fetch Episodes'],
  ['Fetch Episodes', 0, 'Shape Episodes'],
  ['Fetch Episodes', 1, 'Respond Bad Request'],
  ['Shape Episodes', 0, 'Respond JSON'],
  ['Prepare Get', 0, 'Fetch Episode'],
  ['Fetch Episode', 0, 'Shape Episode'],
  ['Fetch Episode', 1, 'Respond Bad Request'],
  ['Shape Episode', 0, 'Respond JSON']
];

const publicApi = workflow(
  "4bhBARvaFnFj1sxG",
  "Public API"
).settings({
  callerPolicy: "workflowsFromSameOwner",
  availableInMCP: false,
  executionOrder: "v1",
  binaryMode: "separate"
});

for (const live of liveNodes) publicApi.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  publicApi.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default publicApi;
