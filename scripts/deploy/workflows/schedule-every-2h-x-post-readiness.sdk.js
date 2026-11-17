import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow ybngTJAUMqJaDwbB, fetched 2026-11-17.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh ybngTJAUMqJaDwbB schedule-every-2h-x-post-readiness
const liveNodes = [
  {"id": "e4000000-0000-4000-8000-000000000001", "name": "Every 2 Hours", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 300], "parameters": {"rule": {"interval": [{"field": "hours", "hoursInterval": 2}]}}},
  {"id": "e4000000-0000-4000-8000-000000000002", "name": "Fetch X Copy Needed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [240, 180], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "view", "value": "viwCZGBwut56NnNgY"}, {"name": "maxRecords", "value": "100"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e4000000-0000-4000-8000-000000000010", "name": "Fetch X Link Needed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [240, 420], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "view", "value": "viwWvqDJ0iG5BaSK7"}, {"name": "maxRecords", "value": "100"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "e4000000-0000-4000-8000-000000000008", "name": "X Copy Needed View", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [480, 80], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbllWUvhNolvdk3uw", "cachedResultName": "Publications"}, "triggerField": "Last Modified Time", "additionalFields": {"viewId": "viwCZGBwut56NnNgY"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "e4000000-0000-4000-8000-000000000011", "name": "Merge Views", "type": "n8n-nodes-base.merge", "typeVersion": 3.2, "position": [480, 300], "parameters": {"mode": "append", "numberInputs": 2}},
  {"id": "e4000000-0000-4000-8000-000000000009", "name": "X Link Needed View", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [480, 560], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbllWUvhNolvdk3uw", "cachedResultName": "Publications"}, "triggerField": "Last Modified Time", "additionalFields": {"viewId": "viwWvqDJ0iG5BaSK7"}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "e4000000-0000-4000-8000-000000000003", "name": "Plan Nudges", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [720, 300], "parameters": {"jsCode": "// Why Code: decides which X rows need a copy or link nudge and respects the stage, age and cooldown.\nconst NOW = Date.now();\nconst COPY_COOLDOWN = 12 * 60 * 60 * 1000;\nconst EARLY_COPY_COOLDOWN = 48 * 60 * 60 * 1000;\nconst EARLY_AGE = 2 * 60 * 60 * 1000;\nconst LINK_COOLDOWN = 24 * 60 * 60 * 1000;\nconst COPY_STATUSES = new Set(['Approved', 'Awaiting Thumbnail Pick', 'Artwork Ready', 'Ready to Publish', 'Scheduled to Publish', 'Published']);\nconst EARLY_STATUSES = new Set(['Approved', 'Awaiting Thumbnail Pick']);\n\nconst NY_HOUR = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));\nif (NY_HOUR < 8 || NY_HOUR >= 21) return [];\n\nconst lookupValue = (v) => {\n  if (v == null) return '';\n  if (Array.isArray(v)) return String(v[0] ?? '');\n  if (typeof v === 'object') {\n    if (v.valuesByLinkedRecordId) {\n      const vals = Object.values(v.valuesByLinkedRecordId).flat();\n      return String(vals[0] ?? '');\n    }\n    if (v.name) return String(v.name);\n  }\n  return String(v);\n};\n\nconst lookupNonEmpty = (v) => {\n  if (v == null) return false;\n  if (Array.isArray(v)) return v.length > 0;\n  if (typeof v === 'object' && v.valuesByLinkedRecordId) {\n    return Object.values(v.valuesByLinkedRecordId).flat().filter(Boolean).length > 0;\n  }\n  return String(v).trim().length > 0;\n};\n\nconst out = [];\nconst rows = $input.all().flatMap(it => Array.isArray(it.json?.records) ? it.json.records : [it.json]);\nfor (const row of rows) {\n  const f = row.fields || row;\n  const publication = String(f.Publication || '').trim();\n  if (!publication.endsWith(' - X')) continue;\n  const episodeId = publication.slice(0, -4);\n  const title = lookupValue(f['Episode Title']) || '(untitled)';\n  const episodeStatus = lookupValue(f['Episode Status']);\n  const socialPosts = f['Episode Social Posts'];\n  const postCopy = String(f['Post Copy'] || '').trim();\n  const url = String(f.URL || '').trim();\n  const last = f['Last Nudged At'] ? new Date(f['Last Nudged At']).getTime() : 0;\n  const since = NOW - last;\n  const created = row.createdTime ? new Date(row.createdTime).getTime() : 0;\n  const isEarly = EARLY_STATUSES.has(episodeStatus);\n\n  let kind = null;\n  if (!postCopy && COPY_STATUSES.has(episodeStatus) && lookupNonEmpty(socialPosts)) {\n    if (isEarly && created && NOW - created < EARLY_AGE) {\n      // The options were only just written; let the \"Social posts ready\" message land first.\n    } else if (!last || since >= (isEarly ? EARLY_COPY_COOLDOWN : COPY_COOLDOWN)) {\n      kind = 'copy';\n    }\n  } else if (postCopy && !url && episodeStatus === 'Published') {\n    if (!last || since >= LINK_COOLDOWN) kind = 'link';\n  }\n  if (!kind) continue;\n\n  out.push({ json: {\n    id: row.id,\n    episodeId: episodeId,\n    title: title,\n    episodeStatus: episodeStatus,\n    kind: kind,\n    postCopy: postCopy,\n    url: url\n  }});\n}\nreturn out;"}},
  {"id": "e4000000-0000-4000-8000-000000000004", "name": "Build Nudges", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [720, 300], "parameters": {"jsCode": "const NL = String.fromCharCode(10);\nconst esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst out = [];\nfor (const it of $input.all()) {\n  const j = it.json;\n  const lines = [];\n  if (j.kind === 'copy') {\n    const stage = j.episodeStatus === 'Artwork Ready'\n      ? 'The artwork is done'\n      : j.episodeStatus === 'Ready to Publish'\n        ? 'The episode is ready to publish'\n        : j.episodeStatus === 'Scheduled to Publish'\n          ? 'The episode is scheduled to publish'\n          : 'The episode is live';\n    lines.push(\n      '\\ud83d\\udfe1 <b>X post not chosen</b>',\n      '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500',\n      '<code>' + esc(j.episodeId) + '</code> \\u00b7 ' + esc(j.title),\n      '',\n      stage + ' and there is no X post picked yet.',\n      '',\n      '\\ud83d\\udfe1 Reply to the \"Social posts ready\" message with <i>option 2</i>, or reply <i>resend social posts</i> and I will post the four again.',\n      '',\n      'If you are not doing X for this one, set the X row Status = Skipped in Airtable.',\n      '',\n      '\\u2699\\ufe0f <code>' + $workflow.id + '</code> \\u00b7 exec <code>' + $execution.id + '</code>'\n    );\n  } else {\n    lines.push(\n      '\\ud83d\\udfe1 <b>X link needed</b>',\n      '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500',\n      '<code>' + esc(j.episodeId) + '</code> \\u00b7 ' + esc(j.title),\n      '',\n      'The episode is live. The X post is still marked Pending.',\n      '',\n      '\\ud83d\\udfe1 Reply with the X link and I will store it on the X row, or set Status = Published in Airtable.',\n      '',\n      '\\u2699\\ufe0f <code>' + $workflow.id + '</code> \\u00b7 exec <code>' + $execution.id + '</code>'\n    );\n  }\n  out.push({ json: { ...j, text: lines.join(NL) } });\n}\nreturn out;"}},
  {"id": "e4000000-0000-4000-8000-000000000005", "name": "Send X Nudges", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [960, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "547c2367-1c35-4cf4-93e1-b7fd0980ddec", "parameters": {"chatId": "-5254203539", "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "e4000000-0000-4000-8000-000000000006", "name": "Build Nudge Stamps", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1200, 300], "parameters": {"jsCode": "const now = new Date().toISOString();\nconst records = $('Plan Nudges').all().map(it => ({ id: it.json.id, fields: { 'Last Nudged At': now } }));\nreturn [{ json: { records: records } }];"}},
  {"id": "e4000000-0000-4000-8000-000000000007", "name": "Stamp Nudged", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1440, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ records: $json.records }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}}
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
  ['Every 2 Hours', 0, 'Fetch X Copy Needed'],
  ['Every 2 Hours', 0, 'Fetch X Link Needed'],
  ['Fetch X Copy Needed', 0, 'Merge Views'],
  ['Plan Nudges', 0, 'Build Nudges'],
  ['Build Nudges', 0, 'Send X Nudges'],
  ['Send X Nudges', 0, 'Build Nudge Stamps'],
  ['Build Nudge Stamps', 0, 'Stamp Nudged'],
  ['X Copy Needed View', 0, 'Plan Nudges'],
  ['X Link Needed View', 0, 'Plan Nudges'],
  ['Fetch X Link Needed', 0, 'Merge Views', 1],
  ['Merge Views', 0, 'Plan Nudges']
];

const scheduleEvery2hXPostReadiness = workflow(
  "ybngTJAUMqJaDwbB",
  "BA - Schedule Every 2h > X Post Readiness"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) scheduleEvery2hXPostReadiness.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  scheduleEvery2hXPostReadiness.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default scheduleEvery2hXPostReadiness;
