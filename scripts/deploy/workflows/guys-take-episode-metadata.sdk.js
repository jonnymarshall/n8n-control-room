import { workflow, node, trigger, merge, ifElse, languageModel, outputParser, newCredential, expr, sticky } from '@n8n/workflow-sdk';

const frameioOAuthCred = newCredential('Adobe OAuth');
const geminiCred = newCredential('Gemini API Key [n8n]');
const airtableCred = newCredential('Airtable [n8n] (PAT)');

// ---- Code: Parse the Frame.io file.ready webhook payload -------------------
const parseEventCode = `const items = $input.all();
const out = [];
for (const it of items) {
  const body = (it.json && it.json.body) ? it.json.body : (it.json || {});
  const resource = body.resource || {};
  const account = body.account || {};
  const fileId = resource.id || body.resource_id || '';
  const accountId = account.id || body.account_id || '';
  if (!fileId) continue;
  out.push({ json: { fileId: fileId, accountId: accountId, eventType: body.type || '' } });
}
return out;`;

// ---- Code: pull name + proxy download URL out of the Show File response -----
const extractInfoCode = `const items = $input.all();
const out = [];
for (const it of items) {
  const f = (it.json && it.json.data) ? it.json.data : (it.json || {});
  const name = f.name || f.file_name || '';
  const m = String(name).match(/^(BA-[^_\\s.]+)/i);
  const ml = f.media_links || {};
  const rend = ml.efficient || ml.high_quality || ml.original || {};
  const lk = f.links || {};
  const webUrl = f.web_url || f.player_url || lk.web || lk.player || lk.download || '';
  out.push({ json: {
    fileName: name,
    episodeId: m ? m[1] : null,
    downloadUrl: rend.download_url || '',
    mimeType: f.media_type || f.mime_type || 'video/mp4',
    webUrl: webUrl
  } });
}
return out;`;

// ---- Code: assemble the markdown deliverable + Telegram caption text --------
const buildOutputsCode = `const items = $input.all();
const out = [];
const NL = String.fromCharCode(10);
let fileName = 'Episode';
let frameioUrl = '';
let transcriptText = '';
let episodeId = '';
try { fileName = $('Extract Episode Info').first().json.fileName || 'Episode'; } catch (e) {}
try { episodeId = $('Extract Episode Info').first().json.episodeId || ''; } catch (e) {}
try { frameioUrl = $('Extract Episode Info').first().json.webUrl || ''; } catch (e) {}
if (!frameioUrl) { try { const rl = $('Create Review Link').first().json; const d = (rl && rl.data) ? rl.data : rl; frameioUrl = d.short_url || d.url || d.link || d.review_url || ''; } catch (e) {} }
if (!frameioUrl) { try { frameioUrl = $('Extract Episode Info').first().json.downloadUrl || ''; } catch (e) {} }
try { transcriptText = $('Extract Transcript').first().json.transcript || ''; } catch (e) {}
function secondsToHMS(s) {
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return ('00' + h).slice(-2) + ':' + ('00' + m).slice(-2) + ':' + ('00' + sec).slice(-2);
}
for (const it of items) {
  const o = (it.json && it.json.output) ? it.json.output : (it.json || {});
  const titles = Array.isArray(o.titles) ? o.titles : [];
  const caps = Array.isArray(o.thumbnail_captions) ? o.thumbnail_captions : [];
  const desc = o.description || '';
  const summary = o.summary || '';
  const chaptersRaw = Array.isArray(o.chapters) ? o.chapters : [];
  const chaptersJson = JSON.stringify({ version: '1.2.0', chapters: chaptersRaw.map(function(c) { return { startTime: c.startTime || 0, title: c.title || '' }; }) });
  const chaptersText = chaptersRaw.map(function(c) { return '(' + secondsToHMS(c.startTime || 0) + ') - ' + (c.title || ''); }).join(NL);
  const chaptersJsonBase64 = Buffer.from(chaptersJson, 'utf8').toString('base64');
  const chaptersFileName = (episodeId || 'episode') + '_Chapters.json';
  const title = String(fileName).replace(/\\.[a-zA-Z0-9]+$/, '').trim() || 'Episode';
  let md = '# ' + title + ' - Metadata' + NL + NL;
  md += '## Title options' + NL;
  for (let i = 0; i < titles.length; i++) md += (i + 1) + '. ' + titles[i] + NL;
  md += NL + '## Thumbnail caption options' + NL;
  for (let i = 0; i < caps.length; i++) md += (i + 1) + '. ' + caps[i] + NL;
  md += NL + '## Description (with timecodes)' + NL + NL + desc + NL;
  if (summary) md += NL + '## Summary' + NL + NL + summary + NL;
  const titlesText = titles.slice(0, 5).map(function (t, i) { return (i + 1) + '. ' + t; }).join(NL);
  const capsText = caps.slice(0, 5).map(function (c, i) { return (i + 1) + '. ' + c; }).join(NL);
  const b64 = Buffer.from(md, 'utf8').toString('base64');
  const safe = String(title).split('').filter(function (c) { return /[a-zA-Z0-9 _-]/.test(c); }).join('').trim().slice(0, 50) || 'episode';
  out.push({ json: { md: md, mdBase64: b64, fileName: 'Metadata - ' + safe + '.md', titlesText: titlesText, capsText: capsText, episodeTitle: title, episodeId: episodeId, summary: summary, chaptersJson: chaptersJson, chaptersText: chaptersText, chaptersJsonBase64: chaptersJsonBase64, chaptersFileName: chaptersFileName, frameioUrl: frameioUrl, transcriptText: transcriptText } });
}
return out;`;

