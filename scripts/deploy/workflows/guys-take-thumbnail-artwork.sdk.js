import { workflow, node, trigger, ifElse, newCredential } from '@n8n/workflow-sdk';

// ===== NEW REVISION-CHAIN NODES =====
const revisionRequested = trigger({
  type: 'n8n-nodes-base.airtableTrigger',
  version: 1,
  config: {
    name: 'Revision Requested',
    position: [0, 816],
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      authentication: 'airtableTokenApi',
      baseId: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9' },
      tableId: { __rl: true, value: 'tblkcASzE4DXlxokO', mode: 'id' },
      triggerField: 'Last Modified Time',
      additionalFields: { viewId: 'viwGVYiheuTD2pPlx' }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') }
  },
  output: [{}]
});

const planRevision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan Revision',
    position: [224, 816],
    parameters: {
      jsCode: "const rec = $input.first().json;\nconst f = rec.fields || rec;\nconst ep = Array.isArray(f['Episode']) ? f['Episode'][0] : (f['Episode'] || null);\nconst caption = f['Caption'] || '';\nconst brief = String(f['Revision Brief'] || '').trim();\nlet targets = f['Revision Targets'] || [];\nif (typeof targets === 'string') targets = targets.split(',').map(s => s.trim());\ntargets = targets.filter(t => ['16x9', '1x1', '9x16'].includes(t));\nif (!ep || !brief || !targets.length) {\n  throw new Error('Revision needs an Episode link, a non-empty Revision Brief, and at least one valid Revision Target (16x9 / 1x1 / 9x16). Got targets=' + JSON.stringify(f['Revision Targets']) + ', brief=' + (brief ? 'present' : 'EMPTY'));\n}\nconst meta = {\n  '16x9': { aspectRatio: '16:9', filename: 'thumbnail-16x9.png' },\n  '1x1':  { aspectRatio: '1:1',  filename: 'thumbnail-1x1.png' },\n  '9x16': { aspectRatio: '9:16', filename: 'thumbnail-9x16.png' }\n};\nconst att = (field) => (Array.isArray(f[field]) && f[field][0]) ? f[field][0] : null;\nconst sixteen = att('16x9');\nconst only16x9 = (targets.length === 1 && targets[0] === '16x9');\nreturn targets.map((field) => {\n  const own = att(field);\n  const src = own || sixteen;\n  return {\n    json: {\n      rowId: rec.id,\n      episodeId: ep,\n      caption: caption,\n      brief: brief,\n      field: field,\n      aspectRatio: meta[field].aspectRatio,\n      filename: meta[field].filename,\n      promptRow: 'Artwork Revision',\n      srcUrl: (src && src.url) ? src.url : '',\n      srcType: (src && src.type) ? src.type : 'image/png',\n      targetsCsv: targets.join(','),\n      only16x9: only16x9\n    },\n    pairedItem: { item: 0 }\n  };\n});"
    }
  },
  output: [{}]
});

const downloadRevisionSources = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Revision Sources',
    position: [448, 816],
    parameters: {
      url: '={{ $json.srcUrl }}',
      options: { response: { response: { responseFormat: 'file' } }, timeout: 60000 }
    },
    retryOnFail: true
  },
  output: [{}]
});

const revisionToBase64 = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Revision To Base64',
    position: [672, 816],
    parameters: { operation: 'binaryToPropery', destinationKey: 'dataB64', options: {} }
  },
  output: [{}]
});

const aggregateRevisionSources = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Aggregate Revision Sources',
    position: [896, 816],
    parameters: {
      jsCode: "const plans = $('Plan Revision').all();\nconst b64s = $('Revision To Base64').all();\nif (!plans.length) return [];\nconst first = plans[0].json;\nconst tasks = plans.map((p, i) => {\n  const j = p.json;\n  const data = (b64s[i] && b64s[i].json && b64s[i].json.dataB64) || '';\n  if (!data) throw new Error('No base64 captured for revision source \"' + j.field + '\"');\n  return { field: j.field, aspectRatio: j.aspectRatio, filename: j.filename, promptRow: j.promptRow, mime: j.srcType, dataB64: data };\n});\nconst clearFields = {};\nfor (const t of tasks) clearFields[t.field] = [];\nreturn [{\n  json: {\n    rowId: first.rowId,\n    episodeId: first.episodeId,\n    caption: first.caption,\n    brief: first.brief,\n    only16x9: first.only16x9,\n    targetsCsv: first.targetsCsv,\n    tasks: tasks,\n    clearBody: { fields: clearFields, typecast: true }\n  },\n  pairedItem: { item: 0 }\n}];"
    }
  },
  output: [{}]
});

const fetchEpisodeForTag = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Episode For Tag',
    position: [1120, 816],
    parameters: {
      url: '=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $json.episodeId }}',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      options: { timeout: 30000 }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    retryOnFail: true
  },
  output: [{}]
});

const clearTargetFields = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Clear Target Fields',
    position: [1344, 816],
    parameters: {
      method: 'PATCH',
      url: '=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails/{{ $(\"Aggregate Revision Sources\").first().json.rowId }}',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $(\"Aggregate Revision Sources\").first().json.clearBody }}',
      options: { timeout: 30000 }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    retryOnFail: true
  },
  output: [{}]
});

const fetchRevisionPrompt = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Revision Prompt',
    position: [1568, 816],
    parameters: {
      url: 'https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblhG1nw2P1k3CBVU',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      options: {}
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') }
  },
  output: [{}]
});

const buildRevisionRequests = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Revision Requests',
    position: [1792, 816],
    parameters: {
      jsCode: "const agg = $('Aggregate Revision Sources').first().json;\nconst brief = agg.brief || '';\nconst caption = agg.caption || '';\nconst promptRecs = ((($('Fetch Revision Prompt').first() || {}).json) || {}).records || [];\nconst P = {};\nfor (const r of promptRecs) { const rf = r.fields || {}; if (rf.Name) P[rf.Name] = rf.Prompt || ''; }\nconst render = (t, v) => t.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => (v[k] != null ? v[k] : ''));\nfunction tpl(name) { const t = P[name]; if (!t) throw new Error('Missing prompt row \"' + name + '\" in the Prompts table (check the Name and that the Prompt field is filled)'); return t; }\nreturn agg.tasks.map((t) => {\n  const promptText = render(tpl(t.promptRow), { REVISION: brief, HOOK: caption });\n  const imagePart = { inline_data: { mime_type: t.mime || 'image/png', data: t.dataB64 } };\n  return {\n    json: {\n      rowId: agg.rowId,\n      field: t.field,\n      filename: t.filename,\n      requestBody: {\n        contents: [{ parts: [{ text: promptText }, imagePart] }],\n        generationConfig: {\n          responseModalities: ['TEXT', 'IMAGE'],\n          imageConfig: { aspectRatio: t.aspectRatio, imageSize: '1K' }\n        }\n      }\n    },\n    pairedItem: { item: 0 }\n  };\n});"
    }
  },
  output: [{}]
});

