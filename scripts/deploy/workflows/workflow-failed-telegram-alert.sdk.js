import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow 9PMI1kuBjLW2YHwb, fetched 2026-11-27.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh 9PMI1kuBjLW2YHwb workflow-failed-telegram-alert
const liveNodes = [
  {"id": "02af0aad-22ce-4276-9d86-5b39d908a092", "name": "Workflow Errored", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1, "position": [240, 304], "parameters": {}},
  {"id": "dce91822-4508-466b-98ca-9dd3589a1075", "name": "Build Alert Message", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [544, 304], "parameters": {"jsCode": "const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst out = [];\nfor (const item of $input.all()) {\n  const j = item.json || {};\n  const exec = j.execution || {};\n  const wf = j.workflow || {};\n  const err = exec.error || (j.trigger && j.trigger.error) || {};\n  const isTriggerLevel = !exec.id && !!(j.trigger && j.trigger.error);\n  const causeMessage = (err.cause && err.cause.message) || '';\n  const extraMessages = Array.isArray(err.messages) ? err.messages.join(' ') : '';\n  const combined = [err.message, err.description, causeMessage, extraMessages].filter(Boolean).join(' ');\n  const isTransientDns = isTriggerLevel && /EAI_AGAIN|getaddrinfo|ENOTFOUND|DNS server returned an error/i.test(combined);\n  const failedNode = exec.lastNodeExecuted || (err.node && err.node.name) || (isTriggerLevel ? 'trigger poll' : 'unknown');\n  const workflowName = wf.name || 'unknown';\n  const errorMessage = err.message || err.description || 'no error message';\n  const executionUrl = exec.url || '';\n  const causeSuffix = causeMessage && causeMessage !== errorMessage ? ' (' + causeMessage + ')' : '';\n  // A Telegram rate limit is caused by volume, so alerting about it only adds\n  // volume. Log it silently instead; this is what stopped the 2026-11-10 storm\n  // (one throttled notice per upload, then one throttled alert per failed notice).\n  const isRateLimit = /too many requests|retry after|\\b429\\b/i.test(combined) || Number(err.httpCode) === 429;\n  // n8n's regex safety guard has a hardcoded 250ms wall-clock budget. A brief\n  // CPU stall can trip it while n8n checks the workflow's settings before any\n  // node runs (which is why the failed node is \"unknown\"). Nothing executed,\n  // so nothing was written or skipped: the next scheduled run does the work.\n  // Known n8n behaviour since 2.35, not a fault in this workflow.\n  const isHarmlessPreflightRegexTimeout =\n    failedNode === 'unknown' &&\n    /Regular expression execution timed out/i.test(combined);\n  // An upstream 5xx is a shared-service problem, not a workflow bug. During the\n  // 2026-11-27 Airtable incident every poller failed at once and each failure\n  // sent its own message (84 in seven minutes). A 5xx now goes through a\n  // 15-minute Ops Log cooldown before another Telegram alert is allowed.\n  const httpCodeMatch = combined.match(/\\b(500|502|503|504)\\b/);\n  const httpCode = String(err.httpCode || (httpCodeMatch ? httpCodeMatch[1] : '') || '');\n  const isUpstream5xx =\n    Number(httpCode) >= 500 ||\n    /SERVER_ERROR|Server encountered an error while processing your request/i.test(combined);\n  const alertMode = (isTransientDns || isRateLimit) ? 'silent' : (isUpstream5xx ? 'check5xx' : 'alert');\n  const title = isTransientDns\n    ? 'Transient DNS failure (logged, not alerted)'\n    : (isRateLimit\n      ? 'Telegram rate limit (logged, not alerted)'\n      : (isHarmlessPreflightRegexTimeout\n        ? 'Workflow failed (harmless, nothing to fix)'\n        : (isUpstream5xx ? 'Upstream service error' : 'Workflow failed')));\n  const lines = [\n    '❌ <b>' + title + '</b>',\n    '',\n    '<b>Workflow:</b> ' + esc(workflowName),\n    '<b>Failed node:</b> ' + esc(isHarmlessPreflightRegexTimeout ? 'none (stopped before the first step)' : failedNode),\n    '<b>Error:</b> ' + esc(errorMessage + causeSuffix),\n  ];\n  if (httpCode) lines.push('<b>HTTP:</b> ' + esc(httpCode));\n  if (isHarmlessPreflightRegexTimeout) {\n    lines.push('', \"Nothing to fix: this is n8n's own safety check timing out before the workflow started, not a fault in the workflow. No step ran and nothing was changed, and a scheduled workflow will simply try again on its next run.\");\n  }\n  if (isUpstream5xx) {\n    lines.push('', 'A shared service is returning an error. This alert repeats at most once every 15 minutes; further failures are logged without a message.');\n  }\n  if (isTriggerLevel) {\n    lines.push('', 'The trigger poll failed before a run was created, so there is no execution ID.');\n  } else {\n    lines.push('', 'Execution: <code>' + esc(exec.id || 'n/a') + '</code>');\n    if (executionUrl) lines.push(esc(executionUrl));\n  }\n  const suffix = isTransientDns\n    ? ' (benign DNS, suppressed)'\n    : (isRateLimit\n      ? ' (Telegram rate limit, suppressed)'\n      : (isHarmlessPreflightRegexTimeout\n        ? ' (harmless, no action)'\n        : (isUpstream5xx ? ' (upstream 5xx)' : '')));\n  const detail = [\n    'Failed node: ' + failedNode,\n    'HTTP: ' + (httpCode || 'n/a'),\n    'Error: ' + (errorMessage + causeSuffix),\n    'Trigger level: ' + (isTriggerLevel ? 'yes' : 'no'),\n    'Execution: ' + (exec.id || 'n/a'),\n    executionUrl,\n  ].filter(Boolean).join(' | ');\n  out.push({ json: {\n    message: lines.join('\\n'),\n    event: workflowName + ' failed' + suffix,\n    workflowName,\n    failedNode,\n    errorMessage: errorMessage + causeSuffix,\n    httpCode,\n    executionUrl,\n    alertMode,\n    upstream5xx: isUpstream5xx,\n    detail,\n  } });\n}\nreturn out;"}},
  {"id": "a7f3c1e2-9b4d-4f6a-8c21-5e0d9b7a3c10", "name": "Is Alertable?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [744, 304], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "is-transient-dns", "leftValue": "={{ $json.alertMode }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "alert"}], "combinator": "and"}, "options": {}}},
  {"id": "c7a1f0e2-1111-4a11-8f01-000000000001", "name": "Upstream 5xx?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [744, 464], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "is-upstream-5xx", "leftValue": "={{ $json.alertMode }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "check5xx"}], "combinator": "and"}, "options": {}}},
  {"id": "e5b41d71-83e3-4db3-9789-521db7df2b33", "name": "Send Alert to Group", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [944, 192], "onError": "continueRegularOutput", "retryOnFail": true, "webhookId": "b4209321-030c-48ab-a036-3236062130fb", "parameters": {"chatId": "-5254203539", "text": "={{ $('Build Alert Message').first().json.message }}", "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "c7a1f0e2-1111-4a11-8f01-000000000002", "name": "Find Recent Upstream Alert", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [944, 464], "onError": "continueErrorOutput", "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm", "cachedResultName": "Ops"}, "table": {"__rl": true, "mode": "id", "value": "tblgBjxgIKpje5q0S", "cachedResultName": "Ops Log"}, "filterByFormula": "AND(NOT(FIND(\"(upstream 5xx)\", {Event}) = 0), IS_AFTER({Timestamp}, DATEADD(NOW(), -15, 'minutes')))", "returnAll": false, "limit": 1, "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "f79ed43b-6983-44b4-a55f-a9a315e875a4", "name": "Log Error to Ops Log", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1144, 304], "onError": "continueRegularOutput", "retryOnFail": true, "parameters": {"operation": "create", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "id", "value": "tblgBjxgIKpje5q0S"}, "columns": {"mappingMode": "defineBelow", "value": {"Event": "={{ $('Build Alert Message').first().json.event }}", "Workflow": "={{ $('Build Alert Message').first().json.workflowName }}", "Type": "Error", "Execution URL": "={{ $('Build Alert Message').first().json.executionUrl }}", "Detail": "={{ $('Build Alert Message').first().json.detail }}"}, "matchingColumns": [], "schema": [{"id": "Event", "displayName": "Event", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Workflow", "displayName": "Workflow", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Record ID", "displayName": "Record ID", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Type", "displayName": "Type", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "options", "options": [{"name": "Error", "value": "Error"}, {"name": "Skipped", "value": "Skipped"}, {"name": "Completed", "value": "Completed"}, {"name": "Heartbeat", "value": "Heartbeat"}], "readOnly": false, "removed": false}, {"id": "Execution URL", "displayName": "Execution URL", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Detail", "displayName": "Detail", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Timestamp", "displayName": "Timestamp", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": true, "removed": false}], "attemptToConvertTypes": false, "convertFieldsToString": false}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "c7a1f0e2-1111-4a11-8f01-000000000003", "name": "Already Alerted?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1144, 464], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "has-recent-alert", "leftValue": "={{ ($json.records || []).length > 0 }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}}
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
  ['Is Alertable?', 0, 'Send Alert to Group'],
  ['Is Alertable?', 1, 'Log Error to Ops Log'],
  ['Send Alert to Group', 0, 'Log Error to Ops Log'],
  ['Build Alert Message', 0, 'Upstream 5xx?'],
  ['Upstream 5xx?', 0, 'Find Recent Upstream Alert'],
  ['Upstream 5xx?', 1, 'Is Alertable?'],
  ['Find Recent Upstream Alert', 0, 'Already Alerted?'],
  ['Find Recent Upstream Alert', 1, 'Log Error to Ops Log'],
  ['Already Alerted?', 0, 'Log Error to Ops Log'],
  ['Already Alerted?', 1, 'Send Alert to Group']
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
