import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow qUFKGRwgkL2jjLra, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh qUFKGRwgkL2jjLra weekday-drip
const liveNodes = [
  {"id": "9101cf23-7ab6-431c-9c8e-42cc6dc1357e", "name": "Sticky Note 9c4bfb7f", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [100, 300], "parameters": {"content": "## Pod21 Weekday Drip", "color": 3}},
  {"id": "c1cd328a-f584-43b7-b66a-28f56de51de8", "name": "Weekdays 12:00 UTC", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.3, "position": [240, 300], "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 0 12 * * 1-5"}]}}},
  {"id": "2e0ebf83-5a91-4852-8ee5-c9ff7f79336c", "name": "Find Queued Tweets", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [440, 300], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "filterByFormula": "={status='queued'}", "returnAll": true}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "73ec0914-7812-46ca-9b1e-7e00de723ae2", "name": "Pick Oldest Due", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [640, 300], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const records = $input.all().map(i => i.json).filter(r => r.fields && r.fields.scheduled_for);\n\nif (records.length === 0) return [{ json: { hasTweet: false }}];\n\nconst now = new Date();\nconst due = records.filter(r => new Date(r.fields.scheduled_for) <= now);\nif (due.length === 0) return [{ json: { hasTweet: false }}];\n\ndue.sort((a, b) => new Date(a.fields.scheduled_for) - new Date(b.fields.scheduled_for));\nconst oldest = due[0];\nconst draftLink = oldest.fields.draft || [];\nconst draftId = Array.isArray(draftLink) ? draftLink[0] : draftLink;\n\nreturn [{ json: {\n  hasTweet: true,\n  scheduled_tweet_id: oldest.id,\n  draft_id: draftId,\n  scheduled_for: oldest.fields.scheduled_for,\n}}];"}},
  {"id": "81818aeb-316a-4ae7-8dc7-9eb9383d842d", "name": "Has Tweet to Post?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [840, 300], "parameters": {"conditions": {"conditions": [{"id": "ht", "leftValue": "={{ $json.hasTweet }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}}]}}},
  {"id": "e608640d-4bc5-4d49-a0b9-d37368301564", "name": "Fetch Draft Content", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1040, 220], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "get", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "id": "={{ $json.draft_id }}"}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "42c0a96d-22ce-4f68-82aa-fdcc1fbe6e40", "name": "Post Tweet to X", "type": "n8n-nodes-base.twitter", "typeVersion": 2, "position": [1240, 220], "parameters": {"resource": "tweet", "operation": "create", "text": "={{ $json.fields.content }}", "additionalFields": {}}, "credentials": {"twitterOAuth2Api": {"id": "YWLrfI49G9dBAfnY", "name": "X [pod21-n8n]"}}},
  {"id": "a3b8f7be-3290-4e2a-bd42-6049ec8bc105", "name": "Mark Scheduled Posted", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1440, 220], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $(\"Pick Oldest Due\").first().json.scheduled_tweet_id }}", "status": "posted", "posted_url": "=https://x.com/i/web/status/{{ $json.id }}", "posted_at": "={{ $now.toISO() }}"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "7a457369-6b3a-438c-a75e-48e10e4e4a3f", "name": "Mark Draft Posted", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1640, 220], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $(\"Pick Oldest Due\").first().json.draft_id }}", "status": "posted", "posted_at": "={{ $now.toISO() }}"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "ee302d06-8994-4780-88ab-2ce0b9ab599a", "name": "Notify Tweet Posted", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1840, 220], "webhookId": "12acb493-998e-48c9-87ae-649fda4915ae", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Posted to X: https://x.com/i/web/status/{{ $(\"Post Tweet to X\").first().json.id }}\n\n{{ $(\"Fetch Draft Content\").first().json.fields.content }}", "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Weekdays 12:00 UTC', 0, 'Find Queued Tweets'],
  ['Find Queued Tweets', 0, 'Pick Oldest Due'],
  ['Pick Oldest Due', 0, 'Has Tweet to Post?'],
  ['Has Tweet to Post?', 0, 'Fetch Draft Content'],
  ['Fetch Draft Content', 0, 'Post Tweet to X'],
  ['Post Tweet to X', 0, 'Mark Scheduled Posted'],
  ['Mark Scheduled Posted', 0, 'Mark Draft Posted'],
  ['Mark Draft Posted', 0, 'Notify Tweet Posted']
];

const weekdayDrip = workflow(
  "qUFKGRwgkL2jjLra",
  "Pod21 \u2014 Weekday Drip"
).settings({
  executionOrder: "v1",
  availableInMCP: true,
  binaryMode: "separate"
});

for (const live of liveNodes) weekdayDrip.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  weekdayDrip.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default weekdayDrip;