const generateRevisionsNanoBanana = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Generate Revisions (Nano Banana)',
    position: [2016, 816],
    parameters: {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $json.requestBody }}',
      options: { response: { response: { neverError: true } }, timeout: 120000 }
    },
    credentials: { httpHeaderAuth: newCredential('Gemini API Key [n8n]') },
    retryOnFail: true
  },
  output: [{}]
});

const extractRevisions = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Revisions',
    position: [2240, 816],
    parameters: {
      jsCode: "const builds = $('Build Revision Requests').all();\nconst responses = $input.all();\nconst out = [];\nconst diags = [];\nfor (let i = 0; i < responses.length; i++) {\n  const resp = responses[i].json || {};\n  const b = (builds[i] && builds[i].json) || {};\n  const cand = ((resp.candidates || [])[0]) || {};\n  const parts = ((cand.content) || {}).parts || [];\n  const imgPart = parts.find(p => (p.inline_data && p.inline_data.data) || (p.inlineData && p.inlineData.data));\n  if (!imgPart) {\n    const reason = cand.finishReason || (resp.promptFeedback && resp.promptFeedback.blockReason) || 'NO_IMAGE';\n    const msg = cand.finishMessage || (resp.error && (resp.error.message || JSON.stringify(resp.error))) || 'empty response';\n    diags.push((b.field || ('opt' + (i + 1))) + ' [' + reason + ']: ' + String(msg).slice(0, 220));\n    continue;\n  }\n  const inl = imgPart.inline_data || imgPart.inlineData;\n  out.push({ json: { rowId: b.rowId, field: b.field, filename: b.filename, base64: inl.data, contentType: inl.mime_type || inl.mimeType || 'image/png' }, pairedItem: { item: i } });\n}\nif (!out.length) throw new Error('Nano Banana returned no revision image. ' + diags.join(' || '));\nif (diags.length) { console.log('Some revisions failed: ' + diags.join(' || ')); }\nreturn out;"
    }
  },
  output: [{}]
});

const uploadRevision = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload Revision',
    position: [2464, 816],
    parameters: {
      method: 'POST',
      url: '=https://content.airtable.com/v0/app8Xw9Tq0XLjhmp9/{{ $json.rowId }}/{{ $json.field }}/uploadAttachment',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ { "contentType": $json.contentType, "file": $json.base64, "filename": $json.filename } }}',
      options: { batching: { batch: { batchSize: 1, batchInterval: 300 } }, timeout: 60000 }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    retryOnFail: true
  },
  output: [{}]
});

const collectRevisions = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Collect Revisions',
    position: [2688, 816],
    parameters: {
      jsCode: "const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst ups = $('Upload Revision').all();\nconst exs = $('Extract Revisions').all();\nconst agg = $('Aggregate Revision Sources').first().json;\nlet epId = '';\ntry { const ef = ($('Fetch Episode For Tag').first().json.fields) || {}; epId = ef['ID'] || agg.episodeId || ''; } catch (e) { epId = agg.episodeId || ''; }\nconst idTag = epId ? ' <code>' + esc(epId) + '</code>' : '';\nconst label = { '16x9': '16:9', '1x1': '1:1 square', '9x16': '9:16 vertical' };\nconst staleNote = agg.only16x9 ? '\\n<i>Heads up: the 1:1 and 9:16 still derive from the previous 16:9 - brief those too if you want them matched.</i>' : '';\nconst out = [];\nfor (let i = 0; i < ups.length; i++) {\n  const fo = (ups[i].json && ups[i].json.fields) || {};\n  const field = (exs[i] && exs[i].json && exs[i].json.field) || null;\n  const wantName = (exs[i] && exs[i].json && exs[i].json.filename) || null;\n  let url = null;\n  for (const v of Object.values(fo)) {\n    if (Array.isArray(v)) { const hit = v.find(a => a && a.filename === wantName && a.url); if (hit) { url = hit.url; break; } }\n  }\n  if (field && url) {\n    out.push({ json: { photoUrl: url, caption: 'Revised ' + (label[field] || field) + ' artwork' + idTag + staleNote }, pairedItem: { item: i } });\n  }\n}\nif (!out.length) throw new Error('No revised image URLs found to send to Telegram');\nreturn out;"
    }
  },
  output: [{}]
});

const sendRevisions = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Revisions',
    position: [2912, 816],
    parameters: {
      operation: 'sendPhoto',
      chatId: '-5254203539',
      file: '={{ $json.photoUrl }}',
      additionalFields: { caption: '={{ $json.caption }}', parse_mode: 'HTML' }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') }
  },
  output: [{}]
});

const markRowRevised = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Mark Row Revised Final',
    position: [3136, 816],
    parameters: {
      method: 'PATCH',
      url: '=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails/{{ $(\"Aggregate Revision Sources\").first().json.rowId }}',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ { "fields": { "Status": "Final", "Revision Brief": "", "Revision Targets": [] }, "typecast": true } }}',
      options: { timeout: 30000 }
    },
    credentials: { airtableTokenApi: newCredential('Airtable [n8n] (PAT)') },
    retryOnFail: true
  },
  output: [{}]
});

