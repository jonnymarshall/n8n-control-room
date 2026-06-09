# Guy's Take

## Constants
Publishing Channels = {
  - Pod feed,
  - X,
  - YouTube,
  - Rumble,
  - Keet,
  - Instagram,
  - Nostr
}

Social Interaction Channels = {
  X,
  YouTube,
  Rumble,
  Instagram,
  Nostr
}

Artwork formats = {
  - 16X9,
  - 1X1 (Reversioning),
  - 9X16 (Reversioning)
}

## Workflow

### Scheduling (Thursday)
- 🤖 Create episode in Airtable
  -- Episode.RecordingStatus: Unscheduled
- 🤖 Suggest recoring options on Telegram to group (Monday or Tuesday, 9, 10 or 11AM ET)
  -- Episode.RecordingStatus: Awaiting confirmation
- ☝️ Confirm record slot (Telegram - Guy)
- 🤖 Create calendar event for recording and invite Jonny and Guy
  -- Episode.RecordingStatus: Scheduled
  -- Episode.RecordDateTime: <RecordDateTime>

### Research & Scripting (Friday)
- 🤖 Research trending stories
  - 🤖 Create shortlist
    - YouTube (Phase 1) ✅
    - X (Phase 2)
    - Reddit (Phase 3)
  - 🤖 Suggest 8X shortlisted topics on Telegram (Await confirmation)
  -- Episode.Shortlist: <Link to 8X possible topics>
- ☝️ Confirm 2X topics to create script for (Telegram - Guy)
- 🤖 Create 2X Topics: <Link to 2X chosen topics>

### Scripting
- 🤖 Generate Script for 2X topics and create script pages (HTML?)
  -- Topic.Script: <Script>
- 🤖 Send link to scripts on Telegram

### Recording
- 🎙️ Record 2X Take episodes
- 🤖 Send message to Telegram asking to confirm recording complete 2H after RecordDateTime
  -- Episode.RecordingStatus: Recorded

### Post-record
- Download transcript from Riverside [J] (Trigger: Airtable)
- Run export with 60% audio enhance [C] (Trigger: Airtable)
- Download recording [J] (Trigger: Airtable)

### Editing
- ▶️ Create edited episode [J]
- 📝 Create references.md [J]
- 📁 Put both on Frame.io [J]

### AI Titles, Thumbnail Captions, Description & Chapter Markers
- 🤖 Generate title options
- 🤖 Generate thumbnail caption options
- 🤖 Generate Description
- 🤖 Generate SEO friendly chapter markers
- 🤖 Suggest Titles, Thumbnail Captions & Description on Telegram
- ☝️ Approve specific title [J]
- ☝️ Approve specific thumbnail caption [J]

### Artwork
- 🤖 Generate 5X 16X9 YouTube Thumbnail options and send on Telegram
- ☝️ Confirm YouTube Thumbnail
- 🤖 Generate 1X1 and 9X16 version of confirmed Thumbnail
- ☝️ Confirm 1X1 and 9X16 Thumbnail versions

### Publishing & Social (Full episode)
- {Publishing Channels}

### Social Interaction (~24 hour sweep)
- {Social Interaction Channels} - Nostr [C]
- Nostr [J]

## Social Interaction (~48 hour sweep)
- {Social Interaction Channels} - Nostr [C]
- Nostr [J]