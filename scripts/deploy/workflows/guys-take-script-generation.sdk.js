import { workflow, node, trigger, ifElse, languageModel, outputParser, newCredential, expr } from '@n8n/workflow-sdk';

const airtableCred = newCredential('Airtable [n8n] (PAT)');

const scriptSystemPrompt = `You are the scriptwriter for Guy's Take, a punchy Bitcoin and sovereign-tech commentary show. Guy is the host and delivers straight to camera. Produce a clean, retention-optimised TALKING-HEAD script for ONE 5-12 minute YouTube episode on the supplied news event.

This script is the ONLY deliverable. Do NOT produce title options, thumbnail captions, SEO descriptions, social copy, or editor resource lists. Write Leading Questions + Concepts (each with a visual cue) so Guy can speak organically while holding maximum retention. Do NOT write word-for-word narration.

CORE FRAMEWORK (fight viewer drop-off):
1. 30-second scroll stop: immediately pay off the title/thumbnail promise. No greetings, intros, or channel filler.
2. Pattern interrupts every 60-90s: framing shifts, on-screen data/charts, or verbal bridge loops.
3. Loop chaining: never resolve a question without immediately opening the next layer of tension.
4. Branded outro + end-screen hold.

PACING: assume 130-160 words per minute. Do NOT invent statistics, prices, dates, or quotes beyond the supplied SUMMARY; where a figure is needed but unconfirmed, add a concept line that flags it for verification rather than fabricate it.

SPONSOR: the sponsor is supplied at runtime (name + overview). Use it DYNAMICALLY, never hardcode a sponsor. Place exactly ONE inline sponsor beat, matched to the episode's strongest relevant argument.

OUTPUT exactly three fields:
- title_suggestion: a single strong internal working title (not shown in the script).
- references: a short markdown references block (cited + suggested); real canonical links where confident, else name the source and mark (verify link); never invent a URL.
- slides: an ARRAY of beats, in order, one object per beat. Each beat object has:
  - heading: the beat name.
  - share: integer percent of runtime for this beat (all shares sum to ~100).
  - leading_questions: array of 1-2 open questions that prompt natural delivery (use an empty array for fixed scripted beats).
  - concepts: array of objects { point, visual_cue } where point is an idea/fact to cover and visual_cue is the on-screen visual (chart, number card, map, headline screenshot, B-roll, prop, shot change).

Produce these beats in this exact order:
1. heading '1. The Hook', share 7 - HOOK ONLY, do not dive into content. concepts state the punchy big question or news event; the beat MUST end on the exact line: It's time for a Guy's Take episode. Put 2-4 open questions in leading_questions.
2. heading 'Guy's Take Graphic', share 1 - branded logo sting; one concept note; no questions.
3. heading '2. The Setup & Stakes', share 9 - why the viewer must care for their sovereignty and wallet right now.
4. heading '3. Core Point 1', share 18.
5. heading '4. Core Point 2', share 18.
6. heading '5. Core Point 3', share 18 - three logical insight points linked by open/closed loops.
7. heading 'Sponsor: <Sponsor Name> - <matched angle>', share 7 - the single inline sponsor beat; content bridge + 2-3 talking points drawn from the sponsor overview.
8. heading '6. The Grand Payoff', share 13 - MUST end positive: either how Bitcoin withstands and grows stronger through exactly this threat, or the concrete self-sovereignty action the viewer can take.
9. heading '7. What Do You Think?', share 6 - outro/CTA, adds NO new argument; 1-2 open what-do-you-think questions, invite the viewer to comment, like, share, and subscribe, and close on the exact line: This has been my Guy's Take, see you in the next one.
10. heading 'Endframe Hold - Related Videos', share 3 - final beat; 2-3 related-video card suggestions; no goodbye.`;