const transcribePrompt = "You are a precise transcription engine. Transcribe the ENTIRE audio of the supplied video verbatim. Do not summarise, paraphrase, or omit anything. At the start of each new topic or roughly every 30-60 seconds, insert a timecode marker in the form [MM:SS] on its own. Where two or more distinct speakers are present, label turns as 'Speaker 1:', 'Speaker 2:' etc. Output plain text only.";

const metadataSystemPrompt = `You are the YouTube growth editor for "Guy's Take", a punchy Bitcoin and sovereign-tech commentary show hosted by Guy. From the supplied episode transcript you produce packaging options the team picks from.

Output exactly five fields:
- titles: an array of 5 high-CTR YouTube title options. Punchy, curiosity-driven, honest (no clickbait lies), max ~70 characters each, no emojis. Grounded in the actual content.
- thumbnail_captions: an array of 5 ultra-short viral thumbnail captions, 2-5 words each, the bold text overlaid on a thumbnail. Scroll-stopping and true to the episode.
- description: a single YouTube description string. Open with a 2-3 sentence hook paragraph. Then a "Chapters:" section listing timecoded chapter markers derived from the transcript's timecodes, one per line as "MM:SS Chapter title". Start the first chapter at 00:00. Use 5-10 chapters covering the real topic shifts. Clean and copy-paste ready.
- summary: a concise 2-3 sentence episode summary suitable for a podcast listing. Accurate, no spoilers beyond what a title would reveal.
- chapters: an array of chapter objects derived from the transcript's [MM:SS] timecodes. Each object has "startTime" (integer seconds, converted from MM:SS — e.g. [02:14] → 134) and "title" (short chapter title, 2-5 words). Start first chapter at 0. Use 5-10 chapters covering the real topic shifts.

Base everything strictly on the transcript. Never invent facts, names, numbers, or timecodes not supported by it. Match the show's confident, slightly contrarian Bitcoin voice.`;

const metadataPromptText = "Generate the packaging options for this Guy's Take episode.\n\nWORKING TITLE: {{ $('Extract Episode Info').first().json.fileName }}\n\nTRANSCRIPT (with timecodes):\n{{ $('Extract Transcript').first().json.transcript }}";

