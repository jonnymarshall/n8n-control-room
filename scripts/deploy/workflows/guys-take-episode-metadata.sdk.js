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
  const rend = [ml.efficient, ml.high_quality, ml.original].find(function(r) { return r && r.download_url; }) || {};
  const lk = f.links || {};
  const webUrl = f.web_url || f.player_url || f.view_url || lk.web || lk.player || lk.download || '';
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
// Telegram messages are sent with parse_mode HTML, so anything that reaches a
// message body must have & < > escaped. The markdown FILE keeps the raw text.
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---- context for the "your turn" message ----------------------------------
// What's already on the episode (so Jonny can see it before deciding whether to
// change it) plus the mood library, so the message can list the moods he picks from.
let currentTitle = '';
let guestNames = [];
try {
  const ep = $('Find Episode').first().json;
  currentTitle = ep.Title || '';
  const gn = ep['Guest Name'];   // lookup on the Guests link -> always an array
  guestNames = Array.isArray(gn) ? gn.filter(Boolean) : (gn ? [gn] : []);
} catch (e) {}
let moodList = [];
try {
  const recs = (($('Fetch Mood Library').first() || {}).json || {}).records || [];
  moodList = recs.map(function (r) { return (r.fields || {})['Mood']; }).filter(Boolean);
} catch (e) {}
const moodsText = moodList.length
  ? moodList.map(function (m, i) { return (i + 1) + '. ' + esc(m); }).join(NL)
  : '(none — the Thumbnail References table is empty)';