const buildHtmlCode = `const out = ($("Generate Script").first().json.output) || {};
const sl = $("Shortlist Row Changed").first().json;
const topic = sl.Topic || (sl.fields && sl.fields.Topic) || "Untitled Episode";
const summary = sl.Summary || (sl.fields && sl.fields.Summary) || "";
const title = out.title_suggestion || topic;
const slides = Array.isArray(out.slides) ? out.slides : [];
const references = out.references || "";
const NL = String.fromCharCode(10);

function esc(s) {
  return String(s == null ? "" : s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
}

let scriptText = "# " + title + NL + NL + "_" + topic + "_" + NL + NL;
for (let a = 0; a < slides.length; a++) {
  const s = slides[a];
  const share = (s.share || s.share === 0) ? (" (" + s.share + "%)") : "";
  scriptText += "## " + (s.heading || "Beat") + share + NL + NL;
  const lq = Array.isArray(s.leading_questions) ? s.leading_questions : [];
  if (lq.length) {
    scriptText += "**Leading questions:**" + NL;
    for (let b = 0; b < lq.length; b++) scriptText += "- " + lq[b] + NL;
    scriptText += NL;
  }
  const cs = Array.isArray(s.concepts) ? s.concepts : [];
  if (cs.length) {
    scriptText += "**Cover:**" + NL;
    for (let c = 0; c < cs.length; c++) {
      const it = cs[c];
      const point = (it && it.point) ? it.point : it;
      const cue = (it && it.visual_cue) ? (NL + "  _Visual cue: " + it.visual_cue + "_") : "";
      scriptText += "- " + point + cue + NL;
    }
    scriptText += NL;
  }
}
if (references) scriptText += "## References" + NL + NL + references + NL;

let slidesHtml = "";
slidesHtml += "<section class='slide active'><hgroup><h1>" + esc(title) + "</h1><p>" + esc(topic) + "</p></hgroup><p>" + esc(summary) + "</p><footer><small>Guy's Take talking-head script. Use the arrow keys or the buttons to advance.</small></footer></section>";
for (let a = 0; a < slides.length; a++) {
  const s = slides[a];
  const share = (s.share || s.share === 0) ? ("<span class='share-badge'>" + esc(s.share) + "%</span>") : "";
  let body = "";
  const lq = Array.isArray(s.leading_questions) ? s.leading_questions : [];
  if (lq.length) {
    body += "<h4>Leading questions</h4><ul>";
    for (let b = 0; b < lq.length; b++) body += "<li>" + esc(lq[b]) + "</li>";
    body += "</ul>";
  }
  const cs = Array.isArray(s.concepts) ? s.concepts : [];
  if (cs.length) {
    body += "<h4>Cover</h4><ul>";
    for (let c = 0; c < cs.length; c++) {
      const it = cs[c];
      const point = (it && it.point) ? it.point : it;
      const cue = (it && it.visual_cue) ? (" <em>&mdash; Visual cue: " + esc(it.visual_cue) + "</em>") : "";
      body += "<li>" + esc(point) + cue + "</li>";
    }
    body += "</ul>";
  }
  slidesHtml += "<section class='slide'><h2>" + esc(s.heading || "Beat") + share + "</h2>" + body + "</section>";
}
if (references) {
  slidesHtml += "<section class='slide'><h2>References</h2><pre style='white-space:pre-wrap;font-family:inherit'>" + esc(references) + "</pre></section>";
}

const head = "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>" + esc(title) + "</title><link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css'><style>.slide{display:none;min-height:68vh}.slide.active{display:block}.share-badge{float:right;opacity:.55;font-size:.65em;font-weight:normal}.deck-nav{position:fixed;bottom:1rem;right:1rem;display:flex;gap:.5rem;align-items:center;background:var(--pico-card-background-color,#fff);padding:.4rem .7rem;border-radius:.6rem;box-shadow:0 2px 14px rgba(0,0,0,.18)}.deck-nav button{margin:0;padding:.15rem .8rem}#counter{opacity:.7;font-size:.85em;min-width:4.5rem;text-align:center}</style></head><body><main class='container'>";
const tail = "</main><div class='deck-nav'><button id='prev'>Prev</button><span id='counter'></span><button id='next'>Next</button></div><script>var slides=[].slice.call(document.querySelectorAll('.slide'));var i=0;function show(n){slides[i].classList.remove('active');i=(n+slides.length)%slides.length;slides[i].classList.add('active');document.getElementById('counter').textContent=(i+1)+' / '+slides.length;window.scrollTo(0,0);}document.getElementById('next').onclick=function(){show(i+1);};document.getElementById('prev').onclick=function(){show(i-1);};document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();show(i+1);}if(e.key==='ArrowLeft'){show(i-1);}});show(0);</script></body></html>";

const html = head + slidesHtml + tail;
const htmlBase64 = Buffer.from(html, "utf8").toString("base64");
const safeName = String(topic).split("").filter(function (ch) { return /[a-zA-Z0-9 _-]/.test(ch); }).join("").trim().slice(0, 60) || "episode";
const fileName = "Guys Take Script - " + safeName + ".html";

return [{ json: { title: title, topic: topic, summary: summary, references: references, scriptText: scriptText, html: html, htmlBase64: htmlBase64, fileName: fileName } }];`;