// ===== REBUILT EXISTING NODES (verbatim params) =====
const planGenerate = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Plan Generate",
    position: [224,-32],
    parameters: {"jsCode":"// ── Plan Generate ─────────────────────────────────────────────\n// Reads the episode that entered the \"Ready for 16X9 Thumbnail\" view and\n// derives everything the downstream nodes need: delete query, layout,\n// guest list, Airtable filter formula, and the auto-art flag.\n\n// HTML-escape helper (& < >) for any text that goes into a Telegram HTML message.\nconst esc = s => String(s == null ? '' : s)\n  .replace(/&/g, '&amp;')\n  .replace(/</g, '&lt;')\n  .replace(/>/g, '&gt;');\n\n// The triggering episode record. `fields` when nested, else the record itself.\nconst rec = $('Ready for 16X9 Thumbnail').first().json;\nconst f = rec.fields || rec;\n\n// Old thumbnail rows still linked to this episode -> build the batch-delete query\n// so a re-run starts from a clean slate.\nconst oldIds = Array.isArray(f['Thumbnails']) ? f['Thumbnails'] : [];\nconst deleteQuery = oldIds.map(id => 'records[]=' + encodeURIComponent(id)).join('&');\n\n// Content type drives the layout. Missing Type defaults to Take (solo host).\nconst type = f['Type'] || 'Take';\nconst layout = type === 'Take'\n  ? 'solo'\n  : (type === 'Roundtable' ? 'roundtable' : 'duo'); // Chat / Clip -> duo\nconst autoArt = ['Take', 'Chat', 'Clip', 'Roundtable'].indexOf(type) !== -1;\n\n// Guests to composite into the frame.\n// The host (Guy) is ALWAYS drawn from the Thumbnail References library, so if\n// he's also sitting in the episode's Guests link he'd be rendered twice\n// (this is exactly what happened in exec #1318: Guy + Guy + Bitcoin Mechanic).\n// Strip his guest record here so he can never be double-added.\n// `.filter` tolerates both shapes n8n may return: bare id strings and { id } objects.\nconst HOST_GUEST_REC_ID = 'recs8srWCoJwDuzLn'; // \"Guy\" — host, never a guest\nconst guestIds = (Array.isArray(f['Guests']) ? f['Guests'] : [])\n  .filter(g => (g && g.id ? g.id : g) !== HOST_GUEST_REC_ID);\n\n// Airtable filterByFormula for \"Fetch Guests\" — only this episode's real guests.\n// FALSE() returns nothing when there are no guests (solo / guestless episode).\nconst guestFilter = guestIds.length\n  ? 'OR(' + guestIds.map(id => \"RECORD_ID()='\" + id + \"'\").join(',') + ')'\n  : 'FALSE()';\n\nreturn [{\n  json: {\n    episodeId: rec.id,\n    episodeDisplayId: f['ID'] || rec.id,\n    title: f['Title'] || '',\n    titleHtml: esc(f['Title'] || ''),     // pre-escaped for Telegram HTML mode\n    caption: f['Thumbnail Caption'] || f['Title'] || '',\n    summary: f['Summary'] || '',\n    deleteQuery: deleteQuery,\n    hasOld: oldIds.length > 0,\n    type: type,\n    guestIds: guestIds,\n    guestFilter: guestFilter,\n    layout: layout,\n    autoArt: autoArt\n  }\n}];"}
  },
  output: [{}]
});

const autoArtableType = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.2,
  config: {
    name: "Auto-artable Type?",
    position: [448,-32],
    parameters: {"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"cond-autoart","leftValue":"={{ $json.autoArt }}","rightValue":"","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"},"options":{}}
  },
  output: [{}]
});

const markGenerating = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark Generating",
    position: [672,-128],
    parameters: {"method":"PATCH","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $(\"Plan Generate\").item.json.episodeId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Status\": \"Generating Artwork\" }, \"typecast\": true } }}","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const deleteOldThumbnails = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Delete Old Thumbnails",
    position: [896,-128],
    parameters: {"method":"DELETE","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails?{{ $('Plan Generate').item.json.deleteQuery }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{"response":{"response":{"neverError":true}},"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const fetchMoodReferences = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Fetch Mood References",
    position: [1120,-128],
    parameters: {"url":"https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnail%20References","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const fetchGuests = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Fetch Guests",
    position: [1568,-128],
    parameters: {"url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Guests?filterByFormula={{ encodeURIComponent($(\"Plan Generate\").item.json.guestFilter) }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{"response":{"response":{"neverError":true}},"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const buildMoodPrompt = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Build Mood Prompt",
    position: [1792,-128],
    parameters: {"jsCode":"const refs = (($('Fetch Mood References').first() || {}).json || {}).records || [];\n  const moods = refs.map(r => r.fields && r.fields['Mood']).filter(Boolean);\n  const ep = $('Plan Generate').first().json;\n  \n  const prompt =\n  `You are assigning facial-expression vibes to the 4 thumbnail options for a Bitcoin podcast episode.\n  \n  Episode title: ${ep.title}\n  Thumbnail headline: ${ep.caption}\n  ${ep.summary ? 'Episode summary: ' + ep.summary : ''}\n  \n  Available vibes (use ONLY these): ${moods.join(', ')}\n  \n  First decide how strongly ONE vibe dominates this episode. If a single vibe clearly fits best (for example a hack, crash or crisis is clearly Dramatic/Intense), assign that vibe to MOST \n  or ALL of the 4 slots. Only spread across several different vibes when the episode is genuinely ambiguous and multiple vibes fit equally well.\n  \n  Assign one vibe to each of the 4 slots. Repeats are strongly encouraged when one vibe dominates.\n  \n  Respond ONLY as JSON: {\"slots\":[\"vibe\",\"vibe\",\"vibe\",\"vibe\"]} with exactly 4 entries, each taken from the available list.`;\n  \n  return [{\n    json: {\n      episodeId: ep.episodeId,\n      title: ep.title,\n      caption: ep.caption,\n      requestBody: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }\n    } \n  }];"}
  },
  output: [{}]
});

const pickMoodsGemini = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Pick Moods (Gemini)",
    position: [2016,-128],
    parameters: {"method":"POST","url":"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","sendBody":true,"specifyBody":"json","jsonBody":"={{ $json.requestBody }}","options":{"timeout":60000}},
    credentials: { httpHeaderAuth: newCredential("Gemini API Key [n8n]") }
  },
  output: [{}]
});

const resolveVibes = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Resolve Vibes",
    position: [2240,-128],
    parameters: {"jsCode":"const refs = (($('Fetch Mood References').first() || {}).json || {}).records || [];\n  const moodMap = {};\n  for (const r of refs) {\n    const m = r.fields && r.fields['Mood'];\n    const photo = r.fields && r.fields['Reference Photo'];\n    const att = Array.isArray(photo) && photo[0] ? photo[0] : null;\n    if (m && att && att.url) moodMap[m] = { url: att.url, type: att.type || 'image/jpeg' };\n  } \n  const avail = Object.keys(moodMap);\n  if (!avail.length) throw new Error('No vibes with reference photos in the Thumbnail References table');\n  \n  const ep = $('Build Mood Prompt').first().json;\n  const plan = ($('Plan Generate').first() || {}).json || {};\n  const summary = plan.summary || '';\n  \n  let slots = [];\n  try {\n    const resp = $input.first().json;\n    const parts = ((((resp.candidates || [])[0] || {}).content) || {}).parts || [];\n    const j = JSON.parse((parts[0] || {}).text || '{}');\n    if (Array.isArray(j.slots)) slots = j.slots.filter(m => moodMap[m]);\n  } catch (e) {}\n  \n  const pool = slots.length ? slots : avail;\n  const out = [];\n  for (let i = 0; i < 4; i++) {\n    const vibe = pool[i % pool.length];\n    const ref = moodMap[vibe];\n    out.push({\n      json: {\n        episodeId: ep.episodeId, title: ep.title, caption: ep.caption, summary: summary,\n        vibe: vibe, optionIndex: i + 1, photoUrl: ref.url, photoType: ref.type || 'image/jpeg'\n      },\n      pairedItem: { item: 0 }\n    });\n  } \n  return out;"}
  },
  output: [{}]
});

