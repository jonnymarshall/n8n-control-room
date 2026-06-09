---
name: guys-take-script
description: Generates natural, high-retention talking-head video scripts, structural prompt outlines, highly competitive titles, thumbnail copy, and optimized descriptions for YouTube videos 5-12 minutes long. Tailored for crypto, geopolitics, sovereign tech, privacy, and economics niches. Use when creating optimized content architectures and host guide prompts. Stage 2 of the Guy's Take pipeline — run after one or more topics are chosen from guys-take-ideas (supports scripting multiple ideas in one run, typically 2 per week).
license: MIT
metadata:
  version: "2.0"
  author: Jonny
---

# Guy's Take Scripting Skill

This skill provides a structured framework for generating 5–12 minute talking-head YouTube video frameworks. Instead of rigid, word-for-word teleprompter scripts, this skill focuses on generating **Internal Leading Questions** and **Pacing Milestones** that allow a host to speak organically while maintaining maximum algorithmic retention.

Additionally, it generates click-through assets (Viral Titles, Thumbnail Captions, and SEO Descriptions) to maximize initial algorithmic impressions.

---

## Pipeline Context

This is **stage 2** of the weekly Guy's Take workflow. It normally runs after `guys-take-ideas` has produced `Ideas.md` and the user has chosen which topics to script.

### Selecting topics (multi-select)

The week normally produces **two Guy's Take episodes**, so this skill is built to script **one or more ideas in a single run** — do not assume just one.

1. **If the user already named the topics** (e.g. "script ideas 1 and 4", or gave titles), use those and skip the prompt.
2. **Otherwise, read `Ideas.md` and ask the user to choose**, presenting the shortlist with **multi-selection enabled** so they can pick several at once. Default the framing to "pick the ones you want (usually 2)." Use the `AskUserQuestion` tool with `multiSelect: true`. If there are more ideas than the question UI can show at once, list the full shortlist in chat first so every idea is selectable (the user can also choose "Other" to name any by number/title).
3. **Confirm the selection**, then generate a **separate, complete Asset Package for each chosen idea** (run all four modules per topic). Process them one at a time, each into its own episode folder.

- **Input:** the chosen topic(s) (working title + angle). For each idea taken from an `Ideas.md` entry, pull the hook and source context from there; also reference the original `Research/` digest for supporting facts, figures, and source links.
- **Output location:** for **each** chosen topic, create its own episode folder `GuysTake_WeekN/GuysTake_WeekN_[ShortenedTopic]/` and save that topic's package as `Asset_Package.md` inside it. (Use a short CamelCase topic slug per episode, e.g. `MicrostrategySellsBTC`.) Two selected ideas → two episode folders, two `Asset_Package.md` files.
- If run standalone (no idea/digest), just prompt for the topic(s) and proceed.

---

## The Core Algorithmic Framework

The YouTube algorithm acts as a **viewer satisfaction engine**, prioritizing *Average Percentage Viewed (APV)* and *Retention Curve Stability*. For a talking-head format, scripts must fight viewer drop-off using the following structural pillars:

1. **The 30-Second Scroll Stop:** Immediate verification of the thumbnail/title promise. No greetings, intros, or channel filler.
2. **Pattern Interrupts (60–90s):** Programmed changes in visual or narrative state (framing shifts, on-screen data/charts, or verbal bridge loops) to reset the viewer's attention span.
3. **Loop Chaining (Open/Closed):** Never answer a question without immediately posing the next layer of tension.
4. **Branded Outro + End-Screen Hold:** After the payoff, run the audience-participation outro (what-do-you-think questions, comment/like/share/subscribe), close on the Guy's Take sign-off, then hold the end-screen related-videos card. Skip limp "in conclusion" filler — the sign-off is the brand's, and the end-screen does the linking.

---

## Step-by-Step Generation Instructions

When executing this skill to generate a new content asset package, always output the following modules in order.

> **Auto slideshow:** writing `Asset_Package.md` triggers a hook that renders an `Asset_Package.html` storyboard deck (one slide per video section, same Pod 21 styling as the ideas deck). For it to work, **every section heading in the Script module must carry its runtime share as a `· NN%` token** (e.g. `### 1. The Hook · 7%`). The deck's progress bar advances by the cumulative % so you can "feel" the cut build. The %s across all beats should sum to ~100.

