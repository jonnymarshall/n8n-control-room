import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow tXCSFJVPrNfHld3s, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh tXCSFJVPrNfHld3s draft-approvals
const liveNodes = [
  {"id": "1d74fddf-0d36-4da0-af44-b2bc893d3f75", "name": "Sticky Note 26a24180", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [100, 300], "parameters": {"content": "## Pod21 - Draft Approvals\n\nPolls Drafts table every minute for last_modified changes where status is approved or rejected.\n\nactions:\n- approve_tweet (tweet_candidate approved) -> schedule next weekday slot in ScheduledTweets\n- approve_main (x_thread/linkedin/instagram approved) -> mark manual_pending, notify\n- rejected -> notify", "color": 5}},
  {"id": "d7d1b7c8-3be0-4a03-b3a4-ceb4540c4e16", "name": "On Draft Status Change", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [240, 400], "parameters": {"authentication": "airtableTokenApi", "pollTimes": {"item": [{"mode": "everyMinute"}]}, "baseId": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "tableId": {"__rl": true, "mode": "id", "value": "tbl7zD56mo1UywCGM"}, "triggerField": "last_modified", "additionalFields": {"formula": "OR({status}='approved',{status}='rejected')", "fields": "status,platform,content,article,last_modified"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "25afb028-aa6c-48bd-823d-259c28949442", "name": "Normalize Draft", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 400], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const draft = $input.first().json;\nconst fields = draft.fields || draft;\nconst articleLink = fields.article || [];\nconst articleId = Array.isArray(articleLink) ? articleLink[0] : articleLink;\nconst status = fields.status || '';\nconst platform = fields.platform || '';\n\nlet kind = 'other';\nif (status === 'approved') {\n  kind = platform === 'tweet_candidate' ? 'approve_tweet' : 'approve_main';\n} else if (status === 'rejected') {\n  kind = 'rejected';\n}\n\nreturn [{ json: {\n  _kind: kind,\n  draft_id: draft.id,\n  article_id: articleId,\n  status,\n  platform,\n  content: fields.content || '',\n}}];"}},
  {"id": "08ac9b1f-7942-41be-b35d-9c1684beb66d", "name": "Route by Action", "type": "n8n-nodes-base.switch", "typeVersion": 3.2, "position": [640, 400], "parameters": {"mode": "rules", "rules": {"values": [{"conditions": {"conditions": [{"id": "a1", "leftValue": "={{ $json._kind }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "approve_tweet"}]}}, {"conditions": {"conditions": [{"id": "a2", "leftValue": "={{ $json._kind }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "approve_main"}]}}, {"conditions": {"conditions": [{"id": "a3", "leftValue": "={{ $json._kind }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "rejected"}]}}]}}},
  {"id": "f2bc3da5-c285-4678-8bf0-7881a6d5be24", "name": "Find Existing Slots", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [840, 200], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "filterByFormula": "={status='queued'}", "returnAll": true}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "05f4e78a-953d-432c-bea3-04d2470d5ed3", "name": "Mark Manual Pending", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [840, 400], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $(\"Normalize Draft\").first().json.draft_id }}", "status": "manual_pending"}}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "e12780e6-5772-4fe6-b75b-1b2cc00e7f91", "name": "Notify Rejected", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [840, 600], "webhookId": "d054c352-fa10-4b31-9951-8bd17c3487a8", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Rejected <b>{{ $(\"Normalize Draft\").first().json.platform }}</b> draft (id: {{ $(\"Normalize Draft\").first().json.draft_id }}).", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "8117d566-35ae-4cc4-8cef-5c25ca3bc831", "name": "Compute Next Slot", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1040, 200], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const draftId = $('Normalize Draft').first().json.draft_id;\nconst existing = $input.all().map(i => i.json).filter(r => r.fields && r.fields.scheduled_for);\n\nlet base;\nif (existing.length === 0) {\n  base = new Date();\n} else {\n  const maxDate = existing.reduce((max, r) => {\n    const d = new Date(r.fields.scheduled_for);\n    return d > max ? d : max;\n  }, new Date(0));\n  base = new Date(maxDate.getTime());\n}\n\nlet next = new Date(base.getTime() + 24*60*60*1000);\nwhile (next.getDay() === 0 || next.getDay() === 6) {\n  next = new Date(next.getTime() + 24*60*60*1000);\n}\nnext.setUTCHours(12, 0, 0, 0);\n\nreturn [{ json: { draft_id: draftId, scheduled_for: next.toISOString(), status: 'queued' }}];"}},
  {"id": "b9aa584f-9bfa-48fe-b745-816f8ca3f2e3", "name": "Notify Manual Pending", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1040, 400], "webhookId": "e76535d9-229a-4739-8777-7fa1b45323db", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Approved <b>{{ $(\"Normalize Draft\").first().json.platform }}</b> draft.\n\nCopy content from Airtable Drafts row <b>{{ $(\"Normalize Draft\").first().json.draft_id }}</b> and post manually.\n\nStatus auto-updated to manual_pending.", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "de03bb03-7553-4ca6-8d70-24866d525a10", "name": "Create Scheduled Tweet", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1240, 200], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "create", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "columns": {"mappingMode": "defineBelow", "value": {"draft": "={{ [$json.draft_id] }}", "scheduled_for": "={{ $json.scheduled_for }}", "status": "queued"}}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "f5021a26-2a81-4463-be45-a5e7fe589e41", "name": "Notify Tweet Queued", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1440, 200], "webhookId": "d18413b0-d3cd-4686-9008-0d7e7c22cbd7", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Tweet queued for {{ DateTime.fromISO($(\"Compute Next Slot\").first().json.scheduled_for).toFormat(\"ccc d LLL HH:mm\") }} UTC.\n\n{{ $(\"Normalize Draft\").first().json.content }}", "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['On Draft Status Change', 0, 'Normalize Draft'],
  ['Normalize Draft', 0, 'Route by Action'],
  ['Route by Action', 0, 'Find Existing Slots'],
  ['Route by Action', 1, 'Mark Manual Pending'],
  ['Route by Action', 2, 'Notify Rejected'],
  ['Find Existing Slots', 0, 'Compute Next Slot'],
  ['Compute Next Slot', 0, 'Create Scheduled Tweet'],
  ['Create Scheduled Tweet', 0, 'Notify Tweet Queued'],
  ['Mark Manual Pending', 0, 'Notify Manual Pending']
];

const draftApprovals = workflow(
  "tXCSFJVPrNfHld3s",
  "Pod21 \u2014 Draft Approvals"
).settings({
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) draftApprovals.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  draftApprovals.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default draftApprovals;
