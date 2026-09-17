# Fountain API

Load shows and episodes, search across transcripts and publish your own podcasts.

New here? Start with [Getting Started](/docs/getting-started.md) — it covers API keys, authentication and your first request.

## Endpoints

Every endpoint is served from `https://api.fountain.fm/v1`.

### Project — **draft**

Your API project: credits, feeds and shows, preferences, email reports

- [List Projects](/docs/endpoints/project/list-projects.md) — `GET /projects` — List the projects your key can access. — **draft**
- [Load Project](/docs/endpoints/project/load-project.md) — `GET /projects/{id}` — Get a project overview. — **draft**
- [Get Project Stats](/docs/endpoints/project/load-project-stats.md) — `GET /projects/{id}/stats` — Get transcript indexing progress for the connected shows. — **draft**
- [Load Project Preferences](/docs/endpoints/project/load-project-preferences.md) — `GET /projects/{id}/preferences` — Get the project preferences. — **draft**
- [Update Project Preferences](/docs/endpoints/project/update-project-preferences.md) — `PATCH /projects/{id}/preferences` — Replace the project preferences. — **draft**
- [Connect Show](/docs/endpoints/project/connect-project-show.md) — `POST /projects/{id}/shows` — Connect an existing show to your project. — **draft**
- [Send Project Report](/docs/endpoints/project/send-project-report.md) — `POST /projects/{id}/reports` — Send a report via email — **draft**

### Content — **draft**

Load shows, episodes, albums and tracks; load and generate enriched transcripts

- [Load Content](/docs/endpoints/content/load-content.md) — `GET /content/{id}` — Load a single piece of content by ID. — **draft**
- [Load Content Children](/docs/endpoints/content/load-content-children.md) — `GET /content/{id}/children` — Load child content, e.g. the episodes of a show. — **draft**
- [Load Transcript](/docs/endpoints/content/load-content-transcript.md) — `GET /content/{id}/transcript` — Load the transcript for an episode. — **draft**
- [Generate Transcript](/docs/endpoints/content/generate-content-transcript.md) — `POST /content/{id}/transcript/generate` — Generate a transcript for an episode. — **draft**

### Search — **draft**

Search across Fountain: content, transcripts, and Nostr profiles

- [Search Content](/docs/endpoints/search/search-content.md) — `POST /search/content` — Search shows, episodes, albums and tracks. — **draft**
- [Search Transcripts](/docs/endpoints/search/search-transcripts.md) — `POST /search/transcripts` — Search episode transcripts. — **draft**
- [Search Profiles](/docs/endpoints/search/search-profiles.md) — `POST /search/profiles` — Search listener and creator profiles. — **draft**

### Publishing

Host podcasts on Fountain: manage feeds and items. A feed/item is the internal representation of a public show/episode.

- [List Feeds](/docs/endpoints/publishing/list-feeds.md) — `GET /feeds` — List the feeds you host.
- [Load Feed](/docs/endpoints/publishing/load-feed.md) — `GET /feeds/{feed_id}` — Read a single feed.
- [Update Feed](/docs/endpoints/publishing/update-feed.md) — `PATCH /feeds/{feed_id}` — Edit a feed.
- [Feed Stats](/docs/endpoints/publishing/load-feed-stats.md) — `GET /feeds/{feed_id}/stats` — Read a feed’s download and payment stats.
- [List Items](/docs/endpoints/publishing/list-items.md) — `GET /feeds/{feed_id}/items` — List a feed's items.
- [Create Item](/docs/endpoints/publishing/create-item.md) — `POST /feeds/{feed_id}/items` — Create a draft item.
- [Load Item](/docs/endpoints/publishing/load-item.md) — `GET /feeds/{feed_id}/items/{item_id}` — Read a single item.
- [Update Item](/docs/endpoints/publishing/update-item.md) — `PATCH /feeds/{feed_id}/items/{item_id}` — Edit an item.
- [Delete Item](/docs/endpoints/publishing/delete-item.md) — `DELETE /feeds/{feed_id}/items/{item_id}` — Delete an item.
- [Publish Item](/docs/endpoints/publishing/publish-item.md) — `POST /feeds/{feed_id}/items/{item_id}/publish` — Publish an item now.
- [Schedule Item](/docs/endpoints/publishing/schedule-item.md) — `POST /feeds/{feed_id}/items/{item_id}/schedule` — Schedule an item for later.
- [Item Stats](/docs/endpoints/publishing/load-item-stats.md) — `GET /feeds/{feed_id}/items/{item_id}/stats` — Read an item’s download and payment stats.

