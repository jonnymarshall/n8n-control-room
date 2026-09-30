#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(REPO_ROOT, "data", "bitcoin-podcast-rss");

function resolveRepoPath(p) {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

const BASE_ID = "appwcz1Bux9YLcZYm";
const TABLE_ID = "tbl9ljNAHwSEQ1FbV";

const FIELD = {
  name: "fldROxE7S6HSKWnlY",
  description: "fld2VMml6HiacWfyf",
  link: "fldY91YX0GwbyHZH2",
  status: "fldY6NaoPt59j0ViQ",
  notes: "fldcUnqtCJD9kzZB5",
  podcastRss: "flduCdlIaMUL5pO8R",
  platform: "fldnUmljZtsYdpdt9",
  youtubeUrl: "fldVJsqRpUyUu0Ywi",
  hosts: "fldQT5zMbiuszYX0c",
  xHandles: "fldSreEPiruPWSI9j",
  lastEpisodeDate: "fldOhAEfAjD1Wj2Fz",
  episodeCount: "flduIG2Er6SKhB3E7",
  lastCheckedAt: "flddiL4BAla393jF8",
  youtubeRss: "fldjmkR7Dk1KpgTv7",
  youtubeChannelId: "fldj2JKZcxIREsjlK",
  youtubeHandle: "fldhXqqRcwhbHG7Xu",
  podcastEmail: "fld2WRH8CckW4EZrU",
  rssStatus: "fldBaXGcF8eqNoj5q",
  rssLastVerifiedAt: "fldEhXkwl3DVlhark",
  rssEpisodeCountChecked: "fld4nXzFrU4YgPRHR",
  rssLatestEpisodeDate: "fldrwI8LecK5L7Ptg",
  researchConfidence: "fldyMYl3rQLnWf6AD",
  rssLatestEpisodeTitle: "fldKg45FWWg1esAkr",
  rssDuplicateNotes: "fldTc5S4YZzUioDbK",
};

const RSS_COM_ENDPOINT = "https://apollo.rss.com/search/podcast-index/byterm";
const ACTIVE_WINDOW_DAYS = 180;

const APPLY_UPDATES = process.env.APPLY_UPDATES === "true";
const DELAY_MS = Number(process.env.DELAY_MS || 2000);
const MAX_ROWS = process.env.MAX_ROWS ? Number(process.env.MAX_ROWS) : Infinity;
const START_INDEX = process.env.START_INDEX ? Number(process.env.START_INDEX) : 0;
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(DATA_DIR, "rss-enrichment-results.json");
const ONLY_MISSING = process.env.ONLY_MISSING === "true";
const APPLY_FROM_FILE = process.env.APPLY_FROM_FILE || "";
const SKIP_REVIEWED = process.env.SKIP_REVIEWED !== "false";

async function loadEnvFile() {
  const envPath = path.join(REPO_ROOT, ".env");

  try {
    const env = await fs.readFile(envPath, "utf8");

    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();

      if (!process.env[key]) {
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function first(xml, regex) {
  const match = xml.match(regex);
  return match ? stripHtml(match[1] || "") : "";
}

function firstRaw(xml, regex) {
  const match = xml.match(regex);
  return match ? String(match[1] || "").trim() : "";
}

function extractEmail(value = "") {
  const match = String(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function toIsoDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function isActiveByDate(isoDate) {
  if (!isoDate) return false;

  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Date(isoDate).getTime() >= cutoff;
}

function isYoutubeFeed(feedUrl = "") {
  return feedUrl.includes("youtube.com/feeds/videos.xml");
}

function truncateSingleLine(value = "", maxLength = 500) {
  return stripHtml(value).replace(/[\r\n]+/g, " ").slice(0, maxLength);
}

async function airtableFetch(airtableToken, route, options = {}) {
  const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${route}`, {
    ...options,
    headers: {
      authorization: `Bearer ${airtableToken}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function listRecords(airtableToken) {
  const records = [];
  let offset;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      returnFieldsByFieldId: "true",
    });

    if (offset) params.set("offset", offset);

    const data = await airtableFetch(airtableToken, `${TABLE_ID}?${params.toString()}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function searchRssCom(query) {
  const response = await fetch(RSS_COM_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: "https://rss.com",
      referer: "https://rss.com/tools/find-my-feed/",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    return {
      query,
      error: `${response.status} ${response.statusText}`,
      feeds: [],
    };
  }

  const data = await response.json();

  return {
    query,
    feeds: (data.feeds || []).map((feed) => ({
      query,
      title: feed.title || "",
      author: feed.author || "",
      feedUrl: feed.url || "",
      image: feed.image || "",
      description: feed.description || "",
    })),
  };
}

async function validateFeed(feedUrl) {
  const response = await fetch(feedUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 RSS enrichment checker",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });

  const xml = await response.text();

  if (!response.ok || !xml.includes("<")) {
    return {
      ok: false,
      status: response.status,
      error: `Feed returned ${response.status}`,
    };
  }

  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
  const items = itemMatches.length ? itemMatches : entryMatches;
  const latest = items[0] || "";
  const rawOwnerEmail = firstRaw(xml, /<itunes:email[^>]*>([\s\S]*?)<\/itunes:email>/i);
  const rawManagingEditor = firstRaw(xml, /<managingEditor[^>]*>([\s\S]*?)<\/managingEditor>/i);
  const rawWebMaster = firstRaw(xml, /<webMaster[^>]*>([\s\S]*?)<\/webMaster>/i);

  const title = first(xml, /<channel[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i) ||
    first(xml, /<feed[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = first(xml, /<description[^>]*>([\s\S]*?)<\/description>/i) ||
    first(xml, /<itunes:summary[^>]*>([\s\S]*?)<\/itunes:summary>/i) ||
    first(xml, /<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i);
  const author = first(xml, /<itunes:author[^>]*>([\s\S]*?)<\/itunes:author>/i) ||
    first(xml, /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i) ||
    first(xml, /<author[^>]*>([\s\S]*?)<\/author>/i);
  const latestTitle = first(latest, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const latestDateRaw = first(latest, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
    first(latest, /<published[^>]*>([\s\S]*?)<\/published>/i) ||
    first(latest, /<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const latestDate = toIsoDate(latestDateRaw);
  const youtubeChannelId = first(xml, /<yt:channelId[^>]*>([\s\S]*?)<\/yt:channelId>/i);
  const email = extractEmail(rawOwnerEmail) || extractEmail(rawManagingEditor) || extractEmail(rawWebMaster);

  return {
    ok: items.length > 0,
    status: response.status,
    title,
    description,
    author,
    email,
    latestTitle,
    latestDate,
    itemCount: items.length,
    youtubeChannelId,
    feedKind: itemMatches.length ? "rss" : entryMatches.length ? "atom" : "unknown",
    error: items.length ? "" : "No item or entry nodes found",
  };
}

function scoreCandidate(record, candidate, validation) {
  const name = normalize(record.fields[FIELD.name]);
  const hosts = normalize(record.fields[FIELD.hosts]);
  const title = normalize(candidate.title || validation.title);
  const author = normalize(candidate.author || validation.author);
  const description = normalize(candidate.description || validation.description);
  const combined = `${title} ${author} ${description}`;
  let score = 0;
  const reasons = [];

  if (title === name) {
    score += 50;
    reasons.push("exact title match");
  } else if (title.includes(name) || name.includes(title)) {
    score += 30;
    reasons.push("partial title match");
  }

  if (hosts && (author.includes(hosts) || description.includes(hosts))) {
    score += 25;
    reasons.push("host match");
  }

  if (validation.ok && validation.itemCount > 0) {
    score += 15;
    reasons.push("valid feed with items");
  }

  if (validation.latestDate && isActiveByDate(validation.latestDate)) {
    score += 10;
    reasons.push("active feed");
  }

  if (isYoutubeFeed(candidate.feedUrl) && normalize(record.fields[FIELD.youtubeUrl])) {
    score += 10;
    reasons.push("youtube feed and youtube url exists");
  }

  if (name.includes("orange pill") && !combined.includes("bitcoin") && combined.includes("health")) {
    score -= 100;
    reasons.push("rejected unrelated health show");
  }

  if (name.includes("orange pill") && !combined.includes("keiser") && !combined.includes("herbert") && !combined.includes("bitcoin")) {
    score -= 80;
    reasons.push("rejected non-bitcoin orange pill match");
  }

  if (name.includes("bitcoin university") && combined.includes("evander smart")) {
    score -= 60;
    reasons.push("likely wrong Bitcoin University");
  }

  if (!validation.ok) {
    score -= 40;
    reasons.push(validation.error || "invalid feed");
  }

  return { score, reasons };
}

function buildSearchQueries(record) {
  const name = record.fields[FIELD.name] || "";
  const hosts = record.fields[FIELD.hosts] || "";

  return [hosts ? `${name} ${hosts}` : "", name].filter(Boolean);
}

async function discoverCandidates(record) {
  const queries = buildSearchQueries(record);
  const searches = [];
  const candidates = [];

  for (const query of queries) {
    const result = await searchRssCom(query);
    searches.push(result);
    candidates.push(...result.feeds);
    await sleep(DELAY_MS);
  }

  const uniqueCandidates = [
    ...new Map(candidates.filter((candidate) => candidate.feedUrl).map((candidate) => [candidate.feedUrl, candidate])).values(),
  ];
  const validated = [];

  for (const candidate of uniqueCandidates) {
    try {
      const validation = await validateFeed(candidate.feedUrl);
      const score = scoreCandidate(record, candidate, validation);
      validated.push({ candidate, validation, score });
    } catch (error) {
      validated.push({
        candidate,
        validation: { ok: false, error: error.message },
        score: { score: -100, reasons: ["validation failed"] },
      });
    }

    await sleep(DELAY_MS);
  }

  validated.sort((a, b) => b.score.score - a.score.score);

  return {
    queries,
    searches,
    candidates: validated,
    best: validated[0] || null,
    selected: validated[0] && validated[0].score.score >= 35 ? validated[0] : null,
  };
}

function buildNotes(selected, discovery) {
  const lines = [];

  if (selected) {
    lines.push(`Selected: ${selected.candidate.title || selected.validation.title || selected.candidate.feedUrl}`);
    lines.push(`Score: ${selected.score.score} (${selected.score.reasons.join(", ")})`);
  }

  const alternates = (discovery?.candidates || [])
    .filter((candidate) => candidate !== selected)
    .slice(0, 5)
    .map((candidate) => `${candidate.score.score}: ${candidate.candidate.title} <${candidate.candidate.feedUrl}>`);

  if (alternates.length) {
    lines.push(`Alternates: ${alternates.join(" | ")}`);
  }

  return lines.join("\n").slice(0, 5000);
}

function buildUpdateFields(record, selected, source, discovery) {
  const now = new Date().toISOString();
  const validation = selected.validation;
  const candidate = selected.candidate;
  const updates = {
    [FIELD.rssLastVerifiedAt]: now,
    [FIELD.rssStatus]: validation.ok ? "Verified" : "Broken",
    [FIELD.researchConfidence]: selected.score.score >= 60 ? "High" : "Medium",
  };

  if (!validation.ok) {
    updates[FIELD.rssDuplicateNotes] = buildNotes(selected, discovery || { candidates: [] }) || validation.error || "Feed validation failed";
    return updates;
  }

  updates[FIELD.rssLatestEpisodeTitle] = validation.latestTitle || "";
  updates[FIELD.rssEpisodeCountChecked] = validation.itemCount || 0;
  updates[FIELD.lastCheckedAt] = now;
  updates[FIELD.rssDuplicateNotes] = buildNotes(selected, discovery || { candidates: [] });

  if (validation.latestDate) {
    updates[FIELD.rssLatestEpisodeDate] = validation.latestDate;
    updates[FIELD.lastEpisodeDate] = validation.latestDate;
    updates[FIELD.status] = isActiveByDate(validation.latestDate) ? "Active" : "Inactive";
  }

  if (validation.itemCount) {
    updates[FIELD.episodeCount] = validation.itemCount;
  }

  if (validation.email && !record.fields[FIELD.podcastEmail]) {
    updates[FIELD.podcastEmail] = validation.email;
  }

  if (validation.author && !record.fields[FIELD.hosts]) {
    updates[FIELD.hosts] = validation.author;
  }

  if (validation.description && !record.fields[FIELD.description]) {
    updates[FIELD.description] = truncateSingleLine(validation.description);
  }

  if (source === "discovered") {
    if (isYoutubeFeed(candidate.feedUrl)) {
      updates[FIELD.youtubeRss] = candidate.feedUrl;
      updates[FIELD.platform] = "YouTube";

      if (validation.youtubeChannelId) {
        updates[FIELD.youtubeChannelId] = validation.youtubeChannelId;
      }
    } else {
      updates[FIELD.podcastRss] = candidate.feedUrl;
      updates[FIELD.platform] = "RSS";
    }
  } else if (!record.fields[FIELD.platform]) {
    updates[FIELD.platform] = isYoutubeFeed(candidate.feedUrl) ? "YouTube" : "RSS";
  }

  return updates;
}

function buildNoMatchUpdate(discovery) {
  const best = discovery.best;
  const notes = best
    ? `No safe match selected. Best candidate scored ${best.score.score}: ${best.candidate.title} <${best.candidate.feedUrl}>. Reasons: ${best.score.reasons.join(", ")}`
    : `No RSS.com candidates found. Queries: ${discovery.queries.join(" | ")}`;

  return {
    [FIELD.rssStatus]: best ? "Uncertain" : "Not Found",
    [FIELD.rssLastVerifiedAt]: new Date().toISOString(),
    [FIELD.researchConfidence]: "Low",
    [FIELD.rssDuplicateNotes]: notes.slice(0, 5000),
  };
}

async function updateRecord(airtableToken, recordId, fields) {
  return airtableFetch(airtableToken, TABLE_ID, {
    method: "PATCH",
    body: JSON.stringify({
      records: [{ id: recordId, fields }],
      typecast: false,
    }),
  });
}

function shouldProcess(record) {
  if (!record.fields[FIELD.name]) return false;

  const hasAnyRss = Boolean(record.fields[FIELD.podcastRss] || record.fields[FIELD.youtubeRss]);

  if (ONLY_MISSING) {
    if (hasAnyRss) return false;
    if (SKIP_REVIEWED && record.fields[FIELD.rssStatus]) return false;
  }

  return true;
}

async function processRecord(record) {
  const name = record.fields[FIELD.name] || record.id;
  const existingFeedUrl = record.fields[FIELD.podcastRss] || record.fields[FIELD.youtubeRss] || "";

  if (existingFeedUrl) {
    try {
      const validation = await validateFeed(existingFeedUrl);
      const selected = {
        candidate: {
          feedUrl: existingFeedUrl,
          title: validation.title,
          author: validation.author,
          description: validation.description,
        },
        validation,
        score: { score: validation.ok ? 80 : -100, reasons: ["existing feed validation"] },
      };

      return {
        recordId: record.id,
        name,
        mode: "existing",
        existingFeedUrl,
        selected,
        updates: buildUpdateFields(record, selected, "existing"),
      };
    } catch (error) {
      return {
        recordId: record.id,
        name,
        mode: "existing",
        existingFeedUrl,
        error: error.message,
        updates: {
          [FIELD.rssStatus]: "Broken",
          [FIELD.rssLastVerifiedAt]: new Date().toISOString(),
          [FIELD.researchConfidence]: "Medium",
          [FIELD.rssDuplicateNotes]: `Existing feed failed validation: ${error.message}`,
        },
      };
    }
  }

  const discovery = await discoverCandidates(record);

  return {
    recordId: record.id,
    name,
    mode: "discovery",
    discovery,
    selected: discovery.selected,
    updates: discovery.selected
      ? buildUpdateFields(record, discovery.selected, "discovered", discovery)
      : buildNoMatchUpdate(discovery),
  };
}

async function main() {
  await loadEnvFile();

  const airtableToken = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT_TOKEN;

  if (!airtableToken) {
    throw new Error("Missing AIRTABLE_API_KEY, AIRTABLE_TOKEN, or AIRTABLE_PAT_TOKEN in the environment or .env file");
  }

  if (APPLY_FROM_FILE) {
    if (!APPLY_UPDATES) {
      throw new Error("APPLY_FROM_FILE requires APPLY_UPDATES=true");
    }

    const reviewedResults = JSON.parse(await fs.readFile(resolveRepoPath(APPLY_FROM_FILE), "utf8"));
    const applicableResults = reviewedResults.filter((result) => result.recordId && result.updates && Object.keys(result.updates).length);

    console.log(`Applying ${applicableResults.length} reviewed updates from ${APPLY_FROM_FILE}.`);

    for (const [index, result] of applicableResults.entries()) {
      console.log(`[${index + 1}/${applicableResults.length}] Updating ${result.name || result.recordId}`);
      await updateRecord(airtableToken, result.recordId, result.updates);
      await sleep(DELAY_MS);
    }

    console.log("Done applying reviewed updates.");
    return;
  }

  const allRecords = await listRecords(airtableToken);
  const outputPath = resolveRepoPath(OUTPUT_FILE);
  const records = allRecords.filter(shouldProcess).slice(START_INDEX, START_INDEX + MAX_ROWS);
  const results = [];

  console.log(`Loaded ${allRecords.length} records. Processing ${records.length} from filtered index ${START_INDEX}.`);
  console.log(APPLY_UPDATES ? "Airtable updates are enabled." : "Dry run only. No Airtable rows will be changed.");

  for (const [index, record] of records.entries()) {
    const name = record.fields[FIELD.name] || record.id;
    console.log(`[${START_INDEX + index + 1}] Checking ${name}`);

    const result = await processRecord(record);
    results.push(result);

    if (APPLY_UPDATES && result.updates && Object.keys(result.updates).length) {
      console.log(`Updating ${name}`);
      await updateRecord(airtableToken, record.id, result.updates);
    }

    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    await sleep(DELAY_MS);
  }

  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`Done. Wrote ${OUTPUT_FILE}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