const planDownloads = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Plan Downloads",
    position: [2464,-128],
    parameters: {"jsCode":"\nconst vibes = $('Resolve Vibes').all();\nconst plan = $('Plan Generate').first().json;\nconst tasks = [];\n\nfor (let i = 0; i < vibes.length; i++) {\n  const v = (vibes[i] || {}).json || {};\n  tasks.push({ kind: 'host', slot: i, photoUrl: v.photoUrl, mime: v.photoType || 'image/jpeg' });\n}\n\n// Fetch Guests is already filtered to this episode's guests, so take all of them.\nif (plan.layout === 'duo') {\n  const guestRecs = ((($('Fetch Guests').first() || {}).json) || {}).records || [];\n  for (const g of guestRecs) {\n    const photo = g.fields && g.fields['Headshot'];\n    const att = Array.isArray(photo) && photo[0] ? photo[0] : null;\n    if (att && att.url) tasks.push({ kind: 'guest', photoUrl: att.url, mime: att.type || 'image/jpeg' });\n  }\n}\n\nreturn tasks.map(t => ({ json: t, pairedItem: { item: 0 } }));\n"}
  },
  output: [{}]
});

const downloadImage = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Download Image",
    position: [2688,-128],
    parameters: {"url":"={{ $json.photoUrl }}","options":{"response":{"response":{"responseFormat":"file"}}}},
    retryOnFail: true
  },
  output: [{}]
});

const imageToBase64 = node({
  type: "n8n-nodes-base.extractFromFile",
  version: 1.1,
  config: {
    name: "Image To Base64",
    position: [2912,-128],
    parameters: {"operation":"binaryToPropery","destinationKey":"dataB64","options":{}}
  },
  output: [{}]
});

const buildImageRequests = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Build Image Requests",
    position: [3136,-128],
    parameters: {"jsCode":"const IMAGE_SIZE = '1K';\nconst tasks  = $('Plan Downloads').all();\nconst files  = $('Image To Base64').all();\nconst vibes  = $('Resolve Vibes').all();\nconst plan   = $('Plan Generate').first().json;\nconst layout = plan.layout || 'solo';   // 'solo' | 'duo' | 'roundtable'\n\n// ---- prompt templates pulled from Airtable (Thumbnail Prompts table) ----\nconst promptRecs = (($('Fetch Prompts').first() || {}).json || {}).records || [];\nconst P = {};\nfor (const r of promptRecs) {\n  const rf = r.fields || {};\n  if (rf.Name) P[rf.Name] = rf.Prompt || '';\n}\nconst ROW_BY_LAYOUT = { solo: 'Solo Thumbnail', duo: 'Duo Thumbnail', roundtable: 'Roundtable Thumbnail' };\nfunction tpl(lay) {\n  const rowName = ROW_BY_LAYOUT[lay];\n  const t = P[rowName];\n  if (!t) throw new Error('Missing prompt row \"' + rowName + '\" in Thumbnail Prompts (layout: ' + lay + ')');\n  return t;\n}\nconst render = (t, v) => t.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => (v[k] != null ? v[k] : ''));\n\n// per-option framing (solo/duo only; the roundtable template has no {{VARIATION}} slot)\nconst variations = [\n  'Tight close-up framing with the headline across the top; warm orange key light.',\n  'Slightly wider framing with the headline in a lower band; clean, punchy, high-key lighting.',\n  'Dramatic low camera angle with strong shadows and a single bright rim light.',\n  'Bold off-centre composition with strong negative space reserved for the headline.'\n];\n\n// zip download tasks with their base64 by position (hosts first, then guests)\nconst hostBySlot = {};\nconst guestParts = [];\nfor (let i = 0; i < tasks.length; i++) {\n  const t = (tasks[i] || {}).json || {};\n  const b64 = ((files[i] || {}).json || {}).dataB64;\n  if (!b64) continue;\n  if (t.kind === 'host') hostBySlot[t.slot] = { mime: t.mime || 'image/jpeg', data: b64 };\n  else if (t.kind === 'guest') guestParts.push({ inline_data: { mime_type: t.mime || 'image/jpeg', data: b64 } });\n}\n\nconst useGuests = layout !== 'solo' && guestParts.length > 0;\nconst key = useGuests ? layout : 'solo';   // duo/roundtable with no guest images fall back to solo\n\nconst out = [];\nfor (let i = 0; i < vibes.length; i++) {\n  const m = (vibes[i] || {}).json || {};\n  const host = hostBySlot[i];\n  if (!host) throw new Error('No host image for option ' + (i + 1));\n  const prompt = render(tpl(key), {\n    HOOK: m.caption,\n    CONTEXT: m.summary || m.caption,\n    VIBE: m.vibe,\n    VARIATION: variations[i % variations.length]\n  });\n  const parts = [{ text: prompt }, { inline_data: { mime_type: host.mime, data: host.data } }];\n  if (useGuests) for (let g = 0; g < guestParts.length; g++) parts.push(guestParts[g]);\n  out.push({\n    json: {\n      episodeId: m.episodeId, title: m.title, caption: m.caption, mood: m.vibe,\n      optionIndex: m.optionIndex || (i + 1), layout: key, imageCount: parts.length - 1,\n      requestBody: { contents: [{ parts: parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: IMAGE_SIZE } } }\n    },\n    pairedItem: { item: 0 }\n  });\n}\nreturn out;"}
  },
  output: [{}]
});

const generateThumbnailNanoBanana = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Generate Thumbnail (Nano Banana)",
    position: [3360,-128],
    parameters: {"method":"POST","url":"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","sendBody":true,"specifyBody":"json","jsonBody":"={{ $json.requestBody }}","options":{"response":{"response":{"neverError":true}},"timeout":120000}},
    credentials: { httpHeaderAuth: newCredential("Gemini API Key [n8n]") }
  },
  output: [{}]
});