### Module 1: High-CTR Packaging Assets
Generate options designed to trigger high click-through rates (CTR) based on curiosity gap psychology and extreme relevance to the target demographic.
1. **5 Viral Title Options:** Keep titles under 50 characters when possible to prevent truncation on mobile screens. Focus on high stakes, negative framing (warnings), or massive curiosity gaps.
2. **5 Thumbnail Caption Options:** Short, punchy overlay text (up to 6 words) designed to contrast against and complement the title, not repeat it.

### Module 2: SEO Meta Architecture
Generate a highly descriptive video description containing natural target keywords to optimize search indexing and suggested video indexing.
* Include an above-the-fold value hook (first 2 lines). **This opening 1-2 liner is reused verbatim as the concept explainer on the slideshow's first/title page**, so make it a crisp, self-contained statement of what the video is about (like: "The world is celebrating the Bitcoin ETF as the moment Bitcoin won. But an IOU for Bitcoin held by one custodian is the exact thing Satoshi built Bitcoin to kill. Here's what nobody pitching the ETF will tell you.").
* Add a host-facing **SECTIONS** outline — short pointers describing what each part of the video should *cover* (not viewer-facing chapter titles), with **no timestamps**, since the real timings aren't known until the video is cut. Phrase them as build instructions (e.g. "Problem: people are celebrating custodied Bitcoin like ETFs as a win"), not catchy chapter names.
* Integrate keyword-rich paragraphs covering themes of Bitcoin, privacy, macroeconomics, or sovereign technology without keyword stuffing.

### Module 3: The Structural Timeline Matrix
Calculate word count thresholds based on target duration (assuming an optimal conversational speaking pace of 130–160 words per minute):

| Timeline | Phase | Objective | Host Target Focus |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:30** | **The Hook** | Stop the scroll; introduce the macro curiosity loop. | Address the highest-stakes fact immediately. |
| **0:30 - 1:15** | **The Stakes** | Connect the topic to the viewer's personal sovereignty/wallet. | Answer: "Why must I care *right now*?" |
| **1:15 - 6:30** | **The Core Body** | Deliver 3 logical insight points linked by open/closed loops. | Resolve data points; pivot immediately to complications. |
| **6:30 - 7:30** | **The Grand Payoff**| Deliver the ultimate conclusion promised in the hook. | Reassure or challenge the viewer with the raw truth. |
| **7:30 - End** | **Terminal CTA** | Drive session depth by passing the viewer to the next video. | Pitch the next video as the *only* solution to a new problem. |

### Module 3 (cont.): Video Timeline + Script & Storyboard
Open the script module with a **VIDEO TIMELINE** — a compact, proportional diagram of each section's rough share of total runtime (a small per-row block bar + the %). It's the human-readable twin of the `· NN%` tokens that drive the slideshow bar.

Then provide the **Script & Storyboard** as an ordered list of beats. Every beat is a `### ` heading ending in `· NN%`. For each beat give:
- **Leading Question(s):** one or two questions that prompt the host toward natural, unscripted delivery. Do **not** label them "internal" vs. not — the host decides that.
- **Concepts to cover:** a short bulleted list of the specific ideas, facts, and figures that answer the leading question(s). This is what the host builds the section from.
- **Visual Cues:** on-screen visual suggestions, ideally one paired to each concept (chart, number card, map, headline, B-roll, prop, shot change) — written as `— *Visual cue:* ...` on the concept line. Offer one or more options where useful.

Do **not** include "Host Delivery Guideline" lines.

**Two fixed beats — always include:**
- A **Guy's Take graphic** beat (the branded logo sting, 1–2 seconds) placed *immediately after* `### 1. The Hook`. Give it a small % (≈1%).
- An **Endframe Hold — Related Videos (12s)** beat as the final beat, after the Terminal CTA. The host bridges into it with no goodbye.

