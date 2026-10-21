import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow spXF48NOXJYaDfnz, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh spXF48NOXJYaDfnz n8n-githup-backups
const liveNodes = [
  {"id": "236b3e8b-baec-4630-b1ee-633b68ff77cf", "name": "Sticky Note bf73c049", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-96, 336], "parameters": {"content": "## Daily workflow backup to GitHub\n\nPulls every workflow (active, inactive and drafts) from the n8n API, and commits any that changed to github.com/jonnymarshall/n8n-backups under workflows/. Unchanged workflows are skipped, so quiet days produce zero commits. Failures DM Jonny via the bot.\n\nNOT included: credentials (the API cannot export secrets). For full disaster recovery also back up the n8n database volume and N8N_ENCRYPTION_KEY off-server.\n\nFull docs + recovery procedures: n8n-control-room/n8n_workflow_readmes/Schedule - Daily 3am - Backup all workflows to GitHub.md", "height": 200, "width": 520, "color": 5}},
  {"id": "6c752e19-699d-4a9b-99c7-3ab98ef1c078", "name": "Daily at 3am", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.3, "position": [0, 592], "parameters": {"rule": {"interval": [{"triggerAtHour": 3}]}}},
  {"id": "9c5d2182-101a-4199-b41c-ee7d9c93e111", "name": "Fetch All Workflows", "type": "n8n-nodes-base.n8n", "typeVersion": 1, "position": [224, 592], "onError": "continueErrorOutput", "parameters": {"filters": {"excludePinnedData": true}, "requestOptions": {}}, "credentials": {"n8nApi": {"id": "4HcfHQb3ZP74tko4", "name": "N8N_API_SELF_V05"}}},
  {"id": "5f6cc120-9baf-4945-aecb-bc81dd85bc35", "name": "Prepare Backup Files", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [448, 528], "onError": "continueErrorOutput", "parameters": {"jsCode": "const items = $input.all();\nconst out = [];\nfor (const it of items) {\n  const wf = it.json;\n  const safe = String(wf.name || 'unnamed').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\\s+/g, '_').slice(0, 80) || 'unnamed';\n  const path = 'workflows/' + safe + '__' + wf.id + '.json';\n  const content = JSON.stringify(wf, null, 2) + '\\n';\n  out.push({ json: { path: path, name: wf.name, contentB64: Buffer.from(content, 'utf8').toString('base64') } });\n}\nreturn out;"}},
  {"id": "500e3041-4b75-4c23-80ca-16de546bd808", "name": "Get Existing File", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [672, 448], "onError": "continueErrorOutput", "parameters": {"url": "=https://api.github.com/repos/jonnymarshall/n8n-backups/contents/{{ $json.path }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "githubApi", "sendHeaders": true, "headerParameters": {"parameters": [{"name": "Accept", "value": "application/vnd.github+json"}]}, "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 200}}, "response": {"response": {"neverError": true}}, "timeout": 20000}}, "credentials": {"githubApi": {"id": "UPhLeaoc9Fm73QLg", "name": "GitHub [n8n-backups]"}}},
  {"id": "89dbd3bd-d287-4807-841f-8289c31008e5", "name": "Keep Only Changed", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [896, 384], "onError": "continueErrorOutput", "parameters": {"jsCode": "const prepared = $('Prepare Backup Files').all();\nconst responses = $input.all();\nconst out = [];\nfor (let i = 0; i < prepared.length; i++) {\n  const p = prepared[i].json;\n  const r = (responses[i] || {}).json || {};\n  const existing = typeof r.content === 'string' ? r.content.replace(/\\s/g, '') : null;\n  const isNew = !r.sha;\n  if (!isNew && existing === p.contentB64) continue;\n  const body = { message: (isNew ? 'backup: add ' : 'backup: update ') + p.name, content: p.contentB64 };\n  if (!isNew) body.sha = r.sha;\n  out.push({ json: { path: p.path, name: p.name, bodyJson: JSON.stringify(body) } });\n}\nreturn out;"}},
  {"id": "33e1ec59-5977-4678-ad05-2f80089dd399", "name": "Commit Changed Files", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1120, 304], "onError": "continueErrorOutput", "parameters": {"method": "PUT", "url": "=https://api.github.com/repos/jonnymarshall/n8n-backups/contents/{{ $json.path }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "githubApi", "sendHeaders": true, "headerParameters": {"parameters": [{"name": "Accept", "value": "application/vnd.github+json"}]}, "sendBody": true, "specifyBody": "json", "jsonBody": "={{ $json.bodyJson }}", "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 500}}, "timeout": 30000}}, "credentials": {"githubApi": {"id": "UPhLeaoc9Fm73QLg", "name": "GitHub [n8n-backups]"}}},
  {"id": "958d9653-2d8c-429d-8e21-01739b52a03a", "name": "Notify Backup Failed", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1344, 576], "webhookId": "5feb4871-73fa-4b6e-9aa1-8099a8ff718c", "parameters": {"chatId": "1512868522", "text": "=⚠️ n8n GitHub backup failed\n\nError: {{ ($json.error?.message ?? JSON.stringify($json)).substring(0, 600) }}", "additionalFields": {"appendAttribution": false}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Daily at 3am', 0, 'Fetch All Workflows'],
  ['Fetch All Workflows', 0, 'Prepare Backup Files'],
  ['Prepare Backup Files', 0, 'Get Existing File'],
  ['Get Existing File', 0, 'Keep Only Changed'],
  ['Keep Only Changed', 0, 'Commit Changed Files']
];

const n8nGithupBackups = workflow(
  "spXF48NOXJYaDfnz",
  "pod21: n8n Githup Backups"
).settings({
  executionOrder: "v1",
  availableInMCP: true,
  binaryMode: "separate",
  timeSavedMode: "fixed",
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  callerPolicy: "workflowsFromSameOwner"
});

for (const live of liveNodes) n8nGithupBackups.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  n8nGithupBackups.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default n8nGithupBackups;