const extractImages = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Extract Images",
    position: [3584,-128],
    parameters: {"jsCode":"\nconst builds = $('Build Image Requests').all();\nconst responses = $input.all();\nconst out = [];\nconst diags = [];\nfor (let i = 0; i < responses.length; i++) {\n  const resp = responses[i].json || {};\n  const b = (builds[i] && builds[i].json) || {};\n  const cand = ((resp.candidates || [])[0]) || {};\n  const parts = ((cand.content) || {}).parts || [];\n  const imgPart = parts.find(p => (p.inline_data && p.inline_data.data) || (p.inlineData && p.inlineData.data));\n  if (!imgPart) {\n    const reason = cand.finishReason || (resp.promptFeedback && resp.promptFeedback.blockReason) || 'NO_IMAGE';\n    const msg = cand.finishMessage || (resp.error && (resp.error.message || JSON.stringify(resp.error))) || ((parts.find(p => p.text) || {}).text) || 'empty response';\n    diags.push('opt' + (i + 1) + ' [' + reason + ']: ' + String(msg).slice(0, 220));\n    continue;\n  }\n  const inl = imgPart.inline_data || imgPart.inlineData;\n  out.push({\n    json: {\n      episodeId: b.episodeId,\n      title: b.title,\n      caption: b.caption,\n      mood: b.mood,\n      optionIndex: b.optionIndex || (i + 1),\n      base64: inl.data,\n      contentType: inl.mime_type || inl.mimeType || 'image/png',\n      filename: 'thumbnail-' + (b.mood || ('opt' + (i + 1))) + '.png'\n    },\n    pairedItem: { item: i }\n  });\n}\nif (!out.length) throw new Error('Nano Banana returned no image for any option. ' + diags.join(' || '));\nif (diags.length) { console.log('Some options failed: ' + diags.join(' || ')); }\nreturn out;\n"}
  },
  output: [{}]
});

const createThumbnailRow = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Create Thumbnail Row",
    position: [3808,-128],
    parameters: {"method":"POST","url":"https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Name\": $json.title + \" / \" + $json.mood, \"Episode\": [$json.episodeId], \"Mood\": [$json.mood], \"Caption\": $json.caption, \"Option\": $json.optionIndex, \"Status\": \"Proposed\" }, \"typecast\": true } }}","options":{"batching":{"batch":{"batchSize":1,"batchInterval":300}},"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const upload16x9 = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Upload 16x9",
    position: [4032,-128],
    parameters: {"method":"POST","url":"=https://content.airtable.com/v0/app8Xw9Tq0XLjhmp9/{{ $json.id }}/16x9/uploadAttachment","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"contentType\": $(\"Extract Images\").item.json.contentType, \"file\": $(\"Extract Images\").item.json.base64, \"filename\": $(\"Extract Images\").item.json.filename } }}","options":{"batching":{"batch":{"batchSize":1,"batchInterval":300}},"timeout":60000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") },
    retryOnFail: true
  },
  output: [{}]
});

const collectThumbnails = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Collect Thumbnails",
    position: [4256,-128],
    parameters: {"jsCode":"const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n  const ups = $('Upload 16x9').all();\n  const exs = $('Extract Images').all();\n  const rows = $('Create Thumbnail Row').all();\n  let urls = ups.map(u => {\n    const fo = (u.json && u.json.fields) || {};\n    const arr = Object.values(fo).find(v => Array.isArray(v)) || [];\n    return arr[0] && arr[0].url;\n  }).filter(Boolean);\n  const ids = rows.map(r => r.json && r.json.id).filter(Boolean);\n  let moods = exs.map(e => e.json.mood);\n  const ep = $('Build Image Requests').first().json;\n  if (urls.length < 2) {\n    throw new Error('Only ' + urls.length + ' thumbnail(s) generated - a Telegram album needs at least 2. The Thumbnails rows still exist in Airtable; re-run the episode to try for a full set.');\n  }\n  const realCount = urls.length;\n  // The Telegram album is built from 4 static slots, so pad short sets by repeating the last image\n  // (rare now generation is reliable) to avoid an empty slot, which Telegram rejects.\n  while (urls.length < 4) { urls.push(urls[urls.length - 1]); moods.push(moods[moods.length - 1] || ''); }\n  const titleHtml = esc(ep.title || '');\n  const captions = urls.map((u, i) => i === 0\n    ? ('Option 1 (' + esc(moods[0] || '') + '): ' + titleHtml)\n    : ('Option ' + (i + 1) + ': ' + esc(moods[i] || '')));\n  return [{\n    json: { episodeId: ep.episodeId, title: ep.title, titleHtml: titleHtml, urls: urls, ids: ids, moods: moods, captions: captions, realCount: realCount, count: realCount },\n    pairedItem: { item: 0 }\n  }];"}
  },
  output: [{}]
});

const sendThumbnailOptions = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Send Thumbnail Options",
    position: [4480,-128],
    parameters: {"operation":"sendMediaGroup","chatId":"-5254203539","media":{"media":[{"media":"={{ $json.urls[0] }}","additionalFields":{"caption":"={{ $json.captions[0] }}","parse_mode":"HTML"}},{"media":"={{ $json.urls[1] }}","additionalFields":{"caption":"={{ $json.captions[1] }}","parse_mode":"HTML"}},{"media":"={{ $json.urls[2] }}","additionalFields":{"caption":"={{ $json.captions[2] }}","parse_mode":"HTML"}},{"media":"={{ $json.urls[3] }}","additionalFields":{"caption":"={{ $json.captions[3] }}","parse_mode":"HTML"}}]},"additionalFields":{}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "e0ebe366-cb60-4698-b35c-bea31acca5e2"
  },
  output: [{}]
});

const sendPickInstructions = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Send Pick Instructions",
    position: [4704,-128],
    parameters: {"chatId":"-5254203539","text":"=Reply with 1, 2, 3 or 4 to pick the thumbnail for \"{{ $('Collect Thumbnails').item.json.titleHtml }}\" ({{ $('Plan Generate').first().json.episodeDisplayId || 'no-id' }}) — or set a row's Status to Selected in the Thumbnails table. I'll reject the others and mark the episode Artwork Ready.","additionalFields":{"appendAttribution":false,"parse_mode":"HTML"}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "c8d18396-8119-4b1b-b208-99207bf47c9b"
  },
  output: [{}]
});

