import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

// Snapshot of live workflow LTmRVKn9TWJd6Gtk, fetched 2026-09-24.
// Parameters and node settings are intentionally kept verbatim from live.
const liveNodes = [
  {
    id: 'ready-view-trigger', name: 'Ready for Publishing View', type: 'n8n-nodes-base.airtableTrigger', typeVersion: 1, position: [0, 300],
    parameters: { pollTimes: { item: [{ mode: 'everyMinute' }] }, authentication: 'airtableTokenApi', baseId: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" }, tableId: { __rl: true, mode: 'id', value: 'tbl3uYLIvtB9APZp6', cachedResultName: 'Episodes' }, triggerField: 'Last Modified Time', additionalFields: { viewId: 'viwDfPHHKrgggdw20' } },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'claim-episode', name: 'Claim Episode as Publishing', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [220, 300], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Ready for Publishing View').first().json.id, fields: { Status: 'Publishing' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'find-publication', name: 'Find Fountain Publication', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [440, 300], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw?maxRecords=1&filterByFormula={{ encodeURIComponent('AND({Publication}=\"' + (($('Ready for Publishing View').first().json.ID || $('Ready for Publishing View').first().json.fields?.ID || 'no-id')) + ' - Fountain\",{Platform}=\"Fountain\")') }}", authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'guard-publication', name: 'Guard Fountain Publication', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const trigger = $('Ready for Publishing View').first().json;\nconst f = trigger.fields || trigger;\nconst existing = ($input.first().json.records || [])[0] || null;\nconst fields = existing ? (existing.fields || {}) : {};\nconst status = fields.Status || '';\nconst canStart = !existing || status === 'Pending';\nconst restoreStatus = status === 'Published' ? 'Published' : ((status === 'Failed' || status === 'Needs Attention') ? 'Publishing Failed' : 'Scheduled');\nreturn [{ json: {\n  shouldRun: canStart,\n  episodeRecordId: trigger.id,\n  episodeId: f.ID || 'no-id',\n  publicationKey: (f.ID || 'no-id') + ' - Fountain',\n  existingPublicationId: existing ? existing.id : '',\n  existingStatus: status,\n  existingItemId: fields['Platform Item ID'] || '',\n  restoreStatus,\n  attemptCount: Number(fields['Attempt Count'] || 0) + (canStart ? 1 : 0)\n} }];" }
  },
  {
    id: 'should-run', name: 'Should Run Fountain', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [880, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'run-fountain', leftValue: '={{ $json.shouldRun }}', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }
  },
  {
    id: 'upsert-publication', name: 'Upsert Fountain Publication', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1100, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { performUpsert: { fieldsToMergeOn: ['Publication'] }, records: [{ fields: { Publication: $('Guard Fountain Publication').first().json.publicationKey, Episode: [$('Guard Fountain Publication').first().json.episodeRecordId], Platform: 'Fountain', Status: 'Uploading', 'Attempt Count': $('Guard Fountain Publication').first().json.attemptCount, 'Last Attempt': $now.toUTC().toISO(), Error: '', 'Raw Error': '' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'fetch-settings', name: 'Fetch Fountain Settings', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1320, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'GET', url: '=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblHj2gQ9qYhoQVuX?maxRecords=1&filterByFormula={{ encodeURIComponent(\'{Platform}="Fountain"\') }}', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'fetch-links', name: 'Fetch Publishing Links', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1540, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'GET', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl1xX0XpGeTfHMYc?pageSize=100', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'fetch-thumbnail', name: 'Fetch 1x1 Thumbnail', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1760, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'GET', url: "=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblkcASzE4DXlxokO/{{ (($('Ready for Publishing View').first().json.Thumbnails || $('Ready for Publishing View').first().json.fields?.Thumbnails || [])[0]?.id || ($('Ready for Publishing View').first().json.Thumbnails || $('Ready for Publishing View').first().json.fields?.Thumbnails || [])[0]) }}", authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'build-plan', name: 'Build Fountain Plan', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1980, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const trigger = $('Ready for Publishing View').first().json;\nconst f = trigger.fields || trigger;\nconst settingsRec = (($('Fetch Fountain Settings').first().json.records || [])[0] || {});\nconst settings = settingsRec.fields || {};\nconst links = ($('Fetch Publishing Links').first().json.records || [])\n  .map(r => r.fields || {})\n  .filter(x => x.Active === true && (!Array.isArray(x.Destinations) || x.Destinations.includes('Episodes')));\nconst thumbFields = $('Fetch 1x1 Thumbnail').first().json.fields || $('Fetch 1x1 Thumbnail').first().json;\nconst artwork = ((thumbFields['1x1'] || [])[0] || {});\nconst required = {\n  title: f.Title,\n  summary: f.Summary,\n  chapters: f.Chapters,\n  releaseDate: f['Release Date'],\n  videoUrl: f['Frame.io URL'],\n  artworkUrl: artwork.url,\n  feedId: settings['Feed ID'],\n  publishTime: settings['Default Publish Time'],\n  timeZone: settings['Time Zone']\n};\nconst missing = Object.entries(required).filter(([,v]) => !v).map(([k]) => k);\nif (!settingsRec.id) missing.push('Fountain settings row');\nif (settings.Enabled !== true) missing.push('Fountain Enabled checkbox');\nif (missing.length) throw new Error('Fountain preflight failed. Missing or disabled: ' + missing.join(', '));\nif (!/^\\d{2}:\\d{2}$/.test(required.publishTime)) throw new Error('Default Publish Time must use HH:mm, for example 09:00.');\nconst [year, month, day] = String(required.releaseDate).slice(0,10).split('-').map(Number);\nconst [hour, minute] = required.publishTime.split(':').map(Number);\nconst scheduled = $now.setZone(required.timeZone).set({ year, month, day, hour, minute, second: 0, millisecond: 0 });\nif (!scheduled.isValid) throw new Error('Release Date, Default Publish Time, or Time Zone is invalid.');\nif (scheduled <= $now) throw new Error('Fountain schedule time must be in the future. Update Release Date or Publishing Settings.');\nconst bySection = section => links.filter(x => x.Section === section).sort((a,b) => Number(a['Sort Order'] || 0) - Number(b['Sort Order'] || 0));\nconst line = x => '- ' + String(x.Description || x.Name || '').trim() + ' (Link: <' + x.URL + '>)';\nconst parts = [String(required.summary).trim(), '**Chapters**', String(required.chapters).trim()];\nconst affiliates = bySection('Affiliate');\nconst hosts = bySection('Host');\nif (affiliates.length) parts.push('**Affiliate Links**', affiliates.map(line).join('\\n'));\nif (hosts.length) parts.push('**Host Links**', hosts.map(line).join('\\n'));\nconst description = parts.join('\\n\\n');\nif (description.length > 9000) throw new Error('Formatted Fountain description is over the 9,000-character safety limit.');\nconst source = [required.title, description, required.videoUrl, required.artworkUrl, scheduled.toUTC().toISO()].join('|');\nlet hash = 2166136261;\nfor (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }\nreturn [{ json: {\n  episodeRecordId: trigger.id,\n  episodeId: f.ID || 'no-id',\n  title: required.title,\n  description,\n  videoUrl: required.videoUrl,\n  artworkUrl: required.artworkUrl,\n  artworkFileName: artwork.filename || 'episode-square.jpg',\n  feedId: required.feedId,\n  scheduledFor: scheduled.toUTC().toISO(),\n  explicit: settings.Explicit === true,\n  itemId: $('Guard Fountain Publication').first().json.existingItemId || '',\n  publicationRecordId: $('Upsert Fountain Publication').first().json.records[0].id,\n  fingerprint: (hash >>> 0).toString(16).padStart(8, '0')\n} }];" }
  },
  {
    id: 'save-plan', name: 'Save Fountain Plan', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [2200, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.publicationRecordId, fields: { 'Formatted Description': $('Build Fountain Plan').first().json.description, 'Scheduled For': $('Build Fountain Plan').first().json.scheduledFor, 'Source Fingerprint': $('Build Fountain Plan').first().json.fingerprint } }] } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'b179f5bc-f273-4a8b-b938-d0f654118020', name: 'Resolve Frame.io Media', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [2420, 60], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'GET', url: "=https://api.frame.io/v4/accounts/b4480b8c-6815-4eed-8198-d33593ab21c3/files/{{ (($('Build Fountain Plan').first().json.videoUrl || '').split('?')[0]).split('/').filter(Boolean).pop() }}", authentication: 'genericCredentialType', genericAuthType: 'oAuth2Api', sendQuery: true, queryParameters: { parameters: [{ name: 'include', value: 'media_links.efficient,media_links.original' }] }, options: { timeout: 120000 } },
    credentials: { oAuth2Api: { id: '1rXdRm0N6eNzG5cV', name: 'Adobe OAuth' } }
  },
  {
    id: 'probe-video', name: 'Probe Frame.io Video', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [2420, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'HEAD', url: "={{ ($json.data.media_links.original || {}).download_url || ($json.data.media_links.efficient || {}).download_url }}", options: { response: { response: { fullResponse: true } }, timeout: 120000 } }
  },
  {
    id: 'probe-artwork', name: 'Probe Square Artwork', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [2640, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'HEAD', url: "={{ $('Build Fountain Plan').first().json.artworkUrl }}", options: { response: { response: { fullResponse: true } }, timeout: 120000 } }
  },
  {
    id: 'validate-media', name: 'Validate Fountain Media', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2860, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const videoHeaders = $('Probe Frame.io Video').first().json.headers || {};\nconst imageHeaders = $('Probe Square Artwork').first().json.headers || {};\nconst videoBytes = Number(videoHeaders['content-length']);\nconst imageBytes = Number(imageHeaders['content-length']);\nconst videoType = String(videoHeaders['content-type'] || '').split(';')[0].trim().toLowerCase();\nconst imageType = String(imageHeaders['content-type'] || '').split(';')[0].trim().toLowerCase();\nconst allowedVideo = ['video/mp4','video/quicktime','video/webm'];\nconst allowedImage = ['image/jpeg','image/png','image/webp'];\nif (!Number.isFinite(videoBytes) || videoBytes <= 0) throw new Error('Frame.io video URL did not return a valid Content-Length header.');\nif (!Number.isFinite(imageBytes) || imageBytes <= 0) throw new Error('Square artwork URL did not return a valid Content-Length header.');\nif (!allowedVideo.includes(videoType)) throw new Error('Unsupported Fountain video MIME type: ' + (videoType || 'missing'));\nif (!allowedImage.includes(imageType)) throw new Error('Unsupported Fountain artwork MIME type: ' + (imageType || 'missing'));\nif (videoBytes > 20000000000) throw new Error('Video is larger than the Fountain 20 GB limit.');\nif (imageBytes > 10000000) throw new Error('Square artwork is larger than the Fountain 10 MB limit.');\nconst resolvedVideoUrl = (($('Resolve Frame.io Media').first().json.data?.media_links?.original || {}).download_url) || (($('Resolve Frame.io Media').first().json.data?.media_links?.efficient || {}).download_url) || '';\nif (!resolvedVideoUrl) throw new Error('Could not resolve a downloadable Frame.io video URL for the Fountain upload.');\nreturn [{ json: { ...$('Build Fountain Plan').first().json, videoUrl: resolvedVideoUrl, videoBytes, imageBytes, videoType, imageType } }];" }
  },
  {
    id: 'has-item', name: 'Has Fountain Item ID', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [3080, 220],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'has-item-id', leftValue: '={{ $json.itemId }}', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' }, options: {} }
  },
  { id: 'reuse-item', name: 'Reuse Fountain Draft', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3300, 120], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { itemId: $('Validate Fountain Media').first().json.itemId } }];" } },
  {
    id: 'create-item', name: 'Create Fountain Draft', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [3300, 320], onError: 'continueErrorOutput',
    parameters: { method: 'POST', url: "=https://api.fountain.fm/v1/feeds/{{ $('Validate Fountain Media').first().json.feedId }}/items", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: { timeout: 120000 } },
    credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } }
  },
  {
    id: 'capture-item', name: 'Capture Fountain Item', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3520, 320], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const itemId = $input.first().json.item?.id;\nif (!itemId) throw new Error('Fountain create-item response did not include item.id. Before retrying, list the newest Fountain drafts and check whether the timed-out request created one.');\nreturn [{ json: { itemId } }];" }
  },
  {
    id: 'persist-item', name: 'Persist Fountain Item ID', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [3740, 320], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.publicationRecordId, fields: { 'Platform Item ID': $('Capture Fountain Item').first().json.itemId, Status: 'Draft' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'item-context', name: 'Resolve Fountain Item', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3960, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const reused = $('Reuse Fountain Draft').isExecuted ? $('Reuse Fountain Draft').first().json.itemId : '';\nconst created = $('Capture Fountain Item').isExecuted ? $('Capture Fountain Item').first().json.itemId : '';\nconst itemId = reused || created;\nif (!itemId) throw new Error('No Fountain item ID is available.');\nreturn [{ json: { ...$('Validate Fountain Media').first().json, itemId } }];" }
  },
  {
    id: 'start-video', name: 'Start Fountain Video Upload', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [4180, 220], onError: 'continueErrorOutput',
    parameters: { method: 'POST', url: 'https://api.fountain.fm/v1/uploads', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { kind: 'ITEM_VIDEO', feed_id: $('Resolve Fountain Item').first().json.feedId, item_id: $('Resolve Fountain Item').first().json.itemId, content_type: $('Resolve Fountain Item').first().json.videoType, access: 'DEFAULT', num_bytes: $('Resolve Fountain Item').first().json.videoBytes } }}", options: { timeout: 120000 } },
    credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } }
  },
  {
    id: 'video-jobs', name: 'Build Video Part Jobs', type: 'n8n-nodes-base.code', typeVersion: 2, position: [4400, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const response = $input.first().json;\nconst mediaId = response.media?.id;\nconst urls = response.upload?.urls || [];\nconst partSize = Number(response.upload?.part_size);\nconst plan = $('Resolve Fountain Item').first().json;\nif (!mediaId || !urls.length || !partSize) throw new Error('Fountain did not return video multipart upload URLs.');\nfunction shellQuote(value) { return \"'\" + String(value).replace(/'/g, \"'\\\"'\\\"'\") + \"'\"; }\nconst uploader = `(async () => {\n  const { SRC, DEST, START, END } = process.env;\n  const len = Number(END) - Number(START) + 1;\n  const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));\n  const once = async () => {\n    const source = await fetch(SRC, { headers: { Range: 'bytes=' + START + '-' + END } });\n    if (!source.ok && source.status !== 206) throw new Error('source responded ' + source.status);\n    const body = Buffer.from(await source.arrayBuffer());\n    if (body.length !== len) throw new Error('range length ' + body.length + ' != ' + len);\n    const target = await fetch(DEST, { method: 'PUT', body, headers: { 'Content-Length': String(body.length) } });\n    if (!target.ok) throw new Error('target responded ' + target.status);\n  };\n  for (let attempt = 1; attempt <= 20; attempt++) {\n    try { await once(); process.exit(0); }\n    catch (error) {\n      if (attempt === 20) { console.error(String((error && error.message) || error)); process.exit(1); }\n      await sleep(attempt < 6 ? Math.pow(2, attempt) : 60);\n    }\n  }\n})();`;\nreturn urls.map((url, index) => {\n  const start = index * partSize;\n  const end = Math.min(plan.videoBytes - 1, start + partSize - 1);\n  const command = 'SRC=' + shellQuote(plan.videoUrl) + ' DEST=' + shellQuote(url) + ' START=' + start + ' END=' + end + ' node -e ' + shellQuote(uploader);\n  return { json: { uploadId: mediaId, partNumber: index + 1, totalParts: urls.length, command } };\n});" }
  },
  { id: 'upload-video-parts', name: 'Upload Fountain Video Parts', type: 'n8n-nodes-base.executeCommand', typeVersion: 1, position: [4620, 220], onError: 'continueErrorOutput', parameters: { command: '={{ $json.command }}', executeOnce: false } },
  {
    id: 'collapse-video', name: 'Confirm Video Parts Uploaded', type: 'n8n-nodes-base.code', typeVersion: 2, position: [4840, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const uploadId = $('Build Video Part Jobs').first().json.uploadId;\nconst expected = $('Build Video Part Jobs').all().length;\nconst completed = $input.all().length;\nif (!uploadId || completed !== expected) throw new Error(`Only ${completed} of ${expected} Fountain video parts completed.`);\nreturn [{ json: { uploadId } }];" }
  },
  {
    id: 'save-video-id', name: 'Save Fountain Video Upload ID', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [5060, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.publicationRecordId, fields: { 'Video Upload ID': $('Confirm Video Parts Uploaded').first().json.uploadId, Status: 'Processing' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  { id: 'finalize-video', name: 'Finalize Fountain Video', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [5280, 220], onError: 'continueErrorOutput', parameters: { method: 'POST', url: "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Video Parts Uploaded').first().json.uploadId }}/finalize", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: { timeout: 120000 } }, credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } } },
  { id: 'wait-video', name: 'Wait for Fountain Video', type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [5500, 220], webhookId: '1906d199-473a-4485-9079-41a5d4986dbb', parameters: { resume: 'timeInterval', amount: "={{ Number((($('Fetch Fountain Settings').first().json.records || [])[0]?.fields?.['Upload Poll Seconds']) || 30) }}", unit: 'seconds' } },
  { id: 'get-video', name: 'Get Fountain Video Status', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [5720, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput', parameters: { method: 'GET', url: "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Video Parts Uploaded').first().json.uploadId }}", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: { timeout: 120000 } }, credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } } },
  { id: 'video-error', name: 'Fountain Video Error', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [5940, 220], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'video-error-status', leftValue: '={{ $json.media.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'ERROR' }], combinator: 'and' }, options: {} } },
  { id: 'throw-video-error', name: 'Stop on Fountain Video Error', type: 'n8n-nodes-base.code', typeVersion: 2, position: [6160, 120], onError: 'continueErrorOutput', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "throw new Error('Fountain video processing failed: ' + ($input.first().json.media?.error || 'Unknown Fountain error'));\nreturn [];" } },
  { id: 'video-ready', name: 'Fountain Video Ready', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [6160, 280], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'video-ready-status', leftValue: '={{ $json.media.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'READY' }], combinator: 'and' }, options: {} } },
  {
    id: 'start-artwork', name: 'Start Fountain Artwork Upload', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [6380, 220], onError: 'continueErrorOutput',
    parameters: { method: 'POST', url: 'https://api.fountain.fm/v1/uploads', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { kind: 'ITEM_IMAGE', feed_id: $('Resolve Fountain Item').first().json.feedId, item_id: $('Resolve Fountain Item').first().json.itemId, content_type: $('Resolve Fountain Item').first().json.imageType, num_bytes: $('Resolve Fountain Item').first().json.imageBytes } }}", options: { timeout: 120000 } },
    credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } }
  },
  {
    id: 'artwork-jobs', name: 'Build Artwork Part Jobs', type: 'n8n-nodes-base.code', typeVersion: 2, position: [6600, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const response = $input.first().json;\nconst mediaId = response.media?.id;\nconst urls = response.upload?.urls || [];\nconst partSize = Number(response.upload?.part_size);\nconst plan = $('Resolve Fountain Item').first().json;\nif (!mediaId || !urls.length || !partSize) throw new Error('Fountain did not return artwork multipart upload URLs.');\nfunction shellQuote(value) { return \"'\" + String(value).replace(/'/g, \"'\\\"'\\\"'\") + \"'\"; }\nconst uploader = `(async () => {\n  const { SRC, DEST, START, END } = process.env;\n  const len = Number(END) - Number(START) + 1;\n  const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));\n  const once = async () => {\n    const source = await fetch(SRC, { headers: { Range: 'bytes=' + START + '-' + END } });\n    if (!source.ok && source.status !== 206) throw new Error('source responded ' + source.status);\n    const body = Buffer.from(await source.arrayBuffer());\n    if (body.length !== len) throw new Error('range length ' + body.length + ' != ' + len);\n    const target = await fetch(DEST, { method: 'PUT', body, headers: { 'Content-Length': String(body.length) } });\n    if (!target.ok) throw new Error('target responded ' + target.status);\n  };\n  for (let attempt = 1; attempt <= 20; attempt++) {\n    try { await once(); process.exit(0); }\n    catch (error) {\n      if (attempt === 20) { console.error(String((error && error.message) || error)); process.exit(1); }\n      await sleep(attempt < 6 ? Math.pow(2, attempt) : 60);\n    }\n  }\n})();`;\nreturn urls.map((url, index) => {\n  const start = index * partSize;\n  const end = Math.min(plan.imageBytes - 1, start + partSize - 1);\n  const command = 'SRC=' + shellQuote(plan.artworkUrl) + ' DEST=' + shellQuote(url) + ' START=' + start + ' END=' + end + ' node -e ' + shellQuote(uploader);\n  return { json: { uploadId: mediaId, partNumber: index + 1, totalParts: urls.length, command } };\n});" }
  },
  { id: 'upload-artwork-parts', name: 'Upload Fountain Artwork Parts', type: 'n8n-nodes-base.executeCommand', typeVersion: 1, position: [6820, 220], onError: 'continueErrorOutput', parameters: { command: '={{ $json.command }}', executeOnce: false } },
  {
    id: 'collapse-artwork', name: 'Confirm Artwork Parts Uploaded', type: 'n8n-nodes-base.code', typeVersion: 2, position: [7040, 220], onError: 'continueErrorOutput',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const uploadId = $('Build Artwork Part Jobs').first().json.uploadId;\nconst expected = $('Build Artwork Part Jobs').all().length;\nconst completed = $input.all().length;\nif (!uploadId || completed !== expected) throw new Error(`Only ${completed} of ${expected} Fountain artwork parts completed.`);\nreturn [{ json: { uploadId } }];" }
  },
  {
    id: 'save-artwork-id', name: 'Save Fountain Artwork Upload ID', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [7260, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.publicationRecordId, fields: { 'Artwork Upload ID': $('Confirm Artwork Parts Uploaded').first().json.uploadId, Status: 'Processing' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  { id: 'finalize-artwork', name: 'Finalize Fountain Artwork', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [7480, 220], onError: 'continueErrorOutput', parameters: { method: 'POST', url: "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Artwork Parts Uploaded').first().json.uploadId }}/finalize", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: { timeout: 120000 } }, credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } } },
  { id: 'wait-artwork', name: 'Wait for Fountain Artwork', type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [7700, 220], webhookId: '7a0cf344-e94b-4166-8a75-cdfca588d3b9', parameters: { resume: 'timeInterval', amount: "={{ Number((($('Fetch Fountain Settings').first().json.records || [])[0]?.fields?.['Upload Poll Seconds']) || 30) }}", unit: 'seconds' } },
  { id: 'get-artwork', name: 'Get Fountain Artwork Status', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [7920, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput', parameters: { method: 'GET', url: "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Artwork Parts Uploaded').first().json.uploadId }}", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: { timeout: 120000 } }, credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } } },
  { id: 'artwork-error', name: 'Fountain Artwork Error', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [8140, 220], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'artwork-error-status', leftValue: '={{ $json.media.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'ERROR' }], combinator: 'and' }, options: {} } },
  { id: 'throw-artwork-error', name: 'Stop on Fountain Artwork Error', type: 'n8n-nodes-base.code', typeVersion: 2, position: [8360, 120], onError: 'continueErrorOutput', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "throw new Error('Fountain artwork processing failed: ' + ($input.first().json.media?.error || 'Unknown Fountain error'));\nreturn [];" } },
  { id: 'artwork-ready', name: 'Fountain Artwork Ready', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [8360, 280], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: 'artwork-ready-status', leftValue: '={{ $json.media.status }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'READY' }], combinator: 'and' }, options: {} } },
  {
    id: 'update-item', name: 'Update Fountain Item', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [8580, 220], onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: "=https://api.fountain.fm/v1/feeds/{{ $('Resolve Fountain Item').first().json.feedId }}/items/{{ $('Resolve Fountain Item').first().json.itemId }}", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { title: $('Resolve Fountain Item').first().json.title, description: $('Resolve Fountain Item').first().json.description, explicit: $('Resolve Fountain Item').first().json.explicit, video_default_id: $('Confirm Video Parts Uploaded').first().json.uploadId, image_id: $('Confirm Artwork Parts Uploaded').first().json.uploadId } }}", options: { timeout: 120000 } },
    credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } }
  },
  {
    id: 'schedule-item', name: 'Schedule Fountain Item', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [8800, 220], onError: 'continueErrorOutput',
    parameters: { method: 'POST', url: "=https://api.fountain.fm/v1/feeds/{{ $('Resolve Fountain Item').first().json.feedId }}/items/{{ $('Resolve Fountain Item').first().json.itemId }}/schedule", authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { scheduled: $('Resolve Fountain Item').first().json.scheduledFor } }}", options: { timeout: 120000 } },
    credentials: { httpBearerAuth: { id: '5zWdDTc3e6SFgBVb', name: 'FOUNTAIN_API_KEY' } }
  },
  {
    id: 'mark-publication-scheduled', name: 'Mark Fountain Scheduled', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [9020, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.publicationRecordId, fields: { Status: 'Scheduled', 'Platform Item ID': $('Resolve Fountain Item').first().json.itemId, 'Video Upload ID': $('Confirm Video Parts Uploaded').first().json.uploadId, 'Artwork Upload ID': $('Confirm Artwork Parts Uploaded').first().json.uploadId, 'Scheduled For': $('Resolve Fountain Item').first().json.scheduledFor, Error: '', 'Raw Error': '' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'mark-episode-scheduled', name: 'Mark Episode Scheduled', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [9240, 220], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: 'continueErrorOutput',
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Plan').first().json.episodeRecordId, fields: { Status: 'Scheduled' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'notify-scheduled', name: 'Notify Fountain Scheduled', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [9460, 220], webhookId: '2da80ac1-5d67-4c9d-ae4e-135f68c536fe', retryOnFail: true, maxTries: 4, waitBetweenTries: 5000,
    parameters: { operation: 'sendMessage', chatId: '-5254203539', text: "=🎙️ <b>Fountain episode scheduled</b>\n\n{{ $('Build Fountain Plan').first().json.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}\n<code>{{ $('Build Fountain Plan').first().json.episodeId || 'no-id' }}</code>\n\nScheduled: <code>{{ $('Build Fountain Plan').first().json.scheduledFor }}</code>\nFountain item: <code>{{ $('Resolve Fountain Item').first().json.itemId }}</code>", additionalFields: { appendAttribution: false, parse_mode: 'HTML' } },
    credentials: { telegramApi: { id: 'INjDc84OskDdqiNR', name: 'Telegram [pod21_n8n_agent_bot]' } }
  },
  {
    id: 'build-failure', name: 'Build Fountain Failure', type: 'n8n-nodes-base.code', typeVersion: 2, position: [5060, 620],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const trigger = $('Ready for Publishing View').first().json;\nconst f = trigger.fields || trigger;\nconst input = $input.first().json || {};\nconst err = input.error;\nconst candidates = [\n  typeof err === 'string' ? err : null,\n  err && err.message,\n  err && err.description,\n  err && err.error,\n  input.message,\n  input.description\n].filter((v) => typeof v === 'string' && v.trim().length);\nconst message = String(candidates[0] || 'Unknown Fountain publishing error');\nconst raw = (() => { try { return JSON.stringify(input).slice(0, 9000); } catch { return message; } })();\nconst esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\nconst executionId = String($execution.id || 'unknown');\nlet publicationRecordId = '';\ntry { publicationRecordId = $('Upsert Fountain Publication').first().json.records[0].id; } catch {}\nreturn [{ json: {\n  episodeRecordId: trigger.id,\n  episodeId: f.ID || 'no-id',\n  publicationRecordId,\n  executionId,\n  error: message,\n  rawError: raw,\n  telegramText: '<b>Fountain publishing failed - needs attention</b>\\n\\n<code>' + esc(f.ID || 'no-id') + '</code>\\n' + esc(f.Title || 'Untitled episode') + '\\n\\n<b>Reason:</b> ' + esc(message).slice(0, 1800) + '\\n<b>Execution:</b> <code>' + esc(executionId) + '</code>\\n\\n<b>To retry:</b> fix the reported problem, then set the Fountain Publication Status to Pending and move the episode back into Ready for Publishing. If draft creation timed out, check the newest Fountain drafts before retrying.'\n} }];" }
  },
  {
    id: 'mark-publication-failed', name: 'Mark Fountain Failed', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [5280, 620], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Failure').first().json.publicationRecordId, fields: { Status: 'Failed', Error: $('Build Fountain Failure').first().json.error, 'Raw Error': $('Build Fountain Failure').first().json.rawError } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'mark-episode-failed', name: 'Mark Episode Publishing Failed', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [5500, 620], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Build Fountain Failure').first().json.episodeRecordId, fields: { Status: 'Publishing Failed' } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  },
  {
    id: 'notify-failure', name: 'Notify Fountain Failure', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [5720, 620], webhookId: '177ab0d2-04dd-4488-b487-6233aa5ddad8', retryOnFail: true, maxTries: 4, waitBetweenTries: 5000,
    parameters: { operation: 'sendMessage', chatId: '-5254203539', text: "={{ $('Build Fountain Failure').first().json.telegramText }}", additionalFields: { appendAttribution: false, parse_mode: 'HTML' } },
    credentials: { telegramApi: { id: 'INjDc84OskDdqiNR', name: 'Telegram [pod21_n8n_agent_bot]' } }
  },
  {
    id: 'restore-guarded-status', name: 'Restore Guarded Episode Status', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1100, 420], retryOnFail: true, maxTries: 5, waitBetweenTries: 5000,
    parameters: { method: 'PATCH', url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6', authentication: 'predefinedCredentialType', nodeCredentialType: 'airtableTokenApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: "={{ { records: [{ id: $('Guard Fountain Publication').first().json.episodeRecordId, fields: { Status: $('Guard Fountain Publication').first().json.restoreStatus } }], typecast: true } }}", options: {} },
    credentials: { airtableTokenApi: { id: '04Sw0cnSlBkB6Y3s', name: 'Airtable [n8n] (PAT)' } }
  }
];

