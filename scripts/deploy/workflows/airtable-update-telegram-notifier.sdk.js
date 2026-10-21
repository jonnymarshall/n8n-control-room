import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow GbFwXLACjj1O6spS, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh GbFwXLACjj1O6spS airtable-update-telegram-notifier
const liveNodes = [
  {"id": "ff6cf887-34ce-4b19-a8a1-22db42af94e1", "name": "On Episode Changed", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [240, 304], "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9"}, "tableId": {"__rl": true, "value": "tbl3uYLIvtB9APZp6", "mode": "id"}, "triggerField": "Last Modified Time", "additionalFields": {"fields": "Title,Status,Record Date,Notes,Last Modified Time,ID"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "15ed9306-81ba-4f3f-83c4-ecb406ba2f6f", "name": "Notify Status Change", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [544, 304], "webhookId": "161726f2-3f61-4415-aa2a-139fd5183fa5", "parameters": {"chatId": "-5254203539", "text": "=📻 <b>{{ $json.fields?.Title || \"(untitled episode)\" }}</b>\nID: <code>{{ $json.fields?.ID || \"\" }}</code>\nStatus: <code>{{ $json.fields?.Status || \"(no status)\" }}</code>\nUpdated: {{ $now.toFormat(\"HH:mm\") }}\n\n<a href=\"https://airtable.com/app8Xw9Tq0XLjhmp9\">Open Guy's Take base</a>", "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['On Episode Changed', 0, 'Notify Status Change']
];

const airtableUpdateTelegramNotifier = workflow(
  "GbFwXLACjj1O6spS",
  "BA: Airtable Update Telegram Notifier"
).settings({
  executionOrder: "v1",
  availableInMCP: true,
  binaryMode: "separate",
  timeSavedMode: "fixed",
  timezone: "America/Cancun",
  callerPolicy: "workflowsFromSameOwner"
});

for (const live of liveNodes) airtableUpdateTelegramNotifier.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  airtableUpdateTelegramNotifier.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default airtableUpdateTelegramNotifier;