const markAwaitingPick = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark Awaiting Pick",
    position: [4928,-128],
    parameters: {"method":"PATCH","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $(\"Collect Thumbnails\").item.json.episodeId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Status\": \"Awaiting Thumbnail Pick\" } } }}","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const markManualArtwork = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark Manual Artwork",
    position: [672,64],
    parameters: {"method":"PATCH","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $(\"Plan Generate\").item.json.episodeId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Status\": \"Awaiting Manual Artwork\" }, \"typecast\": true } }}","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const notifyManual = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Notify Manual",
    position: [896,64],
    parameters: {"chatId":"-5254203539","text":"=Episode \"{{ $(\"Plan Generate\").item.json.titleHtml }}\" ({{ $(\"Plan Generate\").item.json.episodeId || \"no-id\" }}) is type {{ $(\"Plan Generate\").item.json.type }} — skipping auto thumbnails. Please art this one manually.","additionalFields":{"appendAttribution":false,"parse_mode":"HTML"}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "9c191313-ea57-405a-bfa2-db3e8fe7070d"
  },
  output: [{}]
});

const thumbnailSelected = trigger({
  type: "n8n-nodes-base.airtableTrigger",
  version: 1,
  config: {
    name: "Thumbnail Selected",
    position: [0,384],
    parameters: {"pollTimes":{"item":[{"mode":"everyMinute"}]},"authentication":"airtableTokenApi","baseId":{"__rl":true,"mode":"id","value":"app8Xw9Tq0XLjhmp9"},"tableId":{"__rl":true,"value":"tblkcASzE4DXlxokO","mode":"id"},"triggerField":"Last Modified Time","additionalFields":{"viewId":"viw7AHjnX9ZkvIrKo"}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const resolveSelected = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Resolve Selected",
    position: [432,384],
    parameters: {"jsCode":"// Pick the first Selected row that is actually linked to an episode.\n// Skips orphan rows (Selected but no Episode) instead of bailing, so a real\n// pick sitting behind an orphan in the same poll still gets processed.\n// Downstream handles ONE selection; Check Extra Picks warns about extras.\nlet rec = null, f = null, ep = null;\nfor (const item of $input.all()) {\n  const cand = item.json;\n  const cf = cand.fields || cand;\n  const cep = Array.isArray(cf['Episode']) ? cf['Episode'][0] : (cf['Episode'] || null);\n  if (cep) { rec = cand; f = cf; ep = cep; break; }\n}\nif (!ep) return [];\nconst att = Array.isArray(f['16x9']) && f['16x9'][0] ? f['16x9'][0] : null;\n\nconst has1x1  = Array.isArray(f['1x1'])  && f['1x1'].length  > 0;\nconst has9x16 = Array.isArray(f['9x16']) && f['9x16'].length > 0;\n\nreturn [{\n  json: {\n    selectedRowId: rec.id,\n    episodeId: ep,\n    caption: f['Caption'] || '',\n    sixteenUrl: att && att.url ? att.url : '',\n    sixteenType: att && att.type ? att.type : 'image/png',\n    need1x1: !has1x1,\n    need9x16: !has9x16,\n    url1x1: has1x1 ? (f['1x1'][0].url || '') : '',\n    url9x16: has9x16 ? (f['9x16'][0].url || '') : ''\n  },\n  pairedItem: { item: 0 }\n}];"}
  },
  output: [{}]
});

const getEpisodeThumbnails = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Get Episode Thumbnails",
    position: [656,288],
    parameters: {"url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $json.episodeId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const computeRejects = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Compute Rejects",
    position: [880,288],
    parameters: {"jsCode":"\nconst esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst sel = $('Resolve Selected').first().json;\nconst epRec = $input.first().json;\nconst f = epRec.fields || epRec;\nconst all = Array.isArray(f['Thumbnails']) ? f['Thumbnails'] : [];\nconst records = all.filter(id => id !== sel.selectedRowId).map(id => ({ id: id, fields: { Status: 'Rejected' } }));\nreturn [{\n  json: { episodeId: sel.episodeId, episodeDisplayId: f['ID'] || sel.episodeId, selectedRowId: sel.selectedRowId, title: f['Title'] || '', titleHtml: esc(f['Title'] || ''), hasRejects: records.length > 0, body: { records: records, typecast: false } },\n  pairedItem: { item: 0 }\n}];\n"}
  },
  output: [{}]
});

const rejectSiblings = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Reject Siblings",
    position: [1104,288],
    parameters: {"method":"PATCH","url":"https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ $json.body }}","options":{"response":{"response":{"neverError":true}},"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const markEpisodeArtworkReady = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark Episode Artwork Ready",
    position: [1328,288],
    parameters: {"method":"PATCH","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tbl3uYLIvtB9APZp6/{{ $(\"Compute Rejects\").item.json.episodeId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Status\": \"Artwork Ready\", \"Thumbnails\": [$(\"Compute Rejects\").item.json.selectedRowId] } } }}","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const markSelectedFinal = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Mark Selected Final",
    position: [1552,288],
    parameters: {"method":"PATCH","url":"=https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/Thumbnails/{{ $(\"Compute Rejects\").item.json.selectedRowId }}","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"fields\": { \"Status\": \"Final\" }, \"typecast\": true } }}","options":{"timeout":30000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const confirmThumbnailSet = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Confirm Thumbnail Set",
    position: [1776,288],
    parameters: {"chatId":"-5254203539","text":"=Thumbnail selected for \"{{ $(\"Compute Rejects\").item.json.titleHtml }}\" ({{ $(\"Compute Rejects\").item.json.episodeDisplayId || \"no-id\" }}). Episode is now Artwork Ready. {{ ($(\"Resolve Selected\").first().json.need1x1 && $(\"Resolve Selected\").first().json.need9x16) ? \"Generating 1:1 and 9:16 versions now.\" : ($(\"Resolve Selected\").first().json.need1x1 ? \"Generating the 1:1 version now.\" : ($(\"Resolve Selected\").first().json.need9x16 ? \"Generating the 9:16 version now.\" : \"Both 1:1 and 9:16 versions are already in place.\")) }}","additionalFields":{"appendAttribution":false,"parse_mode":"HTML"}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "9ea34dee-3ad3-4f8a-b294-2cd7a853dabd"
  },
  output: [{}]
});

const downloadSelected16x9 = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Download Selected 16x9",
    position: [880,480],
    parameters: {"url":"={{ $json.sixteenUrl }}","options":{"response":{"response":{"responseFormat":"file"}},"timeout":60000}},
    retryOnFail: true
  },
  output: [{}]
});

