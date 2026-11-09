import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow XY4WfJ2XaBA9bPKY, fetched 2026-11-04.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh XY4WfJ2XaBA9bPKY guys-take-fountain-upload-video
const liveNodes = [
  {"id": "5b100000-0000-4000-8000-000000000001", "name": "Input", "type": "n8n-nodes-base.executeWorkflowTrigger", "typeVersion": 1.1, "position": [0, 300], "parameters": {"inputSource": "passthrough"}},
  {"id": "5b100000-0000-4000-8000-000000000002", "name": "Resolve Frame.io Media", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [220, 300], "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"method": "GET", "url": "=https://api.frame.io/v4/accounts/b4480b8c-6815-4eed-8198-d33593ab21c3/files/{{ (($('Input').first().json.videoUrl || '').split('?')[0]).split('/').filter(Boolean).pop() }}", "authentication": "genericCredentialType", "genericAuthType": "oAuth2Api", "sendQuery": true, "queryParameters": {"parameters": [{"name": "include", "value": "media_links.efficient,media_links.original,media_links.high_quality"}]}, "options": {"timeout": 120000}}, "credentials": {"oAuth2Api": {"id": "1rXdRm0N6eNzG5cV", "name": "Adobe OAuth"}}},
  {"id": "a7000000-0000-4000-8000-000000000030", "name": "Probe Renditions", "type": "n8n-nodes-base.executeCommand", "typeVersion": 1, "position": [440, 300], "parameters": {"command": "=HQ='{{ ($json.data.media_links.high_quality || {}).download_url || 'none' }}' OR='{{ ($json.data.media_links.original || {}).download_url || 'none' }}' EF='{{ ($json.data.media_links.efficient || {}).download_url || 'none' }}' node -e 'const order=[[\"high_quality\",process.env.HQ],[\"original\",process.env.OR],[\"efficient\",process.env.EF]];(async()=>{const out=[];for(const [k,u] of order){if(!u||u===\"none\"){continue;}try{const r=await fetch(u,{headers:{Range:\"bytes=0-1048575\"}});const cr=r.headers.get(\"content-range\")||\"\";const total=Number(cr.split(\"/\")[1]||0);const ct=(r.headers.get(\"content-type\")||\"\").split(\";\")[0];const b=Buffer.from(await r.arrayBuffer());let i=b.indexOf(Buffer.from(\"moov\"));let d=b;if(i<0&&total>0){const s=Math.max(0,total-2097152);const r2=await fetch(u,{headers:{Range:\"bytes=\"+s+\"-\"+(total-1)}});d=Buffer.from(await r2.arrayBuffer());i=d.indexOf(Buffer.from(\"moov\"));}let w=0,h=0;if(i>=0){const j=d.indexOf(Buffer.from(\"tkhd\"),i);if(j>=0){const v=d[j+4];const p=j+8+(v===1?76:72);w=d.readUInt32BE(p)/65536;h=d.readUInt32BE(p+4)/65536;}}out.push({rendition:k,url:u,bytes:total,type:ct,width:w,height:h});}catch(e){out.push({rendition:k,url:u,error:String((e&&e.message)||e)});}}console.log(JSON.stringify(out));})();'"}},
  {"id": "a7000000-0000-4000-8000-000000000031", "name": "Choose Source", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 300], "parameters": {"jsCode": "const out = $input.first().json || {};\nif (Number(out.exitCode) !== 0) throw new Error('Could not measure the Frame.io renditions: ' + String(out.stderr || '').slice(0, 300));\nlet candidates = [];\ntry { candidates = JSON.parse(String(out.stdout || '[]').trim().split('\\n').pop()); } catch (e) { candidates = []; }\nconst usable = (Array.isArray(candidates) ? candidates : []).filter(function (c) {\n  return c && !c.error && c.url && /^video\\//.test(String(c.type || ''));\n});\n// Preference (Jonny, 2026-11-04): 1920x1080 if any rendition has it, otherwise 1280x720.\n// Anything below 1280x720 is a proxy and is never uploaded.\nconst smallest = function (pred) {\n  const hits = usable.filter(pred).sort(function (a, b) { return Number(a.bytes) - Number(b.bytes); });\n  return hits.length ? hits[0] : null;\n};\nconst pick = smallest(function (c) { return Number(c.width) >= 1920 && Number(c.height) >= 1080; })\n  || smallest(function (c) { return Number(c.width) >= 1280 && Number(c.height) >= 720; });\nif (!pick) {\n  const seen = (candidates || []).map(function (c) { return (c.rendition || '?') + ' ' + (c.width || '?') + 'x' + (c.height || '?') + (c.error ? ' (unreadable)' : ''); }).join(', ');\n  throw new Error('Nothing on this Frame.io file is 1280x720 or better, so it looks like a proxy and nothing was uploaded. Measured: ' + (seen || 'nothing'));\n}\nconst input = $('Input').first().json;\nreturn { json: Object.assign({}, input, {\n  videoUrl: pick.url,\n  videoBytes: Number(pick.bytes),\n  videoType: pick.type,\n  rendition: pick.rendition,\n  resolution: pick.width + 'x' + pick.height,\n  candidates: (candidates || []).map(function (c) { return { rendition: c.rendition, width: c.width, height: c.height, mb: Math.round(Number(c.bytes || 0) / 1000000) }; })\n}) };"}},
  {"id": "a7000000-0000-4000-8000-000000000020", "name": "Note Upload Started", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [770, 300], "onError": "continueRegularOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { Notes: 'Uploading the ' + $('Choose Source').first().json.rendition + ' (' + $('Choose Source').first().json.resolution + ', ' + Math.round($('Choose Source').first().json.videoBytes/1000000) + ' MB) since ' + $now.setZone('America/New_York').toFormat('HH:mm') + ', expect about ' + Math.max(3, Math.round(Number($('Choose Source').first().json.videoBytes) / 210000000)) + ' min' } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "5b100000-0000-4000-8000-000000000005", "name": "Start Fountain Video Upload", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 300], "parameters": {"method": "POST", "url": "https://api.fountain.fm/v1/uploads", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { kind: 'ITEM_VIDEO', feed_id: $('Choose Source').first().json.feedId, item_id: $('Choose Source').first().json.itemId, content_type: $('Choose Source').first().json.videoType, access: 'DEFAULT', num_bytes: $('Choose Source').first().json.videoBytes } }}", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "5b100000-0000-4000-8000-000000000006", "name": "Build Video Part Jobs", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 300], "parameters": {"jsCode": "const response = $input.first().json;\nconst mediaId = response.media?.id;\nconst urls = response.upload?.urls || [];\nconst partSize = Number(response.upload?.part_size);\nconst plan = $('Choose Source').first().json;\nif (!mediaId || !urls.length || !partSize) throw new Error('Fountain did not return video multipart upload URLs.');\nfunction shellQuote(value) { return \"'\" + String(value).replace(/'/g, \"'\\\"'\\\"'\") + \"'\"; }\nconst uploader = `(async () => {\n  const { SRC, DEST, START, END } = process.env;\n  const len = Number(END) - Number(START) + 1;\n  const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));\n  const once = async () => {\n    const source = await fetch(SRC, { headers: { Range: 'bytes=' + START + '-' + END } });\n    if (!source.ok && source.status !== 206) throw new Error('source responded ' + source.status);\n    const body = Buffer.from(await source.arrayBuffer());\n    if (body.length !== len) throw new Error('range length ' + body.length + ' != ' + len);\n    const target = await fetch(DEST, { method: 'PUT', body, headers: { 'Content-Length': String(body.length) } });\n    if (!target.ok) throw new Error('target responded ' + target.status);\n  };\n  for (let attempt = 1; attempt <= 20; attempt++) {\n    try { await once(); process.exit(0); }\n    catch (error) {\n      if (attempt === 20) { console.error(String((error && error.message) || error)); process.exit(1); }\n      await sleep(attempt < 6 ? Math.pow(2, attempt) : 60);\n    }\n  }\n})();`;\nreturn urls.map((url, index) => {\n  const start = index * partSize;\n  const end = Math.min(plan.videoBytes - 1, start + partSize - 1);\n  const command = 'SRC=' + shellQuote(plan.videoUrl) + ' DEST=' + shellQuote(url) + ' START=' + start + ' END=' + end + ' node -e ' + shellQuote(uploader);\n  return { json: { uploadId: mediaId, partNumber: index + 1, totalParts: urls.length, command } };\n});"}},
  {"id": "5b100000-0000-4000-8000-000000000007", "name": "Upload Fountain Video Parts", "type": "n8n-nodes-base.executeCommand", "typeVersion": 1, "position": [1320, 300], "parameters": {"command": "={{ $json.command }}", "executeOnce": false}},
  {"id": "5b100000-0000-4000-8000-000000000008", "name": "Confirm Video Parts Uploaded", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 300], "parameters": {"jsCode": "const uploadId = $('Build Video Part Jobs').first().json.uploadId;\nconst expected = $('Build Video Part Jobs').all().length;\nconst completed = $input.all().length;\nif (!uploadId || completed !== expected) throw new Error(`Only ${completed} of ${expected} Fountain video parts completed.`);\nreturn [{ json: { uploadId } }];"}},
  {"id": "5b100000-0000-4000-8000-000000000009", "name": "Save Video Upload ID", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1760, 300], "onError": "continueRegularOutput", "parameters": {"method": "PATCH", "url": "https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbllWUvhNolvdk3uw", "authentication": "predefinedCredentialType", "nodeCredentialType": "airtableTokenApi", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ { records: [{ id: $('Input').first().json.publicationRecordId, fields: { 'Video Upload ID': $('Confirm Video Parts Uploaded').first().json.uploadId } }], typecast: true } }}", "options": {}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "5b100000-0000-4000-8000-00000000000a", "name": "Finalize Fountain Video", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [1980, 300], "parameters": {"method": "POST", "url": "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Video Parts Uploaded').first().json.uploadId }}/finalize", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "5b100000-0000-4000-8000-00000000000b", "name": "Wait for Fountain Video", "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "position": [2200, 300], "webhookId": "f3bffdf8-715d-41aa-83a3-41741627a38f", "parameters": {"resume": "timeInterval", "amount": 30, "unit": "seconds"}},
  {"id": "5b100000-0000-4000-8000-00000000000c", "name": "Get Fountain Video Status", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [2420, 300], "parameters": {"method": "GET", "url": "=https://api.fountain.fm/v1/uploads/{{ $('Confirm Video Parts Uploaded').first().json.uploadId }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 120000}}, "credentials": {"httpBearerAuth": {"id": "5zWdDTc3e6SFgBVb", "name": "FOUNTAIN_API_KEY"}}},
  {"id": "5b100000-0000-4000-8000-00000000000d", "name": "Fountain Video Error", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [2640, 300], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "video-error-status", "leftValue": "={{ $json.media.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "ERROR"}], "combinator": "and"}, "options": {}}},
  {"id": "5b100000-0000-4000-8000-00000000000e", "name": "Stop on Video Error", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2860, 180], "parameters": {"jsCode": "throw new Error('Fountain video processing failed: ' + (($input.first().json.media || {}).error || 'Unknown Fountain error'));\nreturn [];"}},
  {"id": "5b100000-0000-4000-8000-00000000000f", "name": "Fountain Video Ready", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [2860, 400], "parameters": {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3}, "conditions": [{"id": "video-ready-status", "leftValue": "={{ $json.media.status }}", "operator": {"type": "string", "operation": "equals"}, "rightValue": "READY"}], "combinator": "and"}, "options": {}}},
  {"id": "5b100000-0000-4000-8000-000000000010", "name": "Return Video Upload", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [3080, 400], "parameters": {"jsCode": "const status = $('Get Fountain Video Status').first().json || {};\nreturn [{ json: {\n  uploadId: $('Confirm Video Parts Uploaded').first().json.uploadId,\n  mediaId: (status.media || {}).id || '',\n  status: (status.media || {}).status || '',\n  videoBytes: $('Validate Video').first().json.videoBytes,\n  videoType: $('Validate Video').first().json.videoType\n} }];"}}
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
  ['Input', 0, 'Resolve Frame.io Media'],
  ['Start Fountain Video Upload', 0, 'Build Video Part Jobs'],
  ['Build Video Part Jobs', 0, 'Upload Fountain Video Parts'],
  ['Upload Fountain Video Parts', 0, 'Confirm Video Parts Uploaded'],
  ['Confirm Video Parts Uploaded', 0, 'Save Video Upload ID'],
  ['Save Video Upload ID', 0, 'Finalize Fountain Video'],
  ['Finalize Fountain Video', 0, 'Wait for Fountain Video'],
  ['Wait for Fountain Video', 0, 'Get Fountain Video Status'],
  ['Get Fountain Video Status', 0, 'Fountain Video Error'],
  ['Fountain Video Error', 0, 'Stop on Video Error'],
  ['Fountain Video Error', 1, 'Fountain Video Ready'],
  ['Fountain Video Ready', 0, 'Return Video Upload'],
  ['Fountain Video Ready', 1, 'Wait for Fountain Video'],
  ['Note Upload Started', 0, 'Start Fountain Video Upload'],
  ['Resolve Frame.io Media', 0, 'Probe Renditions'],
  ['Probe Renditions', 0, 'Choose Source'],
  ['Choose Source', 0, 'Note Upload Started']
];

const guysTakeFountainUploadVideo = workflow(
  "XY4WfJ2XaBA9bPKY",
  "BA - Subworkflow - Upload Video to Fountain"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  executionOrder: "v1",
  callerPolicy: "workflowsFromSameOwner",
  availableInMCP: true
});

for (const live of liveNodes) guysTakeFountainUploadVideo.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  guysTakeFountainUploadVideo.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default guysTakeFountainUploadVideo;