const transcribeBody = "{{ { contents: [ { parts: [ { fileData: { mimeType: $('Extract Episode Info').first().json.mimeType, fileUri: $('Upload Bytes to Gemini').first().json.file.uri } }, { text: " + JSON.stringify(transcribePrompt) + " } ] } ], generationConfig: { temperature: 0.2 } } }}";

// ---------------------------------------------------------------------------
const frameioTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Frame.io Webhook',
    parameters: { httpMethod: 'POST', path: 'frameio-episode-uploaded', responseMode: 'onReceived', options: {} },
    position: [240, 300]
  },
  output: [{ body: { type: 'file.ready', resource: { id: 'file-uuid', type: 'file' }, account: { id: 'account-uuid' }, project: { id: 'project-uuid' } } }]
});

const parseEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Frame.io Event',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: parseEventCode },
    position: [460, 300]
  },
  output: [{ fileId: 'file-uuid', accountId: 'account-uuid', eventType: 'file.ready' }]
});

const showFile = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Show File',
    parameters: {
      method: 'GET',
      url: expr('https://api.frame.io/v4/accounts/{{ $json.accountId }}/files/{{ $json.fileId }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 'include', value: 'media_links.efficient' }] },
      options: {}
    },
    credentials: { oAuth2Api: frameioOAuthCred },
    position: [680, 300]
  },
  output: [{ id: 'file-uuid', name: 'EP042 - The Final Cut.mp4', media_type: 'video/mp4', media_links: { efficient: { download_url: 'https://assets.frame.io/.../efficient.mp4?signature' } } }]
});

const extractInfo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Episode Info',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: extractInfoCode },
    position: [900, 300]
  },
  output: [{ fileName: 'EP042 - The Final Cut.mp4', episodeId: 42, downloadUrl: 'https://assets.frame.io/.../efficient.mp4?signature', mimeType: 'video/mp4' }]
});

const createReviewLink = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Review Link',
    parameters: {
      method: 'POST',
      url: expr("https://api.frame.io/v4/accounts/{{ $('Parse Frame.io Event').first().json.accountId }}/review_links"),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ { name: $('Extract Episode Info').first().json.fileName, asset_ids: [$('Parse Frame.io Event').first().json.fileId] } }}"),
      options: {}
    },
    credentials: { oAuth2Api: frameioOAuthCred },
    onError: 'continueRegularOutput',
    position: [1120, 300]
  },
  output: [{ data: { id: 'review-link-uuid', short_url: 'https://app.frame.io/reviews/abc123' } }]
});

const downloadProxy = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Proxy',
    parameters: {
      method: 'GET',
      url: expr("{{ $('Extract Episode Info').first().json.downloadUrl }}"),
      options: { response: { response: { fullResponse: true, responseFormat: 'file', outputPropertyName: 'data' } }, timeout: 300000 }
    },
    position: [1340, 300]
  },
  output: [{ headers: { 'content-length': '48211234' }, statusCode: 200 }]
});

const startResumable = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Start Gemini Upload',
    parameters: {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/upload/v1beta/files',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [
        { name: 'X-Goog-Upload-Protocol', value: 'resumable' },
        { name: 'X-Goog-Upload-Command', value: 'start' },
        { name: 'X-Goog-Upload-Header-Content-Length', value: expr("{{ $json.headers['content-length'] }}") },
        { name: 'X-Goog-Upload-Header-Content-Type', value: expr("{{ $('Extract Episode Info').first().json.mimeType }}") }
      ] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: { file: { display_name: 'guys-take-episode' } },
      options: { response: { response: { fullResponse: true } } }
    },
    credentials: { httpHeaderAuth: geminiCred },
    position: [1340, 220]
  },
  output: [{ headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc&upload_protocol=resumable' }, statusCode: 200 }]
});

