import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow aRwDA0qtQnjXR0sr, fetched 2026-11-23.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh aRwDA0qtQnjXR0sr audionauts-post-revising-redrafted
const liveNodes = [
  {"id": "c1100000-0000-4000-8000-000000000001", "name": "Social Posts Changed", "type": "n8n-nodes-base.airtableTrigger", "typeVersion": 1, "position": [0, 300], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "authentication": "airtableTokenApi", "baseId": {"__rl": true, "mode": "id", "value": "app8Xw9Tq0XLjhmp9", "cachedResultName": "Guy's Take"}, "tableId": {"__rl": true, "mode": "id", "value": "tbly8EpeOlYrXHYNE", "cachedResultName": "Social Posts"}, "triggerField": "Last Modified Time", "additionalFields": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "c1100000-0000-4000-8000-000000000002", "name": "Pick Audionauts Revising", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 300], "parameters": {"jsCode": "// Why Code: one revision request identifies the Audionauts row, its episode and the brief.\nconst seen = new Set();\nconst out = [];\nfor (const it of $input.all()) {\n  const row = it.json || {};\n  const f = row.fields || row;\n  if (String(f.Status || '').trim() !== 'Revising') continue;\n  if (String(f.Platform || '').trim() !== 'Keet + Telegram') continue;\n  const rawLink = Array.isArray(f.Episode) ? f.Episode[0] : f.Episode;\n  const episodeRecordId = typeof rawLink === 'string' ? rawLink : rawLink?.id;\n  if (!episodeRecordId) continue;\n  if (seen.has(episodeRecordId)) continue;\n  seen.add(episodeRecordId);\n  const first = (v) => Array.isArray(v) ? v[0] : v;\n  const brief = String(f['Revision Brief'] || '').trim();\n  if (!brief) throw new Error('Audionauts row ' + row.id + ' is Revising with no Revision Brief');\n  out.push({ json: {\n    rowId: row.id,\n    episodeRecordId: episodeRecordId,\n    episodeId: String(first(f['Episode ID']) || 'no-id').trim(),\n    title: String(first(f['Episode Title']) || '(untitled)').trim(),\n    brief: brief,\n    previous: String(f.Copy || '').trim(),\n    round: Number(f.Round || 1)\n  }});\n}\nreturn out;"}},
  {"id": "c1100000-0000-4000-8000-000000000003", "name": "Fetch Clip Episode", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [440, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $('Pick Audionauts Revising').first().json.episodeRecordId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "c1100000-0000-4000-8000-000000000004", "name": "Resolve Parent Episode", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [660, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "={{ \"{ID}='\" + ($('Fetch Clip Episode').first().json.fields?.['Associated Episode'] || '') + \"'\" }}"}, {"name": "maxRecords", "value": "1"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "c1100000-0000-4000-8000-000000000005", "name": "Fetch Audionauts Prompts", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblhG1nw2P1k3CBVU", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendQuery": true, "queryParameters": {"parameters": [{"name": "filterByFormula", "value": "OR({Name}='Audionauts Post',{Name}='Social Post Humanizer')"}, {"name": "maxRecords", "value": "2"}]}, "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "c1100000-0000-4000-8000-000000000006", "name": "Build Revision Request", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 300], "parameters": {"jsCode": "// Why Code: re-fills the Audionauts brief with the clip, the parent episode, the brief and the rejected draft.\nconst job = $('Pick Audionauts Revising').first().json;\nconst f = $('Fetch Clip Episode').first().json.fields || {};\nconst parentRec = ($('Resolve Parent Episode').first().json.records || [])[0];\nconst parent = parentRec ? (parentRec.fields || {}) : {};\nconst prompts = ($('Fetch Audionauts Prompts').first().json.records || []);\nconst fieldsOf = (name) => ((prompts.find(r => String(r.fields?.Name || '') === name) || {}).fields) || {};\nconst template = String(fieldsOf('Audionauts Post').Prompt || '');\nif (!template.trim()) throw new Error('Audionauts Post prompt row not found or empty');\nconst humanizer = String(fieldsOf('Social Post Humanizer').Prompt || '');\nif (!humanizer.trim()) throw new Error('Social Post Humanizer prompt row not found or empty');\n\nconst asList = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);\nconst parentGuests = asList(parent['Guest Name']);\nconst guests = (parentGuests.length ? parentGuests : asList(f['Guest Name'])).join(', ');\nconst parentTitle = String(parent.Title || '').trim();\nconst clipTitle = String(f.Title || job.title || '').trim();\nconst titleLine = parentTitle ? (parentTitle + ' (Audionauts clip: ' + clipTitle + ')') : clipTitle;\n\nconst filled = template\n  .split('{{TITLE}}').join(titleLine)\n  .split('{{GUESTS}}').join(guests || 'none listed')\n  .split('{{TRANSCRIPT}}').join(String(f.Transcript || ''))\n  .split('{{HUMANIZER}}').join(humanizer)\n  .split('{{BRIEF}}').join(job.brief)\n  .split('{{PREVIOUS}}').join(job.previous || '(none)');\n\nreturn [{ json: Object.assign({}, job, { guests: guests || 'none listed', titleLine, requestBody: {\n  model: 'google/gemini-3.7-flash',\n  messages: [\n    { role: 'system', content: 'You write the Audionauts clip rundown. Follow the editorial brief exactly. Return only the JSON object, with no markdown fences, no explanation and no working.' },\n    { role: 'user', content: filled }\n  ],\n  temperature: 0.85,\n  max_tokens: 3000,\n  response_format: { type: 'json_object' }\n} } ) }];"}},
  {"id": "c1100000-0000-4000-8000-000000000007", "name": "Draft Audionauts Post", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1320, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "POST", "url": "https://openrouter.ai/api/v1/chat/completions", "authentication": "predefinedCredentialType", "nodeCredentialType": "openRouterApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.requestBody) }}", "options": {"timeout": 120000}}, "credentials": {"openRouterApi": {"id": "fYdCNdLcAcCMjpnr", "name": "OpenRouter [n8n]"}}},
  {"id": "c1100000-0000-4000-8000-000000000008", "name": "Parse Audionauts Revision", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 300], "parameters": {"jsCode": "// Why Code: validates the redraft against the Audionauts hard limits before the row is rewritten.\nconst LIMIT = 1000;\nconst BANNED = ['dive into','delve','unleash','game-changer','game changer','revolutionary','transform','landscape','unlock','journey','discover','testament','symphony','mind-blowing','cutting-edge','massive','foster','leverage','utilize','facilitate','empower','streamline','robust','paradigm shift','tapestry','realm','beacon','multifaceted','meticulous','intricate','paramount','transformative','elevate','embark','supercharge','harness','ever-evolving','this is huge','this changes everything','insane','wild','crazy','epic','ultimate','must-listen','unmissable'];\nconst BANNED_MOVES = ['here is the thing',\"here's the thing\",'let me be clear','what nobody tells you','the part everyone misses','most people get this wrong','what if i told you','plot twist','join me as i','i sit down with','in conclusion','ultimately,','overall,'];\nconst job = $('Pick Audionauts Revising').first().json;\nconst raw = $input.first().json?.choices?.[0]?.message?.content;\nif (typeof raw !== 'string' || !raw.trim()) throw new Error('No Audionauts redraft returned for ' + job.episodeId);\nconst parsed = (() => {\n  const cleaned = raw.replace(/^\\s*```(?:json)?/i, '').replace(/```\\s*$/i, '').trim();\n  try { return JSON.parse(cleaned); } catch (e) {}\n  const first = cleaned.indexOf('{');\n  const last = cleaned.lastIndexOf('}');\n  if (first >= 0 && last > first) { try { return JSON.parse(cleaned.slice(first, last + 1)); } catch (e) {} }\n  return null;\n})();\nif (!parsed || typeof parsed.body !== 'string' || !parsed.body.trim()) throw new Error('Audionauts redraft for ' + job.episodeId + ' had no body');\n\nlet body = parsed.body\n  .replace(/[\\u2014\\u2013]/g, ', ')\n  .replace(/[\\u2018\\u2019]/g, \"'\")\n  .replace(/[\\u201c\\u201d]/g, '\"')\n  .replace(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/gu, ' ')\n  .replace(/[ \\t]+/g, ' ')\n  .replace(/ *\\n */g, '\\n')\n  .replace(/\\n{3,}/g, '\\n\\n')\n  .trim();\nif (body.length > LIMIT) {\n  const cut = body.slice(0, LIMIT);\n  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('\\n'));\n  if (at < LIMIT * 0.5) throw new Error('Audionauts redraft for ' + job.episodeId + ' is ' + body.length + ' characters with no sentence boundary to trim at');\n  body = cut.slice(0, at + 1).trim();\n}\nconst flat = body.toLowerCase();\nif (/\\bmatters?\\b|\\bmattering\\b/.test(flat)) throw new Error('Banned word \"matters\" in the Audionauts redraft for ' + job.episodeId);\nfor (const w of BANNED) { if (flat.includes(w)) throw new Error('Banned word \"' + w + '\" in the Audionauts redraft for ' + job.episodeId); }\nfor (const m of BANNED_MOVES) { if (flat.includes(m)) throw new Error('Banned move \"' + m + '\" in the Audionauts redraft for ' + job.episodeId); }\nif (/https?:\\/\\//i.test(body)) throw new Error('URL in the Audionauts redraft for ' + job.episodeId);\nconst angle = String(parsed.angle || 'Audionauts rundown').replace(/\\s+/g, ' ').trim().slice(0, 60);\nreturn [{ json: Object.assign({}, job, { angle, body, characters: body.length, nextRound: job.round + 1 }) }];"}},
  {"id": "c1100000-0000-4000-8000-000000000009", "name": "Update Audionauts Social Post", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1760, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "PATCH", "url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbly8EpeOlYrXHYNE/{{ $('Parse Audionauts Revision').first().json.rowId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ fields: { Name: $('Parse Audionauts Revision').first().json.episodeId + ' \\u00b7 R' + $('Parse Audionauts Revision').first().json.nextRound + ' \\u00b7 O1', Copy: $('Parse Audionauts Revision').first().json.body, Angle: $('Parse Audionauts Revision').first().json.angle, Characters: $('Parse Audionauts Revision').first().json.characters, Round: $('Parse Audionauts Revision').first().json.nextRound, Status: 'Proposed', 'Revision Brief': '' } }) }}", "options": {"timeout": 30000}}, "credentials": {"httpBearerAuth": {"id": "6kLezx6frdcTmewI", "name": "Airtable PAT"}}},
  {"id": "c1100000-0000-4000-8000-000000000010", "name": "Build Revised Message", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1980, 300], "parameters": {"jsCode": "const NL = String.fromCharCode(10);\nconst esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst j = $('Parse Audionauts Revision').first().json;\nconst text = [\n  '\\u2705 <b>Audionauts post redrafted</b>',\n  '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500',\n  '<code>' + esc(j.episodeId) + '</code> \\u00b7 ' + esc(j.title),\n  '',\n  '<b>' + esc(j.angle) + '</b>',\n  esc(j.body),\n  '',\n  '<i>' + j.characters + ' / 1000 characters \\u00b7 Round ' + j.nextRound + '</i>',\n  '',\n  '\\ud83d\\udfe1 Reply <i>option 1</i> to pick it, <i>custom: your exact post</i> to use your own copy, or <i>revise: your feedback</i> for another pass.',\n  '',\n  '\\u2699\\ufe0f <code>' + $workflow.id + '</code> \\u00b7 exec <code>' + $execution.id + '</code>'\n].join(NL);\nreturn [{ json: { text } }];"}},
  {"id": "c1100000-0000-4000-8000-000000000011", "name": "Send Revised Message", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2200, 300], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "ab77514f-6469-4eb7-8270-1c8a73a5075b", "parameters": {"chatId": "-5254203539", "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Social Posts Changed', 0, 'Pick Audionauts Revising'],
  ['Pick Audionauts Revising', 0, 'Fetch Clip Episode'],
  ['Fetch Clip Episode', 0, 'Resolve Parent Episode'],
  ['Resolve Parent Episode', 0, 'Fetch Audionauts Prompts'],
  ['Fetch Audionauts Prompts', 0, 'Build Revision Request'],
  ['Build Revision Request', 0, 'Draft Audionauts Post'],
  ['Draft Audionauts Post', 0, 'Parse Audionauts Revision'],
  ['Parse Audionauts Revision', 0, 'Update Audionauts Social Post'],
  ['Update Audionauts Social Post', 0, 'Build Revised Message'],
  ['Build Revised Message', 0, 'Send Revised Message']
];

const audionautsPostRevisingRedrafted = workflow(
  "aRwDA0qtQnjXR0sr",
  "BA - Audionauts Post Revising > Redrafted"
).settings({
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
  executionTimeout: 1800,
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) audionautsPostRevisingRedrafted.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  audionautsPostRevisingRedrafted.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default audionautsPostRevisingRedrafted;
