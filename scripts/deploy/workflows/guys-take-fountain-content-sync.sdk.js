import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow WMZ0Zpin1Stn9uF1, fetched 2026-11-02.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh WMZ0Zpin1Stn9uF1 guys-take-fountain-content-sync
const liveNodes = [
  {"id": "every-15", "name": "Every 15 Minutes", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.4, "position": [0, 768], "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": 15}]}}},
  {"id": "fetch-links", "name": "Fetch Publishing Links", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [224, 768], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl1xX0XpGeTfHMYc?pageSize=100", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "fetch-settings", "name": "Fetch Fountain Settings", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [448, 768], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblHj2gQ9qYhoQVuX?maxRecords=1&filterByFormula={{ encodeURIComponent('{Platform}=\"Fountain\"') }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "fetch-live-pubs", "name": "Fetch Live Publications", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [672, 768], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw?pageSize=100&filterByFormula={{ encodeURIComponent('AND({Platform Item ID}!=\"\",OR({Status}=\"Draft\",{Status}=\"Scheduled\",{Status}=\"Published\"))') }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "expand-pubs", "name": "Expand Live Publications", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [896, 768], "parameters": {"jsCode": "const rows = $input.first().json.records || [];\nreturn rows.map(row => {\n  const f = row.fields || {};\n  return { json: {\n    publicationRecordId: row.id,\n    publicationName: f.Publication || '',\n    platform: f.Platform || '',\n    status: f.Status || '',\n    itemId: f['Platform Item ID'] || '',\n    episodeRecordId: (f.Episode || [])[0] || '',\n    storedFingerprint: f['Content Fingerprint'] || '',\n    storedFileId: f['Frame.io File ID'] || '',\n    scheduledFor: f['Scheduled For'] || '',\n    syncApproved: f['Sync Approved'] === true,\n    approvedFingerprint: f['Approved Fingerprint'] || '',\n    syncStatus: f['Sync Status'] || '',\n    lastAttempt: f['Last Attempt'] || ''\n  } };\n}).filter(x => x.json.episodeRecordId && x.json.itemId && x.json.platform);"}},
  {"id": "load-episode", "name": "Load Episode", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1120, 768], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $json.episodeRecordId }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "load-thumb", "name": "Load Thumbnail Row", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [1344, 768], "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblkcASzE4DXlxokO/{{ ($json.fields?.Thumbnails || [])[0] }}", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "prepare-job", "name": "Prepare Update Job", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1568, 768], "parameters": {"mode": "runOnceForEachItem", "jsCode": "const job = $('Expand Live Publications').item.json;\nconst ep = $('Load Episode').item.json;\nconst fields = ep.fields || {};\nconst tf = $json.fields || {};\nconst art = (tf['1x1'] || [])[0] || {};\nconst links = ($('Fetch Publishing Links').first().json.records || []).map(r => r.fields || {});\nconst url = String(fields['Frame.io URL'] || '').trim();\nconst clean = url.split('?')[0].replace(/\\/+$/, '');\nconst currentFileId = clean ? clean.split('/').pop() : '';\nreturn { json: { ...job,\n  episodeId: fields.ID || 'no-id',\n  title: fields.Title || '',\n  summary: fields.Summary || '',\n  chapters: fields.Chapters || '',\n  episodeUrl: url,\n  currentFileId,\n  releaseDate: fields['Release Date'] || '',\n  episodeStatus: fields.Status || '',\n  artworkUrl: art.url || '',\n  artworkId: art.id || '',\n  artworkType: art.type || '',\n  artworkBytes: Number(art.size || 0),\n  artworkName: art.filename || 'artwork',\n  links\n} };"}},
  {"id": "route-platform", "name": "Route by Platform", "type": "n8n-nodes-base.switch", "typeVersion": 3.4, "position": [1792, 768], "parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "is-fountain", "leftValue": "={{ $json.platform }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "Fountain"}], "combinator": "and"}, "renameOutput": true, "outputKey": "Fountain"}]}, "options": {}}},
  {"id": "a8f36cf3-382d-4cc8-bf2a-5cd338db0777", "name": "Build Fountain Content", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.3, "position": [2016, 768], "onError": "continueErrorOutput", "parameters": {"mode": "each", "workflowId": {"__rl": true, "mode": "list", "value": "uSkbv5YFty7GLb2l", "cachedResultName": "BA - Subworkflow - Build Fountain Content"}, "options": {}}},
  {"id": "fingerprint", "name": "Compute Changes", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2240, 768], "parameters": {"mode": "runOnceForEachItem", "jsCode": "const j = $json;\nconst fnv1a = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };\nconst textHash = fnv1a(j.title + '\\u0000' + j.description);\nconst artHash = fnv1a(j.artworkId || j.artworkUrl);\nconst stored = String(j.storedFingerprint || '').split('.');\nconst needsText = textHash !== stored[0];\nconst needsArt = artHash !== stored[1];\nconst currentFileId = String(j.currentFileId || '');\nconst storedFileId = String(j.storedFileId || '');\nconst needsVideo = !!currentFileId && !!storedFileId && currentFileId !== storedFileId;\nconst videoUnknown = !!currentFileId && !storedFileId;\nconst nyDay = iso => { try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return ''; } };\nconst scheduledDay = j.scheduledFor ? nyDay(j.scheduledFor) : '';\nconst releaseDay = String(j.releaseDate || '').slice(0, 10);\n// A live item must never be re-scheduled, whatever the dates say.\nconst isPublished = String(j.status || '') === 'Published' || ['Published','Partially Published'].includes(String(j.episodeStatus || ''));\nconst needsDate = !!(scheduledDay && releaseDay && scheduledDay !== releaseDay) && !isPublished;\nconst changeHash = fnv1a([textHash, artHash, currentFileId, releaseDay].join('|'));\n// A long video upload holds the row in Syncing for up to ~80 minutes. Without\n// this guard every 15-minute tick would start another upload for the same row.\nconst lastAttemptMs = j.lastAttempt ? new Date(j.lastAttempt).getTime() : 0;\nconst runningFresh = String(j.syncStatus || '') === 'Syncing' && lastAttemptMs > 0 && (Date.now() - lastAttemptMs) < 3 * 60 * 60 * 1000;\nconst needsUpdate = (needsText || needsArt || needsVideo || needsDate) && !runningFresh;\nconst approved = j.syncApproved === true;\nconst approvalMatches = approved && String(j.approvedFingerprint || '') === changeHash;\nconst alreadyProposed = String(j.syncStatus || '') === 'Awaiting Approval' && String(j.approvedFingerprint || '') === changeHash;\n// \"Adopt\" means: take what is on Fountain as correct, record it as the new\n// baseline, and stop asking. Set Sync Status = 'Adopt Requested' to request it.\nconst adopt = String(j.syncStatus || '') === 'Adopt Requested';\nconst changes = [];\nif (needsText) changes.push('title and description');\nif (needsArt) changes.push('1x1 artwork');\nif (needsVideo) changes.push('video file');\nif (needsDate) changes.push('release date');\nreturn { json: Object.assign({}, j, { textHash, artHash, fingerprint: textHash + '.' + artHash, needsText, needsArt, needsVideo, videoUnknown, needsDate, scheduledDay, releaseDay, changeHash, needsUpdate, approved, approvalMatches, alreadyProposed, runningFresh, adopt, isPublished, changes }) };"}},
  {"id": "content-changed", "name": "Content Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [2464, 768], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "needs-update", "leftValue": "={{ $json.needsUpdate }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}}], "combinator": "and"}, "options": {}}},
  {"id": "patch-item", "name": "Update Fountain Item", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [2688, 768], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "=https://api.fountain.fm/v1/feeds/{{ $('Fetch Fountain Settings').first().json.records[0].fields['Feed ID'] }}/items/{{ $('Compute Changes').item.json.itemId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { title: $('Compute Changes').item.json.title, description: $('Compute Changes').item.json.description } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "art-changed", "name": "Artwork Changed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [2912, 688], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "needs-art", "leftValue": "={{ $('Compute Changes').item.json.needsArt }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}}], "combinator": "and"}, "options": {}}},
  {"id": "c5000000-0000-4000-8000-000000000030", "name": "Adopt Requested?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [3060, 900], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "adopt", "leftValue": "={{ $json.adopt }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "start-art", "name": "Start Fountain Artwork Upload", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [3136, 784], "onError": "continueErrorOutput", "parameters": {"method": "POST", "url": "https://api.fountain.fm/v1/uploads", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { kind: 'ITEM_IMAGE', feed_id: $('Fetch Fountain Settings').first().json.records[0].fields['Feed ID'], item_id: $('Compute Changes').item.json.itemId, content_type: $('Compute Changes').item.json.artworkType, num_bytes: $('Compute Changes').item.json.artworkBytes } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "c5000000-0000-4000-8000-000000000031", "name": "Adopt Baselines", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [3280, 1040], "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Compute Changes').item.json.publicationRecordId, fields: { 'Content Fingerprint': $('Compute Changes').item.json.fingerprint, 'Frame.io File ID': $('Compute Changes').item.json.currentFileId, 'Sync Approved': false, 'Sync Status': 'Synced' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "download-art", "name": "Download Artwork", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [3360, 720], "onError": "continueErrorOutput", "parameters": {"url": "={{ $('Fountain Content Fingerprint').item.json.artworkUrl }}", "options": {"response": {"response": {"responseFormat": "file"}}, "timeout": 120000}}},
  {"id": "c5000000-0000-4000-8000-000000000001", "name": "Approved?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [3500, 768], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "approval-matches", "leftValue": "={{ $json.approvalMatches }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "c5000000-0000-4000-8000-000000000032", "name": "Notify Adopted", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [3500, 1040], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "6a628a5d-067d-4a7b-851f-663063ff41eb", "parameters": {"chatId": "-5254203539", "text": "=👍 <b>Sync ignored for this episode</b>\n\n<code>{{ $('Compute Changes').item.json.episodeId }}</code>\nWhat is on Fountain is now recorded as correct, so it will not ask again. Future changes will still be offered.\n\n⚙️ <code>{{ $workflow.id }}</code> · exec <code>{{ $execution.id }}</code>", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "upload-art", "name": "Upload Artwork Part", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [3584, 640], "onError": "continueErrorOutput", "parameters": {"method": "PUT", "url": "={{ $('Start Fountain Artwork Upload').item.json.upload.urls[0] }}", "sendBody": true, "contentType": "binaryData", "inputDataFieldName": "data", "options": {"timeout": 120000}}},
  {"id": "c5000000-0000-4000-8000-00000000000f", "name": "Mark Syncing", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [3720, 540], "onError": "continueRegularOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $json.publicationRecordId, fields: { 'Sync Status': 'Syncing', 'Last Attempt': $now.toISO() } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "c5000000-0000-4000-8000-000000000002", "name": "Already Proposed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [3720, 960], "parameters": {"conditions": {"options": {"version": 3, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "already-proposed", "leftValue": "={{ $json.alreadyProposed }}", "operator": {"type": "boolean", "operation": "true", "singleValue": true}, "rightValue": ""}], "combinator": "and"}, "options": {}}},
  {"id": "finalize-art", "name": "Finalize Fountain Artwork", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [3808, 576], "onError": "continueErrorOutput", "parameters": {"method": "POST", "url": "=https://api.fountain.fm/v1/uploads/{{ $('Start Fountain Artwork Upload').item.json.media.id }}/finalize", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "c5000000-0000-4000-8000-000000000003", "name": "Mark Awaiting Approval", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [3940, 1160], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Compute Changes').item.json.publicationRecordId, fields: { 'Sync Status': 'Awaiting Approval', 'Approved Fingerprint': $('Compute Changes').item.json.changeHash } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "wait-art", "name": "Wait for Fountain Artwork", "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "position": [4032, 496], "webhookId": "b7c1f0a2-3d4e-4f56-8a9b-0c1d2e3f4a5b", "parameters": {"amount": "={{ Number((($('Fetch Fountain Settings').first().json.records || [])[0]?.fields?.['Upload Poll Seconds']) || 30) }}"}},
  {"id": "c5000000-0000-4000-8000-000000000004", "name": "Notify Proposal", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [4160, 1160], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "53b44372-4dd6-4034-9e8d-3f97267c58a2", "parameters": {"chatId": "-5254203539", "text": "=📝 <b>Fountain needs updating</b>\n\n<code>{{ $('Compute Changes').item.json.episodeId }}</code>\n<b>{{ $('Compute Changes').item.json.title }}</b>\n\nChanged since Fountain was given this episode:\n✅ {{ ($('Compute Changes').item.json.changes || []).join(' — ✅ ') }}\n\nNothing has been sent. Reply <i>approve sync</i> and the bot will tick Sync Approved, or tick it on the Publication row yourself.\n\n⚙️ <code>{{ $workflow.id }}</code> · exec <code>{{ $execution.id }}</code>", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}},
  {"id": "get-art", "name": "Get Fountain Artwork Status", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [4256, 400], "onError": "continueErrorOutput", "retryOnFail": true, "maxTries": 5, "waitBetweenTries": 5000, "parameters": {"url": "=https://api.fountain.fm/v1/uploads/{{ $('Start Fountain Artwork Upload').item.json.media.id }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "art-error", "name": "Fountain Artwork Error", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [4480, 336], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "art-error-status", "leftValue": "={{ $json.media.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "ERROR"}], "combinator": "and"}, "options": {}}},
  {"id": "art-ready", "name": "Fountain Artwork Ready", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [4704, 256], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "art-ready-status", "leftValue": "={{ $json.media.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "READY"}], "combinator": "and"}, "options": {}}},
  {"id": "patch-image", "name": "Update Fountain Item Image", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.5, "position": [4928, 256], "onError": "continueErrorOutput", "parameters": {"method": "PATCH", "url": "=https://api.fountain.fm/v1/feeds/{{ $('Fetch Fountain Settings').first().json.records[0].fields['Feed ID'] }}/items/{{ $('Fountain Content Fingerprint').item.json.itemId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { image_id: $('Start Fountain Artwork Upload').item.json.media.id } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "c5000000-0000-4000-8000-00000000000e", "name": "Mark Sync Failed", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [5280, 620], "onError": "continueRegularOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Compute Changes').first().json.publicationRecordId, fields: { 'Sync Approved': false, 'Sync Status': 'Failed' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "c5000000-0000-4000-8000-000000000020", "name": "Build Apply Request", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [5300, 760], "parameters": {"jsCode": "const s = $('Compute Changes').item.json;\nconst settings = (($('Fetch Fountain Settings').first().json.records || [])[0] || {}).fields || {};\nreturn { json: Object.assign({}, s, { fountainSettings: settings }) };"}},
  {"id": "build-failure", "name": "Build Failure", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [5376, 784], "parameters": {"jsCode": "const item = $input.first().json || {};\nconst err = item.error;\nconst candidates = [ typeof err === 'string' ? err : null, err && err.message, err && err.description, item.message ];\nconst message = String(candidates.find(v => typeof v === 'string' && v.trim()) || 'Unknown content sync error');\nconst esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\nlet episodeId = 'no-id';\ntry { episodeId = $('Prepare Update Job').first().json.episodeId || 'no-id'; } catch {}\nconst executionId = String($execution.id || 'unknown');\nreturn [{ json: { telegramText: '<b>Fountain content sync failed - needs attention</b>\\n\\n<code>' + esc(episodeId) + '</code>\\n\\n<b>Reason:</b> ' + esc(message).slice(0, 1800) + '\\n<b>Execution:</b> <code>' + esc(executionId) + '</code>' } }];"}},
  {"id": "c5000000-0000-4000-8000-000000000021", "name": "Apply Fountain Sync", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [5520, 760], "onError": "continueRegularOutput", "parameters": {"mode": "each", "workflowId": {"__rl": true, "mode": "list", "value": "G1N3gUA2CUa8Q5sF", "cachedResultName": "BA - Subworkflow - Apply Fountain Sync"}, "options": {}}},
  {"id": "notify-failure", "name": "Notify Failure", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [5600, 784], "retryOnFail": true, "maxTries": 4, "waitBetweenTries": 5000, "webhookId": "5644bb63-cce1-45d0-a078-ea2ac038a75c", "parameters": {"chatId": "-5254203539", "text": "={{ $('Build Failure').first().json.telegramText }}", "additionalFields": {"appendAttribution": false, "parse_mode": "HTML"}}, "credentials": {"telegramApi": {"id": "INjDc84OskDdqiNR", "name": "Telegram [pod21_n8n_agent_bot]"}}}
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
  ['Every 15 Minutes', 0, 'Fetch Publishing Links'],
  ['Fetch Publishing Links', 0, 'Fetch Fountain Settings'],
  ['Fetch Fountain Settings', 0, 'Fetch Live Publications'],
  ['Fetch Live Publications', 0, 'Expand Live Publications'],
  ['Expand Live Publications', 0, 'Load Episode'],
  ['Load Episode', 0, 'Load Thumbnail Row'],
  ['Load Thumbnail Row', 0, 'Prepare Update Job'],
  ['Prepare Update Job', 0, 'Route by Platform'],
  ['Update Fountain Item', 0, 'Artwork Changed?'],
  ['Update Fountain Item', 1, 'Build Failure'],
  ['Artwork Changed?', 0, 'Start Fountain Artwork Upload'],
  ['Artwork Changed?', 1, 'Build Apply Request'],
  ['Start Fountain Artwork Upload', 0, 'Download Artwork'],
  ['Start Fountain Artwork Upload', 1, 'Build Failure'],
  ['Download Artwork', 0, 'Upload Artwork Part'],
  ['Download Artwork', 1, 'Build Failure'],
  ['Upload Artwork Part', 0, 'Finalize Fountain Artwork'],
  ['Upload Artwork Part', 1, 'Build Failure'],
  ['Finalize Fountain Artwork', 0, 'Wait for Fountain Artwork'],
  ['Finalize Fountain Artwork', 1, 'Build Failure'],
  ['Wait for Fountain Artwork', 0, 'Get Fountain Artwork Status'],
  ['Get Fountain Artwork Status', 0, 'Fountain Artwork Error'],
  ['Get Fountain Artwork Status', 1, 'Build Failure'],
  ['Fountain Artwork Error', 0, 'Build Failure'],
  ['Fountain Artwork Error', 1, 'Fountain Artwork Ready'],
  ['Fountain Artwork Ready', 0, 'Update Fountain Item Image'],
  ['Fountain Artwork Ready', 1, 'Wait for Fountain Artwork'],
  ['Update Fountain Item Image', 0, 'Build Apply Request'],
  ['Update Fountain Item Image', 1, 'Build Failure'],
  ['Route by Platform', 0, 'Build Fountain Content'],
  ['Build Fountain Content', 0, 'Compute Changes'],
  ['Build Fountain Content', 1, 'Build Failure'],
  ['Content Changed?', 0, 'Approved?'],
  ['Approved?', 0, 'Mark Syncing'],
  ['Approved?', 1, 'Already Proposed?'],
  ['Already Proposed?', 1, 'Mark Awaiting Approval'],
  ['Mark Awaiting Approval', 0, 'Notify Proposal'],
  ['Mark Awaiting Approval', 1, 'Build Failure'],
  ['Build Failure', 0, 'Mark Sync Failed'],
  ['Mark Sync Failed', 0, 'Notify Failure'],
  ['Mark Syncing', 0, 'Update Fountain Item'],
  ['Build Apply Request', 0, 'Apply Fountain Sync'],
  ['Compute Changes', 0, 'Adopt Requested?'],
  ['Adopt Requested?', 0, 'Adopt Baselines'],
  ['Adopt Requested?', 1, 'Content Changed?'],
  ['Adopt Baselines', 0, 'Notify Adopted']
];

const guysTakeFountainContentSync = workflow(
  "WMZ0Zpin1Stn9uF1",
  "BA - Schedule Every 15m > Publication Content Synced"
).settings({
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
  executionTimeout: 7200,
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  binaryMode: "separate",
  availableInMCP: true
});

for (const live of liveNodes) guysTakeFountainContentSync.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  guysTakeFountainContentSync.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default guysTakeFountainContentSync;