const getUploadUrl = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Capture Upload URL',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [{ id: 'u1', name: 'uploadUrl', value: expr("{{ $json.headers['x-goog-upload-url'] }}"), type: 'string' }] },
      includeOtherFields: false,
      options: {}
    },
    position: [1560, 220]
  },
  output: [{ uploadUrl: 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc' }]
});

const mergeUpload = merge({
  version: 3.2,
  config: { name: 'Merge URL + Bytes', parameters: { mode: 'combine', combineBy: 'combineByPosition' }, position: [1780, 300] }
});

const uploadBytes = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload Bytes to Gemini',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.uploadUrl }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [
        { name: 'X-Goog-Upload-Offset', value: '0' },
        { name: 'X-Goog-Upload-Command', value: 'upload, finalize' }
      ] },
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      options: { timeout: 300000 }
    },
    position: [2000, 300]
  },
  output: [{ file: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123', name: 'files/abc123', state: 'PROCESSING', mimeType: 'video/mp4' } }]
});

const waitProcessing = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait for Processing', parameters: { resume: 'timeInterval', amount: 8, unit: 'seconds' }, position: [2220, 300] },
  output: [{ file: { name: 'files/abc123' } }]
});

const getFileState = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get File State',
    parameters: {
      method: 'GET',
      url: expr("https://generativelanguage.googleapis.com/v1beta/{{ $('Upload Bytes to Gemini').first().json.file.name }}"),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {}
    },
    credentials: { httpHeaderAuth: geminiCred },
    position: [2440, 300]
  },
  output: [{ name: 'files/abc123', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123', state: 'ACTIVE' }]
});

const isActive = ifElse({
  version: 2.3,
  config: {
    name: 'Is File Active',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [{ leftValue: expr('{{ $json.state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'ACTIVE', id: 'cond-active' }],
        combinator: 'and'
      },
      options: {}
    },
    position: [2660, 300]
  }
});

const transcribe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Transcribe with Gemini',
    parameters: {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(transcribeBody),
      options: { timeout: 600000 }
    },
    credentials: { httpHeaderAuth: geminiCred },
    position: [2880, 220]
  },
  output: [{ candidates: [{ content: { parts: [{ text: '[00:00] Speaker 1: Welcome back to Guys Take...' }] } }] }]
});

const extractTranscript = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Extract Transcript',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [{ id: 't1', name: 'transcript', value: expr("{{ ($json.candidates[0].content.parts || []).map(p => p.text).join('') }}"), type: 'string' }] },
      includeOtherFields: false,
      options: {}
    },
    position: [3100, 220]
  },
  output: [{ transcript: '[00:00] Speaker 1: Welcome back to Guys Take...' }]
});

const metadataModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  version: 1,
  config: {
    name: 'Metadata Model (OpenRouter)',
    parameters: { model: 'openai/gpt-5.1', options: { maxTokens: 4000, responseFormat: 'json_object', temperature: 0.8 } },
    credentials: { openRouterApi: newCredential('OpenRouter [n8n]') },
    position: [3320, 420]
  }
});

const metadataParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Metadata Output Parser',
    parameters: { jsonSchemaExample: '{"titles":["High-CTR title option"],"thumbnail_captions":["BANK RUN"],"description":"Hook paragraph.\\n\\nChapters:\\n00:00 Intro\\n02:14 The real story","summary":"Guy breaks down why...","chapters":[{"startTime":0,"title":"Intro"},{"startTime":134,"title":"The real story"}]}' },
    position: [3480, 420]
  }
});

const generateMetadata = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Generate Metadata',
    parameters: {
      promptType: 'define',
      text: expr(metadataPromptText),
      hasOutputParser: true,
      messages: { messageValues: [{ message: metadataSystemPrompt }] },
      batching: {}
    },
    subnodes: { model: metadataModel, outputParser: metadataParser },
    position: [3320, 220]
  },
  output: [{ output: { titles: ['Title A', 'Title B'], thumbnail_captions: ['BANK RUN', 'GAME OVER'], description: 'Hook.\n\nChapters:\n00:00 Intro' } }]
});

