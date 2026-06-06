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

### Scheduling
- Confirm record date & time [C]

### Research & Scripting
- Research Trending Stories on YouTube (Auto triggered every Friday by N8N)
- Research Trending Stories on X (Auto triggered every Friday by N8N) #Phase2
- Research Trending Stories on Reddit (Auto triggered every Friday by N8N) #Phase2
- Send research on via AgentEmail to Jonny & Guy (Auto triggered by N8N)
- Notify on Telegram that research is ready and await confirmation of picked stories (Auto triggered by N8N)
- Pick 2 Stories to record [G]
- Confirm stories to create script for (Manual Trigger: Telegram)
- Generate Script (Auto triggered by N8N)

### Recording
- Record Takes [J & G]

### Post-record
- Download transcript from Riverside [J] (Trigger: Airtable)
- Run export with 60% audio enhance [J] (Trigger: Airtable)
- Download recording [J] (Trigger: Airtable)

### Editing
- Create edited episode [J] (Auto Trigger: Frame.io)
- Supply references [J] (Manual Trigger: Telegram)

### AI Analysis
- Generate title options (Auto Trigger: Airtable)
- Generate thumbnail caption options (Auto Trigger: Airtable)
- Generate Description (Auto Trigger: Airtable)
- Generate SEO friendly chapter markers (Auto Trigger: Airtable)

### Approvals
- Approve specific title [J] (Manual Trigger: Telegram)
- Approve specific thumbnail caption [J] (Manual Trigger: Telegram)

### Artwork
{Artwork formats} [J]

### Publishing & Social (Full episode)
- {Publishing Channels}

### Social Interaction (~24 hour sweep)
- {Social Interaction Channels} - Nostr [C]
- Nostr [J]

## Social Interaction (~48 hour sweep)
- {Social Interaction Channels} - Nostr [C]
- Nostr [J]