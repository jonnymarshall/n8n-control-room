import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow AXQhgidSnT7LMRRh, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh AXQhgidSnT7LMRRh approval-handler
const liveNodes = [
  {"id": "dfeaf659-70a4-4ac4-ba12-b719bddec5cc", "name": "Sticky Note d666173d", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [100, 300], "parameters": {"content": "## Pod21 Approval Handler", "color": 5}},
  {"id": "a549cc8c-922b-42a3-9ae3-1e8a5b0a0911", "name": "On Telegram Callback", "type": "n8n-nodes-base.telegramTrigger", "typeVersion": 1.2, "position": [240, 300], "webhookId": "6b3f4e21-5998-4d52-a610-dbbb54732c4c", "parameters": {"updates": ["callback_query"], "additionalFields": {"chatIds": "1512868522"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "5d948490-c9a6-41cc-9ce0-4130e05a76b0", "name": "Parse Callback Data", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 300], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const update = $input.first().json;\nconst cb = update.callback_query;\nif (!cb) {\n  return [{ json: { error: 'No callback_query', skip: true }}];\n}\nconst data = cb.data || '';\nconst parts = data.split(':');\nconst action = parts[0];\nconst target = parts[1];\nconst articleId = parts[2] || '';\n\nreturn [{ json: {\n  action, target, articleId,\n  callback_query_id: cb.id,\n  chat_id: cb.message.chat.id,\n  message_id: cb.message.message_id,\n}}];"}},
  {"id": "9d3ba947-98b9-4ac3-aae3-c645ffafd467", "name": "Route by Action", "type": "n8n-nodes-base.switch", "typeVersion": 3.2, "position": [640, 300], "parameters": {"mode": "rules", "rules": {"values": [{"conditions": {"conditions": [{"id": "r1", "leftValue": "={{ $json.action }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "review"}]}, "outputKey": "review"}, {"conditions": {"conditions": [{"id": "r2", "leftValue": "={{ $json.action }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "approve"}]}, "outputKey": "approve"}, {"conditions": {"conditions": [{"id": "r3", "leftValue": "={{ $json.action }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "reject"}]}, "outputKey": "reject"}]}}},
  {"id": "996492fb-d3fb-4e83-bece-3bfa7ed9ca62", "name": "Find Pending Drafts", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [840, 120], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "filterByFormula": "={AND(ARRAYJOIN(article)='{{ $json.articleId }}', platform='{{ $json.target }}', status='pending')}", "returnAll": true}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "3cba4090-49ba-484e-83e0-a9a4eae5913b", "name": "Fetch Draft (Approve)", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [840, 300], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "get", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "id": "={{ $json.target }}"}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "52970f14-0ff9-4af4-a385-607164338a92", "name": "Mark Rejected", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [840, 500], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $json.target }}", "status": "rejected"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a0a6ea9d-0ac2-4c83-a3bb-4ea9f7b56b05", "name": "Format Draft Display", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1040, 120], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const item = $input.first().json;\nconst drafts = $input.all().map(i => i.json);\nconst parsed = $('Parse Callback Data').first().json;\nconst platform = parsed.target;\n\nif (drafts.length === 0 || !drafts[0].fields) {\n  return [{ json: { display: 'No pending drafts for this article + platform.', noDraft: true, articleId: parsed.articleId, platform }}];\n}\n\nconst draft = drafts[0];\nconst fields = draft.fields;\nlet display = '';\n\nif (platform === 'x_thread') {\n  let tweets;\n  try { tweets = JSON.parse(fields.content); } catch(e) { tweets = [fields.content]; }\n  display = 'X Thread (' + tweets.length + ' tweets):\\n\\n' + tweets.map((t, i) => (i+1) + '/ ' + t).join('\\n\\n');\n} else if (platform === 'tweet_candidate') {\n  const pendingCount = drafts.length;\n  display = 'Tweet ' + (10 - pendingCount + 1) + ' of 10:\\n\\n' + fields.content;\n} else {\n  display = (platform === 'linkedin' ? 'LinkedIn' : 'Instagram') + ' draft:\\n\\n' + fields.content;\n}\n\nif (display.length > 3800) display = display.slice(0, 3700) + '\\n\\n...[truncated, full draft in Airtable]';\n\nreturn [{ json: { display, draftId: draft.id, platform, articleId: parsed.articleId, noDraft: false }}];"}},
  {"id": "ff8fcd2f-a0a9-4614-91b5-5dde79da8053", "name": "Is Tweet Candidate?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1040, 300], "parameters": {"conditions": {"conditions": [{"id": "tc", "leftValue": "={{ $json.fields.platform }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "tweet_candidate"}]}}},
  {"id": "7a0260ad-d6ce-4f0a-87f2-6a5bc1dc680e", "name": "Fetch Rejected Draft Info", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1040, 500], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "get", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "id": "={{ $(\"Parse Callback Data\").first().json.target }}"}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "15dbffbd-6409-4605-8555-66936d20731b", "name": "Send Draft for Review", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1240, 120], "webhookId": "d7bdc4d0-5784-44f0-bcdd-8c483756e1fe", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "={{ $json.display }}", "replyMarkup": "inlineKeyboard", "inlineKeyboard": {"rows": [{"row": {"buttons": [{"text": "Approve", "additionalFields": {"callback_data": "=approve:{{ $json.draftId }}:{{ $json.articleId }}"}}, {"text": "Reject", "additionalFields": {"callback_data": "=reject:{{ $json.draftId }}:{{ $json.articleId }}"}}]}}]}, "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "5939b823-b00e-4f16-a98d-2d04c1f622c5", "name": "Find Existing Slots", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1240, 240], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "filterByFormula": "={status='queued'}", "returnAll": true}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "3fdae5b6-e3ef-450e-a0e2-2cc015913c2f", "name": "Mark Manual Pending", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1240, 380], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $(\"Parse Callback Data\").first().json.target }}", "status": "manual_pending"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "a4bd8d1f-324e-4ed9-b5ba-88000820c24e", "name": "Was Rejected a Tweet?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1240, 500], "parameters": {"conditions": {"conditions": [{"id": "rt", "leftValue": "={{ $json.fields.platform }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "tweet_candidate"}]}}},
  {"id": "5bd208c9-67af-4e42-a7e4-56790b9a47cf", "name": "Compute Next Slot", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1440, 240], "parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": "const draftId = $('Parse Callback Data').first().json.target;\nconst existing = $input.all().map(i => i.json).filter(r => r.fields && r.fields.scheduled_for);\n\nlet base;\nif (existing.length === 0) {\n  base = new Date();\n} else {\n  const maxDate = existing.reduce((max, r) => {\n    const d = new Date(r.fields.scheduled_for);\n    return d > max ? d : max;\n  }, new Date(0));\n  base = new Date(maxDate.getTime());\n}\n\nlet next = new Date(base.getTime() + 24*60*60*1000);\nwhile (next.getDay() === 0 || next.getDay() === 6) {\n  next = new Date(next.getTime() + 24*60*60*1000);\n}\nnext.setUTCHours(12, 0, 0, 0);\n\nreturn [{ json: {\n  draft_id: draftId,\n  scheduled_for: next.toISOString(),\n  status: 'queued',\n}}];"}},
  {"id": "b5c12d2d-9044-4222-b156-9b6d5b838102", "name": "Notify Manual Pending", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1440, 380], "webhookId": "c1fec5a8-fed1-4a24-9aa0-8bf3887790cb", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Approved (manual). Copy from Airtable Drafts row <b>{{ $json.id }}</b> and post to {{ $(\"Fetch Draft (Approve)\").first().json.fields.platform }} when ready.", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "e98edbbb-1ef5-476f-b9de-6589a8da59a2", "name": "Find Next After Reject", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1440, 460], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "filterByFormula": "={AND(ARRAYJOIN(article)='{{ $(\"Parse Callback Data\").first().json.articleId }}', platform='tweet_candidate', status='pending')}", "returnAll": false, "limit": 1}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "b3e112f7-589b-404a-a4b3-e816408482d3", "name": "Notify Rejected", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1440, 580], "webhookId": "03e1447c-0d1a-483b-90ef-e2f3aef41990", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "Rejected.", "additionalFields": {"appendAttribution": false}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "09f6ac65-6eb1-4c51-b1ac-a06d0fd60df4", "name": "Create Scheduled Tweet", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1640, 240], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "create", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "ScheduledTweets"}, "columns": {"mappingMode": "defineBelow", "value": {"draft": "={{ [$json.draft_id] }}", "scheduled_for": "={{ $json.scheduled_for }}", "status": "queued"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "90cea7a8-b39e-448e-a779-f85f10013bee", "name": "Has Next After Reject?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [1640, 460], "parameters": {"conditions": {"conditions": [{"id": "hn2", "leftValue": "={{ $json.id }}", "operator": {"type": "string", "operation": "notEmpty", "singleValue": true}}]}}},
  {"id": "3e97d23b-f189-461b-bca8-e33a703505c6", "name": "Mark Draft Approved", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1840, 240], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $(\"Parse Callback Data\").first().json.target }}", "status": "approved"}}, "options": {"typecast": true}}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "28d69533-c7ca-49cf-b9bf-3bbc479570da", "name": "Send Next After Reject", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1840, 400], "webhookId": "45926d86-79fe-4797-bf08-0711f1f461b9", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Next tweet:\n\n{{ $json.fields.content }}", "replyMarkup": "inlineKeyboard", "inlineKeyboard": {"rows": [{"row": {"buttons": [{"text": "Approve", "additionalFields": {"callback_data": "=approve:{{ $json.id }}:{{ $(\"Parse Callback Data\").first().json.articleId }}"}}, {"text": "Reject", "additionalFields": {"callback_data": "=reject:{{ $json.id }}:{{ $(\"Parse Callback Data\").first().json.articleId }}"}}]}}]}, "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "f9bc7d61-b20c-4a7d-8ea0-23dc171d201b", "name": "All Done After Reject", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1840, 540], "webhookId": "3c1527e5-e686-449a-95f6-cabd97febe92", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "All 10 tweets reviewed for this article.", "additionalFields": {"appendAttribution": false}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "cf38d6a1-36d9-4c56-8b9b-69e37c218e8c", "name": "Notify Tweet Queued", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2040, 240], "webhookId": "fa3cbad8-9077-4669-9352-95821ddfbc6e", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Tweet queued for {{ DateTime.fromISO($(\"Compute Next Slot\").first().json.scheduled_for).toFormat(\"ccc d LLL HH:mm\") }}.\n\nFetching next pending tweet...", "additionalFields": {"appendAttribution": false}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "21cc4545-e643-4638-ac09-fcacbf68ecd0", "name": "Find Next Pending Tweet", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [2240, 240], "parameters": {"authentication": "airtableTokenApi", "resource": "record", "operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "list", "value": "Drafts"}, "filterByFormula": "={AND(ARRAYJOIN(article)='{{ $(\"Parse Callback Data\").first().json.articleId }}', platform='tweet_candidate', status='pending')}", "returnAll": false, "limit": 1}, "credentials": {"airtableOAuth2Api": {"id": "65VKjfkEB2mkLQtR", "name": "Airtable"}, "airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "816875f1-947f-4913-95ba-ac840b667dcf", "name": "Has Next Tweet?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [2440, 240], "parameters": {"conditions": {"conditions": [{"id": "hn", "leftValue": "={{ $json.id }}", "operator": {"type": "string", "operation": "notEmpty", "singleValue": true}}]}}},
  {"id": "dc80f083-5db9-41fc-a69f-ce1311731bb6", "name": "Send Next Tweet", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2640, 180], "webhookId": "d9e06af1-faf2-4fc8-97dc-ddc4d35db0ba", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "=Next tweet:\n\n{{ $json.fields.content }}", "replyMarkup": "inlineKeyboard", "inlineKeyboard": {"rows": [{"row": {"buttons": [{"text": "Approve", "additionalFields": {"callback_data": "=approve:{{ $json.id }}:{{ $(\"Parse Callback Data\").first().json.articleId }}"}}, {"text": "Reject", "additionalFields": {"callback_data": "=reject:{{ $json.id }}:{{ $(\"Parse Callback Data\").first().json.articleId }}"}}]}}]}, "additionalFields": {"appendAttribution": false, "disable_web_page_preview": true}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "37e526cd-7510-4a18-bc7c-689d30caeee7", "name": "All Tweets Done", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [2640, 320], "webhookId": "7ebba544-c890-4433-8757-398e5d69902d", "parameters": {"resource": "message", "operation": "sendMessage", "chatId": "1512868522", "text": "All 10 tweets reviewed for this article.", "additionalFields": {"appendAttribution": false}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['On Telegram Callback', 0, 'Parse Callback Data'],
  ['Parse Callback Data', 0, 'Route by Action'],
  ['Route by Action', 0, 'Find Pending Drafts'],
  ['Route by Action', 1, 'Fetch Draft (Approve)'],
  ['Route by Action', 2, 'Mark Rejected'],
  ['Find Pending Drafts', 0, 'Format Draft Display'],
  ['Format Draft Display', 0, 'Send Draft for Review'],
  ['Fetch Draft (Approve)', 0, 'Is Tweet Candidate?'],
  ['Is Tweet Candidate?', 0, 'Find Existing Slots'],
  ['Is Tweet Candidate?', 1, 'Mark Manual Pending'],
  ['Find Existing Slots', 0, 'Compute Next Slot'],
  ['Compute Next Slot', 0, 'Create Scheduled Tweet'],
  ['Create Scheduled Tweet', 0, 'Mark Draft Approved'],
  ['Mark Draft Approved', 0, 'Notify Tweet Queued'],
  ['Notify Tweet Queued', 0, 'Find Next Pending Tweet'],
  ['Find Next Pending Tweet', 0, 'Has Next Tweet?'],
  ['Has Next Tweet?', 0, 'Send Next Tweet'],
  ['Has Next Tweet?', 1, 'All Tweets Done'],
  ['Mark Manual Pending', 0, 'Notify Manual Pending'],
  ['Mark Rejected', 0, 'Fetch Rejected Draft Info'],
  ['Fetch Rejected Draft Info', 0, 'Was Rejected a Tweet?'],
  ['Was Rejected a Tweet?', 0, 'Find Next After Reject'],
  ['Was Rejected a Tweet?', 1, 'Notify Rejected'],
  ['Find Next After Reject', 0, 'Has Next After Reject?'],
  ['Has Next After Reject?', 0, 'Send Next After Reject'],
  ['Has Next After Reject?', 1, 'All Done After Reject']
];

const approvalHandler = workflow(
  "AXQhgidSnT7LMRRh",
  "Pod21 \u2014 Approval Handler"
).settings({
  executionOrder: "v1",
  availableInMCP: true,
  binaryMode: "separate"
});

for (const live of liveNodes) approvalHandler.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  approvalHandler.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default approvalHandler;