const shortlistTrigger = trigger({
  type: 'n8n-nodes-base.airtableTrigger',
  version: 1,
  config: {
    name: 'Shortlist Row Changed',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      authentication: 'airtableTokenApi',
      baseId: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      tableId: { __rl: true, mode: 'id', value: 'tblED3N6WdT1tQTzY', cachedResultName: 'Shortlist' },
      triggerField: 'Last Modified Time',
      additionalFields: { fields: 'Topic,Summary,Status,Last Modified Time', viewId: 'viw5PKdnY3XPmALjV' }
    },
    credentials: { airtableTokenApi: airtableCred },
    position: [240, 192]
  },
  output: [{ id: 'recXXXXXXXXXXXXXX', Topic: 'Example topic', Summary: 'Example summary', Status: 'Picked' }]
});

const isPicked = ifElse({
  version: 2.3,
  config: {
    name: 'Is Picked',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [{
          leftValue: expr("{{ $json.Status ?? $json.fields?.Status }}"),
          operator: { type: 'string', operation: 'equals' },
          rightValue: 'Picked',
          id: '186b6d14-8cdc-4774-99e4-18fe1e35f286'
        }],
        combinator: 'and'
      },
      options: {}
    },
    position: [464, 192]
  }
});

const fetchSponsor = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Fetch Sponsor Info',
    parameters: {
      operation: 'search',
      base: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      table: { __rl: true, mode: 'id', value: 'tbl6sfPWRXmcLutxX', cachedResultName: 'Sponsors' },
      filterByFormula: "{Status}='Active'",
      returnAll: false,
      limit: 1,
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    position: [688, 192]
  },
  output: [{ Name: 'Example Sponsor', Overview: 'Sponsor overview text' }]
});

const scriptModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  version: 1,
  config: {
    name: 'Script Model (OpenRouter)',
    parameters: { model: 'openai/gpt-5.1', options: { maxTokens: 8000, responseFormat: 'json_object', temperature: 0.6 } },
    credentials: { openRouterApi: newCredential('OpenRouter [n8n]') },
    position: [928, 416]
  }
});

const scriptParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Script Output Parser',
    parameters: {
      jsonSchemaExample: '{"title_suggestion":"Internal working title","references":"Cited and suggested sources as markdown","slides":[{"heading":"1. The Hook","share":7,"leading_questions":["Open question?"],"concepts":[{"point":"Idea or fact to cover","visual_cue":"chart / number card / B-roll"}]}]}'
    },
    position: [1072, 416]
  }
});