**Section-specific rules:**
- **The Hook is structured differently from every other beat — it does NOT dive into content.** It is: a punchy **big question or news event** (1-2 lines, e.g. "Everyone's cheering the ETFs… but wasn't third-party custody exactly what Bitcoin was built to abolish?"), then **2-4 open-ended questions** that tee up the episode ("Does this threaten Bitcoin?", "Where is all that Bitcoin actually held?", "Can we really expect everyone to hold their own keys?"), and it **always ends with the exact line: "It's time for a Guy's Take episode."** That line hands straight into the Guy's Take graphic beat.
- **The Grand Payoff must end positive.** Pick whichever fits: **(A)** how Bitcoin is designed to withstand and grow *stronger* through exactly the threat this video covered, or **(B)** the concrete action the viewer can take to protect themselves / increase their self-sovereignty through Bitcoin.
- **After the Grand Payoff, always add an Audience Participation beat** (the outro / CTA). It adds NO new argument — it: poses **1-2 open "what do you think?" questions** about the topic, invites the viewer to **comment** their take, **like** the video, **share it with someone** who needs it, and **subscribe** to keep up with the latest in Bitcoin and beyond, and it **closes on the exact line: "This has been my Guy's Take, see you in the next one."**
- **The Endframe Hold (12s) is the final slide and links to another episode.** Carry the related-video card options here: always **the week's *other* Guy's Take episode**, plus **2-3 loosely-related suggestions** (privacy, the Fed / economy, a self-custody how-to, etc.) for the editor to match to a real video.
- **Visual cues** are auto-styled in the slideshow (smaller, italic, brand-blue tint) so they read as editing notes rather than spoken lines — keep writing them as `— *Visual cue:* ...`.

### Module 4: Sponsor Plug (Bitbox) — insert the best one inline
The show has one sponsor: **Bitbox** — a Swiss-made, fully open-source, non-custodial hardware wallet (read `Bitbox_Overview.md` in the Takes root first). **Match the video's argument to a relevant Bitbox feature/value, pick the single strongest placement, and insert it inline in the Script & Storyboard as its own `### Sponsor: Bitbox — [angle] · NN%` beat** (≈6-8%) at that point, with a content bridge + 2-3 talking points. Then, under a `## MODULE 4: SPONSOR PLUGS — Bitbox` heading, note which option was placed inline and list any **alternative** plug options (placement + bridge + talking points) so the host can swap. Matching examples: custody/confiscation risk → self-custody, EAL6+ secure chip, eliminates counterparty risk, open-source; complexity/onboarding fear → 5-minute setup + microSD backup; supply-chain/trust → tamper-evident packaging; maximalist audience → Bitcoin-only edition's minimal attack surface.

### Module 5: References
A `## MODULE 5: REFERENCES` section listing articles, papers, filings, data, and source videos. Split into:
- **Cited in the video** — anything referenced directly on screen or verbally (give a link where known).
- **Suggested / optional** — credible sources the host *might* pull in to support the argument.
Use real, canonical links where you are confident; otherwise name the source precisely and mark it `(verify link)` rather than inventing a URL.

### Module 6: Editor's Resources
A `## MODULE 6: EDITOR'S RESOURCES` section: every asset needed to cut the video, with links where possible. Always include the **Guy's Take graphic/logo sting** and the **endframe related-videos hold template** as internal assets. Then list the visual cues from the storyboard as concrete to-source items: title/lower-third cards, charts/number cards, maps, headline screenshots, B-roll, props, the **Bitbox brand assets** (for the sponsor read), and a music bed. Mark internal items `[internal asset]`; for external items give a source link or a stock/archive pointer.

---

## Template Copy-Paste Resource

Use this skeleton layout whenever generating a new video blueprint for a user:

```markdown
# Asset Package: [Insert Topic Working Title]

## MODULE 1: VIRAL PACKAGING ASSETS
### 5 High-Viral Title Options (aim under ~50 chars)
1. 
2. 
3. 
4. 
5. 

### 5 Thumbnail Caption Options (up to 6 words)
1. 
2. 
3. 
4. 
5. 

## MODULE 2: SEO DESCRIPTION & SECTION OUTLINE
[Insert Paragraph 1: above-the-fold value hook + primary target keywords (first 2 lines).]

[Insert Paragraph 2: secondary semantic keywords + contextual links, no keyword stuffing.]

### SECTIONS (host build outline — what each beat should COVER; no timestamps)
- Hook: [what to open on]
- Stakes: [why the viewer must care right now]
- Point 1: [foundational context to establish]
- Point 2: [the complication / open loop]
- Point 3: [the actionable landscape]
- Payoff: [the conclusion to land]
- Next step: [the bridge into the next video]

## MODULE 3: VIDEO TIMELINE + SCRIPT & STORYBOARD

### Video Timeline (rough runtime share — drives the slideshow progress bar, sums to ~100)
- Hook ▓▓▓▓ — 7%
- Guy's Take logo ▏ — 1%
- Setup & Stakes ▓▓▓▓ — 9%
- Core · Point 1 ▓▓▓▓▓▓▓▓▓ — 18%
- Core · Point 2 ▓▓▓▓▓▓▓▓▓ — 18%
- Core · Point 3 ▓▓▓▓▓▓▓▓▓ — 18%
- Sponsor: Bitbox ▓▓▓▓ — 7%
- Grand Payoff ▓▓▓▓▓▓ — 13%
- Audience participation ▓▓▓ — 6%
- Endframe hold ▓▏ — 3%

### 1. The Hook · 7%
(Hook only — do NOT dive into content. Big question/news event, then open questions, then the fixed closing line.)
* **The big question / news event:** [1-2 punchy lines]
* **Open questions (pose, don't answer):**
    - [open question 1]
    - [open question 2]
    - [open question 3]
* **Close on:** "It's time for a Guy's Take episode."

### Guy's Take Graphic (1–2s) · 1%
* **Note:** Branded Guy's Take logo sting, 1–2 seconds, immediately after the cold-open hook. Fixed element — always include.

### 2. The Setup & Stakes · 9%
* **Leading Question(s):** 
* **Concepts to cover:**
    - [concept] — *Visual cue:* [...]

### 3. Core Body — Point 1: [Foundational Context] · 18%
* **Leading Question(s):** 
* **Concepts to cover:**
    - [concept] — *Visual cue:* [...]

### 4. Core Body — Point 2: [The Complication / Open Loop] · 18%
* **Leading Question(s):** 
* **Concepts to cover:**
    - [concept] — *Visual cue:* [...]

### 5. Core Body — Point 3: [The Actionable Landscape] · 18%
* **Leading Question(s):** 
* **Concepts to cover:**
    - [concept] — *Visual cue:* [...]

### Sponsor: Bitbox — [matched angle] · 7%
* **Content bridge:** [how the preceding beat sets the plug up naturally]
* **Talking points:**
    - [matched Bitbox feature / selling point]
    - [...]

### 6. The Grand Payoff · 13%
(End positive — choose A: how Bitcoin withstands/grows stronger through this exact threat, or B: what the viewer can do to protect themselves / gain sovereignty.)
* **Leading Question(s):** 
* **Concepts to cover:**
    - [concept] — *Visual cue:* [...]

### 7. Audience Participation — What Do You Think? · 6%
(Outro / CTA — no new argument. Pose, invite, sign off.)
* **Open questions to the audience:**
    - [open question 1 about the topic]
    - [open question 2]
* **Calls to action:**
    - Invite comments below with their take.
    - Like the video, and share it with someone who needs to see it.
    - Subscribe to keep up with the latest in Bitcoin and beyond.
* **Close on:** "This has been my Guy's Take, see you in the next one."

### Endframe Hold — Related Videos (12s) · 3%
* **Note:** 12-second end-screen hold; the final slide, linking to another episode. Fixed element — always include.
* **Related-video card options (pick on the day):**
    - This week's companion episode: [the other Week N video title]
    - [loosely-related topic, e.g. privacy / self-custody how-to] — find a video to link
    - [loosely-related topic, e.g. the Fed / fiat debasement] — find a video to link

## MODULE 4: SPONSOR PLUGS — Bitbox
Preferred plug is inserted inline above (the "Sponsor: Bitbox" beat). Alternatives the host can swap to:

### Alt Plug — suggested placement: [after which section]
- **Content bridge:** [how the preceding beat sets it up]
- **Bitbox angle:** [the matched feature / selling point]
- **Talking points:** [2-3 short bullets]

## MODULE 5: REFERENCES
**Cited in the video:**
- [source / publication] — [link, or (verify link)]

**Suggested / optional:**
- [credible source the host might pull in] — [link]

## MODULE 6: EDITOR'S RESOURCES
- Guy's Take logo sting (1–2s) — [internal asset]
- Endframe related-videos hold template (12s) — [internal asset]
- [Title / lower-third cards needed]
- [Charts / number cards]
- [Maps / headline screenshots]
- [B-roll] — [stock/archive source link]
- Bitbox brand assets (for the sponsor read) — [link]
- Music bed — [link]
```