const buildOutputs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Outputs',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: buildOutputsCode },
    position: [3540, 220]
  },
  output: [{ md: '# Episode - Metadata', mdBase64: 'IyBFcA==', fileName: 'Metadata - EP042.md', titlesText: '1. Title A', episodeTitle: 'EP042 - The Final Cut' }]
});

const findEpisode = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Find Episode',
    parameters: {
      resource: 'record',
      operation: 'search',
      authentication: 'airtableTokenApi',
      base: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      table: { __rl: true, mode: 'id', value: 'tbl3uYLIvtB9APZp6', cachedResultName: 'Episodes' },
      filterByFormula: expr("{ID}=\"{{ $('Extract Episode Info').first().json.episodeId }}\""),
      returnAll: false,
      limit: 1,
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    onError: 'continueRegularOutput',
    position: [3760, 220]
  },
  output: [{ id: 'recEPISODEXXXXXXX', Title: 'EP042 - The Final Cut', ID: 42 }]
});

const updateStatus = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Set Status AI Analysis Complete',
    parameters: {
      resource: 'record',
      operation: 'update',
      authentication: 'airtableTokenApi',
      base: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      table: { __rl: true, mode: 'id', value: 'tbl3uYLIvtB9APZp6', cachedResultName: 'Episodes' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: expr("{{ $('Find Episode').first().json.id }}"),
          Status: 'AI Analysis Complete',
          Summary: expr("{{ $('Build Outputs').first().json.summary }}"),
          Chapters: expr("{{ $('Build Outputs').first().json.chaptersText }}"),
          Transcript: expr("{{ $('Build Outputs').first().json.transcriptText }}"),
          'Frami.io URL': expr("{{ $('Build Outputs').first().json.frameioUrl }}"),
          'Chapters JSON': []
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true },
          { id: 'Status', displayName: 'Status', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'options', options: [{ name: 'Scheduled', value: 'Scheduled' }, { name: 'Research Ready', value: 'Research Ready' }, { name: 'Stories Picked', value: 'Stories Picked' }, { name: 'Script Ready', value: 'Script Ready' }, { name: 'Recorded', value: 'Recorded' }, { name: 'Transcript Ready', value: 'Transcript Ready' }, { name: 'Edited', value: 'Edited' }, { name: 'AI Analysis Complete', value: 'AI Analysis Complete' }, { name: 'Approved', value: 'Approved' }, { name: 'Artwork Ready', value: 'Artwork Ready' }, { name: 'Published', value: 'Published' }], readOnly: false, removed: false },
          { id: 'Summary', displayName: 'Summary', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Chapters', displayName: 'Chapters', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Transcript', displayName: 'Transcript', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Frami.io URL', displayName: 'Frami.io URL', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Chapters JSON', displayName: 'Chapters JSON', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'array', readOnly: false, removed: false }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    onError: 'continueRegularOutput',
    position: [3980, 220]
  },
  output: [{ id: 'recEPISODEXXXXXXX', Status: 'AI Analysis Complete' }]
});

const airtablePATCred = newCredential('Airtable PAT (Bearer)');

// Airtable Content API — Upload attachment.
// Correct contract (https://airtable.com/developers/web/api/upload-attachment):
//   POST https://content.airtable.com/v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment
//   Body is JSON: { contentType, filename, file (base64) }  — NOT multipart.
// The field name comes BEFORE the /uploadAttachment segment; "Chapters JSON" is URL-encoded.
const uploadChaptersAttachment = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload Chapters Attachment',
    parameters: {
      method: 'POST',
      url: expr("https://content.airtable.com/v0/app8Xw9Tq0XLjhmp9/{{ $('Find Episode').first().json.id }}/Chapters%20JSON/uploadAttachment"),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ { contentType: 'application/json', filename: $('Build Outputs').first().json.chaptersFileName, file: $('Build Outputs').first().json.chaptersJsonBase64 } }}"),
      options: {}
    },
    credentials: { httpBearerAuth: airtablePATCred },
    onError: 'continueRegularOutput',
    position: [4200, 220]
  },
  output: [{ id: 'attachment-uuid' }]
});

