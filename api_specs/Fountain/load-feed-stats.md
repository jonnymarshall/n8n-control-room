# Feed Stats

> `GET https://api.fountain.fm/v1/feeds/{feed_id}/stats`

Read a feed’s download stats, plus payment stats once it is published — unpublished feeds report downloads only. `group_by` dimensions differ in coverage: `CONTENT` and `APP` cover both downloads and payments, `COUNTRY`/`PLATFORM` are downloads-only (revenue and supporters `0`), and `ACTION`/`SUPPORTER` are payments-only (downloads `0`). Under `CONTENT` each `group.content` is a hosting item id; rows from deleted items and livestreams are omitted from the breakdown but still counted in the feed totals.

## Path parameters

- `feed_id` (string, required) — The feed to read stats for.

## Query parameters

- `start` (string, optional) — ISO-8601 inclusive range start; also enables the `previous` comparison window.
- `end` (string, optional) — ISO-8601 inclusive range end.
- `bucket` (string, optional) — Bucket size for the `buckets` time series: `DAY`, `WEEK` or `MONTH`. Omit for totals only.
- `group_by` (string, optional) — Comma-separated breakdown dimensions: `CONTENT`, `COUNTRY`, `PLATFORM`, `APP`, `ACTION`, `SUPPORTER`.

## Responses

### 200 — The feed stats.

- `stats` ([Stats](/docs/models/stats.md), required) — The feed stats.

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
curl -X GET "https://api.fountain.fm/v1/feeds/{feed_id}/stats" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
