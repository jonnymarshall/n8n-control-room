import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Snapshot of live workflow sqkxLdtSzTQqLC1m, fetched 2026-10-21.
// Parameters and node settings are intentionally kept verbatim from live.
// Regenerate with: scripts/deploy/workflows/snapshot-sdk.sh sqkxLdtSzTQqLC1m weekly-bitcoin-podcast-episode-import
const liveNodes = [
  {"id": "b1c9a843-2f12-4f1c-9dc8-5a10c42f1011", "name": "Every Monday 8am", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.3, "position": [208, 304], "parameters": {"rule": {"interval": [{"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 8}]}}},
  {"id": "3a8ebf0f-8a61-4f8b-a437-9ca97c9d8f91", "name": "Find Podcasts With RSS", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [432, 304], "parameters": {"operation": "search", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "id", "value": "tbl9ljNAHwSEQ1FbV"}, "filterByFormula": "AND({Status} = 'Active', OR({RSS Feed URL (YouTube)} != '', {RSS Feed URL (Podcast)} != ''))", "returnAll": true, "options": {"fields": ["Name", "Status", "Platform", "RSS Feed URL (Podcast)", "RSS Feed URL (YouTube)", "YouTube Channel ID", "YouTube Handle"]}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "c1a4ae07-441b-46db-863f-cbb8259906fb", "name": "Emit Feed Requests", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [656, 304], "parameters": {"jsCode": "const out = [];\nfor (const item of $input.all()) {\n  const f = item.json.fields || item.json || {};\n  const podcastId = item.json.id;\n  const name = f.Name || 'Unknown podcast';\n  const youtubeRss = f['RSS Feed URL (YouTube)'];\n  const podcastRss = f['RSS Feed URL (Podcast)'];\n  if (youtubeRss) {\n    out.push({ json: { podcastId, name, platform: 'YouTube', rssUrl: youtubeRss, channelId: f['YouTube Channel ID'] || '', handle: f['YouTube Handle'] || '' } });\n  }\n  if (podcastRss) {\n    out.push({ json: { podcastId, name, platform: 'Podcast', rssUrl: podcastRss, channelId: '', handle: '' } });\n  }\n}\nreturn out;"}},
  {"id": "fb4604f0-ad0c-489c-ab1a-47e97dc283e0", "name": "Fetch RSS", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": [880, 304], "onError": "continueRegularOutput", "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 5000, "parameters": {"url": "={{ $json.rssUrl }}", "options": {"response": {"response": {"responseFormat": "text"}}, "timeout": 15000}}},
  {"id": "40c4b785-4144-48db-93b9-f2319746d182", "name": "Parse RSS XML", "type": "n8n-nodes-base.xml", "typeVersion": 1, "position": [1104, 304], "parameters": {"options": {"explicitArray": false, "mergeAttrs": true, "trim": true}}},
  {"id": "6c69ddb1-96a6-4500-a086-3ff3144b3f40", "name": "RSS Response Available", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1104, 520], "parameters": {"conditions": {"options": {"version": 2, "leftValue": "", "caseSensitive": true, "typeValidation": "strict"}, "conditions": [{"id": "c1b9f4d2-70f6-4ab6-9c8d-9d37c0b4a1e2", "leftValue": "={{ $json.data }}", "rightValue": "", "operator": {"type": "string", "operation": "notEmpty", "singleValue": true}}], "combinator": "and"}}},
  {"id": "fca70a6a-4e31-4dcb-8142-784e74064675", "name": "Flatten Feed Items", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1328, 304], "parameters": {"jsCode": "const MAX_PER_FEED = 15;\nconst parsedItems = $input.all();\nconst feedRequests = $('Emit Feed Requests').all();\nconst results = [];\n\nfunction asArray(value) {\n  if (!value) return [];\n  return Array.isArray(value) ? value : [value];\n}\n\nfunction cleanText(value) {\n  return String(value || '')\n    .replace(/<[^>]*>/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n\nfunction toDateOnly(value) {\n  const d = new Date(value || '');\n  if (isNaN(d.getTime())) return '';\n  return d.toISOString().slice(0, 10);\n}\n\nfor (let i = 0; i < parsedItems.length; i++) {\n  const source = (feedRequests[i] && feedRequests[i].json) || {};\n  const parsed = parsedItems[i].json || {};\n\n  if (source.platform === 'YouTube') {\n    const feed = parsed.feed || {};\n    const entries = asArray(feed.entry).slice(0, MAX_PER_FEED);\n    for (const e of entries) {\n      const videoId = e['yt:videoId'] || '';\n      if (!videoId) continue;\n      const mg = e['media:group'] || {};\n      const community = mg['media:community'] || {};\n      const stats = community['media:statistics'] || {};\n      const title = typeof e.title === 'string' ? e.title : (e.title && e.title._) || 'Untitled';\n      const url = 'https://www.youtube.com/watch?v=' + videoId;\n      results.push({ json: {\n        podcastId: source.podcastId,\n        podcastName: source.name,\n        platform: 'YouTube',\n        sourceRssUrl: source.rssUrl,\n        title,\n        url,\n        published: toDateOnly(e.published),\n        views: parseInt(stats.views || '0', 10) || 0,\n        description: cleanText(mg['media:description']).slice(0, 500),\n        youtubeVideoId: videoId,\n      } });\n    }\n    continue;\n  }\n\n  const channel = (parsed.rss && parsed.rss.channel) || parsed.channel || {};\n  const entries = asArray(channel.item).slice(0, MAX_PER_FEED);\n  for (const e of entries) {\n    const title = typeof e.title === 'string' ? e.title : (e.title && e.title._) || 'Untitled';\n    const url = e.link || (e.enclosure && e.enclosure.url) || e.guid || '';\n    if (!url) continue;\n    results.push({ json: {\n      podcastId: source.podcastId,\n      podcastName: source.name,\n      platform: 'Podcast',\n      sourceRssUrl: source.rssUrl,\n      title,\n      url,\n      published: toDateOnly(e.pubDate || e.published || e['itunes:published']),\n      views: 0,\n      description: cleanText(e.description || e['itunes:summary']).slice(0, 500),\n      youtubeVideoId: '',\n    } });\n  }\n}\n\nreturn results;"}},
  {"id": "c6f59dfc-8bea-4de2-8445-dfc619231c75", "name": "Upsert Podcast Episode", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [1552, 304], "parameters": {"operation": "upsert", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "id", "value": "tblnSita8c8hGwTgV"}, "columns": {"mappingMode": "defineBelow", "value": {"Title": "={{ $json.title }}", "Podcast": "={{ [$json.podcastId] }}", "Platform": "={{ $json.platform }}", "URL": "={{ $json.url }}", "Published": "={{ $json.published }}", "Views": "={{ $json.views }}", "Description": "={{ $json.description }}", "Source RSS URL": "={{ $json.sourceRssUrl }}", "YouTube Video ID": "={{ $json.youtubeVideoId }}", "Last Checked At": "={{ $now.toISO() }}"}, "matchingColumns": ["URL"], "schema": [{"id": "id", "displayName": "id", "required": false, "defaultMatch": true, "display": true, "type": "string", "readOnly": true, "removed": false}, {"id": "Title", "displayName": "Title", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Podcast", "displayName": "Podcast", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "array", "readOnly": false, "removed": false}, {"id": "Platform", "displayName": "Platform", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "options", "options": [{"name": "YouTube", "value": "YouTube"}, {"name": "Podcast", "value": "Podcast"}], "readOnly": false, "removed": false}, {"id": "URL", "displayName": "URL", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Published", "displayName": "Published", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "dateTime", "readOnly": false, "removed": false}, {"id": "Views", "displayName": "Views", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "number", "readOnly": false, "removed": false}, {"id": "Description", "displayName": "Description", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Source RSS URL", "displayName": "Source RSS URL", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "YouTube Video ID", "displayName": "YouTube Video ID", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Last Checked At", "displayName": "Last Checked At", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "dateTime", "readOnly": false, "removed": false}], "attemptToConvertTypes": false, "convertFieldsToString": false}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}},
  {"id": "adab21f8-c65e-4376-95e2-a020b705a9e8", "name": "Summarize Podcast Updates", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1776, 304], "parameters": {"jsCode": "const episodes = $('Flatten Feed Items').all().map(i => i.json || {});\nconst byPodcast = new Map();\n\nfor (const episode of episodes) {\n  if (!episode.podcastId) continue;\n  const existing = byPodcast.get(episode.podcastId) || {\n    podcast_record_id: episode.podcastId,\n    episode_count: 0,\n    last_episode_date: '',\n    highest_view_episode: '',\n    highest_views: -1,\n    view_sum: 0,\n    view_count: 0,\n  };\n\n  existing.episode_count += 1;\n  if (episode.published && (!existing.last_episode_date || episode.published > existing.last_episode_date)) {\n    existing.last_episode_date = episode.published;\n  }\n  if (episode.platform === 'YouTube') {\n    const views = Number(episode.views || 0);\n    existing.view_sum += views;\n    existing.view_count += 1;\n    if (views > existing.highest_views) {\n      existing.highest_views = views;\n      existing.highest_view_episode = episode.url;\n    }\n  }\n\n  byPodcast.set(episode.podcastId, existing);\n}\n\nreturn Array.from(byPodcast.values()).map(s => ({\n  json: {\n    podcast_record_id: s.podcast_record_id,\n    episode_count: s.episode_count,\n    last_episode_date: s.last_episode_date,\n    highest_view_episode: s.highest_view_episode,\n    average_views: s.view_count ? Math.round(s.view_sum / s.view_count) : 0,\n  }\n}));"}},
  {"id": "81de134f-2d52-4e5f-a739-b354d6d641ab", "name": "Update Podcast Summary", "type": "n8n-nodes-base.airtable", "typeVersion": 2.2, "position": [2000, 304], "parameters": {"operation": "update", "base": {"__rl": true, "mode": "id", "value": "appwcz1Bux9YLcZYm"}, "table": {"__rl": true, "mode": "id", "value": "tbl9ljNAHwSEQ1FbV"}, "columns": {"mappingMode": "defineBelow", "value": {"id": "={{ $json.podcast_record_id }}", "Last Episode Date": "={{ $json.last_episode_date }}", "Episode Count": "={{ $json.episode_count }}", "Highest View Episode": "={{ $json.highest_view_episode }}", "Average Views": "={{ $json.average_views }}", "Last Checked At": "={{ $now.toISO() }}"}, "matchingColumns": ["id"], "schema": [{"id": "id", "displayName": "id", "required": false, "defaultMatch": true, "display": true, "type": "string", "readOnly": true, "removed": false}, {"id": "Last Episode Date", "displayName": "Last Episode Date", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "dateTime", "readOnly": false, "removed": false}, {"id": "Episode Count", "displayName": "Episode Count", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "number", "readOnly": false, "removed": false}, {"id": "Highest View Episode", "displayName": "Highest View Episode", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "string", "readOnly": false, "removed": false}, {"id": "Average Views", "displayName": "Average Views", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "number", "readOnly": false, "removed": false}, {"id": "Last Checked At", "displayName": "Last Checked At", "required": false, "defaultMatch": false, "canBeUsedToMatch": true, "display": true, "type": "dateTime", "readOnly": false, "removed": false}], "attemptToConvertTypes": false, "convertFieldsToString": false}, "options": {"typecast": true}}, "credentials": {"airtableTokenApi": {"id": "04Sw0cnSlBkB6Y3s", "name": "Airtable [n8n] (PAT)"}}}
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
  ['Every Monday 8am', 0, 'Find Podcasts With RSS'],
  ['Find Podcasts With RSS', 0, 'Emit Feed Requests'],
  ['Emit Feed Requests', 0, 'Fetch RSS'],
  ['Parse RSS XML', 0, 'Flatten Feed Items'],
  ['Flatten Feed Items', 0, 'Upsert Podcast Episode'],
  ['Upsert Podcast Episode', 0, 'Summarize Podcast Updates'],
  ['Summarize Podcast Updates', 0, 'Update Podcast Summary'],
  ['Fetch RSS', 0, 'RSS Response Available'],
  ['RSS Response Available', 0, 'Parse RSS XML']
];

const weeklyBitcoinPodcastEpisodeImport = workflow(
  "sqkxLdtSzTQqLC1m",
  "Pod21: Weekly Bitcoin Podcast Episode Import"
).settings({
  errorWorkflow: "9PMI1kuBjLW2YHwb",
  timezone: "America/New_York",
  executionOrder: "v1",
  availableInMCP: true
});

for (const live of liveNodes) weeklyBitcoinPodcastEpisodeImport.add(nodesByName[live.name]);
for (const [source, output, target, targetIndex = 0] of connections) {
  weeklyBitcoinPodcastEpisodeImport.connect(nodesByName[source], output, nodesByName[target], targetIndex);
}

export default weeklyBitcoinPodcastEpisodeImport;
