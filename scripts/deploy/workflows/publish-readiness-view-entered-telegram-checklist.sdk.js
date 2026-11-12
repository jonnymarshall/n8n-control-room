import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow RATBwwfOlRDPDHeN, fetched 2026-11-12.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh RATBwwfOlRDPDHeN publish-readiness-view-entered-telegram-checklist
const liveNodes = [
  {"id": "f8000000-0000-4000-8000-000000000001", "name": "Publish Readiness Nudge", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [0, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbl3uYLIvtB9APZp6", "cachedResultName": "Episodes"}, "triggerField": "Last Modified Time", "additionalFields": {"viewId": "viwcMtlZm687luVei"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "f8000000-0000-4000-8000-000000000002", "name": "Build Checklist", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 300], "parameters": {"jsCode": "const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst NL = String.fromCharCode(10);\n// 2026-11-12: the scheduler and publisher write Status on this same row too\n// (Publishing, Scheduled to Publish, Published), and every one of those writes\n// re-fires this poller. Once the row is past the handover the checklist is\n// noise, so skip it rather than tell Jonny to set a status he already set.\nconst HANDED_OVER = ['Ready to Publish', 'Publishing', 'Scheduled to Publish', 'Publishing Failed', 'Partially Published', 'Published', 'Suspended'];\nconst out = [];\nfor (const it of $input.all()) {\n  const row = it.json || {};\n  const f = row.fields || row;\n  const status = String(f.Status || '').trim();\n  if (HANDED_OVER.indexOf(status) !== -1) continue;\n  const has = v => String(v == null ? '' : v).trim().length > 0;\n  const items = [];\n  const add = (ok, label) => items.push((ok ? '✅ ' : '⚠️ ') + label);\n  add(has(f.Title), 'Title');\n  add(has(f.Summary), 'Summary');\n  add(has(f.Chapters), 'Chapters');\n  add(has(f['Thumbnail Caption']), 'Thumbnail caption');\n  add(Number(f['1x1 Thumbnail Count'] || 0) > 0, '1:1 artwork');\n  const res = String(f['Video Resolution'] || '').trim();\n  add(f['Video Quality OK'] === true, res ? 'Video ' + esc(res) : 'Video quality measured');\n  const rel = String(f['Release Date'] || '').slice(0, 10);\n  add(!!rel, rel ? 'Release date ' + esc(rel) : 'Release date');\n  const id = f.ID || f.id || row.id || 'no-id';\n  const text = [\n    '🟡 <b>Ready to publish?</b>',\n    '',\n    '<code>' + esc(id) + '</code> · ' + esc(f.Title || '(untitled)'),\n    '',\n    items.join(NL),\n    '',\n    'That is everything the publisher needs. Set <b>Status = Ready to Publish</b> when you want it to go to Fountain. Nothing moves until you do.',\n    '',\n    '⚙️ <code>' + $workflow.id + '</code> · exec <code>' + $execution.id + '</code>'\n  ].join(NL);\n  out.push({ json: { text: text } });\n}\nreturn out;"}},
  {"id": "f8000000-0000-4000-8000-000000000003", "name": "Send Checklist", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [480, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "1b41d88a-734e-4be8-862a-421ad6979012", "parameters": {"chatId": "-5254203539", "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Publish Readiness Nudge', 0, 'Build Checklist'],
  ['Build Checklist', 0, 'Send Checklist']
];

const publishReadinessViewEnteredTelegramChecklist = workflow(
  "RATBwwfOlRDPDHeN",
  "BA - Publish Readiness View Entered > Telegram Checklist"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  executionOrder: "v1",
  callerPolicy: "workflowsFromSameOwner",
  availableInMCP: true
});

for (const live of liveNodes) publishReadinessViewEnteredTelegramChecklist.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  publishReadinessViewEnteredTelegramChecklist.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default publishReadinessViewEnteredTelegramChecklist;