### Uploads

Upload media; shared by the Publishing and Social APIs.

- [Start Upload](/docs/endpoints/uploads/create-upload.md) — `POST /uploads` — Start a media upload.
- [Get Upload](/docs/endpoints/uploads/load-upload.md) — `GET /uploads/{id}` — Poll a media upload.
- [Finalize Upload](/docs/endpoints/uploads/finalize-upload.md) — `POST /uploads/{id}/finalize` — Finalize a media upload.

### Social — **draft**

Connect social channels and publish posts to them.

- [List Social Channels](/docs/endpoints/social/list-social-channels.md) — `GET /social/channels` — List the connected social channels. — **draft**
- [Add Social Channel](/docs/endpoints/social/add-social-channel.md) — `POST /social/channels` — Start connecting a social channel. — **draft**
- [Reconnect Social Channel](/docs/endpoints/social/reconnect-social-channel.md) — `PATCH /social/channels/{id}` — Restart OAuth for an existing channel. — **draft**
- [List Social Posts](/docs/endpoints/social/list-social-posts.md) — `GET /social/posts` — List the social posts. — **draft**
- [Create Social Post](/docs/endpoints/social/add-social-post.md) — `POST /social/posts` — Create a social post. — **draft**
- [Load Social Post](/docs/endpoints/social/load-social-post.md) — `GET /social/posts/{id}` — Load a single social post. — **draft**
- [Update Social Post](/docs/endpoints/social/update-social-post.md) — `PATCH /social/posts/{id}` — Update a social post. — **draft**
- [Delete Social Post](/docs/endpoints/social/delete-social-post.md) — `DELETE /social/posts/{id}` — Delete a social post. — **draft**

## Models

Reusable data shapes returned across the API.

- [AudioMetadata](/docs/models/audio-metadata.md) — ID3 tags extracted from an uploaded audio file.
- [ContentHit](/docs/models/content-hit.md) — The core content object returned across the API.
- [ContentID](/docs/models/content-id.md) — A string that uniquely identifies a piece of content.
- [ContentType](/docs/models/content-type.md) — The kind of content a hit represents.
- [Feed](/docs/models/feed.md) — A podcast feed you host.
- [Item](/docs/models/item.md) — An item in a feed you host.
- [ItemStatus](/docs/models/item-status.md) — The publishing state of an item.
- [JobStatus](/docs/models/job-status.md) — The lifecycle state of an asynchronous job.
- [Media](/docs/models/media.md) — A tracked media upload.
- [MediaKind](/docs/models/media-kind.md) — The kind of media an upload holds.
- [MediaStatus](/docs/models/media-status.md) — The processing state of a media upload.
- [NostrProfile](/docs/models/nostr-profile.md) — A Nostr profile indexed in the Fountain graph.
- [PodcastCategory](/docs/models/podcast-category.md) — A category a podcast show can be listed under.
- [ProjectOverview](/docs/models/project-overview.md) — An API project, its credit balance and connected content.
- [SocialChannel](/docs/models/social-channel.md) — A connected social channel.
- [SocialChannelStatus](/docs/models/social-channel-status.md) — The connection state of a social channel.
- [SocialPlatform](/docs/models/social-platform.md) — A social platform a project can connect a channel to.
- [SocialPost](/docs/models/social-post.md) — A social post created through the Fountain API.
- [SocialPostMediaSource](/docs/models/social-post-media-source.md) — The segment of Fountain content a social post was cut from.
- [SocialPostPublishMode](/docs/models/social-post-publish-mode.md) — How a post should be approved, scheduled or published when updated.
- [SocialPostStats](/docs/models/social-post-stats.md) — Engagement figures for a published social post.
- [SocialPostStatus](/docs/models/social-post-status.md) — The lifecycle state of a social post.
- [SocialPostUpload](/docs/models/social-post-upload.md) — Media attached to a social post.
- [SocialPostUploadType](/docs/models/social-post-upload-type.md) — The type of media attached to a social post.
- [Stats](/docs/models/stats.md) — A feed’s or item’s download and payment statistics.
- [StatsBucket](/docs/models/stats-bucket.md) — A metric attributed to a single time bucket.
- [StatsMetric](/docs/models/stats-metric.md) — One period’s aggregate figures.
- [StatsRow](/docs/models/stats-row.md) — One group’s figures: current totals, the prior window, and an optional time series.
- [TranscriptSegment](/docs/models/transcript-segment.md) — A span of transcript text with start and end times.
