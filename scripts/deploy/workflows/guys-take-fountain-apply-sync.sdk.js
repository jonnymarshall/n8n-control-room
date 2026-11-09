import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow G1N3gUA2CUa8Q5sF, fetched 2026-11-06.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh G1N3gUA2CUa8Q5sF guys-take-fountain-apply-sync
const liveNodes = [
  {"id": "a7000000-0000-4000-8000-000000000001", "name": "Input", "type": "n8n-nodes-base.executeWorkflowTrigger", "typeVersion": 1.1, "position": [0, 300], "parameters": {"inputSource": "passthrough"}},
  {"id": "a7000000-0000-4000-8000-000000000002", "name": "Video Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [220, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "needs-video", "leftValue": "={{ $('Input').first().json.needsVideo }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000003", "name": "Build Video Upload Request", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 180], "onError": "continueErrorOutput", "parameters": {"jsCode": "const s = $('Input').first().json;\nreturn { json: { publicationRecordId: s.publicationRecordId, itemId: s.itemId, feedId: s.feedId, videoUrl: s.episodeUrl || '' } };"}},
  {"id": "a7000000-0000-4000-8000-000000000004", "name": "Upload New Video", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [660, 180], "onError": "continueErrorOutput", "parameters": {"mode": "each", "workflowId": {"__rl": true, "mode": "list", "value": "XY4WfJ2XaBA9bPKY", "cachedResultName": "BA - Subworkflow - Upload Video to Fountain"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000005", "name": "Attach New Video", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 180], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "=https://api.fountain.fm/v1/feeds/$('Input').first().json.feedId/items/$('Input').first().json.itemId", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { audio_default_id: null, video_default_id: $json.uploadId } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "a7000000-0000-4000-8000-000000000006", "name": "Record Video File Id", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1100, 180], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Frame.io File ID': $('Input').first().json.currentFileId, 'Video Upload ID': $('Upload New Video').first().json.uploadId } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-000000000007", "name": "Date Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1320, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "needs-date", "leftValue": "={{ $('Input').first().json.needsDate }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "a7000000-0000-4000-8000-000000000008", "name": "Build New Schedule", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 440], "onError": "continueErrorOutput", "parameters": {"jsCode": "const s = $('Input').first().json;\nconst settings = s.fountainSettings || {};\nconst tz = settings['Time Zone'] || 'America/New_York';\nconst rel = String(s.releaseDay || '');\nconst local = $now.setZone(tz);\nconst today = local.toISODate();\nlet target;\nlet reason;\nif (!rel) {\n  throw new Error('The episode has no Release Date, so there is nothing to schedule against.');\n} else if (rel <= today) {\n  target = local.plus({ hours: 1 }).set({ second: 0, millisecond: 0 });\n  reason = rel === today ? 'today, so now + 1 hour' : 'already passed (' + rel + '), so now + 1 hour';\n} else {\n  const parts = rel.split('-').map(Number);\n  const hm = String(settings['Default Publish Time'] || '06:00').split(':').map(Number);\n  target = local.set({ year: parts[0], month: parts[1], day: parts[2], hour: hm[0], minute: hm[1], second: 0, millisecond: 0 });\n  reason = rel + ' at ' + (settings['Default Publish Time'] || '06:00') + ' ' + tz;\n}\nif (!target.isValid) throw new Error('Release Date or Default Publish Time is invalid: ' + rel);\nif (target <= $now) target = $now.plus({ minutes: 5 }).set({ second: 0, millisecond: 0 });\nreturn { json: Object.assign({}, s, { newScheduledFor: target.toUTC().toISO(), scheduleReason: reason }) };"}},
  {"id": "a7000000-0000-4000-8000-000000000009", "name": "Schedule New Date", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1760, 440], "onError": "continueErrorOutput", "parameters": {"method": "POST", "url": "=https://api.fountain.fm/v1/feeds/$('Input').first().json.feedId/items/$('Input').first().json.itemId/schedule", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { scheduled: $json.newScheduledFor } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "a7000000-0000-4000-8000-00000000000a", "name": "Record New Schedule", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1980, 440], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Scheduled For': $('Build New Schedule').first().json.newScheduledFor } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-00000000000b", "name": "Finish Sync", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [2200, 300], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Content Fingerprint': $('Input').first().json.newFingerprint || $('Input').first().json.fingerprint, 'Formatted Description': $('Input').first().json.newFormattedDescription || $('Input').first().json.description, 'Sync Approved': false, 'Sync Status': 'Synced' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a7000000-0000-4000-8000-00000000000c", "name": "Notify Synced", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2420, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "4d529f02-8137-4ef1-956e-25588b5759f1", "parameters": {"chatId": "-5254203539", "text": "=🎙️ <b>Fountain item updated from Airtable</b>\n\n<code>{{ $('Input').first().json.episodeId }}</code>\nApplied: {{ (($('Input').first().json.appliedChanges || $('Input').first().json.changes || []).join(' · ')) || 'nothing to change' }}\n{{ $('Input').first().json.needsDate ? 'Scheduled for ' + $('Build New Schedule').first().json.newScheduledFor + ' (' + $('Build New Schedule').first().json.scheduleReason + ')' : '' }}{{ $('Input').first().json.textWasEdited ? '\n\n⚠️ The description on Fountain had been edited by hand, so Airtable\\u2019s text was not sent. The live description is untouched.' : '' }}\n\n⚙️ <code>{{ $workflow.id }}</code> · exec <code>{{ $execution.id }}</code>", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "f1000000-0000-4000-8000-000000000001", "name": "Build Failure", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2640, 760], "parameters": {"jsCode": "const item = $input.first().json || {};\nconst err = item.error || {};\nconst candidates = [typeof err === 'string' ? err : null, err.message, err.description, (err.error || {}).message, item.message];\nconst reason = String(candidates.find(function (v) { return typeof v === 'string' && v.trim(); }) || 'Unknown failure').slice(0, 900);\nlet episodeId = 'no-id';\nlet publicationRecordId = '';\ntry { episodeId = $('Input').first().json.episodeId || 'no-id'; } catch (e) {}\ntry { publicationRecordId = $('Input').first().json.publicationRecordId || ''; } catch (e) {}\nconst esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };\nconst text = '🚨 <b>Fountain sync failed</b>\\n\\n<code>' + esc(episodeId) + '</code>\\n<b>Reason:</b> ' + esc(reason) + '\\n\\nNothing is half-applied: the approval has been cleared and the Publication row is marked Failed. Fix the cause, then set Sync Status back to Awaiting Approval (or re-tick Sync Approved) to try again.\\n\\n⚙️ <code>' + String($workflow.id) + '</code> · exec <code>' + String($execution.id) + '</code>';\nreturn [{ json: { publicationRecordId: publicationRecordId, episodeId: episodeId, reason: reason, telegramText: text } }];"}},
  {"id": "f1000000-0000-4000-8000-000000000002", "name": "Mark Sync Failed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [2860, 760], "onError": "continueRegularOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $json.publicationRecordId, fields: { 'Sync Approved': false, 'Sync Status': 'Failed', Error: $json.reason } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "f1000000-0000-4000-8000-000000000003", "name": "Notify Failure", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [3080, 760], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "0285b12e-eed3-4ccf-b8c7-674e64b7e3cf", "parameters": {"chatId": "-5254203539", "text": "={{ $('Build Failure').first().json.telegramText }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Build Video Upload Request', 1, 'Build Failure'],
  ['Upload New Video', 0, 'Attach New Video'],
  ['Upload New Video', 1, 'Build Failure'],
  ['Attach New Video', 0, 'Record Video File Id'],
  ['Attach New Video', 1, 'Build Failure'],
  ['Record Video File Id', 0, 'Date Changed?'],
  ['Record Video File Id', 1, 'Build Failure'],
  ['Date Changed?', 0, 'Build New Schedule'],
  ['Date Changed?', 1, 'Finish Sync'],
  ['Build New Schedule', 0, 'Schedule New Date'],
  ['Build New Schedule', 1, 'Build Failure'],
  ['Schedule New Date', 0, 'Record New Schedule'],
  ['Schedule New Date', 1, 'Build Failure'],
  ['Record New Schedule', 0, 'Finish Sync'],
  ['Record New Schedule', 1, 'Build Failure'],
  ['Finish Sync', 0, 'Notify Synced'],
  ['Finish Sync', 1, 'Build Failure'],
  ['Build Failure', 0, 'Mark Sync Failed'],
  ['Mark Sync Failed', 0, 'Notify Failure']
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