const selectedToBase64 = node({
  type: "n8n-nodes-base.extractFromFile",
  version: 1.1,
  config: {
    name: "Selected To Base64",
    position: [1104,480],
    parameters: {"operation":"binaryToPropery","destinationKey":"dataB64","options":{}}
  },
  output: [{}]
});

const buildReversionRequests = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Build Reversion Requests",
    position: [1552,480],
    parameters: {"jsCode":"const sel = $('Resolve Selected').first().json;\nconst b64 = $('Selected To Base64').first().json.dataB64;\nif (!b64) throw new Error('No base64 for the selected 16x9 image');\nconst caption = sel.caption || '';\nconst mime = sel.sixteenType || 'image/png';\nconst imagePart = { inline_data: { mime_type: mime, data: b64 } };\n\n// prompt templates from the Thumbnail Prompts Airtable table (field is named \"Prompt\")\nconst promptRecs = (($('Fetch Reversion Prompts').first() || {}).json || {}).records || [];\nconst P = {};\nfor (const r of promptRecs) {\n  const rf = r.fields || {};\n  if (rf.Name) P[rf.Name] = rf.Prompt || '';\n}\nconst render = (t, v) => t.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => (v[k] != null ? v[k] : ''));\nfunction tpl(name) {\n  const t = P[name];\n  if (!t) throw new Error('Missing prompt row \"' + name + '\" in Thumbnail Prompts (check the Name and that the Prompt field is filled)');\n  return t;\n}\n\n// only regenerate the aspect ratios that are actually missing on the row\nconst need = { '1x1': sel.need1x1, '9x16': sel.need9x16 };\nconst targets = [\n  { field: '1x1',  aspectRatio: '1:1',  filename: 'thumbnail-1x1.png',  row: 'Reversion 1x1' },\n  { field: '9x16', aspectRatio: '9:16', filename: 'thumbnail-9x16.png', row: 'Reversion 9x16' }\n].filter(t => need[t.field]);\n\n// both already present -> return nothing -> the rest of the branch (incl. Telegram) is skipped\nif (!targets.length) return [];\n\nreturn targets.map((t) => ({\n  json: {\n    rowId: sel.selectedRowId,\n    field: t.field,\n    filename: t.filename,\n    requestBody: {\n      contents: [{ parts: [{ text: render(tpl(t.row), { HOOK: caption }) }, imagePart] }],\n      generationConfig: {\n        responseModalities: ['TEXT', 'IMAGE'],\n        imageConfig: { aspectRatio: t.aspectRatio, imageSize: '1K' }\n      }\n    }\n  },\n  pairedItem: { item: 0 }\n}));"}
  },
  output: [{}]
});

const generateReversionsNanoBanana = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Generate Reversions (Nano Banana)",
    position: [1776,480],
    parameters: {"method":"POST","url":"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","sendBody":true,"specifyBody":"json","jsonBody":"={{ $json.requestBody }}","options":{"response":{"response":{"neverError":true}},"timeout":120000}},
    credentials: { httpHeaderAuth: newCredential("Gemini API Key [n8n]") },
    retryOnFail: true
  },
  output: [{}]
});

const extractReversions = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Extract Reversions",
    position: [2000,480],
    parameters: {"jsCode":"\nconst builds = $('Build Reversion Requests').all();\nconst responses = $input.all();\nconst out = [];\nconst diags = [];\nfor (let i = 0; i < responses.length; i++) {\n  const resp = responses[i].json || {};\n  const b = (builds[i] && builds[i].json) || {};\n  const cand = ((resp.candidates || [])[0]) || {};\n  const parts = ((cand.content) || {}).parts || [];\n  const imgPart = parts.find(p => (p.inline_data && p.inline_data.data) || (p.inlineData && p.inlineData.data));\n  if (!imgPart) {\n    const reason = cand.finishReason || (resp.promptFeedback && resp.promptFeedback.blockReason) || 'NO_IMAGE';\n    const msg = cand.finishMessage || (resp.error && (resp.error.message || JSON.stringify(resp.error))) || 'empty response';\n    diags.push((b.field || ('opt' + (i + 1))) + ' [' + reason + ']: ' + String(msg).slice(0, 220));\n    continue;\n  }\n  const inl = imgPart.inline_data || imgPart.inlineData;\n  out.push({\n    json: {\n      rowId: b.rowId,\n      field: b.field,\n      filename: b.filename,\n      base64: inl.data,\n      contentType: inl.mime_type || inl.mimeType || 'image/png'\n    },\n    pairedItem: { item: i }\n  });\n}\nif (!out.length) throw new Error('Nano Banana returned no reversion image. ' + diags.join(' || '));\nif (diags.length) { console.log('Some reversions failed: ' + diags.join(' || ')); }\nreturn out;\n"}
  },
  output: [{}]
});

const uploadReversion = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Upload Reversion",
    position: [2224,480],
    parameters: {"method":"POST","url":"=https://content.airtable.com/v0/app8Xw9Tq0XLjhmp9/{{ $json.rowId }}/{{ $json.field }}/uploadAttachment","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","sendBody":true,"specifyBody":"json","jsonBody":"={{ { \"contentType\": $json.contentType, \"file\": $json.base64, \"filename\": $json.filename } }}","options":{"batching":{"batch":{"batchSize":1,"batchInterval":300}},"timeout":60000}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") },
    retryOnFail: true
  },
  output: [{}]
});