const nodesByName = {};
for (const live of liveNodes) {
  const { type, typeVersion, credentials, ...config } = live;
  if (credentials) {
    config.credentials = Object.fromEntries(
      Object.entries(credentials).map(([credentialType, reference]) => [credentialType, newCredential(reference.name)])
    );
  }
  nodesByName[live.name] = (type === 'n8n-nodes-base.airtableTrigger' ? trigger : node)({
    type,
    version: typeVersion,
    config,
    output: [{}]
  });
}

const connections = [
  ['Ready for Publishing View', 0, 'Claim Episode as Publishing'],
  ['Claim Episode as Publishing', 0, 'Find Fountain Publication'],
  ['Find Fountain Publication', 0, 'Guard Fountain Publication'],
  ['Guard Fountain Publication', 0, 'Should Run Fountain'],
  ['Should Run Fountain', 0, 'Upsert Fountain Publication'],
  ['Should Run Fountain', 1, 'Restore Guarded Episode Status'],
  ['Upsert Fountain Publication', 0, 'Fetch Fountain Settings'],
  ['Fetch Fountain Settings', 0, 'Fetch Publishing Links'], ['Fetch Fountain Settings', 1, 'Build Fountain Failure'],
  ['Fetch Publishing Links', 0, 'Fetch 1x1 Thumbnail'], ['Fetch Publishing Links', 1, 'Build Fountain Failure'],
  ['Fetch 1x1 Thumbnail', 0, 'Build Fountain Plan'], ['Fetch 1x1 Thumbnail', 1, 'Build Fountain Failure'],
  ['Build Fountain Plan', 0, 'Save Fountain Plan'], ['Build Fountain Plan', 1, 'Build Fountain Failure'],
  ['Save Fountain Plan', 0, 'Resolve Frame.io Media'], ['Save Fountain Plan', 1, 'Build Fountain Failure'],
  ['Resolve Frame.io Media', 0, 'Probe Frame.io Video'], ['Resolve Frame.io Media', 1, 'Build Fountain Failure'],
  ['Probe Frame.io Video', 0, 'Probe Square Artwork'], ['Probe Frame.io Video', 1, 'Build Fountain Failure'],
  ['Probe Square Artwork', 0, 'Validate Fountain Media'], ['Probe Square Artwork', 1, 'Build Fountain Failure'],
  ['Validate Fountain Media', 0, 'Has Fountain Item ID'], ['Validate Fountain Media', 1, 'Build Fountain Failure'],
  ['Has Fountain Item ID', 0, 'Reuse Fountain Draft'], ['Has Fountain Item ID', 1, 'Create Fountain Draft'],
  ['Reuse Fountain Draft', 0, 'Resolve Fountain Item'],
  ['Create Fountain Draft', 0, 'Capture Fountain Item'], ['Create Fountain Draft', 1, 'Build Fountain Failure'],
  ['Capture Fountain Item', 0, 'Persist Fountain Item ID'], ['Capture Fountain Item', 1, 'Build Fountain Failure'],
  ['Persist Fountain Item ID', 0, 'Resolve Fountain Item'], ['Persist Fountain Item ID', 1, 'Build Fountain Failure'],
  ['Resolve Fountain Item', 0, 'Start Fountain Video Upload'], ['Resolve Fountain Item', 1, 'Build Fountain Failure'],
  ['Start Fountain Video Upload', 0, 'Build Video Part Jobs'], ['Start Fountain Video Upload', 1, 'Build Fountain Failure'],
  ['Build Video Part Jobs', 0, 'Upload Fountain Video Parts'], ['Build Video Part Jobs', 1, 'Build Fountain Failure'],
  ['Upload Fountain Video Parts', 0, 'Confirm Video Parts Uploaded'], ['Upload Fountain Video Parts', 1, 'Build Fountain Failure'],
  ['Confirm Video Parts Uploaded', 0, 'Save Fountain Video Upload ID'], ['Confirm Video Parts Uploaded', 1, 'Build Fountain Failure'],
  ['Save Fountain Video Upload ID', 0, 'Finalize Fountain Video'], ['Save Fountain Video Upload ID', 1, 'Build Fountain Failure'],
  ['Finalize Fountain Video', 0, 'Wait for Fountain Video'], ['Finalize Fountain Video', 1, 'Build Fountain Failure'],
  ['Wait for Fountain Video', 0, 'Get Fountain Video Status'],
  ['Get Fountain Video Status', 0, 'Fountain Video Error'], ['Get Fountain Video Status', 1, 'Build Fountain Failure'],
  ['Fountain Video Error', 0, 'Stop on Fountain Video Error'], ['Fountain Video Error', 1, 'Fountain Video Ready'],
  ['Stop on Fountain Video Error', 1, 'Build Fountain Failure'],
  ['Fountain Video Ready', 0, 'Start Fountain Artwork Upload'], ['Fountain Video Ready', 1, 'Wait for Fountain Video'],
  ['Start Fountain Artwork Upload', 0, 'Build Artwork Part Jobs'], ['Start Fountain Artwork Upload', 1, 'Build Fountain Failure'],
  ['Build Artwork Part Jobs', 0, 'Upload Fountain Artwork Parts'], ['Build Artwork Part Jobs', 1, 'Build Fountain Failure'],
  ['Upload Fountain Artwork Parts', 0, 'Confirm Artwork Parts Uploaded'], ['Upload Fountain Artwork Parts', 1, 'Build Fountain Failure'],
  ['Confirm Artwork Parts Uploaded', 0, 'Save Fountain Artwork Upload ID'], ['Confirm Artwork Parts Uploaded', 1, 'Build Fountain Failure'],
  ['Save Fountain Artwork Upload ID', 0, 'Finalize Fountain Artwork'], ['Save Fountain Artwork Upload ID', 1, 'Build Fountain Failure'],
  ['Finalize Fountain Artwork', 0, 'Wait for Fountain Artwork'], ['Finalize Fountain Artwork', 1, 'Build Fountain Failure'],
  ['Wait for Fountain Artwork', 0, 'Get Fountain Artwork Status'],
  ['Get Fountain Artwork Status', 0, 'Fountain Artwork Error'], ['Get Fountain Artwork Status', 1, 'Build Fountain Failure'],
  ['Fountain Artwork Error', 0, 'Stop on Fountain Artwork Error'], ['Fountain Artwork Error', 1, 'Fountain Artwork Ready'],
  ['Stop on Fountain Artwork Error', 1, 'Build Fountain Failure'],
  ['Fountain Artwork Ready', 0, 'Update Fountain Item'], ['Fountain Artwork Ready', 1, 'Wait for Fountain Artwork'],
  ['Update Fountain Item', 0, 'Schedule Fountain Item'], ['Update Fountain Item', 1, 'Build Fountain Failure'],
  ['Schedule Fountain Item', 0, 'Mark Fountain Scheduled'], ['Schedule Fountain Item', 1, 'Build Fountain Failure'],
  ['Mark Fountain Scheduled', 0, 'Mark Episode Scheduled'], ['Mark Fountain Scheduled', 1, 'Build Fountain Failure'],
  ['Mark Episode Scheduled', 0, 'Notify Fountain Scheduled'], ['Mark Episode Scheduled', 1, 'Build Fountain Failure'],
  ['Build Fountain Failure', 0, 'Mark Fountain Failed'],
  ['Mark Fountain Failed', 0, 'Mark Episode Publishing Failed'],
  ['Mark Episode Publishing Failed', 0, 'Notify Fountain Failure']
];

const fountainPublishing = workflow(
  'LTmRVKn9TWJd6Gtk',
  'BA - Ready for Publishing View Entered > Fountain Scheduled'
).settings({
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataErrorExecution: 'all',
  saveDataSuccessExecution: 'all',
  executionTimeout: 43200,
  errorWorkflow: '9PMI1kuBjLW2YHwb',
  timezone: 'America/New_York',
  executionOrder: 'v1'
});

for (const live of liveNodes) fountainPublishing.add(nodesByName[live.name]);
for (const [source, output, target] of connections) {
  fountainPublishing.connect(nodesByName[source], output, nodesByName[target], 0);
}

export default fountainPublishing;
