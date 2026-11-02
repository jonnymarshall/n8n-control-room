import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow G1N3gUA2CUa8Q5sF, fetched 2026-10-30.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh G1N3gUA2CUa8Q5sF guys-take-fountain-apply-sync
const liveNodes = [
  {"id": "a7000000-0000-4000-8000-000000000001", "name": "Input", "type": "n8n-nodes-base.executeWorkflowTrigger", "typeVersion": 1.1, "position": [0, 300], "parameters": {"inputSource": "passthrough"}},
  {"id": "a7000000-0000-4000-8000-000000000002", "name": "Video Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [220, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "needs-video", "leftValue": "={{ $('Input').first().json.needsVideo }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000003", "name": "Build Video Upload Request", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 180], "parameters": {"jsCode": "const s = $('Input').first().json;\nreturn { json: { publicationRecordId: s.publicationRecordId, itemId: s.itemId, feedId: s.feedId, videoUrl: s.episodeUrl || '' } };"}},
  {"id": "a7000000-0000-4000-8000-000000000004", "name": "Upload New Video", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [660, 180], "parameters": {"mode": "each", "workflowId": {"__rl": true, "mode": "list", "value": "XY4WfJ2XaBA9bPKY", "cachedResultName": "BA - Subworkflow - Upload Video to Fountain"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000005", "name": "Attach New Video", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 180], "parameters": {"method": "PATCH", "url": "=https://api.fountain.fm/v1/feeds/$('Input').first().json.feedId/items/$('Input').first().json.itemId", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { video_default_id: $json.uploadId } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "a7000000-0000-4000-8000-000000000006", "name": "Record Video File Id", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1100, 180], "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Frame.io File ID': $('Input').first().json.currentFileId, 'Video Upload ID': $('Upload New Video').first().json.uploadId } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-000000000007", "name": "Date Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1320, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "needs-date", "leftValue": "={{ $('Input').first().json.needsDate }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000008", "name": "Build New Schedule", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 440], "parameters": {"jsCode": "const s = $('Input').first().json;\nconst settings = s.fountainSettings || {};\nconst tz = settings['Time Zone'] || 'America/New_York';\nconst rel = String(s.releaseDay || '');\nconst local = $now.setZone(tz);\nconst today = local.toISODate();\nlet target;\nlet reason;\nif (!rel) {\n  throw new Error('The episode has no Release Date, so there is nothing to schedule against.');\n} else if (rel <= today) {\n  target = local.plus({ hours: 1 }).set({ second: 0, millisecond: 0 });\n  reason = rel === today ? 'today, so now + 1 hour' : 'already passed (' + rel + '), so now + 1 hour';\n} else {\n  const parts = rel.split('-').map(Number);\n  const hm = String(settings['Default Publish Time'] || '06:00').split(':').map(Number);\n  target = local.set({ year: parts[0], month: parts[1], day: parts[2], hour: hm[0], minute: hm[1], second: 0, millisecond: 0 });\n  reason = rel + ' at ' + (settings['Default Publish Time'] || '06:00') + ' ' + tz;\n}\nif (!target.isValid) throw new Error('Release Date or Default Publish Time is invalid: ' + rel);\nif (target <= $now) target = $now.plus({ minutes: 5 }).set({ second: 0, millisecond: 0 });\nreturn { json: Object.assign({}, s, { newScheduledFor: target.toUTC().toISO(), scheduleReason: reason }) };"}},
  {"id": "a7000000-0000-4000-8000-000000000009", "name": "Schedule New Date", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1760, 440], "parameters": {"method": "POST", "url": "=https://api.fountain.fm/v1/feeds/$('Input').first().json.feedId/items/$('Input').first().json.itemId/schedule", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { scheduled: $json.newScheduledFor } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "a7000000-0000-4000-8000-00000000000a", "name": "Record New Schedule", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1980, 440], "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Scheduled For': $('Build New Schedule').first().json.newScheduledFor } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-00000000000b", "name": "Finish Sync", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [2200, 300], "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Content Fingerprint': $('Input').first().json.fingerprint, 'Formatted Description': $('Input').first().json.description, 'Sync Approved': false, 'Sync Status': 'Synced' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-00000000000c", "name": "Notify Synced", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2420, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "4d529f02-8137-4ef1-956e-25588b5759f1", "parameters": {"chatId": "-5254203539", "text": "=🎙️ <b>Fountain item updated from Airtable</b>\n\n<code>{{ $('Input').first().json.episodeId }}</code>\nApplied: {{ ($('Input').first().json.changes || []).join(' · ') }}\n{{ $('Input').first().json.needsDate ? 'Scheduled for ' + $('Build New Schedule').first().json.newScheduledFor + ' (' + $('Build New Schedule').first().json.scheduleReason + ')' : '' }}\n\n⚙️ <code>{{ $workflow.id }}</code> · exec <code>{{ $execution.id }}</code>", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Input', 0, 'Video Changed?'],
  ['Video Changed?', 0, 'Build Video Upload Request'],
  ['Video Changed?', 1, 'Date Changed?'],
  ['Build Video Upload Request', 0, 'Upload New Video'],
  ['Upload New Video', 0, 'Attach New Video'],
  ['Attach New Video', 0, 'Record Video File Id'],
  ['Record Video File Id', 0, 'Date Changed?'],
  ['Date Changed?', 0, 'Build New Schedule'],
  ['Date Changed?', 1, 'Finish Sync'],
  ['Build New Schedule', 0, 'Schedule New Date'],
  ['Schedule New Date', 0, 'Record New Schedule'],
  ['Record New Schedule', 0, 'Finish Sync'],
  ['Finish Sync', 0, 'Notify Synced']
];

const guysTakeFountainApplySync = workflow(
  "G1N3gUA2CUa8Q5sF",
  "BA - Subworkflow - Apply Fountain Sync"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  executionOrder: "v1",
  callerPolicy: "workflowsFromSameOwner",
  availableInMCP: true
});

for (const live of liveNodes) guysTakeFountainApplySync.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  guysTakeFountainApplySync.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default guysTakeFountainApplySync;
