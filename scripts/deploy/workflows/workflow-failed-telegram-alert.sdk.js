import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow 9PMI1kuBjLW2YHwb, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh 9PMI1kuBjLW2YHwb workflow-failed-telegram-alert
const liveNodes = [
  {"id": "02af0aad-22ce-4276-9d86-5b39d908a092", "name": "Workflow Errored", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1, "position": [240, 304], "parameters": {}},
  {"id": "dce91822-4508-466b-98ca-9dd3589a1075", "name": "Build Alert Message", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [544, 304], "parameters": {"jsCode": "const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst out = [];\nfor (const item of $input.all()) {\n  const j = item.json || {};\n  const exec = j.execution || {};\n  const wf = j.workflow || {};\n  const err = exec.error || (j.trigger && j.trigger.error) || {};\n  const isTriggerLevel = !exec.id && !!(j.trigger && j.trigger.error);\n  const causeMessage = (err.cause && err.cause.message) || '';\n  const isTransientDns = isTriggerLevel && /EAI_AGAIN|getaddrinfo|ENOTFOUND|DNS server returned an error/i.test(String(err.message || '') + ' ' + causeMessage);\n  const failedNode = exec.lastNodeExecuted || (err.node && err.node.name) || (isTriggerLevel ? 'trigger poll' : 'unknown');\n  const workflowName = wf.name || 'unknown';\n  const errorMessage = err.message || err.description || 'no error message';\n  const executionUrl = exec.url || '';\n  const causeSuffix = causeMessage && causeMessage !== errorMessage ? ' (' + causeMessage + ')' : '';\n  const alertMode = isTransientDns ? 'silent' : 'alert';\n  const title = isTransientDns ? 'Transient DNS failure (logged, not alerted)' : 'Workflow failed';\n  const lines = [\n    '🚨 <b>' + title + '</b>',\n    '',\n    '<b>Workflow:</b> ' + esc(workflowName),\n    '<b>Failed node:</b> ' + esc(failedNode),\n    '<b>Error:</b> ' + esc(errorMessage + causeSuffix),\n  ];\n  if (isTriggerLevel) {\n    lines.push('', 'The trigger poll failed before a run was created, so there is no execution ID.');\n  } else {\n    lines.push('', 'Execution: <code>' + esc(exec.id || 'n/a') + '</code>');\n    if (executionUrl) lines.push(esc(executionUrl));\n  }\n  out.push({ json: {\n    message: lines.join('\\n'),\n    event: workflowName + ' failed' + (isTransientDns ? ' (benign DNS, suppressed)' : ''),\n    workflowName,\n    failedNode,\n    errorMessage: errorMessage + causeSuffix,\n    executionUrl,\n    alertMode,\n  } });\n}\nreturn out;"}},
  {"id": "a7f3c1e2-9b4d-4f6a-8c21-5e0d9b7a3c10", "name": "Is Alertable?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [744, 304], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "is-transient-dns", "leftValue": "={{ $json.alertMode }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "alert"}], "combinator": "and"}, "options": {}}},
  {"id": "e5b41d71-83e3-4db3-9789-521db7df2b33", "name": "Send Alert to Group", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [944, 192], "retryOnFail": true, "webhookId": "b4209321-030c-48ab-a036-3236062130fb", "parameters": {"chatId": "-5254203539", "text": "={{ $json.message }}", "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "f79ed43b-6983-44b4-a55f-a9a315e875a4", "name": "Log Error to Ops Log", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1144, 304], "onError": "continueRegularOutput", "retryOnFail": true, "parameters": {"operation": "create", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "id", "value": "tblgBjxgIKpje5q0S"}, "columns": {"mappingMode": "defineBelow", "value": {"Event": "={{ $('Build Alert Message').item.json.event }}", "Workflow": "={{ $('Build Alert Message').item.json.workflowName }}", "Type": "Error", "Execution URL": "={{ $('Build Alert Message').item.json.executionUrl }}"}, "matchingColumns": [], "schema": [{"id": "Event", "displayName": "Event", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Workflow", "displayName": "Workflow", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Record ID", "displayName": "Record ID", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Type", "displayName": "Type", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "options", "options": [{"name": "Error", "value": "Error"}, {"name": "Skipped", "value": "Skipped"}, {"name": "Completed", "value": "Completed"}, {"name": "Heartbeat", "value": "Heartbeat"}], "readOnly": false, "removed": false}, {"id": "Execution URL", "displayName": "Execution URL", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Timestamp", "displayName": "Timestamp", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": true, "removed": false}], "attemptToConvertTypes": false, "convertFieldsToString": false}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}}
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
  ['Workflow Errored', 0, 'Build Alert Message'],
  ['Build Alert Message', 0, 'Is Alertable?'],
  ['Is Alertable?', 0, 'Send Alert to Group'],
  ['Is Alertable?', 1, 'Log Error to Ops Log'],
  ['Send Alert to Group', 0, 'Log Error to Ops Log']
];

const workflowFailedTelegramAlert = workflow(
  "9PMI1kuBjLW2YHwb",
  "Pod21: Workflow Failed > Telegram Alert"
).settings({
  executionOrder: "v1",
  availableInMCP: true,
  binaryMode: "separate"
});

for (const live of liveNodes) workflowFailedTelegramAlert.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  workflowFailedTelegramAlert.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default workflowFailedTelegramAlert;
