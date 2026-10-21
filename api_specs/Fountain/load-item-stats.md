# Item Stats

> `GET https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}/stats`

Read a single item’s stats — the same shape and params as [Feed Stats](/docs/endpoints/publishing/load-feed-stats.md), scoped to one item. `group_by=CONTENT` is a per-episode breakdown and is not valid here: it returns `400 BAD_REQUEST`.

## Path parameters

- `feed_id` (string, required) — The feed the item belongs to.
- `item_id` (string, required) — The item to read stats for.

## Query parameters

- `start` (string, optional) — ISO-8601 inclusive range start; also enables the `previous` comparison window.
- `end` (string, optional) — ISO-8601 inclusive range end.
- `bucket` (string, optional) — Bucket size for the `buckets` time series: `DAY`, `WEEK` or `MONTH`. Omit for totals only.
- `group_by` (string, optional) — Comma-separated breakdown dimensions: `COUNTRY`, `PLATFORM`, `APP`, `ACTION`, `SUPPORTER`.

## Responses

### 200 — The item stats.

- `stats` ([Stats](/docs/models/stats.md), required) — The item stats.

```json
{
  "ok": true,
  "stats": {
    "rows": [
      {
        "group": {},
        "total": {
          "downloads": 1240,
          "revenue_usd": 32.5,
          "revenue_satoshis": 48210,
          "supporters": 18
        },
        "previous": {
          "downloads": 980,
          "revenue_usd": 24,
          "revenue_satoshis": 35600,
          "supporters": 14
        }
      }
    ],
    "meta": {}
  }
}
```

## Example

```bash
curl -X GET "https://api.fountain.fm/v1/feeds/{feed_id}/items/{item_id}/stats" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
