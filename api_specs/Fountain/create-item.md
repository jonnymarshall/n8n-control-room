# Create Item

> `POST https://api.fountain.fm/v1/feeds/{feed_id}/items`

Create a `DRAFT` item. All fields are updated later via [Update Item](/docs/endpoints/publishing/update-item.md).

## Path parameters

- `feed_id` (string, required) — The feed to add the item to.

## Responses

### 200 — The new draft item.

- `item` ([Item](/docs/models/item.md), required) — The new item.

```json
{
  "ok": true,
  "item": {
    "id": "e5f6g7h8",
    "status": "DRAFT",
    "updated": "2026-02-18T22:03:53.467Z"
  }
}
```

## Example

```bash
curl -X POST "https://api.fountain.fm/v1/feeds/{feed_id}/items" \
  -H "Authorization: Bearer $FOUNTAIN_API_KEY"
```
