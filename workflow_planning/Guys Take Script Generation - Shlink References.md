# Guy's Take Script Generation — Shlink Reference Shortening

This note documents the exact workflow change to shorten reference URLs before they are written to
`Episodes.References` in Airtable.

## Goal

Only URLs inside **Module 5: References** are shortened. All other modules and fields stay unchanged.
If shortening fails, the workflow must fall back to the original URLs so the run still completes.

## Where the change goes

Workflow: **BA - Guy's Take Script Generation** (`q80QVMszf2iOfwIy`)

Insert a **Code** node named **Shorten Reference Links** between:

`Generate Script` → **Shorten Reference Links** → `Create Episode`

The node takes `output.references` and returns a modified string. `Create Episode` should map
`References = output.references` from this node's output.

## Required environment (in server .env only)

- `SHLINK_BASE_URL` (example: `https://shlink.example.com`)
- `SHLINK_API_KEY`
- `SHLINK_DOMAIN` (optional; short domain string like `s.example.com`)

## Shlink API behavior

Use the REST API with `Accept: application/json` and `X-Api-Key` headers.

Endpoint:

- `POST /rest/v3/short-urls`

Body:

```json
{
  "longUrl": "https://example.com/some/long/url",
  "domain": "s.example.com"
}
```

The response includes `shortUrl`, which should replace the original URL. If a request fails (timeout,
non-2xx, or invalid response), keep the original URL.

## Suggested Code node logic (pseudocode)

1. Read `const references = $input.first().json.output.references`.
2. Extract all URLs with a conservative regex like `/https?:\/\/[^\s)\]]+/g`.
3. For each URL:
   - Call Shlink.
   - Replace the URL in the references string with `shortUrl`.
4. Return the original item JSON with `output.references` replaced.

## Safety rules

- Only operate on `output.references`.
- If `SHLINK_BASE_URL` or `SHLINK_API_KEY` is missing, do nothing and return input unchanged.
- Never throw on errors; log and continue.

## Example Code node (n8n JavaScript)

```js
const input = $input.first();
const data = JSON.parse(JSON.stringify(input.json));

const baseUrl = process.env.SHLINK_BASE_URL;
const apiKey = process.env.SHLINK_API_KEY;
const domain = process.env.SHLINK_DOMAIN || undefined;

const references = data.output?.references;
if (!references || !baseUrl || !apiKey) {
  return [data];
}

const urlRegex = /https?:\/\/[^\s)\]]+/g;
const urls = Array.from(new Set(references.match(urlRegex) || []));

async function shorten(url) {
  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v3/short-urls`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ longUrl: url, domain }),
  });

  if (!resp.ok) {
    return url;
  }

  const payload = await resp.json();
  return payload?.shortUrl || url;
}

let updated = references;
for (const url of urls) {
  try {
    const shortUrl = await shorten(url);
    updated = updated.split(url).join(shortUrl);
  } catch (err) {
    // keep original URL on error
  }
}

data.output.references = updated;
return [data];
```

Notes:

- `fetch` is available in the n8n Code node runtime; if it is not on your instance, swap in `axios`.
- If you want per-link retry or rate limiting, add a small retry loop inside `shorten()`.