const guestsText = guestNames.length ? esc(guestNames.join(', ')) : 'none linked yet';
const currentTitleText = currentTitle ? esc(currentTitle) : 'not set yet';

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
  // Labelled + HTML-escaped variants for the Telegram message. The labels match
  // the reply codes exactly (T1 / TC1) so the assistant can map a reply straight
  // back to an option without inferring the numbering.
  const titlesTextHtml = titles.slice(0, 5).map(function (t, i) { return 'T' + (i + 1) + '. ' + esc(t); }).join(NL);
  const capsTextHtml = caps.slice(0, 5).map(function (c, i) { return 'TC' + (i + 1) + '. ' + esc(c); }).join(NL);
  const b64 = Buffer.from(md, 'utf8').toString('base64');
  const safe = String(title).split('').filter(function (c) { return /[a-zA-Z0-9 _-]/.test(c); }).join('').trim().slice(0, 50) || 'episode';
  out.push({ json: { md: md, mdBase64: b64, fileName: 'Metadata - ' + safe + '.md', titlesText: titlesText, capsText: capsText, titlesTextHtml: titlesTextHtml, capsTextHtml: capsTextHtml, episodeTitle: title, episodeTitleHtml: esc(title), episodeId: episodeId, moodsText: moodsText, guestsText: guestsText, currentTitleText: currentTitleText, summary: summary, chaptersJson: chaptersJson, chaptersText: chaptersText, chaptersJsonBase64: chaptersJsonBase64, chaptersFileName: chaptersFileName, frameioUrl: frameioUrl, transcriptText: transcriptText } });
}
return out;`;

const transcribePrompt = "You are a precise transcription engine. Transcribe the ENTIRE audio of the supplied video or audio file verbatim. Do not summarise, paraphrase, or omit anything. At the start of each new topic or roughly every 30-60 seconds, insert a timecode marker in the form [MM:SS] on its own. Where two or more distinct speakers are present, label turns as 'Speaker 1:', 'Speaker 2:' etc. Output plain text only.";

const metadataSystemPrompt = "You are the YouTube growth editor for Guy's Take, a punchy Bitcoin and sovereign-tech commentary show hosted by Guy. From the supplied transcript produce packaging options. Return a JSON object with EXACTLY these five keys: (1) titles: array of exactly 5 high-CTR YouTube title strings, punchy, max 70 chars, no emojis; (2) thumbnail_captions: array of exactly 5 ultra-short viral thumbnail captions, 2-5 words each; (3) description: a single string opening with a 2-3 sentence hook paragraph, then a line 'Chapters:' followed by timecoded chapter markers each on its own line formatted as 'MM:SS Chapter title', first chapter at 00:00, 5-10 chapters total; (4) summary: a single concise 2-3 sentence podcast-listing summary — voice depends on EPISODE TYPE: Take/Chat/Roundtable = first person as host Guy; Clip = THIRD PERSON about the GUEST (e.g. 'In this clip, {GUEST} explains...'); Unknown = general first person; (5) chapters: array of chapter objects, each with startTime as an INTEGER number of seconds converted from the [MM:SS] timecode in the transcript (e.g. [02:14] becomes the integer 134, NOT the string '02:14') and title as a 2-5 word string — 5-10 chapters, first at startTime 0. Base everything strictly on the transcript. Never invent facts or timecodes not present in the transcript.";

const metadataPromptText = "Generate the packaging options for this Guy's Take episode.\n\nEPISODE TYPE: {{ $('Find Episode').all().length ? ($('Find Episode').first().json.Type || $('Find Episode').first().json.Category || 'Unknown') : 'Unknown' }}\n\nGUEST: {{ $('Find Episode').all().length && $('Find Episode').first().json['Guest Name'] ? (Array.isArray($('Find Episode').first().json['Guest Name']) ? $('Find Episode').first().json['Guest Name'].join(', ') : $('Find Episode').first().json['Guest Name']) : 'Unknown' }}\n\nWORKING TITLE: {{ $('Extract Episode Info').first().json.fileName }}\n\nTRANSCRIPT (with timecodes):\n{{ $('Extract Transcript').first().json.transcript }}";

// Transcription only needs the AUDIO; the video frames are pure token waste and
// blow the 1M context past ~58 min. Sample frames sparsely (fps 0.2) at low media
// resolution so frame tokens go near-zero while audio (32 tok/s) is untouched —
// lifts the practical ceiling to ~6h. mediaResolution/videoMetadata don't affect
// audio fidelity, so transcript quality is unchanged.
const transcribeBody = "{{ { contents: [ { parts: [ { fileData: { mimeType: $('Extract Episode Info').first().json.mimeType, fileUri: $('Upload Bytes to Gemini').first().json.file.uri }, videoMetadata: { fps: 0.2 } }, { text: " + JSON.stringify(transcribePrompt) + " } ] } ], generationConfig: { temperature: 0.2, mediaResolution: 'MEDIA_RESOLUTION_LOW' } } }}";

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
      queryParameters: { parameters: [{ name: 'include', value: 'media_links.efficient,media_links.original' }] },
      options: {}
    },
    credentials: { oAuth2Api: frameioOAuthCred },
    retryOnFail: true,
    maxTries: 5,
    waitBetweenTries: 5000,
    position: [680, 300]
  },
  output: [{ id: 'file-uuid', name: 'EP042 - The Final Cut.mp4', media_type: 'video/mp4', media_links: { efficient: { download_url: 'https://assets.frame.io/.../efficient.mp4?signature' } }, view_url: 'https://next.frame.io/project/abc/view/def' }]
});

const extractInfo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Episode Info',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: extractInfoCode },
    position: [900, 300]
  },
  output: [{ fileName: 'EP042 - The Final Cut.mp4', episodeId: 42, downloadUrl: 'https://assets.frame.io/.../efficient.mp4?signature', mimeType: 'video/mp4', webUrl: 'https://next.frame.io/project/abc/view/def' }]
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
    retryOnFail: true,
    maxTries: 5,
    waitBetweenTries: 5000,
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
    retryOnFail: true,
    maxTries: 5,
    waitBetweenTries: 5000,
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
    retryOnFail: true,
    maxTries: 5,
    waitBetweenTries: 5000,
    position: [2440, 300]
  },
  output: [{ name: 'files/abc123', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123', state: 'ACTIVE', videoMetadata: { videoDuration: '202s' } }]
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
    // Gemini returns transient 503 "Service unavailable" under load. Generation is
    // idempotent here (we only read the text back), so retry is safe.
    retryOnFail: true,
    maxTries: 5,
    waitBetweenTries: 5000,
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

// The mood library ("Thumbnail References") is read here purely so the Telegram
// message can LIST the moods for Jonny to pick from. Picking used to be done by
// Gemini inside the artwork workflow; that node is gone and the choice is his.
// Sits on the full-run path only, so a _Bypass / same-length re-upload never
// pays for it. Its output item is irrelevant downstream (Generate Metadata
// builds its prompt entirely from expressions), so inserting it here is safe.
const fetchMoodLibrary = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Mood Library',
    parameters: {
      url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnail%20References',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      // A missing/renamed table must not sink an otherwise good metadata run —
      // Build Outputs falls back to "(none)" and the message still goes out.
      options: { response: { response: { neverError: true } }, timeout: 30000 }
    },
    credentials: { airtableTokenApi: airtableCred },
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    position: [3210, 220]
  },
  output: [{ records: [{ id: 'recMOOD000000001', fields: { Mood: 'confident' } }, { id: 'recMOOD000000002', fields: { Mood: 'shocked' } }] }]
});

const metadataModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  version: 1,
  config: {
    name: 'Metadata Model (OpenRouter)',
    parameters: { model: 'openai/gpt-5.1', options: { maxTokens: 8192, responseFormat: 'json_object', temperature: 0.8 } },
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
    position: [1120, 460]
  },
  output: [{ id: 'recEPISODEXXXXXXX', Title: 'EP042 - The Final Cut', ID: 42, Type: 'Clip', Guest: ['recGUEST0000000'], 'Guest Name': ['Alice Nakamoto'], 'Duration (s)': 1500 }]
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
          'Frame.io URL': expr("{{ $('Build Outputs').first().json.frameioUrl }}"),
          'Chapters JSON': []
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true },
          { id: 'Status', displayName: 'Status', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'options', options: [{ name: 'Scheduled', value: 'Scheduled' }, { name: 'Research Ready', value: 'Research Ready' }, { name: 'Stories Picked', value: 'Stories Picked' }, { name: 'Script Ready', value: 'Script Ready' }, { name: 'Recorded', value: 'Recorded' }, { name: 'Transcript Ready', value: 'Transcript Ready' }, { name: 'Edited', value: 'Edited' }, { name: 'AI Analysis Complete', value: 'AI Analysis Complete' }, { name: 'Approved', value: 'Approved' }, { name: 'Artwork Ready', value: 'Artwork Ready' }, { name: 'Published', value: 'Published' }], readOnly: false, removed: false },
          { id: 'Summary', displayName: 'Summary', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Chapters', displayName: 'Chapters', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Transcript', displayName: 'Transcript', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Frame.io URL', displayName: 'Frame.io URL', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false },
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
        // Deliberately SHORT. A sendDocument caption is capped at 1024 chars and
        // the full option set no longer fits; everything Jonny replies to now
        // lives in the separate "Send Packaging Request" message below.
        caption: expr("📺 <b>Episode metadata ready</b>\n\n<b>{{ $('Build Outputs').first().json.episodeTitleHtml }}</b> · <code>{{ $('Build Outputs').first().json.episodeId }}</code>\n\nFull timecoded description is in this file. Your options are in the next message.")
      }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 5000,
    position: [4860, 220]
  },
  output: [{ ok: true, result: { message_id: 1 } }]
});

// ---- The "your turn" message ----------------------------------------------
// This is the message Jonny REPLIES to, and the Telegram Airtable Assistant
// treats the replied-to message as its spec — so everything needed to act must
// be in this one message: the options, their labels, what's already set, and
// which field each answer lands in. A sendMessage allows 4096 chars (vs 1024
// for a document caption), which is why the file and this are now separate.
const sendPackagingRequest = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Packaging Request',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: '-5254203539',
      text: expr(
        "🎬 <b>Packaging for {{ $('Build Outputs').first().json.episodeTitleHtml }}</b> · <code>{{ $('Build Outputs').first().json.episodeId }}</code>\n\n" +
        "<b>Already set</b>\nTitle: {{ $('Build Outputs').first().json.currentTitleText }}\nGuests: {{ $('Build Outputs').first().json.guestsText }}\n\n" +
        "<b>1 · Title</b> → <i>Title</i>\n{{ $('Build Outputs').first().json.titlesTextHtml }}\nReply <b>T1</b>–<b>T5</b>, or write your own. Skip this to keep the title above.\n\n" +
        "<b>2 · Thumbnail caption</b> → <i>Thumbnail Caption</i>\n{{ $('Build Outputs').first().json.capsTextHtml }}\nReply <b>TC1</b>–<b>TC5</b>, or write your own.\n\n" +
        "<b>3 · Guests</b> → <i>Guests</i>\nName anyone to add, e.g. \"add Bitcoin Mechanic\". They must already exist in the Guests table — I'll tell you if there's no match rather than creating a half-empty record.\n\n" +
        "<b>4 · Thumbnail moods</b> → <i>Thumbnail Moods</i>\n{{ $('Build Outputs').first().json.moodsText }}\nReply with the names you want, e.g. \"moods: confident, shocked\". They cycle across the 4 artwork options. Skip this to use the whole library.\n\n" +
        "<b>5 · Image prompt</b> → <i>Custom Image Prompt</i> <b>(required)</b>\nDescribe the artwork you want and it's added to the standard prompt. Reply <b>default</b> for no extra direction.\n\n" +
        "⚠️ Artwork does not start until the image prompt is filled in."
      ),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 5000,
    position: [5080, 220]
  },
  output: [{ ok: true, result: { message_id: 2 } }]
});

// ---- Duration from Gemini -------------------------------------------------
// Frame.io's file object exposes NO duration field, so we read it from the
// Gemini file resource (videoMetadata.videoDuration, e.g. "202s") once the file
// is ACTIVE. This node sits on Is File Active's true branch, so $json is the
// ACTIVE Get File State output (unambiguous even after multiple poll runs).
const parseDuration = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Parse Duration',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [
        { id: 'pd1', name: 'durationSeconds', value: expr("{{ Math.round(Number(String(($json.videoMetadata && $json.videoMetadata.videoDuration) || '0').replace(/[^0-9.]/g, '')) || 0) }}"), type: 'number' }
      ] },
      includeOtherFields: true,
      options: {}
    },
    position: [2880, 420]
  },
  output: [{ durationSeconds: 202 }]
});

// ---- Same-length short-circuit -------------------------------------------
// On a re-upload, if the new Gemini duration exactly matches the duration we
// stored last time, assume a bug-fix re-export: skip transcription + AI metadata
// and just refresh the Frame.io URL. Needs durationSeconds > 0 AND equal to the
// stored value, so a missing/zero baseline always falls through to the full run.
const sameLengthIf = ifElse({
  version: 2.3,
  config: {
    name: 'Same Length?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          { id: 'cond-dur-positive', leftValue: expr("{{ $('Parse Duration').first().json.durationSeconds }}"), operator: { type: 'number', operation: 'gt' }, rightValue: 0 },
          { id: 'cond-dur-equal', leftValue: expr("{{ $('Parse Duration').first().json.durationSeconds }}"), operator: { type: 'number', operation: 'equals' }, rightValue: expr("{{ $('Find Episode').first().json['Duration (s)'] }}") }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [3100, 420]
  }
});

const swapUrl = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Swap Frame.io URL',
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
          'Frame.io URL': expr("{{ $('Extract Episode Info').first().json.webUrl || (($('Create Review Link').first().json.data || {}).short_url) || $('Extract Episode Info').first().json.downloadUrl }}")
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true },
          { id: 'Frame.io URL', displayName: 'Frame.io URL', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    onError: 'continueRegularOutput',
    position: [3320, 560]
  },
  output: [{ id: 'recEPISODEXXXXXXX', 'Frame.io URL': 'https://next.frame.io/project/abc/view/def' }]
});

// Persists the duration on full runs so the next re-upload has a baseline.
// Kept as its OWN node (error-continue) so a missing 'Duration (s)' field can
// never fail the main metadata write in 'Set Status AI Analysis Complete'.
const storeDuration = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Store Duration',
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
          'Duration (s)': expr("{{ $('Parse Duration').first().json.durationSeconds }}")
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true },
          { id: 'Duration (s)', displayName: 'Duration (s)', required: false, defaultMatch: false, canBeUsedToMatch: false, display: true, type: 'number', readOnly: false, removed: false }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    onError: 'continueRegularOutput',
    position: [3980, 400]
  },
  output: [{ id: 'recEPISODEXXXXXXX', 'Duration (s)': 1500 }]
});

// ---- _Bypass short-circuit ------------------------------------------------
// If the Frame.io file name ends with "_Bypass" (case-insensitive, extension
// ignored), skip the whole AI pipeline — no transcript, no metadata, no
// Telegram — and just refresh the episode's 'Frame.io URL' via the existing
// 'Swap Frame.io URL' node, the same effect as the same-length re-upload path.
const bypassIf = ifElse({
  version: 2.3,
  config: {
    name: 'Name Ends _Bypass?',
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          { id: 'cond-bypass', leftValue: expr("{{ /_bypass$/i.test(String($('Extract Episode Info').first().json.fileName || '').replace(/\\.[a-zA-Z0-9]+$/, '').trim()) }}"), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1340, 460]
  }
});

// ---- Media type guard -------------------------------------------------------
// The webhook fires on EVERY file.ready in the Frame.io project, including
// non-media files. Gate the pipeline on a real video/audio + a download URL.
// Audio files use ml.original as their download URL (no efficient proxy).
// Non-media uploads (images, PDFs, etc.) get a heads-up Telegram message.
const isVideoIf = ifElse({
  version: 2.3,
  config: {
    name: 'Is Video or Audio?',
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          { id: 'cond-mime-media', leftValue: expr("{{ $('Extract Episode Info').first().json.mimeType }}"), operator: { type: 'string', operation: 'regex' }, rightValue: '^(video|audio)/' },
          { id: 'cond-has-url', leftValue: expr("{{ $('Extract Episode Info').first().json.downloadUrl }}"), operator: { type: 'string', operation: 'startsWith' }, rightValue: 'http' }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1120, 140]
  }
});

const notifySkipped = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Notify Skipped (Non-Media)',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: '-5254203539',
      text: expr("⏭️ <b>Ignored non-media upload</b>\nEpisode <code>{{ $('Extract Episode Info').first().json.episodeId || 'no-id' }}</code>\n<code>{{ $('Extract Episode Info').first().json.fileName }}</code> ({{ $('Extract Episode Info').first().json.mimeType }})\nOnly video and audio files are transcribed. Skipping."),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 5000,
    position: [1340, 140]
  },
  output: [{ ok: true, result: { message_id: 1 } }]
});

const setupNote = sticky(
  "## Frame.io -> AI metadata -> Telegram\n\nVideo and audio uploads are both transcribed via Gemini. Non-media uploads (images, PDFs, etc.) are skipped via 'Is Video or Audio?'. A file name ending '_Bypass' skips the whole AI pipeline and just refreshes 'Frame.io URL'. Duration comes from Gemini (videoMetadata.videoDuration), not Frame.io. Same-length re-upload just refreshes 'Frame.io URL'. Summary geared to Episodes 'Type' + 'Guest Name'. Delivery is TWO Telegram messages: the description file (short caption), then 'Send Packaging Request' — the message Jonny replies to, carrying title/caption options, the guests + title already set, the mood library, and the required Custom Image Prompt. Artwork will not start until 'Custom Image Prompt' is filled. Telegram sends and the idempotent Frame.io/Gemini calls (Show File, Download Proxy, Start Gemini Upload, Get File State, Transcribe with Gemini) retry 5x/5s on transient failures (DNS, Gemini 503).",
  [frameioTrigger, parseEvent, showFile],
  { color: 4 }
);

export default workflow('jroXHciDvy0sWlRM', 'BA - Frame.io Uploaded > AI Metadata')
  .add(setupNote)
  .add(frameioTrigger)
  .to(parseEvent)
  .to(showFile)
  .to(extractInfo)
  .to(isVideoIf
    .onTrue(createReviewLink)
    .onFalse(notifySkipped))
  .add(createReviewLink)
  .to(findEpisode)
  .to(bypassIf
    .onTrue(swapUrl)
    .onFalse(downloadProxy))
  .add(downloadProxy)
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
      parseDuration
        .to(sameLengthIf
          .onTrue(swapUrl)
          .onFalse(
            transcribe
              .to(extractTranscript)
              .to(fetchMoodLibrary)
              .to(generateMetadata)
              .to(buildOutputs)
              .to(updateStatus)
              .to(storeDuration)
              .to(uploadChaptersAttachment)
              .to(injectMdData)
              .to(convertToFile)
              .to(sendToTelegram)
              .to(sendPackagingRequest)
          ))
    )
    .onFalse(waitProcessing));