const injectMdData = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Telegram File',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [
        { id: 'tf1', name: 'mdBase64', value: expr("{{ $('Build Outputs').first().json.mdBase64 }}"), type: 'string' },
        { id: 'tf2', name: 'fileName', value: expr("{{ $('Build Outputs').first().json.fileName }}"), type: 'string' }
      ] },
      includeOtherFields: false,
      options: {}
    },
    position: [4420, 220]
  },
  output: [{ mdBase64: 'IyBFcA==', fileName: 'Metadata - EP042.md' }]
});

const convertToFile = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Convert Markdown to File',
    parameters: {
      operation: 'toBinary',
      sourceProperty: 'mdBase64',
      binaryPropertyName: 'data',
      options: { fileName: expr('{{ $json.fileName }}'), mimeType: 'text/markdown', dataIsBase64: true }
    },
    position: [4640, 220]
  },
  output: [{ fileName: 'Metadata - EP042.md' }]
});

const sendToTelegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Metadata to Telegram',
    parameters: {
      resource: 'message',
      operation: 'sendDocument',
      chatId: '-5254203539',
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: {
        appendAttribution: false,
        parse_mode: 'HTML',
        caption: expr("📺 <b>Episode metadata ready</b>\n\n<b>{{ $('Build Outputs').first().json.episodeTitle }}</b> · <code>{{ $('Build Outputs').first().json.episodeId }}</code>\n\n<b>Title Options</b>\n{{ $('Build Outputs').first().json.titlesText }}\nReply <b>T1–T5</b> to select a title, or suggest your own.\n\n<b>Thumbnail Caption Options</b>\n{{ $('Build Outputs').first().json.capsText }}\nReply <b>TC1–TC5</b> to select a caption, or suggest your own.\n\nFull timecoded description in the attached file.")
      }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [4860, 220]
  },
  output: [{ ok: true, result: { message_id: 1 } }]
});

const setupNote = sticky(
  "## Frame.io -> AI metadata -> Telegram\n\nTrigger: Frame.io file.ready webhook. Register it to this node's Production URL with events=['file.ready'].\n\nCredentials: Frame.io OAuth2 (Adobe IMS) on Show File; Gemini API Key [n8n] (header auth); OpenRouter, Telegram, Airtable PAT.\n\nAirtable: Episodes.ID is a string matched by the BA-xxxx prefix (e.g. BA-hPtPmN_Title.mp4 → ID=BA-hPtPmN). V4 API wraps response in a 'data' key.",
  [frameioTrigger, parseEvent, showFile],
  { color: 4 }
);

export default workflow('jroXHciDvy0sWlRM', 'BA - Frame.io: Episode uploaded → AI metadata → Telegram')
  .add(setupNote)
  .add(frameioTrigger)
  .to(parseEvent)
  .to(showFile)
  .to(extractInfo)
  .to(createReviewLink)
  .to(downloadProxy)
  .to(startResumable)
  .to(getUploadUrl)
  .to(mergeUpload.input(0))
  .add(downloadProxy)
  .to(mergeUpload.input(1))
  .add(mergeUpload)
  .to(uploadBytes)
  .to(waitProcessing)
  .to(getFileState)
  .to(isActive
    .onTrue(
      transcribe
        .to(extractTranscript)
        .to(generateMetadata)
        .to(buildOutputs)
        .to(findEpisode)
        .to(updateStatus)
        .to(uploadChaptersAttachment)
        .to(injectMdData)
        .to(convertToFile)
        .to(sendToTelegram)
    )
    .onFalse(waitProcessing));
