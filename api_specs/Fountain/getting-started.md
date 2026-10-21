# Getting Started

Make your first authenticated request to the Fountain API.

## 1. Get an API key

Create a Project API Key at [https://fountain.fm/studio/api](https://fountain.fm/studio/api). Save the key directly or copy the instructions for your agent to save the key in a secure way.

## 2. Authenticate

Every endpoint is served from `https://api.fountain.fm/v1` and takes the key as a bearer token in the `Authorization` header:

```
Authorization: Bearer <FOUNTAIN_API_KEY>
```

## 3. Your first request

[List Feeds](/docs/endpoints/publishing/list-feeds.md) — List the feeds you host.

```bash
curl -X GET "https://api.fountain.fm/v1/feeds" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```

## Draft endpoints

Endpoints marked **draft** are documented but unreleased: they may change or disappear without notice, and are not covered by any stability guarantee. Build against them only if you are willing to follow those changes.

## Next steps

- [API reference](/docs.md) — every endpoint, grouped
- [Models](/docs.md#models) — the data shapes returned across the API