const generateScript = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Generate Script',
    parameters: {
      promptType: 'define',
      text: expr("Generate the Guy's Take talking-head script for this episode.\n\nTOPIC: {{ $('Shortlist Row Changed').first().json.Topic ?? $('Shortlist Row Changed').first().json.fields?.Topic }}\n\nSUMMARY: {{ $('Shortlist Row Changed').first().json.Summary ?? $('Shortlist Row Changed').first().json.fields?.Summary }}\n\nSPONSOR (use dynamically, do not hardcode):\nName: {{ $('Fetch Sponsor Info').first().json.Name ?? $('Fetch Sponsor Info').first().json.fields?.Name }}\nOverview: {{ $('Fetch Sponsor Info').first().json.Overview ?? $('Fetch Sponsor Info').first().json.fields?.Overview }}\nExtra notes: {{ $('Fetch Sponsor Info').first().json['Attachment Summary'] ?? $('Fetch Sponsor Info').first().json.fields?.['Attachment Summary'] ?? '' }}"),
      hasOutputParser: true,
      messages: { messageValues: [{ message: scriptSystemPrompt }] },
      batching: {}
    },
    subnodes: { model: scriptModel, outputParser: scriptParser },
    position: [912, 192]
  },
  output: [{ output: { title_suggestion: 'Working title', references: 'References markdown', slides: [{ heading: '1. The Hook', share: 7, leading_questions: ['Q?'], concepts: [{ point: 'Point', visual_cue: 'Cue' }] }] } }]
});

const buildHtml = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Script HTML',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: buildHtmlCode },
    position: [1136, 192]
  },
  output: [{ title: 'Working title', topic: 'Example topic', summary: 'Example summary', references: 'References markdown', scriptText: '# Example', html: '<!doctype html>', htmlBase64: 'PCFkb2N0eXBlIGh0bWw+', fileName: 'Guys Take Script - Example.html' }]
});

const createEpisode = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Create Episode',
    parameters: {
      operation: 'create',
      base: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      table: { __rl: true, mode: 'id', value: 'tbl3uYLIvtB9APZp6', cachedResultName: 'Episodes' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Title: expr("{{ $('Shortlist Row Changed').first().json.Topic ?? $('Shortlist Row Changed').first().json.fields?.Topic }}"),
          Status: 'Script Ready',
          Summary: expr("{{ $('Shortlist Row Changed').first().json.Summary ?? $('Shortlist Row Changed').first().json.fields?.Summary }}"),
          Script: expr("{{ $('Build Script HTML').first().json.scriptText }}"),
          References: expr("{{ $('Build Script HTML').first().json.references }}"),
          'Source Shortlist': expr("{{ [ $('Shortlist Row Changed').first().json.id ] }}")
        },
        matchingColumns: [],
        schema: [
          { id: 'Title', displayName: 'Title', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Status', displayName: 'Status', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'options', options: [{ name: 'Scheduled', value: 'Scheduled' }, { name: 'Research Ready', value: 'Research Ready' }, { name: 'Stories Picked', value: 'Stories Picked' }, { name: 'Script Ready', value: 'Script Ready' }, { name: 'Recorded', value: 'Recorded' }, { name: 'Transcript Ready', value: 'Transcript Ready' }, { name: 'Edited', value: 'Edited' }, { name: 'AI Analysis Complete', value: 'AI Analysis Complete' }, { name: 'Approved', value: 'Approved' }, { name: 'Artwork Ready', value: 'Artwork Ready' }, { name: 'Published', value: 'Published' }], readOnly: false, removed: false },
          { id: 'Summary', displayName: 'Summary', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Script', displayName: 'Script', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'References', displayName: 'References', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'Source Shortlist', displayName: 'Source Shortlist', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'array', readOnly: false, removed: false }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: { typecast: true }
    },
    credentials: { airtableTokenApi: airtableCred },
    position: [1360, 192]
  },
  output: [{ id: 'recEPISODEXXXXXXX', Title: 'Example topic', Status: 'Script Ready' }]
});