const readyFor16x9Thumbnail = trigger({
  type: "n8n-nodes-base.airtableTrigger",
  version: 1,
  config: {
    name: "Ready for 16X9 Thumbnail",
    position: [0,-32],
    parameters: {"pollTimes":{"item":[{"mode":"everyMinute"}]},"authentication":"airtableTokenApi","baseId":{"__rl":true,"mode":"id","value":"app8Xw9Tq0XLjhmp9"},"tableId":{"__rl":true,"mode":"id","value":"tbl3uYLIvtB9APZp6"},"triggerField":"Last Modified Time","additionalFields":{"viewId":"viwqgtrry8n6yNgqW"}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const fetchPrompts = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Fetch Prompts",
    position: [1344,-128],
    parameters: {"url":"https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblhG1nw2P1k3CBVU","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const fetchReversionPrompts = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Fetch Reversion Prompts",
    position: [1328,480],
    parameters: {"url":"https://api.airtable.com/v0/app8Xw9Tq0XLjhmp9/tblhG1nw2P1k3CBVU","authentication":"predefinedCredentialType","nodeCredentialType":"airtableTokenApi","options":{}},
    credentials: { airtableTokenApi: newCredential("Airtable [n8n] (PAT)") }
  },
  output: [{}]
});

const collectReversions = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Collect Reversions",
    position: [2448,480],
    parameters: {"jsCode":"const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst ups = $('Upload Reversion').all();\nconst exs = $('Extract Reversions').all();\n\nlet epId = '';\ntry { epId = $('Compute Rejects').first().json.episodeDisplayId || ''; } catch (e) {}\nconst idTag = epId ? ' <code>' + esc(epId) + '</code>' : '';\n\nconst label = { '1x1': '1:1 square', '9x16': '9:16 vertical' };\nconst out = [];\nfor (let i = 0; i < ups.length; i++) {\n  const fo = (ups[i].json && ups[i].json.fields) || {};\n  const field = (exs[i] && exs[i].json && exs[i].json.field) || null;\n  const wantName = (exs[i] && exs[i].json && exs[i].json.filename) || null;\n  // Airtable's uploadAttachment response keys fields by field ID (not name) and can\n  // include OTHER already-present attachments, so match the file we just uploaded by its filename.\n  let url = null;\n  for (const v of Object.values(fo)) {\n    if (Array.isArray(v)) {\n      const hit = v.find(a => a && a.filename === wantName && a.url);\n      if (hit) { url = hit.url; break; }\n    }\n  }\n  if (field && url) {\n    out.push({\n      json: { photoUrl: url, caption: 'New ' + (label[field] || field) + ' artwork' + idTag },\n      pairedItem: { item: i }\n    });\n  }\n}\nif (!out.length) throw new Error('No new reversion image URLs found to send to Telegram');\nreturn out;"}
  },
  output: [{}]
});

const sendReversions = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Send Reversions",
    position: [2672,480],
    parameters: {"operation":"sendPhoto","chatId":"-5254203539","file":"={{ $json.photoUrl }}","additionalFields":{"caption":"={{ $json.caption }}","parse_mode":"HTML"}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "fc404d49-bdb1-4369-b828-9d00144cac20"
  },
  output: [{}]
});

const needsReversion = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.2,
  config: {
    name: "Needs Reversion?",
    position: [656,480],
    parameters: {"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"id":"cond-needrev","leftValue":"={{ $json.need1x1 || $json.need9x16 }}","rightValue":"","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"},"options":{}}
  },
  output: [{}]
});

const checkExtraPicks = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Check Extra Picks",
    position: [224,544],
    parameters: {"jsCode":"// Guardrail for the .first() limitation in Resolve Selected.\n// The Airtable poll can return several rows flipped to \"Selected\" inside one\n// 60s window; Resolve Selected only processes the FIRST. Warn about any extras,\n// which would otherwise be silently dropped and never re-fire (their Last\n// Modified Time won't advance again on its own).\nconst esc = s => String(s == null ? '' : s)\n  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n\nconst rows = $input.all();\nconst valid = rows.filter(r => {\n  const f = (r.json && (r.json.fields || r.json)) || {};\n  const ep = Array.isArray(f['Episode']) ? f['Episode'][0] : f['Episode'];\n  return !!ep;\n});\nif (valid.length <= 1) return [];   // normal case — nothing to warn about\n\nconst nameOf = r => { const j = r.json, f = j.fields || j; return f['Name'] || j.id; };\nconst line   = r => `• <b>${esc(nameOf(r))}</b> (<code>${r.json.id}</code>)`;\n\nconst text =\n  `⚠️ <b>${valid.length} thumbnails were set to Selected in the same poll.</b>\\n\\n` +\n  `Only the first is being processed:\\n${line(valid[0])}\\n\\n` +\n  `<b>NOT processed</b> (won't re-fire on their own — re-flip each to Selected one at a time):\\n` +\n  valid.slice(1).map(line).join('\\n');\n\nreturn [{ json: { text } }];"}
  },
  output: [{}]
});

const sendATextMessage = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Send a text message",
    position: [432,608],
    parameters: {"chatId":"-5254203539","text":"=={{ $json.text }}","additionalFields":{"parse_mode":"HTML"}},
    credentials: { telegramApi: newCredential("Telegram [pod21_n8n_agent_bot]") },
    webhookId: "dd7413d6-e6af-4f25-994e-8b4e9d0d4264"
  },
  output: [{}]
});
// ===== ASSEMBLY =====

export default workflow('guys-take-thumbnail-artwork', "BA: Guy's Take Thumbnail Artwork")
  // ---- Path 1: Generate (Episode enters "Ready for 16X9 Thumbnail") ----
  .add(readyFor16x9Thumbnail)
  .to(planGenerate)
  .to(autoArtableType
    .onTrue(markGenerating
      .to(deleteOldThumbnails).to(fetchMoodReferences).to(fetchPrompts).to(fetchGuests)
      .to(buildMoodPrompt).to(pickMoodsGemini).to(resolveVibes).to(planDownloads)
      .to(downloadImage).to(imageToBase64).to(buildImageRequests).to(generateThumbnailNanoBanana)
      .to(extractImages).to(createThumbnailRow).to(upload16x9).to(collectThumbnails)
      .to(sendThumbnailOptions).to(sendPickInstructions).to(markAwaitingPick))
    .onFalse(markManualArtwork.to(notifyManual)))
  // ---- Path 2: Select (Thumbnails row enters "Selected") ----
  .add(thumbnailSelected)
  .to(resolveSelected
    .to(getEpisodeThumbnails).to(computeRejects).to(rejectSiblings)
    .to(markEpisodeArtworkReady).to(markSelectedFinal).to(confirmThumbnailSet))
  .add(resolveSelected)
  .to(needsReversion
    .onTrue(downloadSelected16x9.to(selectedToBase64).to(fetchReversionPrompts)
      .to(buildReversionRequests).to(generateReversionsNanoBanana).to(extractReversions)
      .to(uploadReversion).to(collectReversions).to(sendReversions)))
  .add(thumbnailSelected)
  .to(checkExtraPicks.to(sendATextMessage))
  // ---- Path 3: Revision (Thumbnails row enters "Revision Requested") ----
  .add(revisionRequested)
  .to(planRevision).to(downloadRevisionSources).to(revisionToBase64).to(aggregateRevisionSources)
  .to(fetchEpisodeForTag).to(clearTargetFields).to(fetchRevisionPrompt).to(buildRevisionRequests)
  .to(generateRevisionsNanoBanana).to(extractRevisions).to(uploadRevision).to(collectRevisions)
  .to(sendRevisions).to(markRowRevised);