const uploadScriptHtml = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Upload Script HTML',
    parameters: {
      method: 'POST',
      url: expr('https://content.airtable.com/v0/app8Xw9Tq0XLjhmp9/{{ $json.id }}/Attachments/uploadAttachment'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { "contentType": "text/html", "filename": $("Build Script HTML").first().json.fileName, "file": $("Build Script HTML").first().json.htmlBase64 } }}'),
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    position: [1584, 192]
  },
  output: [{ id: 'recEPISODEXXXXXXX', fields: {} }]
});

const markScripted = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Mark Shortlist Scripted',
    parameters: {
      operation: 'update',
      base: { __rl: true, mode: 'id', value: 'app8Xw9Tq0XLjhmp9', cachedResultName: "Guy's Take" },
      table: { __rl: true, mode: 'id', value: 'tblED3N6WdT1tQTzY', cachedResultName: 'Shortlist' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: expr("{{ $('Shortlist Row Changed').first().json.id }}"),
          Status: 'Scripted'
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true },
          { id: 'Status', displayName: 'Status', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'options', options: [{ name: 'Shortlisted', value: 'Shortlisted' }, { name: 'Picked', value: 'Picked' }, { name: 'Rejected', value: 'Rejected' }, { name: 'Scripted', value: 'Scripted' }], readOnly: false, removed: false }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    },
    credentials: { airtableTokenApi: airtableCred },
    position: [1808, 192]
  },
  output: [{ id: 'recXXXXXXXXXXXXXX', Status: 'Scripted' }]
});

const surfaceHtml = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Surface HTML for Doc',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'a1', name: 'htmlBase64', value: expr("{{ $('Build Script HTML').first().json.htmlBase64 }}"), type: 'string' },
          { id: 'a2', name: 'fileName', value: expr("{{ $('Build Script HTML').first().json.fileName }}"), type: 'string' },
          { id: 'a3', name: 'title', value: expr("{{ $('Build Script HTML').first().json.title }}"), type: 'string' }
        ]
      },
      includeOtherFields: false,
      options: {}
    },
    position: [2032, 192]
  },
  output: [{ htmlBase64: 'PCFkb2N0eXBlIGh0bWw+', fileName: 'Guys Take Script - Example.html', title: 'Working title' }]
});

const convertHtml = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Convert HTML to File',
    parameters: {
      operation: 'toBinary',
      sourceProperty: 'htmlBase64',
      binaryPropertyName: 'data',
      options: { fileName: expr('{{ $json.fileName }}'), mimeType: 'text/html', dataIsBase64: true }
    },
    position: [2256, 192]
  },
  output: [{ htmlBase64: 'PCFkb2N0eXBlIGh0bWw+', fileName: 'Guys Take Script - Example.html', title: 'Working title' }]
});

const notifyScriptReady = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Notify Script Ready',
    parameters: {
      resource: 'message',
      operation: 'sendDocument',
      chatId: '1512868522',
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: {
        appendAttribution: false,
        parse_mode: 'HTML',
        caption: expr("✍️ <b>Script ready</b>\n\n<b>{{ $('Shortlist Row Changed').first().json.Topic ?? $('Shortlist Row Changed').first().json.fields?.Topic }}</b>\nWorking title: <i>{{ $('Build Script HTML').first().json.title }}</i>\n\nEpisode created with Status = Script Ready. The full talking-head script is attached as a browser slideshow.\n\nOpen Airtable: https://airtable.com/app8Xw9Tq0XLjhmp9")
      }
    },
    credentials: { telegramApi: newCredential('Telegram [pod21_n8n_agent_bot]') },
    position: [2480, 192]
  },
  output: [{ ok: true, result: { message_id: 1 } }]
});

export default workflow('q80QVMszf2iOfwIy', "BA: Guy's Take Script Generation")
  .add(shortlistTrigger)
  .to(isPicked.onTrue(
    fetchSponsor
      .to(generateScript)
      .to(buildHtml)
      .to(createEpisode)
      .to(uploadScriptHtml)
      .to(markScripted)
      .to(surfaceHtml)
      .to(convertHtml)
      .to(notifyScriptReady)
  ));
